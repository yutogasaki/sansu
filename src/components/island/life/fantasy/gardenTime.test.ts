import { afterEach, describe, expect, it, vi } from 'vitest';
import { gardenTimeAt } from './presentation';
import { gardenLight } from './lighting';
import { watchGardenTime } from './useGardenTime';

const local = (hour: number, minute = 0, second = 0) => new Date(2026, 9, 1, hour, minute, second);
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('device-local scenery clock', () => {
    it.each([
        [0, 0, 'night'], [4, 59, 'night'], [5, 0, 'morning'], [7, 44, 'morning'],
        [9, 59, 'morning'], [10, 0, 'day'], [15, 59, 'day'], [16, 0, 'dusk'],
        [18, 59, 'dusk'], [19, 0, 'night'], [23, 59, 'night'],
    ] as const)('at %i:%i uses %s', (hour, minute, time) => {
        expect(gardenTimeAt(local(hour, minute))).toBe(time);
        expect(gardenLight[time]).toBeDefined();
    });

    it('crosses a boundary while open, resamples a changed clock on resume, and cleans up', () => {
        vi.useFakeTimers(); vi.setSystemTime(local(15, 59, 45));
        const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
        const win = Object.assign(new EventTarget(), { setInterval, clearInterval });
        vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
        // An old manually chosen night must not affect the actual afternoon.
        const storage = { getItem: vi.fn(() => 'night'), setItem: vi.fn() };
        vi.stubGlobal('localStorage', storage);
        const changed = vi.fn(); const stop = watchGardenTime(changed);
        expect(changed).toHaveBeenLastCalledWith('day');
        vi.advanceTimersByTime(30_000);
        expect(changed).toHaveBeenLastCalledWith('dusk');
        doc.visibilityState = 'hidden';
        changed.mockClear(); vi.setSystemTime(local(21)); vi.advanceTimersByTime(30_000);
        expect(changed).not.toHaveBeenCalled();
        doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
        expect(changed).toHaveBeenLastCalledWith('night');
        vi.setSystemTime(local(7, 44)); win.dispatchEvent(new Event('pageshow'));
        expect(changed).toHaveBeenLastCalledWith('morning');
        vi.setSystemTime(local(12)); win.dispatchEvent(new Event('focus'));
        expect(changed).toHaveBeenLastCalledWith('day');
        stop(); changed.mockClear(); vi.advanceTimersByTime(60_000);
        doc.dispatchEvent(new Event('visibilitychange'));
        win.dispatchEvent(new Event('focus')); win.dispatchEvent(new Event('pageshow'));
        expect(changed).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
    });
});
