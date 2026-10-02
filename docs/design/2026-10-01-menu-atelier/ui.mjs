import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedDev, appRootMetadata, runtimeMetadata, readNative, waitMode } from '../../../tools/island-e2e-helpers.mjs';

const out = process.env.SANSU_MENU_OUTPUT || 'output/playwright/menu-atelier';
await fs.mkdir(out, { recursive: true });
const inputs = ['src/components/Layout.tsx', 'src/components/ui/MenuAtelier.css', 'src/components/island/IslandHomeActions.tsx', 'src/components/island/growing/GrowingIsland.tsx'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = { started: new Date().toISOString(), source: await hashes(), fixture: 'Disposable DEV profile with optional derived isWeak flags initialized to false; Growing preview fixture with two residents, 200 drops, stored bench, and unlocked seed catalogs. The existing guide action intentionally chooses the A3 goal to open its real flag detail sheet. These are display fixtures, not acquired progress or child observation.', cases: [] };
const browser = await chromium.launch({ channel: process.env.SANSU_MENU_BROWSER || 'chrome', args: ['--use-angle=metal'] });
try {
    const targets = [process.env.SANSU_MENU_URL || 'http://127.0.0.1:5260', process.env.SANSU_MENU_STANDARD_URL || 'http://127.0.0.1:5198'];
    for (const target of targets) {
        for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
            const growing = target === targets[0];
            if (!growing && ![390, 768].includes(viewport.width)) continue;
            const tag = `${growing ? 'growing' : 'standard'}-${viewport.width}`;
            if (process.env.SANSU_MENU_CASE && process.env.SANSU_MENU_CASE !== tag) continue;
            const row = { tag, target, viewport, captures: [], errors: [], geometry: [], pass: false }; report.cases.push(row);
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 390 ? 'no-preference' : 'reduce' });
            const page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', e => row.errors.push(e.message));
            const shot = async name => {
                await page.waitForTimeout(800);
                const root = await appRootMetadata(page);
                assert.equal(root.islandFeatureEnabled, true); assert.equal(root.natureTownFeatureEnabled, false); assert.equal(root.configuredDelivery, 'snap-root-v1'); assert(root.revision && root.version);
                // Utility keeps a hidden Island page mounted for safe return. Its stale
                // identity belongs to that cached page, not to the current utility route.
                const onIsland = new URL(page.url()).hash.startsWith('#/island');
                const island = onIsland ? await runtimeMetadata(page) : { url: page.url(), candidate: 'not-applicable: shared utility route' };
                if (island.revision) { assert.equal(root.revision, island.revision); assert.equal(root.version, island.version); }
                const menuStyleCandidate = await page.locator('.island-shell').getAttribute('data-menu-style-candidate');
                assert.equal(menuStyleCandidate, 'shared-paper-atelier-v1');
                const file = `${tag}-${name}.png`; await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
                const candidate = page.locator('[data-menu-candidate]').first();
                const world = page.locator('[data-growing-world]');
                const worldIdentity = await world.count() ? await world.evaluate(e => ({ ...e.dataset })) : null;
                if (growing && island.mode === 'home') { assert.equal(worldIdentity?.growingFeatureEnabled, 'true'); assert.equal(worldIdentity?.visualCandidate, 'growing-island-v1'); }
                row.captures.push({ file, ...island, appRoot: root, menuStyleCandidate, worldIdentity, menuCandidate: await candidate.count() ? await candidate.getAttribute('data-menu-candidate') : null });
                console.log('CAPTURE', tag, name);
            };
            const geometry = async (locator, name) => {
                const value = await locator.evaluate(root => ({ width: root.getBoundingClientRect().width, scrollWidth: root.scrollWidth, buttons: [...root.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0).map(b => ({ text: b.innerText, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }));
                row.geometry.push({ name, ...value }); assert(value.scrollWidth <= value.width + 1, `${name} horizontal overflow`);
                assert(value.buttons.every(b => b.width >= 43.9 && b.height >= 43.9), `${name} 44px target: ${JSON.stringify(value.buttons.filter(b => b.width < 43.9 || b.height < 43.9))}`);
            };
            const menu = page.locator(growing ? '.growing-menu' : '.island-menu[open]');
            const open = async () => { await page.locator(growing ? '.growing-menu-button' : '.island-menu-trigger').tap(); await menu.waitFor(); };
            const closeTray = async () => { await page.locator('.growing-tray .growing-close').tap(); await page.locator('.growing-tray').waitFor({ state: 'hidden' }); };
            try {
                await page.goto(`${target}/#/island`); const id = await seedDev(page, { name: 'Yu', familiar: true }); row.profileId = id;
                // Stats normally initializes this optional derived flag on its first read.
                // Explicitly initialize the disposable display fixture; do not confuse that
                // existing migration with a progress change caused by the menu styles.
                await page.evaluate(async id => {
                    const { db } = await import('/src/db/index.ts');
                    await db.memoryMath.where('profileId').equals(id).modify({ isWeak: false });
                    await db.memoryVocab.where('profileId').equals(id).modify({ isWeak: false });
                }, id);
                if (growing) await page.evaluate(async id => {
                    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
                    const { newIsland } = await import('/src/domain/growingIsland/island.ts');
                    const { refreshUnlocks } = await import('/src/domain/growingIsland/community.ts');
                    if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('Fixture only supports the isolated DEV preview database');
                    const now = Date.now(), state = newIsland(id, now); state.tutorial = 'done'; state.guidance.starter.automatic = false;
                    state.drops = 200; state.genki.best = 3;
                    state.landmarks.push({ id: 'qa-stored-bench', kind: 'bench', growth: 0 });
                    state.villagers = ['rabbit', 'otter'].map((species, i) => ({ id: `qa-friend-${i}`, species, home: 'pokomoko', trait: 'mellow', arrivedAt: i, variant: { color: 0, accessory: 0, sparkle: false } }));
                    refreshUnlocks(state);
                    await growingDb.islands.put({ profileId: id, version: 3, revision: 1, createdAt: now, updatedAt: now, state });
                }, id);
                await page.goto(`${target}/#/island`); await waitMode(page, 'home');
                if (growing) { await page.locator('[data-growing-island=ready] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); }
                const before = await readNative(page, id);
                await shot('island');
                await open(); await shot('menu'); await geometry(menu, 'menu');
                if (growing) {
                    const close = menu.getByRole('button', { name: 'メニューを とじる', exact: true });
                    await close.focus(); await page.keyboard.press('Enter'); await menu.waitFor({ state: 'hidden' });
                    assert(await page.locator('.growing-menu-button').evaluate(e => document.activeElement === e));
                    await page.locator('.growing-seed-button').tap();
                    const tray = page.locator('.growing-tray'); await shot('seeds'); await geometry(tray, 'seeds');
                    const prices = await tray.locator('[data-growing-seed]').evaluateAll(buttons => buttons.map(b => ({ kind: b.dataset.growingSeed, label: b.querySelector('.growing-price')?.getAttribute('aria-label') ?? b.querySelector('.growing-price')?.textContent })));
                    row.prices = prices;
                    const seedPrices = await page.evaluate(async () => (await import('/src/domain/growingIsland/rules.ts')).SEED_PRICE);
                    assert(prices.every(p => p.label === (seedPrices[p.kind] === 0 ? 'むりょう' : `しずく ${seedPrices[p.kind]}`)), 'Catalog prices must match current domain prices');
                    await tray.getByRole('tab', { name: 'めじるし', exact: true }).tap(); await shot('landmarks'); await geometry(tray, 'landmarks');
                    await tray.locator('.growing-card').last().scrollIntoViewIfNeeded(); assert(await tray.locator('.growing-close').isVisible());
                    await tray.getByRole('tab', { name: 'しまってある', exact: true }).tap(); await shot('stored'); await geometry(tray, 'stored');
                    await closeTray();
                    for (const [label, name] of [['なかま', 'friends'], ['みせる', 'show'], ['はなずかん', 'flowers'], ['もちもの', 'inventory']]) {
                        await open(); await menu.getByRole('button', { name: label, exact: true }).tap(); await tray.waitFor(); await shot(name); await geometry(tray, name);
                        if (name === 'friends') assert.equal(await tray.locator('li').count(), 2);
                        await closeTray();
                    }
                    await open(); await menu.getByRole('button', { name: 'なぞる', exact: true }).tap();
                    const trace = page.getByRole('dialog', { name: 'なぞって かざる', exact: true });
                    await trace.waitFor(); await shot('trace'); await geometry(trace, 'trace');
                    await trace.getByRole('button', { name: 'とじる', exact: true }).tap();
                    // Use the existing guide's real destination action to inspect the flag
                    // detail sheet. Choosing a goal is intentional guidance state, not a
                    // claim that menu browsing leaves all game preference fields untouched.
                    await open(); await menu.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
                    const book = page.locator('section[aria-label="しまの あそびかた"]');
                    let color = book.locator('.growing-guide-candidates [data-guidance-goal=A3]');
                    if (!await color.count()) { await book.locator('summary').tap(); color = book.locator('.growing-guide-all [data-guidance-goal=A3]'); }
                    await color.tap(); await book.getByRole('button', { name: 'これを やってみる', exact: true }).tap();
                    const detail = page.locator('.growing-sheet[aria-label="しまの はた"]');
                    await detail.waitFor(); await shot('detail'); await geometry(detail, 'detail');
                    await detail.getByRole('button', { name: 'とじる', exact: true }).tap();
                    await open(); await menu.getByRole('button', { name: 'せってい', exact: true }).tap();
                } else {
                    await menu.locator('[data-home-group=arrange] summary').tap(); await shot('arrange'); await geometry(menu, 'arrange');
                    await page.keyboard.press('Escape'); await menu.waitFor({ state: 'hidden' }); assert(await page.locator('.island-menu-trigger').evaluate(e => document.activeElement === e));
                    await page.locator('.island-shell-nav').getByRole('button', { name: '設定', exact: true }).tap();
                }
                await page.locator('.settings-category-list').waitFor(); await shot('settings'); await geometry(page.locator('.settings-category-list'), 'settings');
                for (const section of ['profile', 'learning', 'display', 'parent']) {
                    await page.locator(`[data-setting-section=${section}]`).tap(); await page.locator(`#settings-panel-${section}`).waitFor(); await shot(`settings-${section}`);
                    await page.locator('.island-shell-back').tap(); await page.locator('.settings-category-list').waitFor();
                }
                const nav = page.locator('.island-shell-nav'); await geometry(nav, 'navigation');
                await nav.getByRole('button', { name: 'きろく', exact: true }).tap(); await shot('records');
                await nav.getByRole('button', { name: 'いえ', exact: true }).tap(); await waitMode(page, 'keepsakes'); await shot('house');
                assert.deepEqual(await readNative(page, id), before, 'Menu browsing must preserve canonical learning, Island and Explore records');
                if (growing) {
                    row.remainingDrops = await page.evaluate(async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id)).state.drops, id);
                    assert.equal(row.remainingDrops, 200, 'Opening menus and choosing a guide goal must not spend drops');
                }
                await nav.locator('.island-shell-tab--learn').tap(); await waitMode(page, 'learning'); await page.locator('[data-input-ready=true]').waitFor();
                for (const digit of '0123456789') assert(await page.getByRole('button', { name: digit, exact: true }).isVisible());
                await shot('learning'); assert.equal(row.errors.length, 0, row.errors.join('\n')); row.pass = true; console.log('PASS', tag);
            } catch (error) { row.error = error.stack; await page.screenshot({ path: `${out}/${tag}-failure.png` }).catch(() => {}); console.error('FAIL', tag, error.message); }
            await context.close();
        }
    }
} finally {
    await browser.close(); report.sourceEnd = await hashes(); report.stable = JSON.stringify(report.source) === JSON.stringify(report.sourceEnd);
    report.pass = report.stable && report.cases.every(c => c.pass); report.finished = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
if (!report.pass) process.exitCode = 1;
