import * as T from 'three';
import { growthStage, type LifeItem } from '../../../domain/islandLife/model';
import { ellipsoid, IslandMaterials } from '../three/primitives';
import { tint } from './itemGeometry';

export const PLANT_MAGIC_MS = 3000;
export const PLANT_MAGIC_RETRY_MS = 500;

/** Display-only duplicates: the plant never loses a leaf or gains any growth. */
export function buildPlantMagic(item: LifeItem, materials: IslandMaterials) {
    const root = new T.Group(); root.name = 'life-plant-magic'; root.visible = false;
    const petals = item.kind === 'flower' && growthStage(item) === 2;
    const color = petals ? tint(item.style) : '#80ad65';
    const bits = Array.from({ length: 7 }, (_, i) => {
        const bit = ellipsoid(root, materials.surface(color, .85), [0, 0, 0], petals ? [.10, .032, .07] : [.12, .025, .05], 10);
        bit.userData.baseScale = bit.scale.clone();
        bit.rotation.y = i * 1.7; return bit;
    });
    const base = item.kind === 'sapling' ? [.20, .52, .92][growthStage(item)] : petals ? .50 : growthStage(item) === 1 ? .34 : .21;
    return { root, petals,
        sample(elapsed: number, reduced: boolean) {
            root.visible = elapsed >= 0 && elapsed < PLANT_MAGIC_MS;
            if (!root.visible) return;
            bits.forEach((bit, i) => {
                const phase = reduced ? .55 + (i % 3) * .1 : Math.max(0, Math.min(1, (elapsed / PLANT_MAGIC_MS - i * .045) / .73));
                bit.position.set(Math.sin(i * 2.3) * (.24 + phase * .15), base + phase * 1.02, Math.cos(i * 2.3) * .23);
                bit.scale.copy(bit.userData.baseScale).multiplyScalar(reduced ? 1 : Math.sin(Math.PI * phase));
                bit.rotation.z = reduced ? (i % 2 ? -.35 : .35) : phase * 1.8 + i;
            });
        },
    };
}
