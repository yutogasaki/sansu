import * as THREE from 'three';
import { fitLearningFrame } from './sceneFraming';
import { fitSharedDisplayCamera, sharedDisplayCameraDiagnostic, type SharedDisplayFrameScene } from './sharedDisplayFraming';

export const OPTIONAL_FURNITURE_VIEW_ANGLES = [-70, -40, -20, 0, 20, 40, 70].map(degrees => degrees * Math.PI / 180 - Math.atan2(3, 6));

interface OptionalFurnitureFrameOptions { key: string; scene: SharedDisplayFrameScene; model?: THREE.Object3D; present?: (inspect: () => void) => void }
const frames = new WeakMap<THREE.Camera, { key: string; position: THREE.Vector3; quaternion: THREE.Quaternion;
    left: number; right: number; top: number; bottom: number; diagnostic: ReturnType<typeof sharedDisplayCameraDiagnostic> }>();
export function optionalFurnitureCameraDiagnostic(camera: THREE.Camera) { return frames.get(camera)?.diagnostic; }

/** A quaternion restore may represent a half turn as Euler (PI, 0, PI).
 * The actual forward direction, including its parent, remains unchanged. */
export function optionalFurnitureForwardYaw(model: THREE.Object3D) {
    model.updateWorldMatrix(true, false);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(model.matrixWorld);
    return Math.atan2(forward.x, forward.z);
}

function furnitureSubjects(model: THREE.Object3D | undefined, subjects: SharedDisplayFrameScene['subjects']) {
    const cup = model?.getObjectByName('optional-tea-cup'), table = model?.getObjectByName('furniture-static');
    // A visible back or head must not compensate for the same cup or table
    // being hidden. Keep actual contact meshes in the live occluder set.
    return cup && table ? [cup, table, ...subjects] : subjects;
}

/** The complete real tool, faces, hands and supports share one close camera. */
export function fitOptionalFurnitureCamera(camera: THREE.OrthographicCamera, bounds: THREE.Box3, aspect: number, rotation: number, options?: OptionalFurnitureFrameOptions) {
    if (options) {
        const yaw = options.model ? optionalFurnitureForwardYaw(options.model) : rotation;
        const key = `${options.key}:${aspect}:${yaw}`, previous = frames.get(camera);
        if (!previous || previous.key !== key) {
            const inspect = () => fitSharedDisplayCamera(camera, bounds, aspect, yaw,
                { ...options.scene, subjects: furnitureSubjects(options.model, options.scene.subjects) });
            if (options.present) options.present(inspect); else inspect();
            frames.set(camera, { key, position: camera.position.clone(), quaternion: camera.quaternion.clone(), left: camera.left, right: camera.right,
                top: camera.top, bottom: camera.bottom, diagnostic: sharedDisplayCameraDiagnostic(camera) });
        } else {
            camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion);
            camera.left = previous.left; camera.right = previous.right; camera.top = previous.top; camera.bottom = previous.bottom;
            camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
        }
        return true;
    }
    frames.delete(camera);
    const target = bounds.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-3.8, 3.4, 6).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    camera.position.copy(target).add(offset); camera.lookAt(target); camera.updateMatrixWorld(true);
    return fitLearningFrame(camera, [bounds], aspect, 1.9);
}
