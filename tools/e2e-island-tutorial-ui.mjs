import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { seedDev, button, waitMode, waitReady, runtimeMetadata, readNative } from './island-e2e-helpers.mjs';
const target = process.env.SANSU_TUTORIAL_URL || 'http://127.0.0.1:5226';
const out = `output/playwright/tutorial-ui-${Date.now()}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target, fixture: 'Explicit new-profile flag, no fabricated growth or answers; UI-only diagnostic, not first-learning evidence', pass: false, humanN: 0, captures: [] };
try {
for (const width of [390, 768]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(`${target}/#/island`); await button(page, 'まなぶ').waitFor();
        const id = await seedDev(page, { familiar: false });
        await page.evaluate(async id => { const { updateProfileAtomically } = await import('/src/domain/user/repository.ts'); await updateProfileAtomically(id, profile => ({ ...profile, islandTutorialVersion: 1 })); }, id);
        await page.goto(`${target}/#/island`); await waitMode(page, 'home'); await waitReady(page);
        const capture = async name => { const file = `${width}-${name}.png`; await page.screenshot({ path: `${out}/${file}`, fullPage: true }); report.captures.push({ file, ...await runtimeMetadata(page) }); };
        await page.locator('[data-tutorial="view"]').waitFor(); await capture('view');
        await page.locator('summary').filter({ hasText: 'ながめ' }).click(); await button(page, 'しまを おおきく').click();
        await page.locator('[data-tutorial]').waitFor({ state: 'hidden' });
        await button(page, 'しまのメニュー').click(); await button(page, 'どうぶつと あそぶ').click(); await waitMode(page, 'play');
        await page.locator('[data-tutorial="play"]').waitFor(); await capture('play');
        await button(page, 'あんないを とじる').click(); await button(page, 'あそびを とじる').click(); await waitMode(page, 'home');
        await button(page, 'しまのメニュー').click(); if (await page.locator('[data-home-group=arrange]').count()) await page.locator('[data-home-group=arrange] > summary').click(); await page.locator('[data-home-action=customization]').click(); await waitMode(page, 'customization');
        await page.locator('[data-tutorial="customization"]').waitFor(); await capture('customization');
        await page.locator('[data-customization-id]').last().click(); await page.locator('[data-tutorial]').waitFor({ state: 'hidden' });
        await page.goBack(); await waitMode(page, 'home');
        await button(page, 'しまのメニュー').click(); await button(page, 'あそびかた').click(); await waitMode(page, 'help'); await capture('help');
        for (const title of ['ながめる', '学ぶと 育つ', 'どうぶつと 遊ぶ', 'きせかえ', 'みつける', '写真を とる', '家具を 動かす']) {
            await page.locator('.island-help-topics').getByRole('button', { name: title, exact: true }).click();
            await button(page, 'やってみる').click(); await page.locator('[data-tutorial]').waitFor(); await capture(`manual-${title}`);
            await button(page, 'あんないを とじる').click(); await page.goBack(); await waitMode(page, 'help');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const stored = await readNative(page, id); assert.equal(stored.logs.length, 0); assert.equal(stored.island.completedSets, 0);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
}
report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ out, pass: report.pass }));
