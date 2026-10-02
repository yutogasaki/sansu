import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata, seedDev } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_HOUSE_GUIDE_URL || 'http://127.0.0.1:5260';
const out = process.env.SANSU_HOUSE_GUIDE_OUTPUT;
assert(out, 'Specify a fresh output directory'); await fs.mkdir(out, { recursive: false });
async function sources() {
    const paths = execFileSync('rg', ['--files', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-growing-house-guide.mjs', 'tools/island-e2e-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
}
const report = { target: base, source: 'DEV; disposable profile only. Actual house/book/world actions and ordinary UI answers.',
    initialSources: await sources(), scenarios: [], captures: [], exceptions: [], pass: false };
const browser = await chromium.launch(); let activePage;
const book = page => page.locator('section[aria-label="しまの あそびかた"]');
const read = (page, id) => page.evaluate(async id => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    assertPreview(growingDb.name); function assertPreview(name) { if (name !== 'SansuGrowingIslandPreviewV1') throw Error('Preview only'); }
    return growingDb.islands.get(id);
}, id);
const islandReady = async page => {
    await page.locator('[data-growing-island="ready"] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
async function house(page) {
    await page.locator('.island-shell-nav').getByRole('button', { name: 'いえ', exact: true }).tap();
    await page.locator('[data-keepsake-section="home"]').waitFor(); await page.locator('.island-stage canvas').waitFor();
    await page.waitForTimeout(500);
}
async function open(page) {
    await page.locator('[data-house-menu-trigger]').tap();
    const entry = page.locator('[data-keepsake-action="growing-guide"]');
    await entry.scrollIntoViewIfNeeded();
    const size = await entry.boundingBox(); assert(size.width >= 44 && size.height >= 44);
    await entry.tap(); await book(page).waitFor(); await page.waitForTimeout(100);
}
async function capture(page, name) {
    const file = `${page.viewportSize().width}-${name}.png`; await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), bookCandidate: await book(page).count() ? await book(page).getAttribute('data-visual-candidate') : null });
}
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(30000);
        page.on('pageerror', e => report.exceptions.push(e.message));
        await page.goto(`${base}/#/island`); const id = await seedDev(page, { familiar: false });
        await page.reload(); await islandReady(page); await house(page);
        const learningBefore = await readNative(page, id), growingBefore = await read(page, id);
        const direct = page.locator('[data-house-guide-book]');
        const hit = await direct.boundingBox(); assert(hit.width >= 44 && hit.height >= 44);
        await capture(page, 'house-direct-book'); await direct.tap(); await book(page).waitFor();
        await page.keyboard.press('Escape'); await book(page).waitFor({ state: 'hidden' });
        await page.locator('[data-house-menu-trigger]').tap(); await capture(page, 'house-menu');
        await page.locator('[data-keepsake-action="growing-guide"]').tap(); await book(page).waitFor(); await capture(page, 'house-book');
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        await page.keyboard.press('Escape'); await book(page).waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        assert.deepEqual(await readNative(page, id), learningBefore); assert.deepEqual(await read(page, id), growingBefore);
        await open(page); await page.reload(); await page.locator('[data-keepsake-section="home"]').waitFor();
        assert.equal(await book(page).count(), 0, 'Reload keeps house and does not auto-open the book');
        await direct.tap(); await book(page).waitFor();
        await book(page).locator('summary').tap(); await book(page).locator('[data-guidance-goal="A6"]').tap();
        await book(page).getByRole('button', { name: 'あとで やることにする', exact: true }).tap();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        assert.equal((await read(page, id)).state.guidance.selected, 'A6');
        assert.equal(await book(page).getByRole('button', { name: 'しまで やってみる', exact: true }).isDisabled(), true);
        assert.match(await book(page).locator('.growing-guide-detail').innerText(), /しずく 12こ。いまは 0こ/);
        await capture(page, 'house-later-goal');
        // A second real tab changes its own flag; the already open house book follows the saved record.
        const other = await context.newPage();
        await other.goto(`${base}/#/island`); await islandReady(other);
        await other.locator('.growing-menu-button').tap();
        await other.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
        await book(other).locator('summary').tap(); await book(other).locator('[data-guidance-goal="A3"]').first().tap();
        await book(other).getByRole('button', { name: 'これを やってみる', exact: true }).tap();
        await other.locator('.growing-sheet[aria-label="しまの はた"]').waitFor();
        await other.getByRole('button', { name: 'いろ 3', exact: true }).tap();
        await book(page).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await book(page).locator('[data-guidance-memory="A3"]').waitFor();
        assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
        await capture(page, 'house-live-memory');
        await other.close();
        await book(page).getByRole('button', { name: 'とじる', exact: true }).tap();
        // Restore only this disposable profile to the before-flag state for the ordinary A3 journey below.
        await page.evaluate(async ({ id, saved }) => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('Preview only');
            const current = await growingDb.islands.get(id);
            await growingDb.islands.put({ ...saved, revision: current.revision + 1 });
        }, { id, saved: growingBefore });
        await open(page); await book(page).locator('summary').tap(); await book(page).locator('[data-guidance-goal="A3"]').first().tap();
        await book(page).getByRole('button', { name: 'これを やってみる', exact: true }).tap();
        await page.locator('.growing-sheet[aria-label="しまの はた"]').waitFor(); await capture(page, 'house-goal-in-island');
        assert.equal((await read(page, id)).state.guidance.selected, 'A3');
        await page.getByRole('button', { name: 'いろ 2', exact: true }).tap();
        await page.locator('.growing-sheet').getByRole('button', { name: 'とじる', exact: true }).tap();
        await house(page); await open(page); await book(page).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await book(page).locator('[data-guidance-memory="A3"]').waitFor(); await capture(page, 'house-memory');
        await book(page).getByRole('button', { name: 'この場所へ', exact: true }).tap();
        await page.locator('.growing-sheet[aria-label="しまの はた"]').waitFor();
        await page.locator('.growing-sheet').getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        let native = await readNative(page, id); const first = native.plan.id; let answers = 0;
        while (native.plan.id === first && answers < 12) { native = (await answerUI(page, native.plan, { touch: true })).state; answers++; }
        assert.equal(answers, 3); const next = { id: native.plan.id, cursor: native.plan.cursor };
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await islandReady(page);
        await house(page); await open(page); await capture(page, 'house-after-learning');
        await book(page).getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id); assert.equal(native.plan.id, next.id); assert.equal(native.plan.cursor, next.cursor);
        assert.deepEqual(report.exceptions, []); report.scenarios.push({ viewport, answers, pass: true }); await context.close();
    }
    report.finalSources = await sources(); assert.deepEqual(report.finalSources, report.initialSources); report.pass = true;
} catch (e) {
    report.error = String(e.stack || e); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
    console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios, exceptions: report.exceptions, error: report.error }));
}
