import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createIsland } from '../../domain/island/catalog';
import { createInitialProfile } from '../../domain/user/profile';
import { getIslandCustomization } from '../../domain/island/customization';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import { getIslandRewardGoal, type IslandRewardGoalAction } from '../../domain/island/rewardGoal';
import type { IslandRecord } from '../../domain/island/types';

// The controlled commit harness delays parent/liveQuery publication. The writer,
// native transactions, receipt lookup, ownership and revision checks remain real.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return { save: vi.fn(), reset() { cells.length = 0; effects.length = 0; cursor = 0; }, begin() { cursor = 0; },
        useState(initial?: unknown) {
            const i = cursor++; if (!cells[i]) cells[i] = { value: initial };
            return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
        },
        useRef(value?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: { current: value } }; return cells[i].value; },
        useCallback(callback: unknown, deps: unknown[]) {
            const i = cursor++; if (!cells[i] || !same(cells[i].deps, deps)) cells[i] = { value: callback, deps }; return cells[i].value;
        },
        effect(callback: () => void | (() => void), deps?: unknown[]) {
            const i = cursor++, previous = cells[i];
            if (!previous || !same(previous.deps, deps)) { cells[i] = { deps, cleanup: previous?.cleanup };
                effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; }); }
        },
        commit() { for (const effect of effects.splice(0)) effect(); }, unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useLayoutEffect: hooks.effect }));
vi.mock('../../domain/island/rewardGoalRepository', async original => ({ ...await original<object>(), saveIslandRewardGoal: hooks.save }));
import { useIslandRewardGoal } from './useIslandRewardGoal';
const actual = await vi.importActual<typeof import('../../domain/island/rewardGoalRepository')>('../../domain/island/rewardGoalRepository');
const databases: SansuDatabase[] = [];
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async t => [t.name, await t.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`reward-goal-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const initial = createIsland('child', 1);
    // Explicit wallet fixture for error/continuation boundaries, not a claim of earned UI points.
    initial.customization = { ...getIslandCustomization(initial), points: 100 };
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } }); await d.islands.put(initial);
    hooks.save.mockImplementation((id: string, rev: number, action: IslandRewardGoalAction) => actual.saveIslandRewardGoal(id, rev, action, d));
    vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    const onSaved = vi.fn(), run = vi.fn(async <T,>(write: () => Promise<T>): Promise<T | undefined> => write());
    let island = initial, active: string | undefined = 'home', api!: ReturnType<typeof useIslandRewardGoal>;
    const RenderGoal = (next = island, nextActive: string | false = active ?? false) => {
        island = next; active = nextActive === false ? undefined : nextActive; hooks.begin(); api = useIslandRewardGoal(island, active, run, onSaved); hooks.commit(); return api;
    };
    RenderGoal();
    return { d, initial, run, onSaved, render: RenderGoal, get api() { return api; },
        hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

const choose = (target: Extract<IslandRewardGoalAction, { type: 'choose' }>['target']): IslandRewardGoalAction => ({ type: 'choose', target });
const hammock = choose({ category: 'furniture', kind: 'hammock' });
const bird = choose({ category: 'expression', itemId: 'leaf-bird-flag-trim' });
describe('one optional goal with exact receipts and screen ownership', () => {
    it('changes all three categories and clears for free without changing learning, wallet, or any other table', async () => {
        const h = await harness(), before = await allRows(h.d), api = h.api;
        for (const action of [choose({ category: 'customization', itemId: 'starry' }), hammock, bird]) {
            expect(await api.action(action)).toBe(true);
            expect(getIslandRewardGoal(await current(h.d))).toEqual(action.type === 'choose' ? action.target : null);
        }
        expect(await api.action({ type: 'clear' })).toBe(true);
        const saved = await current(h.d), after = await allRows(h.d);
        expect(getIslandRewardGoal(saved)).toBeNull(); expect(saved.customization).toEqual(h.initial.customization);
        expect({ ...saved, revision: h.initial.revision, updatedAt: h.initial.updatedAt }).toEqual(h.initial);
        for (const table of Object.keys(before)) if (!['islands', 'islandEvents'].includes(table)) expect(after[table]).toEqual(before[table]);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1, 2, 3]);
    });
    it('retries a committed unknown intent with its exact original revision after a newer cross-category choice', async () => {
        const h = await harness(); hooks.save.mockImplementationOnce(async (id, revision, action) => {
            await actual.saveIslandRewardGoal(id, revision, action, h.d); throw new Error('native completion lost');
        });
        expect(await h.api.action(hammock)).toBe(false); h.render(); expect(h.api.retry).toBeTypeOf('function');
        expect(await h.api.action(bird)).toBe(false); expect(hooks.save).toHaveBeenCalledTimes(1);
        const later = await actual.saveIslandRewardGoal('child', 1, bird, h.d);
        h.render(later, false); h.render(later, 'expression');
        const before = await allRows(h.d); expect(await h.api.retry!()).toBe(true);
        expect(await allRows(h.d)).toEqual(before); expect(h.onSaved).toHaveBeenLastCalledWith(later);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 0]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]);
    });
    it('keeps the same retry when the shared runner loses a committed return value', async () => {
        const h = await harness(); h.run.mockImplementationOnce(async write => { await write(); return undefined; });
        await h.api.action(bird); h.render(); const before = await allRows(h.d);
        expect(h.api.retry).toBeTypeOf('function'); expect(await h.api.retry!()).toBe(true); expect(await allRows(h.d)).toEqual(before);
    });
    it('releases a known CAS rejection and requires a deliberate new choice at the refreshed revision', async () => {
        const h = await harness(), later = await saveIslandExperience('child', 0, { type: 'rename-island', name: 'べつの しま' }, h.d);
        expect(await h.api.action(hammock)).toBe(false); h.render(); expect(h.api.retry).toBeUndefined();
        expect(h.onSaved).toHaveBeenLastCalledWith(later); expect(getIslandRewardGoal(await current(h.d))).toBeNull();
        expect(await h.api.action(bird)).toBe(true); expect(hooks.save.mock.calls.at(-1)![1]).toBe(later.revision);
    });
    it('does not double write or mutate a caller-owned target, and tolerates its own liveQuery before completion', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const row = await actual.saveIslandRewardGoal(id, revision, action, h.d); committed.resolve(row); return response.promise; });
        const input = choose({ category: 'furniture', kind: 'telescope' }), operation = h.api.action(input);
        expect(await h.api.action(bird)).toBe(false);
        const written = await committed.promise; h.render(written); response.resolve(written);
        expect(await operation).toBe(true); expect(hooks.save).toHaveBeenCalledTimes(1);
        expect(Object.isFrozen(input)).toBe(false);
        const sent = hooks.save.mock.calls[0][2]; expect(Object.isFrozen(sent)).toBe(true); expect(Object.isFrozen(sent.target)).toBe(true);
    });
    it.each(['screen', 'inactive', 'hidden', 'unmount', 'profile'] as const)('preserves native commits but refuses late continuations after %s, including return', async boundary => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const row = await actual.saveIslandRewardGoal(id, revision, action, h.d); committed.resolve(row); return response.promise; });
        const operation = h.api.action(bird), written = await committed.promise;
        if (boundary === 'screen') { h.render(h.initial, 'furniture'); h.render(h.initial, 'home'); }
        else if (boundary === 'inactive') { h.render(h.initial, false); h.render(h.initial, 'home'); }
        else if (boundary === 'hidden') { h.hidden(); h.hidden(false); }
        else if (boundary === 'profile') h.render(createIsland('other', 1)); else h.unmount();
        response.resolve(written); expect(await operation).toBe(false); expect(await current(h.d)).toEqual(written);
        if (boundary === 'profile' || boundary === 'unmount') expect(h.onSaved).not.toHaveBeenCalled();
        else expect(h.onSaved).toHaveBeenLastCalledWith(written);
    });
    it('never starts a deferred write after leaving its originating screen', async () => {
        const h = await harness(), gate = deferred<void>(); h.run.mockImplementationOnce(async write => { await gate.promise; return write(); });
        const operation = h.api.action(hammock); h.render(h.initial, 'expression'); gate.resolve();
        expect(await operation).toBe(false); expect(hooks.save).not.toHaveBeenCalled(); expect(getIslandRewardGoal(await current(h.d))).toBeNull();
        h.render(); expect(h.api.retry).toBeTypeOf('function');
    });
});
