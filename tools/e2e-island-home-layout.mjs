import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { button, readNative, seedNative, waitMode, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5219';
const out = process.env.SANSU_HOME_LAYOUT_OUTPUT || 'output/playwright/island-home-layout';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, layout: 'world-first-v2', fixture: 'Native profile only; learning and destinations opened through UI.', scenarios: [], pass: false };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1024, height: 640 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: true });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const scenario = { viewport, captures: [], checks: [], errors, pass: false };
        report.scenarios.push(scenario);
        const capture = async name => {
            const file = `${viewport.width}-${viewport.height}-${name}.png`;
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            scenario.captures.push({ file, ...(await runtimeMetadata(page)) });
        };
        try {
            await page.goto(base);
            await page.locator('.island-welcome').waitFor();
            const id = await seedNative(page, randomUUID());
            await page.reload(); await waitReady(page); await waitMode(page, 'home');
            const nav = page.locator('.island-shell-nav');
            const dock = page.locator('.island-home-actions');
            scenario.layout = await page.evaluate(() => {
                const rect = selector => {
                    const r = document.querySelector(selector).getBoundingClientRect();
                    return { width: r.width, height: r.height, top: r.top, bottom: r.bottom };
                };
                return { stage: rect('.island-stage__viewport'), nav: rect('.island-shell-nav'), dock: rect('.island-home-actions'),
                    tabTargets: [...document.querySelectorAll('.island-shell-tab')].map(e => ({ width: e.clientWidth, height: e.offsetHeight })),
                    documentWidth: document.documentElement.scrollWidth };
            });
            assert(scenario.layout.nav.height <= 64, 'Compact navigation retains more room for the world');
            assert(scenario.layout.stage.height >= viewport.height * .65, 'World remains the main display, including a short phone');
            assert(scenario.layout.dock.bottom <= scenario.layout.nav.top + 1, 'Navigation cannot cover the action dock');
            assert(scenario.layout.tabTargets.every(r => r.width >= 44 && r.height >= 44), 'Tabs preserve 44px touch targets');
            assert.equal(scenario.layout.documentWidth, viewport.width, 'Page does not overflow horizontally');
            assert.equal((await readNative(page, id)).plan, undefined, 'Home does not start questions');
            await capture('home');
            const menu = page.getByRole('dialog', { name: 'しまのメニュー' });
            const openMenu = () => button(page, 'しまのメニュー').click();
            const closeMenu = () => button(page, 'しまのメニューを とじる').click();
            await openMenu();
            await button(page, 'しまぜんぶ').click(); await closeMenu();
            await page.locator('.island-view-tools > summary').click();
            await button(page, 'もとの ながめ').click(); await capture('overview');
            await openMenu(); await button(page, 'にわ').click(); await closeMenu();
            await button(page, 'しまを おおきく').click();
            assert.equal(await button(page, 'しまを ちいさく').isEnabled(), true);
            await button(page, 'もとの ながめ').click();
            assert.equal(await button(page, 'しまを ちいさく').isDisabled(), true);
            scenario.checks.push('compact layout, no overlap, full overview and zoom/reset');

            await page.locator('.island-view-tools > summary').click();
            await openMenu(); await capture('menu');
            const actions = menu.locator('[data-home-action]');
            const actionIds = await actions.evaluateAll(elements => elements.map(element => element.dataset.homeAction));
            assert(actionIds.includes('inventory') && actionIds.includes('album') && actionIds.includes('other-games'));
            await actions.first().focus();
            for (let index = 0; index < actionIds.length; index++) {
                assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-home-action')), actionIds[index]);
                if (index + 1 < actionIds.length) await page.keyboard.press('Tab');
            }
            await page.keyboard.press('Escape');
            await menu.waitFor({ state: 'hidden' });
            assert.equal(await button(page, 'しまのメニュー').evaluate(e => e === document.activeElement), true, 'Escape restores the menu trigger focus');
            await openMenu();
            await button(page, 'アルバム').click(); await waitMode(page, 'album');
            assert.equal(await page.locator('dialog[open]').count(), 0);
            await button(page, 'アルバムを とじる').click(); await waitMode(page, 'home');
            scenario.checks.push('all menu entries, keyboard order, Escape focus restore and destination close');
            await nav.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await waitMode(page, 'learning'); await waitReady(page);
            assert.equal(await nav.count(), 0, 'Learning closes the tabs');
            const reservation = (await readNative(page, id)).plan;
            assert(reservation, 'Only explicit learning reserves the questions');
            await capture('learning');
            await button(page, 'とじる').click(); await waitMode(page, 'home');
            await page.waitForTimeout(100);
            assert.equal(await page.locator('dialog[open]').count(), 0, 'Learning returns with the menu closed');
            assert.deepEqual((await readNative(page, id)).plan, reservation, 'Close leaves the learning reservation intact');
            await capture('returned');
            scenario.checks.push('album and learning return correctly; learning hides tabs and reserves only on demand');

            await openMenu(); await dock.getByRole('button', { name: 'いえ', exact: true }).click();
            await waitMode(page, 'keepsakes');
            await button(page, 'いえを とじる').click(); await waitMode(page, 'home');
            await openMenu(); await dock.getByRole('button', { name: 'もちもの', exact: true }).click();
            await waitMode(page, 'inventory');
            await button(page, 'もちものから もどる').click(); await waitMode(page, 'home');
            await button(page, 'せってい').click(); await capture('settings');
            await nav.getByRole('button', { name: 'しま', exact: true }).click(); await waitMode(page, 'home');
            await openMenu(); await page.goBack();
            await page.waitForURL('**/#/settings');
            assert.equal(await page.locator('dialog[open]').count(), 0, 'History closes the retained island modal');
            await nav.getByRole('button', { name: 'きろく', exact: true }).click();
            await nav.getByRole('button', { name: 'きろく', exact: true }).click(); await capture('records');
            await nav.getByRole('button', { name: 'しま', exact: true }).click(); await waitMode(page, 'home');
            await openMenu(); await dock.getByRole('button', { name: 'ほかの あそび', exact: true }).click();
            await page.waitForURL('**/#/battle');
            scenario.checks.push('house, inventory, settings, records and other games remain reachable');
            assert.deepEqual(errors, []);
            scenario.pass = true;
        } finally { await context.close(); }
    }
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
}
