import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { seedNative } from './island-e2e-helpers.mjs';
const base=process.env.SANSU_TOWN_URL||'http://127.0.0.1:5233';
const out=process.env.SANSU_TOWN_OUTPUT||'output/nature-town-editing';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={target:base,fixture:'Disposable native profile. Final conflict diagnostic changes only stored generation; no world or learning injection.',devices:[],pass:false};
const row=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('SansuNatureTownV02');open.onsuccess=()=>{const db=open.result,q=db.transaction('saves').objectStore('saves').getAll();q.onsuccess=()=>{resolve(q.result[0]);db.close();};q.onerror=()=>reject(q.error);};open.onerror=()=>reject(open.error);}));
try {
 for(const viewport of [{width:390,height:844},{width:768,height:1024}]) {
  const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:viewport.width===768?'reduce':'no-preference'}), page=await context.newPage();
  page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();await seedNative(page,`Editing ${viewport.width}`);await page.goto(`${base}/#/nature-town`);
  await page.locator('.nature-town').waitFor();await page.getByRole('button',{name:'一時停止',exact:true}).click();
  await page.getByRole('button',{name:'住人をさがす',exact:true}).click();await page.locator('.town-resident-list button').first().click();
  const person=await page.locator('.town-resident-detail').getAttribute('data-resident-id');
  await page.getByRole('button',{name:'うごかす',exact:true}).click();
  const beforeTick=Number(await page.locator('.nature-town').getAttribute('data-tick'));
  await page.waitForFunction(t=>Number(document.querySelector('.nature-town')?.getAttribute('data-tick'))>=t+3,beforeTick);
  await page.getByRole('button',{name:'一時停止',exact:true}).click();
  assert.equal(await page.locator('.town-resident-detail').getAttribute('data-resident-id'),person);
  await page.screenshot({path:`${out}/${viewport.width}-resident.png`});
  await page.getByRole('button',{name:'住人のようすを閉じる',exact:true}).click();
  await page.getByRole('button',{name:'どうぐ',exact:true}).click();await page.getByRole('button',{name:'道',exact:true}).click();
  const cell=p=>page.locator(`[data-cell="${p}"]`);
  await cell('8,6').scrollIntoViewIfNeeded();
  const point=async p=>{const b=await cell(p).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const a=await point('7,6'),b=await point('9,6');
  const cdp=await context.newCDPSession(page);
  if(viewport.width===390){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();}
  assert.equal(await page.locator('.town-cell.pending').count(),3,'continuous stroke fills skipped cells');
  const cancelPoint=await point('8,7'),afterCancel=await point('10,7');
  assert.equal(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('.town-map'),cancelPoint),true,'touch target is inside unobscured map');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...cancelPoint,id:2}]});
  await page.waitForFunction(()=>document.querySelectorAll('.town-cell.pending').length===4);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.mouse.move(afterCancel.x,afterCancel.y);
  assert.equal(await page.locator('.town-cell.pending').count(),4,'cancelled pointer cannot continue painting');
  await page.screenshot({path:`${out}/${viewport.width}-brush.png`});
  await page.getByRole('button',{name:'地図を動かす',exact:true}).click();await cell('8,5').click();assert.equal(await page.locator('.town-cell.pending').count(),4,'pan mode does not paint');
  await page.getByRole('button',{name:'ここにする',exact:true}).click();await cell('8,6').filter({has:page.locator('svg')}).waitFor();
  await page.getByRole('button',{name:'せかい',exact:true}).click();await page.getByRole('button',{name:'取り消し',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-cell="8,6"]')?.classList.contains('path'));
  await page.getByRole('button',{name:'どうぐ',exact:true}).click();await page.getByRole('button',{name:'花',exact:true}).click();
  await cell('12,6').click();assert.equal(await page.getByRole('button',{name:'ここにする',exact:true}).isDisabled(),true);assert.equal(await page.locator('.town-cell.pending.invalid').count(),1);
  await page.screenshot({path:`${out}/${viewport.width}-invalid.png`});
  await cell('8,6').click();assert.equal(await page.getByRole('button',{name:'ここにする',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'ここにする',exact:true}).click();await page.getByRole('button',{name:'8,6 花',exact:true}).waitFor();
  const saved=await row(page);
  const other=await context.newPage();await other.goto(`${base}/#/nature-town`);await other.getByText(/別のタブで この島を/).waitFor();await other.getByRole('button',{name:'前の保存を確認する',exact:true}).click();await other.getByText(/この画面では復旧できません/).waitFor();assert.equal((await row(page)).generation,saved.generation);await other.close();
  // Explicit stale-writer diagnostic. The rejected confirmation must preserve the edit.
  await page.getByRole('button',{name:'花',exact:true}).click();await cell('8,5').click();
  await page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('SansuNatureTownV02');open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),q=store.getAll();q.onsuccess=()=>store.put({...q.result[0],generation:q.result[0].generation+1});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
  await page.getByRole('button',{name:'ここにする',exact:true}).click();await page.getByRole('alert').filter({hasText:'別の画面で島が変わりました'}).waitFor();
  assert.equal(await page.locator('.town-cell.pending').count(),1);assert.equal(await page.getByRole('button',{name:'やめる',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'ここにする',exact:true}).isDisabled(),true);
  assert.equal((await row(page)).current.payload,saved.current.payload,'rejected writer does not mutate world');
  await page.screenshot({path:`${out}/${viewport.width}-conflict.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  report.devices.push({viewport,person,pass:true,metadata:await page.evaluate(()=>({revision:document.querySelector('.app-container')?.getAttribute('data-build-revision'),delivery:document.querySelector('.app-container')?.getAttribute('data-delivery-id')}))});await context.close();
 }
 report.pass=true;
} catch(error){report.error=error.stack;throw error;}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
