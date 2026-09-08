import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { IslandExperienceConflict, type IslandExperienceAction } from '../../domain/island/experience';
import { IslandConflict } from '../../domain/island/repository';
import { executeIslandExperienceRequest, IslandExperiencePendingConflict, type IslandExperienceRequest } from './islandExperienceRequest';

describe('island expression request recovery', () => {
    const action = { type: 'save-layout' as const, layoutId: 'slot-1' as const, name: 'ほしの にわ' };
    it.each([new IslandConflict('new revision'), new IslandExperienceConflict('layout-collision', 'ぶつかるよ')])(
        'rebases after a confirmed conflict: %s', async conflict => {
            const pending = { current: undefined as IslandExperienceRequest | undefined };
            const write = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce(createIsland('child', 1));
            await expect(executeIslandExperienceRequest(pending, 2, action, write)).rejects.toBe(conflict);
            expect(pending.current).toBeUndefined();
            await executeIslandExperienceRequest(pending, 4, action, write);
            expect(write.mock.calls.map(call => call[0].revision)).toEqual([2, 4]);
        });
    it('retries the exact canonical intent after an unknown IO failure, regardless of live revision', async () => {
        const pending = { current: undefined as IslandExperienceRequest | undefined };
        const write = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(createIsland('child', 1));
        const first = { type: 'rename-island' as const, name: '  はなさく しま  ' };
        await expect(executeIslandExperienceRequest(pending, 2, first, write)).rejects.toThrow('response lost');
        first.name = 'caller changed its object';
        const original = pending.current;
        await executeIslandExperienceRequest(pending, 8, { type: 'rename-island', name: 'はなさく しま' }, write);
        expect(write.mock.calls[1][0]).toBe(original);
        expect(Object.isFrozen(original)).toBe(true);
        expect(Object.isFrozen(original!.action)).toBe(true);
        expect(original).toEqual({ revision: 2, action: { type: 'rename-island', name: 'はなさく しま' } });
        expect(pending.current).toBeUndefined();
    });
    it('rejects a different operation while preserving the unknown intent, and rejects invalid names before IO', async () => {
        const pending = { current: { revision: 2, action } as IslandExperienceRequest | undefined };
        const write = vi.fn().mockResolvedValue(createIsland('child', 1));
        const original = pending.current;
        await expect(executeIslandExperienceRequest(pending, 6, { type: 'emblem', emblem: 'wave' }, write)).rejects.toBeInstanceOf(IslandExperiencePendingConflict);
        expect(pending.current).toBe(original);
        expect(write).not.toHaveBeenCalled();
        await executeIslandExperienceRequest(pending, 6, action, write);
        expect(write).toHaveBeenCalledWith(original);
        const invalid: IslandExperienceAction = { type: 'rename-island', name: '\u0000' };
        await expect(executeIslandExperienceRequest(pending, 7, invalid, write)).rejects.toBeInstanceOf(IslandExperienceConflict);
        expect(write).toHaveBeenCalledTimes(1);
    });
});
