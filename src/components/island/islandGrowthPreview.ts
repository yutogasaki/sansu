import { getIslandHabitatLevel, ISLAND_GROWTH_THRESHOLDS, isIslandHabitatUnlocked } from '../../domain/island/growth';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';

const nextLife: Record<IslandHabitatId, readonly string[]> = {
    garden: ['おはなに 近づいて くんくん', 'ちょうが おはなに やってくる', 'ベンチの ともだちへ おはなを とどける'],
    waterside: ['みずべを ながめて ひとやすみ', 'ともだちに みずたまを おすそわけ', '葉っぱの ふねが ふわり'],
    grove: ['木かげの いすで ひとやすみ', 'あかりを ともだちと いっしょに', '大きな 木の したで のんびり'],
    village: ['おうちへ ともだちが やってくる', 'ほしあかりを おすそわけ', 'テラスで ふたり のんびり'],
};

/** Render-only next stage: never feeds a learning writer, unlock or observation. */
export function islandGrowthPreview(island: IslandRecord, habitatId: IslandHabitatId) {
    const level = getIslandHabitatLevel(island, habitatId);
    if (!island.growth || level >= 3 || !isIslandHabitatUnlocked(island, habitatId)) return;
    const progress = ISLAND_GROWTH_THRESHOLDS[level];
    const projected: IslandRecord = { ...island,
        items: island.items.map(item => item.habitatId === habitatId ? { ...item, growthLevel: level + 1, appearanceLevel: undefined } : item),
        growth: { ...island.growth, progress: { ...island.growth.progress, [habitatId]: progress } },
    };
    return { island: projected, habitatId, level: level + 1, description: nextLife[habitatId][level] };
}
