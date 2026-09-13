import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const base = process.env.SANSU_RESOURCES_URL, out = process.env.SANSU_RESOURCES_OUTPUT;
assert(base && out, 'Specify the target and fresh output directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, version: await fetch(new URL('/version.json', base)).then(r => r.json()).catch(() => null), humanN: 0,
    evidence: 'Real onboarding and first learning segment; five-digit glyphs are a DOM-only layout diagnostic', scenarios: [] };
try {
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 768, 1024], ['small', 320, 568], ['landscape', 844, 390]]) {
        if (process.env.SANSU_RESOURCES_WIDTH && width !== Number(process.env.SANSU_RESOURCES_WIDTH)) continue;
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const shot = label => page.screenshot({ path: `${out}/${name}-${label}.png` });
        const world = page.locator('.life-world'), wallet = page.locator('.life-wallet');
        const ready = () => page.locator('.life-world[data-rendered="true"]').waitFor();
        const button = name => page.getByRole('button', { name, exact: true });
        const hit = async locator => {
            assert(await locator.evaluate(el => { const b = el.getBoundingClientRect(); return b.width >= 44 && b.height >= 44 && b.top >= 0 && b.bottom <= innerHeight && el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }), 'Control must be a visible, reachable 44px target');
        };
        const separation = async panel => {
            const w = await wallet.boundingBox(), p = await panel.boundingBox();
            assert(w && p && p.y >= w.y + w.height + 2, `Panel must remain below the balance: ${JSON.stringify({ wallet: w, panel: p })}`);
        };
        try {
            await page.goto(base);
            for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await button(name).first().click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            await button('とじる').click(); await ready();
            const candidate = await page.locator('[data-life-candidate]').getAttribute('data-life-candidate');
            const hudCandidate = await page.locator('[data-life-hud]').getAttribute('data-life-hud');
            const bounds = await world.boundingBox();
            assert.equal(await wallet.locator('[data-life-resource]').count(), 2);
            assert.equal(await wallet.locator('strong').allTextContents().then(v => v.join(',')), '0,0');
            await shot('quiet');
            await button('しまの ようす').click();
            await separation(page.locator('.life-dock'));
            await page.locator('.life-island-notes > summary').click();
            assert.equal(await page.locator('.life-growth-day b').innerText().then(t => t.replace(/\s/g, '')), '0/6');
            assert.equal(await page.locator('.life-growth-steps [data-filled="true"]').count(), 0);
            await page.locator('.life-island-notes > summary').click();
            for (const name of ['うさぎ', 'カワウソ', 'ぽこもこ']) {
                await page.locator('.life-resident-choices').getByRole('button', { name, exact: true }).click();
                assert.equal(await page.locator('#life-resident-story').getAttribute('aria-label'), `${name}の ようす`);
                if (name === 'うさぎ') await shot('rabbit-selected');
            }
            const informationBounds = await page.locator('.life-dock').boundingBox();
            if (height >= 568) assert(informationBounds.height <= 360, 'Default information must leave the island visible');
            const storyBounds = await page.locator('.life-resident-story').boundingBox();
            assert(storyBounds.y >= informationBounds.y && storyBounds.y + storyBounds.height <= informationBounds.y + informationBounds.height, 'The selected activity must be visible without scrolling');
            await hit(button('しまの ようすを とじる')); await shot('information');
            assert.equal(await page.locator('.life-resident-portrait img:not([hidden])').count(), 3);
            assert.equal(await page.locator('.life-island-notes').getAttribute('open'), null);
            await page.locator('.life-island-notes > summary').click();
            await page.locator('.life-resource-guide').scrollIntoViewIfNeeded(); await shot('resource-guide');
            await hit(button('しまの ようすを とじる')); await button('しまの ようすを とじる').click();
            assert.deepEqual(await world.boundingBox(), bounds, 'Information must not resize the world');
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            let native = await readNative(page), answers = 0; const start = native.island.completedSets;
            while (native.island.completedSets === start && answers++ < 20) native = (await attempt(page, native)).after;
            assert(answers < 20); await button('とじる').click(); await ready();
            const earned = page.locator('[data-life-earned]'); await earned.waitFor();
            assert.equal(await earned.getAttribute('data-life-earned'), '6');
            const wb = await wallet.boundingBox(), eb = await earned.boundingBox();
            assert(eb.y >= wb.y + wb.height + 4, 'Reward notice must sit below the balance');
            await shot('earned'); await button('つくる').click();
            assert.equal(await page.locator('.life-earned').count(), 0);
            await separation(page.locator('.life-menu')); await shot('build');
            for (const tab of ['もちもの', 'いろ', 'ひろげる']) {
                await page.locator('.life-menu-tabs').getByRole('button', { name: tab, exact: true }).click();
                await separation(page.locator('.life-menu')); await hit(button('メニューを とじる'));
            }
            await shot('land'); await button('メニューを とじる').click();
            await button('しまの ようす').click();
            await page.locator('.life-island-notes > summary').click();
            assert.equal(await page.locator('.life-growth-steps [data-filled="true"]').count(), 3);
            await shot('growth'); await button('しまの ようすを とじる').click();
            const beforeLayout = await readNative(page);
            await wallet.locator('strong').evaluateAll(elements => elements.forEach(el => { el.textContent = '99999'; }));
            const fits = await wallet.locator('strong').evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth));
            assert(fits, 'Five-digit typography must not truncate'); await shot('five-digits-layout-only');
            assert.deepEqual(await readNative(page), beforeLayout);
            await page.reload(); await ready();
            assert.equal(await wallet.locator('[data-life-resource="drops"] strong').innerText(), '6');
            assert.equal(await page.locator('[data-life-earned]').count(), 0, 'Reload must not repeat the reward');
            await shot('reloaded'); assert.deepEqual(await readNative(page), beforeLayout);
            assert.equal(errors.length, 0, errors.join('\n'));
            report.scenarios.push({ name, width, height, candidate, hudCandidate, informationBounds, answers, pass: true }); console.log(`${name} PASS`);
        } catch (error) {
            await shot('failure'); report.scenarios.push({ name, pass: false, error: String(error), body: await page.locator('body').innerText(), errors }); throw error;
        } finally { await context.close(); }
    }
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
