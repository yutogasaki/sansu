import { createReadOnlyWorkerRunner } from './readOnlyWorker';
import type { LifeRecord, LifeState } from '../islandLife/model';
import { replayLifeForMigration } from './lifeMigration';

export interface LifeMigrationRequest { record: LifeRecord; realNow: number }
export type LifeMigrationResponse = { state: LifeState } | { error: string };
/** One read-only replay per worker, bounded and cancelled with its opening. */
export function createLifeMigrationRunner(factory: () => Worker) {
    const run = createReadOnlyWorkerRunner<LifeMigrationRequest, LifeState>(factory);
    return (record: LifeRecord, realNow: number, signal?: AbortSignal) => run({ record, realNow }, signal);
}

const offThread = createLifeMigrationRunner(() => new Worker(new URL('./lifeMigration.worker.ts', import.meta.url), { type: 'module' }));
export function replayLifeMigrationResponsive(record: LifeRecord, realNow: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    return typeof Worker === 'undefined' ? replayLifeForMigration(record, realNow) : offThread(record, realNow, signal);
}
