import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Consumes observations exposed by the visible read-only panel. No save writes.
const folder = new URL('./evidence/', import.meta.url);
const names = ['04-A-initial-state', '18-terrace-input-state', '22-D2-placed-state', '23-D2-used-state', '24-D2-reloaded-state'];
const observations = await Promise.all(names.map(async name => {
    const source = await readFile(new URL(`${name}.json`, folder), 'utf8');
    return { name, sha256: createHash('sha256').update(source).digest('hex'), state: JSON.parse(source) };
}));
const [initial, stored, placed, used, reloaded] = observations.map(item => item.state);
const inventory = state => state.landmarks.map(({ cell: _cell, ...owner }) => owner);
for (const state of [stored, placed, used, reloaded]) {
    assert.deepEqual(inventory(state), inventory(initial));
    for (const field of ['land', 'plots', 'villagers', 'character', 'drops', 'town']) assert.deepEqual(state[field], initial[field], field);
}
assert.ok(stored.landmarks.every(owner => !owner.cell));
assert.deepEqual(placed.landmarks.map(owner => owner.cell), [{ x: 1, z: 3 }, { x: 2, z: 3 }]);
assert.deepEqual(placed.terrain, stored.terrain);
assert.notEqual(used.places[0].revision, initial.places[0].revision);
for (const actorId of ['pokomoko', 'v2']) assert.ok(used.placeProgress.useHistory.some(use => use.actorId === actorId && use.revision === used.places[0].revision));
for (const field of ['landmarks', 'terrain', 'places']) assert.deepEqual(reloaded[field], used[field]);
assert.ok(used.placeProgress.useHistory.every(fact => reloaded.placeProgress.useHistory.some(after => JSON.stringify(after) === JSON.stringify(fact))));
const result = {
    status: 'PASS', checkedAt: new Date().toISOString(),
    scope: 'D2 limited two-step terrace: normal inventory placement, natural resident use, reload',
    observations: observations.map(({ name, sha256 }) => ({ name, sha256 })),
    checks: ['same acquired land, owners, maturity, currency and villagers', 'two ordinary placements on edited land', 'both actors used the new place revision', 'reload retained all prior use facts and the terrain/owners'],
    addedUseFactsAfterObservation: reloaded.placeProgress.useHistory.length - used.placeProgress.useHistory.length,
    occupiedUndo: 'Observed rejection, unchanged terrain, screenshot 25-D2-occupied-undo.png. Not counted as successful Undo.',
    excluded: ['D2 general edit acceptance: independently rejected for threshold jumps', 'visual acceptance', 'child comprehension', 'production/offline/update acceptance'],
};
await writeFile(new URL('terrace-ui-check.json', folder), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
