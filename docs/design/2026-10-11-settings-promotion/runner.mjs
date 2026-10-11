import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { appRootMetadata, openIslandDestination, readNative } from '../../../tools/island-e2e-helpers.mjs';
const base = process.env.SANSU_PROMO_SETTINGS_URL || 'http://127.0.0.1:5377';
const out = process.env.SANSU_PROMO_SETTINGS_OUTPUT || 'docs/design/2026-10-11-settings-promotion/runtime';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, candidate: 'settings-promotion-link-v1', scope: 'Fresh Chromium profiles; real onboarding, Settings link, popup, keyboard, original route and native learning-store retention. No child or physical device evaluation.', cases: [], pass: false };
const ready = async page => { await page.locator('[data-growing-island="ready"] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
const learning = state => Object.fromEntries(['islandPlans','logs','memoryMath','memoryVocab','exploreRuns'].map(key=>[key,state[key]]));
try {
 report.version = await fetch(`${base}/version.json`).then(r=>r.json());
 for (const width of [320,390,768,1440]) {
  const context = await browser.newContext({ viewport: { width, height: width < 760 ? 844 : 1024 }, hasTouch: true, reducedMotion: width===768?'reduce':'no-preference' });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const entry={width,pass:false}; report.cases.push(entry);
  try {
   await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
   await page.getByRole('button',{name:/^まなぶ/}).first().tap();
   for (const name of ['小学 1 年生','さんすう','足し算まで']) await page.getByRole('button',{name,exact:true}).tap();
   await ready(page);
   await openIslandDestination(page,'設定',{touch:true});
   const link=page.getByRole('link',{name:/アプリの紹介/}); await link.waitFor(); await link.scrollIntoViewIfNeeded();
   await page.waitForTimeout(800);
   const before=learning(await readNative(page)); const original=page.url();
   const metadata=await appRootMetadata(page); assert.equal(metadata.islandFeatureEnabled,true); assert.equal(metadata.revision,report.version.revision);
   const layout=await link.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(layout.width>=44&&layout.height>=44); assert.equal(layout.overflow,false);
   assert.equal(await link.getAttribute('href'),'/promo/');
   await page.screenshot({path:`${out}/${width}-settings.png`});
   const popupPromise=page.waitForEvent('popup');
   if(width===1440){await link.focus();await page.keyboard.press('Enter');} else await link.tap();
   const popup=await popupPromise; popup.on('pageerror',e=>errors.push(e.message)); await popup.waitForLoadState();
   await popup.getByRole('heading',{name:/算数も、英語も/}).waitFor();
   assert.equal(new URL(popup.url()).pathname,'/promo/');
   assert.equal(await popup.evaluate(()=>window.opener),null);
   await popup.waitForFunction(()=>Array.from(document.querySelectorAll('.hero img')).every(im=>im.complete&&im.naturalWidth>0));
   await popup.screenshot({path:`${out}/${width}-promotion.png`});
   assert.equal(await popup.locator('body').getAttribute('data-visual-candidate'),'promotion-learning-complete-v3');
   assert.equal(page.url(),original); assert.deepEqual(learning(await readNative(page)),before);
   await popup.close(); await page.reload(); await link.waitFor(); assert.deepEqual(learning(await readNative(page)),before);
   if(width===390){
    await page.getByRole('button',{name:/表示とサウンド/}).tap();
    await page.getByRole('group',{name:'表示テキスト'}).getByRole('button',{name:'やさしい',exact:true}).tap();
    await page.getByRole('button',{name:'もどる',exact:true}).tap();
    const easy=page.getByRole('link',{name:/アプリの しょうかい/}); await easy.waitFor(); assert.match(await easy.innerText(),/べつの タブで ひらく/);
    await easy.scrollIntoViewIfNeeded(); await page.screenshot({path:`${out}/${width}-settings-easy.png`}); entry.easyCopy=true;
   }
   assert.deepEqual(errors,[]); Object.assign(entry,{metadata,layout,original,popup:`${base}/promo/`,learningRetained:true,pass:true});
  } catch(e){entry.error=String(e.stack||e);entry.url=page.url();entry.errors=errors;entry.screen=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:`${out}/${width}-failure.png`}).catch(()=>{});throw e;} finally{await context.close();}
 }
 report.pass=true;
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log('PASS Settings → promotion, 4 widths, keyboard/touch, learning stores, easy copy, reload.');
