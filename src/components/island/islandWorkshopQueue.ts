import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import { canonicalIslandWorkshopAction, getIslandWorkshop, IslandWorkshopConflict, workshopLayoutKey,
    type IslandWorkshopAction } from '../../domain/island/workshop';
import { WorkshopLayoutConflict } from '../../domain/island/workshopLayout';
import { executeIslandWorkshopRequest, type IslandWorkshopRequest } from './islandWorkshopRequest';

export interface IslandWorkshopQueueContext { island?: IslandRecord; active: boolean; busy: boolean; visible: boolean }
export interface IslandWorkshopQueueStatus { cause?: unknown; retry: boolean }
interface QueueEntry {
    action: IslandWorkshopAction;
    observationKey?: string;
    waiter?: { promise: Promise<boolean>; resolve: (saved: boolean) => void };
}
interface QueueOptions {
    profileId: string;
    context: () => IslandWorkshopQueueContext;
    run: <T>(action: () => Promise<T>) => Promise<T | undefined>;
    write: (profileId: string, request: IslandWorkshopRequest) => Promise<IslandRecord>;
    refresh: (profileId: string) => Promise<IslandRecord | undefined>;
    onSaved: (island: IslandRecord) => void;
    onStatus: (status: IslandWorkshopQueueStatus) => void;
}
type ObservationStatus = 'ready' | 'observed' | 'expired';
const isObservation = (action: IslandWorkshopAction) => action.type === 'observe-specimen' || action.type === 'observe-creation';

/** Check at the head, after preceding gestures have saved. A callback may describe
 * the surface produced by a brush stroke which is still waiting in this queue. */
export function islandWorkshopObservationStatus(island: IslandRecord, action: IslandWorkshopAction): ObservationStatus {
    if (!isObservation(action)) return 'ready';
    const state = getIslandWorkshop(island);
    if (action.type === 'observe-specimen') {
        const specimen = state.specimens[action.specimenId];
        if (specimen.observations.some(entry => entry.result === action.result)) return 'observed';
        return specimen.cleanedMask === action.cleanedMask ? 'ready' : 'expired';
    }
    if (action.type === 'observe-creation') {
        if (state.creations.some(entry => entry.partId === action.partId)) return 'observed';
        return workshopLayoutKey(state.draftCheckpoint.draft.layout) === action.layoutKey ? 'ready' : 'expired';
    }
    return 'ready';
}

/** One FIFO owns scene gestures, UI actions and their uncertain receipts. Only
 * repeated observations are coalesced; move A -> B -> A remains three intents. */
export function createIslandWorkshopQueue(options: QueueOptions) {
    const entries: QueueEntry[] = [], observations = new Map<string, QueueEntry>();
    const pending = { current: undefined as IslandWorkshopRequest | undefined };
    let disposed = false, inFlight = false, blocked = false, wakeRequested = false;
    const owned = () => !disposed && options.context().island?.profileId === options.profileId;
    const accepting = () => owned() && options.context().active && options.context().visible;
    const status = (cause?: unknown, retry = false) => { if (owned()) options.onStatus({ cause, retry }); };
    const waiting = (entry: QueueEntry) => {
        if (!entry.waiter) {
            let resolve!: (saved: boolean) => void;
            const promise = new Promise<boolean>(done => { resolve = done; });
            entry.waiter = { promise, resolve };
        }
        return entry.waiter.promise;
    };
    const settle = (entry: QueueEntry, saved: boolean) => { entry.waiter?.resolve(saved); entry.waiter = undefined; };
    const publish = (island: IslandRecord) => {
        const current = options.context().island;
        const latest = current?.profileId === island.profileId && current.revision > island.revision ? current : island;
        options.onSaved(latest); return latest;
    };
    const remove = (entry: QueueEntry, saved: boolean) => {
        entries.shift();
        if (entry.observationKey) observations.delete(entry.observationKey);
        pending.current = undefined; blocked = false; settle(entry, saved);
    };
    const retire = (entry: QueueEntry, island: IslandRecord): boolean => {
        const result = islandWorkshopObservationStatus(island, entry.action);
        if (result === 'ready') return false;
        remove(entry, result === 'observed'); status(); return true;
    };

    async function pump(): Promise<void> {
        if (!owned()) return;
        if (inFlight) { wakeRequested = true; return; }
        wakeRequested = false;
        // A refresh/live update can retire a failed observation, even while its
        // old error is displayed. It must not hold unrelated gestures hostage.
        try {
            while (entries[0] && retire(entries[0], options.context().island!)) { /* preserve FIFO */ }
        } catch (cause) { blocked = true; if (entries[0]) settle(entries[0], false); status(cause, true); return; }
        if (!entries[0] || blocked || !accepting() || options.context().busy) return;
        const entry = entries[0], owner = options.context().island!;
        inFlight = true; status();
        let progressed = false;
        try {
            const result = await options.run(async () => {
                // The shared lock may defer/decline the callback. Recheck the
                // learning/visibility/profile gate immediately before the write.
                if (!accepting()) return { type: 'deferred' as const };
                try {
                    const island = await executeIslandWorkshopRequest(pending, owner.revision, entry.action,
                        request => options.write(options.profileId, request));
                    return { type: 'saved' as const, island };
                } catch (cause) {
                    if (cause instanceof IslandConflict) {
                        // A failed read is itself uncertain. Keep the head for
                        // an explicit retry instead of spinning a refresh loop.
                        try {
                            const latest = await options.refresh(options.profileId);
                            if (owned() && latest?.profileId === options.profileId) {
                                const observation = islandWorkshopObservationStatus(publish(latest), entry.action);
                                if (observation !== 'ready') return { type: 'retired' as const, saved: observation === 'observed' };
                            }
                        } catch (refreshCause) { return { type: 'failed' as const, cause: refreshCause }; }
                    }
                    return { type: 'failed' as const, cause };
                }
            });
            if (!owned() || !result || result.type === 'deferred') return;
            if (result.type === 'saved') {
                publish(result.island); remove(entry, true); status(); progressed = true;
            } else if (result.type === 'retired') {
                remove(entry, result.saved); status(); progressed = true;
            } else {
                const { cause } = result;
                if (cause instanceof IslandWorkshopConflict || cause instanceof WorkshopLayoutConflict) {
                    // Confirmed invalid input did not commit. It can be corrected
                    // by the next gesture; replaying it cannot make it valid.
                    remove(entry, false); progressed = true;
                    if (isObservation(entry.action) && cause instanceof IslandWorkshopConflict
                        && (cause.code === 'stale-observation' || cause.code === 'result-unavailable')) status();
                    else status(cause);
                } else { blocked = true; settle(entry, false); status(cause, true); }
            }
        } catch (cause) {
            // Also support shared runners which propagate an unexpected failure.
            if (owned()) { blocked = true; settle(entry, false); status(cause, true); }
        } finally {
            inFlight = false;
            // A foreground/learning update can arrive before the runner finishes
            // declining a write. Do not lose that one wakeup or poll the lock.
            if (wakeRequested) { wakeRequested = false; void pump(); }
        }
        if (progressed) await pump();
    }

    return {
        enqueue(action: IslandWorkshopAction): Promise<boolean> {
            if (!accepting()) return Promise.resolve(false);
            let intent: IslandWorkshopAction;
            try { intent = canonicalIslandWorkshopAction(action); }
            catch (cause) { status(cause, blocked); return Promise.resolve(false); }
            const observationKey = isObservation(intent) ? JSON.stringify(intent) : undefined;
            let entry = observationKey ? observations.get(observationKey) : undefined;
            if (!entry) {
                entry = { action: structuredClone(intent), observationKey };
                entries.push(entry);
                if (observationKey) observations.set(observationKey, entry);
                // A new deliberate gesture also requests recovery of a failed
                // earlier intent, without replacing that intent or its receipt.
                if (!observationKey) blocked = false;
            }
            const result = waiting(entry);
            void pump(); return result;
        },
        retry(): Promise<boolean> {
            const entry = entries[0];
            if (!entry || !accepting()) return Promise.resolve(false);
            const result = waiting(entry);
            blocked = false; void pump(); return result;
        },
        wake() { void pump(); },
        dispose() {
            disposed = true;
            for (const entry of entries.splice(0)) settle(entry, false);
            observations.clear(); pending.current = undefined;
        },
    };
}
