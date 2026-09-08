import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createIsland } from '../../domain/island/catalog';
import { createInitialProfile } from '../../domain/user/profile';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import { getIslandLearningKeepsakes, type IslandLearningKeepsakeAction } from '../../domain/island/learningKeepsakes';
import type { IslandRecord } from '../../domain/island/types';

// The controlled commit harness delays parent/liveQuery publication. The writer,
// native transactions, receipt lookup, ownership and revision checks remain real.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return { save: vi.fn(), read: vi.fn(), query: undefined as (() => Promise<unknown>) | undefined, live: undefined as unknown, reset() { cells.length = 0; effects.length = 0; cursor = 0; this.query = undefined; this.live = undefined; }, begin() { cursor = 0; },
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
vi.mock('../../domain/island/learningKeepsakesRepository', async original => ({ ...await original<object>(), saveIslandLearningKeepsakes: hooks.save, readIslandLearningKeepsakeSummary: hooks.read }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: (query: () => Promise<unknown>) => { hooks.query = query; return hooks.live; } }));
import { useIslandLearningKeepsakes } from './useIslandLearningKeepsakes';
const actual = await vi.importActual<typeof import('../../domain/island/learningKeepsakesRepository')>('../../domain/island/learningKeepsakesRepository');
const databases: SansuDatabase[] = [];
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async t => [t.name, await t.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); hooks.read.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`keepsake-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const initial = createIsland('child', 1);
    // Explicit aggregate fixture for native receipt/continuation tests; no earned UI claim.
    initial.completedSets = 10;
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } }); await d.islands.put(initial);
    hooks.save.mockImplementation((id: string, rev: number, action: IslandLearningKeepsakeAction) => actual.saveIslandLearningKeepsakes(id, rev, action, d));
    hooks.read.mockImplementation((id, keepsakeId) => actual.readIslandLearningKeepsakeSummary(id, keepsakeId, d));
    vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    const onSaved = vi.fn(), run = vi.fn(async <T,>(write: () => Promise<T>): Promise<T | undefined> => write());
    let island: IslandRecord | undefined = initial, active = true, api!: ReturnType<typeof useIslandLearningKeepsakes>;
    const RenderGoal = (next: IslandRecord | undefined = island, nextActive = active) => {
        island = next; active = nextActive; hooks.begin(); api = useIslandLearningKeepsakes(island, active, run, onSaved); hooks.commit(); return api;
    };
    RenderGoal();
    return { d, initial, run, onSaved, render: RenderGoal, get api() { return api; },
        hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

const certificate: IslandLearningKeepsakeAction = { type: 'display', keepsakeId: 'first-completion', displayed: true };
const trophy: IslandLearningKeepsakeAction = { type: 'display', keepsakeId: 'completed-5', displayed: true };
const storeCertificate: IslandLearningKeepsakeAction = { ...certificate, displayed: false };
describe('keepsake selection, records, and exact native display receipts', () => {
    it('reads an unearned selection without writing, and suppresses stale profile, selection and count histories', async () => {
        const h = await harness(), before = await allRows(h.d);
        hooks.live = await hooks.query!(); h.render();
        expect(h.api.summary?.recordScope).toBe('count-only'); expect(h.api.summary?.completedAt).toBeUndefined();
        h.api.select('completed-1000'); h.render(); expect(h.api.selectedId).toBe('completed-1000'); expect(h.api.summary).toBeUndefined();
        hooks.live = await hooks.query!(); h.render(); expect(h.api.summary?.available).toBe(false);
        h.render({ ...h.initial, completedSets: 11 }); expect(h.api.summary).toBeUndefined();
        h.render(createIsland('other', 1)); expect(h.api.selectedId).toBe('first-completion'); expect(h.api.summary).toBeUndefined();
        expect(hooks.save).not.toHaveBeenCalled(); expect(await allRows(h.d)).toEqual(before);
    });
    it('shows multiple awards, stores one, and displays all for free while preserving every other island branch and table', async () => {
        const h = await harness(), before = await allRows(h.d), oldCallback = h.api.act;
        for (const action of [certificate, trophy, storeCertificate, { type: 'display-earned' } as const]) expect(await oldCallback(action)).toBe(true);
        const saved = await current(h.d), after = await allRows(h.d);
        expect(getIslandLearningKeepsakes(saved).displayed).toEqual(['first-completion', 'completed-5', 'completed-10']);
        const { learningKeepsakes: selection, ...rest } = saved;
        expect(selection).toBeDefined(); expect({ ...rest, revision: h.initial.revision, updatedAt: h.initial.updatedAt }).toEqual(h.initial);
        for (const table of Object.keys(before)) if (!['islands', 'islandEvents'].includes(table)) expect(after[table]).toEqual(before[table]);
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 1, 2, 3]);
    });
    it('keeps the exact committed unknown receipt and never reinstates an older display after another tab stores it', async () => {
        const h = await harness(); hooks.save.mockImplementationOnce(async (id, revision, action) => {
            await actual.saveIslandLearningKeepsakes(id, revision, action, h.d); throw new Error('native completion lost');
        });
        expect(await h.api.act(certificate)).toBe(false); h.render(); expect(h.api.retry).toBeTypeOf('function');
        h.api.select('completed-5'); expect(await h.api.act(trophy)).toBe(false); h.render();
        expect(h.api.selectedId).toBe('first-completion'); expect(hooks.save).toHaveBeenCalledTimes(1);
        const later = await actual.saveIslandLearningKeepsakes('child', 1, storeCertificate, h.d);
        h.render(later, false); h.render(later, true); const before = await allRows(h.d);
        expect(await h.api.retry!()).toBe(true); expect(await allRows(h.d)).toEqual(before);
        expect(h.onSaved).toHaveBeenLastCalledWith(later); expect(hooks.save.mock.calls.map(call => call[1])).toEqual([0, 0]);
        expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]);
        h.render(h.initial); expect(await h.api.act(trophy)).toBe(true); expect(hooks.save.mock.calls.at(-1)![1]).toBe(2);
    });
    it('retains an exact retry when the shared runner loses a committed return value', async () => {
        const h = await harness(); h.run.mockImplementationOnce(async write => { await write(); return undefined; });
        await h.api.act({ type: 'display-earned' }); h.render(); const before = await allRows(h.d);
        expect(h.api.retry).toBeTypeOf('function'); expect(await h.api.retry!()).toBe(true); expect(await allRows(h.d)).toEqual(before);
    });
    it('releases known CAS without rebasing and uses refreshed revision only for a deliberate new action', async () => {
        const h = await harness(), later = await saveIslandExperience('child', 0, { type: 'rename-island', name: 'べつの しま' }, h.d);
        expect(await h.api.act(certificate)).toBe(false); h.render(); expect(h.api.retry).toBeUndefined();
        expect(h.onSaved).toHaveBeenLastCalledWith(later); expect(getIslandLearningKeepsakes(await current(h.d)).displayed).toEqual([]);
        expect(await h.api.act(trophy)).toBe(true); expect(hooks.save.mock.calls.at(-1)![1]).toBe(later.revision);
    });
    it('accepts its own liveQuery before completion without double writing or mutating the caller action', async () => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const row = await actual.saveIslandLearningKeepsakes(id, revision, action, h.d); committed.resolve(row); return response.promise; });
        const input = { ...certificate }, operation = h.api.act(input);
        expect(await h.api.act(trophy)).toBe(false); const written = await committed.promise; h.render(written); response.resolve(written);
        expect(await operation).toBe(true); expect(hooks.save).toHaveBeenCalledTimes(1); expect(Object.isFrozen(input)).toBe(false);
        expect(Object.isFrozen(hooks.save.mock.calls[0][2])).toBe(true);
    });
    it.each(['inactive', 'hidden', 'unmount', 'profile'] as const)('keeps a native commit but suppresses late UI continuation across %s', async boundary => {
        const h = await harness(), committed = deferred<IslandRecord>(), response = deferred<IslandRecord>();
        hooks.save.mockImplementationOnce(async (id, revision, action) => { const row = await actual.saveIslandLearningKeepsakes(id, revision, action, h.d); committed.resolve(row); return response.promise; });
        const operation = h.api.act(certificate), written = await committed.promise;
        if (boundary === 'inactive') { h.render(h.initial, false); h.render(h.initial, true); }
        else if (boundary === 'hidden') { h.hidden(); h.hidden(false); }
        else if (boundary === 'profile') h.render(createIsland('other', 1)); else h.unmount();
        response.resolve(written); expect(await operation).toBe(false); expect(await current(h.d)).toEqual(written);
        if (boundary === 'profile' || boundary === 'unmount') expect(h.onSaved).not.toHaveBeenCalled();
        else expect(h.onSaved).toHaveBeenLastCalledWith(written);
    });
    it('does not begin queued saves or selection changes during learning or while hidden', async () => {
        const h = await harness(), gate = deferred<void>(), before = await allRows(h.d);
        h.run.mockImplementationOnce(async write => { await gate.promise; return write(); });
        const operation = h.api.act(certificate); h.render(h.initial, false); gate.resolve();
        expect(await operation).toBe(false); expect(hooks.save).not.toHaveBeenCalled();
        h.api.select('completed-5'); h.render(); expect(h.api.selectedId).toBe('first-completion');
        h.render(h.initial, true); h.hidden(); expect(await h.api.retry!()).toBe(false); expect(await allRows(h.d)).toEqual(before);
    });
});
