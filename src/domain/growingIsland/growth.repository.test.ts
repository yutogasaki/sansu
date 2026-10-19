import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, expect, it } from 'vitest';
import { GrowingIslandDatabase, restoreGrowingWonder, commandGrowingIsland, type GrowingRecord } from './repository';
import { upgrade } from './syncProjection';
import { newLegacyIsland } from './legacy.fixture';
const dbs: Dexie[] = [];
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.delete())); });
const database = () => { const db = new GrowingIslandDatabase(`growth-save-${crypto.randomUUID()}`); dbs.push(db); return db; };
function source(version: 1 | 4 = 1): GrowingRecord {
    const state = newLegacyIsland('child', 0); state.drops = 123; state.learned = ['paid-once'];
    return { profileId: 'child', islandId: 'main', version, revision: 4, createdAt: 0, updatedAt: 0, state };
}

it('cuts over active/archive/photos atomically and isolates old voyage writes', async () => {
    const db = database(), old = new Dexie(db.name); dbs.push(old);
    old.version(8).stores({ islands: '&profileId', balancedIslands: '&profileId', guidedIslands: '&profileId', placedIslands: '&profileId',
        voyageIslands: '&profileId', archivedIslands: '[profileId+islandId], profileId', moments: '&requiresVoyageWriter',
        voyageMoments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
    const original = source(4);
    await old.table('voyageIslands').put(original);
    await old.table('archivedIslands').put({ ...original, islandId: 'forest' });
    await old.table('voyageMoments').put({ id: 7, profileId: 'child', islandId: 'main', image: new Blob(['picture']), at: 1, width: 2, height: 2 });
    await old.table('gifts').put({ id: 'mail', to: 'child', from: 'sibling', fromName: 'Sibling', at: 0 });
    old.close(); await db.open();
    expect(await db.islands.get('child')).toEqual(original);
    expect(await db.archivedIslands.get(['child', 'forest'])).toMatchObject({ state: original.state });
    expect((await db.moments.get(7))?.image.size).toBe(7);
    await db.legacyGifts.delete('mail');
    expect(await db.gifts.get('mail')).toMatchObject({ to: 'child' });
    await expect(db.legacyGifts.put({ id: 'old-write', to: 'child', from: 'old', fromName: 'Old', at: 1 })).rejects.toThrow();
    await db.voyageIslands.put({ ...original, state: { ...original.state, drops: 999 } });
    expect((await db.islands.get('child'))?.state.drops).toBe(123);
    await expect(db.table('voyageMoments').add({ profileId: 'child', at: 2 })).rejects.toThrow();
    await expect(db.table('voyageMoments').where('profileId').equals('child').delete()).rejects.toThrow();
});

it('serializes recovery from two callers, retains original data and rejects the wrong island', async () => {
    const db = database(), record = source(); await db.islands.put(record);
    const [a, b] = await Promise.all([restoreGrowingWonder('child', 'main', 'W2', 4, 1, db), restoreGrowingWonder('child', 'main', 'W2', 4, 2, db)]);
    expect(a.state.wonderSeeds).toBe(1); expect(b.state.wonderSeeds).toBe(1); expect(a.revision).toBe(b.revision);
    expect(a.state.drops).toBe(123); expect(a.state.learned).toEqual(['paid-once']);
    await expect(restoreGrowingWonder('child', 'other', 'W3', a.revision, 3, db)).rejects.toThrow('島が変わり');
    const before = await db.islands.get('child'); expect(before?.version).toBe(5);
    const next = await commandGrowingIsland('child', { id: 'plant-restored', command: { type: 'plant', kind: 'wonder', cell: { x: 5, z: 4 } } }, 4, db);
    expect(next.record.state.plots.at(-1)?.restoredWonder).toBe('W2');
});

it('rolls back stock and receipt together on a failed recovery write', async () => {
    const db = database(), record = upgrade(source(), 0); await db.islands.put(record);
    const abort = () => { throw new Error('injected-write-abort'); };
    db.islands.hook('updating', abort);
    await expect(restoreGrowingWonder('child', 'main', 'W1', 4, 1, db)).rejects.toThrow('injected-write-abort');
    db.islands.hook('updating').unsubscribe(abort);
    expect(await db.islands.get('child')).toEqual(record);
});
