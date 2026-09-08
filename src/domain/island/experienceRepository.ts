import { db } from '../../db';
import { canonicalIslandExperienceAction, reduceIslandExperience, type IslandExperienceAction } from './experience';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function saveIslandExperience(profileId: string, revision: number, action: IslandExperienceAction,
    database = db): Promise<IslandRecord> {
    const intent = canonicalIslandExperienceAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-experience-v1', profileId, revision]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'experience_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Island experience changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now();
        const updated = { ...reduceIslandExperience(island, intent, now), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'experience_changed', timestamp: now, action: intent });
        return updated;
    });
}
