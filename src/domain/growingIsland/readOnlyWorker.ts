export type ReadOnlyWorkerReply<T> = { state: T } | { error: string };
const retryMessage = 'しまの よみこみが とまったよ。もういちど ためしてね。';

/** A bounded, cancellable calculation. A failure never falls back onto the UI thread. */
export function createReadOnlyWorkerRunner<Input, Output>(factory: () => Worker) {
    return (input: Input, signal?: AbortSignal) => new Promise<Output>((resolve, reject) => {
        let worker: Worker | undefined, settled = false;
        const finish = (reply: ReadOnlyWorkerReply<Output>) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer); signal?.removeEventListener('abort', abort); worker?.terminate();
            if ('error' in reply) reject(new Error(reply.error)); else resolve(reply.state);
        };
        const abort = () => finish({ error: retryMessage });
        const timer = setTimeout(abort, 120_000);
        if (signal?.aborted) { abort(); return; }
        signal?.addEventListener('abort', abort, { once: true });
        try {
            worker = factory();
            worker.onerror = event => { event.preventDefault(); abort(); };
            worker.onmessageerror = abort;
            worker.onmessage = (event: MessageEvent<ReadOnlyWorkerReply<Output>>) => finish(event.data);
            worker.postMessage(input);
        } catch { abort(); }
    });
}
