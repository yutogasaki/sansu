import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import * as T from 'three';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function inputs() {
    const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true }))
        .map(item => item.isDirectory() ? walk(`${dir}/${item.name}`) : [`${dir}/${item.name}`]))).flat();
    const files = [...await walk('src'), 'package-lock.json', 'vite.config.ts',
        'prototypes/place-qa/authored.html', 'prototypes/place-qa/authored-fixture.json',
        'prototypes/place-qa/native05-world.json.gz', 'prototypes/place-qa/native05-coast.json.gz',
        'tools/growing-authored-fixture.mjs', 'tools/e2e-authored-island-editing.mjs'];
    return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await fs.readFile(file))])));
}
const read = page => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredState));
const owners = state => [...state.plots, ...state.landmarks];
function invariant(state) {
    const copy = structuredClone(state);
    delete copy.applied; delete copy.placeProgress;
    for (const owner of owners(copy)) delete owner.cell;
    return copy;
}
async function ready(page) {
    await page.locator('[data-growing-world] canvas').waitFor();
    await page.waitForFunction(() => !document.querySelector('.authored-status')
        && Boolean(document.querySelector('[data-growing-world]')?.dataset.growingCamera));
    await page.waitForTimeout(650);
}

/** Reads diagnostic state and camera only; all edits go through visible buttons
 * and canvas taps. Uses the project's pinned Playwright runtime. */
export async function run(page, output) {
    await fs.mkdir(output, { recursive: false });
    const report = { target: page.url(), condition: 'DEV synthetic 27-owner island; pointer UI on desktop plus width/reduced-motion views',
        initialInputs: await inputs(), steps: [], captures: [], pass: false,
        excludes: ['Player save or acquisition', 'Learning integration in this authored world', 'Touch hardware', 'Authored gallery/water deck acceptance', 'Independent art/understanding acceptance'] };
    const errors = []; const onError = error => errors.push(error.message); page.on('pageerror', onError);
    const phase = async name => { report.phase = name; console.log(`authored-edit: ${name}`); await fs.writeFile(path.join(output, 'progress.json'), JSON.stringify({ phase: name, at: new Date().toISOString() })); };
    let domain, world;
    const capture = async name => {
        await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
        report.captures.push({ file: `${name}.png`, viewport: page.viewportSize(), url: page.url(),
            metadata: await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset })),
            build: await page.locator('[data-authored-island]').getAttribute('data-build-revision') });
    };
    const choose = async id => {
        const index = await page.locator('[data-owner-id]').evaluateAll((nodes, id) => nodes.findIndex(node => node.dataset.ownerId === id), id);
        assert(index >= 0); await page.locator('[data-owner-id]').nth(index).click(); await page.waitForTimeout(450);
    };
    const full = async () => { await page.getByRole('button', { name: '全景', exact: true }).click(); await ready(page); };
    const point = async cell => {
        const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
        const pose = await page.locator('[data-growing-world]').evaluate(node => JSON.parse(node.dataset.growingCamera));
        const physical = world.floorAt(cell)?.point; assert(physical, 'Tap projects a real source floor');
        const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld);
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
        const p = new T.Vector3(physical.x - pose.center, physical.y, physical.z - 2).project(camera);
        return { x: box.x + (p.x + 1) * box.width / 2, y: box.y + (1 - p.y) * box.height / 2 };
    };
    const tap = async cell => { const p = await point(cell); await page.mouse.click(p.x, p.y); };
    try {
        await phase('compile-projection');
        assert.match(page.url(), /\/prototypes\/place-qa\/authored\.html/);
        const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { canPlace } from './src/domain/growingIsland/commands.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
        domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
        world = domain.compileWorldDefinition(JSON.parse(gunzipSync(await fs.readFile('prototypes/place-qa/native05-world.json.gz'))));
        await phase('viewport-reload');
        await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.reload(); await ready(page);
        await phase('initial-identity');
        const metadata = await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
        assert.equal(metadata.artCandidate, 'native05-authored-runtime-m1'); assert.equal(metadata.nativeGrowingArt, 'true');
        assert(metadata.nativeKitSha256 && metadata.authoredCoastSource); assert.equal(metadata.worldDefinition, world.id);
        const baseline = await read(page), protectedState = invariant(baseline);
        assert.equal(owners(baseline).length, 27); assert.equal(baseline.plots.filter(owner => owner.kind === 'home').length, 8);
        const tree = baseline.landmarks.find(owner => owner.kind === 'sapling' && owner.cell.x === 4 && owner.cell.z === -8); assert(tree);
        report.initialState = baseline; await capture('desktop-whole');
        await phase('tree-choice');
        await choose(tree.id); await capture('desktop-tree-close');
        await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await full();
        const target = world.sites.filter(site => site.placement && domain.canPlace(baseline, site.cell, tree.id, world)
            && Math.hypot(site.cell.x - tree.cell.x, site.cell.z - tree.cell.z) >= 3)
            .sort((a, b) => Math.hypot(a.cell.x - 6, a.cell.z + 6) - Math.hypot(b.cell.x - 6, b.cell.z + 6))[0].cell;
        await tap(target); await page.getByRole('button', { name: 'ここにおく', exact: true }).waitFor();
        assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isEnabled()); await capture('desktop-move-preview');
        // Sea click clears an already valid choice; it never reuses stale placement.
        const canvas = await page.locator('[data-growing-world] canvas').boundingBox(); assert(canvas);
        await page.mouse.click(canvas.x + 16, canvas.y + 16);
        assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isDisabled());
        assert.deepEqual(owners(await read(page)), owners(baseline)); report.steps.push({ name: 'sea-clears-preview-no-edit', pass: true });
        const walkOnly = world.sites.filter(site => !site.placement && site.cell.x > 5 && site.cell.z < -4)
            .sort((a, b) => Math.hypot(a.cell.x - 6.25, a.cell.z + 6) - Math.hypot(b.cell.x - 6.25, b.cell.z + 6))[0].cell;
        await tap(walkOnly); assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isDisabled());
        report.steps.push({ name: 'walking-only-site-rejects-planting', cell: walkOnly, pass: true });
        await tap(target); await page.getByRole('button', { name: 'やめる', exact: true }).click();
        assert.deepEqual(owners(await read(page)), owners(baseline)); report.steps.push({ name: 'cancel-preserves-owners', pass: true });
        await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await tap(target);
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await ready(page);
        const moved = await read(page); assert.deepEqual(moved.landmarks.find(owner => owner.id === tree.id), { ...tree, cell: target });
        assert.deepEqual(invariant(moved), protectedState); await capture('desktop-split');
        report.steps.push({ name: 'move-same-tree-splits-compact-grove', id: tree.id, from: tree.cell, to: target, pass: true });
        await page.getByRole('button', { name: 'しまう', exact: true }).click(); await ready(page);
        assert.equal((await read(page)).landmarks.find(owner => owner.id === tree.id).cell, undefined);
        assert.deepEqual(invariant(await read(page)), protectedState); report.steps.push({ name: 'store-keeps-id-maturity', pass: true });
        await page.getByRole('button', { name: 'おく', exact: true }).click(); await tap(tree.cell);
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await ready(page);
        const restored = await read(page); assert.deepEqual(owners(restored), owners(baseline)); assert.deepEqual(invariant(restored), protectedState);
        await capture('desktop-reconnected'); report.steps.push({ name: 'restore-original-owner-and-shared-shape', pass: true });
        report.finalState = restored;
        await page.setViewportSize({ width: 390, height: 844 }); await full(); await capture('phone-whole');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.setViewportSize({ width: 768, height: 1024 }); await page.emulateMedia({ reducedMotion: 'reduce' });
        await full(); await page.getByRole('button', { name: '夕の光', exact: true }).click(); await ready(page); await capture('tablet-dusk-whole');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
        report.finalInputs = await inputs(); assert.deepEqual(report.finalInputs, report.initialInputs, 'Candidate inputs stayed fixed during the journey');
        report.pass = true;
    } catch (error) { report.error = String(error.stack || error); await capture('failure').catch(() => {}); throw error; }
    finally { page.off('pageerror', onError); report.errors = errors; await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`); }
    return { pass: report.pass, output, steps: report.steps, captures: report.captures.map(item => item.file) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert(process.env.SANSU_AUTHORED_EDIT_OUTPUT, 'Specify a fresh SANSU_AUTHORED_EDIT_OUTPUT directory');
    const browser = await chromium.launch({ headless: process.env.SANSU_AUTHORED_EDIT_HEADED !== '1' });
    try {
        const page = await browser.newPage(); page.setDefaultTimeout(30000);
        await page.goto(process.env.SANSU_AUTHORED_EDIT_URL || 'http://127.0.0.1:5340/prototypes/place-qa/authored.html');
        console.log(JSON.stringify(await run(page, process.env.SANSU_AUTHORED_EDIT_OUTPUT)));
    } finally { await browser.close(); }
}
