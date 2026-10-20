import { describe, expect, it } from 'vitest';
import { newIsland } from './island';
import { placePlay } from './placePlay';
import { derivePlaces } from './places';
import { experienceFixture, experienceLayouts } from '../../prototypes/placeQa/experienceFixture';

describe('play on actual owned connections', () => {
    it('visits each tree once in a loop, uses the remaining path after a cut, and never jumps components', () => {
        const state = newIsland('play', 0); state.land = { expanded: 'east', extra: ['south'], capes: [] }; state.landmarks = [];
        for (const [i, cell] of [{ x: 0, z: 3 }, { x: 2, z: 3 }, { x: 2, z: 5 }, { x: 0, z: 5 }, { x: 8, z: 7 }].entries())
            state.landmarks.push({ id: `t${i}`, kind: 'sapling', cell, growth: 18 });
        const before = structuredClone(state), reply = placePlay(state, 't0')!;
        expect(reply.replies.map(node => node.id).sort()).toEqual(['t0', 't1', 't2', 't3']);
        expect(new Set(reply.replies.map(node => node.id)).size).toBe(4);
        expect(Math.max(...reply.replies.map(node => node.delay))).toBeLessThanOrEqual(500);
        expect(state).toEqual(before);
        state.landmarks.push({ id: 'cut', kind: 'bench', cell: { x: 1, z: 3 }, growth: 0 });
        expect(placePlay(state, 't0')!.replies.find(node => node.id === 't1')?.step).toBe(3);
        state.landmarks.push({ id: 'cut-again', kind: 'bench', cell: { x: 0, z: 4 }, growth: 0 });
        expect(placePlay(state, 't0')!.replies.map(node => node.id)).toEqual(['t0']);
    });
    it('reads only supplied water, respects eight supply cells and stops immediately after disconnection', () => {
        const state = newIsland('water', 0); state.land = { expanded: 'east', extra: ['west'], capes: [] }; state.landmarks = [];
        state.landmarks.push({ id: 'bowl', kind: 'water-bowl', cell: { x: -3, z: 3 }, growth: 0 });
        for (let i = 1; i <= 11; i++) state.landmarks.push({ id: `c${i}`, kind: 'water-channel', cell: { x: -3 + i, z: 3 }, growth: 0 });
        expect(placePlay(state, 'bowl')!.replies).toHaveLength(9);
        expect(placePlay(state, 'c9')).toBeUndefined();
        state.landmarks.find(owner => owner.id === 'c3')!.cell = undefined;
        expect(placePlay(state, 'bowl')!.replies.map(node => node.id)).toEqual(['bowl', 'c1', 'c2']);
        expect(placePlay(state, 'c4')).toBeUndefined();
        expect(placePlay(state, 'missing')).toBeUndefined();
    });
    it('keeps all four place families and real ground targets after cross-family bench allocation in all three equal islands', () => {
        for (const layout of experienceLayouts) {
            const state = experienceFixture(layout.id), places = derivePlaces(state), before = structuredClone(state);
            expect([...new Set(places.filter(place => place.stage === 'grown').map(place => place.family))].sort()).toEqual(['community', 'flowers', 'grove', 'spring']);
            for (const place of places.filter(p => p.stage === 'grown' && (p.ruleId === 'P01' || p.ruleId === 'P05')))
                expect(place.useTargets.some(target => target.kind === 'garden')).toBe(true);
            derivePlaces(state); expect(state).toEqual(before);
        }
    });
});
