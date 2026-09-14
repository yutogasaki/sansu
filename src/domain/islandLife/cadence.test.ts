import { describe, expect, it } from 'vitest';
import { enableCadence } from './cadence';
import { HOUR, isRoamVisit, LIFE_RULES, newLife, type LifeState } from './model';
import { advanceLifeState, replayLife, residentCell, settleCadenceUse } from './simulation';
import { routeDuration } from './walkingSpace';
import { makeLifeStateProjection } from '../../components/island/life/stateProjection';

function source(furnished = true) {
    const state = replayLife(newLife('cadence', 100));
    state.placementVersion = 1; state.tourVersion = 1;
    state.residents.forEach(r => { r.visit = undefined; });
    if (furnished) state.items = [{ id: 'flower', kind: 'flower', cell: { x: 0, z: 3 }, growth: 0, style: 'original' }];
    enableCadence(state); advanceLifeState(state, state.now);
    return state;
}
describe('short autonomous stays', () => {
    it.each([false, true])('moves all three residents repeatedly in two minutes, furniture=%s', furnished => {
        const state = source(furnished), walks = new Map<string, Set<number>>();
        for (let at = 100; at <= 120100; at += 1000) {
            advanceLifeState(state, at);
            for (const r of state.residents) if (r.visit && routeDuration(r.visit.path) > 0) {
                const visits = walks.get(r.id) ?? new Set(); visits.add(r.visit.start); walks.set(r.id, visits);
            }
        }
        expect([...walks.keys()].sort()).toEqual(['otter', 'pokomoko', 'rabbit']);
        for (const visits of walks.values()) expect(visits.size).toBeGreaterThanOrEqual(3);
        expect(state.light).toBe(0); expect(state.residents.every(r => r.enjoyed === 0)).toBe(true);
    });
    it('leaves a used item for a different place or a stroll before returning', () => {
        const state = source();
        const resident = state.residents.find(r => r.visit?.itemId === 'flower')!;
        const visit = structuredClone(resident.visit!);
        expect(visit.end - visit.start - routeDuration(visit.path)).toBeLessThanOrEqual(20000);
        advanceLifeState(state, visit.end);
        expect(resident.visit?.itemId).not.toBe('flower');
    });
    it('counts only actual use, excludes walking/free observation and retains the finite budget', () => {
        const state = source(); state.economy = { version: 'life-v3.0-rc1', completionTimes: [], lightRemainingBudget: 1 };
        const r = state.residents[0]; r.cadence = { round: 0, useMs: { flower: LIFE_RULES.activityMs - 1000 } };
        r.visit = { cadence: true, itemId: 'flower', from: { x: 0, z: 2 }, path: [{ x: 0, z: 2 }, { x: 0, z: 3 }], start: 100, end: 10100 };
        settleCadenceUse(state, 100, 1300); expect(r.enjoyed).toBe(0);
        settleCadenceUse(state, 1300, 2300); expect(r.enjoyed).toBe(1); expect(state.light).toBe(1);
        r.cadence.useMs.flower = LIFE_RULES.activityMs - 1000;
        settleCadenceUse(state, 2300, 3300); expect(r.enjoyed).toBe(2); expect(state.light).toBe(1);
        r.visit.observationTest = true;
        const before = structuredClone(r.cadence); settleCadenceUse(state, 3300, 5000); expect(r.cadence).toEqual(before);
    });
    it('preserves directed visits and clears no in-flight route at cutover', () => {
        const state = source(); delete state.cadenceVersion;
        const r = state.residents[0]; state.target = 'flower';
        r.visit = { itemId: 'flower', from: r.cell, path: [r.cell, { x: 3, z: 3 }], start: 0, end: HOUR / 2 };
        const before = structuredClone(r); enableCadence(state); expect(r).toEqual(before);
        state.target = undefined; const position = residentCell(r, state.now, true);
        enableCadence(state); expect(residentCell(r, state.now, true)).toEqual(position);
        expect(r.visit!.end).toBeLessThan(30000);
    });
    it('matches one-shot, split and rendered clocks without mutating source or its reward budget', () => {
        const original = source(), before = structuredClone(original), split = structuredClone(original);
        const project = makeLifeStateProjection(original);
        for (const at of [200, 5100, 20100, 36111, 60100, 120100]) {
            const all = structuredClone(original); advanceLifeState(all, at); advanceLifeState(split, at);
            expect(split.residents).toEqual(all.residents);
            expect(project(at).residents).toEqual(all.residents);
        }
        expect(original).toEqual(before);
    });
    it('keeps transport collection, delivery and a readable use window', () => {
        const state = source(false), r = state.residents[0];
        state.items = [{ id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
            { id: 'bench', kind: 'bench', cell: { x: 0, z: 3 }, growth: 0, style: 'original' }];
        r.visit = { itemId: 'library', from: r.cell, path: [r.cell], start: 100, end: 2100 };
        r.facilityTrip = { facilityId: 'library', targetId: 'bench', kind: 'library', phase: 'collect', path: [r.cell, { x: 0, z: 2 }], end: HOUR / 2 };
        enableCadence(state); advanceLifeState(state, 2100);
        expect(r.facilityTrip?.phase).toBe('carry'); expect(r.visit?.cadence).toBe(true);
        expect(r.visit!.end - r.visit!.start - routeDuration(r.visit!.path)).toBeCloseTo(24000);
    });
    it('never rewards a ground walk', () => {
        const state: LifeState = source(false);
        advanceLifeState(state, state.now + LIFE_RULES.activityMs);
        expect(state.residents.some(r => isRoamVisit(r.visit))).toBe(true);
        expect(state.light).toBe(0); expect(state.residents.map(r => r.enjoyed)).toEqual([0, 0, 0]);
    });
});
