import type { IslandPosition, IslandRecord } from './types';
import type { SharedDisplayId } from './sharedMemories';

/** Includes the table, preparation tray, and return plate. Both placement directions use the same footprint. */
export const SHARED_DISPLAY_RADII = { specimen: .72, work: 1 } as const;

/** No catalog or reducer runtime imports: ordinary furniture can test exhibits without a dependency cycle. */
export function sharedDisplayObstacles(island: Pick<IslandRecord, 'sharedMemories'>) {
    return Object.entries(island.sharedMemories?.displays ?? {}).flatMap(([id, display]) => display
        ? [{ displayId: id as SharedDisplayId, ...display.position, radius: SHARED_DISPLAY_RADII[display.target.kind] }] : []);
}

export function isClearOfSharedDisplays(island: Pick<IslandRecord, 'sharedMemories'>, point: IslandPosition, radius: number) {
    return sharedDisplayObstacles(island).every(other => Math.hypot(point.x - other.x, point.z - other.z) >= radius + other.radius + .08);
}
