import { afterEach, expect, it, vi } from 'vitest';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { createLifeUpdateRunner, type LifeUpdateResponse } from './lifeUpdateClient';
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../../domain/islandLife/repository', () => ({ updateLife: mocks.update }));
class FakeWorker extends EventTarget {
    onmessage?: (event: MessageEvent<LifeUpdateResponse>) => void;
    onerror?: () => void;
    onmessageerror?: () => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    reply(data: LifeUpdateResponse) { this.onmessage?.({ data } as MessageEvent<LifeUpdateResponse>); }
}
afterEach(() => { vi.useRealTimers(); mocks.update.mockReset(); });
it('dispatches only after readiness and returns the computed record', async () => {
    const worker = new FakeWorker(), runner = createLifeUpdateRunner(() => worker as unknown as Worker);
    const record = newLife('owner', 100), result = runner('owner', []);
    expect(worker.postMessage).not.toHaveBeenCalled();
    worker.reply({ ready: true }); await Promise.resolve();
    expect(worker.postMessage).toHaveBeenCalledOnce();
    const request = worker.postMessage.mock.calls[0][0];
    worker.reply({ id: request.id, record, state: replayLife(record) });
    expect(await result).toEqual(record); expect(mocks.update).not.toHaveBeenCalled();
});
it('uses the original implementation if a worker cannot boot, before sending any write', async () => {
    const record = newLife('owner', 100); mocks.update.mockResolvedValue(record);
    const runner = createLifeUpdateRunner(() => { throw new Error('unsupported'); });
    expect(await runner('owner', [])).toEqual(record); expect(mocks.update).toHaveBeenCalledOnce();
});
it('does not retry a possibly committed command after losing its reply', async () => {
    const worker = new FakeWorker(), runner = createLifeUpdateRunner(() => worker as unknown as Worker);
    const intent = { id: 'same-receipt', revision: 1, command: { type: 'store' as const, itemId: 'flower' } };
    const result = runner('owner', [], intent); worker.reply({ ready: true }); await Promise.resolve();
    const rejection = expect(result).rejects.toThrow('interrupted'); worker.onerror?.(); await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(mocks.update).not.toHaveBeenCalled();
    expect(worker.postMessage.mock.calls[0][0].intent).toEqual(intent);
});
it('preserves a domain rejection without automatic fallback or duplicate writes', async () => {
    const worker = new FakeWorker(), runner = createLifeUpdateRunner(() => worker as unknown as Worker);
    const result = runner('owner', []); worker.reply({ ready: true }); await Promise.resolve();
    const rejection = expect(result).rejects.toThrow('しまが かわったよ。');
    worker.reply({ id: worker.postMessage.mock.calls[0][0].id, error: 'しまが かわったよ。' });
    await rejection; expect(mocks.update).not.toHaveBeenCalled();
});
it('bounds a boot that never acknowledges readiness without sending a write', async () => {
    vi.useFakeTimers(); const worker = new FakeWorker(); mocks.update.mockResolvedValue(newLife('owner', 100));
    const result = createLifeUpdateRunner(() => worker as unknown as Worker)('owner', []);
    await vi.advanceTimersByTimeAsync(5000); await result;
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.postMessage).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledOnce();
});
