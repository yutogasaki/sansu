import * as THREE from 'three';
import type { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';

export const ISLAND_HOME_CAMERA_CANDIDATE = 'island-home-interior-v3';
export const ISLAND_HOME_CAMERA_POSITION = [0, 3, 4.62] as const;
const livingNames = ['home-reading-seat', 'home-coffee-table', 'home-album', 'home-notice-board', 'home-plant-pot', 'home-window-frame'];
const corners = (bounds: THREE.Box3) => [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
    [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));

/** A camera INSIDE the existing house footprint. Orthographic island framing
 * and the exterior model are untouched; only this camera sees the closed room. */
export function fitIslandHomeInteriorCamera(camera: THREE.PerspectiveCamera, room: IslandLearningKeepsakeScenery, aspect: number): boolean {
    if (!room.group.visible || !Number.isFinite(aspect) || aspect <= 0) return false;
    room.group.updateWorldMatrix(true, true);
    const scale = room.group.getWorldScale(new THREE.Vector3()).x, selected = room.selectedObject();
    let position = new THREE.Vector3(...ISLAND_HOME_CAMERA_POSITION), target = new THREE.Vector3(0, 1.40, 1.10);
    let subjects: THREE.Object3D[];
    if (selected) {
        const bounds = new THREE.Box3().setFromPoints(corners(new THREE.Box3().setFromObject(selected, true)).map(point => room.group.worldToLocal(point)));
        target = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3()), distance = Math.max(1.05, Math.max(size.y, size.x / aspect) * .6 / Math.tan(Math.PI / 8));
        position = target.clone().add(new THREE.Vector3(0, .04, distance + size.z / 2));
        subjects = [selected];
    } else {
        subjects = livingNames.map(name => room.group.getObjectByName(name)).filter((object): object is THREE.Object3D => Boolean(object));
        // Include the complete finite display area even while the child has no awards.
        subjects.push(...room.group.children.filter(object => object.name.startsWith('keepsake-') && object.userData.keepsakeId));
    }
    camera.position.copy(room.group.localToWorld(position)); camera.up.set(0, 1, 0).applyQuaternion(room.group.getWorldQuaternion(new THREE.Quaternion()));
    camera.lookAt(room.group.localToWorld(target)); camera.updateMatrixWorld(true);
    let tangent = selected ? Math.tan(Math.PI / 8) : Math.tan(39 * Math.PI / 180);
    for (const object of subjects) for (const point of corners(new THREE.Box3().setFromObject(object, true))) {
        point.applyMatrix4(camera.matrixWorldInverse);
        if (point.z >= -.01 * scale) return false;
        tangent = Math.max(tangent, Math.abs(point.y) / -point.z * 1.06, Math.abs(point.x) / -point.z / aspect * 1.06);
    }
    camera.fov = 2 * Math.atan(tangent) * 180 / Math.PI;
    camera.aspect = aspect; camera.near = .01; camera.far = Math.max(10, scale * 20); camera.zoom = 1;
    camera.updateProjectionMatrix();
    return true;
}
