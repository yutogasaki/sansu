import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GrowingRecord, SyncResult } from '../../../domain/growingIsland/repository';
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return {
        reset() { cells.length = 0; effects.length = 0; cursor = 0; }, begin() { cursor = 0; },
        useState(initial?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: initial }; return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }]; },
        useRef(value?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: { current: value } }; return cells[i].value; },
        useCallback(callback: unknown, deps: unknown[]) { const i = cursor++; if (!cells[i] || !same(cells[i].deps, deps)) cells[i] = { value: callback, deps }; return cells[i].value; },
        effect(callback: () => void | (() => void), deps?: unknown[]) { const i = cursor++, old = cells[i]; if (!old || !same(old.deps, deps)) { cells[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; }); } },
        commit() { for (const effect of effects.splice(0)) effect(); }, unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
const mocks = vi.hoisted(() => ({ read: vi.fn(), sync: vi.fn(), command: vi.fn(), profile: vi.fn(), facts: vi.fn(), opening: 0, saving: 0 }));
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect }));
vi.mock('../../../pwa', () => ({
    allowPwaUpdateDuringReadOnlyOpening: () => { mocks.opening++; return () => { mocks.opening--; }; },
    holdPwaUpdateForCriticalPersistence: () => { mocks.saving++; return () => { mocks.saving--; }; },
}));
vi.mock('../../../domain/user/repository', () => ({ getProfile: mocks.profile }));
vi.mock('../../../domain/islandLife/repository', () => ({ lifeDb: {}, terminalFacts: mocks.facts }));
vi.mock('../../../domain/growingIsland/repository', () => ({
    growingDb: {}, readGrowingIsland: mocks.read, syncGrowingIsland: mocks.sync, commandGrowingIsland: mocks.command,
    GuidanceReceiptConflict: class extends Error {},
}));
import { useGrowingIsland } from './useGrowingIsland';
import { GuidanceReceiptConflict } from '../../../domain/growingIsland/repository';
import { newIsland } from '../../../domain/growingIsland/island';
import { newPlaceProgress } from '../../../domain/growingIsland/placeGoals';
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const record = { profileId: 'kid', revision: 0 } as GrowingRecord;
const RenderGrowing = (active = true) => { hooks.begin(); const api = useGrowingIsland('kid', active); hooks.commit(); return api; };
beforeEach(() => {
    hooks.reset(); mocks.read.mockReset().mockReturnValue(new Promise(() => {})); mocks.sync.mockReset(); mocks.command.mockReset();
    mocks.profile.mockReset().mockResolvedValue(undefined); mocks.facts.mockReset().mockResolvedValue([]);
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn() });
    vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(() => { hooks.unmount(); expect(mocks.opening).toBe(0); expect(mocks.saving).toBe(0); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('ends a stalled learning-history read and never saves its late result', async () => {
    vi.useFakeTimers(); const facts = deferred<[]>(); mocks.facts.mockReturnValueOnce(facts.promise);
    RenderGrowing(); await vi.advanceTimersByTimeAsync(120_000);
    expect(RenderGrowing().error).toContain('よみこみ');
    expect(mocks.sync).not.toHaveBeenCalled(); expect(mocks.saving).toBe(0);
    facts.resolve([]); await vi.advanceTimersByTimeAsync(0); expect(mocks.sync).not.toHaveBeenCalled();
    mocks.sync.mockResolvedValue({ record, town: [], nature: [], learned: 0 });
    await RenderGrowing().sync(); expect(RenderGrowing().record).toBe(record); expect(RenderGrowing().error).toBeUndefined();
});

it('keeps update recovery available after a failed opening and releases it when leaving', async () => {
    const sync = deferred<SyncResult>(); mocks.sync.mockReturnValue(sync.promise);
    RenderGrowing(); await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalled());
    expect(mocks.opening).toBe(1); expect(mocks.saving).toBe(0);
    sync.reject(new Error('しまを よみなおしてね。'));
    await vi.waitFor(() => expect(RenderGrowing().error).toBeDefined());
    expect(mocks.opening).toBe(1); expect(mocks.saving).toBe(0);
    RenderGrowing(false); expect(mocks.opening).toBe(0);
});

it('restores normal protection when a saved island appears and holds explicit commands', async () => {
    const read = deferred<GrowingRecord>(), sync = deferred<SyncResult>();
    mocks.read.mockReturnValue(read.promise); mocks.sync.mockReturnValue(sync.promise);
    RenderGrowing(); expect(mocks.opening).toBe(1);
    read.resolve(record); await vi.waitFor(() => expect(RenderGrowing().record).toBe(record));
    expect(mocks.opening).toBe(0);
    sync.resolve({ record, town: [], nature: [], learned: 0 });
    await RenderGrowing().sync();
    const command = deferred<{ record: GrowingRecord; town: [] }>(); mocks.command.mockReturnValue(command.promise);
    const saving = RenderGrowing().dispatch({ type: 'name', target: 'island', name: 'みなと' });
    expect(mocks.saving).toBe(1);
    command.resolve({ record, town: [] }); await saving;
    expect(mocks.saving).toBe(0);
});

function placeRecord(revision = 7): GrowingRecord {
    const state = newIsland('kid', 0); state.placeProgress = newPlaceProgress();
    return { profileId: 'kid', version: 4, revision, createdAt: 0, updatedAt: 0, state };
}

it('retries a rendered place receipt against the latest saved owner revision', async () => {
    const before = placeRecord(), after = placeRecord(8);
    mocks.sync.mockResolvedValue({ record: before, town: [], nature: [], learned: 0 });
    mocks.read.mockResolvedValue(before);
    const api = RenderGrowing(); await api.sync();
    mocks.read.mockReset().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    mocks.command.mockRejectedValueOnce(new GuidanceReceiptConflict()).mockResolvedValue({ record: placeRecord(9), town: [] });
    const receipt = { type: 'place-used' as const, ruleId: 'P01' as const, placeId: 'P01:tree', revision: 'grown-shape', actorId: 'pokomoko', targetId: 'seat' };
    expect(await api.acknowledgePlace(receipt)).toBe(true);
    expect(mocks.command).toHaveBeenCalledTimes(2);
    const first = mocks.command.mock.calls[0][1], second = mocks.command.mock.calls[1][1];
    expect(first.id).toBe(second.id);
    expect(first.command).toEqual({ ...receipt, profileId: 'kid', expectedRevision: 7 });
    expect(second.command).toEqual({ ...receipt, profileId: 'kid', expectedRevision: 8 });
    expect(mocks.saving).toBe(0);
});

it('serializes simultaneous shown receipts and avoids saving the same already-shown shape again', async () => {
    let current = placeRecord();
    mocks.sync.mockResolvedValue({ record: current, town: [], nature: [], learned: 0 });
    mocks.read.mockImplementation(() => Promise.resolve(current));
    const api = RenderGrowing(); await api.sync();
    const firstSave = deferred<{ record: GrowingRecord; town: [] }>();
    mocks.command.mockReturnValueOnce(firstSave.promise).mockImplementationOnce(() => {
        current = { ...current, revision: 9 };
        current.state.placeProgress!.shown.P05 = 'flowers';
        return Promise.resolve({ record: current, town: [] });
    });
    const first = api.acknowledgePlace({ type: 'place-shown', ruleId: 'P01', revision: 'trees' });
    const second = api.acknowledgePlace({ type: 'place-shown', ruleId: 'P05', revision: 'flowers' });
    await vi.waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
    expect(mocks.saving).toBe(1);
    current = { ...current, revision: 8 }; current.state.placeProgress!.shown.P01 = 'trees';
    firstSave.resolve({ record: current, town: [] });
    expect(await first).toBe(true); expect(await second).toBe(true);
    expect(mocks.command.mock.calls[1][1].command.expectedRevision).toBe(8);
    expect(await api.acknowledgePlace({ type: 'place-shown', ruleId: 'P05', revision: 'flowers' })).toBe(true);
    expect(mocks.command).toHaveBeenCalledTimes(2); expect(mocks.saving).toBe(0);
});

it('drops queued place receipts when the island leaves the foreground', async () => {
    const current = placeRecord();
    mocks.sync.mockResolvedValue({ record: current, town: [], nature: [], learned: 0 }); mocks.read.mockResolvedValue(current);
    const api = RenderGrowing(); await api.sync();
    const firstSave = deferred<{ record: GrowingRecord; town: [] }>(); mocks.command.mockReturnValue(firstSave.promise);
    const first = api.acknowledgePlace({ type: 'place-shown', ruleId: 'P01', revision: 'trees' });
    const queued = api.acknowledgePlace({ type: 'place-shown', ruleId: 'P05', revision: 'flowers' });
    await vi.waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
    RenderGrowing(false); firstSave.resolve({ record: current, town: [] });
    expect(await first).toBe(true); expect(await queued).toBe(false); expect(mocks.command).toHaveBeenCalledTimes(1);
    Object.assign(document, { visibilityState: 'hidden' });
    expect(await api.acknowledgePlace({ type: 'place-shown', ruleId: 'P03', revision: 'water' })).toBe(false);
});
