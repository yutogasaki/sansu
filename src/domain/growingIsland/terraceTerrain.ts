import { occupiedCells } from '../islandLife/footprint';
import type { ItemKind } from '../islandLife/model';
import { HOUSE_CELLS, bridgeAnchor, key, landBounds } from './space';
import { OWN_LANDMARKS, type Cell, type GrowingState } from './types';

/** DEV-only comparison of how the same saved heights become ground. The saved data
 * (integer offsets per acquired cell) is identical in both forms; only the derived
 * floor, walk graph and art differ. The production default stays 'continuous'. */
export type TerrainForm = 'continuous' | 'terrace';
// Read from the build env so the page and its workers always agree; production never sees it.
/**
 * One switch for the whole island-shaping set (terrace ground, brush, coast from the land,
 * placement advice and growing places). Off unless a build sets `VITE_ISLAND_SHAPING=on`;
 * the older DEV-only switches still work for side-by-side comparisons.
 */
export const islandShaping = () => import.meta.env?.VITE_ISLAND_SHAPING === 'on';
let form: TerrainForm = islandShaping() || import.meta.env?.DEV && import.meta.env.VITE_TERRAIN_FORM === 'terrace' ? 'terrace' : 'continuous';
export const terrainForm = (): TerrainForm => form;
export function setTerrainForm(next: TerrainForm) { form = next; }

export interface TerraceStair { upper: Cell; lower: Cell }
export interface TerracePlan {
    /** The child's integer step on every acquired cell (the saved offset, 0 where unedited). */
    levels: Map<string, number>;
    /** Acquired cells whose floor stays above the sea. */
    dry: Set<string>;
    stairs: TerraceStair[];
    /** Dry cells a resident can walk to from the home. */
    reachable: number;
    /** The same cells, by key. */
    reached: ReadonlySet<string>;
    /** Cells of terraces that hold something yet have no way up. */
    stranded: number;
    /** Cells an owner, the home, the pier or a stair already use; scenery keeps off them. */
    occupied: Set<string>;
    /** The unedited land: base hills and landscape rise stay continuous, walkable slopes. */
    baseAt(cell: Cell): number;
    /** Base plus stepped offsets, including stair ramps; fractional cells are allowed. */
    heightAt(cell: Cell): number;
    step: number;
}

type TerraceState = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge' | 'terrain' | 'plots' | 'landmarks' | 'keepsakes'>>;
const DIRS: Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const MAX_STAIR_RISE = 2;
/** Half width of the grassy bank between cells one step apart. Narrow enough that an
 * owner's footing probes (.46, corners included) stay within the support tolerance, wide
 * enough that the bank stays under the .8 walking slope. */
export const TERRACE_BANK = .12;

/** Cells an owner, the home or the pier already claims: a stair's treads sit inside its
 * lower cell, so they never go there; its landing avoids them when it can. */
function claimedCells(state: TerraceState): Set<string> {
    const cells: Cell[] = [...HOUSE_CELLS, { x: landBounds(state).maxX - 1, z: landBounds(state).depth - 1 }];
    if (state.bridge) cells.push(bridgeAnchor(state as GrowingState));
    for (const plot of state.plots ?? []) if (plot.cell) cells.push(plot.cell);
    for (const owner of state.landmarks ?? []) if (owner.cell)
        cells.push(...(OWN_LANDMARKS.includes(owner.kind) ? [owner.cell] : occupiedCells({ kind: owner.kind as ItemKind, cell: owner.cell })));
    for (const owner of state.keepsakes ?? []) if (owner.cell) cells.push(owner.cell);
    return new Set(cells.map(key));
}

/**
 * Only the child's saved steps become terraces: the land underneath (`baseAt`, base hills
 * and landscape rise) keeps its continuous walkable slopes, so unedited ground and the
 * footing of everything on it are exactly as before. A step change is a cliff, and
 * stairs are placed by rule only where a dry terrace would otherwise be unreachable.
 */
export function terracePlan(state: TerraceState, baseAt: (cell: Cell) => number, step: number, dryLevel: number): TerracePlan {
    const bounds = landBounds(state), levels = new Map<string, number>(), dry = new Set<string>();
    for (let z = 0; z < bounds.depth; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const k = key({ x, z }), level = state.terrain?.heights[k] ?? 0;
        levels.set(k, level);
        if (baseAt({ x, z }) + level * step >= dryLevel) dry.add(k);
    }
    const cells = [...dry], set = dry, claimed = claimedCells(state);
    const parse = (k: string): Cell => { const [x, z] = k.split(',').map(Number); return { x, z }; };
    const neighbours = (k: string) => { const c = parse(k); return DIRS.map(d => key({ x: c.x + d.x, z: c.z + d.z })).filter(n => set.has(n)); };
    const lv = (k: string) => levels.get(k)!;
    const edges = new Map<string, Set<string>>(cells.map(k => [k, new Set<string>()]));
    const link = (a: string, b: string) => { edges.get(a)!.add(b); edges.get(b)!.add(a); };
    // One step is a walkable grassy bank; two steps are a cliff that needs a stair.
    for (const k of cells) for (const n of neighbours(k)) if (Math.abs(lv(k) - lv(n)) <= 1) link(k, n);
    const home = cells.includes(key(HOUSE_CELLS[2])) ? key(HOUSE_CELLS[2]) : cells[0];
    const flood = () => {
        const seen = new Set<string>(home ? [home] : []), queue = home ? [home] : [];
        for (let i = 0; i < queue.length; i++) for (const n of edges.get(queue[i]) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
        return seen;
    };
    const stairs: { upper: string; lower: string }[] = [], feet = new Set<string>();
    const legal = (upper: string, lower: string) => {
        const rise = lv(upper) - lv(lower);
        return rise >= 2 && rise <= MAX_STAIR_RISE && !feet.has(lower) && !claimed.has(lower);
    };
    // An owner on the landing walls off the rest of the terrace, so an open landing is
    // preferred; a claimed one is used only when it is the sole way up (a pad holding a bench).
    const stairCost = (upper: string) => claimed.has(upper) ? 24 : 8;
    // Only a terrace something stands on needs a way up: an owner, the home or the pier.
    // An empty terrace gets its stair when the child sets something there.
    const needed = new Set<string>();
    for (const start of cells) {
        if (needed.has(start) || !claimed.has(start)) continue;
        const queue = [start]; needed.add(start);
        for (let i = 0; i < queue.length; i++) for (const n of edges.get(queue[i])!) if (!needed.has(n)) { needed.add(n); queue.push(n); }
    }
    const neededReached = (seen: Set<string>) => [...needed].filter(k => seen.has(k)).length;
    let reachable = flood();
    const walkDistances = () => {
        const hops = new Map<string, number>(home ? [[home, 0]] : []), queue = home ? [home] : [];
        for (let i = 0; i < queue.length; i++) for (const n of edges.get(queue[i]) ?? []) if (!hops.has(n)) { hops.set(n, hops.get(queue[i])! + 1); queue.push(n); }
        return hops;
    };
    // Fewest new stairs first: flat steps cost 1, a stair 8 (24 onto an owner).
    for (let guard = 0; guard < 96 && neededReached(reachable) < needed.size; guard++) {
        // Reached cells start at their walking distance from the home, so a new stair is
        // put on the edge nearest the home; it stays put when unrelated cells change.
        const dist = new Map<string, number>(), back = new Map<string, string>(), open: [number, string][] = [];
        for (const [k, hops] of walkDistances()) { dist.set(k, hops); open.push([hops, k]); }
        let found: string | undefined;
        while (open.length) {
            open.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
            const [d, k] = open.shift()!;
            if (d !== dist.get(k)) continue;
            if (!reachable.has(k) && needed.has(k)) { found = k; break; }
            for (const n of neighbours(k)) {
                const upper = lv(k) > lv(n) ? k : n, lower = upper === k ? n : k;
                const cost = edges.get(k)!.has(n) ? 1 : legal(upper, lower) ? stairCost(upper) : Infinity;
                if (d + cost < (dist.get(n) ?? Infinity)) { dist.set(n, d + cost); back.set(n, k); open.push([d + cost, n]); }
            }
        }
        if (!found) break;
        const chain = [found];
        while (back.has(chain[0]) && !reachable.has(chain[0])) chain.unshift(back.get(chain[0])!);
        for (let i = 1; i < chain.length; i++) {
            const a = chain[i - 1], b = chain[i];
            if (edges.get(a)!.has(b)) continue;
            const upper = lv(a) > lv(b) ? a : b, lower = upper === a ? b : a;
            stairs.push({ upper, lower }); feet.add(lower); link(upper, lower);
        }
        reachable = flood();
    }
    // Drop stairs that no longer reach anything new, so the island does not collect them.
    for (let i = stairs.length - 1; i >= 0; i--) {
        const { upper, lower } = stairs[i];
        edges.get(upper)!.delete(lower); edges.get(lower)!.delete(upper);
        if (neededReached(flood()) === neededReached(reachable)) { stairs.splice(i, 1); feet.delete(lower); } else link(upper, lower);
    }
    reachable = flood();
    const byFoot = new Map(stairs.map(s => [s.lower, s]));
    const heightAt = (cell: Cell) => {
        const x = Math.max(bounds.minX, Math.min(bounds.maxX, Math.floor(cell.x + .5)));
        const z = Math.max(0, Math.min(bounds.depth - 1, Math.floor(cell.z + .5)));
        const k = key({ x, z }), stair = byFoot.get(k), base = baseAt(cell);
        // Toward a neighbour one step away the floor leans into a bank that meets the
        // neighbour's own lean halfway, so the two sides join on the cell boundary.
        let bank = 0;
        for (const d of DIRS) {
            const n = key({ x: x + d.x, z: z + d.z }), rise = dry.has(n) ? lv(n) - lv(k) : 0;
            if (Math.abs(rise) !== 1) continue;
            const toEdge = .5 - ((cell.x - x) * d.x + (cell.z - z) * d.z);
            if (toEdge < TERRACE_BANK) bank += rise * .5 * (1 - Math.max(0, toEdge) / TERRACE_BANK);
        }
        const offset = (lv(k) + bank) * step;
        if (!stair) return base + offset;
        // The ramp rises across the half of the foot cell that faces the terrace.
        const u = parse(stair.upper), along = (cell.x - x) * (u.x - x) + (cell.z - z) * (u.z - z);
        return base + offset + (along <= 0 ? 0 : (lv(stair.upper) * step - offset) * Math.min(1, along / .5));
    };
    return { levels, dry, stairs: stairs.map(s => ({ upper: parse(s.upper), lower: parse(s.lower) })), reachable: reachable.size, reached: reachable, stranded: needed.size - neededReached(reachable),
        occupied: new Set([...claimed, ...stairs.flatMap(s => [s.upper, s.lower])]), baseAt, heightAt, step };
}
