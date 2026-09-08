import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createInitialProfile } from '../../domain/user/profile';
import { parkHissanGrid } from '../../domain/park/learning';
import { getIslandLandAccess, islandPlacementCandidates } from '../../domain/island/catalog';
import { commitIslandLearning } from '../../domain/island/commit';
import { openIsland, startIslandPlan } from '../../domain/island/repository';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import { isValidSharedDisplayPlacement, resolveSharedTarget, sharedDestinationKey, sharedRequestIdentity,
    type IslandSharedMemoriesAction, type SharedDisplayId } from '../../domain/island/sharedMemories';
import type { IslandPlan, IslandRecord } from '../../domain/island/types';

// Controlled hook commits intentionally delay parent/liveQuery updates. Domain
// actions, canonical receipts, native transactions and CAS below are real.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = []; let cursor = 0;
    const effects: (() => void)[] = [];
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
    return { cells, effects, save: vi.fn(),
        reset() { cells.length = 0; effects.length = 0; cursor = 0; },
        begin() { cursor = 0; },
        useState(initial?: unknown) {
            const index = cursor++; if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [cells[index].value, (next: unknown) => { cells[index].value = typeof next === 'function' ? next(cells[index].value) : next; }];
        },
        useRef(value?: unknown) { const index = cursor++; if (!cells[index]) cells[index] = { value: { current: value } }; return cells[index].value; },
        useCallback(callback: unknown, deps: unknown[]) {
            const index = cursor++; if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: callback, deps }; return cells[index].value;
        },
        effect(callback: () => void | (() => void), deps?: unknown[]) {
            const index = cursor++, previous = cells[index];
            if (!previous || !same(previous.deps, deps)) {
                cells[index] = { deps, cleanup: previous?.cleanup };
                effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect, useLayoutEffect: hooks.effect }));
vi.mock('../../domain/island/sharedMemoriesRepository', async importOriginal => ({ ...await importOriginal<object>(), saveIslandSharedMemories: hooks.save }));
import { useIslandSharedMemories } from './useIslandSharedMemories';
const actual = await vi.importActual<typeof import('../../domain/island/sharedMemoriesRepository')>('../../domain/island/sharedMemoriesRepository');
const databases: SansuDatabase[] = [];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
function place(island: IslandRecord, displayId: SharedDisplayId = 'display-1'): Extract<IslandSharedMemoriesAction, { type: 'place-display' }> {
    const target = { kind: 'specimen' as const, specimenId: 'driftwood' as const }, resolved = resolveSharedTarget(island, target);
    const position = islandPlacementCandidates(getIslandLandAccess(island)).find(point => isValidSharedDisplayPlacement(island, displayId, resolved, point));
    if (!position) throw new Error('No legal test display position');
    return { type: 'place-display', displayId, target, position, rotation: 0, expectedDisplayKey: null };
}
function complete(island: IslandRecord): Extract<IslandSharedMemoriesAction, { type: 'complete-request' }> {
    const request = island.sharedMemories!.activeRequest!;
    return { type: 'complete-request', requestId: request.requestId, targetKey: request.target.targetKey, visualKey: request.visualKey,
        destinationKey: sharedDestinationKey(request.destination), result: { kind: 'placed' } };
}
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`shared-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d); let plan = await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
    let island = await current(d), active = true; const initial = island;
    const onSaved = vi.fn();
    const run = vi.fn(async <T,>(action: () => Promise<T>): Promise<T | undefined> => action());
    hooks.save.mockImplementation((id: string, revision: number, action: IslandSharedMemoriesAction) => actual.saveIslandSharedMemories(id, revision, action, d));
    const refresh = vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    let api!: ReturnType<typeof useIslandSharedMemories>;
    const RenderSharedHook = (next = island, accepting = active) => { island = next; active = accepting; hooks.begin(); api = useIslandSharedMemories(island, active, run, onSaved); hooks.commit(); return api; };
    const render = RenderSharedHook; render();
    const prepare = async () => {
        const now = await current(d), action = place(now);
        await actual.saveIslandSharedMemories('child', now.revision, { type: 'prepare-request', requestId: sharedRequestIdentity('child', crypto.randomUUID()),
            residentId: 'otter', jobId: 'carry', target: action.target, destination: { displayId: action.displayId, position: action.position, rotation: 0, expectedDisplayKey: null }, expectedRequestId: null }, d);
        const prepared = await current(d); render(prepared); return prepared;
    };
    return { d, initial, run, onSaved, refresh, render, prepare, get api() { return api; }, hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

describe('shared hook exact receipt replay and monotonic parent state', () => {
    it('retries a natively committed operation with its original revision/action after the parent receives a newer island', async () => {
        const h = await harness(), action = place(h.initial);
        hooks.save.mockImplementationOnce(async (id, revision, intent) => { await actual.saveIslandSharedMemories(id, revision, intent, h.d); throw new Error('completion delivery lost'); });
        expect(await h.api.act(action)).toBeUndefined(); h.render(); expect(h.api.retry).toBeTypeOf('function');
        const committed = await current(h.d); const latest = await saveIslandExperience('child', committed.revision, { type: 'rename-island', name: 'あとからの なまえ' }, h.d);
        h.render(latest); const before = await allRows(h.d); expect(await h.api.retry!()).toEqual(latest);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, h.initial.revision]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]); expect(await allRows(h.d)).toEqual(before);
        expect(h.onSaved).toHaveBeenLastCalledWith(latest, hooks.save.mock.calls[1][2]);
    });
    it('rejects a different new gesture during uncertain I/O and keeps the first canonical action available for retry', async () => {
        const h = await harness(), first = place(h.initial), replacement = { ...first, target: { kind: 'specimen' as const, specimenId: 'seaglass' as const } };
        hooks.save.mockRejectedValueOnce(new Error('temporary disk failure'));
        await h.api.act(first); h.render(); const before = await allRows(h.d);
        expect(await h.api.act(replacement)).toBeUndefined(); h.render(); expect(h.api.error).toContain('さきの そうさ'); expect(hooks.save).toHaveBeenCalledTimes(1); expect(await allRows(h.d)).toEqual(before);
        await h.api.retry!(); h.render(); expect((await current(h.d)).sharedMemories!.displays['display-1']!.target).toMatchObject(first.target);
        expect(hooks.save.mock.calls[1][1]).toBe(h.initial.revision); expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]); expect(h.api.retry).toBeUndefined();
    });
    it('keeps the newest published island through a stale liveQuery render and freezes the next action at its revision', async () => {
        const h = await harness(); await h.api.act(place(h.initial)); const saved = await current(h.d);
        h.render(h.initial); const next = place(saved, 'display-2'); await h.api.act(next);
        expect(hooks.save.mock.calls[1][1]).toBe(saved.revision); expect(h.onSaved).toHaveBeenLastCalledWith(await current(h.d), hooks.save.mock.calls[1][2]);
    });
    it('does not publish an older completion over a newer query and a subsequent action uses the newer revision', async () => {
        const h = await harness(), gate = deferred<IslandRecord>(); let first: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { first = await actual.saveIslandSharedMemories(id, revision, action, h.d); return gate.promise; });
        const pending = h.api.act(place(h.initial)); await vi.waitFor(() => expect(first).toBeDefined());
        const newer = await saveIslandExperience('child', first!.revision, { type: 'rename-island', name: 'あたらしい しま' }, h.d); h.render(newer);
        gate.resolve(first!); await pending; expect(h.onSaved).toHaveBeenLastCalledWith(newer, hooks.save.mock.calls[0][2]);
        await h.api.act(place(newer, 'display-2')); expect(hooks.save.mock.calls.at(-1)![1]).toBe(newer.revision);
    });
    it('does not permit an old prepare continuation after another tab cancels that request and its newer query has arrived', async () => {
        const h = await harness(), destination = place(h.initial), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        const requestId = sharedRequestIdentity('child', crypto.randomUUID());
        const intent: IslandSharedMemoriesAction = { type: 'prepare-request', requestId, residentId: 'otter', jobId: 'carry', target: destination.target,
            destination: { displayId: destination.displayId, position: destination.position, rotation: 0, expectedDisplayKey: null }, expectedRequestId: null };
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandSharedMemories(id, revision, action, h.d); return gate.promise; });
        const startActing = vi.fn();
        const pending = h.api.act(intent).then(result => {
            if (result?.sharedMemories?.activeRequest?.requestId === requestId && result.sharedMemories.activeRequest.status === 'prepared') startActing();
        });
        await vi.waitFor(() => expect(written).toBeDefined());
        const cancelled = await actual.saveIslandSharedMemories('child', written!.revision, { type: 'cancel-request', requestId }, h.d);
        h.render(cancelled); gate.resolve(written!); await pending;
        expect(h.onSaved).toHaveBeenLastCalledWith(cancelled, hooks.save.mock.calls[0][2]);
        expect(startActing).not.toHaveBeenCalled();
    });
    it('refreshes after a known CAS without rebasing the failed action; only a later explicit gesture writes', async () => {
        const h = await harness(), intent = place(h.initial);
        const newer = await saveIslandExperience('child', h.initial.revision, { type: 'rename-island', name: 'べつの タブ' }, h.d);
        expect(await h.api.act(intent)).toBeUndefined(); h.render(); expect(h.refresh).toHaveBeenCalledWith('child'); expect(h.onSaved).toHaveBeenLastCalledWith(newer, undefined);
        expect(h.api.retry).toBeUndefined(); expect(hooks.save).toHaveBeenCalledTimes(1); expect((await current(h.d)).sharedMemories).toBeUndefined();
        await h.api.act(intent); expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, newer.revision]); expect((await current(h.d)).sharedMemories!.displays['display-1']).toBeDefined();
    });
});

describe('shared callback ownership and UI continuation', () => {
    it.each(['inactive', 'hidden'] as const)('rejects a real visible-result callback while %s, then accepts a new callback after returning', async boundary => {
        const h = await harness(), prepared = await h.prepare(), action = complete(prepared), before = await allRows(h.d);
        if (boundary === 'inactive') h.render(prepared, false); else h.hidden();
        h.api.capture(action); await new Promise(resolve => setTimeout(resolve, 0)); expect(hooks.save).not.toHaveBeenCalled(); expect(await allRows(h.d)).toEqual(before);
        h.hidden(false); h.render(prepared, true); await h.api.act(action);
        expect((await current(h.d)).sharedMemories!.activeRequest!.status).toBe('result-seen'); expect(await h.d.islandEvents.where('type').equals('shared_memory_first').count()).toBe(1);
    });
    it.each(['inactive', 'hidden', 'unmounted'] as const)('keeps a started write atomic but denies its UI continuation after %s', async boundary => {
        const h = await harness(), prepared = await h.prepare(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandSharedMemories(id, revision, action, h.d); return gate.promise; });
        const continuation = vi.fn(), pending = h.api.act(complete(prepared)).then(result => { if (result) continuation(result); return result; });
        await vi.waitFor(() => expect(written).toBeDefined());
        if (boundary === 'inactive') h.render(prepared, false); else if (boundary === 'hidden') h.hidden(); else h.unmount();
        gate.resolve(written!); expect(await pending).toBeUndefined(); expect(continuation).not.toHaveBeenCalled();
        expect(await current(h.d)).toEqual(written); expect(await h.d.islandEvents.where('type').equals('shared_memory_first').count()).toBe(1);
        if (boundary === 'unmounted') expect(h.onSaved).not.toHaveBeenCalled();
    });
    it.each(['hidden', 'inactive'] as const)('invalidates a started UI continuation across %s and foreground re-entry while publishing its committed data', async boundary => {
        const h = await harness(), prepared = await h.prepare(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandSharedMemories(id, revision, action, h.d); return gate.promise; });
        const action = complete(prepared), continuation = vi.fn();
        const pending = h.api.act(action).then(result => { if (result) continuation(result); return result; });
        await vi.waitFor(() => expect(written).toBeDefined());
        if (boundary === 'hidden') { h.hidden(); h.hidden(false); }
        else { h.render(prepared, false); h.render(prepared, true); }
        gate.resolve(written!); expect(await pending).toBeUndefined(); expect(continuation).not.toHaveBeenCalled();
        expect(h.onSaved).toHaveBeenLastCalledWith(written, hooks.save.mock.calls[0][2]);
        expect(await current(h.d)).toEqual(written); expect(await h.d.islandEvents.where('type').equals('shared_memory_first').count()).toBe(1);
    });
});
