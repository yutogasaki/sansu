import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { learningDay, newLife } from '../../../domain/islandLife/model';
import { IslandLifeDatabase, type LifeIntent } from '../../../domain/islandLife/repository';

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
vi.mock('../../../domain/islandLife/model', async original => ({ ...await original<object>(), lifeEnabled: () => true }));
vi.mock('../../../domain/islandLife/repository', async original => ({ ...await original<object>(), terminalFacts: hooks.facts, updateLife: hooks.update }));
import { useIslandLife } from './useIslandLife';
const actual = await vi.importActual<typeof import('../../../domain/islandLife/repository')>('../../../domain/islandLife/repository');
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const databases: IslandLifeDatabase[] = [];
beforeEach(() => { hooks.reset(); hooks.facts.mockReset().mockResolvedValue([]); hooks.update.mockReset(); });
afterEach(async () => { hooks.unmount(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } vi.unstubAllGlobals(); });
async function harness() {
    const d = new IslandLifeDatabase(`life-controls-${crypto.randomUUID()}`); databases.push(d);
    for (const id of ['a', 'b']) { const record = newLife(id, 100); record.credits = Array.from({ length: 4 }, (_, i) => ({ id: `fixture-${i}`, at: 100, day: learningDay(100) })); await d.worlds.put(record); }
    hooks.update.mockImplementation((id, facts, intent) => actual.updateLife(id, facts, intent, 1000, d));
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('document', doc); vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn() });
    let id = 'a', active = true, api!: ReturnType<typeof useIslandLife>;
    const RenderLife = (nextId = id, nextActive = active) => { id = nextId; active = nextActive; hooks.begin(); api = useIslandLife(id, active); hooks.commit(); return api; };
    RenderLife(); await vi.waitFor(() => { RenderLife(); expect(api.record).toBeDefined(); });
    return { d, render: RenderLife, get api() { return api; }, doc, intent: (): LifeIntent => ({ id: crypto.randomUUID(), revision: api.record!.revision, command: { type: 'buy', kind: 'bench', cell: { x: 4, z: 2 } } }) };
}
describe('island life background refresh and explicit choices', () => {
    it('holds PWA reload until a pending save commits and releases after failure', async () => {
        const h = await harness(), held = deferred<[]>();
        expect(persistence.count).toBe(0);
        hooks.facts.mockImplementationOnce(() => held.promise);
        const save = h.api.refresh(h.intent()); expect(persistence.count).toBe(1);
        held.resolve([]); expect(await save).toBe(true); expect(persistence.count).toBe(0);
        hooks.update.mockRejectedValueOnce(new Error('save failed'));
        expect(await h.api.refresh()).toBe(false); expect(persistence.count).toBe(0);
    });
    it('keeps choices enabled, queues one purchase and adopts only its own background revision', async () => {
        const h = await harness(), hold = deferred<[]>(); hooks.facts.mockImplementationOnce(() => hold.promise);
        const read = h.api.refresh(); h.render(); expect(h.api.busy).toBe(false);
        const intent = h.intent(), original = structuredClone(intent), save = h.api.refresh(intent); h.render(); expect(h.api.busy).toBe(true);
        expect(persistence.count).toBe(2);
        expect(await h.api.refresh(h.intent())).toBe(false); expect(await h.api.refresh()).toBe(false);
        expect((await h.d.worlds.get('a'))!.actions).toHaveLength(0);
        hold.resolve([]); expect(await read).toBe(true); expect(await save).toBe(true); expect(persistence.count).toBe(0);
        const row = (await h.d.worlds.get('a'))!; expect(row.actions).toHaveLength(1); expect(row.actions[0].id).toBe(intent.id);
        expect(intent).toEqual(original); expect(hooks.update.mock.calls.at(-1)![2].revision).toBe(original.revision + 1);
        h.render(); expect(h.api.busy).toBe(false);
    });
    it('accepts an old displayed revision across completed own refreshes before React paints', async () => {
        const h = await harness(), intent = h.intent();
        await h.api.refresh(); await h.api.refresh(); // deliberately retain the original rendered API
        expect(await h.api.refresh(intent)).toBe(true); expect((await h.d.worlds.get('a'))!.actions).toHaveLength(1);
    });
    it('does not rebase over an external writer picked up by its background refresh', async () => {
        const h = await harness(), intent = h.intent(), hold = deferred<[]>(); hooks.facts.mockImplementationOnce(() => hold.promise);
        const read = h.api.refresh(), save = h.api.refresh(intent);
        await actual.updateLife('a', [], undefined, 1001, h.d); hold.resolve([]);
        await read; expect(await save).toBe(false); h.render(); expect(h.api.error).toContain('しまが かわった');
        expect((await h.d.worlds.get('a'))!.actions).toHaveLength(0);
    });
    it('retains an unknown committed intent through automatic refresh and retries it once', async () => {
        const h = await harness(); hooks.update.mockImplementationOnce(async (id, facts, intent) => { await actual.updateLife(id, facts, intent, 1000, h.d); throw new Error('completion lost'); });
        const intent = h.intent(); expect(await h.api.refresh(intent)).toBe(false); h.render();
        const count = hooks.update.mock.calls.length; expect(await h.api.refresh()).toBe(false); expect(hooks.update).toHaveBeenCalledTimes(count);
        expect(h.api.error).toBe('completion lost'); expect(await h.api.retry()).toBe(true);
        expect((await h.d.worlds.get('a'))!.actions).toHaveLength(1); expect(hooks.update.mock.calls.at(-1)![2]).toEqual(intent);
    });
    it('keeps a queued purchase retryable when the preceding background read fails', async () => {
        const h = await harness(), hold = deferred<[]>(); hooks.facts.mockImplementationOnce(async () => { await hold.promise; throw new Error('read failed'); });
        const read = h.api.refresh(), intent = h.intent(), save = h.api.refresh(intent); hold.resolve([]);
        expect(await read).toBe(false); expect(await save).toBe(false); h.render(); expect(h.api.error).toBe('read failed');
        expect(await h.api.refresh()).toBe(false); expect(await h.api.retry()).toBe(true);
        expect((await h.d.worlds.get('a'))!.actions.map(a => a.id)).toEqual([intent.id]);
    });
    it('does not restore a canceled purchase to retry when the background read fails after leaving and returning', async () => {
        const h = await harness(), hold = deferred<[]>(); hooks.facts.mockImplementationOnce(async () => { await hold.promise; throw new Error('read failed'); });
        const read = h.api.refresh(), save = h.api.refresh(h.intent());
        h.render('a', false); h.render('a', true); hold.resolve([]);
        expect(await read).toBe(false); expect(await save).toBe(false);
        expect(await h.api.retry()).toBe(true);
        expect((await h.d.worlds.get('a'))!.actions).toHaveLength(0);
    });
    it.each(['leave', 'leave-and-return', 'profile', 'unmount'] as const)('cancels the unstarted queued purchase on %s', async boundary => {
        const h = await harness(), hold = deferred<[]>(); hooks.facts.mockImplementationOnce(() => hold.promise);
        const read = h.api.refresh(), save = h.api.refresh(h.intent());
        if (boundary === 'profile') h.render('b');
        else if (boundary === 'unmount') hooks.unmount();
        else { h.render('a', false); if (boundary === 'leave-and-return') h.render('a', true); }
        hold.resolve([]); await read; expect(await save).toBe(false);
        expect((await h.d.worlds.get('a'))!.actions).toHaveLength(0); expect((await h.d.worlds.get('b'))!.actions).toHaveLength(0);
    });
    it('finishes an already-started save for its owner without returning a placement continuation after leaving', async () => {
        const h = await harness(), committed = deferred<void>(), release = deferred<void>();
        hooks.update.mockImplementationOnce(async (id, facts, intent) => { const saved = await actual.updateLife(id, facts, intent, 1000, h.d); committed.resolve(); await release.promise; return saved; });
        const save = h.api.refresh(h.intent()); await committed.promise; h.render('a', false); h.render('a', true); release.resolve();
        expect(await save).toBe(false); expect((await h.d.worlds.get('a'))!.actions).toHaveLength(1);
    });
});
