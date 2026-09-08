import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { IslandConflict } from '../../domain/island/repository';
import { IslandWorkshopConflict, type IslandWorkshopAction } from '../../domain/island/workshop';
import { WorkshopLayoutConflict } from '../../domain/island/workshopLayout';
import { executeIslandWorkshopRequest, type IslandWorkshopRequest } from './islandWorkshopRequest';

describe('workshop gesture receipt recovery', () => {
    it('retries a lost undo response with the original receipt after a newer live revision arrives', async () => {
        const pending = { current: undefined as IslandWorkshopRequest | undefined };
        const write = vi.fn().mockRejectedValueOnce(new Error('reply lost')).mockResolvedValueOnce(createIsland('child', 1));
        const action: IslandWorkshopAction = { type: 'edit-draft', edit: { type: 'undo' } };
        await expect(executeIslandWorkshopRequest(pending, 12, action, write)).rejects.toThrow('reply lost');
        const original = pending.current;
        await executeIslandWorkshopRequest(pending, 13, action, write);
        expect(write.mock.calls[1][0]).toBe(original);
        expect(original?.revision).toBe(12);
        expect(pending.current).toBeUndefined();
    });
    it('detaches the original nested gesture and retries canonical Unicode names', async () => {
        const pending = { current: undefined as IslandWorkshopRequest | undefined };
        const write = vi.fn().mockRejectedValueOnce(new Error('reply lost')).mockResolvedValueOnce(createIsland('child', 1));
        const action: IslandWorkshopAction = { type: 'edit-draft', edit: { type: 'move', partId: 'wheel', position: { col: 1, row: 1 } } };
        await expect(executeIslandWorkshopRequest(pending, 8, action, write)).rejects.toThrow();
        action.edit.position.row = 3;
        expect(pending.current?.action).toEqual({ type: 'edit-draft', edit: { type: 'move', partId: 'wheel', position: { col: 1, row: 1 } } });
        write.mockRejectedValueOnce(new Error('again'));
        // A new deliberate operation gets a new receipt; its normalized name is stable.
        await executeIslandWorkshopRequest(pending, 9, { type: 'save-work', workId: 'work-1', name: '  か\u3099らす  ' }, write);
        expect(write.mock.calls[1][0]).toEqual({ revision: 9, action: { type: 'save-work', workId: 'work-1', name: 'がらす' } });
    });
    it.each([new IslandConflict('new revision'), new IslandWorkshopConflict('stale-observation', 'older surface'),
        new WorkshopLayoutConflict('collision', 'occupied')])('clears only a confirmed conflict before rebasing: %s', async conflict => {
        const pending = { current: undefined as IslandWorkshopRequest | undefined };
        const write = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce(createIsland('child', 1));
        const action: IslandWorkshopAction = { type: 'brush', specimenId: 'driftwood', section: 1 };
        await expect(executeIslandWorkshopRequest(pending, 2, action, write)).rejects.toBe(conflict);
        expect(pending.current).toBeUndefined();
        await executeIslandWorkshopRequest(pending, 4, action, write);
        expect(write.mock.calls.map(call => call[0].revision)).toEqual([2, 4]);
    });
    it('rejects a forged whole workshop before any storage call', async () => {
        const write = vi.fn();
        await expect(executeIslandWorkshopRequest({ current: undefined }, 2,
            { type: 'edit-draft', edit: { type: 'move', partId: 'wheel', position: { col: -1, row: 1 } } }, write)).rejects.toThrow();
        expect(write).not.toHaveBeenCalled();
    });
});
