import * as T from 'three';
import type { GrowingState } from '../../../../domain/growingIsland';
import { treeAge } from '../../../../domain/growingIsland/nature';
import type { SceneLayout } from '../sceneLayout';
import { treeForm } from '../treeSilhouettes';
import type { NativeGrowingManifest, NativeGrowingPart } from './nativeGrowingKit';

export interface NativeAuthoredForestManifest {
    version: number;
    candidate: string;
    source: { id: string; sha256: string; artifact: string };
    artifact: { path: string; sha256: string; expandedSha256: string; expandedBytes: number; gzipBytes: number };
    parts: readonly {
        node: string; ownerId: string; meshes: number; triangles: number;
        roles: readonly { id: string; derived: boolean }[];
        binding: {
            cell: { x: number; z: number }; age: string; minimumGrowth: number;
            sourcePart: string; sourcePivot: readonly number[];
            sourceId: string; sourceSha256: string; kitExpandedSha256: string; kitGzipSha256: string;
            authoredMatrixWorld: readonly number[]; floorWorldId: string;
        };
    }[];
    counts: { nodes: number; meshes: number; primitives: number; triangles: number; materials: number; originalRoles: number; derivedBoughs: number };
    status: { visual: string; strictWorldGeometryGate: boolean; allRoleNormalRoundtrip: string; certifiedContactPass: boolean; independentObservers: number; devCompositionOnly: boolean };
}
export type AuthoredForestLayout = Pick<SceneLayout, 'authored' | 'center' | 'world'>;
const finite = (values: readonly number[]) => values.every(Number.isFinite);
const close = (a: readonly number[], b: readonly number[]) => a.length === b.length && finite(a) && finite(b)
    && a.every((value, i) => Math.abs(value - b[i]) <= 1e-8);
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
const identity = new T.Matrix4().elements;
const variant = (id: string, count: number) => {
    let hash = 0;
    for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    return hash % count;
};

/** Saved source-only HOLD geometry. This factory supplies no floor, owner, right,
 * maturation or clearance approval. It retains the GLTF's local geometry and
 * hierarchy. The current native tree transform maps the authored tree frame to
 * its real placement and age; source owner/cell/age are lineage, not eligibility.
 * Callers replace the entire matched original tree, including its hit/guard
 * geometry. Instances borrow resources until the factory itself is disposed. */
export function makeNativeAuthoredForest(source: T.Group, input: NativeAuthoredForestManifest) {
    const manifest = structuredClone(input), { source: lineage, artifact } = manifest;
    if (manifest.version !== 1 || !lineage.id || !/^[a-f\d]{64}$/.test(lineage.sha256)
        || !/^[a-f\d]{64}$/.test(artifact.expandedSha256)
        || source.userData.sourceId !== lineage.id || source.userData.sourceSha256 !== artifact.expandedSha256)
        throw Error('Authored forest source identity differs');
    if (manifest.parts.length !== 4 || new Set(manifest.parts.map(part => part.ownerId)).size !== 4
        || manifest.counts.originalRoles !== 128 || manifest.counts.derivedBoughs !== 6
        || !manifest.status.devCompositionOnly || manifest.status.visual !== 'HOLD')
        throw Error('Authored forest delivery scope differs');
    source.updateWorldMatrix(true, true);
    if (!close(source.matrixWorld.elements, identity)) throw Error('Authored forest source parent transform differs');
    const templates = new Map<string, T.Object3D>(), geometry = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    const all = meshes(source), observed = new Set<T.Mesh>(), roleIds = new Set<string>();
    let triangleCount = 0, derivedCount = 0;
    for (const part of manifest.parts) {
        const root = source.children.find(node => node.userData.nativeForestOwner === part.ownerId);
        if (!root || (root.userData.name ?? root.name) !== part.node) throw Error('Authored forest owner group differs');
        const owned = meshes(root), expected = new Map(part.roles.map(role => [role.id, role.derived]));
        if (owned.length !== part.meshes || expected.size !== part.roles.length || part.roles.length !== part.meshes)
            throw Error('Authored forest owner role count differs');
        let triangles = 0;
        for (const mesh of owned) {
            const role = mesh.userData.forestDeliveryId as string, derived = mesh.userData.forestDeliveryDerived;
            const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
            if (observed.has(mesh) || roleIds.has(role) || !expected.has(role) || expected.get(role) !== derived
                || mesh.userData.forestDeliveryOwner !== part.ownerId || Array.isArray(mesh.material)
                || !position || !normal || position.count !== normal.count || !mesh.geometry.index
                || mesh.geometry.index.count % 3 || !finite(mesh.matrixWorld.elements))
                throw Error('Authored forest source primitive differs');
            for (const attribute of [position, normal])
                if (!Array.from(attribute.array).every(Number.isFinite)) throw Error('Authored forest nonfinite source geometry');
            triangles += mesh.geometry.index.count / 3; derivedCount += derived ? 1 : 0;
            observed.add(mesh); roleIds.add(role); geometry.add(mesh.geometry); materials.add(mesh.material);
        }
        if (triangles !== part.triangles) throw Error('Authored forest owner triangle count differs');
        const binding = part.binding;
        if (!finite([binding.cell.x, binding.cell.z, binding.minimumGrowth])
            || binding.authoredMatrixWorld.length !== 16 || !finite(binding.authoredMatrixWorld)
            || binding.sourcePivot.length !== 3 || !finite(binding.sourcePivot)
            || new T.Matrix4().fromArray(binding.authoredMatrixWorld).determinant() <= 0)
            throw Error('Authored forest binding differs');
        triangleCount += triangles; templates.set(part.ownerId, root);
    }
    if (all.length !== observed.size || all.length !== manifest.counts.meshes || triangleCount !== manifest.counts.triangles
        || derivedCount !== manifest.counts.derivedBoughs || materials.size !== manifest.counts.materials)
        throw Error('Authored forest contains unexpected geometry or material');
    let disposed = false;
    return {
        sourceId: lineage.id, sourceSha256: lineage.sha256,
        instance(state: GrowingState, layout: AuthoredForestLayout, actualTreeRoot: T.Object3D, nativeKitIdentity: NativeGrowingManifest): T.Group | undefined {
            if (disposed) throw Error('Authored forest source is disposed');
            if (!layout.authored || !Number.isFinite(layout.center)) return undefined;
            const ownerId = actualTreeRoot.userData.ownerId ?? actualTreeRoot.userData.objectId;
            const owner = state.landmarks.find(value => value.id === ownerId);
            if (!owner?.cell || owner.kind !== 'sapling' || treeAge(state, ownerId) === 'young') return undefined;
            const form = treeForm(ownerId), sourcePart = form === 'spread' ? 'willow' : form === 'spire' ? 'spire' : 'birch';
            const choices = manifest.parts.filter(value => value.binding.sourcePart === sourcePart).sort((a, b) => a.node.localeCompare(b.node));
            const part = choices[variant(ownerId, choices.length)];
            if (!part) return undefined;
            const binding = part.binding;
            if (!Number.isFinite(owner.growth) || owner.growth < binding.minimumGrowth
                || !layout.world.owns(owner.cell) || !layout.world.floorAt(owner.cell)) return undefined;
            if (nativeKitIdentity.candidate !== binding.sourceId || nativeKitIdentity.sourceSha256 !== binding.sourceSha256
                || nativeKitIdentity.sha256 !== binding.kitExpandedSha256 || nativeKitIdentity.gzipSha256 !== binding.kitGzipSha256
                || actualTreeRoot.userData.nativePart !== binding.sourcePart || actualTreeRoot.userData.sourceSha256 !== binding.sourceSha256
                || actualTreeRoot.name !== `growing-tree-${form}`) return undefined;
            const description = nativeKitIdentity.parts[binding.sourcePart as NativeGrowingPart];
            if (!description) return undefined;
            const pivot = binding.sourcePart === 'willow' ? [-8, 1.24, -2.7]
                : [(description.min[0] + description.max[0]) / 2, description.min[1], (description.min[2] + description.max[2]) / 2];
            if (!close(pivot, binding.sourcePivot)) return undefined;
            for (let parent: T.Object3D | null = actualTreeRoot; parent; parent = parent.parent)
                if (!parent.visible && parent.userData.authoredPreviewHidden !== true) return undefined;
            actualTreeRoot.updateWorldMatrix(true, true);
            if (!finite(actualTreeRoot.matrixWorld.elements) || actualTreeRoot.matrixWorld.determinant() <= 0) return undefined;
            const root = new T.Group(); root.name = 'authored-forest-tree'; root.matrixAutoUpdate = false;
            root.matrix.copy(actualTreeRoot.matrixWorld).multiply(new T.Matrix4().fromArray(binding.authoredMatrixWorld).invert());
            root.matrix.decompose(root.position, root.quaternion, root.scale);
            const metadata = () => ({ nativePart: 'authored-forest-tree', ownerId, objectId: ownerId, ownerIds: [ownerId],
                templateOwnerId: part.ownerId, templateSourcePart: sourcePart, treeAge: treeAge(state, ownerId),
                sourceId: lineage.id, sourceSha256: lineage.sha256, artifactSha256: artifact.expandedSha256,
                visualCandidate: manifest.candidate, noNewOwnerOrRights: true, devCompositionOnly: true, artStatus: 'HOLD',
                strictWorldGeometryGate: false, certifiedContactPass: false });
            root.userData = metadata();
            const clone = templates.get(part.ownerId)!.clone(true);
            clone.traverse(node => {
                node.userData = { ...node.userData, ...metadata() };
                if (node instanceof T.Mesh) {
                    node.userData.nativeSharedGeometry = true; node.userData.nativeSharedMaterial = true;
                    node.castShadow = !(node.material instanceof T.MeshPhysicalMaterial && node.material.transmission > .3); node.receiveShadow = true;
                }
            });
            root.add(clone); return root;
        },
        dispose() {
            if (disposed) return; disposed = true;
            geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); templates.clear();
        },
    };
}
export type NativeAuthoredForest = ReturnType<typeof makeNativeAuthoredForest>;
