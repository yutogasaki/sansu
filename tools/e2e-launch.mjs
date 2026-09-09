import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { seedNative, readNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_LAUNCH_BASE_URL || 'http://127.0.0.1:5222';
const mode = process.env.SANSU_LAUNCH_MODE || 'island';
const destination = { island: '/island', classic: '/battle' }[mode];
assert(destination, 'Choose island or classic launch mode');
const out = process.env.SANSU_LAUNCH_OUTPUT || `output/playwright/launch-${mode}`;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const report = { target: base, mode, destination, pass: false, checks: [] };
const home = async () => {
    await page.waitForURL(`**/#${destination}`);
    await page.locator({ island: '.island-page[data-mode="home"]', classic: '.game-hub' }[mode]).waitFor();
    assert.equal(await page.locator('#explore-problem-title, .island-page[data-mode="learning"], .park-page[data-visual-mode="learning"]').count(), 0);
};
try {
    await page.goto(base);
    await page.waitForURL('**/#/onboarding');
    await page.getByRole('button', { name: mode === 'island' ? /^まなぶ$/ : /はじめる$/ }).waitFor();
    const id = await seedNative(page, randomUUID());
    await page.goto(base); await home();
    assert.equal((await readNative(page, id)).exploreRuns.length, 0);
    assert.equal((await readNative(page, id)).islandPlans.length, 0);
    report.checks.push('missing profile onboarding; existing profile ordinary top');

    // Create a real resumable exploration through its explicit route, then return
    // to top. A fabricated run row could miss startup or checkpoint side effects.
    await page.goto(`${base}/#/explore`);
    await page.locator('#explore-problem-title').waitFor();
    const attempt = page.getByTestId('explore-attempt');
    const runId = await attempt.getAttribute('data-run-id');
    assert(runId);
    const saved = await readNative(page, id);
    assert(saved.exploreRuns.some(run => run.runId === runId && run.status === 'active'));
    for (const entry of ['', '/#/', '/#/?learn=1', '/#/missing-page?start=learn', '/#/onboarding', '/#/park', '/#/park?learn=1&parkRenderer=three']) {
        await page.goto(`${base}${entry}`); await home();
        const state = await readNative(page, id);
        for (const store of ['exploreRuns', 'islandPlans', 'logs', 'memoryMath', 'memoryVocab']) {
            assert.deepEqual(state[store], saved[store], `${entry} keeps ${store} without resuming questions`);
        }
    }
    await page.reload(); await home();
    await page.screenshot({ path: `${out}/top-with-active-run.png`, animations: 'disabled' });
    report.checks.push('real active run cannot take over root, stale query, unknown route, onboarding return or reload');
    await page.goto(`${base}/#/explore`);
    await attempt.waitFor();
    assert.equal(await attempt.getAttribute('data-run-id'), runId, 'Deliberate exploration resumes the same saved run');
    assert.equal((await readNative(page, id)).logs.length, saved.logs.length);
    report.checks.push('explicit exploration still resumes its saved checkpoint');
    assert.deepEqual(errors, []);
    report.pass = true;
    console.log(`PASS ${mode} top entry`);
} catch (error) {
    report.error = String(error); report.url = page.url(); report.errors = errors;
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    throw error;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
