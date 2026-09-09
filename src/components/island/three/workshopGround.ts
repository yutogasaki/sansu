import * as THREE from 'three';

/** The existing drawn sand: its triangulated upper surface, not a y=0 disk. */
export const WORKSHOP_SAND = {
    position: [0, -.2, 0] as [number, number, number],
    scale: [4.35, .24, 3.08] as [number, number, number],
    segments: 32,
};
type Triangle = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; denominator: number };
const sectors: Triangle[][] = Array.from({ length: WORKSHOP_SAND.segments }, () => []);
function sector(x: number, z: number) {
    const angle = (Math.atan2(z / WORKSHOP_SAND.scale[2], -x / WORKSHOP_SAND.scale[0]) + Math.PI * 2) % (Math.PI * 2);
    return Math.min(sectors.length - 1, Math.floor(angle / (Math.PI * 2) * sectors.length));
}
// Keep numeric triangles only. This disposable CPU geometry uses exactly the
// ellipsoid primitive's segments and the same Float32 transform as batching.
{
    const geometry = new THREE.SphereGeometry(1, WORKSHOP_SAND.segments, 12);
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...WORKSHOP_SAND.position), new THREE.Quaternion(), new THREE.Vector3(...WORKSHOP_SAND.scale)));
    const positions = geometry.attributes.position, indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
        const [a, b, c] = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, indices.getX(i + offset)));
        if (Math.min(a.y, b.y, c.y) < -.200001) continue;
        const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(denominator) < 1e-12) continue;
        sectors[sector(a.x + b.x + c.x, a.z + b.z + c.z)].push({ a, b, c, denominator });
    }
    geometry.dispose();
}

/** At most eleven triangles in the point's angular sector; no ray/mesh allocation per frame. */
export function workshopSandHeight(x: number, z: number): number | undefined {
    for (const { a, b, c, denominator } of sectors[sector(x, z)]) {
        const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
        const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
        if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return u * a.y + v * b.y + (1 - u - v) * c.y;
    }
}

const soles = new WeakMap<THREE.BufferGeometry, readonly THREE.Vector3[]>();
function soleVertices(foot: THREE.Mesh) {
    let points = soles.get(foot.geometry);
    if (!points) {
        const positions = foot.geometry.attributes.position, unique = new Map<string, THREE.Vector3>();
        for (let i = 0; i < positions.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(positions, i);
            if (point.y <= 0) unique.set(point.toArray().map(value => value.toFixed(7)).join(','), point);
        }
        points = [...unique.values()]; soles.set(foot.geometry, points);
    }
    return points;
}
export interface WorkshopFootSupport { point: THREE.Vector3; sandY: number; clearance: number }

/** Actual sole vertices include the full foot width, not just the root or toe. */
export function workshopFootSupport(foot: THREE.Mesh): WorkshopFootSupport | undefined {
    foot.updateWorldMatrix(true, false);
    const point = new THREE.Vector3(); let nearest: WorkshopFootSupport | undefined;
    for (const local of soleVertices(foot)) {
        point.copy(local).applyMatrix4(foot.matrixWorld);
        const sandY = workshopSandHeight(point.x, point.z);
        if (sandY === undefined) return undefined;
        const clearance = point.y - sandY;
        if (!nearest || clearance < nearest.clearance) nearest = { point: point.clone(), sandY, clearance };
    }
    return nearest;
}

/** Test the drawn feet's footprint plus the ordinary stride's maximum travel.
 * Only the workshop lane changes; ordinary island navigation is untouched. */
export function workshopWaitingOffset(feet: readonly THREE.Mesh[]): number | undefined {
    const point = new THREE.Vector3();
    for (const offset of [1.1, .95, .8, .65, .5]) {
        const supported = feet.every(foot => {
            foot.updateWorldMatrix(true, false);
            return soleVertices(foot).every(local => {
                point.copy(local).applyMatrix4(foot.matrixWorld);
                return [-.16, .16].every(stride => workshopSandHeight(point.x, point.z + offset + stride) !== undefined);
            });
        });
        if (supported) return offset;
    }
}
