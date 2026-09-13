import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_BELONGINGS_URL;
const out = process.env.SANSU_BELONGINGS_OUTPUT;
assert(base && out, 'Specify the target and fresh output directory');
await mkdir(out, {recursive:true});
const browser = await chromium.launch();
const report={target:base,version:await fetch(new URL('/version.json',base)).then(r=>r.json()).catch(()=>null), fixture:'Disposable historical credits and placed items, not earned learning evidence',humanN:0,scenarios:[]};
async function record(page, update) {
 return page.evaluate(async update => {
  const names=await indexedDB.databases(); const name=names.find(d=>d.name.startsWith('SansuIslandLife'))?.name;
  const req=indexedDB.open(name); const db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error)});
  const tx=db.transaction('worlds',update?'readwrite':'readonly'); const store=tx.objectStore('worlds'); const get=store.getAll();
  const done=new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=()=>j(tx.error)});
  const rows=await new Promise((r,j)=>{get.onsuccess=()=>r(get.result);get.onerror=()=>j(get.error)}); let row=rows[0];
  if(update){
   const now=Date.now(), start=now-7*3600000; const day=new Date(start);day.setHours(day.getHours()-4);
   const dayKey=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
   row={...row,createdAt:start,now,realAt:now,activitiesV2At:start,activitiesV2After:0,offsets:[{at:start,offset:0}],
    credits:Array.from({length:20},(_,i)=>({id:`qa-credit-${i}`,at:start,day:dayKey})),
    actions:[{id:'qa-flower',at:start+1000,command:{type:'buy',kind:'flower',cell:{x:0,z:2}}},{id:'qa-bench',at:start+2000,command:{type:'buy',kind:'bench',cell:{x:4,z:2}}}]};store.put(row);
  }
  await done;db.close();return row;
 },update);
}
try {
 for(const [name,width,height] of [['phone',390,844],['tablet',768,1024],['small',320,568]]) {
  if(process.env.SANSU_BELONGINGS_WIDTH && width !== Number(process.env.SANSU_BELONGINGS_WIDTH)) continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:name==='tablet'?'reduce':'no-preference'});
  const page=await context.newPage(); page.setDefaultTimeout(20000); const errors=[];let candidate;page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.locator('.life-world[data-rendered="true"]').waitFor();
  const shot=async label=>{await page.screenshot({path:`${out}/${name}-${label}.png`});};
  const tab=async label=>{if(!await page.locator('.life-menu').count())await page.getByRole('button',{name:'つくる',exact:true}).click();await page.locator('.life-menu-tabs').getByRole('button',{name:label,exact:true}).click();};
  const images=()=>page.waitForFunction(()=>[...document.querySelectorAll('.life-menu .life-product-preview img')].every(img=>img.complete&&img.naturalWidth>0&&!img.hidden));
  const close=()=>page.getByRole('button',{name:'メニューを とじる',exact:true}).click();
  try {
   await page.goto(base);
   for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await page.getByRole('button',{name,exact:true}).first().click();
   await page.locator('.island-learning[data-input-ready="true"]').waitFor();await page.getByRole('button',{name:'とじる',exact:true}).click();await ready();candidate=await page.locator('[data-life-candidate]').getAttribute('data-life-candidate');await shot('island');
   await page.getByRole('button',{name:'しまの ようす',exact:true}).click();assert.equal(await page.locator('.life-dock .life-tabs').count(),0);assert.equal(await page.locator('.life-residents > span').count(),3);await shot('residents');await page.getByRole('button',{name:'しまの ようすを とじる',exact:true}).click();
   await tab('もちもの');await shot('empty');await page.getByRole('button',{name:'つくるものを えらぶ',exact:true}).click();assert.equal(await page.locator('[data-life-buy="flower"]').count(),1);
   await tab('いろ');await images();assert(await page.locator('[data-life-style="sunshine"]').isDisabled());await shot('style-empty');
   await tab('ひろげる');assert(await page.locator('.life-land-confirm').isDisabled());await close();
   const native=await readNative(page);await record(page,true);await page.reload();await ready();
   const initial=await record(page);await tab('もちもの');await images();await shot('inventory');
   await page.locator('[data-life-item="qa-flower"]').click();await images();await shot('detail');
   await page.getByRole('button',{name:'いろを かえる',exact:true}).click();await images();await shot('flower-colors');
   assert.equal((await record(page)).actions.length,initial.actions.length,'Viewing previews must not spend or mutate ownership');
   await page.locator('[data-life-style="starlight"]').click();await page.waitForFunction(()=>document.querySelector('[data-life-style="starlight"]')?.getAttribute('aria-pressed')==='true');
   assert.equal((await record(page)).actions.at(-1).command.itemId,'qa-flower');
   await page.getByRole('button',{name:'ぽこもこの いろへ',exact:true}).click();await images();await shot('hero-colors');
   await page.locator('[data-life-style="sunshine"]').click();await page.waitForFunction(()=>document.querySelector('[data-life-style="sunshine"]')?.getAttribute('aria-pressed')==='true');
   assert.equal((await record(page)).actions.at(-1).command.itemId,undefined);
   await tab('もちもの');await page.locator('[data-life-item="qa-flower"]').click();await page.getByRole('button',{name:'しまう',exact:true}).click();await page.getByText('しまってある',{exact:true}).waitFor();
   await page.getByRole('button',{name:'おく',exact:true}).click();await page.getByRole('button',{name:'マスから えらぶ',exact:true}).click();
   // First row has a vacant legal cell; storage does not reset the item's growth or style.
   await page.locator('[data-life-cell="0,0"]').click();await page.getByRole('button',{name:'ここに おく',exact:true}).click();await page.locator('.life-placement').waitFor({state:'hidden'});
   await tab('ひろげる');await page.getByRole('button',{name:'ひだりへ',exact:true}).click();await shot('expand-preview');
   const before=await record(page);assert.equal(await page.locator('[data-proposed="true"]').count(),15);assert(!before.actions.some(a=>a.command.type==='expand'));
   await page.locator('.life-land-confirm').click();await page.getByText('ひろがった しま',{exact:true}).waitFor();assert.equal((await record(page)).actions.at(-1).command.side,'west');await shot('expanded');
   await page.reload();await ready();await tab('もちもの');await page.locator('[data-life-item="qa-flower"]').click();await images();await shot('restored');assert.match(await page.locator('.life-item-growth-detail').innerText(),/さいた/);
   assert.deepEqual(await readNative(page),native,'Editing preserves learning tables');
   await close();await page.getByRole('navigation',{name:'メインメニュー'}).getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('.island-learning[data-input-ready="true"]').waitFor();await shot('learning');
   assert.equal(errors.length,0,errors.join('\n'));
   report.scenarios.push({name,width,height,pass:true,candidate,actions:(await record(page)).actions.map(a=>a.command)});
   console.log(name+' PASS');
  }catch(e){await shot('failure');report.scenarios.push({name,pass:false,error:String(e),body:await page.locator('body').innerText(),errors});throw e;}finally{await context.close();}
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
