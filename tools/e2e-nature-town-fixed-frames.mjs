import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedNative } from './island-e2e-helpers.mjs';

assert.equal(process.platform,'linux','BeginFrameControl requires the Linux runner for this harness');
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5339';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-fixed-frames';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--run-all-compositor-stages-before-draw']});
const root=await browser.newBrowserCDPSession();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const report={target:base,version:await fetch(`${base}/version.json`).then(r=>r.json()),browser:browser.version(),platform:process.platform,commit:process.env.GITHUB_SHA,scope:'Native compositor BeginFrameControl, 30/60 Hz frameTimeTicks intervals verified against unmodified requestAnimationFrame timestamps. Actual app timer callback advances once per logical second after exactly fps frames. Disposable profile; initial UI placements cloned across runs. Physical screen refresh rate and wall-clock throughput are not measured.',runs:[],pass:false};
async function instrument(context){await context.addInitScript(()=>{
 const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window),callbacks=new Map();let id=-1;
 window.setInterval=(cb,ms,...args)=>{if(ms===1000&&typeof cb==='function'){const token=id--;callbacks.set(token,()=>cb(...args));return token;}return interval(cb,ms,...args);};
 window.clearInterval=token=>{if(callbacks.has(token))callbacks.delete(token);else clear(token);};
 window.__fixedFrames={pulse:()=>{for(const cb of callbacks.values())cb();},frames:[]};
 const record=t=>{window.__fixedFrames.frames.push(t);requestAnimationFrame(record);};requestAnimationFrame(record);
 });}
async function town(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('SansuNatureTownV02');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,q=db.transaction('saves').objectStore('saves').get('Frame owner');q.onsuccess=()=>{db.close();resolve(JSON.parse(q.result.current.payload));};q.onerror=()=>reject(q.error);};}));}
async function ready(p){await p.locator('.nature-town').waitFor();await p.waitForFunction(()=>!document.querySelector('.town-nav button:last-child')?.disabled,undefined,{polling:20});}
try{
 const setup=await browser.newContext({viewport:{width:390,height:844}});await instrument(setup);const p=await setup.newPage();await p.goto(base);await p.waitForURL('**/#/onboarding');await seedNative(p,'Frame owner');await p.goto(`${base}/#/nature-town`);await ready(p);await button(p,'一時停止').click();
 for(const [name,cell] of [['家','8,6'],['畑','10,3']]){await button(p,'どうぐ').click();await p.locator('.town-tools').getByRole('button',{name,exact:true}).click();await p.locator(`[data-cell="${cell}"]`).click();await button(p,'ここにする').click();await button(p,'ここにする').waitFor({state:'detached'});}
 await button(p,'せかい').click();const initial=await town(p),storageState=await setup.storageState({indexedDB:true});report.initialHash=hash(initial.world);await setup.close();let expected;
 for(const fps of [60,30]){
  const context=await browser.newContext({storageState,viewport:{width:fps===60?390:768,height:fps===60?844:1024},reducedMotion:fps===60?'no-preference':'reduce'});await instrument(context);
  const bootstrap=await context.newPage(),session=await context.newCDPSession(bootstrap);const {targetInfo}=await session.send('Target.getTargetInfo');
  const waiting=context.waitForEvent('page');await root.send('Target.createTarget',{url:'about:blank',browserContextId:targetInfo.browserContextId,enableBeginFrameControl:true,width:fps===60?390:768,height:fps===60?844:1024});const page=await waiting;await bootstrap.close();
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const metrics=await cdp.send('Performance.getMetrics');let time=metrics.metrics.find(m=>m.name==='Timestamp').value*1000;const interval=1000/fps;
  const frame=async screenshot=>{time+=interval;return cdp.send('HeadlessExperimental.beginFrame',{frameTimeTicks:time,interval,...(screenshot?{screenshot:{format:'png'}}:{})});};
  let pumping=true,pumpError;const pump=(async()=>{try{while(pumping){await frame();await new Promise(r=>setTimeout(r,5));}}catch(e){pumpError=e;}})();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`${base}/#/nature-town`);await ready(page);assert.deepEqual((await town(page)).world,initial.world);
   if(fps===30){await button(page,'全景').click();await page.getByRole('combobox',{name:'地図の見え方'}).selectOption('moisture');await page.goto(`${base}/#/settings`);await page.getByRole('button',{name:/みため と おと|表示とサウンド/}).click();const sound=page.getByText(/^(おと・BGM|サウンド)$/).locator('..').locator('..');await sound.getByRole('button',{name:'OFF',exact:true}).click();await page.goto(`${base}/#/nature-town`);await ready(page);await button(page,'全景').click();await page.getByRole('combobox',{name:'地図の見え方'}).selectOption('moisture');}
   pumping=false;await pump;if(pumpError)throw pumpError;
   await page.evaluate(()=>{window.__fixedFrames.frames=[];});const started=Date.now();
   for(let tick=1;tick<=120;tick++){
    for(let f=0;f<fps;f++)await frame();
    await page.evaluate(()=>window.__fixedFrames.pulse());await page.waitForFunction(t=>Number(document.querySelector('.nature-town')?.getAttribute('data-tick'))===t,tick,{polling:10,timeout:15000});
    if(tick%30===0)console.log(fps,'Hz',tick,'ticks');
   }
   const final=await town(page),frames=await page.evaluate(()=>window.__fixedFrames.frames),deltas=frames.slice(1).map((t,i)=>t-frames[i]);
   await fs.writeFile(`${out}/${fps}hz-frame-times.json`,JSON.stringify({requestedInterval:interval,frames,deltas}));
   const anomalies=deltas.map((d,i)=>({d,i})).filter(x=>Math.abs(x.d-interval)>=.1);console.log('cadence',fps,{count:deltas.length,min:Math.min(...deltas),max:Math.max(...deltas),anomalies:anomalies.slice(0,12)});
   // Non-isolated DOMHighResTimeStamp is coarsened to 100us with jitter;
   // an interval subtracts two such timestamps. Preserve exact frame count
   // and cumulative cadence, allowing only the 0.2ms quantization envelope.
   assert.equal(frames.length,fps*120,'every requested native frame produced RAF');
   assert.ok(deltas.every(d=>Math.abs(d-interval)<=.201),`native RAF cadence must match ${fps} Hz within timestamp precision`);
   assert.ok(Math.abs(frames.at(-1)-frames[0]-(frames.length-1)*interval)<=.201,'no accumulated frame drift');
   if(expected)assert.deepEqual(final.world,expected,'all world state, inventory, resident paths and random ordinals match at the same tick');else expected=final.world;
   assert.deepEqual(final.progress,initial.progress);assert.deepEqual(errors,[]);
   const capture=await frame(true);assert.ok(capture.screenshotData);await fs.writeFile(`${out}/${fps}hz.png`,Buffer.from(capture.screenshotData,'base64'));
   const identity=await page.evaluate(()=>({revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),candidate:document.querySelector('.nature-town')?.getAttribute('data-candidate')}));
   report.runs.push({fps,identity,frames:frames.length,intervalMin:Math.min(...deltas),intervalMax:Math.max(...deltas),intervalMean:deltas.reduce((s,n)=>s+n,0)/deltas.length,tick:final.world.tick,worldHash:hash(final.world),ordinals:final.world.randomEvaluationOrdinals,wallMs:Date.now()-started,pass:true});console.log('PASS',fps,'Hz');
  }finally{pumping=false;await pump;await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
 }
 report.pass=true;
}catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
