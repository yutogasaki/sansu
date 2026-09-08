import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import { IslandResident } from './animals';
import { ExpressionResidentWalk } from './expressionResidentWalk';
import { ExpressionFootTrails } from './expressionFootTrails';
import { IslandMaterials, disposeGeometry } from './primitives';
import { createIsland } from '../../../domain/island/catalog';
import { createIslandExpressionSelection } from '../../../domain/island/expression';
import type { IslandStageState } from './types';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
    vi.stubGlobal('window', { clearTimeout: vi.fn() }); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('document', { hidden: false });
    const materials = new IslandMaterials(), resident = new IslandResident('otter', materials, [-1, 0, 2], () => {});
    const scene = new THREE.Scene(); scene.add(resident.group);
    const walk = new ExpressionResidentWalk([resident]), trails = new ExpressionFootTrails([resident]); scene.add(trails.group);
    const selection = createIslandExpressionSelection(); selection.residents.otter.trail = 'leaf-trail';
    const request = { id: 'readonly-walk', residentId: 'otter' as const };
    walk.set({ request, items: [], land: 0, obstacles: [] });
    for (let now = 0; now <= 700; now += 40) {
        walk.update(now, false); trails.update(selection, new Set(['otter']), 0, now, true, false);
    }
    expect(trails.describe()[0].marks.some(mark => mark.visible)).toBe(true);
    const runtime = Object.create(IslandScene.prototype) as {
        state: IslandStageState; pause(): void; updateMotionPreference(): void; frameExpressionResident(): boolean;
    };
    const state: IslandStageState = { ...createIsland('expression-runtime', 0), items: [], learning: false, readOnly: true, pulse: 0,
        expressionSelection: selection, expressionResidentId: 'otter', expressionWalkRequest: request };
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100), requestFrame = vi.fn();
    const host = { clientWidth: 390, clientHeight: 295, dataset: {} as Record<string, string> };
    Object.assign(runtime, { state, expressionWalk: walk, expressionTrails: trails, residents: [resident], camera,
        host, motion: { matches: true }, requestFrame,
        optionalFurniture: { active: false, cancel: vi.fn() }, sharedJobs: { active: false, stop: vi.fn() },
        workshop: { stop: vi.fn() }, workshopPresentation: { restore: vi.fn() }, pointerCancel: vi.fn(),
        cancelLivingActivity: vi.fn(), clearOrdinaryInterest: vi.fn() });
    return { runtime, resident, walk, trails, request, requestFrame, camera, host, dispose() {
        walk.dispose(); trails.dispose(); resident.disposeAppearance(); disposeGeometry(scene); materials.dispose();
    } };
}
describe('expression rendering stays optional inside a read-only scene', () => {
    it('pause restores the actual resident, clears every live mark and consumes the interrupted request', () => {
        const f = fixture(), uuid = f.resident.group.uuid;
        f.runtime.pause();
        expect(f.walk.active).toBe(false); expect(f.trails.describe()[0].marks.every(mark => !mark.visible)).toBe(true);
        expect(JSON.parse(f.host.dataset.islandExpression).walk).toBeNull();
        expect(JSON.parse(f.host.dataset.islandExpression).trails[0].marks.every((mark: { visible: boolean }) => !mark.visible)).toBe(true);
        expect(f.resident.group.uuid).toBe(uuid); expect(f.resident.group.position.toArray()).toEqual([-1, 0, 2]);
        f.walk.set({ request: f.request, items: [], land: 0, obstacles: [] }); f.walk.update(10000, false);
        expect(f.walk.active).toBe(false); f.dispose();
    });
    it('changing reduced motion schedules the owned temporary rig instead of resetting it through ordinary updates', () => {
        const f = fixture(), original = f.resident.group.position.toArray(), ordinary = vi.spyOn(f.resident, 'update');
        f.runtime.updateMotionPreference(); expect(f.requestFrame).toHaveBeenCalledOnce(); expect(ordinary).not.toHaveBeenCalled();
        expect(f.resident.group.position.toArray()).toEqual(original); expect(f.walk.active).toBe(true); f.dispose();
    });
    it('frames the actual read-only trial and releases that camera on learning and exit', () => {
        const f = fixture();
        expect(f.runtime.frameExpressionResident()).toBe(true);
        const before = [...f.camera.matrixWorld.toArray(), ...f.camera.projectionMatrix.toArray()];
        const original = f.resident.group.position.toArray();
        f.runtime.state = { ...f.runtime.state, learning: true };
        expect(f.runtime.frameExpressionResident()).toBe(false);
        expect([...f.camera.matrixWorld.toArray(), ...f.camera.projectionMatrix.toArray()]).toEqual(before);
        expect(f.resident.group.position.toArray()).toEqual(original);
        f.runtime.state = { ...f.runtime.state, learning: false, expressionResidentId: undefined };
        expect(f.runtime.frameExpressionResident()).toBe(false); f.dispose();
    });
});
