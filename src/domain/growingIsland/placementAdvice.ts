import { TREE_MATURE_HOURS } from './environment';
import { LANDMARK_PRICE } from './rules';
import { HOME_CELL, HOUSE_CELLS, isReachable, isVacant, key, landBounds, landCells, reachableFromHome, walkableCells } from './space';
import { editableIslandWorld } from './editableTerrainWorld';
import { applyTerrainCommand } from './terrainEditing';
import { islandShaping } from './terraceTerrain';
import type { Cell, GrowingState, Landmark, LandmarkKind, SeedKind } from './types';

/** DEV switch for the place-growth experiment (advice glows, growing a place, raising a grove). */
export const placeGrowthEnabled = () => islandShaping() || Boolean(import.meta.env?.DEV && import.meta.env.VITE_PLACE_GROWTH === 'on');

/**
 * DEV experiment: where a new thing would help the island read as one garden. It only
 * ranks cells the child may already use; placing elsewhere stays fully allowed. The
 * rules come from how the adopted art composes a lived island: homes gather in small
 * hamlets with their doors kept open, fields join into a patchwork at the edge, trees
 * into groves, water into one running line, flowers and seats where people pass.
 */
export type AdviceGroup = 'home' | 'farm' | 'tree' | 'water' | 'flower' | 'seat' | 'other';

export function adviceGroup(kind: SeedKind | LandmarkKind): AdviceGroup {
    if (kind === 'home') return 'home';
    if (kind === 'farm') return 'farm';
    if (kind === 'sapling') return 'tree';
    if (kind === 'water-bowl' || kind === 'water-channel') return 'water';
    if (kind === 'flower' || kind === 'planter' || kind === 'wild' || kind === 'flower-arch') return 'flower';
    if (kind === 'bench' || kind === 'picnic-table' || kind === 'swing') return 'seat';
    return 'other';
}

function groups(state: GrowingState) {
    const by: Record<AdviceGroup, Cell[]> = { home: [...HOUSE_CELLS], farm: [], tree: [], water: [], flower: [], seat: [], other: [] };
    for (const plot of state.plots) if (plot.cell) {
        const group = plot.kind === 'home' ? 'home' : plot.kind === 'farm' ? 'farm' : plot.style === 'tree' ? 'tree' : plot.style === 'water' ? 'water' : plot.kind === 'wild' ? 'flower' : 'other';
        by[group].push(plot.cell);
    }
    for (const owner of state.landmarks) if (owner.cell) by[adviceGroup(owner.kind)].push(owner.cell);
    return by;
}

const manhattan = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const chebyshev = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

/**
 * The few cells worth suggesting, best first, from the cells the caller already found legal
 * and reachable. Doors and cells that would wall off other open land are never suggested;
 * when nothing good is left the list is empty (the child may still place anywhere allowed).
 */
export function placementAdvice(state: GrowingState, kind: SeedKind | LandmarkKind, candidates: readonly Cell[], limit = 3): Cell[] {
    const by = groups(state), group = adviceGroup(kind), bounds = landBounds(state);
    const homeHeart = { x: (HOUSE_CELLS[0].x + HOUSE_CELLS[1].x) / 2, z: .5 };
    // Doors stay open for everything: the cell in front of every home.
    const doors = new Set([...by.home.filter(c => !HOUSE_CELLS.slice(0, 2).some(h => key(h) === key(c))), HOME_CELL].map(c => key({ x: c.x, z: c.z + 1 })));
    const count = (list: Cell[], cell: Cell, test: (d: number) => boolean, metric = manhattan) => list.filter(o => test(metric(o, cell))).length;
    const edge = (cell: Cell) => Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
    const score = (cell: Cell) => {
        if (doors.has(key(cell))) return -100;
        const fromHeart = manhattan(cell, homeHeart);
        switch (group) {
            case 'home': {
                const close = count(by.home, cell, d => d === 1), near = count(by.home, cell, d => d >= 2 && d <= 3);
                const front = { x: cell.x, z: cell.z + 1 };
                const frontOpen = !Object.values(by).some(list => list.some(o => key(o) === key(front))) && front.z < bounds.depth;
                // A hamlet holds a handful of homes; beyond that the next one starts nearby.
                const crowd = count(by.home, cell, d => d <= 2, chebyshev) >= 5 ? -5 : 0;
                return near * 2 + close * .5 + (frontOpen ? 2 : -4) - count(by.farm, cell, d => d === 1) * 3
                    - count(by.tree, cell, d => d === 1) * 1.5 + crowd - fromHeart * .25;
            }
            case 'farm':
                return count(by.farm, cell, d => d === 1) * 3 + count(by.farm, cell, d => d === 1, chebyshev) - count(by.home, cell, d => d <= 1, chebyshev) * 2
                    + (edge(cell) === 0 ? 2 : edge(cell) === 1 ? 1 : 0) + fromHeart * .3;
            case 'tree':
                return count(by.tree, cell, d => d === 1, chebyshev) * 3 - count(by.home, cell, d => d === 1) * 2
                    + (edge(cell) <= 1 ? 1.5 : 0) + fromHeart * .2 - cell.z * .2;
            case 'water': {
                // One running line toward the sea: extend an end of the water, never thicken it into a pool.
                const touching = count(by.water, cell, d => d === 1), around = count(by.water, cell, d => d === 1, chebyshev);
                const line = touching === 1 ? 6 - (around - 1) * 3 : touching ? -4 : 0;
                const seaward = by.water.length ? cell.z * .8 - Math.min(edge(cell), 2) * .3 : -fromHeart * .1;
                return line + seaward + count([...by.flower, ...by.seat], cell, d => d <= 2) * .6 - count(by.home, cell, d => d === 1) * 2;
            }
            case 'flower':
                return count(by.home, cell, d => d >= 1 && d <= 2) * 1.2 + count(by.flower, cell, d => d === 1) + count(by.water, cell, d => d <= 2) * .8
                    - count(by.farm, cell, d => d === 1) * 2 - fromHeart * .15;
            case 'seat':
                return count(by.water, cell, d => d <= 2) * 2 + count(by.flower, cell, d => d <= 2) * 1.5 + count(by.tree, cell, d => d <= 2)
                    - count(by.farm, cell, d => d <= 1) - count(by.seat, cell, d => d <= 2) * 2 - fromHeart * .2;
            default:
                return count([...by.seat, ...by.flower], cell, d => d <= 2) - count(by.farm, cell, d => d <= 1) - fromHeart * .2;
        }
    };
    const ranked = [...candidates].map(cell => ({ cell, value: score(cell) })).filter(entry => entry.value > -100)
        .sort((a, b) => b.value - a.value || manhattan(a.cell, homeHeart) - manhattan(b.cell, homeHeart) || a.cell.x - b.cell.x || a.cell.z - b.cell.z)
        .map(entry => entry.cell);
    // Never advise a cell that would wall off other open land from the home.
    const world = editableIslandWorld(state), reached = reachableFromHome(state, undefined, world);
    const open = landCells(state, world).filter(c => isVacant(state, c) && isReachable(c, reached, world));
    const keeps = (cell: Cell) => {
        const after = { ...state, keepsakes: [...state.keepsakes, { id: 'advice-probe', unitId: 'advice-probe', cell }] };
        const r = reachableFromHome(after, walkableCells(after, world), world);
        return open.every(c => key(c) === key(cell) || isReachable(c, r, world));
    };
    const safe: Cell[] = [];
    for (const cell of ranked) { if (safe.length >= limit) break; if (keeps(cell)) safe.push(cell); }
    return safe;
}

/** Growing a place instead of adding a thing: what may be grown, how far, and its price. */
export const TENDABLE: readonly LandmarkKind[] = ['sapling', 'flower', 'water-bowl', 'water-channel'];
export const TEND_LIMIT = 3;
export const tendPrice = (kind: LandmarkKind) => LANDMARK_PRICE[kind] ?? 20;

/** Share of the land that already holds something. Past half, the next reward grows a place. */
export function islandCrowding(state: GrowingState) {
    const land = landCells(state).length || 1;
    const held = new Set([...HOUSE_CELLS, ...state.plots.flatMap(p => p.cell ? [p.cell] : []), ...state.landmarks.flatMap(l => l.cell ? [l.cell] : [])].map(key));
    return held.size / land;
}
export const crowded = (state: GrowingState) => islandCrowding(state) >= .5;

/** The place most worth growing next: the least-grown member of the largest group of its kind. */
export function tendAdvice(state: GrowingState): Landmark | undefined {
    const by = groups(state);
    const kin = (l: Landmark) => by[adviceGroup(l.kind)].filter(o => chebyshev(o, l.cell!) === 1).length;
    return state.landmarks.filter(l => l.cell && TENDABLE.includes(l.kind) && (l.tended ?? 0) < TEND_LIMIT && (l.kind !== 'sapling' || l.growth >= TREE_MATURE_HOURS))
        .sort((a, b) => (a.tended ?? 0) - (b.tended ?? 0) || kin(b) - kin(a) || a.id.localeCompare(b.id))[0];
}

/** Mature trees on level ground, gathered into groves of three or more (cheap; no terrain checks). */
export function groves(state: GrowingState): Landmark[][] {
    const height = (c: Cell) => state.terrain?.heights[key(c)] ?? 0;
    const trees = state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS && height(l.cell) === 0);
    const seen = new Set<string>(), out: Landmark[][] = [];
    for (const start of trees) {
        if (seen.has(start.id)) continue;
        const grove = [start]; seen.add(start.id);
        for (let i = 0; i < grove.length; i++) for (const other of trees)
            if (!seen.has(other.id) && chebyshev(other.cell!, grove[i].cell!) === 1) { seen.add(other.id); grove.push(other); }
        if (grove.length >= 3) out.push(grove);
    }
    return out;
}

/**
 * A grown grove may become a small hill. Returns the one-step terrain edits that raise it
 * two steps (or one, if two would not hold), each checked by the ordinary terrain rules.
 */
export function groveLift(state: GrowingState, treeId?: string): { cells: Cell[]; edits: { type: 'terrain-edit'; cell: Cell; delta: 1; group: string }[] } | undefined {
    for (const grove of groves(state)) {
        if (treeId && !grove.some(t => t.id === treeId)) continue;
        const cells = grove.map(t => t.cell!);
        for (const steps of [2, 1]) {
            const group = `grove:${grove[0].id}:${state.terrain?.undo.length ?? 0}`;
            const edits = Array.from({ length: steps }, () => cells.map(cell => ({ type: 'terrain-edit' as const, cell: { ...cell }, delta: 1 as const, group }))).flat();
            try {
                const probe = structuredClone(state);
                if (edits.every(edit => applyTerrainCommand(probe, edit))) return { cells, edits };
            } catch { /* this height would strand or tilt something: try lower */ }
        }
    }
    return undefined;
}
