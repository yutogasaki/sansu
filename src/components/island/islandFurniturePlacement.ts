import type { IslandResidentId } from '../../domain/island/residentIdentity';
import type { IslandStageItem } from './three/types';

export interface IslandFurniturePlacementChoice { residentId: IslandResidentId; partnerId?: IslandResidentId }
export interface IslandFurniturePlacementResult extends IslandFurniturePlacementChoice {
    key: string; itemId: string;
    status: 'checking' | 'ready' | 'blocked' | 'searching' | 'no-space';
    suggestion?: { requestId: string; position: { x: number; z: number }; rotation: number };
}
/** Stable preview ownership; no renderer or Three.js is loaded by this helper. */
export function furniturePlacementKey(item: IslandStageItem, choice: IslandFurniturePlacementChoice) {
    return JSON.stringify([item.id, item.kind, item.position?.x, item.position?.z, item.rotation, choice.residentId, choice.partnerId]);
}
