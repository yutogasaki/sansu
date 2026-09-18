import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5233';
const diagnostic=process.env.SANSU_TOWN_LIVING_DIAGNOSTIC==='1';
const out=process.env.SANSU_TOWN_OUTPUT||'output/nature-town-living';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,fixture:'Disposable native profile; unmodified starter town. User-facing 2x speed only, no clock, food, or job injection.',diagnostic,devices:[],pass:false};
try {
 await Promise.all([390,768].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:width===768?'reduce':'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();await seedNative(page,`Living ${width}`);await page.goto(`${base}/#/nature-town`);
   await page.locator('[data-candidate="nature-town-living-s1"]').waitFor();
   await page.getByRole('button',{name:'1倍',exact:true}).click();
   await page.screenshot({path:`${out}/${width}-ready.png`});
   let captures=[];
   if(!diagnostic){
   // Record committed state presentations while ordinary ticks proceed. No writes to app state.
   await page.evaluate(()=>{
    window.__townSeen={harvest:false,pickup:false,delivery:false,meal:false};
    new MutationObserver(()=>{
     const seen=window.__townSeen;
     if(document.querySelector('[data-recent-harvest]:not([data-recent-harvest="0"])'))seen.harvest=true;
     if(document.querySelector('[data-from^="farm-"]'))seen.pickup=true;
     if(document.querySelector('[data-to^="hub-"]'))seen.delivery=true;
     if(document.querySelector('[data-meal-served]:not([data-meal-served="0"])'))seen.meal=true;
    }).observe(document.querySelector('.nature-town'),{attributes:true,childList:true,subtree:true});
   });
   const stages=[['harvest','[data-recent-harvest]:not([data-recent-harvest="0"])'],['pickup','[data-from^="farm-"]'],['delivery','[data-to^="hub-"]'],['meal','[data-meal-served]:not([data-meal-served="0"])']];
   // Independent waits capture each real event, even if meal and delivery occur in a different order.
   captures=await Promise.all(stages.map(async([name,selector])=>{
    await page.locator(selector).first().waitFor({timeout:240000});
    if(name==='pickup'&&width===768)assert.equal(await page.locator('.town-transfer-fruit').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    const event=await page.locator(selector).first().evaluate(el=>Object.fromEntries([...el.attributes].map(a=>[a.name,a.value])));
    await page.screenshot({path:`${out}/${width}-${name}.png`});return{name,event};
   }));
   assert.deepEqual(await page.evaluate(()=>window.__townSeen),{harvest:true,pickup:true,delivery:true,meal:true});
   }
   await page.getByRole('button',{name:'一時停止',exact:true}).click();
   // Crop and table are drawn from actual committed inventory, including after reload.
   await page.reload();await page.locator('.nature-town').waitFor();await page.getByRole('button',{name:'一時停止',exact:true}).click();
   assert.equal(await page.locator('[data-transfer-id]').count(),0,'reload does not replay prior transfers');
   assert.equal(await page.locator('[data-meal-served]:not([data-meal-served="0"])').count(),0,'reload does not invent a fresh meal');
   const row=await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('SansuNatureTownV02');open.onsuccess=()=>{const db=open.result,q=db.transaction('saves').objectStore('saves').getAll();q.onsuccess=()=>{resolve(JSON.parse(q.result[0].current.payload));db.close();};};}));
   for(const prop of row.world.props.filter(p=>!p.stored&&['farm','hub'].includes(p.kind))){
    const food=page.locator(`[data-cell="${prop.position.join(',')}"] [data-food]`);
    if(prop.inventory.food>0||prop.kind==='hub')assert.equal(Number(await food.getAttribute('data-food')),prop.inventory.food);
   }
   // The starter river has no bridge: moving the same farm across it disconnects supply.
   const farm=row.world.props.find(p=>p.kind==='farm'&&!p.stored), opposite=[14,6];
   await page.locator(`[data-cell="${farm.position.join(',')}"]`).click();
   await page.locator('.town-panel').getByRole('button',{name:'うごかす',exact:true}).click();
   await page.locator(`[data-cell="${opposite.join(',')}"]`).click();
   assert.equal(await page.getByRole('button',{name:'ここにする',exact:true}).isEnabled(),true);
   await page.getByRole('button',{name:'ここにする',exact:true}).click();
   await page.locator(`[data-cell="${opposite.join(',')}"] [data-connection="blocked"]`).waitFor();
   await page.locator(`[data-cell="${opposite.join(',')}"]`).click();await page.getByText(/食たくまで 通れる道が ないよ/).waitFor();
   await page.screenshot({path:`${out}/${width}-blocked.png`});
   await page.getByRole('button',{name:'取り消し',exact:true}).click();
   await page.getByRole('button',{name:`${farm.position.join(',')} 畑`,exact:true}).waitFor();
   assert.equal(await page.locator(`[data-cell="${farm.position.join(',')}"] [data-connection="blocked"]`).count(),0);
   assert.deepEqual(errors,[]);
   report.devices.push({width,captures,candidate:await page.locator('.nature-town').getAttribute('data-candidate'),pass:true});
  }catch(error){await page.screenshot({path:`${out}/${width}-failure.png`});throw error;}finally{await context.close();}
 }));
 report.pass=true;
}catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
