import { db } from '../../db';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import { canonicalIslandCustomizationAction, IslandCustomizationConflict, reduceIslandCustomization,
    type IslandCustomizationAction } from './customization';
import type { IslandRecord } from './types';

export async function customizeIsland(profileId: string, revision: number, action: IslandCustomizationAction,
    database = db): Promise<IslandRecord> {
    let intent: IslandCustomizationAction;
    try { intent = canonicalIslandCustomizationAction(action); } catch (error) {
        if (error instanceof IslandCustomizationConflict) throw new IslandConflict(error.message);
        throw error;
    }
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-customization-v1', profileId, revision]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'customization_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Customization changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        let reduced: IslandRecord;
        try { reduced = reduceIslandCustomization(island, intent); } catch (error) {
            if (error instanceof IslandCustomizationConflict) throw new IslandConflict(error.message);
            throw error;
        }
        const now = Date.now();
        const updated = { ...reduced, revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'customization_changed', timestamp: now, action: intent });
        return updated;
    });
}
