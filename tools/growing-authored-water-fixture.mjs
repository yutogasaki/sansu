import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { makeAuthoredFixture } from './growing-authored-fixture.mjs';

assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output NEW_FILE');
const fixture = await makeAuthoredFixture();
const compiled = await build({ stdin: { contents: `
    export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
    export { applyIntent } from './src/domain/growingIsland/commands.ts';
    export { composeAuthoredWaterWorld } from './src/domain/growingIsland/authoredWaterWorld.ts';
    export { derivePlaces } from './src/domain/growingIsland/places.ts';
    export { key, reachableFromHome, isReachable } from './src/domain/growingIsland/space.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const base = d.compileWorldDefinition(JSON.parse(gunzipSync(await readFile('prototypes/place-qa/native05-world.json.gz'))));
let state = fixture.state;
const before = structuredClone(state), moves = { l25: [2, -7], l20: [5, -9], l21: [6, -9], l22: [8, -9],
    l23: [7, -9], l24: [7, -8], l26: [10, -8], l16: [6, -10] };
for (const [id, [x, z]] of Object.entries(moves)) {
    // This is a new synthetic arrangement, built through ordinary commands.
    // No existing player's acquisition, clocks or owner fields are rewritten.
    const old = [...state.plots, ...state.landmarks].find(owner => owner.id === id);
    const cell = { x, z };
    state = d.applyIntent(state, { id: `water-arrange-${id}`, command: { type: 'move', id, cell } }, fixture.epoch, base).state;
    fixture.relocations.push({ id, kind: old.kind, from: old.cell, to: cell });
}
const owners = [...state.plots, ...state.landmarks], oldOwners = [...before.plots, ...before.landmarks];
assert.equal(owners.length, 27);
for (const owner of owners) {
    const old = oldOwners.find(item => item.id === owner.id);
    assert.deepEqual({ ...owner, cell: old.cell }, old, 'Only synthetic owner cells change');
    assert.equal(owners.filter(item => d.key(item.cell) === d.key(owner.cell)).length, 1);
}
const frame = d.composeAuthoredWaterWorld(state, base), reached = d.reachableFromHome(state, undefined, frame.world);
assert.equal(frame.world.sites.filter(site => site.placement).length, 73);
for (const owner of owners) assert(d.isReachable(owner.cell, reached, frame.world), `Wet world approach ${owner.id}`);
assert.equal(frame.plan.pools.length, 3);
assert.equal(frame.plan.streams.length, 4);
// Check the actual cut floors through each stream, including its pool mouths.
// Counting logical links alone does not establish continuous water geometry.
const continuity = frame.plan.streams.map(stream => {
    const floorIds = [...stream.waterFloorIds, ...frame.plan.pools.filter(pool => stream.ownerIds.includes(pool.ownerId)).map(pool => pool.waterFloorId)];
    const samples = Array.from({ length: 41 }, (_, i) => {
        const point = { x: stream.from.x + (stream.to.x - stream.from.x) * i / 40, z: stream.from.z + (stream.to.z - stream.from.z) * i / 40 };
        const cell = base.logicalAt(point);
        return { point, supported: Boolean(cell && floorIds.some(id => frame.world.sampleFloorAt(cell, id))) };
    });
    if (!samples.every(sample => sample.supported)) console.error(JSON.stringify({ stream, unsupported: samples.filter(sample => !sample.supported) }, null, 2));
    assert(samples.every(sample => sample.supported), `Actual continuous water ${stream.id}`);
    return { id: stream.id, samples };
});
fixture.state = state; fixture.candidate = 'native05-authored-water-m1-v1';
fixture.ownership = owners.map(({ id, kind, cell }) => ({ id, kind, cell }));
fixture.conditions.push('Synthetic hill water arrangement; original shore/flower goals may become seeded', 'Actual water geometry; not original native05 three-basin positions or art acceptance');
fixture.projection = { places: d.derivePlaces(state, frame.world), reachableWalkingPoints: reached.size, waterPlan: frame.plan, continuity };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = [...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'), 'tools/growing-authored-water-fixture.mjs', 'package-lock.json'].sort();
fixture.waterSources = Object.fromEntries(await Promise.all(inputs.map(async file => [file, sha(await readFile(file))])));
fixture.waterSourceHash = sha(JSON.stringify(fixture.waterSources));
await writeFile(process.argv[3], `${JSON.stringify(fixture, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ candidate: fixture.candidate, owners: owners.length, rights: 73, pools: frame.plan.pools.length,
    streams: frame.plan.streams.length, reached: reached.size, revision: frame.world.definition.revision }));
