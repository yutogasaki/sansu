import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IslandLifeDatabase, updateLife } from './repository';
import { HOUR, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
const stores: IslandLifeDatabase[] = [];
const fresh = () => { const d = new IslandLifeDatabase(`life-test-${crypto.randomUUID()}`); stores.push(d); return d; };
afterEach(async () => { await Promise.all(stores.splice(0).map(d => d.delete())); });
describe('independent life persistence', () => {
    it('switches an existing preview once, preserving the old economy and using v2 for its first new command', async () => {
        const db = fresh(); let old = newLife('old', 100); delete old.activitiesV2At;
        old.credits = [{ id: 'one', at: 100, day: learningDay(100) }];
        old = commandLife(old, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'f', 100);
        await db.worlds.put(old);
        const now = 100 + HOUR, before = replayLife(old, now);
        const migrated = await updateLife('old', [], undefined, now, db);
        expect(migrated.activitiesV2At).toBe(now); expect(replayLife(migrated).light).toBe(before.light);
        expect(replayLife(migrated).items).toEqual(before.items);
        const again = await updateLife('old', [], undefined, now + 1000, db);
        expect(again.activitiesV2At).toBe(now); expect(again.actions).toEqual(old.actions);
    });
    it('keeps an old edge purchase before the switch even when a backward clock gives both the same timestamp', async () => {
        const db = fresh(); let old = newLife('same-time', 100); delete old.activitiesV2At;
        old.credits = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
        old = commandLife(old, { type: 'buy', kind: 'bench', cell: { x: 5, z: 4 } }, 'old-edge', 100);
        await db.worlds.put(old);
        const migrated = await updateLife('same-time', [], { id: 'new-flower', revision: old.revision,
            command: { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } } }, 50, db);
        expect(migrated.activitiesV2At).toBe(100); expect(migrated.activitiesV2After).toBe(1);
        expect(replayLife(migrated).items[0]).toEqual(replayLife(old).items[0]);
        expect(replayLife(migrated).residents[1].discovery?.itemId).toBe('new-flower');
        expect(replayLife(migrated).drops).toBe(6);
    });
    it('enrolls prospectively and handles concurrent spending and identical retry', async () => {
        const db = fresh(), t = 100000;
        let r = await updateLife('a', [{ id: 'past', at: t - 1 }], undefined, t, db);
        r = await updateLife('a', [{ id: 'new', at: t + 1 }], undefined, t + 2, db);
        expect(replayLife(r).drops).toBe(2);
        const intent = { id: 'buy', revision: r.revision, command: { type: 'buy' as const, kind: 'flower' as const, cell: { x: 0, z: 2 } } };
        const results = await Promise.allSettled([updateLife('a', [], intent, t + 3, db), updateLife('a', [], { ...intent, id: 'other' }, t + 3, db)]);
        expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
        const retry = await updateLife('a', [], intent, t + 5, db); expect(replayLife(retry).items).toHaveLength(1);
        expect(replayLife(await updateLife('b', [], undefined, t, db)).drops).toBe(0);
    });
    it('rolls back a failed command without losing prior credits', async () => {
        const db = fresh(); const r = await updateLife('a', [], undefined, 100, db);
        await expect(updateLife('a', [], { id: 'bad', revision: r.revision, command: { type: 'expand', side: 'east' } }, 200, db)).rejects.toThrow();
        expect(await db.worlds.get('a')).toEqual(r);
    });
    it('never awards a diagnostic time jump twice and recovers from backward clock', async () => {
        const db = fresh(); const r = await updateLife('a', [], undefined, 100000, db);
        const intent = { id: 'jump', revision: r.revision, advanceHours: 24 as const };
        const jumped = await updateLife('a', [], intent, 100001, db);
        expect((await updateLife('a', [], intent, 100010, db)).now).toBe(jumped.now);
        const back = await updateLife('a', [], undefined, 100, db); expect(back.now).toBe(jumped.now);
        expect((await updateLife('a', [], undefined, 1100, db)).now).toBe(jumped.now + 1000);
        expect(jumped.now).toBe(100001 + 24 * HOUR);
    });
});
