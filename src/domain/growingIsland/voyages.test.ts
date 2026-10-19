import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newIsland } from './island';
import { GrowingIslandDatabase, addMoment, commandGrowingIsland, deleteGrowingOwner, listMoments, listVoyageIslands, sailGrowingIsland, syncGrowingIsland, type GrowingRecord } from './repository';
import { IslandLifeDatabase } from '../islandLife/repository';
import { landBounds } from './space';
const now = 1_800_000_000_000;
const dbs: Dexie[] = [];
const database = () => { const db = new GrowingIslandDatabase(`voyage-${crypto.randomUUID()}`); dbs.push(db); return db; };
const life = () => { const db = new IslandLifeDatabase(`voyage-life-${crypto.randomUUID()}`); dbs.push(db); return db; };
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.delete())); });
async function owner(db: GrowingIslandDatabase, id = 'child') {
    const state = newIsland(id, now);
    state.drops = 500; state.learned = ['old']; state.mastery = { math: 2, vocab: 1 };
    state.land = { expanded: 'west', extra: ['east', 'south'], capes: ['east', 'west'], districts: ['east', 'south'] };
    state.landmarks.push({ id: 'old-tree', kind: 'sapling', growth: 18, cell: { x: 5, z: 2 } });
    const record: GrowingRecord = { profileId: id, version: 4, revision: 3, createdAt: now, updatedAt: now, state };
    await db.islands.put(record); return record;
}
const destination = { id: 'forest', create: { name: 'もりのわがや', start: 'grove' as const } };

describe('independent islands and voyages', () => {
    it('returns every owned cell and resident untouched; both islands can expand without contact', async () => {
        const db = database(), original = await owner(db);
        const forest = await sailGrowingIsland('child', 'main', destination, now, db);
        expect(forest.state.land).toEqual({ extra: [], capes: [] });
        expect(forest.state.landmarks.filter(item => item.kind === 'sapling')).toHaveLength(2);
        expect(forest.state.drops).toBe(500);
        const planted = await commandGrowingIsland('child', { id: 'home', islandId: 'forest', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }, now, db);
        const expanded = await commandGrowingIsland('child', { id: 'expand', islandId: 'forest', command: { type: 'expand', side: 'east' } }, now, db);
        expect(landBounds(expanded.record.state).maxX).toBe(8);
        const restored = await sailGrowingIsland('child', 'forest', { id: 'main' }, now, db);
        expect(restored.state.land).toEqual(original.state.land);
        expect(restored.state.landmarks).toEqual(original.state.landmarks);
        expect(restored.state.villagers).toEqual(original.state.villagers);
        expect(restored.state.drops).toBe(expanded.record.state.drops);
        const again = await sailGrowingIsland('child', 'main', { id: 'forest' }, now, db);
        expect(again.state.plots).toEqual(planted.record.state.plots);
        expect(again.state.land).toEqual(expanded.record.state.land);
        db.close(); await db.open();
        expect((await db.islands.get('child'))?.islandId).toBe('forest');
    });

    it('shares one learning claim and wallet, while earned town time stays on its own island', async () => {
        const db = database(), oldLife = life();
        await owner(db); await sailGrowingIsland('child', 'main', destination, now, db);
        const fact = { id: 'new-completion', at: now + 1 };
        const earned = await syncGrowingIsland('child', [fact], now + 1, db, oldLife, { math: 3, vocab: 1 });
        expect(earned.record.state.keepsakes).toHaveLength(1);
        expect(earned.learned).toBe(1);
        const forestTime = structuredClone(earned.record.state.town);
        await sailGrowingIsland('child', 'forest', { id: 'main' }, now + 2, db);
        const home = await syncGrowingIsland('child', [fact], now + 2, db, oldLife, { math: 3, vocab: 1 });
        expect(home.record.state.keepsakes).toHaveLength(0);
        expect(home.learned).toBe(0); expect(home.record.state.drops).toBe(502);
        expect(home.record.state.town).toEqual({ clock: 0, bank: 0 });
        await commandGrowingIsland('child', { id: 'spend', command: { type: 'place', kind: 'flower', cell: { x: 0, z: 4 } } }, now + 2, db);
        const back = await sailGrowingIsland('child', 'main', { id: 'forest' }, now + 2, db);
        expect(back.state.drops).toBeLessThan(502);
        expect(back.state.town).toEqual(forestTime);
        expect(back.state.keepsakes).toHaveLength(1);
        expect((await syncGrowingIsland('child', [fact], now + 2, db, oldLife)).learned).toBe(0);
    });

    it('keeps both records unchanged after invalid creation, stale travel or stale commands', async () => {
        const db = database(); await owner(db);
        await expect(sailGrowingIsland('child', 'main', { id: 'bad', create: { name: '', start: 'garden' } }, now, db)).rejects.toThrow('なまえ');
        expect(await db.archivedIslands.count()).toBe(0);
        await sailGrowingIsland('child', 'main', destination, now, db);
        const current = await db.islands.get('child');
        await expect(commandGrowingIsland('child', { id: 'late', command: { type: 'name', target: 'island', name: 'wrong' } }, now, db)).rejects.toThrow('かわった');
        await expect(sailGrowingIsland('child', 'main', { id: 'other', create: { name: 'other', start: 'garden' } }, now, db)).rejects.toThrow('かわった');
        expect(await db.islands.get('child')).toEqual(current);
        expect(await db.archivedIslands.count()).toBe(1);
    });

    it('rolls back the archived snapshot if saving the destination fails', async () => {
        const db = database(), original = await owner(db);
        const write = vi.spyOn(db.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(sailGrowingIsland('child', 'main', destination, now, db)).rejects.toThrow('disk-full');
        write.mockRestore();
        expect(await db.islands.get('child')).toEqual(original);
        expect(await db.archivedIslands.count()).toBe(0);
    });

    it('makes a retried creation idempotent and isolates another profile', async () => {
        const db = database(); await owner(db); const other = await owner(db, 'sibling');
        const first = await sailGrowingIsland('child', 'main', destination, now, db);
        expect(await sailGrowingIsland('child', 'main', destination, now + 1, db)).toEqual(first);
        expect(await db.archivedIslands.count()).toBe(1);
        expect(await db.islands.get('sibling')).toEqual(other);
        expect(await listVoyageIslands('sibling', db)).toHaveLength(1);
    });

    it('separates old and new photographs and removes all islands only for the deleted owner', async () => {
        const db = database(); await owner(db); await owner(db, 'sibling');
        await db.moments.add({ profileId: 'child', at: now, image: new Blob(['old']), width: 1, height: 1 });
        await sailGrowingIsland('child', 'main', destination, now, db);
        expect(await listMoments('child', db)).toHaveLength(0);
        await addMoment('child', new Blob(['new']), 1, 1, now, db, 'forest');
        expect(await listMoments('child', db)).toHaveLength(1);
        await sailGrowingIsland('child', 'forest', { id: 'main' }, now, db);
        expect(await listMoments('child', db)).toHaveLength(1);
        await deleteGrowingOwner('child', db);
        expect(await db.islands.get('child')).toBeUndefined();
        expect(await db.archivedIslands.count()).toBe(0);
        expect(await db.moments.count()).toBe(0);
        expect(await db.islands.get('sibling')).toBeDefined();
    });

    it('copies schema5 once and fences an older writer from the active and archived islands', async () => {
        const db = database(), old = new Dexie(db.name); dbs.push(old);
        old.version(1).stores({ islands: '&profileId' });
        old.version(2).stores({ moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        old.version(3).stores({ balancedIslands: '&profileId' });
        old.version(4).stores({ guidedIslands: '&profileId' });
        old.version(5).stores({ placedIslands: '&profileId' });
        const state = newIsland('child', now); state.drops = 53;
        const source = { profileId: 'child', version: 4, revision: 7, createdAt: now, updatedAt: now, state };
        await old.table('placedIslands').put(source); old.close();
        expect(await db.islands.get('child')).toEqual(source);
        await sailGrowingIsland('child', 'main', destination, now, db);
        await old.open();
        await old.table('placedIslands').put({ ...source, state: { ...state, drops: 9999 } });
        expect((await db.islands.get('child'))?.state.drops).toBe(53);
        expect((await db.archivedIslands.get(['child', 'main']))?.state.drops).toBe(53);
        old.close();
    });
});


/** Schema5's deletion transaction must fail atomically after the photo-store fence. */
function priorDatabase(name: string, version = 5) {
    const old = new Dexie(name); dbs.push(old);
    old.version(1).stores({ islands: '&profileId' });
    old.version(2).stores({ moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
    old.version(3).stores({ balancedIslands: '&profileId' });
    old.version(4).stores({ guidedIslands: '&profileId' });
    old.version(5).stores({ placedIslands: '&profileId' });
    if (version === 6) old.version(6).stores({ voyageIslands: '&profileId', archivedIslands: '[profileId+islandId], profileId' });
    return old;
}
async function priorDeleteOwner(old: Dexie, profileId: string) {
    const names = ['placedIslands', 'guidedIslands', 'balancedIslands', 'islands', 'moments', 'gifts'];
    await old.transaction('rw', names, async () => {
        for (const name of names.slice(0, 4)) await old.table(name).delete(profileId);
        await old.table('moments').where('profileId').equals(profileId).delete();
        await old.table('gifts').where('to').equals(profileId).delete();
        await old.table('gifts').where('from').equals(profileId).delete();
    });
}

describe('photo migration and legacy deletion fence', () => {
    it('copies schema5 photo bytes and IDs once and rejects old retention and owner deletion atomically', async () => {
        const db = database(), old = priorDatabase(db.name);
        const source: GrowingRecord = { profileId: 'child', version: 4, revision: 1, createdAt: now, updatedAt: now, state: newIsland('child', now) };
        await old.table('placedIslands').put(source);
        await old.table('moments').add({ id: 7, profileId: 'child', at: now, image: new Blob(['original']), width: 4, height: 3 }); old.close();
        const migrated = await db.moments.get(7);
        expect(migrated).toMatchObject({ id: 7, profileId: 'child', width: 4, height: 3 });
        expect(await migrated!.image.text()).toBe('original');
        await owner(db, 'sibling');
        await sailGrowingIsland('child', 'main', destination, now, db);
        await db.moments.bulkAdd(['main', 'forest'].flatMap(islandId => Array.from({ length: islandId === 'main' ? 59 : 60 }, (_, i) =>
            ({ profileId: 'child', islandId, at: now + i + 1, image: new Blob([islandId]), width: 1, height: 1 }))));
        for (const id of ['main', 'forest']) await addMoment('child', new Blob(['latest']), 1, 1, now + 100, db, id);
        const photos = await db.moments.toArray(), active = await db.islands.toArray(), archived = await db.archivedIslands.toArray();
        expect(photos).toHaveLength(120);
        db.close();
        // Old APIs auto-open the database; its incompatible legacy primary key rejects them.
        await expect((async () => { await old.table('moments').add({ profileId: 'child', at: now + 100, image: new Blob(['old']), width: 1, height: 1 }); })()).rejects.toThrow();
        await expect(priorDeleteOwner(old, 'child')).rejects.toThrow(); old.close();
        await db.open();
        expect(await db.moments.toArray()).toEqual(photos);
        expect(await db.islands.toArray()).toEqual(active); expect(await db.archivedIslands.toArray()).toEqual(archived);
        expect(await db.placedIslands.get('child')).toEqual(source);
        expect(await db.moments.add({ profileId: 'sibling', at: now, image: new Blob(['sibling']), width: 1, height: 1 })).toBeGreaterThan(7);
        db.close(); await db.open(); expect(await db.moments.count()).toBe(121);
        await deleteGrowingOwner('child', db);
        expect(await db.islands.get('child')).toBeUndefined(); expect(await db.archivedIslands.count()).toBe(0);
        expect(await db.moments.where('profileId').equals('child').count()).toBe(0);
        expect(await db.placedIslands.get('child')).toBeUndefined();
        expect(await db.moments.where('profileId').equals('sibling').count()).toBe(1);
    });

    it('preserves schema6 island identities and all photos when upgrading an already travelled profile', async () => {
        const db = database(), old = priorDatabase(db.name, 6);
        const state = newIsland('child', now);
        const forest = { profileId: 'child', islandId: 'forest', version: 4, revision: 9, createdAt: now, updatedAt: now, state };
        await old.table('voyageIslands').put(forest);
        await old.table('archivedIslands').put({ ...forest, islandId: 'main' });
        await old.table('moments').bulkAdd([
            { id: 1, profileId: 'child', at: now, image: new Blob(['main']), width: 1, height: 1 },
            { id: 2, profileId: 'child', islandId: 'forest', at: now, image: new Blob(['forest']), width: 1, height: 1 },
        ]); old.close();
        expect(await db.islands.get('child')).toEqual(forest);
        expect(await listMoments('child', db)).toMatchObject([{ id: 2, islandId: 'forest' }]);
        expect(await db.archivedIslands.get(['child', 'main'])).toBeDefined();
        expect(await db.moments.count()).toBe(2);
        expect(await db.table('moments').count()).toBe(0);
        expect(db.backendDB().transaction('moments').objectStore('moments').keyPath).toBe('requiresVoyageWriter');
    });

    it('restores the source photos and schema when photo migration aborts, then retries without duplication', async () => {
        const db = database(), old = priorDatabase(db.name, 6);
        await old.table('moments').add({ id: 3, profileId: 'child', at: now, image: new Blob(['keep']), width: 2, height: 3 }); old.close();
        db.version(7).upgrade(() => { throw new Error('photo-copy-aborted'); });
        await expect(db.open()).rejects.toThrow('photo-copy-aborted');
        await old.open(); expect(await old.table('moments').count()).toBe(1);
        expect(old.backendDB().objectStoreNames.contains('voyageMoments')).toBe(false); old.close();
        const retry = new GrowingIslandDatabase(db.name); dbs.push(retry);
        expect(await retry.moments.count()).toBe(1); expect(await (await retry.moments.get(3))!.image.text()).toBe('keep');
        retry.close(); await retry.open(); expect(await retry.moments.count()).toBe(1);
    });
});
