// Retired 2026-10-27: it makes ordinary islands from the chart, which island-journey.md §3.1 ended.
// Kept as the evidence of that round; special islands are checked in src/domain/growingIsland/journey.test.ts.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { seedNative, openGrowingMenu, runtimeMetadata, readNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_VOYAGES_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_VOYAGES_OUTPUT;
assert(out, 'Specify a fresh SANSU_VOYAGES_OUTPUT directory');
await fs.mkdir(out, { recursive: false });
const walk = async path => (await Promise.all((await fs.readdir(path, { withFileTypes: true }))
    .map(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`]))).flat();
const paths = [...await walk('src'), 'package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-island-voyages.mjs'];
const sources = async () => Object.fromEntries(await Promise.all(paths.map(async path =>
    [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const report = { at: new Date().toISOString(), target: base, sources: await sources(), cases: [], pass: false,
    scope: 'Explicit native profile fixture; actual production UI creates and visits islands. No learning credits, clock changes or Growing DB injection. Offline retention checked. Human comprehension and real two-build migration remain separate.' };
const read = (page, profileId) => page.evaluate(async profileId => {
    const request = indexedDB.open('SansuGrowingIslandV1');
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = db.transaction('foundationIslands'), get = transaction.objectStore('foundationIslands').get(profileId);
    const result = await new Promise((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
    db.close(); return result;
}, profileId);
const rights = state => ({ land: state.land, villagers: state.villagers, plots: state.plots.map(({ id, kind, cell }) => ({ id, kind, cell })),
    landmarks: state.landmarks.map(({ id, kind, cell }) => ({ id, kind, cell })) });
const browser = await chromium.launch();
let activePage;
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true,
            reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/island`);
        const id = await seedNative(page, randomUUID());
        await page.reload();
        const ready = async () => { await page.locator('[data-growing-island="ready"]').waitFor();
            await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
        const chart = async () => { await openGrowingMenu(page); await page.getByRole('button', { name: '海図と ふね', exact: true }).click();
            await page.locator('.voyage-island').first().waitFor(); };
        await ready();
        const original = await read(page, id), learning = await readNative(page, id);
        await chart();
        // The dialog animates into the fixed canvas. Wait for its actual touch target
        // to settle before starting the next step; an early mouse click can miss it.
        await page.waitForTimeout(800);
        const newIsland = page.getByRole('button', { name: '新しい島を つくる', exact: true });
        await newIsland.scrollIntoViewIfNeeded();
        await newIsland.tap();
        await page.locator('.voyage-create').waitFor();
        await page.getByRole('button', { name: /森のしま 木の苗/ }).click();
        await page.getByLabel('島の なまえ', { exact: true }).fill('もりのわがや');
        await page.getByRole('button', { name: '新しい島を つくっていく（無料）', exact: true }).click();
        await page.getByRole('dialog', { name: '海図と ふね' }).waitFor({ state: 'hidden' }); await ready();
        const forest = await read(page, id);
        assert.equal(forest.islandStart, 'grove'); assert.equal(forest.state.islandName, 'もりのわがや');
        assert.equal(forest.state.landmarks.filter(item => item.kind === 'sapling').length, 2);
        assert.equal(forest.state.drops, original.state.drops);
        await page.screenshot({ path: `${out}/${width}-forest.png` });
        await chart();
        await page.getByRole('button', { name: 'もりのわがや・いまここ', exact: true }).waitFor();
        await page.screenshot({ path: `${out}/${width}-chart.png` });
        await page.getByRole('button', { name: 'はじまりのしまへ ふねでいく', exact: true }).click();
        await page.getByRole('dialog', { name: '海図と ふね' }).waitFor({ state: 'hidden' }); await ready();
        const returned = await read(page, id);
        assert.equal(returned.islandId, 'main'); assert.deepEqual(rights(returned.state), rights(original.state));
        await chart();
        await page.getByRole('button', { name: 'ぽこもこの家', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-growing-world]')?.dataset.growingFocus === 'house');
        await chart();
        await page.getByRole('button', { name: 'もりのわがやへ ふねでいく', exact: true }).click();
        await page.getByRole('dialog', { name: '海図と ふね' }).waitFor({ state: 'hidden' }); await ready();
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await context.setOffline(true); await page.reload(); await ready();
        const offline = await read(page, id);
        assert.equal(offline.islandId, forest.islandId); assert.deepEqual(rights(offline.state), rights(forest.state));
        await chart();
        await page.getByRole('button', { name: '木のところ', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-growing-world]')?.dataset.growingFocus === 'voyage-tree-1');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(await readNative(page, id), learning);
        assert.deepEqual(errors, []);
        const metadata = await runtimeMetadata(page);
        assert.equal(metadata.appRoot.islandFeatureEnabled, true);
        report.cases.push({ width, forestId: forest.islandId, returnedId: returned.islandId, offline: true, learningUnchanged: true, metadata });
        await context.close();
    }
    assert.deepEqual(await sources(), report.sources, 'App inputs changed during journey');
    report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (activePage && !activePage.isClosed()) { report.body = await activePage.locator('body').innerText().catch(() => 'unavailable');
        await activePage.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => undefined); }
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`PASS production voyages, return, offline and learning preservation (${report.cases.length} viewports)`);
