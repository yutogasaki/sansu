import { afterEach, expect, it, vi } from 'vitest';
import * as T from 'three';
import { makeEncounterObservation } from './encounterObservation';
import { buildLifeScene } from './scene';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { createDiscoveryScene } from '../../../domain/islandLife/discoveryJournal';
import { newLife, type LifeItem } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';

const visibility = vi.hoisted(() => ({ visible: true }));
vi.mock('./relationVisibility', () => ({ visibleRelationObject: () => visibility.visible }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); visibility.visible = true; });

async function setup(tree = false) {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.spyOn(performance, 'now').mockReturnValue(10000);
    const state = replayLife(newLife('encounter-test', 0)); state.encounterVersion = 1; state.landscapeVersion = 'groves-water-v1';
    state.items = Array.from({ length: tree ? 3 : 6 }, (_, i): LifeItem => ({ id: `plant-${i}`, kind: tree ? 'sapling' : 'flower',
        cell: { x: i % 3, z: 2 + Math.floor(i / 3) }, growth: 18, style: 'original' }));
    state.items.push({ id: 'water', kind: 'water-bowl', cell: { x: 4, z: 2 }, growth: 0, style: 'original' });
    const rules = evaluateDiscovery(state, 'encounter-test'), group = rules.find(r => r.ruleId === (tree ? 'GT3' : 'GF6'))!;
    const ordinary = await createDiscoveryScene('encounter-test', state, group, 'current-context-test', 'ordinary', 0);
    const scene = new T.Scene(), content = buildLifeScene(state); scene.add(content.root);
    const prepare = vi.fn(async (s, rule) => createDiscoveryScene('encounter-test', s,
        evaluateDiscovery(s, 'encounter-test').find(r => r.ruleId === rule.ruleId)!, 'current-context-test', 'encounter', 0));
    const presented = vi.fn(), hint = vi.fn(), node = { dataset: {} } as HTMLElement;
    const controller = makeEncounterObservation(node, scene, new T.PerspectiveCamera(), { prepare, presented, hint });
    const frame = (elapsed: number, foreground = true) => {
        vi.mocked(performance.now).mockReturnValue(10000 + elapsed);
        controller.update(state, content, group, false, 10000 + elapsed, false);
        controller.sample(10000 + elapsed, foreground, true, true);
    };
    frame(0);
    return { state, content, controller, prepare, presented, hint, ordinary, frame, group, node,
        close: () => { controller.dispose(); content.dispose(); } };
}

it('requires actual ordinary presentation and explicit input, and coalesces repeated input', async () => {
    const x = await setup();
    try {
        x.controller.start(); expect(x.prepare).not.toHaveBeenCalled(); expect(x.hint).not.toHaveBeenCalledWith('X1');
        x.controller.normalPresented(x.ordinary); x.frame(0); expect(x.hint).toHaveBeenLastCalledWith('X1');
        expect(x.prepare).not.toHaveBeenCalled();
        visibility.visible = false; x.controller.start(); expect(x.prepare).not.toHaveBeenCalled();
        visibility.visible = true; x.controller.start(); x.controller.start();
        await vi.waitFor(() => expect(x.controller.active()).toBe(true));
        x.controller.start(); expect(x.prepare).toHaveBeenCalledTimes(1);
        for (let t = 0; t <= 4200; t += 100) x.frame(t);
        expect(x.presented).toHaveBeenCalledTimes(1);
        x.frame(7000); expect(x.controller.active()).toBe(false);
    } finally { x.close(); }
});

it('records the bird only after a visible water peek followed by a visible return', async () => {
    const x = await setup(true);
    try {
        x.controller.normalPresented(x.ordinary); x.frame(0); x.controller.start();
        await vi.waitFor(() => expect(x.controller.active()).toBe(true));
        for (let t = 0; t <= 8900; t += 100) x.frame(t);
        expect(x.presented).not.toHaveBeenCalled();
        x.frame(9000); expect(x.presented).toHaveBeenCalledTimes(1);
    } finally { x.close(); }
});

it('does not record a bird whose water peek was obscured, and layout changes clear the prerequisite', async () => {
    const x = await setup(true);
    try {
        x.controller.normalPresented(x.ordinary); x.frame(0); x.controller.start();
        await vi.waitFor(() => expect(x.controller.active()).toBe(true));
        for (let t = 0; t <= 10800; t += 100) { visibility.visible = t < 3000 || t >= 6000; x.frame(t); }
        expect(x.presented).not.toHaveBeenCalled();
        x.state.items.find(i => i.id === 'water')!.cell = undefined; x.frame(10900);
        expect(x.controller.active()).toBe(false); expect(x.hint).toHaveBeenLastCalledWith(undefined);
        x.controller.start(); expect(x.prepare).toHaveBeenCalledTimes(1);
    } finally { x.close(); }
});

it('ignores an asynchronously prepared scene after cancellation', async () => {
    const x = await setup();
    try {
        x.controller.normalPresented(x.ordinary); x.frame(0); x.controller.start(); x.controller.cancel();
        await vi.waitFor(() => expect(x.prepare).toHaveResolved());
        x.frame(1000); expect(x.controller.active()).toBe(false); expect(x.presented).not.toHaveBeenCalled();
    } finally { x.close(); }
});

it('preserves the gesture across a same-layout mesh rebuild without counting the GPU gap as visible time', async () => {
    const x = await setup(); let replacement: ReturnType<typeof buildLifeScene> | undefined;
    try {
        x.controller.normalPresented(x.ordinary); x.frame(0); x.controller.start();
        await vi.waitFor(() => expect(x.controller.active()).toBe(true));
        for (let t = 0; t <= 2700; t += 100) x.frame(t);
        expect(x.presented).not.toHaveBeenCalled();
        replacement = buildLifeScene(x.state); vi.mocked(performance.now).mockReturnValue(15000);
        x.controller.update(x.state, replacement, x.group, false, 15000, false);
        x.controller.sample(15000, true, true, true);
        expect(JSON.parse(x.node.dataset.encounterView!)).toMatchObject({ active: true, stage: 'water', elapsed: 2700, activeRebuilds: 1 });
        expect(x.presented).not.toHaveBeenCalled();
        for (let at = 15100; at <= 15800; at += 100) {
            vi.mocked(performance.now).mockReturnValue(at);
            x.controller.update(x.state, replacement, x.group, false, at, false); x.controller.sample(at, true, true, true);
        }
        expect(x.presented).toHaveBeenCalledTimes(1);
    } finally { x.close(); replacement?.dispose(); }
});
