import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedDev, openGrowingMenu, runtimeMetadata, waitForAsync } from './island-e2e-helpers.mjs';
import { productionCellPoint, disposeProductionProjection } from './growing-production-helpers.mjs';
import { confirmStoredPlacement } from './e2e-growing-places.mjs';

const base = process.env.SANSU_MENU_URL || 'http://127.0.0.1:5198';
assert(new URL(base).hostname === '127.0.0.1', 'Local DEV fixtures only');
const out = process.env.SANSU_MENU_OUTPUT;
assert(out, 'Specify a fresh SANSU_MENU_OUTPUT directory');
await fs.mkdir(out, { recursive: false });
const sources = async () => {
    const paths = execFileSync('rg', ['--files', 'src'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('tools/e2e-growing-places.mjs', 'tools/e2e-island-menu.mjs', 'tools/island-e2e-helpers.mjs', 'tools/growing-production-helpers.mjs', 'vite.config.ts', 'package.json', 'package-lock.json');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
};
const report = { at: new Date().toISOString(), target: base, candidate: 'island-direct-play-v2', initialSources: await sources(),
    scope: 'DEV disposable profiles: free first-home UI then explicitly unlocked/owned diagnostic fixture. No production data or child-comprehension claim.', captures: [], cases: [], pass: false };
const browser = await chromium.launch();
let activePage;
const ready = async page => {
    await page.locator('[data-growing-island="ready"]').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
const read = (page, id) => page.evaluate(async id => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    assertDev(growingDb.name);
    function assertDev(name) { if (name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV DB only'); }
    return growingDb.islands.get(id);
}, id);
async function capture(page, label) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const file = `${page.viewportSize().width}x${page.viewportSize().height}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), cacheState: 'DEV modules, no production SW claim' });
}
async function audit(page, scope) {
    const result = await scope.evaluate(element => {
        const area = element.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, area: { x: area.x, y: area.y, width: area.width, height: area.height, bottom: area.bottom }, navTop: document.querySelector('.island-shell-nav').getBoundingClientRect().top,
            small: [...element.querySelectorAll('button,summary')].filter(node => node.getClientRects().length).map(node => ({ text: node.textContent.trim(), height: node.getBoundingClientRect().height })).filter(item => item.height < 43.5) };
    });
    assert.equal(result.overflow, false); assert.deepEqual(result.small, []);
    assert(result.area.y >= 0 && result.area.x >= 0);
    assert(result.area.bottom <= result.navTop + 1, 'Panel must stay above the bottom navigation');
    return result;
}
try {
    for (const viewport of (process.env.SANSU_MENU_VIEWPORTS || '320x568,390x844,768x1024,568x320').split(',').map(value => { const [width, height] = value.split('x').map(Number); return { width, height }; })) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        console.log(`[menu] ${viewport.width}x${viewport.height}`);
        await page.goto(`${base}/#/island`); const id = await seedDev(page, { familiar: false, name: 'メニュー確認' });
        await page.reload(); await ready(page);
        await page.getByRole('button', { name: 'しまに おく', exact: true }).tap();
        const tray = page.getByRole('region', { name: 'しまに おく', exact: true });
        assert.equal(await tray.locator('[data-growing-seed]').count(), 1);
        await tray.getByText('むりょう', { exact: true }).waitFor();
        await capture(page, 'first-free-home'); await audit(page, tray);
        await tray.getByRole('tab', { name: 'あたらしく おく', exact: true }).press('Escape');
        await page.waitForFunction(selector => document.activeElement?.matches(selector), '.growing-home-place');
        assert.equal(await page.locator('.growing-home-place').evaluate(node => node === document.activeElement), true);
        // Explicit diagnostic ownership/unlocks, not claimed as learning-earned rewards.
        await page.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV DB only');
            const { SEED_PRICE, LANDMARK_PRICE } = await import('/src/domain/growingIsland/index.ts');
            const record = await growingDb.islands.get(id), state = record.state;
            state.tutorial = 'done'; state.guidance.starter.automatic = false; state.drops = 300; state.wonderSeeds = 2;
            state.unlocked = [...Object.keys(SEED_PRICE).map(kind => `seed:${kind}`), ...Object.keys(LANDMARK_PRICE).map(kind => `landmark:${kind}`)];
            state.keepsakes = Array.from({ length: 13 }, (_, i) => ({ id: `qa-keepsake-${i}`, unitId: `${i < 7 ? 'math' : 'vocab'}:${i < 7 ? i + 1 : i - 6}` }));
            state.landmarks.push({ id: 'qa-owned-bench', kind: 'bench', growth: 0 });
            await growingDb.islands.put({ ...record, state, revision: record.revision + 1 });
        }, id);
        await page.reload(); await ready(page);
        await page.locator('.growing-place-current').getByText('そだつ場所', { exact: true }).waitFor();
        await capture(page, 'home');
        let menu = await openGrowingMenu(page, { touch: true });
        assert.equal(await menu.getByRole('button', { name: /^(いえ|きろく|設定)$/ }).count(), 0);
        await capture(page, 'menu'); const menuLayout = await audit(page, menu);
        assert.equal(await menu.getByRole('button', { name: /^(しまに おく|もちもの|そだつ場所)$/ }).count(), 0);
        if (viewport.height > 500) assert(menuLayout.area.height <= (viewport.height - 60) * .6 + 1);
        await menu.getByRole('button', { name: 'メニューを とじる', exact: true }).tap();
        await page.getByRole('button', { name: 'そだつ場所', exact: true }).tap();
        await page.locator('.growing-place-book').waitFor(); await capture(page, 'places');
        await page.locator('.growing-place-book').getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.waitForFunction(selector => document.activeElement?.matches(selector), '.growing-home-goal');
        assert.equal(await page.locator('.growing-home-goal').evaluate(node => node === document.activeElement), true);
        await page.getByRole('button', { name: 'しまに おく', exact: true }).tap();
        assert.equal(await tray.locator('[data-growing-seed]').count(), 7);
        assert.equal(await tray.locator('[data-growing-landmark]').count(), 16);
        assert(await tray.locator('[data-growing-flower]').count() > 0);
        await capture(page, 'catalog-all'); await audit(page, tray);
        const lastItem = tray.locator('[data-growing-seed], [data-growing-flower], [data-growing-landmark]').last();
        await lastItem.scrollIntoViewIfNeeded();
        assert.equal(await lastItem.evaluate(node => { const r = node.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return node.contains(hit); }), true, 'Last item must be reachable above the navigation');
        await capture(page, 'catalog-last-item');
        await tray.getByRole('button', { name: 'はたけ・おみせ', exact: true }).tap();
        assert.equal(await tray.locator('[data-growing-seed="farm"]').count(), 1);
        assert.equal(await tray.locator('[data-growing-seed="home"]').count(), 0);
        await capture(page, 'farms-shops');
        await tray.getByRole('button', { name: 'あそぶ・やすむ', exact: true }).tap();
        await tray.locator('[data-growing-landmark="bench"]').waitFor();
        const ownedTab = tray.getByRole('tab', { name: /^もちもの/ });
        await ownedTab.tap(); assert.equal(await tray.locator('[data-growing-stored]').count(), 14);
        assert.equal(await tray.locator('.growing-price').count(), 0); await capture(page, 'owned');
        await ownedTab.press('ArrowLeft'); assert.equal(await tray.getByRole('tab', { name: 'あたらしく おく', exact: true }).getAttribute('aria-selected'), 'true');
        await tray.getByRole('tab', { name: 'あたらしく おく', exact: true }).press('End');
        assert.equal(await ownedTab.getAttribute('aria-selected'), 'true');
        const before = (await read(page, id)).state;
        await tray.locator('[data-growing-stored="qa-owned-bench"]').tap();
        const previousPoint = await productionCellPoint(page, before, { x: 4, z: 3 });
        const previousHit = await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.closest('button')?.textContent ?? 'world', previousPoint);
        const candidates = await page.evaluate(async state => {
            const { landCells } = await import('/src/domain/growingIsland/space.ts');
            const { canPlace } = await import('/src/domain/growingIsland/index.ts');
            return landCells(state).filter(cell => cell.x !== 0 && cell.z !== 0 && canPlace(state, cell));
        }, before);
        let target;
        for (const cell of candidates) {
            const point = await productionCellPoint(page, before, cell);
            const visible = await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest('[data-growing-world]')), point);
            if (visible) { target = { cell, point }; break; }
        }
        assert(target, 'Choose an unobscured valid world cell, not an overlaid control');
        await page.touchscreen.tap(target.point.x, target.point.y);
        const confirmation = await confirmStoredPlacement(page, () => read(page, id), 'qa-owned-bench', target.cell, 20000);
        const after = (await read(page, id)).state;
        assert.equal(after.drops, before.drops); assert.deepEqual(after.keepsakes, before.keepsakes);
        const placedCell = after.landmarks.find(item => item.id === 'qa-owned-bench').cell;
        assert(placedCell.x === target.cell.x && placedCell.z === target.cell.z, 'Saved cell matches the touched world cell, including equivalent signed zero');
        await page.getByRole('button', { name: 'ながめ', exact: true }).tap();
        const view = page.getByRole('region', { name: 'ながめ', exact: true });
        assert.equal(await view.getByRole('button', { name: /ひろげる/ }).count(), 0);
        await view.getByRole('button', { name: 'みぎに まわす', exact: true }).tap(); await capture(page, 'view-controls');
        await page.keyboard.press('Escape');
        await page.waitForFunction(selector => document.activeElement?.matches(selector), '.growing-home-view');
        assert.equal(await page.locator('.growing-home-view').evaluate(node => node === document.activeElement), true);
        const beforeExpand = (await read(page, id)).state;
        await page.getByRole('button', { name: 'しまを ひろげる', exact: true }).tap();
        const expansion = page.getByRole('region', { name: 'しまを ひろげる', exact: true });
        await audit(page, expansion); await capture(page, 'expand-choices');
        assert.equal((await read(page, id)).state.drops, beforeExpand.drops, 'Opening expansion never buys land');
        const buyLand = expansion.getByRole('button', { name: /^ひがしへ ひろげる/ });
        await buyLand.scrollIntoViewIfNeeded();
        assert.equal(await buyLand.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Expansion touch reaches its own button');
        await buyLand.tap();
        await waitForAsync(page, async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.drops === 180, id);
        await page.getByRole('button', { name: 'しまを ひろげる', exact: true }).tap();
        assert((await expansion.locator('.growing-expansion-choices button').count()) > 0);
        assert.equal(await expansion.locator('.growing-expansion-choices button:disabled').count(), await expansion.locator('.growing-expansion-choices button').count(), 'Next available directions remain locked at the true price');
        await capture(page, 'expand-shortfall'); await page.keyboard.press('Escape');
        assert.equal((await read(page, id)).state.drops, 180);
        await page.waitForFunction(selector => document.activeElement?.matches(selector), '.growing-home-expand');
        assert.equal(await page.locator('.growing-home-expand').evaluate(node => node === document.activeElement), true);
        menu = await openGrowingMenu(page, { touch: true });
        const other = menu.locator('.growing-pocket-other'); await other.locator('summary').scrollIntoViewIfNeeded(); await other.locator('summary').tap();
        await menu.getByRole('button', { name: 'しまの あそびかた', exact: true }).waitFor();
        await capture(page, 'utilities');
        await menu.getByRole('button', { name: 'メニューを とじる', exact: true }).tap();
        await page.reload(); await ready(page);
        const reloadedCell = (await read(page, id)).state.landmarks.find(item => item.id === 'qa-owned-bench')?.cell;
        assert(reloadedCell && reloadedCell.x === target.cell.x && reloadedCell.z === target.cell.z);
        assert.deepEqual(errors, []);
        report.cases.push({ viewport, menuLayout, directPlay: true, expansionPurchaseAndShortfall: true, independentView: true, focusReturn: true, firstHomeFree: true, allItems: true, categories: true, keepsakes: 13, freeReposition: true, reload: true, keyboardTabs: true, sound: 'off', previousPlacementPointHit: previousHit, placementCell: target.cell, confirmationTaps: confirmation.confirmationTaps, reducedMotion: viewport.width === 768 });
        await disposeProductionProjection(page); await context.close();
    }
    report.finalSources = await sources(); assert.deepEqual(report.finalSources, report.initialSources, 'Sources changed during evidence'); report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (activePage && !activePage.isClosed()) { report.body = await activePage.locator('body').innerText().catch(() => 'unavailable'); await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => undefined); }
    throw error;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>島メニュー確認</title><style>body{font:14px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{max-width:100%}</style><h1>島メニュー / island-direct-play-v2</h1><p>DEV diagnostic fixtures / ${report.at}</p><main>${report.captures.map(item => `<figure><img src="${item.file}"><figcaption>${item.file}</figcaption></figure>`).join('')}</main>`);
    await browser.close();
}
console.log(`PASS island menu/catalog ${report.cases.length} viewports`);
