import type { LifeRecord, LifeState } from '../islandLife/model';
import { replayLifeForMigration } from './lifeMigration';

export interface LifeMigrationRequest { record: LifeRecord; realNow: number }
export type LifeMigrationResponse = { state: LifeState } | { error: string };
const retryMessage = 'しまの ひきつぎが とまったよ。もういちど ためしてね。';

/** One read-only replay per worker. A failed worker never moves expensive work onto the UI. */
export function createLifeMigrationRunner(factory: () => Worker) {
    return (record: LifeRecord, realNow: number) => new Promise<LifeState>((resolve, reject) => {
        let worker: Worker | undefined;
        const finish = (reply: LifeMigrationResponse) => {
            clearTimeout(timer);
            worker?.terminate();
            if ('error' in reply) reject(new Error(reply.error));
            else resolve(reply.state);
        };
        const timer = setTimeout(() => finish({ error: retryMessage }), 120_000);
        try {
            worker = factory();
            worker.onerror = event => { event.preventDefault(); finish({ error: retryMessage }); };
            worker.onmessageerror = () => finish({ error: retryMessage });
            worker.onmessage = (event: MessageEvent<LifeMigrationResponse>) => finish(event.data);
            worker.postMessage({ record, realNow } satisfies LifeMigrationRequest);
        } catch { finish({ error: retryMessage }); }
    });
}

const offThread = createLifeMigrationRunner(() => new Worker(new URL('./lifeMigration.worker.ts', import.meta.url), { type: 'module' }));
export function replayLifeMigrationResponsive(record: LifeRecord, realNow: number) {
    return typeof Worker === 'undefined' ? replayLifeForMigration(record, realNow) : offThread(record, realNow);
}
