import { refreshUnlocks } from './community';
import { HOME_CELL, distance, isVacant, landCells } from './space';
import type { GrowingState, TownEvent } from './types';

/** Learning levels that bring a keepsake. The subject's main level is raised only by
 * independent evidence (spec 34), so a keepsake is never a prize for volume (§10). */
export interface LearningLevels { math: number; vocab: number }

export const KEEPSAKE_KINDS = ['blocks', 'balance', 'fountain', 'clock', 'windmill', 'star', 'flowerbed', 'tower', 'book', 'globe', 'abc', 'balloon', 'telescope'] as const;
export type KeepsakeKind = typeof KEEPSAKE_KINDS[number];

/** Each unit family has its own fixed shape: the island keeps a map of what was learned. */
export function keepsakeKind(unitId: string): KeepsakeKind {
    const [subject, raw] = unitId.split(':'), level = Number(raw);
    // English keepsakes grow with the words: letter blocks, a book, word balloons, a globe, a telescope.
    if (subject === 'vocab') return level <= 3 ? 'abc' : level <= 6 ? 'book' : level <= 9 ? 'balloon' : level <= 13 ? 'globe' : 'telescope';
    if (level <= 3) return 'blocks';
    if (level <= 7) return 'balance';
    if (level <= 12) return 'fountain';
    if (level <= 14) return 'clock';
    if (level <= 18) return 'windmill';
    if (level <= 20) return 'star';
    if (level <= 24) return 'flowerbed';
    return 'tower';
}

/**
 * Levels reached after the island started each bring one keepsake to place. The first call
 * only records where the child already was; a level reached again never brings a second.
 */
export function deliverKeepsakes(state: GrowingState, levels: LearningLevels | undefined): TownEvent[] {
    if (!levels || !Number.isSafeInteger(levels.math) || !Number.isSafeInteger(levels.vocab)) return [];
    if (!state.mastery) { state.mastery = { ...levels }; return []; }
    const events: TownEvent[] = [];
    for (const subject of ['math', 'vocab'] as const) {
        for (let level = state.mastery[subject] + 1; level <= levels[subject]; level++) {
            const unitId = `${subject}:${level}`;
            if (state.keepsakes.some(k => k.unitId === unitId)) continue;
            state.keepsakes.push({ id: `k${state.nextId++}`, unitId });
            events.push({ type: 'keepsake', unitId });
        }
        state.mastery[subject] = Math.max(state.mastery[subject], levels[subject]);
    }
    if (events.length) refreshUnlocks(state);
    return events;
}

/** A flower another profile on this device left while visiting (§13). */
export interface FlowerGift { id: string; to: string; from: string; fromName: string; at: number }

const GIFT_MEMORY = 200;

/** The open cell nearest Pokomoko's doorstep, so a gift is the first thing a child sees. */
function giftCell(state: GrowingState) {
    return landCells(state).filter(cell => isVacant(state, cell))
        .sort((a, b) => distance(a, HOME_CELL) - distance(b, HOME_CELL) || a.z - b.z || a.x - b.x)[0];
}

/** Each gift for this island becomes a bloomed flower once; with no room it waits among stored things. */
export function receiveGifts(state: GrowingState, gifts: readonly FlowerGift[]): TownEvent[] {
    const seen = new Set(state.gifts ?? []), events: TownEvent[] = [];
    for (const gift of [...gifts].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
        if (seen.has(gift.id)) continue;
        seen.add(gift.id);
        const cell = giftCell(state), id = `l${state.nextId++}`;
        state.landmarks.push({ id, kind: 'flower', cell, growth: 6, from: gift.fromName.slice(0, 12) });
        events.push({ type: 'gift', from: gift.fromName.slice(0, 12), landmarkId: id });
    }
    if (events.length) state.gifts = [...seen].slice(-GIFT_MEMORY);
    return events;
}
