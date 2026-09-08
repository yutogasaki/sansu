import * as THREE from 'three';

/** Look toward the source from the northeast: the resident's face and left
 * hand stay forward, while the waterwheel window retains a visible face. */
export function fitIslandWorkshopResidentCamera(camera: THREE.OrthographicCamera, workshop: THREE.Group, aspect: number, followProgress = 0) {
    workshop.updateWorldMatrix(true, true);
    const target = new THREE.Vector3(-.85, 1, .3);
    const wheel = workshop.getObjectByName('workshop-part-wheel');
    const windowNormal = wheel ? new THREE.Vector3(1, 0, 0).applyQuaternion(wheel.quaternion) : new THREE.Vector3(1, 0, 0);
    // Layout B's window faces south, opposite the handle user's face. Keep the
    // hand contact view first; once the resident watches, reveal that window.
    const follow = windowNormal.z > .5 ? THREE.MathUtils.clamp(followProgress, 0, 1) : 0;
    const offset = new THREE.Vector3(4, 5, -10).lerp(new THREE.Vector3(9, 4, 4), follow);
    camera.position.copy(workshop.localToWorld(target.clone().add(offset)));
    camera.lookAt(workshop.localToWorld(target)); camera.updateMatrixWorld(true);
    const height = Math.max(5.5, (7.5 + .8 * follow) / Math.max(.1, aspect));
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
    camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
}
