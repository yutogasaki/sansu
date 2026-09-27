import { HOUR, type Cell, type LifeAction, type LifeRecord, type LifeState } from './model';
import { effectiveGrowthHours, GROWTH_WINDOW_MS, growthHoursRemaining } from './economyRules';
import { cellKey, landCells } from './space';
import { shadeInfluence, waterInfluence } from './waterChannels';

export interface SoilCutover {
    rules: 'island-soil-v1'; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}

const BASE = .20;
// A three-hour half-life makes a changed water route visible during a return visit.
const RELAXATION = Math.LN2 / 3;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

async function digest(cutover: SoilCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function prepareSoilCutover(record: LifeRecord): Promise<LifeRecord> {
    if (record.soilCutover) {
        if (record.soilCutover.validationHash !== await digest(record.soilCutover)) throw new Error('土の切替記録を確認できません。');
        return record;
    }
    if (!record.foodCutover) throw new Error('島の食べものをよみなおしてから始めてね。');
    const cutover: SoilCutover = { rules: 'island-soil-v1', at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    return { ...record, soilCutover: cutover };
}

export function beginSoilMoisture(state: LifeState) {
    if (state.soilMoisture) return;
    state.soilMoisture = Object.fromEntries(landCells(state).map(cell => [cellKey(cell), BASE]));
}

export function syncSoilCells(state: LifeState) {
    if (!state.soilMoisture) return;
    for (const cell of landCells(state)) state.soilMoisture[cellKey(cell)] ??= BASE;
}

export function soilMoistureAt(state: LifeState, cell: Cell) {
    return state.soilMoisture?.[cellKey(cell)] ?? BASE;
}

export function soilWetness(value: number) { return clamp((value - BASE) / .5); }

export function soilTarget(state: LifeState, cell: Cell, elapsedGrowthHours = 0) {
    return clamp(BASE + .50 * waterInfluence(state, cell) + .08 * shadeInfluence(state, cell, elapsedGrowthHours));
}

function relaxed(start: number, target: number, hours: number) {
    return target + (start - target) * Math.exp(-RELAXATION * hours);
}

function average(start: number, target: number, hours: number) {
    return hours ? target + (start - target) * -Math.expm1(-RELAXATION * hours) / (RELAXATION * hours) : start;
}

function averageWetness(start: number, target: number, hours: number) {
    if (hours <= 0) return soilWetness(start);
    const end = relaxed(start, target, hours), full = BASE + .5;
    if (start <= full && end <= full) return soilWetness(average(start, target, hours));
    if (start >= full && end >= full) return 1;
    const crossing = Math.max(0, Math.min(hours, -Math.log((full - target) / (start - target)) / RELAXATION));
    if (start < full) return (crossing * soilWetness(average(start, target, crossing)) + hours - crossing) / hours;
    return (crossing + (hours - crossing) * soilWetness(average(full, target, hours - crossing))) / hours;
}

export interface SoilStep { intervals: { growthFrom: number; growthHours: number; wallHours: number }[] }

/** One clock plan is shared by all cells and planters in a replay step. */
export function planSoilStep(state: LifeState, wallHours: number, growthHours: number): SoilStep {
    const transitions = growthHours > 0 ? state.items.filter(item => item.kind === 'sapling' && item.cell)
        .map(item => 18 - item.growth).filter(at => at > 0 && at < growthHours).sort((a, b) => a - b) : [];
    const expiries = growthHours > 0 && state.economy ? state.economy.completionTimes
        .map(at => at + GROWTH_WINDOW_MS).filter(at => at > state.now && at < state.now + wallHours * HOUR)
        .map(at => effectiveGrowthHours(state.economy!.completionTimes, state.now, at))
        .filter(at => at > 0 && at < growthHours) : [];
    const boundaries = growthHours > 0 ? [0, ...new Set([...transitions, ...expiries])].sort((a, b) => a - b).concat(growthHours) : [0, 1];
    let previousWall = 0;
    const intervals: SoilStep['intervals'] = [];
    for (let index = 1; index < boundaries.length; index++) {
        const from = boundaries[index - 1], to = boundaries[index];
        const endWall = index === boundaries.length - 1 ? wallHours : state.economy
            ? Math.min(wallHours, growthHoursRemaining(state.economy.completionTimes, state.now, to))
            : wallHours * to / growthHours;
        intervals.push({ growthFrom: growthHours > 0 ? from : 0, growthHours: growthHours > 0 ? to - from : 0, wallHours: endWall - previousWall });
        previousWall = endWall;
    }
    return { intervals };
}

/** Split at tree maturity and learning-window expiry for replay-size independence. */
export function soilCourse(state: LifeState, cell: Cell, wallHours: number, growthHours: number,
    step = planSoilStep(state, wallHours, growthHours)) {
    let moisture = soilMoistureAt(state, cell);
    const segments: { growthHours: number; shade: number; water: number }[] = [];
    for (const interval of step.intervals) {
        const shade = shadeInfluence(state, cell, interval.growthFrom);
        const target = soilTarget(state, cell, interval.growthFrom);
        segments.push({ growthHours: interval.growthHours, shade, water: averageWetness(moisture, target, interval.wallHours) });
        moisture = relaxed(moisture, target, interval.wallHours);
    }
    return { moisture: clamp(moisture), segments };
}

export function advanceSoilMoisture(state: LifeState, wallHours: number, growthHours: number,
    step = planSoilStep(state, wallHours, growthHours)) {
    if (!state.soilMoisture) return;
    syncSoilCells(state);
    for (const cell of landCells(state)) state.soilMoisture[cellKey(cell)] = soilCourse(state, cell, wallHours, growthHours, step).moisture;
}
