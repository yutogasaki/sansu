import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { getHeapStatistics } from 'node:v8';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Preparation does not authorize execution. Root must explicitly start each
// process after reviewing this runner and its fixed input manifest.
const args = process.argv.slice(2), mode = args[0];
assert(args.length === 2 && ['before', 'after'].includes(mode) && args[1] === '--start',
    'Usage (after authorization): node --expose-gc diagnose.mjs before|after --start');
const directory = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prepared = read(path.join(directory, 'prepared-inputs.json'));
const root = mode === 'before' ? prepared.candidate : prepared.afterRoot;
const expected = prepared[`${mode}Inputs`], expectedReviewed = prepared[`${mode}ReviewedFiles`];
assert(global.gc, 'Requires --expose-gc');
assert(!process.execArgv.some(x => /max.old.space/i.test(x)), 'Keep default heap limit');
assert(!/max.old.space/i.test(process.env.NODE_OPTIONS ?? ''), 'No heap override in NODE_OPTIONS');
assert.equal(process.version, prepared.node, 'Same Node version as original diagnostic');
assert.equal(getHeapStatistics().heap_size_limit, prepared.heapLimit, 'Same default heap limit');
const originalCwd = process.cwd(); process.chdir(root);
const output = path.join(directory, mode);
assert(!fs.existsSync(output), 'Fresh output directory required; do not overwrite a failed run');
fs.mkdirSync(output);
const events = fs.openSync(path.join(output, 'events.jsonl'), 'wx');
const started = performance.now(), MiB = 1024 ** 2, GiB = 1024 ** 3;
const memory = () => ({ ...process.memoryUsage(), heapLimit: getHeapStatistics().heap_size_limit });
const report = { scope: 'Three direct-domain states; no outer cache. Diagnostic only, not browser or application performance acceptance.',
    mode, root, node: process.version, argv: process.execArgv, heapLimit: getHeapStatistics().heap_size_limit,
    heapStopBytes: 3 * GiB, reserveBytes: 768 * MiB,
    scriptSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    preparedInputsSha256: sha(fs.readFileSync(path.join(directory, 'prepared-inputs.json'))),
    changedProjectionInputs: prepared.changedProjectionInputs,
    priorDiagnostic: { path: prepared.priorDiagnostic, sha256: prepared.priorDiagnosticSha256 },
    steps: [], completed: false,
    exclusions: ['Browser/GPU/render execution', 'Full acquisition/maturation journey', 'Actor/owner access acceptance', 'True transient peak attribution'] };
const save = () => fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
function flush(event, details = {}) {
    const entry = { event, elapsedMs: performance.now() - started, cpu: process.cpuUsage(), memory: memory(), ...details };
    fs.writeSync(events, `${JSON.stringify(entry)}\n`); fs.fsyncSync(events);
    console.log(JSON.stringify(entry)); return entry;
}
let stopReason;
function checkpoint(label, details = {}) {
    const beforeGC = memory(); global.gc();
    const entry = flush(label, { beforeGC, ...details });
    if (entry.memory.heapUsed >= report.heapStopBytes) {
        stopReason = `Retained heap reaches 3 GiB at ${label}`; throw new Error(stopReason);
    }
    return entry;
}
function reserve(label) {
    const used = process.memoryUsage().heapUsed;
    if (used + report.reserveBytes >= report.heapStopBytes) {
        stopReason = `Stop before ${label}: fixed 768 MiB reserve would exceed 3 GiB`;
        flush('self-stop', { stopReason, used }); throw new Error(stopReason);
    }
}
const inputs = () => Object.fromEntries(Object.keys(expected).map(file => [file, sha(fs.readFileSync(file))]));
const reviewed = () => Object.fromEntries(Object.keys(expectedReviewed).map(file => [file, sha(fs.readFileSync(file))]));
const c1Inputs = () => Object.fromEntries(Object.keys(prepared.beforeInputs).map(file => [file, sha(fs.readFileSync(path.join(prepared.candidate, file)))]));
const canonical = value => { const copy = structuredClone(value); delete copy.applied; delete copy.placeProgress; return copy; };
function digest(values) {
    const hash = createHash('sha256');
    for (const value of values) { hash.update(JSON.stringify(value) ?? 'undefined'); hash.update('\n'); }
    return hash.digest('hex');
}
function* physical(world) {
    for (const [kind, floors] of [['floor', world.floors], ['anchor', world.anchorFloors]]) for (const floor of floors) {
        yield [kind, floor.id, floor.kind];
        for (const vertex of floor.vertices) yield [vertex.cell, vertex.point];
        yield floor.indices;
    }
}
function* renderPayload(world) {
    // Stream one floor/surface at a time; do not retain a second world-sized copy.
    for (const floor of world.floors) yield ['floor', floor];
    for (const floor of world.anchorFloors) yield ['anchor', floor];
    for (const surface of world.surfaces) yield ['surface', surface];
}
function* sourcePayload(world) {
    const { districts, ...header } = world.definition; yield header;
    for (const district of districts) {
        const { floors, anchorFloors, surfaces, ...rest } = district; yield rest;
        for (const floor of floors) yield ['floor', floor];
        for (const floor of anchorFloors ?? []) yield ['anchor', floor];
        for (const surface of surfaces ?? []) yield ['surface', surface];
    }
}
function floorQueryProof(world) {
    const hash = createHash('sha256'); let count = 0;
    for (const site of world.sites) for (const dx of [-.28, 0, .28]) for (const dz of [-.28, 0, .28]) {
        const at = { x: site.cell.x + dx, z: site.cell.z + dz }, floor = world.floorAt(at);
        const inverses = floor ? [undefined, floor.point.y - .25, floor.point.y, floor.point.y + .25].map(y =>
            world.logicalAt({ x: floor.point.x, z: floor.point.z, ...(y === undefined ? {} : { y }) })) : [];
        hash.update(JSON.stringify([at, floor, inverses])); hash.update('\n'); count++;
    }
    return { count, sha256: hash.digest('hex') };
}
let local, installed;
try {
    const core = read(path.join(prepared.candidate, '..', 'core', 'report.json'));
    assert(core.pass && core.sourceFixed && core.revision === 'authored-shoulder-c1');
    assert.deepEqual(core.initialInputs, core.finalInputs);
    report.initialC1Inputs = c1Inputs(); assert.deepEqual(report.initialC1Inputs, prepared.beforeInputs);
    report.initialInputs = inputs(); assert.deepEqual(report.initialInputs, expected);
    report.initialReviewedFiles = reviewed(); assert.deepEqual(report.initialReviewedFiles, expectedReviewed);
    for (const [file, hash] of Object.entries(prepared.beforeInputs)) assert.equal(core.finalInputs[file], hash, `c1 core ${file}`);
    const require = createRequire(path.join(root, 'package.json')), { build } = require('esbuild');
    const extract = driver => driver.match(/const compiled = await build\(\{ stdin: \{ contents: `([\s\S]*?)`, resolveDir/)[1];
    const contents = extract(fs.readFileSync('tools/e2e-authored-shoulder.mjs', 'utf8'));
    assert.equal(contents, extract(fs.readFileSync(path.join(prepared.candidate, 'tools/e2e-authored-shoulder.mjs'), 'utf8')),
        'Projection export entry unchanged by driver cache removal');
    const bundle = await build({ stdin: { contents, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
        metafile: true, logLevel: 'silent' });
    local = new Set(['tools/e2e-authored-shoulder.mjs', 'package.json', 'package-lock.json',
        'prototypes/place-qa/native05-world-source-shading.json.gz', 'prototypes/place-qa/authored-shoulder-profile.json.gz',
        'prototypes/place-qa/native05-world-source-shading-manifest.json', 'prototypes/place-qa/authored-shoulder-profile-manifest.json',
        'prototypes/place-qa/authored-flower-reference-mature.json', 'prototypes/place-qa/authored-shoulder-reference-mature.json']);
    const moduleRoot = fs.realpathSync('node_modules');
    installed = new Map([['node_modules/.package-lock.json', path.join(moduleRoot, '.package-lock.json')]]);
    for (const file of Object.keys(bundle.metafile.inputs)) {
        if (file === '<stdin>') continue;
        const real = fs.realpathSync(path.resolve(file));
        if (real.startsWith(`${moduleRoot}${path.sep}`)) installed.set(`node_modules/${path.relative(moduleRoot, real)}`, real);
        else { const relative = path.relative(root, real); assert(!relative.startsWith('../'), `Outside root: ${file}`); local.add(relative); }
    }
    assert.deepEqual([...local].sort(), Object.keys(expected).sort(), 'Same 99 local projection inputs');
    const installedSnapshot = () => Object.fromEntries([...installed].map(([file, actual]) => [file, sha(fs.readFileSync(actual))]));
    report.initialInstalledDependencies = installedSnapshot();
    assert.deepEqual(report.initialInstalledDependencies, prepared.installedDependencies, 'Same six installed dependency inputs');
    for (const [file, hash] of Object.entries(report.initialInstalledDependencies)) assert.equal(core.finalInstalledDependencies[file], hash, `c1 installed ${file}`);
    report.bundleSha256 = sha(bundle.outputFiles[0].text);
    const d = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    const ground = JSON.parse(gunzipSync(fs.readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz')));
    const shoulder = JSON.parse(gunzipSync(fs.readFileSync('prototypes/place-qa/authored-shoulder-profile.json.gz')));
    let current = structuredClone(read('prototypes/place-qa/authored-flower-reference-mature.json').state);
    checkpoint('setup'); save(); reserve('base');
    const base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(ground));
    checkpoint('base-ready');
    async function step(label, state) {
        const before = checkpoint(`${label}:before`); reserve(label);
        const time = performance.now(), cpu = process.cpuUsage();
        // No caller-side Map, no stored frame array: use the real domain caches.
        const frame = d.authoredWorldFrame(state, base, { water: true, cove: true, shoulder });
        const afterNoGC = memory(), operationMs = performance.now() - time, operationCpu = process.cpuUsage(cpu);
        const after = checkpoint(`${label}:after`, { operationMs, operationCpu });
        const summary = { label, frameRevision: frame.revision, worldRevision: frame.world.revision,
            waterPlanRevision: frame.waterPlan?.revision, covePlanRevision: frame.covePlan?.revision,
            canonicalSha256: sha(JSON.stringify(canonical(state))), ownerCount: state.plots.length + state.landmarks.length,
            drops: state.drops, nextId: state.nextId, before: before.memory, afterNoGC, afterGC: after.memory, operationMs, operationCpu };
        report.steps.push(summary); save(); reserve(`${label}:proof`);
        summary.proof = { physicalSha256: digest(physical(frame.world)), renderPayloadSha256: digest(renderPayload(frame.world)),
            sourcePayloadSha256: digest(sourcePayload(frame.world)), floorQueries: floorQueryProof(frame.world),
            sitesSha256: digest([frame.world.sites, frame.world.walkSites]),
            planSha256: digest([frame.waterPlan, frame.covePlan]),
            triangleCount: frame.world.floors.reduce((n, floor) => n + floor.indices.length / 3, 0),
            rights: frame.world.sites.filter(site => site.placement).length };
        checkpoint(`${label}:proof-released`); save();
        await new Promise(resolve => setImmediate(resolve)); return frame;
    }
    let currentFrame = await step('baseline32', current);
    const cell = { x: 6, z: -7 };
    let preview = d.previewGrowingState(current, { kind: 'sapling', seed: false, style: 'plain', prospectiveOwnerId: 'l33', cell, allowed: [cell], valid: true });
    await step('preview-l33', preview); preview = null;
    checkpoint('apply-l33:before'); reserve('apply-l33');
    current = d.applyIntent(current, { id: 'shoulder-oracle-l33', command: { type: 'place', kind: 'sapling', cell } }, current.nature.realAt, currentFrame.world).state;
    checkpoint('apply-l33:after');
    currentFrame = await step('commit-l33', current);
    assert.equal(report.steps.length, 3); report.completed = true;
    currentFrame = null; current = null;
} catch (error) {
    report.error = error.stack; report.selfStopped = Boolean(stopReason); report.stopReason = stopReason;
    flush('diagnostic-error', { error: String(error), selfStopped: Boolean(stopReason) }); process.exitCode = 1;
} finally {
    report.finalInputs = inputs(); report.inputsUnchanged = JSON.stringify(report.initialInputs) === JSON.stringify(report.finalInputs);
    report.finalReviewedFiles = reviewed(); report.reviewedFilesUnchanged = JSON.stringify(report.initialReviewedFiles) === JSON.stringify(report.finalReviewedFiles);
    report.finalC1Inputs = c1Inputs(); report.c1InputsUnchanged = JSON.stringify(report.initialC1Inputs) === JSON.stringify(report.finalC1Inputs);
    if (installed) {
        report.finalInstalledDependencies = Object.fromEntries([...installed].map(([file, actual]) => [file, sha(fs.readFileSync(actual))]));
        report.installedUnchanged = JSON.stringify(report.initialInstalledDependencies) === JSON.stringify(report.finalInstalledDependencies);
    }
    if (!report.inputsUnchanged || !report.reviewedFilesUnchanged || !report.c1InputsUnchanged || !report.installedUnchanged) process.exitCode = 1;
    report.elapsedMs = performance.now() - started; flush('end', { completed: report.completed }); save();
    fs.closeSync(events); process.chdir(originalCwd);
}
