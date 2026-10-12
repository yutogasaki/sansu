import * as T from 'three';
import type { AuthoredCoveAssembly } from '../../../../domain/growingIsland/authoredCoveWorld';
import type { SceneLayout } from '../sceneLayout';

export interface AuthoredCoveManifest {
    version: number;
    source: { id: string; sha256: string; artifact: string };
    artifact: { path: string; sha256: string; expandedSha256: string; expandedBytes: number; gzipBytes: number };
    counts: { nodes: number; primitives: number; triangles: number; materials: number };
    coordinateContract: { pivot: readonly number[]; uniformScale: number };
    nodes: readonly { name: string; primitives: readonly { material: string; triangles: number }[] }[];
    materialNames: readonly string[];
}

const finite = (values: readonly number[]) => values.every(Number.isFinite);
const materialsOf = (mesh: T.Mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material];

/** Own the verified, shell-only GLTF resources for all live/preview instances.
 * The loader verifies bytes and sets sourceId/sourceSha256 before calling this
 * factory. Floor, navigation, placement rights and eligibility belong to the
 * composed world/plan; no source node creates a new owner or apron here. */
export function makeNativeAuthoredCove(source: T.Group, manifest: AuthoredCoveManifest) {
    const sourceId = manifest.source.id, sourceSha256 = manifest.source.sha256;
    const pivot = [...manifest.coordinateContract.pivot], scale = manifest.coordinateContract.uniformScale;
    if (manifest.version !== 1 || !sourceId || !/^[a-f\d]{64}$/.test(sourceSha256)
        || manifest.artifact.expandedSha256 !== sourceSha256
        || source.userData.sourceId !== sourceId || source.userData.sourceSha256 !== sourceSha256)
        throw Error('Authored cove source identity differs');
    if (pivot.length !== 3 || !finite(pivot) || !Number.isFinite(scale) || scale <= 0
        || manifest.counts.nodes !== manifest.nodes.length || new Set(manifest.nodes.map(node => node.name)).size !== manifest.nodes.length)
        throw Error('Authored cove source profile differs');

    const expected = new Map(manifest.nodes.map(node => [node.name, [...node.primitives]]));
    const sources: { mesh: T.Mesh; boundary: string }[] = [];
    const materials = new Set<T.Material>(), sourceGeometries = new Set<T.BufferGeometry>();
    let triangles = 0;
    source.updateMatrixWorld(true);
    source.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        let ancestor: T.Object3D | null = object;
        while (ancestor && !expected.has(ancestor.userData.name)) ancestor = ancestor.parent;
        const boundary = ancestor?.userData.name as string | undefined;
        const remaining = boundary ? expected.get(boundary) : undefined;
        const position = object.geometry.getAttribute('position'), normal = object.geometry.getAttribute('normal');
        const count = (object.geometry.index?.count ?? 0) / 3;
        const material = materialsOf(object);
        const match = remaining?.findIndex(primitive => primitive.material === material[0]?.name && primitive.triangles === count) ?? -1;
        if (!boundary || !remaining || match < 0 || material.length !== 1 || !position || !normal || normal.count !== position.count
            || object instanceof T.SkinnedMesh || object.morphTargetInfluences?.length || !finite(object.matrixWorld.elements)
            || object.matrixWorld.determinant() <= 0)
            throw Error(`Authored cove source boundary differs: ${object.name}`);
        remaining.splice(match, 1);
        triangles += count; materials.add(material[0]); sourceGeometries.add(object.geometry);
        sources.push({ mesh: object, boundary });
    });
    if ([...expected.values()].some(primitives => primitives.length) || sources.length !== manifest.counts.primitives
        || triangles !== manifest.counts.triangles || materials.size !== manifest.counts.materials
        || manifest.materialNames.length !== materials.size || [...materials].some(material => !manifest.materialNames.includes(material.name)))
        throw Error('Authored cove source geometry/material counts differ');

    // Bake full nested source transforms once. Preserve source indices, normals,
    // attributes and the loader's original material objects (including its
    // transmission guard); do not recompute normals, recolor or batch by owner.
    const templates = sources.map(({ mesh, boundary }) => {
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        return { name: mesh.name, boundary, geometry, material: mesh.material as T.Material };
    });
    for (const geometry of sourceGeometries) geometry.dispose();
    let disposed = false;

    return {
        sourceId,
        sourceSha256,
        instance(assembly: AuthoredCoveAssembly, layout: Pick<SceneLayout, 'center'>): T.Group {
            if (disposed) throw Error('Authored cove source is disposed');
            if (assembly.sourceId !== sourceId || assembly.sourceSha256 !== sourceSha256)
                throw Error('Authored cove assembly source identity differs');
            const transform = assembly.transform, at = transform.position;
            if (transform.pivot.length !== 3 || transform.pivot.some((value, index) => value !== pivot[index]) || transform.scale !== scale
                || !finite([at.x, at.y, at.z, transform.yaw, layout.center]))
                throw Error('Authored cove assembly transform differs');
            if (!assembly.placeId || !assembly.placeRevision || !assembly.playId || !assembly.ownerIds.length
                || assembly.ownerIds.some(id => !id) || !assembly.ownerIds.includes(assembly.playId)
                || new Set(assembly.ownerIds).size !== assembly.ownerIds.length)
                throw Error('Authored cove assembly ownership differs');
            const metadata = {
                nativePart: 'authored-cove-shell', sourceId, sourceSha256,
                ownerId: assembly.playId, objectId: assembly.playId, ownerIds: [...assembly.ownerIds],
                placeId: assembly.placeId, placeRevision: assembly.placeRevision,
            };
            const root = new T.Group(); root.name = 'authored-cove-shell'; root.userData = metadata;
            root.position.set(at.x - layout.center, at.y, at.z - 2);
            root.rotation.y = transform.yaw; root.scale.setScalar(transform.scale);
            // Keep native-coordinate vertices intact and subtract the common
            // pivot before the rigid scale/rotation/translation above.
            const origin = new T.Group(); origin.name = 'authored-cove-source-pivot';
            origin.position.set(-pivot[0], -pivot[1], -pivot[2]); root.add(origin);
            for (const template of templates) {
                const mesh = new T.Mesh(template.geometry, template.material); mesh.name = template.name;
                mesh.castShadow = !(template.material instanceof T.MeshPhysicalMaterial && template.material.transmission > .3);
                mesh.receiveShadow = true;
                mesh.userData = { ...metadata, ownerIds: [...assembly.ownerIds], sourceNative05Names: [template.boundary],
                    nativeSharedGeometry: true, nativeSharedMaterial: true };
                origin.add(mesh);
            }
            return root;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const template of templates) template.geometry.dispose();
            for (const material of materials) material.dispose();
        },
    };
}

export type NativeAuthoredCove = ReturnType<typeof makeNativeAuthoredCove>;
export type NativeAuthoredCoveAPI = NativeAuthoredCove;
