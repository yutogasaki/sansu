import type { Object3D } from 'three';
import { growthStage, type LifeItem } from '../../../domain/islandLife/model';
export const runtimeAssetsEnabled = import.meta.env.VITE_ISLAND_RUNTIME_ASSETS === 'true';
export type RuntimeAssetKind = 'tree' | 'rock' | 'bench' | 'garden-hut' | 'flowerbed' | 'streetlamp';
/** Only a mature flower may acquire the generated, fully blooming silhouette. */
export function gardenRuntimeAsset(item: LifeItem, preview: boolean): RuntimeAssetKind | undefined {
    if (preview || item.style !== 'original') return;
    if (item.kind === 'flower' && growthStage(item) === 2) return 'flowerbed';
    if (item.kind === 'lantern') return 'streetlamp';
}
export function runtimeAssetSlot(object: Object3D, kind: RuntimeAssetKind) {
    if (runtimeAssetsEnabled) object.userData.runtimeAssetKind = kind;
}
