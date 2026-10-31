import { N, RES, heightAt, indexOf, worldX, type Heights } from './terrain';

// Roads find their own way, and they always get there. A road may only climb
// so steeply, so on a hill the cheapest way up is a zigzag: switchbacks come out
// of the rule, not out of a drawing. Where even a zigzag cannot climb, the way
// turns into steps, then into a little funicular; over water it becomes a
// bridge. Each is dearer than the last, so the island uses the plain road
// wherever it can and the child never hears "you can't get there".

export const MAX_GRADE = .4;
/** Half the width of a road: wide enough for the bus and a resident to pass. */
export const ROAD_HALF = .45;
/** Steeper than this, steps give way to the funicular. */
export const STAIR_GRADE = 1.1;
// Shallow angles (1 across, 3 along) let a road climb a hillside at its
// steepest gently, slanting across it, instead of only straight up or level.
const MOVES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
    [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
    [1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1]];
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

/** Extra cost for turning, per unit of (1 - cos) of the turn: a road prefers long
 * easy legs to a tangle of short ones, so its switchbacks come out wide apart. */
const TURN = 1.6;
const DIRS = MOVES.length;

/** Cheapest way from `start` to any of `goals`. It always exists on the grid. */
export function findWay(h: Heights, start: number, goals: Set<number>, shared = new Set<number>()): { nodes: number[]; kinds: Way[] } | undefined {
    // A state is a node and the move that reached it (DIRS for the start), so turns can be priced.
    const S = DIRS + 1;
    const cost = new Float64Array(N * N * S).fill(Infinity);
    const from = new Int32Array(N * N * S).fill(-1);
    const kindTo: Way[] = new Array(N * N * S);
    const isGoal = new Uint8Array(N * N), isShared = new Uint8Array(N * N);
    for (const k of goals) isGoal[k] = 1;
    for (const k of shared) isShared[k] = 1;
    // How far each node is from the nearest goal, as a lower bound on what is
    // left to pay, so the search heads for the goals first instead of spreading
    // evenly. Off the network a road costs at least 1 per unit; only the final
    // step onto it is cheaper, by at most (1 - .35) of the longest move.
    const away = new Float32Array(N * N).fill(Infinity);
    for (const k of goals) away[k] = 0;
    const D = Math.SQRT2;
    for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
            const k = i + j * N;
            if (i > 0) away[k] = Math.min(away[k], away[k - 1] + 1);
            if (j > 0) away[k] = Math.min(away[k], away[k - N] + 1);
            if (i > 0 && j > 0) away[k] = Math.min(away[k], away[k - N - 1] + D);
            if (i < N - 1 && j > 0) away[k] = Math.min(away[k], away[k - N + 1] + D);
        }
        for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
            const k = i + j * N;
            if (i < N - 1) away[k] = Math.min(away[k], away[k + 1] + 1);
            if (j < N - 1) away[k] = Math.min(away[k], away[k + N] + 1);
            if (i < N - 1 && j < N - 1) away[k] = Math.min(away[k], away[k + N + 1] + D);
            if (i > 0 && j < N - 1) away[k] = Math.min(away[k], away[k + N - 1] + D);
        }
    }
    // The grid distance overstates the straight line a little (by up to 8%), so scale it down to stay a true lower bound.
    const lastStep = (1 - .35) * Math.hypot(1, 3) * RES;
    const guess = (k: number) => Math.max(0, away[k] * RES * .92 - lastStep);
    const first = start * S + DIRS;
    cost[first] = 0;
    // A binary heap in flat arrays keeps this quick enough to rerun after every stroke.
    let heapCost = new Float64Array(1024), heapState = new Int32Array(1024), size = 0;
    const push = (c: number, st: number) => {
        if (size === heapCost.length) {
            const nc = new Float64Array(size * 2), ns = new Int32Array(size * 2);
            nc.set(heapCost); ns.set(heapState); heapCost = nc; heapState = ns;
        }
        let i = size++;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heapCost[p] <= c) break;
            heapCost[i] = heapCost[p]; heapState[i] = heapState[p]; i = p;
        }
        heapCost[i] = c; heapState[i] = st;
    };
    const pop = (): [number, number] => {
        const top: [number, number] = [heapCost[0], heapState[0]];
        const c = heapCost[--size], st = heapState[size];
        let i = 0;
        for (;;) {
            const l = i * 2 + 1, r = l + 1;
            let m = -1, mc = c;
            if (l < size && heapCost[l] < mc) { m = l; mc = heapCost[l]; }
            if (r < size && heapCost[r] < mc) { m = r; }
            if (m < 0) break;
            heapCost[i] = heapCost[m]; heapState[i] = heapState[m]; i = m;
        }
        heapCost[i] = c; heapState[i] = st;
        return top;
    };
    push(guess(start), first);
    const unitDir = MOVES.map(([di, dj]) => { const l = Math.hypot(di, dj); return [di / l, dj / l]; });
    while (size) {
        const [f, st] = pop();
        const k = Math.floor(st / S), d = st % S;
        const c = cost[st];
        if (f > c + guess(k) + 1e-9) continue;
        if (isGoal[k]) {
            const nodes: number[] = [], kinds: Way[] = [];
            for (let s = st; s >= 0; s = from[s]) { nodes.unshift(Math.floor(s / S)); kinds.unshift(kindTo[s]); }
            kinds[0] = 'road';
            return { nodes, kinds };
        }
        const i = k % N, j = Math.floor(k / N);
        for (let m = 0; m < DIRS; m++) {
            const [di, dj] = MOVES[m];
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nk = ni + nj * N;
            const run = Math.hypot(di, dj) * RES;
            const kind = wayOf(h, k, nk, run);
            // Flat road is cheap, climbing costs more, steps, bridges and the
            // funicular much more; an existing road costs least.
            const [flat, climb] = COST[kind];
            const unit = flat + Math.abs(h[nk] - h[k]) / run * climb;
            const turn = d === DIRS ? 0 : TURN * (1 - (unitDir[d][0] * unitDir[m][0] + unitDir[d][1] * unitDir[m][1]));
            const step = (run * unit + turn) * (isShared[nk] ? .35 : 1);
            const ns = nk * S + m;
            if (c + step < cost[ns]) { cost[ns] = c + step; from[ns] = st; kindTo[ns] = kind; push(c + step + guess(nk), ns); }
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
    // Steps and the funicular round their corners too, so treads do not fan out.
    if (kind !== 'road') return sample(pts.length > 2 ? chaikin(pts, 2) : pts, (x, z) => heightAt(h, x, z));
    const line = sample(chaikin(pts, 3), (x, z) => heightAt(h, x, z));
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
export function network(h: Heights, harbour: XZ, places: XZ[], chains: XZ[][] = []): Network {
    const roads: Road[] = [];
    const on = new Set<number>([node(harbour)]);
    const join = (start: number, goals: Set<number>) => {
        if (goals.has(start)) return true;
        const way = findWay(h, start, goals, on);
        if (!way) return false;
        const nodes = way.nodes.reverse();
        const kinds: Way[] = ['road', ...way.kinds.slice(1).reverse()];
        roads.push(buildRoad(h, nodes, kinds));
        nodes.forEach(k => on.add(k));
        return true;
    };
    const reached = places.map(p => join(node(p), on));
    // A drawn line is one road: the stop nearest the roads already there joins
    // them, then the line grows stop by stop both ways from it, so the road
    // follows the finger instead of every stop sprouting its own branch.
    const gap = (p: XZ) => Math.min(...[...on].map(k => Math.hypot(worldX(k % N) - p[0], worldX(Math.floor(k / N)) - p[1])));
    for (const chain of chains) {
        if (!chain.length) continue;
        const gaps = chain.map(gap), first = gaps.indexOf(Math.min(...gaps));
        join(node(chain[first]), on);
        for (let i = first + 1; i < chain.length; i++) join(node(chain[i]), new Set([node(chain[i - 1])]));
        for (let i = first - 1; i >= 0; i--) join(node(chain[i]), new Set([node(chain[i + 1])]));
    }
    return { roads, reached };
}

/** Roads are cut into the hillside: ground near a road is levelled to it. */
export function cutRoads(base: Heights, roads: Road[], reach = 1.3): Heights {
    const h = base.slice();
    const weight = new Float32Array(N * N);
    const level = new Float32Array(N * N);
    // Each patch of ground follows the nearest bit of road, so where two legs
    // of a zigzag pass close by, each is cut to its own height.
    const nearest = new Float32Array(N * N).fill(Infinity);
    // Only the plain road is cut in; steps and the funicular lie on the hill, bridges over the water.
    for (const road of roads) for (const part of road.parts) if (part.kind === 'road') for (const [x, y, z] of part.line) {
        const i0 = Math.floor(indexOf(x - reach)), j0 = Math.floor(indexOf(z - reach));
        for (let j = Math.max(0, j0); j <= Math.min(N - 1, j0 + Math.ceil(reach * 2 / RES) + 1); j++) {
            for (let i = Math.max(0, i0); i <= Math.min(N - 1, i0 + Math.ceil(reach * 2 / RES) + 1); i++) {
                const d = Math.hypot(worldX(i) - x, worldX(j) - z);
                if (d > reach) continue;
                const t = d < reach * .5 ? 1 : 1 - (d - reach * .5) / (reach * .5);
                const k = i + j * N;
                if (d < nearest[k]) { nearest[k] = d; weight[k] = t; level[k] = y - .02; }
            }
        }
    }
    for (let k = 0; k < N * N; k++) if (weight[k] > 0) h[k] = h[k] * (1 - weight[k]) + level[k] * weight[k];
    return h;
}
