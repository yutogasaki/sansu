// The saved island is only data: acquired cells, integer heights (the same
// shape as GrowingTerrain.heights) and owned items on cells. Every mesh, stair,
// path and route below is derived from it and never saved.
export type Method = 'T' | 'G';
export type Kind = 'house' | 'tree' | 'bigtree' | 'canopy' | 'bench' | 'flowers' | 'pool';
export interface Owner { id: string; kind: Kind; cell: [number, number]; rot: number; variant: string }
export interface Island { version: 1; width: number; depth: number; land: string[]; heights: Record<string, number>; owners: Owner[]; hub: [number, number];
    /** Placement hints only: reloaded connectors are re-validated, never trusted. */
    hints?: { stairs: Stair[]; bridges: Bridge[] } }
export interface Stair { upper: [number, number]; lower: [number, number] }
export interface Bridge { a: [number, number]; b: [number, number]; water: [number, number] }
export interface Derived { stairs: Stair[]; bridges: Bridge[]; edges: Map<string, string[]>; reachable: Set<string>; unreachable: string[]; paths: [string, string][]; routes: string[][]; doors: Map<string, string> }

export const MIN_LEVEL = -1, MAX_LEVEL = 3;
export const key = (x: number, z: number) => `${x},${z}`;
export const unkey = (k: string) => k.split(',').map(Number) as [number, number];
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function footprint(owner: Pick<Owner, 'kind' | 'cell'>): [number, number][] {
    const [x, z] = owner.cell;
    return owner.kind === 'bigtree' || owner.kind === 'canopy' ? [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] : [[x, z]];
}
export function level(island: Island, x: number, z: number) {
    return island.land.includes(key(x, z)) ? island.heights[key(x, z)] ?? 0 : undefined;
}
export function occupant(island: Island, x: number, z: number) {
    return island.owners.find(o => footprint(o).some(([a, b]) => a === x && b === z));
}
/** The door cell faces local +z rotated by rot quarter turns. */
export function doorCell(owner: Owner): [number, number] {
    const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][((owner.rot % 4) + 4) % 4];
    return [owner.cell[0] + d[0], owner.cell[1] + d[1]];
}

export function canPlace(island: Island, owner: Pick<Owner, 'kind' | 'cell' | 'id'>, stairs: Stair[] = []): string | undefined {
    // Bridges span water and owners never go on water, so only stairs need checking here.
    const cells = footprint(owner), levels = cells.map(([x, z]) => level(island, x, z));
    if (levels.some(l => l === undefined)) return 'まだ じぶんの とちでは ないよ';
    if (levels.some(l => (l as number) < 0)) return 'みずの うえには おけないよ';
    if (new Set(levels).size > 1) return 'たいらな ところに おこう';
    if (cells.some(([x, z]) => { const o = occupant(island, x, z); return o && o.id !== owner.id; })) return 'ほかの ものが あるよ';
    if (stairs.some(s => cells.some(([x, z]) => (s.lower[0] === x && s.lower[1] === z) || (s.upper[0] === x && s.upper[1] === z)))) return 'かいだんの ばしょだよ';
    return undefined;
}

const blocking = (kind: Kind) => kind !== 'flowers';
function walkable(island: Island, x: number, z: number) {
    const l = level(island, x, z);
    if (l === undefined || l < 0) return false;
    const o = occupant(island, x, z);
    return !o || !blocking(o.kind);
}

/** Terrace method: same-level neighbours connect; a level change needs a stair. Stairs
 * are placed by rule until every walkable terrace reaches the hub, keeping previous
 * stairs while they stay legal so edits elsewhere do not move them. */
export function derive(island: Island, method: Method, previous: Stair[] = [], previousBridges: Bridge[] = []): Derived {
    const cells = island.land.filter(k => walkable(island, ...unkey(k)));
    const set = new Set(cells), stairs: Stair[] = [], bridges: Bridge[] = [];
    const lv = (k: string) => island.heights[k] ?? 0;
    const sk = (s: Stair) => `${key(...s.upper)}>${key(...s.lower)}`;
    const neighbours = (k: string) => { const [x, z] = unkey(k); return DIRS.map(([dx, dz]) => key(x + dx, z + dz)).filter(n => set.has(n)); };
    const edges = new Map<string, string[]>();
    const link = (a: string, b: string) => { (edges.get(a) ?? edges.set(a, []).get(a)!).push(b); (edges.get(b) ?? edges.set(b, []).get(b)!).push(a); };
    for (const k of cells) edges.set(k, []);
    for (const k of cells) for (const n of neighbours(k)) {
        if (k > n) continue;
        const d = Math.abs(lv(k) - lv(n));
        if (method === 'G' ? d <= 2 : d === 0) link(k, n);
    }
    const hubKey = set.has(key(...island.hub)) ? key(...island.hub) : cells.find(k => lv(k) === 0) ?? cells[0];
    const flood = () => {
        const seen = new Set<string>(); if (!hubKey) return seen;
        const queue = [hubKey]; seen.add(hubKey);
        for (let i = 0; i < queue.length; i++) for (const n of edges.get(queue[i]) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
        return seen;
    };
    let reachable = flood();
    // Connectors are authored modules placed by rule only where they are needed:
    // a stair (terrace method) for a one-level step, a bridge across one dug water cell
    // between two meadow cells. Previous connectors are kept while legal so edits
    // elsewhere do not move them.
    const footCells = new Set<string>(), waterCells = new Set<string>();
    const free = (k: string) => !occupant(island, ...unkey(k));
    // Treads sit in the lower cell; the upper cell is only a walkable landing (a flower bed is fine).
    const stairLegal = (upper: string, lower: string) => method === 'T' && set.has(upper) && set.has(lower) && lv(upper) - lv(lower) === 1
        && !footCells.has(lower) && free(lower);
    const water = (k: string) => island.land.includes(k) && lv(k) < 0 && free(k) && !waterCells.has(k);
    const bridgeOver = (a: string, b: string) => {
        const [ax, az] = unkey(a), [bx, bz] = unkey(b);
        if (Math.abs(ax - bx) + Math.abs(az - bz) !== 2 || (ax !== bx && az !== bz)) return undefined;
        const w = key((ax + bx) / 2, (az + bz) / 2);
        return set.has(a) && set.has(b) && lv(a) === 0 && lv(b) === 0 && water(w) ? w : undefined;
    };
    const addStair = (upper: string, lower: string) => { stairs.push({ upper: unkey(upper), lower: unkey(lower) }); footCells.add(lower); link(upper, lower); };
    const addBridge = (a: string, b: string, w: string) => { bridges.push({ a: unkey(a), b: unkey(b), water: unkey(w) }); waterCells.add(w); link(a, b); };
    for (const s of previous) {
        const u = key(...s.upper), l = key(...s.lower);
        if (stairLegal(u, l) && (!reachable.has(u) || !reachable.has(l))) { addStair(u, l); reachable = flood(); }
    }
    for (const br of previousBridges) {
        const a = key(...br.a), b = key(...br.b), w = bridgeOver(a, b);
        if (w && (!reachable.has(a) || !reachable.has(b))) { addBridge(a, b, w); reachable = flood(); }
    }
    const across = (k: string) => {
        const [x, z] = unkey(k);
        return DIRS.map(([dx, dz]) => key(x + dx * 2, z + dz * 2)).filter(n => bridgeOver(k, n));
    };
    // Multi-source search from everything already reachable: flat steps cost 1, a new
    // stair 8, a new bridge 10, so the fewest new modules that reach a stranded cell win.
    for (let guard = 0; guard < 60; guard++) {
        if (reachable.size === cells.length) break;
        const dist = new Map<string, number>(), back = new Map<string, string>(), open: [number, string][] = [];
        for (const k of reachable) { dist.set(k, 0); open.push([0, k]); }
        let found: string | undefined;
        while (open.length) {
            open.sort((p, q) => p[0] - q[0]);
            const [d, k] = open.shift()!;
            if (d !== dist.get(k)) continue;
            if (!reachable.has(k)) { found = k; break; }
            const step = (n: string, cost: number) => { if (d + cost < (dist.get(n) ?? Infinity)) { dist.set(n, d + cost); back.set(n, k); open.push([d + cost, n]); } };
            for (const n of neighbours(k)) {
                const diff = Math.abs(lv(k) - lv(n));
                if (edges.get(k)?.includes(n)) step(n, 1);
                else if (diff === 1 && stairLegal(lv(k) > lv(n) ? k : n, lv(k) > lv(n) ? n : k)) step(n, 8);
            }
            for (const n of across(k)) step(n, 10);
        }
        if (!found) break;
        const chain = [found];
        while (back.has(chain[0]) && !reachable.has(chain[0])) chain.unshift(back.get(chain[0])!);
        for (let i = 1; i < chain.length; i++) {
            const p = chain[i - 1], q = chain[i];
            if (edges.get(p)?.includes(q)) continue;
            const w = bridgeOver(p, q);
            if (w) addBridge(p, q, w); else addStair(lv(p) > lv(q) ? p : q, lv(p) > lv(q) ? q : p);
        }
        reachable = flood();
    }
    // Modules that became unnecessary are dropped so the island does not collect them.
    const unlink = (a: string, b: string) => { edges.set(a, (edges.get(a) ?? []).filter(n => n !== b)); edges.set(b, (edges.get(b) ?? []).filter(n => n !== a)); };
    for (let i = stairs.length - 1; i >= 0; i--) {
        const u = key(...stairs[i].upper), l = key(...stairs[i].lower);
        unlink(u, l);
        if (flood().size === reachable.size) { stairs.splice(i, 1); footCells.delete(l); } else link(u, l);
    }
    for (let i = bridges.length - 1; i >= 0; i--) {
        const a = key(...bridges[i].a), b = key(...bridges[i].b);
        unlink(a, b);
        if (flood().size === reachable.size) { waterCells.delete(key(...bridges[i].water)); bridges.splice(i, 1); } else link(a, b);
    }
    reachable = flood();
    const unreachable = cells.filter(k => !reachable.has(k));
    // Shared paths: every home door and bench walks to the hub over the real graph.
    const doors = new Map<string, string>(), used = new Set<string>(), paths: [string, string][] = [], routes: string[][] = [];
    const route = (from: string) => shortest(edges, from, hubKey);
    for (const o of island.owners) {
        if (o.kind !== 'house' && o.kind !== 'bench') continue;
        const door = o.kind === 'house' ? key(...doorCell(o)) : neighbours(key(...o.cell)).find(n => reachable.has(n));
        if (!door || !reachable.has(door)) continue;
        doors.set(o.id, door);
        const r = route(door); if (r.length) routes.push(r);
        for (let i = 1; i < r.length; i++) {
            const id = [r[i - 1], r[i]].sort().join('|');
            if (!used.has(id)) { used.add(id); paths.push([r[i - 1], r[i]]); }
        }
    }
    void sk;
    return { stairs, bridges, edges, reachable, unreachable, paths, routes, doors };
}

export function shortest(edges: Map<string, string[]>, from: string, to: string | undefined): string[] {
    if (!to || !edges.has(from)) return [];
    const back = new Map<string, string>([[from, from]]), queue = [from];
    for (let i = 0; i < queue.length; i++) {
        const k = queue[i]; if (k === to) break;
        for (const n of edges.get(k) ?? []) if (!back.has(n)) { back.set(n, k); queue.push(n); }
    }
    if (!back.has(to)) return [];
    const out = [to]; while (out[0] !== from) out.unshift(back.get(out[0])!);
    return out;
}

export type Command = { type: 'height'; cell: [number, number]; delta: 1 | -1 } | { type: 'move'; id: string; cell: [number, number]; rot?: number };
export function apply(island: Island, command: Command, stairs: Stair[]): { island: Island; inverse: Command } | string {
    const next: Island = structuredClone(island);
    if (command.type === 'height') {
        const [x, z] = command.cell, l = level(island, x, z);
        if (l === undefined) return 'まだ じぶんの とちでは ないよ';
        const after = l + command.delta;
        if (after < MIN_LEVEL || after > MAX_LEVEL) return command.delta > 0 ? 'これより たかくは できないよ' : 'これより ふかくは できないよ';
        if (occupant(island, x, z)) return 'ものが のっているよ。さきに うごかそう';
        if (after === 0) delete next.heights[key(x, z)]; else next.heights[key(x, z)] = after;
        return { island: next, inverse: { type: 'height', cell: command.cell, delta: (-command.delta) as 1 | -1 } };
    }
    const owner = next.owners.find(o => o.id === command.id); if (!owner) return 'みつからないよ';
    const before = { cell: owner.cell, rot: owner.rot };
    const why = canPlace(next, { ...owner, cell: command.cell }, stairs.filter(s => !footprint(owner).some(([x, z]) => key(x, z) === key(...s.lower))));
    if (why) return why;
    owner.cell = command.cell; if (command.rot !== undefined) owner.rot = command.rot;
    return { island: next, inverse: { type: 'move', id: owner.id, cell: before.cell, rot: before.rot } };
}
