import { describe, expect, it } from 'vitest';
import { derivePlaces } from './places';
import { supportedPlaceVariant } from './placeCapability';
import { communityRoofModules } from './communityRoof';
import { architectureFixture } from './placeArchitecture.fixture';

describe('large place architecture from growing owners', () => {
    it('extends either axis past four mature owners without authorizing curves, blocked gaps or immature trees', () => {
        for (const axis of ['x', 'z'] as const) {
            const state = architectureFixture(); state.land = { expanded: 'east', extra: ['south', 'south', 'south', 'south'], capes: [] }; state.plots = [];
            state.landmarks = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, kind: 'sapling', cell: axis === 'x' ? { x: i + 2, z: 2 } : { x: 2, z: i + 1 }, growth: 18, maturedAt: 0 }));
            const saved = structuredClone(state), large = derivePlaces(state).find(place => place.ruleId === 'P02');
            expect(large?.stage).toBe('grown'); expect(large!.walkSurface.length).toBeGreaterThan(30); expect(state).toEqual(saved);
            state.landmarks[5].growth = 0;
            const retained = derivePlaces(state).find(place => place.ruleId === 'P02')!;
            expect(retained.stage).toBe('grown'); expect(retained.mainIds).not.toContain('t5');
            state.landmarks[3].growth = 0;
            expect(derivePlaces(state).find(place => place.ruleId === 'P02')).toBeUndefined();
        }
        expect(supportedPlaceVariant('P05', Array.from({ length: 12 }, (_, x) => ({ x, z: 0 })), true)).toBe('arch');
        expect(supportedPlaceVariant('P05', [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 5, z: 0 }, { x: 6, z: 0 }], true)).toBeUndefined();
        expect(supportedPlaceVariant('P05', [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 2, z: 2 }], true)).toBeUndefined();
    });
    it('uses only reachable acquired clear front-yard bays, retains home styles and falls back after obstruction/maturity changes', () => {
        const state = architectureFixture(), before = structuredClone(state), ids = state.plots.map(home => home.id);
        const modules = communityRoofModules(state, ids);
        expect(modules).toHaveLength(1);
        expect(derivePlaces(state).find(place => place.ruleId === 'P04')?.structure).toBe('P04:shared-roof');
        const garden = derivePlaces(state).find(place => place.ruleId === 'P04')!;
        expect(garden.useTargets.find(target => target.kind === 'garden')?.cell).toEqual(modules[0].target);
        expect(state).toEqual(before);
        state.plots.push({ ...state.plots[1], id: 'new-young-home', cell: { x: 11, z: 3 }, stage: 1 });
        expect(derivePlaces(state).find(place => place.ruleId === 'P04')?.structure).toBe('P04:shared-roof');
        state.plots.pop();
        state.landmarks.push({ id: 'my-tree', kind: 'sapling', growth: 18, cell: { x: 8, z: 4 } });
        const blocked = derivePlaces(state).find(place => place.ruleId === 'P04')!;
        expect(blocked.structure).toBeUndefined(); expect(blocked.stage).toBe('grown'); expect(blocked.revision).not.toBe(garden.revision);
        state.landmarks = []; state.plots[1].stage = 1;
        expect(communityRoofModules(state, ids)).toEqual([]);
        expect(state.plots.map(home => home.style)).toEqual(before.plots.map(home => home.style));
        state.plots[1].stage = 2; state.plots[1].cell!.z = 9;
        expect(communityRoofModules(state, ids)).toEqual([]);
    });
});
