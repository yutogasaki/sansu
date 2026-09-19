import { expandRuntimeFixture } from './expanded-life-fixture.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.RUNTIME_GAME_URL || 'http://127.0.0.1:5247/';
const out = process.env.RUNTIME_GAME_OUTPUT || 'output/playwright/life-runtime-assets';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const version=await (await fetch(new URL('/version.json',base))).json();
const report = { version, target: base, flag: 'VITE_ISLAND_RUNTIME_ASSETS=true', candidate: process.env.RUNTIME_GAME_CANDIDATE || 'island-life-runtime-assets-v3', fixture: 'Disposable historical credit/bench fixture; not earned learning or real-device evidence', humanN: 0, runs: [] };
try {
 for (const width of (process.env.RUNTIME_GAME_WIDTHS || '390,768').split(',').map(Number)) {
  const context = await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:width===768?'reduce':'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(60000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  for (const name of ['まなぶ','小学 1 年生','さんすう','足し算まで']) await page.getByRole('button',{name,exact:true}).first().click();
  await page.locator('.island-learning[data-input-ready="true"]').waitFor();
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.locator('.life-world[data-rendered="true"]').waitFor();
  await page.waitForTimeout(600);await page.screenshot({path:`${out}/${width}-launch.png`});
  const read = async (seed=false)=>page.evaluate(async seed=>{
   const names=await indexedDB.databases(), name=names.find(d=>d.name.startsWith('SansuIslandLife'))?.name;
   const req=indexedDB.open(name),db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
   const tx=db.transaction('worlds',seed?'readwrite':'readonly'), store=tx.objectStore('worlds'),get=store.getAll();
   const done=new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=()=>j(tx.error);});
   let row=(await new Promise((r,j)=>{get.onsuccess=()=>r(get.result);get.onerror=()=>j(get.error);}))[0];
   if(seed){const now=Date.now(),start=now-7*3600000,day=new Date(start);day.setHours(day.getHours()-4);
    const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    row={profileId:row.profileId,version:1,revision:0,clockIntents:[],createdAt:start,now,realAt:now,activitiesV2At:start,activitiesV2After:0,offsets:[{at:start,offset:0}],
     credits:Array.from({length:20},(_,i)=>({id:`qa-credit-${i}`,at:start,day:key})),
     actions:[{id:'qa-bench',at:start+2000,command:{type:'buy',kind:'bench',cell:{x:4,z:2}}}]};store.put(row);
   }
   await done;db.close();return {actions:row.actions,credits:row.credits};
  },seed);
  await read(true);await page.reload();
  const ready=()=>page.waitForFunction(()=>{try{const d=JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}');return d.loaded.includes('bench')&&d.loaded.includes('rock')&&d.pending.length===0;}catch{return false;}});
  let expanded;
  if(process.env.RUNTIME_GAME_EXPANDED==='1'){await ready();expanded=await expandRuntimeFixture(page);await page.reload();}
  await ready().catch(async e=>{console.error(await page.evaluate(()=>({url:location.href,body:document.body.innerText,world:document.querySelector('.life-world')?.outerHTML})));console.error(errors);await page.screenshot({path:`${out}/${width}-failure.png`});throw e;});await page.screenshot({path:`${out}/${width}-game.png`});
  const diagnostic=()=>page.locator('.life-world').evaluate(n=>({assets:JSON.parse(n.dataset.runtimeAssets),render:JSON.parse(n.dataset.lifeRender||'{}'),candidate:n.dataset.lifeVisualCandidate}));
  const measure=()=>page.evaluate(async()=>{
   const samples=[];let last=performance.now();
   for(let i=0;i<35;i++){await new Promise(r=>requestAnimationFrame(r));const at=performance.now();if(i>=5)samples.push(at-last);last=at;}
   samples.sort((a,b)=>a-b);const canvas=document.querySelector('.life-world canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   const glbs=performance.getEntriesByType('resource').filter(r=>/\.glb(?:\?|$)/.test(r.name)).map(r=>({url:r.name,encodedBytes:r.encodedBodySize,transferBytes:r.transferSize,duration:r.duration}));
   return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),frameMedianMs:samples[Math.floor(samples.length*.5)],frameP95Ms:samples[Math.floor(samples.length*.95)],sampleCount:samples.length,glbs};
  });
  const before=await read();const initial=await diagnostic();const initialMeasure=await measure();assert.equal(initial.assets.failed.length,0);
  assert.equal(initial.assets.candidate, report.candidate);
  await page.locator('.life-camera-tools summary').click();await page.getByRole('button',{name:'しま全体を みる',exact:true}).click();
  await page.screenshot({path:`${out}/${width}-overview.png`});
  const smaller=page.getByRole('button',{name:'しまを ちいさく',exact:true});
  for(let i=0;i<12&&await smaller.isEnabled();i++)await smaller.click();
  const distant=await diagnostic();
  if(expanded&&width===390)assert(distant.assets.far>initial.assets.far,'Expanded overview must use more far models');
  const distantMeasure=await measure();await page.screenshot({path:`${out}/${width}-distant.png`});
  await page.getByRole('button',{name:'もとの ながめ',exact:true}).last().click();
  await page.getByRole('button',{name:'くらしを みる',exact:true}).click();await page.locator('.life-camera-tools summary').click();
  assert.deepEqual(await read(),before,'Camera/material changes preserve saved ownership');
  await page.reload();await ready();assert.deepEqual(await read(),before);
  const final=await diagnostic();
  assert.equal(final.assets.instances,initial.assets.instances,'Reload does not accumulate models');
  if(expanded)assert(final.assets.far<=distant.assets.far,'Close view returns to near geometry');
  await page.route('**/*.glb*',route=>route.abort());await page.reload();
  await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}').failed.length>0;}catch{return false;}});
  await page.locator('.life-world[data-rendered="true"]').waitFor();await page.screenshot({path:`${out}/${width}-fallback.png`});
  assert.deepEqual(await read(),before,'Failed model requests preserve ownership');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.getByRole('button',{name:'まなぶ',exact:true}).first().click();
  await page.locator('.island-learning[data-input-ready="true"]').waitFor();
  await page.screenshot({path:`${out}/${width}-learning.png`});
  report.runs.push({width,expanded,initial,initialMeasure,distant,distantMeasure,final,errors});await context.close();
 }
 report.pass=true;
} finally {await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
