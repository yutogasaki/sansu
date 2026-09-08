import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { canonicalIslandExperienceAction, IslandExperienceConflict, previewIslandLayout, type IslandExperienceAction, type IslandLayoutId } from '../../domain/island/experience';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';
import { executeIslandExperienceRequest, IslandExperiencePendingConflict, type IslandExperienceRequest } from './islandExperienceRequest';

function experienceError(error: unknown) {
    if (error instanceof IslandExperienceConflict || error instanceof IslandExperiencePendingConflict) return error.message;
    if (error instanceof IslandConflict) return 'しまの ようすが かわったよ。いまの ものから えらびなおそう。';
    return 'きろくを たしかめよう。おなじ そうさで もういちど ためせるよ。';
}
interface ProfileRequest {
    profileId: string;
    pending: { current: IslandExperienceRequest | undefined };
    latest?: IslandRecord;
    error?: string;
}
const newest = (a: IslandRecord | undefined, b: IslandRecord | undefined) => !a || b && (a.profileId !== b.profileId || b.revision > a.revision) ? b : a;

/** Explicit recovery keeps the original receipt while presentation can be freely
 * cancelled. A completed write may publish data after exit, never continue its UI. */
export function useIslandExperience(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (island: IslandRecord) => void) {
    const [previewLayoutId, setPreviewLayoutId] = useState<IslandLayoutId>();
    const [error, setError] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const [published, setPublished] = useState<IslandRecord>();
    const owner = useRef({ island, active, onSaved, mounted: false });
    // Profile changes must neither apply A's old intent to B nor silently discard it.
    // These small in-memory buckets disappear with this page; no learning store is added.
    const requests = useRef(new Map<string, ProfileRequest>());
    const running = useRef<{ bucket: ProfileRequest; promise: Promise<boolean> } | undefined>(undefined);
    const continuation = useRef(0);
    const profileId = island?.profileId;
    const accepting = useCallback((id: string) => owner.current.mounted && owner.current.active
        && owner.current.island?.profileId === id && !document.hidden, []);
    const syncStatus = useCallback((bucket: ProfileRequest) => {
        if (!owner.current.mounted || owner.current.island?.profileId !== bucket.profileId) return;
        setError(bucket.error); setCanRetry(Boolean(bucket.pending.current) && !running.current);
    }, []);
    useLayoutEffect(() => {
        const previous = owner.current.island;
        const changedProfile = previous?.profileId !== island?.profileId;
        if (changedProfile || owner.current.active && !active) {
            continuation.current += 1;
            setPreviewLayoutId(undefined);
        }
        let bucket = island ? requests.current.get(island.profileId) : undefined;
        if (island && !bucket) {
            bucket = { profileId: island.profileId, pending: { current: undefined } };
            requests.current.set(island.profileId, bucket);
        }
        if (bucket) bucket.latest = newest(bucket.latest, island);
        owner.current = { island: bucket?.latest, active, onSaved, mounted: true };
        setPublished(bucket?.latest);
        if (bucket) syncStatus(bucket); else { setError(undefined); setCanRetry(false); }
    }, [island, active, onSaved, syncStatus]);
    useLayoutEffect(() => {
        const hidden = () => {
            if (!document.hidden) return;
            continuation.current += 1;
            setPreviewLayoutId(undefined);
        };
        document.addEventListener('visibilitychange', hidden);
        return () => {
            owner.current.mounted = false; continuation.current += 1;
            document.removeEventListener('visibilitychange', hidden);
        };
    }, []);
    const reset = useCallback(() => {
        if (!owner.current.mounted || owner.current.island?.profileId !== profileId) return;
        continuation.current += 1;
        setPreviewLayoutId(undefined);
        const bucket = profileId ? requests.current.get(profileId) : undefined;
        if (bucket) {
            if (!bucket.pending.current) bucket.error = undefined;
            syncStatus(bucket);
        }
    }, [profileId, syncStatus]);
    const preview = useCallback((layoutId: IslandLayoutId | undefined) => {
        if (!profileId || !accepting(profileId)) return;
        setPreviewLayoutId(layoutId);
        const bucket = requests.current.get(profileId);
        if (bucket && !bucket.pending.current) { bucket.error = undefined; syncStatus(bucket); }
    }, [accepting, profileId, syncStatus]);
    const execute = useCallback((bucket: ProfileRequest): Promise<boolean> => {
        const request = bucket.pending.current;
        if (!request || !accepting(bucket.profileId)) return Promise.resolve(false);
        if (running.current) return running.current.bucket === bucket ? running.current.promise : Promise.resolve(false);
        const epoch = continuation.current;
        bucket.error = undefined; setError(undefined); setCanRetry(false);
        const owned = () => owner.current.mounted && owner.current.island?.profileId === bucket.profileId;
        const publish = (updated: IslandRecord) => {
            if (updated.profileId !== bucket.profileId) return;
            bucket.latest = newest(bucket.latest, updated);
            if (!owned()) return;
            owner.current.island = newest(owner.current.island, bucket.latest);
            setPublished(owner.current.island);
            owner.current.onSaved(owner.current.island!);
        };
        const promise = (async () => {
            let result: { island: IslandRecord } | { cause: unknown } | { deferred: true } | undefined;
            try {
                result = await run(async () => {
                    if (!accepting(bucket.profileId) || continuation.current !== epoch) return { deferred: true as const };
                    try {
                        // Keep the outer intent until the shared runner delivers
                        // completion too; its own delivery can also be lost.
                        return { island: await executeIslandExperienceRequest({ current: request }, request.revision, request.action,
                            intent => saveIslandExperience(bucket.profileId, intent.revision, intent.action)) };
                    } catch (cause) { return { cause }; }
                });
            } catch (cause) { result = { cause }; }
            if (result && 'island' in result) {
                if (bucket.pending.current === request) bucket.pending.current = undefined;
                publish(result.island); bucket.error = undefined;
                if (owned()) syncStatus(bucket);
                const allowed = accepting(bucket.profileId) && continuation.current === epoch;
                if (allowed && (request.action.type === 'apply-layout' || request.action.type === 'delete-layout')) setPreviewLayoutId(undefined);
                return allowed;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandExperienceConflict) {
                if (bucket.pending.current === request) bucket.pending.current = undefined;
                // The helper already released this known-failed intent. Refresh
                // data without re-running or rebasing the old scene capture.
                try { const latest = await db.islands.get(bucket.profileId); if (latest) publish(latest); }
                catch { /* A failed read cannot turn the known failed write into a retry. */ }
            }
            bucket.error = experienceError(cause);
            if (owned()) syncStatus(bucket);
            return false;
        })().finally(() => {
            if (running.current?.promise === promise) running.current = undefined;
            if (owner.current.mounted && owner.current.island) {
                const current = requests.current.get(owner.current.island.profileId);
                if (current) syncStatus(current);
            }
        });
        running.current = { bucket, promise };
        return promise;
    }, [accepting, run, syncStatus]);
    const act = useCallback((action: IslandExperienceAction): Promise<boolean> => {
        if (!profileId || !accepting(profileId)) return Promise.resolve(false);
        const bucket = requests.current.get(profileId), current = owner.current.island;
        if (!bucket || !current) return Promise.resolve(false);
        let canonical: IslandExperienceAction;
        try { canonical = canonicalIslandExperienceAction(action); }
        catch (cause) { bucket.error = experienceError(cause); syncStatus(bucket); return Promise.resolve(false); }
        if (bucket.pending.current && JSON.stringify(bucket.pending.current.action) !== JSON.stringify(canonical)) {
            bucket.error = experienceError(new IslandExperiencePendingConflict()); syncStatus(bucket); return Promise.resolve(false);
        }
        if (running.current && running.current.bucket !== bucket) return Promise.resolve(false);
        bucket.pending.current ??= Object.freeze({ revision: current.revision, action: Object.freeze({ ...canonical }) });
        return execute(bucket);
    }, [accepting, execute, profileId, syncStatus]);
    const retry = useCallback((): Promise<boolean> => {
        if (!profileId || !accepting(profileId)) return Promise.resolve(false);
        const bucket = requests.current.get(profileId);
        return bucket ? execute(bucket) : Promise.resolve(false);
    }, [accepting, execute, profileId]);
    const visibleIsland = newest(island, published?.profileId === profileId ? published : undefined);
    let previewIsland: IslandRecord | undefined, previewError: string | undefined;
    if (active && visibleIsland && previewLayoutId) {
        try { previewIsland = previewIslandLayout(visibleIsland, previewLayoutId); }
        catch (cause) { previewError = experienceError(cause); }
    }
    return { act, error: error ?? previewError, previewLayoutId, previewIsland, preview, reset, retry: canRetry ? retry : undefined };
}
