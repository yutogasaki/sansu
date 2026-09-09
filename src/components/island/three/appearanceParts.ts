import * as THREE from 'three';
import { getIslandAppearanceStyle, type IslandAppearanceSlotId, type IslandAppearanceStyleId } from '../../../domain/island/appearance';
import { batch, disposeGeometry, IslandMaterials } from './primitives';
import { createBiscuitGroundSurface } from './appearanceGround';
import { createIslandGrassSurface } from './grassSurface';

/** A builder retains only its named surface. Existing authored builders without
 * a selection keep their original mesh order and palette for legacy rendering. */
export class ScenerySlotBuild {
    readonly group = new THREE.Group();
    private readonly discarded = new THREE.Group();
    constructor(readonly slot?: IslandAppearanceSlotId) {
        if (slot) { this.group.name = `appearance-${slot}`; this.group.userData.appearanceSlot = slot; }
    }
    part(slot: IslandAppearanceSlotId) { return !this.slot || this.slot === slot ? this.group : this.discarded; }
    finish(merge = true) {
        disposeGeometry(this.discarded);
        return merge ? batch(this.group) : this.group;
    }
}

const colors = {
    'moon-garden': { wall: '#fff1bf', glass: '#60dcf2', flower: '#f24e9c', center: '#ffbf27', stem: '#087f6a', water: '#60dcf2' },
    starry: { wall: '#dee1fa', glass: '#ffe391', flower: '#fff0a2', center: '#e8a638', stem: '#527aae', water: '#828fe8' },
    candy: { wall: '#f08fae', glass: '#a7efd8', flower: '#ff76a8', center: '#fff0be', stem: '#389779', water: '#a7ebd6' },
    crystal: { wall: '#e4f1f6', glass: '#b4f8f4', flower: '#b4eff3', center: '#9c6bc5', stem: '#438db2', water: '#94efe8' },
} as const;

/** Pools belong to one equipped surface, including procedural texture lifetime.
 * Legacy slots preserve the old color mapping; parts-v1 supplies colors that
 * used to be constant across themes (windows, blossoms and fountain water). */
export class IslandPartMaterials extends IslandMaterials {
    readonly style;
    private biscuitGround?: ReturnType<typeof createBiscuitGroundSurface>;
    private grassGround?: ReturnType<typeof createIslandGrassSurface>;
    constructor(readonly styleId: IslandAppearanceStyleId) {
        const style = getIslandAppearanceStyle(styleId);
        super(style.family); this.style = style;
    }
    override surface(color: string, roughness: number, metalness = 0, glow = false) {
        if (this.style.version === 'parts-v1' && this.style.family === 'candy'
            && this.style.slot === 'ground' && color.toLowerCase() === '#72ab50') {
            return (this.biscuitGround ??= createBiscuitGroundSurface()).material;
        }
        const base = super.surface(color, roughness, metalness, glow);
        if (this.styleId === 'legacy-v1:moon-garden:ground' && color.toLowerCase() === '#72ab50') {
            return (this.grassGround ??= createIslandGrassSurface(base, this.styleId))?.material ?? base;
        }
        return base;
    }
    override dispose() {
        this.biscuitGround?.dispose(); this.biscuitGround = undefined;
        this.grassGround?.dispose(); this.grassGround = undefined;
        super.dispose();
    }
    override color(source: string) {
        if (this.style.version === 'legacy-v1') return super.color(source);
        const palette = colors[this.style.family], key = source.toLowerCase();
        if (this.style.slot === 'houseBody' && ['#f7e8c6', '#f6eacb', '#dcceab', '#d5dac3'].includes(key)) return palette.wall;
        if (this.style.slot === 'houseWindows' && ['#79b6ac', '#80b5b5', '#ffe59a'].includes(key)) return palette.glass;
        if (this.style.slot === 'flower') {
            if (['#f39482', '#fff0c0', '#ffd06c'].includes(key)) return palette.flower;
            if (['#d99635', '#ffe599'].includes(key)) return palette.center;
            if (['#638f48', '#467343', '#4d8c50', '#76a85b', '#5f9251'].includes(key)) return palette.stem;
        }
        if (this.style.slot === 'water' && ['#67c9bf', '#b3efde', '#c0eee1'].includes(key)) return palette.water;
        return super.color(source);
    }
}
