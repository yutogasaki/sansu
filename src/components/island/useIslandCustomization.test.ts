import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { db, SansuDatabase } from '../../db';
import { createIsland } from '../../domain/island/catalog';
import { createInitialProfile } from '../../domain/user/profile';
import { getIslandCosmetics, getIslandCustomization, type IslandCustomizationAction } from '../../domain/island/customization';
import { resolveIslandAppearance } from '../../domain/island/appearance';
import { saveIslandExperience } from '../../domain/island/experienceRepository';
import { getIslandExperience } from '../../domain/island/experience';
import { getIslandExpression } from '../../domain/island/expression';
import { saveIslandRewardGoal } from '../../domain/island/rewardGoalRepository';
import { reduceIslandRewardGoal } from '../../domain/island/rewardGoal';
import type { IslandRecord } from '../../domain/island/types';

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
vi.mock('../../domain/island/customizationRepository', async importOriginal => ({ ...await importOriginal<object>(), customizeIsland: hooks.save }));
import { useIslandCustomization } from './useIslandCustomization';
const actual = await vi.importActual<typeof import('../../domain/island/customizationRepository')>('../../domain/island/customizationRepository');
const databases: SansuDatabase[] = [];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const allRows = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); });
afterEach(async () => { hooks.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function harness() {
    const d = new SansuDatabase(`customization-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    // Explicit local wallet fixture. These tests do not claim earned points or a browser learning flow.
    const initial = createIsland('child', 1); initial.customization = { ...getIslandCustomization(initial), points: 200 };
    const profile = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await d.islands.put(initial); let island = initial, active = true;
    const onSaved = vi.fn(), run = vi.fn(async <T,>(action: () => Promise<T>): Promise<T | undefined> => action());
    hooks.save.mockImplementation((id: string, revision: number, action: IslandCustomizationAction) => actual.customizeIsland(id, revision, action, d));
    const refresh = vi.spyOn(db.islands, 'get').mockImplementation((id: string) => d.islands.get(id));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    let api!: ReturnType<typeof useIslandCustomization>;
    const RenderCustomization = (next = island, accepting = active) => { island = next; active = accepting; hooks.begin(); api = useIslandCustomization(island, active, run, onSaved); hooks.commit(); return api; };
    const render = RenderCustomization; render();
    return { d, initial, run, onSaved, refresh, render, get api() { return api; }, hidden(value = true) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}
const roof = { type: 'purchase' as const, itemId: 'candy-house' as const, slot: 'houseRoof' as const };

describe('part previews and deliberate equipment scope', () => {
    it('keeps a mixed real preview and its selected part through the separate goal writer, then purchases at the latest revision', async () => {
        const h = await harness(); h.api.open(); h.api.select('crystal-plants', 'flower'); h.api.select('candy-house', 'houseRoof'); h.render();
        const preview = h.api.preview;
        let saved = await saveIslandRewardGoal('child', h.initial.revision, { type: 'choose', target: { category: 'customization', itemId: 'candy-house' } }, h.d);
        h.render(saved); h.render(saved);
        expect(h.api.preview).toBe(preview); expect(h.api.selectionReady).toBe(true); expect(h.api.selectedSlot).toBe('houseRoof');
        expect(h.api.selectedId).toBe('candy-house');
        saved = await saveIslandRewardGoal('child', saved.revision, { type: 'clear' }, h.d); h.render(saved); h.render(saved);
        expect(h.api.preview).toBe(preview); expect(h.api.selectionReady).toBe(true);
        await h.api.act(roof); expect(hooks.save.mock.calls.at(-1)![1]).toBe(saved.revision);
    });
    it.each(['absent', 'default', 'default-undefined-appearance'] as const)('keeps %s customization semantics when a goal materializes only the valid default wallet', async initialState => {
        const h = await harness(), old = createIsland('child', 1);
        if (initialState !== 'absent') old.customization = getIslandCustomization(old);
        if (initialState === 'default-undefined-appearance') old.customization!.appearance = undefined;
        await h.d.islands.put(old); h.render(old); h.api.open('starry'); h.render(old);
        const before = structuredClone(old), preview = h.api.preview;
        const goal = await saveIslandRewardGoal('child', old.revision, { type: 'choose', target: { category: 'customization', itemId: 'starry' } }, h.d);
        h.render(goal); h.render(goal); expect(h.api.preview).toBe(preview); expect(h.api.selectionReady).toBe(true);
        expect(old).toEqual(before); expect(getIslandCustomization(goal).points).toBe(getIslandCustomization(old).points);
    });
    it.each(['wallet', 'ownership', 'appearance', 'placement', 'growth', 'experience', 'expression'] as const)('still resets a preview when a goal arrives together with changed %s', async field => {
        const h = await harness(); h.api.open('candy-house'); h.render();
        const changed = reduceIslandRewardGoal(structuredClone(h.initial), { type: 'choose', target: { category: 'furniture', kind: 'telescope' } });
        changed.revision += 1;
        if (field === 'wallet') changed.customization!.points += 1;
        else if (field === 'ownership') changed.customization!.ownedItemIds.push('star-lanterns');
        else if (field === 'appearance') changed.customization!.appearance = resolveIslandAppearance(changed.customization!);
        else if (field === 'placement') changed.items.push({ id: 'new-bench', kind: 'bench', rotation: 0, position: { x: 0, z: 1 } });
        else if (field === 'growth') changed.completedSets += 1;
        else if (field === 'experience') changed.experience = { ...getIslandExperience(changed), islandName: 'かわった しま' };
        else { changed.expression = getIslandExpression(changed); changed.expression.selection.environment.period = 'evening'; }
        h.render(changed); h.render(changed); expect(h.api.preview).toBeUndefined(); expect(h.api.selectionReady).toBe(false);
    });
    it.each(['profile', 'exit'] as const)('does not use goal equivalence to preserve presentation across %s', async boundary => {
        const h = await harness(); h.api.open('candy-house'); h.render();
        const changed = reduceIslandRewardGoal(h.initial, { type: 'choose', target: { category: 'furniture', kind: 'hammock' } }); changed.revision += 1;
        if (boundary === 'profile') changed.profileId = 'other';
        h.render(changed, boundary !== 'exit'); h.render(changed, true);
        expect(h.api.preview).toBeUndefined(); expect(h.api.selectionReady).toBe(false);
    });
    it('opens the exact requested goal product without acquiring it or changing the old goal', async () => {
        const h = await harness(), before = await allRows(h.d);
        h.api.open('candy-house'); h.render();
        expect(h.api.selectedId).toBe('candy-house'); expect(h.api.selectionReady).toBe(true);
        expect(h.api.selectedSlot).toBeUndefined(); expect(hooks.save).not.toHaveBeenCalled(); expect(await allRows(h.d)).toEqual(before);
    });
    it.each(['browse', 'reset'] as const)('clears the default-part selection scope on %s so a theme cannot acquire a roof-only action', async action => {
        const h = await harness(); h.api.open(); h.api.selectRestore('house', 'houseRoof'); h.render();
        expect(h.api.restore).toEqual({ type: 'restore-part', partId: 'house', slot: 'houseRoof' });
        h.api[action](); h.render(); expect(h.api.restore).toBeUndefined(); expect(h.api.selectedSlot).toBeUndefined(); expect(h.api.selectionReady).toBe(false);
        expect(hooks.save).not.toHaveBeenCalled();
    });
    it('opens an old owned theme exactly as saved and does not silently equip the new visual version', async () => {
        const h = await harness();
        const old = { ...h.initial, customization: { ...h.initial.customization!, themeId: 'starry' as const, ownedItemIds: ['moon-garden', 'starry'] as const } };
        const legacy: IslandRecord = { ...old, customization: { ...old.customization, ownedItemIds: [...old.customization.ownedItemIds] } };
        h.render(legacy); h.api.open(); h.render(legacy);
        expect(h.api.preview).toEqual({ themeId: 'starry', accentId: null }); expect(h.api.selectionReady).toBe(false); expect(hooks.save).not.toHaveBeenCalled();
    });
    it('mixes unowned roof and flower previews, undoes only the roof, and leaves all stores untouched', async () => {
        const h = await harness(), before = await allRows(h.d); h.api.open();
        h.api.select('candy-house', 'houseRoof'); h.api.select('crystal-plants', 'flower'); h.render();
        let appearance = resolveIslandAppearance(h.api.preview!);
        expect(appearance.slots.houseRoof).toBe('parts-v1:candy:houseRoof'); expect(appearance.slots.flower).toBe('parts-v1:crystal:flower');
        h.api.undoPart('house', 'houseRoof'); h.render(); appearance = resolveIslandAppearance(h.api.preview!);
        expect(appearance.slots.houseRoof).toBe('legacy-v1:moon-garden:houseRoof'); expect(appearance.slots.flower).toBe('parts-v1:crystal:flower');
        expect(await allRows(h.d)).toEqual(before); expect(hooks.save).not.toHaveBeenCalled();
    });
    it('buys the house rights but applies just the chosen roof, discarding another uncommitted preview', async () => {
        const h = await harness(), before = await allRows(h.d); h.api.open();
        h.api.select('crystal-plants', 'flower'); h.api.select('candy-house', 'houseRoof'); h.render();
        await h.api.act(roof); h.render(); const saved = await current(h.d), appearance = resolveIslandAppearance(getIslandCosmetics(saved));
        expect(getIslandCustomization(saved)).toMatchObject({ points: 175, ownedItemIds: ['moon-garden', 'candy-house'] });
        expect(appearance.slots.houseRoof).toBe('parts-v1:candy:houseRoof'); expect(appearance.slots.houseBody).toBe('legacy-v1:moon-garden:houseBody');
        expect(appearance.slots.flower).toBe('legacy-v1:moon-garden:flower'); expect(h.api.preview).toEqual(getIslandCosmetics(saved));
        const after = await allRows(h.d); for (const key of Object.keys(before)) if (!['islands', 'islandEvents'].includes(key)) expect(after[key]).toEqual(before[key]);
    });
});

describe('uncertain purchase and UI ownership', () => {
    it('keeps the purchase arrival visible when liveQuery publishes its committed row before the writer completes', async () => {
        const h = await harness(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.customizeIsland(id, revision, action, h.d); return gate.promise; });
        const operation = h.api.act(roof); await vi.waitFor(() => expect(written).toBeDefined()); h.render(written!);
        gate.resolve(written!); expect(await operation).toEqual(written); h.render(written!);
        expect(h.api.celebration).toContain('おかしの おうち'); expect(h.api.preview).toEqual(getIslandCosmetics(written!));
    });
    it('retries the same roof receipt after another tab changes the island and never publishes an older state', async () => {
        const h = await harness(); hooks.save.mockImplementationOnce(async (id, revision, action) => { await actual.customizeIsland(id, revision, action, h.d); throw new Error('completion lost'); });
        await h.api.act(roof); h.render(); expect(h.api.retry).toBeTypeOf('function');
        const committed = await current(h.d), later = await saveIslandExperience('child', committed.revision, { type: 'rename-island', name: 'あとの なまえ' }, h.d);
        h.render(later); const before = await allRows(h.d); await h.api.retry!();
        expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, h.initial.revision]); expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]);
        expect(await allRows(h.d)).toEqual(before); expect(h.onSaved).toHaveBeenLastCalledWith(later);
        h.render(h.initial); await h.api.act({ type: 'purchase', itemId: 'starry-water' }); expect(hooks.save.mock.calls.at(-1)![1]).toBe(later.revision);
    });
    it('retains a request even if the shared runner loses a successful result', async () => {
        const h = await harness(); h.run.mockImplementationOnce(async action => { await action(); return undefined; });
        await h.api.act(roof); h.render(); const before = await allRows(h.d); expect(h.api.retry).toBeTypeOf('function');
        expect(getIslandCustomization(await current(h.d)).points).toBe(175);
        await h.api.retry!(); expect(await allRows(h.d)).toEqual(before); expect(hooks.save.mock.calls.map(call => call[1])).toEqual([h.initial.revision, h.initial.revision]);
    });
    it('refuses another action while a result is unknown and keeps retry through closing and reopening', async () => {
        const h = await harness(); hooks.save.mockRejectedValueOnce(new Error('temporary IO')); await h.api.act(roof); h.render();
        await h.api.act({ type: 'purchase', itemId: 'crystal-plants' }); expect(hooks.save).toHaveBeenCalledTimes(1);
        h.api.reset(); h.render(h.initial, false); h.api.open(); h.render(h.initial, true); expect(h.api.retry).toBeTypeOf('function');
        await h.api.retry!(); expect(getIslandCustomization(await current(h.d)).ownedItemIds).toEqual(['moon-garden', 'candy-house']);
    });
    it('refreshes a confirmed conflict and waits for a new explicit selection', async () => {
        const h = await harness(); const newer = await saveIslandExperience('child', h.initial.revision, { type: 'rename-island', name: 'べつの タブ' }, h.d);
        await h.api.act(roof); h.render(); expect(h.api.retry).toBeUndefined(); expect(h.api.selectionReady).toBe(false);
        expect(h.onSaved).toHaveBeenLastCalledWith(newer); expect(hooks.save).toHaveBeenCalledTimes(1); expect(getIslandCustomization(await current(h.d)).points).toBe(200);
        h.api.select('candy-house', 'houseRoof'); await h.api.act(roof); expect(hooks.save.mock.calls.at(-1)![1]).toBe(newer.revision);
    });
    it.each(['inactive', 'hidden', 'unmount'] as const)('keeps a started commit but suppresses its view continuation after %s', async boundary => {
        const h = await harness(), gate = deferred<IslandRecord>(); let written: IslandRecord | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, action) => { written = await actual.customizeIsland(id, revision, action, h.d); return gate.promise; });
        const operation = h.api.act(roof); await vi.waitFor(() => expect(written).toBeDefined());
        if (boundary === 'inactive') { h.render(h.initial, false); h.render(h.initial, true); }
        else if (boundary === 'hidden') { h.hidden(); h.hidden(false); } else h.unmount();
        gate.resolve(written!); expect(await operation).toBeUndefined(); expect(await current(h.d)).toEqual(written);
        if (boundary !== 'unmount') { h.render(); expect(h.api.celebration).toBeUndefined(); } else expect(h.onSaved).not.toHaveBeenCalled();
    });
});
