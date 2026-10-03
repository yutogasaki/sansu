import { afterEach, expect, it, vi } from 'vitest';
import { newLife, type LifeState } from '../islandLife/model';
import { createLifeMigrationRunner, type LifeMigrationResponse } from './lifeMigrationClient';

const mocks = vi.hoisted(() => ({ replay: vi.fn() }));
vi.mock('./lifeMigration', () => ({ replayLifeForMigration: mocks.replay }));
class FakeWorker {
    onmessage?: (event: MessageEvent<LifeMigrationResponse>) => void;
    onerror?: (event: ErrorEvent) => void;
    onmessageerror?: () => void;
    postMessage = vi.fn();
    terminate = vi.fn();
    reply(data: LifeMigrationResponse) { this.onmessage?.({ data } as MessageEvent<LifeMigrationResponse>); }
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
it('dispatches a read-only record and clock, then terminates the completed worker', async () => {
    const worker = new FakeWorker(), record = newLife('kid', 1000), state = { now: 2000 } as LifeState;
    const result = createLifeMigrationRunner(() => worker as unknown as Worker)(record, 2000);
    expect(worker.postMessage).toHaveBeenCalledWith({ record, realNow: 2000 });
    worker.reply({ state }); expect(await result).toBe(state);
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(mocks.replay).not.toHaveBeenCalled();
});
it.each(['error', 'messageerror', 'timeout', 'postMessage'] as const)('ends a stalled %s and permits a fresh retry without main-thread replay', async failure => {
    vi.useFakeTimers();
    const first = new FakeWorker(), retry = new FakeWorker();
    if (failure === 'postMessage') first.postMessage.mockImplementation(() => { throw new Error('clone failed'); });
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(retry);
    const runner = createLifeMigrationRunner(factory), record = newLife('kid', 1000);
    const result = runner(record, 2000), rejected = expect(result).rejects.toThrow('もういちど');
    if (failure === 'error') first.onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent);
    if (failure === 'messageerror') first.onmessageerror?.();
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(120_000);
    await rejected; expect(first.terminate).toHaveBeenCalledOnce(); expect(mocks.replay).not.toHaveBeenCalled();
    const next = runner(record, 2000), state = { now: 2000 } as LifeState;
    retry.reply({ state }); expect(await next).toBe(state);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
});
it('returns an invalid-save error without falling back or leaving a worker running', async () => {
    const worker = new FakeWorker(), result = createLifeMigrationRunner(() => worker as unknown as Worker)(newLife('kid', 1000), 2000);
    const rejected = expect(result).rejects.toThrow('新しい版');
    worker.reply({ error: 'この島のデータは新しい版で開いてください。' }); await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(mocks.replay).not.toHaveBeenCalled();
});
it('fails recoverably when a worker cannot be constructed', async () => {
    const runner = createLifeMigrationRunner(() => { throw new Error('unsupported'); });
    await expect(runner(newLife('kid', 1000), 2000)).rejects.toThrow('もういちど');
    expect(mocks.replay).not.toHaveBeenCalled();
});
it('cancels an abandoned opening and ignores late worker messages', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker(), controller = new AbortController();
    const result = createLifeMigrationRunner(() => worker as unknown as Worker)(newLife('kid', 1000), 2000, controller.signal);
    const rejected = expect(result).rejects.toThrow('もういちど');
    controller.abort(); await rejected;
    worker.reply({ state: { now: 2000 } as LifeState });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
