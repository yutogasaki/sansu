import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedNative } from './island-e2e-helpers.mjs';

const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5337';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'disposable local target only');
const out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-replay';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,fixture:'Disposable native profiles. Timer dispatcher drives the actual 1-second application callback once per pulse, awaiting durable save; no world/offer/ordinal injection. Same IndexedDB snapshot is cloned between isolated contexts. RAF rates are imposed callback cadences, not device FPS benchmarks.',runs:[],pass:false};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function waitUntil(predicate,label,timeout=15000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error(`Timeout: ${label}`);}
async function readTown(page,id='Replay A') {
 return page.evaluate(id=>new Promise((resolve,reject)=>{const open=indexedDB.open('SansuNatureTownV02');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction('saves').objectStore('saves').get(id);q.onsuccess=()=>{db.close();resolve(q.result?JSON.parse(q.result.current.payload):null);};q.onerror=()=>reject(q.error);};}),id);
}
async function ready(page){await page.locator('.nature-town').waitFor();await waitUntil(async()=>await button(page,'れんしゅう').isEnabled(),'writer ready');}
async function pause(page){if(await button(page,'一時停止').count())await button(page,'一時停止').click();}
async function play(page){if(await button(page,'うごかす').count())await button(page,'うごかす').first().click();}
async function advance(page,n,id='Replay A') {
 for(let i=0;i<n;i++) {
  const before=(await readTown(page,id)).world.tick;
  await page.evaluate(()=>window.__townDiagnostic.pulse());
  await waitUntil(async()=>Number(await page.locator('.nature-town').getAttribute('data-tick'))===before+1,'one published tick');
  assert.equal((await readTown(page,id)).world.tick,before+1,'published state is durably saved');
 }
}
async function instrumentation(context,fps) {
 await context.addInitScript(({fps})=>{
  const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window),raf=window.requestAnimationFrame.bind(window);
  const callbacks=new Map();let id=-1;
  window.setInterval=(callback,delay,...args)=>{if(delay===1000&&typeof callback==='function'){const token=id--;callbacks.set(token,()=>callback(...args));return token;}return interval(callback,delay,...args);};
  window.clearInterval=token=>{if(callbacks.has(token))callbacks.delete(token);else clear(token);};
  window.__townDiagnostic={pulse:()=>{for(const cb of callbacks.values())cb();},frames:0,first:0,last:0};
  window.requestAnimationFrame=callback=>{
   if(fps===60)return raf(callback);
   const start=performance.now();
   const draw=time=>{if(time-start>=1000/fps-2)callback(time);else raf(draw);};
   return raf(draw);
  };
  const count=time=>{const d=window.__townDiagnostic;d.first||=time;d.last=time;d.frames++;window.requestAnimationFrame(count);};
  window.requestAnimationFrame(count);
 },{fps});
}
try {
 const setup=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await instrumentation(setup,60);const page=await setup.newPage();
 await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();
 await seedNative(page,'Replay B');await seedNative(page,'Replay A');
 // The single-profile helper replaces appData.profiles; explicitly register both disposable owners.
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const open=indexedDB.open('SansuDatabase');open.onerror=()=>reject(open.error);open.onsuccess=()=>{
   const db=open.result,tx=db.transaction(['profiles','appData'],'readwrite'),profiles=tx.objectStore('profiles').getAll();
   profiles.onsuccess=()=>{const app=tx.objectStore('appData').get('app');app.onsuccess=()=>tx.objectStore('appData').put({...app.result,profiles:Object.fromEntries(profiles.result.map(p=>[p.id,p]))});};
   tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
  };
 }));
 await page.goto(`${base}/#/nature-town`);await ready(page);await pause(page);
 for(const [name,pos] of [['家',[8,6]],['畑',[10,3]]]) {
  await button(page,'どうぐ').click();await page.locator('.town-tools').getByRole('button',{name,exact:true}).click();
  await page.locator(`[data-cell="${pos.join(',')}"]`).click();await button(page,'ここにする').click();await button(page,'ここにする').waitFor({state:'detached'});
 }
 await button(page,'せかい').click();await play(page);
 for(let i=0;i<1800&&!(await readTown(page)).world.offer;i++)await advance(page,1);
 await pause(page);const initial=await readTown(page);assert.equal(initial.world.offer?.status,'pending');
 const seedState=await setup.storageState({indexedDB:true});
 report.start={tick:initial.world.tick,offer:initial.world.offer,ordinals:initial.world.randomEvaluationOrdinals,worldHash:digest(initial.world)};
 await page.screenshot({path:`${out}/initial-offer.png`});await setup.close();
 let expected;
 for(const scenario of [{width:390,fps:60,motion:'no-preference',alter:false},{width:768,fps:30,motion:'reduce',alter:true}]) {
  const context=await browser.newContext({storageState:seedState,viewport:{width:scenario.width,height:scenario.width===390?844:1024},reducedMotion:scenario.motion});
  await instrumentation(context,scenario.fps);const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try {
   await p.goto(`${base}/#/nature-town`);await ready(p);await pause(p);
   assert.deepEqual((await readTown(p)).world,initial.world);
   if(scenario.alter){await button(p,'全景').click();await p.getByRole('combobox',{name:'地図の見え方'}).selectOption('moisture');await button(p,'住人をさがす').click();await p.locator('.town-resident-list button').last().click();}
   await play(p);await advance(p,60);await pause(p);const midway=await readTown(p);
   await p.screenshot({path:`${out}/${scenario.width}-midway.png`});
   if(scenario.alter) {
    await p.reload();await ready(p);await pause(p);assert.deepEqual((await readTown(p)).world,midway.world);
    await p.goto(`${base}/#/settings`);await p.getByRole('button',{name:/みため と おと|表示とサウンド/}).click();
    const sound=p.getByText(/^(おと・BGM|サウンド)$/).locator('..').locator('..');
    await sound.getByRole('button',{name:'OFF',exact:true}).click();await sound.getByRole('button',{name:'ON',exact:true}).waitFor();
    await p.goto(`${base}/#/nature-town`);await ready(p);await pause(p);assert.deepEqual((await readTown(p)).world,midway.world);
    await p.goto(`${base}/#/settings`);await p.getByRole('button',{name:/プロフィール/}).click();
    await p.getByRole('button',{name:/^(きりかえ|切替)$/}).click();
    await p.waitForURL('**/#/island');await p.locator('.island-page').waitFor();
    await p.goto(`${base}/#/nature-town`);await ready(p);await pause(p);
    assert.equal((await readTown(p,'Replay B')).world.profileId,'Replay B');
    await play(p);await advance(p,5,'Replay B');await pause(p);const other=await readTown(p,'Replay B');
    await p.goto(`${base}/#/settings`);await p.getByRole('button',{name:/プロフィール/}).click();await p.getByRole('button',{name:/^(きりかえ|切替)$/}).click();
    await p.waitForURL('**/#/island');await p.locator('.island-page').waitFor();
    await p.goto(`${base}/#/nature-town`);await ready(p);await pause(p);
    assert.deepEqual((await readTown(p)).world,midway.world,'other owner never advances or redraws A');
    assert.deepEqual((await readTown(p,'Replay B')).world,other.world);
   }
   await play(p);await advance(p,120);await pause(p);const final=await readTown(p);
   assert.deepEqual(final.world.offer,initial.world.offer,'pending offer persists without redraw');
   if(expected)assert.deepEqual(final.world,expected,'same world, ordinals and outcomes at same tick');else expected=final.world;
   await p.evaluate(async()=>{await navigator.serviceWorker.ready;});
   await p.screenshot({path:`${out}/${scenario.width}-final.png`});
   const runtime=await p.evaluate(()=>({revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),candidate:document.querySelector('.nature-town')?.getAttribute('data-candidate'),sw:!!navigator.serviceWorker.controller,frames:window.__townDiagnostic.frames,elapsed:window.__townDiagnostic.last-window.__townDiagnostic.first}));
   assert.deepEqual(errors,[]);
   report.runs.push({...scenario,runtime,tick:final.world.tick,worldHash:digest(final.world),ordinals:final.world.randomEvaluationOrdinals,pass:true});
   console.log('PASS',scenario.width,final.world.tick);
  } catch(error){await p.screenshot({path:`${out}/${scenario.width}-failure.png`}).catch(()=>{});throw error;}finally{await context.close();}
 }
 report.pass=true;
} catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
