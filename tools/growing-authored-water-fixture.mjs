import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { makeAuthoredFixture } from './growing-authored-fixture.mjs';

assert((process.argv.length === 4 || process.argv.length === 6 && process.argv[4] === '--world-output') && process.argv[2] === '--output', 'Use --output NEW_FILE [--world-output NEW_FILE]');
const fixture = await makeAuthoredFixture();
console.log(JSON.stringify({ phase: 'source-fixture-ready', owners: fixture.ownership.length }));
const compiled = await build({ stdin: { contents: `
    export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
    export { applyIntent } from './src/domain/growingIsland/commands.ts';
    export { composeAuthoredWaterWorld } from './src/domain/growingIsland/authoredWaterWorld.ts';
    export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
    export { derivePlaces } from './src/domain/growingIsland/places.ts';
    export { key, reachableFromHome, isReachable } from './src/domain/growingIsland/space.ts';
    export { hasAuthoredPlacementSupport } from './src/domain/growingIsland/authoredPlacementSupport.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = [...new Set([...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'), ...Object.keys(fixture.sources),
    'tools/growing-authored-water-fixture.mjs', 'package-lock.json', 'prototypes/place-qa/native05-world.json.gz',
    'docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz', 'prototypes/place-qa/native-water-bridge.json.gz'])].sort();
const sourceHashes = () => Promise.all(inputs.map(async file => [file, sha(await readFile(file))])).then(Object.fromEntries);
const initialSources = await sourceHashes();
let bundle = compiled.outputFiles[0].text;
const profiled = process.env.SANSU_AUTHORED_WATER_PROFILE === '1';
if (profiled) {
    bundle = `var __waterTimings = Object.create(null);\n${bundle}`;
    for (const name of ['composeAuthoredWaterWorld', 'compileWorldDefinition', 'isWorldWalkEdgeSupported', 'isAuthoredWaterCarvingSafe',
        'poolFor', 'streamFor', 'floorIntersectsOutline', 'bankFor', 'findAuthoredShoreEntries', 'composeAuthoredWaterBridges', 'dryLanding', 'makeDeck']) {
        const declaration = `function ${name}(`;
        assert.equal(bundle.split(declaration).length, 2, `Unique profile function ${name}`);
        bundle = bundle.replace(declaration, `function __profile_${name}(`);
        bundle += `\nfunction ${name}(...args) { const start = performance.now(); try { return __profile_${name}(...args); }
            finally { const entry = __waterTimings[${JSON.stringify(name)}] ??= { calls: 0, ms: 0 }; entry.calls++; entry.ms += performance.now() - start; } }\n`;
    }
    bundle += '\nexport { __waterTimings };\n';
}
const d = await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`);
const base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(await readFile('prototypes/place-qa/native05-world.json.gz')))));
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
console.log(JSON.stringify({ phase: 'compose-native-water', owners: owners.length }));
if (profiled) for (const name of Object.keys(d.__waterTimings)) delete d.__waterTimings[name];
const started = performance.now(), frame = d.composeAuthoredWaterWorld(state, base), composeMs = performance.now() - started;
console.log(JSON.stringify({ phase: 'native-water-composed', composeMs, pools: frame.plan.pools.length, bridges: frame.plan.bridges.length, stages: d.__waterTimings }));
if (process.argv[5]) {
    await writeFile(process.argv[5], `${JSON.stringify(frame.world.definition)}\n`, { flag: 'wx' });
    await writeFile(`${process.argv[5]}.metadata.json`, `${JSON.stringify({ state, plan: frame.plan, composeMs, stages: d.__waterTimings,
        timingScope: profiled ? 'Diagnostic Node function instrumentation; nested timings, not browser/device acceptance' : 'Uninstrumented Node composition',
        initialSources, finalSources: await sourceHashes() }, null, 2)}\n`, { flag: 'wx' });
}
const reached = d.reachableFromHome(state, undefined, frame.world);
assert.equal(frame.world.sites.filter(site => site.placement).length, 73);
const anchorSignature = world => world.sites.map(site => [site.ref, site.cell, site.point, site.placement]);
const nonWalkEdges = world => world.definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
assert.deepEqual(anchorSignature(frame.world), anchorSignature(base));
assert.deepEqual(nonWalkEdges(frame.world), nonWalkEdges(base));
for (const owner of owners) assert(d.isReachable(owner.cell, reached, frame.world), `Wet world approach ${owner.id}`);
for (const owner of owners.filter(owner => !frame.plan.ownerIds.includes(owner.id))) assert(d.hasAuthoredPlacementSupport(frame.world, owner.cell), `Whole dry footprint ${owner.id}`);
assert.equal(frame.plan.pools.length, 3);
assert.equal(frame.plan.streams.length, 4);
assert.equal(frame.plan.grottos.length, 1);
assert.equal(frame.plan.bridges.length, 1);
// Check the actual cut floors through each stream, including its pool mouths.
// Counting logical links alone does not establish continuous water geometry.
const continuity = frame.plan.streams.map(stream => {
    const floorIds = [...stream.waterFloorIds, ...frame.plan.pools.filter(pool => stream.ownerIds.includes(pool.ownerId)).map(pool => pool.waterFloorId)];
    const samples = stream.centerline.slice(1).flatMap((end, segment) => Array.from({ length: 21 }, (_, i) => {
        const start = stream.centerline[segment], t = i / 20;
        const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t };
        const cell = base.logicalAt(point);
        const support = cell && floorIds.map(id => frame.world.sampleFloorAt(cell, id)).find(sample => sample && Math.abs(sample.point.y - point.y) < .004);
        return { segment, point, supported: Boolean(support), floorId: support?.floorId, waterY: support?.point.y };
    }));
    if (!samples.every(sample => sample.supported)) console.error(JSON.stringify({ stream, unsupported: samples.filter(sample => !sample.supported) }, null, 2));
    assert(samples.every(sample => sample.supported), `Actual continuous water ${stream.id}`);
    return { id: stream.id, samples };
});
fixture.state = state; fixture.candidate = 'native05-authored-water-garden-v2';
fixture.ownership = owners.map(({ id, kind, cell }) => ({ id, kind, cell }));
fixture.conditions.push('Synthetic hill water arrangement; original shore/flower goals may become seeded', 'Actual water geometry; not original native05 three-basin positions or art acceptance');
fixture.projection = { places: d.derivePlaces(state, frame.world), reachableWalkingPoints: reached.size, waterPlan: frame.plan, continuity };
fixture.waterSources = await sourceHashes();
assert.deepEqual(fixture.waterSources, initialSources, 'Native fixture inputs changed during composition');
fixture.waterSourceHash = sha(JSON.stringify(fixture.waterSources));
await writeFile(process.argv[3], `${JSON.stringify(fixture, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ candidate: fixture.candidate, owners: owners.length, rights: 73, pools: frame.plan.pools.length,
    streams: frame.plan.streams.length, grottos: frame.plan.grottos.length, bridges: frame.plan.bridges.length, composeMs,
    continuitySamples: continuity.reduce((count, stream) => count + stream.samples.length, 0), reached: reached.size, revision: frame.world.definition.revision }));
