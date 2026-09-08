import { db } from '../../db';
import { canonicalIslandExpressionAction, reduceIslandExpression, type IslandExpressionAction } from './expression';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function saveIslandExpression(profileId: string, revision: number, action: IslandExpressionAction, database = db): Promise<IslandRecord> {
    const intent = canonicalIslandExpressionAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-expression-v1', profileId, revision]), prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'expression_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Expression choice changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now(), updated = { ...reduceIslandExpression(island, intent), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'expression_changed', timestamp: now, action: intent });
        return updated;
    });
}
