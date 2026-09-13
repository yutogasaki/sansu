import { describe, expect, it } from 'vitest';
import { LIFE_RULES, HOUR, newLife, type LifeState } from './model';
import { advanceLifeState, applyCommand, replayLife, residentCell } from './simulation';
function world(tours = true): LifeState {
    const state = replayLife(newLife('tour-simulation', 100));
    state.tourVersion = tours ? 1 : undefined;
    state.economy = { version: 'life-v3.0-rc1', lightRemainingBudget: 8, completionTimes: [] };
    state.items = ['a', 'b', 'c'].map((id, x) => ({ id, kind: 'swing', cell: { x, z: 2 }, growth: 0, style: 'original', access: 'front' }));
    state.residents.forEach((r, x) => { r.visit = undefined; r.cell = { x, z: 3 }; });
    return state;
}
describe('authoritative GP3 time and interruption', () => {
    it('walks to successive real destinations without paying per short stop', () => {
        const state = world(); advanceLifeState(state, state.now);
        const seen = new Map(state.residents.map(r => [r.id, new Set([r.visit!.itemId])]));
        for (let t = 1100; t <= 45100; t += 1000) {
            advanceLifeState(state, t);
            state.residents.forEach(r => { if (r.visit) seen.get(r.id)!.add(r.visit.itemId); });
            expect(state.light).toBe(0); expect(state.residents.map(r => r.enjoyed)).toEqual([0, 0, 0]);
        }
        expect([...seen].map(([id, ids]) => [id, [...ids]])).toEqual(expect.arrayContaining(state.residents.map(r => [r.id, expect.arrayContaining(['a', 'b', 'c'])])));
    });
    it('pays only full existing use windows and never refills the finite light budget', () => {
        const state = world(); state.residents = [state.residents[0]]; advanceLifeState(state, 100 + LIFE_RULES.activityMs - 1);
        expect(state.light).toBe(0);
        advanceLifeState(state, 100 + LIFE_RULES.activityMs);
        expect(state.light).toBe(1); expect(state.residents[0].enjoyed).toBe(1);
        advanceLifeState(state, 100 + 5 * HOUR);
        expect(state.light).toBe(8); expect(state.economy!.lightRemainingBudget).toBe(0);
    });
    it('keeps all three residents circulating during a long absence', () => {
        const state = world(); advanceLifeState(state, 100 + 7 * 24 * HOUR);
        expect(state.residents.map(r => r.enjoyed)).toEqual(expect.arrayContaining([expect.any(Number)]));
        expect(state.residents.every(r => r.enjoyed > 0)).toBe(true);
        expect(state.residents.some(r => r.visit)).toBe(true);
        expect(state.light).toBe(8); expect(state.economy!.lightRemainingBudget).toBe(0);
    }, 30000);
    it('is independent of refresh boundaries', () => {
        const whole = world(), divided = world(), at = 64123;
        advanceLifeState(whole, at);
        for (let time = 177; time < at; time += 1337) advanceLifeState(divided, time);
        advanceLifeState(divided, at); expect(divided).toEqual(whole);
    });
    it('uses the actual walking cell on interruption, cancelling incomplete payment', () => {
        const state = world(); advanceLifeState(state, 9100);
        const before = state.residents.map(r => residentCell(r, state.now));
        applyCommand(state, { id: 'store', at: state.now, command: { type: 'store', itemId: 'c' } });
        expect(state.residents.every(r => !r.playTour)).toBe(true);
        state.residents.forEach((r, i) => expect(r.visit?.from ?? r.cell).toEqual(before[i]));
        expect(state.light).toBe(0);
    });
    it('keeps earned light after interruption and leaves old unversioned visits unchanged', () => {
        const state = world(); advanceLifeState(state, 100 + LIFE_RULES.activityMs + 1000);
        const light = state.light;
        applyCommand(state, { id: 'store', at: state.now, command: { type: 'store', itemId: 'c' } });
        expect(state.light).toBe(light);
        const legacy = world(false); advanceLifeState(legacy, 100);
        expect(legacy.residents.every(r => !r.playTour && r.visit!.end === 100 + LIFE_RULES.activityMs)).toBe(true);
    });
    it('does not count a blocked tour waiting at its approach as use time', () => {
        const state = world(); advanceLifeState(state, 100);
        const hero = state.residents[0];
        hero.visit = undefined; hero.playTour = { memberIds: ['a', 'b', 'c'], lastItemId: 'a', remainingMs: 1000 }; hero.cell = { x: 0, z: 3 };
        state.residents.slice(1).forEach((r, i) => { r.playTour = undefined; r.cell = { x: i + 1, z: 3 }; r.visit = { itemId: ['b', 'c'][i], from: r.cell, path: [r.cell], start: 100, end: 10000 }; });
        advanceLifeState(state, 9000);
        expect(hero.visit).toBeUndefined(); expect(hero.playTour!.remainingMs).toBe(1000); expect(state.light).toBe(0);
    });
});
