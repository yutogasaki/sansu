import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const folder = new URL('./evidence/', import.meta.url);
const names = ['18-terrace-input-state', '29-F2-shaped-state', '30-F2-undo-state', '31-F2-redo-state', '32-F2-placed-state', '33-F2-used-state', '34-F2-reloaded-state'];
const observations = await Promise.all(names.map(async name => {
    const source = await readFile(new URL(`${name}.json`, folder), 'utf8');
    return { name, sha256: createHash('sha256').update(source).digest('hex'), state: JSON.parse(source) };
}));
const [input, shaped, undone, redone, placed, used, reloaded] = observations.map(item => item.state);
const inventory = state => state.landmarks.map(({ cell: _cell, ...owner }) => owner);
for (const state of [shaped, undone, redone, placed, used, reloaded]) {
    assert.deepEqual(inventory(state), inventory(input));
    for (const field of ['land', 'plots', 'villagers', 'character', 'drops', 'town']) assert.deepEqual(state[field], input[field], field);
}
const heights = { ...input.terrain.heights, '2,2': 1, '3,3': 1, '1,4': 1, '3,4': 1, '2,4': 2 };
assert.deepEqual(shaped.terrain.heights, heights);
assert.equal(shaped.terrain.undo.length - input.terrain.undo.length, 6);
assert.equal(undone.terrain.heights['2,4'], 1);
assert.deepEqual(redone.terrain, shaped.terrain);
assert.deepEqual(placed.landmarks.map(owner => owner.cell), [{ x: 2, z: 3 }, { x: 2, z: 4 }]);
for (const actorId of ['pokomoko', 'v2']) assert.ok(used.placeProgress.useHistory.some(use => use.actorId === actorId && use.revision === used.places[0].revision));
for (const field of ['landmarks', 'terrain', 'places']) assert.deepEqual(reloaded[field], used[field]);
assert.ok(used.placeProgress.useHistory.every(fact => reloaded.placeProgress.useHistory.some(after => JSON.stringify(after) === JSON.stringify(fact))));
const result = {
    status: 'PASS', checkedAt: new Date().toISOString(),
    scope: 'F2 local actual app: six normal height commands, Undo/Redo, inventory placement, natural uses and reload',
    observations: observations.map(({ name, sha256 }) => ({ name, sha256 })),
    checks: ['six expected height changes only', 'existing acquired land, owners, tent, villager and funds retained', 'Undo then Redo restored the complete terrain history', 'both actual actors used the current new place', 'reload retained owners, terrain and every prior use fact'],
    limits: ['successful Undo was before furniture placement', 'not a proof that F is better than A with identical inputs', 'not visual acceptance or independent child comprehension', 'not production/offline/update acceptance'],
};
await writeFile(new URL('convex-ui-check.json', folder), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
