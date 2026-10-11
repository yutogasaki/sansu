import type { Cell } from './types';

export interface WorldPoint { x: number; y: number; z: number }
export type WorldPassage = 'walk' | 'join' | 'water';

/** Logical coordinates and the actual floor share one triangulation. */
export interface WorldFloorVertex { cell: Cell; point: WorldPoint }
export interface WorldFloor {
    id: string;
    kind: 'ground' | 'deck' | 'water';
    vertices: readonly WorldFloorVertex[];
    indices: readonly number[];
    color: string;
}
export interface WorldSite {
    id: string;
    /** Planting cells are integers; dry paths may have finer, stable waypoints. */
    cell: Cell;
    floorId: string;
    /** A bridge landing can be walked on without becoming purchased planting land. */
    placement: boolean;
}
export interface WorldPort { id: string; siteId: string }
export interface WorldDistrict {
    id: string;
    templateId: string;
    logicalOrigin: Cell;
    worldOrigin: WorldPoint;
    turn: 0 | 1 | 2 | 3;
    floors: readonly WorldFloor[];
    sites: readonly WorldSite[];
    ports: readonly WorldPort[];
}
export interface WorldSiteRef { districtId: string; siteId: string }
export interface WorldEdge {
    from: WorldSiteRef;
    to: WorldSiteRef;
    allows: readonly WorldPassage[];
}
/** Geometry belongs to the authoring/runtime definition, never to an owner's save. */
export interface WorldDefinition {
    version: 1;
    id: string;
    districts: readonly WorldDistrict[];
    edges: readonly WorldEdge[];
    source?: { artifact: string; sha256: string };
}
