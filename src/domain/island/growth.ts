import { findAvailablePosition, isValidIslandPlacement } from './catalog';
import { ISLAND_HABITAT_IDS, type IslandGrowthMemory, type IslandGrowthState, type IslandHabitatId,
    type IslandItem, type IslandItemKind, type IslandRecord } from './types';

export const ISLAND_GROWTH_THRESHOLDS = [1, 3, 6] as const;
export const ISLAND_HABITATS: readonly { id: IslandHabitatId; name: string; description: string; unlockAt: number }[] = [
    { id: 'garden', name: 'にわ', description: 'おはなが 育つと、ちょうや ともだちが やってくる', unlockAt: 0 },
    { id: 'waterside', name: 'みずべ', description: 'みずたまと 葉っぱの ふねで いっしょに あそぶ', unlockAt: 2 },
    { id: 'grove', name: '木かげ', description: '大きな 木かげで ひとやすみ', unlockAt: 12 },
    { id: 'village', name: 'いえの まわり', description: 'あかりの そばへ ともだちが あそびにくる', unlockAt: 0 },
];
export const ISLAND_DISCOVERIES: readonly { id: string; name: string; description: string; habitatId: IslandHabitatId;
    minLevel: number; kinds: readonly IslandItemKind[] }[] = [
    { id: 'flower-scent', name: 'おはなを くんくん', description: 'さいた おはなに 近づいて くんくん', habitatId: 'garden', minLevel: 1, kinds: ['flower'] },
    { id: 'butterfly-visit', name: 'ちょうの おきゃくさん', description: 'そだった おはなに ちょうが やってきた', habitatId: 'garden', minLevel: 2, kinds: ['flower'] },
    { id: 'flower-sharing', name: 'おはなの おすそわけ', description: 'ベンチの ともだちへ おはなを とどけた', habitatId: 'garden', minLevel: 3, kinds: ['flower', 'bench'] },
    { id: 'water-gazing', name: 'みずべを のぞこう', description: 'みずの そばで ひとやすみ', habitatId: 'waterside', minLevel: 1, kinds: ['fountain', 'swing'] },
    { id: 'water-sharing', name: 'みずたまを どうぞ', description: 'ブランコの ともだちへ みずたまを とどけた', habitatId: 'waterside', minLevel: 2, kinds: ['fountain', 'swing'] },
    { id: 'leaf-boat', name: '葉っぱの ふね', description: 'ふわりと すすむ 葉っぱの ふねを みつけた', habitatId: 'waterside', minLevel: 3, kinds: ['fountain'] },
    { id: 'shade-rest', name: '木かげで ひとやすみ', description: 'そだった 木かげで のんびり', habitatId: 'grove', minLevel: 1, kinds: ['mushroom'] },
    { id: 'lantern-sharing', name: 'ほしあかりを いっしょに', description: 'あかりを ともだちの ところへ とどけた', habitatId: 'village', minLevel: 2, kinds: ['lantern', 'mushroom'] },
    { id: 'home-visit', name: 'あかりの おうちへ', description: 'あかりの そばへ あそびにきた', habitatId: 'village', minLevel: 1, kinds: ['lantern'] },
    { id: 'terrace-time', name: 'テラスで のんびり', description: 'そだった おうちで いっしょに すごす', habitatId: 'village', minLevel: 3, kinds: ['lantern'] },
];

export function isIslandHabitatId(value: unknown): value is IslandHabitatId {
    return ISLAND_HABITAT_IDS.includes(value as IslandHabitatId);
}
export function islandGrowthLevel(progress: number) {
    return ISLAND_GROWTH_THRESHOLDS.filter(threshold => progress >= threshold).length;
}
export function getIslandHabitatLevel(island: Pick<IslandRecord, 'growth'>, habitatId: IslandHabitatId) {
    return islandGrowthLevel(island.growth?.progress[habitatId] ?? 0);
}
export function getIslandItemGrowthLevel(item: Pick<IslandItem, 'growthLevel'>) {
    return Math.max(0, Math.min(3, Math.floor(item.growthLevel ?? 0)));
}
export function getIslandItemAppearanceLevel(item: Pick<IslandItem, 'growthLevel' | 'appearanceLevel'>) {
    return Math.min(getIslandItemGrowthLevel(item), Math.max(0, Math.floor(item.appearanceLevel ?? getIslandItemGrowthLevel(item))));
}
export function isIslandHabitatUnlocked(island: Pick<IslandRecord, 'completedSets'>, habitatId: IslandHabitatId) {
    return island.completedSets >= (ISLAND_HABITATS.find(habitat => habitat.id === habitatId)?.unlockAt ?? Infinity);
}
export function isIslandGrowthComplete(island: Pick<IslandRecord, 'growth'>) {
    return ISLAND_HABITAT_IDS.every(id => (island.growth?.progress[id] ?? 0) >= 6);
}
export function getIslandGrowthTarget(island: Pick<IslandRecord, 'growth' | 'completedSets'>): IslandHabitatId {
    const focus = island.growth?.focus ?? 'garden';
    const canGrow = (id: IslandHabitatId) => isIslandHabitatUnlocked(island, id) && (island.growth?.progress[id] ?? 0) < 6;
    return canGrow(focus) ? focus : ISLAND_HABITAT_IDS.find(canGrow) ?? focus;
}

function snapshot(island: IslandRecord, kind: IslandGrowthMemory['kind'], now: number,
    habitatId?: IslandHabitatId): IslandGrowthMemory {
    const growth = island.growth!;
    return {
        id: kind === 'initial' ? 'island-growth-initial' : `island-growth-${kind}-${island.completedSets}`,
        kind, capturedAt: now, completedSets: island.completedSets, habitatId,
        ...(habitatId ? { level: getIslandHabitatLevel(island, habitatId) } : {}),
        progress: { ...growth.progress }, focus: growth.focus,
        items: island.items.map(item => ({ ...item, ...(item.position ? { position: { ...item.position } } : {}) })),
    };
}

/** No retrospective credit: legacy land, gifts and placements are preserved. */
export function initializeIslandGrowth(island: IslandRecord, now: number): IslandRecord {
    if (island.growth) return island;
    const growth: IslandGrowthState = {
        version: 1, progress: { garden: 0, waterside: 0, grove: 0, village: 0 }, focus: 'garden', memories: [], discoveries: [],
    };
    const initialized = { ...island, growth, items: island.items.map(item => ({ ...item })) };
    // Existing possessions gain metadata without changing their position, direction or storage status.
    for (const definition of MANAGED_ITEMS) {
        const item = managedItem(initialized.items, definition);
        if (item) { item.habitatId = definition.habitatId; item.growthLevel = 0; }
    }
    growth.memories = [snapshot(initialized, 'initial', now)];
    return initialized;
}

/** One stable instance per kind. Existing items of that kind win, even when stored. */
type ManagedItem = IslandItem & { habitatId: IslandHabitatId; addAt: number; reuseKind?: boolean };
const MANAGED_ITEMS: readonly ManagedItem[] = [
    { id: 'starter-flower', kind: 'flower', habitatId: 'garden', position: { x: 1.5, z: .8 }, rotation: 0, addAt: 0 },
    { id: 'starter-lantern', kind: 'lantern', habitatId: 'village', position: { x: -1, z: .25 }, rotation: 0, addAt: 0 },
    { id: 'living-bench', kind: 'bench', habitatId: 'garden', position: { x: -.1, z: 1 }, rotation: Math.atan2(1.6, -.2), addAt: 1 },
    { id: 'living-fountain', kind: 'fountain', habitatId: 'waterside', position: { x: 3.4, z: 1.3 }, rotation: 0, addAt: 2 },
    { id: 'living-swing', kind: 'swing', habitatId: 'waterside', position: { x: 6.2, z: 1.15 }, rotation: Math.atan2(-2.8, .15), addAt: 2 },
    { id: 'living-mushroom', kind: 'mushroom', habitatId: 'grove', position: { x: -5.8, z: 1.3 }, rotation: Math.atan2(-1.1, -1.1), addAt: 12 },
    { id: 'living-grove-lantern', kind: 'lantern', habitatId: 'grove', position: { x: -6.9, z: .2 }, rotation: 0, addAt: 12, reuseKind: false },
];

function managedItem(items: IslandItem[], definition: ManagedItem) {
    return items.find(candidate => candidate.id === definition.id)
        ?? (definition.reuseKind === false ? undefined : items.find(candidate => candidate.kind === definition.kind));
}

function syncManagedItems(island: IslandRecord) {
    const updated = { ...island, items: island.items.map(item => ({ ...item })) };
    for (const definition of MANAGED_ITEMS) {
        const item = managedItem(updated.items, definition);
        const growthLevel = getIslandHabitatLevel(updated, definition.habitatId);
        if (item) {
            item.habitatId = definition.habitatId;
            item.growthLevel = growthLevel;
            continue;
        }
        if (updated.completedSets < definition.addAt) continue;
        const added: IslandItem = { id: definition.id, kind: definition.kind, habitatId: definition.habitatId,
            rotation: definition.rotation, growthLevel };
        updated.items.push(added);
        const position = definition.position && isValidIslandPlacement(updated, added.id, definition.position, added.rotation)
            ? definition.position : findAvailablePosition(updated, added.kind, added.id);
        if (position) added.position = { ...position };
        else added.autoPlacementBlocked = true;
    }
    return updated;
}

/** Pure completion transform. The transaction caller owns exactly-once completion and set count. */
export function growIslandAfterCompletedSet(island: IslandRecord, target: IslandHabitatId, now: number): IslandRecord {
    const initialized = initializeIslandGrowth(island, now);
    const oldLevel = getIslandHabitatLevel(initialized, target);
    let updated: IslandRecord = {
        ...initialized,
        growth: { ...initialized.growth!, progress: { ...initialized.growth!.progress,
            [target]: Math.min(6, initialized.growth!.progress[target] + 1) },
        memories: [...initialized.growth!.memories], discoveries: [...initialized.growth!.discoveries] },
    };
    updated = syncManagedItems(updated);
    updated.growth!.focus = getIslandGrowthTarget(updated);
    if (getIslandHabitatLevel(updated, target) > oldLevel) updated.growth!.memories.push(snapshot(updated, 'upgrade', now, target));
    else if ([2, 12].includes(updated.completedSets)) updated.growth!.memories.push(snapshot(updated, 'expansion', now));
    return updated;
}

/** Eligibility never marks an observation itself. Only an actual runtime action calls persistence. */
export function canObserveIslandDiscovery(island: IslandRecord, discoveryId: string, itemId: string) {
    const definition = ISLAND_DISCOVERIES.find(discovery => discovery.id === discoveryId);
    const item = island.items.find(candidate => candidate.id === itemId);
    if (!definition || !item?.position || !definition.kinds.includes(item.kind)) return false;
    if (discoveryId === 'lantern-sharing') return (item.habitatId === 'grove' || item.habitatId === 'village')
        && getIslandHabitatLevel(island, item.habitatId) >= 2;
    if (item.habitatId !== definition.habitatId) return false;
    return getIslandHabitatLevel(island, definition.habitatId) >= definition.minLevel;
}
