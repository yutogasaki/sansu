import { describe, expect, it } from 'vitest';
import { canonicalWorkshopDraftEdit, createEmptyWorkshopLayout, createWorkshopDraft, getWorkshopPartPorts,
    hasValidWorkshopDraft, hasValidWorkshopLayout, normalizeWorkshopDraft, normalizeWorkshopLayout, reduceWorkshopDraft,
    resolveWorkshopConnections, simulateWorkshop, WORKSHOP_HISTORY_LIMIT, WORKSHOP_PART_IDS, WORKSHOP_SOURCE_PORT,
    WorkshopLayoutConflict, type WorkshopDraft, type WorkshopDraftEdit, type WorkshopLayout, type WorkshopPartId,
    type WorkshopRotation } from './workshopLayout';

const allowed = WORKSHOP_PART_IDS;
function layoutOf(parts: Partial<Record<WorkshopPartId, [number, number, WorkshopRotation]>>): WorkshopLayout {
    const layout = createEmptyWorkshopLayout();
    for (const id of WORKSHOP_PART_IDS) {
        const pose = parts[id];
        if (pose) layout.parts[id] = { assembled: true, position: { col: pose[0], row: pose[1] }, rotation: pose[2] };
    }
    return layout;
}
const designA = () => layoutOf({ straight: [0, 1, 0], wheel: [1, 1, 0], bell: [2, 1, 0] });
const designB = () => layoutOf({ elbow: [0, 1, 0], wheel: [0, 2, 1], bell: [0, 3, 1] });
const edit = (draft: WorkshopDraft, action: WorkshopDraftEdit) => reduceWorkshopDraft(draft, action, allowed);
function expectCode(action: () => unknown, code: WorkshopLayoutConflict['code']) {
    expect(action).toThrow(WorkshopLayoutConflict);
    try { action(); } catch (error) { expect((error as WorkshopLayoutConflict).code).toBe(code); }
}

describe('finite workshop layouts and saved drafts', () => {
    it('starts with four independent empty frames and clones all positions/history', () => {
        const a = createEmptyWorkshopLayout(), b = createEmptyWorkshopLayout();
        expect(Object.keys(a.parts)).toEqual(WORKSHOP_PART_IDS);
        expect(Object.values(a.parts).every(part => !part.assembled && !part.position && part.rotation === 0)).toBe(true);
        a.parts.straight.assembled = true;
        expect(b.parts.straight.assembled).toBe(false);
        const original = createWorkshopDraft(designA());
        const moved = edit(original, { type: 'move', partId: 'straight', position: { col: 0, row: 0 } });
        const clone = normalizeWorkshopDraft(moved);
        clone.layout.parts.straight.position!.col = 3;
        clone.undo[0].parts.wheel.position!.row = 3;
        expect(moved.layout.parts.straight.position).toEqual({ col: 0, row: 0 });
        expect(moved.undo[0].parts.wheel.position).toEqual({ col: 1, row: 1 });
        expect(original.layout).toEqual(designA());
    });

    it('rejects unknown shapes, non-finite or fractional poses, extra parts, collisions and bad assembly', () => {
        const valid = designA();
        const corrupt: unknown[] = [undefined, null, [], {}, { ...valid, version: 2 }, { parts: {} },
            { parts: { ...valid.parts, extra: valid.parts.bell } },
            ...[
                null, { assembled: 'yes', rotation: 0 }, { assembled: true, rotation: 4 }, { assembled: true, rotation: -1 },
                { assembled: true, rotation: .5 }, { assembled: true, rotation: NaN },
                { assembled: true, rotation: 0, position: null }, { assembled: true, rotation: 0, material: 'free' },
                ...[{ col: 4, row: 1 }, { col: -1, row: 1 }, { col: 0, row: 4 }, { col: 0, row: -.1 },
                    { col: Infinity, row: 0 }, { col: NaN, row: 0 }, { col: 0, row: .5 }, { col: 0, row: 0, z: 0 },
                    { col: 1, row: 1 }].map(position => ({ assembled: true, rotation: 0, position })),
            ].map(straight => ({ parts: { ...valid.parts, straight } })),
        ];
        for (const value of corrupt) {
            expect(hasValidWorkshopLayout(value)).toBe(false);
            expectCode(() => normalizeWorkshopLayout(value), 'invalid-layout');
        }
        const pending = designA(); pending.parts.wheel.assembled = false;
        expect(hasValidWorkshopLayout(pending)).toBe(true); // A movable unfinished frame is legitimate.
    });

    it('validates every saved history entry and caps total retained gestures, including redo', () => {
        const valid = createWorkshopDraft(designA());
        for (const invalid of [null, { ...valid, undo: null }, { ...valid, redo: null }, { ...valid, extra: true },
            { ...valid, undo: [null] }, { ...valid, undo: Array(1) }, { ...valid, redo: Array(1) }, { ...valid, redo: [{ parts: {} }] },
            { ...valid, undo: Array(20).fill(designA()), redo: [designB()] }]) {
            expect(hasValidWorkshopDraft(invalid)).toBe(false);
            expectCode(() => normalizeWorkshopDraft(invalid), 'invalid-draft');
        }
        expect(hasValidWorkshopDraft({ ...valid, undo: Array(10).fill(designA()), redo: Array(10).fill(designB()) })).toBe(true);
    });

    it('canonicalizes only one finite edit and rejects snapshots or authority supplied by a caller', () => {
        const input: WorkshopDraftEdit = { type: 'move', partId: 'straight', position: { col: -0, row: 0 } };
        const canonical = canonicalWorkshopDraftEdit(input);
        expect(canonical).toEqual({ type: 'move', partId: 'straight', position: { col: 0, row: 0 } });
        input.position.col = 3;
        expect(canonical).toMatchObject({ position: { col: 0 } });
        for (const invalid of [null, {}, { type: 'clear', layout: designA() }, { type: 'undo', count: 20 },
            { type: 'assemble', partId: 'wheel', assembled: true }, { type: 'assemble', partId: 'unknown' },
            { type: 'move', partId: 'straight', position: { col: 0, row: 4 } },
            { type: 'rotate', partId: 'bell', rotation: 4 }, { type: 'rotate', partId: 'bell', rotation: .5 },
            { type: 'rotate', partId: 'bell', rotation: -1 }, { type: 'replace', draft: createWorkshopDraft() }]) {
            expectCode(() => canonicalWorkshopDraftEdit(invalid), 'invalid-edit');
        }
    });
});

describe('direct edits, assembly permission and bounded undo', () => {
    it('requires a discovered material for assembly and does not let history smuggle in locked parts', () => {
        const draft = createWorkshopDraft(), before = structuredClone(draft);
        expectCode(() => reduceWorkshopDraft(draft, { type: 'assemble', partId: 'wheel' }, ['straight', 'elbow']), 'material-locked');
        expect(draft).toEqual(before);
        const assembled = reduceWorkshopDraft(draft, { type: 'assemble', partId: 'straight' }, ['straight', 'elbow']);
        expect(assembled.layout.parts.straight.assembled).toBe(true);
        const undone = reduceWorkshopDraft(assembled, { type: 'undo' }, ['straight', 'elbow']);
        expect(undone.layout.parts.straight.assembled).toBe(false);
        expectCode(() => reduceWorkshopDraft(undone, { type: 'redo' }, []), 'material-locked');
        expectCode(() => reduceWorkshopDraft({ ...draft, undo: [designA()] }, { type: 'undo' }, []), 'material-locked');
    });

    it('moves and rotates a frame without consuming material; collisions and outside edits preserve the draft', () => {
        let draft = createWorkshopDraft();
        draft = reduceWorkshopDraft(draft, { type: 'move', partId: 'wheel', position: { col: 1, row: 1 } }, []);
        draft = reduceWorkshopDraft(draft, { type: 'rotate', partId: 'wheel', rotation: 1 }, []);
        expect(draft.layout.parts.wheel).toEqual({ assembled: false, rotation: 1, position: { col: 1, row: 1 } });
        const before = structuredClone(draft);
        expectCode(() => edit(draft, { type: 'move', partId: 'straight', position: { col: 1, row: 1 } }), 'collision');
        expectCode(() => edit(draft, { type: 'move', partId: 'straight', position: { col: 4, row: 1 } }), 'invalid-edit');
        expect(draft).toEqual(before);
    });

    it('removes/clears only positions and can restore an entire working design with one undo', () => {
        const original = createWorkshopDraft(designB());
        const removed = edit(original, { type: 'remove', partId: 'wheel' });
        expect(removed.layout.parts.wheel).toEqual({ assembled: true, rotation: 1 });
        expect(edit(removed, { type: 'undo' }).layout).toEqual(original.layout);
        const cleared = edit(original, { type: 'clear' });
        expect(Object.values(cleared.layout.parts).every(part => !part.position)).toBe(true);
        expect(cleared.layout.parts.wheel.assembled).toBe(true);
        expect(edit(cleared, { type: 'undo' }).layout).toEqual(original.layout);
    });

    it('keeps exactly the latest 20 gestures, redoes in order, and drops redo only on a real new edit', () => {
        let draft = createWorkshopDraft();
        const states: WorkshopLayout[] = [draft.layout];
        for (let count = 1; count <= 25; count++) {
            draft = edit(draft, { type: 'rotate', partId: 'elbow', rotation: count % 4 as WorkshopRotation });
            states.push(draft.layout);
        }
        expect(draft.undo).toHaveLength(WORKSHOP_HISTORY_LIMIT);
        for (let count = 0; count < 20; count++) draft = edit(draft, { type: 'undo' });
        expect(draft.layout).toEqual(states[5]);
        expect(draft.undo).toHaveLength(0);
        expect(draft.redo).toHaveLength(20);
        const unchanged = edit(draft, { type: 'rotate', partId: 'elbow', rotation: draft.layout.parts.elbow.rotation });
        expect(unchanged.redo).toEqual(draft.redo);
        for (let count = 0; count < 20; count++) draft = edit(draft, { type: 'redo' });
        expect(draft.layout).toEqual(states[25]);
        expect(draft.redo).toHaveLength(0);
        draft = edit(edit(draft, { type: 'undo' }), { type: 'move', partId: 'straight', position: { col: 3, row: 3 } });
        expect(draft.redo).toEqual([]);
        expect(hasValidWorkshopDraft(draft)).toBe(true);
        expect(edit(createWorkshopDraft(), { type: 'undo' })).toEqual(createWorkshopDraft());
        expect(edit(createWorkshopDraft(), { type: 'clear' }).undo).toEqual([]);
    });
});

describe('physical water and shaft ports', () => {
    it('rotates both ports and half-cell render anchors clockwise with the part', () => {
        const expected = [
            ['west', 'south', { col: .5, row: 1 }, { col: 1, row: 1.5 }],
            ['north', 'west', { col: 1, row: .5 }, { col: .5, row: 1 }],
            ['east', 'north', { col: 1.5, row: 1 }, { col: 1, row: .5 }],
            ['south', 'east', { col: 1, row: 1.5 }, { col: 1.5, row: 1 }],
        ];
        for (let angle = 0; angle < 4; angle++) {
            const ports = getWorkshopPartPorts('elbow', { assembled: true, rotation: angle as WorkshopRotation, position: { col: 1, row: 1 } });
            expect(ports.map(port => port.direction)).toEqual(expected[angle].slice(0, 2));
            expect(ports.map(port => port.anchor)).toEqual(expected[angle].slice(2));
        }
        expect(getWorkshopPartPorts('bell', { assembled: true, rotation: 0 })).toEqual([]);
        expect(WORKSHOP_SOURCE_PORT).toMatchObject({ position: { col: -1, row: 1 }, anchor: { col: -.5, row: 1 }, direction: 'east', channel: 'water' });
    });

    it.each([['A', designA], ['B', designB]] as const)('connects distinct successful design %s at coincident ports', (_name, make) => {
        const edges = resolveWorkshopConnections(make());
        expect(edges).toHaveLength(3);
        for (const edge of edges) {
            expect(edge.from.anchor).toEqual(edge.to.anchor);
            expect(edge.from.channel).toBe(edge.to.channel);
            expect(edge.from.role).toBe('output'); expect(edge.to.role).toBe('input');
        }
        expect(edges.map(edge => [edge.from.ownerId, edge.to.ownerId])).toEqual([
            ['source', _name === 'A' ? 'straight' : 'elbow'], [_name === 'A' ? 'straight' : 'elbow', 'wheel'], ['wheel', 'bell'],
        ]);
    });

    it('can show a disconnected valid shaft edge without pretending the water reached it', () => {
        const layout = layoutOf({ wheel: [1, 2, 0], bell: [2, 2, 0] });
        expect(resolveWorkshopConnections(layout)).toHaveLength(1);
        expect(simulateWorkshop(layout)).toMatchObject({ reachedPartIds: [], complete: false, stop: { reason: 'empty', target: { col: 0, row: 1 } } });
    });
});

describe('deterministic, ordered workshop performance', () => {
    it.each([['A', designA], ['B', designB]] as const)('reaches wheel before bell in design %s using its actual anchors', (_name, make) => {
        const layout = make(), before = structuredClone(layout), result = simulateWorkshop(layout);
        expect(result.complete).toBe(true);
        expect(result.stop).toBeUndefined();
        expect(result.reachedPartIds).toEqual([_name === 'A' ? 'straight' : 'elbow', 'wheel', 'bell']);
        expect(result.beats.filter(beat => beat.type !== 'flow').map(beat => beat.type)).toEqual(['wheel', 'bell']);
        const wheelIndex = result.beats.findIndex(beat => beat.type === 'wheel'), bellIndex = result.beats.findIndex(beat => beat.type === 'bell');
        expect(result.beats.slice(0, wheelIndex).every(beat => beat.type === 'flow' && beat.channel === 'water')).toBe(true);
        expect(result.beats.slice(wheelIndex + 1, bellIndex).every(beat => beat.type === 'flow' && beat.channel === 'shaft')).toBe(true);
        expect(result.beats[wheelIndex]).toEqual({ type: 'wheel', partId: 'wheel', at: layout.parts.wheel.position });
        expect(result.beats[bellIndex]).toEqual({ type: 'bell', partId: 'bell', at: layout.parts.bell.position });
        const flows = result.beats.filter(beat => beat.type === 'flow');
        for (let i = 1; i < flows.length; i++) expect(flows[i].from).toEqual(flows[i - 1].to);
        expect(simulateWorkshop(layout)).toEqual(result);
        expect(layout).toEqual(before);
        expect(result.beats.length).toBeLessThanOrEqual(4 * WORKSHOP_PART_IDS.length + 2);
    });

    it('stops exactly where a removed or unfinished piece interrupts the stream', () => {
        const missing = designA(); delete missing.parts.wheel.position;
        const result = simulateWorkshop(missing);
        expect(result).toMatchObject({ complete: false, reachedPartIds: ['straight'],
            stop: { reason: 'empty', at: { col: .5, row: 1 }, target: { col: 1, row: 1 } } });
        expect(result.beats.some(beat => beat.type === 'wheel' || beat.type === 'bell')).toBe(false);
        const unfinished = designA(); unfinished.parts.wheel.assembled = false;
        expect(simulateWorkshop(unfinished)).toMatchObject({ reachedPartIds: ['straight'], stop: { reason: 'unassembled', partId: 'wheel' } });
        const first = designA(); first.parts.straight.assembled = false;
        expect(simulateWorkshop(first)).toMatchObject({ reachedPartIds: [], stop: { reason: 'unassembled', partId: 'straight' } });
    });

    it('distinguishes wrong direction, water/shaft mismatch and board edge without firing later outcomes', () => {
        const reverse = designA(); reverse.parts.wheel.rotation = 2;
        expect(simulateWorkshop(reverse)).toMatchObject({ reachedPartIds: ['straight'], stop: { reason: 'misaligned', partId: 'wheel' } });
        const waterBell = layoutOf({ straight: [0, 1, 0], bell: [1, 1, 0] });
        expect(simulateWorkshop(waterBell)).toMatchObject({ reachedPartIds: ['straight'], stop: { reason: 'wrong-channel', partId: 'bell' } });
        const shaftWater = layoutOf({ wheel: [0, 1, 0], straight: [1, 1, 0] });
        expect(simulateWorkshop(shaftWater)).toMatchObject({ reachedPartIds: ['wheel'], stop: { reason: 'wrong-channel', partId: 'straight' } });
        const edge = layoutOf({ elbow: [0, 1, 0], straight: [0, 2, 1], wheel: [0, 3, 1] });
        expect(simulateWorkshop(edge)).toMatchObject({ reachedPartIds: ['elbow', 'straight', 'wheel'],
            stop: { reason: 'board-edge', at: { col: 0, row: 3.5 }, target: { col: 0, row: 4 } } });
        // Source can feed the wheel directly; there is no requirement to use all four parts.
        const short = layoutOf({ wheel: [0, 1, 0], bell: [1, 1, 0] });
        expect(simulateWorkshop(short).complete).toBe(true);
    });

    it('bounds all rotations and leaves disconnected/permuted inventory irrelevant to the source trace', () => {
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
            const layout = layoutOf({ elbow: [0, 1, a as WorkshopRotation], wheel: [0, 2, b as WorkshopRotation], bell: [0, 3, c as WorkshopRotation], straight: [3, 3, 0] });
            const result = simulateWorkshop(layout);
            expect(result.complete).toBe(a === 0 && b === 1 && c === 1);
            expect(new Set(result.reachedPartIds).size).toBe(result.reachedPartIds.length);
            expect(result.reachedPartIds.length).toBeLessThanOrEqual(4);
            expect(result.beats.length).toBeLessThanOrEqual(18);
            const reordered = { parts: Object.fromEntries(Object.entries(layout.parts).reverse()) } as WorkshopLayout;
            expect(simulateWorkshop(reordered)).toEqual(result);
        }
    });
});
