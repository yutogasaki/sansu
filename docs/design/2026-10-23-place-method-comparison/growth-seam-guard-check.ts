import assert from 'node:assert/strict';
import observedJSON from './evidence/33-F2-used-state.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import type { GrowingState, Side } from '../../../src/domain/growingIsland/types';

declare const GROWTH_DIAGNOSTIC_MODE: 'A' | 'F';
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const fixture: GrowingState = { ...newIsland('growth-seam-guard-fault', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))), drops: 10_000 };
const results = [];
for (const sides of [['west', 'east'], ['east', 'west']] as Side[][]) {
    let state = structuredClone(fixture);
    for (const side of sides) state = applyIntent(state, { id: `setup-${side}`, command: { type: 'expand', side } }).state;
    assert(terrainOwnerSupported(state, { x: 2, z: 4 }));
    const before = structuredClone(state);
    const errors: string[] = [];
    for (let retry = 0; retry < 2; retry++) {
        assert.throws(() => applyIntent(state, { id: 'south-fault', command: { type: 'expand', side: 'south' } }), error => {
            errors.push(String(error)); return String(error).includes('ものの 足もと');
        });
        assert.deepEqual(state, before, 'Guard rejection must leave complete previous state unchanged, including drops and applied IDs');
    }
    results.push({ sides, rejectedSouthTwice: true, fullInputPreserved: true, drops: state.drops,
        benchSupported: terrainOwnerSupported(state, { x: 2, z: 4 }),
        preExistingFlowerSupported: terrainOwnerSupported(state, { x: 2, z: 3 }), errors });
}
console.log(JSON.stringify({ mode: GROWTH_DIAGNOSTIC_MODE, status: 'PASS',
    fixture: 'Fault injection only: disable inheritance while retaining real final guard in normal applyIntent; prove known south bench failure is rejected before commit. Economy fixture, no DB proof.', results }, null, 2));
