import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { appRootMetadata, assertKeypad, openGrowingMenu, readNative, seedDev } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_DIRECT_NAV_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_DIRECT_NAV_OUTPUT;
assert(out && new URL(base).hostname === '127.0.0.1', 'Fresh local output and DEV URL required');
await fs.mkdir(out, { recursive: false });
const sources = async () => Object.fromEntries(await Promise.all(execFileSync('rg', ['--files', 'src'], { encoding: 'utf8' }).trim().split('\n').sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const report = { at: new Date().toISOString(), target: base, scope: 'DEV diagnostic profiles with one explicit resident; menu destinations, five tabs and the same untouched learning reservation. No real acquisition, PWA or participant claim.', initialSources: await sources(), cases: [], captures: [], pass: false };
const browser = await chromium.launch();
let page;
const ready = async () => { await page.locator('[data-growing-island="ready"]').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
const capture = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const file = `${page.viewportSize().width}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    const identity = await appRootMetadata(page);
    assert.equal(identity.islandFeatureEnabled, true);
    report.captures.push({ file, identity, viewport: page.viewportSize(), cache: 'DEV modules; no production SW claim' });
};
try {
    for (const viewport of (process.env.SANSU_DIRECT_NAV_VIEWPORTS || '390x844,568x320').split(',').map(value => { const [width, height] = value.split('x').map(Number); return { width, height }; })) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width >= 568 ? 'reduce' : 'no-preference' });
        page = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/island`); const id = await seedDev(page, { name: 'つむぎ', familiar: false });
        await page.reload(); await ready();
        await page.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV only');
            const record = await growingDb.islands.get(id), state = record.state;
            state.tutorial = 'done'; state.guidance.starter.automatic = false; state.islandName = 'つむぎの ふしぎな しま';
            state.villagers = [{ id: 'qa-menu-friend', species: 'rabbit', name: 'ミミ', home: 'pokomoko', arrivedAt: 0, trait: 'mellow', variant: { color: 0, accessory: 0, sparkle: false } }];
            state.arrivals = [];
            await growingDb.islands.put({ ...record, state, revision: record.revision + 1 });
        }, id);
        await page.reload(); await ready(); await capture('home');
        const initial = await readNative(page, id);
        let menu = await openGrowingMenu(page, { touch: true });
        await menu.locator('.growing-pocket-friend-model img').waitFor(); await capture('populated-menu');
        for (const [name, selector, close] of [['なかま', '.growing-friends', 'とじる'], ['海図と ふね', '.voyage-chart', '海図を とじる'], ['はたを つくる', '.growing-trace', 'とじる'], ['しゃしん・みせる', 'section[aria-label="しゃしん・みせる"]', 'とじる'], ['はなずかん', 'section[aria-label="はなずかん"]', 'とじる']]) {
            menu = await openGrowingMenu(page, { touch: true });
            await menu.getByRole('button', { name, exact: true }).tap();
            const panel = page.locator(selector); await panel.waitFor();
            await panel.getByRole('button', { name: close, exact: true }).tap();
            await page.waitForFunction(() => document.activeElement?.matches('.growing-menu-button'));
        }
        const nav = page.getByRole('navigation', { name: 'メインメニュー', exact: true });
        assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'しま');
        for (const name of ['いえ', 'きろく', '設定', 'しま']) {
            await nav.getByRole('button', { name, exact: true }).tap();
            await nav.getByRole('button', { name, exact: true }).and(nav.locator('[aria-current="page"]')).waitFor();
            assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
            if (name === 'いえ') { await page.locator('[data-house-candidate]').waitFor(); await capture('house'); }
            if (name === 'しま') await ready();
        }
        assert.deepEqual((await readNative(page, id)).plan, initial.plan, 'Browsing does not reserve questions');
        await nav.getByRole('button', { name: /^まなぶ/ }).tap();
        await page.locator('[data-input-ready="true"]').waitFor(); await assertKeypad(page); await capture('learning');
        const reservation = (await readNative(page, id)).plan;
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready();
        await nav.getByRole('button', { name: /^まなぶ/ }).tap(); await page.locator('[data-input-ready="true"]').waitFor();
        assert.deepEqual((await readNative(page, id)).plan, reservation, 'The same unanswered reservation resumes');
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready();
        const final = await readNative(page, id);
        for (const store of ['logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) assert.deepEqual(final[store], initial[store]);
        assert.deepEqual(errors, []);
        report.cases.push({ viewport, realResidentMiniature: true, secondaryDestinations: 5, singleActiveTab: true, sameReservation: true, fullKeypad: true, sound: 'off' });
        await context.close();
    }
    report.finalSources = await sources(); assert.deepEqual(report.finalSources, report.initialSources); report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (page && !page.isClosed()) { report.body = await page.locator('body').innerText(); await page.screenshot({ path: `${out}/failure.png` }); }
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`PASS direct menu/navigation ${report.cases.length} viewports`);
