import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandLifeDatabase, updateLife } from '../islandLife/repository';
import type { LifeCommand } from '../islandLife/model';
import { commandLife, replayLife } from '../islandLife/simulation';

import { learningDay, newLife } from '../islandLife/model';
import { GrowingIslandDatabase, MOMENT_LIMIT, addMoment, commandGrowingIsland, deleteGrowingOwner, flowerSentToday, listMoments,
    readGrowingIsland, sendFlower, syncGrowingIsland } from './repository';
import type { GrowingRecord } from './repository';
import { newIsland } from './island';
import { dayMoment } from './moments';

const stores: (GrowingIslandDatabase | IslandLifeDatabase)[] = [];
const growing = () => { const d = new GrowingIslandDatabase(`growing-test-${crypto.randomUUID()}`); stores.push(d); return d; };
const life = () => { const d = new IslandLifeDatabase(`life-test-${crypto.randomUUID()}`); stores.push(d); return d; };
afterEach(async () => { await Promise.all(stores.splice(0).map(d => d.delete())); });
const T0 = Date.UTC(2026, 8, 29, 9), HOUR = 3_600_000;

describe('growing island persistence', () => {
    it('persists an unseen real-day moment without rewriting or redrawing on repeated sync', async () => {
        const db = growing(), old = life(), state = newIsland('batch', T0);
        state.landmarks = Array.from({ length: 6 }, (_, x) => ({ id: `flower-${x}`, kind: 'flower', cell: { x, z: 3 }, growth: 6 }));
        const day = Array.from({ length: 30 }, (_, i) => i).find(i => dayMoment(state, i))!;
        const now = T0 + day * 24 * HOUR; state.nature.realAt = now;
        await db.islands.put({ profileId: 'batch', version: 2, revision: 3, createdAt: T0, updatedAt: now, state });
        const first = await syncGrowingIsland('batch', [], now, db, old);
        expect(first.town).toHaveLength(1);
        db.close(); await db.open();
        const again = await syncGrowingIsland('batch', [], now, db, old);
        expect(again.town).toEqual(first.town);
        expect(again.record.revision).toBe(first.record.revision);
        await commandGrowingIsland('batch', { id: 'shown', command: { type: 'ack-moment', day } }, now, db);
        expect((await syncGrowingIsland('batch', [], now, db, old)).town).toEqual([]);
    });

    it('rolls back a failed table copy without losing the legacy source or photos', async () => {
        const db = growing(), legacy = new Dexie(db.name);
        legacy.version(2).stores({ islands: '&profileId', moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        const source: GrowingRecord = { profileId: 'kid', version: 1, revision: 9, createdAt: T0, updatedAt: T0, state: newIsland('kid', T0) };
        await legacy.table('islands').put(source);
        await legacy.table('moments').add({ profileId: 'kid', at: T0, image: new Blob(['photo']), width: 4, height: 3 });
        legacy.close();
        db.version(3).upgrade(() => { throw new Error('copy-aborted'); });
        await expect(db.open()).rejects.toThrow('copy-aborted');
        await legacy.open();
        expect(await legacy.table('islands').get('kid')).toEqual(source);
        expect(await legacy.table('moments').count()).toBe(1);
        expect(legacy.backendDB().objectStoreNames.contains('balancedIslands')).toBe(false);
        legacy.close();
        const retry = new GrowingIslandDatabase(db.name); stores.push(retry);
        await retry.open();
        expect(await retry.islands.get('kid')).toEqual(source);
        expect(await retry.moments.count()).toBe(1);
    });

    it('migrates v1 atomically, preserving earned rights, photos and undelivered gifts', async () => {
        const db = growing();
        const state = newIsland('migrate', T0);
        state.drops = 123; state.town.bank = 336; state.learned = ['already-paid'];
        state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
        state.genki.best = 150; state.wonderSeeds = 4;
        const original: GrowingRecord = { profileId: 'migrate', version: 1, revision: 7, createdAt: T0, updatedAt: T0, state };
        await db.islands.put(original);
        await addMoment('migrate', new Blob(['photo']), 4, 3, T0, db);
        await sendFlower('migrate', 'みなと', 'sibling', T0, db);
        const images = await db.moments.toArray(), gifts = await db.gifts.toArray();
        const put = vi.spyOn(db.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        const intent = { id: 'rename', command: { type: 'name' as const, target: 'island', name: 'みなと' } };
        await expect(commandGrowingIsland('migrate', intent, T0 + 24 * HOUR, db)).rejects.toThrow('disk-full');
        expect(await db.islands.get('migrate')).toEqual(original);
        put.mockRestore();
        const next = await commandGrowingIsland('migrate', intent, T0 + 24 * HOUR, db);
        expect(next.record).toMatchObject({ version: 4, revision: 8, createdAt: T0 });
        expect(next.record.state).toEqual({ ...state, islandName: 'みなと', applied: ['rename'], surprise: { day: 1 } });
        expect(await db.moments.toArray()).toEqual(images);
        expect(await db.gifts.toArray()).toEqual(gifts);
        const again = await commandGrowingIsland('migrate', intent, T0 + 25 * HOUR, db);
        expect(again.record).toEqual(next.record);
    });

    it('refuses unknown records on reads, syncs and commands without writing', async () => {
        const db = growing(), old = life();
        const record = { profileId: 'future', version: 99, revision: 1, createdAt: T0, updatedAt: T0, state: newIsland('future', T0) } as unknown as GrowingRecord;
        await db.islands.put(record);
        await expect(readGrowingIsland('future', db)).rejects.toThrow('新しい版');
        await expect(syncGrowingIsland('future', [], T0, db, old)).rejects.toThrow('新しい版');
        await expect(commandGrowingIsland('future', { id: 'open', command: { type: 'open-all' } }, T0, db)).rejects.toThrow('新しい版');
        expect(await db.islands.get('future')).toEqual(record);
    });

    it('isolates legacy writers and copies the old table once without truncating new districts', async () => {
        const db = growing();
        db.close();
        const legacy = new Dexie(db.name);
        legacy.version(1).stores({ islands: '&profileId' });
        legacy.version(2).stores({ islands: '&profileId', moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        const record: GrowingRecord = { profileId: 'kid', version: 1, revision: 4, createdAt: T0, updatedAt: T0, state: newIsland('kid', T0) };
        await legacy.table('islands').put(record);
        legacy.close();
        await db.open();
        expect(await db.islands.get('kid')).toEqual(record);
        const next = await commandGrowingIsland('kid', { id: 'rename', command: { type: 'name', target: 'island', name: 'あたらしい しま' } }, T0, db);
        db.close();
        await legacy.open();
        await legacy.table('islands').put({ ...record, state: { ...record.state, drops: 999 } });
        legacy.close();
        await db.open();
        expect(await db.islands.get('kid')).toEqual(next.record);
        await deleteGrowingOwner('kid', db);
        expect(await db.legacyIslands.get('kid')).toBeUndefined();
    });

    it('creates a new island for a new child and saves it once', async () => {
        const db = growing(), old = life();
        const first = await syncGrowingIsland('new-kid', [], T0, db, old);
        expect(first.record.revision).toBe(0);
        expect(first.record.state.tutorial).toBe('first-home');
        expect(first.record.migratedFrom).toBeUndefined();
        const again = await syncGrowingIsland('new-kid', [], T0, db, old);
        expect(again.record.revision).toBe(0);
    });

    it('copies the current island once and leaves its record untouched', async () => {
        const db = growing(), old = life();
        let record = newLife('kid', T0 - 10 * HOUR);
        record.credits = [{ id: 'past', at: T0 - 9 * HOUR, day: learningDay(T0 - 9 * HOUR) }];
        record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 4, z: 3 } }, 'buy-flower', T0 - 8 * HOUR);
        await old.worlds.put(record);
        const before = structuredClone(await old.worlds.get('kid'));
        const result = await syncGrowingIsland('kid', [{ id: 'past', at: T0 - 9 * HOUR }], T0, db, old);
        expect(result.record.migratedFrom).toMatchObject({ lifeVersion: record.version, lifeRevision: record.revision });
        expect(result.record.state.landmarks.some(l => l.kind === 'flower' && l.cell?.x === 4)).toBe(true);
        expect(result.learned).toBe(0);
        expect(await old.worlds.get('kid')).toEqual(before);
    });

    it('adds learning once and retains time when nothing is prepared', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old);
        const facts = [1, 2, 3].map(n => ({ id: `done-${n}`, at: T0 + n }));
        const opened = await syncGrowingIsland('kid', facts, T0 + 10, db, old);
        expect(opened.learned).toBe(3);
        expect(opened.record.state.drops).toBe(6);
        expect(opened.record.state.town).toEqual({ clock: 0, bank: 6 });
        const again = await syncGrowingIsland('kid', facts, T0 + 20, db, old);
        expect(again.learned).toBe(0);
        expect(again.record.state.drops).toBe(6);
    });

    it('applies an action once, even after a background refresh saved first', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old);
        await syncGrowingIsland('kid', [{ id: 'one', at: T0 + 5 }], T0 + 6, db, old);
        const intent = { id: 'plant-1', command: { type: 'plant' as const, kind: 'home' as const, cell: { x: 1, z: 3 } } };
        const planted = await commandGrowingIsland('kid', intent, T0 + 7, db);
        expect(planted.record.state.villagers).toHaveLength(1);
        const repeated = await commandGrowingIsland('kid', intent, T0 + 8, db);
        expect(repeated.record.revision).toBe(planted.record.revision);
    });

    it('delivers a sibling\'s flower once, and only one per day from the same visitor', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old);
        await syncGrowingIsland('sis', [], T0, db, old);
        const before = structuredClone(await readGrowingIsland('kid', db));
        expect(await sendFlower('sis', 'はるか', 'kid', T0 + HOUR, db)).toBe(true);
        expect(await sendFlower('sis', 'はるか', 'kid', T0 + 2 * HOUR, db)).toBe(false);
        expect(await flowerSentToday('sis', 'kid', T0 + 3 * HOUR, db)).toBe(true);
        // Visiting never writes the other child's island itself.
        expect(await readGrowingIsland('kid', db)).toEqual(before);
        const opened = await syncGrowingIsland('kid', [], T0 + 4 * HOUR, db, old);
        expect(opened.town).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'gift', from: 'はるか' })]));
        expect(opened.record.state.landmarks.filter(l => l.from === 'はるか')).toHaveLength(1);
        expect(await db.gifts.count()).toBe(0);
        const again = await syncGrowingIsland('kid', [], T0 + 5 * HOUR, db, old);
        expect(again.record.state.landmarks.filter(l => l.from === 'はるか')).toHaveLength(1);
    });

    it('brings a keepsake when a learning level rises after the island started', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old, { math: 5, vocab: 1 });
        const next = await syncGrowingIsland('kid', [], T0 + HOUR, db, old, { math: 6, vocab: 1 });
        expect(next.town).toEqual([expect.objectContaining({ type: 'keepsake', unitId: 'math:6' })]);
        expect(next.record.state.keepsakes).toHaveLength(1);
    });

    it('keeps sixty pictures of the island\'s story, from the first day to today', async () => {
        const db = growing();
        const blob = new Blob(['x'], { type: 'image/png' });
        const at = (i: number) => T0 + i * i * HOUR;
        for (let i = 0; i < MOMENT_LIMIT + 5; i++) await addMoment('kid', blob, 4, 3, at(i), db);
        const kept = await listMoments('kid', db);
        expect(kept).toHaveLength(MOMENT_LIMIT);
        expect(kept[0].at).toBe(T0);
        expect(kept.at(-1)!.at).toBe(at(MOMENT_LIMIT + 4));
        await deleteGrowingOwner('kid', db);
        expect(await listMoments('kid', db)).toEqual([]);
    });

    it('copies a well-used current island: every item, the land, the drops and the friends', async () => {
        const db = growing(), old = life();
        const facts = Array.from({ length: 30 }, (_, i) => ({ id: `past-${i}`, at: T0 - 29 * HOUR + i }));
        let record = await updateLife('rich', facts, undefined, T0 - 29 * HOUR, old, T0 - 30 * HOUR);
        const steps: LifeCommand[] = [
            { type: 'buy', kind: 'water-bowl', cell: { x: 4, z: 3 } }, { type: 'buy', kind: 'flower', cell: { x: 1, z: 3 } },
            { type: 'buy', kind: 'bench', cell: { x: 0, z: 4 } }, { type: 'expand', side: 'east' },
        ];
        for (const [i, command] of steps.entries())
            record = await updateLife('rich', facts, { id: `step-${i}`, revision: record.revision, command }, T0 - 20 * HOUR + i * HOUR, old);
        expect(record.actions.length).toBeGreaterThanOrEqual(4);
        const before = structuredClone(await old.worlds.get('rich'));
        const current = replayLife(before!, T0);
        const copied = (await syncGrowingIsland('rich', [], T0, db, old)).record.state;
        expect(copied.drops).toBe(current.drops);
        expect(copied.land.expanded).toBe(current.expanded);
        expect(copied.landmarks.map(l => [l.id, l.kind, l.cell])).toEqual(current.items.map(i => [i.id, i.kind, i.cell]));
        expect(copied.villagers.map(v => v.legacyId).sort()).toEqual(current.residents.filter(r => r.id !== 'pokomoko').map(r => r.id).sort());
        expect(await old.worlds.get('rich')).toEqual(before);
    });
});
