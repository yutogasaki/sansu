import * as THREE from 'three';
import type { Size3 } from './geometry';

/** Twelve rounded lobes cut into one closed leaf mass. Its 32 x 24 grid is
 * bounded to 1,472 triangles; no separate balls, materials or per-frame work.
 * The original spherical UV mapping still carries the yellow dots. */
export function treeCanopyGeometry(size: Size3, phase = 0): THREE.BufferGeometry {
    if (size.some(value => !Number.isFinite(value) || value <= 0) || !Number.isFinite(phase)) throw new RangeError('Invalid canopy dimensions');
    const geometry = new THREE.SphereGeometry(1, 32, 24);
    const positions = geometry.getAttribute('position');
    const golden = (1 + Math.sqrt(5)) / 2, lobes: THREE.Vector3[] = [];
    const rotation = new THREE.Euler(.17, phase * .7, .12);
    for (const a of [-1, 1]) for (const b of [-golden, golden]) {
        lobes.push(new THREE.Vector3(0, a, b), new THREE.Vector3(a, b, 0), new THREE.Vector3(b, 0, a));
    }
    lobes.forEach(lobe => lobe.normalize().applyEuler(rotation));
    const direction = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        direction.set(x, y, z).normalize();
        const raised = lobes.reduce((sum, lobe) => sum + Math.exp(18 * (direction.dot(lobe) - 1)), 0);
        const carved = .66 + .30 * Math.min(1, raised);
        // Branch caps enter from below. Keep that supporting volume while the
        // upper/side silhouette retains its carved lobes at every growth scale.
        const support = THREE.MathUtils.clamp((-.15 - y) / .5, 0, 1);
        const radius = THREE.MathUtils.lerp(carved, .98, support * support * (3 - 2 * support));
        // The authored organic-ellipsoid envelope, sampled more densely. Even
        // lobe tips stay inset so they cannot exceed its original triangle mesh.
        const envelope = 1 + .045 * Math.sin(x * 4 + z * 3 + phase) * (1 - y * y);
        positions.setXYZ(i, x * size[0] * envelope * (1 + .035 * z) * radius,
            y * size[1] * (1 + .065 * x - .025 * z) * radius,
            z * size[2] * envelope * (1 - .025 * x) * radius);
    }
    geometry.computeVertexNormals();
    // Weld normals across the authored UV seam and poles, retaining their UVs
    // for the existing yellow dots. Unused pole vertices borrow the same normal.
    const normals = geometry.getAttribute('normal'), shared = new Map<string, THREE.Vector3>();
    const keyAt = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)]
        .map(value => Math.round(value * 1e6)).join(':');
    for (let i = 0; i < positions.count; i++) {
        const key = keyAt(i), sum = shared.get(key) ?? new THREE.Vector3();
        sum.add(new THREE.Vector3().fromBufferAttribute(normals, i)); shared.set(key, sum);
    }
    for (let i = 0; i < positions.count; i++) {
        const normal = shared.get(keyAt(i))!.clone().normalize();
        normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    return geometry;
}
