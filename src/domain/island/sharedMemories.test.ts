import { describe, expect, it } from 'vitest';
import { createIsland, findAvailablePosition, islandPlacementCandidates, isValidIslandPlacement } from './catalog';
import { previewIslandLayout, reduceIslandExperience } from './experience';
import { growIslandAfterCompletedSet } from './growth';
import { canonicalIslandSharedMemoriesAction, getIslandSharedMemories, hasValidIslandSharedMemories, hasValidSharedMemory,
    isValidSharedDisplayPlacement, reduceIslandSharedMemories, resolveSharedTarget, sharedDestinationKey, sharedDisplayKey,
    sharedIlluminationResult, sharedOperationIdentity, sharedRequestIdentity, sharedTargetVisualKey, sharedWorkCaptureKey,
    type IslandSharedMemoriesAction, type SharedDestination, type SharedDisplayId, type SharedMemory, type SharedTargetRef, type SharedVisibleResult } from './sharedMemories';
import { getIslandWorkshop, reduceIslandWorkshop, WORKSHOP_SPECIMENS, type WorkshopSpecimenId } from './workshop';
import type { IslandRecord } from './types';

const specimen = (specimenId: WorkshopSpecimenId = 'driftwood'): SharedTargetRef => ({ kind: 'specimen', specimenId });
const initial = (profileId = 'child'): IslandRecord => ({ ...createIsland(profileId, 0), completedSets: 6, growth: undefined });
function change(island: IslandRecord, action: IslandSharedMemoriesAction, fact?: SharedMemory) {
    const result = reduceIslandSharedMemories(island, action, island.updatedAt + 1,
        { firstFact: fact, receiptId: sharedOperationIdentity(island.profileId, island.revision) });
    return { ...result, island: { ...result.island, revision: island.revision + 1, updatedAt: island.updatedAt + 1 } };
}
function destination(island: IslandRecord, ref = specimen(), displayId: SharedDisplayId = 'display-1'): SharedDestination {
    const target = resolveSharedTarget(island, ref), existing = island.sharedMemories?.displays[displayId];
    const point = existing?.position ?? islandPlacementCandidates({ expansionLevel: 1 }).find(point => isValidSharedDisplayPlacement(island, displayId, target, point));
    if (!point) throw new Error('No test position');
    return { displayId, position: point, rotation: existing?.rotation ?? 0, expectedDisplayKey: sharedDisplayKey(existing) };
}
function prepare(island: IslandRecord, ref = specimen(), residentId: 'otter' | 'rabbit' | 'fox' = 'otter', dest = destination(island, ref)) {
    return change(island, { type: 'prepare-request', requestId: sharedRequestIdentity(island.profileId, `request-${island.revision}`),
        residentId, jobId: residentId === 'otter' ? 'carry' : residentId === 'rabbit' ? 'gather' : 'illuminate', target: ref,
        destination: dest, expectedRequestId: island.sharedMemories?.activeRequest?.requestId ?? null }).island;
}
function finish(island: IslandRecord, result: SharedVisibleResult = { kind: 'placed' }, fact?: SharedMemory) {
    const request = island.sharedMemories!.activeRequest!;
    return change(island, { type: 'complete-request', requestId: request.requestId, targetKey: request.target.targetKey,
        visualKey: request.visualKey, destinationKey: sharedDestinationKey(request.destination), result }, fact);
}
function identified(island: IslandRecord, id: WorkshopSpecimenId) {
    for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId: id, section }, 1);
    for (const result of ['clean', WORKSHOP_SPECIMENS[id].identityResult] as const) island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId: id, result, cleanedMask: 63 }, 2);
    return island;
}
function withWork(island = initial()) {
    island = identified(island, 'driftwood');
    island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId: 'straight' } }, 3);
    island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 0, row: 1 } } }, 3);
    return reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: 'もとの さくひん' }, 4);
}
function workRef(island: IslandRecord): SharedTargetRef {
    return { kind: 'work', workId: 'work-1', targetKey: sharedWorkCaptureKey(island.profileId, 'work-1', getIslandWorkshop(island).works['work-1']!) };
}

describe('shared display and memory identities', () => {
    it('uses unlocked connecting floor for exhibits and keeps both furniture and exhibit collisions', () => {
        const base = createIsland('connected-exhibit', 0), point = { x: 4.25, z: 1.5 };
        const ref = specimen(), target = resolveSharedTarget(base, ref);
        const opened = { ...base, completedSets: 12, growth: { ...base.growth!, expansionLevel: 1 as const } };
        expect(isValidSharedDisplayPlacement(base, 'display-1', target, point)).toBe(false);
        expect(isValidSharedDisplayPlacement(opened, 'display-1', target, point)).toBe(true);
        expect(isValidSharedDisplayPlacement(opened, 'display-1', target, { x: -point.x, z: point.z })).toBe(false);
        expect(isValidSharedDisplayPlacement({ ...opened, growth: { ...opened.growth, expansionLevel: 2 } },
            'display-1', target, { x: -point.x, z: point.z })).toBe(true);
        expect(isValidSharedDisplayPlacement(opened, 'display-1', target, { x: 4.75, z: 0 })).toBe(false);
        const occupied = { ...opened, items: [...opened.items, { ...opened.items[0], id: 'neck-furniture', position: point }] };
        expect(isValidSharedDisplayPlacement(occupied, 'display-1', target, point)).toBe(false);
        const placed = change(opened, { type: 'place-display', displayId: 'display-1', target: ref,
            position: point, rotation: 0, expectedDisplayKey: null }).island;
        expect(isValidIslandPlacement(placed, placed.items[0].id, point)).toBe(false);
        expect(isValidSharedDisplayPlacement(placed, 'display-2', resolveSharedTarget(placed, specimen('seaglass')), point)).toBe(false);
        expect(placed.items).toEqual(opened.items); expect(placed.growth).toEqual(opened.growth);
    });

    it('keeps legacy absence virtual, rejects unknown formats, and uses encoded workshop individual identity', () => {
        const island = initial('child/:日本語');
        expect(getIslandSharedMemories(island)).toEqual({ version: 1, displays: {}, memories: [], nextMemoryOrder: 1 });
        expect(island.sharedMemories).toBeUndefined();
        expect(resolveSharedTarget(island, specimen()).targetKey).toBe(getIslandWorkshop(island).specimens.driftwood.id);
        for (const value of [null, {}, { ...getIslandSharedMemories(island), version: 2 }, { ...getIslandSharedMemories(island), registry: {} }]) {
            expect(hasValidIslandSharedMemories({ ...island, sharedMemories: value as never })).toBe(false);
            expect(() => getIslandSharedMemories({ ...island, sharedMemories: value as never })).toThrow();
        }
    });

    it('retains a work snapshot after overwrite/deletion, and explicitly starts a new draft without altering saved works or learning', () => {
        let island = withWork(); const ref = workRef(island), original = resolveSharedTarget(island, ref);
        const dest = destination(island, ref);
        island = change(island, { type: 'place-display', ...dest, target: ref }).island;
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 3, row: 3 } } }, 5);
        island = reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: 'べつの さくひん' }, 6);
        const beforeRead = structuredClone(island), displayRef: SharedTargetRef = { kind: 'display', displayId: dest.displayId, targetKey: original.targetKey };
        expect(() => resolveSharedTarget(island, ref)).toThrow();
        expect(resolveSharedTarget(island, displayRef)).toEqual(original); expect(island).toEqual(beforeRead);
        island = reduceIslandWorkshop(island, { type: 'delete-work', workId: 'work-1' }, 7);
        expect(resolveSharedTarget(island, displayRef)).toEqual(original);
        const preserved = structuredClone(island), started = change(island, { type: 'start-from-work', target: displayRef }).island;
        expect(started.workshop!.draftCheckpoint.draft.layout).toEqual(original.kind === 'work' ? original.layout : null);
        expect(started.workshop!.draftCheckpoint.draft.undo).toEqual([]);
        expect(started.workshop!.works).toEqual(preserved.workshop!.works);
        expect(started.workshop!.specimens).toEqual(preserved.workshop!.specimens);
        expect(started.items).toEqual(preserved.items); expect(started.completedSets).toBe(preserved.completedSets);
    });

    it('transfers one owned specimen atomically between three slots, preserving its original observations and existing arrangement', () => {
        let island = initial();
        for (const id of ['driftwood', 'seaglass', 'striped-shell'] as const) {
            const slot = `display-${['driftwood', 'seaglass', 'striped-shell'].indexOf(id) + 1}` as SharedDisplayId;
            island = change(island, { type: 'place-display', ...destination(island, specimen(id), slot), target: specimen(id) }).island;
        }
        const before = getIslandWorkshop(island);
        island = change(island, { type: 'arrange-display', displayId: 'display-1', expectedDisplayKey: sharedDisplayKey(island.sharedMemories!.displays['display-1'])! }).island;
        const target = specimen('driftwood'), dest = destination(island, target, 'display-2');
        island = change(island, { type: 'place-display', ...dest, target }).island;
        expect(island.sharedMemories!.displays['display-1']).toBeUndefined();
        expect(island.sharedMemories!.displays['display-2']!.arrangement).toBe('petal-ring');
        expect(Object.keys(island.sharedMemories!.displays)).toHaveLength(2);
        expect(getIslandWorkshop(island)).toEqual(before);
    });

    it('rejects arbitrary snapshots, extra fields, invalid results, stale work identities, and empty works', () => {
        const island = withWork(), ref = workRef(island), target = resolveSharedTarget(island, ref);
        const dest = destination(island, ref);
        for (const action of [
            { type: 'place-display', ...dest, target },
            { type: 'place-display', ...dest, target: ref, snapshot: target },
            { type: 'arrange-display', displayId: 'display-4', expectedDisplayKey: 'x' },
            { type: 'complete-request', requestId: 'x', targetKey: 'x', visualKey: 'x', destinationKey: 'x', result: { kind: 'petals-arranged', count: 2 } },
        ]) expect(() => canonicalIslandSharedMemoriesAction(action)).toThrow();
        const empty = reduceIslandWorkshop(initial(), { type: 'save-work', workId: 'work-1', name: 'からの あん' }, 1);
        expect(() => resolveSharedTarget(empty, workRef(empty))).toThrow();
        expect(() => resolveSharedTarget(island, { kind: 'work', workId: 'work-1', targetKey: 'wrong' })).toThrow();
    });
});

describe('prepared requests and visible physical outcomes', () => {
    it('records only a confirmed visible result, and cancellation preserves the previous display and ownership', () => {
        const island = initial(), before = structuredClone(island), prepared = prepare(island);
        expect(prepared.sharedMemories!.displays).toEqual({}); expect(prepared.sharedMemories!.memories).toEqual([]);
        expect(prepared.sharedMemories!.activeRequest!.status).toBe('prepared'); expect(island).toEqual(before);
        const canceled = change(prepared, { type: 'cancel-request', requestId: prepared.sharedMemories!.activeRequest!.requestId }).island;
        expect(canceled.sharedMemories!.activeRequest).toBeUndefined(); expect(getIslandWorkshop(canceled)).toEqual(getIslandWorkshop(island));
        const done = finish(prepared);
        expect(done.island.sharedMemories!.memories).toHaveLength(1); expect(done.firstFact).toEqual(done.island.sharedMemories!.memories[0]);
        expect(done.island.sharedMemories!.activeRequest!.status).toBe('result-seen');
        expect(getIslandWorkshop(done.island)).toEqual(getIslandWorkshop(island));
    });

    it('binds carry to the actual existing source and rejects moved, removed or changed destination/source and changed specimen surfaces', () => {
        let island = finish(prepare(initial())).island;
        const from = island.sharedMemories!.displays['display-1']!, ref = specimen();
        const prepared = prepare(island, ref, 'otter', destination(island, ref, 'display-2'));
        expect(prepared.sharedMemories!.activeRequest!.source).toEqual({ kind: 'display', displayId: 'display-1', expectedDisplayKey: sharedDisplayKey(from) });
        const removed = change(prepared, { type: 'remove-display', displayId: 'display-1', expectedDisplayKey: sharedDisplayKey(from)! }).island;
        expect(() => finish(removed)).toThrow();
        const brushed = reduceIslandWorkshop(prepared, { type: 'brush', specimenId: 'driftwood', section: 0 }, 10);
        expect(() => finish(brushed)).toThrow();
        island = change(prepared, { type: 'place-display', ...destination(prepared, specimen('seaglass'), 'display-2'), target: specimen('seaglass') }).island;
        expect(() => finish(island)).toThrow();
    });

    it('requires each distinct job result and current material; the rabbit arrangement and fox light never create workshop observations', () => {
        const carry = finish(prepare(initial())).island;
        const rabbit = prepare(carry, specimen(), 'rabbit');
        expect(() => finish(rabbit)).toThrow();
        const gathered = finish(rabbit, { kind: 'petals-arranged', count: 3 }).island;
        expect(gathered.sharedMemories!.displays['display-1']!.arrangement).toBe('petal-ring');
        const fox = prepare(gathered, specimen(), 'fox');
        expect(() => finish(fox, { kind: 'illuminated', effect: 'transmit' })).toThrow();
        expect(finish(fox, { kind: 'illuminated', effect: 'shadow' }).island.sharedMemories!.memories).toHaveLength(3);
        expect(getIslandWorkshop(gathered)).toEqual(getIslandWorkshop(initial()));
        expect(() => prepare({ ...initial(), completedSets: 1 }, specimen(), 'fox')).toThrow();
        const dirty = resolveSharedTarget(initial(), specimen('seaglass'));
        expect(sharedIlluminationResult(dirty, 0)).toEqual({ kind: 'illuminated', effect: 'shadow' });
        expect(sharedIlluminationResult(dirty, 63)).toEqual({ kind: 'illuminated', effect: 'transmit' });
    });

    it('rejects persisted visual/result corruption instead of replacing the request with an empty default', () => {
        const prepared = prepare(initial());
        for (const mutate of [
            (state: NonNullable<IslandRecord['sharedMemories']>) => { state.activeRequest!.visualKey = '["wrong",0]'; },
            (state: NonNullable<IslandRecord['sharedMemories']>) => { state.activeRequest!.destination.expectedDisplayKey = 'not-a-display'; },
            (state: NonNullable<IslandRecord['sharedMemories']>) => { state.activeRequest!.source = { kind: 'display', displayId: 'display-1', expectedDisplayKey: '{}' }; },
        ]) {
            const island = structuredClone(prepared); mutate(island.sharedMemories!);
            expect(hasValidIslandSharedMemories(island)).toBe(false); expect(() => getIslandSharedMemories(island)).toThrow();
        }
        const fox = prepare(finish(prepared).island, specimen(), 'fox');
        const done = finish(fox, { kind: 'illuminated', effect: 'shadow' }).island;
        const request = done.sharedMemories!.activeRequest!;
        if (request.status !== 'result-seen') throw new Error('Expected visible result');
        request.result = { kind: 'illuminated', effect: 'transmit' };
        expect(hasValidIslandSharedMemories(done)).toBe(false);
    });

    it('keeps immutable first names, physical snapshot, order and time after curation and re-enactment', () => {
        const first = finish(prepare(initial())), fact = first.firstFact!;
        let island = change(first.island, { type: 'remove-memory', memoryKey: fact.memoryKey }).island;
        island = reduceIslandExperience(island, { type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'cap' }, 90);
        island = reduceIslandWorkshop(island, { type: 'name-specimen', specimenId: 'driftwood', name: 'ながい き' }, 91);
        island = change(island, { type: 'remember-result', requestId: island.sharedMemories!.activeRequest!.requestId }, fact).island;
        expect(island.sharedMemories!.memories).toEqual([fact]);
        const replay = finish(prepare(island), { kind: 'placed' }, fact);
        expect(replay.firstFact).toBeUndefined(); expect(replay.island.sharedMemories!.nextMemoryOrder).toBe(2);
        expect(replay.island.sharedMemories!.memories).toEqual([fact]);
        const corrupt = { ...fact, specimenSnapshot: { cleanedMask: 0, knownResults: ['transmit' as const] } };
        expect(hasValidSharedMemory(island.profileId, corrupt)).toBe(false);
        expect(() => finish(prepare(island), { kind: 'placed' }, { ...fact, firstOrder: 200 })).toThrow();
    });

    it('limits the visible shelf to twelve without blocking a thirteenth job or losing its retrievable first fact', () => {
        let island = withWork(); const facts: SharedMemory[] = [];
        for (let index = 0; index < 13; index++) {
            island = reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: `さくひん ${index}` }, 100 + index);
            const finished = finish(prepare(island, workRef(island))); island = finished.island; facts.push(finished.firstFact!);
        }
        expect(island.sharedMemories!.memories).toHaveLength(12);
        expect(island.sharedMemories!.activeRequest).toMatchObject({ status: 'result-seen', memoryOutcome: 'not-stored-full' });
        expect(island.sharedMemories!.nextMemoryOrder).toBe(14);
        expect(island.sharedMemories!.displays['display-1']!.target.targetKey).toBe(facts[12].target.targetKey);
        island = change(island, { type: 'remove-memory', memoryKey: facts[0].memoryKey }).island;
        island = change(island, { type: 'remember-result', requestId: island.sharedMemories!.activeRequest!.requestId }, facts[12]).island;
        expect(island.sharedMemories!.memories).toHaveLength(12); expect(island.sharedMemories!.memories.at(-1)).toEqual(facts[12]);
        expect(Object.keys(island.sharedMemories!).sort()).toEqual(['activeRequest', 'displays', 'memories', 'nextMemoryOrder', 'version']);
    });
});

describe('both directions of shared exhibit placement', () => {
    it('rejects furniture/reserved land/outside collisions and keeps auto-placement away from current exhibits', () => {
        const island = initial(), target = resolveSharedTarget(island, specimen());
        expect(isValidSharedDisplayPlacement(island, 'display-1', target, { x: 1.5, z: .8 })).toBe(false);
        expect(isValidSharedDisplayPlacement(island, 'display-1', target, { x: -2.6, z: -1.65 })).toBe(false);
        expect(isValidSharedDisplayPlacement(island, 'display-1', target, { x: 50, z: 50 })).toBe(false);
        const shown = finish(prepare(island)).island, display = shown.sharedMemories!.displays['display-1']!;
        expect(isValidIslandPlacement(shown, 'starter-flower', display.position)).toBe(false);
        const auto = findAvailablePosition(shown, 'flower'); expect(auto).toBeDefined();
        expect(Math.hypot(auto!.x - display.position.x, auto!.z - display.position.z)).toBeGreaterThanOrEqual(.72 + .35 + .08);
        expect(isValidSharedDisplayPlacement(shown, 'display-2', resolveSharedTarget(shown, specimen('seaglass')), display.position)).toBe(false);
    });

    it('lets real future growth relocate only its newly added furniture around an exhibit while preserving all seven earned possessions', () => {
        let island = createIsland('child', 0);
        for (let i = 1; i <= 5; i++) island = growIslandAfterCompletedSet({ ...island, completedSets: i }, 'garden', i);
        island = change(island, { type: 'place-display', displayId: 'display-1', target: specimen(),
            position: { x: 3.4, z: 1.3 }, rotation: 0, expectedDisplayKey: null }).island;
        const display = structuredClone(island.sharedMemories!.displays['display-1']);
        for (let i = 6; i <= 24; i++) island = growIslandAfterCompletedSet({ ...island, completedSets: i },
            i <= 6 ? 'garden' : i <= 12 ? 'waterside' : i <= 18 ? 'grove' : 'village', i);
        expect(island.items).toHaveLength(7);
        expect(island.items.find(item => item.id === 'living-fountain')!.position).not.toEqual(display!.position);
        expect(island.sharedMemories!.displays['display-1']).toEqual(display);
        for (const item of island.items) expect(isValidIslandPlacement(island, item.id, item.position!, item.rotation)).toBe(true);
    });

    it('rejects an old E6 layout that collides with a newer exhibit, without partially moving furniture or deleting either', () => {
        let island = initial(); const dest = destination(island);
        island = { ...island, items: island.items.map(item => item.id === 'starter-flower' ? { ...item, position: dest.position } : item) };
        island = reduceIslandExperience(island, { type: 'save-layout', layoutId: 'slot-1', name: 'まえの にわ' }, 1);
        island = { ...island, items: island.items.map(item => item.id === 'starter-flower' ? { ...item, position: { x: 1.5, z: .8 } } : item) };
        island = change(island, { type: 'place-display', ...dest, target: specimen() }).island;
        const before = structuredClone(island);
        expect(() => previewIslandLayout(island, 'slot-1')).toThrow(); expect(island).toEqual(before);
        expect(sharedTargetVisualKey(island, resolveSharedTarget(island, specimen()))).toContain('specimen');
    });
});
