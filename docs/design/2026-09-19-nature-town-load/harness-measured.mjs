import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { seedNative } from './island-e2e-helpers.mjs';

const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5337';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'local disposable target only');
const source=process.env.SANSU_TOWN_SOURCE_ROOT||'/tmp/sansu-nt3-index-t1bn4rns';
const out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-load';
await fs.mkdir(out,{recursive:false});
const compiled=await build({stdin:{contents:"export {newWorld,makeChunk,makeProp,makeResident,context} from './src/domain/natureTown/world'; export {stepWorld} from './src/domain/natureTown/simulation'; export {assertWorld} from './src/domain/natureTown/validation';",resolveDir:source},bundle:true,platform:'node',format:'esm',write:false});
const engine=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const hash=s=>createHash('sha256').update(typeof s==='string'?s:JSON.stringify(s)).digest('hex');
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,mean:values.reduce((s,n)=>s+n,0)/values.length,p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
function fixture(population,chunks,id){
 const w=engine.newWorld(id);w.chunks=[];w.props=[];w.residents=[];w.hubMetrics=[];w.foodAccounting.initialized=0;
 for(let i=0;i<chunks;i++){
  const dx=(i%4)*16,dy=Math.floor(i/4)*16,c=engine.makeChunk([i%4,Math.floor(i/4)]);w.chunks.push(c);
  // Diagnostic repeated serviced neighborhoods; all-flat land and a local road loop.
  for(const cell of c.cells){cell.terrain='ground';cell.elevation=0;cell.moisture=.6;cell.path=cell.position[1]===dy+9||cell.position[0]===dx+10;}
  for(const [kind,x,y] of [['hub',8,8],['home',6,8],['home',4,8],['home',2,8],['home',6,6],['farm',10,8],['farm',10,6],['flowers',9,5],['tree',9,3]]){
   const p=engine.makeProp(`${i}:${kind}:${x}:${y}`,kind,[dx+x,dy+y]);if(kind==='home')p.hubId=`${i}:hub:8:8`;
   if('inventory'in p){p.inventory.food=kind==='hub'?8:4;w.foodAccounting.initialized+=p.inventory.food;}w.props.push(p);
  }
  w.hubMetrics.push({hubId:`${i}:hub:8:8`,historyStartedTick:0,history:[],eligibleStreak:0});
 }
 for(let i=0;i<population;i++){const chunk=i%chunks,slot=Math.floor(i/chunks),homes=w.props.filter(p=>p.kind==='home'&&p.id.startsWith(`${chunk}:`)),home=homes[Math.floor(slot/3)];assert.ok(home);w.residents.push(engine.makeResident(`load-resident:${i}`,i,home.id,home.hubId,home.entrance));}
 engine.assertWorld(w,id);return w;
}
const browser=await chromium.launch();
const report={target:base,sourceRoot:source,sourceCommit:'11d0d25954e35239a02bf5762437ded1742fba66',flags:{VITE_ISLAND_ENABLED:true,VITE_NATURE_TOWN_ENABLED:true},candidate:'nature-town-living-s1',host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemory:os.totalmem()},browser:browser.version(),scope:'Synthetic expanded neighborhoods; 30 logical ticks per run. Actual app timer callback pulsed after each prior save/render; wall time is measured, not claimed real-time cadence. CSS content-visibility:auto is diagnostic only. Node step timing excludes browser persistence/render. FPS is observed RAF callback cadence under headless load, not physical display FPS. Heap is JS heap only.',cases:[],pass:false};
const btn=(p,name)=>p.getByRole('button',{name,exact:true});
async function wait(predicate,label){const end=Date.now()+60000;while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,25));}throw Error(label);}
async function town(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('SansuNatureTownV02');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('saves').objectStore('saves').get('Load');r.onsuccess=()=>{db.close();resolve(JSON.parse(r.result.current.payload));};r.onerror=()=>reject(r.error);};}));}
async function instrument(context){await context.addInitScript(()=>{const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window);let token=-1;const callbacks=new Map();window.setInterval=(cb,ms,...args)=>{if(ms===1000&&typeof cb==='function'){const id=token--;callbacks.set(id,()=>cb(...args));return id;}return interval(cb,ms,...args);};window.clearInterval=id=>{if(callbacks.has(id))callbacks.delete(id);else clear(id);};window.__load={pulse:()=>{const t=performance.now();for(const cb of callbacks.values())cb();return performance.now()-t;},frames:[],longTasks:[],collect:false};new PerformanceObserver(list=>{if(window.__load.collect)window.__load.longTasks.push(...list.getEntries().map(e=>e.duration));}).observe({type:'longtask',buffered:true});const frame=t=>{if(window.__load.collect)window.__load.frames.push(t);requestAnimationFrame(frame);};requestAnimationFrame(frame);});}
try{
 for(const chunks of [8,24])for(const population of [24,96]){
  const initial=fixture(population,chunks,'Load'),tickTimes=[];let expected=initial;
  for(let i=0;i<30;i++){const start=performance.now();expected=engine.stepWorld(expected,engine.context()).state;tickTimes.push(performance.now()-start);}
  engine.assertWorld(expected,'Load');
  const pair={population,chunks,cells:chunks*256,nodeTickMs:stats(tickTimes),initialHash:hash(initial),expectedHash:hash(expected),runs:[]};report.cases.push(pair);
  for(const cull of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await instrument(context);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(base);await page.waitForURL('**/#/onboarding');await seedNative(page,'Load');await page.goto(`${base}/#/nature-town`);await page.locator('.nature-town').waitFor();await wait(()=>btn(page,'れんしゅう').isEnabled(),'ready');await btn(page,'一時停止').click();const save=await town(page);save.world=initial;
    await page.goto(`${base}/#/settings`);
    const payload=JSON.stringify(save);await page.evaluate(({payload,checksum})=>new Promise((resolve,reject)=>{const q=indexedDB.open('SansuNatureTownV02');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put({profileId:'Load',generation:0,current:{payload,checksum}});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),{payload,checksum:hash(payload)});
    await page.goto(`${base}/#/nature-town`);await page.locator('.nature-town').waitFor();await wait(()=>btn(page,'れんしゅう').isEnabled(),'load ready');
    if(cull)await page.addStyleTag({content:'.town-cell,.town-resident-marker{content-visibility:auto}'});
    assert.equal(await page.locator('.town-cell').count(),chunks*256);assert.equal(await page.locator('.town-resident-marker').count(),population);
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const before=await cdp.send('Performance.getMetrics');await page.evaluate(()=>{window.__load.frames=[];window.__load.longTasks=[];window.__load.collect=true;});
    const start=performance.now(),callback=[],saveRender=[];
    for(let tick=1;tick<=30;tick++){
     const t=performance.now();callback.push(await page.evaluate(()=>window.__load.pulse()));await page.waitForFunction(tick=>Number(document.querySelector('.nature-town')?.getAttribute('data-tick'))===tick,tick,{timeout:60000});
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));saveRender.push(performance.now()-t);
    }
    const durationMs=performance.now()-start;await btn(page,'一時停止').click();const final=await town(page);assert.deepEqual(final.world,expected,'entire world including every offscreen chunk matches same-source oracle');assert.deepEqual(final.progress,save.progress);assert.deepEqual(errors,[]);
    const measurement=await page.evaluate(()=>{window.__load.collect=false;const frames=window.__load.frames;return {frameIntervals:frames.slice(1).map((t,i)=>t-frames[i]),longTasks:window.__load.longTasks,revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),candidate:document.querySelector('.nature-town')?.getAttribute('data-candidate'),skippedElements:[...document.querySelectorAll('.town-cell,.town-resident-marker')].filter(e=>!e.checkVisibility({contentVisibilityAuto:true})).length};});
    const after=await cdp.send('Performance.getMetrics');
    await page.screenshot({path:`${out}/${population}-${chunks}-${cull?'culled':'full'}.png`});
    const intervals=measurement.frameIntervals;delete measurement.frameIntervals;
    pair.runs.push({cull,durationMs,logicalTicks:30,callbackMs:stats(callback),saveAndRenderMs:stats(saveRender),rafFps:1000/(intervals.reduce((s,n)=>s+n,0)/intervals.length),frameIntervalMs:stats(intervals),...measurement,heapBefore:before.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,heapAfter:after.metrics.find(m=>m.name==='JSHeapUsedSize')?.value,savePayloadBytes:Buffer.byteLength(JSON.stringify(final)),worldHash:hash(final.world),pass:true});
    console.log('PASS',population,chunks,cull?'culled':'full',Math.round(durationMs),'ms');
   }finally{await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
  }
 }
 report.pass=true;
}catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
