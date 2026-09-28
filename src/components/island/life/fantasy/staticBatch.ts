import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Consolidate only direct, unanimated item meshes. Named seats, harvests,
 * anchors and animated descendants remain attached to their original items. */
export function batchStaticGardenItems(root: T.Group, containers: T.Group[]) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const container of containers) for (const child of container.children) {
        if (!(child instanceof T.Mesh) || child.name || Array.isArray(child.material)
            || !child.visible || child.material.transparent) continue;
        const meshes = buckets.get(child.material) ?? [];
        meshes.push(child); buckets.set(child.material, meshes);
    }
    const geometries: T.BufferGeometry[] = [];
    for (const [material, meshes] of buckets) {
        if (meshes.length < 2) continue;
        const copies = meshes.map(mesh => {
            const copy = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
            if (!copy.index) return copy;
            const flat = copy.toNonIndexed(); copy.dispose(); return flat;
        });
        const merged = mergeGeometries(copies, false);
        copies.forEach(geometry => geometry.dispose());
        if (!merged) continue;
        const mesh = new T.Mesh(merged, material);
        mesh.name = 'garden-static-items';
        mesh.castShadow = meshes.some(part => part.castShadow);
        mesh.receiveShadow = meshes.some(part => part.receiveShadow);
        // Keep authored item bounds and anchors for framing and discovery. They
        // are excluded from rendering; ray hits come from the actual merged
        // triangles and are attributed back to their source item.
        const ends: number[] = []; let triangles = 0;
        for (const part of meshes) {
            triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
            ends.push(triangles); part.layers.set(31);
        }
        const raycast = mesh.raycast.bind(mesh);
        mesh.raycast = (ray, hits) => {
            const actual: T.Intersection[] = []; raycast(ray, actual);
            for (const hit of actual) {
                const index = ends.findIndex(end => (hit.faceIndex ?? -1) < end);
                if (index >= 0) hits.push({ ...hit, object: meshes[index] });
            }
        };
        root.add(mesh); geometries.push(merged);
    }
    return () => geometries.forEach(geometry => geometry.dispose());
}
