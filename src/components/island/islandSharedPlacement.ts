import { getIslandLandAccess, getIslandLands } from '../../domain/island/catalog';
import { isValidSharedDisplayPlacement, type SharedDisplayId, type SharedTarget } from '../../domain/island/sharedMemories';
import type { IslandPosition, IslandRecord } from '../../domain/island/types';

/** Suggestions never move furniture or reserve a place. The reducer checks the
 * actual latest island again when the child places the preview. */
export function findSharedDisplayPosition(island: IslandRecord, id: SharedDisplayId, target: SharedTarget): IslandPosition | undefined {
    const points = getIslandLands(getIslandLandAccess(island)).flatMap(land => {
        const options: IslandPosition[] = [];
        for (let z = -land.radiusZ + .5; z < land.radiusZ; z += .25) for (let x = -land.radiusX + .5; x < land.radiusX; x += .25) {
            options.push({ x: land.x + x, z: land.z + z });
        }
        return options.sort((a, b) => Math.hypot(a.x - land.x, a.z - 1) - Math.hypot(b.x - land.x, b.z - 1));
    });
    return points.find(point => isValidSharedDisplayPlacement(island, id, target, point));
}
