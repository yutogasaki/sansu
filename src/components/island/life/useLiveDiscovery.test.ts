import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return { facts: vi.fn(), update: vi.fn(), reset() { cells.length = 0; effects.length = 0; cursor = 0; }, begin() { cursor = 0; },
        useState(initial?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: initial }; return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }]; },
        useRef(value?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: { current: value } }; return cells[i].value; },
        useCallback(callback: unknown, deps: unknown[]) { const i = cursor++; if (!cells[i] || !same(cells[i].deps, deps)) cells[i] = { value: callback, deps }; return cells[i].value; },
        effect(callback: () => void | (() => void), deps?: unknown[]) { const i = cursor++, old = cells[i]; if (!old || !same(old.deps, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; }); } },
        commit() { for (const effect of effects.splice(0)) effect(); }, unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
const persistence = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../../pwa', () => ({ holdPwaUpdateForCriticalPersistence: () => { persistence.count++; return () => { persistence.count--; }; } }));
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect }));
const save = vi.hoisted(() => vi.fn());
vi.mock('../../../domain/islandLife/discoveryRepository', () => ({ recordPresentedScene: save }));
import { useLiveDiscovery } from './useLiveDiscovery';
const event = (profileId: string, eventId: string) => ({ profileId, eventId } as DiscoveryScene);
const evidence = { eventId: 'one', visibleDurationMs: 1000 } as PresentationEvidence;
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
function RenderLive(owner = 'a') { hooks.begin(); const api = useLiveDiscovery(owner); hooks.commit(); return api; }
beforeEach(() => { hooks.reset(); save.mockReset().mockResolvedValue(undefined); });
afterEach(() => { hooks.unmount(); expect(persistence.count).toBe(0); });
describe('live scene persistence ownership', () => {
    it('holds PWA persistence for the full queue and retries the original failed evidence', async () => {
        const held = deferred(); save.mockImplementationOnce(() => held.promise);
        const api = RenderLive(), first = event('a', 'one'), second = event('a', 'two');
        api.presented(first, evidence); api.presented(second, evidence);
        expect(persistence.count).toBe(1); expect(save).toHaveBeenCalledTimes(1);
        save.mockRejectedValueOnce(new Error('disk unavailable')); held.resolve();
        await vi.waitFor(() => expect(RenderLive().error).not.toBe(''));
        expect(persistence.count).toBe(0);
        await RenderLive().retry(); expect(save.mock.calls.map(call => call[1])).toEqual([first, second, second]);
        expect(save.mock.calls[2][2]).toBe(evidence); expect(RenderLive().error).toBe('');
    });
    it('writes an in-flight scene only to its original owner and drains the new owner afterward', async () => {
        const held = deferred(); save.mockImplementationOnce(() => held.promise);
        RenderLive().presented(event('a', 'one'), evidence);
        const next = RenderLive('b'); next.presented(event('a', 'stale'), evidence); next.presented(event('b', 'two'), evidence);
        expect(save).toHaveBeenCalledTimes(1); held.resolve();
        await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
        expect(save.mock.calls.map(call => [call[0], call[1].eventId])).toEqual([['a', 'one'], ['b', 'two']]);
        await vi.waitFor(() => expect(persistence.count).toBe(0)); expect(RenderLive('b').error).toBe('');
    });
    it('ignores presentation callbacks after unmount', async () => {
        const api = RenderLive(); hooks.unmount(); api.presented(event('a', 'late'), evidence); await api.retry();
        expect(save).not.toHaveBeenCalled();
    });
});
