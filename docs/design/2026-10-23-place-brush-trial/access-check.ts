import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { replacePlace, reachablePlacePlatform } from './model';
import { shapeOf, type PlaceShape } from './field';
import { placeEditingRevision, trialHistoryOf } from './persistent-model';
import { flatBodyFootprintSupported } from './flat-support';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { HOME_CELL, walkableCells } from '../../../src/domain/growingIsland/space';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';

const original = structuredClone(fixture.state) as unknown as GrowingState;
const unchanged = JSON.stringify(original), safety = { actors: [], occupiedPlaceTargets: [] };
const shape: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
let id = 0, state = original;
const command = (value: Command) => { state = applyIntent(state, { id: `access-${++id}`, command: value }, state.nature.realAt).state; };
const place = (action: 'apply' | 'undo' | 'redo', value = shape) => command({ type: 'place-outline', action, shape: value,
    safety, expectedPlaceRevision: placeEditingRevision(state) });
place('apply');
command({ type: 'move', id: 'starter-bench', cell: { x: 5, z: 5 } });
command({ type: 'move', id: 'starter-flower', cell: { x: 6, z: 5 } });
const owners = JSON.stringify(state.landmarks), world = editableIslandWorld(state)!, open = walkableCells(state, world);
const oldCandidates = world.walkSites.filter(site => Math.hypot(site.cell.x - 5, site.cell.z - 5) <= .6);
assert.equal(oldCandidates.length, 5);
assert(oldCandidates.every(site => !open.has(`${site.cell.x},${site.cell.z}`)));
const destination = reachablePlacePlatform(world, open, shape);
assert(destination);
assert(flatBodyFootprintSupported(world, destination));
assert(world.route(HOME_CELL, destination, open));
place('apply', { ...shape, entrance: 2 });
assert.equal(shapeOf(state)?.entrance, 2);
place('undo'); assert.deepEqual(shapeOf(state), shape);
place('redo'); assert.equal(shapeOf(state)?.entrance, 2);
assert.equal(JSON.stringify(state.landmarks), owners);
assert.equal(trialHistoryOf(state)?.undo.length, 2);

// Reachable land outside the plateau is insufficient. Removing only the
// platform's open destinations must not allow a surrounding rim to pass.
const outside = new Set([...open].filter(key => {
    const [x, z] = key.split(',').map(Number);
    return Math.hypot(x - 5, (z - 5) / .8) > 1.75;
}));
assert(outside.has(`${HOME_CELL.x},${HOME_CELL.z}`));
assert.equal(reachablePlacePlatform(world, outside, shape), undefined);
assert.equal(reachablePlacePlatform(world, new Set([`${HOME_CELL.x},${HOME_CELL.z}`, `${destination.x},${destination.z}`]), shape), undefined);
assert.equal(reachablePlacePlatform(world, open, { ...shape, height: -.55 }), undefined);
assert.throws(() => replacePlace(original, { ...shape, height: .9 }, safety), /広さが足りない/);
assert.throws(() => replacePlace(state, undefined, safety), /足もと/);
assert.equal(JSON.stringify(original), unchanged);
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', scope: 'Actual transformed domain; empty actor precondition, not browser proof',
    oldBlockedCore: oldCandidates.map(site => site.cell), reachablePlatform: destination,
    route: world.route(HOME_CELL, destination, open), history: trialHistoryOf(state),
    cases: ['occupied-centre entrance edit', 'Undo/Redo preserves owners', 'outer rim only rejected', 'disconnected top rejected',
        'different/wet height rejected', 'short high ramp rejected', 'unsafe owner Undo rejected', 'original state immutable'] }, null, 2));
