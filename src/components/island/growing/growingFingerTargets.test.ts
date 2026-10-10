import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { chooseGrowingFingerTarget, updateGrowingFingerTargets } from './growingFingerTargets';

function cameraAt(width: number, height: number, zoom = 1) {
    const camera = new T.OrthographicCamera(-12, 12, 12 * height / width, -12 * height / width, 0.1, 100);
    camera.position.set(10, 14, 16);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return camera;
}

function pad(id: string, x = 0, z = 0) {
    const holder = new T.Group(); holder.position.set(x, 0, z);
    const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    mesh.position.y = 0.2;
    mesh.userData.objectId = id;
    holder.add(mesh);
    holder.updateMatrixWorld(true);
    return { holder, mesh };
}

function projected(object: T.Object3D, camera: T.OrthographicCamera, width: number, height: number) {
    const point = object.getWorldPosition(new T.Vector3()).project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
}

function intersection(object: T.Object3D, distance = 1): T.Intersection<T.Object3D> {
    return { object, distance, point: new T.Vector3() };
}

function disposePad(item: ReturnType<typeof pad>) {
    item.mesh.geometry.dispose(); item.mesh.material.dispose();
}

describe('growing island finger targets', () => {
    it.each([390, 768, 1440])('keeps a physical 44px circle at width %i through full-island and close views', width => {
        const height = 900, ray = new T.Raycaster(), item = pad('young-tree', 1, 2);
        const centreBefore = item.mesh.getWorldPosition(new T.Vector3()).clone();
        for (const zoom of [1, 4]) {
            const camera = cameraAt(width, height, zoom);
            updateGrowingFingerTargets([item.mesh], camera, width);
            const centre = projected(item.mesh, camera, width, height);
            // Raycast the real low-segment sphere, not only its bounding box.
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const x = centre.x + Math.cos(angle) * 22, y = centre.y + Math.sin(angle) * 22;
                ray.setFromCamera(new T.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
                expect(ray.intersectObject(item.mesh)).not.toHaveLength(0);
            }
            expect(item.mesh.getWorldPosition(new T.Vector3()).distanceTo(centreBefore)).toBe(0);
            expect(item.mesh.userData).toMatchObject({ objectId: 'young-tree', placementHitOnly: true });
        }
        disposePad(item);
    });

    it('compensates for owner scale and changes size when viewport or zoom changes', () => {
        const item = pad('flower'); item.holder.scale.set(2, 3, 4);
        const camera = cameraAt(390, 900);
        updateGrowingFingerTargets([item.mesh], camera, 390);
        const scale = item.mesh.getWorldScale(new T.Vector3());
        expect(scale.x).toBeCloseTo(scale.y); expect(scale.y).toBeCloseTo(scale.z);
        const before = scale.x;
        camera.zoom = 4; camera.updateProjectionMatrix();
        updateGrowingFingerTargets([item.mesh], camera, 768);
        expect(item.mesh.getWorldScale(new T.Vector3()).x).toBeCloseTo(before / 4 * 390 / 768);
        const centreBefore = item.mesh.position.clone(), scaleBefore = item.mesh.scale.clone();
        updateGrowingFingerTargets([item.mesh], camera, 0);
        expect(item.mesh.position.equals(centreBefore)).toBe(true);
        expect(item.mesh.scale.equals(scaleBefore)).toBe(true);
        disposePad(item);
    });

    it('preserves visible friends, houses, benches and flowers over invisible overlapping targets', () => {
        const item = pad('young-tree'), camera = cameraAt(390, 900);
        updateGrowingFingerTargets([item.mesh], camera, 390);
        const invisible = intersection(item.mesh), centre = projected(item.mesh, camera, 390, 900);
        for (const data of [{ actorId: 'friend' }, { objectId: 'house' }, { objectId: 'bench' }, { objectId: 'flower' }, { budId: 'bud' }]) {
            const visible = new T.Object3D(); visible.userData = data;
            const visibleHit = intersection(visible, 2);
            expect(chooseGrowingFingerTarget([invisible, visibleHit], camera, 390, 900, centre.x, centre.y)).toBe(visibleHit);
        }
        const boat = new T.Object3D(); boat.userData.boat = 'arrival'; const boatHit = intersection(boat, 2);
        expect(chooseGrowingFingerTarget([invisible, boatHit], camera, 390, 900, centre.x, centre.y, true)).toBe(boatHit);
        expect(chooseGrowingFingerTarget([invisible, boatHit], camera, 390, 900, centre.x, centre.y, false)).toBe(invisible);
        expect(chooseGrowingFingerTarget([], camera, 390, 900, centre.x, centre.y)).toBeUndefined();
        disposePad(item);
    });

    it('chooses the closest overlapping plant centre regardless of ray depth, then stable owner ID', () => {
        const a = pad('tree-a', -0.2), b = pad('flower-b', 0.2), camera = cameraAt(390, 900);
        updateGrowingFingerTargets([a.mesh, b.mesh], camera, 390);
        const aHit = intersection(a.mesh, 1), bHit = intersection(b.mesh, 3);
        const aCentre = projected(a.mesh, camera, 390, 900), bCentre = projected(b.mesh, camera, 390, 900);
        expect(chooseGrowingFingerTarget([aHit, bHit], camera, 390, 900, bCentre.x, bCentre.y)).toBe(bHit);
        expect(chooseGrowingFingerTarget([bHit, aHit], camera, 390, 900, aCentre.x, aCentre.y)).toBe(aHit);
        const midpoint = { x: (aCentre.x + bCentre.x) / 2, y: (aCentre.y + bCentre.y) / 2 };
        for (const hits of [[aHit, bHit], [bHit, aHit]]) {
            expect(chooseGrowingFingerTarget(hits, camera, 390, 900, midpoint.x, midpoint.y)).toBe(bHit);
        }
        disposePad(a); disposePad(b);
    });
});
