import { useCallback, useRef, useState } from 'react';
import { useGrowingIsland, type PlaceReceipt } from '../../../src/components/island/growing/useGrowingIsland';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import type { GrowingRecord } from '../../../src/domain/growingIsland/repository';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import expanded from './evidence/expanded-fixture-v2.json';
import shore from './evidence/expanded-place-recipe-flower-flat-wide-fixture.json';

/** A disclosed, memory-only size comparison. No island repository write, learning
 * reward or save claim is made for this fixture. The ordinary screen, command
 * guards, floor and life controller still execute; reload resets the fixture. */
export function expandedTrialEnabled() {
    return typeof location !== 'undefined' && ['expanded', 'shore'].includes(new URLSearchParams(location.search).get('trialScene') ?? '');
}

export function comparisonScene() {
    return typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('trialScene') ?? '';
}

export function useComparisonIsland(profileId: string, active: boolean): ReturnType<typeof useGrowingIsland> {
    const fixture = expandedTrialEnabled();
    // Hook order is unconditional. The real hook is inactive for the fixture,
    // preventing its opening/sync effects from loading or saving the real island.
    const real = useGrowingIsland(profileId, active && !fixture);
    const [record, setRecord] = useState<GrowingRecord>(() => ({
        profileId, islandId: 'comparison-expanded-memory-only', version: 6,
        revision: 0, createdAt: 0, updatedAt: 0,
        state: structuredClone(comparisonScene() === 'shore' ? shore.state : expanded.state) as unknown as GrowingState,
    }));
    const current = useRef(record);
    const [error, setError] = useState<string>();
    const dispatch = useCallback(async (command: Command) => {
        if (!fixture || !active) return false;
        try {
            const now = Date.now();
            const result = applyIntent(current.current.state, { id: crypto.randomUUID(), command }, now);
            const next = { ...current.current, state: result.state, revision: current.current.revision + 1, updatedAt: now };
            current.current = next; setRecord(next); setError(undefined); return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
    }, [active, fixture]);
    const acknowledgePlace = useCallback((receipt: PlaceReceipt) => dispatch({ ...receipt,
        profileId, expectedRevision: current.current.revision } as Command), [dispatch, profileId]);
    const sync = useCallback(async () => { /* No repository or learning sync in the fixture. */ }, []);
    const acknowledge = useCallback(async () => false, []);
    const sail = useCallback(async () => { setError('比較用の島では 航海を しません。'); return false; }, []);
    if (!fixture) return real;
    return { record, reveal: undefined, error, busy: false, syncing: false, saving: false,
        dispatch, acknowledgePlace, acknowledge, sync, sail, step: 'saving', clearError: () => setError(undefined) };
}
