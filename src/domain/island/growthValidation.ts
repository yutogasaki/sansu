import { ISLAND_DISCOVERIES, isIslandHabitatId } from './growth';
import { hasValidIslandCosmetics } from './customization';
import { hasValidIslandSceneStyle } from './sceneStyle';
import { hasValidIslandFurnitureItems } from './furniture';
import { ISLAND_GROWTH_ANSWER_COSTS } from './pacing';
import { ISLAND_HABITAT_IDS, ISLAND_ITEM_KINDS, type IslandItem, type IslandRecord } from './types';

const level = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
const validExpansion = (value: unknown) => value === undefined || Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2;
export function hasValidGrowthItemFields(item: IslandItem) {
    return (item.habitatId === undefined || isIslandHabitatId(item.habitatId))
        && (item.growthLevel === undefined || level(item.growthLevel))
        && (item.appearanceLevel === undefined || level(item.appearanceLevel) && item.appearanceLevel <= (item.growthLevel ?? 0))
        && (item.autoPlacementBlocked === undefined || typeof item.autoPlacementBlocked === 'boolean');
}
const validProgress = (progress: unknown): progress is Record<string, number> => Boolean(progress && typeof progress === 'object'
    && ISLAND_HABITAT_IDS.every(id => {
        const value = (progress as Record<string, unknown>)[id];
        return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
    }));

/** Optional extension validation never rewrites old records or grants missing progress. */
export function hasValidIslandGrowth(island: IslandRecord) {
    const growth = island.growth;
    if (growth === undefined) return true;
    if (!growth || growth.version !== 1 || !validExpansion(growth.expansionLevel) || !validProgress(growth.progress) || !isIslandHabitatId(growth.focus)
        || ISLAND_HABITAT_IDS.reduce((sum, id) => sum + growth.progress[id], 0) > island.completedSets
        || !Array.isArray(growth.memories) || !Array.isArray(growth.discoveries)
        || growth.memories.length > 15 || growth.discoveries.length > ISLAND_DISCOVERIES.length) return false;
    if (growth.pendingAnswers !== undefined && (!growth.pendingAnswers || typeof growth.pendingAnswers !== 'object'
        || Array.isArray(growth.pendingAnswers) || Object.keys(growth.pendingAnswers).length !== ISLAND_HABITAT_IDS.length
        || ISLAND_HABITAT_IDS.some(id => {
            const pending = growth.pendingAnswers![id], required = ISLAND_GROWTH_ANSWER_COSTS[growth.progress[id]] ?? 0;
            return !Number.isSafeInteger(pending) || pending < 0 || (required ? pending >= required : pending !== 0);
        }))) return false;
    if (growth.memories.some(memory => !memory || typeof memory.id !== 'string' || !memory.id
        || !['initial', 'upgrade', 'expansion'].includes(memory.kind)
        || !Number.isFinite(memory.capturedAt) || memory.capturedAt < 0
        || !Number.isInteger(memory.completedSets) || memory.completedSets < 0 || memory.completedSets > island.completedSets
        || !validExpansion(memory.expansionLevel)
        || (memory.cosmetics !== undefined && !hasValidIslandCosmetics(memory.cosmetics))
        || (memory.sceneStyle !== undefined && (!hasValidIslandSceneStyle(memory.sceneStyle) || memory.sceneStyle.version !== 2))
        || !validProgress(memory.progress) || !isIslandHabitatId(memory.focus)
        || (memory.habitatId !== undefined && !isIslandHabitatId(memory.habitatId))
        || (memory.level !== undefined && !level(memory.level))
        || !hasValidIslandFurnitureItems(memory.items) || !Array.isArray(memory.items) || memory.items.some(item => !item || !item.id || !ISLAND_ITEM_KINDS.includes(item.kind)
            || !Number.isFinite(item.rotation) || !hasValidGrowthItemFields(item)
            || item.position && (!Number.isFinite(item.position.x) || !Number.isFinite(item.position.z)))
        || new Set(memory.items.map(item => item.id)).size !== memory.items.length)) return false;
    return new Set(growth.memories.map(memory => memory.id)).size === growth.memories.length
        && new Set(growth.discoveries.map(discovery => discovery?.id)).size === growth.discoveries.length
        && growth.discoveries.every(discovery => discovery && ISLAND_DISCOVERIES.some(definition => definition.id === discovery.id)
            && island.items.some(item => item.id === discovery.itemId)
            && Number.isFinite(discovery.discoveredAt) && discovery.discoveredAt >= 0);
}
