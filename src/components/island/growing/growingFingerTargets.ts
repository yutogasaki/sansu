import * as T from 'three';
import { growingHitTarget } from './growingHitTarget';

// A 16-segment sphere retains a 44px target even between its silhouette vertices.
const FINGER_DIAMETER_PX = 48;

/** Resize radius-one sphere proxies in CSS pixels, without moving their owner or centre. */
export function updateGrowingFingerTargets(targets: readonly T.Mesh[], camera: T.OrthographicCamera, width: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(camera.zoom) || camera.zoom <= 0) return;
    const radius = Math.abs(camera.right - camera.left) / camera.zoom / width * FINGER_DIAMETER_PX / 2;
    const parentScale = new T.Vector3();
    for (const target of targets) {
        parentScale.set(1, 1, 1);
        target.parent?.getWorldScale(parentScale);
        target.scale.set(
            radius / (Math.abs(parentScale.x) || 1),
            radius / (Math.abs(parentScale.y) || 1),
            radius / (Math.abs(parentScale.z) || 1),
        );
        target.userData.placementHitOnly = true;
        target.updateWorldMatrix(false, false);
    }
}

function ownerId(hit: T.Intersection<T.Object3D>): string {
    const data = hit.object.userData;
    return String(data.objectId ?? data.budId ?? data.actorId ?? data.boat ?? '');
}

/** Visible actionable art wins; overlapping finger pads choose the closest screen centre. */
export function chooseGrowingFingerTarget(
    hits: readonly T.Intersection<T.Object3D>[], camera: T.OrthographicCamera,
    width: number, height: number, pointerX: number, pointerY: number, arrivalBoatVisible = true,
): T.Intersection<T.Object3D> | undefined {
    const direct = growingHitTarget(hits, arrivalBoatVisible);
    if (!direct?.object.userData.placementHitOnly) return direct;
    if (![width, height, pointerX, pointerY].every(Number.isFinite) || width <= 0 || height <= 0) return direct;
    const centre = new T.Vector3();
    let nearest: T.Intersection<T.Object3D> | undefined;
    let nearestDistance = Infinity;
    for (const hit of hits) {
        if (!hit.object.userData.placementHitOnly || !growingHitTarget([hit], arrivalBoatVisible)) continue;
        hit.object.getWorldPosition(centre).project(camera);
        const distance = ((centre.x + 1) * width / 2 - pointerX) ** 2
            + ((1 - centre.y) * height / 2 - pointerY) ** 2;
        if (!Number.isFinite(distance)) continue;
        if (distance < nearestDistance - 1e-8
            || Math.abs(distance - nearestDistance) <= 1e-8 && (!nearest || ownerId(hit) < ownerId(nearest))) {
            nearest = hit;
            nearestDistance = distance;
        }
    }
    return nearest ?? direct;
}
