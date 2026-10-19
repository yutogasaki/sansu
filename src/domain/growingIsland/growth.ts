import { WONDER_LEVELS } from './rules';
import type { GrowingState, TownEvent } from './types';

export const WONDER_SLOTS = ['W1', 'W2', 'W3', 'W4'] as const;
export type WonderSlot = typeof WONDER_SLOTS[number];
type Receipt = { status: 'available' | 'pending' | 'legacy-confirmed' | 'granted' | 'restored'; at?: number; reason?: string; targetId?: string };
export interface GrowthProgress {
    version: 1;
    welcomed: boolean;
    built: boolean;
    matured?: string;
    expanded: boolean;
    slots: Record<WonderSlot, Receipt>;
    restoredStock: WonderSlot[];
    source?: { version: number; revision: number; best?: number };
}

export function newGrowth(): GrowthProgress {
    return { version: 1, welcomed: false, built: false, expanded: false,
        slots: Object.fromEntries(WONDER_SLOTS.map(id => [id, { status: 'available' }])) as GrowthProgress['slots'], restoredStock: [] };
}

/** Source tables are retained unchanged. Never infer issuance from remaining inventory. */
export function migrateGrowth(state: GrowingState, version: number, revision: number) {
    if (state.growth) { validateGrowth(state); return; }
    const growth = newGrowth(), best = state.genki?.best;
    for (const plot of state.plots) if (plot.kind === 'home' && plot.stage > 0 && plot.stage < 4
        && plot.stagedAt === undefined && plot.builtAt === undefined) plot.stagedAt = state.town.clock;
    growth.source = { version, revision, ...(Number.isFinite(best) ? { best } : {}) };
    // Only the audited record-4 lineage has the documented level-crossing issuance contract.
    const proven = version === 4 && state.rules === 'growing-island-v1' && Number.isInteger(best) && best >= 0;
    WONDER_SLOTS.forEach((id, index) => {
        growth.slots[id] = { status: !proven ? 'pending' : best >= [8, 25, 60, 115][index] ? 'legacy-confirmed' : 'available',
            reason: proven ? `legacy-level-${WONDER_LEVELS[index]}` : 'legacy-evidence-missing' };
    });
    growth.welcomed = state.villagers.length > 0;
    growth.built = state.plots.some(p => p.townBuilt && p.paid > 0 && !['wild', 'wonder'].includes(p.kind));
    growth.expanded = Boolean(state.land.expanded || state.land.extra.length || state.land.capes.length || state.land.districts?.length);
    state.growth = growth;
}

export function validateGrowth(state: GrowingState) {
    const g = state.growth;
    if (!g || g.version !== 1 || typeof g.welcomed !== 'boolean' || typeof g.built !== 'boolean' || typeof g.expanded !== 'boolean'
        || !g.slots || !WONDER_SLOTS.every(id => ['available', 'pending', 'legacy-confirmed', 'granted', 'restored'].includes(g.slots[id]?.status))
        || !Array.isArray(g.restoredStock) || new Set(g.restoredStock).size !== g.restoredStock.length
        || g.restoredStock.some(id => !WONDER_SLOTS.includes(id) || g.slots[id].status !== 'restored')
        || g.restoredStock.length > (state.wonderSeeds ?? 0)) throw new Error('この島の記念は新しい版で開いてください。');
    if (state.plots.some(p => p.restoredWonder && (p.kind !== 'wonder' || p.paid !== 0)))
        throw new Error('Invalid restored memorial provenance');
    const planted = state.plots.flatMap(p => p.restoredWonder ? [p.restoredWonder] : []);
    if (new Set([...g.restoredStock, ...planted]).size !== g.restoredStock.length + planted.length
        || planted.some(id => !WONDER_SLOTS.includes(id) || g.slots[id].status !== 'restored'))
        throw new Error('この島の記念をもう一度確認してください。');
}

export function grantGrowthMilestones(state: GrowingState, at: number): TownEvent[] {
    const g = state.growth;
    if (!g) return [];
    g.welcomed ||= state.villagers.length > 0;
    const earned = [g.welcomed, g.built, !!g.matured, g.expanded], events: TownEvent[] = [];
    WONDER_SLOTS.forEach((id, index) => {
        if (!earned[index] || g.slots[id].status !== 'available') return;
        g.slots[id] = { status: 'granted', at, reason: id === 'W3' ? 'nature-transition' : 'island-milestone',
            ...(id === 'W3' ? { targetId: g.matured } : {}) };
        state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
        events.push({ type: 'wonder-seed' });
    });
    return events;
}

/** Parent-only repository operation. Its receipt and stock are committed atomically. */
export function restoreWonderSlot(state: GrowingState, slot: WonderSlot, at: number) {
    validateGrowth(state);
    const g = state.growth!;
    if (!WONDER_SLOTS.includes(slot)) throw new Error('復元する記念を選んでください。');
    if (g.slots[slot].status === 'restored') return false;
    if (g.slots[slot].status !== 'pending') throw new Error('この記念は復元の対象ではありません。');
    g.slots[slot] = { status: 'restored', at, reason: 'parent-recovery-possible-legacy-duplicate' };
    g.restoredStock.push(slot);
    state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
    return true;
}
