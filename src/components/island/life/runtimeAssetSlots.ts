import type { Object3D } from 'three';
import { growthStage, type LifeItem } from '../../../domain/islandLife/model';
export const runtimeAssetsEnabled = import.meta.env.VITE_ISLAND_RUNTIME_ASSETS === 'true';
export const homePropsEnabled = import.meta.env.VITE_ISLAND_HOME_PROPS !== 'false';
export const anyRuntimeAssetsEnabled = runtimeAssetsEnabled || homePropsEnabled;
export type RuntimeAssetKind = 'tree' | 'rock' | 'bench' | 'garden-hut' | 'flowerbed' | 'streetlamp' | 'fence' | 'watering-can' | 'planter' | 'mailbox';
/** Only a mature flower may acquire the generated, fully blooming silhouette. */
export function gardenRuntimeAsset(item: LifeItem, preview: boolean): RuntimeAssetKind | undefined {
    if (preview || item.style !== 'original') return;
    if (item.kind === 'flower' && growthStage(item) === 2) return 'flowerbed';
    if (item.kind === 'lantern') return 'streetlamp';
}
export function runtimeAssetSlot(object: Object3D, kind: RuntimeAssetKind) {
    if (['fence', 'watering-can', 'planter', 'mailbox'].includes(kind) ? homePropsEnabled : runtimeAssetsEnabled) object.userData.runtimeAssetKind = kind;
}
