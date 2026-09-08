import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { IslandConflict } from '../../domain/island/repository';
import { canonicalIslandSharedMemoriesAction, IslandSharedMemoriesConflict, type IslandSharedMemoriesAction } from '../../domain/island/sharedMemories';
import { saveIslandSharedMemories } from '../../domain/island/sharedMemoriesRepository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

interface Intent { profileId: string; revision: number; action: IslandSharedMemoriesAction }
function message(cause: unknown) {
    if (cause instanceof IslandSharedMemoriesConflict) return cause.message;
    if (cause instanceof IslandConflict) return 'しまの ようすが かわったよ。いまの ものから えらびなおそう。';
    return 'まだ のこせていないよ。もういちど のこそう。';
}

/** One deliberate operation at a time. An uncertain write retains its original
 * revision and canonical action even if a live query advances the island. */
export function useIslandSharedMemories(island: IslandRecord | undefined, active: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (island: IslandRecord, committedAction?: IslandSharedMemoriesAction) => void) {
    const [error, setError] = useState<string>();
    const [canRetry, setCanRetry] = useState(false);
    const owner = useRef({ island, active, onSaved, mounted: false });
    const pending = useRef<Intent | undefined>(undefined);
    const running = useRef<Promise<IslandRecord | undefined> | undefined>(undefined);
    const continuation = useRef(0);
    useLayoutEffect(() => {
        const previous = owner.current.island;
        if (owner.current.active && !active || previous?.profileId !== island?.profileId) continuation.current += 1;
        owner.current = { island: previous && island?.profileId === previous.profileId && previous.revision > island.revision
            ? previous : island, active, onSaved, mounted: true };
    }, [island, active, onSaved]);
    useLayoutEffect(() => {
        const stopContinuation = () => { if (document.hidden) continuation.current += 1; };
        document.addEventListener('visibilitychange', stopContinuation);
        return () => { owner.current.mounted = false; continuation.current += 1; document.removeEventListener('visibilitychange', stopContinuation); };
    }, []);
    const accepting = useCallback(() => owner.current.mounted && owner.current.active && !document.hidden, []);
    const execute = useCallback((intent: Intent): Promise<IslandRecord | undefined> => {
        if (running.current) return running.current;
        if (!accepting() || owner.current.island?.profileId !== intent.profileId) return Promise.resolve(undefined);
        setError(undefined); setCanRetry(false);
        const epoch = continuation.current;
        const owned = () => owner.current.mounted && owner.current.island?.profileId === intent.profileId;
        const publish = (updated: IslandRecord, committedAction?: IslandSharedMemoriesAction) => {
            const latest = owner.current.island;
            if (!latest || latest.revision <= updated.revision) owner.current.island = updated;
            owner.current.onSaved(owner.current.island!, committedAction);
        };
        const promise = (async () => {
            const result = await run(async () => {
                if (!accepting() || !owned()) return { deferred: true as const };
                try { return { island: await saveIslandSharedMemories(intent.profileId, intent.revision, intent.action) }; }
                catch (cause) { return { cause }; }
            });
            if (!owned()) return;
            if (result && 'island' in result && result.island) {
                publish(result.island, intent.action); pending.current = undefined;
                setError(undefined); setCanRetry(false);
                return accepting() && continuation.current === epoch ? owner.current.island : undefined;
            }
            const cause = result && 'cause' in result ? result.cause : undefined;
            if (cause instanceof IslandConflict || cause instanceof IslandSharedMemoriesConflict) {
                pending.current = undefined;
                try { const latest = await db.islands.get(intent.profileId); if (owned() && latest) publish(latest); }
                catch { /* Keep the known failed operation failed; do not rebase it. */ }
                if (owned()) { setError(message(cause)); setCanRetry(false); }
            } else {
                // A declined runner is also retried explicitly; no background
                // wake may turn a return to learning into a late shared write.
                setError(message(cause)); setCanRetry(true);
            }
        })().finally(() => { if (running.current === promise) running.current = undefined; });
        running.current = promise; return promise;
    }, [accepting, run]);
    const act = useCallback((action: IslandSharedMemoriesAction) => {
        const current = owner.current.island;
        if (!current || !accepting()) return Promise.resolve(undefined);
        let canonical: IslandSharedMemoriesAction;
        try { canonical = canonicalIslandSharedMemoriesAction(action); }
        catch (cause) { setError(message(cause)); return Promise.resolve(undefined); }
        if (pending.current && JSON.stringify(pending.current.action) !== JSON.stringify(canonical)) {
            setError('さきの そうさを のこしてから、つぎを ためそう。');
            setCanRetry(!running.current); return Promise.resolve(undefined);
        }
        const intent = pending.current ?? { profileId: current.profileId, revision: current.revision, action: canonical };
        pending.current = intent; return execute(intent);
    }, [accepting, execute]);
    const retry = useCallback(() => pending.current ? execute(pending.current) : Promise.resolve(undefined), [execute]);
    const capture = useCallback((action: IslandSharedMemoriesAction) => { void act(action); }, [act]);
    return { act, capture, error, retry: canRetry ? retry : undefined };
}
