import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { ISLAND_CANDIDATE, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_CUSTOMIZATION_OUTPUT;
assert(target && manifestPath && out, 'Set frozen production URL, source manifest, and a fresh customization output directory');
const sha = value => createHash('sha256').update(value).digest('hex');
const source = JSON.parse(await fs.readFile(manifestPath));
const qa = ['tools/e2e-island-customization.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...new Set([...source.files.map(file => file.path), ...qa])].sort()
    .map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const startedFiles = await fingerprint();
assert.deepEqual(source.files.filter(file => startedFiles.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const version = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).json();
assert.equal(version.revision, source.revision);
assert(version.island.enabled); assert.equal(version.island.candidate, ISLAND_CANDIDATE);
const report = { target, version, sourceHash: source.sourceHash, startedAt: new Date().toISOString(),
    sourceStart: sha(JSON.stringify(startedFiles)), captures: [], scenarios: [], humanN: 0, pass: false,
    scope: 'Two viewport real onboarding and normal-planner answers earn stars, preview/cancel, choose a target, exchange/apply and restore. A separately named historical-credit fixture checks legacy migration/all-owned/cross-theme state, without calling fixture progress earned or human learning evidence.' };
const browser = await chromium.launch();
const stage = page => page.locator('[data-testid="island-stage"]').first();
const gallery = page => page.getByTestId('island-customization');
const item = (page, id) => page.locator(`[data-customization-id="${id}"]`);
const tapOrClick = (page, locator) => page.viewportSize().width === 390 ? locator.tap() : locator.click();
async function capture(page, name) {
    await page.waitForTimeout(250);
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, version.revision); assert.equal(metadata.version, version.version);
    const cosmetics = await stage(page).evaluate(element => ({ theme: element.dataset.islandTheme, accent: element.dataset.islandAccent,
        cosmeticsCandidate: element.dataset.customizationCandidate, geometries: Number(element.dataset.geometries), textures: Number(element.dataset.textures) }));
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, ...cosmetics });
}
async function waitCosmetics(page, theme, accent = 'none') {
    await page.waitForFunction(({ theme, accent }) => {
        const root = document.querySelector('[data-testid="island-stage"]');
        return root?.getAttribute('data-island-theme') === theme && root.getAttribute('data-island-accent') === accent;
    }, { theme, accent });
}
async function home(page) {
    const close = gallery(page).getByRole('button', { name: 'きせかえを とじる', exact: true });
    await tapOrClick(page, await close.count() ? close : button(page, 'しまへ')); await waitMode(page, 'home');
}
async function openGallery(page) {
    await tapOrClick(page, button(page, 'きせかえ'));
    await waitMode(page, 'customization'); await gallery(page).waitFor();
}
async function choose(page, id) {
    await tapOrClick(page, item(page, id));
    await page.waitForTimeout(80);
    const fixed = await stage(page).evaluate(element => ({ x: element.getBoundingClientRect().x,
        scrollX, parentScroll: document.querySelector('.island-page').scrollLeft }));
    assert(fixed.x >= -.5 && fixed.scrollX === 0 && fixed.parentScroll === 0, `Selector must scroll its rail without shifting the island: ${JSON.stringify(fixed)}`);
}
async function purchase(page) {
    await tapOrClick(page, gallery(page).getByRole('button', { name: /こうかんして つかう/ }));
    await gallery(page).getByRole('button', { name: /こうかんして つかう/ }).waitFor({ state: 'hidden' });
}
async function equip(page) {
    await tapOrClick(page, gallery(page).getByRole('button', { name: 'これを つかう', exact: true }));
}
async function learn(page) {
    await tapOrClick(page, page.getByRole('button', { name: /^(つづきから とく|まなぶ)$/ }));
    await waitMode(page, 'learning');
}
async function finishSection(page, state) {
    const plan = state.plan, previous = state.island.completedSets;
    const points = state.island.customization?.points ?? previous * 10;
    for (let steps = 0; state.plan?.id === plan.id; steps++) {
        assert(steps < 80, 'Normal reserved section must finish');
        state = (await attempt(page, state)).after;
    }
    assert.equal(state.island.completedSets, previous + 1);
    assert.equal(state.island.customization.points, points + 10);
    assert.equal(state.island.pendingRewards.length, 0);
    assert.equal(state.plan.cursor, 0);
    await waitMode(page, 'learning');
    return state;
}
async function assertGalleryGeometry(page) {
    const geometry = await gallery(page).evaluate(root => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        controls: [...root.querySelectorAll('button')].map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
        }),
    }));
    assert.equal(geometry.overflow, false);
    geometry.controls.forEach(control => assert(control.width >= 44 && control.height >= 44, JSON.stringify(control)));
    return geometry;
}
async function failNextPurchase(page) {
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, ...args) {
            if (this.name === 'islands' && value.customization?.ownedItemIds.includes('starry')) {
                IDBObjectStore.prototype.put = original;
                this.transaction.abort();
            }
            return original.call(this, value, ...args);
        };
    });
}
async function historicalFixture(layout, earned) {
    const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const name = `${layout.name}-historical-credit-fixture`;
    try {
        await page.goto(`${target}/#/island`); await waitReady(page);
        const id = await seedNative(page, `cosmetics-legacy-${layout.name}`);
        const fixture = structuredClone(earned);
        fixture.profileId = id; fixture.completedSets = 18;
        delete fixture.customization; delete fixture.pendingPlanId;
        await page.evaluate(async fixture => {
            const req = indexedDB.open('SansuDatabase');
            const database = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
            const tx = database.transaction('islands', 'readwrite'); tx.objectStore('islands').put(fixture);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); database.close();
        }, fixture);
        await page.goto(`${target}/#/island`); await waitReady(page); await waitMode(page, 'home');
        await openGallery(page);
        for (const id of ['starry', 'candy', 'crystal', 'star-lanterns', 'candy-flags', 'crystal-charms']) {
            await choose(page, id); await purchase(page);
        }
        let state = await readNative(page, id);
        assert.equal(state.island.customization.points, 0);
        assert.equal(new Set(state.island.customization.ownedItemIds).size, 7);
        await capture(page, `${name}-all-owned`);
        await home(page); await page.reload(); await waitReady(page); await waitMode(page, 'home');
        assert.equal((await readNative(page, id)).island.customization.points, 0, 'Legacy credit cannot reappear after spending/reload');
        await waitCosmetics(page, 'crystal', 'crystal-charms');
        await openGallery(page); await choose(page, 'candy'); await equip(page);
        await choose(page, 'star-lanterns'); await equip(page);
        await home(page); await waitCosmetics(page, 'candy', 'star-lanterns');
        await capture(page, `${name}-mixed-set`);
        await learn(page); state = await finishSection(page, await readNative(page, id));
        assert.equal(state.island.customization.points, 10, 'All-owned child can continue learning and keep earned stars');
        await capture(page, `${name}-learning`);
        report.scenarios.push({ name, synthetic: true, completedSetsFixture: 18, allOwned: true, noRecredit: true, continued: true, pass: true });
    } catch (error) { await capture(page, `${name}-failure`).catch(() => {}); throw error; }
    finally { await context.close(); }
}

try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone',
            serviceWorkers: 'allow', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let earned;
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            await capture(page, `${layout.name}-01-welcome`);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitReady(page); await waitMode(page, 'learning');
            let state = await readNative(page);
            const id = state.island.profileId;
            await capture(page, `${layout.name}-02-learning`);
            state = await finishSection(page, state);
            assert.equal(state.island.customization.points, 10);
            await home(page); await capture(page, `${layout.name}-03-first-stars`);
            await openGallery(page);
            const previewBefore = await readNative(page, id);
            await stage(page).locator('canvas').evaluate(canvas => { canvas.dataset.previewIdentity = 'same-scene'; });
            const sceneResources = [];
            for (const [index, theme] of ['starry', 'candy', 'crystal', 'moon-garden', 'starry', 'candy', 'crystal', 'moon-garden'].entries()) {
                await choose(page, theme); await waitCosmetics(page, theme);
                assert.equal(await stage(page).locator('canvas').getAttribute('data-preview-identity'), 'same-scene');
                await stage(page).scrollIntoViewIfNeeded();
                await capture(page, `${layout.name}-preview-${index}-${theme}`);
                if (theme === 'moon-garden') sceneResources.push(await stage(page).evaluate(el => ({ g: +el.dataset.geometries, t: +el.dataset.textures })));
            }
            assert.deepEqual(sceneResources[0], sceneResources[1], 'Repeated theme preview returns to stable renderer resources');
            assert.deepEqual(await readNative(page, id), previewBefore, 'Preview never writes currency, ownership, learning or discovery');
            await home(page); await waitCosmetics(page, 'moon-garden');
            assert.deepEqual((await readNative(page, id)).island.customization, previewBefore.island.customization);
            await openGallery(page); await choose(page, 'crystal');
            await tapOrClick(page, gallery(page).getByRole('button', { name: 'これが ほしい', exact: true }));
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, 'crystal');
            await tapOrClick(page, gallery(page).getByRole('button', { name: 'ほしいを やめる', exact: true }));
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, null);
            await choose(page, 'starry'); await tapOrClick(page, gallery(page).getByRole('button', { name: 'これが ほしい', exact: true }));
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, 'starry');
            const controls = await assertGalleryGeometry(page);
            await choose(page, 'star-lanterns'); await purchase(page);
            assert.equal((await readNative(page, id)).island.customization.points, 0);
            await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            await capture(page, `${layout.name}-04-first-accent`);
            await tapOrClick(page, gallery(page).locator('[data-customization-action="clear-accent"]'));
            await waitCosmetics(page, 'moon-garden');
            assert((await readNative(page, id)).island.customization.ownedItemIds.includes('star-lanterns'));
            await choose(page, 'star-lanterns'); await equip(page);
            await home(page); await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            await capture(page, `${layout.name}-05-wanted-goal`);
            await learn(page);
            state = await readNative(page, id);
            for (let i = 0; i < 3; i++) state = await finishSection(page, state);
            assert.equal(state.island.customization.points, 30);
            await home(page); await openGallery(page); await choose(page, 'starry');
            const beforeFailed = await readNative(page, id);
            await failNextPurchase(page);
            await gallery(page).getByRole('button', { name: /こうかんして つかう/ }).click();
            await page.locator('.island-error').waitFor();
            assert.deepEqual(await readNative(page, id), beforeFailed, 'Native transaction abort rolls back the complete exchange');
            await capture(page, `${layout.name}-06-save-retry`);
            await purchase(page);
            state = await readNative(page, id);
            assert.equal(state.island.customization.points, 0);
            assert.equal(state.island.customization.themeId, 'starry');
            assert.equal(state.island.customization.desiredItemId, null);
            await waitCosmetics(page, 'starry', 'star-lanterns');
            await capture(page, `${layout.name}-07-theme-earned`);
            await home(page); await capture(page, `${layout.name}-08-live-island`);
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.reload(); await waitReady(page);
            assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Use the real installed service worker');
            await context.setOffline(true); await page.reload(); await waitReady(page);
            // Stored learning reservations resume automatically on new document.
            if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
            await waitCosmetics(page, 'starry', 'star-lanterns');
            await openGallery(page); await choose(page, 'moon-garden'); await equip(page); await home(page);
            await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            assert.equal((await readNative(page, id)).island.customization.points, 0);
            await openGallery(page); await choose(page, 'starry'); await equip(page); await home(page);
            await learn(page);
            state = await readNative(page, id);
            while (state.island.completedSets < 6) state = await finishSection(page, state);
            earned = state.island;
            const latest = earned.growth.memories.at(-1);
            assert.equal(latest.cosmetics.themeId, 'starry'); assert.equal(latest.cosmetics.accentId, 'star-lanterns');
            await home(page); await button(page, 'アルバム').click(); await waitMode(page, 'album');
            assert.equal(await page.locator('[data-memory-current] [data-testid="island-stage"]').getAttribute('data-island-theme'), 'starry');
            await capture(page, `${layout.name}-09-album`);
            assert.deepEqual(errors, []);
            report.scenarios.push({ name: `${layout.name}-earned-flow`, synthetic: false, completedSets: earned.completedSets,
                starsEarned: 60, starsSpent: 40, controls, stableResources: sceneResources, realOfflineReloadAndEquip: true, errors, pass: true });
        } catch (error) { await capture(page, `${layout.name}-failure`).catch(() => {}); throw error; }
        finally { await context.close(); }
        await historicalFixture(layout, earned);
    }
    report.pass = true;
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
    await browser.close();
    const endedFiles = await fingerprint();
    report.sourceEnd = sha(JSON.stringify(endedFiles));
    report.sourceUnchanged = report.sourceStart === report.sourceEnd;
    report.pass &&= report.sourceUnchanged;
    if (!report.pass) process.exitCode = 1;
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.length, captures: report.captures.length, error: report.error?.message, out }));
}
