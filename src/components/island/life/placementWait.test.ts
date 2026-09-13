import { describe, expect, it, vi } from 'vitest';
import { PlacementWait } from './placementWait';

describe('placement waits for the visible saved retreat', () => {
    it('does not commit or charge before an actually rendered arrival', async () => {
        const wait = new PlacementWait(), token = wait.begin(), commit = vi.fn();
        const completion = wait.wait(token, 1200).then(ready => { if (ready && wait.current(token)) commit(); });
        wait.frame(1199, true); await Promise.resolve(); expect(commit).not.toHaveBeenCalled();
        wait.frame(1200, false); await Promise.resolve(); expect(commit).not.toHaveBeenCalled();
        wait.frame(1200, true); await completion; expect(commit).toHaveBeenCalledTimes(1);
        wait.frame(1500, true); expect(commit).toHaveBeenCalledTimes(1);
    });
    it.each(['cancel', 'unmount', 'hidden', 'new selection'])('never commits an abandoned request after %s', async () => {
        const wait = new PlacementWait(), token = wait.begin(), commit = vi.fn();
        const completion = wait.wait(token, 1200).then(ready => { if (ready && wait.current(token)) commit(); });
        wait.cancel(); wait.frame(2000, true); await completion;
        expect(commit).not.toHaveBeenCalled(); expect(wait.current(token)).toBe(false);
    });
    it('a retry replaces the earlier wait and completes only its own original action', async () => {
        const wait = new PlacementWait(), first = wait.begin();
        const stale = wait.wait(first, 100);
        const retry = wait.begin(), current = wait.wait(retry, 200);
        expect(await stale).toBe(false); expect(wait.current(first)).toBe(false);
        wait.frame(200, true); expect(await current).toBe(true); expect(wait.current(retry)).toBe(true);
    });
    it('cancellation before the save returns prevents registering a later wait', async () => {
        const wait = new PlacementWait(), token = wait.begin();wait.cancel();
        expect(await wait.wait(token, 200)).toBe(false);
    });
});
