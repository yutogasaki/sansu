import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { canonicalIslandLearningKeepsakeAction, IslandLearningKeepsakeConflict, ISLAND_LEARNING_KEEPSAKES, type IslandLearningKeepsakeAction, type IslandLearningKeepsakeId } from '../../domain/island/learningKeepsakes';
import { saveIslandLearningKeepsakes, readIslandLearningKeepsakeSummary } from '../../domain/island/learningKeepsakesRepository';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

interface Request { revision: number; action: IslandLearningKeepsakeAction }
interface Bucket { profileId: string; latest: IslandRecord; pending?: Request; error?: string }
const newest = (a: IslandRecord, b: IslandRecord) => b.revision > a.revision ? b : a;
function errorMessage(cause: unknown) {
    if (cause instanceof IslandLearningKeepsakeConflict || cause instanceof IslandConflict) return 'しまの ようすが かわったよ。かざるものを えらびなおそう。';
    return 'たなに のこした きろくを たしかめよう。おなじ そうさで もういちど ためせるよ。';
}

/** Reading a keepsake changes only the panel selection. Display writes keep
 * their original receipt until its outcome is known, even after leaving. */
export function useIslandLearningKeepsakes(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (updated: IslandRecord) => void) {
    const [pending, setPending] = useState<IslandLearningKeepsakeAction>();
    const [error, setError] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const owner = useRef({ island, active, mounted: false, onSaved });
    const buckets = useRef(new Map<string, Bucket>());
    const running = useRef<Promise<boolean> | undefined>(undefined), epoch = useRef(0);
    const profileId = island?.profileId;
    const accepting = useCallback((id: string) => owner.current.mounted && Boolean(owner.current.active)
        && owner.current.island?.profileId === id && !document.hidden, []);
    const sync = useCallback((bucket?: Bucket) => {
        if (!owner.current.mounted || bucket && owner.current.island?.profileId !== bucket.profileId) return;
        setPending(bucket?.pending?.action); setError(bucket?.error); setCanRetry(Boolean(bucket?.pending) && !running.current);
    }, []);
    useLayoutEffect(() => {
        if (owner.current.island?.profileId !== profileId || owner.current.active !== active) epoch.current += 1;
        let bucket = profileId ? buckets.current.get(profileId) : undefined;
        if (island) {
            if (!bucket) { bucket = { profileId: island.profileId, latest: island }; buckets.current.set(island.profileId, bucket); }
            else bucket.latest = newest(bucket.latest, island);
        }
        owner.current = { island: bucket?.latest, active, mounted: true, onSaved }; sync(bucket);
    }, [profileId, island, active, onSaved, sync]);
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
                    try { return { island: await saveIslandLearningKeepsakes(bucket.profileId, request.revision, request.action) }; }
                    catch (cause) { return { cause }; }
                });
            } catch (cause) { result = { cause }; }
            if (result && 'island' in result) {
                if (bucket.pending === request) bucket.pending = undefined;
                bucket.error = undefined; publish(result.island); sync(bucket);
                return accepting(bucket.profileId) && epoch.current === startedAt;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandLearningKeepsakeConflict) {
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
    const act = useCallback((value: IslandLearningKeepsakeAction) => {
        if (!profileId || !accepting(profileId) || running.current) return Promise.resolve(false);
        const bucket = buckets.current.get(profileId); if (!bucket) return Promise.resolve(false);
        let canonical: IslandLearningKeepsakeAction;
        try { canonical = canonicalIslandLearningKeepsakeAction(value); }
        catch (cause) { bucket.error = errorMessage(cause); sync(bucket); return Promise.resolve(false); }
        if (bucket.pending && JSON.stringify(bucket.pending.action) !== JSON.stringify(canonical)) {
            bucket.error = 'さきに たなに のこした きろくを たしかめよう。'; sync(bucket); return Promise.resolve(false);
        }
        bucket.pending ??= Object.freeze({ revision: bucket.latest.revision, action: Object.freeze(canonical) });
        setPending(bucket.pending.action); return execute(bucket);
    }, [profileId, accepting, execute, sync]);
    const retry = useCallback(() => {
        const bucket = profileId ? buckets.current.get(profileId) : undefined;
        return bucket ? execute(bucket) : Promise.resolve(false);
    }, [profileId, execute]);
    const [selection, setSelection] = useState<{ profileId: string; id: IslandLearningKeepsakeId }>();
    const [readNonce, setReadNonce] = useState(0);
    const selectedId = selection && selection.profileId === profileId ? selection.id : 'first-completion';
    const select = useCallback((id: IslandLearningKeepsakeId) => {
        if (!profileId || !accepting(profileId) || buckets.current.get(profileId)?.pending
            || !ISLAND_LEARNING_KEEPSAKES.some(item => item.id === id)) return;
        setSelection({ profileId, id });
    }, [accepting, profileId]);
    const completedSets = island?.completedSets;
    const record = useLiveQuery(async () => {
        if (!profileId || !active) return undefined;
        const key = { profileId, id: selectedId, completedSets };
        try { return { ...key, summary: await readIslandLearningKeepsakeSummary(profileId, selectedId), error: undefined }; }
        catch { return { ...key, summary: undefined, error: 'まなんだ きろくを ひらけなかったよ。' }; }
    }, [profileId, selectedId, completedSets, active, readNonce]);
    const currentRecord = active && record?.profileId === profileId && record?.id === selectedId
        && record?.completedSets === completedSets ? record : undefined;
    const summary = currentRecord?.summary?.completedSets === completedSets ? currentRecord?.summary : undefined;
    const retryRead = useCallback(() => { if (profileId && accepting(profileId)) setReadNonce(value => value + 1); }, [profileId, accepting]);
    return { act, pending, error, retry: canRetry ? retry : undefined, selectedId, select,
        summary, reading: Boolean(active && profileId && !summary && !currentRecord?.error), readError: currentRecord?.error, retryRead };
}
