import { N, RES, heightAt, indexOf, worldX, type Heights } from './terrain';

// Roads find their own way, and they always get there. A road may only climb
// so steeply, so on a hill the cheapest way up is a zigzag: switchbacks come out
// of the rule, not out of a drawing. Where even a zigzag cannot climb, the way
// turns into steps, then into a little funicular; over water it becomes a
// bridge. Each is dearer than the last, so the island uses the plain road
// wherever it can and the child never hears "you can't get there".

export const MAX_GRADE = .3;
/** Steeper than this, steps give way to the funicular. */
export const STAIR_GRADE = 1.1;
const MOVES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
    [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const LAND = .12;

export type XZ = [number, number];
export type P3 = [number, number, number];
export type Way = 'road' | 'stair' | 'bridge' | 'lift';
/** Cost per unit of run: a flat part, and a part for every unit of rise. Climbing by
 * steps or funicular costs more per metre gained than a zigzag road, so they only
 * appear where a road cannot climb at all. */
const COST: Record<Way, [number, number]> = { road: [1, 4], stair: [4, 12], bridge: [12, 0], lift: [8, 30] };
const RANK: Record<Way, number> = { road: 0, stair: 1, lift: 2, bridge: 3 };

export interface Part { kind: Way; line: P3[] }
export interface Road {
    /** Grid nodes the road follows. */
    nodes: number[];
    /** How each step is made: kinds[i] joins nodes[i - 1] to nodes[i] (kinds[0] is unused). */
    kinds: Way[];
    /** Runs of one kind, each with its own centre line. */
    parts: Part[];
    /** The whole centre line in the world, sampled about every quarter unit. */
    line: P3[];
}

const clampIndex = (v: number) => Math.max(0, Math.min(N - 1, v));
export const node = ([x, z]: XZ) => clampIndex(Math.round(indexOf(x))) + clampIndex(Math.round(indexOf(z))) * N;
const where = (k: number): XZ => [worldX(k % N), worldX(Math.floor(k / N))];

/** How a step from k to nk would be built. */
export function wayOf(h: Heights, k: number, nk: number, run: number): Way {
    if (h[k] < LAND || h[nk] < LAND) return 'bridge';
    const grade = Math.abs(h[nk] - h[k]) / run;
    return grade <= MAX_GRADE ? 'road' : grade <= STAIR_GRADE ? 'stair' : 'lift';
}

/** Cheapest way from `start` to any of `goals`. It always exists on the grid. */
export function findWay(h: Heights, start: number, goals: Set<number>, shared = new Set<number>()): { nodes: number[]; kinds: Way[] } | undefined {
    const cost = new Float64Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const kindTo: Way[] = new Array(N * N);
    cost[start] = 0;
    // A small binary heap keeps this quick enough to rerun after every brush stroke.
    const heap: [number, number][] = [[0, start]];
    const push = (c: number, k: number) => {
        heap.push([c, k]);
        for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop()!;
        if (heap.length) {
            heap[0] = last;
            for (let i = 0; ;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
            }
        }
        return top;
    };
    while (heap.length) {
        const [c, k] = pop();
        if (c > cost[k]) continue;
        if (goals.has(k)) {
            const nodes = [k], kinds: Way[] = [kindTo[k]];
            while (from[nodes[0]] >= 0) { nodes.unshift(from[nodes[0]]); kinds.unshift(kindTo[nodes[0]]); }
            kinds[0] = 'road';
            return { nodes, kinds };
        }
        const i = k % N, j = Math.floor(k / N);
        for (const [di, dj] of MOVES) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nk = ni + nj * N;
            const run = Math.hypot(di, dj) * RES;
            const kind = wayOf(h, k, nk, run);
            // Flat road is cheap, climbing costs more, steps, bridges and the
            // funicular much more; an existing road costs least.
            const [flat, climb] = COST[kind];
            const unit = flat + Math.abs(h[nk] - h[k]) / run * climb;
            const step = run * unit * (shared.has(nk) ? .35 : 1);
            if (c + step < cost[nk]) { cost[nk] = c + step; from[nk] = k; kindTo[nk] = kind; push(c + step, nk); }
        }
    }
    return undefined;
}

/** A lone step of a plainer kind between two of a sturdier one is built like them. */
function settle(kinds: Way[]): Way[] {
    const out = kinds.slice();
    for (let i = 2; i + 1 < out.length; i++) {
        const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
        if (a === c && a !== b && a !== 'bridge' && b !== 'bridge' && RANK[b] < RANK[a]) out[i] = a;
    }
    return out;
}

const chaikin = (pts: XZ[], rounds: number) => {
    for (let r = 0; r < rounds; r++) {
        const out: XZ[] = [pts[0]];
        for (let i = 0; i + 1 < pts.length; i++) {
            const [a, b] = [pts[i], pts[i + 1]];
            out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
    }
    return pts;
};

function sample(pts: XZ[], y: (x: number, z: number, t: number) => number): P3[] {
    const steps: XZ[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .25));
        for (let s = 0; s < n; s++) steps.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]);
    }
    steps.push(pts[pts.length - 1]);
    return steps.map(([x, z], i) => [x, y(x, z, steps.length > 1 ? i / (steps.length - 1) : 0), z]);
}

function partLine(h: Heights, kind: Way, nodes: number[]): P3[] {
    const pts = nodes.map(where);
    if (kind === 'bridge') {
        // A deck from bank to bank with a gentle arch, held above the water.
        const deck = (p: XZ) => Math.max(.35, heightAt(h, p[0], p[1]));
        const [a, b] = [deck(pts[0]), deck(pts[pts.length - 1])];
        return sample(pts, (_x, _z, t) => a + (b - a) * t + Math.sin(t * Math.PI) * .2);
    }
    if (kind !== 'road') return sample(pts, (x, z) => heightAt(h, x, z));
    const line = sample(chaikin(pts, 2), (x, z) => heightAt(h, x, z));
    // Even out the road's rise so it does not follow every bump; the ends stay
    // where the next part begins.
    return line.map((p, i) => {
        if (i === 0 || i === line.length - 1) return p;
        let y = 0, n = 0;
        for (let k = Math.max(0, i - 3); k <= Math.min(line.length - 1, i + 3); k++) { y += line[k][1]; n++; }
        return [p[0], y / n, p[2]];
    });
}

export function buildRoad(h: Heights, nodes: number[], rawKinds: Way[]): Road {
    const kinds = settle(rawKinds);
    const parts: Part[] = [];
    let from = 0;
    for (let i = 1; i < nodes.length; i++) {
        if (i + 1 < nodes.length && kinds[i + 1] === kinds[i]) continue;
        parts.push({ kind: kinds[i], line: partLine(h, kinds[i], nodes.slice(from, i + 1)) });
        from = i;
    }
    if (!parts.length) parts.push({ kind: 'road', line: partLine(h, 'road', nodes) });
    const line = parts.flatMap((p, i) => (i ? p.line.slice(1) : p.line));
    return { nodes, kinds, parts, line };
}

export interface Network { roads: Road[]; reached: boolean[] }

/** Roads from the harbour to each place in turn, each joining the network so far. */
export function network(h: Heights, harbour: XZ, places: XZ[]): Network {
    const roads: Road[] = [];
    const on = new Set<number>([node(harbour)]);
    const reached = places.map(p => {
        const start = node(p);
        if (on.has(start)) return true;
        const way = findWay(h, start, on, on);
        if (!way) return false;
        const nodes = way.nodes.reverse();
        const kinds: Way[] = ['road', ...way.kinds.slice(1).reverse()];
        roads.push(buildRoad(h, nodes, kinds));
        nodes.forEach(k => on.add(k));
        return true;
    });
    return { roads, reached };
}

/** Roads are cut into the hillside: ground near a road is levelled to it. */
export function cutRoads(base: Heights, roads: Road[], reach = .95): Heights {
    const h = base.slice();
    const weight = new Float32Array(N * N);
    const level = new Float32Array(N * N);
    // Only the plain road is cut in; steps and the funicular lie on the hill, bridges over the water.
    for (const road of roads) for (const part of road.parts) if (part.kind === 'road') for (const [x, y, z] of part.line) {
        const i0 = Math.floor(indexOf(x - reach)), j0 = Math.floor(indexOf(z - reach));
        for (let j = Math.max(0, j0); j <= Math.min(N - 1, j0 + Math.ceil(reach * 2 / RES) + 1); j++) {
            for (let i = Math.max(0, i0); i <= Math.min(N - 1, i0 + Math.ceil(reach * 2 / RES) + 1); i++) {
                const d = Math.hypot(worldX(i) - x, worldX(j) - z);
                if (d > reach) continue;
                const t = d < reach * .5 ? 1 : 1 - (d - reach * .5) / (reach * .5);
                const k = i + j * N;
                if (t > weight[k]) { weight[k] = t; level[k] = y - .02; }
            }
        }
    }
    for (let k = 0; k < N * N; k++) if (weight[k] > 0) h[k] = h[k] * (1 - weight[k]) + level[k] * weight[k];
    return h;
}
