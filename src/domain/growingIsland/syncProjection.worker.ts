import { projectGrowingSync, type SyncProjectionRequest } from './syncProjection';
import type { ReadOnlyWorkerReply } from './readOnlyWorker';
import type { SyncProjection } from './syncProjection';

self.onmessage = (event: MessageEvent<SyncProjectionRequest>) => {
    try { self.postMessage({ state: projectGrowingSync(event.data) } satisfies ReadOnlyWorkerReply<SyncProjection>); }
    catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : 'Island calculation failed' } satisfies ReadOnlyWorkerReply<SyncProjection>);
    }
};
