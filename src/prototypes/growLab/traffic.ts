import { N, worldX } from './terrain';
import type { Road, XZ } from './roads';

// Residents' comings and goings. Each learning session sends them on trips:
// from a house to somewhere worth going (a special building, a child's
// house, the harbour) along the roads. Every road node keeps count of the
// footsteps that crossed it; busy roads get better paving, and new houses
// prefer to go up where people pass.

export type Footfall = Float32Array;
export const newFootfall = (): Footfall => new Float32Array(N * N);

/** Road nodes and which nodes each one joins, over every road on the island. */
export function graphOf(roads: Road[]): Map<number, number[]> {
    const g = new Map<number, number[]>();
    const link = (a: number, b: number) => { if (!g.has(a)) g.set(a, []); if (!g.get(a)!.includes(b)) g.get(a)!.push(b); };
    for (const r of roads) for (let i = 1; i < r.nodes.length; i++) { link(r.nodes[i - 1], r.nodes[i]); link(r.nodes[i], r.nodes[i - 1]); }
    return g;
}

/** The road node nearest a point, if one is within reach. */
export function nodeNear(g: Map<number, number[]>, [x, z]: XZ, reach: number): number | undefined {
    let best: number | undefined, bestD = reach;
    for (const k of g.keys()) {
        const d = Math.hypot(worldX(k % N) - x, worldX(Math.floor(k / N)) - z);
        if (d <= bestD) { bestD = d; best = k; }
    }
    return best;
}

/** Fewest road steps from one node to another, or nothing if they are not joined. */
export function pathBetween(g: Map<number, number[]>, from: number, to: number): number[] | undefined {
    const prev = new Map<number, number>([[from, -1]]);
    const queue = [from];
    for (let q = 0; q < queue.length; q++) {
        const k = queue[q];
        if (k === to) {
            const path = [];
            for (let s = to; s >= 0; s = prev.get(s)!) path.unshift(s);
            return path;
        }
        for (const n of g.get(k) ?? []) if (!prev.has(n)) { prev.set(n, k); queue.push(n); }
    }
}

/**
 * Sends `count` residents on trips from the given homes to the given places,
 * adding a footstep to every road node they cross. Places nobody can reach
 * by road are left out (they are returned, so the island can hint at them).
 */
export function walkTrips(fall: Footfall, roads: Road[], homes: XZ[], places: XZ[], count: number, rand: () => number): { trips: number; unreached: XZ[] } {
    const g = graphOf(roads);
    const from = homes.map(h => nodeNear(g, h, 2.4)).filter((k): k is number => k !== undefined);
    const to = places.map(p => ({ p, k: nodeNear(g, p, 1.6) }));
    const unreached = to.filter(t => t.k === undefined).map(t => t.p);
    const open = to.filter(t => t.k !== undefined).map(t => t.k!);
    let trips = 0;
    if (!from.length || !open.length) return { trips, unreached };
    for (let i = 0; i < count; i++) {
        const a = from[Math.floor(rand() * from.length)], b = open[Math.floor(rand() * open.length)];
        if (a === b) continue;
        const path = pathBetween(g, a, b);
        if (!path) continue;
        for (const k of path) fall[k] += 1;
        trips++;
    }
    return { trips, unreached };
}

/** How a road looks for the footsteps it has had: 0 worn path, 1 gravel, 2 stones, 3 tiles. */
export const stageFor = (steps: number) => (steps >= 70 ? 3 : steps >= 24 ? 2 : steps >= 5 ? 1 : 0);

/**
 * The stage at each point of a road's centre line. Worn ground nearby counts
 * too (the most footsteps within a unit), so a road nudged aside by a stroke
 * keeps the paving people walked into it instead of starting over.
 */
export function stagesAlong(fall: Footfall, road: Road): number[] {
    const last = road.line.length - 1;
    return road.line.map((_, i) => {
        const k = road.nodes[Math.round((i / Math.max(1, last)) * (road.nodes.length - 1))];
        const ki = k % N, kj = Math.floor(k / N);
        let most = 0;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
            const ni = ki + di, nj = kj + dj;
            if (ni >= 0 && nj >= 0 && ni < N && nj < N) most = Math.max(most, fall[ni + nj * N]);
        }
        return stageFor(most);
    });
}

/** A spot by a road, picked in proportion to how busy that part of the road is. */
export function busySpot(fall: Footfall, roads: Road[], rand: () => number): XZ | undefined {
    const nodes = [...new Set(roads.flatMap(r => r.nodes))].filter(k => fall[k] > 0);
    const total = nodes.reduce((s, k) => s + fall[k], 0);
    if (!total) return;
    let pick = rand() * total;
    for (const k of nodes) {
        pick -= fall[k];
        if (pick <= 0) return [worldX(k % N), worldX(Math.floor(k / N))];
    }
}
