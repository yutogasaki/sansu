import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import { db, type SansuDatabase } from '../../db';
import { acknowledgeFoundationCompletion, pendingFoundationCompletions, verifyFoundationCompletion } from '../englishFoundation/repository';
import type { FoundationCompletion } from '../englishFoundation/types';
import { noteLearning } from './guidance';
import { assertGrowingOwnerAvailable, growingDb, type GrowingIslandDatabase, type GrowingRecord } from './repository';
import { RULES } from './rules';
import { upgrade } from './syncProjection';
import { islandIdOf } from './voyages';

/** Source verification is mandatory; a generic terminal fact cannot bypass the legacy floor. */
export async function receiveFoundationCompletion(completion: FoundationCompletion,
    database: GrowingIslandDatabase = growingDb, source: SansuDatabase = db, now = Date.now()) {
    // Persist only the versioned proof, never incidental outbox acknowledgement fields.
    const { sourceVersion, profileId, completionId, planId, slotIndex, completionKind, completedAt } = completion;
    completion = { sourceVersion, profileId, completionId, planId, slotIndex, completionKind, completedAt };
    if (!await verifyFoundationCompletion(completion, source)) throw new Error('がくしゅうの ほぞんを たしかめてね。');
    const release = holdPwaUpdateForCriticalPersistence();
    try {
        return await database.transaction('rw', database.islands, database.foundationReceipts, database.deletedOwners, async () => {
            await assertGrowingOwnerAvailable(completion.profileId, database);
            const existing = await database.foundationReceipts.get([completion.profileId, completion.completionId]);
            const current = await database.islands.get(completion.profileId);
            if (!current || current.state.seed !== completion.profileId) throw new Error('じぶんの しまを ひらいてね。');
            if (existing) {
                // Compare the complete proof, including the original completion timestamp.
                if (!(Object.keys(completion) as (keyof FoundationCompletion)[]).every(key => existing[key] === completion[key])) throw new Error('がくしゅうの ほぞんを たしかめてね。');
                return { credited: false, record: current, receipt: existing };
            }
            const upgraded = upgrade(current, now), state = structuredClone(upgraded.state);
            state.drops += RULES.dropsPerCompletion;
            state.town.bank += RULES.townHoursPerCompletion;
            noteLearning(state, completion.completionId, completion.completedAt);
            const record: GrowingRecord = { ...upgraded, state, revision: current.revision + 1, updatedAt: now };
            const receipt = { ...completion, islandId: islandIdOf(current), receivedAt: now };
            // The wallet and the permanent cross-island receipt commit or roll back together.
            await database.foundationReceipts.add(receipt);
            await database.islands.put(record);
            return { credited: true, record, receipt };
        });
    } finally { release(); }
}

/** At-least-once delivery: losing an acknowledgement only causes an idempotent resend. */
export async function drainFoundationRewards(profileId: string, database: GrowingIslandDatabase = growingDb,
    source: SansuDatabase = db, now = Date.now()) {
    let credited = 0, retryPending = false;
    let record: GrowingRecord | undefined;
    for (const completion of await pendingFoundationCompletions(profileId, source)) {
        if (completion.profileId !== profileId) throw new Error('プロフィールを えらびなおしてね。');
        const received = await receiveFoundationCompletion(completion, database, source, now);
        credited += Number(received.credited);
        record = received.record;
        try { await acknowledgeFoundationCompletion(completion, source); }
        catch { retryPending = true; } // Keep source outbox intact; the saved island is already valid.
    }
    return { credited, record, retryPending };
}
