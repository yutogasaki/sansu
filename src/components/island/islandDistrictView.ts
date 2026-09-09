import { getIslandLandAccess, getIslandLands } from '../../domain/island/catalog';
import type { IslandRecord, IslandPosition } from '../../domain/island/types';
import type { IslandDistrict } from './IslandGrowth';

/** Loading and every earned land stage use the same local view until the child chooses another. */
export function islandHomeDistrict(island: Pick<IslandRecord, 'completedSets' | 'growth'> | undefined,
    selected?: IslandDistrict): IslandDistrict {
    if (selected === 'all' || selected === 'home') return selected;
    if (!island) return 'home';
    const lands = getIslandLands(getIslandLandAccess(island));
    if (selected === 'east' && lands.some(land => land.x > 4) || selected === 'west' && lands.some(land => land.x < -4)) return selected;
    return 'home';
}

/** Editing an existing possession brings its actual district into view. */
export function islandDistrictForPosition(island: Pick<IslandRecord, 'completedSets' | 'growth'>,
    position: IslandPosition): IslandDistrict {
    const land = getIslandLands(getIslandLandAccess(island)).reduce((closest, area) =>
        Math.hypot(area.x - position.x, area.z - position.z) < Math.hypot(closest.x - position.x, closest.z - position.z) ? area : closest);
    return land.x > 4 ? 'east' : land.x < -4 ? 'west' : 'home';
}
