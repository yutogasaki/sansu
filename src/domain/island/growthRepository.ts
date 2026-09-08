import { db } from '../../db';
import { canObserveIslandDiscovery, getIslandItemGrowthLevel, isIslandHabitatId, isIslandHabitatUnlocked } from './growth';
import { IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandHabitatId, IslandRecord } from './types';

export async function selectIslandGrowthTarget(profileId: string, revision: number, habitatId: IslandHabitatId,
    database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-growth-selection-v1', profileId, revision]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'growth_selected' || prior.profileId !== profileId || prior.habitatId !== habitatId) throw new IslandConflict('Growth choice changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        if (!island.growth || !isIslandHabitatId(habitatId) || !isIslandHabitatUnlocked(island, habitatId)
            || island.growth.progress[habitatId] >= 6) throw new IslandConflict('Growth place unavailable');
        const now = Date.now();
        const updated: IslandRecord = { ...island, revision: island.revision + 1, updatedAt: now,
            growth: { ...island.growth, focus: habitatId } };
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'growth_selected', timestamp: now, habitatId });
        return updated;
    });
}

export async function setIslandItemAppearance(profileId: string, revision: number, itemId: string, level: number,
    database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-appearance-v1', profileId, revision]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'appearance_changed' || prior.profileId !== profileId
                || prior.itemId !== itemId || prior.appearanceLevel !== level) throw new IslandConflict('Appearance choice changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const selected = island.items.find(item => item.id === itemId);
        if (!selected || !Number.isInteger(level) || level < 0 || level > getIslandItemGrowthLevel(selected)) throw new IslandConflict('Appearance unavailable');
        const now = Date.now();
        const updated: IslandRecord = { ...island, revision: island.revision + 1, updatedAt: now,
            items: island.items.map(item => item.id !== itemId ? item : {
                ...item, appearanceLevel: level === getIslandItemGrowthLevel(item) ? undefined : level,
            }) };
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'appearance_changed', timestamp: now, itemId, appearanceLevel: level });
        return updated;
    });
}

/** The renderer supplies an actual completed/visible action. Eligibility alone never registers it.
 * No revision from a long-running animation is used: merge only this monotonic discovery into latest owned state. */
export async function recordIslandDiscovery(profileId: string, discoveryId: string, itemId: string,
    database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-discovery-v1', profileId, discoveryId]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'discovery_observed' || prior.profileId !== profileId || prior.discoveryId !== discoveryId
                || !island.growth?.discoveries.some(discovery => discovery.id === discoveryId)) throw new IslandConflict('Discovery changed');
            return island;
        }
        if (!island.growth || !canObserveIslandDiscovery(island, discoveryId, itemId)
            || island.growth.discoveries.some(discovery => discovery.id === discoveryId)) throw new IslandConflict('Discovery unavailable');
        const now = Date.now();
        const updated: IslandRecord = { ...island, revision: island.revision + 1, updatedAt: now,
            growth: { ...island.growth, discoveries: [...island.growth.discoveries, { id: discoveryId, itemId, discoveredAt: now }] } };
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'discovery_observed', timestamp: now, itemId, discoveryId });
        return updated;
    });
}
