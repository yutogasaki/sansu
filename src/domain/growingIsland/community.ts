import { growthStage } from '../islandLife/model';
import { connectedWaterChannels } from '../islandLife/waterChannels';
import { TREE_MATURE_HOURS, waterAt, waterLayout } from './environment';
import { FOOD_SUPPORT, LIKES, PLAY_SUPPORT, RULES, UNLOCKS } from './rules';
import { HOME_CELL, distance, isReachable, key, reachableFromHome } from './space';
import type { Cell, GrowingState, Like, Villager } from './types';

export function homeCellOf(state: GrowingState, villager: Villager): Cell {
    return state.plots.find(p => p.id === villager.home)?.cell ?? HOME_CELL;
}

/** People who can live in plot homes. Friends sharing Pokomoko's house do not use a home slot. */
export function housing(state: GrowingState) {
    const capacity = state.plots.filter(p => p.kind === 'home' && p.cell)
        .reduce((sum, p) => sum + RULES.homeCapacity[p.stage], 0);
    const housed = state.villagers.filter(v => v.home !== 'pokomoko').length;
    return { capacity, housed, vacancy: capacity - housed };
}

export function occupantsOf(state: GrowingState, plotId: string) {
    return state.villagers.filter(v => v.home === plotId);
}

/** Food reaches people only from plots Pokomoko's doorstep can walk to (§7.3). */
export function foodSupport(state: GrowingState, reached = reachableFromHome(state)) {
    let support: number = RULES.baseFood;
    for (const p of state.plots) {
        if (!p.cell || p.stage === 0 || !isReachable(p.cell, reached)) continue;
        if (p.kind === 'farm') support += waterAt(state, p.cell) > 0 ? FOOD_SUPPORT.farm! + 1 : FOOD_SUPPORT.farm!;
        else if (p.kind === 'market') support += FOOD_SUPPORT.market!;
    }
    for (const l of state.landmarks) if (l.kind === 'planter' && l.cell && isReachable(l.cell, reached)) support += 1;
    return support;
}

export function playSupport(state: GrowingState) {
    let support: number = RULES.basePlay;
    for (const p of state.plots) if (p.cell && p.stage > 0) support += PLAY_SUPPORT[p.kind] ?? 0;
    for (const l of state.landmarks) if (l.cell) support += PLAY_SUPPORT[l.kind] ?? 0;
    return support + state.keepsakes.filter(k => k.cell).length * 2;
}

function playCells(state: GrowingState): Cell[] {
    return [
        ...state.plots.filter(p => p.cell && p.stage > 0 && PLAY_SUPPORT[p.kind]).map(p => p.cell!),
        ...state.landmarks.filter(l => l.cell && PLAY_SUPPORT[l.kind]).map(l => l.cell!),
        ...state.keepsakes.filter(k => k.cell).map(k => k.cell!),
    ];
}

function playPlotCells(state: GrowingState): Cell[] {
    return state.plots.filter(p => p.cell && p.stage > 0 && (p.kind === 'play' || p.kind === 'festival')).map(p => p.cell!);
}

function likeCells(state: GrowingState, like: Like): Cell[] {
    const reached = connectedWaterChannels(waterLayout(state));
    switch (like) {
        case 'flower': return [
            ...state.landmarks.filter(l => l.kind === 'flower' && l.cell && growthStage({ kind: 'flower', growth: l.growth }) === 2).map(l => l.cell!),
            ...state.plots.filter(p => p.kind === 'wild' && p.cell && p.stage > 0 && p.growth >= 6 && p.style !== 'tree').map(p => p.cell!),
        ];
        case 'water': return state.landmarks.filter(l => l.cell && (l.kind === 'water-bowl'
            || l.kind === 'water-channel' && reached.has(key(l.cell)))).map(l => l.cell!);
        case 'tree': return state.landmarks.filter(l => l.kind === 'sapling' && l.cell && l.growth >= TREE_MATURE_HOURS).map(l => l.cell!);
        case 'light': return state.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).map(l => l.cell!);
        case 'farm': return state.plots.filter(p => p.cell && p.stage > 0 && (p.kind === 'farm' || p.kind === 'market')).map(p => p.cell!);
        case 'play': return playCells(state);
        default: return [];
    }
}

const within = (cells: Cell[], home: Cell, radius: number) => cells.some(c => distance(c, home) <= radius);

/** Comfort stars 0-3 (§7.4). Shown to children only through faces and one-line remarks. */
export function comfort(state: GrowingState, villager: Villager, fed = foodSupport(state) >= state.villagers.length) {
    const home = homeCellOf(state, villager), likes = LIKES[villager.species];
    const quiet = !within(playPlotCells(state), home, RULES.quietRadius);
    const liked = likes.some(like => like === 'food' ? fed : like === 'quiet' ? quiet : within(likeCells(state, like), home, RULES.likeRadius));
    const played = likes.includes('quiet') ? quiet : within(playCells(state), home, RULES.likeRadius);
    return (liked ? 1 : 0) + (fed ? 1 : 0) + (played ? 1 : 0);
}

export function genki(state: GrowingState) {
    const fed = foodSupport(state) >= state.villagers.length;
    return state.villagers.reduce((sum, v) => sum + comfort(state, v, fed), 0);
}

export function levelFor(points: number) {
    let level = 1;
    RULES.genkiLevels.forEach((threshold, index) => { if (points >= threshold) level = index + 1; });
    return level;
}

export const islandLevel = (state: GrowingState) => levelFor(state.genki.best);

export function unlockedKeys(state: GrowingState) {
    const level = islandLevel(state), villagers = state.villagers.length;
    return UNLOCKS.filter(u => (u.level ?? 1) <= level && (u.villagers ?? 0) <= villagers).map(u => u.key);
}

/** Adds newly opened keys and returns them for the evening announcement. */
export function refreshUnlocks(state: GrowingState): string[] {
    const fresh = unlockedKeys(state).filter(k => !state.unlocked.includes(k));
    state.unlocked.push(...fresh);
    return fresh;
}
