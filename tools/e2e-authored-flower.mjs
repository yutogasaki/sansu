import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

assert(process.env.SANSU_AUTHORED_FLOWER_OUTPUT, 'Specify a fresh SANSU_AUTHORED_FLOWER_OUTPUT');
assert(process.env.SANSU_AUTHORED_FLOWER_BUILD, 'Specify the actual SANSU_AUTHORED_FLOWER_BUILD');
const output = process.env.SANSU_AUTHORED_FLOWER_OUTPUT;
const baseUrl = process.env.SANSU_AUTHORED_FLOWER_URL || 'http://127.0.0.1:5352/prototypes/place-qa/authored.html?water=wide&reference=preflight32';
const expectedBuild = process.env.SANSU_AUTHORED_FLOWER_BUILD;
const shapeOnly = process.env.SANSU_AUTHORED_FLOWER_SHAPE_ONLY === '1';
const rayOnly = process.env.SANSU_AUTHORED_FLOWER_RAY_ONLY === '1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = async () => {
    const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(item => item.isDirectory() ? walk(`${dir}/${item.name}`) : [`${dir}/${item.name}`]))).flat();
    const files = [...await walk('src'), ...await walk('prototypes/place-qa'), ...await walk('tools'),
        'package.json', 'package-lock.json', 'vite.config.ts',
        'docs/design/2026-10-11-authored-flower-garden/native-flower-support-profile.json',
        'docs/design/2026-10-11-authored-coast-skin/skin-manifest.json',
        'docs/design/2026-10-11-authored-world-foundation/world-manifest.json',
        'docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz',
        'docs/design/2026-10-11-native-owned-island/kit-manifest.json',
        'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz',
        'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
        'docs/design/2026-10-10-island-final-3d/whole-island.glb',
        'docs/design/2026-10-11-authored-whole-preflight/runtime/young-32.frame.json',
        'docs/design/2026-10-11-authored-whole-preflight/runtime/mature-32.frame.json'];
    return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => [file, sha(await fs.readFile(file))])));
};
await fs.mkdir(output, { recursive: false });
const report = { pass: false, expectedBuild, candidate: 'native05-authored-flower-garden-v3', target: baseUrl,
    shapeOnly, rayOnly,
    scope: rayOnly ? 'Focused actual canvas selection of four owners from the fixed archived synthetic 32-owner/8-home reference'
        : shapeOnly ? 'Two actual DEV views of the fixed archived synthetic 32-owner/8-home reference'
        : 'Actual DEV renderer, fixed archived synthetic 32-owner/8-home reference; whole/near views, four owner selections, pointer cancel/split/store/reconnect',
    excludes: ['Fresh acquisition', 'Personal save', 'Independent art/child acceptance', 'Performance acceptance', 'Final whole island'],
    initialInputs: await inputs(), captures: [], selections: [], canvasSelections: [], edits: [], timings: [], errors: [] };
report.initialInputHash = sha(JSON.stringify(report.initialInputs));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(90000);
page.on('pageerror', error => report.errors.push(error.message));
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => {
    await page.waitForFunction(() => !document.querySelector('.authored-status') && document.querySelector('[data-growing-world]')?.dataset.growingCamera);
    await paint();
};
const meta = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const state = () => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredState));
const canonical = value => { const copy = structuredClone(value); delete copy.applied; delete copy.placeProgress; return copy; };
const protectedState = value => { const copy = canonical(value); for (const owner of [...copy.plots, ...copy.landmarks]) delete owner.cell; return copy; };
const timed = async (name, operation) => {
    console.log(`authored-flower: ${name}`); const start = performance.now(); let success = false;
    try { await operation(); await paint(); success = true; }
    finally { report.timings.push({ name, elapsedMs: performance.now() - start, success }); }
};
const capture = async (name, expectedState, expectedStocks) => {
    await paint(); const metadata = await meta();
    assert.equal(metadata.artCandidate, report.candidate); assert.equal(metadata.nativeGrowingArt, 'true');
    assert.equal(metadata.authoredFlowerSupport, 'native05-owned-flower-support-v1');
    assert.equal(metadata.authoredFlowerSource, '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
    assert.equal(await page.locator('[data-authored-island]').getAttribute('data-build-revision'), expectedBuild);
    const referenceSource = await page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.referenceSource));
    const saved = JSON.parse(await fs.readFile(`prototypes/place-qa/authored-flower-reference-${referenceSource.stage}.json`, 'utf8'));
    assert.equal(referenceSource.sha256, sha(await fs.readFile(referenceSource.path)), 'Archived acquisition source is unchanged');
    assert.deepEqual(canonical(await state()), canonical(expectedState ?? saved.state));
    const physical = JSON.parse(metadata.authoredFlowerWalking), poses = JSON.parse(metadata.authoredFlowerPoses ?? 'null');
    assert.equal(physical.stockCount, expectedStocks ?? (referenceSource.stage === 'mature' ? 4 : 3));
    assert.deepEqual(physical.ownerAccess.filter(owner => !owner.reachable), [], 'All current owner approaches remain reachable in the actual composed world');
    assert(poses?.checked > 0); assert.equal(poses.unplaced, 0);
    await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
    report.captures.push({ file: `${name}.png`, viewport: page.viewportSize(), url: page.url(), build: expectedBuild, metadata, referenceSource });
};
const whole = async () => {
    const previousHost = await page.locator('[data-growing-world]').elementHandle(); assert(previousHost);
    await page.getByRole('button', { name: '全景', exact: true }).click();
    // 全景 remounts the renderer. Readiness on the outgoing focused renderer
    // must not supply the camera used to project the next real pointer tap.
    await page.waitForFunction(node => !node.isConnected, previousHost);
    await ready(); assert.equal((await meta()).growingFocus, undefined);
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
};
const select = async id => {
    await page.locator(`[data-owner-id="${id}"]`).click(); await paint();
    assert.equal(await page.locator(`[data-owner-id="${id}"]`).getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingFocus === id, id);
    const metadata = await meta(); assert.equal(metadata.growingFocus, id);
    report.selections.push({ id, viewport: page.viewportSize(), camera: JSON.parse(metadata.growingCamera) });
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
};
let projectionWorld, projectionDomain;
const initProjection = async () => {
    if (projectionWorld) return projectionDomain;
    const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { canPlace } from './src/domain/growingIsland/commands.ts'; export { landCells } from './src/domain/growingIsland/space.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    projectionDomain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    projectionWorld = projectionDomain.compileWorldDefinition(JSON.parse(gunzipSync(await fs.readFile('prototypes/place-qa/native05-world.json.gz'))));
    return projectionDomain;
};
const tap = async (cell, height = 0, offset = { x: 0, z: 0 }) => {
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const pose = JSON.parse((await meta()).growingCamera), floor = projectionWorld.floorAt(cell); assert(floor);
    const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
    const p = new T.Vector3(floor.point.x - pose.center + offset.x, floor.point.y + height, floor.point.z - 2 + offset.z).project(camera);
    const pointer = { x: box.x + (p.x + 1) * box.width / 2, y: box.y + (1 - p.y) * box.height / 2 };
    assert(pointer.x > box.x && pointer.x < box.x + box.width && pointer.y > box.y && pointer.y < box.y + box.height, 'Projected tap must be inside the actual canvas');
    await page.mouse.click(pointer.x, pointer.y);
    await paint();
    return { pointer, cell, height, offset, canvas: box, sourceFloor: floor.point, camera: pose };
};
const crown = async () => JSON.parse((await meta()).authoredFlowerShape).find(place => place.ownerIds.includes('l17'));
const raySelections = async baseline => {
    await initProjection();
    for (const id of ['l31', 'l17', 'l18', 'l19']) await timed(`canvas-select-${id}`, async () => {
        let previousOwner = await page.evaluate(() => document.querySelector('[data-owner-id][aria-pressed="true"]')?.getAttribute('data-owner-id') ?? null);
        if (previousOwner === id) { await select('p1'); previousOwner = 'p1'; }
        if ((await meta()).growingFocus) await whole();
        assert.notEqual(previousOwner, id, 'Each canvas tap must change the selection');
        // The low center of l31 is visibly occluded by the shell in this
        // azimuth. Tap its exposed stock face, rather than through the shell.
        const owner = baseline.landmarks.find(item => item.id === id), projected = await tap(owner.cell, id === 'l31' ? .5 : .23, { x: id === 'l31' ? -.18 : 0, z: 0 });
        const selection = { id, previousOwner, ...projected, pass: false };
        report.canvasSelections.push(selection);
        await page.waitForFunction(id => document.querySelector(`[data-owner-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
        await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingFocus === id, id);
        assert.deepEqual(canonical(await state()), canonical(baseline));
        selection.pass = true;
    });
};
const edits = async baseline => {
    const domain = await initProjection();
    const owner = baseline.landmarks.find(item => item.id === 'l31'), invariant = protectedState(baseline);
    // P05 is dry source ground. This target stays outside the water carving scope;
    // the actual UI still decides whether the visible pointer placement is valid.
    const target = domain.landCells(baseline, projectionWorld).filter(at => at.x < 5 && at.z > -7 && at.z < -3
        && domain.canPlace(baseline, at, owner.id, projectionWorld))
        .sort((a, b) => Math.hypot(a.x - 4, a.z + 5) - Math.hypot(b.x - 4, b.z + 5))[0];
    assert(target); assert.equal((await crown()).crownCount, 1);
    await select(owner.id); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await whole();
    await timed('preview-and-cancel-flower', async () => {
        await tap(target); assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isEnabled());
        assert.deepEqual(canonical(await state()), canonical(baseline));
        await page.getByRole('button', { name: 'やめる', exact: true }).click(); await ready();
        assert.deepEqual(canonical(await state()), canonical(baseline)); assert.equal((await crown()).crownCount, 1);
    }); report.edits.push({ action: 'cancel', id: owner.id, target, pass: true });
    await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await tap(target);
    await timed('split-flower', async () => { await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await ready(); });
    const moved = await state(); assert.deepEqual(moved.landmarks.find(item => item.id === owner.id), { ...owner, cell: target });
    assert.deepEqual(protectedState(moved), invariant); assert.equal((await crown()).crownCount, 0);
    await capture('desktop-flower-split-whole-day', moved, 3); report.edits.push({ action: 'move-split', id: owner.id, from: owner.cell, target, pass: true });
    await timed('store-flower', async () => { await page.getByRole('button', { name: 'しまう', exact: true }).click(); await ready(); });
    const stored = await state(); assert.equal(stored.landmarks.find(item => item.id === owner.id).cell, undefined);
    assert.deepEqual(protectedState(stored), invariant); assert.equal((await crown()).crownCount, 0);
    report.edits.push({ action: 'store', id: owner.id, pass: true });
    await page.getByRole('button', { name: 'おく', exact: true }).click(); await tap(owner.cell);
    await timed('restore-reconnect-flower', async () => { await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await ready(); });
    const restored = await state(); assert.deepEqual(canonical(restored), canonical(baseline)); assert.equal((await crown()).crownCount, 1);
    await capture('desktop-flower-reconnected-whole-day', restored); report.edits.push({ action: 'restore-reconnect', id: owner.id, target: owner.cell, pass: true });
    await raySelections(baseline);
};
try {
    await timed('load-mature-32', async () => { await page.goto(baseUrl); await ready(); });
    const baseline = await state(); assert.equal(baseline.plots.length + baseline.landmarks.length, 32);
    assert.equal(baseline.plots.filter(owner => owner.kind === 'home').length, 8);
    await capture('desktop-mature-whole-day');
    if (rayOnly) await raySelections(baseline);
    else for (const id of shapeOnly ? ['l17'] : ['l31', 'l17', 'l18', 'l19']) { await timed(`select-${id}`, () => select(id)); if (id === 'l17') await capture('desktop-flower-close-day'); }
    if (!shapeOnly && !rayOnly) {
    await edits(baseline);
    await timed('rotate-whole', async () => { await whole(); await page.getByRole('button', { name: '右へ回す', exact: true }).click(); });
    await capture('desktop-rotated-whole-day'); await timed('rotated-flower-close', () => select('l18')); await capture('desktop-rotated-flower-close-day');
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport); await timed(`whole-${viewport.width}`, whole); await capture(`${viewport.width}-mature-whole-day`);
        await timed(`flower-close-${viewport.width}`, () => select('l18')); await capture(`${viewport.width}-flower-close-day`);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const youngUrl = new URL(baseUrl); youngUrl.searchParams.set('reference', 'preflight32-young');
    await timed('load-young-32', async () => { await page.goto(youngUrl.href); await ready(); });
    await capture('desktop-young-whole-day'); await timed('young-flower-close', () => select('l31')); await capture('desktop-young-flower-close-day');
    assert.equal((await state()).landmarks.find(owner => owner.id === 'l31').growth, 0);
    }
    assert.deepEqual(report.errors, []);
    report.finalInputs = await inputs(); report.finalInputHash = sha(JSON.stringify(report.finalInputs));
    assert.deepEqual(report.finalInputs, report.initialInputs, 'Application/QA inputs changed during reference capture');
    report.sourceClosureUnchanged = true;
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error);
    report.failureMetadata = await meta().catch(() => null);
    report.failureSelection = await page.evaluate(() => document.querySelector('[data-owner-id][aria-pressed="true"]')?.getAttribute('data-owner-id') ?? null).catch(() => null);
    await page.screenshot({ path: path.join(output, 'first-failure.png') }).catch(() => {});
    process.exitCode = 1;
} finally {
    await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
}
console.log(JSON.stringify({ pass: report.pass, captures: report.captures.length, selections: report.selections.length, error: report.error, output }));
