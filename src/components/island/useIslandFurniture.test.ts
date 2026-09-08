import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createIsland } from '../../domain/island/catalog';
import { createInitialProfile } from '../../domain/user/profile';
import { getIslandCustomization } from '../../domain/island/customization';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import type { IslandFurnitureAction } from '../../domain/island/furniture';
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
vi.mock('../../domain/island/furnitureRepository', async original => ({ ...await original<object>(), acquireIslandFurniture: hooks.save }));
import { useIslandFurniture } from './useIslandFurniture';
const actual = await vi.importActual<typeof import('../../domain/island/furnitureRepository')>('../../domain/island/furnitureRepository');
const databases: SansuDatabase[] = [];
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async t => [t.name, await t.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`furniture-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const initial = createIsland('child', 1);
    // Explicit wallet fixture for error/continuation boundaries, not a claim of earned UI points.
    initial.customization = { ...getIslandCustomization(initial), points: 100 };
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } }); await d.islands.put(initial);
    hooks.save.mockImplementation((id: string, rev: number, action: IslandFurnitureAction) => actual.acquireIslandFurniture(id, rev, action, d));
    vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    const onSaved = vi.fn(), run = vi.fn(async <T,>(write: () => Promise<T>): Promise<T | undefined> => write());
    let island = initial, active = true, api!: ReturnType<typeof useIslandFurniture>;
    const RenderFurniture = (next = island, nextActive = active) => {
        island = next; active = nextActive; hooks.begin(); api = useIslandFurniture(island, active, run, onSaved); hooks.commit(); return api;
    };
    RenderFurniture();
    return { d, initial, run, onSaved, render: RenderFurniture, get api() { return api; },
        hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

describe('furniture purchase receipt and UI continuation', () => {
    it('adopts an actual stored acquisition before liveQuery paints and uses its revision for the next purchase', async () => {
        const h = await harness(), oldApi = h.api, before = await allRows(h.d);
        const first = await oldApi.purchase('hammock'); expect(first?.items.find(i => i.id === 'optional-hammock')).toEqual({ id: 'optional-hammock', kind: 'hammock', rotation: 0 });
        const second = await oldApi.purchase('telescope'); expect(second?.customization?.points).toBe(45);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1]);
        const after = await allRows(h.d); for (const table of Object.keys(before)) if (!['islands', 'islandEvents'].includes(table)) expect(after[table]).toEqual(before[table]);
    });
    it('keeps the purchase continuation when its own liveQuery commit is delivered before the response', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => {
            const written = await actual.acquireIslandFurniture(id, revision, action, h.d); committed.resolve(written); return response.promise;
        });
        const operation = h.api.purchase('telescope'), written = await committed.promise; h.render(written); response.resolve(written);
        expect(await operation).toEqual(written); expect(h.onSaved).toHaveBeenLastCalledWith(written);
    });
    it('retains an unknown receipt through close/reopen, rejects another kind, and preserves a newer island on retry', async () => {
        const h = await harness(); hooks.save.mockImplementationOnce(async (id, revision, action) => {
            await actual.acquireIslandFurniture(id, revision, action, h.d); throw new Error('commit response lost');
        });
        await h.api.purchase('telescope'); h.render(); expect(h.api.pendingKind).toBe('telescope'); expect(h.api.retry).toBeTypeOf('function');
        await h.api.purchase('hammock'); expect(hooks.save).toHaveBeenCalledTimes(1);
        h.api.reset(); h.render(h.initial, false); h.render(h.initial, true); expect(h.api.retry).toBeTypeOf('function');
        const purchased = await current(h.d), later = await saveIslandExperience('child', purchased.revision, { type: 'rename-island', name: 'あとの しま' }, h.d);
        h.render(later); const before = await allRows(h.d); expect(await h.api.retry!()).toEqual(later);
        expect(await allRows(h.d)).toEqual(before); expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 0]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]); h.render(later); expect(h.api.retry).toBeUndefined();
    });
    it('keeps the receipt when the shared runner loses its completion value', async () => {
        const h = await harness(); h.run.mockImplementationOnce(async action => { await action(); return undefined; });
        await h.api.purchase('hammock'); h.render(); const before = await allRows(h.d);
        expect(h.api.retry).toBeTypeOf('function'); await h.api.retry!(); expect(await allRows(h.d)).toEqual(before);
    });
    it('refreshes a known CAS conflict and requires a new deliberate purchase', async () => {
        const h = await harness(), later = await saveIslandExperience('child', 0, { type: 'rename-island', name: 'べつの タブ' }, h.d);
        expect(await h.api.purchase('hammock')).toBeUndefined(); h.render(); expect(h.api.retry).toBeUndefined(); expect(h.onSaved).toHaveBeenLastCalledWith(later);
        expect((await current(h.d)).customization?.points).toBe(100); await h.api.purchase('hammock'); expect(hooks.save.mock.calls.at(-1)![1]).toBe(later.revision);
    });
    it.each(['inactive', 'hidden', 'unmount', 'profile'] as const)('preserves a started write but never opens placement after %s', async boundary => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const written = await actual.acquireIslandFurniture(id, revision, action, h.d); committed.resolve(written); return response.promise; });
        const operation = h.api.purchase('tea-table'), written = await committed.promise;
        if (boundary === 'inactive') { h.render(h.initial, false); h.render(h.initial, true); }
        else if (boundary === 'hidden') { h.hidden(); h.hidden(false); }
        else if (boundary === 'profile') h.render(createIsland('other', 1)); else h.unmount();
        response.resolve(written); expect(await operation).toBeUndefined(); expect(await current(h.d)).toEqual(written);
        if (boundary === 'profile' || boundary === 'unmount') expect(h.onSaved).not.toHaveBeenCalled();
    });
    it('refuses a second click during a native response gate and can continue after the real promise finishes', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const written = await actual.acquireIslandFurniture(id, revision, action, h.d); committed.resolve(written); return response.promise; });
        const operation = h.api.purchase('hammock'), written = await committed.promise;
        expect(await h.api.purchase('hammock')).toBeUndefined(); expect(hooks.save).toHaveBeenCalledTimes(1); response.resolve(written); await operation;
        await h.api.purchase('telescope'); expect(hooks.save.mock.calls.at(-1)![1]).toBe(written.revision);
    });
});
