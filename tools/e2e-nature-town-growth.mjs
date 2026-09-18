import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative, readNative, answerUI, waitMode } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5336';
const out=process.env.SANSU_TOWN_OUTPUT||'output/nature-town-growth';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,fixture:'Disposable native profile only. Actual UI commands, ordinary learning and 2x speed; no town, credit, offer, or clock injection.',devices:[],pass:false};
async function waitUntil(predicate,{timeout=45000,interval=250,label='town condition'}={}) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,interval));}
 throw new Error(`Timed out: ${label}`);
}
async function readTown(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('SansuNatureTownV02');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,q=db.transaction('saves').objectStore('saves').getAll();q.onsuccess=()=>{db.close();resolve(JSON.parse(q.result[0].current.payload));};q.onerror=()=>reject(q.error);};}));}
try{
 await Promise.all([390,768].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:width===768?'reduce':'no-preference'}),page=await context.newPage();
  page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const stages=[];
  const button=name=>page.getByRole('button',{name,exact:true});
  const cell=pos=>page.locator(`[data-cell="${pos.join(',')}"]`);
  const pause=async()=>{if(await button('一時停止').count())await button('一時停止').click();};
  const run=async()=>{if(await button('1倍').count())await button('1倍').click();if(await button('うごかす').count())await button('うごかす').first().click();};
  const shot=async name=>{const s=await readTown(page);stages.push({name,tick:s.world.tick,population:s.world.residents.length,chunks:s.world.chunks.length,awards:s.progress.awards.length,unlocks:s.progress.unlocks.map(u=>u.capability)});await page.screenshot({path:`${out}/${width}-${name}.png`});console.log(width,name,stages.at(-1));return s;};
  const choose=async name=>{await button('どうぐ').click();await page.locator('.town-tools').getByRole('button',{name,exact:true}).click();};
  const confirm=async()=>{assert.equal(await button('ここにする').isEnabled(),true,await page.locator('.town-information').innerText());await button('ここにする').click();await button('ここにする').waitFor({state:'detached'});};
  const place=async(name,pos)=>{await choose(name);await cell(pos).click();await confirm();};
  const brush=async(name,positions)=>{await choose(name);for(const p of positions){await cell(p).scrollIntoViewIfNeeded();await cell(p).focus();await cell(p).press('Enter');}await confirm();};
  try{
   await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();const profileId=await seedNative(page,`Growth ${width}`);await page.goto(`${base}/#/nature-town`);await page.locator('.nature-town').waitFor();await pause();
   const initial=await shot('initial');
   await place('家',[8,6]);await place('畑',[10,3]);await button('せかい').click();await cell([8,8]).click();await page.locator('.town-settlement-status').waitFor();await shot('supply-readying');await run();
   await page.locator('.town-offer').waitFor({timeout:900000});await pause();const offered=await shot('offer');assert.equal(offered.world.residents.length,3);
   await cell([8,6]).click();await button('しまう').click();await page.getByText(/旅人は あとで むかえられるよ/).waitFor();
   await page.reload();await page.locator('.nature-town').waitFor();await pause();assert.equal((await readTown(page)).world.offer.id,offered.world.offer.id);
   await button('どうぐ').click();await button('家を またおく').click();await cell([8,6]).click();await confirm();await button('せかい').click();
   await page.locator('.town-offer button').first().click();await page.waitForFunction(()=>document.querySelector('.nature-town')?.getAttribute('data-population')==='4');
   const admitted=await shot('admitted');assert.equal(new Set(admitted.world.residents.map(r=>r.id)).size,4);
   await cell([8,8]).click();await run();
   await waitUntil(async()=>{const s=await readTown(page);return s.world.hubMetrics[0].history.some(h=>h.tick>admitted.world.tick&&h.requested===4);},{timeout:90000,interval:500,label:'new population demand'});await pause();await shot('four-person-demand');
   // Both boundaries use real continuous roads. The east river requires the initial bridge tool.
   await brush('道',Array.from({length:7},(_,i)=>[8,9+i]));await button('せかい').click();await button('北へ ひろげる').click();await page.waitForFunction(()=>document.querySelectorAll('.town-cell').length===512);
   await brush('橋',[[12,9]]);await brush('道',[[13,9],[14,9],[15,9]]);await button('せかい').click();await button('東へ ひろげる').click();await page.waitForFunction(()=>document.querySelectorAll('.town-cell').length===768);
   await page.getByText('この試作で遊べる 3地区が ひらいたよ。').waitFor();const expanded=await shot('three-regions');assert.deepEqual(expanded.world.residents.map(r=>r.id),admitted.world.residents.map(r=>r.id));assert.equal(expanded.world.foodAccounting.initialized,initial.world.foodAccounting.initialized);
   // Keep the same productive farm and its inventory when moving into the dry north.
   await button('せかい').click();await run();
   await waitUntil(async()=>{const s=await readTown(page);return s.world.props.find(p=>p.kind==='farm'&&p.position.join(',')==='10,3').inventory.food>=4;},{timeout:120000,label:'four actual harvested items'});await pause();
   await place('食たく',[7,16]);await place('家',[6,16]);
   await button('せかい').click();await cell([10,3]).click();await page.locator('.town-panel').getByRole('button',{name:'うごかす',exact:true}).click();await cell([7,18]).click();await confirm();
   await cell([10,6]).click();await button('しまう').click();
   let state=await readTown(page);const remoteHub=state.world.props.find(p=>p.kind==='hub'&&p.position.join(',')==='7,16'),remoteFarm=state.world.props.find(p=>p.kind==='farm'&&p.position.join(',')==='7,18');assert.equal(remoteHub.inventory.food,0,'remote stock is not global');
   await brush('道',[[8,15],[8,16],[8,17],[7,17],[8,17],[8,18],[8,19],[7,19]]);
   await button('せかい').click();await cell([8,6]).click();await page.getByRole('combobox',{name:'家の食たく'}).selectOption(remoteHub.id);
   await cell([7,18]).click();const dry=await shot('dry-north');
   // Earn six actual completed learning sections. The normal UI commits all facts.
   const pausedTick=dry.world.tick;await button('れんしゅう').click();await waitMode(page,'learning');
   for(let answers=0;answers<100;answers++){
    const native=await readNative(page,profileId);if(native.islandPlans.filter(p=>p.status==='completed').length>=6)break;
    await answerUI(page,native.plan,{dev:false});
   }
   assert.equal((await readNative(page,profileId)).islandPlans.filter(p=>p.status==='completed').length,6);
   await button('とじる').click();await page.locator('.nature-town:visible').waitFor();
   await waitUntil(async()=> (await readTown(page)).progress.awards.length===6,{label:'six durable section credits'});
   assert.equal((await readTown(page)).world.tick,pausedTick);
   await button('どうぐ').click();await page.locator('.town-unlock').filter({hasText:'水路 —'}).getByRole('button',{name:'ひらく',exact:true}).click();await page.locator('.town-unlock').filter({hasText:'台車 —'}).getByRole('button',{name:'ひらく',exact:true}).click();
   await waitUntil(async()=> (await readTown(page)).progress.unlocks.length===2,{label:'both earned tools'});await shot('earned-tools');
   await brush('水路',[[11,18],[10,18],[9,18],[8,18]]);await button('せかい').click();await cell([7,16]).click();await button('台車をつかう').click();
   await run();
   await waitUntil(async()=>{const s=await readTown(page);return s.world.chunks.flatMap(c=>c.cells).find(c=>c.position.join(',')==='7,18').moisture>.5;},{timeout:45000,interval:500,label:'irrigation changes dry farm'});
   // Capture one real four-item cart pickup from the same newly irrigated farm.
   const cart=page.locator(`[data-from="${remoteFarm.id}"][data-quantity="4"]`);
   await cart.waitFor({timeout:240000});const carrier=await cart.getAttribute('data-to');await pause();const carried=await shot('cart-four');assert.equal(carried.world.residents.find(r=>r.id===carrier).carriedFood,4);
   await run();await page.locator(`[data-from="${carrier}"][data-to="${remoteHub.id}"]`).waitFor({timeout:240000});await pause();const delivered=await shot('remote-delivery');assert.ok(delivered.world.props.find(p=>p.id===remoteHub.id).inventory.food>0);
   assert.ok(delivered.world.chunks.flatMap(c=>c.cells).find(c=>c.position.join(',')==='7,18').moisture>dry.world.chunks.flatMap(c=>c.cells).find(c=>c.position.join(',')==='7,18').moisture);
   await page.reload();await page.locator('.nature-town').waitFor();await pause();const resumed=await shot('resumed');assert.equal(resumed.progress.awards.length,6);assert.equal(resumed.progress.unlocks.length,2);assert.equal(resumed.world.chunks.length,3);assert.equal(resumed.world.residents.length,4);assert.deepEqual(errors,[]);
   report.devices.push({width,stages,pass:true,metadata:await page.evaluate(()=>({revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),candidate:document.querySelector('.nature-town')?.getAttribute('data-candidate'),sw:!!navigator.serviceWorker.controller}))});
  }catch(error){await page.screenshot({path:`${out}/${width}-failure.png`});await fs.writeFile(`${out}/${width}-failure-save.json`,JSON.stringify(await readTown(page)));throw error;}finally{await context.close();}
 }));report.pass=true;
}catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
