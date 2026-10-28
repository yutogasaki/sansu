import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { appRootMetadata, seedNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_KOKUGO_URL;
const output = process.env.SANSU_KOKUGO_OUTPUT;
assert(base && output, 'Specify a fixed preview URL and a new output directory');
await fs.mkdir(output);
const report = { at: new Date().toISOString(), base, fixture: 'isolated synthetic owners; actual UI for settings, exposure and navigation', scenarios: [], errors: [], pass: false };
const browser = await chromium.launch();
let currentPage;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = (page, table) => page.evaluate(async table => {
    const request = indexedDB.open('SansuDatabase');
    const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
        const request = database.transaction(table).objectStore(table).getAll();
        return await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    } finally { database.close(); }
}, table);
async function capture(page, name, width) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal overflow');
    await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
}
try {
    for (const width of [390, 320, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : 844 }, reducedMotion: 'reduce' });
        const page = currentPage = await context.newPage(); page.setDefaultTimeout(30000);
        page.on('pageerror', error => report.errors.push({ width, message: error.stack }));
        page.on('requestfailed', request => report.errors.push({ width, url: request.url(), message: request.failure()?.errorText }));
        await page.goto(`${base}/#/onboarding`); await button(page, 'しまへ いく').waitFor();
        await seedNative(page, `kokugo-continuity-${width}`);
        await page.goto(`${base}/#/kokugo`); await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor();
        await page.getByLabel('学年の めやす', { exact: true }).selectOption('2');
        const other = await context.newPage(); await other.goto(`${base}/#/kokugo`);
        await other.getByRole('alert').filter({ hasText: 'ほかの画面で 学習中' }).waitFor();
        assert(await button(other, 'しまへ 戻る').isEnabled());
        assert(await button(other, '教科を えらぶ').isEnabled());
        assert(await other.locator('[data-kokugo-unit]').first().isDisabled(), 'Blocked tab cannot reserve learning');
        const before = await read(other, 'kokugoCourses');
        await capture(other, 'blocked-exit', width);
        await button(other, 'しまへ 戻る').click(); await other.waitForURL(/#\/island$/);
        assert.deepEqual(await read(other, 'kokugoCourses'), before, 'Exit itself does not change course');
        await other.close();

        // A keyed ordinary settings child keeps the existing history behavior.
        await page.goto(`${base}/#/settings`);
        await page.locator('[data-setting-section=learning]').click(); await page.waitForURL(/section=learning/);
        await button(page, 'もどる').click(); await page.waitForURL(/#\/settings$/);
        await page.goto(`${base}/#/stats`);
        await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
        await button(page, '教科を えらぶ').click();
        const subjects = page.getByRole('group', { name: '学習する科目', exact: true });
        await subjects.waitFor();
        assert.equal(await button(page, '筆算モード').count(), 0);
        await subjects.getByRole('button', { name: '算数', exact: true }).click();
        await button(page, '筆算モード').waitFor();
        await page.waitForFunction(() => document.querySelector('[aria-label="筆算モード"]')?.getAttribute('aria-pressed') === 'false');
        await button(page, '筆算モード').click();
        await page.waitForFunction(() => document.querySelector('[aria-label="筆算モード"]')?.getAttribute('aria-pressed') === 'true');
        await subjects.getByRole('button', { name: '英語', exact: true }).click();
        await button(page, '筆算モード').waitFor({ state: 'detached' });
        await subjects.getByRole('button', { name: '算数+英語', exact: true }).click();
        await button(page, '筆算モード').waitFor();
        assert.equal(await button(page, '筆算モード').getAttribute('aria-pressed'), 'true', 'Hidden math setting retains preference');
        await button(page, 'もどる').click(); await page.waitForURL(/#\/stats$/);
        assert.equal((await read(page, 'kokugoCourses'))[0].preferred, false, 'Returning does not reactivate Kokugo');

        await page.goto(`${base}/#/settings?section=display`);
        await page.getByRole('group', { name: '表示テキスト', exact: true }).getByRole('button', { name: 'やさしい', exact: true }).click();
        await page.getByRole('group', { name: 'ひょうじ テキスト', exact: true }).waitFor();
        await page.goto(`${base}/#/kokugo`);
        await page.getByRole('heading', { name: 'こくごを まなぼう', exact: true }).waitFor();
        assert(await page.locator('.kokugo-header h1').evaluate(element => element.scrollWidth <= element.clientWidth), 'Subject name remains fully visible');
        await button(page, 'かんじ').click();
        await page.getByRole('heading', { name: '1,026じの かんじ', exact: true }).waitFor();
        assert.equal(await page.locator('label[for=kokugo-kanji-search]').innerText(), 'じ・ことば・よみで さがす（ぜんがくねん）');
        await page.getByLabel('じ・ことば・よみで さがす（ぜんがくねん）', { exact: true }).fill('山');
        await page.getByRole('button', { name: /^山 · しょうがく1ねん/ }).click();
        const detail = page.locator('.kokugo-kanji-detail');
        assert.equal(await detail.locator('.kokugo-kanji-glyph').innerText(), '山', 'Target glyph remains unchanged');
        await detail.getByRole('button', { name: 'よみと ことばの れいを みる', exact: true }).click();
        await detail.locator('.kokugo-kanji-model').waitFor();
        assert((await detail.locator('ruby').count()) > 0, 'Authored word models remain available');
        await capture(page, 'easy-kanji', width);
        const summary = page.getByText('かんじごとの きろく', { exact: true });
        await summary.click(); await page.getByLabel('がくねん', { exact: true }).waitFor();
        assert((await page.locator('#kokugo-record-grade').innerText()).includes('しょうがく1ねん'));
        assert((await page.locator('#kokugo-record-grade').locator('..').innerText()).includes('よみを えらぶ'));
        await capture(page, 'easy-records', width);
        await button(page, 'きょうかを えらぶ').click();
        await page.getByRole('group', { name: 'べんきょう する もの', exact: true }).waitFor();
        assert.equal(await button(page, 'ひっさん モード').count(), 0);
        report.scenarios.push({ width, pass: true, metadata: await appRootMetadata(page) });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (currentPage && !currentPage.isClosed()) {
        report.failedUrl = currentPage.url();
        report.failedText = await currentPage.locator('body').innerText().catch(() => 'unavailable');
        await currentPage.screenshot({ path: `${output}/failure.png` }).catch(() => undefined);
    }
    throw error;
} finally {
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
