import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL;
const out = process.env.SANSU_LEGACY_ENTRY_OUTPUT;
assert(base && out, 'Specify the app URL and a fresh output directory');
await mkdir(out, { recursive: false });
const browser = await chromium.launch();
const report = { target: base, fixture: 'Disposable native profile; actual UI answer and navigation. No injected earned rewards.', cases: [], pass: false };
let activePage;
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: 'reduce' });
        const page = activePage = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.locator('.island-welcome').waitFor();
        const id = await seedNative(page, randomUUID());
        await page.reload(); await waitReady(page); await waitMode(page, 'home');
        await page.getByRole('button', { name: 'しまのメニュー', exact: true }).click();
        await page.getByRole('dialog', { name: 'しまのメニュー' }).waitFor();
        assert.equal(await page.locator('[data-home-action="other-games"]').count(), 0);
        await page.locator('details').filter({ has: page.locator('[data-home-action="inventory"]') }).locator('summary').click();
        assert(await page.locator('[data-home-action="inventory"]').isVisible());
        await page.screenshot({ path: `${out}/${width}-menu.png` });
        await page.keyboard.press('Escape');
        await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
        await waitMode(page, 'learning'); await waitReady(page);
        const before = await readNative(page, id);
        await answerUI(page, before.plan, { dev: base.includes('127.0.0.1') });
        await page.getByRole('button', { name: 'とじる', exact: true }).click();
        await waitMode(page, 'home');
        const saved = await readNative(page, id);
        assert(saved.logs.length > before.logs.length);
        await page.goto(`${base}/#/battle`);
        await page.getByRole('heading', { name: 'ほかの あそび', exact: true }).waitFor();
        assert(await page.getByRole('button', { name: /ポッコの たんけん/ }).isVisible());
        await page.screenshot({ path: `${out}/${width}-direct-games.png` });
        await page.getByRole('button', { name: /ポッコの たんけん/ }).click();
        await page.waitForURL('**/#/explore');
        await page.goto(`${base}/#/island`); await waitReady(page); await waitMode(page, 'home');
        const returned = await readNative(page, id);
        assert.deepEqual(returned.plan, saved.plan);
        assert.deepEqual(returned.logs, saved.logs);
        await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
        await waitMode(page, 'learning'); await waitReady(page);
        assert.equal((await readNative(page, id)).plan.id, saved.plan.id);
        await page.screenshot({ path: `${out}/${width}-same-learning.png` });
        assert.deepEqual(errors, []);
        report.cases.push({ width, runtime: await runtimeMetadata(page), logs: saved.logs.length, planId: saved.plan.id, pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close(); console.log(JSON.stringify(report, null, 2));
}
