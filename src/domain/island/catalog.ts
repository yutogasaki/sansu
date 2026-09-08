import type { IslandBasicItemKind, IslandItemKind, IslandPosition, IslandRecord } from './types';
import { ISLAND_FURNITURE_CATALOG } from './furniture';
import { initializeIslandGrowth } from './growth';
import { getIslandExpansionLevel, type IslandExpansionLevel } from './expansion';
import { isClearOfSharedDisplays } from './sharedDisplayGeometry';

export const ISLAND_ITEMS: Record<IslandItemKind, { name: string; description: string; radius: number }> = {
    bench: { name: 'ベンチ', description: 'どうぶつが ひとやすみ', radius: .65 },
    flower: { name: 'ひかる おはな', description: 'のぞくと ふわっと ひかる', radius: .35 },
    lantern: { name: 'ほしあかり', description: 'あたたかな あかりを ともす', radius: .35 },
    swing: { name: 'ブランコ', description: 'ゆらゆら ゆれて あそぶ', radius: .8 },
    mushroom: { name: 'きのこの いす', description: 'どうぶつが ひとやすみ', radius: .6 },
    fountain: { name: 'ふんすい', description: 'みずを のぞいて あそぶ', radius: .7 },
    telescope: ISLAND_FURNITURE_CATALOG[0],
    hammock: ISLAND_FURNITURE_CATALOG[1],
    'tea-table': ISLAND_FURNITURE_CATALOG[2],
};

export const ISLAND_MAIN_LAND = { x: 0, z: 0, radiusX: 4.8, radiusZ: 3.6 };
// Grow outward from the existing inner banks at ±4.3. Every earlier shore,
// saved possession and bridge landing remains inside the enlarged district.
export const ISLAND_EAST_LAND = { x: 7.3, z: 0, radiusX: 3, radiusZ: 3.4 };
export const ISLAND_WEST_LAND = { x: -7.3, z: 0, radiusX: 3, radiusZ: 3.4 };
export const ISLAND_RESERVED_AREAS = [
    { x: -2.6, z: -1.65, radius: 1.15 },
    { x: 1.6, z: -1.6, radius: .85 },
    // Keep the later lighthouse clear before it arrives, preserving every placed possession.
    { x: 6.35, z: -1.16, radius: .7 },
    { x: 4.75, z: 0, radius: .7 },
    { x: -4.75, z: 0, radius: .7 },
    { x: -6.7, z: -1.2, radius: .55 },
] as const;

export function islandRewardChoices(sequence: number): IslandBasicItemKind[] {
    const choices: IslandBasicItemKind[][] = [
        ['flower', 'bench', 'lantern'],
        ['swing', 'mushroom', 'fountain'],
        ['bench', 'swing', 'flower'],
        ['lantern', 'mushroom', 'fountain'],
    ];
    return [...choices[sequence % choices.length]];
}

/** Numeric/boolean inputs preserve legacy callers. Runtime callers explicitly
 * carry earned land access independently of the real learning section count. */
export type IslandLandAccess = number | boolean | { expansionLevel: IslandExpansionLevel };
export function getIslandLandAccess(state: Parameters<typeof getIslandExpansionLevel>[0]) {
    return { expansionLevel: getIslandExpansionLevel(state) };
}

export function getIslandLandLevel(access: IslandLandAccess): IslandExpansionLevel {
    return typeof access === 'object' ? access.expansionLevel
        : getIslandExpansionLevel({ completedSets: typeof access === 'boolean' ? access ? 2 : 0 : access });
}

export function getIslandLands(access: IslandLandAccess) {
    const level = getIslandLandLevel(access);
    return [ISLAND_MAIN_LAND, ...(level >= 1 ? [ISLAND_EAST_LAND] : []), ...(level >= 2 ? [ISLAND_WEST_LAND] : [])];
}

export function getIslandLandBounds(access: IslandLandAccess) {
    const lands = getIslandLands(access);
    return {
        minX: Math.min(...lands.map(land => land.x - land.radiusX)),
        maxX: Math.max(...lands.map(land => land.x + land.radiusX)),
        minZ: Math.min(...lands.map(land => land.z - land.radiusZ)),
        maxZ: Math.max(...lands.map(land => land.z + land.radiusZ)),
    };
}

/** Both automatic placement and reachable advice search every unlocked shore. */
export function islandPlacementCandidates(access: IslandLandAccess): IslandPosition[] {
    const bounds = getIslandLandBounds(access), candidates: IslandPosition[] = [], step = .5;
    for (let iz = Math.floor(bounds.maxZ / step); iz >= Math.ceil(bounds.minZ / step); iz--) {
        for (let ix = Math.ceil(bounds.minX / step); ix <= Math.floor(bounds.maxX / step); ix++) candidates.push({ x: ix * step, z: iz * step });
    }
    return candidates;
}

function fitsLand(position: IslandPosition, radius: number, access: IslandLandAccess) {
    return getIslandLands(access).some(land => ((position.x - land.x) / (land.radiusX - radius)) ** 2
        + ((position.z - land.z) / (land.radiusZ - radius)) ** 2 <= 1);
}

function canPlaceKind(island: IslandRecord, kind: IslandItemKind, position: IslandPosition, itemId?: string) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const radius = ISLAND_ITEMS[kind]?.radius;
    if (!radius || !fitsLand(position, radius, getIslandLandAccess(island))) return false;
    if (ISLAND_RESERVED_AREAS.some(area => Math.hypot(position.x - area.x, position.z - area.z) < radius + area.radius)) return false;
    if (!isClearOfSharedDisplays(island, position, radius)) return false;
    return island.items.every(item => item.id === itemId || !item.position
        || Math.hypot(item.position.x - position.x, item.position.z - position.z) >= radius + ISLAND_ITEMS[item.kind].radius + .08);
}

export function isValidIslandPlacement(island: IslandRecord, itemId: string, position: IslandPosition, rotation = 0) {
    const item = island.items.find(candidate => candidate.id === itemId);
    return Boolean(item && Number.isFinite(rotation) && canPlaceKind(island, item.kind, position, itemId));
}

/** A deterministic suggestion only; the user remains free to choose any clear land. */
export function findAvailablePosition(island: IslandRecord, kind: IslandItemKind, itemId?: string): IslandPosition | undefined {
    const candidates = islandPlacementCandidates(getIslandLandAccess(island));
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
