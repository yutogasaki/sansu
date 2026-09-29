import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
// The initial module is intentionally held, so DOMContentLoaded/fonts.ready may not resolve.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const base = process.env.SANSU_LOADING_URL, out = process.env.SANSU_LOADING_OUTPUT;
const manifest = JSON.parse(await readFile(process.env.SANSU_LOADING_MANIFEST));
assert(base && out); await mkdir(out, { recursive: false });
async function verifySource() {
    for (const f of [...manifest.files, ...manifest.distFiles]) assert.equal(createHash('sha256').update(await readFile(f.path)).digest('hex'), f.sha256, f.path);
}
await verifySource();
const report = { target: base, version: manifest.version, sourceHash: manifest.sourceHash, humanN: 0,
    scope: 'Real onboarding/answers, module delay and module failure diagnostics, real WebGL context loss/retry, navigation and SW offline reload. No profile/save fixture injection.', captures: [], cases: [], pass: false };
const browser = await chromium.launch(); let activePage; const gates = [];
const world = page => page.locator('.life-world[data-rendered="true"]').waitFor();
const noLoading = page => page.locator('.app-loading:visible').waitFor({ state: 'hidden' });
async function owner(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuIslandLifeV1');
        const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
        try { const r = db.transaction('worlds').objectStore('worlds').getAll(); return await new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); } finally { db.close(); }
    });
}
async function shot(page, label, boot = false) {
    const file = `${page.viewportSize().width}-${label}.png`; await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...(boot ? { url: page.url(), stage: 'static HTML before module', appRoot: null } : await runtimeMetadata(page)) });
}
function gate() { let release, notify; const arrival = new Promise(resolve => { notify = resolve; }); const waiting = new Promise(resolve => { release = resolve; }); const value = { waiting, release, arrival, notify, requests: 0, open: false }; gates.push(value); return value; }
async function arrived(gate) { let timeout; try { await Promise.race([gate.arrival, new Promise((_, no) => { timeout = setTimeout(() => no(Error('Expected module request was not observed')), 15000); })]); } finally { clearTimeout(timeout); } }
try {
    for (const viewport of JSON.parse(process.env.SANSU_LOADING_VIEWPORTS || '[{"width":390,"height":844},{"width":768,"height":1024}]')) {
        const { width } = viewport;
        console.log(`${width}: start`);
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); activePage = page; page.setDefaultTimeout(45000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const boot = gate(), garden = gate(), house = gate();
        await context.route('**/assets/*.js', async route => {
            const name = new URL(route.request().url()).pathname.split('/').pop();
            const hold = /^index-/.test(name) ? boot : /^LifeWorld-/.test(name) ? garden : /^runtime-/.test(name) ? house : undefined;
            if (hold && !hold.open) { hold.requests++; hold.notify(); await hold.waiting; }
            await route.continue();
        });
        await page.goto(base, { waitUntil: 'commit' });
        await page.locator('#app-boot').waitFor(); console.log(`${width}: boot-visible`); await shot(page, 'boot-loading', true); assert(boot.requests > 0);
        if (width === 390) { await page.locator('#boot-slow').waitFor(); assert(await page.locator('#boot-retry').isVisible()); await shot(page, 'boot-slow', true); }
        boot.open = true; boot.release(); await page.locator('.island-welcome').waitFor();
        assert.deepEqual(await (await page.request.get(`${base}/version.json`)).json(), manifest.version);
        for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
        await page.locator('[data-input-ready="true"]').waitFor();
        const sound = page.getByRole('button', { name: 'おとを けす', exact: true }); if (await sound.isVisible()) await sound.click();
        let native = await readNative(page), firstPlan = native.plan.id;
        while (native.plan.id === firstPlan) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        await page.getByRole('button', { name: 'とじる', exact: true }).click();
        await page.getByText('しまを えがいているよ…', { exact: true }).waitFor(); await arrived(garden); assert(garden.requests > 0);
        await shot(page, 'garden-loading');
        await page.getByText('すこし じかんが かかっているよ', { exact: true }).waitFor();
        if (width === 768) assert.equal(await page.locator('.app-loading:visible .app-loading__orbit').evaluate(n => getComputedStyle(n).animationName), 'none');
        garden.open = true; garden.release(); await world(page); await noLoading(page); await shot(page, 'garden-ready');
        const learning = await readNative(page), before = await owner(page);
        await page.getByRole('button', { name: 'いえ', exact: true }).click();
        await page.getByText('いえを ひらいているよ…', { exact: true }).waitFor(); await arrived(house); assert(house.requests > 0); await shot(page, 'house-loading');
        house.open = true; house.release();
        await page.waitForFunction(() => { const n = document.querySelector('[data-renderer="three"]'); return n && JSON.parse(n.dataset.keepsakeRoom || 'null')?.visible && Number(n.dataset.drawCalls) > 10; });
        await noLoading(page); await shot(page, 'house-ready');
        await page.getByRole('button', { name: 'しま', exact: true }).click(); await world(page);
        await page.locator('.life-world canvas').evaluate(canvas => {
            const gl = canvas.getContext('webgl2'); const extension = gl?.getExtension('WEBGL_lose_context'); if (!extension) throw Error('Context loss unavailable'); extension.loseContext();
        });
        await page.locator('.life-world-error').waitFor(); await noLoading(page); await shot(page, 'renderer-error');
        await page.locator('.life-world-error').getByRole('button', { name: 'もういちど みる', exact: true }).click();
        await world(page); await page.locator('.life-world-error').waitFor({ state: 'hidden' }); await noLoading(page);
        assert.deepEqual(await readNative(page), learning);
        const after = await owner(page); assert.deepEqual(after.map(r => r.actions), before.map(r => r.actions)); assert.deepEqual(after.map(r => r.credits), before.map(r => r.credits));
        await page.getByRole('button', { name: 'きろく', exact: true }).click(); await page.getByRole('heading', { name: /^(きろく|記録)$/ }).waitFor();
        await page.getByRole('button', { name: '設定', exact: true }).click(); await page.getByRole('button', { name: 'しま', exact: true }).click(); await world(page);
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await context.setOffline(true); await page.reload(); await world(page); await noLoading(page); await shot(page, 'offline-ready');
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('[data-input-ready="true"]').waitFor();
        assert.equal((await readNative(page)).plan.id, learning.plan.id); await shot(page, 'same-learning');
        native = (await answerUI(page, learning.plan, { touch: true, dev: false })).state;
        assert.equal(native.logs.length, learning.logs.length + 1); assert.deepEqual(errors, []);
        report.cases.push({ width, pass: true, errors, sameLearning: true, retryPreservesOwner: true, offlineAnswer: true, delayedModules: { boot: boot.requests, garden: garden.requests, house: house.requests } });
        await context.close();
    }
    // A failed initial module must leave a usable HTML retry, before React exists.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); activePage = page;
    await context.route('**/assets/index-*.js', route => route.abort('failed'));
    await page.goto(base, { waitUntil: 'commit' }); await page.getByText('うまく ひらけなかったよ', { exact: true }).waitFor(); await shot(page, 'module-error', true);
    await context.unroute('**/assets/index-*.js'); await page.getByRole('button', { name: 'もういちど ひらく', exact: true }).click(); await page.locator('.island-welcome').waitFor();
    report.moduleRetry = true; await context.close();
    await verifySource(); report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (activePage && !activePage.isClosed()) { await activePage.screenshot({ path: `${out}/failure.png` }); report.failure = { url: activePage.url(), text: await activePage.locator('body').innerText() }; }
    throw error;
} finally { gates.forEach(g => g.release()); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases, moduleRetry: report.moduleRetry }));
