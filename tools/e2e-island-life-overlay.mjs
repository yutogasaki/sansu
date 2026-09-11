import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const base = process.env.SANSU_ISLAND_PRODUCTION_URL, out = process.env.SANSU_ISLAND_OUTPUT;
assert(base && out, 'Specify a production URL and fresh output directory');
await mkdir(out, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_LIFE_ENABLED=true; production', humanN: 0, scenarios: [], pass: false };
const browser = await (process.env.SANSU_OVERLAY_BROWSER === 'webkit' ? webkit : chromium).launch();
try {
 for (const [name, viewport] of [['small', { width: 320, height: 568 }], ['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
    if (process.env.SANSU_OVERLAY_WIDTH && viewport.width !== Number(process.env.SANSU_OVERLAY_WIDTH)) continue;
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(base);
      await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
      await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
      await page.getByRole('button', { name: 'さんすう', exact: true }).click();
      await page.getByRole('button', { name: '足し算まで', exact: true }).click();
      await page.locator('.island-learning[data-input-ready="true"]').waitFor();
      await page.getByRole('button', { name: 'とじる', exact: true }).click();
      await page.locator('.life-world[data-rendered="true"]').waitFor();
      assert.equal(await page.locator('.life-dev').count(), 0);
      assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '0');
      assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), '0');
      const databaseNames = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
      assert(databaseNames.includes('SansuIslandLifeV1')); assert(!databaseNames.includes('SansuIslandLifePreviewV1'));
      await page.screenshot({ path: `${out}/${name}-initial.png` });
      const world = page.locator('.life-world'), beforeWorld = await world.boundingBox(), camera = await world.getAttribute('data-life-camera');
      const tap = async (label) => {
        const button = page.getByRole('button', { name: label, exact: true });
        const b = await button.boundingBox(); assert(b && b.y >= 0 && b.y + b.height <= viewport.height);
        const hit = await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
        assert(hit, label + ' must be reachable without scrolling');
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      };
      for (const label of ['つくる', 'もちもの', 'いろ', 'ひろげる']) {
        await tap(label);
        assert.deepEqual(await world.boundingBox(), beforeWorld);
        assert.equal(await world.getAttribute('data-life-camera'), camera);
        await page.screenshot({ path: `${out}/${name}-${label}.png` });
        if (label === 'つくる') { await tap('つぎの ページ'); await page.screenshot({path:`${out}/${name}-catalog-2.png`}); }
        await tap('メニューを とじる');
      }
      assert.equal(await page.locator('.island-page').evaluate(el=>el.scrollTop),0);
      await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
      let native = await readNative(page), answers = 0; const start = native.island.completedSets;
      while (native.island.completedSets === start && answers++ < 20) native = (await attempt(page, native)).after;
      assert(answers < 20);
      await page.getByRole('button', { name: 'とじる', exact: true }).click();
      await page.waitForFunction(() => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) >= 6);
      const earned = Number(await page.locator('[data-life-drops]').getAttribute('data-life-drops'));
      await page.getByRole('button', { name: 'つくる', exact: true }).click();
      await page.locator('[data-life-buy="flower"]').click();
      await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
      await page.getByRole('button', { name: 'つぎの マス' }).click();
      await page.getByRole('button', { name: 'つぎの マス' }).click();
      await page.locator('[data-life-cell="0,2"]').click();
      await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
      await page.locator('.life-placement').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), String(earned - 2));
      await tap('もちもの');
      await page.locator('[data-life-item]').first().click();
      await page.screenshot({path:`${out}/${name}-item.png`});
      await tap('とりのぞく');
      await page.screenshot({path:`${out}/${name}-remove.png`});
      await tap('やめる');
      await tap('うごかす');
      assert.deepEqual(await world.boundingBox(), beforeWorld);
      assert.equal(await world.getAttribute('data-life-camera'), camera);
      await page.screenshot({path:`${out}/${name}-placement.png`});
      await tap('やめる');
      await tap('つくる'); await tap('メニューを とじる');
      assert.equal(await page.getByRole('button', { name: 'まなぶ', exact: true }).count(), 1);
      if (process.env.SANSU_OVERLAY_UI_ONLY === '1' || name === 'small' || process.env.SANSU_OVERLAY_BROWSER === 'webkit') {
        report.scenarios.push({ name, pass: true, scope: 'touch menu, fixed world/camera, real learning/purchase, placement and removal cancellation; offline not measured in this browser run' });
        continue;
      }
      const before = await readNative(page);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
      assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '1');
      assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), String(earned - 2));
      const after = await readNative(page);
      for (const key of ['logs', 'memoryMath', 'memoryVocab', 'islandPlans']) assert.deepEqual(after[key], before[key]);
      assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Real SW control');
      await context.setOffline(true);
      await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
      await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
      await page.locator('.island-learning[data-input-ready="true"]').waitFor();
      const offlineBefore = await readNative(page);
      await attempt(page, offlineBefore);
      await page.getByRole('button', { name: 'とじる', exact: true }).click();
      await page.locator('.life-world[data-rendered="true"]').waitFor();
      const offlineAfter = await readNative(page);
      assert(offlineAfter.islandEvents.length > offlineBefore.islandEvents.length);
      await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
      assert.deepEqual((await readNative(page)).islandPlans, offlineAfter.islandPlans);
      assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '1');
      assert.equal(await page.locator('.life-dev').count(), 0);
      await page.screenshot({ path: `${out}/${name}-offline.png` });
      assert.deepEqual(errors, []);
      report.scenarios.push({ name, pass: true, answers, earned, savedItems: 1, offlineAnswerAndReload: true });
    } catch (e) { await page.screenshot({ path: `${out}/${name}-failure.png` }); throw e; }
    finally { await context.close(); }
 }
 report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
