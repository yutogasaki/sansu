import * as THREE from 'three';
import { boxCorners } from './sceneFraming';
import type { ResidentRoute } from './navigation';

/** The transported object's actual bounds are swept separately from the feet.
 * Source/destination tabletops may be passed above while lifted; callers keep
 * those tables in the ordinary foot route and exclude only them here. */
export function sharedCarryRouteIsClear(route: ResidentRoute, bounds: THREE.Box3, root: THREE.Vector3, yaw: number,
    obstacles: readonly { x: number; z: number; radius: number }[], onBlocked?: (collision: { root: { x: number; z: number }; obstacle: { x: number; z: number; radius: number }; bounds: number[][] }) => void) {
    if (route.points.length < 2 || bounds.isEmpty()) return false;
    const local = boxCorners(bounds).map(point => point.sub(root).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw));
    const safe = (point: { x: number; z: number }, heading: number) => {
        const box = new THREE.Box3().setFromPoints(local.map(corner => corner.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), heading)
            .add(new THREE.Vector3(point.x, 0, point.z))));
        return obstacles.every(obstacle => {
            const x = THREE.MathUtils.clamp(obstacle.x, box.min.x, box.max.x), z = THREE.MathUtils.clamp(obstacle.z, box.min.z, box.max.z);
            const clear = Math.hypot(obstacle.x - x, obstacle.z - z) >= obstacle.radius + .025;
            if (!clear) onBlocked?.({ root: point, obstacle, bounds: [box.min.toArray(), box.max.toArray()] });
            return clear;
        });
    };
    const total = route.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - route.points[index].x, point.z - route.points[index].z), 0);
    const delta = Math.atan2(Math.sin(route.yaw - yaw), Math.cos(route.yaw - yaw));
    let travelled = 0;
    for (let index = 1; index < route.points.length; index++) {
        const a = route.points[index - 1], b = route.points[index], length = Math.hypot(b.x - a.x, b.z - a.z);
        const samples = Math.max(1, Math.ceil(length / .04));
        for (let n = 0; n <= samples; n++) {
            const fraction = total ? (travelled + length * n / samples) / total : 1;
            const heading = yaw + delta * fraction * fraction * (3 - 2 * fraction);
            if (!safe({ x: THREE.MathUtils.lerp(a.x, b.x, n / samples), z: THREE.MathUtils.lerp(a.z, b.z, n / samples) }, heading)) return false;
        }
        travelled += length;
    }
    return true;
}
