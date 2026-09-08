import { db } from '../../db';
import { canonicalIslandLearningKeepsakeAction, ISLAND_LEARNING_KEEPSAKES, IslandLearningKeepsakeConflict, reduceIslandLearningKeepsakes,
    summarizeIslandLearningKeepsake, type IslandLearningKeepsakeAction, type IslandLearningKeepsakeId, type IslandLearningKeepsakeSummary } from './learningKeepsakes';
import { learningKeepsakeHistoryOrdinals, learningKeepsakePlanId } from './learningKeepsakeSummary';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function saveIslandLearningKeepsakes(profileId: string, revision: number, action: IslandLearningKeepsakeAction, database = db): Promise<IslandRecord> {
    const intent = canonicalIslandLearningKeepsakeAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-learning-keepsakes-v1', profileId, revision]), prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'learning_keepsakes_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Keepsake selection changed');
            return island; // A lost completion must not reinstate an older shelf after a later choice.
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now(), updated = { ...reduceIslandLearningKeepsakes(island, intent), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'learning_keepsakes_changed', timestamp: now, action: intent });
        return updated;
    });
}

export async function readIslandLearningKeepsakeSummary(profileId: string, keepsakeId: IslandLearningKeepsakeId, database = db): Promise<IslandLearningKeepsakeSummary> {
    const item = ISLAND_LEARNING_KEEPSAKES.find(item => item.id === keepsakeId);
    if (!item) throw new IslandLearningKeepsakeConflict('invalid-action', 'きねんの しなを えらびなおしてね');
    return database.transaction('r', [database.appData, database.islands, database.islandPlans, database.islandEvents], async () => {
        const { island } = await ownedIsland(database, profileId);
        const ids = learningKeepsakeHistoryOrdinals(island.completedSets, item.requiredCompletedSets).map(ordinal => learningKeepsakePlanId(profileId, ordinal));
        const [plans, events] = await Promise.all([database.islandPlans.bulkGet(ids), database.islandEvents.bulkGet(ids.map(id => `${id}:completed`))]);
        return summarizeIslandLearningKeepsake(island, keepsakeId, plans, events);
    });
}
