import { expect, it } from 'vitest';
import { newLife } from '../../../domain/islandLife/model';
import { advanceLifeState, replayLife } from '../../../domain/islandLife/simulation';
import { makeLifeStateProjection } from './stateProjection';
import { createDiscoveryScene, sceneDigest } from '../../../domain/islandLife/discoveryJournal';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
function source() {
    const state = replayLife(newLife('projection', 100)); state.tourVersion = 1;
    state.items = ['a', 'b', 'c'].map((id, x) => ({ id, kind: 'swing', cell: { x, z: 2 }, growth: 0, style: 'original', access: 'front' }));
    state.residents.forEach((r, x) => { r.visit = undefined; r.cell = { x, z: 3 }; });
    advanceLifeState(state, state.now); return state;
}
it('renders authoritative visits between refreshes and can seek back without changing saved state', () => {
    const original = source(), before = structuredClone(original), project = makeLifeStateProjection(original);
    for (const at of [200, 8100, 14333, 21345, 45000, 15000]) {
        const expected = structuredClone(original); advanceLifeState(expected, at);
        expect(project(at).residents).toEqual(expected.residents);
    }
    expect(original).toEqual(before);
});
it('captures real tour poses and freezes their paths in a replay', async () => {
    const original = source(), visible = makeLifeStateProjection(original)(22123);
    const rule = evaluateDiscovery(visible, 'projection').find(rule => rule.ruleId === 'GP3')!;
    const event = await createDiscoveryScene('projection', visible, rule, 'live', 'shown', 30000);
    expect(event.snapshot.scene.residents).toEqual(visible.residents);
    expect(event.snapshot.scene.scenePose).toBe('captured-v1');
    const frozen = { ...original, ...event.snapshot.scene }, project = makeLifeStateProjection(frozen);
    expect(project(50000)).toBe(frozen);
    expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash);
});
it('keeps snapshot plant stages aligned with the geometry that the scene actually built', () => {
    const original = source(); original.economy = { version: 'life-v3.0-rc1', completionTimes: [], lightRemainingBudget: 0 };
    original.items.push({ id: 'flower', kind: 'flower', cell: { x: 5, z: 2 }, growth: 5.999, style: 'original' });
    const visible = makeLifeStateProjection(original)(12100);
    expect(visible.items).toBe(original.items); expect(visible.items[3].growth).toBe(5.999);
});
