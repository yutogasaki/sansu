import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IslandRecord } from '../../domain/island/types';
import { createIslandDiscoveryQueue } from './useIslandDiscoveries';

const island: IslandRecord = { profileId: 'p', schemaVersion: 1, revision: 1, completedSets: 1, items: [], pendingRewards: [], updatedAt: 1 };
describe('actual discovery save retries', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100); });
    afterEach(() => { vi.useRealTimers(); });

    it('automatically retries the same observed fact once a transient write failure clears', async () => {
        const save = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue(island), onSaved = vi.fn();
        const queue = createIslandDiscoveryQueue(save, onSaved);
        queue.resume(); queue.observe('flower-scent', 'flower');
        await vi.advanceTimersByTimeAsync(1499);
        expect(save).toHaveBeenCalledTimes(1); expect(onSaved).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(save.mock.calls).toEqual([['flower-scent', 'flower'], ['flower-scent', 'flower']]);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledWith(island);
        queue.observe('flower-scent', 'different-item');
        await vi.advanceTimersByTimeAsync(20000);
        expect(save).toHaveBeenCalledTimes(2);
    });

    it('pauses scheduled retries throughout learning/backgrounding and resumes without another observed animation', async () => {
        const save = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue(island);
        const queue = createIslandDiscoveryQueue(save, vi.fn());
        queue.resume(); queue.observe('leaf-boat', 'fountain');
        await vi.advanceTimersByTimeAsync(10); queue.pause();
        await vi.advanceTimersByTimeAsync(20000);
        expect(save).toHaveBeenCalledTimes(1);
        queue.resume(); await vi.advanceTimersByTimeAsync(0);
        expect(save).toHaveBeenCalledTimes(2);
    });

    it('bounds repeated failures and preserves the fact for the next natural visit', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const queue = createIslandDiscoveryQueue(save, vi.fn());
        queue.resume(); queue.observe('shade-rest', 'chair');
        await vi.advanceTimersByTimeAsync(60000);
        expect(save).toHaveBeenCalledTimes(3);
        queue.pause(); queue.resume(); await vi.advanceTimersByTimeAsync(60000);
        expect(save).toHaveBeenCalledTimes(3);
        save.mockResolvedValueOnce(island); queue.revisit(); await vi.advanceTimersByTimeAsync(0);
        expect(save).toHaveBeenCalledTimes(4);
    });

    it('serializes multiple displayed discoveries and deduplicates repeated callbacks during a write', async () => {
        let complete!: (value: IslandRecord) => void;
        const save = vi.fn().mockImplementationOnce(() => new Promise<IslandRecord>(resolve => { complete = resolve; })).mockResolvedValue(island);
        const queue = createIslandDiscoveryQueue(save, vi.fn());
        queue.resume(); queue.observe('flower-scent', 'flower'); queue.observe('flower-scent', 'flower'); queue.observe('butterfly-visit', 'flower');
        expect(save).toHaveBeenCalledTimes(1);
        complete(island); await vi.advanceTimersByTimeAsync(0);
        expect(save.mock.calls).toEqual([['flower-scent', 'flower'], ['butterfly-visit', 'flower']]);
    });
});
