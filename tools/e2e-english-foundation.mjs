import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { runtimeMetadata } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_FOUNDATION_URL || 'http://127.0.0.1:5276';
const output = process.env.SANSU_FOUNDATION_OUTPUT;
assert(output, 'Set fresh SANSU_FOUNDATION_OUTPUT');
await fs.mkdir(output, { recursive: false });
const browser = await chromium.launch();
const report = { at: new Date().toISOString(), base, scenarios: [], pass: false };
async function store(page, table, database = 'SansuDatabase') {
    return page.evaluate(async ({ table, database }) => {
        const request = indexedDB.open(database);
        const db = await new Promise((ok, fail) => { request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
        try { const request = db.transaction(table).objectStore(table).getAll(); return await new Promise((ok, fail) => { request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); }); }
        finally { db.close(); }
    }, { table, database });
}
async function until(read, predicate) {
    for (let i = 0; i < 200; i++) { const value = await read(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('Saved state did not reach expected result');
}
const plan = async page => (await store(page, 'foundationPlans')).find(p => p.status === 'pending');
const section = page => page.locator('[data-foundation-screen]');
const click = (page, name) => section(page).getByRole('button', { name, exact: true }).click();
async function capture(page, name) { await page.screenshot({ path: `${output}/${page.viewportSize().width}-${name}.png`, animations: 'disabled' }); }
async function ready(page) { await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor(); }
let currentPage;
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = currentPage = await context.newPage(); page.setDefaultTimeout(45000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        if (process.env.SANSU_FOUNDATION_UPDATE_CONTROL) await page.request.post(`${process.env.SANSU_FOUNDATION_UPDATE_CONTROL}/old`);
        await page.goto(`${base}/#/onboarding`);
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).click(); await ready(page);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
        await page.getByRole('button', { name: 'えいご', exact: true }).click();
        await page.getByRole('button', { name: /もじと おとから はじめる/ }).click();
        await page.locator('[data-foundation-screen="introduction"]').waitFor();
        assert.deepEqual(await store(page, 'memoryMath'), []); assert.deepEqual(await store(page, 'memoryVocab'), []);
        await capture(page, 'F01-introduction');
        for (const letter of ['A', 'B', 'C']) await click(page, `${letter}の おとを きく`);
        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        // Explicit cache-corruption diagnostic; the service worker remains enabled.
        await page.evaluate(async () => {
            for (const name of await caches.keys()) {
                const cache = await caches.open(name);
                const key = (await cache.keys()).find(key => new URL(key.url).pathname === '/foundation/v1/audio/A.mp3');
                if (key) {
                    window.__foundationOriginalAsset = { name, url: key.url, bytes: Array.from(new Uint8Array(await (await cache.match(key)).arrayBuffer())) };
                    await cache.put(key, new Response(new Uint8Array(160).fill(1), { headers: { 'Content-Type': 'audio/mpeg' } })); return;
                }
            }
            throw new Error('Missing actual precache clip');
        });
        await click(page, 'いっしょに やってみよう');
        await section(page).getByRole('alert').waitFor();
        assert.equal((await plan(page)).slots[0].presentation, undefined);
        assert.equal((await store(page, 'foundationOutbox')).length, 0);
        await capture(page, 'asset-fault-diagnostic');
        await page.evaluate(async () => { const saved = window.__foundationOriginalAsset; await (await caches.open(saved.name)).put(saved.url, new Response(new Uint8Array(saved.bytes), { headers: { 'Content-Type': 'audio/mpeg' } })); delete window.__foundationOriginalAsset; });
        await click(page, 'もういちど ためす');
        let saved = await until(() => plan(page), p => Boolean(p?.slots[0].presentation));
        await page.getByRole('button', { name: saved.slots[0].choices.find(t => t !== saved.slots[0].target), exact: true }).click();
        saved = await until(() => plan(page), p => p?.slots[0].firstAnswer?.correct === false);
        const snapshot = structuredClone(saved);
        await capture(page, 'F01-retry');
        await click(page, 'あとで・しまへ もどる'); await ready(page);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('[data-foundation-screen="question"]').waitFor();
        saved = await plan(page); assert.equal(saved.id, snapshot.id); assert.deepEqual(saved.slots[0].firstAnswer, snapshot.slots[0].firstAnswer); assert.deepEqual(saved.slots[0].choices, snapshot.slots[0].choices);
        await click(page, 'おてほんを みよう'); await click(page, 'つぎへ すすむ');
        for (let cursor = 1; cursor < 3; cursor++) {
            saved = await until(() => plan(page), p => p?.cursor === cursor && !!p.slots[cursor].presentation);
            await click(page, '♪ おとを きく');
            await section(page).getByRole('button', { name: saved.slots[cursor].target, exact: true }).click();
        }
        await page.locator('[data-foundation-screen="completed"]').waitFor();
        await capture(page, 'F01-completed');
        assert.equal((await store(page, 'foundationOutbox')).length, 3);
        assert.equal((await store(page, 'foundationEvents')).filter(e => e.type === 'answer' && e.correct).length, 2);
        await click(page, 'コースを かえる'); await section(page).getByRole('button', { name: /えいごの おとを きこう/ }).click();
        await page.locator('[data-foundation-screen="introduction"]').waitFor();
        await capture(page, 'F02-introduction');
        for (const word of ['りんご', 'ねこ', 'いぬ']) await click(page, `${word}の おとを きく`);
        await click(page, 'いっしょに やってみよう');
        saved = await until(() => plan(page), p => p?.unit === 'F02' && !!p.slots[0].presentation);
        await capture(page, 'F02-listening');
        assert.equal(await section(page).getByText(/apple|cat|dog/).count(), 0);
        await click(page, '♪ おとを きく');
        await section(page).getByRole('button', { name: `${saved.slots[0].choices.indexOf(saved.slots[0].target) + 1}ばんの え`, exact: true }).click();
        await until(() => plan(page), p => p?.cursor === 1 && !!p.slots[1].presentation);
        await click(page, 'コースを かえる'); await section(page).getByRole('button', { name: /えいたんごを よむ/ }).click();
        assert.equal((await store(page, 'foundationCourses'))[0].pending.course, 'vocabulary');
        await click(page, 'あとで・しまへ もどる'); await ready(page);
        await until(() => store(page, 'foundationReceipts', 'SansuGrowingIslandV1'), receipts => receipts.length === 4);
        const world = (await store(page, 'foundationIslands', 'SansuGrowingIslandV1'))[0]; assert.equal(world.state.drops, 8);
        if (process.env.SANSU_FOUNDATION_UPDATE_CONTROL) {
            const beforeUpdate = await store(page, 'foundationPlans');
            await page.request.post(`${process.env.SANSU_FOUNDATION_UPDATE_CONTROL}/new`);
            await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
            await page.waitForFunction(version => document.querySelector('.island-page')?.dataset.buildVersion === version, process.env.SANSU_FOUNDATION_NEW_VERSION, { timeout: 90000 });
            await ready(page); assert.deepEqual(await store(page, 'foundationPlans'), beforeUpdate);
            await capture(page, 'updated-same-reservation');
        }
        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
        await page.reload(); await ready(page);
        await context.setOffline(true); await page.reload(); await ready(page);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('[data-foundation-screen="question"]').waitFor();
        await section(page).getByRole('button', { name: '♪ おとを きく', exact: true }).waitFor({ state: 'visible' });
        saved = await plan(page); assert.equal(saved.cursor, 1); assert.equal(saved.unit, 'F02');
        await page.getByRole('button', { name: 'おとを けす', exact: true }).click();
        await until(() => store(page, 'profiles'), rows => rows[0].soundEnabled === false);
        await until(() => section(page).getByRole('button', { name: '♪ おとを きく', exact: true }).isDisabled(), value => value);
        await click(page, 'きこえない・もじで みる');
        await section(page).getByRole('button', { name: ({ apple: 'りんご', cat: 'ねこ', dog: 'いぬ' })[saved.slots[1].target], exact: true }).click();
        await capture(page, 'offline-alternative');
        assert.deepEqual(await store(page, 'logs'), []);
        assert.equal((await store(page, 'foundationReceipts', 'SansuGrowingIslandV1')).length, 4);
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, runtime: await runtimeMetadata(page), assetHashFailureSafe: true, firstWrongPreserved: true, supportWithoutFalseCorrect: true, F02AudioPictures: true, queuedSwitch: true, rewardsOnce: true, offlineResume: true, alternativeSupported: true, soundOffRespected: true, realTwoBuildUpdate: Boolean(process.env.SANSU_FOUNDATION_UPDATE_CONTROL), passed: true });
        await context.close();
    }
    report.pass = true;
} catch (error) { report.error = String(error); report.url = currentPage?.url(); if (currentPage) { report.body = await currentPage.locator('body').innerText().catch(() => ''); await capture(currentPage, 'failure').catch(() => {}); } throw error; }
finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log('PASS English foundation: both units, evidence, resume, reward ledger, queued course, offline, alternative');
