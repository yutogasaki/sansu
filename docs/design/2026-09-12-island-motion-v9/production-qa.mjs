import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readNative } from '../../tools/island-e2e-helpers.mjs';
import { attempt } from '../../tools/island-learning-checks.mjs';
const base = process.env.SANSU_ISLAND_PRODUCTION_URL, out = process.env.SANSU_ISLAND_OUTPUT;
assert(base && out, 'Specify a production URL and fresh output directory');
await mkdir(out, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_LIFE_ENABLED=true; production', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
 for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
    const context = await browser.newContext({ recordVideo: { dir: out, size: viewport }, viewport, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const touch = await context.newCDPSession(page);
    const swipeCatalog = async (targetPage) => {
      const view = page.locator('[data-life-catalog-swipe]');
      const bounds = await view.boundingBox(); assert(bounds);
      const left = bounds.x + bounds.width * .16, right = bounds.x + bounds.width * .84;
      const from = targetPage === 2 ? right : left, to = targetPage === 2 ? left : right;
      const y = bounds.y + Math.min(80,bounds.height*.45);
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y}]});
      for(let step=1;step<=12;step++) {
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*step/12,y}]});
        await page.waitForTimeout(20);
      }
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(n => document.querySelector(`.life-catalog-dots button:nth-child(${n})`)?.getAttribute('aria-pressed') === 'true', targetPage);
      await page.waitForFunction(n => {const el=document.querySelector('[data-life-catalog-swipe]');return Math.abs(el.scrollLeft-(n-1)*el.clientWidth)<2;},targetPage);
      assert.equal(await page.locator('.life-placement').count(),0,'Swiping must not select or purchase a product');
    };

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
      assert.equal(await page.locator('[data-life-light]').getAttribute('data-life-light'), '0');
      assert.equal(await page.locator('.life-wallet span[title="みんなが たのしむと ふえるよ"]').count(), 1);
      const databaseNames = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
      assert(databaseNames.includes('SansuIslandLifeV1')); assert(!databaseNames.includes('SansuIslandLifePreviewV1'));
      await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
      const residentFavorites = { pokomoko: 'ベンチ', rabbit: 'おはな', otter: 'ブランコ' };
      for (const [id, label] of Object.entries(residentFavorites)) {
        const resident = page.locator(`[data-life-resident="${id}"]`);
        assert.equal(await resident.getAttribute('data-life-favorite'), label);
        assert.match(await resident.innerText(), new RegExp(`すき: ${label}`));
      }
      await page.getByRole('button', { name: 'しまの ようすを とじる', exact: true }).click();
      assert.equal(await page.locator('[data-life-candidate]').getAttribute('data-life-candidate'), 'island-life-moon-garden-v9');
      await page.getByRole('button', { name: 'つくる', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.life-product-preview img')].every(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: `${out}/${name}-catalog.png` });
      await swipeCatalog(2);
      await page.screenshot({ path: `${out}/${name}-catalog-swiped.png` });
      const firstDot=page.getByRole('button',{name:'1ページめ',exact:true});
      await firstDot.focus(); await firstDot.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.life-catalog-dots button')?.getAttribute('aria-pressed')==='true');
      await page.waitForFunction(()=>document.querySelector('[data-life-catalog-swipe]')?.scrollLeft<2);
      assert.equal(await page.locator('.life-placement').count(),0);

      await page.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
      const openLifePanel = async () => {
        const group = page.getByRole('group', { name: 'しまの ていれ' });
        if (!await group.isVisible().catch(() => false)) {
          await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
          await group.waitFor();
        }
        return group;
      };
      const selectTab = async label => { await (await openLifePanel()).getByRole('button', { name: label, exact: true }).click(); };
      await selectTab('つくる');
      assert.equal(await page.locator('[data-life-build-hint]').textContent(), 'まなぶと しずくが ふえるよ。');
      assert.equal(await page.locator('[data-life-buy="flower"]').isDisabled(), true);
      assert.match(await page.locator('[data-life-buy="flower"]').innerText(), /あと 2 しずく/);
      await page.screenshot({ path: `${out}/${name}-build-empty.png` });
      await selectTab('いろ');
      assert.match(await page.locator('[data-life-style="sunshine"]').innerText(), /ひかり 4/);
      await page.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
      await page.screenshot({ path: `${out}/${name}-initial.png` });
      await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
      let native = await readNative(page), answers = 0; const start = native.island.completedSets;
      while (native.island.completedSets === start && answers++ < 20) native = (await attempt(page, native)).after;
      assert(answers < 20);
      await page.getByRole('button', { name: 'とじる', exact: true }).click();
      await page.waitForFunction(() => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) >= 6);
      const earned = Number(await page.locator('[data-life-drops]').getAttribute('data-life-drops'));
      const earnedCue = page.locator('[data-life-earned]');
      await earnedCue.waitFor();
      assert.equal(await earnedCue.getAttribute('data-life-earned'), '6');
      const earnedCueBox = await earnedCue.boundingBox();
      assert(earnedCueBox && earnedCueBox.width > 0 && earnedCueBox.height > 0);
      const cueWorld = await page.locator('.life-world').boundingBox();
      await earnedCue.click();
      await page.locator('.life-menu').waitFor();
      assert.deepEqual(await page.locator('.life-world').boundingBox(), cueWorld);
      await page.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
      await selectTab('つくる');
      await swipeCatalog(2);
      assert.match(await page.locator('[data-life-buy="lantern"]').innerText(), /あと 2 しずく/);
      await swipeCatalog(1);
      await page.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
      await page.locator('.life-camera-tools summary').click();
      await page.getByRole('button', { name: 'しまを おおきく', exact: true }).click();
      await page.getByRole('button', { name: 'しまを おおきく', exact: true }).click();
      assert(JSON.parse(await page.locator('.life-world').getAttribute('data-life-camera')).cameraView.zoom > 1);
      await page.locator('.life-camera-tools summary').click();
      await page.getByRole('button', { name: 'つくる', exact: true }).click();
      await page.locator('[data-life-buy="flower"]').click();
      assert.equal(JSON.parse(await page.locator('.life-world').getAttribute('data-life-camera')).cameraView.zoom, 1);
      await page.screenshot({ path: `${out}/${name}-placement-overview.png` });
      await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
      await page.getByRole('button', { name: 'つぎの マス' }).click();
      await page.getByRole('button', { name: 'つぎの マス' }).click();
      await page.locator('[data-life-cell="0,2"]').click();
      const discoveryBounce = page.waitForFunction(reduced => {
        const pose = JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').find(p => p.id === 'rabbit');
        return pose?.reaction === '!' && (reduced ? pose.hop === 0 : pose.hop > .02);
      }, name === 'tablet');
      await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
      await page.locator('.life-placement').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), String(earned - 2));
      const observationCue = page.locator('[data-life-observation-earned]');
      await observationCue.waitFor();
      assert.match(await observationCue.innerText(), /うさぎが おはなを/);
      assert.match(await observationCue.innerText(), /みつけたよ|みているよ/);
      await discoveryBounce;
      await page.screenshot({ path: `${out}/${name}-observation.png` });
      await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-life-resident="rabbit"] em')?.textContent === 'におい すき');
      assert.match(await page.locator('[data-life-resident="rabbit"]').innerText(), /におい すき/);
      await page.waitForFunction(reduced => {
        const pose = JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').find(p => p.id === 'rabbit');
        return pose?.reaction === '♪' && (reduced ? pose.headRoll >= .1 : pose.headRoll > .03);
      }, name === 'tablet');
      await page.screenshot({ path: `${out}/${name}-resident-reply.png` });
      await selectTab('もちもの');
      const flowerItem = page.locator('[data-life-item]').first();
      assert.equal(await flowerItem.getAttribute('data-life-growth-stage'), '0');
      assert.equal(await flowerItem.getAttribute('data-life-growth-next-hours'), '2');
      assert.match(await flowerItem.innerText(), /めが でた/);
      assert.match(await flowerItem.innerText(), /あと 2じかんで つぼみ/);
      assert.equal(await page.getByRole('img', { name: 'そだち 1 / 3' }).count(), 1);
      await page.screenshot({ path: `${out}/${name}-growth-inventory.png` });
      await page.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
      const before = await readNative(page);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
      assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '1');
      assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), String(earned - 2));
      assert.equal(await page.locator('[data-life-earned]').count(), 0);
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
      report.scenarios.push({ name, pass: true, nativeSwipeBothDirections: true, keyboardDots: true, noAccidentalPurchase: true, answers, earned, earnedCue: 6, earnedCueBox, residentFavorites, discoveryBounce: true, residentReply: 'におい すき', rabbitHeadTilt: true, lightMeaning: true, lightStylePrice: 4,
        growthStageVisible: true, growthNextHint: 'あと 2じかんで つぼみ', savedItems: 1, offlineAnswerAndReload: true });
    } catch (e) { await page.screenshot({ path: `${out}/${name}-failure.png` }); throw e; }
    finally { const video = page.video(); await context.close(); if (video) await video.saveAs(`${out}/${name}-journey.webm`); }
 }
 report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
