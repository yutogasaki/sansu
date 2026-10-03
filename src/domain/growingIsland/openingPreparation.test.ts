import { afterEach, expect, it, vi } from 'vitest';
import { prepareIslandOpening } from './openingPreparation';
afterEach(() => vi.useRealTimers());
it('times out even if a database read never settles; a late result cannot start the save', async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void, signal!: AbortSignal;
    const save = vi.fn();
    const opening = prepareIslandOpening(s => {
        signal = s; return new Promise<string>(resolve => { finish = resolve; });
    }).then(save);
    const rejected = expect(opening).rejects.toThrow('もういちど');
    await vi.advanceTimersByTimeAsync(120_000); await rejected;
    expect(signal.aborted).toBe(true);
    finish('late'); await vi.advanceTimersByTimeAsync(0);
    expect(save).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(await prepareIslandOpening(async () => 'fresh')).toBe('fresh');
});
it('clears its deadline on success and on a real read error', async () => {
    vi.useFakeTimers();
    expect(await prepareIslandOpening(async () => 'ready')).toBe('ready');
    await expect(prepareIslandOpening(async () => { throw new Error('invalid-save'); })).rejects.toThrow('invalid-save');
    expect(vi.getTimerCount()).toBe(0);
});
