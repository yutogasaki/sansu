import { db } from '../../db';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import { canonicalIslandWorkshopAction, reduceIslandWorkshop, WORKSHOP_NAMESPACE, type IslandWorkshopAction } from './workshop';
import type { IslandRecord } from './types';

/** Unknown I/O outcomes are retried with this exact profile/revision/intent. Receipt replay never recaptures a later draft. */
export async function saveIslandWorkshop(profileId: string, revision: number, action: IslandWorkshopAction, database = db): Promise<IslandRecord> {
    const intent = canonicalIslandWorkshopAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = `${WORKSHOP_NAMESPACE}operation:${JSON.stringify([profileId, revision])}`;
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'workshop_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Island workshop changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now();
        const updated = { ...reduceIslandWorkshop(island, intent, now), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'workshop_changed', timestamp: now, action: intent });
        return updated;
    });
}
