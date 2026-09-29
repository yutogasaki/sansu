import { growthStage, type ItemKind } from '../islandLife/model';
import { connectedWaterChannels, shadeInfluence, waterInfluence, type WaterLayout } from '../islandLife/waterChannels';
import { RULES } from './rules';
import { distance, key, landCells } from './space';
import type { Cell, Character, GrowingState, PlotStyle } from './types';

type Feature = Exclude<Character, 'mixed'>;
export type Scores = Record<Feature, number>;
const empty = (): Scores => ({ water: 0, tree: 0, flower: 0, farm: 0, light: 0 });

/** The shared water/shade formulas read only placed current-catalog items. */
export function waterLayout(state: GrowingState): WaterLayout {
    return { items: state.landmarks.filter(l => l.kind !== 'lighthouse' && l.cell)
        .map(l => ({ kind: l.kind as ItemKind, cell: l.cell, growth: l.growth })) };
}

export const TREE_MATURE_HOURS = 18;
export const BLOOM_HOURS = 6;

/** Feature points of everything that stands on the island (spec 52 §3.2, §6). */
export function features(state: GrowingState): { cell: Cell; feature: Feature; points: number }[] {
    const reached = connectedWaterChannels(waterLayout(state)), out: { cell: Cell; feature: Feature; points: number }[] = [];
    for (const l of state.landmarks) {
        if (!l.cell) continue;
        if (l.kind === 'water-bowl') out.push({ cell: l.cell, feature: 'water', points: 2 });
        else if (l.kind === 'water-channel' && reached.has(key(l.cell))) out.push({ cell: l.cell, feature: 'water', points: 1 });
        else if (l.kind === 'sapling') out.push({ cell: l.cell, feature: 'tree', points: l.growth >= TREE_MATURE_HOURS ? 2 : 1 });
        else if (l.kind === 'flower' && growthStage({ kind: 'flower', growth: l.growth }) === 2) out.push({ cell: l.cell, feature: 'flower', points: 1 });
        else if (l.kind === 'lantern') out.push({ cell: l.cell, feature: 'light', points: 2 });
        else if (l.kind === 'lighthouse') out.push({ cell: l.cell, feature: 'light', points: 4 });
        else if (l.kind === 'planter') out.push({ cell: l.cell, feature: 'farm', points: 1 });
    }
    for (const p of state.plots) {
        if (!p.cell || p.stage === 0) continue;
        if (p.kind === 'farm' || p.kind === 'market') out.push({ cell: p.cell, feature: 'farm', points: 2 });
        else if (p.kind === 'wild' && p.growth >= BLOOM_HOURS) {
            const feature: Feature = p.style === 'tree' ? 'tree' : p.style === 'water' ? 'water' : p.style === 'light' ? 'light' : 'flower';
            out.push({ cell: p.cell, feature, points: 1 });
        }
    }
    return out;
}

export function scoresNear(state: GrowingState, cell: Cell, radius = RULES.styleRadius, all = features(state)): Scores {
    const scores = empty();
    for (const f of all) if (distance(f.cell, cell) <= radius) scores[f.feature] += f.points;
    return scores;
}

const STYLE_ORDER: readonly Exclude<PlotStyle, 'plain'>[] = ['water', 'tree', 'flower', 'light'];

/** The form a plot takes when it is built. Ties follow the table order; farms do not style. */
export function styleAt(state: GrowingState, cell: Cell, all = features(state)): PlotStyle {
    const scores = scoresNear(state, cell, RULES.styleRadius, all);
    let best: PlotStyle = 'plain', bestPoints = 0;
    for (const s of STYLE_ORDER) if (scores[s] > bestPoints) { best = s; bestPoints = scores[s]; }
    return bestPoints >= 1 ? best : 'plain';
}

const CHARACTER_ORDER: readonly Feature[] = ['water', 'tree', 'flower', 'farm', 'light'];

export function islandScores(state: GrowingState): Scores {
    const scores = empty();
    for (const f of features(state)) scores[f.feature] += f.points;
    return scores;
}

export function islandCharacter(state: GrowingState): Character {
    const scores = islandScores(state), total = CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
    if (total < RULES.characterMinimum) return 'mixed';
    let best: Feature = 'water';
    for (const f of CHARACTER_ORDER) if (scores[f] > scores[best]) best = f;
    return scores[best] / total >= RULES.characterShare ? best : 'mixed';
}

export function richness(state: GrowingState) {
    const scores = islandScores(state);
    return CHARACTER_ORDER.reduce((sum, f) => sum + scores[f], 0);
}

export function soilTargetAt(state: GrowingState, cell: Cell, layout = waterLayout(state), reached = connectedWaterChannels(layout)) {
    return Math.max(0, Math.min(1, RULES.soilBase + .5 * waterInfluence(layout, cell, reached) + .08 * shadeInfluence(layout, cell)));
}

export function waterAt(state: GrowingState, cell: Cell) {
    return waterInfluence(waterLayout(state), cell);
}

export function soilAt(state: GrowingState, cell: Cell) { return state.soil[key(cell)] ?? RULES.soilBase; }

export function syncSoil(state: GrowingState) {
    for (const cell of landCells(state)) state.soil[key(cell)] ??= RULES.soilBase;
}
