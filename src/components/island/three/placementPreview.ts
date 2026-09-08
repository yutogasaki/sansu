import * as THREE from 'three';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import { makeFurniture } from './furniture';
import { batch, disposeGeometry, IslandMaterials, mesh } from './primitives';
import type { IslandStageItem } from './types';
import type { IslandCosmeticScenery } from './cosmeticScenery';
import { applyFurnitureAppearance, furnitureAppearanceMaterials } from './furnitureAppearance';
import { applyFurnitureGrowth } from './growthVisuals';

/** The outline describes the real saved footprint; gaps also distinguish an invalid location. */
export function makePlacementMarker(radius: number, valid: boolean) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: valid ? '#fff3be' : '#946643',
        transparent: true, opacity: .95, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    material.userData.islandOwned = true;
    const segments = valid ? 1 : 8;
    for (let i = 0; i < segments; i++) {
        const arc = Math.PI * 2 / segments;
        const geometry = new THREE.RingGeometry(radius + .015, radius + .05, valid ? 48 : 6,
            1, i * arc, arc * (valid ? 1 : .58));
        geometry.rotateX(-Math.PI / 2);
        mesh(group, geometry, material, [0, .025, 0]);
    }
    // A pointed front makes rotation legible even for round furniture. It follows
    // local +Z, the same front used by seats and saved rotations.
    const front = new THREE.Shape();
    front.moveTo(-.105, radius + .075); front.lineTo(.105, radius + .075);
    front.lineTo(0, radius + .23); front.closePath();
    const direction = new THREE.ShapeGeometry(front);
    direction.rotateX(Math.PI / 2);
    mesh(group, direction, material, [0, .03, 0]);
    batch(group);
    group.traverse(child => { if (child instanceof THREE.Mesh) {
        child.castShadow = child.receiveShadow = false; child.renderOrder = 3;
    } });
    return group;
}

/** Keep geometry and materials alive through a drag. Only switching the object rebuilds them. */
export class IslandPlacementPreview {
    readonly group = new THREE.Group();
    buildCount = 0;
    private item?: IslandStageItem;
    private validMarker?: THREE.Group;
    private invalidMarker?: THREE.Group;
    private appearanceKey?: string;

    constructor(private readonly materials: IslandMaterials) { this.group.visible = false; }

    update(item?: IslandStageItem, valid = true, world?: IslandCosmeticScenery, progress = 0) {
        if (!item?.position) { this.clear(); return; }
        const slot = item.kind === 'flower' ? 'flower' : item.kind === 'mushroom' ? 'mushroom' : item.kind === 'fountain' ? 'water' : undefined;
        const appearanceKey = `${slot && world ? world.appearance.slots[slot] : 'fixed'}:${item.growthLevel}:${item.appearanceLevel}:${progress}`;
        if (item.id !== this.item?.id || item.kind !== this.item?.kind || appearanceKey !== this.appearanceKey) {
            this.clear();
            const model = makeFurniture(item.kind, this.materials);
            if (world) applyFurnitureAppearance(model, item, world, this.materials);
            applyFurnitureGrowth(model, item, world ? furnitureAppearanceMaterials(item, world, this.materials) : this.materials, progress);
            // Mutable instance materials already belong to this model. Shared palette materials
            // need one clone, retained for the entire edit, including all rotations and moves.
            const clones = new Map<THREE.Material, THREE.Material>();
            model.traverse(child => {
                if (!(child instanceof THREE.Mesh)) return;
                const ghost = (source: THREE.Material) => {
                    let material = clones.get(source);
                    if (!material) {
                        material = source.userData.islandOwned ? source : source.clone();
                        material.userData.islandOwned = true;
                        material.transparent = true; material.opacity = .94; material.depthWrite = true;
                        clones.set(source, material);
                    }
                    return material;
                };
                child.material = Array.isArray(child.material) ? child.material.map(ghost) : ghost(child.material);
                child.castShadow = false;
                child.renderOrder = 2;
            });
            const radius = ISLAND_ITEMS[item.kind].radius;
            this.validMarker = makePlacementMarker(radius, true);
            this.invalidMarker = makePlacementMarker(radius, false);
            this.group.add(model, this.validMarker, this.invalidMarker);
            this.buildCount++;
            this.appearanceKey = appearanceKey;
        }
        this.item = item;
        this.group.visible = true;
        this.group.position.set(item.position.x, .015, item.position.z);
        this.group.rotation.y = item.rotation;
        this.validMarker!.visible = valid;
        this.invalidMarker!.visible = !valid;
    }

    private clear() {
        if (!this.item && !this.group.children.length) return;
        disposeGeometry(this.group);
        this.group.clear(); this.group.visible = false;
        this.item = undefined; this.validMarker = this.invalidMarker = undefined;
        this.appearanceKey = undefined;
    }

    dispose() { this.clear(); this.group.removeFromParent(); }
}
