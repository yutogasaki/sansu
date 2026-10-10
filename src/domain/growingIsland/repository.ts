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
    version: 1 | 2 | 3 | 4;
    revision: number;
    createdAt: number;
    updatedAt: number;
    state: GrowingState;
    /** The one moment of the current island that was copied. Its record is never modified. */
    migratedFrom?: { lifeVersion: number; lifeRevision: number; at: number };
}

/** One small picture per opening, replayed as "しまの あゆみ" (§13). Never leaves the device. */
export interface MomentRecord { id?: number; profileId: string; at: number; image: Blob; width: number; height: number }
export const MOMENT_LIMIT = 60;

/** Separate from the current island's database, so switching back keeps its record intact. */
export function growingDatabaseName() { return import.meta.env.DEV ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1'; }
export class GrowingIslandDatabase extends Dexie {
    islands!: Table<GrowingRecord, string>;
    moments!: Table<MomentRecord, number>;
    /** Flowers left by siblings' visits, waiting for the recipient's next opening. */
    gifts!: Table<FlowerGift, string>;
    /** Source at cutover; older builds can only write their own lineage. */
    legacyIslands!: Table<GrowingRecord, string>;
    balancedIslands!: Table<GrowingRecord, string>;
    guidedIslands!: Table<GrowingRecord, string>;
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
        this.legacyIslands = this.table('islands');
        this.balancedIslands = this.table('balancedIslands');
        this.guidedIslands = this.table('guidedIslands');
        this.islands = this.table('placedIslands');
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
    if (!await Dexie.exists(database.name)) return;
    await withGrowingPersistence(() => database.transaction('rw', [database.islands, database.guidedIslands, database.balancedIslands, database.legacyIslands, database.moments, database.gifts], async () => {
        await database.islands.delete(profileId);
        await database.legacyIslands.delete(profileId);
        await database.balancedIslands.delete(profileId);
        await database.guidedIslands.delete(profileId);
        await database.moments.where('profileId').equals(profileId).delete();
        await database.gifts.where('to').equals(profileId).delete();
        await database.gifts.where('from').equals(profileId).delete();
    }));
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
            const saved = await database.transaction('rw', database.islands, database.gifts, async () => {
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
    database = growingDb): Promise<{ record: GrowingRecord; town: TownEvent[] }> {
    return withGrowingPersistence(() => database.transaction('rw', database.islands, async () => {
        const current = await database.islands.get(profileId);
        if (!current) throw new Error('しまを よみこんでから もういちど ためしてね。');
        const upgraded = upgrade(current, now);
        if (current.state.applied.includes(intent.id) && current.version === upgraded.version) return { record: current, town: [] };
        const command = intent.command;
        if (command.type === 'concert-started' || command.type === 'learning-returned' || command.type === 'ack-achievements'
            || command.type === 'place-used' || command.type === 'place-shown') {
            if (command.profileId !== profileId || current.state.seed !== profileId) throw new Error('じぶんの しまを もういちど ひらいてね。');
            if (command.expectedRevision !== current.revision) throw new GuidanceReceiptConflict();
        }
        const { state, events } = applyIntent(upgraded.state, intent, now);
        const record = { ...upgraded, revision: current.revision + 1, updatedAt: now, state };
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
    return withGrowingPersistence(() => database.transaction('rw', database.gifts, async () => {
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
export async function addMoment(profileId: string, image: Blob, width: number, height: number, now = Date.now(), database = growingDb) {
    await withGrowingPersistence(() => database.transaction('rw', database.moments, async () => {
        await database.moments.add({ profileId, at: now, image, width, height });
        const all = await database.moments.where('[profileId+at]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray();
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
    return database.moments.where('[profileId+at]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray();
}
