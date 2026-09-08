import { getIslandExpansionLevel } from '../../domain/island/expansion';
import { getIslandGrowthTarget, isIslandHabitatUnlocked, ISLAND_HABITATS } from '../../domain/island/growth';
import type { IslandHabitatId, IslandPlan, IslandRecord } from '../../domain/island/types';

/** Name a real expansion earned by finishing this place, including inherited land. */
export function islandCompletionExpansion(island: IslandRecord, habitat: IslandHabitatId) {
    if (!island.growth || !isIslandHabitatUnlocked(island, habitat) || island.growth.progress[habitat] >= 6) return undefined;
    const level = getIslandExpansionLevel(island);
    const mature = ISLAND_HABITATS.filter(place => island.growth!.progress[place.id] >= 6).length;
    const next = Math.min(2, mature + 1);
    return next > level ? (next === 1 ? 'east' : 'west') : undefined;
}

/** A brief near-completion cue; ordinary progress and old gift reservations stay quiet. */
export function islandExpansionPreview(island: IslandRecord, plan?: IslandPlan) {
    if (plan && !plan.growthTarget) return undefined;
    const target = plan?.status === 'active' && plan.growthTarget ? plan.growthTarget : getIslandGrowthTarget(island);
    return island.growth?.progress[target] === 5 ? islandCompletionExpansion(island, target) : undefined;
}
