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
    /** A composed district proves this fixed point against its original anchor floor. */
    anchorPoint?: WorldPoint;
    /** A bridge landing can be walked on without becoming purchased planting land. */
    placement: boolean;
}
/** Vertical banks and falling water are visible surfaces, never supporting floors. */
export interface WorldSurface {
    id: string;
    kind: 'bank' | 'flow';
    vertices: readonly WorldPoint[];
    indices: readonly number[];
    material: { color: string; roughness: number; metalness: number; opacity?: number };
}
export interface WorldPort { id: string; siteId: string }
/** Authoring permission over existing original ground; never a planting or passage grant. */
export interface WorldWaterCarvingScope { id: string; floorIds: readonly string[]; envelope: readonly Cell[] }
/** Existing graph entries beside this owner's actual active water surfaces. */
export interface WorldShoreAccess { ownerSiteId: string; waterFloorIds: readonly string[]; entrySiteIds: readonly string[] }
export interface WorldDistrict {
    id: string;
    templateId: string;
    logicalOrigin: Cell;
    worldOrigin: WorldPoint;
    turn: 0 | 1 | 2 | 3;
    floors: readonly WorldFloor[];
    /** Original geometry proves acquired anchors without entering hit, bounds or footing. */
    anchorFloors?: readonly WorldFloor[];
    surfaces?: readonly WorldSurface[];
    waterCarvingScopes?: readonly WorldWaterCarvingScope[];
    shoreAccess?: readonly WorldShoreAccess[];
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
    /** Derived geometry changes independently of the stable district/source identity. */
    revision?: string;
    districts: readonly WorldDistrict[];
    edges: readonly WorldEdge[];
    source?: { artifact: string; sha256: string };
}
