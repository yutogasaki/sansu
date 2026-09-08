import * as THREE from 'three';
import { boxCorners } from './sceneFraming';

/** Read-only outfit view of the actual resident. Face the current body without
 * changing the actor, and keep one generous scale across its optional clothes. */
export function fitIslandResidentPortraitCamera(camera: THREE.OrthographicCamera, resident: THREE.Group, aspect: number) {
    resident.updateWorldMatrix(true, true);
    const position = resident.getWorldPosition(new THREE.Vector3());
    const forward = resident.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
    const target = position.clone().add(new THREE.Vector3(0, .85, 0));
    camera.position.copy(target).addScaledVector(forward, 4).add(new THREE.Vector3(0, 2.2, 0));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(resident, true);
    const projected = new THREE.Box3().setFromPoints(boxCorners(bounds).map(point => point.applyMatrix4(camera.matrixWorldInverse)));
    // A recently standing actor can be offset above the fixed focus. Extent
    // alone would fit its size while still clipping a cap above the viewport.
    const halfHeight = Math.max(Math.abs(projected.min.y), Math.abs(projected.max.y));
    const halfWidth = Math.max(Math.abs(projected.min.x), Math.abs(projected.max.x));
    // The shared minimum contains the tallest default fox cap as well as the
    // original rig, so changing clothes does not change apparent body size.
    const height = Math.max(3.4, 3.4 / aspect, halfHeight * 2 / .85, halfWidth * 2 / (aspect * .85));
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
}
