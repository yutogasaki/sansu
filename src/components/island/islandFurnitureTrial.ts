import { findAvailablePosition } from '../../domain/island/catalog';
import { getOwnedIslandFurniture, islandFurnitureItemId, type IslandOptionalFurnitureKind } from '../../domain/island/furniture';
import type { IslandItem, IslandRecord } from '../../domain/island/types';

/** A temporary model has the same identity/geometry as the eventual possession,
 * but is never added to the saved items, inventory or discovery pipeline. */
export function islandFurnitureTrial(island: IslandRecord, kind: IslandOptionalFurnitureKind): IslandItem | undefined {
    if (getOwnedIslandFurniture(island, kind)) return undefined;
    const id = islandFurnitureItemId(kind), position = findAvailablePosition(island, kind, id);
    return position ? { id, kind, position, rotation: 0 } : undefined;
}
