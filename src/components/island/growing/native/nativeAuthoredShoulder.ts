import * as T from 'three';
import type { GrowingState } from '../../../../domain/growingIsland';
import type { CompiledWorldFloor, IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import type { SceneLayout } from '../sceneLayout';
import type { NativeGrowingManifest } from './nativeGrowingKit';

export interface ShoulderBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface NativeAuthoredShoulderManifest {
    version: number;
    source: { id: string; sha256: string; artifact: string };
    artifact: { path: string; sha256: string; expandedSha256: string; expandedBytes: number; gzipBytes: number };
    extension: { worldId: string; districtId: string; topFingerprint: string; topTriangles: number };
    soil: { node: string; triangles: number };
    roots: readonly {
        node: string; ownerId: string; triangles: number;
        binding: { cell: { x: number; z: number }; sourcePart: string; sourcePivot: readonly number[];
            sourceId: string; sourceSha256: string; kitExpandedSha256: string; kitGzipSha256: string;
            authoredMatrixWorld: readonly number[]; floorWorldId: string; localFloor: ShoulderBounds & { fingerprint: string } };
    }[];
    counts: { nodes: number; primitives: number; triangles: number; materials: number };
}

/** Physical identity only. Material splitting, normals, floor IDs, vertex order
 * and triangle order cannot change this signature. The 1 nm rounding matches
 * the compiled world's coordinate precision, rather than relaxing support. */
export function shoulderFloorFingerprint(floors: readonly CompiledWorldFloor[], bounds?: ShoulderBounds): string {
    const rows: string[] = [], rounded = (value: number) => Math.round(value * 1e9) / 1e9;
    for (const floor of floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const vertices = [0, 1, 2].map(offset => floor.vertices[floor.indices[i + offset]]);
        if (bounds && (Math.max(...vertices.map(vertex => vertex.point.x)) < bounds.minX
            || Math.min(...vertices.map(vertex => vertex.point.x)) > bounds.maxX
            || Math.max(...vertices.map(vertex => vertex.point.z)) < bounds.minZ
            || Math.min(...vertices.map(vertex => vertex.point.z)) > bounds.maxZ)) continue;
        rows.push(JSON.stringify([floor.kind, vertices.map(({ cell, point }) =>
            [cell.x, cell.z, point.x, point.y, point.z].map(rounded)).map(vertex => JSON.stringify(vertex)).sort()]));
    }
    rows.sort();
    // A stable geometry signature, not a replacement for the verified GLB SHA.
    const text = JSON.stringify(rows); let a = 2166136261, b = 2246822507;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909); }
    return `${rows.length}:${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

const finite = (values: readonly number[]) => values.every(Number.isFinite);
const close = (a: readonly number[], b: readonly number[]) => a.length === b.length && finite(a) && finite(b)
    && a.every((value, i) => Math.abs(value - b[i]) <= 1e-8);
const identity = new T.Matrix4().elements;
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
type ShoulderLayout = Pick<SceneLayout, 'authored' | 'center' | 'world'>;

/** Takes ownership of the verified, component-only GLTF's geometry/materials.
 * Instances borrow those resources; ObjectLayer may dispose each instance, but
 * only factory.dispose releases shared source resources. No floor or right is
 * supplied by these meshes. The common world alone draws/hits the top surface. */
export function makeNativeAuthoredShoulder(source: T.Group, input: NativeAuthoredShoulderManifest) {
    const manifest = structuredClone(input), { source: lineage, artifact } = manifest;
    if (manifest.version !== 1 || !lineage.id || !/^[a-f\d]{64}$/.test(lineage.sha256)
        || !/^[a-f\d]{64}$/.test(artifact.expandedSha256)
        || source.userData.sourceId !== lineage.id || source.userData.sourceSha256 !== artifact.expandedSha256)
        throw Error('Authored shoulder source identity differs');
    const expected = [manifest.soil, ...manifest.roots];
    if (manifest.counts.nodes !== expected.length || manifest.counts.primitives !== expected.length
        || new Set(expected.map(part => part.node)).size !== expected.length || manifest.roots.length !== 3)
        throw Error('Authored shoulder manifest parts differ');
    source.updateWorldMatrix(true, true);
    const templates = new Map<string, T.Mesh>(), geometry = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    const allMeshes = meshes(source);
    if (allMeshes.length !== expected.length) throw Error('Authored shoulder contains unexpected geometry');
    for (const part of expected) {
        const node = source.children.find(child => (child.userData.name ?? child.name) === part.node);
        const owned = node && meshes(node);
        if (!node || owned?.length !== 1) throw Error('Authored shoulder source node differs');
        const mesh = owned[0], position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
        if (!close(mesh.matrixWorld.elements, identity) || !position || !normal || normal.count !== position.count
            || !mesh.geometry.index || mesh.geometry.index.count !== part.triangles * 3 || Array.isArray(mesh.material))
            throw Error('Authored shoulder source primitive differs');
        templates.set(part.node, mesh); geometry.add(mesh.geometry); materials.add(mesh.material);
    }
    if (expected.reduce((sum, part) => sum + part.triangles, 0) !== manifest.counts.triangles || materials.size !== manifest.counts.materials)
        throw Error('Authored shoulder source counts differ');
    for (const root of manifest.roots) {
        const binding = root.binding;
        if (!root.ownerId || binding.authoredMatrixWorld.length !== 16 || !finite(binding.authoredMatrixWorld)
            || binding.sourcePivot.length !== 3 || !finite(binding.sourcePivot)
            || !finite([binding.cell.x, binding.cell.z, binding.localFloor.minX, binding.localFloor.maxX, binding.localFloor.minZ, binding.localFloor.maxZ]))
            throw Error('Authored shoulder root binding differs');
    }
    let disposed = false;
    const physical = new WeakMap<IslandWorld, { topMatches: boolean; roots: Map<string, boolean> }>();
    const eligibility = (layout: ShoulderLayout) => {
        if (!layout.authored || !Number.isFinite(layout.center) || layout.world.id !== manifest.extension.worldId) return undefined;
        const world = layout.world, known = physical.get(world); if (known) return known;
        const district = world.definition.districts.find(value => value.id === manifest.extension.districtId);
        const ids = new Set(district?.floors.map(floor => JSON.stringify([district.id, floor.id])));
        const top = world.floors.filter(floor => ids.has(floor.id));
        const result = { topMatches: Boolean(district && shoulderFloorFingerprint(top) === manifest.extension.topFingerprint),
            roots: new Map(manifest.roots.map(root => [root.ownerId,
                shoulderFloorFingerprint(world.floors, root.binding.localFloor) === root.binding.localFloor.fingerprint])) };
        physical.set(world, result); return result;
    };
    const instance = (node: string, name: string, layout: ShoulderLayout, ownerId?: string) => {
        if (disposed) throw Error('Authored shoulder source is disposed');
        const metadata = { nativePart: name, sourceId: lineage.id, sourceSha256: lineage.sha256, artifactSha256: artifact.expandedSha256,
            ...(ownerId ? { ownerId, objectId: ownerId, ownerIds: [ownerId] } : {}), noNewOwnerOrRights: true };
        const root = new T.Group(); root.name = name; root.position.set(-layout.center, 0, -2); root.userData = metadata;
        const template = templates.get(node)!, mesh = new T.Mesh(template.geometry, template.material);
        mesh.name = template.name; mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData = { ...metadata, ...(ownerId ? { ownerIds: [ownerId] } : {}), nativeSharedGeometry: true, nativeSharedMaterial: true };
        if (!ownerId) mesh.raycast = () => {};
        root.add(mesh); return root;
    };
    return {
        sourceId: lineage.id, sourceSha256: lineage.sha256,
        /** A future water cut invalidates the closed source soil. The domain
         * keeps its evaluated floor; this adapter then deliberately adds no skin. */
        instanceSoil(layout: ShoulderLayout): T.Group | undefined {
            if (disposed) throw Error('Authored shoulder source is disposed');
            return eligibility(layout)?.topMatches ? instance(manifest.soil.node, 'authored-shoulder-soil', layout) : undefined;
        },
        instanceRoots(state: GrowingState, layout: ShoulderLayout, actualTreeRoot: T.Object3D, nativeKitIdentity: NativeGrowingManifest): T.Group | undefined {
            if (disposed) throw Error('Authored shoulder source is disposed');
            const ownerId = actualTreeRoot.userData.ownerId ?? actualTreeRoot.userData.objectId;
            const part = manifest.roots.find(root => root.ownerId === ownerId), owner = state.landmarks.find(value => value.id === ownerId);
            if (!part || !owner?.cell || owner.kind !== 'sapling' || owner.growth < 18) return undefined;
            const binding = part.binding;
            if (owner.cell.x !== binding.cell.x || owner.cell.z !== binding.cell.z || layout.world.id !== binding.floorWorldId
                || !layout.world.floorAt(owner.cell) || !eligibility(layout)?.roots.get(ownerId)) return undefined;
            if (nativeKitIdentity.candidate !== binding.sourceId || nativeKitIdentity.sourceSha256 !== binding.sourceSha256
                || nativeKitIdentity.sha256 !== binding.kitExpandedSha256 || nativeKitIdentity.gzipSha256 !== binding.kitGzipSha256
                || actualTreeRoot.userData.nativePart !== binding.sourcePart || actualTreeRoot.userData.sourceSha256 !== binding.sourceSha256
                || !/^growing-tree-(spread|branch|spire)$/.test(actualTreeRoot.name)) return undefined;
            const description = nativeKitIdentity.parts[binding.sourcePart as keyof typeof nativeKitIdentity.parts];
            if (!description) return undefined;
            const pivot = binding.sourcePart === 'willow' ? [-8, 1.24, -2.7]
                : [(description.min[0] + description.max[0]) / 2, description.min[1], (description.min[2] + description.max[2]) / 2];
            if (!close(pivot, binding.sourcePivot)) return undefined;
            for (let parent: T.Object3D | null = actualTreeRoot; parent; parent = parent.parent)
                if (!parent.visible && parent.userData.authoredPreviewHidden !== true) return undefined;
            actualTreeRoot.updateWorldMatrix(true, true);
            const authored = new T.Matrix4().makeTranslation(layout.center, 0, 2).multiply(actualTreeRoot.matrixWorld);
            if (!close(authored.elements, binding.authoredMatrixWorld)) return undefined;
            return instance(part.node, 'authored-tree-root-continuation', layout, ownerId);
        },
        dispose() {
            if (disposed) return; disposed = true;
            geometry.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
        },
    };
}

export type NativeAuthoredShoulder = ReturnType<typeof makeNativeAuthoredShoulder>;
