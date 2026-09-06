import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';

// Two real hosted builds, independent disposable profiles, real Service Workers.
// Start before deploying; send the new Git SHA on stdin after production is ready.
const base = process.env.SANSU_PARK_LIVE_URL;
assert(base, 'Set SANSU_PARK_LIVE_URL to the existing production origin');
const out = 'output/playwright/park-release';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const report = { target: base, browser: browser.version(), device: 'Desktop Chromium / Metal; not physical mobile', navigations: { safe: [], protected: [] }, errors: [] };
const bundle = page => page.locator('script[type="module"][src]').first().getAttribute('src');
async function stored(page) {
    return page.evaluate(async () => {
        const r = indexedDB.open('SansuDatabase');
        const d = await new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        const result = {};
        for (const table of ['profiles', 'appData', 'logs', 'parks', 'parkPlans', 'exploreRuns']) {
            if (!d.objectStoreNames.contains(table)) continue;
            const request = d.transaction(table).objectStore(table).getAll();
            result[table] = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        }
        d.close(); return result;
    });
}
async function openOld(key) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('request', r => { if (r.isNavigationRequest() && new URL(r.url()).searchParams.has('__app-update')) report.navigations[key].push(r.url()); });
    await page.goto(`${base}/#/onboarding`);
    await page.getByRole('button', { name: 'たんけんを はじめる' }).waitFor();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    return { context, page };
}
async function finishOnboarding(page) {
    await page.getByRole('button', { name: '次へ', exact: true }).click();
    await page.getByRole('button', { name: /小学 1 年生/ }).click();
    await page.getByRole('button', { name: /さんすう だけ/ }).click();
    await page.getByRole('button', { name: /足し算まで/ }).click();
    await page.waitForURL(url => !url.hash.includes('onboarding'));
}
try {
    report.before = await (await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    const safe = await openOld('safe');
    await safe.page.getByRole('button', { name: 'たんけんを はじめる' }).click();
    await safe.page.getByRole('textbox', { name: 'あだ名でOK' }).fill('更新データ確認');
    await finishOnboarding(safe.page);
    await safe.page.goto(`${base}/#/settings`);
    await safe.page.getByRole('button', { name: /プロフィール.*更新データ確認/ }).waitFor();
    await safe.page.evaluate(() => localStorage.setItem('sansu-release-preservation', 'retain'));
    const beforeData = await stored(safe.page);
    const protectedTab = await openOld('protected');
    await protectedTab.page.getByRole('button', { name: 'たんけんを はじめる' }).click();
    await protectedTab.page.getByRole('textbox', { name: 'あだ名でOK' }).fill('更新途中');
    const oldBundle = await bundle(safe.page);
    assert.equal(await bundle(protectedTab.page), oldBundle);
    await safe.page.screenshot({ path: `${out}/old-settings.png` });
    await protectedTab.page.screenshot({ path: `${out}/old-protected.png` });
    await safe.context.setOffline(true); await protectedTab.context.setOffline(true);
    await fs.writeFile(`${out}/before.json`, JSON.stringify({ ...report, oldBundle, controlled: true, profileCount: beforeData.profiles.length }, null, 2));
    console.log('READY: old production is SW-controlled in two offline contexts. Send the published Git SHA on stdin.');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    let expectedRevision;
    for await (const line of input) { if (/^[a-f0-9]{40}$/.test(line.trim())) { expectedRevision = line.trim(); break; } }
    input.close(); assert(expectedRevision, 'A published Git SHA is required');
    report.after = await (await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    assert.equal(report.after.revision, expectedRevision);
    assert.notEqual(report.after.version, report.before.version);
    assert.deepEqual(report.after.park, { enabled: true, renderer: 'three' });
    const start = Date.now();
    await safe.context.setOffline(false); await protectedTab.context.setOffline(false);
    await safe.page.waitForFunction(old => document.querySelector('script[type="module"][src]')?.getAttribute('src') !== old, oldBundle, { timeout: 90000 });
    await safe.page.getByRole('button', { name: /プロフィール.*更新データ確認/ }).waitFor();
    report.pickupMs = Date.now() - start;
    assert.deepEqual(await stored(safe.page), beforeData);
    assert.equal(await safe.page.evaluate(() => localStorage.getItem('sansu-release-preservation')), 'retain');
    assert.equal(new URL(safe.page.url()).hash, '#/settings');
    await protectedTab.page.waitForTimeout(4500);
    assert.equal(await bundle(protectedTab.page), oldBundle, 'Interrupted a protected form');
    assert.equal(await protectedTab.page.getByRole('textbox', { name: 'あだ名でOK' }).inputValue(), '更新途中');
    assert.equal(report.navigations.protected.length, 0);
    await finishOnboarding(protectedTab.page);
    await protectedTab.page.waitForFunction(old => document.querySelector('script[type="module"][src]')?.getAttribute('src') !== old, oldBundle, { timeout: 30000 });
    await protectedTab.page.waitForTimeout(4500);
    assert.equal((await stored(protectedTab.page)).profiles[0].name, '更新途中');
    assert.equal(report.navigations.safe.length, 1);
    assert.equal(report.navigations.protected.length, 1);
    report.dataPreserved = true; report.protectedFormPreserved = true;
    await safe.page.goto(`${base}/#/park`);
    await safe.page.locator('[data-art-candidate="park-three-resin-v1"] canvas[data-frames]').waitFor();
    assert.equal(await safe.page.locator('[data-game-id]').getAttribute('data-build-revision'), expectedRevision);
    assert.equal((await stored(safe.page)).parks[0].parts.length, 2);
    await safe.page.screenshot({ path: `${out}/production-390.png` });
    await safe.page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
    await safe.page.getByRole('button', { name: 'とめて つくりなおす', exact: true }).waitFor();
    await safe.page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 20000 });
    assert.equal((await stored(safe.page)).logs.length, beforeData.logs.length);
    await safe.page.setViewportSize({ width: 768, height: 1024 });
    await safe.page.getByRole('button', { name: 'ならべかえる', exact: true }).click();
    await safe.page.screenshot({ path: `${out}/production-768.png` });
    assert.deepEqual(report.errors, []);
    report.pass = true;
    console.log('PASS hosted old→new PWA, one reload per context, protected form, data preservation and Three.js replay.');
} catch (error) {
    report.pass = false; report.failure = String(error); throw error;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
