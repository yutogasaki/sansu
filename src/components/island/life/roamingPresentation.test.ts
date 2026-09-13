import { describe, expect, it } from 'vitest';
import { HOUR, isRoamVisit, LIFE_STEP_MS, newLife } from '../../../domain/islandLife/model';
import { replayLife, residentCell } from '../../../domain/islandLife/simulation';
import { isHouse, sameCell } from '../../../domain/islandLife/space';
import { ROAM_REST_MS, sampleLifeRoaming } from './roamingPresentation';

const start = 1000;
describe('display-only roaming cadence', () => {
    it('keeps authoritative walkers when placement must inspect their visible positions', () => {
        const source = { ...replayLife(newLife('placement', start)), placementVersion: 1 as const };
        expect(sampleLifeRoaming(source, start + 5000)).toBe(source);
    });
    it('takes turns 1.8 seconds after arrival without changing rewards or the source', () => {
        const source = replayLife(newLife('cadence', start)), before = structuredClone(source);
        const seen = new Set<string>();
        let at = start;
        for (let turn = 0; turn < 9; turn++) {
            const frame = sampleLifeRoaming(source, at);
            const walker = frame.residents.find(r => isRoamVisit(r.visit))!;
            const visit = walker.visit!;
            seen.add(walker.id);
            expect(visit.end - visit.start).toBe((visit.path.length - 1) * LIFE_STEP_MS + ROAM_REST_MS);
            expect(visit.end - visit.start).toBeLessThan(30_000);
            const resting = sampleLifeRoaming(source, visit.end - 1);
            expect(resting.residents.find(r => isRoamVisit(r.visit))!.id).toBe(walker.id);
            for (const p of visit.path.slice(1)) {
                expect(isHouse(p)).toBe(false);
                expect(frame.residents.filter(r => r !== walker).some(r => sameCell(residentCell(r, at), p))).toBe(false);
            }
            expect(frame.light).toBe(before.light);
            expect(frame.residents.map(r => r.enjoyed)).toEqual(before.residents.map(r => r.enjoyed));
            at = visit.end;
        }
        expect(seen.size).toBe(3);
        expect(source).toEqual(before);
    });
    it('gives the same position after ordinary snapshot refresh and backward sampling', () => {
        const record = newLife('refresh', start), source = replayLife(record);
        for (const elapsed of [0, 15_000, 60_000, 300_000, 1_790_000]) {
            const at = start + elapsed;
            const a = sampleLifeRoaming(source, at);
            const b = sampleLifeRoaming(replayLife(record, at), at);
            expect(a.residents).toEqual(b.residents);
        }
        expect(sampleLifeRoaming(source, start).residents).toEqual(sampleLifeRoaming(replayLife(record), start).residents);
    });
    it('keeps furniture visits and the explicit hero destination authoritative', () => {
        const source = replayLife(newLife('reserved', start));
        source.target = 'bench';
        source.residents[0].visit = undefined;
        source.items.push({ id: 'bench', kind: 'bench', cell: { x: 0, z: 2 }, growth: 0, style: 'original' });
        source.residents[1].visit = { itemId: 'bench', from: { x: 3, z: 1 }, path: [{ x: 3, z: 1 }, { x: 3, z: 2 }], start, end: start + HOUR / 2 };
        source.residents[2].visit = { itemId: 'roam:otter', from: source.residents[2].cell, path: [source.residents[2].cell], start, end: start + HOUR / 2 };
        const frame = sampleLifeRoaming(source, start + 60_000);
        expect(frame.residents[0].visit).toBeUndefined();
        expect(frame.residents[1]).toBe(source.residents[1]);
        expect(frame.residents[2].visit?.itemId).toMatch(/^roam:display:/);
    });
    it('does not replay offline walking history or add walks to legacy records', () => {
        const source = replayLife(newLife('old', start));
        expect(sampleLifeRoaming(source, start + 365 * 24 * HOUR)).toBe(source);
        source.activityVersion = 1;
        expect(sampleLifeRoaming(source, start + 100)).toBe(source);
    });
});
