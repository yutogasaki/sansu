import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5342',out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-acting-final';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const report={target:base,version:await fetch(`${base}/version.json`).then(r=>r.json()),candidate:'nature-town-acting-s2',checks:[],pass:false};
try {
 for(const width of [390,768]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // This check holds the initial world still; the acting harness covers actual ticks.
  await context.addInitScript(()=>{const original=setInterval;window.setInterval=(cb,ms,...args)=>ms===1000?0:original(cb,ms,...args);});
  await page.goto(base);await page.waitForURL('**/#/onboarding');await seedNative(page,`Sprites ${width}`);
  await page.goto(`${base}/#/nature-town`);await page.locator('[data-candidate="nature-town-acting-s2"]').waitFor();
  await page.getByRole('button',{name:'一時停止',exact:true}).tap();
  await page.waitForFunction(()=>[...document.querySelectorAll('.town-resident-body img,.town-prop-art')].every(i=>i.complete&&i.naturalWidth===160));
  await page.locator('.town-resident-marker').first().tap();
  assert.equal(await page.locator('.town-resident-marker.chosen').count(),1);
  assert.equal(await page.locator('.nature-town canvas').count(),0);
  await page.screenshot({path:`${out}/${width}-normal-touch.png`});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('.nature-town').waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await page.locator('[data-candidate="nature-town-acting-s2"]').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.town-resident-body img,.town-prop-art')].every(i=>i.complete&&i.naturalWidth===160));
  await page.screenshot({path:`${out}/${width}-offline.png`});assert.deepEqual(errors,[]);
  report.checks.push({width,touchSelection:true,normalMotion:true,offlineSprites:true,runtimeWebGL:false});
  await context.close();
 }
 report.pass=true;
} catch(error){report.error=error.stack;throw error;}finally{await browser.close();await fs.writeFile(`${out}/sprites-report.json`,JSON.stringify(report,null,2));}
