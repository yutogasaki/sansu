import type { LifeRecord, LifeState } from '../../../domain/islandLife/model';
import { updateLife, type LifeIntent, type TerminalFact } from '../../../domain/islandLife/repository';
import { cadenceReplayKey, rememberLifeState } from '../../../domain/islandLife/replayCache';

export interface LifeUpdateRequest { id: number; profileId: string; facts: TerminalFact[]; intent?: LifeIntent }
export type LifeUpdateResponse = { ready: true } | { id: number; record: LifeRecord; state: LifeState } | { id: number; error: string };

/** Never fall back after dispatch: a failed reply may follow a committed write. */
export function createLifeUpdateRunner(factory: () => Worker) {
    let worker: Worker | undefined, boot: Promise<boolean> | undefined, sequence = 0;
    const pending = new Map<number, { resolve: (record: LifeRecord) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    const start = () => boot ??= new Promise<boolean>(resolve => {
        let ready = false;
        const fail = () => {
            clearTimeout(timer); worker?.terminate(); worker = undefined; boot = undefined;
            for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Island worker interrupted')); }
            pending.clear();
            if (!ready) resolve(false);
        };
        const timer = setTimeout(fail, 5000);
        try {
            worker = factory();
            worker.onerror = fail;
            worker.onmessageerror = fail;
            worker.onmessage = (event: MessageEvent<LifeUpdateResponse>) => {
                const reply = event.data;
                if ('ready' in reply) { ready = true; clearTimeout(timer); resolve(true); return; }
                const request = pending.get(reply.id);
                if (!request) return;
                pending.delete(reply.id); clearTimeout(request.timer);
                if ('error' in reply) request.reject(new Error(reply.error));
                else {
                    // This is a state computed by our own worker from the committed log,
                    // not an unverified persisted snapshot. Avoid replaying it on the UI thread.
                    rememberLifeState(cadenceReplayKey(reply.record, reply.record.now), reply.state);
                    request.resolve(reply.record);
                }
            };
        } catch { fail(); }
    });
    return async (profileId: string, facts: TerminalFact[], intent?: LifeIntent) => {
        if (!await start() || !worker) return updateLife(profileId, facts, intent);
        const target = worker, id = ++sequence;
        return new Promise<LifeRecord>((resolve, reject) => {
            const timer = setTimeout(() => {
                // Terminate the stalled transaction; retries retain the original intent ID.
                target.dispatchEvent(new Event('error'));
            }, 120_000);
            pending.set(id, { resolve, reject, timer });
            try { target.postMessage({ id, profileId, facts, intent } satisfies LifeUpdateRequest); }
            catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
        });
    };
}
const offThread = createLifeUpdateRunner(() => new Worker(new URL('./lifeUpdate.worker.ts', import.meta.url), { type: 'module' }));
export function updateLifeResponsive(profileId: string, facts: TerminalFact[], intent?: LifeIntent) {
    return typeof Worker === 'undefined' ? updateLife(profileId, facts, intent) : offThread(profileId, facts, intent);
}
