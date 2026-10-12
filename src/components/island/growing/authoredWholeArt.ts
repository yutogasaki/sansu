import * as T from 'three';
import type { GrowingState } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import type { NativeAuthoredForest } from './native/nativeAuthoredForest';
import type { NativeAuthoredGallery } from './native/nativeAuthoredGallery';
import { cloneGrowingPreviewMaterial } from './growingShaderWarmup';

export const AUTHORED_WHOLE_ART_CANDIDATE = 'native05-growth-assembly-v1';
export interface AuthoredWholeArt { forest: NativeAuthoredForest; gallery: NativeAuthoredGallery }
export interface WholeArtAttachment { source: T.Object3D; rendered: T.Group; ownerIds: string[] }

const trees = new Set(['growing-tree-spread', 'growing-tree-spire', 'growing-tree-branch']);
const visible = (object: T.Object3D) => {
    for (let parent: T.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
};

/** Attach source models in the current scene frame. Forest art follows the
 * current owned tree; gallery eligibility is still source-specific. These
 * visual structures grant no upper floor or use route. */
export function attachAuthoredWholeArt(scan: T.Object3D, state: GrowingState, layout: SceneLayout,
    native: NativeGrowingKit | undefined, art: AuthoredWholeArt | undefined, destination: T.Object3D = scan, preview = false): WholeArtAttachment[] {
    if (!layout.authored || !native || !art) return [];
    const sources: T.Object3D[] = [];
    scan.traverse(object => {
        if (visible(object) && (object.name === 'place-native-shared-tree' || trees.has(object.name) && object.userData.nativePart)) sources.push(object);
    });
    const attachments: WholeArtAttachment[] = [];
    for (const source of sources) {
        const gallery = source.name === 'place-native-shared-tree';
        const rendered = (gallery ? art.gallery : art.forest).instance(state, layout, source, native.manifest);
        if (!rendered) continue;
        const ownerIds: string[] = rendered.userData.ownerIds ?? [rendered.userData.ownerId];
        rendered.userData.artCandidate = AUTHORED_WHOLE_ART_CANDIDATE;
        rendered.userData.galleryTraversalEnabled = false;
        if (source.userData.placeId) rendered.userData.placeId = source.userData.placeId;
        rendered.traverse(object => {
            if (source.userData.placeId) object.userData.placeId = source.userData.placeId;
            if (!(object instanceof T.Mesh) || !preview) return;
            object.material = Array.isArray(object.material) ? object.material.map(cloneGrowingPreviewMaterial) : cloneGrowingPreviewMaterial(object.material);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                material.transparent = true; material.opacity = .32; material.depthWrite = false;
            }
            object.castShadow = false; object.userData.ownMaterial = true; object.userData.nativeSharedMaterial = false;
        });
        // Forest bundles contain the original trunk too; the gallery contains
        // only additional structure, so its original trunk and crown stay.
        if (!gallery) { source.visible = false; source.traverse(object => { object.raycast = () => {}; }); }
        // Factories return renderer-world transforms, including source hierarchy.
        // Preview/place containers can themselves have a transform.
        destination.updateWorldMatrix(true, false);
        rendered.applyMatrix4(destination.matrixWorld.clone().invert());
        destination.add(rendered);
        attachments.push({ source, rendered, ownerIds });
    }
    return attachments;
}
