import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, landCells, walkableCells } from '../../../src/domain/growingIsland/space';
import { terrainEditingRevision } from '../../../src/domain/growingIsland/terrainEditing';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import { diagnosticPlanFor, type PlaceShape } from './directional-field';
import { TRIAL_PLACE_RECIPE, placeEditingRevision, type PersistentPlaceState } from './persistent-model';

const base: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const safety = { actors: [], occupiedPlaceTargets: [] };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function initial(shape: PlaceShape): PersistentPlaceState {
    const state = structuredClone(fixture.state) as unknown as PersistentPlaceState;
    state.trialPlace = structuredClone(shape);
    state.trialPlaceHistory = { version: 1, recipe: TRIAL_PLACE_RECIPE, undo: [{ after: structuredClone(shape) }], redo: [] };
    return state;
}
function editShape(state: GrowingState, shape: PlaceShape, id: string) {
    return applyIntent(state, { id, command: { type: 'place-outline', action: 'apply', shape, safety,
        expectedPlaceRevision: placeEditingRevision(state) } }, 1000).state;
}
function evictWorlds() {
    // The real cache keeps eight revisions. These ten distinct acquired-ground
    // edits force a rebuild without reaching into the cache or the plan maps.
    for (let i = 0; i < 10; i++) {
        const other = structuredClone(fixture.state) as unknown as GrowingState;
        other.terrain!.heights['-3,0'] = (i % 5) - 2;
        other.terrain!.heights['-3,1'] = Math.floor(i / 5) + 1;
        editableIslandWorld(other);
    }
}
function signature(state: GrowingState, world: IslandWorld) {
    const open = walkableCells(state, world);
    const routes = landCells(state).map(cell => ({ cell, route: world.route(HOME_CELL, cell, open) ?? null }));
    return { floorSHA256: hash(world.floors), routeSHA256: hash(routes),
        vertices: world.floors.reduce((sum, floor) => sum + floor.vertices.length, 0),
        reachable: routes.filter(route => route.route).length, routeTargets: routes.length };
}
const reports: Record<string, unknown>[] = [];
const cases: { name: string; before: PlaceShape; edit: (state: GrowingState) => GrowingState }[] = [
    { name: 'west-height-0.5-to-0.9', before: { ...base, rampDirection: 'west' },
        edit: state => editShape(state, { ...base, height: .9, rampDirection: 'west' }, 'cache-west-height') },
    { name: 'inherited-north-height-0.3-to-0.5', before: { ...base, height: .3 },
        edit: state => editShape(state, base, 'cache-north-height') },
    { name: 'west-underlying-terrain-2-5-down', before: { ...base, height: .9, rampDirection: 'west' },
        edit: state => {
            // The landing currently holds the flower. Move both owners through
            // ordinary commands before testing a valid source-terrain edit.
            for (const [id, cell] of [['starter-bench', { x: 5, z: 5 }], ['starter-flower', { x: 6, z: 5 }]] as const)
                state = applyIntent(state, { id: `cache-prepare-${id}`, command: { type: 'move', id, cell } }, 1000).state;
            // The previous world must be cold when the command validates its
            // mutable clone, or a warm hit can conceal the stale-plan defect.
            evictWorlds();
            return applyIntent(state, { id: 'cache-terrain-down', command: { type: 'terrain-edit', cell: { x: 2, z: 5 }, delta: -1,
                actors: [], occupiedPlaceTargets: [], expectedTerrainRevision: terrainEditingRevision(state) } }, 1000).state;
        } },
];
for (const test of cases) {
    const report: Record<string, unknown> = { name: test.name };
    try {
        evictWorlds();
        const source = initial(test.before), sourceSnapshot = JSON.stringify(source);
        const state = test.edit(source) as PersistentPlaceState;
        assert.notEqual(state, source, 'actual command must apply, not be a no-op');
        assert.equal(JSON.stringify(source), sourceSnapshot, 'actual command must preserve its input');
        const snapshot = JSON.stringify(state), revision = terrainRevision(state);
        const beforeWorld = editableIslandWorld(state)!;
        const before = signature(state, beforeWorld), beforePlan = diagnosticPlanFor(state);
        assert.equal(editableIslandWorld(state), beforeWorld, 'same revision remains a cache hit');
        assert.equal(JSON.stringify(state), snapshot, 'cache hit must not mutate state');
        evictWorlds();
        const afterWorld = editableIslandWorld(state)!;
        const after = signature(state, afterWorld), afterPlan = diagnosticPlanFor(state);
        const rebuilt = beforeWorld !== afterWorld;
        const floorEqual = before.floorSHA256 === after.floorSHA256, routesEqual = before.routeSHA256 === after.routeSHA256;
        const unchanged = JSON.stringify(state) === snapshot && terrainRevision(state) === revision;
        const freshClone = structuredClone(state);
        evictWorlds();
        const cloneWorld = editableIslandWorld(freshClone)!;
        const clone = signature(freshClone, cloneWorld);
        const cloneEqual = clone.floorSHA256 === before.floorSHA256 && clone.routeSHA256 === before.routeSHA256;
        Object.assign(report, { before, after, clone, lastPlanForStateBefore: beforePlan, lastPlanForStateAfter: afterPlan,
            planNote: 'Last plan compiled for this state object; on a cache hit it can predate a mutation. Geometry equality is checked independently.',
            rebuilt, floorEqual, routesEqual, unchanged, cloneEqual,
            shape: state.trialPlace, shapeHistorySHA256: hash(state.trialPlaceHistory), terrainHistorySHA256: hash(state.terrain),
            pass: rebuilt && floorEqual && routesEqual && unchanged && cloneEqual });
    } catch (error) { report.error = String(error); report.pass = false; }
    reports.push(report);
}
const pass = reports.every(report => report.pass);
console.log(JSON.stringify({ at: new Date().toISOString(), status: pass ? 'PASS' : 'FAIL',
    scope: 'Actual transformed applyIntent, real eight-entry world-cache eviction, exact serialized floor and all acquired-site route equality; no browser claim', reports }, null, 2));
assert(pass, 'plan-cache determinism cases must all pass; see report above');
