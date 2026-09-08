import { db } from '../../db';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import { canonicalIslandSharedMemoriesAction, getIslandSharedMemories, hasValidSharedMemory, reduceIslandSharedMemories,
    sharedFirstMemoryIdentity, sharedMemoryIdentity, sharedOperationIdentity, type IslandSharedMemoriesAction, type SharedMemory } from './sharedMemories';
import type { IslandRecord } from './types';

/** The caller retains the exact canonical action and revision after uncertain I/O. Never silently rebase or manufacture a new request ID. */
export async function saveIslandSharedMemories(profileId: string, revision: number, action: IslandSharedMemoriesAction,
    database = db): Promise<IslandRecord> {
    const intent = canonicalIslandSharedMemoriesAction(action);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new IslandConflict('Invalid island revision');
    return database.transaction('rw', islandTables(database), async () => {
        // Ownership is checked before old receipts: another profile cannot replay an earlier successful request.
        const { island } = await ownedIsland(database, profileId), id = sharedOperationIdentity(profileId, revision);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'shared_memory_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Shared operation changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        if (intent.type === 'prepare-request') {
            // A UUID cannot resurrect an earlier canceled/completed request with a different target.
            const previousRequest = await database.islandEvents.get(intent.requestId);
            if (previousRequest) throw new IslandConflict('Shared request already used');
        }
        let firstFact: SharedMemory | undefined;
        if (intent.type === 'complete-request' || intent.type === 'remember-result') {
            const request = getIslandSharedMemories(island).activeRequest;
            if (request?.requestId === intent.requestId) {
                const memoryKey = sharedMemoryIdentity(profileId, request.residentId, request.jobId, request.target.targetKey);
                // Stable primary-key lookup only. No event scan and no unbounded registry in IslandRecord.
                const first = await database.islandEvents.get(sharedFirstMemoryIdentity(memoryKey));
                if (first) {
                    if (first.type !== 'shared_memory_first' || first.profileId !== profileId
                        || Object.keys(first).some(key => !['id', 'profileId', 'type', 'timestamp', 'sharedMemory'].includes(key))
                        || !hasValidSharedMemory(profileId, first.sharedMemory) || first.sharedMemory.memoryKey !== memoryKey
                        || first.timestamp !== first.sharedMemory.firstAt) throw new IslandConflict('Invalid first shared memory receipt');
                    firstFact = first.sharedMemory;
                } else if (getIslandSharedMemories(island).memories.some(memory => memory.memoryKey === memoryKey)
                    || request.status === 'result-seen') {
                    throw new IslandConflict('Missing first shared memory receipt');
                }
            }
        }
        const now = Date.now(), reduction = reduceIslandSharedMemories(island, intent, now, { firstFact, receiptId: id });
        if (reduction.island === island) return island;
        const updated = { ...reduction.island, revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'shared_memory_changed', timestamp: now, action: intent });
        if (intent.type === 'prepare-request') {
            await database.islandEvents.add({ id: intent.requestId, profileId, type: 'shared_memory_changed', timestamp: now, action: intent });
        }
        if (reduction.firstFact) {
            await database.islandEvents.add({ id: sharedFirstMemoryIdentity(reduction.firstFact.memoryKey), profileId,
                type: 'shared_memory_first', timestamp: reduction.firstFact.firstAt, sharedMemory: reduction.firstFact });
        }
        return updated;
    });
}
