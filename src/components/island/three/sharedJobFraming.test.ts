import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { resolveSharedTarget } from '../../../domain/island/sharedMemories';
import { reduceIslandWorkshop } from '../../../domain/island/workshop';
import { IslandResident } from './animals';
import { SharedJobActor } from './sharedJobActor';
import { SharedJobVisuals } from './sharedJobVisuals';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { disposeGeometry, IslandMaterials } from './primitives';
import { boxCorners } from './sceneFraming';
import { clearSharedJobCamera, fitSharedDisplayCamera, fitSharedJobCamera, sharedJobCameraDiagnostic, type SharedJobFrame } from './sharedDisplayFraming';

function meshes(root: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return;
        result.push(object);
    });
    return result;
}
/** Independent denser native ray grid; does not use the candidate's BVH. */
function visibleRatio(root: readonly THREE.Object3D[], scene: THREE.Scene, camera: THREE.Camera) {
    const subjects = root.flatMap(meshes), blockers = meshes(scene), box = new THREE.Box3();
    subjects.forEach(mesh => box.union(new THREE.Box3().setFromObject(mesh, true)));
    const bounds = new THREE.Box3().setFromPoints(boxCorners(box).map(p => p.project(camera)));
    const size = bounds.getSize(new THREE.Vector3()), ray = new THREE.Raycaster();
    let total = 0, clear = 0;
    const rows = 9, columns = 11;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        ray.setFromCamera(new THREE.Vector2(bounds.min.x + size.x * (x + .5) / columns, bounds.min.y + size.y * (y + .5) / rows), camera);
        const hit = ray.intersectObjects(subjects, false)[0]; if (!hit) continue;
        total++;
        if (!ray.intersectObjects(blockers, false).some(other => other.distance < hit.distance - .004)) clear++;
    }
    expect(total).toBeGreaterThanOrEqual(9); return clear / total;
}
/** Camera-independent population: the same authored triangle centroids are
 * tested before and after. Back-facing tips remain samples and may be blocked
 * by their own full limb; a missing screen-grid hit is never treated as zero. */
function surfaceSamples(roots: readonly THREE.Object3D[], contact?: THREE.Object3D) {
    const points: THREE.Vector3[] = [];
    for (const mesh of roots.flatMap(meshes)) {
        const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index;
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
            const point = new THREE.Vector3();
            for (let j = 0; j < 3; j++) point.add(new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + j) : i + j));
            point.divideScalar(3);
            if (contact && mesh === contact.parent && point.dot(contact.position.clone().normalize()) < .5) continue;
            points.push(point.applyMatrix4(mesh.matrixWorld));
        }
    }
    expect(points.length).toBeGreaterThanOrEqual(9); return points;
}
function visibleSurfaceRatio(points: readonly THREE.Vector3[], scene: THREE.Scene, camera: THREE.Camera) {
    const blockers = meshes(scene), backwards = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    let clear = 0;
    for (const point of points) {
        const ndc = point.clone().project(camera);
        if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) continue;
        const ray = new THREE.Raycaster(point.clone().addScaledVector(backwards, 20), backwards.clone().negate(), 0, 20 - .004);
        if (!ray.intersectObjects(blockers, false).length) clear++;
    }
    return clear / points.length;
}
function transforms(root: THREE.Object3D) {
    const result: unknown[] = []; root.updateMatrixWorld(true);
    root.traverse(o => result.push([o.uuid, o.matrixWorld.toArray(), o.visible])); return result;
}
function fixture(light = false) {
    let island = { ...createIsland('job-view-geometry', 0), completedSets: 15 };
    for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId: 'driftwood', section }, 1);
    const target = resolveSharedTarget(island, { kind: 'specimen', specimenId: 'driftwood' });
    const position = light ? { x: -3.05, z: .65 } : { x: -1.5, z: 1.5 };
    const rotation = light ? Math.PI : 0;
    const state = { ...island, sharedMemories: { version: 1 as const, memories: [], nextMemoryOrder: 1, displays: {
        'display-1': { target, position, rotation, arrangement: 'plain' as const, placedAt: 1 } } } };
    const world = new THREE.Scene(), scenery = new IslandCosmeticScenery(), display = new IslandSharedDisplayScene();
    const materials = new IslandMaterials(), resident = new IslandResident(light ? 'fox' : 'otter', materials, [0, 0, 0], () => {});
    const actor = new SharedJobActor(resident), props = new SharedJobVisuals();
    display.update(state); world.add(scenery.group, display.group, resident.group, props.group);
    const visual = display.targetVisual('display-1')!, a = visual.anchors();
    const targets = light ? [new THREE.Vector3(-2.75, 1.0117999911308289, -.065)] : [a.gripLeft, a.gripRight];
    const yaw = light ? -.9972712733446314 : Math.PI;
    const expectedRoot = light ? new THREE.Vector3(-2.123478986300433, 0, -.07755732190254128) : new THREE.Vector3(-1.5, 0, 2.7267596312284317);
    const pose = actor.contactCandidates(targets, yaw).sort((a, b) => a.root.distanceToSquared(expectedRoot) - b.root.distanceToSquared(expectedRoot))[0];
    expect(pose.root.distanceTo(expectedRoot)).toBeLessThan(1e-7);
    actor.pose(pose.root, pose.yaw, pose.lean, targets);
    const channels: SharedJobFrame['channels'][number][] = [
        { name: 'target', objects: [visual.specimen!.group] },
        { name: 'head', objects: [resident.head], identity: true },
        { name: 'body', objects: resident.body.children.filter(o => o instanceof THREE.Mesh), identity: true },
        ...((light ? ['left'] : ['left', 'right']).map(side => ({ name: `paw-${side}`, objects: [resident.group.getObjectByName(`hand-contact-${side}`)!.parent!], handContact: resident.group.getObjectByName(`hand-contact-${side}`)! }))),
    ];
    let illumination: SharedJobFrame['light'];
    if (light) {
        props.group.visible = props.lamp.visible = true;
        props.lamp.position.copy(resident.handAnchor(new THREE.Vector3(), 'left'));
        expect(props.illuminate(visual, a.surface, .525, new THREE.Vector3(position.x, 0, position.z), .72, 'shadow')).toBe(true);
        const actual = props.lightContact!, table = display.group.getObjectByName('shared-display-table')!;
        const receiverSamples = [[0, 0], [-.04, 0], [.04, 0], [0, -.04], [0, .04]].map(([x, z]) =>
            new THREE.Raycaster(actual.receiver.clone().add(new THREE.Vector3(x, .03, z)), new THREE.Vector3(0, -1, 0), 0, .06).intersectObject(table, true)[0].point);
        illumination = { ...actual, receiverSamples }; channels.push({ name: 'lamp', objects: [props.lamp] });
    }
    world.updateMatrixWorld(true);
    const bounds = display.describe()[0].displayBounds.clone().union(new THREE.Box3().setFromObject(resident.group, true));
    if (light) bounds.union(new THREE.Box3().setFromObject(props.lamp, true));
    const frame: SharedJobFrame = { key: light ? 'actual-fox' : 'actual-otter', phase: light ? 'surface-illuminated' : 'pickup-contact', bounds, channels,
        facing: { origin: resident.head.getWorldPosition(new THREE.Vector3()), direction: new THREE.Vector3(0, 0, 1).transformDirection(resident.head.matrixWorld) }, light: illumination };
    return { world, frame, resident, props, state, dispose() {
        actor.restore(); resident.disposeAppearance(); disposeGeometry(resident.group); materials.dispose(); props.dispose(); display.dispose(); scenery.dispose();
    } };
}

describe('actual shared job sightlines', () => {
    it.each([375 / 287, 768 / 430])('replaces the recorded back view with both actual paws and the same held object at aspect %s', aspect => {
        const h = fixture(), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const pose = transforms(h.world), state = JSON.stringify(h.state);
            fitSharedDisplayCamera(camera, h.frame.bounds, aspect);
            const paws = h.frame.channels.filter(c => c.name.startsWith('paw'));
            const samples = paws.map(c => surfaceSamples(c.objects, c.handContact));
            const before = samples.map(points => visibleSurfaceRatio(points, h.world, camera));
            expect(Math.min(...before)).toBeLessThan(.2);
            fitSharedJobCamera(camera, h.frame, aspect, [h.world], 0);
            const diagnostic = sharedJobCameraDiagnostic(camera)!;
            expect(diagnostic).toMatchObject({ candidate: 'island-shared-job-camera-v2', readable: false, facing: true });
            const after = samples.map(points => visibleSurfaceRatio(points, h.world, camera));
            after.forEach((ratio, i) => expect(ratio, JSON.stringify({ diagnostic, samples: samples.map(points => points.length), before, after })).toBeGreaterThan(before[i]));
            expect(visibleRatio(h.frame.channels[0].objects, h.world, camera)).toBeGreaterThanOrEqual(.95);
            expect(transforms(h.world)).toEqual(pose); expect(JSON.stringify(h.state)).toBe(state);
        } finally { h.dispose(); }
    });
    it.each([375 / 287, 768 / 430])('improves the lamp view and exposes actual receiver triangles without hiding residual occlusion at aspect %s', aspect => {
        const h = fixture(true), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const pose = transforms(h.world), light = JSON.stringify(h.props.lightContact);
            fitSharedDisplayCamera(camera, h.frame.bounds, aspect);
            const lamp = h.frame.channels.find(c => c.name === 'lamp')!;
            const samples = surfaceSamples(lamp.objects);
            const before = visibleSurfaceRatio(samples, h.world, camera);
            fitSharedJobCamera(camera, h.frame, aspect, [h.world], 0);
            const diagnostic = sharedJobCameraDiagnostic(camera)!;
            expect(diagnostic, JSON.stringify(diagnostic)).toMatchObject({ readable: false, contacts: [false, true, true, true, true, true], separated: true, facing: true });
            const after = visibleSurfaceRatio(samples, h.world, camera);
            expect(after, JSON.stringify({ diagnostic, samples: samples.length, before, after })).toBeGreaterThan(before);
            for (const point of h.frame.light!.receiverSamples) {
                const backwards = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
                const origin = point.clone().addScaledVector(backwards, 20);
                const hits = new THREE.Raycaster(origin, backwards.negate(), 0, 20 - .004).intersectObjects(meshes(h.world), false);
                expect(hits).toHaveLength(0);
            }
            expect(diagnostic.channels.find(c => c.name === 'lamp')!.visible).toBeGreaterThan(.5);
            expect(diagnostic.channels.find(c => c.name === 'paw-left')!.visible).toBeGreaterThan(.5);
            expect(transforms(h.world)).toEqual(pose); expect(JSON.stringify(h.props.lightContact)).toBe(light);
        } finally { h.dispose(); }
    });
    it('retains its selected contact angle through moving bounds without full searches or GPU allocations', () => {
        const h = fixture(), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        try {
            const geometry = meshes(h.world).map(m => m.geometry.uuid), material = meshes(h.world).map(m => m.material);
            fitSharedJobCamera(camera, h.frame, 1, [h.world], 0);
            const first = sharedJobCameraDiagnostic(camera)!;
            expect(first.candidates).toBeLessThanOrEqual(24);
            for (let i = 1; i <= 60; i++) {
                const frame = { ...h.frame, bounds: h.frame.bounds.clone().expandByScalar(i * .0001) };
                fitSharedJobCamera(camera, frame, 1, [h.world], i * 33);
                expect(sharedJobCameraDiagnostic(camera)).toMatchObject({ angle: first.angle, elevation: first.elevation, searches: first.searches, candidates: 0, reused: true });
            }
            expect(meshes(h.world).map(m => m.geometry.uuid)).toEqual(geometry); expect(meshes(h.world).map(m => m.material)).toEqual(material);
            clearSharedJobCamera(camera); expect(sharedJobCameraDiagnostic(camera)).toBeUndefined();
        } finally { h.dispose(); }
    });
    it('keeps an unreadable view honest and caps reselection during continuous occlusion', () => {
        const h = fixture(), camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        const enclosure = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        enclosure.position.copy(h.frame.bounds.getCenter(new THREE.Vector3())); h.world.add(enclosure);
        try {
            fitSharedJobCamera(camera, h.frame, 1, [h.world], 0);
            const first = sharedJobCameraDiagnostic(camera)!;
            expect(first.readable).toBe(false); expect(first.candidates).toBeLessThanOrEqual(24);
            for (let i = 1; i <= 7; i++) {
                fitSharedJobCamera(camera, { ...h.frame, bounds: h.frame.bounds.clone().expandByScalar(i * .001) }, 1, [h.world], i * 33);
                expect(sharedJobCameraDiagnostic(camera)).toMatchObject({ readable: false, searches: 1, candidates: 0, angle: first.angle });
            }
            fitSharedJobCamera(camera, { ...h.frame, bounds: h.frame.bounds.clone().expandByScalar(.01) }, 1, [h.world], 300);
            expect(sharedJobCameraDiagnostic(camera)).toMatchObject({ readable: false, searches: 1, angle: first.angle });
            fitSharedJobCamera(camera, { ...h.frame, phase: 'lifting' }, 1, [h.world], 333);
            expect(sharedJobCameraDiagnostic(camera)).toMatchObject({ readable: false, searches: 2 });
            const dispose = vi.spyOn(enclosure.geometry, 'dispose');
            clearSharedJobCamera(camera); expect(dispose).not.toHaveBeenCalled();
        } finally { enclosure.geometry.dispose(); enclosure.material.dispose(); h.dispose(); }
    });
});
