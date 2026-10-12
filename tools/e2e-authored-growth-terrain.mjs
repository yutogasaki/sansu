import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

// Actual local UI journey. Time advancement is explicit DEV UI, not elapsed
// natural time; district acquisition is diagnostic, not personal land purchase.
const output = process.env.SANSU_GROWTH_TERRAIN_OUTPUT;
const revision = process.env.SANSU_GROWTH_TERRAIN_BUILD;
const corePath = process.env.SANSU_GROWTH_TERRAIN_CORE_REPORT;
assert(output && revision && corePath, 'Set a fresh output directory, build revision and completed core report');
const target = new URL(process.env.SANSU_GROWTH_TERRAIN_URL ?? 'http://127.0.0.1:5365/prototypes/place-qa/authored.html?art=whole&terrain=grove');
assert.equal(target.pathname, '/prototypes/place-qa/authored.html');
assert.equal(target.searchParams.get('art'), 'whole');
assert.equal(target.searchParams.get('terrain'), 'grove');
mkdirSync(output, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const core = JSON.parse(readFileSync(corePath));
assert(core.pass && core.sourceFixed && core.revision === revision, 'Frozen candidate core must pass first');
const fingerprints = () => Object.fromEntries(Object.keys(core.finalInputs).sort().map(file => [file, sha(readFileSync(file))]));
const initial = fingerprints(); assert.deepEqual(initial, core.finalInputs);
const manifest = JSON.parse(readFileSync('prototypes/place-qa/authored-growth-terrain-manifest.json'));
const compressed = readFileSync(manifest.artifact.path.replace(/^\//, '')), expanded = gunzipSync(compressed);
assert.equal(sha(compressed), manifest.artifact.sha256); assert.equal(sha(expanded), manifest.artifact.expandedSha256);
const catalog = JSON.parse(expanded), cases = manifest.diagnosticCases;
for (const name of ['parallel', 'seaward', 'shifted']) assert.equal(cases[name].localCells.length, 2);
const bundle = await build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { compileWorldDefinition } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const localWorld = compileWorldDefinition({ version: 1, id: 'growth-pointer-projection', source: catalog.source, districts: [catalog.template.district], edges: catalog.template.edges });
const report = { pass: false, target: target.href, revision, candidate: catalog.candidate,
    scope: 'Same two normally purchased DEV saplings: young, mature, rearranged, stored and restored on one acquired diagnostic shore; real canvas pointers',
    excludes: ['personal land purchase/save', 'offline/update', 'natural time observation', 'actor traversal/use', 'art acceptance', 'performance acceptance'],
    initialInputs: initial, steps: [], captures: [], pointers: [], errors: [] };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(180000);
page.on('pageerror', error => report.errors.push(String(error)));
const host = () => page.locator('[data-authored-island]').evaluate(n => ({ ...n.dataset }));
const state = async () => JSON.parse((await host()).authoredState);
const plan = async () => JSON.parse((await host()).growthTerrainPlan);
const ready = async () => {
    await page.waitForFunction(() => {
        const h = document.querySelector('[data-authored-island]')?.dataset, w = document.querySelector('[data-growing-world]')?.dataset;
        return !document.querySelector('.authored-status') && h?.growthTerrainPlan && w?.growingCamera && w.worldRevision === h.worldRevision;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function step(name, fn) {
    report.phase = name; writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase: name, steps: report.steps }, null, 2));
    console.log(name); const start = Date.now(); await fn(); report.steps.push({ name, elapsedMs: Date.now() - start });
}
async function click(locator) { await locator.scrollIntoViewIfNeeded(); await locator.click(); }
const rotate = (p, turn) => turn === 1 ? { x: -p.z, z: p.x } : turn === 2 ? { x: -p.x, z: -p.z } : turn === 3 ? { x: p.z, z: -p.x } : p;
let grant, ids;
const cellFor = cell => { const p = rotate(cell, grant.turn); return { x: p.x + grant.logicalOrigin.x, z: p.z + grant.logicalOrigin.z }; };
async function tap(localCell) {
    const canvas = page.locator('[data-growing-world] canvas'); await canvas.scrollIntoViewIfNeeded();
    const floor = localWorld.floorAt(localCell); assert(floor, 'Pointer must target an original acquired floor');
    const p = rotate(floor.point, grant.turn), physical = { x: p.x + grant.worldOrigin.x, y: floor.point.y + grant.worldOrigin.y, z: p.z + grant.worldOrigin.z };
    const pose = await page.locator('[data-growing-world]').evaluate(n => JSON.parse(n.dataset.growingCamera));
    const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
    const screen = new T.Vector3(physical.x - pose.center, physical.y, physical.z - 2).project(camera), box = await canvas.boundingBox(); assert(box);
    const pointer = { x: box.x + (screen.x + 1) * box.width / 2, y: box.y + (1 - screen.y) * box.height / 2 };
    report.pointers.push({ localCell, cell: cellFor(localCell), physical, pointer, camera: pose });
    await page.mouse.click(pointer.x, pointer.y);
}
async function capture(name) {
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
    const h = await host(), renderer = await page.locator('[data-growing-world]').evaluate(n => Object.fromEntries(['worldId', 'worldRevision', 'growingCamera', 'authoredGrowthTerrainCandidate', 'growingSceneCounters', 'placeActors'].map(k => [k, n.dataset[k]])));
    report.captures.push({ name, viewport: page.viewportSize(), host: h, renderer });
}
async function move(id, localCell, restore = false) {
    await click(page.locator(`[data-owner-id="${id}"]`));
    await click(page.getByRole('button', { name: restore ? 'おく' : 'うごかす', exact: true }));
    await tap(localCell); await click(page.getByRole('button', { name: 'ここにおく', exact: true })); await ready();
    assert.deepEqual((await state()).landmarks.find(item => item.id === id).cell, cellFor(localCell));
}
async function arrange(name, captureName = name) {
    const desired = cases[name].localCells;
    // Store both before restoring so swapped slots never overwrite each other.
    for (const id of ids) { await click(page.locator(`[data-owner-id="${id}"]`)); await click(page.getByRole('button', { name: 'しまう', exact: true })); await ready(); }
    assert.equal((await plan()).assemblies.length, 0);
    for (let i = 0; i < ids.length; i++) await move(ids[i], desired[i], true);
    const result = await plan(); assert.equal(result.assemblies.length, 1);
    assert.equal(result.assemblies[0].shape, cases[name].expectedShape);
    assert.equal(result.assemblies[0].socketId, cases[name].expectedSocket);
    assert.deepEqual([...result.assemblies[0].ownerIds].sort(), [...ids].sort());
    await click(page.getByRole('button', { name: '全景', exact: true })); await ready();
    await capture(captureName); return result;
}
try {
    await step('load', async () => { await page.goto(target.href); await ready(); const h = await host(); assert.equal(h.buildRevision, revision); assert.equal(h.growthTerrainCandidate, catalog.candidate); });
    await step('acquire-diagnostic-shore', async () => {
        await click(page.locator(`[data-district-template="${catalog.template.id}"]`));
        await page.waitForFunction(() => document.querySelector('[data-authored-island]')?.dataset.districtPreview !== 'null'); await ready();
        await click(page.locator('[data-district-confirm]')); await ready(); grant = JSON.parse((await host()).districtGrants).at(-1);
        assert.equal(grant.templateId, catalog.template.id); assert.equal((await plan()).assemblies.length, 0); await capture('low-shore');
    });
    await step('purchase-two-saplings', async () => {
        ids = [];
        for (const localCell of cases.parallel.localCells) {
            const before = await state(), id = `l${before.nextId}`;
            await click(page.locator('[data-purchase-kind="sapling"]')); await tap(localCell);
            await click(page.getByRole('button', { name: 'ここにおく', exact: true })); await ready();
            const after = await state(), owner = after.landmarks.find(item => item.id === id); assert(owner);
            assert.deepEqual(owner.cell, cellFor(localCell)); assert(after.drops < before.drops); ids.push(id);
        }
        assert.equal((await plan()).assemblies.length, 0); await capture('young');
    });
    await step('mature-through-existing-clock', async () => {
        await click(page.locator('[data-advance-nature="18"]')); await ready();
        const result = await plan(); assert.equal(result.assemblies.length, 1); assert.equal(result.assemblies[0].shape, cases.parallel.expectedShape); await capture('parallel');
    });
    let seaward, shifted;
    await step('same-owners-seaward', async () => { seaward = await arrange('seaward'); });
    await step('same-owners-shifted', async () => { shifted = await arrange('shifted'); assert.notEqual(shifted.revision, seaward.revision); });
    await step('restore-parallel', async () => { await arrange('parallel', 'parallel-restored'); });
    await step('rotate-and-small-screens', async () => { await click(page.getByRole('button', { name: '右へ回す', exact: true })); await ready(); await capture('rotated'); await page.setViewportSize({ width: 390, height: 844 }); await ready(); await capture('phone'); await page.setViewportSize({ width: 768, height: 1024 }); await ready(); await capture('tablet'); });
    assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) {
    report.failure = String(error.stack ?? error); process.exitCode = 1;
    await page.screenshot({ path: path.join(output, 'failure.png'), scale: 'css' }).catch(() => {});
    report.failureHost = await host().catch(() => null);
} finally {
    report.finalInputs = fingerprints(); report.sourceFixed = JSON.stringify(report.finalInputs) === JSON.stringify(initial);
    if (!report.sourceFixed) { report.pass = false; process.exitCode = 1; }
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
    console.log(JSON.stringify({ pass: report.pass, phase: report.phase, failure: report.failure, sourceFixed: report.sourceFixed }));
}
