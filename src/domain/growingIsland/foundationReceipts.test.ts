import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundationCompletion } from '../englishFoundation/types';
import { newIsland } from './island';
import { GrowingIslandDatabase, deleteGrowingOwner, sailGrowingIsland, syncGrowingIsland, addMoment, sendFlower } from './repository';
import { drainFoundationRewards, receiveFoundationCompletion } from './foundationReceipts';

const source = vi.hoisted(() => ({ verify: vi.fn(), pending: vi.fn(), ack: vi.fn() }));
vi.mock('../englishFoundation/repository', () => ({ verifyFoundationCompletion: source.verify,
    pendingFoundationCompletions: source.pending, acknowledgeFoundationCompletion: source.ack }));
const databases: GrowingIslandDatabase[] = [];
const T = Date.UTC(2026, 9, 20);
const completion = (id = 'foundation-slot-1'): FoundationCompletion => ({ sourceVersion: 'english-foundation-v1',
    profileId: 'kid', completionId: id, planId: 'plan-1', slotIndex: 0, completionKind: 'independent', completedAt: T - 86400000 });
async function setup() {
    const database = new GrowingIslandDatabase(`foundation-receipts-${crypto.randomUUID()}`);
    databases.push(database);
    const state = newIsland('kid', T); state.learnedFloor = T; state.drops = 10; state.town.bank = 0;
    await database.islands.put({ profileId: 'kid', version: 5, revision: 3, createdAt: T, updatedAt: T, state });
    return database;
}
beforeEach(() => { source.verify.mockReset().mockResolvedValue(true); source.pending.mockReset().mockResolvedValue([]); source.ack.mockReset().mockResolvedValue(undefined); });
afterEach(async () => { await Promise.all(databases.splice(0).map(database => database.delete())); });

describe('durable English foundation reward delivery', () => {
    it('credits valid late learning below the legacy floor once, including parallel delivery', async () => {
        const database = await setup(), fact = completion();
        const received = await Promise.all([receiveFoundationCompletion(fact, database), receiveFoundationCompletion(fact, database)]);
        expect(received.filter(result => result.credited)).toHaveLength(1);
        expect((await database.islands.get('kid'))!.state).toMatchObject({ drops: 12, town: { bank: 2 }, learnedFloor: T, learned: [] });
        expect(await database.foundationReceipts.get(['kid', fact.completionId])).toMatchObject({ ...fact, islandId: 'main' });
        database.close(); await database.open();
        expect((await receiveFoundationCompletion(fact, database)).credited).toBe(false);
        expect(await database.foundationReceipts.count()).toBe(1);
    });

    it('rolls back the ledger and wallet together if saving the island fails', async () => {
        const database = await setup(), fact = completion();
        const put = vi.spyOn(database.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(receiveFoundationCompletion(fact, database)).rejects.toThrow('disk-full');
        expect(await database.foundationReceipts.count()).toBe(0);
        expect((await database.islands.get('kid'))!.state.drops).toBe(10);
        put.mockRestore();
        expect((await receiveFoundationCompletion(fact, database)).credited).toBe(true);
    });

    it('resends after acknowledgement failure without reminting a reward or timestamp', async () => {
        const database = await setup(), fact = completion(); source.pending.mockResolvedValue([fact]);
        source.ack.mockRejectedValueOnce(new Error('lost-ack'));
        expect(await drainFoundationRewards('kid', database)).toMatchObject({ credited: 1, retryPending: true });
        expect(await drainFoundationRewards('kid', database)).toMatchObject({ credited: 0, retryPending: false });
        expect((await database.islands.get('kid'))!.state.drops).toBe(12);
        expect((await database.foundationReceipts.get(['kid', fact.completionId]))!.completedAt).toBe(fact.completedAt);
    });

    it('serializes with sailing, fixes the credited island, and shares the wallet without double credit', async () => {
        const database = await setup(), fact = completion();
        await Promise.all([sailGrowingIsland('kid', 'main', { id: 'next', create: { name: 'つぎ', start: 'garden' } }, T, database),
            receiveFoundationCompletion(fact, database)]);
        const receipt = (await database.foundationReceipts.get(['kid', fact.completionId]))!;
        expect(['main', 'next']).toContain(receipt.islandId);
        await sailGrowingIsland('kid', 'next', { id: 'main' }, T + 1, database);
        await receiveFoundationCompletion(fact, database);
        expect((await database.islands.get('kid'))!.state.drops).toBe(12);
        const islands = [await database.islands.get('kid'), await database.archivedIslands.get(['kid', 'next'])];
        expect(islands.reduce((sum, island) => sum + island!.state.town.bank, 0)).toBe(2);
        expect((await database.foundationReceipts.get(['kid', fact.completionId]))!.islandId).toBe(receipt.islandId);
    });

    it('rejects unverified or changed source proofs without touching the wallet', async () => {
        const database = await setup(), fact = completion(); source.verify.mockResolvedValueOnce(false);
        await expect(receiveFoundationCompletion(fact, database)).rejects.toThrow('がくしゅう');
        await receiveFoundationCompletion(fact, database);
        await expect(receiveFoundationCompletion({ ...fact, completedAt: fact.completedAt + 1 }, database)).rejects.toThrow('がくしゅう');
        expect((await database.islands.get('kid'))!.state.drops).toBe(12);
    });

    it('requires an actual saved source slot, acknowledges after receipt, and rejects a deleting source owner', async () => {
        const actual = await vi.importActual<typeof import('../englishFoundation/repository')>('../englishFoundation/repository');
        const learning = new SansuDatabase(`foundation-proof-${crypto.randomUUID()}`);
        try {
            const child = { ...createInitialProfile('test', 2, 1, 1, 'vocab'), id: 'kid' };
            await learning.profiles.put(child);
            await learning.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'kid', profiles: { kid: child } });
            await actual.setFoundationCourse('kid', 'foundation', 'F01', learning);
            let plan = (await actual.reserveFoundationPlan('kid', learning, T))!;
            plan = await actual.finishFoundationIntroduction('kid', plan.id, plan.revision, learning, T + 1);
            plan = await actual.presentFoundationSlot('kid', plan.id, learning, T + 2);
            const done = await actual.commitFoundationAction({ profileId: 'kid', planId: plan.id, revision: plan.revision,
                action: 'answer', answer: plan.slots[0].target }, learning, T + 3);
            const fact = done.completion!;
            source.verify.mockImplementation(actual.verifyFoundationCompletion);
            source.pending.mockImplementation(actual.pendingFoundationCompletions);
            source.ack.mockImplementation(actual.acknowledgeFoundationCompletion);
            const database = await setup();
            await expect(receiveFoundationCompletion({ ...fact, completedAt: T + 4 }, database, learning)).rejects.toThrow('がくしゅう');
            expect(await drainFoundationRewards('kid', database, learning)).toMatchObject({ credited: 1, retryPending: false });
            expect(await actual.pendingFoundationCompletions('kid', learning)).toEqual([]);
            expect(await database.foundationReceipts.get(['kid', fact.completionId])).toMatchObject(fact);
            await actual.beginFoundationOwnerDeletion('kid', learning);
            await expect(receiveFoundationCompletion(fact, database, learning)).rejects.toThrow('がくしゅう');
            expect((await database.islands.get('kid'))!.state.drops).toBe(12);
        } finally { await learning.delete(); }
    });

    it('copies the v10 island, archive, photos and gifts atomically and fences old writers', async () => {
        const database = new GrowingIslandDatabase(`foundation-v10-${crypto.randomUUID()}`);
        databases.push(database);
        const legacy = new Dexie(database.name);
        legacy.version(10).stores({ cultivatedIslands: '&profileId', cultivatedArchives: '[profileId+islandId], profileId',
            cultivatedMoments: '++id, profileId, [profileId+at]', cultivatedGifts: '&id, to, from' });
        const state = newIsland('kid', T); state.drops = 17;
        const original = { profileId: 'kid', version: 5, revision: 9, createdAt: T, updatedAt: T, state };
        await legacy.table('cultivatedIslands').put(original);
        await legacy.table('cultivatedArchives').put({ ...original, islandId: 'archive' });
        await legacy.table('cultivatedMoments').add({ profileId: 'kid', at: T, image: new Blob(['photo']), width: 4, height: 3 });
        await legacy.table('cultivatedGifts').put({ id: 'gift', to: 'kid', from: 'sibling' });
        legacy.close();
        await database.open();
        expect(await database.islands.get('kid')).toEqual(original);
        expect(await database.archivedIslands.count()).toBe(1);
        expect(await database.moments.count()).toBe(1);
        expect(await database.gifts.count()).toBe(1);
        await receiveFoundationCompletion(completion(), database);
        database.close();
        await legacy.open();
        await legacy.table('cultivatedIslands').put({ ...original, state: { ...state, drops: 999 } });
        await expect(legacy.transaction('rw', legacy.tables, async () => {
            await legacy.table('cultivatedIslands').delete('kid');
            await legacy.table('cultivatedMoments').where('profileId').equals('kid').delete();
        })).rejects.toThrow();
        legacy.close(); await database.open();
        expect((await database.islands.get('kid'))!.state.drops).toBe(19);
        expect(await database.foundationReceipts.count()).toBe(1);
        expect(await database.moments.count()).toBe(1);
        expect(await database.gifts.count()).toBe(1);
    });

    it('rolls back the v10 copy on migration failure and preserves the source photos', async () => {
        const database = new GrowingIslandDatabase(`foundation-copy-failure-${crypto.randomUUID()}`);
        databases.push(database);
        const legacy = new Dexie(database.name);
        legacy.version(10).stores({ cultivatedIslands: '&profileId', cultivatedArchives: '[profileId+islandId], profileId',
            cultivatedMoments: '++id, profileId, [profileId+at]', cultivatedGifts: '&id, to, from' });
        await legacy.table('cultivatedIslands').put({ profileId: 'kid', version: 5, revision: 1, createdAt: T, updatedAt: T, state: newIsland('kid', T) });
        await legacy.table('cultivatedMoments').add({ profileId: 'kid', at: T, image: new Blob(['photo']), width: 4, height: 3 });
        legacy.close();
        database.version(11).upgrade(() => { throw new Error('copy-aborted'); });
        await expect(database.open()).rejects.toThrow('copy-aborted');
        await legacy.open();
        expect(await legacy.table('cultivatedIslands').count()).toBe(1);
        expect(await legacy.table('cultivatedMoments').count()).toBe(1);
        expect(legacy.backendDB().objectStoreNames.contains('foundationIslands')).toBe(false);
        legacy.close();
    });

    it('deletion removes receipt proof and fences late delivery and opening forever', async () => {
        const database = await setup();
        await receiveFoundationCompletion(completion(), database);
        await deleteGrowingOwner('kid', database);
        expect(await database.foundationReceipts.count()).toBe(0);
        await expect(receiveFoundationCompletion(completion(), database)).rejects.toThrow('プロフィール');
        await expect(syncGrowingIsland('kid', [], T, database)).rejects.toThrow('プロフィール');
        await expect(addMoment('kid', new Blob(['late-photo']), 4, 3, T, database)).rejects.toThrow('プロフィール');
        await expect(sendFlower('sibling', 'きょうだい', 'kid', T, database)).rejects.toThrow('プロフィール');
        expect(await database.islands.get('kid')).toBeUndefined();
        expect(await database.deletedOwners.get('kid')).toBeDefined();
    });
});
