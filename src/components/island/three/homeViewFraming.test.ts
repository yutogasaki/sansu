import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { IslandResident } from './animals';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandCameraControls } from './islandCameraControls';
import { disposeGeometry, IslandMaterials } from './primitives';
import { IslandScene } from './runtime';
import { boxCorners } from './sceneFraming';
import type { IslandStageState } from './types';

function fixture(width = 390, height = 657) {
    const island = createIsland('home-view-framing', 0);
    const state: IslandStageState = { ...island, pulse: 0, learning: false, districtFocus: 'home' };
    const world = new IslandCosmeticScenery(); world.updateGrowth(state);
    const materials = new IslandMaterials();
    const residents = [new IslandResident('otter', materials, [.1, 0, 1.6], () => undefined),
        new IslandResident('rabbit', materials, [2.45, 0, 1.45], () => undefined)];
    const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
    const controls = new IslandCameraControls(() => undefined);
    const runtime = Object.create(IslandScene.prototype) as { resize(): void; state: IslandStageState };
    const host = { clientWidth: width, clientHeight: height };
    Object.assign(runtime, { camera, host, state, residents, world,
        renderer: { setSize: () => undefined, getSize: (size: THREE.Vector2) => size.set(host.clientWidth, host.clientHeight) },
        rendererSize: new THREE.Vector2(), cameraControls: controls,
        expansion: world.expansion, westExpansion: world.westExpansion, items: new Map(),
        learningFocus: new THREE.Vector3(.8, .55, 1), learningBounds: residents.map(resident => resident.learningFrameBounds()),
        placeCycleAccent: () => undefined, requestFrame: () => undefined });
    return { runtime, state, world, residents, camera, controls, host,
        frame() { runtime.resize(); return [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]; },
        dispose() { world.dispose(); residents.forEach(resident => disposeGeometry(resident.group)); materials.dispose(); } };
}

describe('layout-owned close phone home', () => {
    it('enlarges nearby life while retaining both residents and the house, without entering manual camera mode', () => {
        const f = fixture();
        try {
            f.frame(); const originalHeight = f.camera.top - f.camera.bottom;
            const roots = f.residents.map(resident => resident.group.position.toArray());
            f.state.closeHomeView = true; f.frame();
            expect(originalHeight / (f.camera.top - f.camera.bottom)).toBeCloseTo(1.3);
            expect(f.controls.view).toEqual({ zoom: 1, azimuth: 0, pan: { x: 0, y: 0 }, manual: false });
            for (const object of [...f.residents.map(resident => resident.group),
                ...f.world.partObjects('houseBody'), ...f.world.partObjects('houseRoof')]) {
                // House appearance diagnostics also contain the locked, hidden
                // lighthouse; only the actual visible cottage belongs to home.
                if (object.parent === f.world.lighthouse) continue;
                const bounds = new THREE.Box3().setFromObject(object, true);
                if (bounds.isEmpty()) continue;
                const points = boxCorners(bounds);
                for (const point of points) {
                    point.project(f.camera);
                    expect(Math.max(Math.abs(point.x), Math.abs(point.y)), object.name).toBeLessThan(.98);
                }
            }
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(roots);
        } finally { f.dispose(); }
    });

    it('keeps the first deliberate zoom continuous relative to the closer base frame', () => {
        const f = fixture();
        try {
            f.state.closeHomeView = true; f.frame(); const baseHeight = f.camera.top - f.camera.bottom;
            f.controls.action('in'); f.frame();
            expect(baseHeight / (f.camera.top - f.camera.bottom)).toBeCloseTo(1.25);
            expect(f.controls.view.manual).toBe(true);
            f.controls.reset(); f.frame();
            expect(f.camera.top - f.camera.bottom).toBeCloseTo(baseHeight);
            expect(f.controls.view.manual).toBe(false);
        } finally { f.dispose(); }
    });

    it.each([[768, 900], [1024, 600], [390, 330]])('leaves the existing %sx%s framing unchanged', (width, height) => {
        const f = fixture(width, height);
        try {
            const original = f.frame(); f.state.closeHomeView = true;
            expect(f.frame()).toEqual(original);
        } finally { f.dispose(); }
    });

    it.each([
        { districtFocus: 'all' }, { districtFocus: 'east' }, { districtFocus: 'west' },
        { photographing: true }, { readOnly: true }, { readOnly: true, comparisonHabitat: 'garden' },
        { learning: true }, { preview: { id: 'move', kind: 'flower', position: { x: 0, z: 1 }, rotation: 0 } },
        { playRequest: { id: 'replay', itemId: 'flower' } },
    ] satisfies Partial<IslandStageState>[])('does not alter the dedicated or overview frame: %j', overrides => {
        const f = fixture();
        try {
            Object.assign(f.state, overrides);
            const original = f.frame(); f.state.closeHomeView = true;
            expect(f.frame()).toEqual(original);
            expect(f.controls.view.manual).toBe(false);
        } finally { f.dispose(); }
    });

    it('returns from the whole-island view to the same close home frame', () => {
        const f = fixture();
        try {
            f.state.closeHomeView = true; const close = f.frame();
            f.state.districtFocus = 'all'; const overview = f.frame();
            expect(overview).not.toEqual(close);
            f.state.closeHomeView = false; expect(f.frame()).toEqual(overview);
            f.state.closeHomeView = true; f.state.districtFocus = 'home';
            expect(f.frame()).toEqual(close);
            expect(f.controls.view.manual).toBe(false);
        } finally { f.dispose(); }
    });

    it('lets an automatic shared activity keep its authored camera with manual mode still off', () => {
        const f = fixture();
        try {
            const shared = { position: new THREE.Vector3(3, 4, 6), quaternion: new THREE.Quaternion(),
                left: -2, right: 2, top: 3, bottom: -3 };
            Object.assign(f.runtime, { sharedCamera: {}, sharedActivity: { plan: {} }, fitSharedFrame: () => shared });
            const original = f.frame(); f.state.closeHomeView = true;
            expect(f.frame()).toEqual(original);
            expect(f.camera.position.toArray()).toEqual([3, 4, 6]);
            expect(f.controls.view.manual).toBe(false);
        } finally { f.dispose(); }
    });
});
