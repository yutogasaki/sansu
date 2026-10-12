import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { getHeapStatistics } from 'node:v8';
import { createRequire } from 'node:module';
const root = '/private/tmp/sansu-authored-shoulder-c1/candidate';
const output = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(root, 'package.json'));
const { build } = require('esbuild');
const MiB = 1024 ** 2, GiB = 1024 ** 3;
assert(global.gc, 'Run with --expose-gc');
assert(!process.execArgv.some(x => /max.old.space/i.test(x)), 'Use the default heap limit');
const originalCwd = process.cwd(); process.chdir(root);
const eventsPath = path.join(output, 'events.jsonl');
assert(!fs.existsSync(eventsPath), 'Fresh diagnostic events required');
const fd = fs.openSync(eventsPath, 'wx');
const started = performance.now();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const canonical = value => { const c = structuredClone(value); delete c.applied; delete c.placeProgress; return c; };
const report = { scope: 'Pure Node frame-retention diagnostic, not browser/purchase/placement/owner-access acceptance',
    candidate: root, argv: process.execArgv, node: process.version, heapLimit: getHeapStatistics().heap_size_limit,
    attempt: 2, stepLimit: 16, heapStopBytes: 3 * GiB, preflightReserveFloorBytes: 768 * MiB,
    omitted: ['Browser/renderer/screenshot/report capture retention', 'All 75 placement targets and direct canPlace acceptance', 'Actor/owner-access acceptance', 'Production performance conclusion'],
    phases: [], stages: [], totalFrameSteps: 0, completed: false };
let peakStepGrowth = 0, stopReason;
const memory = () => ({ ...process.memoryUsage(), heapLimit: getHeapStatistics().heap_size_limit });
const flush = (event, extra = {}) => {
    const entry = { event, elapsedMs: performance.now() - started, cpu: process.cpuUsage(), memory: memory(), ...extra };
    fs.writeSync(fd, `${JSON.stringify(entry)}\n`); fs.fsyncSync(fd);
    console.log(JSON.stringify(entry)); return entry;
};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
function checkpoint(label, extra = {}) {
    const before = memory(); global.gc(); const entry = flush(label, { beforeGC: before, ...extra });
    if (entry.memory.heapUsed >= report.heapStopBytes) { stopReason = `heap >= 3 GiB at ${label}`; throw new Error(stopReason); }
    return entry;
}
function reserve(label) {
    const used = process.memoryUsage().heapUsed;
    const margin = report.preflightReserveFloorBytes;
    if (used + margin >= report.heapStopBytes) {
        stopReason = `Preflight reserve stop before ${label}: used=${used}, fixed transient reserve=${margin}`;
        flush('self-stop', { reason: stopReason }); throw new Error(stopReason);
    }
}
let inputs;
const core = read('/private/tmp/sansu-authored-shoulder-c1/core/report.json');
assert(core.pass && core.sourceFixed && core.revision === 'authored-shoulder-c1');
assert.deepEqual(core.initialInputs, core.finalInputs);
const driver = fs.readFileSync('tools/e2e-authored-shoulder.mjs', 'utf8');
const contents = driver.match(/const compiled = await build\(\{ stdin: \{ contents: `([\s\S]*?)`, resolveDir/)[1];
const bundle = await build({ stdin: { contents, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const local = new Set(['tools/e2e-authored-shoulder.mjs', 'package.json', 'package-lock.json',
    'prototypes/place-qa/native05-world-source-shading.json.gz', 'prototypes/place-qa/authored-shoulder-profile.json.gz',
    'prototypes/place-qa/native05-world-source-shading-manifest.json', 'prototypes/place-qa/authored-shoulder-profile-manifest.json',
    'prototypes/place-qa/authored-flower-reference-mature.json', 'prototypes/place-qa/authored-shoulder-reference-mature.json']);
const moduleRoot = fs.realpathSync('node_modules');
const installed = new Map([['node_modules/.package-lock.json', path.join(moduleRoot, '.package-lock.json')]]);
for (const file of Object.keys(bundle.metafile.inputs)) {
    if (file === '<stdin>') continue;
    const real = fs.realpathSync(path.resolve(file));
    if (real.startsWith(`${moduleRoot}${path.sep}`)) installed.set(`node_modules/${path.relative(moduleRoot, real)}`, real);
    else { const relative = path.relative(root, real); assert(!relative.startsWith('../'), `Non-c1 local input ${file}`); local.add(relative); }
}
inputs = Object.fromEntries([...local].sort().map(file => [file, sha(fs.readFileSync(file))]));
for (const [file, hash] of Object.entries(inputs)) assert.equal(core.finalInputs[file], hash, `Core input ${file}`);
report.initialInputs = inputs;
report.initialInstalledDependencies = Object.fromEntries([...installed].map(([file, actual]) => [file, sha(fs.readFileSync(actual))]));
for (const [file, hash] of Object.entries(report.initialInstalledDependencies)) assert.equal(core.finalInstalledDependencies[file], hash, `Core installed ${file}`);
report.bundleSha256 = sha(bundle.outputFiles[0].text);
report.rawFailure = { path: '/private/tmp/sansu-authored-shoulder-c1/regressions/02-shoulder-full/execution.log.txt', sha256: sha(fs.readFileSync('/private/tmp/sansu-authored-shoulder-c1/regressions/02-shoulder-full/execution.log.txt')) };
const d = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const ground = JSON.parse(gunzipSync(fs.readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz')));
const shoulder = JSON.parse(gunzipSync(fs.readFileSync('prototypes/place-qa/authored-shoulder-profile.json.gz')));
const initial = read('prototypes/place-qa/authored-flower-reference-mature.json').state;
const expectedMature = read('prototypes/place-qa/authored-shoulder-reference-mature.json').state;
const cells = [{ x: 6, z: -7 }, { x: 7, z: -6 }, { x: 8, z: -6 }];
checkpoint('setup'); save();

async function run(mode) {
    const limit = mode === 'bounded3' ? 3 : Infinity;
    let base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(ground));
    let current = structuredClone(initial), currentFrame;
    const cache = new Map();
    const phase = { mode, limit: Number.isFinite(limit) ? limit : 'unbounded', steps: [], complete: false };
    report.phases.push(phase);
    checkpoint(`${mode}:base-ready`);
    const projection = (state, label) => {
        const key = JSON.stringify(canonical(state));
        const hit = cache.get(key);
        if (hit) { cache.delete(key); cache.set(key, hit); return { frame: hit, hit: true }; }
        reserve(`${mode}:${label}`);
        const value = d.authoredWorldFrame(state, base, { water: true, cove: true, shoulder });
        cache.set(key, value);
        while (cache.size > limit) cache.delete(cache.keys().next().value);
        return { frame: value, hit: false };
    };
    const step = async (label, state) => {
        assert(report.totalFrameSteps < report.stepLimit);
        const start = checkpoint(`${mode}:${label}:before`, { cacheSize: cache.size });
        const startCpu = process.cpuUsage(), t = performance.now();
        const result = projection(state, label);
        const afterNoGC = memory();
        peakStepGrowth = Math.max(peakStepGrowth, afterNoGC.heapUsed - start.memory.heapUsed);
        const summary = { mode, label, number: ++report.totalFrameSteps, hit: result.hit, cacheSize: cache.size,
            frameRevision: result.frame.revision, canonicalSha256: sha(JSON.stringify(canonical(state))),
            ownerCount: state.plots.length + state.landmarks.length, drops: state.drops, nextId: state.nextId, natureHours: state.nature.hours,
            elapsedMs: performance.now() - t, cpu: process.cpuUsage(startCpu), before: start.memory, afterNoGC };
        const after = checkpoint(`${mode}:${label}:after`, summary); summary.afterGC = after.memory;
        phase.steps.push(summary); report.stages.push(summary); save();
        await new Promise(resolve => setImmediate(resolve));
        return result.frame;
    };
    currentFrame = await step('baseline32', current);
    for (const [i, cell] of cells.entries()) {
        const id = `l${33 + i}`;
        let preview = d.previewGrowingState(current, { kind: 'sapling', seed: false, style: 'plain', prospectiveOwnerId: id, cell, allowed: [cell], valid: true });
        await step(`preview-${id}`, preview); preview = null;
        reserve(`${mode}:apply-${id}`); checkpoint(`${mode}:apply-${id}:before`, { cacheSize: cache.size });
        const t = performance.now();
        // Same pure purchase oracle as the browser harness, but this diagnostic
        // is not the real UI journey or a complete placement/support acceptance.
        current = d.applyIntent(current, { id: `shoulder-oracle-${id}`, command: { type: 'place', kind: 'sapling', cell } }, current.nature.realAt, currentFrame.world).state;
        checkpoint(`${mode}:apply-${id}:after`, { operationMs: performance.now() - t });
        currentFrame = await step(`commit-${id}`, current);
    }
    reserve(`${mode}:advance18h`); checkpoint(`${mode}:advance18h:before`, { cacheSize: cache.size });
    let mature = structuredClone(current); const now = current.nature.realAt + 18 * 3600000, t = performance.now();
    const events = d.advanceNature(mature, now, currentFrame.world);
    checkpoint(`${mode}:advance18h:after`, { operationMs: performance.now() - t, events });
    const syncStart = performance.now(); d.syncPlaceMilestones(mature, now, currentFrame.world);
    checkpoint(`${mode}:sync-mature:after`, { operationMs: performance.now() - syncStart });
    assert.deepEqual(canonical(mature), canonical(expectedMature), 'Same canonical mature35 reference');
    currentFrame = await step('mature35', mature);
    phase.complete = true;
    // No frame/world/plan is stored in report. Release every caller-side root
    // before the next mode; domain caches are WeakMap/LRU as in the c1 module.
    currentFrame = null; current = null; mature = null; base = null; cache.clear();
    await new Promise(resolve => setImmediate(resolve));
    checkpoint(`${mode}:released`); save();
}
try {
    await run('bounded3');
    await new Promise(resolve => setImmediate(resolve)); checkpoint('between-modes');
    await run('unbounded');
    report.completed = true;
} catch (error) {
    report.error = error.stack; report.selfStopped = Boolean(stopReason); report.stopReason = stopReason;
    flush('diagnostic-error', { error: String(error), selfStopped: Boolean(stopReason) });
    if (!stopReason) process.exitCode = 1;
} finally {
    report.finalInputs = Object.fromEntries([...local].sort().map(file => [file, sha(fs.readFileSync(file))]));
    report.inputsUnchanged = JSON.stringify(report.initialInputs) === JSON.stringify(report.finalInputs);
    report.finalInstalledDependencies = Object.fromEntries([...installed].map(([file, actual]) => [file, sha(fs.readFileSync(actual))]));
    report.installedUnchanged = JSON.stringify(report.initialInstalledDependencies) === JSON.stringify(report.finalInstalledDependencies);
    report.elapsedMs = performance.now() - started; flush('end', { completed: report.completed, selfStopped: report.selfStopped ?? false, totalFrameSteps: report.totalFrameSteps }); save();
    fs.closeSync(fd); process.chdir(originalCwd);
}
