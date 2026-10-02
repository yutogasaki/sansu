import { migrateGuidance, noteTownBuilds, validateGuidance } from './guidance';
import Dexie, { liveQuery, type Table } from 'dexie';
import { lifeDb, type IslandLifeDatabase } from '../islandLife/repository';
import { replayLife } from '../islandLife/simulation';
import { readableLifeVersion } from '../islandLife/model';
import { applyIntent, type Intent } from './commands';
import { deliverKeepsakes, receiveGifts, type FlowerGift, type LearningLevels } from './gifts';
import { fromLife, ingestCompletions, newIsland } from './island';
import { advanceNature } from './nature';
import { openTown } from './town';
import { scheduleSurprise, surpriseDay } from './moments';
import type { GrowingState, NatureEvent, TownEvent } from './types';

export interface GrowingRecord {
    profileId: string;
    version: 1 | 2 | 3;
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
        this.legacyIslands = this.table('islands');
        this.balancedIslands = this.table('balancedIslands');
        this.islands = this.table('guidedIslands');
    }
}
export const growingDb = new GrowingIslandDatabase();

export async function deleteGrowingOwner(profileId: string, database = growingDb) {
    if (!await Dexie.exists(database.name)) return;
    await database.transaction('rw', [database.islands, database.balancedIslands, database.legacyIslands, database.moments, database.gifts], async () => {
        await database.islands.delete(profileId);
        await database.legacyIslands.delete(profileId);
        await database.balancedIslands.delete(profileId);
        await database.moments.where('profileId').equals(profileId).delete();
        await database.gifts.where('to').equals(profileId).delete();
        await database.gifts.where('from').equals(profileId).delete();
    });
}

export interface Completion { id: string; at: number }
export interface SyncResult { record: GrowingRecord; town: TownEvent[]; nature: NatureEvent[]; learned: number }

function readable(record: GrowingRecord) {
    if (record.version !== 1 && record.version !== 2 && record.version !== 3) throw new Error('この島のデータは新しい版で開いてください。');
    if (record.version === 3 && !record.state.guidance) throw new Error('この島のあそびかたは新しい版で開いてください。');
    if (record.state.guidance) validateGuidance(record.state.guidance);
}

/** Preserve all rights and clocks; no old learning or missed surprises are reissued. */
function upgrade(record: GrowingRecord, now: number): GrowingRecord {
    readable(record);
    if (record.version === 3 && record.state.guidance) return record;
    const state = structuredClone(record.state);
    if (record.version === 1) state.surprise = { day: Math.max(surpriseDay(state), Math.floor((now - state.enrolledAt) / 86_400_000)) };
    migrateGuidance(state);
    return { ...record, version: 3, state };
}

async function firstState(profileId: string, now: number, life: IslandLifeDatabase) {
    const old = await Dexie.exists(life.name) ? await life.worlds.get(profileId) : undefined;
    if (!old) return { state: newIsland(profileId, now) };
    if (!readableLifeVersion(old.version)) throw new Error('この島のデータは新しい版で開いてください。');
    const current = replayLife(old, now);
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
    const existing = await database.islands.get(profileId);
    const created = existing ? undefined : await firstState(profileId, now, life);
    return database.transaction('rw', database.islands, database.gifts, async () => {
        const current = await database.islands.get(profileId);
        let record: GrowingRecord = current ? upgrade(current, now) : { profileId, version: 3, revision: 0, createdAt: now, updatedAt: now,
            state: created!.state, ...(created?.migratedFrom ? { migratedFrom: created.migratedFrom } : {}) };
        const ingested = ingestCompletions(record.state, completions);
        const state = structuredClone(ingested.state);
        const mailbox = await database.gifts.where('to').equals(profileId).toArray();
        const received = [...receiveGifts(state, mailbox), ...deliverKeepsakes(state, levels)];
        const nature = advanceNature(state, now);
        const beforeTown = JSON.stringify(state);
        const opened = state.town.bank > 0 ? openTown(state) : [];
        noteTownBuilds(state, opened);
        const town = [...received, ...(ingested.added > 0 || beforeTown !== JSON.stringify(state) ? opened : []), ...scheduleSurprise(state)];
        if (mailbox.length) await database.gifts.bulkDelete(mailbox.filter(g => state.gifts?.includes(g.id)).map(g => g.id));
        const changed = !current || current.version !== record.version || ingested.added > 0 || nature.length > 0
            || JSON.stringify(state) !== JSON.stringify(record.state);
        if (changed) {
            record = { ...record, revision: record.revision + (current ? 1 : 0), updatedAt: now, state };
            await database.islands.put(record);
        }
        return { record, town, nature, learned: ingested.added };
    });
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
    return database.transaction('rw', database.islands, async () => {
        const current = await database.islands.get(profileId);
        if (!current) throw new Error('しまを よみこんでから もういちど ためしてね。');
        const upgraded = upgrade(current, now);
        if (current.state.applied.includes(intent.id) && current.version === upgraded.version) return { record: current, town: [] };
        const command = intent.command;
        if (command.type === 'concert-started' || command.type === 'learning-returned' || command.type === 'ack-achievements') {
            if (command.profileId !== profileId || current.state.seed !== profileId) throw new Error('じぶんの しまを もういちど ひらいてね。');
            if (command.expectedRevision !== current.revision) throw new GuidanceReceiptConflict();
        }
        const { state, events } = applyIntent(upgraded.state, intent, now);
        const record = { ...upgraded, revision: current.revision + 1, updatedAt: now, state };
        await database.islands.put(record);
        return { record, town: events };
    });
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
    return database.transaction('rw', database.gifts, async () => {
        if (await database.gifts.get(id)) return false;
        await database.gifts.put({ id, to, from, fromName: fromName.slice(0, 12), at: now });
        return true;
    });
}

export async function flowerSentToday(from: string, to: string, now = Date.now(), database = growingDb) {
    return Boolean(await Dexie.exists(database.name) && await database.gifts.get(giftId(from, to, now)));
}

/**
 * Keeps at most 60 pictures. The one closest in time to its predecessor goes first, so the
 * replay still runs from the very first day to today (§13).
 */
export async function addMoment(profileId: string, image: Blob, width: number, height: number, now = Date.now(), database = growingDb) {
    await database.transaction('rw', database.moments, async () => {
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
    });
}

export async function listMoments(profileId: string, database = growingDb) {
    if (!await Dexie.exists(database.name)) return [];
    return database.moments.where('[profileId+at]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray();
}
