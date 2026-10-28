import assert from 'node:assert/strict';
import fixture from './evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { startTrialTiming, stopTrialTiming, trialTimingSnapshot, trialTimingEnter, trialTimingExit } from './timing-store';
declare const TIMING_ENABLED: boolean;
const state = structuredClone(fixture.state) as GrowingState, original = structuredClone(state);
if (TIMING_ENABLED) startTrialTiming();
const next = applyIntent(state, { id: 'timing-cold-edit', command: { type: 'terrain-edit', cell: { x: 4, z: 5 }, delta: 1 } }, 6000).state;
assert.deepEqual(state, original);
let message: string | undefined;
try { applyIntent(next, { id: 'timing-rejected-edit', command: { type: 'terrain-edit', cell: { x: 99, z: 99 }, delta: 1 } }, 6001); }
catch (error) { message = String(error); }
assert(message, 'The invalid action must still reject');
stopTrialTiming();
const snapshot = trialTimingSnapshot();
if (TIMING_ENABLED) {
    assert.equal(snapshot.incompleteSpans, 0);
    assert(snapshot.spans.some(s => s.name === 'applyIntent' && s.failed));
    assert(snapshot.spans.some(s => s.name === 'editableIslandWorld' && s.detail === 'cold'));
    assert(snapshot.spans.some(s => s.name === 'compileWorldDefinition'));
    assert(snapshot.spans.every(s => s.selfMs <= s.inclusiveMs + .001));
    // A standalone domain calculation while armed must not mutate timing data.
    startTrialTiming(); editableIslandWorld(next); stopTrialTiming(); assert.equal(trialTimingSnapshot().spans.length, 0);
    // Nested exception records retain the original thrown object.
    startTrialTiming(); const sentinel = new Error('identity'); const outer = trialTimingEnter('applyIntent', 'exception-probe');
    try { const child = trialTimingEnter('compileWorldDefinition', 'exception-probe'); try { throw sentinel; } finally { trialTimingExit(child, true); } }
    catch (error) { assert.equal(error, sentinel); } finally { trialTimingExit(outer, true); stopTrialTiming(); }
    assert.equal(trialTimingSnapshot().incompleteSpans, 0);
} else assert.equal(snapshot.spans.length, 0);
console.log(JSON.stringify({ enabled: TIMING_ENABLED, state: next, rejectedMessage: message, snapshot,
    limits: ['Node timing is not browser timing', 'No renderer or React mounted in this diagnostic; transform syntax checked separately'] }));
