import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { canonicalIslandRewardGoalAction, IslandRewardGoalConflict, type IslandRewardGoalAction } from '../../domain/island/rewardGoal';
import { saveIslandRewardGoal } from '../../domain/island/rewardGoalRepository';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

interface Request { revision: number; action: IslandRewardGoalAction }
interface Bucket { profileId: string; latest: IslandRecord; pending?: Request; error?: string }
const newest = (a: IslandRecord, b: IslandRecord) => b.revision > a.revision ? b : a;
function errorMessage(cause: unknown) {
    if (cause instanceof IslandRewardGoalConflict && cause.code === 'already-owned') return 'これは もう もっているよ。';
    if (cause instanceof IslandRewardGoalConflict || cause instanceof IslandConflict) return 'しまの ようすが かわったよ。ほしいものを えらびなおそう。';
    return 'ほしいものの きろくを たしかめよう。おなじ そうさで もういちど ためせるよ。';
}

/** A goal never owns navigation or preview state. A different screen is still
 * a new presentation epoch, even when both screens support goal selection. */
export function useIslandRewardGoal(island: IslandRecord | undefined, activeView: string | undefined,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (updated: IslandRecord) => void) {
    const [pending, setPending] = useState<IslandRewardGoalAction>();
    const [error, setError] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const owner = useRef({ island, activeView, mounted: false, onSaved });
    const buckets = useRef(new Map<string, Bucket>());
    const running = useRef<Promise<boolean> | undefined>(undefined), epoch = useRef(0);
    const profileId = island?.profileId;
    const accepting = useCallback((id: string) => owner.current.mounted && Boolean(owner.current.activeView)
        && owner.current.island?.profileId === id && !document.hidden, []);
    const sync = useCallback((bucket?: Bucket) => {
        if (!owner.current.mounted || bucket && owner.current.island?.profileId !== bucket.profileId) return;
        setPending(bucket?.pending?.action); setError(bucket?.error); setCanRetry(Boolean(bucket?.pending) && !running.current);
    }, []);
    useLayoutEffect(() => {
        if (owner.current.island?.profileId !== profileId || owner.current.activeView !== activeView) epoch.current += 1;
        let bucket = profileId ? buckets.current.get(profileId) : undefined;
        if (island) {
            if (!bucket) { bucket = { profileId: island.profileId, latest: island }; buckets.current.set(island.profileId, bucket); }
            else bucket.latest = newest(bucket.latest, island);
        }
        owner.current = { island: bucket?.latest, activeView, mounted: true, onSaved }; sync(bucket);
    }, [profileId, island, activeView, onSaved, sync]);
    useLayoutEffect(() => {
        const hidden = () => { if (document.hidden) epoch.current += 1; };
        document.addEventListener('visibilitychange', hidden);
        return () => { owner.current.mounted = false; epoch.current += 1; document.removeEventListener('visibilitychange', hidden); };
    }, []);
    const execute = useCallback((bucket: Bucket): Promise<boolean> => {
        const request = bucket.pending;
        if (!request || !accepting(bucket.profileId) || running.current) return Promise.resolve(false);
        const startedAt = epoch.current; bucket.error = undefined; setError(undefined); setCanRetry(false);
        const publish = (updated: IslandRecord) => {
            if (updated.profileId !== bucket.profileId) return;
            bucket.latest = newest(bucket.latest, updated);
            if (!owner.current.mounted || owner.current.island?.profileId !== bucket.profileId) return;
            owner.current.island = newest(owner.current.island, bucket.latest);
            owner.current.onSaved(owner.current.island);
        };
        const promise = (async () => {
            let result: { island: IslandRecord } | { cause: unknown } | { deferred: true } | undefined;
            try {
                result = await run(async () => {
                    if (!accepting(bucket.profileId) || epoch.current !== startedAt) return { deferred: true as const };
                    try { return { island: await saveIslandRewardGoal(bucket.profileId, request.revision, request.action) }; }
                    catch (cause) { return { cause }; }
                });
            } catch (cause) { result = { cause }; }
            if (result && 'island' in result) {
                if (bucket.pending === request) bucket.pending = undefined;
                bucket.error = undefined; publish(result.island); sync(bucket);
                return accepting(bucket.profileId) && epoch.current === startedAt;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandRewardGoalConflict) {
                if (bucket.pending === request) bucket.pending = undefined;
                try { const latest = await db.islands.get(bucket.profileId); if (latest) publish(latest); }
                catch { /* A known rejection needs a new choice, even when refresh fails. */ }
            }
            bucket.error = errorMessage(cause); sync(bucket); return false;
        })().finally(() => {
            if (running.current === promise) running.current = undefined;
            if (owner.current.island) sync(buckets.current.get(owner.current.island.profileId));
        });
        running.current = promise; return promise;
    }, [accepting, run, sync]);
    const action = useCallback((value: IslandRewardGoalAction) => {
        if (!profileId || !accepting(profileId) || running.current) return Promise.resolve(false);
        const bucket = buckets.current.get(profileId); if (!bucket) return Promise.resolve(false);
        let canonical: IslandRewardGoalAction;
        try { canonical = canonicalIslandRewardGoalAction(value); }
        catch (cause) { bucket.error = errorMessage(cause); sync(bucket); return Promise.resolve(false); }
        if (bucket.pending && JSON.stringify(bucket.pending.action) !== JSON.stringify(canonical)) {
            bucket.error = 'さきに ほしいものの きろくを たしかめよう。'; sync(bucket); return Promise.resolve(false);
        }
        if (canonical.type === 'choose') Object.freeze(canonical.target);
        bucket.pending ??= Object.freeze({ revision: bucket.latest.revision, action: Object.freeze(canonical) });
        setPending(bucket.pending.action); return execute(bucket);
    }, [profileId, accepting, execute, sync]);
    const retry = useCallback(() => {
        const bucket = profileId ? buckets.current.get(profileId) : undefined;
        return bucket ? execute(bucket) : Promise.resolve(false);
    }, [profileId, execute]);
    return { action, pending, error, retry: canRetry ? retry : undefined };
}
