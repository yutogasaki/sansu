import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cameraPanHull, frameIslandCameraPan, type CameraPanFraming } from './cameraPanFraming';
import { IslandCameraControls } from './islandCameraControls';
import { IslandScene } from './runtime';
import { createIsland, getIslandLandAccess, getIslandLands } from '../../../domain/island/catalog';
import { islandTerrainEnvelope } from './terrainProfile';
import type { IslandStageState } from './types';
import { IslandHomePresentation } from './homePresentation';

const base: CameraPanFraming = { center: { x: 0, y: 0 }, height: 10, aspect: 2,
    bounds: { minX: -9, maxX: 9, minY: -4, maxY: 4 }, regions: [] };

describe('bounded camera pan after the authored fit', () => {
    it('keeps the complete 1x overview exact and never drifts off its original margins', () => {
        const frame = frameIslandCameraPan(base, 1, { x: 1e6, y: -1e6 });
        expect(frame).toEqual({ left: -10, right: 10, top: 5, bottom: -5, width: 20, height: 10, pan: { x: 0, y: 0 } });
    });
    it('allows a local starting view to reach earned land on both sides', () => {
        const local = { ...base, aspect: 1, bounds: { ...base.bounds, minX: -15, maxX: 15 } };
        expect(frameIslandCameraPan(local, 1, { x: 14, y: 0 }).pan.x).toBe(10);
        expect(frameIslandCameraPan(local, 1, { x: -14, y: 0 }).pan.x).toBe(-10);
        expect(frameIslandCameraPan(local, 6, { x: 1e6, y: -1e6 }).right).toBeCloseTo(15);
    });
    it('keeps a highly zoomed frame near the real silhouette rather than the empty corners of its rectangle', () => {
        const outline = [{ x: -8, y: 0 }, { x: 0, y: -3 }, { x: 8, y: 0 }, { x: 0, y: 3 }];
        const frame = frameIslandCameraPan({ ...base, regions: [cameraPanHull(outline)] }, 6, { x: 1e6, y: 1e6 });
        const boundary = outline.flatMap((point, index) => Array.from({ length: 101 }, (_, step) => ({
            x: point.x + (outline[(index + 1) % outline.length].x - point.x) * step / 100,
            y: point.y + (outline[(index + 1) % outline.length].y - point.y) * step / 100,
        })));
        const inside = boundary.some(point => point.x > frame.left && point.x < frame.right && point.y > frame.bottom && point.y < frame.top);
        // The actual land edge remains visibly inside; the bbox-only result is entirely over sea.
        expect(inside).toBe(true);
        expect(frame.pan.y).toBeLessThan(4);
        expect(cameraPanHull([...outline, ...outline].reverse())).toEqual(cameraPanHull(outline));
    });
});

function runtime(width: number, height: number, level: 0 | 1 | 2, district: 'all' | 'home' = 'all') {
    const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    const island = createIsland('camera-pan-regression', 1);
    const state: IslandStageState = { ...island, learning: false, pulse: 0, districtFocus: district,
        growth: { ...island.growth!, expansionLevel: level } };
    const scene = Object.create(IslandScene.prototype) as { resize(): void; state: IslandStageState; controlCamera(action: 'in' | 'right' | 'reset'): void };
    const controls = new IslandCameraControls(() => scene.resize());
    const host = { clientWidth: width, clientHeight: height };
    const homePresentation = new IslandHomePresentation();
    Object.assign(scene, { camera, host, rendererSize: new THREE.Vector2(),
        renderer: { setSize: vi.fn(), getSize: (size: THREE.Vector2) => size.set(host.clientWidth, host.clientHeight) },
        cameraControls: controls, state, expansion: { visible: level >= 1 }, westExpansion: { visible: level >= 2 },
        items: new Map(), homePresentation, requestFrame: vi.fn() });
    scene.resize();
    return { scene, camera, controls, host, state, homePresentation, viewport: { left: 0, top: 0, width, height } };
}

describe('real normal-island runtime framing', () => {
    it('lets a manual camera action cancel the house transition without its later frame taking control back', () => {
        const h = runtime(390, 380, 1);
        h.homePresentation.begin(h.camera, 0, false);
        h.scene.controlCamera('in');
        const matrix = [...h.camera.matrixWorld.elements, ...h.camera.projectionMatrix.elements];
        expect(h.homePresentation.animate(h.camera, 260, false)).toBe(false);
        expect([...h.camera.matrixWorld.elements, ...h.camera.projectionMatrix.elements]).toEqual(matrix);
        expect(h.controls.view.zoom).toBe(1.25);
    });
    it.each([[390, 380], [768, 470]])('retains a zoomed world point and pan through repeated fits at %s×%s', (width, height) => {
        const h = runtime(width, height, 2);
        const point = new THREE.Vector3(3, .1, 1), before = point.clone().project(h.camera);
        const cursor = { x: (before.x + 1) * width / 2, y: (1 - before.y) * height / 2 };
        h.controls.wheel(-160, cursor, h.viewport);
        const after = point.clone().project(h.camera);
        expect(after.x).toBeCloseTo(before.x, 10); expect(after.y).toBeCloseTo(before.y, 10);
        h.controls.down(1, cursor); h.controls.move(1, { x: cursor.x - 70, y: cursor.y + 30 }, h.viewport);
        const view = structuredClone(h.controls.view), matrix = h.camera.projectionMatrix.toArray();
        h.scene.state = { ...h.state, pulse: 1 }; h.scene.resize(); h.scene.resize();
        expect(h.controls.view).toEqual(view); expect(h.camera.projectionMatrix.toArray()).toEqual(matrix);
        h.host.clientWidth *= .9; h.scene.resize();
        expect(h.controls.view.pan.x).toBeCloseTo(view.pan.x, 10); expect(h.controls.view.pan.y).toBeCloseTo(view.pan.y, 10);
        const photo = h.camera.projectionMatrix.toArray(); h.scene.state = { ...h.scene.state, photographing: true };
        h.scene.controlCamera('in'); expect(h.camera.projectionMatrix.toArray()).toEqual(photo);
        expect(h.controls.view.zoom).toBe(view.zoom);
    });

    it.each([0, 1, 2] as const)('constrains extreme swipes to the earned world, expansion %s', level => {
        const h = runtime(390, 380, level);
        for (let count = 0; count < 20; count++) h.controls.action('in');
        expect(h.controls.view.zoom).toBe(6);
        const lands = getIslandLands(getIslandLandAccess(h.state));
        for (const end of [{ x: 1e6, y: 1e6 }, { x: -1e6, y: -1e6 }, { x: 1e6, y: -1e6 }]) {
            h.controls.down(1, { x: 190, y: 190 }); h.controls.move(1, end, h.viewport); h.controls.up(1, end);
            const points = lands.flatMap(islandTerrainEnvelope).map(point => new THREE.Vector3(...point).project(h.camera));
            // At least one actual rendered shore point remains inside the viewport after enormous input.
            expect(points.some(point => Math.abs(point.x) < 1 && Math.abs(point.y) < 1)).toBe(true);
            expect(Math.abs(h.controls.view.pan.x)).toBeLessThan(30);
            expect(Math.abs(h.controls.view.pan.y)).toBeLessThan(20);
        }
    });

    it('allows movement from the home district to another earned district without changing saved poses', () => {
        const h = runtime(390, 380, 2, 'home'), saved = JSON.stringify(h.state);
        const east = new THREE.Vector3(7.3, 0, 0), before = east.clone().project(h.camera);
        h.controls.down(1, { x: 195, y: 190 }); h.controls.move(1, { x: -155, y: 190 }, h.viewport);
        expect(Math.abs(east.clone().project(h.camera).x)).toBeLessThan(Math.abs(before.x));
        expect(h.controls.view.pan.x).toBeGreaterThan(4);
        expect(JSON.stringify(h.state)).toBe(saved);
        h.controls.action('reset'); expect(h.controls.view.pan).toEqual({ x: 0, y: 0 });
    });
});
