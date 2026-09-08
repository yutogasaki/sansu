import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fitSharedDisplayCamera, sharedDisplayCameraDiagnostic } from './sharedDisplayFraming';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { createIsland } from '../../../domain/island/catalog';
import { resolveSharedTarget, type SharedTarget } from '../../../domain/island/sharedMemories';
import { boxCorners } from './sceneFraming';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandResident } from './animals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { makeFurniture } from './furniture';
import { getIslandWorkshop, reduceIslandWorkshop } from '../../../domain/island/workshop';
import { createEmptyWorkshopLayout, WORKSHOP_PART_IDS } from '../../../domain/island/workshopLayout';

describe('shared actual display camera', () => {
    it.each([390 / 366, 768 / 430])('frames the actual table and object together at aspect %s', aspect => {
        const island = createIsland('framing-fixture', 0), scene = new IslandSharedDisplayScene();
        const target = resolveSharedTarget(island, { kind: 'specimen', specimenId: 'driftwood' });
        scene.update({ ...island, sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1, displays: {
            'display-1': { target, position: { x: 2, z: 1 }, rotation: .7, arrangement: 'petal-ring', placedAt: 0 } } } });
        const object = scene.targetObject('display-1')!, pose = object.matrixWorld.toArray(), bounds = scene.describe()[0].displayBounds;
        const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        expect(fitSharedDisplayCamera(camera, bounds, aspect, .7)).toBe(true);
        const ndc = boxCorners(bounds).map(point => point.project(camera));
        expect(ndc.every(point => Math.abs(point.x) <= .861 && Math.abs(point.y) <= .861 && Math.abs(point.z) <= 1)).toBe(true);
        expect(Math.max(...ndc.map(point => point.y)) - Math.min(...ndc.map(point => point.y))).toBeGreaterThan(.4);
        expect(object.matrixWorld.toArray()).toEqual(pose); scene.dispose();
    });
    it('keeps the active actor and held target inside the same frame across a route', () => {
        const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        for (const aspect of [.6, 1, 1.9]) for (const x of [-3, 0, 4]) {
            const bounds = new THREE.Box3(new THREE.Vector3(x - .5, 0, -.6), new THREE.Vector3(x + 1.4, 2.2, 1.2));
            expect(fitSharedDisplayCamera(camera, bounds, aspect)).toBe(true);
            expect(boxCorners(bounds).map(point => point.project(camera)).every(point => Math.abs(point.x) <= .861 && Math.abs(point.y) <= .861)).toBe(true);
        }
    });
    it('retains the previous camera when a removed target or invalid viewport cannot be framed', () => {
        const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100), before = camera.toJSON();
        expect(fitSharedDisplayCamera(camera, new THREE.Box3(), 1)).toBe(false);
        expect(fitSharedDisplayCamera(camera, new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)), 0)).toBe(false);
        expect(camera.toJSON()).toEqual(before);
    });
});

// Native Three raycasts on a denser, independent grid validate the selected
// camera. These are geometry regressions, not rendered-image/child-use evidence.
function silhouetteVisibility(subject: THREE.Object3D, camera: THREE.Camera, scene: THREE.Object3D) {
    scene.updateWorldMatrix(true, true);
    const live = (root: THREE.Object3D) => {
        const result: THREE.Mesh[] = [];
        root.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return;
            result.push(object);
        });
        return result;
    };
    const subjectMeshes = live(subject), whole = live(scene), bounds = new THREE.Box3();
    subjectMeshes.forEach(mesh => bounds.union(new THREE.Box3().setFromObject(mesh, true)));
    const projected = new THREE.Box3().setFromPoints(boxCorners(bounds).map(point => point.project(camera)));
    const size = projected.getSize(new THREE.Vector3()), ray = new THREE.Raycaster();
    let count = 0, visible = 0;
    const opaque = (hit: THREE.Intersection) => {
        const mesh = hit.object as THREE.Mesh;
        const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        return !!material?.visible && (!material.transparent || material.opacity > .05);
    };
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) {
        ray.setFromCamera(new THREE.Vector2(projected.min.x + size.x * (x + .5) / 11,
            projected.min.y + size.y * (y + .5) / 9), camera);
        const target = ray.intersectObjects(subjectMeshes, false).find(opaque);
        if (!target) continue;
        count++;
        if (!ray.intersectObjects(whole, false).some(hit => opaque(hit) && hit.distance < target.distance - .003)) visible++;
    }
    expect(count).toBeGreaterThan(8);
    return visible / count;
}

function displayFixture(kind: 'driftwood' | 'work') {
    let island = { ...createIsland('occluded-photo-geometry-fixture', 0), completedSets: 1 };
    // Mature appearance is explicit test setup; no earned-learning claim.
    for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId: 'driftwood', section }, 1);
    const layout = createEmptyWorkshopLayout();
    WORKSHOP_PART_IDS.forEach((id, i) => { layout.parts[id] = { position: { col: i % 2 * 3, row: i < 2 ? 0 : 3 }, rotation: i as 0 | 1 | 2 | 3, assembled: true }; });
    const target: SharedTarget = kind === 'driftwood' ? resolveSharedTarget(island, { kind: 'specimen', specimenId: 'driftwood' })
        : { kind: 'work', targetKey: 'geometry-work-A', sourceWorkId: 'work-1', capturedAt: 1, name: 'geometry-only A', layout };
    island = { ...island, workshop: getIslandWorkshop(island), sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1, displays: {
        'display-1': { target, position: { x: .20, z: -.60 }, rotation: Math.PI / 2, arrangement: 'plain', placedAt: 1 } } } };
    const scene = new THREE.Scene(), world = new IslandCosmeticScenery(), displays = new IslandSharedDisplayScene(), materials = new IslandMaterials();
    displays.update(island); scene.add(world.group, displays.group);
    const bench = makeFurniture('bench', materials); bench.position.set(-.5, 0, .75); bench.rotation.y = Math.PI / 2; scene.add(bench);
    const actors = [new IslandResident('otter', materials, [.1, 0, 1.6], () => {}),
        new IslandResident('rabbit', materials, [2.45, 0, 1.45], () => {})];
    actors.forEach(actor => scene.add(actor.group));
    const visual = displays.targetVisual('display-1')!;
    return { scene, world, displays, actors, island, visual, bounds: displays.describe()[0].displayBounds,
        subjects: visual.specimen ? [visual.specimen.group] : Object.values(visual.parts).map(part => part.group),
        dispose() { actors.forEach(actor => disposeGeometry(actor.group)); disposeGeometry(bench); displays.dispose(); world.dispose(); materials.dispose(); } };
}
function poses(scene: THREE.Object3D) {
    const result: unknown[] = [];
    scene.traverse(object => {
        result.push([object.uuid, object.parent?.uuid, object.visible, object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()]);
        if (object instanceof THREE.Mesh) result.push((Array.isArray(object.material) ? object.material : [object.material])
            .map(material => [material.uuid, material.visible, material.opacity, material.transparent]));
    });
    return result;
}

describe('shared photo actual scene sightlines', () => {
    it.each([{ label: 'phone', aspect: 390 / 354 }, { label: 'tablet', aspect: 768 / 430 }])('clears the photographed tree at (.20, -.60), π/2 on $label without hiding or relocating it', ({ aspect }) => {
        const fixture = displayFixture('driftwood'), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const before = poses(fixture.scene), saved = structuredClone(fixture.island);
            fitSharedDisplayCamera(camera, fixture.bounds, aspect, Math.PI / 2);
            expect(silhouetteVisibility(fixture.subjects[0], camera, fixture.scene)).toBeLessThan(.5);
            expect(fitSharedDisplayCamera(camera, fixture.bounds, aspect, Math.PI / 2, { subjects: fixture.subjects, occluders: [fixture.scene] })).toBe(true);
            expect(sharedDisplayCameraDiagnostic(camera)?.readable).toBe(true);
            expect(silhouetteVisibility(fixture.subjects[0], camera, fixture.scene)).toBeGreaterThanOrEqual(.95);
            expect(boxCorners(fixture.bounds).every(point => { point.project(camera); return Math.abs(point.x) <= .861 && Math.abs(point.y) <= .861; })).toBe(true);
            const view = camera.matrixWorld.toArray();
            for (let frame = 0; frame < 3; frame++) {
                fitSharedDisplayCamera(camera, fixture.bounds, aspect, Math.PI / 2, { subjects: fixture.subjects, occluders: [fixture.scene] });
                expect(camera.matrixWorld.toArray()).toEqual(view);
            }
            expect(poses(fixture.scene)).toEqual(before); expect(fixture.island).toEqual(saved);
        } finally { fixture.dispose(); }
    });

    it.each([390 / 354, 768 / 430])('keeps every actual saved work part readable at aspect %s', aspect => {
        const fixture = displayFixture('work'), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const before = poses(fixture.scene), saved = structuredClone(fixture.island);
            fitSharedDisplayCamera(camera, fixture.bounds, aspect, Math.PI / 2, { subjects: fixture.subjects, occluders: [fixture.scene] });
            expect(sharedDisplayCameraDiagnostic(camera)?.visibility).toHaveLength(4);
            for (const subject of fixture.subjects) expect(silhouetteVisibility(subject, camera, fixture.scene)).toBeGreaterThanOrEqual(.9);
            expect(boxCorners(fixture.bounds).every(point => { point.project(camera); return Math.abs(point.x) <= .861 && Math.abs(point.y) <= .861; })).toBe(true);
            expect(poses(fixture.scene)).toEqual(before); expect(fixture.island).toEqual(saved);
        } finally { fixture.dispose(); }
    });

    it('uses transformed world geometry and caches a stable near view without repeating rays', () => {
        const fixture = displayFixture('driftwood'), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            fixture.scene.position.set(3, .2, -4); fixture.scene.rotation.y = .6; fixture.scene.scale.set(.8, 1.1, 1.2);
            const bounds = fixture.displays.describe()[0].displayBounds, before = poses(fixture.scene);
            const fit = () => fitSharedDisplayCamera(camera, bounds, 1.1, Math.PI / 2 + .6, { subjects: fixture.subjects, occluders: [fixture.scene] });
            fit(); expect(silhouetteVisibility(fixture.subjects[0], camera, fixture.scene)).toBeGreaterThanOrEqual(.95);
            const view = camera.matrixWorld.toArray(), raycasts = vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects');
            try {
                for (let frame = 0; frame < 5; frame++) fit();
                expect(raycasts).not.toHaveBeenCalled(); expect(camera.matrixWorld.toArray()).toEqual(view);
            } finally { raycasts.mockRestore(); }
            expect(poses(fixture.scene)).toEqual(before);
        } finally { fixture.dispose(); }
    });

    it('responds to a real resident entering the chosen sightline and keeps that view when it clears', () => {
        const fixture = displayFixture('driftwood'), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const fit = () => fitSharedDisplayCamera(camera, fixture.bounds, 1.1, Math.PI / 2, { subjects: fixture.subjects, occluders: [fixture.scene] });
            fit(); const oldView = camera.matrixWorld.toArray(), actor = fixture.actors[1];
            const target = new THREE.Box3().setFromObject(fixture.subjects[0], true).getCenter(new THREE.Vector3());
            const ray = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
            actor.group.position.copy(target).addScaledVector(ray, 1.3); actor.group.position.y = 0;
            expect(silhouetteVisibility(fixture.subjects[0], camera, fixture.scene)).toBeLessThan(.5);
            const before = poses(fixture.scene); fit();
            expect(camera.matrixWorld.toArray()).not.toEqual(oldView);
            expect(silhouetteVisibility(fixture.subjects[0], camera, fixture.scene)).toBeGreaterThanOrEqual(.95);
            expect(poses(fixture.scene)).toEqual(before);
            const clearView = camera.matrixWorld.toArray(); actor.group.position.set(4, 0, 2); fit();
            expect(camera.matrixWorld.toArray()).toEqual(clearView);
        } finally { fixture.dispose(); }
    });

    it('ignores invisible and fully transparent meshes, but reports an opaque enclosure as unreadable', () => {
        const fixture = displayFixture('driftwood'), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        const enclosure = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        const hidden = new THREE.Group(); hidden.visible = false; hidden.add(enclosure); fixture.scene.add(hidden);
        try {
            const fit = () => fitSharedDisplayCamera(camera, fixture.bounds, 1, Math.PI / 2, { subjects: fixture.subjects, occluders: [fixture.scene] });
            fit(); expect(sharedDisplayCameraDiagnostic(camera)?.readable).toBe(true);
            const view = camera.matrixWorld.toArray();
            hidden.visible = true; enclosure.material.transparent = true; enclosure.material.opacity = 0; fit();
            expect(camera.matrixWorld.toArray()).toEqual(view);
            enclosure.material.opacity = 1; fit();
            expect(sharedDisplayCameraDiagnostic(camera)?.readable).toBe(false);
            expect(sharedDisplayCameraDiagnostic(camera)?.minimumVisibility).toBe(0);
        } finally { disposeGeometry(hidden); enclosure.material.dispose(); fixture.dispose(); }
    });
});
