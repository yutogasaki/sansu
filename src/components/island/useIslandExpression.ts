import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { canonicalIslandExpressionAction, IslandExpressionConflict, previewIslandExpression,
    type IslandExpressionAction, type IslandExpressionEquipAction } from '../../domain/island/expression';
import { saveIslandExpression } from '../../domain/island/expressionRepository';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

interface Request { revision: number; action: IslandExpressionAction }
interface Owner { profileId: string; latest: IslandRecord; pending?: Request; error?: string }
const newest = (a: IslandRecord, b: IslandRecord) => b.revision > a.revision ? b : a;
function errorMessage(error: unknown) {
    if (error instanceof IslandExpressionConflict) {
        if (error.code === 'insufficient-stars') return 'ほしが もうすこし いるよ。';
        if (error.code === 'not-eligible') return 'みつけた しるしを たしかめよう。';
        if (error.code === 'already-owned') return 'もう もっているよ。つかう ものを えらぼう。';
        if (error.code === 'not-owned') return 'もらってから つかえるよ。おためしは むりょう。';
    }
    if (error instanceof IslandExpressionConflict || error instanceof IslandConflict) return 'しまの ようすが かわったよ。いまの ものから えらびなおそう。';
    return 'きろくを たしかめよう。おなじ そうさで もういちど ためせるよ。';
}

/** A preview is never a writable island. Acquisition and equipping retain
 * separate exact receipts, while leaving cancels only presentation. */
export function useIslandExpression(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (updated: IslandRecord) => void) {
    const [previewAction, setPreviewAction] = useState<IslandExpressionEquipAction>();
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState<IslandExpressionAction>();
    const [canRetry, setCanRetry] = useState(false);
    const [published, setPublished] = useState<IslandRecord>();
    const owner = useRef({ island, active, mounted: false, onSaved });
    const buckets = useRef(new Map<string, Owner>());
    const running = useRef<{ bucket: Owner; promise: Promise<boolean> } | undefined>(undefined);
    const epoch = useRef(0), profileId = island?.profileId;
    const accepting = useCallback((id: string) => owner.current.mounted && owner.current.active
        && owner.current.island?.profileId === id && !document.hidden, []);
    const sync = useCallback((bucket?: Owner) => {
        if (!owner.current.mounted || bucket && owner.current.island?.profileId !== bucket.profileId) return;
        setError(bucket?.error); setPending(bucket?.pending?.action);
        setCanRetry(Boolean(bucket?.pending) && !running.current);
    }, []);
    useLayoutEffect(() => {
        if (owner.current.island?.profileId !== profileId || owner.current.active && !active) {
            epoch.current += 1; setPreviewAction(undefined);
        }
        let bucket = profileId ? buckets.current.get(profileId) : undefined;
        if (island) {
            if (!bucket) { bucket = { profileId: island.profileId, latest: island }; buckets.current.set(island.profileId, bucket); }
            else bucket.latest = newest(bucket.latest, island);
        }
        owner.current = { island: bucket?.latest, active, mounted: true, onSaved };
        setPublished(bucket?.latest); sync(bucket);
    }, [profileId, island, active, onSaved, sync]);
    useLayoutEffect(() => {
        const hidden = () => { if (document.hidden) { epoch.current += 1; setPreviewAction(undefined); } };
        document.addEventListener('visibilitychange', hidden);
        return () => { owner.current.mounted = false; epoch.current += 1; document.removeEventListener('visibilitychange', hidden); };
    }, []);
    const reset = useCallback(() => {
        epoch.current += 1; setPreviewAction(undefined);
        const bucket = profileId ? buckets.current.get(profileId) : undefined;
        if (bucket && !bucket.pending) bucket.error = undefined;
        sync(bucket);
    }, [profileId, sync]);
    const preview = useCallback((action: IslandExpressionEquipAction | undefined) => {
        if (!profileId || !accepting(profileId) || !owner.current.island) return;
        try {
            const checked = action ? previewIslandExpression(owner.current.island, action) : undefined;
            setPreviewAction(checked?.action);
        } catch (cause) { setError(errorMessage(cause)); }
    }, [profileId, accepting]);
    const execute = useCallback((bucket: Owner): Promise<boolean> => {
        const request = bucket.pending;
        if (!request || !accepting(bucket.profileId) || running.current) return Promise.resolve(false);
        const startedAt = epoch.current;
        bucket.error = undefined; setError(undefined); setCanRetry(false);
        const publish = (updated: IslandRecord) => {
            if (updated.profileId !== bucket.profileId) return;
            bucket.latest = newest(bucket.latest, updated);
            if (!owner.current.mounted || owner.current.island?.profileId !== bucket.profileId) return;
            owner.current.island = newest(owner.current.island, bucket.latest);
            setPublished(owner.current.island); owner.current.onSaved(owner.current.island);
        };
        const promise = (async () => {
            let result: { island: IslandRecord } | { cause: unknown } | { deferred: true } | undefined;
            try {
                result = await run(async () => {
                    if (!accepting(bucket.profileId) || epoch.current !== startedAt) return { deferred: true as const };
                    try { return { island: await saveIslandExpression(bucket.profileId, request.revision, request.action) }; }
                    catch (cause) { return { cause }; }
                });
            } catch (cause) { result = { cause }; }
            if (result && 'island' in result) {
                if (bucket.pending === request) bucket.pending = undefined;
                publish(result.island); bucket.error = undefined; sync(bucket);
                const allowed = accepting(bucket.profileId) && epoch.current === startedAt;
                if (allowed && request.action.type !== 'acquire') setPreviewAction(undefined);
                return allowed;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandExpressionConflict) {
                if (bucket.pending === request) bucket.pending = undefined;
                // A rejected old revision retires that preview as well. Keeping
                // it would silently rebase the displayed choice onto the refresh.
                if (cause instanceof IslandConflict && accepting(bucket.profileId) && epoch.current === startedAt) setPreviewAction(undefined);
                try { const latest = await db.islands.get(bucket.profileId); if (latest) publish(latest); }
                catch { /* A known failed intent stays released when refresh fails. */ }
            }
            bucket.error = errorMessage(cause); sync(bucket); return false;
        })().finally(() => {
            if (running.current?.promise === promise) running.current = undefined;
            if (owner.current.island) sync(buckets.current.get(owner.current.island.profileId));
        });
        running.current = { bucket, promise }; return promise;
    }, [accepting, run, sync]);
    const action = useCallback((value: IslandExpressionAction) => {
        if (!profileId || !accepting(profileId)) return Promise.resolve(false);
        const bucket = buckets.current.get(profileId);
        if (!bucket || running.current) return Promise.resolve(false);
        let canonical: IslandExpressionAction;
        try { canonical = canonicalIslandExpressionAction(value); }
        catch (cause) { bucket.error = errorMessage(cause); sync(bucket); return Promise.resolve(false); }
        if (bucket.pending && JSON.stringify(bucket.pending.action) !== JSON.stringify(canonical)) {
            bucket.error = 'さきに きろくを たしかめよう。'; sync(bucket); return Promise.resolve(false);
        }
        bucket.pending ??= Object.freeze({ revision: bucket.latest.revision, action: Object.freeze(canonical) });
        setPending(bucket.pending.action); return execute(bucket);
    }, [profileId, accepting, execute, sync]);
    const retry = useCallback(() => {
        const bucket = profileId ? buckets.current.get(profileId) : undefined;
        return bucket ? execute(bucket) : Promise.resolve(false);
    }, [profileId, execute]);
    const current = published && published.profileId === profileId && island ? newest(island, published) : island;
    let previewState: ReturnType<typeof previewIslandExpression> | undefined;
    if (active && current && previewAction) {
        try { previewState = previewIslandExpression(current, previewAction); }
        catch { /* A changed profile or invalid source cannot produce a preview. */ }
    }
    return { action, preview, previewAction, previewState, reset, error, pending, retry: canRetry ? retry : undefined };
}
