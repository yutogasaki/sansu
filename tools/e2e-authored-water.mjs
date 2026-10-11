import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

assert(process.env.SANSU_AUTHORED_WATER_OUTPUT, 'Specify a fresh SANSU_AUTHORED_WATER_OUTPUT');
const output = process.env.SANSU_AUTHORED_WATER_OUTPUT;
await fs.mkdir(output, { recursive: false });
const inputs = async () => {
    const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(item => item.isDirectory() ? walk(`${dir}/${item.name}`) : [`${dir}/${item.name}`]))).flat();
    const files = [...await walk('src'), 'package-lock.json', 'vite.config.ts', 'tools/e2e-authored-water.mjs', 'tools/growing-authored-water-fixture.mjs',
        'prototypes/place-qa/authored.html', 'prototypes/place-qa/authored-fixture.json', 'prototypes/place-qa/authored-water-fixture.json',
        'prototypes/place-qa/native05-world.json.gz', 'prototypes/place-qa/native05-coast.json.gz', 'prototypes/place-qa/native-water-bridge.json.gz',
        'tools/extract-native-water-profile.mjs', 'tools/extract-native-water-bridge.mjs'];
    return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
};
const report = { pass: false, scope: 'DEV synthetic 27-owner/73-right hill water; actual pointer edits, static future terrain, desktop mouse plus phone/tablet crops',
    excludes: ['Natural acquisition/growth', 'Player save or learning', 'Touch hardware', 'Performance acceptance', 'Independent understanding/art acceptance'], captures: [], steps: [], operationTimings: [], timingScope: 'Headless desktop browser, action through evaluated world and two painted frames; diagnostic elapsed time, no device acceptance threshold', initialInputs: await inputs() };
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(60000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const read = () => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredState));
const metadata = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => { await page.waitForFunction(() => !document.querySelector('.authored-status') && document.querySelector('[data-growing-world]')?.dataset.growingCamera); await paint(); };
const capture = async name => { await paint(); await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' }); report.captures.push({ file: `${name}.png`, viewport: page.viewportSize(), url: page.url(), metadata: await metadata(), build: await page.locator('[data-authored-island]').getAttribute('data-build-revision') }); };
const phase = async name => { report.phase = name; console.log(`authored-water: ${name}`); await fs.writeFile(path.join(output, 'progress.json'), JSON.stringify({ phase: name })); };
const timed = async (name, operation) => {
    const start = performance.now(); let success = false;
    try { const result = await operation(); await paint(); success = true; return result; }
    finally { report.operationTimings.push({ name, elapsedMs: performance.now() - start, success }); }
};
const choose = async id => {
    const index = await page.locator('[data-owner-id]').evaluateAll((nodes, id) => nodes.findIndex(node => node.dataset.ownerId === id), id);
    assert(index >= 0, `Missing owner ${id}`);
    const button = page.locator('[data-owner-id]').nth(index);
    await button.scrollIntoViewIfNeeded(); await button.click(); await paint();
};
const protectedState = state => { const copy = structuredClone(state); delete copy.applied; delete copy.placeProgress; for (const owner of [...copy.plots, ...copy.landmarks]) delete owner.cell; return copy; };
try {
    const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts'; export { authoredWaterFrame } from './src/domain/growingIsland/authoredWaterFrame.ts'; export { canPlace } from './src/domain/growingIsland/commands.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(await fs.readFile('prototypes/place-qa/native05-world.json.gz')))));
    await phase('load'); await timed('initial-load', async () => { await page.goto(process.env.SANSU_AUTHORED_WATER_URL || 'http://127.0.0.1:5344/prototypes/place-qa/authored.html?water=wide'); await ready(); });
    const baseline = await read(), initial = d.authoredWaterFrame(baseline, base), expected = protectedState(baseline), firstMeta = await metadata();
    report.initialState = baseline;
    assert.equal(firstMeta.artCandidate, 'native05-authored-water-garden-v2'); assert.equal(firstMeta.nativeGrowingArt, 'true');
    assert.equal(firstMeta.worldRevision, initial.plan.revision); assert.deepEqual(JSON.parse(firstMeta.authoredWater), initial.plan);
    assert.equal(initial.plan.pools.length, 3); assert.equal(initial.plan.streams.length, 4); await capture('desktop-whole');
    assert.equal(initial.plan.bridges.length, 1); assert.equal(firstMeta.authoredWaterBridgeId, 'native05-forest-garden-bridge');
    const full = async () => { await page.getByRole('button', { name: '全景', exact: true }).click(); await ready(); };
    const tap = async (cell, world, elevation = 0) => {
        world ??= d.authoredWaterFrame(await read(), base).world;
        const box = await page.locator('[data-growing-world] canvas').boundingBox(), pose = JSON.parse((await metadata()).growingCamera);
        const physical = world.floorAt(cell)?.point ?? world.anchorAt(cell); assert(physical);
        const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
        const point = new T.Vector3(physical.x - pose.center, physical.y + elevation, physical.z - 2).project(camera);
        await page.mouse.click(box.x + (point.x + 1) * box.width / 2, box.y + (1 - point.y) * box.height / 2);
        await paint();
    };
    await phase('water-hit'); const pool = initial.plan.pools.find(pool => pool.ownerId === 'l22');
    await tap(baseline.landmarks.find(owner => owner.id === pool.ownerId).cell, initial.world, pool.waterY - pool.center.y);
    assert.equal(await page.locator('[data-owner-id]').evaluateAll(nodes => nodes.find(node => node.getAttribute('aria-pressed') === 'true')?.dataset.ownerId), pool.ownerId);
    await capture('water-close'); report.steps.push('actual water mesh selects its owner');
    await full();
    const bridge = initial.plan.bridges[0], bridgeProfile = JSON.parse(await fs.readFile('src/domain/growingIsland/nativeWaterBridgeProfile.json', 'utf8'));
    const board = bridgeProfile.deckRows[8], along = board.x * bridge.span / bridgeProfile.span;
    const bridgeCell = initial.world.logicalAt({ x: bridge.center.x + Math.cos(bridge.yaw) * along, z: bridge.center.z - Math.sin(bridge.yaw) * along });
    assert(bridgeCell); await tap(bridgeCell, initial.world, .003);
    assert.equal(await page.locator('[data-owner-id]').evaluateAll(nodes => nodes.find(node => node.getAttribute('aria-pressed') === 'true')?.dataset.ownerId), bridge.ownerId);
    report.steps.push('actual source bridge board selects its supplying owner'); await capture('water-bridge-close');
    await phase('store'); await choose('l24'); await timed('store', async () => {
        await page.getByRole('button', { name: 'しまう', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-growing-world]').dataset.authoredWater).pools.length === 0);
    });
    assert.deepEqual(protectedState(await read()), expected); await full(); await capture('stored-dry-ground'); report.steps.push('store restores dry original floor');
    await phase('reconnect'); await page.getByRole('button', { name: 'おく', exact: true }).click();
    await timed('reconnect-preview', async () => { await tap(baseline.landmarks.find(owner => owner.id === 'l24').cell); assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isEnabled()); });
    const previewJoin = (await metadata()).previewWorldRevision; assert.equal(previewJoin, initial.plan.revision); await capture('reconnect-preview');
    await timed('reconnect-confirm', async () => { await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await page.waitForFunction(revision => document.querySelector('[data-growing-world]').dataset.worldRevision === revision, initial.plan.revision); });
    assert.equal((await metadata()).previewWorldRevision, undefined); assert.deepEqual(protectedState(await read()), expected); await capture('reconnected'); report.steps.push('confirmation uses same water revision as preview');
    await phase('preview-cancel'); await choose('l20'); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await full();
    const target = { x: 12, z: -9 }; assert(d.canPlace(await read(), target, 'l20', initial.world)); await timed('move-preview', () => tap(target));
    const previewRevision = (await metadata()).previewWorldRevision; assert(previewRevision && previewRevision !== initial.plan.revision);
    await capture('move-preview'); await timed('preview-cancel', () => page.getByRole('button', { name: 'やめる', exact: true }).click());
    assert.equal((await metadata()).previewWorldRevision, undefined); assert.equal((await metadata()).worldRevision, initial.plan.revision); assert.deepEqual(protectedState(await read()), expected);
    await capture('preview-cancelled'); report.steps.push('cancel restores committed world without changing owner fields');
    await phase('move-split'); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await tap(target); await timed('split-confirm', async () => {
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click();
        await page.waitForFunction(revision => document.querySelector('[data-growing-world]').dataset.worldRevision === revision, previewRevision);
    });
    assert.deepEqual(protectedState(await read()), expected); await capture('moved-split');
    await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await full(); await timed('restore-preview', () => tap(baseline.landmarks.find(owner => owner.id === 'l20').cell));
    await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await page.waitForFunction(revision => document.querySelector('[data-growing-world]').dataset.worldRevision === revision, initial.plan.revision);
    report.steps.push('split and reconnect retain all 27 owner IDs');
    await phase('art-views'); await full();
    await page.getByRole('button', { name: '夕の光', exact: true }).click(); await paint(); await capture('desktop-dusk-whole');
    await choose('l22'); await capture('water-dusk-close');
    await page.getByRole('button', { name: '昼の光', exact: true }).click(); await full();
    await page.getByRole('button', { name: '右へ回す', exact: true }).click(); await paint(); await capture('desktop-rotated-whole');
    await page.getByRole('button', { name: '左へ回す', exact: true }).click(); await paint();
    for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet', { width: 768, height: 1024 }, 'reduce']]) {
        await phase(name); await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion }); await full(); await capture(`${name}-whole`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []); report.finalState = await read(); report.finalInputs = await inputs(); assert.deepEqual(report.finalInputs, report.initialInputs);
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); await capture('failure').catch(() => {}); throw error; }
finally { report.errors = errors; await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, steps: report.steps, captures: report.captures.length, output }));
