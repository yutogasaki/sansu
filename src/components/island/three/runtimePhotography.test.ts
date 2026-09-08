import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { boxCorners } from './sceneFraming';
import { createIsland } from '../../../domain/island/catalog';
import { resolveSharedTarget } from '../../../domain/island/sharedMemories';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandPersonalScenery } from './personalScenery';
import { IslandHomePresentation, ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { sharedDisplayCameraDiagnostic } from './sharedDisplayFraming';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(clean => clean()); vi.unstubAllGlobals(); });

function captureHarness() {
    vi.stubGlobal('document', { hidden: false });
    const scene = new THREE.Scene(), actor = new THREE.Group(), world = new IslandCosmeticScenery();
    const homePresentation = new IslandHomePresentation(), keepsakeRoom = new IslandLearningKeepsakeScenery();
    const personal = new IslandPersonalScenery(() => ({ getContext: () => null } as unknown as HTMLCanvasElement));
    keepsakeRoom.group.position.set(...ISLAND_HOME_INTERIOR.position); keepsakeRoom.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale);
    scene.add(world.group, personal.group, keepsakeRoom.group);
    cleanups.push(() => { homePresentation.dispose(); keepsakeRoom.dispose(); personal.dispose(); world.dispose(); });
    actor.position.set(-3.1, .7, -1.2); scene.add(actor);
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
    const homeCamera = new THREE.PerspectiveCamera(62, 1, .01, 100);
    camera.position.set(4, 5, -10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    const order: string[] = [];
    const renderer = { render: vi.fn(() => order.push('render')),
        domElement: { toDataURL: vi.fn(() => { order.push('encode'); return 'data:image/png;base64,actual-render'; }) } };
    const runtime = Object.create(IslandScene.prototype) as IslandScene;
    Object.assign(runtime, { scene, world, personal, homePresentation, keepsakeRoom, camera, homeCamera, renderer, onscreen: true, state: { learning: false, photographing: true } });
    return { runtime, renderer, actor, camera, homeCamera, order, scene, world, personal, homePresentation, keepsakeRoom };
}

describe('current-scene photography boundary', () => {
    it('renders before encoding without resetting the current actor or camera', () => {
        const { runtime, renderer, actor, camera, order } = captureHarness();
        const position = actor.position.toArray(), view = camera.matrixWorld.toArray();
        expect(runtime.captureImage()).toBe('data:image/png;base64,actual-render');
        expect(order).toEqual(['render', 'encode']);
        expect(renderer.domElement.toDataURL).toHaveBeenCalledWith('image/png');
        expect(actor.position.toArray()).toEqual(position);
        expect(camera.matrixWorld.toArray()).toEqual(view);
    });

    it.each([[390, 354], [768, 430]])('photographs a real house keepsake in the existing island scene at %s×%s', (width, height) => {
        const { runtime, renderer, camera, homeCamera, scene, world, actor, homePresentation, keepsakeRoom, order } = captureHarness();
        const island = { ...createIsland('house-photography-fixture', 1), completedSets: 1,
            learningKeepsakes: { version: 1 as const, displayed: ['first-completion' as const] } }, before = structuredClone(island);
        keepsakeRoom.update(island.learningKeepsakes, 1, true, 'first-completion');
        const shells: THREE.Object3D[] = []; world.group.traverse(object => { if (object.name === 'island-home-shell') shells.push(object); });
        expect(shells.length).toBeGreaterThan(0);
        expect(shells.every(shell => { let vertices = 0; shell.traverse(child => {
            if (child instanceof THREE.Mesh) vertices += child.geometry.getAttribute('position').count;
        }); return vertices > 0; })).toBe(true);
        const state = { ...island, learning: false, photographing: true,
            learningKeepsakes: { state: island.learningKeepsakes, selectedId: 'first-completion' } }, stateBefore = structuredClone(state);
        Object.assign(runtime, { host: { clientWidth: width, clientHeight: height }, state });
        const sceneChildren = [...scene.children], actorPosition = actor.position.toArray();
        const originalCamera = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
        const originalHomeCamera = [...homeCamera.matrixWorld.elements, ...homeCamera.projectionMatrix.elements];
        const selected = keepsakeRoom.selectedObject();
        expect(selected?.name).toBe('keepsake-first-completion');
        homePresentation.begin(camera, 0, false); // A shutter during the entry transition must use the final real view.
        renderer.render.mockImplementation(() => {
            order.push('render');
            expect(shells.every(shell => shell.visible)).toBe(true);
            for (const name of ['keepsake-room-wall', 'keepsake-room-side-wall', 'home-right-wall', 'home-ceiling', 'home-entry-wall']) {
                const wall = keepsakeRoom.group.getObjectByName(name);
                expect(wall).toBeInstanceOf(THREE.Mesh); expect(wall?.visible).toBe(true);
            }
            expect(world.group.visible).toBe(true); expect(keepsakeRoom.group.parent).toBe(scene);
            const points = boxCorners(new THREE.Box3().setFromObject(selected!, true)).map(point => point.project(homeCamera));
            expect(points.every(point => Math.abs(point.x) < .94 && Math.abs(point.y) < .94 && Math.abs(point.z) < 1)).toBe(true);
        });
        expect(runtime.captureImage()).toBe('data:image/png;base64,actual-render');
        expect(renderer.render).toHaveBeenCalledWith(scene, homeCamera); expect(order).toEqual(['render', 'encode']);
        expect([...homeCamera.matrixWorld.elements, ...homeCamera.projectionMatrix.elements]).not.toEqual(originalHomeCamera);
        expect(homeCamera.near).toBe(.01); expect(homeCamera.aspect).toBeCloseTo(width / height);
        expect(homePresentation.animate(camera, 600, false)).toBe(false);
        expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(originalCamera);
        expect(scene.children).toEqual(sceneChildren); expect(actor.position.toArray()).toEqual(actorPosition);
        expect(island).toEqual(before); expect(state).toEqual(stateBefore); expect(shells.every(shell => shell.visible)).toBe(true);
    });

    it.each(['hidden', 'offscreen', 'learning', 'lost', 'disposed'])('cannot render or encode a %s scene', boundary => {
        const { runtime, renderer } = captureHarness();
        if (boundary === 'hidden') vi.stubGlobal('document', { hidden: true });
        else if (boundary === 'offscreen') Object.assign(runtime, { onscreen: false });
        else if (boundary === 'learning') Object.assign(runtime, { state: { learning: true, photographing: true } });
        else Object.assign(runtime, { [boundary]: true });
        expect(runtime.captureImage()).toBeUndefined();
        expect(renderer.render).not.toHaveBeenCalled();
        expect(renderer.domElement.toDataURL).not.toHaveBeenCalled();
    });

    it.each(['otter', 'rabbit', 'fox'] as const)('tracks the actual %s and cap before capture without changing its pose', species => {
        const { runtime, camera } = captureHarness();
        const materials = new IslandMaterials(), resident = new IslandResident(species, materials, [0, 0, 0], () => {});
        resident.setAppearance('cap');
        Object.assign(runtime, { residents: [resident], state: { learning: false, photographing: true, residentPortraitId: species } });
        try {
            for (const [width, height] of [[390, 366], [768, 430]]) {
                Object.assign(runtime, { host: { clientWidth: width, clientHeight: height } });
                for (const [x, z, rotation, raised] of [[0, 0, 0, 0], [3.5, -2, Math.PI * .8, .4], [-3, 4, -Math.PI * .5, .15]]) {
                    resident.group.position.set(x, 0, z); resident.group.rotation.y = rotation;
                    resident.pose.position.y = raised;
                    const before = { root: resident.group.position.toArray(), rotation: resident.group.rotation.toArray(), pose: resident.pose.position.toArray() };
                    runtime.captureImage();
                    const projected = boxCorners(new THREE.Box3().setFromObject(resident.group, true)).map(point => point.project(camera));
                    expect(projected.every(point => Math.abs(point.x) < .96 && Math.abs(point.y) < .96)).toBe(true);
                    expect(Math.max(...projected.map(point => point.y)) - Math.min(...projected.map(point => point.y))).toBeGreaterThan(.7);
                    expect({ root: resident.group.position.toArray(), rotation: resident.group.rotation.toArray(), pose: resident.pose.position.toArray() }).toEqual(before);
                }
            }
            const view = camera.matrixWorld.toArray();
            Object.assign(runtime, { state: { learning: false, photographing: false, residentPortraitId: species } });
            resident.group.position.x += 5; runtime.captureImage();
            expect(camera.matrixWorld.toArray()).toEqual(view); // Ordinary view never follows a leftover portrait id.
        } finally { resident.disposeAppearance(); disposeGeometry(resident.group); materials.dispose(); }
    });
});


describe('display photo uses the actual scene before encoding', () => {
    it.each([[390, 354], [768, 430]])('checks live tree occlusion before a %s×%s capture', (width, height) => {
        const { runtime, camera, renderer, order, scene } = captureHarness();
        const island = createIsland('camera-call-geometry-fixture', 0), displays = new IslandSharedDisplayScene();
        const state = { ...island, sharedMemories: { version: 1 as const, memories: [], nextMemoryOrder: 1, displays: {
            'display-1': { target: resolveSharedTarget(island, { kind: 'specimen', specimenId: 'driftwood' }),
                position: { x: .20, z: -.60 }, rotation: Math.PI / 2, arrangement: 'plain' as const, placedAt: 0 } } } };
        displays.update(state); scene.add(displays.group);
        Object.assign(runtime, { scene, sharedDisplays: displays, host: { clientWidth: width, clientHeight: height },
            state: { learning: false, photographing: true, shared: { active: true, island: state, focusDisplayId: 'display-1' } } });
        try {
            let renderedView: number[] | undefined;
            renderer.render.mockImplementation(() => { renderedView = camera.matrixWorld.toArray(); order.push('render'); });
            expect(runtime.captureImage()).toBe('data:image/png;base64,actual-render');
            expect(sharedDisplayCameraDiagnostic(camera)?.readable).toBe(true);
            expect(sharedDisplayCameraDiagnostic(camera)?.angle).not.toBe(0);
            expect(renderedView).toEqual(camera.matrixWorld.toArray()); expect(order).toEqual(['render', 'encode']);
            const bounds = displays.describe()[0].displayBounds;
            expect(boxCorners(bounds).every(point => { point.project(camera); return Math.abs(point.x) <= .861 && Math.abs(point.y) <= .861; })).toBe(true);
            // Leaving explicit display focus preserves the ordinary camera.
            Object.assign(runtime, { state: { learning: false, photographing: false } });
            camera.position.set(4, 5, -10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
            const ordinary = camera.matrixWorld.toArray(); runtime.captureImage();
            expect(camera.matrixWorld.toArray()).toEqual(ordinary);
        } finally { displays.dispose(); }
    });
});
