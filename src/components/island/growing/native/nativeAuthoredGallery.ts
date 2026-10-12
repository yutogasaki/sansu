import * as T from 'three';
import type { GrowingState } from '../../../../domain/growingIsland';
import { TREE_MATURE_HOURS } from '../../../../domain/growingIsland/environment';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import type { SceneLayout } from '../sceneLayout';
import type { NativeGrowingManifest } from './nativeGrowingKit';

export interface NativeAuthoredGalleryManifest {
    version: number;
    source: { id: string; sha256: string; artifact: string };
    artifact: { path: string; sha256: string; expandedSha256: string; expandedBytes: number; gzipBytes: number };
    counts: { nodes: number; primitives: number; triangles: number; materials: number };
    nodes: readonly { name: string; sourceRole: string; primitives: readonly { material: string; triangles: number }[] }[];
    materialNames: readonly string[];
    binding: {
        placeId: string;
        owners: readonly { id: string; cell: { x: number; z: number } }[];
        nativeKit: { candidate: string; sourceSha256: string; sha256: string; gzipSha256: string };
        authoredOrigin: readonly number[]; sourcePivot: readonly number[]; sourceScale: number; crownLocalY: number;
    };
    defaultGroundExcluded: boolean;
    galleryTraversalEnabled: boolean;
}

type GalleryLayout = Pick<SceneLayout, 'authored' | 'center' | 'world'>;
const close = (a: readonly number[], b: readonly number[]) => a.length === b.length
    && a.every((value, i) => Number.isFinite(value) && Number.isFinite(b[i]) && Math.abs(value - b[i]) <= 1e-8);
const sameIds = (a: unknown, b: readonly string[]) => Array.isArray(a) && a.length === b.length
    && [...a].sort().every((id, i) => id === [...b].sort()[i]);
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };

/** Own the verified component-only GLTF resources. All instances borrow them.
 * This is visible source structure and collision geometry only: no floor,
 * placement right, gallery target, upper route or use receipt is created. */
export function makeNativeAuthoredGallery(source: T.Group, input: NativeAuthoredGalleryManifest) {
    const manifest = structuredClone(input), { binding } = manifest;
    if (manifest.version !== 1 || !manifest.source.id || !/^[a-f\d]{64}$/.test(manifest.source.sha256)
        || manifest.artifact.expandedSha256 !== manifest.source.sha256
        || source.userData.sourceId !== manifest.source.id || source.userData.sourceSha256 !== manifest.artifact.expandedSha256
        || !manifest.defaultGroundExcluded || manifest.galleryTraversalEnabled)
        throw Error('Authored gallery source identity or role differs');
    const ownerIds = binding.owners.map(owner => owner.id);
    if (ownerIds.length !== 4 || new Set(ownerIds).size !== 4 || binding.sourceScale !== .45
        || !close(binding.authoredOrigin, binding.authoredOrigin) || binding.authoredOrigin.length !== 3
        || binding.sourcePivot.length !== 3 || !close(binding.sourcePivot, binding.sourcePivot)
        || !Number.isFinite(binding.crownLocalY)
        || binding.owners.some(owner => !owner.id || !Number.isInteger(owner.cell.x) || !Number.isInteger(owner.cell.z)))
        throw Error('Authored gallery owner binding differs');
    const parts = new Map(manifest.nodes.map(node => [node.name, node]));
    if (parts.size !== manifest.nodes.length || parts.size !== manifest.counts.nodes || source.children.length !== parts.size)
        throw Error('Authored gallery source nodes differ');
    source.updateWorldMatrix(true, true);
    const templates: { mesh: T.Mesh; sourceName: string; sourceRole: string }[] = [];
    const geometry = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    for (const node of source.children) {
        const name = node.userData.name ?? node.name, part = parts.get(name), owned = meshes(node);
        if (!part || part.primitives.length !== 1 || owned.length !== 1 || !/^(solid-body|solid-bough|solid-rail-post|solid-rail|walk-top)\//.test(name))
            throw Error('Authored gallery contains unexpected context');
        const mesh = owned[0], primitive = part.primitives[0], position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
        if (!close(mesh.matrixWorld.elements, new T.Matrix4().elements) || !position || !normal || normal.count !== position.count
            || mesh.geometry.index?.count !== primitive.triangles * 3 || Array.isArray(mesh.material)
            || mesh.material.name !== primitive.material || mesh instanceof T.SkinnedMesh || mesh.morphTargetInfluences?.length)
            throw Error('Authored gallery source primitive differs');
        templates.push({ mesh, sourceName: name, sourceRole: part.sourceRole }); geometry.add(mesh.geometry); materials.add(mesh.material);
    }
    if (templates.length !== manifest.counts.primitives || templates.reduce((n, part) => n + part.mesh.geometry.index!.count / 3, 0) !== manifest.counts.triangles
        || materials.size !== manifest.counts.materials || [...materials].some(material => !manifest.materialNames.includes(material.name)))
        throw Error('Authored gallery source counts differ');
    let disposed = false;
    return {
        sourceId: manifest.source.id, sourceSha256: manifest.source.sha256,
        instance(state: GrowingState, layout: GalleryLayout, sharedTree: T.Object3D, native: NativeGrowingManifest): T.Group | undefined {
            if (disposed) throw Error('Authored gallery source is disposed');
            if (!layout.authored || !Number.isFinite(layout.center) || sharedTree.name !== 'place-native-shared-tree'
                || !sameIds(sharedTree.userData.ownerIds, ownerIds) || sharedTree.userData.sourceScale !== binding.sourceScale) return undefined;
            for (const [key, value] of Object.entries(binding.nativeKit)) if (native[key as keyof typeof binding.nativeKit] !== value) return undefined;
            const pivot = [-4.8, native.parts['hollow-trunk'].min[1], -17];
            if (!close(pivot, binding.sourcePivot)
                || !close([(native.parts['fan-crown'].min[1] - pivot[1]) * binding.sourceScale], [binding.crownLocalY])) return undefined;
            for (const expected of binding.owners) {
                const owner = state.landmarks.find(value => value.id === expected.id);
                if (owner?.kind !== 'sapling' || !owner.cell || owner.growth < TREE_MATURE_HOURS
                    || owner.cell.x !== expected.cell.x || owner.cell.z !== expected.cell.z
                    || !layout.world.owns(owner.cell) || !layout.world.floorAt(owner.cell)) return undefined;
            }
            const place = derivePlaces(state, layout.world).find(value => value.id === binding.placeId && value.ruleId === 'P02'
                && value.variant === 'cluster' && ['grown', 'lived'].includes(value.stage) && sameIds(value.mainIds, ownerIds));
            if (!place) return undefined;
            let previewHidden = false;
            for (let parent: T.Object3D | null = sharedTree; parent; parent = parent.parent) {
                if (!parent.visible && parent.userData.authoredPreviewHidden !== true) return undefined;
                if (!parent.visible) previewHidden = true;
            }
            sharedTree.updateWorldMatrix(true, true);
            const toAuthored = new T.Matrix4().makeTranslation(layout.center, 0, 2);
            const expectedShared = new T.Matrix4().makeTranslation(...binding.authoredOrigin as [number, number, number]);
            if (!close(toAuthored.clone().multiply(sharedTree.matrixWorld).elements, expectedShared.elements)) return undefined;
            for (const part of ['hollow-trunk', 'fan-crown'] as const) {
                const children = sharedTree.children.filter(child => child.userData.nativePart === part);
                const actual = children[0], expected = expectedShared.clone()
                    .multiply(new T.Matrix4().makeTranslation(0, part === 'fan-crown' ? binding.crownLocalY : 0, 0))
                    .multiply(new T.Matrix4().makeScale(binding.sourceScale, binding.sourceScale, binding.sourceScale));
                if (children.length !== 1 || actual.userData.sourceSha256 !== native.sourceSha256
                    || !actual.visible || !close(toAuthored.clone().multiply(actual.matrixWorld).elements, expected.elements)) return undefined;
            }
            const metadata = { nativePart: 'authored-gallery-structure', sourceId: manifest.source.id, sourceSha256: manifest.source.sha256,
                artifactSha256: manifest.artifact.expandedSha256, placeId: place.id, placeRevision: place.revision,
                ownerIds: [...ownerIds], noNewOwnerOrRights: true, defaultGroundExcluded: true, galleryTraversalEnabled: false };
            const root = new T.Group(); root.name = 'authored-gallery-structure'; root.position.set(-layout.center, 0, -2); root.userData = metadata;
            if (previewHidden) { root.visible = false; root.userData.authoredPreviewHidden = true; }
            for (const [i, template] of templates.entries()) {
                const mesh = new T.Mesh(template.mesh.geometry, template.mesh.material); mesh.name = template.mesh.name;
                mesh.castShadow = true; mesh.receiveShadow = true;
                mesh.userData = { ...metadata, ownerIds: [...ownerIds], ownerId: ownerIds[i % ownerIds.length], objectId: ownerIds[i % ownerIds.length],
                    sourceGalleryNode: template.sourceName, sourceSurfaceRole: template.sourceRole, nativeSharedGeometry: true, nativeSharedMaterial: true };
                root.add(mesh);
            }
            return root;
        },
        dispose() { if (disposed) return; disposed = true; geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); },
    };
}

export type NativeAuthoredGallery = ReturnType<typeof makeNativeAuthoredGallery>;
