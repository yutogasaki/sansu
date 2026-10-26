import { editableIslandWorld, editableTerracePlan, terrainOf } from './editableTerrainWorld';
import { growthStage, type ItemKind } from '../islandLife/model';
import { connectedWaterChannels, shadeInfluence, waterInfluence, type WaterLayout } from '../islandLife/waterChannels';
import { RULES } from './rules';
import { distance, key, landCells, onLand } from './space';
import { OWN_LANDMARKS, type Cell, type Character, type GrowingState, type PlotStyle } from './types';
import type { IslandWorld } from './worldDefinition';

type Feature = Exclude<Character, 'mixed'>;
export type Scores = Record<Feature, number>;
const empty = (): Scores => ({ water: 0, tree: 0, flower: 0, farm: 0, light: 0 });

/** The shared water/shade formulas read only placed current-catalog items. */
export function waterLayout(state: GrowingState, world?: IslandWorld): WaterLayout {
    world ??= editableIslandWorld(state);
    return { items: state.landmarks.filter(l => !OWN_LANDMARKS.includes(l.kind) && l.cell && (!world || onLand(state, l.cell, world)))
        .map(l => ({ kind: l.kind as ItemKind, cell: l.cell, growth: l.growth })),
        ...(world ? { neighbors: (cell: Cell) => world.neighbors(cell, 'water') } : {}) };
}

export const TREE_MATURE_HOURS = 18;

const dugCache = new Map<string, Cell[]>();
/**
 * Cells the child dug below the sea (a cove, a pond, a stream) on the terrace ground. They
 * water the soil around them like a water bowl, and count toward the island's water.
 */
export function dugWater(state: GrowingState): Cell[] {
    const terrain = terrainOf(state);
    if (!terrain || !Object.values(terrain.heights).some(height => height < 0)) return [];
    const id = JSON.stringify([state.land, terrain.heights]), known = dugCache.get(id);
    if (known) return known;
    const plan = editableTerracePlan(state);
    const cells = plan ? [...plan.levels.keys()].filter(k => !plan.dry.has(k)).map(k => { const [x, z] = k.split(',').map(Number); return { x, z }; }) : [];
    if (dugCache.size > 32) dugCache.clear();
    dugCache.set(id, cells); return cells;
}
const dugInfluence = (state: GrowingState, cell: Cell) =>
    Math.max(0, ...dugWater(state).map(water => Math.max(0, Math.min(1, 1 - Math.max(0, distance(water, cell) - 1) / 3))));
/** Raised terrace ground: trees there catch the sun and grow a little faster. */
export const sunnyHill = (state: GrowingState, cell: Cell) => Boolean(editableTerracePlan(state)) && (terrainOf(state)?.heights[key(cell)] ?? 0) >= 1;

/** A wonder seed's form follows its surroundings (§3.5): heart tree, polka-dot arch or pumpkin. */
export type WonderForm = 'heart-tree' | 'dot-arch' | 'pumpkin';
export const wonderForm = (style?: PlotStyle): WonderForm => style === 'tree' || style === 'flower' ? 'heart-tree' : style === 'water' || style === 'light' ? 'dot-arch' : 'pumpkin';
const wonderFeature = (style?: PlotStyle): Feature => { const form = wonderForm(style); return form === 'heart-tree' ? 'flower' : form === 'dot-arch' ? 'light' : 'farm'; };
export const BLOOM_HOURS = 6;

/** A light on raised ground reaches one cell further (§1.4). */
const raised = (state: GrowingState, cell: Cell) => (terrainOf(state)?.heights[key(cell)] ?? 0) >= 1 ? 1 : 0;

type FeaturePoint = { cell: Cell; feature: Feature; points: number; reach?: number };
/** Feature points of everything that stands on the island (spec 52 §3.2, §6). */
export function features(state: GrowingState, world?: IslandWorld): FeaturePoint[] {
    world ??= editableIslandWorld(state);
    const reached = connectedWaterChannels(waterLayout(state, world)), out: FeaturePoint[] = [];
    for (const l of state.landmarks) {
        if (!l.cell || world && !onLand(state, l.cell, world)) continue;
        if (l.kind === 'water-bowl' || l.kind === 'fountain') out.push({ cell: l.cell, feature: 'water', points: 2 });
        else if (l.kind === 'water-channel' && reached.has(key(l.cell))) out.push({ cell: l.cell, feature: 'water', points: 1 });
        else if (l.kind === 'sapling') out.push({ cell: l.cell, feature: 'tree', points: l.growth >= TREE_MATURE_HOURS ? 2 : 1 });
        else if (l.kind === 'flower' && growthStage({ kind: 'flower', growth: l.growth }) === 2) out.push({ cell: l.cell, feature: 'flower', points: 1 });
        else if (l.kind === 'lantern') out.push({ cell: l.cell, feature: 'light', points: 2, reach: raised(state, l.cell) });
        else if (l.kind === 'lighthouse') out.push({ cell: l.cell, feature: 'light', points: 4, reach: raised(state, l.cell) });
        else if (l.kind === 'planter') out.push({ cell: l.cell, feature: 'farm', points: 1 });
    }
    for (const p of state.plots) {
        if (!p.cell || p.stage === 0 || world && !onLand(state, p.cell, world)) continue;
        if (p.kind === 'farm' || p.kind === 'market') out.push({ cell: p.cell, feature: 'farm', points: 2 });
        else if (p.kind === 'wonder') out.push({ cell: p.cell, feature: wonderFeature(p.style), points: 2 });
        else if (p.kind === 'wild' && p.growth >= BLOOM_HOURS) {
            const feature: Feature = p.style === 'tree' ? 'tree' : p.style === 'water' ? 'water' : p.style === 'light' ? 'light' : 'flower';
            out.push({ cell: p.cell, feature, points: 1 });
        }
    }
    // Dug water joins the island's water, a point per cell up to six.
    for (const cell of dugWater(state).slice(0, 6)) out.push({ cell, feature: 'water', points: 1 });
    return out;
}

export function scoresNear(state: GrowingState, cell: Cell, radius = RULES.styleRadius, all?: ReturnType<typeof features>, world?: IslandWorld): Scores {
    world ??= editableIslandWorld(state);
    const scores = empty();
    for (const f of all ?? features(state, world)) if (distance(f.cell, cell) <= radius + (f.reach ?? 0) && (!world || onLand(state, f.cell, world))) scores[f.feature] += f.points;
    return scores;
}

const STYLE_ORDER: readonly Exclude<PlotStyle, 'plain'>[] = ['water', 'tree', 'flower', 'light'];

/** The form a plot takes when it is built. Ties follow the table order; farms do not style. */
export function styleAt(state: GrowingState, cell: Cell, all?: ReturnType<typeof features>, world?: IslandWorld): PlotStyle {
    world ??= editableIslandWorld(state);
    const scores = scoresNear(state, cell, RULES.styleRadius, all, world);
    let best: PlotStyle = 'plain', bestPoints = 0;
    for (const s of STYLE_ORDER) if (scores[s] > bestPoints) { best = s; bestPoints = scores[s]; }
    return bestPoints >= 1 ? best : 'plain';
}

const CHARACTER_ORDER: readonly Feature[] = ['water', 'tree', 'flower', 'farm', 'light'];

export function islandScores(state: GrowingState, world?: IslandWorld): Scores {
    world ??= editableIslandWorld(state);
    const scores = empty();
    for (const f of features(state, world)) scores[f.feature] += f.points;
    return scores;
}

export function islandCharacter(state: GrowingState, world?: IslandWorld): Character {
    world ??= editableIslandWorld(state);
    const scores = islandScores(state, world), total = CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
    if (total < RULES.characterMinimum) return 'mixed';
    let best: Feature = 'water';
    for (const f of CHARACTER_ORDER) if (scores[f] > scores[best]) best = f;
    return scores[best] / total >= RULES.characterShare ? best : 'mixed';
}

export function richness(state: GrowingState, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    const scores = islandScores(state, world);
    return CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
}

export function soilTargetAt(state: GrowingState, cell: Cell, layout?: WaterLayout, reached?: Set<string>, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    layout ??= waterLayout(state, world);
    reached ??= connectedWaterChannels(layout);
    const water = Math.max(waterInfluence(layout, cell, reached), dugInfluence(state, cell));
    return Math.max(0, Math.min(1, RULES.soilBase + .5 * water + .08 * shadeInfluence(layout, cell)));
}

export function waterAt(state: GrowingState, cell: Cell, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    return !world || onLand(state, cell, world) ? Math.max(waterInfluence(waterLayout(state, world), cell), dugInfluence(state, cell)) : 0;
}

export function soilAt(state: GrowingState, cell: Cell) { return state.soil[key(cell)] ?? RULES.soilBase; }

export function syncSoil(state: GrowingState, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    for (const cell of landCells(state, world)) state.soil[key(cell)] ??= RULES.soilBase;
}
