import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { IslandNatureVisuals } from './natureVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
import type { LivingNature } from './livingActivities';

describe('causal nature and visitor visuals', () => {
    it('projects the same real butterfly vertices and final wing poses without editing or allocating live geometry', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group();
        source.position.set(1.5, 0, .8); source.rotation.y = .8; source.userData.growthFlowerHeight = 1.02;
        const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
        camera.position.set(12, 13, 8); camera.lookAt(source.position); camera.updateMatrixWorld(true);
        try {
            for (const kind of ['butterfly', 'ribbon-butterfly'] as const) for (const reduced of [false, true]) {
                nature.update(kind, source, 0, reduced); nature.faceCamera(camera);
                const actual = nature.activeObject!, projection = nature.observationProjection(source, reduced)!;
                const snapshot = actual.children.map(child => child.matrixWorld.toArray());
                const hypothetical = projection.at(camera, 350).object;
                expect(actual.children.map(child => child.matrixWorld.toArray())).toEqual(snapshot);
                expect(nature.group.children).not.toContain(hypothetical);
                const realMeshes: THREE.Mesh[] = [], projectedMeshes: THREE.Mesh[] = [];
                actual.traverse(object => { if (object instanceof THREE.Mesh) realMeshes.push(object); });
                hypothetical.traverse(object => { if (object instanceof THREE.Mesh) projectedMeshes.push(object); });
                expect(projectedMeshes).toHaveLength(realMeshes.length);
                for (const elapsed of [...projection.times, 81, 899, 3789]) {
                    projection.at(camera, elapsed);
                    nature.update(kind, source, elapsed, reduced); nature.faceCamera(camera);
                    realMeshes.forEach((mesh, index) => {
                        const projected = projectedMeshes[index]; expect(projected.geometry).toBe(mesh.geometry); expect(projected.material).toBe(mesh.material);
                        const vertices = mesh.geometry.getAttribute('position');
                        for (const i of [0, Math.floor(vertices.count / 2), vertices.count - 1]) {
                            const original = new THREE.Vector3().fromBufferAttribute(vertices, i);
                            expect(original.clone().applyMatrix4(mesh.matrixWorld).distanceTo(original.applyMatrix4(projected.matrixWorld))).toBeLessThan(1e-10);
                        }
                    });
                }
            }
            nature.update('leaf-bird', source, 0, false); expect(nature.observationProjection(source, false)).toBeUndefined();
        } finally { nature.dispose(); m.dispose(); }
    });
    it('lands all petals on open water at every earned fountain appearance, clear of lilies and ornaments', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), flower = new THREE.Group(), water = makeFurniture('fountain', m);
        for (const growthLevel of [1, 2, 3]) for (const rotation of [0, .7]) {
            water.rotation.y = rotation;
            applyFurnitureGrowth(water, { id: 'water', kind: 'fountain', rotation, growthLevel }, m, 6);
            nature.update('petal-ripple', flower, 5000, false, water);
            water.updateWorldMatrix(true, true);
            for (const petal of nature.activeObject!.children.filter((_, index) => index % 2 === 0)) {
                const origin = petal.getWorldPosition(new THREE.Vector3()); origin.y = .34;
                const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, .06);
                const hit = ray.intersectObject(water, true)[0];
                expect(hit?.point.y).toBeCloseTo(.2995, 3);
            }
        }
        nature.dispose(); disposeGeometry(water); m.dispose();
    });
    it('preserves the firefly abdomen dimensions while pulsing and in reduced motion', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group();
        for (const reduced of [false, true]) for (const elapsed of [0, 400, 1400, 4200]) {
            nature.update('pond-firefly', source, elapsed, reduced);
            const size = new THREE.Box3().setFromObject(nature.activeObject!).getSize(new THREE.Vector3());
            expect(size.x).toBeLessThan(.32); expect(size.y).toBeLessThan(.26); expect(size.z).toBeLessThan(.25);
        }
        nature.dispose(); m.dispose();
    });
    it('keeps a seated resident intact and chooses clear air at that same mushroom', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), host = new THREE.Group();
        host.position.set(-5.8, 0, 1.3);
        const resident = new THREE.Box3(new THREE.Vector3(-6.25, .6, .9), new THREE.Vector3(-5.35, 2, 1.7));
        const original = resident.clone();
        for (const reduced of [false, true]) for (const elapsed of [0, 400, 1400, 4200]) {
            nature.update('leaf-bird', host, elapsed, reduced, undefined, [resident]);
            expect(nature.group.visible).toBe(true); expect(nature.birdPerched).toBe(false);
            expect(new THREE.Box3().setFromObject(nature.activeObject!).intersectsBox(resident)).toBe(false);
            expect(nature.activeObject!.position.distanceTo(host.position)).toBeLessThan(2);
        }
        expect(resident.equals(original)).toBe(true);
        nature.update('leaf-bird', host, 4200, true);
        expect(nature.birdPerched).toBe(true); expect(nature.activeObject!.position.y).toBe(.64);
        nature.dispose(); m.dispose();
    });
    it('moves real petals from the flower to the selected fountain before allowing observation', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group(), water = new THREE.Group();
        source.position.set(1, 0, 1); source.userData.growthFlowerHeight = 1.02; water.position.set(3, 0, 1);
        nature.update('petal-ripple', source, 0, false, water);
        const petal = nature.group.getObjectByName('petal-ripple')!.children[0];
        expect(petal.position.toArray()).toEqual([1, 1.02, 1]); expect(nature.ready).toBe(false);
        nature.update('petal-ripple', source, 3500, false, water);
        expect(petal.position.x).toBeCloseTo(3); expect(petal.position.y).toBeCloseTo(.315);
        expect(nature.ready).toBe(true);
        water.position.set(-2, 0, 2);
        nature.update('petal-ripple', source, 0, true, water);
        expect(petal.position.x).toBeCloseTo(-2); expect(nature.ready).toBe(true);
        nature.dispose(); m.dispose();
    });
    it('places reflected light on the actual rotated water surface and requires the light source', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group(), water = new THREE.Group();
        source.position.set(0, 0, 0); water.position.set(2, 0, 1); water.rotation.y = Math.PI / 2;
        expect(nature.update('lantern-reflection', source, 0, true)).toBe(false); expect(nature.group.visible).toBe(false);
        nature.update('lantern-reflection', source, 0, true, water);
        expect(nature.observationPoints[0].toArray()).toEqual([.12, .91, 0]);
        expect(nature.observationPoints[1].x).toBeCloseTo(1.68); expect(nature.observationPoints[1].z).toBeCloseTo(1);
        expect(nature.group.getObjectByName('lantern-reflection')!.position.toArray()).toEqual(nature.observationPoints[1].toArray());
        for (const reduced of [false, true]) for (const elapsed of [0, 400, 1400, 4200]) {
            nature.update('lantern-reflection', source, elapsed, reduced, water);
            for (const strip of nature.activeObject!.children.slice(0, 5)) {
                const size = new THREE.Box3().setFromObject(strip).getSize(new THREE.Vector3());
                expect(size.x).toBeLessThan(.31); expect(size.y).toBeLessThan(.015); expect(size.z).toBeLessThan(.31);
            }
        }
        nature.dispose(); m.dispose();
    });
    it('keeps the butterfly wings readable from every observation direction throughout a 30 fps sequence', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group();
        const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 100);
        for (const reduced of [false, true]) for (const position of [[-15, 12, 3], [8.8, 10.2, 11.5], [0, 25, 5]]) {
            camera.position.fromArray(position); camera.lookAt(0, .7, 0); camera.updateMatrixWorld(true);
            for (let elapsed = 0; elapsed <= 4200; elapsed += 1000 / 30) {
                nature.update('butterfly', source, elapsed, reduced); nature.faceCamera(camera);
                const points: THREE.Vector3[] = [];
                nature.activeObject!.traverse(object => {
                    if (!(object instanceof THREE.Mesh)) return;
                    const vertices = object.geometry.getAttribute('position');
                    for (let index = 0; index < vertices.count; index++) points.push(new THREE.Vector3().fromBufferAttribute(vertices, index)
                        .applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse));
                });
                const size = new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3());
                // A quarter-unit wing span remains broad enough to read as
                // four lobes at the close observation scale, even mid-flap.
                expect(size.x).toBeGreaterThan(.24); expect(size.y).toBeGreaterThan(.23);
            }
        }
        nature.dispose(); m.dispose();
    });
    it('gives all seven events stable reduced-motion outcomes and disposes every allocated geometry once', () => {
        const m = new IslandMaterials(), nature = new IslandNatureVisuals(m), source = new THREE.Group(), water = new THREE.Group();
        source.position.set(1, 0, 0); water.position.set(3, 0, 0);
        const geometries = new Set<THREE.BufferGeometry>();
        nature.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
        const disposals = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
        const kinds: LivingNature[] = ['butterfly', 'boat', 'petal-ripple', 'lantern-reflection', 'ribbon-butterfly', 'pond-firefly', 'leaf-bird'];
        for (let repeat = 0; repeat < 5; repeat++) for (const kind of kinds) {
            expect(nature.update(kind, source, 0, true, water)).toBe(false);
            expect(nature.ready).toBe(true); expect(nature.group.children.filter(object => object.visible)).toHaveLength(1);
            const first = nature.observationPoints.map(point => point.toArray());
            nature.update(kind, source, 15000, true, water);
            expect(nature.observationPoints.map(point => point.toArray())).toEqual(first);
        }
        expect(disposals.every(spy => spy.mock.calls.length === 0)).toBe(true);
        nature.clear(); expect(nature.ready).toBe(false); expect(nature.observationPoints).toEqual([]);
        const world = new THREE.Group(); world.add(nature.group);
        nature.dispose(); nature.dispose();
        expect(world.children).toEqual([]);
        expect(disposals.every(spy => spy.mock.calls.length === 1)).toBe(true); m.dispose();
    });
});
