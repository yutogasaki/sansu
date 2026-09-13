import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { HOUR, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
import { placementUndo } from './placementUndo';
import { IslandLifeDatabase, updateLife } from './repository';
const at = 100000;
const home = { x: 0, z: 2 }, away = { x: 2, z: 2 };
function fixture() {
    const r = newLife('owner', at);
    r.credits = Array.from({ length: 6 }, (_, i) => ({ id: `credit-${i}`, at, day: learningDay(at) }));
    return commandLife(r, { type: 'buy', kind: 'flower', cell: home }, 'flower', at);
}
const stores: IslandLifeDatabase[] = [];
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });
describe('one placement undo within the same edit history', () => {
    it('stores a new purchase without refund, then restores stored placement only once', () => {
        let r = fixture(); const buy = r.actions[0];
        r = commandLife(r, placementUndo(r, 'flower')!, 'undo-buy', at, 'flower');
        expect(replayLife(r).items[0].cell).toBeUndefined(); expect(replayLife(r).drops).toBe(10);
        expect(r.actions[0]).toEqual(buy); expect(placementUndo(r, 'undo-buy')).toBeUndefined();
        r = commandLife(r, { type: 'move', itemId: 'flower', cell: away }, 'place', at);
        expect(placementUndo(r, 'place')).toEqual({ type: 'store', itemId: 'flower' });
    });
    it('restores a move and storage while preserving time, growth, earned resources and all learning', () => {
        let r = fixture(); r = commandLife(r, { type: 'move', itemId: 'flower', cell: away }, 'move', at);
        const later = at + 3 * HOUR, before = replayLife(r, later);
        r = commandLife(r, placementUndo(r, 'move')!, 'undo', later, 'move');
        const after = replayLife(r);
        expect(after.items[0]).toEqual({ ...before.items[0], cell: home });
        expect([after.drops, after.light, after.days, after.now]).toEqual([before.drops, before.light, before.days, before.now]);
        expect(r.credits).toEqual(fixture().credits);
        r = commandLife(r, { type: 'store', itemId: 'flower' }, 'store', later);
        expect(placementUndo(r, 'store')).toEqual({ type: 'move', itemId: 'flower', cell: home });
    });
    it('rejects other edit histories, forged inverse destinations and no-op/removed items', () => {
        let r = fixture();
        expect(() => commandLife(r, { type: 'move', itemId: 'flower', cell: away }, 'bad', at, 'flower')).toThrow();
        r = commandLife(r, { type: 'move', itemId: 'flower', cell: home }, 'same', at);
        expect(placementUndo(r, 'same')).toBeUndefined();
        r = commandLife(r, { type: 'remove', itemId: 'flower' }, 'remove', at);
        expect(placementUndo(r, 'same')).toBeUndefined(); expect(placementUndo(r, 'remove')).toBeUndefined();
    });
    it('serializes competing writers, rejects stale/changed retry and applies an identical retry once', async () => {
        const db = new IslandLifeDatabase(`undo-${crypto.randomUUID()}`); stores.push(db);
        let r = fixture(); r = commandLife(r, { type: 'move', itemId: 'flower', cell: away }, 'move', at);
        await db.worlds.put(r);
        const intent = { id: 'undo', revision: r.revision, command: placementUndo(r, 'move')!, undoOf: 'move' };
        const results = await Promise.allSettled([updateLife('owner', [], intent, at, db), updateLife('owner', [], { id: 'other', revision: r.revision, command: { type: 'store', itemId: 'flower' } }, at, db)]);
        expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
        const saved = await db.worlds.get('owner');
        expect(await updateLife('owner', [], intent, at + HOUR, db)).toEqual(saved);
        await expect(updateLife('owner', [], { ...intent, undoOf: 'flower' }, at, db)).rejects.toThrow();
        await expect(updateLife('other-owner', [], intent, at, db)).rejects.toThrow();
        expect(await db.worlds.get('other-owner')).toBeUndefined();
    });
    it('checks the latest placement in the transaction even with a freshly supplied revision', async () => {
        const db = new IslandLifeDatabase(`undo-${crypto.randomUUID()}`); stores.push(db);
        let r = fixture(); const inverse = placementUndo(r, 'flower')!;
        r = commandLife(r, { type: 'buy', kind: 'flower', cell: away }, 'other', at); await db.worlds.put(r);
        await expect(updateLife('owner', [], { id: 'stale-undo', revision: r.revision, command: inverse, undoOf: 'flower' }, at, db)).rejects.toThrow();
        expect(await db.worlds.get('owner')).toEqual(r);
    });
    it('restores an isolated legacy placement under current rules without losing ownership', async () => {
        const db = new IslandLifeDatabase(`undo-${crypto.randomUUID()}`); stores.push(db);
        let r = newLife('owner', at); delete r.activitiesV2At; delete r.activitiesV2After;
        r.credits = Array.from({ length: 6 }, (_, i) => ({ id: `credit-${i}`, at, day: learningDay(at) }));
        r = commandLife(r, { type: 'buy', kind: 'bench', cell: { x: 5, z: 4 } }, 'old-bench', at);
        await db.worlds.put(r);
        r = await updateLife('owner', [], { id: 'store', revision: r.revision, command: { type: 'store', itemId: 'old-bench' } }, at + 1, db);
        const restored = await updateLife('owner', [], { id: 'restore-undo', revision: r.revision, command: placementUndo(r, 'store')!, undoOf: 'store' }, at + 2, db);
        expect(replayLife(restored).items[0]).toMatchObject({ id: 'old-bench', cell: { x: 5, z: 4 } });
        expect(replayLife(restored).drops).toBe(replayLife(r).drops);
        expect(await db.worlds.get('owner')).toEqual(restored);
    });

});
