import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HomeCameraControls, canControlHomeCamera, HOME_MAX_ZOOM, HOME_MIN_ZOOM } from './homeCameraControls';
import type { IslandStageState } from './types';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';
import { fitIslandHomeInteriorCamera } from './homeInteriorCamera';

function setup() {
    const room = new THREE.Group(); room.position.set(-2.6, .18, -2.25); room.scale.setScalar(.26); room.rotation.y = .12;
    room.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(62, 390 / 617, .01, 100);
    camera.position.copy(room.localToWorld(new THREE.Vector3(.85, 2.8, 4.62)));
    camera.lookAt(room.localToWorld(new THREE.Vector3(.7, .75, 2.65))); camera.updateMatrixWorld(true);
    const controls = new HomeCameraControls(); controls.prepare(camera, room);
    return { camera, room, controls };
}

describe('indoor camera gestures', () => {
    it('keeps a still tap but never turns drag, pinch, released pinch fingers or cancellation into taps', () => {
        const { controls } = setup();
        controls.down(1, { x: 100, y: 100 }); controls.move(1, { x: 103, y: 104 }, 600);
        expect(controls.up(1, { x: 103, y: 104 })).toBe(true); expect(controls.view.manual).toBe(false);
        controls.down(1, { x: 100, y: 100 }); controls.move(1, { x: 150, y: 130 }, 600); controls.move(1, { x: 100, y: 100 }, 600);
        expect(controls.up(1, { x: 100, y: 100 })).toBe(false); expect(controls.view.manual).toBe(true);
        controls.down(1, { x: 100, y: 100 }); controls.down(2, { x: 200, y: 100 });
        controls.move(2, { x: 230, y: 150 }, 600);
        expect(controls.view.zoom).toBeGreaterThan(1); expect(controls.view.azimuth).not.toBe(0);
        expect(controls.up(1, { x: 100, y: 100 })).toBe(false);
        expect(controls.up(2, { x: 230, y: 150 })).toBe(false);
        controls.down(1, { x: 100, y: 100 }); controls.cancel();
        expect(controls.up(1, { x: 100, y: 100 })).toBe(false);
    });
    it('freezes a manual view across automatic camera updates, preserves finite bounds, and resets transient gestures', () => {
        const { camera, room, controls } = setup();
        controls.action('in'); const manual = structuredClone(controls.view);
        camera.position.set(0, 99, 0); controls.prepare(camera, room);
        expect(controls.view).toEqual(manual);
        for (const direction of ['left', 'right', 'up', 'down', 'turn-left', 'turn-right'] as const) {
            for (let i = 0; i < 50; i++) {
                controls.action(direction); expect(controls.apply(camera, room, 390 / 617)).toBe(true);
                const eye = room.worldToLocal(camera.position.clone());
                expect(eye.x).toBeGreaterThanOrEqual(-3.20001); expect(eye.x).toBeLessThanOrEqual(3.20001);
                expect(eye.y).toBeGreaterThanOrEqual(.29999); expect(eye.y).toBeLessThanOrEqual(3.50001);
                expect(eye.z).toBeGreaterThanOrEqual(-.15001); expect(eye.z).toBeLessThanOrEqual(4.75001);
                expect(camera.matrixWorld.elements.every(Number.isFinite)).toBe(true);
            }
        }
        for (let i = 0; i < 100; i++) controls.action('in'); expect(controls.view.zoom).toBe(HOME_MAX_ZOOM);
        for (let i = 0; i < 100; i++) controls.action('out'); expect(controls.view.zoom).toBe(HOME_MIN_ZOOM);
        const before = structuredClone(controls.view); controls.wheel(NaN); expect(controls.view).toEqual(before);
        controls.down(1, { x: 100, y: 100 }); controls.reset();
        expect(controls.view.manual).toBe(false); expect(controls.apply(camera, room, 1)).toBe(false);
        expect(controls.up(1, { x: 100, y: 100 })).toBe(false);
    });
    it('casts back to the same real surface after pan, zoom, rotation and viewport resize', () => {
        const { camera, room, controls } = setup();
        const item = new THREE.Mesh(new THREE.BoxGeometry(.6, .12, .4), new THREE.MeshBasicMaterial());
        item.position.set(0, .65, 2.5); room.add(item); room.updateMatrixWorld(true);
        for (const aspect of [390 / 617, 768 / 800, 320 / 340]) {
            controls.action('left'); controls.action('in'); controls.action('turn-right'); controls.apply(camera, room, aspect);
            const center = item.getWorldPosition(new THREE.Vector3()).project(camera);
            const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(center.x, center.y), camera);
            expect(ray.intersectObject(item)[0]?.object).toBe(item);
        }
        item.geometry.dispose(); item.material.dispose();
    });
    it('keeps the real enclosed room in every viewport corner through a full turn and extreme pans', () => {
        const room = new IslandLearningKeepsakeScenery(); room.group.scale.setScalar(.26); room.update(undefined, 0, true);
        const camera = new THREE.PerspectiveCamera(), controls = new HomeCameraControls();
        try {
            fitIslandHomeInteriorCamera(camera, room, 390 / 617, true);
            controls.prepare(camera, room.group); controls.action('out');
            for (let turn = 0; turn < 18; turn++) {
                controls.action('turn-right');
                for (const aspect of [390 / 617, 768 / 800, 320 / 340]) {
                    controls.apply(camera, room.group, aspect);
                    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
                        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x, y), camera); ray.near = camera.near;
                        expect(ray.intersectObject(room.group, true).some(hit => {
                            for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) if (!node.visible) return false;
                            return true;
                        }), `enclosure at turn ${turn}, aspect ${aspect}, ${x}/${y}`).toBe(true);
                    }
                }
            }
        } finally { room.dispose(); }
    });
    it('permits only room overview, leaving detail, decor, photography and learning automatic', () => {
        const state = { learningKeepsakes: { closeOverview: true } } as IslandStageState;
        expect(canControlHomeCamera(state)).toBe(true);
        expect(canControlHomeCamera()).toBe(false);
        for (const patch of [{ learning: true }, { photographing: true }, { learningKeepsakes: { closeOverview: true, decorating: true } },
            { learningKeepsakes: { closeOverview: true, selectedId: 'first-completion' as const } }, { learningKeepsakes: { closeOverview: false } }]) {
            expect(canControlHomeCamera({ ...state, ...patch })).toBe(false);
        }
    });
});
