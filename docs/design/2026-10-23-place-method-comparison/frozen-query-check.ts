import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import observed from './evidence/69-H-wide-shore-final-state.json';
import { terrainMethod } from './section-profile';
import { candidateId } from './candidate';
import { parseTrialQuery, frozenTrialEnabled, trialQuery } from './frozen-query';

for (const search of ['', '?terrainTrial=H&terrainTrial=A', '?x=&a=%E5%B3%B6+b&x=second', '?a=%ZZ']) {
    const expected = new URLSearchParams(search), actual = parseTrialQuery(search);
    for (const key of ['terrainTrial', 'x', 'a', 'missing']) {
        assert.equal(actual.get(key), expected.get(key)); assert.equal(actual.has(key), expected.has(key));
    }
}
assert.equal(terrainMethod('?terrainTrial=B'), 'B');
assert.equal(terrainMethod('?terrainTrial=bogus'), 'A');
assert.equal(terrainMethod(''), 'A');
const state = { ...newIsland('frozen-query-check', 0), ...observed } as GrowingState;
const started = performance.now(), world = editableIslandWorld(state)!;
assert(world);
const queries = [];
for (let z = 0; z <= 7; z += .5) for (let x = -3; x <= 8; x += .5) {
    const cell = { x, z }; queries.push([world.floorAt(cell), world.owns(cell), world.siteAt({ x, y: world.floorAt(cell)?.point.y ?? 0, z })]);
}
for (let i = 0; i < 100; i++) terrainRevision(state);
console.log(JSON.stringify({ enabled: frozenTrialEnabled, candidate: candidateId(), mode: terrainMethod(),
    coldMs: performance.now() - started,
    hash: createHash('sha256').update(JSON.stringify([world.definition, world.floors, world.sites, queries])).digest('hex'),
    queryFlags: ['terrainTrial', 'baseTrial', 'rampTrial', 'growthTrial', 'compileTrial', 'trialScene'].map(key => [key, trialQuery().get(key)]) }));
