import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IslandLifeDatabase, updateLife } from './repository';
import { HOUR, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
import { foodGrowthConditions } from './foodLoop';
const stores: IslandLifeDatabase[] = [];
const fresh = () => { const d = new IslandLifeDatabase(`life-test-${crypto.randomUUID()}`); stores.push(d); return d; };
afterEach(async () => { await Promise.all(stores.splice(0).map(d => d.delete())); });
describe('independent life persistence', () => {
    it('credits learning during a delayed first load once, without enrolling past learning', async () => {
        const db = fresh(), facts = [{ id: 'before-opening', at: 900 }, { id: 'during-download', at: 2000 }];
        const first = await updateLife('slow-boot', facts, undefined, 5000, db, 1000);
        expect(first.createdAt).toBe(1000);
        expect(first.realAt).toBe(5000); expect(first.now).toBe(5000);
        expect(first.credits.map(c => c.id)).toEqual(['during-download']);
        expect(replayLife(first).drops).toBe(2);
        const retry = await updateLife('slow-boot', facts, undefined, 6000, db, 1000);
        expect(retry.credits).toEqual(first.credits); expect(replayLife(retry).drops).toBe(2);
    });
    it('ignores an earlier enrollment request after another tab has already saved the world', async () => {
        const db = fresh();
        await updateLife('shared', [], undefined, 2000, db);
        const later = await updateLife('shared', [], undefined, 5000, db, 1000);
        expect(later.createdAt).toBe(2000);
        expect(later.realAt).toBe(5000); expect(later.now).toBe(5000);
        expect((await updateLife('shared', [], undefined, 6000, db)).now).toBe(6000);
    });
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
    it('keeps one food cutover and the harvested inventory through a reload', async () => {
        const db = fresh(), start = 100000;
        let record = await updateLife('food-save', [], undefined, start, db);
        expect(record.version).toBe(20); // Old production writers reject before the first purchase.
        expect(record.foodCutover?.actionCount).toBe(0);
        const facts = Array.from({ length: 7 }, (_, i) => ({ id: `lesson-${i}`, at: start + 1 }));
        record = await updateLife('food-save', facts, undefined, start + 2, db);
        record = await updateLife('food-save', [], { id: 'herbs', revision: record.revision,
            command: { type: 'buy', kind: 'planter', cell: { x: 0, z: 3 } } }, start + 3, db);
        record = await updateLife('food-save', [], { id: 'table', revision: record.revision,
            command: { type: 'buy', kind: 'picnic-table', cell: { x: 4, z: 3 } } }, start + 4, db);
        const cutover = record.foodCutover;
        const grown = await updateLife('food-save', [], { id: 'six-hours', revision: record.revision, advanceHours: 6 }, start + 5, db);
        const before = replayLife(grown);
        expect(before.food!.harvested).toBeGreaterThan(0);
        expect(grown.foodCutover).toEqual(cutover);
        const reopened = await updateLife('food-save', [], undefined, start + 6, db);
        expect(replayLife(reopened).food).toEqual(replayLife(grown, grown.now + 1).food);
        const corrupted = { ...reopened, foodCutover: { ...reopened.foodCutover!, at: 0 } };
        await db.worlds.put(corrupted);
        await expect(updateLife('food-save', [], undefined, start + 7, db)).rejects.toThrow('食べものの切替記録');
    });
    it('persists channel receipts and reroutes water after storing and replacing a segment', async () => {
        const db = fresh(), start = 200000, owner = 'water-save';
        let record = await updateLife(owner, [], undefined, start, db);
        record = await updateLife(owner, Array.from({ length: 8 }, (_, i) => ({ id: `water-lesson-${i}`, at: start + 1 })), undefined, start + 2, db);
        for (const [id, kind, x] of [
            ['bowl', 'water-bowl', 0], ['c1', 'water-channel', 1], ['c2', 'water-channel', 2],
            ['c3', 'water-channel', 3], ['herbs', 'planter', 5],
        ] as const) {
            record = await updateLife(owner, [], { id, revision: record.revision,
                command: { type: 'buy', kind, cell: { x, z: 3 } } }, start + 3 + x, db);
        }
        expect(record.version).toBe(20);
        expect(record.actions.find(a => a.id === 'c1')?.purchaseReceipt).toMatchObject({ priceVersion: 'life-v20-channel-v1', actualPaidDrops: 2 });
        const justConnected = replayLife(record), plot = justConnected.items.find(i => i.id === 'herbs')!;
        expect(justConnected.items.filter(i => i.kind === 'water-channel').every(i => i.waterFlow)).toBe(true);
        expect(foodGrowthConditions(justConnected, plot).water).toBeLessThan(.01);
        record = await updateLife(owner, [], { id: 'wet-six-hours', revision: record.revision, advanceHours: 6 }, start + 9, db);
        const wet = replayLife(record);
        expect(foodGrowthConditions(wet, wet.items.find(i => i.id === 'herbs')!).water).toBeGreaterThan(.5);
        const opened = await updateLife(owner, [], undefined, start + 10, db);
        expect(replayLife(opened).items.find(i => i.id === 'c3')?.waterFlow).toBe(true);
        record = await updateLife(owner, [], { id: 'store-c2', revision: opened.revision,
            command: { type: 'store', itemId: 'c2' } }, start + 11, db);
        expect(replayLife(record).items.find(i => i.id === 'c3')?.waterFlow).toBe(false);
        const afterCut = replayLife(record);
        expect(foodGrowthConditions(afterCut, afterCut.items.find(i => i.id === 'herbs')!).water).toBeGreaterThan(.5);
        record = await updateLife(owner, [], { id: 'dry-six-hours', revision: record.revision, advanceHours: 6 }, start + 12, db);
        const dry = replayLife(record);
        expect(foodGrowthConditions(dry, dry.items.find(i => i.id === 'herbs')!).water).toBeLessThan(.2);
        record = await updateLife(owner, [], { id: 'return-c2', revision: record.revision,
            command: { type: 'move', itemId: 'c2', cell: { x: 2, z: 3 } } }, start + 13, db);
        expect(record.version).toBe(20);
        expect(replayLife(record).items.find(i => i.id === 'c3')?.waterFlow).toBe(true);
        expect(replayLife(record).food?.harvested).toBe(dry.food?.harvested);
        expect(foodGrowthConditions(replayLife(record), replayLife(record).items.find(i => i.id === 'herbs')!).water).toBeLessThan(.2);
        await expect(updateLife(owner, [], { id: 'c1', revision: record.revision,
            command: { type: 'buy', kind: 'water-channel', cell: { x: 5, z: 3 } } }, start + 14, db)).rejects.toThrow('同じ操作');
        await db.worlds.put({ ...record, soilCutover: { ...record.soilCutover!, at: 0 } });
        await expect(updateLife(owner, [], undefined, start + 15, db)).rejects.toThrow('土の切替記録');
    });

    it('starts soil at the existing island time without changing its earlier food history', async () => {
        const db = fresh(), owner = 'old-soil', start = 300000;
        let record = await updateLife(owner, [], undefined, start, db);
        record = await updateLife(owner, Array.from({ length: 7 }, (_, index) => ({ id: `lesson-${index}`, at: start + 1 })), undefined, start + 2, db);
        record = await updateLife(owner, [], { id: 'bowl', revision: record.revision,
            command: { type: 'buy', kind: 'water-bowl', cell: { x: 0, z: 3 } } }, start + 3, db);
        record = await updateLife(owner, [], { id: 'herbs', revision: record.revision,
            command: { type: 'buy', kind: 'planter', cell: { x: 1, z: 3 } } }, start + 4, db);
        record = await updateLife(owner, [], { id: 'six-hours', revision: record.revision, advanceHours: 6 }, start + 5, db);
        const legacy = { ...record, soilCutover: undefined, replaySnapshot: undefined };
        await db.worlds.put(legacy);
        const before = replayLife(legacy);
        const migrated = await updateLife(owner, [], undefined, legacy.realAt, db);
        const after = replayLife(migrated);
        expect(after.food).toEqual(before.food);
        expect(after.items).toEqual(before.items);
        expect(after.drops).toBe(before.drops);
        expect(after.soilMoisture?.['1,3']).toBe(.2);
        expect(migrated.soilCutover).toMatchObject({ at: legacy.now, actionCount: legacy.actions.length });
        expect(replayLife(migrated, migrated.now - HOUR).soilMoisture).toBeUndefined();
    });
});
