import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { assertIsland, IslandConflict } from './repository';
import { canonicalIslandWorkshopAction, getIslandWorkshop, getWorkshopAssemblableParts, getWorkshopSpecimenName,
    getWorkshopToolResult, hasValidIslandWorkshop, IslandWorkshopConflict, reduceIslandWorkshop, WORKSHOP_CLEAN_MASK,
    WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, WORKSHOP_TOOL_IDS, workshopLayoutKey,
    type IslandWorkshopAction, type IslandWorkshopState, type WorkshopObservationResult, type WorkshopSpecimenId } from './workshop';
import { createEmptyWorkshopLayout, simulateWorkshop, WorkshopLayoutConflict, type WorkshopDraftEdit, type WorkshopPartId } from './workshopLayout';
import type { IslandRecord } from './types';

const ready = (): IslandRecord => ({ ...createIsland('child', 0), completedSets: 1 });
const act = (island: IslandRecord, action: IslandWorkshopAction, now = 10) => reduceIslandWorkshop(island, action, now);
function brush(island: IslandRecord, specimenId: WorkshopSpecimenId) {
    for (let section = 0; section < 6; section++) island = act(island, { type: 'brush', specimenId, section });
    return island;
}
const observe = (island: IslandRecord, specimenId: WorkshopSpecimenId, result: WorkshopObservationResult, now = 20) => act(island,
    { type: 'observe-specimen', specimenId, result, cleanedMask: getIslandWorkshop(island).specimens[specimenId].cleanedMask }, now);
function identify(island: IslandRecord, specimenId: WorkshopSpecimenId) {
    return observe(observe(brush(island, specimenId), specimenId, 'clean'), specimenId, WORKSHOP_SPECIMENS[specimenId].identityResult);
}
const edit = (island: IslandRecord, action: WorkshopDraftEdit) => act(island, { type: 'edit-draft', edit: action });
function materialized() { return WORKSHOP_SPECIMEN_IDS.reduce(identify, ready()); }
function successful() {
    let island = materialized();
    for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
        island = edit(island, { type: 'assemble', partId });
        island = edit(island, { type: 'move', partId, position: { col, row: 1 } });
    }
    return island;
}

describe('finite owned specimens and visible observations', () => {
    it('reads optional old data without materializing it and gives each profile independent stable identities', () => {
        const island = createIsland('child', 0), before = structuredClone(island), state = getIslandWorkshop(island);
        expect(hasValidIslandWorkshop(island)).toBe(true);
        expect(Object.keys(state.specimens)).toEqual([...WORKSHOP_SPECIMEN_IDS]);
        expect(state.shelves).toEqual({ 'shelf-1': null, 'shelf-2': null, 'shelf-3': null });
        expect(state.works).toEqual({}); expect(state.creations).toEqual([]);
        expect(state.draftCheckpoint.draft.layout).toEqual(createEmptyWorkshopLayout());
        expect(state.specimens.driftwood.id).toBe('island-workshop:v1:specimen:child:driftwood');
        expect(getIslandWorkshop({ ...island, profileId: 'other' }).specimens.driftwood.id).not.toBe(state.specimens.driftwood.id);
        state.specimens.driftwood.cleanedMask = 63; state.draftCheckpoint.draft.layout.parts.straight.rotation = 1;
        expect(getIslandWorkshop(island).specimens.driftwood.cleanedMask).toBe(0);
        expect(island).toEqual(before);
        expect(() => act(island, { type: 'brush', specimenId: 'driftwood', section: 0 })).toThrowError(IslandWorkshopConflict);
        expect(island).toEqual(before);
    });

    it.each(WORKSHOP_SPECIMEN_IDS)('keeps %s identity through all six confirmed regions and all three tools, without awarding an unrendered result', specimenId => {
        let island = ready(); const original = getIslandWorkshop(island).specimens[specimenId].id;
        const dirty = getIslandWorkshop(island);
        expect(getWorkshopToolResult(dirty, specimenId, 'brush')).toBeUndefined();
        expect(getWorkshopToolResult(dirty, specimenId, 'lamp')).toBe(specimenId === 'seaglass' ? undefined : 'opaque');
        expect(getWorkshopToolResult(dirty, specimenId, 'water')).toBe(WORKSHOP_SPECIMENS[specimenId].water);
        for (let section = 0; section < 6; section++) {
            island = act(island, { type: 'brush', specimenId, section });
            const beforeRepeat = structuredClone(island);
            island = act(island, { type: 'brush', specimenId, section }, 999999);
            expect(island).toEqual(beforeRepeat);
            expect(island.workshop!.specimens[specimenId].cleanedMask).toBe((1 << (section + 1)) - 1);
            expect(island.workshop!.specimens[specimenId].observations).toEqual([]);
            expect(island.workshop!.specimens[specimenId].identity).toBeUndefined();
        }
        const beforePreview = structuredClone(island);
        const results = WORKSHOP_TOOL_IDS.map(tool => getWorkshopToolResult(getIslandWorkshop(island), specimenId, tool));
        expect(results).toEqual(['clean', WORKSHOP_SPECIMENS[specimenId].lamp, WORKSHOP_SPECIMENS[specimenId].water]);
        expect(island).toEqual(beforePreview);
        for (const result of results) island = observe(island, specimenId, result!);
        expect(island.workshop!.specimens[specimenId]).toMatchObject({ id: original, cleanedMask: 63, identity: { observedAt: 20 } });
        expect(island.workshop!.specimens[specimenId].observations).toHaveLength(3);
        const firstRecords = structuredClone(island.workshop!.specimens[specimenId]);
        for (const result of results) island = observe(island, specimenId, result!, 9999);
        expect(island.workshop!.specimens[specimenId]).toEqual(firstRecords);
        expect(hasValidIslandWorkshop(island)).toBe(true);
    });

    it('requires clean plus the distinct identity property, retaining first times and order even when the clock moves backwards', () => {
        let island = observe(ready(), 'driftwood', 'float', 100);
        expect(island.workshop!.specimens.driftwood.identity).toBeUndefined();
        island = observe(brush(island, 'driftwood'), 'driftwood', 'clean', 5);
        expect(island.workshop!.specimens.driftwood.observations.map(entry => [entry.result, entry.order, entry.observedAt]))
            .toEqual([['float', 1, 100], ['clean', 2, 100]]);
        expect(island.workshop!.specimens.driftwood.identity).toMatchObject({ order: 3, observedAt: 100 });
        island = observe(brush(island, 'seaglass'), 'seaglass', 'clean', 6);
        island = observe(island, 'seaglass', 'sink', 7);
        expect(island.workshop!.specimens.seaglass.identity).toBeUndefined();
        island = observe(island, 'seaglass', 'transmit', 8);
        expect(island.workshop!.specimens.seaglass.identity).toMatchObject({ order: 7, observedAt: 100 });
        island = observe(brush(island, 'striped-shell'), 'striped-shell', 'clean', 9);
        island = observe(island, 'striped-shell', 'sink', 10);
        expect(island.workshop!.specimens['striped-shell'].identity).toBeUndefined();
        island = observe(island, 'striped-shell', 'opaque', 11);
        expect(island.workshop!.specimens['striped-shell'].identity).toMatchObject({ order: 11, observedAt: 100 });
        expect(getWorkshopAssemblableParts(island.workshop!)).toEqual(['straight', 'elbow', 'wheel', 'bell']);
    });

    it('rejects dirty glass transmission, wrong physical results and callbacks for an older cleaned surface atomically', () => {
        const island = act(ready(), { type: 'brush', specimenId: 'seaglass', section: 2 }), before = structuredClone(island);
        for (const result of ['clean', 'transmit', 'opaque', 'float'] as const) {
            expect(() => observe(island, 'seaglass', result)).toThrowError(IslandWorkshopConflict);
        }
        expect(() => act(island, { type: 'observe-specimen', specimenId: 'seaglass', result: 'sink', cleanedMask: 0 })).toThrowError(/いまの かたち/);
        expect(island).toEqual(before);
    });

    it('keeps an optional normalized nickname separate from identity and does not consume a specimen when moving it off a shelf', () => {
        let island = act(ready(), { type: 'name-specimen', specimenId: 'seaglass', name: '  か\u3099らす　' });
        expect(getWorkshopSpecimenName(island.workshop!, 'seaglass')).toBe('がらす');
        expect(island.workshop!.specimens.seaglass.identity).toBeUndefined();
        island = act(island, { type: 'shelve', specimenId: 'seaglass', shelfId: 'shelf-1' });
        const specimen = structuredClone(island.workshop!.specimens.seaglass);
        expect(() => act(island, { type: 'shelve', specimenId: 'driftwood', shelfId: 'shelf-1' })).toThrowError(/べつの もの/);
        island = act(island, { type: 'shelve', specimenId: 'seaglass', shelfId: 'shelf-3' });
        expect(island.workshop!.shelves).toEqual({ 'shelf-1': null, 'shelf-2': null, 'shelf-3': 'seaglass' });
        island = act(island, { type: 'shelve', specimenId: 'seaglass' });
        expect(island.workshop!.specimens.seaglass).toEqual(specimen);
        island = act(island, { type: 'name-specimen', specimenId: 'seaglass' });
        expect(getWorkshopSpecimenName(island.workshop!, 'seaglass')).toBe('すなの かたまり 2');
        island = identify(island, 'seaglass');
        expect(getWorkshopSpecimenName(island.workshop!, 'seaglass')).toBe('いろガラス');
        for (const name of ['', ' ', 'あ'.repeat(17), 'なまえ\n', '\u202eなまえ']) expect(() => act(island, { type: 'name-specimen', specimenId: 'seaglass', name })).toThrowError(/1〜16/);
        expect(act(island, { type: 'name-specimen', specimenId: 'seaglass', name: '🌟'.repeat(16) }).workshop!.specimens.seaglass.name).toBe('🌟'.repeat(16));
    });
});

describe('private checkpoints, named works and real creation results', () => {
    it('assembles only identified material, saves two independent complete layouts and cancels to the selected snapshot without rolling back later discoveries', () => {
        expect(() => edit(ready(), { type: 'assemble', partId: 'wheel' })).toThrowError(WorkshopLayoutConflict);
        let island = identify(ready(), 'driftwood');
        island = edit(island, { type: 'assemble', partId: 'straight' });
        island = edit(island, { type: 'move', partId: 'straight', position: { col: 0, row: 1 } });
        island = act(island, { type: 'save-work', workId: 'work-1', name: 'もとの みぞ' });
        const original = structuredClone(island.workshop!.works['work-1']!);
        island = act(island, { type: 'load-work', workId: 'work-1' });
        island = edit(island, { type: 'rotate', partId: 'straight', rotation: 1 });
        island = identify(island, 'seaglass');
        island = act(island, { type: 'name-specimen', specimenId: 'seaglass', name: 'きらり' });
        island = act(island, { type: 'shelve', specimenId: 'seaglass', shelfId: 'shelf-2' });
        island = act(island, { type: 'save-work', workId: 'work-2', name: 'べつの みぞ' });
        island = act(island, { type: 'save-work', workId: 'work-1', name: 'かわった みぞ' });
        const observations = structuredClone(island.workshop!.specimens), shelves = structuredClone(island.workshop!.shelves);
        island = act(island, { type: 'cancel-draft' });
        expect(island.workshop!.draftCheckpoint.draft).toEqual({ layout: original.layout, undo: [], redo: [] });
        expect(island.workshop!.specimens).toEqual(observations); expect(island.workshop!.shelves).toEqual(shelves);
        expect(island.workshop!.works['work-1']!.layout.parts.straight.rotation).toBe(1);
        expect(island.workshop!.works['work-2']!.layout.parts.straight.rotation).toBe(1);
        island = act(island, { type: 'delete-work', workId: 'work-1' });
        expect(island.workshop!.draftCheckpoint.sourceWorkId).toBeUndefined();
        expect(island.workshop!.draftCheckpoint.baseLayout).toEqual(original.layout);
        island = act(island, { type: 'load-work' });
        expect(island.workshop!.draftCheckpoint.draft.layout).toEqual(createEmptyWorkshopLayout());
        expect(island.workshop!.specimens).toEqual(observations);
        const copy = getIslandWorkshop(island); copy.works['work-2']!.layout.parts.straight.rotation = 3;
        expect(island.workshop!.works['work-2']!.layout.parts.straight.rotation).toBe(1);
    });

    it('checkpoints undo/redo across assembly and clear, caps history at 20, and retains all specimen ownership', () => {
        let island = materialized(); const specimens = structuredClone(island.workshop!.specimens);
        island = edit(island, { type: 'assemble', partId: 'wheel' });
        island = edit(island, { type: 'undo' });
        expect(island.workshop!.draftCheckpoint.draft.layout.parts.wheel.assembled).toBe(false);
        island = edit(island, { type: 'redo' });
        expect(island.workshop!.draftCheckpoint.draft.layout.parts.wheel.assembled).toBe(true);
        island = edit(island, { type: 'move', partId: 'wheel', position: { col: 1, row: 1 } });
        island = edit(island, { type: 'clear' });
        expect(island.workshop!.draftCheckpoint.draft.layout.parts.wheel).toEqual({ assembled: true, rotation: 0 });
        island = edit(island, { type: 'undo' });
        expect(island.workshop!.draftCheckpoint.draft.layout.parts.wheel.position).toEqual({ col: 1, row: 1 });
        for (let i = 0; i < 25; i++) island = edit(island, { type: 'rotate', partId: 'wheel', rotation: i % 2 === 0 ? 1 : 0 });
        expect(island.workshop!.draftCheckpoint.draft.undo).toHaveLength(20);
        expect(island.workshop!.draftCheckpoint.draft.redo).toHaveLength(0);
        expect(island.workshop!.specimens).toEqual(specimens);
    });

    it('records wheel and bell only after a callback bound to the current reachable layout; simulations, replay, edit and cancel cannot invent or erase first observations', () => {
        let island = successful(); const layout = island.workshop!.draftCheckpoint.draft.layout, key = workshopLayoutKey(layout);
        expect(simulateWorkshop(layout).complete).toBe(true);
        expect(island.workshop!.creations).toEqual([]);
        for (const partId of ['wheel', 'bell'] as const) island = act(island, { type: 'observe-creation', partId, layoutKey: key }, 30);
        const first = structuredClone(island.workshop!.creations);
        expect(first.map(entry => entry.partId)).toEqual(['wheel', 'bell']);
        expect(first.map(entry => entry.order)).toEqual([10, 11]);
        island = act(island, { type: 'observe-creation', partId: 'bell', layoutKey: key }, 99999);
        expect(island.workshop!.creations).toEqual(first);
        island = edit(island, { type: 'rotate', partId: 'wheel', rotation: 2 });
        expect(() => act(island, { type: 'observe-creation', partId: 'bell', layoutKey: key })).toThrowError(/いまの つなぎかた/);
        expect(() => act(island, { type: 'observe-creation', partId: 'bell', layoutKey: workshopLayoutKey(island.workshop!.draftCheckpoint.draft.layout) })).toThrowError(/つなぎめ/);
        island = act(island, { type: 'cancel-draft' });
        expect(island.workshop!.creations).toEqual(first);
        expect(hasValidIslandWorkshop(island)).toBe(true);
    });
});

describe('strict workshop schema and intent validation', () => {
    it('rejects malformed or foreign saved data without resetting unknown content', () => {
        const good = materialized(), state = good.workshop!;
        const cases: unknown[] = [null, { ...state, version: 2 }, { ...state, future: true }];
        const corrupt = (change: (state: IslandWorkshopState) => void) => { const value = structuredClone(state); change(value); cases.push(value); };
        corrupt(value => { value.specimens.driftwood.cleanedMask = 64; });
        corrupt(value => { value.specimens.driftwood.id = 'island-workshop:v1:specimen:other:driftwood'; });
        corrupt(value => { value.specimens.driftwood.observations[0].order = 9; });
        corrupt(value => { value.specimens.driftwood.identity!.observedAt++; });
        corrupt(value => { delete value.specimens.driftwood.identity; });
        corrupt(value => { value.specimens.seaglass.cleanedMask = 31; });
        corrupt(value => { value.shelves['shelf-1'] = 'driftwood'; value.shelves['shelf-2'] = 'driftwood'; });
        corrupt(value => { value.draftCheckpoint.draft.undo = new Array(2); });
        corrupt(value => { value.draftCheckpoint.sourceWorkId = 'work-1'; });
        corrupt(value => { value.creations = new Array(1); });
        for (const value of cases) {
            const island = { ...good, workshop: value as IslandWorkshopState }, before = structuredClone(island);
            expect(hasValidIslandWorkshop(island)).toBe(false);
            expect(() => getIslandWorkshop(island)).toThrowError(IslandWorkshopConflict);
            expect(() => assertIsland(island)).toThrowError(IslandConflict);
            expect(() => act(island, { type: 'cancel-draft' })).toThrowError(IslandWorkshopConflict);
            expect(island).toEqual(before);
        }
        const locked = getIslandWorkshop(ready()); locked.draftCheckpoint.draft.layout.parts.bell.assembled = true;
        expect(hasValidIslandWorkshop({ ...ready(), workshop: locked })).toBe(false);
    });

    it('rejects a forged creation whose first observation precedes the material identity, even with a valid reachable layout and contiguous record order', () => {
        let island = successful();
        island = act(island, { type: 'observe-creation', partId: 'wheel', layoutKey: workshopLayoutKey(island.workshop!.draftCheckpoint.draft.layout) }, 30);
        const forged = structuredClone(island);
        for (const id of WORKSHOP_SPECIMEN_IDS) {
            const specimen = forged.workshop!.specimens[id];
            for (const entry of [...specimen.observations, specimen.identity!]) { entry.order++; entry.observedAt = 30; }
        }
        forged.workshop!.creations[0].order = 1;
        expect(hasValidIslandWorkshop(forged)).toBe(false);
        expect(hasValidIslandWorkshop(island)).toBe(true);
    });

    it('canonicalizes names, edit property order and layout keys while rejecting arbitrary snapshots and invalid IDs', () => {
        expect(canonicalIslandWorkshopAction({ name: ' か\u3099らす ', specimenId: 'seaglass', type: 'name-specimen' }))
            .toEqual({ type: 'name-specimen', specimenId: 'seaglass', name: 'がらす' });
        const layout = createEmptyWorkshopLayout();
        const reverse = { parts: Object.fromEntries(Object.entries(layout.parts).reverse()) };
        expect(canonicalIslandWorkshopAction({ type: 'observe-creation', partId: 'wheel', layoutKey: JSON.stringify(reverse, null, 2) }))
            .toEqual({ type: 'observe-creation', partId: 'wheel', layoutKey: workshopLayoutKey(layout) });
        for (const value of [
            { type: 'brush', specimenId: 'seaglass', section: 6 }, { type: 'brush', specimenId: 'seaglass', section: .5 },
            { type: 'brush', specimenId: 'unknown', section: 0 }, { type: 'brush', specimenId: 'seaglass', section: 0, visible: true },
            { type: 'save-work', workId: 'work-3', name: 'さくひん' }, { type: 'save-work', workId: 'work-1', name: 'さくひん', layout },
            { type: 'edit-draft', draft: { layout, undo: [], redo: [] } }, { type: 'observe-creation', partId: 'straight', layoutKey: workshopLayoutKey(layout) },
            { type: 'observe-creation', partId: 'wheel', layoutKey: '{}' }, { type: 'cancel-draft', workshop: {} },
        ]) expect(() => canonicalIslandWorkshopAction(value)).toThrow();
    });

    it('does not mutate growth, furniture, stars, names or the pending learning reservation in any workshop operation', () => {
        const initial = ready(); let island = successful();
        for (const partId of ['straight', 'wheel', 'bell'] as WorkshopPartId[]) island = edit(island, { type: 'remove', partId });
        const withoutWorkshop = { ...island }; delete withoutWorkshop.workshop;
        expect(withoutWorkshop).toEqual(initial);
        expect(island.workshop!.specimens.driftwood.cleanedMask).toBe(WORKSHOP_CLEAN_MASK);
    });
});
