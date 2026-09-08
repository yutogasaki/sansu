import assert from 'node:assert/strict';
import { test } from 'vitest';
import { emptyWorkshop } from './island-qualified-audit.mjs';
import { assertFocusedAcquisition, assertFocusedBellObservation, assertFocusedBaseline, assertFocusedReservation,
    assertFocusedAnswerIslands, assertNoLearningAmbienceStart, focusedSelection, SHELL_ITEM } from './island-expression-audio-focused-audit.mjs';

// Synthetic oracle fixtures only. These tests do not establish real qualification.
const owner = 'audio-child';
function acquisition() {
    const before = { islands: [{ profileId: owner, revision: 4, updatedAt: 50,
        customization: { points: 3, desiredItemId: null }, workshop: { creations: [{ partId: 'bell' }] } }],
    islandEvents: [{ id: 'older', profileId: owner, type: 'earlier' }], logs: [{ id: 'real-learning-placeholder' }],
    profiles: [{ id: owner, soundEnabled: false }], islandPhotos: [{ id: 'old-photo', sha256: 'unchanged' }] };
    const after = structuredClone(before), island = after.islands[0]; island.revision++; island.updatedAt = 60;
    island.expression = { version: 1, ownedItemIds: [SHELL_ITEM], selection: focusedSelection() };
    after.islandEvents.unshift({ id: JSON.stringify(['island-expression-v1', owner, 4]), profileId: owner,
        type: 'expression_changed', timestamp: 60, action: { type: 'acquire', itemId: SHELL_ITEM } });
    return { before, after };
}
test('zero-star acquisition permits exactly one item/receipt while preserving all unrelated state', () => {
    const { before, after } = acquisition(); assertFocusedAcquisition(before, after, owner);
    assert.equal(before.islands[0].expression, undefined);
});
test('acquisition cannot hide automatic equipment, wallet changes, another receipt, photo change or learning write', () => {
    for (const mutate of [state => { state.islands[0].expression.selection.soundscape = SHELL_ITEM; },
        state => { state.islands[0].customization.points--; }, state => { state.islandEvents[1].type = 'changed'; },
        state => { state.islandPhotos[0].sha256 = 'new'; }, state => { state.logs.push({ id: 'fake' }); }]) {
        const { before, after } = acquisition(); mutate(after); assert.throws(() => assertFocusedAcquisition(before, after, owner));
    }
});
test('missing qualification and already-owned acquisition cannot count as the genuine path', () => {
    const { before, after } = acquisition(); before.islands[0].workshop.creations = [];
    assert.throws(() => assertFocusedAcquisition(before, after, owner), /Saved bell/);
    before.islands[0].workshop.creations = [{ partId: 'bell' }]; before.islands[0].expression = structuredClone(after.islands[0].expression);
    assert.throws(() => assertFocusedAcquisition(before, after, owner), /new explicit/);
});
function bellEvidence() {
    const workshop = emptyWorkshop(owner), layout = workshop.draftCheckpoint.draft.layout;
    ['straight', 'wheel', 'bell'].forEach((id, col) => { layout.parts[id] = { assembled: true, rotation: 0, position: { col, row: 1 } }; });
    workshop.creations = [{ id: `island-workshop:v1:creation:${owner}:wheel`, partId: 'wheel', observedAt: 20, order: 1, layout: structuredClone(layout) }];
    const before = { profileId: owner, revision: 1, updatedAt: 20, workshop }, after = structuredClone(before);
    after.revision++; after.updatedAt = 30;
    after.workshop.creations.push({ id: `island-workshop:v1:creation:${owner}:bell`, partId: 'bell', observedAt: 30, order: 2, layout: structuredClone(layout) });
    const layoutKey = JSON.stringify(layout), event = { id: `island-workshop:v1:operation:${JSON.stringify([owner, 1])}`, profileId: owner,
        type: 'workshop_changed', timestamp: 30, action: { type: 'observe-creation', partId: 'bell', layoutKey } };
    const frame = (at, beat, complete, reached) => ({ capturedAt: at, hidden: false, workshop: { active: true, mode: 'build', replay: false, run: { beat, complete, reached } } });
    const first = frame(11, 'source', false, []), bell = frame(20, 'bell', false, ['straight', 'wheel']), complete = { ...frame(25, 'bell', true, ['straight', 'wheel', 'bell']), file: 'actual.png', sha256: 'actual-hash' };
    return { layoutKey, trace: { gesture: { trusted: true, hidden: false, at: 10 }, frames: [first, bell, complete], images: [complete] },
        audit: { errors: [], commits: [{ at: 30, event, before, operations: [{ store: 'islandEvents', value: event }, { store: 'islands', value: after }] }] } };
}
test('bell evidence requires the rendered terminal frame before the exact native observation commit', () => {
    const { trace, audit, layoutKey } = bellEvidence(); assert.equal(assertFocusedBellObservation(trace, audit, owner, layoutKey).pass, true);
});
test('a late, hidden, replayed or missing terminal picture cannot prove the qualification', () => {
    for (const mutate of [trace => { trace.images[0].capturedAt = 31; }, trace => { trace.images[0].hidden = true; },
        trace => { trace.images[0].workshop.replay = true; }, trace => { trace.images = []; },
        trace => { trace.gesture.trusted = false; }, trace => { trace.images[0].workshop.run.reached = ['bell']; }]) {
        const { trace, audit, layoutKey } = bellEvidence(); mutate(trace);
        assert.throws(() => assertFocusedBellObservation(trace, audit, owner, layoutKey));
    }
});
test('wrong owner/layout, duplicate native completion or unexplained native mutation are rejected', () => {
    const { trace, audit, layoutKey } = bellEvidence();
    assert.throws(() => assertFocusedBellObservation(trace, audit, 'other', layoutKey));
    assert.throws(() => assertFocusedBellObservation(trace, audit, owner, '{}'));
    const duplicate = structuredClone(audit); duplicate.commits.push(duplicate.commits[0]);
    assert.throws(() => assertFocusedBellObservation(trace, duplicate, owner, layoutKey), /Exactly one/);
    const corrupt = structuredClone(audit); corrupt.commits[0].operations[1].value.unrelated = 'changed';
    assert.throws(() => assertFocusedBellObservation(trace, corrupt, owner, layoutKey));
});

test('a roundtrip cannot silently adopt a changed reservation or another table as a new baseline', () => {
    const original = { id: 'initial-plan', profileId: owner, status: 'active', revision: 0, cursor: 0, slots: [{ problem: 'original' }] };
    const before = { islands: [{ profileId: owner, pendingPlanId: original.id }], islandPlans: [original], logs: [] };
    assertFocusedBaseline(before, structuredClone(before), owner, original);
    const replaced = structuredClone(before); replaced.islands[0].pendingPlanId = 'other-plan'; replaced.islandPlans.push({ ...original, id: 'other-plan' });
    assert.throws(() => assertFocusedReservation(replaced, owner, original));
    assert.throws(() => assertFocusedBaseline(before, replaced, owner, original), /unverified UI roundtrip/);
    const advanced = structuredClone(before); advanced.islandPlans[0].revision++;
    assert.throws(() => assertFocusedReservation(advanced, owner, original), /full initial reservation/);
    const mutation = structuredClone(before); mutation.logs.push({ id: 'not-an-answer' });
    assert.throws(() => assertFocusedBaseline(before, mutation, owner, original), /unverified UI roundtrip/);
});
test('the non-final answer guard rejects whole-island row loss/addition and an unenumerated growth branch', () => {
    const before = { islands: [{ profileId: owner, growth: { futureBranch: ['keep'] }, revision: 9 }, { profileId: 'other' }] };
    assertFocusedAnswerIslands(before, structuredClone(before));
    for (const mutate of [value => { value.islands.pop(); }, value => { value.islands.push({ profileId: 'third' }); },
        value => { value.islands[0].growth.futureBranch = []; }, value => { value.islands[0].unknownNewField = true; }]) {
        const after = structuredClone(before); mutate(after); assert.throws(() => assertFocusedAnswerIslands(before, after));
    }
});
test('all native learning history rejects a short ambience that already stopped, while allowing a learning cue', () => {
    const before = { at: 100, probe: { sources: [{ id: 'loop', ambienceCandidate: true, startedAt: 10, stopAt: null }] } };
    const after = { at: 200, probe: { sources: [{ ...before.probe.sources[0], stopAt: 101 }, { id: 'answer-cue', ambienceCandidate: false, startedAt: 120, endedAt: 130 }] } };
    assertNoLearningAmbienceStart(before, after);
    const transient = structuredClone(after); transient.probe.sources.push({ id: 'transient-loop', ambienceCandidate: true, startedAt: 110, stopAt: 115, endedAt: 116 });
    assert.throws(() => assertNoLearningAmbienceStart(before, transient), /even if it already stopped/);
    const forgedOld = structuredClone(transient); forgedOld.probe.sources[2].startedAt = 1;
    assert.throws(() => assertNoLearningAmbienceStart(before, forgedOld), /No new island ambience/);
    const reset = structuredClone(after); reset.probe.sources.shift();
    assert.throws(() => assertNoLearningAmbienceStart(before, reset), /history cannot disappear/);
});
