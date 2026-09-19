import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inventory,closeMenu} from '../island-life-ui-helpers.mjs';
const target='http://127.0.0.1:5250/',out=process.env.HUT_RUNTIME_OUTPUT||'output/playwright/hut-runtime';
await mkdir(out,{recursive:true});
const files=['src/components/island/life/runtimeAssets.ts','src/components/island/life/runtimeAssetSlots.ts','src/components/island/life/scene.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const report={target,candidate:'island-life-runtime-assets-v3',flag:'VITE_ISLAND_RUNTIME_ASSETS=true',sourceHashes:await hashes(),fixture:'Synthetic learning credits in disposable browser; real commandLife purchase; real UI visit. No Meshy calls.',runs:[]};
const browser=await chromium.launch();
try{for(const width of [390,768]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:width===768?'reduce':'no-preference'});
 const p=await context.newPage(),errors=[];p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(target);
 for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).first().click();
 await p.locator('.island-learning[data-input-ready="true"]').waitFor();await p.getByRole('button',{name:'とじる',exact:true}).click();
 await p.locator('.life-world[data-rendered="true"]').waitFor();await p.screenshot({path:`${out}/${width}-launch.png`});
 const fixture=await p.evaluate(async()=>{
  const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {commandLife,replayLife}=await import('/src/domain/islandLife/simulation.ts');const {learningDay}=await import('/src/domain/islandLife/model.ts');
  let r=(await lifeDb.worlds.toArray())[0];const at=Math.max(Date.now(),r.now)+1;
  r={...r,credits:[...r.credits,...Array.from({length:100},(_,i)=>({id:`hut-qa-${i}`,at,day:learningDay(at)}))]};
  r=commandLife(r,{type:'buy',kind:'bench',cell:{x:0,z:3}},'qa-runtime-bench',at+1);
  r=commandLife(r,{type:'buy',kind:'garden-hut',cell:{x:4,z:0}},'qa-runtime-hut',at+2);
  r=commandLife(r,{type:'visit',itemId:'qa-runtime-bench'},'qa-runtime-start-at-bench',at+3);
  r={...r,realAt:Date.now()};await lifeDb.worlds.put(r);
  return {profileId:r.profileId,item:replayLife(r).items.find(i=>i.kind==='garden-hut')};
 });assert(fixture.item);await p.reload();
 const ready=()=>p.waitForFunction(()=>{try{const d=JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}');return d.loaded?.includes('garden-hut')&&d.pending.length===0;}catch{return false;}});
 await ready();await p.waitForFunction(()=>JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses||'[]').some(p=>p.id==='pokomoko'&&p.itemId==='qa-runtime-bench'&&p.phase==='bench'));await p.screenshot({path:`${out}/${width}-placed.png`});
 await inventory(p,fixture.item.id);await p.getByRole('button',{name:'ぽこもこを よぶ',exact:true}).click();await closeMenu(p);
 await p.waitForFunction(id=>JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses||'[]').some(p=>p.id==='pokomoko'&&p.itemId===id&&p.phase==='walking'),fixture.item.id);
 await p.screenshot({path:`${out}/${width}-approach.png`});
 await p.waitForFunction(id=>JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses||'[]').some(p=>p.id==='pokomoko'&&p.itemId===id&&p.facilityUse?.action==='tool-care'),fixture.item.id);
 const use=await p.locator('.life-world').evaluate(n=>({assets:JSON.parse(n.dataset.runtimeAssets),poses:JSON.parse(n.dataset.lifePoses)}));
 assert.equal(use.assets.candidate,report.candidate);assert.deepEqual(use.assets.failed,[]);
 const hero=use.poses.find(p=>p.id==='pokomoko');assert(Math.abs(hero.position[0]-1.5)<.001);assert(Math.abs(hero.position[2])<.001);
 await p.screenshot({path:`${out}/${width}-use.png`});
 await p.locator('.life-camera-tools summary').click();await p.getByRole('button',{name:'しま全体を みる',exact:true}).click();await p.screenshot({path:`${out}/${width}-overview.png`});
 const read=()=>p.evaluate(async()=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const r=(await lifeDb.worlds.toArray())[0];return {actions:r.actions,credits:r.credits};});
 const before=await read();await p.reload();await ready();assert.deepEqual(await read(),before);
 await p.screenshot({path:`${out}/${width}-restored.png`});
 await p.route('**/island-garden-hut-v1/runtime/*.glb*',r=>r.request().resourceType()==='script'?r.continue():r.abort());await p.reload();
 await p.waitForFunction(()=>{try{return JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}').failed?.includes('garden-hut');}catch{return false;}});
 await p.locator('.life-world[data-rendered="true"]').waitFor();assert.deepEqual(await read(),before);await p.screenshot({path:`${out}/${width}-fallback.png`});
 await p.getByRole('button',{name:'まなぶ',exact:true}).first().click();await p.locator('.island-learning[data-input-ready="true"]').waitFor();await p.screenshot({path:`${out}/${width}-learning.png`});
 assert.deepEqual(errors,[]);report.runs.push({width,fixture,use,errors});
 }catch(e){await p.screenshot({path:`${out}/${width}-failure.png`}).catch(()=>{});report.failure={width,error:String(e),text:await p.locator('body').innerText(),runtime:await p.locator('.life-world').getAttribute('data-runtime-assets').catch(()=>null),errors};throw e;}finally{await context.close();}
}assert.deepEqual(await hashes(),report.sourceHashes);report.pass=true;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
