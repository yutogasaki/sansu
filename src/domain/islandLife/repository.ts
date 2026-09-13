import { preparePlacementMigration } from './placementMigration';
import { lifeCatalogKinds } from './capabilities';
import { prepareRelationMigration } from './relationMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareEconomyMigration, reconcileLegacyCredits } from './economyMigration';
import { placementUndo } from './placementUndo';
import { readableLifeVersion } from './model';
import Dexie, { type Table } from 'dexie';
import { db, type SansuDatabase } from '../../db';
import { HOUR, learningDay, newLife, type Credit, type LifeCommand, type LifeRecord } from './model';
import { commandLife, replayLife } from './simulation';
import { commandFingerprint } from './purchases';

/** Separate ownership database; production never imports diagnostic preview time or items. */
export function lifeDatabaseName() { return import.meta.env.DEV ? 'SansuIslandLifePreviewV1' : 'SansuIslandLifeV1'; }
export class IslandLifeDatabase extends Dexie {
    worlds!: Table<LifeRecord, string>;
    constructor(name = lifeDatabaseName()) { super(name); this.version(1).stores({ worlds: '&profileId' }); }
}
export const lifeDb = new IslandLifeDatabase();
/** Called before native profile deletion; a failure leaves the owner available for retry. */
export async function deleteLifeOwner(profileId: string) {
    if (await Dexie.exists(lifeDb.name)) await lifeDb.worlds.delete(profileId);
}
export interface LifeIntent { id: string; revision: number; command?: LifeCommand; undoOf?: string; advanceHours?: 6 | 24 }
export interface TerminalFact { id: string; at: number }
export function mergeFacts(record: LifeRecord, facts: TerminalFact[]) {
    const known = new Set(record.credits.map(c => c.id)), credits: Credit[] = [...record.credits];
    for (const f of facts) {
        if (f.at < record.createdAt || known.has(f.id)) continue;
        const anchor = [...record.offsets].reverse().find(a => a.at <= f.at) ?? record.offsets[0];
        const at = Math.max(record.createdAt, Math.min(record.now, f.at + anchor.offset));
        credits.push({ id: f.id, at, day: learningDay(at) }); known.add(f.id);
    }
    return { ...record, credits };
}
export async function terminalFacts(profileId: string, database: SansuDatabase = db): Promise<TerminalFact[]> {
    return database.transaction('r', [database.islandPlans, database.islandEvents], async () => {
        const events = await database.islandEvents.where('profileId').equals(profileId).toArray();
        const plans = new Map((await database.islandPlans.where('profileId').equals(profileId).toArray()).map(p => [p.id, p]));
        const completed = new Map<string, TerminalFact>();
        for (const e of events) {
            const p = e.planId ? plans.get(e.planId) : undefined;
            if (!p || e.slotIndex === undefined || !p.slots[e.slotIndex]?.completed
                || !['correct', 'assisted-correct', 'supported-completion'].includes(e.result ?? '')
                || !['answer', 'supported_completed'].includes(e.type)) continue;
            // Earlier written steps also say "correct". Only the final successful
            // event of the now-completed slot is the completion timestamp.
            const id = JSON.stringify([profileId, p.id, e.slotIndex]);
            if (!completed.has(id) || completed.get(id)!.at < e.timestamp) completed.set(id, { id, at: e.timestamp });
        }
        return [...completed.values()];
    });
}
export async function updateLife(profileId: string, facts: TerminalFact[], intent?: LifeIntent,
    realNow = Date.now(), database = lifeDb): Promise<LifeRecord> {
    if (intent?.advanceHours && !import.meta.env.DEV) throw new Error('Diagnostic time is unavailable in production');
    return database.transaction('rw', database.worlds, async () => {
        const previous = await database.worlds.get(profileId) ?? newLife(profileId, realNow);
        if (!readableLifeVersion(previous.version)) throw new Error('この島のデータは新しい版で開いてください。');
        if (intent) {
            if (Boolean(intent.command) === Boolean(intent.advanceHours)) throw new Error('Invalid island intent');
            const action = previous.actions.find(a => a.id === intent.id);
            if (action) {
                if (action.undoOf !== intent.undoOf || !intent.command || commandFingerprint(action.command) !== commandFingerprint(intent.command)) throw new Error('同じ操作の内容が変わっています。');
                return previous;
            }
            if (previous.clockIntents.includes(intent.id)) {
                // Legacy time intents did not store their duration. Do not guess it.
                if (intent.undoOf || !intent.advanceHours || previous.clockIntentHours?.[intent.id] !== undefined
                    && previous.clockIntentHours[intent.id] !== intent.advanceHours) throw new Error('同じ操作の内容が変わっています。');
                return previous;
            }
        }
        // Existing receipts still replay after a rollout flag changes; only new purchases are gated.
        if (!import.meta.env.DEV && intent?.command?.type === 'buy' && !lifeCatalogKinds().includes(intent.command.kind)) {
            throw new Error('この おみせでは いま えらべないよ。');
        }
        if (intent && previous.revision !== intent.revision) throw new Error('しまが かわったよ。もういちど えらんでね。');
        if (intent?.undoOf !== undefined) {
            const inverse = placementUndo(previous, intent.undoOf);
            if (!inverse || !intent.command || commandFingerprint(inverse) !== commandFingerprint(intent.command)) {
                throw new Error('しまが かわったよ。もういちど えらんでね。');
            }
        }
        let next = previous;
        const elapsed = Math.max(0, Math.min(7 * 24 * HOUR, realNow - previous.realAt));
        next = { ...next, realAt: realNow, now: previous.now + elapsed, revision: previous.revision + 1 };
        // Bound one unattended interval and recover after wall-clock rollback.
        const offset = next.now - realNow;
        if (Math.abs(offset - next.offsets[next.offsets.length - 1].offset) > 1) next.offsets = [...next.offsets, { at: realNow, offset }];
        next = mergeFacts(next, facts);
        if (intent?.advanceHours) {
            if (![6, 24].includes(intent.advanceHours)) throw new Error('Invalid diagnostic interval');
            next = { ...next, now: next.now + intent.advanceHours * HOUR, clockIntents: [...next.clockIntents, intent.id],
                clockIntentHours: { ...next.clockIntentHours, [intent.id]: intent.advanceHours } };
            next.offsets = [...next.offsets, { at: realNow, offset: next.now - realNow }];
        }
        if (next.activitiesV2At === undefined) {
            next.activitiesV2At = next.now; next.activitiesV2After = next.actions.length;
        }
        // One owner transaction commits the untouched legacy backup, projection,
        // watermark and active version together. WebCrypto cannot let IDB expire.
        next = await Dexie.waitFor(next.economyCheckpoint ? reconcileLegacyCredits(next) : prepareEconomyMigration(next, facts, previous));
        next = await Dexie.waitFor(prepareTourMigration(next));
        next = await Dexie.waitFor(prepareFacilityMigration(next));
        next = await Dexie.waitFor(prepareRelationMigration(next));
        next = await Dexie.waitFor(preparePlacementMigration(next));
        if (intent?.command) next = commandLife(next, intent.command, intent.id, next.now, intent.undoOf);
        replayLife(next); // Reject invalid transactions before any write.
        await database.worlds.put(next); return next;
    });
}
