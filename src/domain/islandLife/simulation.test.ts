import { describe, expect, it } from 'vitest';
import { HOUR, learningDay, newLife, vigor, type Cell, type LifeRecord } from './model';
import { applyCommand, commandLife, replayLife } from './simulation';
import { districts, sameCell } from './space';
const start = new Date(2026, 8, 10, 10).getTime();
function credits(n: number, at = start + 100): LifeRecord {
    const r = newLife('p', start); r.now = at;
    r.credits = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, at, day: learningDay(at) })); return r;
}
function flower(r: LifeRecord, id: string, cell: Cell) { return commandLife(r, { type: 'buy', kind: 'flower', cell }, id, r.now); }
describe('island life: time, choice and learning remain separate', () => {
    it('gives partial participation value and first-day baseline growth without claiming achievement', () => {
        let r = credits(3); r = flower(r, 'a', { x: 0, z: 2 });
        const s = replayLife(r, r.now + 24 * HOUR);
        expect(s.drops).toBe(4); expect(s.lastAchievement).toBeUndefined(); expect(vigor(s)).toBe(.25); expect(s.items[0].growth).toBe(6);
    });
    it('integrates speed boundaries and recovers only on another achieved day', () => {
        const r = credits(6), state = replayLife(r, start + 73 * HOUR);
        expect(vigor(state)).toBe(.1);
        const nextDay = start + 25 * HOUR;
        r.credits.push(...Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, at: nextDay, day: learningDay(nextDay) })));
        expect(vigor(replayLife(r, nextDay + HOUR))).toBe(1);
        expect(replayLife(credits(30)).lastAchievement).toBe(start + 100);
    });
    it('counts a terminal slot once even if its event arrives twice', () => {
        const r = credits(3); r.credits.push(...r.credits); expect(replayLife(r).drops).toBe(6);
    });
    it('integrates both decay boundaries for newly placed flowers, regardless of refresh frequency', () => {
        for (const [offset, expected] of [[23, 1.5], [71, .6]] as const) {
            const base = credits(6);
            base.now += offset * HOUR;
            const r = flower(base, 'f', { x: 0, z: 2 });
            const to = r.now + 2 * HOUR;
            expect(replayLife(r, to).items[0].growth).toBeCloseTo(expected);
            for (let i = 0; i < 8; i++) replayLife(r, r.now + i * HOUR / 4);
            expect(replayLife(r, to).items[0].growth).toBeCloseTo(expected);
        }
    });
    it('waits for an occupied chosen destination and reroutes when a purchase blocks a walking path', () => {
        let r = credits(12);
        r = commandLife(r, { type: 'buy', kind: 'swing', cell: { x: 5, z: 3 } }, 's', r.now);
        const s = replayLife(r);
        const hero = s.residents[0], otter = s.residents[2];
        const occupiedVisit = s.residents.find(r => r.visit)!.visit;
        s.residents.forEach(r => { r.visit = r === otter ? occupiedVisit : undefined; });
        applyCommand(s, { id: 'choose', at: s.now, command: { type: 'visit', itemId: 's' } });
        expect(s.target).toBe('s'); expect(hero.visit).toBeUndefined(); expect(s.light).toBe(0);
        const obstacle = otter.visit!.path[1];
        applyCommand(s, { id: 'f', at: s.now, command: { type: 'buy', kind: 'flower', cell: obstacle } });
        expect(s.residents.every(resident => !resident.visit?.path.some(p => sameCell(p, obstacle)))).toBe(true);
        expect(s.light).toBe(0);
    });
    it('recognizes a bed from maturation without another placement and preserves individual growth on splits', () => {
        let r = credits(3);
        for (const [i, cell] of [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 2, z: 2 }].entries()) r = flower(r, `f${i}`, cell);
        expect(districts(replayLife(r))).toHaveLength(0);
        r.now += 24 * HOUR;
        expect(districts(replayLife(r))[0].label).toBe('かだん');
        r = commandLife(r, { type: 'move', itemId: 'f0', cell: { x: 5, z: 4 } }, 'move', r.now);
        const s = replayLife(r); expect(districts(s)).toHaveLength(0); expect(s.items.every(i => i.growth === 6)).toBe(true);
    });
    it('creates a flower field with area and a different play district from toys', () => {
        let r = credits(30);
        for (const [i, cell] of [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 2, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 2, z: 3 }].entries()) r = flower(r, `f${i}`, cell);
        expect(districts(replayLife(r, r.now + 6 * HOUR))[0].label).toBe('おはなばたけ');
        let t = credits(12);
        for (let i = 0; i < 3; i++) t = commandLife(t, { type: 'buy', kind: 'swing', cell: { x: i, z: 3 } }, `s${i}`, t.now);
        expect(districts(replayLife(t))[0].label).toBe('ゆうえんち');
    });
    it('does not grant pre-placement or stored growth and returns the same individual', () => {
        let r = credits(3); r = flower(r, 'f', { x: 0, z: 2 });
        r = commandLife(r, { type: 'store', itemId: 'f' }, 'store', r.now + 4 * HOUR);
        expect(replayLife(r, r.now + 100 * HOUR).items[0].growth).toBe(1);
        r = commandLife(r, { type: 'move', itemId: 'f', cell: { x: 1, z: 3 } }, 'place', r.now + 100 * HOUR);
        expect(replayLife(r, r.now + 4 * HOUR).items[0].growth).toBe(2);
    });
    it('autonomous use earns light; destination spam and styles do not generate resources', () => {
        let r = flower(credits(3), 'f', { x: 0, z: 2 });
        for (let i = 0; i < 10; i++) r = commandLife(r, { type: 'visit', itemId: 'f' }, `v${i}`, r.now + 1);
        expect(replayLife(r).light).toBe(0);
        r.now += 3 * HOUR;
        const before = replayLife(r); expect(before.light).toBeGreaterThanOrEqual(4);
        r = commandLife(r, { type: 'style', style: 'starlight' }, 'style1', r.now);
        const after = replayLife(r); expect(after.light).toBe(before.light - 4); expect(after.heroStyle).toBe('starlight'); expect(after.drops).toBe(before.drops);
        r = commandLife(r, { type: 'style', style: 'original' }, 'style2', r.now);
        r = commandLife(r, { type: 'style', style: 'starlight' }, 'style3', r.now);
        expect(replayLife(r).light).toBe(after.light);
    });
    it('rejects overlap and insufficient funds; removal refunds once and retains purchased styles', () => {
        let r = flower(credits(3), 'f', { x: 0, z: 2 });
        expect(() => flower(r, 'x', { x: 0, z: 2 })).toThrow();
        expect(() => commandLife(r, { type: 'expand', side: 'east' }, 'e', r.now)).toThrow();
        r = commandLife(r, { type: 'remove', itemId: 'f' }, 'delete', r.now);
        expect(replayLife(r).drops).toBe(5); expect(commandLife(r, { type: 'remove', itemId: 'f' }, 'delete', r.now)).toBe(r);
    });
    it('replays delayed participation at its original time rather than at collection time', () => {
        const r = flower(credits(3), 'f', { x: 0, z: 2 });
        const completion = r.now + HOUR;
        r.now += 5 * HOUR;
        r.credits.push(...Array.from({ length: 3 }, (_, i) => ({ id: `late${i}`, at: completion, day: learningDay(completion) })));
        expect(replayLife(r).items[0].growth).toBeCloseTo(4.25);
    });
});
