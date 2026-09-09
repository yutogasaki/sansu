import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { button, readNative, waitMode, waitReady, runtimeMetadata, seedNative } from './island-e2e-helpers.mjs';
import { attempt, waitLearningReady } from './island-learning-checks.mjs';
const target = process.env.SANSU_TUTORIAL_URL || 'http://127.0.0.1:5226';
const out = process.env.SANSU_TUTORIAL_OUTPUT || `output/playwright/tutorial-${Date.now()}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target, pass: false, humanN: 0, scenarios: [], captures: [] };
try {
for (const width of [390, 768]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const capture = async name => {
        await page.screenshot({ path: `${out}/${width}-${name}.png`, fullPage: true });
        report.captures.push({ file: `${width}-${name}.png`, ...await runtimeMetadata(page) });
    };
    const help = async () => {
        await button(page, 'しまのメニュー').click(); await button(page, 'あそびかた').click(); await waitMode(page, 'help');
    };
    const guide = page.locator('[data-tutorial]');
    try {
        await page.goto(`${target}/#/island`);
        await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
        await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
        await waitMode(page, 'learning'); await waitReady(page);
        let state = await readNative(page); await waitLearningReady(page, state.plan);
        assert.equal(await guide.count(), 0);
        const first = state.plan.id;
        for (let n = 0; state.plan.id === first; n++) { assert(n < 8); state = (await attempt(page, state)).after; }
        const savedLearning = JSON.stringify({ logs: state.logs, math: state.memoryMath, vocab: state.memoryVocab });
        const reservation = state.plan;
        const profileId = state.island.profileId;
        await button(page, 'とじる').click(); await waitMode(page, 'home'); await waitReady(page);
        await page.locator('[data-tutorial="growth"]').waitFor(); await capture('growth');
        await button(page, 'あんないを とじる').click();
        assert.equal(await guide.count(), 0, 'No queued second guide after dismiss');
        await page.reload(); await waitReady(page);
        await page.locator('[data-tutorial="view"]').waitFor(); await capture('view');
        await page.locator('summary').filter({ hasText: 'ながめ' }).click();
        await page.getByRole('button', { name: 'しまを おおきく', exact: true }).click();
        await guide.waitFor({ state: 'hidden' });
        await button(page, 'しまのメニュー').click(); if (await page.locator('[data-home-group=arrange]').count()) await page.locator('[data-home-group=arrange] > summary').click(); await page.locator('[data-home-action=customization]').click(); await waitMode(page, 'customization');
        await page.locator('[data-tutorial="customization"]').waitFor();
        await capture('automatic-customization');
        await page.locator('[data-customization-id]').last().click(); await guide.waitFor({ state: 'hidden' });
        assert(await page.evaluate(id => localStorage.getItem(`pokomoko:tutorial:v1:${encodeURIComponent(id)}:customization:practiced`) === '1', profileId));
        await page.goBack(); await waitMode(page, 'home');
        await button(page, 'しまのメニュー').click(); await button(page, 'どうぶつと あそぶ').click(); await waitMode(page, 'play');
        await page.locator('[data-tutorial="play"]').waitFor(); await capture('automatic-play');
        // Another tab changing unrelated preferences must not dismiss this guide.
        const other = await context.newPage(); await other.goto(`${target}/#/island?view=help`); await waitMode(other, 'help');
        await other.evaluate(() => localStorage.setItem('tutorial-e2e-unrelated', 'yes'));
        assert.equal(await page.locator('[data-tutorial="play"]').count(), 1);
        await other.close(); await page.bringToFront();
        await page.locator('.island-play-choices button').first().click(); await guide.waitFor({ state: 'hidden' });
        await page.waitForFunction(id => localStorage.getItem(`pokomoko:tutorial:v1:${encodeURIComponent(id)}:play:practiced`) === '1', profileId);
        await button(page, 'あそびを とじる').click(); await waitMode(page, 'home');
        await help(); await capture('help');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const sizes = await page.locator('.island-help button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.width, r.height]; }));
        assert(sizes.every(([w, h]) => w >= 44 && h >= 44));
        await page.locator('.island-help-topics').getByRole('button', { name: 'きせかえ', exact: true }).click();
        await button(page, 'やってみる').click(); await waitMode(page, 'customization');
        await page.locator('[data-tutorial="customization"]').waitFor(); await capture('customization');
        await button(page, 'あんないを とじる').click();
        // Browser back preserves the handbook as the explicit entry, without changing a reservation.
        await page.goBack(); await waitMode(page, 'help');
        await page.locator('.island-help-topics').getByRole('button', { name: '家具を 動かす', exact: true }).click();
        await button(page, 'やってみる').click(); await waitMode(page, 'inventory');
        await page.locator('[data-tutorial="placement"]').waitFor(); await capture('placement');
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await waitMode(page, 'learning');
        await waitLearningReady(page, reservation); assert.equal(await guide.count(), 0);
        state = await readNative(page); assert.deepEqual(state.plan, reservation);
        assert.equal(JSON.stringify({ logs: state.logs, math: state.memoryMath, vocab: state.memoryVocab }), savedLearning);
        await capture('learning');
        let offlineChecked = false;
        if (await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
            await button(page, 'とじる').click(); await waitMode(page, 'inventory');
            // Explicit navigation back to the same handbook is read-only.
            await page.goBack(); await waitMode(page, 'help');
            await context.setOffline(true); await page.reload(); await waitMode(page, 'help');
            await page.locator('.island-help-topics').getByRole('button', { name: 'ながめる', exact: true }).click();
            await button(page, 'やってみる').click(); await waitMode(page, 'play');
            await page.locator('[data-tutorial="view"]').waitFor();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await waitMode(page, 'learning');
            await waitLearningReady(page, reservation); assert.deepEqual((await readNative(page)).plan, reservation);
            offlineChecked = true; await context.setOffline(false);
        }
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, pass: true, sameReservation: true, firstLearningUninterrupted: true, minimumTarget: 44, offlineChecked });
    } catch (error) { await capture('failure'); await writeFile(`${out}/${width}-failure-state.json`, JSON.stringify({ state: await readNative(page), local: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('pokomoko:tutorial:')))) }, null, 2)); throw error; }
    finally { await context.close(); }
}
const legacy = await browser.newContext({ viewport: { width: 390, height: 844 } });
try {
    const page = await legacy.newPage(); await page.goto(`${target}/#/island`); await button(page, 'まなぶ').waitFor();
    await seedNative(page, 'tutorial-legacy-fixture'); await page.goto(`${target}/#/island`); await waitReady(page);
    assert.equal(await page.locator('[data-tutorial]').count(), 0);
    await button(page, 'しまのメニュー').click(); await button(page, 'あそびかた').click(); await waitMode(page, 'help');
    report.scenarios.push({ legacyProfileFixture: true, automaticHelpAbsent: true, manualHelpAvailable: true });
} finally { await legacy.close(); }
report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ out, ...report }));
