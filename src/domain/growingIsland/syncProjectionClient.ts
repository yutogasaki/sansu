import { createReadOnlyWorkerRunner } from './readOnlyWorker';
import { projectGrowingSync, type SyncProjection, type SyncProjectionRequest } from './syncProjection';

const offThread = createReadOnlyWorkerRunner<SyncProjectionRequest, SyncProjection>(() =>
    new Worker(new URL('./syncProjection.worker.ts', import.meta.url), { type: 'module' }));

export function projectGrowingSyncResponsive(request: SyncProjectionRequest, signal?: AbortSignal) {
    signal?.throwIfAborted();
    return typeof Worker === 'undefined' ? Promise.resolve(projectGrowingSync(request)) : offThread(request, signal);
}
