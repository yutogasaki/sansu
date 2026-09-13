import { afterEach, expect, it, vi } from 'vitest';
import * as T from 'three';
import { makeReadingObservation } from './readingObservation';
import { buildLifeScene } from './scene';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene } from '../../../domain/islandLife/discoveryJournal';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';

const visibility = vi.hoisted(() => ({ visible: true }));
vi.mock('./relationVisibility', () => ({ visibleRelationObject: () => visibility.visible }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); visibility.visible = true; });

async function setup() {
    vi.spyOn(performance, 'now').mockReturnValue(10000);
    const state = replayLife(newLife('reading-controller', 0));
    state.readingEncounterVersion = 1; state.facilityTripVersion = 1;
    state.items = [
        { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
        { id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, growth: 0, style: 'original', access: 'front' },
    ];
    const path = [{ x: 0, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 2, z: 3 }, { x: 3, z: 3 }];
    const otter = state.residents.find(r => r.id === 'otter')!;
    otter.visit = { itemId: 'bench', from: path[0], path, start: 0, end: 100000 };
    otter.facilityTrip = { facilityId: 'library', targetId: 'bench', kind: 'library', phase: 'carry', path, end: 100000 };
    state.now = 10000;
    const rule = evaluateDiscovery(state, 'reading-controller').find(r => r.ruleId === 'R5')!;
    const ordinary = await createDiscoveryScene('reading-controller', state, rule, 'current-context-test', 'ordinary', 0, ['otter']);
    const content = buildLifeScene(state); content.animate(state.now, false);
    const scene = new T.Scene(); scene.add(content.root);
    const prepare = vi.fn(async s => createDiscoveryScene('reading-controller', s,
        evaluateDiscovery(s, 'reading-controller').find(r => r.ruleId === 'X3')!, 'current-context-test', 'reading', 0, ['otter']));
    const presented = vi.fn(), node = { dataset: {} } as HTMLElement;
    const controller = makeReadingObservation(node, scene, new T.PerspectiveCamera(), { prepare, presented });
    const frame = (elapsed: number, foreground = true, root = content.root) => {
        vi.mocked(performance.now).mockReturnValue(10000 + elapsed);
        controller.update(state, root, 'bench', 'otter', false, true, 10000 + elapsed, false);
        controller.sample(10000 + elapsed, foreground, true, true);
    };
    frame(0);
    const start = async () => { controller.normalPresented(ordinary); frame(0); await vi.waitFor(() => expect(controller.active()).toBe(true)); };
    return { state, content, controller, prepare, presented, node, ordinary, frame, start, close: () => { controller.dispose(); content.dispose(); } };
}

it('requires ordinary R5 presentation and both visible book orientations', async () => {
    const x = await setup();
    try {
        x.frame(1000); expect(x.prepare).not.toHaveBeenCalled();
        await x.start();
        for (let t = 0; t <= 4400; t += 100) x.frame(t);
        expect(x.presented).not.toHaveBeenCalled();
        x.frame(4500); expect(x.presented).toHaveBeenCalledTimes(1);
        x.frame(8000); expect(x.controller.active()).toBe(false);
        expect(x.content.root.getObjectByName('life-resident-otter')!.getObjectByName('life-held-book')!.rotation.y).toBe(0);
        x.frame(9000); expect(x.prepare).toHaveBeenCalledTimes(1);
    } finally { x.close(); }
});

it('does not infer the inverted picture from seeing only the upright book', async () => {
    const x = await setup();
    try {
        await x.start();
        for (let t = 0; t <= 7900; t += 100) { visibility.visible = t >= 3000; x.frame(t); }
        expect(x.presented).not.toHaveBeenCalled();
    } finally { x.close(); }
});

it('ignores a pending scene after cancellation and restores the prop', async () => {
    const x = await setup();
    try {
        x.controller.normalPresented(x.ordinary); x.frame(0); x.controller.cancel();
        await vi.waitFor(() => expect(x.prepare).toHaveResolved());
        x.frame(100); expect(x.controller.active()).toBe(false); expect(x.presented).not.toHaveBeenCalled();
    } finally { x.close(); }
});

it('cancels when the real reader leaves or its layout changes', async () => {
    for (const reason of ['leave', 'layout']) {
        const x = await setup();
        try {
            await x.start(); x.frame(0); x.frame(500);
            if (reason === 'leave') x.state.residents.find(r => r.id === 'otter')!.visit = undefined;
            else x.state.items[1].cell = { x: 4, z: 2 };
            x.frame(1000); expect(x.controller.active()).toBe(false); expect(x.presented).not.toHaveBeenCalled();
        } finally { x.close(); }
    }
});

it('keeps the orientation through a mesh rebuild without crediting an unseen gap', async () => {
    const x = await setup(); let replacement: ReturnType<typeof buildLifeScene> | undefined;
    try {
        await x.start(); for (let t = 0; t <= 1500; t += 100) x.frame(t);
        replacement = buildLifeScene(x.state); replacement.animate(x.state.now, false);
        x.frame(5000, true, replacement.root);
        expect(JSON.parse(x.node.dataset.readingView!)).toMatchObject({ active: true, elapsed: 1500, stage: 'upside-down' });
        expect(x.presented).not.toHaveBeenCalled();
        expect(replacement.root.getObjectByName('life-resident-otter')!.getObjectByName('life-held-book')!.rotation.y).toBeCloseTo(Math.PI);
    } finally { x.close(); replacement?.dispose(); }
});
