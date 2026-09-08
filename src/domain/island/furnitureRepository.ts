import { db } from '../../db';
import { canonicalIslandFurnitureAction, islandFurnitureItemId, reduceIslandFurniture, type IslandFurnitureAction } from './furniture';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function acquireIslandFurniture(profileId: string, revision: number, action: IslandFurnitureAction,
    database = db): Promise<IslandRecord> {
    const intent = canonicalIslandFurnitureAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-furniture-v1', profileId, revision]);
        const itemId = islandFurnitureItemId(intent.kind), prior = await database.islandEvents.get(id);
        // Replay precedes the current quote/ownership/CAS: a lost response must
        // neither charge again nor restore the item's earlier storage or pose.
        if (prior) {
            if (prior.type !== 'furniture_acquired' || prior.profileId !== profileId || prior.kind !== intent.kind
                || prior.itemId !== itemId || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Furniture choice changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now(), updated = { ...reduceIslandFurniture(island, intent), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'furniture_acquired', timestamp: now, action: intent, itemId, kind: intent.kind });
        return updated;
    });
}
