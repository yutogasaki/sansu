import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitNatureObservationCamera, inspectCurrentLeafBirdObservation } from './natureObservationFrame';
import { boxCorners } from './sceneFraming';
import { IslandNatureVisuals } from './natureVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { createIsland } from '../../../domain/island/catalog';
import { IslandResident } from './animals';
import type { IslandStageItem } from './types';

function butterflyScene(reduced: boolean, kind: 'butterfly' | 'ribbon-butterfly' = 'ribbon-butterfly') {
    const materials = new IslandMaterials(), nature = new IslandNatureVisuals(materials), world = new IslandCosmeticScenery();
    const flower: IslandStageItem = { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0, growthLevel: 2 };
    const bench: IslandStageItem = { id: 'living-bench', kind: 'bench', position: { x: -.1, z: 1 }, rotation: 1.6951513213416582, growthLevel: 2 };
    const lamp: IslandStageItem = { id: 'starter-lantern', kind: 'lantern', position: { x: -1, z: .25 }, rotation: 0, growthLevel: 0 };
    const models = [flower, bench, lamp].map(item => {
        const group = makeFurniture(item.kind, materials); group.position.set(item.position!.x, 0, item.position!.z); group.rotation.y = item.rotation;
        applyFurnitureGrowth(group, item, materials); return group;
    });
    const residents = [new IslandResident('otter', materials, [.1, 0, 1.6], () => {}), new IslandResident('rabbit', materials, [2.45, 0, 1.45], () => {})];
    residents[0].visit(bench, 0, true, [flower, bench, lamp], 0, { points: [{ x: .1, z: 1.6 }, { x: -.1, z: 1 }], yaw: bench.rotation });
    const island = createIsland('qualified-03-butterfly', 1);
    world.updateGrowth({ ...island, items: [flower, bench, lamp], completedSets: 4, learning: false, pulse: 0,
        growth: { ...island.growth!, progress: { garden: 3, waterside: 0, grove: 0, village: 0 } } });
    const scene = new THREE.Scene(); scene.add(world.group, ...models, ...residents.map(resident => resident.group), nature.group);
    const host = models[0]; nature.update(kind, host, 0, reduced); scene.updateMatrixWorld(true);
    const occluders = [world.group, ...models.slice(1), ...residents.map(resident => resident.group)];
    return { host, nature, scene, residents, occluders, dispose() {
        nature.dispose(); world.dispose(); models.forEach(disposeGeometry);
        residents.forEach(resident => { resident.disposeAppearance(); disposeGeometry(resident.group); }); materials.dispose();
    } };
}

function actualWingOverlaps(camera: THREE.OrthographicCamera, visitor: THREE.Object3D, residents: THREE.Object3D[]) {
    const ray = new THREE.Raycaster(), points: THREE.Vector3[] = [];
    visitor.traverseVisible(object => {
        if (object instanceof THREE.Mesh) points.push(object.getWorldPosition(new THREE.Vector3()));
    });
    return points.filter(point => {
        const ndc = point.project(camera); ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        return ray.intersectObjects(residents, true).some(hit => {
            for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
            return true;
        });
    }).length;
}

function visibleFeature(camera: THREE.OrthographicCamera, bird: THREE.Object3D, name: string, physical: THREE.Object3D[]) {
    const feature = bird.getObjectByName(name)!;
    const point = feature.getWorldPosition(new THREE.Vector3()).project(camera), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(point.x, point.y), camera);
    const hit = ray.intersectObjects(physical, true).find(hit => {
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
        return true;
    });
    return hit?.object === feature;
}

function leafBirdScene(rotation = -Math.PI * 3 / 4) {
    const materials = new IslandMaterials(), nature = new IslandNatureVisuals(materials), world = new IslandCosmeticScenery();
    const host = makeFurniture('mushroom', materials), lamp = makeFurniture('lantern', materials);
    const island = createIsland('leaf-bird-frame', 1);
    host.position.set(-5.8, 0, 1.3); host.rotation.y = rotation;
    lamp.position.set(-6.9, 0, .2);
    applyFurnitureGrowth(host, { id: 'living-mushroom', kind: 'mushroom', rotation, growthLevel: 2 }, materials);
    applyFurnitureGrowth(lamp, { id: 'living-grove-lantern', kind: 'lantern', rotation: 0, growthLevel: 2 }, materials);
    world.updateGrowth({ ...island, items: [], completedSets: 31, learning: false, pulse: 0,
        growth: { ...island.growth!, expansionLevel: 2, progress: { garden: 6, waterside: 6, grove: 3, village: 0 } } });
    nature.update('leaf-bird', host, 1400, false);
    const bird = nature.activeObject!;
    const scene = new THREE.Scene(); scene.add(host, lamp, world.group, nature.group); scene.updateMatrixWorld(true);
    return { host, bird, nature, scene, occluders: [world.group, lamp], dispose() {
        nature.dispose(); world.dispose(); disposeGeometry(host); disposeGeometry(lamp); materials.dispose();
    } };
}

describe('explicit nature observation framing', () => {
    it.each([false, true])('rejects qualified-03/06 saved phone cameras and a visible but subpixel frontal face (reduced=%s)', reduced => {
        const { host, bird, nature, scene, occluders, dispose } = leafBirdScene();
        const viewport = { width: 390, height: 386 }, camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
        try {
            nature.update('leaf-bird', host, 1400, reduced); scene.updateMatrixWorld(true);
            // Actual saved cameras, not regenerated candidates. 06 changed
            // direction but its 1.8×2.2px eye still could not read as a face.
            for (const [matrix, scale] of [
                [[.79416, 0, -.60771, 0, -.34996, .81754, -.45733, 0, .49683, .57587, .64926, 0, 3, 10.9075, 12.8, 1], [.45374, .45844]],
                [[-.37593, 0, .92665, 0, .60014, .76194, .24347, 0, -.70605, .64765, -.28643, 0, -20.62638, 14.3075, -4.71485, 1], [.45919, .46395]],
            ] as const) {
                camera.matrixWorld.fromArray([...matrix]); camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale); camera.updateMatrixWorld(true);
                camera.left = -1 / scale[0]; camera.right = 1 / scale[0]; camera.top = 1 / scale[1]; camera.bottom = -1 / scale[1]; camera.updateProjectionMatrix();
                const result = inspectCurrentLeafBirdObservation(camera, bird, [scene], viewport);
                expect(result.readable).toBe(false); expect(result.eyePixels.every(eye => Math.min(eye.width, eye.height) < 3)).toBe(true);
            }
            const frame = fitNatureObservationCamera(camera, host, undefined, bird, 390 / 386, 1, nature.observationPoints, [], occluders, { residents: [], viewport });
            expect(frame.visitorIdentity?.readable).toBe(true);
            const large = inspectCurrentLeafBirdObservation(camera, bird, [scene], viewport);
            expect(large.frontDot).toBeGreaterThanOrEqual(.85); expect(large.elevation).toBeLessThanOrEqual(30);
            expect(large.beakPixels.visibleArea).toBeGreaterThanOrEqual(24);
            // Isolate pixel size from direction: the very same front view,
            // widened to 06's scale, must fail even without an occluder.
            camera.left = -1 / .45919; camera.right = 1 / .45919; camera.top = 1 / .46395; camera.bottom = -1 / .46395; camera.updateProjectionMatrix();
            expect(inspectCurrentLeafBirdObservation(camera, bird, [host], viewport)).toMatchObject({ readable: false, reason: 'face-too-small' });
            expect(inspectCurrentLeafBirdObservation(camera, bird, [host], { width: 1, height: 1 })).toMatchObject({ readable: false, reason: 'unknown-viewport' });
        } finally { dispose(); }
    });
    for (const kind of ['butterfly', 'ribbon-butterfly'] as const) for (const aspect of [390 / 386, 768 / 470]) for (const reduced of [false, true]) {
        it(`separates ${kind} in the actual qualified-03 layout from the unchanged rabbit throughout its flight (${aspect}/${reduced})`, () => {
            const fixture = butterflyScene(reduced, kind), { host, nature, scene, residents, occluders } = fixture;
            try {
                const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100), visitor = nature.activeObject!;
                const bodies = residents.map(resident => resident.group), before = bodies.map(body => body.matrixWorld.toArray());
                // The saved camera in qualified-03 puts the wings on the
                // rabbit's chest despite an unobstructed centre-point ray.
                camera.matrixWorld.fromArray([-.47059, 0, .88235, 0, .53599, .79436, .28586, 0, -.70090, .60745, -.37382, 0, -13.57375, 13.77178, -7.18074, 1]);
                camera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale); camera.updateMatrixWorld(true);
                nature.faceCamera(camera); expect(actualWingOverlaps(camera, visitor, [bodies[1]])).toBeGreaterThan(0);
                const frame = fitNatureObservationCamera(camera, host, undefined, visitor, aspect, -1, nature.observationPoints, [], occluders,
                    { residents: bodies, butterfly: nature.observationProjection(host, reduced) });
                expect(frame.visitorIdentity).toMatchObject({ candidate: 'butterfly-silhouette-observation-v1', readable: true, reason: null, residentClear: [1, 1, 1] });
                const matrix = camera.matrixWorld.toArray(), projection = camera.projectionMatrix.toArray(), uuid = visitor.uuid;
                for (let elapsed = 0; elapsed <= 4200; elapsed += 1000 / 30) {
                    nature.update(kind, host, elapsed, reduced); nature.faceCamera(camera); scene.updateMatrixWorld(true);
                    expect(actualWingOverlaps(camera, visitor, bodies), `actual wing silhouettes at ${elapsed}`).toBe(0);
                    for (const object of [host, visitor]) for (const point of boxCorners(new THREE.Box3().setFromObject(object))) {
                        point.project(camera); expect(Math.abs(point.x)).toBeLessThan(.92); expect(Math.abs(point.y)).toBeLessThan(.92);
                    }
                    expect(visitor.uuid).toBe(uuid); expect(bodies.map(body => body.matrixWorld.toArray())).toEqual(before);
                    expect(camera.matrixWorld.toArray()).toEqual(matrix); expect(camera.projectionMatrix.toArray()).toEqual(projection);
                }
            } finally { fixture.dispose(); }
        });
    }
    it('holds a butterfly covered in every candidate and recovers without moving its host or residents', () => {
        const fixture = butterflyScene(false), { host, nature, scene, residents, occluders } = fixture;
        const cover = new THREE.Mesh(new THREE.SphereGeometry(.65, 16, 12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        cover.position.copy(host.position).add(new THREE.Vector3(-.16, 1.42, -.1)); scene.add(cover); scene.updateMatrixWorld(true);
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100), bodies = residents.map(resident => resident.group);
        const before = [host, ...bodies].map(object => ({ uuid: object.uuid, pose: object.matrixWorld.toArray() }));
        const fit = () => fitNatureObservationCamera(camera, host, undefined, nature.activeObject, 390 / 386, -1, nature.observationPoints, [], [...occluders, cover],
            { residents: bodies, butterfly: nature.observationProjection(host, false) });
        try {
            expect(fit().visitorIdentity).toMatchObject({ readable: false, reason: 'foreground-occlusion' });
            cover.visible = false;
            expect(fit().visitorIdentity).toMatchObject({ readable: true, reason: null });
            expect([host, ...bodies].map(object => ({ uuid: object.uuid, pose: object.matrixWorld.toArray() }))).toEqual(before);
        } finally { cover.removeFromParent(); disposeGeometry(cover); cover.material.dispose(); fixture.dispose(); }
    });
    it.each([false, true])('shows the actual eyes and beak at the rotated mushroom from qualified-03/06 without moving any model (reduced=%s)', reduced => {
        const fixture = leafBirdScene(), { host, bird, scene, nature, occluders } = fixture;
        try {
            for (const aspect of [390 / 386, 768 / 420]) {
                nature.update('leaf-bird', host, 0, reduced); scene.updateMatrixWorld(true);
                const before = new Map<string, { matrix: number[]; geometry?: string }>();
                scene.traverse(object => before.set(object.uuid, { matrix: object.matrixWorld.toArray(),
                    ...(object instanceof THREE.Mesh ? { geometry: object.geometry.uuid } : {}) }));
                const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
                const viewport = { width: aspect < 1.1 ? 390 : 768, height: aspect < 1.1 ? 386 : 420 };
                const frame = fitNatureObservationCamera(camera, host, undefined, bird, aspect, 1, nature.observationPoints, [], occluders, { residents: [], viewport });
                expect(frame.visibleTargets).toBe(frame.totalTargets);
                expect(frame.visitorIdentity).toMatchObject({ candidate: 'leaf-bird-face-observation-v2', readable: true });
                scene.traverse(object => expect({ matrix: object.matrixWorld.toArray(),
                    ...(object instanceof THREE.Mesh ? { geometry: object.geometry.uuid } : {}) }).toEqual(before.get(object.uuid)));
                // The runtime frames at arrival, then retains that camera as
                // the same bird lands. Check the actual first-observation
                // pose as well as the initially raised position.
                for (const elapsed of [0, 400, 1400, 4200]) {
                    nature.update('leaf-bird', host, elapsed, reduced); scene.updateMatrixWorld(true);
                    expect(visibleFeature(camera, bird, 'leaf-bird-beak', [scene]), `beak ${aspect}/${elapsed}`).toBe(true);
                    expect(['left', 'right'].some(side => visibleFeature(camera, bird, `leaf-bird-eye-${side}`, [scene])), `eye ${aspect}/${elapsed}`).toBe(true);
                    expect(inspectCurrentLeafBirdObservation(camera, bird, [scene], viewport).readable, `final pixels ${aspect}/${elapsed}`).toBe(true);
                    for (const object of [host, bird]) for (const point of boxCorners(new THREE.Box3().setFromObject(object))) {
                        point.project(camera); expect(Math.abs(point.x)).toBeLessThan(.9); expect(Math.abs(point.y)).toBeLessThan(.9);
                    }
                }
            }
        } finally { fixture.dispose(); }
    });
    it.each([0, Math.PI / 2, Math.PI, -Math.PI * 3 / 4])('keeps a landed or hovering bird readable at host yaw %s in a single fixed observation camera', rotation => {
        const fixture = leafBirdScene(rotation), { host, bird, scene, nature } = fixture;
        // Other-world occlusion is covered by the recorded-layout test. Here
        // the actual host and bird test the complete landing/wing sequence.
        try {
            for (const aspect of [390 / 386, 768 / 420]) for (const reduced of [false, true]) for (const hovering of [false, true]) {
                const occupied = hovering ? [new THREE.Box3().setFromObject(host).expandByScalar(.2)] : [];
                nature.update('leaf-bird', host, 0, reduced, undefined, occupied);
                const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
                const viewport = { width: aspect < 1.1 ? 390 : 768, height: aspect < 1.1 ? 386 : 420 };
                const frame = fitNatureObservationCamera(camera, host, undefined, bird, aspect, 1, nature.observationPoints, [], [], { residents: [], viewport });
                const orientation = bird.quaternion.toArray(), matrix = camera.matrixWorld.toArray();
                expect(frame.visitorIdentity?.readable).toBe(true);
                expect(frame.visitorIdentity!.frontDot).toBeGreaterThanOrEqual(.85);
                for (const elapsed of [0, 400, 1200, 4200]) {
                    nature.update('leaf-bird', host, elapsed, reduced, undefined, occupied); scene.updateMatrixWorld(true);
                    expect(visibleFeature(camera, bird, 'leaf-bird-beak', [host, bird]), `beak ${reduced}/${hovering}/${elapsed}`).toBe(true);
                    expect(['left', 'right'].some(side => visibleFeature(camera, bird, `leaf-bird-eye-${side}`, [host, bird])), `eye ${reduced}/${hovering}/${elapsed}`).toBe(true);
                    expect(inspectCurrentLeafBirdObservation(camera, bird, [host], viewport).readable, `pixels ${reduced}/${hovering}/${elapsed}`).toBe(true);
                    expect(bird.quaternion.toArray()).toEqual(orientation); expect(camera.matrixWorld.toArray()).toEqual(matrix);
                }
            }
        } finally { fixture.dispose(); }
    });
    it('chooses another front angle when real foreground geometry covers the face and never declares a covered face readable', () => {
        const fixture = leafBirdScene(), { host, bird, scene, nature, occluders } = fixture;
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(.28, .12, .05), new THREE.MeshBasicMaterial());
        const cover = new THREE.Mesh(new THREE.BoxGeometry(.5, .14, .5), new THREE.MeshBasicMaterial());
        try {
            const fit = () => fitNatureObservationCamera(camera, host, undefined, bird, 390 / 386, 1, nature.observationPoints, [], [...occluders, obstacle],
                { residents: [], viewport: { width: 390, height: 386 } });
            fit(); const original = camera.matrixWorld.toArray();
            const direction = camera.getWorldDirection(new THREE.Vector3()).negate();
            obstacle.position.copy(bird.getObjectByName('leaf-bird-beak')!.getWorldPosition(new THREE.Vector3())).addScaledVector(direction, .65);
            obstacle.quaternion.copy(camera.quaternion); scene.add(obstacle); scene.updateMatrixWorld(true);
            expect(visibleFeature(camera, bird, 'leaf-bird-beak', [scene])).toBe(false);
            const clear = fit();
            expect(camera.matrixWorld.toArray()).not.toEqual(original); expect(clear.visitorIdentity?.readable).toBe(true);
            expect(visibleFeature(camera, bird, 'leaf-bird-beak', [scene])).toBe(true);
            expect(['left', 'right'].some(side => visibleFeature(camera, bird, `leaf-bird-eye-${side}`, [scene]))).toBe(true);
            bird.add(cover); cover.position.set(0, .34, .1); scene.updateMatrixWorld(true);
            const blocked = fit();
            expect(blocked.visitorIdentity?.readable).toBe(false); expect(blocked.visitorIdentity?.beak).toBe(0);
            cover.removeFromParent(); obstacle.visible = false;
            expect(fit().visitorIdentity?.readable).toBe(true);
        } finally { cover.removeFromParent(); disposeGeometry(obstacle); disposeGeometry(cover); obstacle.material.dispose(); cover.material.dispose(); fixture.dispose(); }
    });
    it('includes both physical objects and the visitor at phone/tablet aspects without moving them', () => {
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
        const source = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.6, .6)), water = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, 1.4));
        const visitor = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .3));
        source.position.set(1.5, .8, .8); water.position.set(-1, .85, 0); visitor.position.set(1.5, 1.8, .8);
        const before = [source.position.toArray(), water.position.toArray(), visitor.position.toArray()];
        for (const aspect of [.8, 1.15, 1.6, 2.5]) {
            const frame = fitNatureObservationCamera(camera, source, water, visitor, aspect);
            for (const object of [source, water, visitor]) for (const point of boxCorners(new THREE.Box3().setFromObject(object))) {
                point.project(camera); expect(Math.abs(point.x)).toBeLessThan(.9); expect(Math.abs(point.y)).toBeLessThan(.9);
            }
            expect(frame.height).toBeGreaterThanOrEqual(3.6);
        }
        expect([source.position.toArray(), water.position.toArray(), visitor.position.toArray()]).toEqual(before);
        source.geometry.dispose(); water.geometry.dispose(); visitor.geometry.dispose();
    });
    it('shows a small furniture host closely without fitting the other islands', () => {
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100), host = new THREE.Mesh(new THREE.BoxGeometry(1, .64, 1));
        host.position.set(-5.8, .32, 1.3);
        const frame = fitNatureObservationCamera(camera, host, undefined, undefined, 1);
        expect(frame.height).toBe(3.6); expect(frame.width).toBe(3.6); expect(frame.target[0]).toBe(-5.8);
        host.geometry.dispose();
    });
    it('looks through the actual gap between visible meshes instead of treating their enclosing box as opaque', () => {
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100), host = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3));
        host.position.y = -.3;
        const obstacle = new THREE.Group(), geometry = new THREE.BoxGeometry(.18, .18, .18);
        const direction = new THREE.Vector3(-15, 12, 3).normalize(), right = new THREE.Vector3(3, 0, 15).normalize();
        for (const side of [-1, 1]) {
            const part = new THREE.Mesh(geometry); part.position.copy(direction).addScaledVector(right, side * .5); obstacle.add(part);
        }
        const target = new THREE.Vector3();
        const actual = fitNatureObservationCamera(camera, host, undefined, undefined, 1, -1, [target], [], [obstacle]);
        expect(actual.angle).toBe(0); expect(actual.visibleTargets).toBe(1);
        const conservative = fitNatureObservationCamera(camera, host, undefined, undefined, 1, -1, [target], [new THREE.Box3().setFromObject(obstacle)]);
        expect(conservative.angle).not.toBe(0);
        host.geometry.dispose(); geometry.dispose();
    });
    it('changes the view when an actual opaque object covers the target, and ignores hidden ancestors', () => {
        const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100), host = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3));
        host.position.y = -.3;
        const obstacle = new THREE.Group(), solid = new THREE.Mesh(new THREE.SphereGeometry(.3));
        solid.position.copy(new THREE.Vector3(-15, 12, 3).normalize()); obstacle.add(solid);
        const frame = fitNatureObservationCamera(camera, host, undefined, undefined, 1, -1, [new THREE.Vector3()], [], [obstacle]);
        expect(frame.angle).not.toBe(0); expect(frame.visibleTargets).toBe(1);
        obstacle.visible = false;
        expect(fitNatureObservationCamera(camera, host, undefined, undefined, 1, -1, [new THREE.Vector3()], [], [obstacle]).angle).toBe(0);
        host.geometry.dispose(); solid.geometry.dispose();
    });
});
