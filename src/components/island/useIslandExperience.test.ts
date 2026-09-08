import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createInitialProfile } from '../../domain/user/profile';
import { parkHissanGrid } from '../../domain/park/learning';
import { commitIslandLearning } from '../../domain/island/commit';
import { openIsland, startIslandPlan } from '../../domain/island/repository';
import type { IslandExperienceAction } from '../../domain/island/experience';
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
vi.mock('../../domain/island/experienceRepository', async importOriginal => ({ ...await importOriginal<object>(), saveIslandExperience: hooks.save }));
import { useIslandExperience } from './useIslandExperience';
const actual = await vi.importActual<typeof import('../../domain/island/experienceRepository')>('../../domain/island/experienceRepository');
const databases: SansuDatabase[] = [];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
const current = async (d: SansuDatabase, profileId = 'child') => (await d.islands.get(profileId))!;
const save: IslandExperienceAction = { type: 'save-layout', layoutId: 'slot-1', name: 'ほしの にわ' };
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`experience-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d); let plan = await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
    await startIslandPlan('child', d);
    let island = await current(d), active = true; const initial = island;
    const onSaved = vi.fn();
    const run = vi.fn(async <T,>(action: () => Promise<T>): Promise<T | undefined> => action());
    hooks.save.mockImplementation((id: string, revision: number, action: IslandExperienceAction) => actual.saveIslandExperience(id, revision, action, d));
    const refresh = vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    let api!: ReturnType<typeof useIslandExperience>;
    const RenderExperienceHook = (next = island, accepting = active) => { island = next; active = accepting; hooks.begin(); api = useIslandExperience(island, active, run, onSaved); hooks.commit(); return api; };
    const render = RenderExperienceHook; render();
    return { d, initial, run, onSaved, refresh, render, get api() { return api; }, hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

describe('experience hook exact scene receipt recovery', () => {
    it('retries the original canonical capture after a committed response is lost, without recapturing later outfits or names', async () => {
        const h = await harness();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { await actual.saveIslandExperience(id, revision, action, h.d); throw new Error('completion lost'); });
        expect(await h.api.act({ type: 'save-layout', layoutId: 'slot-1', name: ' ほしの にわ ' })).toBe(false);
        h.render(); expect(h.api.retry).toBeTypeOf('function');
        const committed = await current(h.d), firstCapture = structuredClone(committed.experience!.layouts[0]);
        const newer = await actual.saveIslandExperience('child', committed.revision, { type: 'resident', residentId: 'fox', name: 'あとからの なまえ', look: 'cap' }, h.d);
        h.render(newer); const before = await allRows(h.d);
        expect(await h.api.retry!()).toBe(true);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, h.initial.revision]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]);
        expect(hooks.save.mock.calls[1][2]).toEqual(save);
        expect((await current(h.d)).experience!.layouts[0]).toEqual(firstCapture);
        expect(firstCapture.sceneStyle!.residentLooks.fox).toBe('original');
        expect(await allRows(h.d)).toEqual(before);
        expect(h.onSaved).toHaveBeenLastCalledWith(newer);
    });
    it('retains the exact receipt when the common runner drops a successful writer completion', async () => {
        const h = await harness();
        h.run.mockImplementationOnce(async action => { await action(); return undefined; });
        expect(await h.api.act(save)).toBe(false); h.render(); expect(h.api.retry).toBeTypeOf('function');
        const before = await allRows(h.d);
        expect(await h.api.retry!()).toBe(true);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, h.initial.revision]);
        expect(await allRows(h.d)).toEqual(before);
    });
    it('reset and view exit preserve an uncertain intent and reject a replacement action', async () => {
        const h = await harness(); hooks.save.mockRejectedValueOnce(new Error('temporary I/O'));
        expect(await h.api.act(save)).toBe(false); h.api.reset(); h.render(h.initial, false); h.render(h.initial, true);
        const before = await allRows(h.d);
        expect(await h.api.act({ type: 'emblem', emblem: 'wave' })).toBe(false); h.render();
        expect(h.api.error).toContain('さきの そうさ'); expect(h.api.retry).toBeTypeOf('function');
        expect(hooks.save).toHaveBeenCalledTimes(1); expect(await allRows(h.d)).toEqual(before);
        expect(await h.api.retry!()).toBe(true); h.render();
        expect((await current(h.d)).experience!.layouts).toHaveLength(1);
        expect(h.api.retry).toBeUndefined();
    });
    it('does not resurrect a captured slot deleted before the old failed delivery is retried', async () => {
        const h = await harness();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { await actual.saveIslandExperience(id, revision, action, h.d); throw new Error('completion lost'); });
        await h.api.act(save); h.render();
        const committed = await current(h.d);
        const removed = await actual.saveIslandExperience('child', committed.revision, { type: 'delete-layout', layoutId: 'slot-1' }, h.d);
        h.render(removed); const before = await allRows(h.d);
        expect(await h.api.retry!()).toBe(true);
        expect((await current(h.d)).experience!.layouts).toHaveLength(0); expect(await allRows(h.d)).toEqual(before);
        expect(h.onSaved).toHaveBeenLastCalledWith(removed);
    });
    it('publishes and uses the latest revision before React or liveQuery delivers another render', async () => {
        const h = await harness(), oldAct = h.api.act;
        expect(await oldAct(save)).toBe(true); const saved = await current(h.d);
        expect(await oldAct({ type: 'emblem', emblem: 'wave' })).toBe(true);
        expect(hooks.save.mock.calls[1][1]).toBe(saved.revision);
        const latest = await current(h.d); h.render(h.initial);
        expect(await oldAct({ type: 'ambience', ambience: 'brook' })).toBe(true);
        expect(hooks.save.mock.calls[2][1]).toBe(latest.revision);
        expect(h.onSaved).toHaveBeenLastCalledWith(await current(h.d));
    });
    it('keeps a newer query when an older success finally arrives and uses that newer scene for preview', async () => {
        const h = await harness(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandExperience(id, revision, action, h.d); return gate.promise; });
        const pending = h.api.act(save); await vi.waitFor(() => expect(written).toBeDefined());
        const newer = await actual.saveIslandExperience('child', written!.revision, { type: 'rename-island', name: 'あたらしい なまえ' }, h.d);
        h.render(newer); gate.resolve(written!); expect(await pending).toBe(true);
        expect(h.onSaved).toHaveBeenLastCalledWith(newer);
        h.render(h.initial); h.api.preview('slot-1'); h.render(h.initial);
        expect(h.api.previewIsland!.experience!.islandName).toBe('あたらしい なまえ');
        expect(await h.api.act({ type: 'emblem', emblem: 'wave' })).toBe(true);
        expect(hooks.save.mock.calls.at(-1)![1]).toBe(newer.revision);
    });
    it('refreshes a known CAS without recapturing or rebasing; only a new explicit gesture creates the layout', async () => {
        const h = await harness();
        const newer = await actual.saveIslandExperience('child', h.initial.revision, { type: 'resident', residentId: 'rabbit', name: 'いまの うさ', look: 'cap' }, h.d);
        expect(await h.api.act(save)).toBe(false); h.render();
        expect(h.refresh).toHaveBeenCalledWith('child'); expect(h.onSaved).toHaveBeenLastCalledWith(newer);
        expect(h.api.retry).toBeUndefined(); expect(hooks.save).toHaveBeenCalledTimes(1);
        expect((await current(h.d)).experience!.layouts).toHaveLength(0);
        expect(await h.api.act(save)).toBe(true);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, newer.revision]);
        expect((await current(h.d)).experience!.layouts[0].sceneStyle!.residentLooks.rabbit).toBe('cap');
    });
    it('coalesces the same in-flight gesture while refusing a different one before React disables the controls', async () => {
        const h = await harness(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandExperience(id, revision, action, h.d); return gate.promise; });
        const first = h.api.act(save), duplicate = h.api.act(save);
        expect(duplicate).toBe(first);
        expect(await h.api.act({ type: 'emblem', emblem: 'wave' })).toBe(false);
        await vi.waitFor(() => expect(written).toBeDefined());
        expect(hooks.save).toHaveBeenCalledTimes(1); gate.resolve(written!);
        expect(await first).toBe(true);
        expect(await h.d.islandEvents.where('type').equals('experience_changed').count()).toBe(1);
    });
});

describe('experience hook ownership and delayed continuation', () => {
    it.each(['inactive', 'hidden'] as const)('rejects new writes and retry while %s, then permits a fresh gesture', async boundary => {
        const h = await harness();
        if (boundary === 'inactive') h.render(h.initial, false); else h.hidden();
        const before = await allRows(h.d);
        expect(await h.api.act(save)).toBe(false); expect(hooks.save).not.toHaveBeenCalled(); expect(await allRows(h.d)).toEqual(before);
        h.hidden(false); h.render(h.initial, true); expect(await h.api.act(save)).toBe(true);
    });
    it.each(['reset', 'hidden', 'inactive', 'unmounted'] as const)('does not continue a started operation after %s, even when the view comes back', async boundary => {
        const h = await harness(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.saveIslandExperience(id, revision, action, h.d); return gate.promise; });
        const continuation = vi.fn(), pending = h.api.act(save).then(allowed => { if (allowed) continuation(); return allowed; });
        await vi.waitFor(() => expect(written).toBeDefined());
        if (boundary === 'reset') h.api.reset();
        else if (boundary === 'hidden') { h.hidden(); h.hidden(false); }
        else if (boundary === 'inactive') { h.render(h.initial, false); h.render(h.initial, true); }
        else h.unmount();
        gate.resolve(written!); expect(await pending).toBe(false); expect(continuation).not.toHaveBeenCalled();
        expect(await current(h.d)).toEqual(written);
        if (boundary === 'unmounted') expect(h.onSaved).not.toHaveBeenCalled(); else expect(h.onSaved).toHaveBeenLastCalledWith(written);
    });
    it('does not start a deferred common-run writer after learning entry and retries only explicitly on return', async () => {
        const h = await harness(), gate = deferred<void>(); let offered = false;
        h.run.mockImplementationOnce(async action => { offered = true; await gate.promise; return action(); });
        const pending = h.api.act(save); expect(offered).toBe(true);
        h.render(h.initial, false); gate.resolve(); expect(await pending).toBe(false);
        expect(hooks.save).not.toHaveBeenCalled();
        h.render(h.initial, true); expect(h.api.retry).toBeTypeOf('function');
        expect(await h.api.retry!()).toBe(true); expect(hooks.save.mock.calls[0][1]).toBe(h.initial.revision);
    });
    it('separates A and B requests and rejects a stale A callback without abandoning A recovery', async () => {
        const h = await harness(), oldAct = h.api.act;
        hooks.save.mockRejectedValueOnce(new Error('A disk error'));
        await h.api.act(save); h.render();
        const oldRetry = h.api.retry!, app = (await h.d.appData.get('app'))!;
        const other = { ...createInitialProfile('other', 2, 1, 1, 'math'), id: 'other', hissanModeEnabled: false };
        await h.d.profiles.put(other);
        const profiles = { ...app.profiles, other };
        await h.d.appData.put({ ...app, activeProfileId: 'other', profiles });
        const b = await openIsland('other', h.d); h.render(b);
        const before = await allRows(h.d);
        expect(await oldAct({ type: 'emblem', emblem: 'star' })).toBe(false);
        expect(await oldRetry()).toBe(false); expect(await allRows(h.d)).toEqual(before);
        expect(await h.api.act({ type: 'emblem', emblem: 'wave' })).toBe(true);
        const savedB = await current(h.d, 'other');
        expect(savedB.experience!.emblem).toBe('wave');
        await h.d.appData.put({ ...app, activeProfileId: 'child', profiles }); h.render(await current(h.d)); h.render();
        expect(h.api.retry).toBeTypeOf('function'); expect(await h.api.retry!()).toBe(true);
        expect((await current(h.d)).experience!.layouts).toHaveLength(1);
        expect(await current(h.d, 'other')).toEqual(savedB);
        expect(hooks.save.mock.calls.map(call => call[0])).toEqual(['child', 'other', 'child']);
        expect(hooks.save.mock.calls[2][1]).toBe(h.initial.revision);
    });
});
