import { getIslandGrowthMilestone, ISLAND_HABITATS, ISLAND_MATURITY_TITLES } from '../../domain/island/growth';
import { getIslandExpansionLevel } from '../../domain/island/expansion';
import type { IslandGrowthMemory, IslandHabitatId } from '../../domain/island/types';

export type IslandAlbumComparison = IslandHabitatId | 'all';

function memoryMilestone(memories: IslandGrowthMemory[], memory: IslandGrowthMemory) {
    const previous = memories[memories.indexOf(memory) - 1];
    if (!previous || memory.kind === 'initial') return undefined;
    return getIslandGrowthMilestone({ completedSets: previous.completedSets, growth: { progress: previous.progress, expansionLevel: previous.expansionLevel } },
        { completedSets: memory.completedSets, growth: { progress: memory.progress, expansionLevel: memory.expansionLevel } });
}

/** Old minor snapshots remain saved. Each place presents its first existing
 * scene and its major changes, without repeating other places' unchanged views. */
export function islandAlbumMemories(memories: IslandGrowthMemory[], habitat: IslandAlbumComparison) {
    if (habitat === 'all') return memories.filter((memory, index) => index === 0 || memoryMilestone(memories, memory));
    const unlockLevel = ISLAND_HABITATS.find(place => place.id === habitat)!.unlockExpansionLevel;
    const baseline = memories.find(memory => getIslandExpansionLevel({ completedSets: memory.completedSets,
        growth: { expansionLevel: memory.expansionLevel } }) >= unlockLevel);
    if (!baseline) return [];
    return memories.filter(memory => {
        if (memory === baseline) return true;
        if (memory.completedSets < baseline.completedSets) return false;
        const milestone = memoryMilestone(memories, memory);
        return milestone?.habitats.includes(habitat)
            || milestone?.expansion === 'east' && habitat === 'waterside'
            || milestone?.expansion === 'west' && habitat === 'grove';
    });
}

/** A new comparison starts before that place grew, rather than pairing its
 * latest snapshot with an almost identical current scene. */
export function islandComparisonMemory(memories: IslandGrowthMemory[], habitat: IslandAlbumComparison) {
    return islandAlbumMemories(memories, habitat)[0];
}

export function islandAlbumMemoryTitle(memories: IslandGrowthMemory[], memory: IslandGrowthMemory, habitat: IslandAlbumComparison) {
    const milestone = memoryMilestone(memories, memory);
    const titles = milestone?.habitats.filter(id => habitat === 'all' || habitat === id).map(id => ISLAND_MATURITY_TITLES[id]) ?? [];
    if (milestone?.expansion === 'east' && (habitat === 'all' || habitat === 'waterside')) titles.push('ひがしへ はしが つながった');
    if (milestone?.expansion === 'west' && (habitat === 'all' || habitat === 'grove')) titles.push('にしへ はしが つながった');
    return titles.join('・') || `はじめの ${habitat === 'all' ? 'しま' : ISLAND_HABITATS.find(place => place.id === habitat)!.name}`;
}
