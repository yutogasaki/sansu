import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { IslandConflict } from '../../domain/island/repository';
import { executeIslandCustomizationRequest, IslandCustomizationPending, type IslandCustomizationRequest } from './islandCustomizationRequest';

describe('customization request recovery', () => {
    const action = { type: 'purchase' as const, itemId: 'starry' as const };
    it('retries the same selection with the refreshed revision after a confirmed conflict', async () => {
        const pending = { current: undefined as IslandCustomizationRequest | undefined };
        const saved = createIsland('child', 1);
        const write = vi.fn().mockRejectedValueOnce(new IslandConflict('Island changed in another tab')).mockResolvedValueOnce(saved);
        await expect(executeIslandCustomizationRequest(pending, 2, action, write)).rejects.toBeInstanceOf(IslandConflict);
        expect(pending.current).toBeUndefined();
        await expect(executeIslandCustomizationRequest(pending, 3, action, write)).resolves.toBe(saved);
        expect(write.mock.calls.map(call => call[0].revision)).toEqual([2, 3]);
        expect(pending.current).toBeUndefined();
    });
    it('retains the exact intent and revision after an uncertain write even when live state is newer', async () => {
        const pending = { current: undefined as IslandCustomizationRequest | undefined };
        const saved = createIsland('child', 1);
        const write = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(saved);
        await expect(executeIslandCustomizationRequest(pending, 2, action, write)).rejects.toThrow('response lost');
        const original = pending.current;
        await expect(executeIslandCustomizationRequest(pending, 3, action, write)).resolves.toBe(saved);
        expect(write.mock.calls[1][0]).toBe(original);
        expect(write.mock.calls.map(call => call[0].revision)).toEqual([2, 2]);
        expect(pending.current).toBeUndefined();
    });
    it('retains an uncertain purchase when a different action is attempted', async () => {
        const pending = { current: { revision: 2, action } as IslandCustomizationRequest | undefined };
        const write = vi.fn().mockResolvedValue(createIsland('child', 1));
        await expect(executeIslandCustomizationRequest(pending, 4, { type: 'desire', itemId: 'candy' }, write)).rejects.toBeInstanceOf(IslandCustomizationPending);
        expect(write).not.toHaveBeenCalled();
        expect(pending.current).toEqual({ revision: 2, action });
    });
    it('freezes the selected equipment scope so a retry cannot become a whole-house purchase', async () => {
        const pending = { current: undefined as IslandCustomizationRequest | undefined };
        const first = { type: 'purchase' as const, itemId: 'candy-house' as const, slot: 'houseRoof' as const };
        const write = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(createIsland('child', 1));
        await expect(executeIslandCustomizationRequest(pending, 2, first, write)).rejects.toThrow('response lost');
        Reflect.set(first, 'slot', 'houseWindows');
        await executeIslandCustomizationRequest(pending, 9, { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' }, write);
        expect(write.mock.calls[1][0]).toBe(write.mock.calls[0][0]);
        expect(write.mock.calls[1][0]).toEqual({ revision: 2, action: { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' } });
    });
});
