import * as THREE from 'three';
import { cameraBounds, occludesPreview } from './sceneFraming';

/** Editing only: the preview stays readable through nearby residents and furniture.
 * Clone materials so shared world colors and saved model state remain untouched. */
export class IslandPlacementOcclusion {
    private readonly faded = new Map<THREE.Mesh, { material: THREE.Material | THREE.Material[]; renderOrder: number }>();
    private readonly clones = new Map<THREE.Material, THREE.Material>();

    update(preview: THREE.Object3D, candidates: THREE.Object3D[], camera: THREE.Camera, scenery: THREE.Object3D[] = []) {
        if (!preview.visible) { this.restore(); return; }
        camera.updateMatrixWorld(true);
        const previewBounds = cameraBounds(preview, camera), current = new Set<THREE.Mesh>();
        for (const candidate of candidates) {
            if (!candidate.visible || !occludesPreview(previewBounds, cameraBounds(candidate, camera))) continue;
            const pieces: THREE.Mesh[] = [];
            candidate.traverseVisible(child => { if (child instanceof THREE.Mesh) pieces.push(child); });
            if (pieces.some(piece => occludesPreview(previewBounds, cameraBounds(piece, camera)))) {
                // A resident remains one intact silhouette while faded, rather
                // than leaving an opaque head floating above a transparent body.
                pieces.forEach(piece => current.add(piece));
            }
        }
        for (const object of scenery) {
            if (!object.visible) continue;
            object.traverseVisible(child => {
                if (child instanceof THREE.Mesh && occludesPreview(previewBounds, cameraBounds(child, camera))) current.add(child);
            });
        }
        for (const [child, saved] of this.faded) if (!current.has(child)) {
            child.material = saved.material; child.renderOrder = saved.renderOrder; this.faded.delete(child);
        }
        for (const child of current) {
            if (this.faded.has(child)) continue;
            this.faded.set(child, { material: child.material, renderOrder: child.renderOrder });
            const fade = (source: THREE.Material) => {
                let clone = this.clones.get(source);
                if (!clone) {
                    clone = source.clone(); clone.transparent = true; clone.opacity = Math.min(source.opacity, .18);
                    clone.depthWrite = false; this.clones.set(source, clone);
                }
                return clone;
            };
            child.material = Array.isArray(child.material) ? child.material.map(fade) : fade(child.material);
            child.renderOrder = 1;
        }
    }

    restore() {
        for (const [child, saved] of this.faded) { child.material = saved.material; child.renderOrder = saved.renderOrder; }
        this.faded.clear();
        for (const clone of this.clones.values()) clone.dispose();
        this.clones.clear();
    }
}
