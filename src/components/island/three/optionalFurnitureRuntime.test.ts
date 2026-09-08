import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { IslandScene } from './runtime';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeOptionalFurniture } from './optionalFurnitureGeometry';
import { OptionalFurnitureController } from './optionalFurnitureController';
import type { IslandPlayResult, IslandStageState } from './types';
import type { OptionalFurnitureTrialResolution } from './optionalFurnitureTrial';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
    vi.stubGlobal('window', { clearTimeout: vi.fn() }); vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('document', { hidden: false });
    const materials = new IslandMaterials(), model = makeOptionalFurniture('hammock', materials);
    const resident = new IslandResident('otter', materials, [-1.7, 0, 1.1], () => {});
    const item = { id: 'optional-hammock', kind: 'hammock' as const, position: { x: 0, z: 0 }, rotation: 0 };
    const controller = new OptionalFurnitureController([resident]);
    expect(controller.start({ item, group: model, requestId: 'old', borrowed: true, items: [], land: 0, now: 0, reduced: false }).status).toBe('playing');
    for (let t = 0; t < 4800; t += 100) { controller.update(t, false); controller.afterRender(() => true); }
    const runtime = Object.create(IslandScene.prototype) as {
        state: IslandStageState; pause(): void; updateMotionPreference(): void;
        performPlay(play: NonNullable<IslandStageState['playRequest']>): IslandPlayResult | undefined;
        updateFurnitureTrial(state: IslandStageState): void; advanceTrialSearch(): void; resumeFurnitureTrial(): void;
        trialSearch?: { iterator: Iterator<unknown>; checked: number }; trialResolution?: OptionalFurnitureTrialResolution;
        furnitureTrial?: { item: typeof item; group: THREE.Group };
        deferredPlay?: unknown; pendingVisitId?: string; optionalAutonomousUntil: number;
    };
    const requestFrame = vi.fn(), playResult = vi.fn(), scene = new THREE.Scene(); scene.add(model, resident.group);
    Object.assign(runtime, { optionalFurniture: controller, residents: [resident], optionalAutonomousUntil: 19000,
        furnitureTrial: { item, group: model }, state: { learning: false, completedSets: 0, pulse: 0, items: [], furnitureTrial: item },
        deferredPlay: { id: 'old', itemId: item.id }, pendingVisitId: item.id,
        sharedJobs: { active: false, stop: vi.fn() }, workshop: { stop: vi.fn() }, workshopPresentation: { restore: vi.fn() },
        sharedActivity: { cancel: vi.fn() }, pointerCancel: vi.fn(), cancelLivingActivity: vi.fn(), clearOrdinaryInterest: vi.fn(),
        furnitureClearance: { active: false },
        callbacks: { caption: vi.fn(), playResult }, motion: { matches: true }, requestFrame, frame: 12, idleTimer: 1,
        materials, scene, onscreen: true, resize: vi.fn(), items: new Map() });
    return { runtime, resident, model, controller, requestFrame, playResult, dispose() {
        controller.cancel(5000); disposeGeometry(model); disposeGeometry(resident.group); materials.dispose();
    } };
}

describe('optional furniture runtime boundaries', () => {
    it('background/offscreen pause restores the actual rig and drops both deferred commands and the borrowed model', () => {
        const f = fixture(), uuid = f.resident.group.uuid;
        f.runtime.pause();
        expect(f.controller.active).toBe(false); expect(f.model.visible).toBe(false);
        expect(f.runtime.deferredPlay).toBeUndefined(); expect(f.runtime.pendingVisitId).toBeUndefined(); expect(f.runtime.optionalAutonomousUntil).toBe(0);
        expect(f.resident.group.uuid).toBe(uuid); expect(f.resident.group.position.y).toBeCloseTo(0);
        f.controller.update(60000, false); expect(f.controller.active).toBe(false); expect(f.playResult).not.toHaveBeenCalled(); f.dispose();
    });
    it('a new ordinary invitation releases the prior automatic tool before reporting the new result', () => {
        const f = fixture();
        expect(f.runtime.performPlay({ id: 'new', itemId: 'stored-flower' })).toMatchObject({ requestId: 'new', reason: 'not-placed' });
        expect(f.controller.active).toBe(false); expect(f.runtime.optionalAutonomousUntil).toBe(0);
        expect(f.playResult).toHaveBeenCalledTimes(1); f.dispose();
    });
    it('changing reduced motion schedules the same temporary controller without running ordinary resident updates over its pose', () => {
        const f = fixture(), before = f.resident.group.position.toArray(), update = vi.spyOn(f.resident, 'update');
        f.runtime.updateMotionPreference(); expect(f.requestFrame).toHaveBeenCalledOnce(); expect(update).not.toHaveBeenCalled();
        expect(f.resident.group.position.toArray()).toEqual(before); expect(f.controller.active).toBe(true); f.dispose();
    });
});

function startSearch() {
    const f = fixture(); f.controller.cancel(5000);
    f.runtime.deferredPlay = undefined; f.runtime.pendingVisitId = undefined;
    f.runtime.updateFurnitureTrial(f.runtime.state);
    expect(f.runtime.trialSearch).toBeDefined(); expect(f.model.visible).toBe(false);
    return f;
}
function finishSearch(runtime: ReturnType<typeof fixture>['runtime']) {
    let steps = 0;
    while (runtime.trialSearch && steps++ < 2000) runtime.advanceTrialSearch();
    expect(runtime.trialSearch).toBeUndefined(); expect(runtime.trialResolution?.ready).toBe(true);
}
function queueTry(f: ReturnType<typeof fixture>, id = 'wait-for-place') {
    const play = { id, itemId: f.runtime.state.furnitureTrial!.id, residentId: 'otter' as const };
    f.runtime.state = { ...f.runtime.state, playRequest: play };
    expect(f.runtime.performPlay(play)).toBeUndefined(); expect(f.runtime.deferredPlay).toEqual(play);
    expect(f.playResult).not.toHaveBeenCalled(); expect(f.controller.active).toBe(false);
    return play;
}
describe('incremental trial preparation uses actual controller preflights', () => {
    it('retains a Try during search, executes it once after preparation, and preserves the same pose through fresh UI state objects', () => {
        const f = startSearch(), uuid = f.model.uuid, play = queueTry(f), saved = JSON.stringify(f.runtime.state.items);
        f.runtime.advanceTrialSearch(); expect(f.runtime.trialSearch).toBeDefined(); expect(f.model.visible).toBe(false);
        finishSearch(f.runtime);
        expect(f.playResult).toHaveBeenCalledTimes(1);
        expect(f.playResult).toHaveBeenCalledWith(expect.objectContaining({ requestId: play.id, status: 'playing', resident: 'otter' }));
        expect(f.controller.active).toBe(true); expect(f.model.uuid).toBe(uuid); expect(f.model.visible).toBe(true);
        const position = f.model.position.toArray(), rotation = f.model.rotation.y, resolution = f.runtime.trialResolution;
        f.runtime.advanceTrialSearch(); f.runtime.advanceTrialSearch(); expect(f.playResult).toHaveBeenCalledTimes(1);
        f.controller.cancel(10000);
        f.runtime.state = { ...f.runtime.state, playRequest: undefined, furnitureTrial: { ...f.runtime.state.furnitureTrial! }, items: [] };
        f.runtime.updateFurnitureTrial(f.runtime.state);
        expect(f.runtime.trialSearch).toBeUndefined(); expect(f.runtime.trialResolution).toBe(resolution);
        expect(f.model.position.toArray()).toEqual(position); expect(f.model.rotation.y).toBe(rotation); expect(f.model.uuid).toBe(uuid);
        expect(JSON.stringify(f.runtime.state.items)).toBe(saved); f.dispose();
    });
    it('drops a queued Try when backgrounded and requires a new invitation after foreground preparation', () => {
        const f = startSearch(); queueTry(f);
        f.runtime.advanceTrialSearch(); f.runtime.pause();
        expect(f.runtime.trialSearch).toBeUndefined(); expect(f.runtime.deferredPlay).toBeUndefined();
        f.runtime.resumeFurnitureTrial(); finishSearch(f.runtime);
        expect(f.controller.active).toBe(false); expect(f.playResult).not.toHaveBeenCalled();
        expect(f.runtime.performPlay({ id: 'fresh', itemId: f.runtime.state.furnitureTrial!.id, residentId: 'otter' })).toMatchObject({ status: 'playing' });
        expect(f.playResult).toHaveBeenCalledTimes(1); f.dispose();
    });
    it.each(['learning', 'exit', 'different-kind'] as const)('%s cancels the queued preparation before the old iterator or model can be reused', boundary => {
        const f = startSearch(); queueTry(f); f.runtime.advanceTrialSearch();
        const old = f.runtime.trialSearch!.iterator, advance = vi.spyOn(old, 'next');
        f.runtime.state = { ...f.runtime.state, learning: boundary === 'learning', furnitureTrial: boundary === 'exit' ? undefined
            : boundary === 'different-kind' ? { ...f.runtime.state.furnitureTrial!, id: 'optional-telescope', kind: 'telescope' } : f.runtime.state.furnitureTrial };
        f.runtime.updateFurnitureTrial(f.runtime.state); f.runtime.advanceTrialSearch();
        expect(advance).not.toHaveBeenCalled(); expect(f.model.parent).toBeNull();
        expect(f.runtime.deferredPlay).toBeUndefined(); expect(f.controller.active).toBe(false); expect(f.playResult).not.toHaveBeenCalled();
        if (boundary === 'different-kind') {
            const replacement = f.runtime.furnitureTrial!.group;
            expect(replacement.uuid).not.toBe(f.model.uuid); f.runtime.state = { ...f.runtime.state, furnitureTrial: undefined };
            f.runtime.updateFurnitureTrial(f.runtime.state);
        }
        f.dispose();
    });
});
