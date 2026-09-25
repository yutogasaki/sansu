import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5342',out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-acting';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),report={target:base,version:await fetch(`${base}/version.json`).then(r=>r.json()),scope:'Disposable profile, UI placement/move/undo/admission. Diagnostic timer pulses drive actual saved ticks; no world/offer/food injection. Both widths reduced motion and sound OFF. Blind screenshots hide surrounding UI copy without changing geometry. Independent observers have not participated.',candidate:'nature-town-ground-a-v1',participants:[],devices:[],runtimePass:false};
const button=(p,name)=>p.getByRole('button',{name,exact:true});
async function read(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('SansuNatureTownV02');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('saves').objectStore('saves').getAll();r.onsuccess=()=>{db.close();resolve(JSON.parse(r.result[0].current.payload));};};}));}
try{
 for(const width of [390,768]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:'reduce'});
  await context.addInitScript(()=>{const interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window),callbacks=new Map();let id=-1;window.setInterval=(cb,ms,...args)=>{if(ms===1000&&typeof cb==='function'){const k=id--;callbacks.set(k,()=>cb(...args));return k;}return interval(cb,ms,...args);};window.clearInterval=id=>{if(callbacks.has(id))callbacks.delete(id);else clear(id);};window.__reviewPulse=()=>{for(const cb of callbacks.values())cb();};});
  const page=await context.newPage(),stages=[],errors=[];page.on('pageerror',e=>errors.push(e.message));const pause=async()=>{if(await button(page,'一時停止').count())await button(page,'一時停止').click();};const play=async()=>{if(await button(page,'うごかす').count())await button(page,'うごかす').first().click();};
  const shot=async(name,id)=>{await pause();if(await button(page,'全景').count())await button(page,'全景').click();await page.locator('.town-map-scroll').evaluate(el=>{el.scrollLeft=216-el.clientWidth/2;el.scrollTop=216-el.clientHeight/2;});const save=await read(page);await page.screenshot({path:`${out}/${width}-${id}-full.png`});const style=await page.addStyleTag({content:'.town-header,.town-toolbar,.town-information,.town-panel,.town-confirm,.town-nav{visibility:hidden!important}'});await page.screenshot({path:`${out}/${width}-${id}-blind.png`});await style.evaluate(e=>e.remove());stages.push({id,name,tick:save.world.tick,population:save.world.residents.length,candidate:await page.locator('.nature-town').getAttribute('data-candidate')});};
  const choose=async name=>{await button(page,'どうぐ').click();await page.locator('.town-tools').getByRole('button',{name,exact:true}).click();};const confirm=async()=>{await button(page,'ここにする').click();await button(page,'ここにする').waitFor({state:'detached'});};
  const advance=async()=>{const tick=(await read(page)).world.tick;await page.evaluate(()=>window.__reviewPulse());await page.waitForFunction(t=>Number(document.querySelector('.nature-town')?.getAttribute('data-tick'))===t,tick+1);};
  try{
   await page.goto(base);await page.screenshot({path:`${out}/${width}-launch.png`});await page.waitForURL('**/#/onboarding');await seedNative(page,`Silent ${width}`);await page.goto(`${base}/#/settings`);await page.getByRole('button',{name:/みため と おと|表示とサウンド/}).click();const sound=page.getByText(/^(おと・BGM|サウンド)$/).locator('..').locator('..');await sound.getByRole('button',{name:'OFF',exact:true}).click();await sound.getByRole('button',{name:'ON',exact:true}).waitFor();
   await page.goto(`${base}/#/nature-town`);await page.locator('[data-candidate="nature-town-ground-a-v1"]').waitFor();await pause();await shot('before-house','01');await choose('家');await page.locator('[data-cell="8,6"]').click();await confirm();await button(page,'せかい').click();await shot('placed-house','02');
   await choose('畑');await page.locator('[data-cell="10,3"]').click();await confirm();await button(page,'せかい').click();await shot('before-transfer','03');await play();
   let found=false;for(let i=0;i<360;i++){await advance();if(await page.locator('[data-from^="farm-"]').count()){found=true;break;}}assert.ok(found,'actual farm pickup');await shot('actual-pickup','04');
   assert.ok(await page.locator('[data-pose="receiving"]').count(), 'pickup uses actual receiving pose');
   await button(page,'近く').click();await page.locator('[data-pose="receiving"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-pickup-near.png`});
   await play();let carried=false,given=false;
   for(let i=0;i<120;i++){
    await advance();
    if(!carried&&await page.locator('[data-pose="carrying"]').count()){await pause();await page.locator('[data-pose="carrying"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-carrying-near.png`});carried=true;await play();}
    if(await page.locator('[data-pose="giving"]').count()){await pause();await page.locator('[data-pose="giving"]').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-giving-near.png`});given=true;break;}
   }
   assert.ok(carried&&given,'actual carry and delivery');
   for(const resident of (await read(page)).world.residents){const marker=page.locator(`[data-resident-id="${resident.id}"]`);assert.equal(await marker.locator('.town-cargo').count(),resident.carriedFood>0?1:0);}
   const original=(await read(page)).world;
   await page.reload();await page.locator('.nature-town').waitFor();await pause();
   assert.equal(await page.locator('[data-pose="giving"],[data-pose="receiving"]').count(),0,'reload does not replay events');
   assert.equal((await read(page)).world.tick,original.tick);
   await page.waitForFunction(()=>[...document.querySelectorAll('.town-resident-body img,.town-prop-art')].every(i=>i.complete&&i.naturalWidth===160));
   assert.equal(await page.locator('.nature-town canvas').count(),0,'no runtime WebGL');

   const farm=(await read(page)).world.props.find(p=>p.kind==='farm'&&!p.stored);await page.locator(`[data-cell="${farm.position.join(',')}"]`).click();await page.locator('.town-panel').getByRole('button',{name:'うごかす',exact:true}).click();await page.locator('[data-cell="14,6"]').click();await confirm();await page.locator('[data-cell="14,6"] [data-connection="blocked"]').waitFor();await shot('disconnected','05');await button(page,'取り消し').click();await button(page,'せかい').click();await shot('restored','06');
   await play();for(let i=0;i<1800&&!(await read(page)).world.offer;i++)await advance();assert.equal((await read(page)).world.offer?.status,'pending');await shot('offer','07');await page.locator('.town-offer button').first().click();await page.waitForFunction(()=>document.querySelector('.nature-town')?.getAttribute('data-population')==='4');await shot('admitted','08');await page.screenshot({path:`${out}/${width}-final.png`});assert.deepEqual(errors,[]);
   report.devices.push({width,reducedMotion:true,sound:'OFF',stages,runtimePass:true});
  }finally{await context.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
 }
 report.runtimePass=true;
}catch(error){report.error=error.stack;throw error;}finally{await browser.close();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
