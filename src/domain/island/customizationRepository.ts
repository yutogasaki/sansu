import { db } from '../../db';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import { CUSTOMIZATION_CATALOG, getIslandCustomization, type IslandAccentId,
    type IslandCustomizationAction } from './customization';
import type { IslandRecord } from './types';

function canonicalAction(action: IslandCustomizationAction): IslandCustomizationAction {
    if (action?.type === 'clear-accent' || action?.type === 'clear-desire') return { type: action.type };
    if (!action || !['purchase', 'equip', 'desire'].includes(action.type)
        || !CUSTOMIZATION_CATALOG.some(item => item.id === action.itemId)) throw new IslandConflict('Unknown island customization');
    return { type: action.type, itemId: action.itemId };
}

export async function customizeIsland(profileId: string, revision: number, action: IslandCustomizationAction,
    database = db): Promise<IslandRecord> {
    const intent = canonicalAction(action);
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
        const state = getIslandCustomization(island);
        if (intent.type === 'clear-accent') state.accentId = null;
        else if (intent.type === 'clear-desire') state.desiredItemId = null;
        else {
            const item = CUSTOMIZATION_CATALOG.find(candidate => candidate.id === intent.itemId)!;
            const owned = state.ownedItemIds.includes(item.id);
            if (intent.type === 'desire') {
                if (owned) throw new IslandConflict('Customization already owned');
                state.desiredItemId = item.id;
            } else {
                if (!owned) {
                    if (intent.type !== 'purchase') throw new IslandConflict('Customization not owned');
                    if (state.points < item.price) throw new IslandConflict('Not enough island stars');
                    state.points -= item.price;
                    state.ownedItemIds.push(item.id);
                }
                if (item.kind === 'theme') state.themeId = item.themeId;
                else state.accentId = item.id as IslandAccentId;
                if (state.desiredItemId === item.id) state.desiredItemId = null;
            }
        }
        const now = Date.now();
        const updated = { ...island, customization: state, revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'customization_changed', timestamp: now, action: intent });
        return updated;
    });
}
