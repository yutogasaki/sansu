import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { plantProduction } from './growing-production-helpers.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_GROWING_PRODUCTION_URL, out = process.env.SANSU_GROWING_PRODUCTION_OUTPUT;
assert(base && out, 'Specify a local production URL and fresh output directory');
await fs.mkdir(out, { recursive: false });
const browser = await chromium.launch(), report = { target: base, scenarios: [], captures: [], pass: false };
let activePage;
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
const read = (page, id) => page.evaluate(async id => {
    const request = indexedDB.open('SansuGrowingIslandV1');
    const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
    try {
        const get = db.transaction('guidedIslands').objectStore('guidedIslands').get(id);
        return await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); });
    } finally { db.close(); }
}, id);
async function until(page, id, predicate) {
    for (let i = 0; i < 100; i++) { const record = await read(page, id); if (predicate(record)) return record; await page.waitForTimeout(100); }
    throw Error('Growing record did not reach its expected state');
}
async function capture(page, label) {
    const file = `${page.viewportSize().width}-${label}.png`; await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), world: await page.locator('[data-growing-world]').count()
        ? await page.locator('[data-growing-world]').evaluate(e => ({ ...e.dataset })) : null });
}
async function plant(page, kind, cell, id) {
    await plantProduction(page, kind, cell, (await read(page, id)).state);
}

try {
    report.version = await (await browser.newPage()).request.get(`${base}/version.json`).then(r => r.json());
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/island`); await capture(page, 'welcome');
        await page.getByRole('button', { name: /^まなぶ/ }).first().tap();
        for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).tap();
        await ready(page);
        if (await page.getByRole('button', { name: /おと.*オン/ }).count()) await page.getByRole('button', { name: /おと.*オン/ }).tap();
        let native = await readNative(page); const id = native.island.profileId;
        await plant(page, 'home', { x: 1, z: 3 }, id); await until(page, id, r => r.state.villagers.length === 1);
        await capture(page, 'first-home');
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id);
        while (native.logs.length < 10) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        await until(page, id, r => r.state.learned.length === 10);
        const seeds = page.getByRole('button', { name: 'たね', exact: true });
        if (!await seeds.isVisible()) await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
        const hit = await seeds.boundingBox(); assert(hit); await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
        await page.locator('[data-growing-seed="home"]').tap();
        await page.waitForFunction(() => document.querySelector('.growing-placing')?.textContent.includes('しずくが あと 20こ'));
        assert.match(await page.locator('.growing-placing').innerText(), /しずくが あと 20こ/);
        await page.getByRole('button', { name: 'やめる', exact: true }).tap();
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id);
        while (native.logs.length < 20) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        const continuation = { id: native.plan.id, cursor: native.plan.cursor };
        await capture(page, 'learning');
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        const earned = await until(page, id, r => r.state.learned.length === 20); assert.equal(earned.state.drops, 40);
        await plant(page, 'home', { x: 4, z: 2 }, id);
        const planted = await until(page, id, r => r.state.plots.length === 2); assert.equal(planted.state.drops, 0); assert.equal(planted.state.plots[1].stage, 0);
        await capture(page, 'planted');
        await page.evaluate(async () => navigator.serviceWorker.ready); await page.reload(); await ready(page);
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await context.setOffline(true); await page.reload(); await ready(page);
        assert.deepEqual((await read(page, id)).state.plots, planted.state.plots);
        await capture(page, 'offline');
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id); assert.equal(native.plan.id, continuation.id); assert.equal(native.plan.cursor, continuation.cursor);
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        assert.equal(native.logs.length, 23);
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        const offline = await until(page, id, r => r.state.learned.length === 23); assert.equal(offline.state.drops, 6); assert.equal(offline.state.plots[1].stage, 1);
        await page.reload(); await ready(page); assert.equal((await read(page, id)).state.drops, 6);
        assert.equal((await readNative(page, id)).logs.length, 23); await capture(page, 'offline-saved');
        assert.deepEqual(errors, []); await context.setOffline(false);
        assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name.includes('Preview'))), false);
        report.scenarios.push({ viewport, source: 'Real onboarding, UI home/learning/seed, real SW offline reload and answers; no fixture writes', answers: 23, saveVersion: offline.version, pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close(); console.log(JSON.stringify(report, null, 2));
}
