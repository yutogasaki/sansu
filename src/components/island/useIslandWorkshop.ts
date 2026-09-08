import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { db } from '../../db';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import { IslandWorkshopConflict, type IslandWorkshopAction } from '../../domain/island/workshop';
import { WorkshopLayoutConflict } from '../../domain/island/workshopLayout';
import { saveIslandWorkshop } from '../../domain/island/workshopRepository';
import { createIslandWorkshopQueue, type IslandWorkshopQueueStatus } from './islandWorkshopQueue';
import type { useIslandActions } from './useIslandActions';

function errorMessage(cause: unknown) {
    if (cause === undefined) return undefined;
    if (cause instanceof IslandWorkshopConflict || cause instanceof WorkshopLayoutConflict) return cause.message;
    if (cause instanceof IslandConflict) return 'いまの きろくに なったよ。もういちど ためそう。';
    return 'まだ のこせなかったよ。もういちど のこそう。';
}

/** The scene and panel share one FIFO and the ordinary island writer lock.
 * A committed profile/screen change gates callbacks before any next write. */
export function useIslandWorkshop(island: IslandRecord | undefined, active: boolean, busy: boolean,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (island: IslandRecord) => void) {
    const [status, setStatus] = useState<IslandWorkshopQueueStatus>({ retry: false });
    const queue = useRef<ReturnType<typeof createIslandWorkshopQueue> | undefined>(undefined);
    const current = useRef({ island, active, busy, onSaved });
    const profileId = island?.profileId;
    useLayoutEffect(() => {
        const previous = current.current.island;
        current.current = { island: previous && island?.profileId === previous.profileId && previous.revision > island.revision
            ? previous : island, active, busy, onSaved };
        queue.current?.wake();
    }, [island, active, busy, onSaved]);
    useLayoutEffect(() => {
        if (!profileId) return;
        const owner = createIslandWorkshopQueue({
            profileId,
            context: () => ({ ...current.current, visible: !document.hidden }),
            run,
            write: (id, request) => saveIslandWorkshop(id, request.revision, request.action),
            refresh: id => db.islands.get(id),
            onSaved: updated => { current.current.island = updated; current.current.onSaved(updated); },
            onStatus: setStatus,
        });
        queue.current = owner; setStatus({ retry: false });
        document.addEventListener('visibilitychange', owner.wake);
        return () => {
            owner.dispose();
            if (queue.current === owner) queue.current = undefined;
            document.removeEventListener('visibilitychange', owner.wake);
        };
    }, [profileId, run]);

    const act = useCallback((action: IslandWorkshopAction) => queue.current?.enqueue(action) ?? Promise.resolve(false), []);
    const capture = useCallback((action: IslandWorkshopAction) => { void queue.current?.enqueue(action); }, []);
    const retry = useCallback(() => queue.current?.retry() ?? Promise.resolve(false), []);
    return { act, capture, error: errorMessage(status.cause), retry: status.retry ? retry : undefined };
}
