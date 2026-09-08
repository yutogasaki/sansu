import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { reduceIslandSharedMemories, sharedDisplayKey, sharedWorkCaptureKey,
    type IslandSharedMemoriesAction, type SharedTarget } from '../../../domain/island/sharedMemories';
import { createEmptyWorkshopLayout } from '../../../domain/island/workshopLayout';
import type { IslandRecord } from '../../../domain/island/types';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { IslandScene } from './runtime';
import { fitSharedDisplayCamera, sharedDisplayCameraDiagnostic } from './sharedDisplayFraming';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { IslandSharedJobController } from './sharedJobController';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandPersonalScenery } from './personalScenery';
import { IslandHomePresentation, ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { boxCorners } from './sceneFraming';
import type { IslandSharedStageState } from './types';

afterEach(() => vi.unstubAllGlobals());

function visibleMeshes(root: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return;
        result.push(object);
    });
    return result;
}

/** Independent Three raycasts, without the framing helper's triangle cache. */
function nativePartContactsVisible(scene: THREE.Scene, camera: THREE.Camera, displays: IslandSharedDisplayScene) {
    scene.updateWorldMatrix(true, true);
    const visual = displays.targetVisual('display-3')!, points = visual.anchors().partSurfaces;
    const opaque = (hit: THREE.Intersection) => {
        const mesh = hit.object as THREE.Mesh, material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        return material?.visible && (!material.transparent || material.opacity > .05);
    };
    return Object.entries(visual.parts).map(([id, part]) => {
        const ndc = points[id as keyof typeof points]!.clone().project(camera), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const target = ray.intersectObjects(visibleMeshes(part.group), false).find(opaque);
        expect(target, id).toBeDefined();
        return !ray.intersectObjects(visibleMeshes(scene), false).some(hit => opaque(hit) && hit.distance < target!.distance - .003);
    });
}

function nativeSurfaceVisibility(scene: THREE.Scene, camera: THREE.Camera, subject: THREE.Object3D) {
    scene.updateWorldMatrix(true, true);
    const subjectMeshes = visibleMeshes(subject), allMeshes = visibleMeshes(scene);
    const bounds = new THREE.Box3();
    subjectMeshes.forEach(mesh => bounds.union(new THREE.Box3().setFromObject(mesh, true)));
    const projected = new THREE.Box3().setFromPoints(boxCorners(bounds).map(point => point.project(camera)));
    const size = projected.getSize(new THREE.Vector3()), ray = new THREE.Raycaster();
    const opaque = (hit: THREE.Intersection) => {
        const mesh = hit.object as THREE.Mesh, material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        return material?.visible && (!material.transparent || material.opacity > .05);
    };
    let samples = 0, clear = 0;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) {
        ray.setFromCamera(new THREE.Vector2(projected.min.x + size.x * (x + .5) / 11,
            projected.min.y + size.y * (y + .5) / 9), camera);
        const target = ray.intersectObjects(subjectMeshes, false).find(opaque);
        if (!target) continue;
        samples++;
        if (!ray.intersectObjects(allMeshes, false).some(hit => opaque(hit) && hit.distance < target.distance - .003)) clear++;
    }
    expect(samples).toBeGreaterThan(8);
    return clear / samples;
}

// Explicit geometry fixture for the photographed three-part work A. The
// browser's separately earned progress is not replaced by this unit test.
function harness(width: number, height: number, reduced: boolean) {
    vi.stubGlobal('document', { hidden: false });
    const island = { ...createIsland('shared-frame-boundary-fixture', 0), completedSets: 1 };
    const layout = createEmptyWorkshopLayout();
    (['straight', 'wheel', 'bell'] as const).forEach((id, col) => {
        layout.parts[id] = { position: { col, row: 1 }, rotation: 0, assembled: true };
    });
    const snapshot = { name: '作品A', capturedAt: 1, layout };
    const target: SharedTarget = { kind: 'work', sourceWorkId: 'work-1', ...snapshot,
        targetKey: sharedWorkCaptureKey(island.profileId, 'work-1', snapshot) };
    let current: IslandRecord = { ...island, sharedMemories: { version: 1, memories: [], nextMemoryOrder: 1, displays: {
        'display-3': { target, position: { x: -1.8, z: 1.65 }, rotation: 0, arrangement: 'plain', placedAt: 1 } } } };
    const scene = new THREE.Scene(), displays = new IslandSharedDisplayScene(), preview = new IslandSharedDisplayScene();
    const world = new IslandCosmeticScenery(), homePresentation = new IslandHomePresentation(), keepsakeRoom = new IslandLearningKeepsakeScenery();
    const personal = new IslandPersonalScenery(() => ({ getContext: () => null } as unknown as HTMLCanvasElement));
    keepsakeRoom.group.position.set(...ISLAND_HOME_INTERIOR.position); keepsakeRoom.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale);
    scene.add(personal.group, keepsakeRoom.group);
    // Actual idle position captured by shared-camera-01 after person-placement.
    const materials = new IslandMaterials(), resident = new IslandResident('otter', materials, [-1, 0, 2], () => {});
    resident.group.rotation.y = 2.408777551803287;
    const actions: IslandSharedMemoriesAction[] = [];
    const controller = new IslandSharedJobController(displays, preview, [resident], { action: action => actions.push(action) });
    scene.add(world.group, displays.group, preview.group, controller.group, resident.group);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
    const runtime = Object.create(IslandScene.prototype) as IslandScene;
    const renderer = { render: vi.fn(), domElement: { toDataURL: vi.fn(() => 'data:image/png;base64,boundary') } };
    const host = { clientWidth: width, clientHeight: height, dataset: {} as Record<string, string> };
    const diagnostic = () => JSON.parse(host.dataset.sharedDisplayCamera);
    Object.assign(runtime, { scene, camera, renderer, host, world, personal, homePresentation, keepsakeRoom, residents: [resident],
        sharedDisplays: displays, sharedJobs: controller, onscreen: true });
    const sync = () => {
        const shared: IslandSharedStageState = { island: current, active: true, focusDisplayId: 'display-3' };
        controller.beforeUpdate(shared); displays.update(current); controller.afterUpdate();
        Object.assign(runtime, { state: { learning: false, photographing: true, shared } });
    };
    sync();
    let now = 0;
    const object = displays.targetObject('display-3')!, originalPose = object.matrixWorld.toArray();
    controller.command({ id: 'actual-arrange', command: { type: 'arrange', displayId: 'display-3',
        expectedDisplayKey: sharedDisplayKey(current.sharedMemories!.displays['display-3'])! } }, now, reduced);
    const captureJob = () => {
        const reference = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
        fitSharedDisplayCamera(reference, controller.bounds!, width / height);
        runtime.captureImage();
        expect(camera.matrixWorld.toArray()).toEqual(reference.matrixWorld.toArray());
        expect(camera.projectionMatrix.toArray()).toEqual(reference.projectionMatrix.toArray());
        expect(sharedDisplayCameraDiagnostic(camera)).toBeUndefined();
        expect(diagnostic().branch).toBe('job');
        expect(diagnostic().selection).toBeUndefined();
    };
    return { runtime, camera, controller, actions, captureJob, diagnostic,
        contactsVisible: () => nativePartContactsVisible(scene, camera, displays),
        workVisibility: () => nativeSurfaceVisibility(scene, camera, displays.targetObject('display-3')!),
        finishVisibleSteps() {
            for (let i = 0; i < 40 && actions.length === 0; i++) {
                now += 1000; controller.update(now, reduced); scene.updateMatrixWorld(true); controller.afterRender(() => true);
            }
            expect(actions).toHaveLength(1);
        },
        settle() { controller.update(++now, reduced); expect(controller.phase).toBe('settled'); },
        commit() {
            current = reduceIslandSharedMemories(current, actions[0], 20).island; sync();
            expect(controller.diagnostic()?.committed).toBe(true);
        },
        checkIdentity() {
            expect(displays.targetObject('display-3')).toBe(object);
            object.updateWorldMatrix(true, true); expect(object.matrixWorld.toArray()).toEqual(originalPose);
        },
        dispose() { homePresentation.dispose(); keepsakeRoom.dispose(); personal.dispose(); controller.dispose(); displays.dispose(); preview.dispose(); world.dispose(); disposeGeometry(resident.group); materials.dispose(); } };
}

describe('shared job completion releases the display camera', () => {
    for (const viewport of [{ width: 390, height: 354, reduced: false }, { width: 768, height: 430, reduced: true }]) {
        it.each([false, true])(`keeps pending work and clears the actual work parts only after commit and settle at ${viewport.width}px (commit first=%s)`, commitFirst => {
            const h = harness(viewport.width, viewport.height, viewport.reduced);
            try {
                h.captureJob(); h.finishVisibleSteps();
                expect(h.controller.phase).toBe('result-visible');
                if (commitFirst) {
                    h.commit(); h.captureJob(); // Saved, but the visible result step has not settled.
                    h.settle();
                } else {
                    h.settle(); h.captureJob(); // Settled, but saving is still pending.
                    h.commit();
                }
                h.runtime.captureImage();
                const frame = sharedDisplayCameraDiagnostic(h.camera);
                expect(frame?.visibility).toHaveLength(4);
                expect(frame?.readable).toBe(true);
                expect(h.diagnostic()).toMatchObject({ branch: 'display', result: true, focusDisplayId: 'display-3',
                    phase: 'settled', settledCommitted: true, subjectCount: 4, occluderRootCount: 1,
                    actors: [{ species: 'otter', visible: true, position: [-1, 0, 2] }], selection: frame });
                expect(h.diagnostic().measuredAt).toEqual(expect.any(Number));
                expect(h.diagnostic().history).toBeUndefined();
                expect(h.contactsVisible()).toEqual([true, true, true]);
                // The three small contacts can be clear while the resident
                // covers the work's board, as the actual fixed11 image shows.
                expect(h.workVisibility()).toBeGreaterThanOrEqual(.95);
                h.checkIdentity();
            } finally { h.dispose(); }
        });
    }
});
