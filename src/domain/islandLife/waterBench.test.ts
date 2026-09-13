import { describe, it, expect } from 'vitest';
import { newLife, type LifeItem, type LifeState } from './model';
import { replayLife } from './simulation';
import { benchRelation, relationDistance } from './discovery';
import { createDiscoveryScene, sceneDigest } from './discoveryJournal';
const item = (id: string, kind: LifeItem['kind'], x: number, z: number): LifeItem => ({ id, kind, cell: { x, z }, growth: 0, style: 'original', access: 'front' });
function world(): LifeState { return { ...replayLife(newLife('water-seat', 0)), relationVersion: 'water-bench-v1', items: [item('b', 'bench', 0, 2), item('w', 'water-bowl', 4, 2)] }; }
describe('water bench uses the existing actual path and explicit target contract', () => {
    it('includes four steps, rejects five and blocked access, and restores without changing the source', () => {
        const state = world(), before = structuredClone(state);
        expect(relationDistance(state, state.items[0], state.items[1])).toBe(4);
        expect(benchRelation(state, 'p', 'b')?.ruleId).toBe('R4'); expect(state).toEqual(before);
        state.items[1].cell!.x = 5; expect(benchRelation(state, 'p', 'b')).toBeUndefined();
        state.items[1].cell!.x = 4; state.items.push(...Array.from({ length: 5 }, (_, z) => item(`wall${z}`, 'lantern', 3, z)));
        expect(benchRelation(state, 'p', 'b')).toBeUndefined();
        expect(benchRelation(before, 'p', 'b')?.ruleId).toBe('R4');
    });
    it.each([['flower', 'water-bowl', 'R1', 'R4'], ['water-bowl', 'swing', 'R4', 'R3']] as const)('breaks equal distance ties between %s and %s, but honors the touched object', (first, second, winner, chosen) => {
        const state = world(); state.items = [item('b', 'bench', 2, 3), item('z', first, 1, 2), item('a', second, 3, 2)];
        expect(relationDistance(state, state.items[0], state.items[1])).toBe(relationDistance(state, state.items[0], state.items[2]));
        expect(benchRelation(state, 'p', 'b')?.ruleId).toBe(winner);
        expect(benchRelation(state, 'p', 'b', 'a')?.ruleId).toBe(chosen);
        state.items[2].cell = undefined; expect(benchRelation(state, 'p', 'b', 'a')).toBeUndefined();
    });
    it('does not introduce R4 into an older snapshot containing water and a swing', async () => {
        const state = world(); state.items[1].cell = { x: 1, z: 2 }; state.items.push(item('s', 'swing', 2, 2)); delete state.relationVersion;
        const rule = benchRelation(state, 'p', 'b')!; expect(rule.ruleId).toBe('R3');
        const event = await createDiscoveryScene('p', state, rule, 'live', 'old', 0), old = JSON.stringify(event);
        state.relationVersion = 'water-bench-v1'; expect(benchRelation(state, 'p', 'b')?.ruleId).toBe('R4');
        const historical = { ...state, relationVersion: undefined, ...event.snapshot.scene };
        expect(benchRelation(historical, 'p', 'b')?.ruleId).toBe('R3');
        expect(await sceneDigest(event.snapshot.scene)).toBe(event.snapshot.immutableHash); expect(JSON.stringify(event)).toBe(old);
        const next = await createDiscoveryScene('p', state, benchRelation(state, 'p', 'b')!, 'live', 'new', 0);
        expect(next.snapshot.scene.relationVersion).toBe('water-bench-v1');
    });
});
