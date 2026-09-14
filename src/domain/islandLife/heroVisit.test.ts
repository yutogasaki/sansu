import { describe, expect, it } from 'vitest';
import { enableCadence } from './cadence';
import { enableHeroVisits, HERO_WAIT_MS } from './heroVisit';
import { HOUR, newLife, type LifeState } from './model';
import { advanceLifeState, applyCommand, replayLife, residentCell } from './simulation';
import { routeDuration } from './walkingSpace';
import { makeLifeStateProjection } from '../../components/island/life/stateProjection';

function source(): LifeState {
    const state = replayLife(newLife('called-hero', 100)); state.placementVersion = 1; state.tourVersion = 1;
    state.items = [{ id: 'flower', kind: 'flower', cell: { x: 0, z: 3 }, growth: 0, style: 'original' }];
    state.residents.forEach(r => { r.visit = undefined; });
    enableCadence(state);
    state.target = 'flower';
    state.residents[0].cell = { x: 0, z: 2 };
    state.residents[0].visit = { itemId: 'flower', from: { x: 0, z: 2 }, path: [{ x: 0, z: 2 }], start: 100, end: 100 + HOUR / 2 };
    return state;
}
describe('called Pokomoko returns to autonomous life', () => {
    it('reproduces the v16 indefinite target, then leaves after one short stay under v17', () => {
        const old = source(); advanceLifeState(old, 60_100);
        expect(old.target).toBe('flower'); expect(old.residents[0].visit?.itemId).toBe('flower');
        const state = source(); enableHeroVisits(state);
        const end = state.residents[0].visit!.end; expect(end).toBe(20100);
        advanceLifeState(state, end - 1); expect(state.target).toBe('flower');
        advanceLifeState(state, end); expect(state.target).toBeUndefined();
        expect(state.residents[0].visit?.itemId).not.toBe('flower'); expect(state.light).toBe(0);
        const departures = new Set<number>();
        for (let at = end; at < 120100; at += 1000) {
            advanceLifeState(state, at); const visit = state.residents[0].visit;
            if (visit && routeDuration(visit.path) > 0) departures.add(visit.start);
        }
        expect(departures.size).toBeGreaterThanOrEqual(3);
    });
    it('keeps an in-flight destination until arrival and the full stay, even past the wait deadline', () => {
        const state = source(), hero = state.residents[0];
        hero.visit!.path = [{ x: 0, z: 2 }, { x: 0, z: 2.5 }];
        const position = residentCell(hero, state.now, true); enableHeroVisits(state);
        expect(residentCell(hero, state.now, true)).toEqual(position);
        state.heroWaitUntil = 200;
        advanceLifeState(state, 500); expect(state.target).toBe('flower');
        expect(hero.visit!.end).toBe(20700);
        advanceLifeState(state, 20700); expect(state.target).toBeUndefined();
    });
    it('expires an unavailable call after 30 seconds in one-shot, split and rendered clocks', () => {
        const state = source(); state.residents[0].visit = undefined;
        state.items[0].cell = undefined; enableHeroVisits(state);
        const project = makeLifeStateProjection(state);
        const before = structuredClone(state); advanceLifeState(before, 100 + HERO_WAIT_MS - 1); expect(before.target).toBe('flower');
        const all = structuredClone(state); advanceLifeState(all, 100 + HERO_WAIT_MS);
        advanceLifeState(before, 100 + HERO_WAIT_MS);
        expect(all.target).toBeUndefined(); expect(before.residents).toEqual(all.residents);
        expect(project(100 + HERO_WAIT_MS).target).toBeUndefined();
        expect(project(100 + HERO_WAIT_MS).residents).toEqual(all.residents);
    });
    it('does not extend the same call or reject a new call to the last-used item', () => {
        const state = source(); enableHeroVisits(state);
        const end = state.residents[0].visit!.end, until = state.heroWaitUntil;
        applyCommand(state, { id: 'repeat', at: 100, command: { type: 'visit', itemId: 'flower' } });
        expect(state.residents[0].visit!.end).toBe(end); expect(state.heroWaitUntil).toBe(until);
        advanceLifeState(state, end);
        applyCommand(state, { id: 'new-call', at: state.now, command: { type: 'visit', itemId: 'flower' } });
        expect(state.target).toBe('flower'); expect(state.residents[0].visit?.itemId).toBe('flower');
        expect(state.residents[0].visit?.cadence).toBe(true);
    });
    it('finishes a library delivery and use before releasing the original library call', () => {
        const state = source(), hero = state.residents[0]; state.target = 'library';
        state.items.push({ id: 'library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' });
        hero.visit = { itemId: 'library', from: hero.cell, path: [hero.cell], start: 100, end: 2100 };
        hero.facilityTrip = { facilityId: 'library', targetId: 'flower', kind: 'library', phase: 'collect', path: [hero.cell, { x: 0, z: 2.5 }], end: HOUR / 2 + 100 };
        enableHeroVisits(state); advanceLifeState(state, 2100);
        expect(state.target).toBe('library'); expect(hero.facilityTrip?.phase).toBe('carry');
        const end = hero.visit!.end; expect(end - 2100 - routeDuration(hero.visit!.path)).toBe(24000);
        applyCommand(state, { id: 'repeat-carry', at: state.now, command: { type: 'visit', itemId: 'library' } });
        expect(hero.visit!.end).toBe(end); expect(hero.facilityTrip?.phase).toBe('carry');
        advanceLifeState(state, end); expect(state.target).toBeUndefined(); expect(state.light).toBe(0);
    });
});
