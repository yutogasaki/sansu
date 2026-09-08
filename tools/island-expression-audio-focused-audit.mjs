import assert from 'node:assert/strict';
import { assertWorkshopDelta, islandFor, orderEvents } from './island-qualified-audit.mjs';

export const SHELL_ITEM = 'shell-three-notes';
export const focusedSelection = () => ({ version: 1,
    residents: Object.fromEntries(['otter', 'rabbit', 'fox'].map(id => [id, { outfit: null, pattern: null, trail: null }])),
    soundscape: null, environment: { period: null, season: null }, album: { cover: null, stamp: null }, flagTrim: null });

export function assertFocusedReservation(tables, owner, originalPlan) {
    assert(originalPlan?.status === 'active');
    assert.equal(islandFor(tables, owner)?.pendingPlanId, originalPlan.id, 'The first verified reservation remains selected');
    assert.deepEqual(tables.islandPlans.find(plan => plan.id === originalPlan.id), originalPlan, 'The full initial reservation must survive optional work');
}
export function assertFocusedBaseline(baseline, nextBefore, owner, originalPlan) {
    assert(baseline, 'A verified all-table baseline is required');
    assert.deepEqual(nextBefore, baseline, 'An unverified UI roundtrip cannot replace the baseline');
    assertFocusedReservation(nextBefore, owner, originalPlan);
}
export function assertFocusedAnswerIslands(before, after) {
    assert.deepEqual(after.islands, before.islands, 'This non-final answer must preserve every complete island row, including row count');
}
export function assertNoLearningAmbienceStart(boundary, later) {
    assert(Number.isFinite(boundary.at) && Number.isFinite(later.at) && later.at >= boundary.at);
    const prior = new Map(boundary.probe.sources.map(source => [source.id, source]));
    const current = new Map(later.probe.sources.map(source => [source.id, source]));
    assert.equal(prior.size, boundary.probe.sources.length); assert.equal(current.size, later.probe.sources.length);
    for (const [id, source] of prior) {
        assert(current.has(id), 'Native source history cannot disappear after learning begins');
        assert.equal(current.get(id).startedAt, source.startedAt, 'Native source start provenance must remain unchanged');
    }
    for (const source of later.probe.sources.filter(source => source.ambienceCandidate)) {
        assert(Number.isFinite(source.startedAt) && source.startedAt < boundary.at && prior.has(source.id),
            'No new island ambience may begin during learning, even if it already stopped or ended');
    }
}

/** Independent, deliberately narrow oracle for this fresh, single-item route.
 * It reads all stores and cannot excuse another purchase, equip or goal edit. */
export function assertFocusedAcquisition(before, after, owner) {
    const expected = structuredClone(before), old = islandFor(before, owner), next = islandFor(after, owner), island = islandFor(expected, owner);
    assert(old && next && old.workshop?.creations.some(entry => entry.partId === 'bell'), 'Saved bell is required');
    assert(!old.expression?.ownedItemIds.includes(SHELL_ITEM), 'This is a new explicit acquisition');
    assert.equal(old.rewardGoal, undefined, 'The fresh route does not select a goal');
    assert.equal(old.customization.desiredItemId, null);
    assert(Number.isSafeInteger(next.updatedAt) && next.updatedAt >= old.updatedAt);
    island.revision++; island.updatedAt = next.updatedAt;
    island.expression ??= { version: 1, ownedItemIds: [], selection: focusedSelection() };
    assert.equal(island.expression.ownedItemIds.length, 0, 'No unrelated item is acquired in this route');
    island.expression.ownedItemIds.push(SHELL_ITEM);
    expected.islandEvents.push({ id: JSON.stringify(['island-expression-v1', owner, old.revision]), profileId: owner,
        type: 'expression_changed', timestamp: next.updatedAt, action: { type: 'acquire', itemId: SHELL_ITEM } });
    orderEvents(expected.islandEvents);
    assert.deepEqual(after, expected, 'Only the zero-star owned item and exact receipt may change; no automatic equip');
}

/** A committed observation must follow this trusted gesture and this actual
 * terminal frame. A constructed/connected layout is insufficient evidence. */
export function assertFocusedBellObservation(trace, audit, owner, layoutKey) {
    assert(trace?.gesture?.trusted && trace.gesture.hidden === false);
    assert.deepEqual(audit.errors, []);
    const matches = audit.commits.filter(value => value.event.profileId === owner && value.event.type === 'workshop_changed'
        && value.event.action.type === 'observe-creation' && value.event.action.partId === 'bell');
    assert.equal(matches.length, 1, 'Exactly one real first-bell commit is required');
    const commit = matches[0]; assert(commit.before && commit.at > trace.gesture.at);
    assert.deepEqual(commit.event.action, { type: 'observe-creation', partId: 'bell', layoutKey });
    assert.deepEqual(commit.operations.map(value => value.store).sort(), ['islandEvents', 'islands']);
    const committed = commit.operations.find(value => value.store === 'islands').value;
    assertWorkshopDelta({ islands: [commit.before], islandEvents: [] }, { islands: [committed], islandEvents: [commit.event] }, owner, [commit.event.action]);
    const first = trace.frames.find(frame => frame.capturedAt >= trace.gesture.at && frame.workshop?.run);
    assert(first && !first.workshop.run.complete && first.workshop.run.reached.length === 0, 'The new run begins empty');
    const bell = trace.frames.find(frame => frame.capturedAt > trace.gesture.at && frame.workshop?.run?.beat === 'bell' && !frame.workshop.run.complete);
    const complete = trace.images.find(frame => !frame.hidden && frame.capturedAt > trace.gesture.at && frame.capturedAt <= commit.at
        && frame.workshop?.active && frame.workshop.mode === 'build' && !frame.workshop.replay && frame.workshop.run?.complete
        && ['straight', 'wheel', 'bell'].every(id => frame.workshop.run.reached.includes(id)) && frame.file && frame.sha256);
    assert(bell && complete && bell.capturedAt < complete.capturedAt, 'Rendered bell and actual complete PNG must precede the native commit');
    return { event: commit.event, commitAt: commit.at, gesture: trace.gesture, firstFrame: first, bellFrame: bell,
        completedFrame: complete, layoutKey, pass: true };
}
