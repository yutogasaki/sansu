import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { canonicalIslandFurnitureAction, IslandFurnitureConflict, type IslandFurnitureAction, type IslandOptionalFurnitureKind } from '../../domain/island/furniture';
import { acquireIslandFurniture } from '../../domain/island/furnitureRepository';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

interface FurnitureRequest { revision: number; action: IslandFurnitureAction }
interface FurnitureOwner { profileId: string; latest: IslandRecord; request?: FurnitureRequest; error?: string }
const newest = (a: IslandRecord, b: IslandRecord) => b.revision > a.revision ? b : a;
function message(cause: unknown) {
    if (cause instanceof IslandFurnitureConflict && cause.code === 'insufficient') return 'ほしが もうすこし いるよ。';
    if (cause instanceof IslandConflict || cause instanceof IslandFurnitureConflict) return 'しまの ようすが かわったよ。いまの ものから えらびなおそう。';
    return 'むかえた どうぐを たしかめよう。おなじ そうさで もういちど ためせるよ。';
}

/** Purchases own their immutable receipt; leaving the shop cancels only the
 * presentation that could follow the write. It never cancels earned ownership. */
export function useIslandFurniture(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (updated: IslandRecord) => void) {
    const [error, setError] = useState<string>();
    const [pendingKind, setPendingKind] = useState<IslandOptionalFurnitureKind>();
    const [retryable, setRetryable] = useState(false);
    const owner = useRef({ island, active, mounted: false, onSaved });
    const buckets = useRef(new Map<string, FurnitureOwner>());
    const running = useRef<{ bucket: FurnitureOwner; promise: Promise<IslandRecord | undefined> } | undefined>(undefined);
    const epoch = useRef(0);
    const profileId = island?.profileId;
    const accepting = useCallback((id: string) => owner.current.mounted && owner.current.active
        && owner.current.island?.profileId === id && !document.hidden, []);
    const sync = useCallback((bucket?: FurnitureOwner) => {
        if (!owner.current.mounted || bucket && owner.current.island?.profileId !== bucket.profileId) return;
        setError(bucket?.error); setPendingKind(bucket?.request?.action.kind);
        setRetryable(Boolean(bucket?.request) && !running.current);
    }, []);
    useLayoutEffect(() => {
        if (owner.current.island?.profileId !== profileId || owner.current.active && !active) epoch.current += 1;
        let bucket = profileId ? buckets.current.get(profileId) : undefined;
        if (island) {
            if (!bucket) { bucket = { profileId: island.profileId, latest: island }; buckets.current.set(island.profileId, bucket); }
            else bucket.latest = newest(bucket.latest, island);
        }
        owner.current = { island: bucket?.latest, active, mounted: true, onSaved };
        sync(bucket);
    }, [profileId, island, active, onSaved, sync]);
    useLayoutEffect(() => {
        const hidden = () => { if (document.hidden) epoch.current += 1; };
        document.addEventListener('visibilitychange', hidden);
        return () => { owner.current.mounted = false; epoch.current += 1; document.removeEventListener('visibilitychange', hidden); };
    }, []);
    const reset = useCallback(() => {
        if (!profileId || owner.current.island?.profileId !== profileId) return;
        epoch.current += 1;
        const bucket = buckets.current.get(profileId);
        if (bucket && !bucket.request) bucket.error = undefined;
        sync(bucket);
    }, [profileId, sync]);
    const execute = useCallback((bucket: FurnitureOwner): Promise<IslandRecord | undefined> => {
        const request = bucket.request;
        if (!request || !accepting(bucket.profileId) || running.current) return Promise.resolve(undefined);
        const startedAt = epoch.current;
        bucket.error = undefined; setError(undefined); setRetryable(false);
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
                    try { return { island: await acquireIslandFurniture(bucket.profileId, request.revision, request.action) }; }
                    catch (cause) { return { cause }; }
                });
            } catch (cause) { result = { cause }; }
            if (result && 'island' in result) {
                if (bucket.request === request) bucket.request = undefined;
                publish(result.island); bucket.error = undefined; sync(bucket);
                return accepting(bucket.profileId) && epoch.current === startedAt ? bucket.latest : undefined;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandFurnitureConflict) {
                if (bucket.request === request) bucket.request = undefined;
                try { const latest = await db.islands.get(bucket.profileId); if (latest) publish(latest); }
                catch { /* Known failed intent remains released even if refresh is unavailable. */ }
            }
            bucket.error = message(cause); sync(bucket);
            return undefined;
        })().finally(() => {
            if (running.current?.promise === promise) running.current = undefined;
            if (owner.current.island) sync(buckets.current.get(owner.current.island.profileId));
        });
        running.current = { bucket, promise };
        return promise;
    }, [accepting, run, sync]);
    const purchase = useCallback((kind: IslandOptionalFurnitureKind) => {
        if (!profileId || !accepting(profileId)) return Promise.resolve(undefined);
        const bucket = buckets.current.get(profileId);
        if (!bucket) return Promise.resolve(undefined);
        let action: IslandFurnitureAction;
        try { action = canonicalIslandFurnitureAction({ type: 'acquire-furniture', kind }); }
        catch (cause) { bucket.error = message(cause); sync(bucket); return Promise.resolve(undefined); }
        if (bucket.request && bucket.request.action.kind !== kind) {
            bucket.error = 'さきに むかえた どうぐを たしかめよう。'; sync(bucket); return Promise.resolve(undefined);
        }
        if (running.current) return Promise.resolve(undefined);
        bucket.request ??= Object.freeze({ revision: bucket.latest.revision, action: Object.freeze(action) });
        setPendingKind(bucket.request.action.kind);
        return execute(bucket);
    }, [profileId, accepting, execute, sync]);
    const retry = useCallback(() => {
        const bucket = profileId ? buckets.current.get(profileId) : undefined;
        return bucket ? execute(bucket) : Promise.resolve(undefined);
    }, [profileId, execute]);
    return { purchase, error, pendingKind, reset, retry: retryable ? retry : undefined };
}
