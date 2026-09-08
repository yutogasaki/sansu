import * as THREE from 'three';
import { makeFurniture } from './furniture';
import type { IslandStageItem } from './types';
import { disposeGeometry, type IslandMaterials } from './primitives';
import type { IslandCosmeticScenery } from './cosmeticScenery';

/** Historically placed furniture used the fixed art pool, even with a purchased
 * theme. Only a parts-v1 flower/mushroom/water choice changes those surfaces. */
export function furnitureAppearanceMaterials(item: IslandStageItem, world: IslandCosmeticScenery, fixed: IslandMaterials) {
    const slot = item.kind === 'flower' ? 'flower' : item.kind === 'mushroom' ? 'mushroom' : item.kind === 'fountain' ? 'water' : undefined;
    if (!slot) return fixed;
    const materials = world.partMaterials(slot);
    return materials.style.version === 'parts-v1' ? materials : fixed;
}

export function applyFurnitureAppearance(group: THREE.Group, item: IslandStageItem, world: IslandCosmeticScenery, fixed: IslandMaterials) {
    const materials = furnitureAppearanceMaterials(item, world, fixed);
    const key = materials === fixed ? 'legacy-fixed' : 'styleId' in materials ? String(materials.styleId) : 'legacy-fixed';
    if (group.userData.appearanceVisualKey === key) return false;
    const previous = group.userData.appearanceVisualKey;
    group.userData.appearanceVisualKey = key;
    if (previous === undefined && materials === fixed || !['flower', 'mushroom', 'fountain'].includes(item.kind)) return false;
    const replacement = makeFurniture(item.kind, item.kind === 'fountain' ? fixed : materials, materials);
    const names = item.kind === 'fountain' ? ['fountain-surface', 'fountain-water', 'fountain-ripple']
        : item.kind === 'flower' ? ['furniture-static', 'flower-leaves', 'flower-blooms'] : ['furniture-static'];
    const retired = new THREE.Group();
    for (const name of names) {
        const old = group.children.find(child => child.name === name);
        const next = replacement.children.find(child => child.name === name);
        if (old) retired.add(old);
        if (next) group.add(next);
    }
    disposeGeometry(retired); disposeGeometry(replacement);
    delete group.userData.growthVisualKey;
    group.traverse(child => { child.userData.itemId = item.id; });
    return true;
}
