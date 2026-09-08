import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createIsland } from '../../domain/island/catalog';
import { createInitialProfile } from '../../domain/user/profile';
import { getIslandCustomization } from '../../domain/island/customization';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import type { IslandExpressionAction } from '../../domain/island/expression';
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
vi.mock('../../domain/island/expressionRepository', async original => ({ ...await original<object>(), saveIslandExpression: hooks.save }));
import { useIslandExpression } from './useIslandExpression';
const actual = await vi.importActual<typeof import('../../domain/island/expressionRepository')>('../../domain/island/expressionRepository');
const databases: SansuDatabase[] = [];
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async t => [t.name, await t.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`expression-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const initial = createIsland('child', 1);
    // Explicit wallet fixture for error/continuation boundaries, not a claim of earned UI points.
    initial.customization = { ...getIslandCustomization(initial), points: 100 };
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } }); await d.islands.put(initial);
    hooks.save.mockImplementation((id: string, rev: number, action: IslandExpressionAction) => actual.saveIslandExpression(id, rev, action, d));
    vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    const onSaved = vi.fn(), run = vi.fn(async <T,>(write: () => Promise<T>): Promise<T | undefined> => write());
    let island = initial, active = true, api!: ReturnType<typeof useIslandExpression>;
    const RenderExpression = (next = island, nextActive = active) => {
        island = next; active = nextActive; hooks.begin(); api = useIslandExpression(island, active, run, onSaved); hooks.commit(); return api;
    };
    RenderExpression();
    return { d, initial, run, onSaved, render: RenderExpression, get api() { return api; },
        hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}


describe('expression acquisition, preview and exact receipt continuation', () => {
    it('drops a preview and never publishes another profile’s late acquisition into the newly opened profile', async () => {
        const h = await harness(), release = deferred<void>(), committed = deferred<void>();
        const other = createIsland('other', 2), beforeOther = structuredClone(other);
        h.api.preview({ type: 'equip-outfit', residentId: 'rabbit', itemId: 'raincoat' }); h.render();
        h.run.mockImplementationOnce(async write => { const result = await write(); committed.resolve(); await release.promise; return result; });
        const operation = h.api.action({ type: 'acquire', itemId: 'raincoat' });
        await committed.promise;
        h.render(other); h.render(other);
        expect(h.api.previewState).toBeUndefined(); expect(h.api.pending).toBeUndefined();
        release.resolve(); expect(await operation).toBe(false);
        expect(h.onSaved).not.toHaveBeenCalled(); expect(other).toEqual(beforeOther);
        expect((await current(h.d)).expression?.ownedItemIds).toEqual(['raincoat']);
        h.render(await current(h.d)); h.render();
        expect(h.api.pending).toBeUndefined(); expect(h.api.previewState).toBeUndefined();
    });
    it('previews without writes, acquires without equipping, then uses the new revision to equip', async () => {
        const h = await harness(), before = await allRows(h.d), oldApi = h.api;
        oldApi.preview({ type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }); h.render();
        expect(h.api.previewState?.selection.residents.otter.outfit).toBe('raincoat');
        expect(await allRows(h.d)).toEqual(before);
        expect(await oldApi.action({ type: 'acquire', itemId: 'raincoat' })).toBe(true);
        const acquired = await current(h.d);
        expect(acquired.expression?.ownedItemIds).toContain('raincoat');
        expect(acquired.expression?.selection.residents.otter.outfit).toBeNull();
        expect(await oldApi.action({ type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' })).toBe(true);
        expect((await current(h.d)).expression?.selection.residents.otter.outfit).toBe('raincoat');
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1]);
        h.render(); expect(h.api.previewState).toBeUndefined();
        const after = await allRows(h.d);
        for (const table of Object.keys(before)) if (!['islands', 'islandEvents'].includes(table)) expect(after[table]).toEqual(before[table]);
    });
    it('retains the original unknown acquisition through close/reopen and rejects another intent', async () => {
        const h = await harness();
        hooks.save.mockImplementationOnce(async (id, revision, action) => {
            await actual.saveIslandExpression(id, revision, action, h.d); throw new Error('commit response lost');
        });
        expect(await h.api.action({ type: 'acquire', itemId: 'raincoat' })).toBe(false); h.render();
        expect(h.api.retry).toBeTypeOf('function');
        await h.api.action({ type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' });
        expect(hooks.save).toHaveBeenCalledTimes(1);
        h.api.reset(); h.render(h.initial, false); h.render(h.initial, true);
        const acquired = await current(h.d);
        const later = await saveIslandExperience('child', acquired.revision, { type: 'rename-island', name: 'あとの しま' }, h.d);
        h.render(later); const before = await allRows(h.d);
        expect(await h.api.retry!()).toBe(true);
        expect(await allRows(h.d)).toEqual(before);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 0]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]);
        expect(h.onSaved).toHaveBeenLastCalledWith(later);
        h.render(later); expect(h.api.retry).toBeUndefined();
    });
    it('preserves a receipt whose outer shared runner lost the completion value', async () => {
        const h = await harness(); h.run.mockImplementationOnce(async write => { await write(); return undefined; });
        await h.api.action({ type: 'acquire', itemId: 'leaf-album-cover' }); h.render();
        const before = await allRows(h.d); expect(h.api.retry).toBeTypeOf('function');
        expect(await h.api.retry!()).toBe(true); expect(await allRows(h.d)).toEqual(before);
    });
    it('accepts its liveQuery update before completion without invalidating the same operation', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => {
            const written = await actual.saveIslandExpression(id, revision, action, h.d);
            committed.resolve(written); return response.promise;
        });
        const operation = h.api.action({ type: 'period', period: 'evening' });
        const written = await committed.promise; h.render(written); response.resolve(written);
        expect(await operation).toBe(true); expect(h.onSaved).toHaveBeenLastCalledWith(written);
    });
    it('adopts a late stored result after leaving without resuming a preview', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        h.api.preview({ type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }); h.render();
        hooks.save.mockImplementationOnce(async (id, revision, action) => {
            const written = await actual.saveIslandExpression(id, revision, action, h.d);
            committed.resolve(written); return response.promise;
        });
        const operation = h.api.action({ type: 'acquire', itemId: 'raincoat' });
        const written = await committed.promise; h.render(h.initial, false); response.resolve(written);
        expect(await operation).toBe(false); expect(h.onSaved).toHaveBeenLastCalledWith(written);
        h.render(h.initial, false); expect(h.api.previewState).toBeUndefined();
        h.render(written, true); expect(h.api.previewState).toBeUndefined();
        expect((await current(h.d)).expression?.selection.residents.otter.outfit).toBeNull();
    });
    it('cancels a hidden preview and refuses a writer that has not started', async () => {
        const h = await harness(), release = deferred<void>(), before = await allRows(h.d);
        h.api.preview({ type: 'season', season: 'winter' }); h.render();
        expect(h.api.previewState).toBeDefined();
        h.run.mockImplementationOnce(async write => { await release.promise; return write(); });
        const operation = h.api.action({ type: 'season', season: 'winter' });
        h.hidden(); h.render(); expect(h.api.previewState).toBeUndefined();
        release.resolve(); expect(await operation).toBe(false);
        expect(hooks.save).not.toHaveBeenCalled(); expect(await allRows(h.d)).toEqual(before);
        h.hidden(false); h.render(); expect(h.api.retry).toBeTypeOf('function');
        expect(await h.api.retry!()).toBe(true);
        expect((await current(h.d)).expression?.selection.environment.season).toBe('winter');
    });
    it('refreshes known CAS without automatically changing or retrying the old choice', async () => {
        const h = await harness();
        const later = await saveIslandExperience('child', 0, { type: 'rename-island', name: 'べつの タブ' }, h.d);
        expect(await h.api.action({ type: 'acquire', itemId: 'raincoat' })).toBe(false); h.render();
        expect(h.api.pending).toBeUndefined(); expect(h.api.retry).toBeUndefined();
        expect(h.onSaved).toHaveBeenLastCalledWith(later); expect((await current(h.d)).customization?.points).toBe(100);
        expect(await h.api.action({ type: 'acquire', itemId: 'star-beret' })).toBe(true);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1]);
        expect((await current(h.d)).expression?.ownedItemIds).toEqual(['star-beret']);
    });
    it('retires a rejected environment preview so a refreshed island requires a new visible selection', async () => {
        const h = await harness();
        h.api.preview({ type: 'season', season: 'winter' }); h.render();
        expect(h.api.previewState?.selection.environment.season).toBe('winter');
        const latest = await saveIslandExperience('child', 0, { type: 'rename-island', name: 'いまの しま' }, h.d);
        expect(await h.api.action(h.api.previewAction!)).toBe(false); h.render();
        expect(h.api.previewAction).toBeUndefined(); expect(h.api.previewState).toBeUndefined();
        expect(h.api.pending).toBeUndefined(); expect(h.api.retry).toBeUndefined();
        expect(h.onSaved).toHaveBeenLastCalledWith(latest);
        expect((await current(h.d)).expression).toBeUndefined();
        h.api.preview({ type: 'season', season: 'summer' }); h.render();
        expect(await h.api.action(h.api.previewAction!)).toBe(true);
        expect((await current(h.d)).expression?.selection.environment.season).toBe('summer');
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1]);
    });
});
