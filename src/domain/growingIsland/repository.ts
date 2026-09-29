import Dexie, { type Table } from 'dexie';
import { lifeDb, type IslandLifeDatabase } from '../islandLife/repository';
import { replayLife } from '../islandLife/simulation';
import { readableLifeVersion } from '../islandLife/model';
import { applyIntent, type Intent } from './commands';
import { fromLife, ingestCompletions, newIsland } from './island';
import { advanceNature } from './nature';
import { openTown } from './town';
import type { GrowingState, NatureEvent, TownEvent } from './types';

export interface GrowingRecord {
    profileId: string;
    version: 1;
    revision: number;
    createdAt: number;
    updatedAt: number;
    state: GrowingState;
    /** The one moment of the current island that was copied. Its record is never modified. */
    migratedFrom?: { lifeVersion: number; lifeRevision: number; at: number };
}

/** Separate from the current island's database, so switching back keeps its record intact. */
export function growingDatabaseName() { return import.meta.env.DEV ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1'; }
export class GrowingIslandDatabase extends Dexie {
    islands!: Table<GrowingRecord, string>;
    constructor(name = growingDatabaseName()) { super(name); this.version(1).stores({ islands: '&profileId' }); }
}
export const growingDb = new GrowingIslandDatabase();

export async function deleteGrowingOwner(profileId: string) {
    if (await Dexie.exists(growingDb.name)) await growingDb.islands.delete(profileId);
}

export interface Completion { id: string; at: number }
export interface SyncResult { record: GrowingRecord; town: TownEvent[]; nature: NatureEvent[]; learned: number }

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
 * Loads (or creates) the island, adds new completions, grows nature to `now` and opens
 * banked town time, all in one transaction. The town events are the "ひらく" results.
 */
export async function syncGrowingIsland(profileId: string, completions: readonly Completion[], now = Date.now(),
    database = growingDb, life: IslandLifeDatabase = lifeDb): Promise<SyncResult> {
    const existing = await database.islands.get(profileId);
    const created = existing ? undefined : await firstState(profileId, now, life);
    return database.transaction('rw', database.islands, async () => {
        const current = await database.islands.get(profileId);
        let record: GrowingRecord = current ?? { profileId, version: 1, revision: 0, createdAt: now, updatedAt: now,
            state: created!.state, ...(created?.migratedFrom ? { migratedFrom: created.migratedFrom } : {}) };
        if (record.version !== 1) throw new Error('この島のデータは新しい版で開いてください。');
        const ingested = ingestCompletions(record.state, completions);
        const state = structuredClone(ingested.state);
        const nature = advanceNature(state, now);
        const town = state.town.bank > 0 ? openTown(state) : [];
        const changed = !current || ingested.added > 0 || nature.length > 0 || town.length > 0
            || JSON.stringify(state) !== JSON.stringify(record.state);
        if (changed) {
            record = { ...record, revision: record.revision + (current ? 1 : 0), updatedAt: now, state };
            await database.islands.put(record);
        }
        return { record, town, nature, learned: ingested.added };
    });
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
        if (current.state.applied.includes(intent.id)) return { record: current, town: [] };
        const { state, events } = applyIntent(current.state, intent);
        const record = { ...current, revision: current.revision + 1, updatedAt: now, state };
        await database.islands.put(record);
        return { record, town: events };
    });
}
