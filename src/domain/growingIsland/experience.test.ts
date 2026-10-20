import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { concertPlace, recordSharedPlay, validateExperience } from './experience';
import { experienceFixture } from '../../prototypes/placeQa/experienceFixture';
import { applyIntent } from './commands';
import { commandGrowingIsland, deleteGrowingOwner, GrowingIslandDatabase, GuidanceReceiptConflict, readGrowingIsland, sailGrowingIsland, type GrowingRecord } from './repository';
import { projectGrowingSync } from './syncProjection';

const stores: GrowingIslandDatabase[] = [];
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });
function fixture() {
    const state = experienceFixture('village'), place = concertPlace(state, 'M1')!;
    expect(place).toBeDefined();
    return { state, receipt: { placeId: place.id, revision: place.revision, actorId: 'V1', targetId: 'M1', overlapMs: 3000 } };
}
describe('island shared memories', () => {
    it('does not issue another memory when editing changes the source group and raw revision', () => {
        const { state, receipt } = fixture(); recordSharedPlay(state, receipt, 10);
        const original = structuredClone(state.experience);
        state.landmarks.find(owner => owner.id === 'T1')!.cell = { x: -1, z: 1 };
        const next = concertPlace(state, 'M1')!;
        expect(next.revision).not.toBe(receipt.revision);
        expect(recordSharedPlay(state, { ...receipt, placeId: next.id, revision: next.revision }, 20)).toBe(true);
        expect(state.experience).toEqual(original);
    });
    it('rejects insufficient overlap, strangers, old topology, absent actors and stored music owners', () => {
        const { state, receipt } = fixture();
        for (const invalid of [{ overlapMs: 2999 }, { overlapMs: NaN }, { actorId: 'visitor' }, { actorId: 'pokomoko' }, { revision: 'old' }])
            expect(recordSharedPlay(state, { ...receipt, ...invalid }, 10)).toBe(false);
        state.villagers[0].away = true; expect(recordSharedPlay(state, receipt, 10)).toBe(false);
        state.villagers[0].away = false; state.landmarks.find(owner => owner.id === 'M1')!.cell = undefined;
        expect(recordSharedPlay(state, receipt, 10)).toBe(false); expect(state.experience).toBeUndefined();
    });
    it('deduplicates by family/actor, and preserves the real historical snapshot through edits and sync', () => {
        const { state, receipt } = fixture(), before = structuredClone(state);
        expect(recordSharedPlay(state, receipt, 10)).toBe(true);
        expect(recordSharedPlay(state, receipt, 11)).toBe(true); expect(state.experience!.shared).toHaveLength(1);
        const edited = applyIntent(state, { id: 'put-away', command: { type: 'store', id: 'M1' } }, 12).state;
        expect(edited.experience).toEqual(state.experience);
        const record: GrowingRecord = { profileId: state.seed, version: 5, revision: 1, createdAt: 0, updatedAt: 12, state: edited };
        const synced = projectGrowingSync({ profileId: state.seed, current: record, completions: [], mailbox: [], now: 13 }).result.record;
        expect(synced.state.experience).toEqual(state.experience);
        expect(state.landmarks).toEqual(before.landmarks); expect(state.drops).toBe(before.drops);
        expect(() => validateExperience({ ...state.experience!, version: 2 } as never)).toThrow();
        expect(() => validateExperience({ version: 1, shared: [...state.experience!.shared, ...state.experience!.shared] })).toThrow();
    });
    it('saves in the owner transaction, rejects a stale revision and isolates/deletes owner data', async () => {
        const { state, receipt } = fixture(), db = new GrowingIslandDatabase(`experience-${crypto.randomUUID()}`); stores.push(db);
        const record: GrowingRecord = { profileId: state.seed, version: 5, revision: 0, createdAt: 0, updatedAt: 0, state };
        await db.islands.put(record);
        const command = { type: 'shared-play' as const, profileId: state.seed, expectedRevision: 0, ...receipt };
        const saved = await commandGrowingIsland(state.seed, { id: 'shared', command }, 10, db);
        expect(saved.record.state.experience?.shared).toHaveLength(1);
        await expect(commandGrowingIsland(state.seed, { id: 'stale', command }, 11, db)).rejects.toBeInstanceOf(GuidanceReceiptConflict);
        expect((await readGrowingIsland(state.seed, db))!.state.experience?.shared).toHaveLength(1);
        expect(await readGrowingIsland('someone-else', db)).toBeUndefined();
        await deleteGrowingOwner(state.seed, db); expect(await db.islands.get(state.seed)).toBeUndefined();
    });
    it('keeps memories on their original island through a voyage and removes them with owner deletion', async () => {
        const { state, receipt } = fixture(); recordSharedPlay(state, receipt, 10);
        const db = new GrowingIslandDatabase(`experience-voyage-${crypto.randomUUID()}`); stores.push(db);
        await db.islands.put({ profileId: state.seed, version: 5, revision: 0, createdAt: 0, updatedAt: 10, state });
        const other = await sailGrowingIsland(state.seed, 'main', { id: 'other', create: { name: 'second', start: 'water' } }, 11, db);
        expect(other.state.experience).toBeUndefined();
        const back = await sailGrowingIsland(state.seed, 'other', { id: 'main' }, 12, db);
        expect(back.state.experience).toEqual(state.experience);
        await deleteGrowingOwner(state.seed, db);
        expect(await db.islands.count()).toBe(0); expect(await db.archivedIslands.count()).toBe(0);
    });
});
