import { BLOOM_HOURS, TREE_MATURE_HOURS } from './environment';
import { LANDMARK_PRICE } from './rules';
import { HOME_CELL, HOUSE_CELLS, isReachable, isVacant, key, landBounds, landCells, reachableFromHome, walkableCells } from './space';
import { editableIslandWorld } from './editableTerrainWorld';
import { applyTerrainCommand } from './terrainEditing';
import { islandShaping } from './terraceTerrain';
import { derivePlaces } from './places';
import { GROWTH_PLACE_GUIDES } from './placeGrowthGuides';
import type { DerivedPlace } from './placeTypes';
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
    const lost = (cell: Cell) => {
        const after = { ...state, keepsakes: [...state.keepsakes, { id: 'advice-probe', unitId: 'advice-probe', cell }] };
        const r = reachableFromHome(after, walkableCells(after, world), world);
        return open.filter(c => key(c) !== key(cell) && !isReachable(c, r, world)).length;
    };
    // Cells that wall nothing off come first; on a crowded island one closed dead end is allowed,
    // never more (a wall across the island is how a home once got shut in).
    const safe: Cell[] = [], tight: Cell[] = [];
    for (const cell of ranked.slice(0, 24)) {
        if (safe.length >= limit) break;
        const n = lost(cell);
        if (n === 0) safe.push(cell); else if (n === 1) tight.push(cell);
    }
    return [...safe, ...tight].slice(0, limit);
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

const STAGE_VALUE: Record<string, number> = { seeded: 0, connected: 2, grown: 4, lived: 5 };
const SHAPE_VALUE: Record<string, number> = { court: 3, cluster: 2, lane: 2 };
/** How much the island's places amount to: their stages, shapes, sizes and unmet needs. */
function placeValue(places: DerivedPlace[]) {
    return places.reduce((sum, place) => sum + 1 + (STAGE_VALUE[place.stage] ?? 0) + (SHAPE_VALUE[place.variant] ?? 0)
        + place.mainIds.length * .5 - place.missing.length * .5, 0);
}

/**
 * "One more and it grows": among the best few suggested cells, the one where this thing would
 * start, enlarge, reshape or complete a place (the same place rules the island already uses),
 * with a line telling the child which place it grows. Only things the child places directly.
 */
/**
 * The cell where this thing would grow a place, what to say, and the place's ground once
 * grown (`area`) beside what it covers now (`now`), so the child sees the shape to come.
 */
export function growthHint(state: GrowingState, kind: SeedKind | LandmarkKind, cells: readonly Cell[]): { cell: Cell; message: string; area: Cell[]; now: Cell[] } | undefined {
    if (kind === 'home' || kind === 'farm' || !cells.length) return undefined;
    const before = derivePlaces(state), value = placeValue(before);
    let best: { cell: Cell; gain: number; place?: DerivedPlace; previous?: DerivedPlace; fresh: boolean; reshaped: boolean } | undefined;
    for (const cell of cells.slice(0, 8)) {
        const id = 'growth-hint-probe';
        // Judge it as it will be once grown: a young tree or a bud joins its place when it matures.
        const grown = kind === 'sapling' ? { growth: TREE_MATURE_HOURS, maturedAt: state.nature.hours } : kind === 'flower' ? { growth: BLOOM_HOURS } : { growth: 0 };
        const after = derivePlaces({ ...state, landmarks: [...state.landmarks, { id, kind: kind as LandmarkKind, cell: { ...cell }, ...grown }] });
        const place = after.find(p => p.memberIds.includes(id)); if (!place) continue;
        const previous = before.find(p => p.ruleId === place.ruleId && p.mainIds.some(m => place.mainIds.includes(m)));
        // Growing a place the child already has always comes before starting a lone new one.
        const gain = (placeValue(after) - value) + (previous ? 100 : 0);
        if (gain <= (previous ? 100 : .5) || best && gain <= best.gain) continue;
        best = { cell, gain, place, previous, fresh: !previous, reshaped: Boolean(previous && previous.variant !== place.variant) };
    }
    if (!best?.place) return undefined;
    const name = GROWTH_PLACE_GUIDES[best.place.ruleId].name, when = kind === 'sapling' || kind === 'flower' ? 'ここに おいて そだつと' : 'ここに おくと';
    return { cell: best.cell, area: best.place.footprint.map(c => ({ x: c.x, z: c.z })), now: (best.previous?.footprint ?? []).map(c => ({ x: c.x, z: c.z })), message: best.fresh ? `${when}「${name}」が はじまるよ`
        : best.reshaped ? `${when}「${name}」の かたちが かわるよ` : `${when}「${name}」が ひろがるよ` };
}
