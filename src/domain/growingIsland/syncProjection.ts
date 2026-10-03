import { migrateGuidance, noteTownBuilds, validateGuidance } from './guidance';
import { deliverKeepsakes, receiveGifts, type FlowerGift, type LearningLevels } from './gifts';
import { ingestCompletions } from './island';
import { advanceNature } from './nature';
import { openTown } from './town';
import { scheduleSurprise, surpriseDay } from './moments';
import type { Completion, GrowingRecord, SyncResult } from './repository';
import type { GrowingState } from './types';

export interface CreatedIsland { state: GrowingState; migratedFrom?: GrowingRecord['migratedFrom'] }
export interface SyncProjectionRequest {
    profileId: string; current?: GrowingRecord; created?: CreatedIsland;
    completions: readonly Completion[]; mailbox: FlowerGift[]; now: number; levels?: LearningLevels;
}
export interface SyncProjection { result: SyncResult; changed: boolean; receivedGiftIds: string[] }

export function readable(record: GrowingRecord) {
    if (record.version !== 1 && record.version !== 2 && record.version !== 3) throw new Error('この島のデータは新しい版で開いてください。');
    if (record.version === 3 && !record.state.guidance) throw new Error('この島のあそびかたは新しい版で開いてください。');
    if (record.state.guidance) validateGuidance(record.state.guidance);
}

/** Preserve all rights and clocks; no old learning or missed surprises are reissued. */
export function upgrade(record: GrowingRecord, now: number): GrowingRecord {
    readable(record);
    if (record.version === 3 && record.state.guidance) return record;
    const state = structuredClone(record.state);
    if (record.version === 1) state.surprise = { day: Math.max(surpriseDay(state), Math.floor((now - state.enrolledAt) / 86_400_000)) };
    migrateGuidance(state);
    return { ...record, version: 3, state };
}

/** Read-only calculation; the caller fences this snapshot before committing. */
export function projectGrowingSync({ profileId, current, created, completions, mailbox, now, levels }: SyncProjectionRequest): SyncProjection {
    let record: GrowingRecord = current ? upgrade(current, now) : { profileId, version: 3, revision: 0, createdAt: now, updatedAt: now,
        state: created!.state, ...(created?.migratedFrom ? { migratedFrom: created.migratedFrom } : {}) };
    const ingested = ingestCompletions(record.state, completions);
    const state = structuredClone(ingested.state);
    const received = [...receiveGifts(state, mailbox), ...deliverKeepsakes(state, levels)];
    const nature = advanceNature(state, now);
    const beforeTown = JSON.stringify(state);
    const opened = state.town.bank > 0 ? openTown(state) : [];
    noteTownBuilds(state, opened);
    const town = [...received, ...(ingested.added > 0 || beforeTown !== JSON.stringify(state) ? opened : []), ...scheduleSurprise(state)];
    const changed = !current || current.version !== record.version || ingested.added > 0 || nature.length > 0
        || JSON.stringify(state) !== JSON.stringify(record.state);
    if (changed) {
        record = { ...record, revision: record.revision + (current ? 1 : 0), updatedAt: now, state };
    }
    return { result: { record, town, nature, learned: ingested.added }, changed,
        receivedGiftIds: mailbox.filter(g => state.gifts?.includes(g.id)).map(g => g.id) };
}
