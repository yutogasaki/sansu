import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { newIsland } from './island';
import { placeStatuses, recordPlaceUse, syncPlaceMilestones } from './placeGoals';
import { derivePlaces } from './places';
import { GrowingIslandDatabase, GuidanceReceiptConflict, addMoment, commandGrowingIsland, deleteGrowingOwner, readGrowingIsland, sendFlower, syncGrowingIsland } from './repository';
import type { GrowingRecord } from './repository';
import type { GrowingState } from './types';
import type { DerivedPlace, PlaceGoalId } from './placeTypes';

const stores: Dexie[] = [];
afterEach(async () => { await Promise.all(stores.splice(0).map(db => db.delete())); });
const now = 1_000;
function island(id = 'kid'): GrowingState {
    const state = newIsland(id, now);
    state.tutorial = 'done'; state.guidance!.starter.automatic = false;
    state.landmarks = [{ id: 't1', kind: 'sapling', cell: { x: 0, z: 3 }, growth: 18, maturedAt: 0 },
        { id: 't2', kind: 'sapling', cell: { x: 2, z: 3 }, growth: 18, maturedAt: 0 },
        { id: 'seat', kind: 'bench', cell: { x: 1, z: 4 }, growth: 0 }];
    return state;
}
function grown(state: GrowingState, id: PlaceGoalId = 'P01'): DerivedPlace {
    const place = derivePlaces(state).find(place => place.ruleId === id && place.stage === 'grown');
    expect(place, `fixture must have grown ${id}`).toBeDefined();
    return place!;
}
function use(state: GrowingState, place = grown(state), actorId = 'pokomoko') {
    return { ruleId: place.ruleId, placeId: place.id, revision: place.revision, actorId, targetId: place.useTargets[0].id };
}
/** Mature owned inputs for spatial/save tests, not naturally acquired progress. */
function threeFamilyIsland() {
    const state = island(); state.land = { expanded: 'east', extra: ['south'], capes: [] };
    state.landmarks.push({ id: 'w1', kind: 'water-bowl', cell: { x: 4, z: 2 }, growth: 0 },
        { id: 'c1', kind: 'water-channel', cell: { x: 5, z: 2 }, growth: 0 },
        { id: 'w2', kind: 'water-bowl', cell: { x: 6, z: 2 }, growth: 0 },
        { id: 'c2', kind: 'water-channel', cell: { x: 7, z: 2 }, growth: 0 },
        { id: 'w3', kind: 'water-bowl', cell: { x: 8, z: 2 }, growth: 0 },
        { id: 'waterside-flower', kind: 'flower', cell: { x: 6, z: 4 }, growth: 6 },
        { id: 'water-seat', kind: 'bench', cell: { x: 8, z: 4 }, growth: 0 },
        ...[{ x: 5, z: 5 }, { x: 6, z: 5 }, { x: 5, z: 6 }, { x: 6, z: 6 }].map((cell, index) => ({ id: `flower-${index}`, kind: 'flower' as const, cell, growth: 6 })),
        { id: 'flower-seat', kind: 'bench', cell: { x: 7, z: 6 }, growth: 0 });
    state.plots.push({ id: 'friend-home', kind: 'home', cell: { x: 4, z: 7 }, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 6, style: 'plain' });
    state.villagers.push({ id: 'friend', species: 'rabbit', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'lively', home: 'friend-home', arrivedAt: 0 });
    return state;
}
async function fixture(state = island()) {
    const db = new GrowingIslandDatabase(`place-goals-${crypto.randomUUID()}`), life = new IslandLifeDatabase(`place-goals-life-${crypto.randomUUID()}`);
    stores.push(db, life);
    const record: GrowingRecord = { profileId: state.seed, version: 4, revision: 0, createdAt: now, updatedAt: now, state };
    await db.islands.put(record);
    return { db, life, record };
}

describe('optional place goals and actual use persistence', () => {
    it('records current maturity independently of selection, without inferring use or paying rewards', async () => {
        const { db, life, record } = await fixture();
        const result = await syncGrowingIsland('kid', [], now, db, life);
        expect(result.record.state.placeProgress!.milestones.P01).toMatchObject({ ruleId: 'P01', at: now, memberIds: ['seat', 't1', 't2'] });
        expect(result.record.state.placeProgress!.uses).toEqual({});
        expect(result.record.state.placeProgress!.shown).toEqual({});
        expect(result.record.state.placeProgress!.selected).toBeUndefined();
        for (const field of ['drops', 'town', 'learned', 'landmarks', 'plots', 'villagers'] as const)
            expect(result.record.state[field]).toEqual(record.state[field]);
        const selected = await commandGrowingIsland('kid', { id: 'select', command: { type: 'choose-place-goal', id: 'P06' } }, now, db);
        expect(selected.record.state.placeProgress!.selected).toBe('P06');
        const clear = await commandGrowingIsland('kid', { id: 'clear', command: { type: 'choose-place-goal' } }, now, db);
        expect(clear.record.state.placeProgress!.selected).toBeUndefined();
        expect(clear.record.state.placeProgress!.milestones).toEqual(result.record.state.placeProgress!.milestones);
        expect(clear.record.state.guidance).toEqual(result.record.state.guidance);
    });

    it('fences renderer receipts against owner, saved revision, current shape, target and present actor', async () => {
        const { db, record } = await fixture();
        const receipt = { type: 'place-used' as const, profileId: 'kid', expectedRevision: 0, ...use(record.state) };
        await expect(commandGrowingIsland('kid', { id: 'foreign', command: { ...receipt, profileId: 'other' } }, now, db)).rejects.toThrow('じぶん');
        await expect(commandGrowingIsland('kid', { id: 'stale', command: { ...receipt, expectedRevision: 1 } }, now, db)).rejects.toBeInstanceOf(GuidanceReceiptConflict);
        for (const invalid of [{ revision: 'old-shape' }, { placeId: 'another-place' }, { targetId: 'another-bench' }, { actorId: 'invented-friend' }, { ruleId: 'P06' as const }])
            await expect(commandGrowingIsland('kid', { id: JSON.stringify(invalid), command: { ...receipt, ...invalid } }, now, db)).rejects.toThrow();
        expect(await db.islands.get('kid')).toEqual(record);
        const saved = await commandGrowingIsland('kid', { id: 'used', command: receipt }, now + 1, db);
        expect(saved.record.state.placeProgress!.uses.P01?.pokomoko).toMatchObject({ actorId: 'pokomoko', targetId: 'seat', at: now + 1 });
        expect(placeStatuses(saved.record.state).find(goal => goal.id === 'P01')?.stage).toBe('lived');
        expect((await commandGrowingIsland('kid', { id: 'used', command: receipt }, now + 2, db)).record).toEqual(saved.record);
        const shown = await commandGrowingIsland('kid', { id: 'shown', command: { type: 'place-shown', profileId: 'kid', expectedRevision: saved.record.revision,
            ruleId: receipt.ruleId, revision: receipt.revision } }, now + 2, db);
        expect(shown.record.state.placeProgress!.shown.P01).toBe(receipt.revision);
    });

    it('retains exact first milestones and receipt history through split, storage, reconnect and reopen', async () => {
        const { db, record } = await fixture();
        const first = await commandGrowingIsland('kid', { id: 'used', command: { type: 'place-used', profileId: 'kid', expectedRevision: 0, ...use(record.state) } }, now + 1, db);
        const proof = structuredClone(first.record.state.placeProgress!.milestones.P01);
        const original = structuredClone(first.record.state.placeProgress!.useHistory);
        const stored = await commandGrowingIsland('kid', { id: 'store-tree', command: { type: 'store', id: 't2' } }, now + 2, db);
        expect(placeStatuses(stored.record.state).find(goal => goal.id === 'P01')).toMatchObject({ achieved: true, stage: 'seeded' });
        expect(stored.record.state.placeProgress!.milestones.P01).toEqual(proof);
        expect(stored.record.state.placeProgress!.useHistory).toEqual(original);
        const restored = await commandGrowingIsland('kid', { id: 'restore', command: { type: 'unstore', id: 't2', cell: { x: 1, z: 3 } } }, now + 3, db);
        expect(placeStatuses(restored.record.state).find(goal => goal.id === 'P01')?.stage).toBe('grown');
        const played = await commandGrowingIsland('kid', { id: 'played-new-shape', command: { type: 'place-used', profileId: 'kid', expectedRevision: restored.record.revision,
            ...use(restored.record.state) } }, now + 4, db);
        expect(played.record.state.placeProgress!.useHistory).toHaveLength(2);
        expect(played.record.state.placeProgress!.useHistory![0]).toEqual(original![0]);
        expect(played.record.state.placeProgress!.milestones.P01).toEqual(proof);
        expect(played.record.state.landmarks.find(tree => tree.id === 't2')).toMatchObject({ growth: 18, maturedAt: 0 });
        db.close(); await db.open();
        expect(await readGrowingIsland('kid', db)).toEqual(played.record);
    });

    it('rolls back disk failure and accepts concurrent duplicate receipts only once without touching sibling data', async () => {
        const { db, record } = await fixture();
        const sibling: GrowingRecord = { ...record, profileId: 'sibling', state: island('sibling') }; await db.islands.put(sibling);
        const intent = { id: 'real-render-use', command: { type: 'place-used' as const, profileId: 'kid', expectedRevision: 0, ...use(record.state) } };
        const fail = vi.spyOn(db.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(commandGrowingIsland('kid', intent, now + 1, db)).rejects.toThrow('disk-full');
        expect(await db.islands.get('kid')).toEqual(record); fail.mockRestore();
        const writer = new GrowingIslandDatabase(db.name); stores.push(writer);
        const [a, b] = await Promise.all([commandGrowingIsland('kid', intent, now + 1, db), commandGrowingIsland('kid', intent, now + 2, writer)]);
        expect(a.record).toEqual(b.record); expect(a.record.state.placeProgress!.useHistory).toHaveLength(1);
        expect(await db.islands.get('sibling')).toEqual(sibling);
    });

    it('requires three different reachable mature families and real current uses by both kinds of actor for P06', () => {
        const state = threeFamilyIsland();
        grown(state, 'P01'); grown(state, 'P03'); grown(state, 'P05');
        syncPlaceMilestones(state, now);
        expect(state.placeProgress!.milestones.P06).toBeUndefined();
        expect(placeStatuses(state).find(goal => goal.id === 'P06')?.stage).toBe('grown');
        recordPlaceUse(state, use(state, grown(state, 'P01')), now + 1);
        expect(state.placeProgress!.milestones.P06).toBeUndefined();
        state.villagers[0].away = true;
        expect(() => recordPlaceUse(state, use(state, grown(state, 'P03'), 'friend'), now + 2)).toThrow();
        delete state.villagers[0].away;
        recordPlaceUse(state, use(state, grown(state, 'P03'), 'friend'), now + 3);
        expect(state.placeProgress!.milestones.P06).toMatchObject({ at: now + 3, ruleId: 'P06', anchorId: 'kid' });
        expect(placeStatuses(state).find(goal => goal.id === 'P06')?.stage).toBe('lived');
        state.landmarks.find(item => item.id === 't2')!.cell = undefined;
        expect(placeStatuses(state).find(goal => goal.id === 'P06')).toMatchObject({ achieved: true, stage: 'connected' });
    });

    it('retains the present earlier actor’s current receipt when the latest visitor goes away, but rejects stale history', async () => {
        const state = threeFamilyIsland();
        state.villagers.push({ ...state.villagers[0], id: 'later-friend', species: 'otter' });
        const { db } = await fixture(state);
        const poco = await commandGrowingIsland('kid', { id: 'poco-used', command: { type: 'place-used', profileId: 'kid', expectedRevision: 0,
            ...use(state, grown(state, 'P01')) } }, now + 1, db);
        const a = await commandGrowingIsland('kid', { id: 'a-used', command: { type: 'place-used', profileId: 'kid', expectedRevision: poco.record.revision,
            ...use(poco.record.state, grown(poco.record.state, 'P03'), 'friend') } }, now + 2, db);
        const b = await commandGrowingIsland('kid', { id: 'b-used', command: { type: 'place-used', profileId: 'kid', expectedRevision: a.record.revision,
            ...use(a.record.state, grown(a.record.state, 'P03'), 'later-friend') } }, now + 3, db);
        const awayB = await commandGrowingIsland('kid', { id: 'b-away', command: { type: 'away', id: 'later-friend', away: true } }, now + 4, db);
        expect(awayB.record.state.placeProgress!.uses.P03?.villager?.actorId).toBe('later-friend');
        expect(placeStatuses(awayB.record.state).find(goal => goal.id === 'P03')?.stage).toBe('lived');
        expect(placeStatuses(awayB.record.state).find(goal => goal.id === 'P06')?.stage).toBe('lived');
        expect(awayB.record.state.placeProgress!.useHistory).toEqual(b.record.state.placeProgress!.useHistory);
        expect(awayB.record.state.placeProgress!.milestones.P06).toEqual(a.record.state.placeProgress!.milestones.P06);
        db.close(); await db.open();
        const restored = (await readGrowingIsland('kid', db))!;
        expect(placeStatuses(restored.state).find(goal => goal.id === 'P06')?.stage).toBe('lived');
        const awayA = await commandGrowingIsland('kid', { id: 'a-away', command: { type: 'away', id: 'friend', away: true } }, now + 5, db);
        expect(placeStatuses(awayA.record.state).find(goal => goal.id === 'P06')?.stage).toBe('grown');
        const backA = await commandGrowingIsland('kid', { id: 'a-back', command: { type: 'away', id: 'friend', away: false } }, now + 6, db);
        const movedSeat = await commandGrowingIsland('kid', { id: 'move-water-seat', command: { type: 'move', id: 'water-seat', cell: { x: 8, z: 3 } } }, now + 7, db);
        expect(grown(movedSeat.record.state, 'P03').revision).not.toBe(grown(backA.record.state, 'P03').revision);
        expect(placeStatuses(movedSeat.record.state).find(goal => goal.id === 'P03')?.stage).toBe('grown');
        expect(placeStatuses(movedSeat.record.state).find(goal => goal.id === 'P06')?.stage).toBe('grown');
        expect(movedSeat.record.state.placeProgress!.useHistory).toEqual(b.record.state.placeProgress!.useHistory);
        expect(movedSeat.record.state.placeProgress!.milestones.P06).toEqual(a.record.state.placeProgress!.milestones.P06);
    });

    it('reports the used current district for a repeated goal instead of an unused district with an earlier owner ID', () => {
        const state = island(); state.land = { expanded: 'east', extra: ['south'], capes: [] };
        state.landmarks.push({ id: 'z-tree-1', kind: 'sapling', cell: { x: 4, z: 5 }, growth: 18, maturedAt: 0 },
            { id: 'z-tree-2', kind: 'sapling', cell: { x: 6, z: 5 }, growth: 18, maturedAt: 0 },
            { id: 'z-seat', kind: 'bench', cell: { x: 5, z: 6 }, growth: 0 });
        const places = derivePlaces(state).filter(place => place.ruleId === 'P01');
        expect(places).toHaveLength(2); expect(places.every(place => place.stage === 'grown')).toBe(true);
        syncPlaceMilestones(state, now); const original = structuredClone(state.placeProgress!.milestones.P01);
        recordPlaceUse(state, use(state, places[1]), now + 1);
        expect(placeStatuses(state).find(goal => goal.id === 'P01')).toMatchObject({ stage: 'lived', place: { id: places[1].id } });
        expect(state.placeProgress!.milestones.P01).toEqual(original);
        state.landmarks.find(item => item.id === 'z-tree-2')!.cell = undefined;
        expect(placeStatuses(state).find(goal => goal.id === 'P01')).toMatchObject({ stage: 'grown', place: { id: places[0].id }, achieved: true });
        expect(state.placeProgress!.useHistory).toHaveLength(1);
    });
});

describe('place-history save cutover', () => {
    it('copies schema4 once, isolates old guidance writers, and deletes every owner lineage with photos/gifts', async () => {
        const name = `place-cutover-${crypto.randomUUID()}`, old = new Dexie(name); stores.push(old);
        old.version(1).stores({ islands: '&profileId' });
        old.version(2).stores({ moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        old.version(3).stores({ balancedIslands: '&profileId' }); old.version(4).stores({ guidedIslands: '&profileId' });
        const state = island(); delete state.placeProgress;
        const source: GrowingRecord = { profileId: 'kid', version: 3, revision: 7, createdAt: now, updatedAt: now, state };
        await old.table('guidedIslands').put(source); old.close();
        const db = new GrowingIslandDatabase(name); stores.push(db);
        expect(await readGrowingIsland('kid', db)).toEqual(source);
        expect(await db.guidedIslands.get('kid')).toEqual(source);
        const next = await commandGrowingIsland('kid', { id: 'select', command: { type: 'choose-place-goal', id: 'P02' } }, now + 1, db);
        expect(next.record.version).toBe(4); expect(next.record.state.placeProgress!.uses).toEqual({});
        expect(next.record.state.guidance).toEqual(source.state.guidance);
        await addMoment('kid', new Blob(['photo']), 4, 3, now, db); await sendFlower('kid', 'なまえ', 'sibling', now, db);
        db.close(); await old.open();
        await old.table('guidedIslands').put({ ...source, state: { ...state, drops: 999 } }); old.close();
        await db.open(); expect(await readGrowingIsland('kid', db)).toEqual(next.record);
        expect(await db.moments.count()).toBe(1); expect(await db.gifts.count()).toBe(1);
        await deleteGrowingOwner('kid', db);
        for (const table of [db.islands, db.guidedIslands, db.balancedIslands, db.legacyIslands]) expect(await table.get('kid')).toBeUndefined();
        expect(await db.moments.count()).toBe(0); expect(await db.gifts.count()).toBe(0);
    });

    it('rolls back an aborted schema5 copy, preserving the old source/photos and allowing a fresh retry', async () => {
        const name = `place-cutover-fault-${crypto.randomUUID()}`, old = new Dexie(name); stores.push(old);
        old.version(1).stores({ islands: '&profileId' }); old.version(2).stores({ moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        old.version(3).stores({ balancedIslands: '&profileId' }); old.version(4).stores({ guidedIslands: '&profileId' });
        const source: GrowingRecord = { profileId: 'kid', version: 3, revision: 2, createdAt: now, updatedAt: now, state: island() };
        await old.table('guidedIslands').put(source); await old.table('moments').add({ profileId: 'kid', at: now, image: new Blob(['photo']), width: 4, height: 3 }); old.close();
        const db = new GrowingIslandDatabase(name); stores.push(db);
        db.version(5).upgrade(() => { throw new Error('place-copy-aborted'); });
        await expect(db.open()).rejects.toThrow('place-copy-aborted');
        await old.open(); expect(await old.table('guidedIslands').get('kid')).toEqual(source);
        expect(await old.table('moments').count()).toBe(1); expect(old.backendDB().objectStoreNames.contains('placedIslands')).toBe(false); old.close();
        const retry = new GrowingIslandDatabase(name); stores.push(retry); await retry.open();
        expect(await retry.islands.get('kid')).toEqual(source); expect(await retry.moments.count()).toBe(1);
    });

    it('rejects future/corrupt/missing place progress on read, command and sync without overwriting it', async () => {
        const { db, life, record } = await fixture();
        const corruptions = [undefined, null, { ...record.state.placeProgress!, version: 99 },
            { ...record.state.placeProgress!, selected: 'A3' }, { ...record.state.placeProgress!, milestones: { P99: {} } },
            { ...record.state.placeProgress!, uses: { P01: { pokomoko: { actorId: 'fake' } } } },
            { ...record.state.placeProgress!, shown: { P01: 1 } }, { ...record.state.placeProgress!, useHistory: [{}] }];
        for (const value of corruptions) {
            const corrupt = structuredClone(record); corrupt.state.placeProgress = value as GrowingState['placeProgress']; await db.islands.put(corrupt);
            await expect(readGrowingIsland('kid', db)).rejects.toThrow('新しい版');
            await expect(commandGrowingIsland('kid', { id: 'do-not-save', command: { type: 'open-all' } }, now, db)).rejects.toThrow('新しい版');
            await expect(syncGrowingIsland('kid', [], now, db, life)).rejects.toThrow('新しい版');
            expect(await db.islands.get('kid')).toEqual(corrupt);
        }
    });
});
