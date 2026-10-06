import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { digestFiles } from './verify-growing.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_SINGLE_ISLAND_URL, output = process.env.SANSU_SINGLE_ISLAND_OUTPUT;
assert(base && output, 'Set a local production URL and a fresh output directory');
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Disposable local preview only');
await fs.mkdir(output, { recursive: false });
const files = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public', 'dist'], { encoding: 'utf8' }).trim().split('\n');
files.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-single-island.mjs', 'tools/island-e2e-helpers.mjs', 'tools/verify-growing.mjs');
const inputs = await digestFiles(process.cwd(), files);
const browser = await chromium.launch();
const report = { scope: 'Real onboarding, one real answer, house/learning history back-forward, same reservation and retired URL at both widths. Explicit old Nature Town sentinel checks no automatic deletion/merge; it is not a real user migration.', target: base, inputs, scenarios: [], pass: false };
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.nature-town, .life-world, .home-journey-preview').count(), 0);
    assert.equal(await page.locator('.app-container').getAttribute('data-nature-town-feature-enabled'), 'false');
};
try {
    report.version = await fetch(`${base}/version.json`).then(r => r.json());
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const scenario = { width, pass: false }; report.scenarios.push(scenario);
        try {
            await page.goto(`${base}/#/nature-town`);
            await page.waitForURL('**/#/onboarding');
            await page.getByRole('button', { name: /^まなぶ/ }).first().click();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).click();
            await ready(page);
            const initial = await readNative(page); const id = initial.island.profileId;
            assert.equal(initial.logs.length, 0, 'Opening must not submit learning');
            const sentinel = { profileId: id, oldTownMarker: 'explicit-retired-db-fixture', revision: 7 };
            await page.evaluate(async sentinel => {
                const request = indexedDB.open('SansuNatureTownV02', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('saves', { keyPath: 'profileId' });
                const database = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
                const tx = database.transaction('saves', 'readwrite'); tx.objectStore('saves').put(sentinel);
                await new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); }); database.close();
            }, sentinel);
            await page.getByRole('button', { name: 'いえ', exact: true }).click();
            await page.locator('.island-page[data-mode="keepsakes"] [data-renderer="three"] canvas').waitFor();
            await page.screenshot({ path: `${output}/${width}-house.png` });
            await page.goBack(); await ready(page);
            await page.goForward();
            await page.locator('.island-page[data-mode="keepsakes"] [data-renderer="three"] canvas').waitFor();
            assert.equal((await readNative(page, id)).logs.length, initial.logs.length);
            await page.getByRole('button', { name: 'しま', exact: true }).click(); await ready(page);
            await page.locator('.island-shell-tab--learn').click();
            await page.locator('[data-input-ready="true"]').waitFor();
            const before = await readNative(page, id);
            const answered = (await answerUI(page, before.plan, { dev: false })).state;
            assert.equal(answered.logs.length, before.logs.length + 1);
            const reservation = { id: answered.plan.id, cursor: answered.plan.cursor };
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await ready(page);
            await page.goto(`${base}/#/nature-town`); await ready(page);
            assert.equal(new URL(page.url()).hash, '#/island');
            const saved = await page.evaluate(async id => {
                const request = indexedDB.open('SansuNatureTownV02');
                const database = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
                const get = database.transaction('saves').objectStore('saves').get(id);
                try { return await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); }); }
                finally { database.close(); }
            }, id);
            assert.deepEqual(saved, sentinel);
            await page.screenshot({ path: `${output}/${width}-home.png` });
            await page.locator('.island-shell-tab--learn').click(); await page.locator('[data-input-ready="true"]').waitFor();
            await page.goBack(); await ready(page);
            await page.goForward(); await page.locator('[data-input-ready="true"]').waitFor();
            const resumed = await readNative(page, id);
            assert.deepEqual({ id: resumed.plan.id, cursor: resumed.plan.cursor }, reservation);
            assert.equal(resumed.logs.length, answered.logs.length);
            assert.deepEqual(errors, []);
            scenario.metadata = await runtimeMetadata(page); scenario.reservation = reservation; scenario.pass = true;
        } catch (error) {
            scenario.error = String(error.stack || error); scenario.url = page.url(); scenario.errors = errors;
            scenario.screen = await page.locator('body').innerText().catch(() => 'unavailable');
            await page.screenshot({ path: `${output}/${width}-failure.png` }).catch(() => {}); throw error;
        } finally { await context.close(); }
    }
    assert.deepEqual(await digestFiles(process.cwd(), files), inputs, 'App, build or harness changed during verification');
    report.pass = true;
} finally {
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
}
console.log('PASS single island: retired URL, home/house, real answer, reservation and old DB retention at 390/768');
