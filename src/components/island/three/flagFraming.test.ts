import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIslandAppearance } from '../../../domain/island/appearance';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandExperience, ISLAND_EMBLEMS } from '../../../domain/island/experience';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { fitIslandFlagCamera } from './flagFraming';
import { IslandPersonalScenery } from './personalScenery';
import { IslandScene } from './runtime';
import type { IslandFlagFrame } from './flagFraming';
import type { IslandStageState } from './types';

function personal() {
    // Canvas API only: these tests measure actual 3D geometry, not font legibility.
    const context = { fillRect() {}, fillText() {}, measureText: () => ({ width: 400 }) };
    return new IslandPersonalScenery(() => ({ getContext: () => context }) as unknown as HTMLCanvasElement);
}
const camera = () => new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
const matrix = (view: THREE.Camera) => [...view.matrixWorld.toArray(), ...view.projectionMatrix.toArray()];
function vertices(object: THREE.Object3D) {
    object.updateWorldMatrix(true, true); const points: THREE.Vector3[] = [];
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const attribute = child.geometry.getAttribute('position');
        for (let i = 0; i < attribute.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(child.matrixWorld));
    }); return points;
}
const geometryIds = (object: THREE.Object3D) => {
    const ids: string[] = []; object.traverse(child => { if (child instanceof THREE.Mesh) ids.push(child.geometry.uuid); }); return ids;
};

describe('inspection of the actual island flag', () => {
    it.each([[390, 295], [768, 380]])('fits trim, every free emblem and nameplate without changing comparison scale at %s×%s', (width, height) => {
        const identity = personal(), view = camera(), original = getIslandExperience({});
        let baseline: number[] | undefined;
        try {
            identity.update(original, null, true);
            const flag = identity.flagView!, uuids = [flag.flag.uuid, flag.trim.uuid, flag.nameplate.uuid], geometry = geometryIds(identity.group);
            for (const emblem of ISLAND_EMBLEMS) for (const trim of [null, 'leaf-bird-flag-trim', null, 'leaf-bird-flag-trim'] as const) {
                identity.update({ ...original, islandName: 'あいうえおかきくけこさしすせそた', emblem }, trim, true);
                const actual = identity.flagView!;
                fitIslandFlagCamera(view, actual, width / height);
                baseline ??= matrix(view); expect(matrix(view)).toEqual(baseline);
                expect([actual.flag.uuid, actual.trim.uuid, actual.nameplate.uuid]).toEqual(uuids);
                expect(geometryIds(identity.group)).toEqual(geometry);
                const projected = vertices(identity.group).map(p => p.project(view));
                expect(projected.every(p => Math.abs(p.x) < .94 && Math.abs(p.y) < .94 && Math.abs(p.z) < 1)).toBe(true);
                // The real two-line preview notice occupies the right half in
                // this view. Protect that CSS envelope without shrinking text.
                const noticeLeft = width - 12 - Math.min(164, width / 2 - 24);
                const flagRight = Math.max(...vertices(actual.flag).map(p => (1 + p.project(view).x) * width / 2));
                expect(flagRight).toBeLessThan(noticeLeft - 8);
                const flagTop = Math.min(...vertices(actual.flag).map(p => (1 - p.project(view).y) * height / 2));
                expect(flagTop).toBeGreaterThan(44);
                if (trim) {
                    const bounds = new THREE.Box3().setFromPoints(vertices(actual.trim).map(p => p.project(view)));
                    expect((bounds.max.x - bounds.min.x) * width / 2).toBeGreaterThan(23);
                }
                expect(identity.group.userData.islandName).toBe('あいうえおかきくけこさしすせそた');
                expect(actual.flag.getObjectByName(`island-emblem-${emblem}`)?.visible).toBe(true);
            }
            expect(original).toEqual(getIslandExperience({}));
        } finally { identity.dispose(); }
    });

    it('keeps identity and trim in front of actual mature house shapes for legacy and independent styles', () => {
        const identity = personal(), world = new IslandCosmeticScenery(), view = camera(), island = createIsland('flag-view', 0);
        const scene = new THREE.Scene(); scene.add(world.group, identity.group);
        try {
            identity.update(getIslandExperience({}), 'leaf-bird-flag-trim', true);
            fitIslandFlagCamera(view, identity.flagView!, 390 / 295);
            const targets = ['island-flag-cloth', 'flag-trim-leaf-body', 'flag-trim-bird-head', 'flag-trim-bird-beak', 'island-nameplate-text'];
            for (const family of ['moon-garden', 'starry', 'candy', 'crystal'] as const) for (const version of ['legacy-v1', 'parts-v1'] as const) {
                world.updateAppearance({ themeId: family, accentId: null, appearance: createIslandAppearance(family, version) });
                world.updateGrowth({ ...island, items: [], learning: false, pulse: 0,
                    growth: { ...island.growth!, progress: { ...island.growth!.progress, village: 6, grove: 6 } } });
                scene.updateMatrixWorld(true);
                for (const name of targets) {
                    const target = identity.group.getObjectByName(name)!;
                    const bounds = new THREE.Box3().setFromPoints(vertices(target));
                    const point = bounds.getCenter(new THREE.Vector3()); point.z = bounds.max.z;
                    const points = name.startsWith('flag-trim-')
                        ? [...new Map(vertices(target).map(vertex => [vertex.toArray().map(n => n.toFixed(6)).join(','), vertex])).values(), point] : [point];
                    for (const sample of points) {
                        const ndc = sample.clone().project(view), ray = new THREE.Raycaster();
                        ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), view);
                        const hit = ray.intersectObject(world.group, true).find(hit => {
                            let object: THREE.Object3D | null = hit.object;
                            while (object) { if (!object.visible) return false; object = object.parent; }
                            return true;
                        });
                        expect(!hit || hit.distance >= ray.ray.origin.distanceTo(sample) - .005,
                            `${family}/${version}/${name}/${sample.toArray()}`).toBe(true);
                    }
                }
            }
        } finally { identity.dispose(); world.dispose(); }
    });

    it('temporarily reveals default identity, preserves its objects through cancellation and restores original visibility', () => {
        const identity = personal(), state = getIslandExperience({}), before = structuredClone(state);
        try {
            identity.update(state); expect(identity.flagView).toBeUndefined(); expect(identity.group.visible).toBe(false);
            identity.update(state, null, true); const flag = identity.flagView!;
            expect(flag.root.visible).toBe(true); expect(flag.trim.visible).toBe(false);
            identity.update(state, 'leaf-bird-flag-trim', true); expect(flag.trim.visible).toBe(true);
            identity.update(state, null, true); expect(flag.root.visible).toBe(true); expect(flag.trim.visible).toBe(false);
            identity.update(state); expect(flag.root.visible).toBe(false);
            identity.update(state, 'leaf-bird-flag-trim'); expect(flag.root.visible).toBe(true);
            expect(identity.flagView!.flag).toBe(flag.flag); expect(state).toEqual(before);
        } finally { identity.dispose(); }
    });

    it('the unchanged short thread connects the actual cloth edge to the leaf body above the dome', () => {
        const identity = personal();
        try {
            identity.update(undefined, 'leaf-bird-flag-trim', true);
            const actual = identity.flagView!, thread = actual.trim.getObjectByName('flag-trim-thread') as THREE.Mesh;
            const body = actual.trim.getObjectByName('flag-trim-leaf-body') as THREE.Mesh;
            const cloth = actual.flag.getObjectByName('island-flag-cloth') as THREE.Mesh;
            identity.group.updateMatrixWorld(true);
            const upper = thread.localToWorld(new THREE.Vector3(0, -.095 / 2, 0));
            const lower = thread.localToWorld(new THREE.Vector3(0, .095 / 2, 0));
            const localUpper = cloth.worldToLocal(upper.clone());
            expect(localUpper.x).toBeCloseTo(.28, 7); expect(Math.abs(localUpper.y)).toBeLessThan(.21);
            expect(localUpper.z).toBeCloseTo(0, 7); expect(upper.distanceTo(lower)).toBeCloseTo(.095, 7);
            const ray = new THREE.Raycaster(upper, lower.clone().sub(upper).normalize(), 0, .095);
            expect(ray.intersectObject(body, false).length).toBeGreaterThan(0);
            // Every actual bird vertex clears the old and new starry dome's y=2.66 top.
            const bottom = Math.min(...vertices(actual.trim).map(point => point.y));
            expect(bottom).toBeGreaterThan(2.66);
            const resources = geometryIds(identity.group), instance = actual.trim.uuid;
            identity.update(undefined, null, true); identity.update(undefined, 'leaf-bird-flag-trim', true);
            expect(identity.flagView!.trim.uuid).toBe(instance); expect(geometryIds(identity.group)).toEqual(resources);
        } finally { identity.dispose(); }
    });

    it('the runtime releases flag focus for overview, resident portraits, another product and learning', () => {
        const identity = personal(), view = camera();
        const runtime = Object.create(IslandScene.prototype) as { state: IslandStageState; flagFrame?: IslandFlagFrame;
            frameExpressionFlag(): boolean; inspectingFlag: boolean };
        Object.assign(runtime, { camera: view, personal: identity, host: { clientWidth: 390, clientHeight: 295 },
            state: { items: [], completedSets: 0, pulse: 0, learning: false, readOnly: true, expressionFlagFocus: true } });
        try {
            identity.update(undefined, null, runtime.inspectingFlag);
            expect(runtime.frameExpressionFlag()).toBe(true); const original = matrix(view);
            identity.update(undefined, 'leaf-bird-flag-trim', runtime.inspectingFlag);
            expect(runtime.frameExpressionFlag()).toBe(true); expect(matrix(view)).toEqual(original);
            for (const change of [{ expressionFlagFocus: false }, { learning: true }, { expressionResidentId: 'otter' as const },
                { residentPortraitId: 'rabbit' as const }, { cosmeticFocus: 'houseRoof' as const }]) {
                const previous = runtime.state; runtime.state = { ...previous, ...change };
                expect(runtime.frameExpressionFlag()).toBe(false); expect(runtime.flagFrame).toBeUndefined();
                // Release does not move another camera; the normal runtime resize owns its next frame.
                expect(matrix(view)).toEqual(original); runtime.state = previous;
            }
        } finally { identity.dispose(); }
    });

    it('the real resize path returns to the same overview and can revisit the same flag frame', () => {
        const identity = personal(), view = camera();
        const runtime = Object.create(IslandScene.prototype) as { state: IslandStageState; resize(): void; flagFrame?: IslandFlagFrame };
        Object.assign(runtime, { camera: view, personal: identity, host: { clientWidth: 390, clientHeight: 295 },
            rendererSize: new THREE.Vector2(), renderer: { getSize: (size: THREE.Vector2) => size.set(390, 295) },
            expansion: { visible: false }, westExpansion: { visible: false }, items: new Map(), requestFrame() {},
            // The other optional views are inactive in this isolated resize fixture.
            frameResidentPortrait: () => false, frameExpressionResident: () => false, frameSharedDisplay: () => false,
            frameOptionalFurniture: () => false,
            state: { items: [], completedSets: 0, pulse: 0, learning: false, readOnly: true } });
        try {
            runtime.resize(); const overview = matrix(view);
            runtime.state.expressionFlagFocus = true; identity.update(undefined, null, true);
            runtime.resize(); const closeup = matrix(view); expect(closeup).not.toEqual(overview);
            runtime.state.expressionFlagFocus = false; identity.update(); runtime.resize();
            expect(matrix(view)).toEqual(overview); expect(runtime.flagFrame).toBeUndefined();
            runtime.state.expressionFlagFocus = true; identity.update(undefined, 'leaf-bird-flag-trim', true); runtime.resize();
            expect(matrix(view)).toEqual(closeup);
        } finally { identity.dispose(); }
    });
});
