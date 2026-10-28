import { matureTrialEnabled } from './mature-composition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGrowingIsland, type PlaceReceipt } from '../../../src/components/island/growing/useGrowingIsland';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { commandGrowingIsland, observeGrowingIsland, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import type { Command } from '../../../src/domain/growingIsland/types';
import { expandedTrialEnabled } from '../2026-10-23-place-method-comparison/TrialIsland';
import type { Safety } from './model';
import type { PlaceShape } from './directional-field';
import { placeEditingRevision, trialHistoryOf, validateTrialPlaceState } from './persistent-model';
import { TRIAL_PROFILE, assertSavedTrialRecipe, localTrialEnabled, openSavedTrial, trialDatabase, trialInitialRecord } from './trial-store';
import { compositeEnabled, type PlaceSlot } from './composite-field';
import { compositeEditingRevision, compositeHistoryOf } from './composite-model';
import { coastalTrialMode } from './coastal-section';
import { compositeDatabase, compositeSavedMode, openCompositeTrial, assertCompositeSavedRecord } from './composite-store';
import { assemblyDatabase, assemblySavedMode, openAssemblyTrial, assertAssemblySavedRecord } from './assembly-store';
export { expandedTrialEnabled };

const singleStorage = { assertMode: assertSavedTrialRecipe, database: trialDatabase, open: openSavedTrial,
    validate: (record: GrowingRecord) => validateTrialPlaceState(record.state) };
const compositeStorage = { assertMode: () => { if (!compositeSavedMode()) throw Error('2つの場所の保存専用URLで開いてください。'); },
    database: compositeDatabase, open: openCompositeTrial, validate: assertCompositeSavedRecord };
const assemblyStorage = { assertMode: () => { if (!assemblySavedMode()) throw Error('湾と高台の保存専用URLで開いてください。'); },
    database: assemblyDatabase, open: openAssemblyTrial, validate: assertAssemblySavedRecord };

export function useComparisonIsland(profileId: string, active: boolean) {
    matureTrialEnabled(); // Reject incompatible save mode before opening any DB.
    coastalTrialMode(); // Reject active shore modes with no supported fixture before the real-island hook.
    const composite = compositeEnabled(); // Reject saving/coast combinations before any DB accessor or hook.
    const savedComposite = compositeSavedMode(); // Also rejects two-local with a missing two/fixture selector.
    const savedAssembly = assemblySavedMode();
    const fixture = expandedTrialEnabled(), persisted = fixture && (savedAssembly || savedComposite || localTrialEnabled());
    const storage = persisted ? savedAssembly ? assemblyStorage : savedComposite ? compositeStorage : singleStorage : undefined;
    const real = useGrowingIsland(profileId, active && !fixture);
    const [record, setRecord] = useState<GrowingRecord | undefined>(() => {
        if (persisted) return undefined;
        const initial = trialInitialRecord();
        if (composite) Object.assign(initial.state, { trialPlaceSet: {}, trialPlaceSetHistory: { version: 1, undo: [], redo: [] } });
        return initial;
    });
    const current = useRef(record), tail = useRef<Promise<unknown>>(Promise.resolve()), pending = useRef(0);
    const [pendingCount, setPendingCount] = useState(0), [error, setError] = useState<string>();
    const publish = useCallback((next: GrowingRecord) => {
        if (!current.current || next.revision >= current.current.revision) {
            current.current = next; setRecord(next);
        }
    }, []);
    const read = useCallback(async () => {
        try { if (storage) { storage.assertMode(); publish(await storage.open()); } setError(undefined); }
        catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
    }, [storage, publish]);
    useEffect(() => {
        if (!storage) return;
        // Do not construct either the opener or observation subscription when
        // the current query is incompatible with this saved recipe.
        try { storage.assertMode(); }
        catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); return; }
        let stopped = false;
        void storage.open().then(saved => { if (!stopped) { publish(saved); setError(undefined); } })
            .catch(cause => { if (!stopped) setError(String(cause instanceof Error ? cause.message : cause)); });
        const subscription = observeGrowingIsland(TRIAL_PROFILE, storage.database()).subscribe({
            next: saved => { if (saved && !stopped) { try { storage.assertMode(); storage.validate(saved); publish(saved); }
                catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); } } },
            error: cause => { if (!stopped) setError(String(cause instanceof Error ? cause.message : cause)); },
        });
        return () => { stopped = true; subscription.unsubscribe(); };
    }, [storage, publish]);

    // A command becomes visible only after the same atomic writer used by the
    // product commits it. A failure retains the last saved record and history.
    const send = useCallback((make: (latest: GrowingRecord) => Command) => {
        if (!fixture || !active || !current.current) return Promise.resolve(false);
        pending.current++; setPendingCount(pending.current);
        const execute = async () => {
            try {
                if (storage) storage.assertMode();
                const latest = storage ? await readGrowingIsland(TRIAL_PROFILE, storage.database()) : current.current;
                if (!latest) throw Error('試作の保存を読み込めませんでした。');
                const command = make(latest), intent = { id: crypto.randomUUID(), islandId: latest.islandId ?? 'main', command };
                const next = storage
                    ? (await commandGrowingIsland(TRIAL_PROFILE, intent, Date.now(), storage.database())).record
                    : { ...latest, state: applyIntent(latest.state, intent, Date.now()).state, revision: latest.revision + 1, updatedAt: Date.now() };
                publish(next); setError(undefined); return true;
            } catch (cause) {
                setError(String(cause instanceof Error ? cause.message : cause)); return false;
            } finally { pending.current--; setPendingCount(pending.current); }
        };
        const result = tail.current.then(execute, execute); tail.current = result;
        return result;
    }, [fixture, active, storage, publish]);
    const dispatch = useCallback((command: Command) => send(() => command), [send]);
    const place = async (action: 'apply' | 'undo' | 'redo', shape: PlaceShape, safety: Safety, slot: PlaceSlot = 'west') => {
        const viewed = current.current;
        if (!viewed || pending.current) return false;
        if (composite) {
            const expectedPlaceRevision = compositeEditingRevision(viewed.state);
            return send(() => ({ type: 'place-set', action, slot, shape, safety, expectedPlaceRevision }));
        }
        const expectedPlaceRevision = placeEditingRevision(viewed.state);
        return send(() => ({ type: 'place-outline', action, shape, safety, expectedPlaceRevision }));
    };
    const acknowledgePlace = useCallback((receipt: PlaceReceipt) => send(latest => ({ ...receipt,
        profileId: TRIAL_PROFILE, expectedRevision: latest.revision } as Command)), [send]);
    if (!fixture) return { ...real, place, placeUndo: 0, placeRedo: 0, trialPersisted: false };
    const history = record && (composite ? compositeHistoryOf(record.state) : trialHistoryOf(record.state));
    return { record, reveal: undefined, error, busy: pendingCount > 0, syncing: false, saving: pendingCount > 0,
        dispatch, acknowledgePlace, acknowledge: async () => false, sync: read, sail: async () => false,
        step: 'saving' as const, clearError: () => setError(undefined), place,
        placeUndo: history?.undo.length ?? 0, placeRedo: history?.redo.length ?? 0, trialPersisted: persisted };
}
