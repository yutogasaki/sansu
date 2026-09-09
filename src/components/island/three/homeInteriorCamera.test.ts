import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_LEARNING_KEEPSAKES, type IslandLearningKeepsakesState } from '../../../domain/island/learningKeepsakes';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { fitIslandHomeInteriorCamera } from './homeInteriorCamera';
import { ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandCosmeticScenery } from './cosmeticScenery';

const all: IslandLearningKeepsakesState = { version: 1, displayed: ISLAND_LEARNING_KEEPSAKES.map(item => item.id) };
const active = (object: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
    return true;
};
const belongs = (object: THREE.Object3D, target: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === target) return true;
    return false;
};
function vertices(object: THREE.Object3D) {
    object.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
    object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const positions = child.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) points.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld));
    });
    return points;
}
function roomAt(inHouse: boolean) {
    const room = new IslandLearningKeepsakeScenery();
    if (inHouse) { room.group.position.set(...ISLAND_HOME_INTERIOR.position); room.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale); }
    room.update(all, 1000, true); room.group.updateWorldMatrix(true, true); return room;
}
function fit(room: IslandLearningKeepsakeScenery, aspect: number) {
    const camera = new THREE.PerspectiveCamera(); expect(fitIslandHomeInteriorCamera(camera, room, aspect)).toBe(true); return camera;
}
function checkEnclosure(room: IslandLearningKeepsakeScenery, camera: THREE.PerspectiveCamera, detailed = false) {
    const steps = detailed ? 8 : 2;
    for (let x = 0; x <= steps; x++) for (let y = 0; y <= steps; y++) {
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / steps * 2 - 1, y / steps * 2 - 1), camera);
        ray.near = camera.near; ray.far = camera.far;
        expect(ray.intersectObject(room.group, true).some(hit => active(hit.object)), `open exterior ray ${x}/${y}`).toBe(true);
    }
}
function checkVisible(room: IslandLearningKeepsakeScenery, camera: THREE.Camera, object: THREE.Object3D, points: THREE.Vector3[]) {
    for (const point of points) {
        const ndc = point.clone().project(camera);
        expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), object.name + '/crop/' + point.toArray()).toBeLessThan(.98);
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const blocker = ray.intersectObject(room.group, true).find(hit => active(hit.object) && !belongs(hit.object, object));
        expect(!blocker || blocker.distance >= ray.ray.origin.distanceTo(point) - .003 * room.group.scale.x,
            object.name + '/blocked-by/' + blocker?.object.name).toBe(true);
    }
}

describe('a perspective camera inside the same closed house', () => {
    it.each([390 / 295, 768 / 380, 1024 / 380])('keeps both additional challenge awards visible at aspect %s', aspect => {
        const room = roomAt(true);
        try {
            room.update(all, 1000, true, undefined, ['certificate', 'trophy']);
            const camera = fit(room, aspect);
            for (const id of ['certificate', 'trophy']) {
                const award = room.group.getObjectByName(`challenge-${id}`)!;
                const bounds = new THREE.Box3().setFromObject(award);
                checkVisible(room, camera, award, [bounds.getCenter(new THREE.Vector3())]);
                for (const point of vertices(award)) {
                    const ndc = point.project(camera);
                    expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y))).toBeLessThan(.98);
                }
            }
        } finally { room.dispose(); }
    });

    it.each([390 / 295, 768 / 380])('places the real room floor above the unchanged exterior foundation at aspect %s', aspect => {
        const world = new IslandCosmeticScenery(), room = roomAt(true), scene = new THREE.Scene();
        scene.add(world.group, room.group);
        const floor = room.group.getObjectByName('keepsake-room-floor')!;
        const samples = [[-2, 3.8], [2.5, 3.8], [0, 4.1]];
        const firstSurfaces = () => {
            scene.updateMatrixWorld(true); const camera = fit(room, aspect);
            return samples.map(([x, z]) => {
                const point = room.group.localToWorld(new THREE.Vector3(x, -.005, z));
                const ray = new THREE.Raycaster(camera.position, point.sub(camera.position).normalize());
                return ray.intersectObject(scene, true).find(hit => active(hit.object))!;
            });
        };
        try {
            // Reproduce the former floor error using the actual, still-visible
            // cottage foundation, rather than a synthetic shadow or blocker.
            room.group.position.y = .13;
            const old = firstSurfaces();
            expect(old.every(hit => belongs(hit.object, world.group))).toBe(true);
            old.forEach(hit => expect(hit.point.y).toBeCloseTo(.16, 5));
            room.group.position.set(...ISLAND_HOME_INTERIOR.position);
            const current = firstSurfaces();
            expect(current.every(hit => hit.object === floor)).toBe(true);
            expect((floor as THREE.Mesh).receiveShadow).toBe(false);
            expect(world.scenery.visible).toBe(true);
        } finally { room.dispose(); world.dispose(); }
    });

    it.each([false, true].flatMap(inHouse => [[390, 295], [768, 380]].map(([width, height]) => ({ inHouse, width, height }))))(
        'encloses the viewport, shows living objects and all sixteen awards at $width×$height, actual cottage=$inHouse', ({ width, height, inHouse }) => {
        const room = roomAt(inHouse), original = structuredClone(all);
        try {
            const camera = fit(room, width / height), frame = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
            const local = room.group.worldToLocal(camera.position.clone());
            expect(local.x).toBeGreaterThan(-3.30); expect(local.x).toBeLessThan(3.30);
            expect(local.y).toBeGreaterThan(0); expect(local.y).toBeLessThan(4.07); expect(local.z).toBeLessThan(4.77);
            expect(camera.near).toBe(.01); expect(camera.fov).toBeLessThan(100); checkEnclosure(room, camera, true);
            for (const name of ['home-reading-seat', 'home-coffee-table', 'home-album', 'home-notice-board', 'home-window-glass']) {
                const object = room.group.getObjectByName(name)!;
                // Use actual front/top visible points, not the hidden back face of a solid object.
                const points = vertices(object), center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
                const sample = points.reduce((best, point) => point.distanceTo(camera.position) < best.distanceTo(camera.position) ? point : best, points[0]);
                const ndc = center.project(camera); expect(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), name).toBeLessThan(.95);
                checkVisible(room, camera, object, [sample]);
            }
            for (const entry of ISLAND_LEARNING_KEEPSAKES) {
                const award = room.group.getObjectByName('keepsake-' + entry.id)!, uuid = award.uuid;
                const front = room.group.localToWorld(new THREE.Vector3(0, 0, 1)).sub(room.group.localToWorld(new THREE.Vector3()));
                const center = new THREE.Box3().setFromObject(award, true).getCenter(new THREE.Vector3());
                const samples = entry.slot === 'certificate'
                    ? [-.08, 0, .08].flatMap(x => [-.1, 0, .1].map(y => award.getObjectByName('keepsake-certificate-paper')!.localToWorld(new THREE.Vector3(x, y, 0))))
                    : vertices(award).filter(point => point.clone().sub(center).dot(front) > .005 * room.group.scale.x);
                checkVisible(room, camera, award, samples);
                room.update(all, 1000, true, entry.id); const close = fit(room, width / height);
                checkVisible(room, close, award, samples); checkEnclosure(room, close);
                const cameraLocal = room.group.worldToLocal(close.position.clone());
                expect(cameraLocal.z).toBeGreaterThan(.425); expect(cameraLocal.z).toBeLessThan(4.77);
                expect(cameraLocal.y).toBeGreaterThan(0); expect(cameraLocal.y).toBeLessThan(4.07);
                expect(room.selectedObject()?.uuid).toBe(uuid);
                room.update(all, 1000, true); const restored = fit(room, width / height);
                expect([...restored.matrixWorld.elements, ...restored.projectionMatrix.elements]).toEqual(frame);
            }
            expect(all).toEqual(original);
        } finally { room.dispose(); }
    });

    it('uses the first visible real mesh for an award, album and notice, with no tap through walls or furniture', () => {
        const room = roomAt(true);
        try {
            const camera = fit(room, 390 / 295);
            const cast = (point: THREE.Vector3) => new THREE.Ray(camera.position.clone(), point.clone().sub(camera.position).normalize());
            const album = room.group.getObjectByName('home-album')!;
            const albumPoint = album.localToWorld(new THREE.Vector3(0, .035, 0));
            expect(room.selectHit(cast(albumPoint))).toEqual({ type: 'album' });
            const notice = room.group.getObjectByName('home-notice-paper')!;
            const noticePoint = notice.localToWorld(new THREE.Vector3(.007, 0, 0));
            expect(room.selectHit(cast(noticePoint))).toEqual({ type: 'notices' });
            const award = room.group.getObjectByName('keepsake-first-completion')!;
            const paper = award.getObjectByName('keepsake-certificate-paper')!;
            const point = paper.localToWorld(new THREE.Vector3());
            expect(room.selectHit(cast(point))).toEqual({ type: 'keepsake', id: 'first-completion' });
            const blocker = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .08), new THREE.MeshBasicMaterial());
            blocker.position.copy(room.group.worldToLocal(point.clone().lerp(camera.position, .3))); room.group.add(blocker);
            expect(room.selectHit(cast(point))).toBeUndefined(); blocker.visible = false;
            expect(room.selectHit(cast(point))).toEqual({ type: 'keepsake', id: 'first-completion' });
            blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose();
            const wall = room.group.localToWorld(new THREE.Vector3(0, 2.4, 5)); expect(room.selectHit(cast(wall))).toBeUndefined();
            room.update({ version: 1, displayed: [] }, 1000, true); expect(room.selectHit(cast(point))).toBeUndefined();
            room.update(undefined, 0, false); expect(room.selectHit(cast(albumPoint))).toBeUndefined();
        } finally { room.dispose(); }
    });

    it('keeps overview framing independent of qualifications and refuses an inactive room without changing the camera', () => {
        const room = roomAt(false);
        try {
            const camera = fit(room, 390 / 295), original = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
            room.update(undefined, 0, true); expect(fitIslandHomeInteriorCamera(camera, room, 390 / 295)).toBe(true);
            expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(original); checkEnclosure(room, camera);
            room.update(all, 1, true, 'completed-1000'); expect(room.selectedObject()).toBeUndefined();
            expect(fitIslandHomeInteriorCamera(camera, room, 390 / 295)).toBe(true); expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(original);
            room.update(undefined, 0, false); expect(fitIslandHomeInteriorCamera(camera, room, 390 / 295)).toBe(false);
            expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(original);
        } finally { room.dispose(); }
    });
});
