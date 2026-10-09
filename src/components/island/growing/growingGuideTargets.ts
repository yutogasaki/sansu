import { canPlace } from '../../../domain/growingIsland/commands';
import { PLANTED_COLORS } from '../../../domain/growingIsland/flowers';
import { landCells } from '../../../domain/growingIsland/space';
import type { GrowingState } from '../../../domain/growingIsland/types';

/** Older flowers lack a purchase marker; gifts and mixed colours are not purchases. */
export function hasPurchasedFlower(state: GrowingState) {
    return Boolean(state.guidance?.firstFlower || state.landmarks.some(item => item.kind === 'flower'
        && item.id !== 'starter-flower' && item.from === undefined
        && (item.color === undefined || PLANTED_COLORS.some(entry => entry.color === item.color))));
}

export function starterBench(state: GrowingState) {
    return state.landmarks.find(item => item.kind === 'bench' && item.cell)
        ?? state.landmarks.find(item => item.kind === 'bench');
}

export function canMoveStarterBench(state: GrowingState) {
    const bench = starterBench(state);
    return Boolean(bench?.cell && landCells(state).some(cell =>
        (cell.x !== bench.cell!.x || cell.z !== bench.cell!.z) && canPlace(state, cell, bench.id)));
}

export function starterPlayChoices(state: GrowingState) {
    return (['A4', 'A3'] as const).filter(id => !state.guidance?.achievements[id]
        && (id !== 'A4' || canMoveStarterBench(state)));
}

export function growingTownSeed(state: GrowingState) {
    const seeds = state.plots.filter(plot => !plot.starter && plot.paid > 0
        && plot.kind !== 'wild' && plot.kind !== 'wonder' && plot.cell);
    return seeds.find(plot => state.unopened.includes(plot.id)) ?? seeds.find(plot => plot.stage === 0);
}
