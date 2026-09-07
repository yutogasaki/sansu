import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Size3 = readonly [number, number, number];
export interface LoftRing {
    y: number;
    radiusX: number;
    radiusZ?: number;
    centerX?: number;
    centerZ?: number;
    lobes?: number;
    lobeStrength?: number;
}

function positive(value: number, label: string) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite`);
    return value;
}

/** Centered on the origin; rounding never changes the requested outside dimensions. */
export function roundedBoxGeometry(size: Size3, radius = .04, segments = 2): THREE.BufferGeometry {
    size.forEach(value => positive(value, 'Size'));
    if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(segments)) throw new RangeError('Invalid rounding');
    if (radius === 0) return new THREE.BoxGeometry(...size);
    return new RoundedBoxGeometry(...size, Math.max(1, Math.min(3, Math.floor(segments))), Math.min(radius, ...size.map(value => value / 2)));
}

/** Smooth, capped horizontal profiles. Useful for a continuous trunk/root flare. */
export function loftGeometry(rings: readonly LoftRing[], segments = 24): THREE.BufferGeometry {
    if (rings.length < 2) throw new RangeError('A loft needs at least two profiles');
    const count = Math.max(8, Math.min(64, Math.floor(positive(segments, 'Segments'))));
    const positions: number[] = [], indices: number[] = [];
    for (const [row, ring] of rings.entries()) {
        positive(ring.radiusX, 'Radius'); positive(ring.radiusZ ?? ring.radiusX, 'Radius');
        if (![ring.y, ring.centerX ?? 0, ring.centerZ ?? 0, ring.lobes ?? 0, ring.lobeStrength ?? 0].every(Number.isFinite)
            || (ring.lobeStrength ?? 0) < 0 || (row > 0 && ring.y <= rings[row - 1].y)) throw new RangeError('Invalid loft profile');
        for (let i = 0; i <= count; i++) {
            const angle = i / count * Math.PI * 2;
            const flare = (ring.lobeStrength ?? 0) * Math.pow(Math.max(0, Math.cos(angle * (ring.lobes ?? 0) + .25)), 3);
            positions.push((ring.centerX ?? 0) + Math.cos(angle) * (ring.radiusX + flare), ring.y,
                (ring.centerZ ?? 0) + Math.sin(angle) * ((ring.radiusZ ?? ring.radiusX) + flare));
        }
        if (row) for (let i = 0; i < count; i++) {
            const lower = (row - 1) * (count + 1) + i, upper = row * (count + 1) + i;
            indices.push(lower, upper, lower + 1, lower + 1, upper, upper + 1);
        }
    }
    // Independent cap vertices preserve the flat contact surface and its exact height.
    for (const [row, top] of [[0, false], [rings.length - 1, true]] as const) {
        const ring = rings[row], center = positions.length / 3;
        positions.push(ring.centerX ?? 0, ring.y, ring.centerZ ?? 0);
        const rim = positions.length / 3;
        for (let i = 0; i <= count; i++) {
            const at = (row * (count + 1) + i) * 3;
            positions.push(positions[at], positions[at + 1], positions[at + 2]);
            if (i < count) indices.push(center, rim + i + (top ? 1 : 0), rim + i + (top ? 0 : 1));
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    for (let row = 0; row < rings.length; row++) {
        const first = row * (count + 1), last = first + count;
        const normal = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
        normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
    return geometry;
}

/** Low-frequency shape variation keeps leaf masses readable without adding tiny leaves. */
export function organicEllipsoidGeometry(size: Size3, phase = 0): THREE.BufferGeometry {
    size.forEach(value => positive(value, 'Size'));
    if (!Number.isFinite(phase)) throw new RangeError('Invalid phase');
    const geometry = new THREE.SphereGeometry(1, 20, 14), positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        const lobe = 1 + .045 * Math.sin(x * 4 + z * 3 + phase) * (1 - y * y);
        positions.setXYZ(i, x * size[0] * lobe * (1 + .035 * z), y * size[1] * (1 + .065 * x - .025 * z),
            z * size[2] * lobe * (1 - .025 * x));
    }
    geometry.computeVertexNormals();
    // Sphere UV seams and poles duplicate positions. Share their deformed normals,
    // including unused pole vertices, so broad color surfaces have no lighting seam.
    const normals = geometry.attributes.normal, shared = new Map<string, THREE.Vector3>();
    const keyAt = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map(value => Math.round(value * 1e6)).join(':');
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

/** Every outline remains outside the saved placement ellipse, including polygon chords. */
export function shoreContour(angle: number) {
    return 1.052 + Math.sin(angle * 3 + .6) * .029 + Math.sin(angle * 5 - 1.1) * .013;
}

/** The saved placement ellipse is a subset of this level, closed surface. */
export function islandGroundGeometry(radiusX: number, radiusZ: number): THREE.BufferGeometry {
    positive(radiusX, 'Radius'); positive(radiusZ, 'Radius');
    const count = 64, positions = [0, 0, 0], indices: number[] = [], colors = [1, 1, 1];
    for (const radial of [.34, .67, 1]) for (let i = 0; i <= count; i++) {
        const angle = i / count * Math.PI * 2, radius = radial * shoreContour(angle);
        const x = Math.cos(angle) * radiusX * radius, z = Math.sin(angle) * radiusZ * radius;
        positions.push(x, 0, z);
        const shade = .97 + .03 * Math.sin(x * .7 + z * .4) * Math.cos(z * .65);
        colors.push(shade, shade, shade);
    }
    for (let i = 0; i < count; i++) indices.push(0, 2 + i, 1 + i);
    for (let row = 0; row < 2; row++) for (let i = 0; i < count; i++) {
        const inner = 1 + row * (count + 1) + i, outer = inner + count + 1;
        indices.push(inner, inner + 1, outer, inner + 1, outer + 1, outer);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

/** One thick gabled shell; the rounded ridge and eave share the same profile. */
export function cottageRoofGeometry(): THREE.BufferGeometry {
    const profile = new THREE.Shape();
    profile.moveTo(-1.18, 1.4);
    profile.quadraticCurveTo(-1.21, 1.46, -1.12, 1.53);
    profile.lineTo(-.08, 2.33); profile.quadraticCurveTo(0, 2.4, .08, 2.33);
    profile.lineTo(1.12, 1.53); profile.quadraticCurveTo(1.21, 1.46, 1.18, 1.4);
    profile.lineTo(1.06, 1.4); profile.lineTo(.035, 2.22);
    profile.quadraticCurveTo(0, 2.25, -.035, 2.22);
    profile.lineTo(-1.06, 1.4); profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile, { depth: 1.95, bevelEnabled: true,
        bevelSize: .016, bevelThickness: .016, bevelSegments: 2, curveSegments: 5, steps: 1 });
    geometry.translate(0, 0, -.975);
    const positions = geometry.attributes.position, normals = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        if (Math.abs(normals.getZ(i)) > .7) uv.setXY(i, (x + 1.22) / 2.44, (y - 1.38) / 1.04);
        else uv.setXY(i, (z + .991) / 1.982, Math.abs(x) / 1.22);
    }
    return geometry;
}

/** A shallow worn stone with a distinct outline, centered at the ground contact plane. */
export function steppingStoneGeometry(radius: number, seed: number): THREE.BufferGeometry {
    positive(radius, 'Radius');
    if (!Number.isFinite(seed)) throw new RangeError('Invalid stone seed');
    const shape = new THREE.Shape(), count = 7;
    for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const r = radius * (1 + Math.sin(i * 2.7 + seed) * .14);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .74;
        if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: true, bevelSize: .025,
        bevelThickness: .006, bevelSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, .008, 0);
    return geometry;
}
