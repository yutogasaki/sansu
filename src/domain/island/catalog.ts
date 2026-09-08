import type { IslandItemKind, IslandPosition, IslandRecord } from './types';
import { initializeIslandGrowth } from './growth';

export const ISLAND_ITEMS: Record<IslandItemKind, { name: string; description: string; radius: number }> = {
    bench: { name: 'ベンチ', description: 'どうぶつが ひとやすみ', radius: .65 },
    flower: { name: 'ひかる おはな', description: 'のぞくと ふわっと ひかる', radius: .35 },
    lantern: { name: 'ほしあかり', description: 'あたたかな あかりを ともす', radius: .35 },
    swing: { name: 'ブランコ', description: 'ゆらゆら ゆれて あそぶ', radius: .8 },
    mushroom: { name: 'きのこの いす', description: 'どうぶつが ひとやすみ', radius: .6 },
    fountain: { name: 'ふんすい', description: 'みずを のぞいて あそぶ', radius: .7 },
};

export const ISLAND_MAIN_LAND = { x: 0, z: 0, radiusX: 4.8, radiusZ: 3.6 };
export const ISLAND_EAST_LAND = { x: 6.2, z: 0, radiusX: 1.9, radiusZ: 2.3 };
export const ISLAND_WEST_LAND = { x: -6.2, z: 0, radiusX: 1.9, radiusZ: 2.3 };
export const ISLAND_RESERVED_AREAS = [
    { x: -2.6, z: -1.65, radius: 1.15 },
    { x: 1.6, z: -1.6, radius: .85 },
    // Keep the later lighthouse clear before it arrives, preserving every placed possession.
    { x: 6.35, z: -1.16, radius: .7 },
    { x: 4.75, z: 0, radius: .7 },
    { x: -4.75, z: 0, radius: .7 },
    { x: -6.7, z: -1.2, radius: .55 },
] as const;

export function islandRewardChoices(sequence: number): IslandItemKind[] {
    const choices: IslandItemKind[][] = [
        ['flower', 'bench', 'lantern'],
        ['swing', 'mushroom', 'fountain'],
        ['bench', 'swing', 'flower'],
        ['lantern', 'mushroom', 'fountain'],
    ];
    return [...choices[sequence % choices.length]];
}

function fitsLand(position: IslandPosition, radius: number, completedSets: number) {
    const lands = [ISLAND_MAIN_LAND, ...(completedSets >= 2 ? [ISLAND_EAST_LAND] : []),
        ...(completedSets >= 12 ? [ISLAND_WEST_LAND] : [])];
    return lands.some(land => ((position.x - land.x) / (land.radiusX - radius)) ** 2
        + ((position.z - land.z) / (land.radiusZ - radius)) ** 2 <= 1);
}

function canPlaceKind(island: IslandRecord, kind: IslandItemKind, position: IslandPosition, itemId?: string) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const radius = ISLAND_ITEMS[kind]?.radius;
    if (!radius || !fitsLand(position, radius, island.completedSets)) return false;
    if (ISLAND_RESERVED_AREAS.some(area => Math.hypot(position.x - area.x, position.z - area.z) < radius + area.radius)) return false;
    return island.items.every(item => item.id === itemId || !item.position
        || Math.hypot(item.position.x - position.x, item.position.z - position.z) >= radius + ISLAND_ITEMS[item.kind].radius + .08);
}

export function isValidIslandPlacement(island: IslandRecord, itemId: string, position: IslandPosition, rotation = 0) {
    const item = island.items.find(candidate => candidate.id === itemId);
    return Boolean(item && Number.isFinite(rotation) && canPlaceKind(island, item.kind, position, itemId));
}

/** A deterministic suggestion only; the user remains free to choose any clear land. */
export function findAvailablePosition(island: IslandRecord, kind: IslandItemKind, itemId?: string): IslandPosition | undefined {
    const candidates: IslandPosition[] = [];
    for (let z = 2.5; z >= -3; z -= .5) {
        for (let x = island.completedSets >= 12 ? -7.5 : -4; x <= (island.completedSets >= 2 ? 7.5 : 4); x += .5) candidates.push({ x, z });
    }
    candidates.sort((a, b) => Math.hypot(a.x, a.z - 1) - Math.hypot(b.x, b.z - 1));
    return candidates.find(position => canPlaceKind(island, kind, position, itemId));
}

export function createIsland(profileId: string, now: number): IslandRecord {
    return initializeIslandGrowth({
        profileId, schemaVersion: 1, revision: 0, completedSets: 0, pendingRewards: [], updatedAt: now,
        items: [
            { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0 },
            { id: 'starter-lantern', kind: 'lantern', position: { x: -1, z: .25 }, rotation: 0 },
        ],
    }, now);
}
