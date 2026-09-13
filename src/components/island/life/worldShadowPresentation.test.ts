import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { makeWorldShadowPresentation, prepareWorldShadowScene } from './worldShadowPresentation';
import { makeShadowObservation, shadowObservationTime, shadowRequestExpired } from './shadowObservation';

it('carries the displayed world clock into the close view instead of replaying up to 15 seconds of an old refresh', () => {
    const request = { id: 'touch', worldAt: 15000, monotonicAt: 100 };
    expect(shadowObservationTime(200, request, 300)).toBe(15200);
    expect(shadowObservationTime(16000, request, 300)).toBe(16000);
    expect(shadowObservationTime(200, undefined, 300)).toBe(200);
    expect(shadowRequestExpired(request, 5100)).toBe(false);
    expect(shadowRequestExpired(request, 5101)).toBe(true);
    expect(shadowRequestExpired(request, 99)).toBe(true);
});

it('predicts a tiny shadow needs the close view without recording or leaving its preview gesture behind', () => {
    const state = replayLife(newLife('tiny-shadow', 0)); state.shadowMagicVersion = 1; state.now = 2000;
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, style: 'original', growth: 0 }];
    state.residents[0].visit = { itemId: 'bench', path: [{ x: 3, z: 3 }], start: 0, end: 10000 };
    const content = buildLifeScene(state), scene = new T.Scene(); scene.add(content.root); content.animate(state.now, true);
    const camera = new T.PerspectiveCamera(); camera.position.set(4,8,12); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
    const prepare = vi.fn(), presented = vi.fn();
    const controller = makeShadowObservation({ dataset: {}, getBoundingClientRect: () => ({ width: 1, height: 1 }) } as HTMLElement, scene, camera, { prepare, presented, ready: vi.fn() });
    const vertices = () => controller.objects()[0].children.map(o => Array.from((o as T.Mesh).geometry.getAttribute('position').array));
    try {
        controller.update(state, content.root, 'bench', 'pokomoko', 0, true);
        const ordinary = vertices(); expect(controller.canShowGesture()).toBe(false);
        expect(vertices()).toEqual(ordinary); expect(prepare).not.toHaveBeenCalled(); expect(presented).not.toHaveBeenCalled();
        expect(controller.subject()).toEqual({ itemId: 'bench', residentId: 'pokomoko', worldAt: 2000 });
        // A captured R5 scene can carry the world's M3 capability without
        // offering a shadow interaction. It must not inherit shadow framing.
        controller.update(state, content.root, 'bench', 'pokomoko', 1, true, false);
        expect(controller.objects()).toHaveLength(0);
        expect(controller.subject()).toBeUndefined();
        controller.update(state, content.root, 'bench', 'pokomoko', 2, true, true);
        expect(vertices()).toEqual(ordinary);
        expect(prepare).not.toHaveBeenCalled(); expect(presented).not.toHaveBeenCalled();
    } finally { controller.dispose(); content.dispose(); }
});

it('resolves the neutral visual rule to the owner before validating and freezing a live shadow scene', async () => {
    const state = replayLife(newLife('owner', 0)); state.shadowMagicVersion = 1; state.now = 2000;
    state.items = [{ id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, style: 'original', growth: 0 }];
    state.residents[0].visit = { itemId: 'bench', path: [{ x: 3, z: 3 }], start: 0, end: 10000 };
    state.shadowTouch = { itemId: 'bench', residentId: 'pokomoko' };
    const before = structuredClone(state), rule = evaluateDiscovery(state, '').find(r => r.ruleId === 'M3')!;
    const event = await prepareWorldShadowScene('owner', state, rule, ['pokomoko']);
    expect(event?.profileId).toBe('owner'); expect(event?.source).toBe('live');
    expect(event?.snapshot.scene.shadowTouch).toEqual(state.shadowTouch);
    expect(event?.focalResidentIds).toEqual(['pokomoko']); expect(state).toEqual(before);
    expect(await prepareWorldShadowScene('owner', { ...state, now: 10000 }, rule, ['pokomoko'])).toBeUndefined();
});

it('owns independent shadows only for actual settled bench users and restores all original casting on interruption', () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const state = replayLife(newLife('shadow-world', 0)); state.shadowMagicVersion = 1; state.now = 2000;
    state.items = state.residents.map((r, i) => ({ id: `bench-${r.id}`, kind: 'bench', cell: { x: i * 2, z: 2 }, style: 'original', growth: 0 }));
    state.residents.forEach((r, i) => { r.visit = { itemId: state.items[i].id, path: [{ x: i * 2, z: 3 }], start: 0, end: 10000 }; });
    const before = structuredClone(state), content = buildLifeScene(state), scene = new T.Scene(); scene.add(content.root); content.animate(state.now, true);
    const originals: [T.Mesh, boolean][] = [];
    state.residents.forEach(r => content.root.getObjectByName(`life-resident-${r.id}`)!.traverse(o => { if (o instanceof T.Mesh) originals.push([o, o.castShadow]); }));
    const controller = makeWorldShadowPresentation({ dataset: {} } as HTMLElement, scene, new T.PerspectiveCamera(), { profileId: () => 'shadow-world', touched: vi.fn(), presented: vi.fn() });
    const count = () => scene.children.filter(o => o.name === 'life-resident-shadow').length;
    try {
        controller.update(state, content.root, 0, true, true);
        expect(count()).toBe(3); expect(originals.every(([mesh]) => !mesh.castShadow)).toBe(true);
        controller.update({ ...state, now: 500 }, content.root, 0, true, true);
        expect(count()).toBe(0); originals.forEach(([mesh, cast]) => expect(mesh.castShadow).toBe(cast));
        controller.update(state, content.root, 0, true, true); expect(count()).toBe(3);
        controller.update({ ...state, items: state.items.slice(1) }, content.root, 0, true, true); expect(count()).toBe(2);
        controller.update(state, content.root, 0, true, false); expect(count()).toBe(0);
        controller.update({ ...state, now: 10000 }, content.root, 0, true, true); expect(count()).toBe(0);
        expect(state).toEqual(before); originals.forEach(([mesh, cast]) => expect(mesh.castShadow).toBe(cast));
    } finally { controller.dispose(); content.dispose(); vi.unstubAllGlobals(); }
});
