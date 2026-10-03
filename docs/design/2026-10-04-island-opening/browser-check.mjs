import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from '../../../tools/island-e2e-helpers.mjs';
const base = process.env.SANSU_OPENING_URL, out = process.env.SANSU_OPENING_OUTPUT;
assert(base && out, 'Specify a production-preview URL and a fresh output directory');
await fs.mkdir(out, { recursive: false });
const report = { target: base, scenarios: [], pass: false };
async function hashes() {
 const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public', 'dist'], { encoding: 'utf8' }).trim().split('\n');
 paths.push('vite.config.ts', 'package.json', 'package-lock.json', 'tools/build-app.mjs', 'tools/island-e2e-helpers.mjs', 'docs/design/2026-10-04-island-opening/browser-check.mjs');
 return Object.fromEntries(await Promise.all(paths.sort().map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
}
report.initialHashes = await hashes();
const ready = async p => { await p.locator('[data-growing-island="ready"] canvas').waitFor(); await p.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
async function setup(p) {
 await p.goto(`${base}/#/island`);
 await p.locator('.island-welcome .island-stage__viewport[aria-busy="false"]').waitFor();
 await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
 await p.getByRole('button', { name: 'まなぶ', exact: true }).click();
 for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await p.getByRole('button', { name, exact: true }).click();
}
const native = p => p.evaluate(async () => {
 const q = indexedDB.open('SansuDatabase'); const db = await new Promise((ok,no) => { q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error); });
 try { const rows = await Promise.all([...db.objectStoreNames].map(async name => {
 const r=db.transaction(name).objectStore(name).getAll();return [name, await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})];
 })); return Object.fromEntries(rows); } finally { db.close(); }
});
const readGrowing = (p,id) => p.evaluate(async id => {
 const q=indexedDB.open('SansuGrowingIslandV1');const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 try { const r=db.transaction('guidedIslands').objectStore('guidedIslands').get(id);return await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}); } finally { db.close(); }
},id);
async function capture(p,name) {
 await p.screenshot({path:`${out}/${name}.png`});return {file:`${name}.png`,metadata:await runtimeMetadata(p)};
}
let active;
try {
 for (const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.SANSU_OPENING_ENGINE||process.env.SANSU_OPENING_ENGINE===name)) {
  const browser=await engine.launch();
  try {
   const context=await browser.newContext({viewport:{width:768,height:1024},hasTouch:true,serviceWorkers:'allow',reducedMotion:'reduce'});
   await context.addInitScript(()=>{
    const RealWorker=Worker;window.openingWorkers=[];window.openingFrames=0;
    window.Worker=class extends RealWorker {
     constructor(url,options){super(url,options);this.stalled=String(url).includes('syncProjection.worker')&&sessionStorage.getItem('stall-projection')==='yes';window.openingWorkers.push({url:String(url),stalled:this.stalled});}
     postMessage(message,...args){if(!this.stalled)super.postMessage(message,...args);}
    };
    const tick=()=>{if(document.querySelector('[data-loading-step="saving"]'))window.openingFrames++;requestAnimationFrame(tick)};requestAnimationFrame(tick);
   });
   const p=active=await context.newPage();p.setDefaultTimeout(35000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
   // A genuine new owner's first write is held in the calculation worker (explicit fault).
   await p.goto(`${base}/version.json`);await p.evaluate(()=>sessionStorage.setItem('stall-projection','yes'));
   await setup(p);await p.locator('[data-loading-step="saving"]').waitFor();
   const before=await native(p);
   await p.getByRole('button',{name:'もういちど ひらく',exact:true}).waitFor();
   const frames=await p.evaluate(()=>window.openingFrames);assert(frames>5,'UI remains responsive while the worker is stalled');
   const stalled=await capture(p,`${name}-worker-stalled`);
   assert.deepEqual(await native(p),before);
   await p.evaluate(()=>sessionStorage.removeItem('stall-projection'));
   await p.getByRole('button',{name:'もういちど ひらく',exact:true}).tap();await ready(p);
   assert.deepEqual(await native(p),before);
   const recovered=await capture(p,`${name}-worker-recovered`);
   const usedWorkers=await p.evaluate(()=>window.openingWorkers);
   assert(usedWorkers.some(w=>w.url.includes('syncProjection.worker')&&!w.stalled));
   // Save a real answer, then retain it through an actual native IDB upgrade block.
   await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();
   let state=await readNative(p);state=(await answerUI(p,state.plan,{touch:true,dev:false})).state;
   await p.getByRole('button',{name:'とじる',exact:true}).tap();await ready(p);
   const id=state.island.profileId;
   let saved;
   for(let i=0;i<100;i++){saved=await readGrowing(p,id);if(saved?.state.learned.length===1)break;await p.waitForTimeout(100)}
   assert.equal(saved.state.learned.length,1);
   const learnedBefore=await native(p);
   await p.goto(`${base}/version.json`);
   await p.evaluate(()=>new Promise((ok,no)=>{const q=indexedDB.deleteDatabase('SansuGrowingIslandV1');q.onsuccess=ok;q.onerror=()=>no(q.error)}));
   const blocker=await context.newPage();await blocker.goto(`${base}/version.json`);
   await blocker.evaluate(async record=>{
    const q=indexedDB.open('SansuGrowingIslandV1',10);q.onupgradeneeded=()=>q.result.createObjectStore('islands',{keyPath:'profileId'});
    const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
    const tx=db.transaction('islands','readwrite');tx.objectStore('islands').put(record);
    await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
    db.onversionchange=()=>{};window.blockingDatabase=db;
   },saved);
   await p.goto(`${base}/#/island`);await p.locator('[data-loading-step="saving"]').waitFor();
   await p.getByRole('button',{name:'もういちど ひらく',exact:true}).waitFor();
   const blocked=await capture(p,`${name}-database-blocked`);
   assert.deepEqual(await native(p),learnedBefore);
   await blocker.evaluate(()=>window.blockingDatabase.close());await blocker.close();
   // Closing the obsolete connection itself permits the pending native request to proceed.
   await ready(p);const after=await readGrowing(p,id);
   assert.deepEqual(after.state.learned,saved.state.learned);assert.equal(after.state.drops,saved.state.drops);
   assert.deepEqual(after.state.landmarks,saved.state.landmarks);
   assert.deepEqual(await native(p),learnedBefore);
   const unblocked=await capture(p,`${name}-database-recovered`);
   if(name==='chromium'){
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready(p);
    await context.setOffline(true);await p.reload();await ready(p);
    assert.deepEqual(await native(p),learnedBefore);
    await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();
    const next=await readNative(p);const answered=(await answerUI(p,next.plan,{touch:true,dev:false})).state;
    assert.equal(answered.logs.length,next.logs.length+1);await capture(p,`${name}-offline-answer`);
    await context.setOffline(false);
   }
   assert.deepEqual(errors,[]);
   report.scenarios.push({engine:name,version:browser.version(),frames,stalled,recovered,blocked,unblocked,usedWorkers,
    realAnswers:name==='chromium'?2:1,learningStoresPreserved:true,offline:name==='chromium'?'restart and answer PASS':'not asserted (known WebKit automation navigation gap)'});
   await context.close();
  }catch(error){if(active&&!active.isClosed()){await active.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});report.failureState={engine:name,url:active.url(),text:await active.locator('body').innerText().catch(()=>''),error:String(error)};}throw error;}finally{await browser.close()}
 }
 report.finalHashes=await hashes();assert.deepEqual(report.finalHashes,report.initialHashes);report.pass=true;
}catch(error){report.error=error.stack||String(error);if(active&&!active.isClosed())await active.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2))}
