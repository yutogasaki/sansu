import { BLOOM_HOURS, soilAt, soilTargetAt, styleAt, syncSoil, TREE_MATURE_HOURS, waterLayout } from './environment';
import { connectedWaterChannels } from '../islandLife/waterChannels';
import { roll } from './random';
import { MIX_EVERY, mixFlowers } from './flowers';
import { RULES } from './rules';
import { HOUSE_CELLS, isVacant, key, landCells, neighbors, same } from './space';
import type { Cell, GrowingState, NatureEvent } from './types';

const HOUR_MS = 3_600_000;
const wetness = (moisture: number) => Math.max(0, Math.min(1, (moisture - RULES.soilBase) / .5));

function relaxSoil(state: GrowingState, targets: Map<string, number>, hours: number) {
    const keep = Math.pow(2, -hours / RULES.soilHalfLife);
    for (const [k, target] of targets) state.soil[k] = target + ((state.soil[k] ?? RULES.soilBase) - target) * keep;
}

function grow(state: GrowingState, hours: number, events: NatureEvent[]) {
    for (const l of state.landmarks) {
        if (!l.cell) continue;
        const m = wetness(soilAt(state, l.cell));
        if (l.kind === 'flower' && l.growth < BLOOM_HOURS) {
            l.growth = Math.min(BLOOM_HOURS, l.growth + hours * (1 + .25 * m));
            if (l.growth >= BLOOM_HOURS) events.push({ type: 'bloomed', id: l.id });
        } else if (l.kind === 'sapling' && l.growth < TREE_MATURE_HOURS) {
            l.growth = Math.min(TREE_MATURE_HOURS, l.growth + hours * (1 + .15 * m));
            if (l.growth >= TREE_MATURE_HOURS) { l.maturedAt = state.nature.hours + hours; events.push({ type: 'matured', id: l.id }); }
        }
    }
    for (const p of state.plots) {
        if (p.kind !== 'wild' || !p.cell || p.stage === 0 || p.growth >= BLOOM_HOURS) continue;
        p.growth = Math.min(BLOOM_HOURS, p.growth + hours * (1 + .25 * wetness(soilAt(state, p.cell))));
        if (p.growth >= BLOOM_HOURS) events.push({ type: 'bloomed', id: p.id });
    }
}

function age(state: GrowingState, from: number, to: number, events: NatureEvent[]) {
    for (const l of state.landmarks) {
        if (l.kind !== 'sapling' || l.maturedAt === undefined || !l.cell) continue;
        const crossed = (threshold: number) => from - l.maturedAt! < threshold && to - l.maturedAt! >= threshold;
        if (crossed(RULES.bigTreeHours)) events.push({ type: 'big-tree', id: l.id });
        if (crossed(RULES.lordTreeHours)) events.push({ type: 'lord-tree', id: l.id });
    }
}

export function treeAge(state: GrowingState, id: string): 'young' | 'mature' | 'big' | 'lord' {
    const tree = state.landmarks.find(l => l.id === id);
    if (!tree || tree.maturedAt === undefined) return 'young';
    const age = state.nature.hours - tree.maturedAt;
    return age >= RULES.lordTreeHours ? 'lord' : age >= RULES.bigTreeHours ? 'big' : 'mature';
}

/** Wild plants never crowd doorsteps, seeds, landmarks or Pokomoko's porch (§5). */
function spreadTargets(state: GrowingState, from: Cell): Cell[] {
    const doors = [...HOUSE_CELLS, ...state.plots.filter(p => p.kind === 'home' && p.cell).map(p => p.cell!)];
    return neighbors(from).filter(cell => isVacant(state, cell)
        && !doors.some(door => neighbors(door).some(n => same(n, cell)))
        && soilAt(state, cell) >= RULES.spreadMoisture);
}

function spread(state: GrowingState, round: number, events: NatureEvent[]) {
    const limit = Math.floor(landCells(state).length * RULES.wildShare);
    const parents = state.plots.filter(p => p.kind === 'wild' && p.cell && p.stage > 0 && p.growth >= BLOOM_HOURS)
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const parent of parents) {
        if (state.plots.filter(p => p.kind === 'wild').length >= limit) return;
        if (roll(state.seed, 'spread', parent.id, round) >= RULES.spreadChance) continue;
        const targets = spreadTargets(state, parent.cell!);
        if (!targets.length) continue;
        const cell = targets[Math.floor(roll(state.seed, 'spread-cell', parent.id, round) * targets.length)];
        const plot = { id: `p${state.nextId++}`, kind: 'wild' as const, cell, plantedAt: state.town.clock, builtAt: state.town.clock,
            stagedAt: state.town.clock, stage: 1 as const, style: styleAt(state, cell), growth: 0, origin: 'spread' as const, paid: 0 };
        state.plots.push(plot);
        events.push({ type: 'spread', plotId: plot.id });
    }
}

/**
 * Real time grows nature, including while the child is away, capped at seven days per
 * absence. A clock that moved backwards is treated as no time passing.
 */
export function advanceNature(state: GrowingState, now: number): NatureEvent[] {
    const events: NatureEvent[] = [];
    const elapsed = Math.min(RULES.natureHourCap, Math.max(0, (now - state.nature.realAt) / HOUR_MS));
    state.nature.realAt = Math.max(state.nature.realAt, now);
    if (elapsed <= 0) return events;
    syncSoil(state);
    const layout = waterLayout(state), reached = connectedWaterChannels(layout);
    const targets = new Map(landCells(state).map(cell => [key(cell), soilTargetAt(state, cell, layout, reached)]));
    let remaining = elapsed;
    while (remaining > 1e-9) {
        const step = Math.min(1, remaining), from = state.nature.hours;
        relaxSoil(state, targets, step);
        grow(state, step, events);
        state.nature.hours = from + step;
        age(state, from, state.nature.hours, events);
        while (Math.floor(state.nature.hours / RULES.spreadEvery) > state.nature.lastSpread) {
            state.nature.lastSpread += 1;
            spread(state, state.nature.lastSpread, events);
        }
        state.nature.lastMix ??= Math.floor(from / MIX_EVERY);
        while (Math.floor(state.nature.hours / MIX_EVERY) > state.nature.lastMix) {
            state.nature.lastMix += 1;
            mixFlowers(state, state.nature.lastMix, events);
        }
        remaining -= step;
    }
    return events;
}
