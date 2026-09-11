import { describe, expect, it } from 'vitest';
import { HOUR, LIFE_STEP_MS, learningDay, newLife, type Cell, type LifeRecord } from './model';
import { arrangeVisits, commandLife, replayLife } from './simulation';
import { activityPhase, residentReaction } from './activity';
import { districts } from './space';

const time = new Date(2026, 8, 10, 10).getTime();
function funded(legacy = false) {
    const r = newLife('activities', time); r.now += 1;
    if (legacy) delete r.activitiesV2At;
    r.credits = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, at: r.now, day: learningDay(r.now) }));
    return r;
}
function buy(r: LifeRecord, kind: 'flower' | 'bench' | 'swing', id: string, cell: Cell) {
    return commandLife(r, { type: 'buy', kind, cell }, id, r.now);
}
describe('resident activities and expressions', () => {
    it('preserves earned v1 light, purchases and old edge placements across the v2 cutover', () => {
        let old = buy(funded(true), 'bench', 'edge', { x: 5, z: 4 });
        old = buy(old, 'flower', 'f', { x: 0, z: 2 });
        old = commandLife(old, { type: 'style', style: 'starlight' }, 'style', old.now + 4 * HOUR);
        const before = replayLife(old), migrated = { ...old, activitiesV2At: old.now };
        const after = replayLife(migrated);
        expect(after.light).toBe(before.light); expect(after.drops).toBe(before.drops);
        expect(after.items).toEqual(before.items); expect(after.styles).toEqual(before.styles);
        expect(after.heroStyle).toBe('starlight'); expect(after.residents.map(r => r.enjoyed)).toEqual(before.residents.map(r => r.enjoyed));
        const continued = buy(migrated, 'flower', 'next', { x: 1, z: 2 });
        expect(replayLife(continued).items).toHaveLength(3);
        expect(commandLife(continued, { type: 'style', style: 'starlight' }, 'style', old.now)).toBe(continued);
        expect(() => buy(continued, 'bench', 'new-edge', { x: 4, z: 4 })).toThrow();
    });
    it('reserves distinct approaches, keeps seats single-occupancy, and never pays for choosing a target', () => {
        let r = buy(funded(), 'flower', 'f', { x: 0, z: 2 });
        r = buy(r, 'bench', 'b', { x: 4, z: 1 });
        r = buy(r, 'swing', 's', { x: 4, z: 3 });
        r = commandLife(r, { type: 'visit', itemId: 'b' }, 'target', r.now + 100);
        const before = replayLife(r);
        for (let i = 0; i < 20; i++) r = commandLife(r, { type: 'visit', itemId: 'b' }, `repeat${i}`, r.now);
        expect(replayLife(r)).toEqual(before);
        for (let hours = 0; hours < 12; hours++) {
            const s = replayLife(r, r.now + hours * HOUR);
            const visits = s.residents.flatMap(resident => resident.visit ? [resident.visit] : []);
            const ends = visits.map(v => JSON.stringify(v.path[v.path.length - 1]));
            expect(new Set(ends).size).toBe(ends.length);
            for (const id of ['b', 's']) expect(visits.filter(v => v.itemId === id).length).toBeLessThanOrEqual(1);
            for (const v of visits.filter(v => v.itemId === 'b')) expect(v.path[v.path.length - 1]).toEqual({ x: 4, z: 2 });
        }
        expect(before.light).toBe(0);
    });
    it('notices a new favorite, enjoys it after arrival, and expires expressions without collection or reload replay', () => {
        let r = buy(funded(), 'flower', 'new-flower', { x: 0, z: 2 });
        const s = replayLife(r), rabbit = s.residents[1], v = rabbit.visit!;
        expect(rabbit.discovery?.itemId).toBe('new-flower');
        expect(residentReaction(s, rabbit, s.now)?.symbol).toBe('!');
        const arrival = v.start + (v.path.length - 1) * LIFE_STEP_MS + 400;
        expect(activityPhase(s, rabbit, arrival - 1)).toBe('walking');
        expect(residentReaction(s, rabbit, arrival + 275)).toMatchObject({ symbol: '♪', hop: .13 });
        expect(residentReaction(s, rabbit, arrival + 2500)).toBeUndefined();
        expect(residentReaction(replayLife(r, arrival + 2500), replayLife(r, arrival + 2500).residents[1], arrival + 2500)).toBeUndefined();
        r = commandLife(r, { type: 'move', itemId: 'new-flower', cell: { x: 1, z: 2 } }, 'move', arrival + 3000);
        expect(replayLife(r).residents.every(resident => !resident.discovery)).toBe(true);
        expect(replayLife(r).light).toBe(0);
    });
    it('creates different daily use from the same learning budget, without consuming the flowers', () => {
        let garden = funded(), play = funded();
        for (const [i, cell] of [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 2, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 2, z: 3 }].entries()) garden = buy(garden, 'flower', `f${i}`, cell);
        for (const [i, cell] of [{ x: 4, z: 3 }, { x: 5, z: 3 }].entries()) play = buy(play, 'swing', `s${i}`, cell);
        const a = replayLife(garden, garden.now + 24 * HOUR), b = replayLife(play, play.now + 24 * HOUR);
        expect(a.drops).toBe(b.drops); expect(a.items).toHaveLength(6);
        expect(districts(a)[0].label).toBe('おはなばたけ'); expect(districts(b)[0].label).toBe('あそびば');
        expect(a.residents[1].enjoyedBy.flower).toBeGreaterThan(20);
        expect(b.residents[2].enjoyedBy.swing).toBeGreaterThan(20);
        expect(a.residents[1].enjoyedBy.swing).toBeUndefined();
    });
    it('makes the same bench more attractive to the rabbit when moved beside flowers', () => {
        let r = buy(funded(), 'flower', 'f', { x: 0, z: 2 });
        r = buy(r, 'bench', 'b', { x: 5, z: 1 });
        const far = replayLife(r), near = replayLife(commandLife(r, { type: 'move', itemId: 'b', cell: { x: 1, z: 2 } }, 'move', r.now));
        const count = (source: typeof far) => {
            let visits = 0;
            for (let i = 0; i < 200; i++) {
                const s = structuredClone(source); s.now += (i + 1) * HOUR;
                s.residents = [s.residents[1]]; s.residents[0].visit = undefined; s.residents[0].cell = { x: 2, z: 1 };
                arrangeVisits(s); if (s.residents[0].visit?.itemId === 'b') visits++;
            }
            return visits;
        };
        expect(near.drops).toBe(far.drops); expect(near.items.map(i => i.growth)).toEqual(far.items.map(i => i.growth));
        expect(count(near)).toBeGreaterThan(count(far) + 20);
    });
});
