import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_FANTASY_PRODUCTION_URL;
const out=process.env.SANSU_FANTASY_PRODUCTION_OUTPUT;
const manifestPath=process.env.SANSU_FANTASY_MANIFEST;
assert(base&&out&&manifestPath,'Specify the production URL, fresh output directory and actual build manifest');
await fs.mkdir(out,{recursive:false});
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
for(const file of manifest.files)assert.equal(createHash('sha256').update(await fs.readFile(file.path)).digest('hex'),file.sha256,file.path);
assert.equal(manifest.flags.VITE_ISLAND_FANTASY_ENABLED,true);
const browser=await chromium.launch();const report={target:base,manifest:manifestPath,sourceHash:manifest.sourceHash,version:manifest.version,humanN:0,workerDelayMs:Number(process.env.SANSU_FANTASY_WORKER_DELAY_MS||0),scenarios:[],captures:[],pass:false};let activePage;
const readLife=(page,id)=>page.evaluate(async id=>{
 const names=(await indexedDB.databases()).map(d=>d.name);if(names.includes('SansuIslandLifePreviewV1'))throw Error('Production must not use the DEV ownership database');
 const open=indexedDB.open('SansuIslandLifeV1');const db=await new Promise((ok,no)=>{open.onsuccess=()=>ok(open.result);open.onerror=()=>no(open.error);});
 try{const request=db.transaction('worlds').objectStore('worlds').get(id);return await new Promise((ok,no)=>{request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error);});}finally{db.close();}
},id);
const capture=async(page,label)=>{await page.waitForTimeout(180);const file=`${page.viewportSize().width}-${label}.png`;await page.screenshot({path:`${out}/${file}`});report.captures.push({file,...await runtimeMetadata(page),world:await page.locator('.life-world').count()?await page.locator('.life-world').first().evaluate(e=>({candidate:e.dataset.lifeVisualCandidate,time:e.dataset.gardenTime,render:e.dataset.lifeRender})):null});};
try{
 for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
  const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:viewport.width===768?'reduce':'no-preference'});const page=activePage=await context.newPage();page.setDefaultTimeout(30000);
  const workerDelay=report.workerDelayMs,delayedWorkerRequests=[];if(workerDelay)await page.route(/lifeUpdate\.worker-[^/]+\.js/,async route=>{const started=Date.now();await new Promise(resolve=>setTimeout(resolve,workerDelay));delayedWorkerRequests.push({url:route.request().url(),elapsedMs:Date.now()-started});await route.continue();});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);assert.deepEqual(await (await page.request.get(`${base}/version.json`)).json(),manifest.version);
  await page.locator('.island-welcome').waitFor();await capture(page,'welcome');
  await page.getByRole('button',{name:'まなぶ',exact:true}).first().click();
  for(const name of ['小学 1 年生','さんすう','足し算まで'])await page.getByRole('button',{name,exact:true}).click();
  await page.locator('[data-input-ready="true"]').waitFor();if(await page.getByRole('button',{name:'おとを けす',exact:true}).count())await page.getByRole('button',{name:'おとを けす',exact:true}).click();
  let native=await readNative(page);const id=native.plan.profileId,first=native.plan.id;let count=0;
  while(native.plan.id===first&&count++<12)native=(await answerUI(page,native.plan,{touch:true,dev:false})).state;
  assert.equal(native.logs.length,3);const continuation=native.plan.id;await capture(page,'learning');
  await page.getByRole('button',{name:'とじる',exact:true}).click();await page.locator('.life-world[data-rendered="true"]').waitFor();
  assert.equal(await page.locator('.life-world').getAttribute('data-life-world-style'),'fantasy-garden-v1');assert.equal(await page.locator('.life-dev').count(),0);
  assert.equal(await page.locator('.life-world').getAttribute('data-life-visual-candidate'),'living-fantasy-garden-v2');
  assert.match(await page.getByRole('button',{name:'しまの ようす',exact:true}).locator('img').getAttribute('src'),/pokomoko-original/);
  await page.waitForFunction(()=>document.querySelector('.island-life')?.dataset.lifeDrops==='6');
  await page.getByRole('button',{name:'つくる',exact:true}).click();await page.locator('[data-life-buy="flower"]').click();await page.getByRole('button',{name:'マスから えらぶ',exact:true}).click();await page.locator('[data-life-cell="0,0"]').click();await page.getByRole('button',{name:'ここに おく',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.island-life')?.dataset.lifeDrops==='4');if(await page.getByRole('button',{name:'メニューを とじる',exact:true}).isVisible())await page.getByRole('button',{name:'メニューを とじる',exact:true}).click();
  await page.getByRole('button',{name:'よる',exact:true}).click();await capture(page,'earned-garden');const owned=await readLife(page,id);assert.equal(owned.credits.length,3);assert.equal(owned.actions.filter(a=>a.command.type==='buy').length,1);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();assert.equal(await page.locator('.life-world').getAttribute('data-garden-time'),'night');assert.deepEqual((await readLife(page,id)).actions,owned.actions);await capture(page,'offline-garden');
  await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('[data-input-ready="true"]').waitFor();native=await readNative(page,id);assert.equal(native.plan.id,continuation);
  native=(await answerUI(page,native.plan,{touch:true,dev:false})).state;assert.equal(native.logs.length,4);await page.getByRole('button',{name:'とじる',exact:true}).click();await page.locator('.life-world[data-rendered="true"]').waitFor();await page.waitForFunction(()=>document.querySelector('.island-life')?.dataset.lifeDrops==='6');
  const offline=await readLife(page,id);assert.equal(offline.credits.length,4);assert.deepEqual(offline.actions,owned.actions);await page.reload();await page.locator('.life-world[data-rendered="true"]').waitFor();assert.equal((await readNative(page,id)).logs.length,4);assert.equal((await readLife(page,id)).credits.length,4);await capture(page,'offline-saved');
  await context.setOffline(false);assert.deepEqual(errors,[]);if(workerDelay){assert(delayedWorkerRequests.length>0);assert(delayedWorkerRequests.every(r=>r.elapsedMs>=workerDelay));}report.scenarios.push({viewport,delayedWorkerRequests,source:'Real onboarding, four UI answers, real purchase/placement, real SW offline reload and native IndexedDB; no fixture writes',credits:offline.credits.length,purchases:offline.actions.filter(a=>a.command.type==='buy').length,pass:true});await context.close();
 }
 report.pass=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;if(activePage&&!activePage.isClosed()){const native=await readNative(activePage).catch(()=>null);report.failureSave={native,life:native?.plan?await readLife(activePage,native.plan.profileId).catch(()=>null):null};}if(activePage&&!activePage.isClosed())await activePage.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,scenarios:report.scenarios,error:report.error},null,2));}
