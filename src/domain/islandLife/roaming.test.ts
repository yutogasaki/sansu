import { describe, expect, it } from 'vitest';
import { isRoamVisit, LIFE_RULES, LIFE_STEP_MS, newLife } from './model';
import { arrangeVisits, lifeRoamStyle, replayLife, residentCell } from './simulation';
import { activityLabel, activityPhase } from './activity';
import { isHouse, landCells, sameCell } from './space';

const start = 1_000;

describe('island life autonomous roaming', () => {
    it('plans one visible walk on empty v2 islands without using a reward path', () => {
        const record = newLife('roaming', start), state = replayLife(record);
        const walker = state.residents.find(resident => isRoamVisit(resident.visit));
        expect(walker).toBeDefined();
        expect(walker!.visit!.path.length).toBeGreaterThan(1);
        expect(activityPhase(state, walker!, state.now)).toBe('walking');
        expect(activityLabel(state, walker!, state.now)).toBe('てくてく むかっている');

        const occupied = state.residents.filter(resident => resident !== walker).flatMap(resident => [residentCell(resident, state.now)]);
        for (const [index, point] of walker!.visit!.path.entries()) {
            if (index > 0) expect(isHouse(point)).toBe(false);
            expect(occupied.some(other => sameCell(other, point))).toBe(false);
            expect(landCells(state).some(cell => sameCell(cell, point))).toBe(true);
        }

        const after = replayLife(record, walker!.visit!.end + 1);
        expect(after.light).toBe(0);
        expect(after.residents.every(resident => resident.enjoyed === 0)).toBe(true);
        expect(after.residents.some(resident => isRoamVisit(resident.visit))).toBe(true);
    });

    it('rotates the walker fairly and varies the destinations over activity rounds', () => {
        const record = newLife('fair-roaming', start);
        const samples = Array.from({ length: 6 }, (_, round) => replayLife(record,
            start + (round + .15) * LIFE_RULES.activityMs));
        const active = samples.map(state => state.residents.find(resident => isRoamVisit(resident.visit))!);
        expect(new Set(active.map(resident => resident.id))).toEqual(new Set(['pokomoko', 'rabbit', 'otter']));
        expect(new Set(active.map(resident => resident.visit!.path.at(-1)!.x + ',' + resident.visit!.path.at(-1)!.z)).size).toBeGreaterThan(2);
        expect(lifeRoamStyle(0, 0)).toBe('nearby');
        expect(lifeRoamStyle(1, 0)).toBe('wide');
        expect(lifeRoamStyle(2, 0)).toBe('crossing');
    });

    it('leaves Pokomoko waiting for an explicit target while another resident strolls', () => {
        const state = replayLife(newLife('waiting-roaming', start));
        state.residents.forEach(resident => { resident.visit = undefined; });
        state.target = 'chosen-later';
        arrangeVisits(state);
        expect(state.residents[0].visit).toBeUndefined();
        expect(activityPhase(state, state.residents[0], state.now)).toBe('waiting');
        expect(state.residents.slice(1).some(resident => isRoamVisit(resident.visit))).toBe(true);
    });

    it('keeps legacy activity records free of derived roaming visits', () => {
        const record = newLife('legacy-roaming', start); delete record.activitiesV2At;
        const state = replayLife(record, start + 2 * LIFE_STEP_MS);
        expect(state.activityVersion).toBe(1);
        expect(state.residents.every(resident => resident.visit === undefined)).toBe(true);
    });
});
