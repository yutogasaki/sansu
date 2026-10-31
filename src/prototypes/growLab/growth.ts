import { N, heightAt, indexOf, slopeAt, worldX, type Heights } from './terrain';
import { ROAD_HALF, type Road } from './roads';

// What the island grows by itself. Houses settle beside the roads, level a
// terrace for themselves on the slope, and face the road; trees take the green slopes the roads
// and houses leave free. Nothing is placed by the child except the special
// buildings, and the island keeps checking that everything still fits.

export interface House { id: number; x: number; z: number; rot: number; w: number; d: number; floors: number; tint: number; born: number }
export type TreeKind = 'pine' | 'cypress' | 'bush' | 'olive' | 'palm';
export interface Tree { id: number; x: number; z: number; kind: TreeKind; size: number; born: number }

/** Deterministic random numbers, so a sample grows the same way each time. */
export function rng(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const near = (x: number, z: number, roads: Road[], within: number) =>
    roads.some(r => r.line.some(([px, , pz]) => (px - x) ** 2 + (pz - z) ** 2 < within * within));

export function houseFits(h: Heights, roads: Road[], houses: House[], c: { x: number; z: number; w: number; d: number; id?: number }): boolean {
    const size = Math.max(c.w, c.d);
    // Sloping is fine, even steep: each house levels its own plot (see padHouses)
    // and stands on a white base built down the hill, as on a cliffside village.
    if (heightAt(h, c.x, c.z) < .3 || slopeAt(h, c.x, c.z) > 1.6) return false;
    if (near(c.x, c.z, roads, ROAD_HALF + .3 + size * .45)) return false;
    return houses.every(o => o.id === c.id || Math.hypot(o.x - c.x, o.z - c.z) > (Math.max(o.w, o.d) + size) * .5 + .12);
}

/**
 * A spot just off a road, facing it, or nothing if the roadsides are full.
 * With `close`, only roadside spots within reach of that point are tried.
 */
export function houseSpot(h: Heights, roads: Road[], houses: House[], rand: () => number, id: number, born: number, close?: { x: number; z: number; reach: number }, size?: { w: number; d: number }): House | undefined {
    if (!roads.length) return;
    const nearby = close && roads.flatMap(road => road.line.flatMap((p, k) =>
        k > 0 && k < road.line.length - 1 && (p[0] - close.x) ** 2 + (p[2] - close.z) ** 2 < close.reach ** 2 ? [{ road, k }] : []));
    if (nearby && !nearby.length) return;
    for (let tries = 0; tries < 40; tries++) {
        const pick = nearby ? nearby[Math.floor(rand() * nearby.length)] : undefined;
        const road = pick?.road ?? roads[Math.floor(rand() * roads.length)];
        if (road.line.length < 3) continue;
        const k = pick?.k ?? 1 + Math.floor(rand() * (road.line.length - 2));
        const [ax, , az] = road.line[k - 1], [bx, , bz] = road.line[k + 1];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const tx = (bx - ax) / len, tz = (bz - az) / len;
        const side = rand() < .5 ? 1 : -1;
        const w = size?.w ?? .7 + rand() * .5, d = size?.d ?? .6 + rand() * .4;
        const off = ROAD_HALF + .35 + Math.max(w, d) * .55 + rand() * .2;
        const x = road.line[k][0] - tz * side * off, z = road.line[k][2] + tx * side * off;
        const c = { id, x, z, w, d };
        if (!houseFits(h, roads, houses, c)) continue;
        // Face the road: the front looks back along the offset.
        const rot = Math.atan2(tz * side, -tx * side);
        const floors = 1 + (rand() < .7 ? 1 : 0) + (rand() < .35 ? 1 : 0) + (rand() < .08 ? 1 : 0);
        return { id, x, z, rot, w, d, floors, tint: Math.floor(rand() * 5), born };
    }
}

/**
 * A house the ground no longer suits moves to the nearest roadside that does,
 * keeping its size, colour and height, instead of vanishing; failing that, anywhere
 * along the roads. Only when no roadside on the island fits is it gone.
 */
export function moveHouse(h: Heights, roads: Road[], houses: House[], rand: () => number, o: House): House | undefined {
    for (const reach of [2, 4, 30]) {
        const spot = houseSpot(h, roads, houses, rand, o.id, o.born, { x: o.x, z: o.z, reach }, o);
        if (spot) return { ...spot, floors: o.floors, tint: o.tint };
    }
}

export function treeFits(h: Heights, roads: Road[], houses: House[], trees: Tree[], c: { x: number; z: number; id?: number }): boolean {
    const y = heightAt(h, c.x, c.z);
    // Steep ground is not left bare: bushes and creepers hold on up to a cliff.
    if (y < .35 || slopeAt(h, c.x, c.z) > 3) return false;
    if (near(c.x, c.z, roads, ROAD_HALF + .4)) return false;
    if (houses.some(o => Math.hypot(o.x - c.x, o.z - c.z) < Math.max(o.w, o.d) * .5 + .3)) return false;
    return trees.every(o => o.id === c.id || Math.hypot(o.x - c.x, o.z - c.z) > .5);
}

/**
 * Trees grow in groves: most new trees seed beside one already standing, so
 * the island has woods and open meadows rather than an even sprinkle. Palms
 * by the shore, pines and olives on the slopes, cypresses up high, bushes in
 * the gardens and on the steep sides.
 */
export function treeSpot(h: Heights, roads: Road[], houses: House[], trees: Tree[], rand: () => number, id: number, born: number): Tree | undefined {
    for (let tries = 0; tries < 30; tries++) {
        const roll = rand();
        const garden = houses.length && roll < .25;
        const grove = !garden && trees.length && roll < .8;
        let x: number, z: number;
        if (garden) {
            const o = houses[Math.floor(rand() * houses.length)];
            const a = rand() * Math.PI * 2, r = Math.max(o.w, o.d) * .5 + .45 + rand() * .4;
            x = o.x + Math.cos(a) * r; z = o.z + Math.sin(a) * r;
        } else if (grove) {
            const o = trees[Math.floor(rand() * trees.length)];
            const a = rand() * Math.PI * 2, r = .6 + rand() * .8;
            x = o.x + Math.cos(a) * r; z = o.z + Math.sin(a) * r;
        } else {
            x = (rand() - .5) * 18; z = (rand() - .5) * 18;
        }
        if (!treeFits(h, roads, houses, trees, { x, z })) continue;
        const y = heightAt(h, x, z);
        const kind: TreeKind = garden || slopeAt(h, x, z) > 1.6 ? 'bush'
            : y < 1.1 ? (rand() < .7 ? 'palm' : 'bush')
            : y > 3.2 && rand() < .6 ? 'cypress'
            : rand() < .3 ? 'olive' : rand() < .15 ? 'bush' : 'pine';
        // Every tree starts young and grows with the island (see grow in main).
        return { id, x, z, kind, size: .45 + rand() * .3, born };
    }
}

/**
 * Every house cuts a level terrace into the slope, the way hillside villages
 * are built: ground under it is levelled to its floor and eases back out to
 * the hill around it.
 */
export function padHouses(h: Heights, houses: House[]): Heights {
    const out = h.slice();
    for (const o of houses) {
        const floor = heightAt(h, o.x, o.z);
        const reach = Math.max(o.w, o.d) * .5 + .55;
        const i0 = Math.max(0, Math.floor(indexOf(o.x - reach))), i1 = Math.min(N - 1, Math.ceil(indexOf(o.x + reach)));
        const j0 = Math.max(0, Math.floor(indexOf(o.z - reach))), j1 = Math.min(N - 1, Math.ceil(indexOf(o.z + reach)));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const d = Math.hypot(worldX(i) - o.x, worldX(j) - o.z);
            if (d > reach) continue;
            const t = d < reach - .5 ? 1 : (reach - d) / .5;
            out[i + j * N] = out[i + j * N] * (1 - t) + floor * t;
        }
    }
    return out;
}
