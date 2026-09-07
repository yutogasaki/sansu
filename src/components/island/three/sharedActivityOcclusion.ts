import * as THREE from 'three';

interface TriangleNode { bounds: THREE.Box3; start: number; end: number; left?: TriangleNode; right?: TriangleNode }
interface TriangleTree {
    root: TriangleNode;
    order: Uint32Array;
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    version: number;
    index: THREE.BufferAttribute | null;
    indexVersion: number;
}
export interface SharedActivityOccluder { mesh: THREE.Mesh; inverse: THREE.Matrix4 }
const triangleTrees = new WeakMap<THREE.BufferGeometry, TriangleTree>();

/** Opaque materials are rendered without blending, regardless of their alpha. */
export function isSharedActivityOccluderMaterial(material: THREE.Material | undefined): material is THREE.Material {
    return !!material?.visible && (!material.transparent || material.opacity > .05);
}

/** Static merged scenery has very broad mesh bounds. Cache a small triangle
 * hierarchy so each ray still tests exact surfaces without scanning an island
 * mesh's thousands of unrelated ground/house triangles on every sample. */
function triangleTree(geometry: THREE.BufferGeometry) {
    const position = geometry.getAttribute('position'), index = geometry.getIndex();
    const version = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position.version;
    const cached = triangleTrees.get(geometry);
    if (cached && cached.position === position && cached.version === version && cached.index === index && cached.indexVersion === (index?.version ?? 0)) return cached;
    const count = Math.floor((index?.count ?? position.count) / 3), order = Uint32Array.from({ length: count }, (_, i) => i);
    const extent = new Float64Array(count * 6), centers = new Float32Array(count * 3), point = new THREE.Vector3();
    for (let triangle = 0; triangle < count; triangle++) {
        const bounds = new THREE.Box3();
        for (let corner = 0; corner < 3; corner++) {
            const vertex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
            bounds.expandByPoint(point.fromBufferAttribute(position, vertex));
        }
        extent.set([...bounds.min.toArray(), ...bounds.max.toArray()], triangle * 6);
        centers.set(bounds.getCenter(point).toArray(), triangle * 3);
    }
    const node = (start: number, end: number): TriangleNode => {
        const bounds = new THREE.Box3();
        for (let offset = start; offset < end; offset++) {
            const at = order[offset] * 6;
            bounds.expandByPoint(point.fromArray(extent, at)); bounds.expandByPoint(point.fromArray(extent, at + 3));
        }
        const result: TriangleNode = { bounds, start, end };
        if (end - start <= 12) return result;
        const size = bounds.getSize(new THREE.Vector3()), axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
        const split = (bounds.min.getComponent(axis) + bounds.max.getComponent(axis)) / 2;
        let left = start, right = end - 1;
        while (left <= right) {
            if (centers[order[left] * 3 + axis] < split) left++;
            else { const swap = order[left]; order[left] = order[right]; order[right--] = swap; }
        }
        const middle = left === start || left === end ? Math.floor((start + end) / 2) : left;
        result.left = node(start, middle); result.right = node(middle, end);
        return result;
    };
    const tree = { root: node(0, count), order, position, version, index, indexVersion: index?.version ?? 0 };
    triangleTrees.set(geometry, tree); return tree;
}

export function segmentHitsMesh(origin: THREE.Vector3, end: THREE.Vector3, occluder: SharedActivityOccluder) {
    const { mesh, inverse } = occluder;
    // These scene models are rigid Mesh groups. Retain Three's own exact path
    // for a future instanced/skinned/morphed object rather than using stale vertices.
    if (mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh || mesh.morphTargetInfluences?.length) {
        const delta = end.clone().sub(origin);
        return new THREE.Raycaster(origin, delta.clone().normalize(), 0, delta.length()).intersectObject(mesh, false)
            .some(hit => {
                const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
                return isSharedActivityOccluderMaterial(material);
            });
    }
    const localOrigin = origin.clone().applyMatrix4(inverse), localEnd = end.clone().applyMatrix4(inverse);
    const direction = localEnd.sub(localOrigin), farSquared = direction.lengthSq();
    const ray = new THREE.Ray(localOrigin, direction.normalize()), intersection = new THREE.Vector3();
    const geometry = mesh.geometry;
    const meets = (bounds: THREE.Box3) => bounds.containsPoint(localOrigin)
        || (ray.intersectBox(bounds, intersection) !== null && intersection.distanceToSquared(localOrigin) <= farSquared);
    // Tree validation happens before broad-phase rejection, so a position or
    // index update cannot be rejected by a stale BufferGeometry.boundingBox.
    const tree = triangleTree(geometry), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const visit = (node: TriangleNode): boolean => {
        if (!meets(node.bounds)) return false;
        if (node.left && node.right) return visit(node.left) || visit(node.right);
        for (let offset = node.start; offset < node.end; offset++) {
            const triangle = tree.order[offset] * 3;
            if (triangle < geometry.drawRange.start || triangle >= geometry.drawRange.start + geometry.drawRange.count) continue;
            const group = Array.isArray(mesh.material) ? geometry.groups.find(group => triangle >= group.start && triangle < group.start + group.count) : undefined;
            const material = Array.isArray(mesh.material) ? group && mesh.material[group.materialIndex ?? 0] : mesh.material;
            if (!isSharedActivityOccluderMaterial(material)) continue;
            a.fromBufferAttribute(tree.position, tree.index ? tree.index.getX(triangle) : triangle);
            b.fromBufferAttribute(tree.position, tree.index ? tree.index.getX(triangle + 1) : triangle + 1);
            c.fromBufferAttribute(tree.position, tree.index ? tree.index.getX(triangle + 2) : triangle + 2);
            const hit = material.side === THREE.BackSide ? ray.intersectTriangle(c, b, a, true, intersection)
                : ray.intersectTriangle(a, b, c, material.side !== THREE.DoubleSide, intersection);
            if (hit && hit.distanceToSquared(localOrigin) <= farSquared) return true;
        }
        return false;
    };
    return visit(tree.root);
}
