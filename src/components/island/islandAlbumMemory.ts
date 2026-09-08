import { ISLAND_HABITATS } from '../../domain/island/growth';
import type { IslandGrowthMemory, IslandHabitatId } from '../../domain/island/types';

/** Begin a place comparison when that place existed. Explicit history browsing
 * remains unrestricted, and the whole-island view keeps its chosen memory. */
export function islandComparisonMemory(memories: IslandGrowthMemory[], current: IslandGrowthMemory | undefined, habitat: IslandHabitatId | 'all') {
    if (!current || habitat === 'all') return current;
    const unlockAt = ISLAND_HABITATS.find(place => place.id === habitat)!.unlockAt;
    if (current.completedSets >= unlockAt) return current;
    return memories.reduce<IslandGrowthMemory | undefined>((earliest, entry) => entry.completedSets >= unlockAt
        && (!earliest || entry.completedSets < earliest.completedSets) ? entry : earliest, undefined) ?? current;
}
