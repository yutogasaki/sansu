import * as T from 'three';
import type { SceneLayout } from './sceneLayout';

export interface CameraView { zoom: number; azimuth: number; pan: { x: number; z: number } }
export const initialView = (): CameraView => ({ zoom: 1, azimuth: 0, pan: { x: 0, z: 0 } });
const BASE = new T.Vector3(4.5, 7.8, 11);

/** Fits the whole island in portrait and landscape; zoom and pan stay within the island. */
export function frameCamera(camera: T.OrthographicCamera, layout: SceneLayout, view: CameraView, aspect: number) {
    const halfWidth = (layout.width + 2.2) / 2, halfHeight = (layout.depth + 4.2) / 2 * .82;
    const offset = BASE.clone().applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    let fit = Math.max(halfHeight, halfWidth / aspect);
    if (layout.width + layout.depth > 26) {
        const forward = offset.clone().normalize(), right = new T.Vector3(forward.z, 0, -forward.x).normalize();
        const up = new T.Vector3().crossVectors(forward, right);
        fit = Math.max(fit, (Math.abs(right.x) * halfWidth + Math.abs(right.z) * (layout.depth + 4.2) / 2) / aspect,
            Math.abs(up.x) * halfWidth + Math.abs(up.z) * (layout.depth + 4.2) / 2 + 2);
    }
    const half = fit / view.zoom;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.far = Math.max(100, (layout.width + layout.depth) * 2);
    const limitX = layout.width / 2, limitZ = layout.depth / 2 + 1;
    view.pan.x = Math.max(-limitX, Math.min(limitX, view.pan.x));
    view.pan.z = Math.max(-limitZ, Math.min(limitZ, view.pan.z));
    const target = new T.Vector3(view.pan.x, .2, (layout.depth - 5) / 2 + .6 + view.pan.z);
    offset.multiplyScalar(Math.max(1, (layout.width + layout.depth) / 30));
    camera.position.copy(target).add(offset); camera.lookAt(target);
    camera.updateProjectionMatrix();
    return target;
}

/** Converts a screen drag into a ground-plane pan that follows the finger. */
export function panFromDrag(camera: T.OrthographicCamera, view: CameraView, dx: number, dy: number, width: number, height: number) {
    const worldPerPixel = (camera.right - camera.left) / width;
    const right = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    const forward = new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), view.azimuth);
    view.pan.x -= (right.x * dx + forward.x * dy * 1.35) * worldPerPixel;
    view.pan.z -= (right.z * dx + forward.z * dy * 1.35) * worldPerPixel;
    void height;
}
