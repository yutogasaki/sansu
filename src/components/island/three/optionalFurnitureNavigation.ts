import * as THREE from 'three';
import type { GroundPoint, ResidentRoute } from './navigation';

export interface OptionalFurnitureRoute extends ResidentRoute { facingYaws?: number[] }

type Circle = GroundPoint & { radius: number };
const cross = (a: GroundPoint, b: GroundPoint, c: GroundPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const edgeDistance = (p: GroundPoint, a: GroundPoint, b: GroundPoint) => {
    const dx = b.x - a.x, dz = b.z - a.z, square = dx * dx + dz * dz;
    const t = square ? THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / square, 0, 1) : 0;
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};
const bounds = (polygon: readonly GroundPoint[]) => ({ minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)),
    minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) });

/** Convex ground projection of actual visible mesh vertices, including clothes,
 * paws and the fox's long tail. No species-specific guessed body radius. */
export function optionalResidentFootprint(object: THREE.Object3D): GroundPoint[] {
    object.updateWorldMatrix(true, true);
    const points: GroundPoint[] = [], point = new THREE.Vector3();
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const attribute = child.geometry.getAttribute('position');
        for (let i = 0; i < attribute.count; i++) {
            point.fromBufferAttribute(attribute, i).applyMatrix4(child.matrixWorld); points.push({ x: point.x, z: point.z });
        }
    });
    points.sort((a, b) => a.x - b.x || a.z - b.z);
    const half = (ordered: GroundPoint[]) => {
        const hull: GroundPoint[] = [];
        for (const point of ordered) {
            while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
            hull.push(point);
        }
        hull.pop(); return hull;
    };
    return [...half(points), ...half([...points].reverse())];
}

export function optionalFootprintClearsCircle(polygon: readonly GroundPoint[], circle: Circle, margin = .015) {
    if (!polygon.length) return false;
    if (polygon.every((a, i) => cross(a, polygon[(i + 1) % polygon.length], circle) >= 0)) return false;
    return polygon.every((a, i) => edgeDistance(circle, a, polygon[(i + 1) % polygon.length]) >= circle.radius + margin);
}

export function optionalFootprintsAreSeparate(a: readonly GroundPoint[], b: readonly GroundPoint[]) {
    return [a, b].some(polygon => polygon.some((p, i) => {
        const q = polygon[(i + 1) % polygon.length], axis = { x: q.z - p.z, z: p.x - q.x };
        const project = (points: readonly GroundPoint[]) => points.map(point => point.x * axis.x + point.z * axis.z);
        const av = project(a), bv = project(b);
        return Math.max(...av) < Math.min(...bv) || Math.max(...bv) < Math.min(...av);
    }));
}

export function makeOptionalFurnitureRouteGuard(local: readonly GroundPoint[], circles: readonly Circle[], bodies: readonly GroundPoint[][], end: GroundPoint, endYaw: number) {
    const at = (point: GroundPoint, yaw: number) => local.map(p => ({ x: point.x + p.x * Math.cos(yaw) + p.z * Math.sin(yaw),
        z: point.z - p.x * Math.sin(yaw) + p.z * Math.cos(yaw) }));
    const bodyBounds = bodies.map(bounds), poseCache = new Map<string, boolean>();
    const clear = (point: GroundPoint, yaw: number) => {
        const key = `${point.x.toFixed(5)}:${point.z.toFixed(5)}:${Math.atan2(Math.sin(yaw), Math.cos(yaw)).toFixed(7)}`;
        const cached = poseCache.get(key); if (cached !== undefined) return cached;
        const polygon = at(point, yaw);
        const box = bounds(polygon);
        const result = circles.every(circle => circle.x + circle.radius + .015 < box.minX || circle.x - circle.radius - .015 > box.maxX
            || circle.z + circle.radius + .015 < box.minZ || circle.z - circle.radius - .015 > box.maxZ || optionalFootprintClearsCircle(polygon, circle))
            && bodies.every((body, i) => bodyBounds[i].maxX < box.minX || bodyBounds[i].minX > box.maxX || bodyBounds[i].maxZ < box.minZ
                || bodyBounds[i].minZ > box.maxZ || optionalFootprintsAreSeparate(polygon, body));
        poseCache.set(key, result); return result;
    };
    const cache = new Map<string, number | undefined>();
    const facing = (from: GroundPoint, to: GroundPoint) => {
        const key = `${from.x}:${from.z}:${to.x}:${to.z}`;
        if (cache.has(key)) return cache.get(key);
        const distance = Math.hypot(to.x - from.x, to.z - from.z), yaw = distance ? Math.atan2(to.x - from.x, to.z - from.z) : endYaw;
        const steps = Math.max(1, Math.ceil(distance / .06));
        const atEnd = Math.hypot(to.x - end.x, to.z - end.z) <= 1e-7;
        if (!atEnd || clear(end, endYaw)) for (const turn of [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI * .75, -Math.PI * .75]) {
            const angle = yaw + turn; let okay = true;
            for (let i = 0; i <= steps; i++) {
                const point = { x: THREE.MathUtils.lerp(from.x, to.x, i / steps), z: THREE.MathUtils.lerp(from.z, to.z, i / steps) };
                if (!clear(point, angle)) { okay = false; break; }
            }
            if (okay) { cache.set(key, angle); return angle; }
        }
        cache.set(key, undefined); return undefined;
    };
    return Object.assign((from: GroundPoint, to: GroundPoint) => facing(from, to) !== undefined, { facing });
}

/** The real feet keep stepping along travel while a long-tailed animal backs
 * away or sidesteps an obstacle. The same sampled path drives planning/render. */
export function optionalFurnitureWalkingYaw(route: OptionalFurnitureRoute, fraction: number, reduced: boolean) {
    if (!route.facingYaws) return undefined;
    const t = THREE.MathUtils.clamp(fraction, 0, 1);
    if (t >= .99) return route.yaw;
    const lengths = route.points.slice(1).map((point, i) => Math.hypot(point.x - route.points[i].x, point.z - route.points[i].z));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) * (reduced ? t < .35 ? 0 : t < .75 ? .5 : 1 : t);
    let index = 0;
    while (index < lengths.length - 1 && remaining > lengths[index]) { remaining -= lengths[index]; index++; }
    return route.facingYaws[index];
}
