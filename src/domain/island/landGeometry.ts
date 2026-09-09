import type { IslandExpansionLevel } from './expansion';

/** Physical floor only. District names and growth targets remain separate. */
export interface IslandLandArea {
    readonly x: number;
    readonly z: number;
    readonly radiusX: number;
    readonly radiusZ: number;
}

export const ISLAND_MAIN_LAND: IslandLandArea = Object.freeze({ x: 0, z: 0, radiusX: 4.8, radiusZ: 3.6 });
export const ISLAND_EAST_LAND: IslandLandArea = Object.freeze({ x: 7.3, z: 0, radiusX: 3, radiusZ: 3.4 });
export const ISLAND_WEST_LAND: IslandLandArea = Object.freeze({ x: -7.3, z: 0, radiusX: 3, radiusZ: 3.4 });
export const ISLAND_EAST_CONNECTOR: IslandLandArea = Object.freeze({ x: 3.65, z: 0, radiusX: 3.65, radiusZ: 3.35 });
export const ISLAND_WEST_CONNECTOR: IslandLandArea = Object.freeze({ x: -3.65, z: 0, radiusX: 3.65, radiusZ: 3.35 });
/** Mature connecting garden, not another district or growth target. */
export const ISLAND_CENTRAL_FLOOR: IslandLandArea = Object.freeze({ x: 0, z: -.6, radiusX: 6.5, radiusZ: 5.5 });

const floors: readonly (readonly IslandLandArea[])[] = Object.freeze([
    Object.freeze([ISLAND_MAIN_LAND]),
    Object.freeze([ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_EAST_CONNECTOR]),
    Object.freeze([ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_EAST_CONNECTOR, ISLAND_WEST_LAND, ISLAND_WEST_CONNECTOR, ISLAND_CENTRAL_FLOOR]),
]);

/** Includes every old ellipse without moving it; the deeper central floor opens only with both districts. */
export function getIslandFloorAreas(level: IslandExpansionLevel): readonly IslandLandArea[] {
    return floors[level];
}

/** Retains the conservative inset-ellipse rule used by furniture and feet. */
export function islandFloorContains(point: { x: number; z: number }, clearance: number, level: IslandExpansionLevel): boolean {
    if (![point.x, point.z, clearance].every(Number.isFinite) || clearance < 0) return false;
    return getIslandFloorAreas(level).some(area => area.radiusX > clearance && area.radiusZ > clearance
        && ((point.x - area.x) / (area.radiusX - clearance)) ** 2
            + ((point.z - area.z) / (area.radiusZ - clearance)) ** 2 <= 1);
}

export function getIslandFloorBounds(level: IslandExpansionLevel) {
    const areas = getIslandFloorAreas(level);
    return {
        minX: Math.min(...areas.map(area => area.x - area.radiusX)),
        maxX: Math.max(...areas.map(area => area.x + area.radiusX)),
        minZ: Math.min(...areas.map(area => area.z - area.radiusZ)),
        maxZ: Math.max(...areas.map(area => area.z + area.radiusZ)),
    };
}
