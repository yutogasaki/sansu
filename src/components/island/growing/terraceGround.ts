import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TERRAIN_SEA_LEVEL } from '../../../domain/growingIsland/editableTerrainWorld';
import { landscapePoint } from '../../../domain/growingIsland/landscape';
import { TERRACE_BANK, islandShaping, type TerracePlan } from '../../../domain/growingIsland/terraceTerrain';
import type { Cell } from '../../../domain/growingIsland/types';
import type { SceneLayout } from './sceneLayout';

// The adopted native05 builds land as stacked rounded plates (Blender island_plate):
// each level's region is outlined, rounded and extruded with a soft bevel. This
// rebuilds that from the saved heights; the walkable floor stays the shared world mesh.
const SAMPLES = 8, MARGIN = 4;
const C = {
    meadow: new T.Color('#a3cc88'), light: new T.Color('#b7d496'),
    stone: new T.Color('#c9d1d4'), stoneDeep: new T.Color('#8e9db3'),
    lilac: new T.Color('#bcb8d3'), lilacDeep: new T.Color('#a29fc0'), sand: new T.Color('#e3d2ab'), sandDeep: new T.Color('#c9b48f'), stair: new T.Color('#c9c3dc'),
};
type Frame = { minX: number; minZ: number; cols: number; rows: number };
type Field = { values: Float32Array; width: number; depth: number };

function field(plan: TerracePlan, frame: Frame, inside: (level: number) => boolean, margin?: (p: Cell) => boolean): Field {
    const width = (frame.cols + MARGIN * 2) * SAMPLES, depth = (frame.rows + MARGIN * 2) * SAMPLES;
    let values = new Float32Array(width * depth);
    // The unowned meadow rim counts as level 0, so it joins every plate at or below it.
    const rim = margin && inside(0) ? margin : undefined;
    for (let j = 0; j < depth; j++) for (let i = 0; i < width; i++) {
        const x = frame.minX - MARGIN + Math.floor(i / SAMPLES), z = frame.minZ - MARGIN + Math.floor(j / SAMPLES);
        const id = `${x},${z}`, level = plan.levels.get(id);
        const own = level !== undefined && plan.dry.has(id) && inside(level);
        values[j * width + i] = own || (level === undefined && rim?.({ x: frame.minX - MARGIN - .5 + (i + .5) / SAMPLES, z: frame.minZ - MARGIN - .5 + (j + .5) / SAMPLES })) ? 1 : 0;
    }
    // A separable gaussian rounds convex and concave corners alike while a straight
    // edge keeps its iso-.5 line on the cell boundary, where the floor's cliff is.
    const sigma = .3 * SAMPLES, r = Math.ceil(sigma * 2.5), kernel: number[] = [];
    for (let k = -r; k <= r; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
    const sum = kernel.reduce((s, v) => s + v, 0);
    for (const vertical of [false, true]) {
        const next = new Float32Array(width * depth);
        for (let j = 0; j < depth; j++) for (let i = 0; i < width; i++) {
            let v = 0;
            for (let k = -r; k <= r; k++) {
                const ii = vertical ? i : Math.min(width - 1, Math.max(0, i + k)), jj = vertical ? Math.min(depth - 1, Math.max(0, j + k)) : j;
                v += values[jj * width + ii] * kernel[k + r];
            }
            next[j * width + i] = v / sum;
        }
        values = next;
    }
    return { values, width, depth };
}
/** Bilinear field value at a logical cell position. */
function sample(f: Field, frame: Frame, p: T.Vector2) {
    const fx = (p.x - (frame.minX - MARGIN - .5)) * SAMPLES - .5, fz = (p.y - (frame.minZ - MARGIN - .5)) * SAMPLES - .5;
    const i = Math.max(0, Math.min(f.width - 2, Math.floor(fx))), j = Math.max(0, Math.min(f.depth - 2, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j)), at = (a: number, b: number) => f.values[b * f.width + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
}

/** Marching squares on sample centres: closed loops in logical cell coordinates. */
function contours(f: Field, frame: Frame, iso: number): T.Vector2[][] {
    const point = (i: number, j: number) => new T.Vector2(frame.minX - MARGIN - .5 + (i + .5) / SAMPLES, frame.minZ - MARGIN - .5 + (j + .5) / SAMPLES);
    const v = (i: number, j: number) => f.values[j * f.width + i] - iso;
    const cut = (p: T.Vector2, q: T.Vector2, s: number, t: number) => p.clone().lerp(q, s / (s - t));
    // Oriented so the inside is consistently on one side; chains follow shared edge keys.
    const table: Record<number, [number, number][]> = {
        1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
        8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
    };
    const segments = new Map<string, [string, T.Vector2]>();
    for (let j = 0; j < f.depth - 1; j++) for (let i = 0; i < f.width - 1; i++) {
        const v0 = v(i, j), v1 = v(i + 1, j), v2 = v(i + 1, j + 1), v3 = v(i, j + 1);
        const code = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
        if (!table[code]) continue;
        const p0 = point(i, j), p1 = point(i + 1, j), p2 = point(i + 1, j + 1), p3 = point(i, j + 1);
        const at = [() => cut(p0, p1, v0, v1), () => cut(p1, p2, v1, v2), () => cut(p2, p3, v2, v3), () => cut(p3, p0, v3, v0)];
        const keys = [`h${i},${j}`, `v${i + 1},${j}`, `h${i},${j + 1}`, `v${i},${j}`];
        for (const [s, t] of table[code]) segments.set(keys[s], [keys[t], at[s]()]);
    }
    const loops: T.Vector2[][] = [];
    while (segments.size) {
        const [start] = segments.keys(); let id = start; const loop: T.Vector2[] = [];
        for (let guard = 0; guard < 200000; guard++) {
            const segment = segments.get(id); if (!segment) break;
            segments.delete(id); loop.push(segment[1]); id = segment[0];
            if (id === start) break;
        }
        if (loop.length > 3) loops.push(loop);
    }
    return loops;
}
type Colors = { cap: T.Color; side: (depthBelowTop: number) => T.Color };
// Field gradient at a straight edge is 1 / (sigma * sqrt(2 pi)) per cell; it converts the
// lip's width into the iso level of the cap edge, so the outer wall lands on `iso`.
const EDGE_GRADIENT = 1 / (.3 * Math.sqrt(2 * Math.PI));

/** Inside of the field at `iso`, cut on the same samples as the contour: whole blocks of
 * 8x8 inside squares become two triangles, boundary squares their marching polygons. */
function cap(f: Field, frame: Frame, iso: number, baseAt: (cell: Cell) => number, add: (polygon: T.Vector2[]) => void) {
    const point = (i: number, j: number) => new T.Vector2(frame.minX - MARGIN - .5 + (i + .5) / SAMPLES, frame.minZ - MARGIN - .5 + (j + .5) / SAMPLES);
    const v = (i: number, j: number) => f.values[j * f.width + i] - iso;
    const cut = (p: T.Vector2, q: T.Vector2, s: number, t: number) => p.clone().lerp(q, s / (s - t));
    const square = (i: number, j: number) => {
        const vs = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)], ps = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
        const code = (vs[0] > 0 ? 1 : 0) | (vs[1] > 0 ? 2 : 0) | (vs[2] > 0 ? 4 : 0) | (vs[3] > 0 ? 8 : 0);
        if (!code) return;
        if (code === 5 || code === 10) {
            // Saddles stay apart, as in the contour table.
            for (const c of code === 5 ? [0, 2] : [1, 3]) add([ps[c], cut(ps[c], ps[(c + 1) % 4], vs[c], vs[(c + 1) % 4]), cut(ps[(c + 3) % 4], ps[c], vs[(c + 3) % 4], vs[c])]);
            return;
        }
        const polygon: T.Vector2[] = [];
        for (let c = 0; c < 4; c++) {
            const n = (c + 1) % 4;
            if (vs[c] > 0) polygon.push(ps[c]);
            if ((vs[c] > 0) !== (vs[n] > 0)) polygon.push(cut(ps[c], ps[n], vs[c], vs[n]));
        }
        add(polygon);
    };
    // A block stays whole only while it is inside and the base is flat enough across it
    // that its two triangles follow the floor; otherwise it splits down to single squares.
    const block = (bi: number, bj: number, size: number) => {
        const ei = Math.min(f.width - 1, bi + size), ej = Math.min(f.depth - 1, bj + size);
        if (ei <= bi || ej <= bj) return;
        if (size === 1) { square(bi, bj); return; }
        let full = true;
        for (let j = bj; j <= ej && full; j++) for (let i = bi; i <= ei && full; i++) if (v(i, j) <= 0) full = false;
        if (full) {
            const corners = [point(bi, bj), point(ei, bj), point(ei, ej), point(bi, ej)], mid = corners[0].clone().lerp(corners[2], .5);
            const at = (p: T.Vector2) => baseAt({ x: p.x, z: p.y }), mean = (at(corners[0]) + at(corners[2])) / 2;
            const edgeMids = [0, 1, 2, 3].map(k => corners[k].clone().lerp(corners[(k + 1) % 4], .5));
            const flat = Math.abs(at(mid) - mean) < .006 && Math.abs(at(mid) - (at(corners[1]) + at(corners[3])) / 2) < .006
                && edgeMids.every((p, k) => Math.abs(at(p) - (at(corners[k]) + at(corners[(k + 1) % 4])) / 2) < .006);
            if (flat) { add(corners); return; }
        }
        const half = size / 2;
        for (const [di, dj] of [[0, 0], [half, 0], [0, half], [half, half]]) block(bi + di, bj + dj, half);
    };
    for (let bj = 0; bj < f.depth - 1; bj += SAMPLES) for (let bi = 0; bi < f.width - 1; bi += SAMPLES) block(bi, bj, SAMPLES);
}

/**
 * One rounded plate in the shared logical frame: a cap cut on the field's own samples,
 * a quarter-round lip and a wall down to `bottom`. Every vertex is lifted by the
 * continuous base, so on hills the plate still lies on the walkable floor.
 * `absoluteBottom` keeps the foundation's underside at the sea rather than the base.
 */
type Bank = { weight: (outside: T.Vector2) => number; drop: number; color: T.Color };
function plate(f: Field, frame: Frame, iso: number, bottom: number, top: number, bevel: number,
    colors: Colors, baseAt: (cell: Cell) => number, absoluteBottom = false, keep: (inside: T.Vector2) => boolean = () => true, bank?: Bank) {
    const positions: number[] = [], color: number[] = [], index: number[] = [];
    const push = (p: T.Vector2, y: number, c: T.Color, displace = true) => {
        positions.push(p.x, y + (displace ? baseAt({ x: p.x, z: p.y }) : 0), p.y); color.push(c.r, c.g, c.b); return positions.length / 3 - 1;
    };
    const edge = Math.min(.95, iso + bevel * EDGE_GRADIENT), segments = 4;
    type RingPoint = { offset: number; y: number; color: T.Color; displace: boolean };
    const cliff: RingPoint[] = [], soft: RingPoint[] = [];
    for (let k = 0; k <= segments; k++) {
        const t = k / segments * Math.PI / 2, drop = bevel * (1 - Math.cos(t));
        cliff.push({ offset: bevel * Math.sin(t), y: top - drop, color: colors.side(drop).clone().lerp(colors.cap, 1 - k / segments), displace: true });
        // A one-step bank: grass rolls down to the neighbour's level across the floor's bank.
        const u = k / segments, fall = (bank?.drop ?? 0) * (1 - Math.cos(Math.PI * u)) / 2;
        soft.push({ offset: (bevel + TERRACE_BANK) * u, y: top - fall, color: colors.cap.clone().lerp(bank?.color ?? colors.cap, Math.sin(Math.PI * u)), displace: true });
    }
    cliff.push({ offset: bevel, y: bottom, color: colors.side(top - bottom), displace: !absoluteBottom });
    soft.push({ offset: bevel + TERRACE_BANK, y: bottom, color: colors.side(top - bottom), displace: !absoluteBottom });
    const ringAt = (r: number, w: number): RingPoint => w <= 0 ? cliff[r] : w >= 1 ? soft[r] : {
        offset: cliff[r].offset + (soft[r].offset - cliff[r].offset) * w, y: cliff[r].y + (soft[r].y - cliff[r].y) * w,
        color: cliff[r].color.clone().lerp(soft[r].color, w), displace: cliff[r].displace,
    };
    for (const loop of contours(f, frame, edge)) {
        // Every crossing point is kept so the lip shares the cap's exact edge, with no T-junctions.
        const points = loop;
        const outward = points.map((_, i) => {
            const a = points[(i - 1 + points.length) % points.length], b = points[(i + 1) % points.length];
            return new T.Vector2(-(b.y - a.y), b.x - a.x).normalize();
        });
        // Outward is away from the field's inside, which also holds for a hole's loop.
        if (sample(f, frame, points[0].clone().addScaledVector(outward[0], .05)) > edge) outward.forEach(n => n.negate());
        const weights = points.map((p, i) => bank ? bank.weight(p.clone().addScaledVector(outward[i], .15)) : 0);
        const ids = cliff.map((_, r) => points.map((p, i) => {
            const ring = ringAt(r, weights[i]);
            return push(p.clone().addScaledVector(outward[i], ring.offset), ring.y, ring.color, ring.displace);
        }));
        const kept = points.map((p, i) => keep(p.clone().addScaledVector(outward[i], -.12)));
        for (let r = 0; r + 1 < cliff.length; r++) for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            if (!kept[i] && !kept[j]) continue;
            index.push(ids[r][i], ids[r][j], ids[r + 1][j], ids[r][i], ids[r + 1][j], ids[r + 1][i]);
        }
    }
    cap(f, frame, edge, baseAt, polygon => {
        const ids = polygon.map(p => push(p, top, colors.cap));
        for (let i = 1; i + 1 < ids.length; i++) index.push(ids[0], ids[i], ids[i + 1]);
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new T.Float32BufferAttribute(color, 3));
    g.setIndex(index);
    return g;
}

const wobble = (x: number, z: number) => .5 + .5 * Math.sin(x * .9 + Math.sin(z * 1.3)) * Math.sin(z * .7 + x * .2);
/** Maps logical cells through the same landscape projection as the floor. */
export function project(geometry: T.BufferGeometry, layout: SceneLayout) {
    const position = geometry.getAttribute('position'), colors = geometry.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
        const cell: Cell = { x: position.getX(i), z: position.getZ(i) }, p = layout.curved ? landscapePoint(cell) : cell;
        const shade = .97 + .06 * wobble(cell.x, cell.z);
        colors.setXYZ(i, colors.getX(i) * shade, colors.getY(i) * shade, colors.getZ(i) * shade);
        position.setXYZ(i, p.x - layout.center, position.getY(i), p.z - 2);
    }
    geometry.computeVertexNormals();
    return geometry;
}

export const hash = (x: number, z: number, salt: number) => { const v = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453; return v - Math.floor(v); };
const TUFT = ['#617c47', '#7f9856', '#a9b675'].map(c => new T.Color(c)), ROCK = ['#a7a593', '#b9b3c9', '#9f9c8c'].map(c => new T.Color(c));
export function tuft(x: number, y: number, z: number, size: number, seed: number) {
    const list: T.BufferGeometry[] = [];
    for (let j = 0; j < 4; j++) {
        const blade = new T.ConeGeometry(.028 * size, .2 * size * (.8 + hash(x, z, seed + j) * .5), 4, 1);
        blade.translate(0, .1 * size, 0); blade.rotateZ((j - 1.5) * .32); blade.rotateY(j * 1.7 + seed);
        blade.translate(x + (j - 1.5) * .03 * size, y, z);
        list.push(colored(blade, TUFT[(((seed + j) % 3) + 3) % 3])); blade.dispose();
    }
    return list;
}
export function rock(x: number, y: number, z: number, size: number, seed: number) {
    const stone = new T.DodecahedronGeometry(.1 * size, 0);
    stone.scale(1, .62, .85); stone.rotateY(seed * 2.1); stone.translate(x, y + .02 * size, z);
    const out = colored(stone, ROCK[((seed % 3) + 3) % 3]); if (out !== stone) stone.dispose(); return out;
}
export function colored(source: T.BufferGeometry, c: T.Color) {
    const g = source.index ? source.toNonIndexed() : source;
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    g.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: g.getAttribute('position').count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
}
/**
 * Ground cover read from the same plan: grass on the top of every one-step bank, rocks
 * and plants at the foot of a cliff and leaning over its lip, a few stones on the coast.
 * The open middle of each level stays clear for the child, and nothing lands on a cell
 * an owner, the home, the pier or a stair uses.
 */
function dressing(plan: TerracePlan, frame: Frame, levels: number[], rim?: (p: Cell) => boolean) {
    const list: T.BufferGeometry[] = [], cellOf = (p: T.Vector2) => `${Math.floor(p.x + .5)},${Math.floor(p.y + .5)}`;
    // The rim has no floor, so it is dressed at the base height, as level 0.
    const onRimCell = (p: T.Vector2) => !plan.levels.has(cellOf(p)) && Boolean(rim?.({ x: p.x, z: p.y }));
    const free = (p: T.Vector2) => (plan.dry.has(cellOf(p)) || onRimCell(p)) && !plan.occupied.has(cellOf(p));
    const floor = (p: T.Vector2) => onRimCell(p) ? plan.baseAt({ x: p.x, z: p.y }) : plan.heightAt({ x: p.x, z: p.y });
    levels.forEach((level, n) => {
        const f = field(plan, frame, l => l >= level, rim), lower = field(plan, frame, l => l >= level - 1, rim);
        const above = n + 1 < levels.length ? field(plan, frame, l => l >= levels[n + 1], rim) : undefined;
        for (const loop of contours(f, frame, .5)) {
            let walked = 0;
            for (let i = 0; i < loop.length; i++) {
                const a = loop[(i - 1 + loop.length) % loop.length], p = loop[i], b = loop[(i + 1) % loop.length];
                walked += p.distanceTo(a); if (walked < .28) continue; walked = 0;
                const out = new T.Vector2(-(b.y - a.y), b.x - a.x).normalize();
                if (sample(f, frame, p.clone().addScaledVector(out, .1)) > .5) out.negate();
                const inside = p.clone().addScaledVector(out, -.14), outside = p.clone().addScaledVector(out, .16);
                if (above && sample(above, frame, inside) >= .5) continue;
                const onRim = (q: T.Vector2) => level <= 0 && !plan.levels.has(cellOf(q)) && Boolean(rim?.({ x: q.x, z: q.y }));
                const coast = !plan.dry.has(cellOf(outside)) && !onRim(outside), bank = !coast && n > 0 && sample(lower, frame, outside) >= .5;
                const h = hash(p.x, p.y, level);
                if (bank) {
                    if (h < .45 && free(inside)) list.push(...tuft(inside.x, floor(inside), inside.y, .9 + h, i));
                } else if (coast) {
                    // Half sunk against the beach, so it reads as part of the shore.
                    const shore = p.clone().addScaledVector(out, .1);
                    if (n === 0 && h < .18 && free(inside)) list.push(rock(shore.x, TERRAIN_SEA_LEVEL + .02, shore.y, 1.2 + h * 3, i));
                } else {
                    if (h < .35 && free(outside)) list.push(rock(outside.x, floor(outside), outside.y, .9 + h * 2.4, i));
                    if (h > .45 && h < .85 && free(outside)) list.push(...tuft(outside.x + out.x * .08, floor(outside), outside.y + out.y * .08, 1.1, i));
                    if (h > .7 && free(inside)) list.push(...tuft(inside.x, floor(inside), inside.y, .8, i + 3));
                }
            }
        }
    });
    return list;
}

/**
 * The same coast outline the island shows before any edit (the native05 shore profile
 * around the acquired land), as a meadow rim outside the acquired cells. Like that
 * decorative bank it holds no floor, owners or routes; it stops where a coastal cell has
 * been dug, so a child's inlet still opens to the sea.
 */
const tightShore = () => islandShaping() || Boolean(import.meta.env?.DEV && import.meta.env.VITE_SHORE === 'tight');

/**
 * DEV `VITE_SHORE=tight`: the coast is drawn from the child's own land. A narrow beach of
 * meadow follows the dry cells at a gently wobbling width (fixed per place, so the shape
 * never shifts between visits): corners round off, a raised or extended edge pushes the
 * coast out, and a dug cell stays open water, so the child's coves and capes are the island.
 */
function landShore(plan: TerracePlan, bounds: { minX: number; maxX: number; depth: number }, bridgeX?: number, keep: { x: number; z: number; r: number }[] = []) {
    const smooth = (v: number) => v * v * (3 - 2 * v);
    const noise = (x: number, z: number) => {
        const gx = x / 1.7, gz = z / 1.7, ix = Math.floor(gx), iz = Math.floor(gz), u = smooth(gx - ix), v = smooth(gz - iz);
        const at = (a: number, b: number) => hash(ix + a, iz + b, 91);
        return (at(0, 0) * (1 - u) + at(1, 0) * u) * (1 - v) + (at(0, 1) * (1 - u) + at(1, 1) * u) * v;
    };
    const dry = [...plan.dry].map(k => k.split(',').map(Number));
    return (p: Cell) => {
        // Inside the acquired land, only the cells themselves decide: a dug cell stays water.
        if (p.x > bounds.minX - .5 && p.x < bounds.maxX + .5 && p.z > -.5 && p.z < bounds.depth - .5) return false;
        if (keep.some(disc => Math.hypot(p.x - disc.x, p.z - disc.z) < disc.r)) return true;
        if (Math.hypot(p.x - (bounds.maxX - 1), p.z - (bounds.depth - 1)) < 1.3) return false;
        if (bridgeX !== undefined && Math.abs(p.x - bridgeX) < 1 && p.z > bounds.depth - 1) return false;
        let nearest = Infinity;
        for (const [x, z] of dry) {
            if (Math.abs(p.x - x) > 2 || Math.abs(p.z - z) > 2) continue;
            nearest = Math.min(nearest, Math.hypot(Math.max(0, Math.abs(p.x - x) - .5), Math.max(0, Math.abs(p.z - z) - .5)));
        }
        return nearest < .18 + noise(p.x, p.z) * .62;
    };
}
function shoreRim(layout: SceneLayout, plan: TerracePlan, profile: readonly number[], bridgeX?: number) {
    const count = profile.length, halfX = layout.width / 2, halfZ = layout.depth / 2, centerZ = (layout.depth - 1) / 2;
    const smooth = (i: number) => [1, 2, 3, 2, 1].reduce((sum, weight, n) => sum + profile[(i + n - 2 + count * 4) % count] * weight, 0) / 9;
    const { minX, maxX, depth } = { minX: Math.round(layout.center - (layout.width - 1) / 2), maxX: Math.round(layout.center + (layout.width - 1) / 2), depth: layout.depth };
    return (p: Cell) => {
        const dx = p.x - layout.center, dz = p.z - centerZ, a = Math.atan2(dz, dx), c = Math.cos(a), s = Math.sin(a);
        const i = Math.round((a + Math.PI) / (Math.PI * 2) * count) % count;
        const r = Math.min(halfX / Math.max(1e-6, Math.abs(c)), halfZ / Math.max(1e-6, Math.abs(s)));
        // DEV `VITE_SHORE=tight`: the coast hugs the child's own land, so shaping the land edge shapes the island.
        const margin = tightShore() ? .3 + smooth(i) * .55 : .8 + smooth(i) * (layout.artMargin > 1.1 ? 2.25 : 1.1), rx = halfX + margin, rz = halfZ + margin;
        const outer = Math.max(r + .45, (Math.pow(Math.abs(c / rx), 4) + Math.pow(Math.abs(s / rz), 4)) ** -.25);
        if (Math.hypot(dx, dz) > outer) return false;
        // The pier (and an acquired lookout bridge) must still reach open water.
        if (Math.hypot(p.x - (maxX - 1), p.z - (depth - 1)) < 1.9) return false;
        if (bridgeX !== undefined && Math.abs(p.x - bridgeX) < 1 && p.z > depth - 1) return false;
        const nearest = `${Math.max(minX, Math.min(maxX, Math.round(p.x)))},${Math.max(0, Math.min(depth - 1, Math.round(p.z)))}`;
        return plan.dry.has(nearest);
    };
}

/**
 * `stone`: the published island's pale stone shore instead of native05 sand. `keep`: discs of
 * meadow beyond the land that carry published scenery (the old sheltering tree's roots).
 */
/** A special island's own ground colours (island-journey.md §4): grass, shore and cliff. */
export interface GroundPalette { meadow: string; light: string; sand: string; sandDeep: string; cliff: string; cliffDeep: string }
export interface TerraceGroundOptions { stone?: boolean; keep?: { x: number; z: number; r: number }[]; palette?: GroundPalette }
export function buildTerraceGround(layout: SceneLayout, plan: TerracePlan, profile?: readonly number[], bridgeX?: number, options: TerraceGroundOptions = {}) {
    const bounds = { minX: Math.round(layout.center - (layout.width - 1) / 2), maxX: Math.round(layout.center + (layout.width - 1) / 2), depth: layout.depth };
    const rim = tightShore() ? landShore(plan, bounds, bridgeX, options.keep) : profile?.length ? shoreRim(layout, plan, profile, bridgeX) : undefined;
    const tone = options.palette;
    const sand = tone ? new T.Color(tone.sand) : options.stone ? C.stone : C.sand, sandDeep = tone ? new T.Color(tone.sandDeep) : options.stone ? C.stoneDeep : C.sandDeep;
    const meadow = tone ? new T.Color(tone.meadow) : C.meadow, light = tone ? new T.Color(tone.light) : C.light;
    const lilac = tone ? new T.Color(tone.cliff) : C.lilac, lilacDeep = tone ? new T.Color(tone.cliffDeep) : C.lilacDeep;
    const root = new T.Group(); root.name = 'terrace-island-ground';
    const cells = [...plan.levels.keys()].map(k => k.split(',').map(Number));
    const frame: Frame = { minX: Math.min(...cells.map(c => c[0])), minZ: Math.min(...cells.map(c => c[1])), cols: 0, rows: 0 };
    frame.cols = Math.max(...cells.map(c => c[0])) - frame.minX + 1; frame.rows = Math.max(...cells.map(c => c[1])) - frame.minZ + 1;
    const dryLevels = [...new Set([...plan.dry].map(k => plan.levels.get(k)!))].sort((a, b) => a - b);
    const geometries: T.BufferGeometry[] = [];
    if (dryLevels.length) {
        const step = plan.step, dryCells = [...plan.dry].map(k => k.split(',').map(Number));
        // The beach ring sits just under the lowest level that actually meets the sea.
        const coast = dryCells.filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !plan.dry.has(`${x + dx},${z + dz}`)));
        const lowest = Math.min(...(coast.length ? coast : dryCells).map(([x, z]) => plan.levels.get(`${x},${z}`)!));
        // A sand foundation slightly wider than the lowest grass shows a beach ring.
        const sandField = field(plan, frame, l => l >= lowest, rim);
        geometries.push(plate(sandField, frame, .34, TERRAIN_SEA_LEVEL - .5, lowest * step - .05, .07, {
            cap: sand, side: depth => sand.clone().lerp(sandDeep, T.MathUtils.smoothstep(depth, .05, .5)),
        }, plan.baseAt, true));
        // Each level's plate spans everything at or above it, so a terrace's foot meets the
        // meadow without a groove. Its lip and wall are drawn only where the land just inside
        // is exactly this level, and walls start at the sea: the coast shows one wall, never
        // a stack of lips from levels that lie inland.
        dryLevels.forEach((level, n) => {
            // One meadow green for every level, a touch sunnier higher up: a level reads as
            // part of the same land, not a separately painted slab.
            const top = level * step, grass = meadow.clone().lerp(light, T.MathUtils.clamp(level, 0, 3) * .12);
            const f = field(plan, frame, l => l >= level, rim), above = n + 1 < dryLevels.length ? field(plan, frame, l => l >= dryLevels[n + 1], rim) : undefined;
            geometries.push(plate(f, frame, .5, TERRAIN_SEA_LEVEL - .5, top, level <= 0 ? .05 : .055, {
                cap: grass.clone().lerp(light, .15),
                side: depth => level <= 0 ? sand.clone().lerp(sandDeep, T.MathUtils.smoothstep(depth, .1, .6))
                    : lilac.clone().lerp(lilacDeep, T.MathUtils.smoothstep(depth, .04, .2)),
            }, plan.baseAt, true, p => !above || sample(above, frame, p) < .5, n === 0 ? undefined : {
                // Where the land outside is exactly one step lower, the edge is a grassy bank.
                weight: (() => { const lower = field(plan, frame, l => l >= level - 1, rim); return (p: T.Vector2) => T.MathUtils.smoothstep(sample(lower, frame, p), .35, .65); })(),
                drop: step, color: grass.clone().multiplyScalar(.9),
            }));
        });
    }
    const details = dryLevels.length ? dressing(plan, frame, dryLevels, rim) : [];
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, side: T.DoubleSide });
    const merged = geometries.length ? mergeGeometries(geometries) : undefined;
    geometries.forEach(g => g.dispose());
    const terrain = merged ? new T.Mesh(project(merged, layout), material) : undefined;
    if (terrain) { terrain.name = 'terrace-plates'; terrain.castShadow = terrain.receiveShadow = true; root.add(terrain); }
    const detailGeometry = details.length ? mergeGeometries(details) : undefined;
    details.forEach(g => g.dispose());
    const cover = detailGeometry ? new T.Mesh(project(detailGeometry, layout), material) : undefined;
    if (cover) { cover.name = 'terrace-ground-cover'; cover.castShadow = cover.receiveShadow = true; root.add(cover); }
    // Stair module: stone treads across the whole lower cell, rising along the floor's ramp.
    const treads: T.BufferGeometry[] = [];
    for (const stair of plan.stairs) {
        const dx = stair.upper.x - stair.lower.x, dz = stair.upper.z - stair.lower.z;
        const low = plan.heightAt({ x: stair.lower.x - dx * .5, z: stair.lower.z - dz * .5 }), high = plan.heightAt({ x: stair.lower.x + dx * .5, z: stair.lower.z + dz * .5 });
        const count = Math.max(2, Math.round((high - low) / .09));
        for (let t = 0; t < count; t++) {
            const h = (high - low) * (t + 1) / count, run = 1 / count, along = -.5 + run * (t + .5);
            const box = new T.BoxGeometry(dx ? run + .01 : .62, h + .04, dz ? run + .01 : .62);
            box.translate(stair.lower.x + dx * along, low + h / 2 - .02, stair.lower.z + dz * along); box.deleteAttribute('uv');
            const tread = box.toNonIndexed(), count3 = tread.getAttribute('position').count;
            tread.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: count3 }, () => [C.stair.r, C.stair.g, C.stair.b]).flat(), 3));
            treads.push(tread); box.dispose();
        }
    }
    const stairMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
    const stairGeometry = treads.length ? mergeGeometries(treads) : undefined;
    treads.forEach(g => g.dispose());
    const stairs = stairGeometry ? new T.Mesh(project(stairGeometry, layout), stairMaterial) : undefined;
    if (stairs) { stairs.name = 'terrace-stairs'; stairs.castShadow = stairs.receiveShadow = true; root.add(stairs); }
    return { root, dispose() { terrain?.geometry.dispose(); cover?.geometry.dispose(); stairs?.geometry.dispose(); material.dispose(); stairMaterial.dispose(); } };
}
