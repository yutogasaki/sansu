import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedDev, readNative, runtimeMetadata, answerUI, waitForAsync } from './island-e2e-helpers.mjs';

const base=process.env.SANSU_FANTASY_URL || 'http://127.0.0.1:5230';
const out=process.env.SANSU_FANTASY_OUTPUT || 'output/playwright/fantasy-first-playable';
await fs.mkdir(out,{recursive:true});
const digest=createHash('sha256');
async function hashTree(path){for(const entry of (await fs.readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=`${path}/${entry.name}`;if(entry.isDirectory())await hashTree(file);else digest.update(file).update(await fs.readFile(file));}}
await hashTree('src');digest.update(await fs.readFile('package-lock.json'));digest.update(await fs.readFile('vite.config.ts'));
const report={target:base,candidate:'living-fantasy-garden-v2',baseRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingSourceHash:digest.digest('hex'),qaHash:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),flags:{VITE_ISLAND_ENABLED:true,VITE_ISLAND_LIFE_PREVIEW:true,VITE_ISLAND_FANTASY_ENABLED:true},runtime:'DEV Vite; disposable browser contexts; no deployment',scenarios:[],captures:[],pass:false};
const browser=await chromium.launch();let currentPage;
const world=page=>page.locator('.life-world[data-rendered="true"]');
const capture=async(page,label)=>{const file=`${page.viewportSize().width}-${label}.png`;await page.waitForTimeout(180);await page.screenshot({path:`${out}/${file}`,animations:'disabled'});report.captures.push({file,...await runtimeMetadata(page),world:await page.locator('.life-world').count()?await page.locator('.life-world').first().evaluate(e=>({candidate:e.dataset.lifeVisualCandidate,time:e.dataset.gardenTime,render:e.dataset.lifeRender?JSON.parse(e.dataset.lifeRender):null})):null});};
const life=async(page,id)=>page.evaluate(async id=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const {replayLife}=await import('/src/domain/islandLife/simulation.ts');const record=await lifeDb.worlds.get(id);return {db:lifeDb.name,record,state:record?replayLife(record):null,journal:record?.discoveryJournal};},id);
async function fresh(viewport,reduced='reduce',loadWorld=true){
 const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:reduced});const page=currentPage=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/#/island`);await page.locator('.island-welcome').waitFor();const id=await seedDev(page,{familiar:false});if(loadWorld){await page.reload();await world(page).waitFor();assert.equal(await world(page).getAttribute('data-life-world-style'),'fantasy-garden-v1');assert.equal(await world(page).getAttribute('data-life-visual-candidate'),'living-fantasy-garden-v2');}
 return {context,page,id,errors};
}
async function fixture(page,id){
 return page.evaluate(async id=>{
  const {lifeDb,updateLife}=await import('/src/domain/islandLife/repository.ts');if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('This diagnostic fixture is restricted to the DEV preview DB');
  const start=Date.now();let r=await updateLife(id,[],undefined,start,lifeDb);
  r=await updateLife(id,Array.from({length:30},(_,i)=>({id:`fixture-${i}`,at:start+1})),undefined,start+2,lifeDb);
  for(const [index,[kind,x,z]] of [['flower',1,2],['flower',0,3],['sapling',5,1],['bench',0,1],['water-bowl',3,3],['lantern',4,3],['planter',1,4],['picnic-table',5,3]].entries())r=await updateLife(id,[],{id:`garden-${index}`,revision:r.revision,command:{type:'buy',kind,cell:{x,z}}},start+10+index,lifeDb);
  await updateLife(id,[],{id:'fixture-growth',revision:r.revision,advanceHours:24},Date.now(),lifeDb);
  return {source:'Diagnostic credits, purchases and 24-hour clock advance through the real writer; not actual learning or elapsed growth',db:lifeDb.name,profileId:id};
 },id);
}
try{
 const real=await fresh({width:390,height:844},'no-preference');const {page,id}=real;
 await capture(page,'initial');
 await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('[data-input-ready="true"]').waitFor();await capture(page,'learning');
 let saved=await readNative(page,id);const first=saved.plan.id;const answers=[];
 while(saved.plan.id===first && answers.length<12){const result=await answerUI(page,saved.plan,{touch:true});answers.push({input:result.inputType,ms:result.ms});saved=result.state;}
 assert.equal(saved.island.completedSets,1);assert.equal(saved.logs.length,3);const continuation={id:saved.plan.id,cursor:saved.plan.cursor};
 await page.getByRole('button',{name:'とじる',exact:true}).click();await world(page).waitFor();
 await waitForAsync(page,async id=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');return (await lifeDb.worlds.get(id))?.credits.length===3;},id);
 const earned=await life(page,id);assert.equal(earned.state.drops,6);await capture(page,'earned');
 await page.getByRole('button',{name:'つくる',exact:true}).click();await capture(page,'catalog');await page.locator('[data-life-buy="flower"]').click();
 await page.getByRole('button',{name:'マスから えらぶ',exact:true}).click();await page.locator('[data-life-cell="0,0"]').click();await capture(page,'placement');
 await page.getByRole('button',{name:'ここに おく',exact:true}).click();
 await waitForAsync(page,async id=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');const r=await lifeDb.worlds.get(id);return r?.actions.some(a=>a.command.type==='buy');},id);
 if(await page.getByRole('button',{name:'メニューを とじる',exact:true}).isVisible())await page.getByRole('button',{name:'メニューを とじる',exact:true}).click();
 await capture(page,'placed');const placed=await life(page,id);assert.equal(placed.state.drops,4);assert.equal(placed.state.items.length,1);
 await page.reload();await world(page).waitFor();assert.equal((await life(page,id)).state.items[0].id,placed.state.items[0].id);
 await page.getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('[data-input-ready="true"]').waitFor();const resumed=await readNative(page,id);assert.equal(resumed.plan.id,continuation.id);assert.equal(resumed.plan.cursor,continuation.cursor);
 assert.deepEqual(real.errors,[]);report.scenarios.push({name:'actual-learning-purchase-place-reload-resume',source:'Profile fixture only; three answers and purchase/placement through actual UI',answers,dropsBefore:earned.state.drops,dropsAfter:placed.state.drops,continuation,pass:true});await real.context.close();
 for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
  const row=await fresh(viewport,'reduce',false);const {page,id}=row;const setup=await fixture(page,id);await page.reload();await world(page).waitFor();await capture(page,'day-populated');
  const before=await life(page,id);for(const [name,time] of [['夕ぐれ','dusk'],['よる','night']]){await page.getByRole('button',{name,exact:true}).click();await page.waitForFunction(t=>document.querySelector('.life-world')?.dataset.gardenTime===t,time);await capture(page,`${time}-populated`);}
  await page.reload();await world(page).waitFor();assert.equal(await world(page).getAttribute('data-garden-time'),'night');const afterTime=await life(page,id);assert.deepEqual(afterTime.record.credits,before.record.credits);assert.deepEqual(afterTime.record.actions,before.record.actions);
  const button=page.getByRole('button',{name:'水ばちに ふれる（1）',exact:true});await button.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.life-world')?.dataset.gardenWater||'{}').kind==='stars');await page.waitForTimeout(400);await button.blur();await capture(page,'water-stars');
  await waitForAsync(page,async id=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');return (await lifeDb.worlds.get(id))?.discoveryJournal?.entries.some(entry=>entry.event.ruleId==='M4'&&entry.event.source==='live');},id);
  const witnessed=await life(page,id);const water=witnessed.journal.entries.find(e=>e.event.ruleId==='M4');assert.equal(water.event.snapshot.scene.gardenTime,'night');assert(water.evidence.visibleDurationMs>=1000);assert.equal(water.evidence.coreShown,true);assert.deepEqual(witnessed.record.credits,before.record.credits);
  await page.getByRole('button',{name:'おもいで',exact:true}).click();await page.getByRole('button',{name:'みえた ばめん',exact:true}).click();await capture(page,'memories');
  await page.locator('[data-life-memory]').filter({hasText:'水'}).first().click();await page.locator('.life-memories .life-world[data-rendered=true]').waitFor();await page.locator('.life-memories').getByRole('button',{name:'水ばちに ふれる（1）',exact:true}).click();await waitForAsync(page,async ({id,eventId})=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');return (await lifeDb.worlds.get(id))?.discoveryJournal?.entries.some(e=>e.event.source==='replay'&&e.event.originEventId===eventId);},{id,eventId:water.event.eventId});await capture(page,'memory-replay');
  await page.getByRole('button',{name:'のこす',exact:true}).click();await waitForAsync(page,async ({id,eventId})=>{const {lifeDb}=await import('/src/domain/islandLife/repository.ts');return (await lifeDb.worlds.get(id))?.discoveryJournal?.savedIds.includes(eventId);},{id,eventId:water.event.eventId});
  await page.getByRole('button',{name:'おもいでを とじる',exact:true}).click();await world(page).waitFor();await capture(page,'return');
  const render=JSON.parse(await world(page).getAttribute('data-life-render'));assert(render.calls<=120,JSON.stringify(render));assert(render.triangles<=150000,JSON.stringify(render));
  if(viewport.width===390){
   const count=async()=>((await life(page,id)).journal?.entries||[]).filter(e=>e.event.ruleId==='M4'&&e.event.source==='live').length;
   const baseline=await count();
   for(const fault of ['overlay','hidden','context-lost','menu']){
    await page.reload();await world(page).waitFor();await page.getByRole('button',{name:'水ばちに ふれる（1）',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(document.querySelector('.life-world')?.dataset.gardenWater||'{}').kind==='stars');
    if(fault==='menu')await page.getByRole('button',{name:'つくる',exact:true}).click();
    else await page.evaluate(fault=>{if(fault==='overlay'){const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;background:#eee;z-index:99999';document.body.append(cover);}else if(fault==='hidden'){Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));}else document.querySelector('.life-world canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();},fault);
    await page.waitForTimeout(1400);assert.equal(await count(),baseline,`${fault} cannot become a witnessed memory`);
   }
   await page.reload();await world(page).waitFor();assert((await life(page,id)).journal.savedIds.includes(water.event.eventId));
   report.scenarios.push({name:'hidden-overlay-context-loss-menu',source:'Explicit fault injection during the first second of a real water response',pass:true});
  }
  assert.deepEqual(row.errors,[]);
  report.scenarios.push({name:`${viewport.width}-world-water-memory`,setup,render,event:{source:water.event.source,rule:water.event.ruleId,visibleDurationMs:water.evidence.visibleDurationMs,viewingTime:water.event.snapshot.scene.gardenTime},pass:true});await row.context.close();
 }
 for(const capture of report.captures){
  const render=capture.world?.render;
  if(render){assert(render.calls<=120,`${capture.file}: ${JSON.stringify(render)}`);assert(render.triangles<=150000,`${capture.file}: ${JSON.stringify(render)}`);}
 }
 report.pass=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,scenarios:report.scenarios,error:report.error,report:`${out}/report.json`},null,2));}
