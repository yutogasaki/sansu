import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { terrainEditingRevision } from './terrainEditing';
import { newIsland } from './island';
import { commandGrowingIsland, deleteGrowingOwner, GrowingIslandDatabase, readGrowingIsland, sailGrowingIsland, syncGrowingIsland, type GrowingRecord } from './repository';
import { readable } from './syncProjection';

const stores: Dexie[] = [], T = 1_000;
const database = () => { const db = new GrowingIslandDatabase(`terrain-save-${crypto.randomUUID()}`); stores.push(db); return db; };
const life = () => { const db = new IslandLifeDatabase(`terrain-life-${crypto.randomUUID()}`); stores.push(db); return db; };
const record = (): GrowingRecord => ({ profileId: 'kid', version: 5, revision: 7, createdAt: T, updatedAt: T, state: newIsland('kid', T) });
const edit = (id: string) => ({ id, command: { type: 'terrain-edit' as const, cell: { x: 0, z: 4 }, delta: -1 as const } });
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });
function oldDatabase(name: string) {
    const db = new Dexie(name); stores.push(db);
    db.version(12).stores({ foundationIslands: '&profileId', foundationArchives: '[profileId+islandId], profileId',
        foundationMoments: '++id, profileId, [profileId+at]', foundationGifts: '&id, to, from',
        foundationReceipts: '[profileId+completionId], profileId', deletedOwners: '&profileId' });
    return db;
}

describe('terrain saves', () => {
    it('commits edits and history once, reloads, syncs new learning, then returns through another island', async () => {
        const db = database(), oldLife = life(), source = record(); await db.islands.put(source);
        const result = await commandGrowingIsland('kid', edit('dig'), T, db);
        expect(result.record.version).toBe(6);
        expect(result.record.revision).toBe(8);
        expect(await commandGrowingIsland('kid', edit('dig'), T + 1, db)).toEqual(result);
        db.close(); await db.open();
        expect((await readGrowingIsland('kid', db))!.state.terrain).toEqual(result.record.state.terrain);
        const sync = await syncGrowingIsland('kid', [{ id: 'real-completion', at: T + 1 }], T + 1, db, oldLife);
        expect(sync.record.state.terrain).toEqual(result.record.state.terrain);
        expect(sync.record.state.learned).toContain('real-completion');
        await sailGrowingIsland('kid', 'main', { id: 'other', create: { name: 'other', start: 'garden' } }, T + 2, db);
        const returned = await sailGrowingIsland('kid', 'other', { id: 'main' }, T + 3, db);
        expect(returned.version).toBe(6); expect(returned.state.terrain).toEqual(result.record.state.terrain);
        expect(returned.state.learned).toContain('real-completion');
    });

    it('rolls back first-edit version and geometry together, rejects stale revision, and keeps no-op unchanged', async () => {
        const db = database(), source = record(); await db.islands.put(source);
        const put = vi.spyOn(db.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(commandGrowingIsland('kid', edit('dig'), T, db)).rejects.toThrow('disk-full'); put.mockRestore();
        expect(await db.islands.get('kid')).toEqual(source);
        await expect(commandGrowingIsland('kid', { ...edit('stale'), command: { ...edit('stale').command, expectedTerrainRevision: 'old' } }, T, db)).rejects.toThrow('かわった');
        await commandGrowingIsland('kid', { id: 'no-undo', command: { type: 'terrain-undo' } }, T, db);
        expect(await db.islands.get('kid')).toEqual(source);
        const revision = terrainEditingRevision(source.state);
        const intents = ['one', 'two'].map(id => commandGrowingIsland('kid', { id, command: { ...edit(id).command, expectedTerrainRevision: revision } }, T, db));
        const outcomes = await Promise.allSettled(intents);
        expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect((await db.islands.get('kid'))!.state.terrain!.undo).toHaveLength(1);
    });

    it('copies every durable boundary once and isolates old wallets, receipts and deletion guards', async () => {
        const db = database(), legacy = oldDatabase(db.name), source = record();
        await legacy.table('foundationIslands').put(source);
        await legacy.table('foundationArchives').put({ ...source, islandId: 'away' });
        await legacy.table('foundationMoments').put({ id: 12, profileId: 'kid', at: T, image: new Blob(['photo']), width: 1, height: 1 });
        await legacy.table('foundationGifts').put({ id: 'gift', from: 'sib', to: 'kid' });
        await legacy.table('foundationReceipts').put({ profileId: 'kid', completionId: 'credited', islandId: 'main' });
        await legacy.table('deletedOwners').put({ profileId: 'deleted', deletedAt: T });
        legacy.close(); await db.open();
        expect(await db.islands.get('kid')).toEqual(source);
        expect(await db.archivedIslands.count()).toBe(1); expect(await db.moments.count()).toBe(1);
        expect(await db.gifts.count()).toBe(1); expect(await db.foundationReceipts.count()).toBe(1);
        expect(await db.deletedOwners.get('deleted')).toEqual({ profileId: 'deleted', deletedAt: T });
        await commandGrowingIsland('kid', edit('dig'), T, db);
        const saved = await db.islands.get('kid');
        db.close(); await legacy.open();
        await legacy.table('foundationIslands').put({ ...source, revision: 99 });
        await expect(legacy.table('foundationReceipts').put({ profileId: 'kid', completionId: 'old-only' })).rejects.toThrow();
        await expect(legacy.table('deletedOwners').put({ profileId: 'kid', deletedAt: T })).rejects.toThrow();
        // Old delivery must fail atomically before it can ACK the shared learning outbox.
        await expect(legacy.transaction('rw', legacy.table('foundationIslands'), legacy.table('foundationReceipts'), async () => {
            await legacy.table('foundationIslands').put({ ...source, revision: 100 });
            await legacy.table('foundationReceipts').add({ profileId: 'kid', completionId: 'old-only' });
        })).rejects.toThrow();
        expect((await legacy.table('foundationIslands').get('kid')).revision).toBe(99);
        await expect(legacy.table('foundationMoments').add({ profileId: 'kid', at: T })).rejects.toThrow();
        await expect(legacy.transaction('rw', legacy.table('foundationIslands'), legacy.table('foundationMoments'), async () => {
            await legacy.table('foundationIslands').delete('kid');
            await legacy.table('foundationMoments').where('profileId').equals('kid').delete();
        })).rejects.toThrow();
        legacy.close(); await db.open();
        expect(await db.islands.get('kid')).toEqual(saved);
        expect(await db.foundationReceipts.get(['kid', 'old-only'])).toBeUndefined();
        expect(await db.deletedOwners.get('kid')).toBeUndefined();
        await deleteGrowingOwner('kid', db);
        expect(await db.islands.get('kid')).toBeUndefined(); expect(await db.archivedIslands.count()).toBe(0);
        expect(await db.table('foundationIslands').get('kid')).toBeUndefined();
        expect(await db.foundationReceipts.count()).toBe(0); expect(await db.moments.count()).toBe(0);
    });

    it('rolls back the complete schema cutover when copying fails', async () => {
        const db = database(), legacy = oldDatabase(db.name), source = record();
        await legacy.table('foundationIslands').put(source);
        await legacy.table('foundationMoments').put({ id: 12, profileId: 'kid', at: T });
        legacy.close();
        db.version(13).upgrade(() => { throw new Error('copy-failed'); });
        await expect(db.open()).rejects.toThrow('copy-failed');
        await legacy.open();
        expect(await legacy.table('foundationIslands').get('kid')).toEqual(source);
        expect(await legacy.table('foundationMoments').count()).toBe(1);
        expect(legacy.backendDB().objectStoreNames.contains('terrainIslands')).toBe(false);
        legacy.close();
    });

    it('rejects missing or corrupt version6 terrain without guessing a repair', () => {
        expect(() => readable({ ...record(), version: 6 })).toThrow('かたち');
        const source = record(); source.state.terrain = { version: 1, heights: { '0,4': -99 }, undo: [], redo: [] };
        expect(() => readable({ ...source, version: 6 })).toThrow('よみこめなかった');
        expect(() => readable(source)).toThrow('かたち');
    });
});
