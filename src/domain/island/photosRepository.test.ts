import Dexie, { type Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase, SANSU_V7_STORES } from '../../db';
import { createInitialProfile } from '../user/profile';
import { deleteProfileOwnedIndexedDbRows } from '../user/repository';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { islandTables, openIsland, startIslandPlan } from './repository';
import { saveIslandWorkshop } from './workshopRepository';
import { deleteIslandPhoto, islandPhotoTables, loadIslandPhotoBlobs, loadIslandPhotoThumbnail, readIslandPhotoAlbum, saveIslandPhoto } from './photosRepository';
import { ISLAND_PHOTO_IMAGE_BYTES, ISLAND_PHOTO_THUMBNAIL_BYTES, islandPhotoId, islandPhotoReceiptId, type IslandPhotoAlbum } from './photos';
import { photoInput, photoPng } from './photos.testSupport';
import type { IslandEvent, IslandPlan } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function learningSnapshot(d: SansuDatabase) {
    const rows = await snapshot(d); delete rows.islandPhotoAlbums; delete rows.islandPhotos; delete rows.islandPhotoBlobs;
    rows.islandEvents = (rows.islandEvents as IslandEvent[]).filter(event => event.type !== 'photo_changed'); return rows;
}
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function setup(learn = true) {
    const d = new SansuDatabase(`island-photos-${crypto.randomUUID()}`, options); databases.push(d);
    const child = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    const other = { ...child, id: 'other', name: 'other' };
    await d.profiles.bulkPut([child, other]); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child, other } });
    await openIsland('child', d);
    if (learn) {
        let plan = await startIslandPlan('child', d);
        while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
        await saveIslandWorkshop('child', (await d.islands.get('child'))!.revision, { type: 'brush', specimenId: 'seaglass', section: 0 }, d);
    }
    return d;
}
async function active(d: SansuDatabase, profileId: string) { const app = (await d.appData.get('app'))!; await d.appData.put({ ...app, activeProfileId: profileId }); }
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('independent photo persistence and replay', () => {
    it('does not materialize absent albums, and saves/loads/deletes the actual PNG without changing learning, growth or workshop', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d), before = await learningSnapshot(d), shot = await photoInput();
        expect(await readIslandPhotoAlbum('child', d)).toEqual({ album: { profileId: 'child', version: 1, revision: 0 }, photos: [] });
        expect(await d.islandPhotoAlbums.count()).toBe(0);
        expect(islandPhotoTables(d).map(table => table.name)).toEqual(['appData', 'islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs', 'islandEvents']);
        expect(islandTables(d).map(table => table.name).filter(name => name.startsWith('islandPhoto'))).toEqual([]);
        const saved = await saveIslandPhoto('child', 0, shot.input, shot.blobs, d);
        expect(saved).toMatchObject({ album: { revision: 1 }, present: true, replayed: false });
        expect(await learningSnapshot(d)).toEqual(before);
        d.close(); await d.open();
        expect(await readIslandPhotoAlbum('child', d)).toEqual({ album: saved.album, photos: saved.photos });
        const loaded = (await loadIslandPhotoBlobs('child', shot.input.id, d))!;
        expect(await loaded.image.arrayBuffer()).toEqual(await shot.blobs.image.arrayBuffer());
        expect(await loaded.thumbnail.arrayBuffer()).toEqual(await shot.blobs.thumbnail.arrayBuffer());
        await deleteIslandPhoto('child', 1, shot.input.id, d);
        expect(await loadIslandPhotoBlobs('child', shot.input.id, d)).toBeUndefined();
        expect(await learningSnapshot(d)).toEqual(before);
        await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d);
        expect((await d.islandPlans.get(plan.id))!.cursor).toBe(plan.cursor + 1);
        expect(await d.islandPhotos.count()).toBe(0); expect((await d.islandPhotoAlbums.get('child'))!.revision).toBe(2);
    });
    it('lists metadata without PNG reads and verifies only thumbnail bytes until a full image is opened', async () => {
        const d = await setup(false), shot = await photoInput('child', { image: photoPng(200), thumbnail: photoPng(100) });
        await saveIslandPhoto('child', 0, shot.input, shot.blobs, d);
        const full = new Uint8Array(await shot.blobs.image.arrayBuffer()); full[0] = 0;
        await d.islandPhotoBlobs.update(shot.input.id, { image: new Blob([full], { type: 'image/png' }) });
        const sizes: number[] = [], arrayBuffer = Blob.prototype.arrayBuffer;
        const spy = vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(function (this: Blob) { sizes.push(this.size); return arrayBuffer.call(this); });
        try {
            await readIslandPhotoAlbum('child', d); expect(sizes).toEqual([]);
            expect((await loadIslandPhotoThumbnail('child', shot.input.id, d))!.size).toBe(100); expect(sizes).toEqual([100]);
            await expect(loadIslandPhotoBlobs('child', shot.input.id, d)).rejects.toMatchObject({ code: 'invalid' }); expect(sizes).toContain(200);
        } finally { spy.mockRestore(); }
    });
    it('serializes identical/different two-tab requests, preserves newer photos on lost-result replay and never resurrects deleted photos', async () => {
        const d = await setup(false), tab = new SansuDatabase(d.name, options), shot = await photoInput(); await tab.open();
        try {
            const results = await Promise.all([saveIslandPhoto('child', 0, shot.input, shot.blobs, d), saveIslandPhoto('child', 0, { ...shot.input }, shot.blobs, tab)]);
            expect(results.map(result => result.replayed).sort()).toEqual([false, true]); expect(await d.islandPhotos.count()).toBe(1);
            const second = await photoInput();
            await expect(saveIslandPhoto('child', 0, second.input, second.blobs, tab)).rejects.toMatchObject({ code: 'conflict' });
            const lostReply = async () => { await saveIslandPhoto('child', 1, second.input, second.blobs, d); throw new Error('completion lost after commit'); };
            await expect(lostReply()).rejects.toThrow('completion lost after commit');
            const before = await snapshot(d);
            expect((await saveIslandPhoto('child', 0, shot.input, shot.blobs, tab)).photos).toHaveLength(2); expect(await snapshot(d)).toEqual(before);
            await deleteIslandPhoto('child', 2, shot.input.id, d);
            const deleted = await snapshot(d);
            expect(await saveIslandPhoto('child', 0, shot.input, shot.blobs, tab)).toMatchObject({ present: false, replayed: true, album: { revision: 3 } });
            expect(await deleteIslandPhoto('child', 2, shot.input.id, tab)).toMatchObject({ present: false, replayed: true });
            expect(await snapshot(d)).toEqual(deleted);
            expect(await saveIslandPhoto('child', 1, second.input, second.blobs, tab)).toMatchObject({ present: true, replayed: true });
            const third = await photoInput(), fourth = await photoInput();
            const competing = await Promise.allSettled([saveIslandPhoto('child', 3, third.input, third.blobs, d), saveIslandPhoto('child', 3, fourth.input, fourth.blobs, tab)]);
            expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(competing.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'conflict' } });
            expect((await readIslandPhotoAlbum('child', d)).album.revision).toBe(4);
            // A known stale revision without a receipt is also rejected; it never rebases automatically.
            await expect(deleteIslandPhoto('child', 9, second.input.id, tab)).rejects.toMatchObject({ code: 'conflict' });
        } finally { tab.close(); }
    });
    it('checks active ownership before historical receipts and isolates two albums', async () => {
        const d = await setup(false), child = await photoInput(), other = await photoInput('other');
        await saveIslandPhoto('child', 0, child.input, child.blobs, d); await active(d, 'other');
        const before = await snapshot(d);
        await expect(saveIslandPhoto('child', 0, child.input, child.blobs, d)).rejects.toMatchObject({ code: 'inactive' });
        await expect(readIslandPhotoAlbum('child', d)).rejects.toMatchObject({ code: 'inactive' });
        await expect(loadIslandPhotoBlobs('other', child.input.id, d)).rejects.toMatchObject({ code: 'invalid' });
        await expect(saveIslandPhoto('other', 0, child.input, child.blobs, d)).rejects.toMatchObject({ code: 'invalid' });
        expect(await snapshot(d)).toEqual(before);
        await saveIslandPhoto('other', 0, other.input, other.blobs, d);
        expect((await readIslandPhotoAlbum('other', d)).photos.map(photo => photo.id)).toEqual([other.input.id]);
        await active(d, 'child'); expect((await readIslandPhotoAlbum('child', d)).photos.map(photo => photo.id)).toEqual([child.input.id]);
    });
    it('does not reset unknown albums, malformed metadata or orphaned/corrupt Blob rows', async () => {
        const d = await setup(false), shot = await photoInput();
        await d.islandPhotoAlbums.put({ profileId: 'child', version: 7, revision: 0 } as unknown as IslandPhotoAlbum);
        let before = await snapshot(d);
        await expect(saveIslandPhoto('child', 0, shot.input, shot.blobs, d)).rejects.toMatchObject({ code: 'invalid' }); expect(await snapshot(d)).toEqual(before);
        await d.islandPhotoAlbums.delete('child'); await saveIslandPhoto('child', 0, shot.input, shot.blobs, d);
        await d.islandPhotoBlobs.update(shot.input.id, { image: new Blob(['wrong'], { type: 'image/png' }) }); before = await snapshot(d);
        await expect(deleteIslandPhoto('child', 1, shot.input.id, d)).rejects.toMatchObject({ code: 'invalid' });
        await expect(loadIslandPhotoBlobs('child', shot.input.id, d)).rejects.toMatchObject({ code: 'invalid' }); expect(await snapshot(d)).toEqual(before);
        await d.islandPhotoBlobs.put({ id: shot.input.id, profileId: 'child', ...shot.blobs });
        const photo = (await d.islandPhotos.get(shot.input.id))!;
        await d.islandPhotos.put({ ...photo, version: 9 } as unknown as typeof photo); before = await snapshot(d);
        await expect(readIslandPhotoAlbum('child', d)).rejects.toMatchObject({ code: 'invalid' }); expect(await snapshot(d)).toEqual(before);
    });
});

describe('atomic limits, abort and deletion', () => {
    it('enforces twelve photos without deleting previous images', async () => {
        const d = await setup(false), shot = await photoInput();
        for (let index = 0; index < 12; index++) await saveIslandPhoto('child', index, { ...shot.input, id: islandPhotoId('child', crypto.randomUUID()) }, shot.blobs, d);
        const before = await snapshot(d);
        await expect(saveIslandPhoto('child', 12, shot.input, shot.blobs, d)).rejects.toMatchObject({ code: 'full' }); expect(await snapshot(d)).toEqual(before);
    });
    it('enforces combined full+thumbnail 24MiB even before the twelfth photo', async () => {
        const d = await setup(false), shot = await photoInput('child', { image: photoPng(ISLAND_PHOTO_IMAGE_BYTES), thumbnail: photoPng(ISLAND_PHOTO_THUMBNAIL_BYTES) });
        for (let index = 0; index < 11; index++) await saveIslandPhoto('child', index, { ...shot.input, id: islandPhotoId('child', crypto.randomUUID()) }, shot.blobs, d);
        const before = await snapshot(d);
        await expect(saveIslandPhoto('child', 11, shot.input, shot.blobs, d)).rejects.toMatchObject({ code: 'full' }); expect(await snapshot(d)).toEqual(before);
    });
    it('rolls back a real native abort after metadata, Blobs and album writes, then retries the exact original receipt', async () => {
        const d = await setup(), shot = await photoInput(), before = await snapshot(d); let aborts = 0, completed: Promise<void> | undefined;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'photo_changed') {
                completed = new Promise(resolve => transaction.idbtrans.addEventListener('abort', () => { aborts++; resolve(); })); transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandPhoto('child', 0, shot.input, shot.blobs, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort); await completed;
        expect(aborts).toBe(1); expect(await snapshot(d)).toEqual(before);
        await saveIslandPhoto('child', 0, shot.input, shot.blobs, d);
        const saved = await snapshot(d); d.islandEvents.hook('creating', abort);
        await expect(deleteIslandPhoto('child', 1, shot.input.id, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort); await completed;
        expect(aborts).toBe(2); expect(await snapshot(d)).toEqual(saved);
        await deleteIslandPhoto('child', 1, shot.input.id, d); expect(await d.islandPhotos.count()).toBe(0);
    });
    it('distinguishes real quota-shaped failures from unknown I/O and never commits partial rows', async () => {
        const d = await setup(false), shot = await photoInput(), before = await snapshot(d);
        const quota = () => { throw new DOMException('quota diagnostic', 'QuotaExceededError'); };
        d.islandPhotoBlobs.hook('creating', quota);
        await expect(saveIslandPhoto('child', 0, shot.input, shot.blobs, d)).rejects.toMatchObject({ code: 'quota' });
        d.islandPhotoBlobs.hook('creating').unsubscribe(quota); expect(await snapshot(d)).toEqual(before);
        const unknown = () => { throw new Error('temporary I/O diagnostic'); }; d.islandPhotoBlobs.hook('creating', unknown);
        await expect(saveIslandPhoto('child', 0, shot.input, shot.blobs, d)).rejects.toThrow('temporary I/O diagnostic');
        d.islandPhotoBlobs.hook('creating').unsubscribe(unknown); expect(await snapshot(d)).toEqual(before);
        await saveIslandPhoto('child', 0, shot.input, shot.blobs, d);
    });
    it('deletes profile photo stores and receipts atomically, keeps the second owner, and denies stale retry after profile deletion', async () => {
        const d = await setup(), child = await photoInput(), other = await photoInput('other');
        await saveIslandPhoto('child', 0, child.input, child.blobs, d); await active(d, 'other'); await saveIslandPhoto('other', 0, other.input, other.blobs, d);
        const before = await snapshot(d);
        const remove = () => d.transaction('rw', d.tables, async () => {
            const app = (await d.appData.get('app'))!, profiles = { ...app.profiles }; delete profiles.child;
            await d.appData.put({ ...app, profiles }); await deleteProfileOwnedIndexedDbRows(d, 'child');
        });
        let completed: Promise<void> | undefined;
        const abort = (_key: unknown, _value: unknown, transaction: Transaction) => {
            completed = new Promise(resolve => transaction.idbtrans.addEventListener('abort', () => resolve())); transaction.idbtrans.abort();
        };
        d.islandPhotoBlobs.hook('deleting', abort); await expect(remove()).rejects.toThrow(); d.islandPhotoBlobs.hook('deleting').unsubscribe(abort); await completed;
        expect(await snapshot(d)).toEqual(before); await remove();
        expect(await d.islandPhotos.get(child.input.id)).toBeUndefined(); expect(await d.islandPhotoBlobs.get(child.input.id)).toBeUndefined();
        expect(await d.islandPhotoAlbums.get('child')).toBeUndefined(); expect(await d.islandEvents.get(islandPhotoReceiptId('child', 0))).toBeUndefined();
        expect((await readIslandPhotoAlbum('other', d)).photos.map(photo => photo.id)).toEqual([other.input.id]);
        const removed = await snapshot(d);
        await expect(saveIslandPhoto('child', 0, child.input, child.blobs, d)).rejects.toMatchObject({ code: 'inactive' }); expect(await snapshot(d)).toEqual(removed);
    });
});

describe('v7 to v8 additive migration', () => {
    it('preserves every prior store schema and row, including normal learning, a pending plan, workshop checkpoint and receipts', async () => {
        const source = await setup(); await startIslandPlan('child', source);
        const old = await snapshot(source), name = `island-photo-migration-${crypto.randomUUID()}`;
        const legacy = new Dexie(name, options); legacy.version(7).stores(SANSU_V7_STORES); await legacy.open();
        for (const table of legacy.tables) if (old[table.name].length) await table.bulkPut(old[table.name]);
        const schemas = Object.fromEntries(legacy.tables.map(table => [table.name, { primary: table.schema.primKey.src, indexes: table.schema.indexes.map(index => index.src) }])); legacy.close();
        const upgraded = new SansuDatabase(name, options); databases.push(upgraded); await upgraded.open();
        expect(upgraded.verno).toBe(8);
        for (const name of Object.keys(SANSU_V7_STORES)) {
            expect(await upgraded.table(name).toArray()).toEqual(old[name]);
            const table = upgraded.table(name); expect({ primary: table.schema.primKey.src, indexes: table.schema.indexes.map(index => index.src) }).toEqual(schemas[name]);
        }
        for (const table of [upgraded.islandPhotoAlbums, upgraded.islandPhotos, upgraded.islandPhotoBlobs]) expect(await table.count()).toBe(0);
        const before = await learningSnapshot(upgraded), shot = await photoInput(); await saveIslandPhoto('child', 0, shot.input, shot.blobs, upgraded);
        expect(await learningSnapshot(upgraded)).toEqual(before); expect((await readIslandPhotoAlbum('child', upgraded)).photos).toHaveLength(1);
    });
});
