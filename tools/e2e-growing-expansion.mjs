import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { makeExpansionPack } from './growing-expansion-fixtures.mjs';
import { digestFiles } from './verify-growing.mjs';
import { openGrowingMenu, readNative, runtimeMetadata, seedNative } from './island-e2e-helpers.mjs';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--development') options.development = true;
    else { assert(['--url', '--output-dir', '--build-dir'].includes(args[i]) && args[i + 1]); options[args[i].slice(2)] = args[++i]; }
}
const base = options.url, out = options['output-dir'];
assert(base && out && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
assert(options.development || options['build-dir'], 'Identify the actual production build');
await fs.mkdir(out, { recursive: false });
const pack = await makeExpansionPack(), fixtures = pack.cases.filter(entry => entry.expansion);
await fs.writeFile(path.join(out, 'fixtures.json'), JSON.stringify(pack, null, 2) + '\n');
const version = options.development ? undefined : JSON.parse(await fs.readFile(path.join(options['build-dir'], 'version.json')));
if (version) {
    assert.equal(version.island.nativeOwnedArt.enabled, true);
    assert.equal(version.island.nativeOwnedArt.candidate, 'native05-expanding-runtime-v2');
    assert.deepEqual(await fetch(`${base}/version.json`).then(response => response.json()), version);
}
const qaFiles = ['tools/e2e-growing-expansion.mjs', 'tools/growing-expansion-fixtures.mjs', 'tools/growing-place-fixtures.mjs', 'tools/island-e2e-helpers.mjs'];
const initialQA = await digestFiles(process.cwd(), qaFiles);
const report = { target: base, version, development: Boolean(options.development), candidate: 'native05-expanding-runtime-v2',
    projection: 'curved-owned-v1', fixtureSource: pack.sourceHash, fixturePayload: pack.payloadHash, initialQA,
    scope: 'Explicit equal-material 16/32-home diagnostic saves; normal SW allowed. Not earned acquisition, natural maturity or real-device performance.',
    cases: [], captures: [], pass: false };
const browser = await chromium.launch({ channel: process.env.SANSU_GROWING_BROWSER_CHANNEL || 'chrome' });
report.browser = browser.version(); let activePage;
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
    await page.locator('[data-art-candidate="native05-expanding-runtime-v2"][data-landscape-projection="curved-owned-v1"]').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const record = async (page, value) => page.evaluate(async ({ name, value }) => {
    const req = indexedDB.open(name), db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
    try {
        assertTable(); function assertTable() { if (!db.objectStoreNames.contains('cultivatedIslands')) throw Error('Missing current owned table'); }
        const tx = db.transaction('cultivatedIslands', value ? 'readwrite' : 'readonly');
        const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
        const op = value ? tx.objectStore('cultivatedIslands').put(value) : tx.objectStore('cultivatedIslands').getAll();
        const result = await new Promise((ok, no) => { op.onsuccess = () => ok(op.result); op.onerror = () => no(op.error); });
        await done; return value || result[0];
    } finally { db.close(); }
}, { name: options.development ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1', value });
const rights = state => ({ plots: state.plots, landmarks: state.landmarks, villagers: state.villagers, land: state.land, drops: state.drops, learned: state.learned });
const capture = async (page, name) => {
    await page.waitForTimeout(800);
    const file = `${name}.png`, canvasFile = `${name}-canvas.png`;
    await page.screenshot({ path: path.join(out, file) });
    await page.locator('[data-growing-world] canvas').screenshot({ path: path.join(out, canvasFile) });
    const metadata = await runtimeMetadata(page), world = await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
    assert.equal(world.artCandidate, report.candidate); assert.equal(world.landscapeProjection, report.projection);
    if (version) { assert.equal(metadata.appRoot.version, version.version); assert.equal(metadata.appRoot.revision, version.revision); }
    report.captures.push({ file, canvasFile, metadata, world }); console.log(`Captured ${file}`);
};
try {
    for (const width of [390, 768]) for (const fixture of fixtures) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true,
            reducedMotion: width === 768 ? 'reduce' : 'no-preference', timezoneId: pack.timezone });
        try {
            const page = activePage = await context.newPage(); page.setDefaultTimeout(60000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            console.log(`Starting ${width}/${fixture.id}`);
            await page.clock.setFixedTime(pack.epoch);
            await page.goto(`${base}/#/island`, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: /^まなぶ/ }).first().waitFor();
            const empty = await readNative(page); assert.equal(empty.logs.length, 0);
            await seedNative(page, fixture.id); await page.goto(`${base}/#/island`, { waitUntil: 'domcontentloaded' }); await ready(page);
            await record(page, fixture.island); await page.reload(); await ready(page);
            const before = rights((await record(page)).state), learning = await readNative(page);
            assert.equal((await record(page)).state.seed, fixture.id);
            assert.equal(await page.locator('.growing-error').count(), 0, 'Actual island must save renderer observations under its own owner');
            assert.equal(before.plots.filter(p => p.kind === 'home').length, fixture.expansion.size);
            assert.equal(before.villagers.length, fixture.expansion.size);
            assert.deepEqual(before.land, fixture.island.state.land);
            await capture(page, `${width}-${fixture.expansion.direction}-${fixture.expansion.size}-whole`);
            const menu = await openGrowingMenu(page, { touch: true }); await menu.getByRole('button', { name: 'なかま', exact: true }).tap();
            const friends = page.locator('.growing-friends'); await friends.waitFor();
            assert.equal(await friends.locator('li').count(), fixture.expansion.size);
            const last = friends.locator('li button').last(); await last.scrollIntoViewIfNeeded(); await last.tap();
            await friends.waitFor({ state: 'hidden' }); await ready(page);
            await capture(page, `${width}-${fixture.expansion.direction}-${fixture.expansion.size}-last-home-focus`);
            const pose = await page.locator('[data-growing-world]').evaluate(node => JSON.parse(node.dataset.growingCamera));
            assert.equal(pose.curved, true);
            await page.reload(); await ready(page); assert.deepEqual(rights((await record(page)).state), before);
            assert.deepEqual(await readNative(page), learning); assert.deepEqual(errors, []);
            assert.equal(await page.locator('[data-growing-world] canvas').count(), 1);
            const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            assert.equal(horizontalOverflow, false);
            report.cases.push({ id: fixture.id, width, homes: fixture.expansion.size, allOwnedRetained: true, allPeopleListed: true,
                hiddenResidentHomeFocusable: true, reloadAndLearningPreserved: true, horizontalOverflow, pass: true });
        } finally { await context.close(); }
    }
    report.finalQA = await digestFiles(process.cwd(), qaFiles); assert.deepEqual(report.finalQA, initialQA); report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, 'first-failure.png') }).catch(() => {});
} finally { await browser.close(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
