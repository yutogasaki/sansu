import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const target='http://127.0.0.1:5250/',out=process.env.GARDEN_RUNTIME_OUTPUT||'output/playwright/garden-game-runtime';
await mkdir(out,{recursive:true});
const files=['src/components/island/life/runtimeAssets.ts','src/components/island/life/runtimeAssetSlots.ts','src/components/island/life/scene.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const report={target,candidate:'island-life-runtime-assets-v3',flag:'VITE_ISLAND_RUNTIME_ASSETS=true',sourceHashes:await hashes(),fixture:'Disposable historical world with synthetic credits and staggered flower ages; no real learning or Meshy calls',runs:[]};
const browser=await chromium.launch();
try{for(const width of [390,768]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:width===768?'reduce':'no-preference'}),p=await context.newPage(),errors=[];
 p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(target);for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).first().click();
 await p.locator('.island-learning[data-input-ready="true"]').waitFor();await p.getByRole('button',{name:'とじる',exact:true}).click();await p.locator('.life-world[data-rendered="true"]').waitFor();
 await p.screenshot({path:`${out}/${width}-launch.png`});
 const fixture=await p.evaluate(async()=>{
  const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {newLife,HOUR,learningDay,growthStage}=await import('/src/domain/islandLife/model.ts');const {commandLife,replayLife}=await import('/src/domain/islandLife/simulation.ts');
  const profile=(await lifeDb.worlds.toArray())[0].profileId,now=Date.now(),start=now-8*HOUR;
  let r=newLife(profile,start);r.credits=Array.from({length:100},(_,i)=>({id:`garden-qa-${i}`,at:start,day:learningDay(start)}));
  r=commandLife(r,{type:'buy',kind:'flower',cell:{x:1,z:2}},'qa-mature',start+1);
  r=commandLife(r,{type:'buy',kind:'flower',cell:{x:0,z:3}},'qa-bud',now-3*HOUR);
  r=commandLife(r,{type:'buy',kind:'flower',cell:{x:2,z:3}},'qa-young',now);
  r=commandLife(r,{type:'buy',kind:'lantern',cell:{x:4,z:2}},'qa-lamp',now+1);
  r={...r,realAt:Date.now()};const stages=replayLife(r).items.filter(i=>i.kind==='flower').map(i=>({id:i.id,stage:growthStage(i)}));await lifeDb.worlds.put(r);return stages;
 });assert.deepEqual(fixture.map(i=>i.stage),[2,1,0]);await p.reload();
 await p.locator('.life-world[data-rendered="true"]').waitFor();
 await p.evaluate(async()=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{commandLife}=await import('/src/domain/islandLife/simulation.ts');let r=(await lifeDb.worlds.toArray())[0];r=commandLife(r,{type:'buy',kind:'garden-hut',cell:{x:4,z:0}},'qa-hut',Math.max(Date.now(),r.now)+1);await lifeDb.worlds.put(r);});await p.reload();
 const ready=()=>p.waitForFunction(()=>{try{const d=JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}');return d.loaded?.includes('flowerbed')&&d.loaded?.includes('streetlamp')&&!d.pending.length;}catch{return false;}});
 await ready();const assets=await p.locator('.life-world').evaluate(n=>JSON.parse(n.dataset.runtimeAssets));
 assert.equal(assets.candidate,report.candidate);assert.equal(assets.byKind.flowerbed,1);assert.equal(assets.byKind.streetlamp,1);assert.deepEqual(assets.failed,[]);
 await p.screenshot({path:`${out}/${width}-garden.png`});
 const read=()=>p.evaluate(async()=>{const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{replayLife}=await import('/src/domain/islandLife/simulation.ts');const{growthStage}=await import('/src/domain/islandLife/model.ts');const{lanternGround}=await import('/src/domain/islandLife/footstepMagic.ts');const{lifeDiscoveryPresentation}=await import('/src/domain/islandLife/capabilities.ts');const r=(await lifeDb.worlds.toArray())[0],current=replayLife(r),s={...current,...lifeDiscoveryPresentation(current.items)};return{actions:r.actions,credits:r.credits,stages:s.items.filter(i=>i.kind==='flower').map(i=>growthStage(i)),ground:lanternGround(s,s.items.find(i=>i.kind==='lantern')),lightEnabled:s.footstepMagicVersion};});
 const before=await read();assert.deepEqual(before.stages,[2,1,0]);assert(before.lightEnabled&&before.ground.length>0);
 await p.locator('.life-camera-tools summary').click();await p.getByRole('button',{name:'しま全体を みる',exact:true}).click();await p.screenshot({path:`${out}/${width}-overview.png`});
 await p.reload();await ready();assert.deepEqual(await read(),before);
 await p.route(/island-(flowerbed|streetlamp)-v1\/runtime\/.*\.glb/,r=>r.request().resourceType()==='script'?r.continue():r.abort());await p.reload();
 await p.waitForFunction(()=>{try{const d=JSON.parse(document.querySelector('.life-world')?.dataset.runtimeAssets||'{}');return d.failed?.includes('flowerbed')&&d.failed?.includes('streetlamp');}catch{return false;}});
 await p.locator('.life-world[data-rendered="true"]').waitFor();assert.deepEqual(await read(),before);await p.screenshot({path:`${out}/${width}-fallback.png`});
 await p.getByRole('button',{name:'まなぶ',exact:true}).first().click();await p.locator('.island-learning[data-input-ready="true"]').waitFor();await p.screenshot({path:`${out}/${width}-learning.png`});
 assert.deepEqual(errors,[]);report.runs.push({width,fixture,assets,ground:before.ground,errors});
 }catch(e){await p.screenshot({path:`${out}/${width}-failure.png`}).catch(()=>{});report.failure={width,error:String(e),text:await p.locator('body').innerText(),errors};throw e;}finally{await context.close();}
}assert.deepEqual(await hashes(),report.sourceHashes);report.pass=true;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
