import * as THREE from 'three';
import type { IslandCosmetics } from '../../../domain/island/customization';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeExpansion, makeLighthouse, makeOcean, makeScenery, makeStarTree } from './scenery';
import { makeWestExpansion } from './westScenery';
import { addAccentMotifs, addThemeEnvironment } from './themeMotifs';
import { applySceneryGrowth } from './growthVisuals';
import type { IslandStageState } from './types';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';

export const ISLAND_CUSTOMIZATION_CANDIDATE = 'island-cosmetics-v1';
export const DEFAULT_ISLAND_COSMETICS: IslandCosmetics = { themeId: 'moon-garden', accentId: null };

export function sameIslandCosmetics(a?: IslandCosmetics, b?: IslandCosmetics) {
    return (a?.themeId ?? 'moon-garden') === (b?.themeId ?? 'moon-garden') && (a?.accentId ?? null) === (b?.accentId ?? null);
}

/** This layer owns all theme-specific GPU resources. Resident/furniture material
 * pools and actor identities are deliberately outside its lifetime. */
export class IslandCosmeticScenery {
    readonly group = new THREE.Group();
    readonly materials: IslandMaterials;
    readonly scenery: THREE.Group;
    readonly tree: THREE.Group;
    readonly expansion: THREE.Group;
    readonly westExpansion: THREE.Group;
    readonly lighthouse: THREE.Group;
    readonly growth = new THREE.Group();
    readonly environment = new THREE.Group();
    readonly accents = new THREE.Group();
    private disposed = false;

    constructor(readonly cosmetics: IslandCosmetics = DEFAULT_ISLAND_COSMETICS) {
        this.group.name = `island-theme-${cosmetics.themeId}`;
        this.materials = new IslandMaterials(cosmetics.themeId);
        this.scenery = makeScenery(this.materials);
        this.tree = makeStarTree(this.materials);
        this.expansion = makeExpansion(this.materials);
        this.westExpansion = makeWestExpansion(this.materials);
        this.lighthouse = makeLighthouse(this.materials);
        addThemeEnvironment(this.environment, this.materials);
        addAccentMotifs(this.accents, this.materials, cosmetics.accentId);
        this.group.add(makeOcean(this.materials), this.scenery, this.tree, this.expansion,
            this.westExpansion, this.lighthouse, this.growth, this.environment, this.accents);
        this.expansion.visible = this.westExpansion.visible = this.lighthouse.visible = false;
    }

    updateGrowth(state: IslandStageState) {
        const level = getIslandExpansionLevel(state);
        this.expansion.visible = level >= 1;
        this.westExpansion.visible = level >= 2;
        this.lighthouse.visible = level >= 1 && state.completedSets >= 6;
        return applySceneryGrowth(this.growth, state, this.materials,
            { main: this.tree, west: this.westExpansion.getObjectByName('western-grove-tree') as THREE.Group | undefined });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.group.removeFromParent();
        disposeGeometry(this.group);
        this.materials.dispose();
    }
}
