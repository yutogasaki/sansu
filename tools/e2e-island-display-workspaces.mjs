import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { ISLAND_CANDIDATE, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL?.replace(/\/$/, '');
const out = process.env.SANSU_DISPLAY_WORKSPACE_OUTPUT;
assert(base && out, 'Set SANSU_ISLAND_BASE_URL and a fresh SANSU_DISPLAY_WORKSPACE_OUTPUT');
const sha = value => createHash('sha256').update(value).digest('hex');
const version = await (await fetch(`${base}/version.json`, { cache: 'no-store' })).json();
assert.equal(version.island.enabled, true); assert.equal(version.island.candidate, ISLAND_CANDIDATE);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const qaFiles = ['tools/e2e-island-display-workspaces.mjs', 'tools/island-e2e-helpers.mjs'];
const fingerprint = () => Promise.all(qaFiles.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const qa = await fingerprint();
const report = { target: base, version, qa, startedAt: new Date().toISOString(), pass: false, humanN: 0, scenarios: [],
    scope: 'Native profile fixture only. One real unanswered reservation is opened before the baseline. All subsequent operations are viewing, local placement preview/cancel, category selection or return. No answers, purchases, equipment changes, profile edits or reset actions. This verifies layout and preservation, not earned growth, offline recovery or independent child comprehension.' };

function protectedState(state) {
    const island = state.island;
    return { plans: state.islandPlans, logs: state.logs, memoryMath: state.memoryMath, memoryVocab: state.memoryVocab,
        exploreRuns: state.exploreRuns, island: { profileId: island.profileId, completedSets: island.completedSets,
            pendingPlanId: island.pendingPlanId, pendingRewards: island.pendingRewards, items: island.items,
            customization: island.customization, experience: island.experience, expression: island.expression,
            sharedMemories: island.sharedMemories, learningKeepsakes: island.learningKeepsakes,
            growth: island.growth && { ...island.growth, discoveries: undefined } } };
}
async function readProfile(page, id) {
    return page.evaluate(async id => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const read = db.transaction('profiles').objectStore('profiles').get(id);
        const value = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
        db.close(); return value;
    }, id);
}
async function rect(locator) {
    const box = await locator.boundingBox(); assert(box, 'Expected a rendered layout rectangle');
    return { ...box, right: box.x + box.width, bottom: box.y + box.height };
}
async function visibleControl(page, locator, label) {
    await locator.waitFor({ state: 'visible' });
    const box = await rect(locator), viewport = page.viewportSize();
    assert(box.width >= 44 && box.height >= 44, `${label}: target remains at least 44px: ${JSON.stringify(box)}`);
    assert(box.x >= -1 && box.y >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
        `${label}: entire control is in the viewport: ${JSON.stringify(box)}`);
    assert(await locator.evaluate(element => {
        const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === element || element.contains(hit);
    }), `${label}: visible control is not covered`);
    return box;
}
async function waitUnblocked(page) {
    await page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
}
async function openMenuEntry(page, action, mode) {
    await waitMode(page, 'home'); await waitUnblocked(page);
    await button(page, 'しまのメニュー').click();
    await page.locator(`dialog[open] [data-home-action="${action}"]`).click();
    await waitMode(page, mode);
    assert.equal(await page.locator('dialog.island-menu[open]').count(), 0, 'Choosing a destination closes the menu');
}
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
try {
    for (const viewport of [{ width: 360, height: 640 }, { width: 1024, height: 640 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 700, serviceWorkers: 'allow' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { viewport, profileId: randomUUID(), captures: [], checks: [], geometry: {}, errors: [], pass: false };
        report.scenarios.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        const capture = async (name, evidence = {}) => {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const metadata = await runtimeMetadata(page);
            assert.equal(metadata.revision, version.revision); assert.equal(metadata.version, version.version);
            assert.equal(metadata.candidate, ISLAND_CANDIDATE);
            const surface = await page.evaluate(() => ({ route: location.hash,
                visibleSurface: document.querySelector('.utility-layout-screen') ? 'utility' : 'island',
                islandVisible: Boolean(document.querySelector('.island-page')?.checkVisibility()),
                documentWidth: document.documentElement.scrollWidth }));
            assert(surface.documentWidth <= viewport.width + 1, 'The page has no horizontal overflow');
            const file = `${viewport.width}-${viewport.height}-${name}.png`, bytes = await page.screenshot({ animations: 'disabled' });
            await fs.writeFile(`${out}/${file}`, bytes, { flag: 'wx' });
            row.captures.push({ file, sha256: sha(bytes), ...metadata, ...surface, ...evidence });
        };
        try {
            await page.goto(base); await page.locator('.island-welcome').waitFor();
            await seedNative(page, row.profileId); await page.reload(); await waitReady(page); await waitMode(page, 'home');
            await page.locator('.island-shell-nav .island-start').click(); await waitReady(page); await waitMode(page, 'learning');
            await button(page, 'とじる').click(); await waitMode(page, 'home'); await waitUnblocked(page);
            const baseline = await readNative(page, row.profileId), profile = await readProfile(page, row.profileId);
            assert(baseline.plan && baseline.plan.cursor === 0 && baseline.plan.revision === 0);
            assert.equal(baseline.logs.length, 0); assert.equal(baseline.island.completedSets, 0);
            const protectedBaseline = protectedState(baseline);
            row.baselineSHA256 = sha(JSON.stringify(protectedBaseline));
            const assertPreserved = async label => {
                const state = await readNative(page, row.profileId);
                assert.deepEqual(protectedState(state), protectedBaseline, `${label}: reservations, learning and owned island state remain unchanged`);
                assert.deepEqual(await readProfile(page, row.profileId), profile, `${label}: viewing does not edit the profile`);
                row.checks.push(label); return state;
            };
            await capture('01-home');

            await openMenuEntry(page, 'inventory', 'inventory');
            assert.equal(await page.locator('.island-page[data-mode="inventory"] > .island-stage').count(), 0, 'Inventory does not repeat the world above the choices');
            const inventory = page.locator('.island-inventory-panel'), cards = inventory.locator('.island-inventory > button');
            assert.equal(await cards.count(), baseline.island.items.length);
            row.geometry.inventoryReturn = await visibleControl(page, button(page, 'もちものから もどる'), 'Inventory return');
            row.geometry.inventoryCards = await Promise.all([rect(cards.nth(0)), rect(cards.nth(1))]);
            const [first, second] = row.geometry.inventoryCards;
            assert(Math.abs(first.y - second.y) < 2 && second.x >= first.right, 'Inventory choices share a readable first row');
            assert(first.y < viewport.height / 2 && first.bottom <= viewport.height, 'Possessions are visible in the first screen');
            const returnLabel = await button(page, 'もちものから もどる').locator('span').evaluate(element => {
                const style = getComputedStyle(element);
                return { height: element.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 };
            });
            assert(returnLabel.height <= returnLabel.lineHeight + 1, 'Return label remains on one horizontal line');
            await capture('02-inventory');
            await cards.first().click(); await waitMode(page, 'placement'); await waitReady(page);
            assert.equal(await page.locator('.island-shell-nav').count(), 0, 'Placement closes the global navigation');
            const close = button(page, 'いどうを とじる'), save = button(page, 'ここに おく');
            row.geometry.placementClose = await visibleControl(page, close, 'Placement cancel');
            row.geometry.placementSave = await visibleControl(page, save, 'Placement save');
            row.geometry.placementStage = await rect(page.locator('.island-page > .island-stage'));
            row.geometry.placementPanel = await rect(page.locator('.island-page > .island-placement'));
            assert(row.geometry.placementClose.bottom <= row.geometry.placementStage.y + 1 && row.geometry.placementSave.bottom <= row.geometry.placementStage.y + 1,
                'Cancel and commit are above the scene');
            if (viewport.width >= 800) assert(row.geometry.placementStage.right <= row.geometry.placementPanel.x + 1, 'Wide editor places tools beside the scene');
            else assert(row.geometry.placementPanel.y >= row.geometry.placementStage.bottom - 1, 'Phone editor places tools below the scene');
            await capture('03-placement');
            await button(page, 'みぎへ').click(); await close.click(); await waitMode(page, 'inventory');
            await assertPreserved('Placement movement and cancellation preserve ownership and the reservation');
            await button(page, 'くらしの どうぐを みる').click(); await waitMode(page, 'furniture'); await waitReady(page);
            await capture('04-furniture-view-only');
            await button(page, 'どうぐから もどる').click(); await waitMode(page, 'inventory');
            await button(page, 'もちものから もどる').click(); await waitMode(page, 'home');

            await openMenuEntry(page, 'album', 'album');
            await page.locator('[data-memory-id] [data-renderer="three"]').waitFor();
            await page.locator('[data-memory-current] [data-renderer="three"]').waitFor();
            const category = page.getByRole('combobox', { name: 'アルバムの なかみ', exact: true });
            assert.equal(await category.inputValue(), 'memories');
            assert.equal(await page.locator('.island-album-compare [data-read-only="true"]').count(), 2);
            row.geometry.albumComparison = await rect(page.locator('.island-album-compare'));
            row.geometry.albumSelection = await rect(page.locator('.island-album-selection'));
            assert(row.geometry.albumComparison.bottom <= row.geometry.albumSelection.y + 1, 'Past and current scenes precede location and time controls');
            assert.equal(await page.getByRole('combobox', { name: 'みくらべる ばしょ', exact: true }).inputValue(), 'garden');
            await capture('05-album');
            await category.selectOption('discoveries'); await page.locator('.island-album-empty').waitFor();
            assert.equal(await page.locator('.island-album-compare').count(), 0);
            await category.selectOption('memories'); await page.locator('[data-memory-current] [data-renderer="three"]').waitFor();
            await button(page, 'アルバムから もどる').click(); await waitMode(page, 'home');
            await assertPreserved('Album category changes preserve immutable history and current ownership');

            await openMenuEntry(page, 'customization', 'customization'); await waitReady(page); await capture('06-customization-view-only');
            if (viewport.width >= 900) {
                const panel = page.locator('.island-page > .island-customization');
                await panel.evaluate(element => { element.scrollTop = 140; });
                const scrollTop = await panel.evaluate(element => element.scrollTop);
                assert(scrollTop > 0, 'The wide tools panel owns scrolling');
                await page.locator('.island-shell-tab--learn').click(); await waitMode(page, 'learning'); await waitReady(page);
                await button(page, 'とじる').click(); await waitMode(page, 'customization');
                await page.waitForFunction(expected => document.querySelector('.island-page > .island-customization')?.scrollTop === expected, scrollTop);
                row.checks.push('Closing learning restores the wide editor scroll position');
            }
            await button(page, 'きせかえから もどる').click(); await waitMode(page, 'home');
            await openMenuEntry(page, 'experience', 'experience'); await waitReady(page); await capture('07-experience-view-only');
            await page.locator('[data-experience-action="expression"]').click(); await waitMode(page, 'expression'); await waitReady(page); await capture('08-expression-view-only');
            await button(page, 'みじたくから もどる').click(); await waitMode(page, 'experience');
            await button(page, 'なまえ・けしきから もどる').click(); await waitMode(page, 'home');
            await openMenuEntry(page, 'guide', 'guide'); await waitReady(page); await capture('09-guide-view-only');
            await button(page, 'みつけものから もどる').click(); await waitMode(page, 'home');
            await button(page, '育てる ばしょを えらぶ').click(); await waitMode(page, 'growth'); await waitReady(page); await capture('10-growth-view-only');
            await button(page, 'ばしょえらびから もどる').click(); await waitMode(page, 'home');
            await assertPreserved('Optional world panels remain view-only');

            await button(page, 'せってい').click(); await page.waitForURL(url => url.hash === '#/settings');
            await page.locator('[data-setting-section="profile"]').waitFor();
            assert.equal(await page.locator('.settings-category-list [data-setting-section]').count(), 4);
            assert.equal(await page.locator('.settings-reset-action').count(), 0, 'Settings root does not show data reset');
            await capture('11-settings');
            row.geometry.settings = [];
            for (const key of ['profile', 'learning', 'display', 'parent']) {
                await page.locator(`[data-setting-section="${key}"]`).click();
                await page.waitForURL(url => url.hash === `#/settings?section=${key}`);
                const panel = page.locator('.settings-panels > .card-surface:not([hidden])');
                await panel.waitFor(); await panel.scrollIntoViewIfNeeded();
                assert.equal(await panel.count(), 1, 'One settings category owns the visible detail');
                const boxes = { section: key, panel: await rect(panel) };
                if (viewport.width >= 760) {
                    boxes.categories = await rect(page.locator('.settings-category-list'));
                    assert(boxes.categories.right <= boxes.panel.x + 1, 'Wide settings places categories to the left of their detail');
                } else assert.equal(await page.locator('.settings-category-list').isVisible(), false, 'Phone details use the reading width');
                assert.equal(await page.locator('.settings-reset-action').count(), key === 'parent' ? 1 : 0, 'Reset is only present inside parent data management');
                row.geometry.settings.push(boxes);
                await visibleControl(page, button(page, 'もどる'), 'Settings return');
                await capture(`12-settings-${key}`);
                await button(page, 'もどる').click(); await page.waitForURL(url => url.hash === '#/settings');
                await page.locator('.settings-category-list').waitFor();
            }
            await assertPreserved('All four settings categories return without changing forms or entering reset');
            await button(page, 'もどる').click(); await waitMode(page, 'home');
            await page.locator('.island-shell-nav').getByRole('button', { name: 'きろく', exact: true }).click();
            await page.waitForURL(url => url.hash === '#/stats'); await page.locator('.stats-first-record').waitFor();
            assert.equal(await page.locator('.stats-metric').count(), 0, 'Empty records use one explanatory entry');
            const toggle = page.locator('[aria-controls="stats-learning-details"]');
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await capture('13-records-empty');
            await toggle.click(); await page.locator('#stats-learning-details').waitFor();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            assert.equal(await page.locator('#stats-learning-details > .card-surface').count(), 6, 'Details actually reveal the six existing record groups');
            assert.match(await page.locator('#stats-learning-details').textContent(), /グラフ/);
            assert.match(await page.locator('#stats-learning-details').textContent(), /テスト/);
            await page.locator('#stats-learning-details > .card-surface').first().scrollIntoViewIfNeeded();
            await capture('14-records-details');
            await toggle.click(); await page.locator('#stats-learning-details').waitFor({ state: 'detached' });
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await capture('15-records-closed');
            await page.locator('.island-shell-nav').getByRole('button', { name: 'しま', exact: true }).click(); await waitMode(page, 'home'); await waitReady(page);
            const finalState = await assertPreserved('Empty record detail open/close preserves all learning data');
            row.finalSHA256 = sha(JSON.stringify(protectedState(finalState)));
            row.observedDiscoveryEvents = finalState.islandEvents.filter(event => event.type === 'discovery_observed').length;
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS display workspaces ${viewport.width}x${viewport.height}: ${row.captures.length} captures, state preserved`);
        } catch (error) {
            row.failure = { message: error.message, stack: error.stack };
            await capture('failure').catch(async captureError => {
                row.captureError = captureError.message;
                await page.screenshot({ path: `${out}/${viewport.width}-${viewport.height}-failure-raw.png` }).catch(() => undefined);
            });
            throw error;
        } finally { await context.close(); }
    }
    assert.deepEqual(await fingerprint(), qa, 'QA inputs stay unchanged during verification');
    report.pass = true;
} catch (error) { report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
    await browser.close(); report.browserClosed = true; report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(JSON.stringify({ pass: report.pass, report: `${out}/report.json` }));
