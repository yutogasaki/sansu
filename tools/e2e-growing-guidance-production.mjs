import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { plantProduction } from './growing-production-helpers.mjs';
import { answerUI, openGrowingMenu, openIslandDestination, readNative, runtimeMetadata, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_GUIDANCE_PRODUCTION_URL, out = process.env.SANSU_GUIDANCE_PRODUCTION_OUTPUT;
assert(base && out, 'Specify a local production URL and fresh output directory');
await fs.mkdir(out, { recursive: false });
const browser = await chromium.launch(), report = { target: base, scenarios: [], captures: [], pass: false };
async function sources() {
    const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public', 'dist'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/build-app.mjs', 'tools/e2e-growing-guidance-production.mjs', 'tools/island-e2e-helpers.mjs', 'tools/growing-production-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
}
report.initialSources = await sources();
let activePage;
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
const read = (page, id) => page.evaluate(async id => {
    const request = indexedDB.open('SansuGrowingIslandV1');
    const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
    try {
        const get = db.transaction('placedIslands').objectStore('placedIslands').get(id);
        return await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); });
    } finally { db.close(); }
}, id);
async function until(page, id, predicate) {
    for (let i = 0; i < 100; i++) { const record = await read(page, id); if (predicate(record)) return record; await page.waitForTimeout(100); }
    throw Error('Growing record did not reach its expected state');
}
async function capture(page, label) {
    const file = `${page.viewportSize().width}-${label}.png`;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    try { await page.screenshot({ path: `${out}/${file}` }); }
    catch (error) {
        if (!String(error).includes('Page.captureScreenshot')) throw error;
        (report.captureRetries ??= []).push({ file, error: error.stack || String(error) });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${file}` });
    }
    const metadata = await runtimeMetadata(page), world = await page.locator('[data-growing-world]').count()
        ? await page.locator('[data-growing-world]').evaluate(e => ({ ...e.dataset })) : null;
    const identity = await page.locator('.app-container').evaluate(e => ({ ...e.dataset }));
    assert.equal(metadata.appRoot.islandFeatureEnabled, true);
    if (world) { assert.equal(world.visualCandidate, 'growing-island-v1'); assert.equal(world.growingFeatureEnabled, 'true'); }
    report.captures.push({ file, ...metadata, identity, world,
        guidanceCandidate: await page.locator('.growing-guide-book').count() ? await page.locator('.growing-guide-book').getAttribute('data-visual-candidate') : null,
        cacheState: await page.evaluate(() => ({ controller: Boolean(navigator.serviceWorker.controller), online: navigator.onLine })) });
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
        await openGrowingMenu(page, { touch: true });
        const sound = page.locator('.island-sound-button');
        if (await sound.getAttribute('data-sound-state') !== 'off') {
            // A blocked audio context first needs its offered enable gesture.
            // Then use the real mute action and wait for the persisted setting.
            if (await sound.getAttribute('aria-label') === 'おとを だす') await sound.tap();
            await page.getByRole('button', { name: 'おとを けす', exact: true }).tap();
        }
        await page.locator('.island-sound-button[data-sound-state="off"]').waitFor();
        let native = await readNative(page); const id = native.island.profileId;
        await plant(page, 'home', { x: 1, z: 3 }, id); await until(page, id, r => r.state.villagers.length === 1);
        await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).tap();
        await until(page, id, r => Boolean(r.state.guidance?.achievements.A1));
        await capture(page, 'first-home');
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id); const first = native.plan.id; let answers = 0;
        while (native.plan.id === first && answers < 12) { native = (await answerUI(page, native.plan, { touch: true, dev: false })).state; answers++; }
        assert.equal(answers, 3); let continuation = { id: native.plan.id, cursor: native.plan.cursor };
        await capture(page, 'learning');
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        const earned = await until(page, id, r => r.state.learned.length === 3); assert.equal(earned.state.drops, 6);
        await until(page, id, r => Boolean(r.state.guidance?.starter.steps.S4));
        await openGrowingMenu(page, { touch: true });
        await capture(page, 'menu');
        await page.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
        await capture(page, 'book');
        await page.locator('.growing-guide-all summary').tap(); await page.locator('[data-guidance-goal="A3"]').first().tap();
        await page.getByRole('button', { name: 'これを やってみる', exact: true }).tap();
        await page.getByRole('button', { name: 'いろ 2', exact: true }).tap();
        const colored = await until(page, id, r => Boolean(r.state.guidance?.achievements.A3));
        const remembered = colored.state.guidance.achievements.A3;
        await page.getByRole('button', { name: 'とじる', exact: true }).tap();
        await openIslandDestination(page, 'いえ', { touch: true });
        await waitReady(page); await capture(page, 'house');
        await page.locator('[data-house-guide-book]').tap(); await page.locator('.growing-guide-book').waitFor();
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        await capture(page, 'house-book');
        await page.locator('.growing-guide-book').getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.locator('.island-shell-nav').getByRole('button', { name: 'しま', exact: true }).tap(); await ready(page);
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id);
        while (native.logs.length < 20) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        continuation = { id: native.plan.id, cursor: native.plan.cursor };
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        await until(page, id, r => r.state.learned.length === 20);
        await plant(page, 'farm', { x: 4, z: 2 }, id);
        const planted = await until(page, id, r => r.state.plots.length === 2); assert.equal(planted.state.drops, 0);
        await capture(page, 'planted');
        await page.evaluate(async () => navigator.serviceWorker.ready); await page.reload(); await ready(page);
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await context.setOffline(true); await page.reload(); await ready(page);
        assert.deepEqual((await read(page, id)).state.plots, planted.state.plots);
        await capture(page, 'offline');
        await openIslandDestination(page, 'いえ', { touch: true });
        await page.locator('[data-house-guide-book]').tap(); await page.locator('.growing-guide-book').waitFor();
        await capture(page, 'offline-house-book');
        await page.locator('.growing-guide-book').getByRole('button', { name: 'とじる', exact: true }).tap();
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        await page.locator('.island-shell-nav').getByRole('button', { name: 'しま', exact: true }).tap(); await ready(page);
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id); assert.equal(native.plan.id, continuation.id); assert.equal(native.plan.cursor, continuation.cursor);
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        assert.equal(native.logs.length, 23);
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        const offline = await until(page, id, r => r.state.learned.length === 23); assert.equal(offline.state.drops, 6); assert.equal(offline.state.plots[1].stage, 1);
        await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).tap();
        await until(page, id, r => Boolean(r.state.guidance?.achievements.A2 && r.state.guidance?.starter.steps.S5));
        await page.reload(); await ready(page); assert.equal((await read(page, id)).state.drops, 6);
        assert.deepEqual((await read(page, id)).state.guidance.achievements.A3, remembered);
        assert.equal((await readNative(page, id)).logs.length, 23); await capture(page, 'offline-saved');
        await openGrowingMenu(page, { touch: true });
        await page.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
        await page.getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await capture(page, 'offline-memories');
        assert.deepEqual(errors, []); await context.setOffline(false);
        assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name.includes('Preview'))), false);
        report.scenarios.push({ viewport, source: 'Real onboarding, starter, goal/color, paid farm, ordinary UI answers and actual SW offline reload; no fixture writes', sound: 'off', answers: 23, saveVersion: offline.version, pass: true });
        await context.close();
    }
    report.finalSources = await sources();
    assert.deepEqual(report.finalSources, report.initialSources, 'Application/build/harness inputs changed during production journey');
    report.sourceStable = true; report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close(); console.log(JSON.stringify(report, null, 2));
}
