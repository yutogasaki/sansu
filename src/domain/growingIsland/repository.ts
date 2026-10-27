import type { KokugoCompletion } from '../kokugo/types';
import type { FoundationCompletion } from '../englishFoundation/types';
import { restoreWonderSlot, type WonderSlot } from './growth';
import { RULES } from './rules';
import { FIRST_ISLAND, carrySharedResources, isTheme, islandIdOf, makeVoyageIsland, type IslandStart } from './voyages';
import { chooseTheme, grantRoutes } from './journey';
import { readable, upgrade } from './syncProjection';
import { projectGrowingSyncResponsive } from './syncProjectionClient';
import Dexie, { liveQuery, type Table } from 'dexie';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import { lifeDb, type IslandLifeDatabase } from '../islandLife/repository';
import { replayLifeMigrationResponsive } from './lifeMigrationClient';
import { prepareIslandOpening } from './openingPreparation';
import { readableLifeVersion } from '../islandLife/model';
import { applyIntent, type Intent } from './commands';
import type { FlowerGift, LearningLevels } from './gifts';
import { fromLife, newIsland } from './island';
import type { GrowingState, NatureEvent, TownEvent } from './types';

export interface GrowingRecord {
    profileId: string;
    islandId?: string;
    islandStart?: IslandStart;
    version: 1 | 2 | 3 | 4 | 5 | 6;
    revision: number;
    createdAt: number;
    updatedAt: number;
    state: GrowingState;
    /** The one moment of the current island that was copied. Its record is never modified. */
    migratedFrom?: { lifeVersion: number; lifeRevision: number; at: number };
}

/** One small picture per opening, replayed as "しまの あゆみ" (§13). Never leaves the device. */
export interface MomentRecord { id?: number; islandId?: string; profileId: string; at: number; image: Blob; width: number; height: number }
export const MOMENT_LIMIT = 60;

/** Separate from the current island's database, so switching back keeps its record intact. */
export function growingDatabaseName() { return import.meta.env.DEV ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1'; }
export class GrowingIslandDatabase extends Dexie {
    islands!: Table<GrowingRecord, string>;
    /** Global across voyages: never compact these durable reward identities. */
    foundationReceipts!: Table<(FoundationCompletion | KokugoCompletion) & { islandId: string; receivedAt: number }, [string, string]>;
    deletedOwners!: Table<{ profileId: string; deletedAt: number }, string>;
    moments!: Table<MomentRecord, number>;
    /** Flowers left by siblings' visits, waiting for the recipient's next opening. */
    gifts!: Table<FlowerGift, string>;
    /** Source at cutover; older builds can only write their own lineage. */
    legacyIslands!: Table<GrowingRecord, string>;
    balancedIslands!: Table<GrowingRecord, string>;
    guidedIslands!: Table<GrowingRecord, string>;
    placedIslands!: Table<GrowingRecord, string>;
    legacyGifts!: Table<FlowerGift, string>;
    voyageIslands!: Table<GrowingRecord, string>;
    voyageArchives!: Table<GrowingRecord & { islandId: string }, [string, string]>;
    archivedIslands!: Table<GrowingRecord & { islandId: string }, [string, string]>;
    constructor(name = growingDatabaseName()) {
        super(name);
        this.version(1).stores({ islands: '&profileId' });
        this.version(2).stores({ islands: '&profileId', moments: '++id, profileId, [profileId+at]', gifts: '&id, to, from' });
        // Dexie retries a VersionError without a version. A schema bump alone is no fence.
        // Keep the old lineage but copy once into a table unknown to old command writers.
        this.version(3).stores({ balancedIslands: '&profileId' }).upgrade(async tx => {
            await tx.table('balancedIslands').bulkAdd(await tx.table('islands').toArray());
        });
        // Fence older balance writers, which cannot preserve guidance or acknowledgement receipts.
        this.version(4).stores({ guidedIslands: '&profileId' }).upgrade(async tx => {
            await tx.table('guidedIslands').bulkAdd(await tx.table('balancedIslands').toArray());
        });
        // Old guidance writers cannot discard place history or renderer-use receipts.
        this.version(5).stores({ placedIslands: '&profileId' }).upgrade(async tx => {
            await tx.table('placedIslands').bulkAdd(await tx.table('guidedIslands').toArray());
        });
        this.version(6).stores({ voyageIslands: '&profileId', archivedIslands: '[profileId+islandId], profileId' }).upgrade(async tx => {
            await tx.table('voyageIslands').bulkAdd(await tx.table('placedIslands').toArray());
        });
        // Deleted stores remain readable during Dexie's content upgrade and are removed
        // only after it succeeds. Preserve the photos and their keys atomically.
        this.version(7).stores({ voyageMoments: '++id, profileId, [profileId+at]', moments: null }).upgrade(async tx => {
            await tx.table('voyageMoments').bulkAdd(await tx.table('moments').toArray());
        });
        // Dexie repairs missing stores even for an older declared schema. An empty store
        // without an automatic id or profile indexes instead rejects legacy photograph
        // adds and aborts old owner-deletion transactions before they can report success.
        this.version(8).stores({ moments: '&requiresVoyageWriter' });
        this.version(9).stores({ cultivatedIslands: '&profileId', cultivatedArchives: '[profileId+islandId], profileId',
            cultivatedMoments: '++id, profileId, [profileId+at]', cultivatedGifts: '&id, to, from', voyageMoments: null, gifts: null }).upgrade(async tx => {
            await tx.table('cultivatedIslands').bulkAdd(await tx.table('voyageIslands').toArray());
            await tx.table('cultivatedArchives').bulkAdd(await tx.table('archivedIslands').toArray());
            await tx.table('cultivatedMoments').bulkAdd(await tx.table('voyageMoments').toArray());
            await tx.table('cultivatedGifts').bulkAdd(await tx.table('gifts').toArray());
        });
        this.version(10).stores({ voyageMoments: '&requiresCultivatedWriter', gifts: '&requiresCultivatedWriter' });
        // Foundation delivery has a permanent ledger outside the compacted legacy facts.
        // Fence old writers too: they cannot safely reset or overwrite a wallet whose
        // credits were committed with receipts they do not know how to preserve.
        this.version(11).stores({ foundationReceipts: '[profileId+completionId], profileId', deletedOwners: '&profileId',
            foundationIslands: '&profileId', foundationArchives: '[profileId+islandId], profileId',
            foundationMoments: '++id, profileId, [profileId+at]', foundationGifts: '&id, to, from',
            cultivatedMoments: null, cultivatedGifts: null }).upgrade(async tx => {
            await tx.table('foundationIslands').bulkAdd(await tx.table('cultivatedIslands').toArray());
            await tx.table('foundationArchives').bulkAdd(await tx.table('cultivatedArchives').toArray());
            await tx.table('foundationMoments').bulkAdd(await tx.table('cultivatedMoments').toArray());
            await tx.table('foundationGifts').bulkAdd(await tx.table('cultivatedGifts').toArray());
        });
        this.version(12).stores({ cultivatedMoments: '&requiresFoundationWriter', cultivatedGifts: '&requiresFoundationWriter' });
        // Terrain is gameplay state: isolate all wallets, receipts and deletion guards,
        // not only meshes. An older tab must never acknowledge a reward in our ledger.
        this.version(13).stores({ terrainIslands: '&profileId', terrainArchives: '[profileId+islandId], profileId',
            terrainMoments: '++id, profileId, [profileId+at]', terrainGifts: '&id, to, from',
            terrainFoundationReceipts: '[profileId+completionId], profileId', terrainDeletedOwners: '&profileId',
            foundationMoments: null, foundationGifts: null, foundationReceipts: null, deletedOwners: null }).upgrade(async tx => {
            for (const [target, source] of [['terrainIslands', 'foundationIslands'], ['terrainArchives', 'foundationArchives'],
                ['terrainMoments', 'foundationMoments'], ['terrainGifts', 'foundationGifts'],
                ['terrainFoundationReceipts', 'foundationReceipts'], ['terrainDeletedOwners', 'deletedOwners']])
                await tx.table(target).bulkAdd(await tx.table(source).toArray());
        });
        this.version(14).stores({ foundationMoments: '&requiresTerrainWriter', foundationGifts: '&requiresTerrainWriter',
            foundationReceipts: '&requiresTerrainWriter', deletedOwners: '&requiresTerrainWriter' });
        this.foundationReceipts = this.table('terrainFoundationReceipts');
        this.deletedOwners = this.table('terrainDeletedOwners');
        this.gifts = this.table('terrainGifts');
        this.legacyGifts = this.table('gifts');
        this.moments = this.table('terrainMoments');
        this.voyageIslands = this.table('voyageIslands');
        this.voyageArchives = this.table('archivedIslands');
        this.placedIslands = this.table('placedIslands');
        this.archivedIslands = this.table('terrainArchives');
        this.legacyIslands = this.table('islands');
        this.balancedIslands = this.table('balancedIslands');
        this.guidedIslands = this.table('guidedIslands');
        this.islands = this.table('terrainIslands');
    }
}
export const growingDb = new GrowingIslandDatabase();

/** Every writer protects the transaction, including callers outside the island hook. */
async function withGrowingPersistence<T>(save: () => Promise<T>): Promise<T> {
    const release = holdPwaUpdateForCriticalPersistence();
    try { return await save(); }
    finally { release(); }
}

export async function deleteGrowingOwner(profileId: string, database = growingDb) {
    const terrainSources = ['foundationIslands', 'foundationArchives'].map(name => database.table(name));
    await withGrowingPersistence(() => database.transaction('rw', [...terrainSources, database.table('cultivatedIslands'), database.table('cultivatedArchives'), database.deletedOwners, database.foundationReceipts, database.islands, database.archivedIslands, database.voyageIslands, database.voyageArchives, database.legacyGifts, database.placedIslands, database.guidedIslands, database.balancedIslands, database.legacyIslands, database.moments, database.gifts], async () => {
        await database.deletedOwners.put({ profileId, deletedAt: Date.now() });
        await database.table('foundationIslands').delete(profileId);
        await database.table('foundationArchives').where('profileId').equals(profileId).delete();
        await database.foundationReceipts.where('profileId').equals(profileId).delete();
        await database.table('cultivatedIslands').delete(profileId);
        await database.table('cultivatedArchives').where('profileId').equals(profileId).delete();
        await database.islands.delete(profileId);
        await database.voyageIslands.delete(profileId);
        await database.voyageArchives.where('profileId').equals(profileId).delete();
        await database.placedIslands.delete(profileId);
        await database.archivedIslands.where('profileId').equals(profileId).delete();
        await database.legacyIslands.delete(profileId);
        await database.balancedIslands.delete(profileId);
        await database.guidedIslands.delete(profileId);
        await database.moments.where('profileId').equals(profileId).delete();
        await database.gifts.where('to').equals(profileId).delete();
        await database.gifts.where('from').equals(profileId).delete();
        await database.legacyGifts.filter(gift => gift.to === profileId || gift.from === profileId).delete();
    }));
}

/** A deleted profile id can never be reused by an interrupted opening or delivery. */
export async function assertGrowingOwnerAvailable(profileId: string, database = growingDb) {
    if (await database.deletedOwners.get(profileId)) throw new Error('プロフィールを えらびなおしてね。');
}

export interface Completion { id: string; at: number }
export interface SyncResult { record: GrowingRecord; town: TownEvent[]; nature: NatureEvent[]; learned: number }

async function firstState(profileId: string, now: number, life: IslandLifeDatabase, signal: AbortSignal) {
    const old = await Dexie.exists(life.name) ? await life.worlds.get(profileId) : undefined;
    signal.throwIfAborted();
    if (!old) return { state: newIsland(profileId, now) };
    if (!readableLifeVersion(old.version)) throw new Error('この島のデータは新しい版で開いてください。');
    const current = await replayLifeMigrationResponsive(old, now, signal);
    // An untouched current island (created in the background, nothing owned or earned) is not a
    // child's island yet: start fresh so the first-home walkthrough still happens.
    if (!current.items.length && !current.drops && !current.light && current.residents.every(r => r.id === 'pokomoko') && !current.expanded)
        return { state: newIsland(profileId, now) };
    return { state: fromLife(current, profileId, now),
        migratedFrom: { lifeVersion: old.version, lifeRevision: old.revision, at: now } };
}

/**
 * Loads (or creates) the island, adds new completions, keepsakes and siblings' flowers, grows
 * nature to `now` and opens banked town time, all in one transaction. The town events are
 * the "ひらく" results.
 */
export async function syncGrowingIsland(profileId: string, completions: readonly Completion[], now = Date.now(),
    database = growingDb, life: IslandLifeDatabase = lifeDb, levels?: LearningLevels): Promise<SyncResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const prepared = await prepareIslandOpening(async signal => {
            const [current, mailbox] = await Promise.all([database.islands.get(profileId), database.gifts.where('to').equals(profileId).toArray()]);
            signal.throwIfAborted();
            const created = current ? undefined : await firstState(profileId, now, life, signal);
            const projection = await projectGrowingSyncResponsive({ profileId, current, created, completions, mailbox, now, levels }, signal);
            return { current, mailbox, projection };
        });
        // Only the short compare-and-save phase can hold app updates.
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const saved = await database.transaction('rw', database.islands, database.gifts, database.deletedOwners, async () => {
                await assertGrowingOwnerAvailable(profileId, database);
                const current = await database.islands.get(profileId);
                const mailbox = await database.gifts.where('to').equals(profileId).toArray();
                if (JSON.stringify(current) !== JSON.stringify(prepared.current)
                    || JSON.stringify(mailbox) !== JSON.stringify(prepared.mailbox)) return undefined;
                const { result, changed, receivedGiftIds } = prepared.projection;
                if (receivedGiftIds.length) await database.gifts.bulkDelete(receivedGiftIds);
                if (changed) await database.islands.put(result.record);
                return result;
            });
            if (saved) return saved;
        } finally { release(); }
    }
    throw new Error('しまが かわったよ。もういちど ひらいてね。');
}

export class GuidanceReceiptConflict extends Error {
    constructor() { super('しまの いまを たしかめています。'); this.name = 'GuidanceReceiptConflict'; }
}

/**
 * Applies one child action to the latest saved island. Every command is validated against
 * that state (prices never change), so a background refresh saved first does not fail a tap.
 */
export async function commandGrowingIsland(profileId: string, intent: Intent, now = Date.now(),
    database = growingDb, receiptSinceRevision?: number): Promise<{ record: GrowingRecord; town: TownEvent[] }> {
    return withGrowingPersistence(() => database.transaction('rw', database.islands, database.deletedOwners, async () => {
        await assertGrowingOwnerAvailable(profileId, database);
        const current = await database.islands.get(profileId);
        if (!current) throw new Error('しまを よみこんでから もういちど ためしてね。');
        if (islandIdOf(current) !== (intent.islandId ?? FIRST_ISLAND)) throw new Error('しまが かわったよ。もういちど ひらいてね。');
        // A house retry's finite receipt window must also hold INSIDE the writer.
        // Another tab may have advanced between the UI read and this transaction.
        if (receiptSinceRevision !== undefined && !current.state.applied.includes(intent.id)
            && (!Number.isSafeInteger(receiptSinceRevision) || receiptSinceRevision < 0
                || current.revision < receiptSinceRevision || current.revision - receiptSinceRevision >= RULES.appliedMemory)) {
            throw new Error('いまの へやを みてね。えらびなおせるよ。');
        }
        const upgraded = upgrade(current, now);
        if (current.state.applied.includes(intent.id) && current.version === upgraded.version) return { record: current, town: [] };
        const command = intent.command;
        if (command.type === 'concert-started' || command.type === 'learning-returned' || command.type === 'ack-achievements'
            || command.type === 'shared-play' || command.type === 'place-used' || command.type === 'place-shown') {
            if (command.profileId !== profileId || current.state.seed !== profileId) throw new Error('じぶんの しまを もういちど ひらいてね。');
            if (command.expectedRevision !== current.revision) throw new GuidanceReceiptConflict();
        }
        const { state, events } = applyIntent(upgraded.state, intent, now);
        if (state === upgraded.state) return { record: current, town: [] };
        const record: GrowingRecord = { ...upgraded, version: state.terrain ? 6 : upgraded.version, revision: current.revision + 1, updatedAt: now, state };
        await database.islands.put(record);
        return { record, town: events };
    }));
}

/** Another profile's island, read without growing, saving or migrating anything (§13). */
export async function readGrowingIsland(profileId: string, database = growingDb) {
    const record = await Dexie.exists(database.name) ? await database.islands.get(profileId) : undefined;
    if (record) readable(record);
    return record;
}

/** An open owner's book follows saves without syncing clocks. Query the table directly:
 * probing Dexie.exists() inside a liveQuery can lose the cross-tab observation range. */
export function observeGrowingIsland(profileId: string, database = growingDb) {
    return liveQuery(async () => {
        const record = await database.islands.get(profileId);
        if (record) readable(record);
        return record;
    });
}

const localDay = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const giftId = (from: string, to: string, at: number) => JSON.stringify([from, to, localDay(at)]);

/** One flower per visitor, recipient and day. The recipient's island is not written here. */
export async function sendFlower(from: string, fromName: string, to: string, now = Date.now(), database = growingDb) {
    if (from === to) throw new Error('じぶんの しまには おくれないよ。');
    const id = giftId(from, to, now);
    return withGrowingPersistence(() => database.transaction('rw', database.gifts, database.deletedOwners, async () => {
        await assertGrowingOwnerAvailable(from, database);
        await assertGrowingOwnerAvailable(to, database);
        if (await database.gifts.get(id)) return false;
        await database.gifts.put({ id, to, from, fromName: fromName.slice(0, 12), at: now });
        return true;
    }));
}

export async function flowerSentToday(from: string, to: string, now = Date.now(), database = growingDb) {
    return Boolean(await Dexie.exists(database.name) && await database.gifts.get(giftId(from, to, now)));
}

/**
 * Keeps at most 60 pictures. The one closest in time to its predecessor goes first, so the
 * replay still runs from the very first day to today (§13).
 */
export async function addMoment(profileId: string, image: Blob, width: number, height: number, now = Date.now(), database = growingDb, islandId = FIRST_ISLAND) {
    await withGrowingPersistence(() => database.transaction('rw', database.moments, database.deletedOwners, async () => {
        await assertGrowingOwnerAvailable(profileId, database);
        await database.moments.add({ profileId, islandId, at: now, image, width, height });
        const all = await database.moments.where('[profileId+at]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).filter(moment => (moment.islandId ?? FIRST_ISLAND) === islandId).toArray();
        while (all.length > MOMENT_LIMIT) {
            let drop = 1, gap = Infinity;
            for (let i = 1; i < all.length - 1; i++) {
                const d = all[i].at - all[i - 1].at;
                if (d < gap) { gap = d; drop = i; }
            }
            await database.moments.delete(all[drop].id!);
            all.splice(drop, 1);
        }
    }));
}

export async function listMoments(profileId: string, database = growingDb) {
    if (!await Dexie.exists(database.name)) return [];
    const current = await database.islands.get(profileId);
    return database.moments.where('[profileId+at]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).filter(moment => (moment.islandId ?? FIRST_ISLAND) === islandIdOf(current)).toArray();
}


/** The sea chart is indicative; no world-space coordinates connect its islands. */
export async function listVoyageIslands(profileId: string, database = growingDb) {
    return database.transaction('r', database.islands, database.archivedIslands, async () => {
        const current = await database.islands.get(profileId);
        const archived = await database.archivedIslands.where('profileId').equals(profileId).toArray();
        return current ? [current, ...archived].map(record => ({ id: islandIdOf(record), name: record.state.islandName ?? 'はじまりのしま',
            start: record.islandStart, land: record.state.land, villagers: record.state.villagers.length, active: islandIdOf(record) === islandIdOf(current) })) : [];
    });
}

/** Save the old island and restore the destination atomically; no learning is minted. */
export async function sailGrowingIsland(profileId: string, expectedIslandId: string,
    destination: { id: string; create?: { name: string; start: IslandStart } }, now = Date.now(), database = growingDb) {
    return withGrowingPersistence(() => database.transaction('rw', database.islands, database.archivedIslands, database.deletedOwners, async () => {
        await assertGrowingOwnerAvailable(profileId, database);
        const current = await database.islands.get(profileId);
        if (!current) throw new Error('しまを よみこんでね。');
        if (islandIdOf(current) === destination.id) return current;
        if (islandIdOf(current) !== expectedIslandId) throw new Error('しまが かわったよ。海図を ひらきなおしてね。');
        const stored = await database.archivedIslands.get([profileId, destination.id]);
        if (!stored && !destination.create) throw new Error('しまが みつからなかったよ。海図を ひらきなおしてね。');
        const target = stored ? upgrade(stored, now) : makeVoyageIsland(current, destination.id, destination.create!.name, destination.create!.start, now);
        // A first friend already welcomed opens slot 0 even if no sync noticed it yet.
        const source = { ...current, state: structuredClone(current.state) }; grantRoutes(source.state, undefined, now);
        const record = { ...carrySharedResources(source, target), revision: current.revision + 1, updatedAt: now };
        // Which island this is, so the shoal knows whether the child stands on the newest one (island-journey.md §3.6).
        (record.state.journey ??= { routes: [], chosen: [], species: [] }).here = destination.id;
        // A special island takes the ready shoal's slot, and is the island the shoal turned out to be (island-journey.md §3.6).
        if (!stored && destination.create && isTheme(destination.create.start)) {
            chooseTheme(record.state, destination.create.start, destination.id);
            // The next shoal starts off the new island.
            grantRoutes(record.state, undefined, now);
        }
        await database.archivedIslands.put({ ...current, islandId: islandIdOf(current) });
        await database.archivedIslands.delete([profileId, destination.id]);
        await database.islands.put(record);
        return record;
    }));
}

/** Parent recovery uses the same island/revision fence and persistence hold as child commands. */
export async function restoreGrowingWonder(profileId: string, islandId: string, slot: WonderSlot, expectedRevision: number,
    now = Date.now(), database = growingDb) {
    return withGrowingPersistence(() => database.transaction('rw', database.islands, database.deletedOwners, async () => {
        await assertGrowingOwnerAvailable(profileId, database);
        const current = await database.islands.get(profileId);
        if (!current || islandIdOf(current) !== islandId) throw new Error('島が変わりました。もう一度確認してください。');
        const upgraded = upgrade(current, now);
        if (upgraded.state.growth?.slots[slot]?.status === 'restored') return upgraded;
        if (current.revision !== expectedRevision) throw new Error('島が変わりました。もう一度確認してください。');
        const state = structuredClone(upgraded.state);
        restoreWonderSlot(state, slot, now);
        const record = { ...upgraded, state, revision: current.revision + 1, updatedAt: now };
        await database.islands.put(record);
        return record;
    }));
}
