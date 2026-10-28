import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Check saved, read-only UI observations. This never starts a browser or writes a save.
const folder = new URL('./evidence/', import.meta.url);
const names = ['04-A-initial-state', '07-B-moved-state', '10-B-reloaded-state', '11-B-undo-state', '12-B-redo-state'];
const observations = await Promise.all(names.map(async name => {
    const source = await readFile(new URL(`${name}.json`, folder), 'utf8');
    return { name, sha256: createHash('sha256').update(source).digest('hex'), state: JSON.parse(source) };
}));
const [initial, moved, reloaded, undone, redone] = observations.map(value => value.state);
const ownersWithoutPosition = state => state.landmarks.map(({ cell: _cell, ...owner }) => owner);
assert.deepEqual(ownersWithoutPosition(moved), ownersWithoutPosition(initial));
for (const field of ['land', 'plots', 'villagers', 'character', 'drops', 'town']) assert.deepEqual(moved[field], initial[field], field);
assert.notDeepEqual(moved.landmarks, initial.landmarks);
assert.notEqual(moved.places[0].revision, initial.places[0].revision);
const uses = Object.values(moved.placeProgress.uses.P05);
assert.ok(uses.some(use => use.actorId === 'pokomoko' && use.revision === moved.places[0].revision));
assert.ok(uses.some(use => use.actorId === 'v2' && use.revision === moved.places[0].revision));
for (const field of ['land', 'terrain', 'landmarks', 'plots', 'places']) assert.deepEqual(reloaded[field], moved[field], `reload:${field}`);
assert.deepEqual(reloaded.placeProgress.useHistory, moved.placeProgress.useHistory, 'reload preserves every use fact');
assert.notDeepEqual(undone.terrain.heights, reloaded.terrain.heights);
assert.deepEqual(undone.landmarks, reloaded.landmarks);
assert.deepEqual(redone.terrain, reloaded.terrain);
assert.deepEqual(redone.landmarks, reloaded.landmarks);
const result = { checkedAt: new Date().toISOString(), status: 'PASS', observations: observations.map(({ name, sha256 }) => ({ name, sha256 })),
    scope: '390×844, real local app, existing owner save. Normal UI moves, natural resident use, real reload, terrain Undo/Redo.',
    checks: ['same acquired land/owners/maturity/currency', 'new arrangement and place revision', 'both actors used the current place', 'reload retained positions and complete useHistory', 'Undo changed terrain only; Redo restored it'],
    excluded: ['new acquisition', 'every store', 'offline or two-build update', 'child comprehension', 'visual acceptance'],
    receiptNote: 'The latest target slot may point to an earlier fact after another natural use. useHistory is immutable and is compared in full; latest at is not a monotonic counter.' };
await writeFile(new URL('ui-check.json', folder), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
