import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative, readNative, answerUI, waitMode } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5233';
const production=process.env.SANSU_TOWN_PRODUCTION==='1';
const out=process.env.SANSU_TOWN_OUTPUT||'output/nature-town';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,fixture:'Disposable native profile only. No town inventory, learning completion, or simulation clock injection.',devices:[],pass:false};
try {
 for(const viewport of [{width:390,height:844},{width:768,height:1024}]) {
  const context=await browser.newContext({viewport,reducedMotion:viewport.width===768?'reduce':'no-preference'}),page=await context.newPage();
  page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();const profileId=await seedNative(page,`Nature ${viewport.width}`);await page.goto(`${base}/#/nature-town`);
  await page.locator('[data-candidate="nature-town-map-s1"]').waitFor();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.screenshot({path:`${out}/${viewport.width}-ready.png`});
  assert.equal(await page.locator('.nature-town').getAttribute('data-population'),'3');
  await page.getByRole('button',{name:'どうぐ',exact:true}).click();
  await page.getByRole('button',{name:'花',exact:true}).click();
  await page.getByRole('button',{name:'8,6 地面',exact:true}).click();
  await page.getByRole('button',{name:'ここにする',exact:true}).click();
  await page.getByRole('button',{name:'8,6 花',exact:true}).waitFor();
  await page.getByRole('button',{name:'せかい',exact:true}).click();
  await page.getByRole('button',{name:'8,6 花',exact:true}).click();
  await page.locator('.town-panel').getByRole('button',{name:'うごかす',exact:true}).click();
  await page.getByRole('button',{name:'8,5 地面',exact:true}).click();
  await page.getByRole('button',{name:'ここにする',exact:true}).click();
  await page.getByRole('button',{name:'8,5 花',exact:true}).waitFor();
  await page.screenshot({path:`${out}/${viewport.width}-edited.png`});
  await page.reload();await page.getByRole('button',{name:'8,5 花',exact:true}).waitFor();
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  const before=await page.locator('.nature-town').getAttribute('data-tick');
  await page.getByRole('button',{name:'れんしゅう',exact:true}).click();
  await waitMode(page,'learning');
  await page.screenshot({path:`${out}/${viewport.width}-learning.png`});
  for(let i=0;i<3;i++) await answerUI(page,(await readNative(page,profileId)).plan,{dev:!production});
  // Native exit retains partial subsequent assignments; use its normal back action.
  const buttons=await page.getByRole('button').allTextContents();
  await fs.writeFile(`${out}/${viewport.width}-learning-buttons.json`,JSON.stringify(buttons));
  const exit=page.getByRole('button',{name:'とじる',exact:true});
  if(await exit.count()) await exit.click();else await page.goBack();
  await page.locator('.nature-town:visible').waitFor();
  assert.equal(await page.locator('.nature-town').getAttribute('data-tick'),before,'world pauses during learning');
  await page.getByRole('button',{name:'きろく と 保存',exact:true}).click();
  await page.getByText(/未使用の学習単位：1/).waitFor();
  await page.screenshot({path:`${out}/${viewport.width}-return.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  const other=await context.newPage();await other.goto(`${base}/#/nature-town`);await other.getByText(/別のタブで この島を/).waitFor();await other.close();
  if(production) {
   await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
   await page.reload();await page.locator('.nature-town').waitFor();
   assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);
   await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'8,5 花',exact:true}).waitFor();
   await page.getByRole('button',{name:'一時停止',exact:true}).click();
   await page.getByRole('button',{name:'8,5 花',exact:true}).click();await page.getByRole('button',{name:'しまう',exact:true}).click();
   await page.getByRole('button',{name:'8,5 地面',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'8,5 地面',exact:true}).waitFor();
   await page.getByRole('button',{name:'一時停止',exact:true}).click();
   await page.getByRole('button',{name:'れんしゅう',exact:true}).click();await waitMode(page,'learning');
   const pending=(await readNative(page,profileId)).plan.id;
   for(let i=0;i<40;i++) {const plan=(await readNative(page,profileId)).plan;if(plan.id!==pending)break;await answerUI(page,plan,{dev:false});}
   await page.getByRole('button',{name:'とじる',exact:true}).click();await page.locator('.nature-town:visible').waitFor();
   await page.getByRole('button',{name:'きろく と 保存',exact:true}).click();await page.getByText(/未使用の学習単位：2/).waitFor();
   await page.screenshot({path:`${out}/${viewport.width}-offline.png`});await context.setOffline(false);
  }
  report.devices.push({viewport,metadata:await page.evaluate(()=>({revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),delivery:document.querySelector('.app-container')?.getAttribute('data-delivery-id'),serviceWorkerControlled:!!navigator.serviceWorker.controller,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches})),townCandidate:await page.locator('.nature-town').getAttribute('data-candidate'),deliveryFlag:'VITE_NATURE_TOWN_ENABLED=true',pauseTick:before,offline:production,pass:true});
  await context.close();
 }
 report.pass=true;
} catch(error) {report.error=error.stack;throw error;} finally {await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
