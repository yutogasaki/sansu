import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedLearningProfile } from '../../../tools/island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata, waitReady, waitMode } from '../../../tools/island-e2e-helpers.mjs';

const base=process.env.SANSU_CONTENT_UI_URL || 'http://127.0.0.1:5268';
const out=process.env.SANSU_CONTENT_UI_OUTPUT || 'output/playwright/learning-content-fixes/'+Date.now();
await fs.mkdir(out,{recursive:true});
const paths=execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').concat(['package.json','package-lock.json','vite.config.ts']).sort();
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const report={target:base,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceStart:await hashes(),startedAt:new Date().toISOString(),scope:'Isolated native profile/memory fixtures; real Island reservations, rendered diagrams, touch answers, writer and reload. DEV Chromium, not deployed build, real device or child observation.',cases:[],pass:false};
const assertControls = async page => {
 const boxes=await page.locator('.park-keypad button,.park-choices button').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.textContent.trim(),width:r.width,height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight};}));
 assert(boxes.length>0);for(const box of boxes)assert(box.width>=44 && box.height>=44 && box.top>=0 && box.bottom<=box.viewport,JSON.stringify(box));
 return boxes;
};
const waitLearningReady = async (page, plan) => {
 await page.locator('.island-page[data-learning-candidate="pokomoko-pop-live-v8"]').waitFor();
 await page.waitForFunction(({id,revision})=>{const root=document.querySelector('[data-island-plan-id]');return root?.getAttribute('data-island-plan-id')===id && Number(root.getAttribute('data-island-plan-revision'))===revision && root.getAttribute('data-input-ready')==='true';},{id:plan.id,revision:plan.revision});
};
const browser=await chromium.launch();
const scenarios=[['foundation_tens',0],['foundation_expanded',0],['foundation_groups',0],['foundation_division',0],['foundation_decimal',0],['foundation_fraction',1],['foundation_equivalence',0],['foundation_mixed',0],['foundation_rate',0],['foundation_decimal',0,'normal']];
try{
 for(const width of [390,768]) for(const [skill,progress,source] of scenarios){
  const row={width,skill,source:source??'due-fixture',errors:[],pass:false};const captureName=skill+(source?'-'+source:'')+'-'+width;report.cases.push(row);
  const c=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:width===768?'reduce':'no-preference'});
  const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>row.errors.push(e.message));
  try{
   await p.goto(base+'/#/island');await p.waitForURL('**/#/onboarding');
   const id=await seedLearningProfile(p,{skill,type:'number'});row.profileId=id;
   await p.evaluate(async ({id,skill,progress,source})=>{
    const r=indexedDB.open('SansuDatabase');const d=await new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error);});
    const t=d.transaction(['memoryMath', 'profiles', 'appData'],'readwrite');
    if(source==='normal'){const get=req=>new Promise((a,b)=>{req.onsuccess=()=>a(req.result);req.onerror=()=>b(req.error);});const profile=await get(t.objectStore('profiles').get(id));profile.mathLevels=profile.mathLevels.map(level=>({...level,enabled:level.level===19}));t.objectStore('profiles').put(profile);t.objectStore('appData').put({id:'app',schemaVersion:1,activeProfileId:id,profiles:{[id]:profile}});}t.objectStore('memoryMath').put({profileId:id,id:skill,strength:1,status:'active',nextReview:source==='normal'?'2099-01-01':'2000-01-01',updatedAt:'2000-01-01',totalAnswers:progress,correctAnswers:progress,independentCorrectAnswers:progress,incorrectAnswers:0,skippedAnswers:0});
    await new Promise((a,b)=>{t.oncomplete=a;t.onerror=()=>b(t.error);});d.close();
   },{id,skill,progress,source});
   await p.goto(base+'/#/island');await waitReady(p);await p.locator('.island-start').tap();await waitMode(p,'learning');
   const before=await readNative(p,id);await waitLearningReady(p,before.plan);
   assert.equal(before.plan.slots[0].problem.categoryId,skill);row.problem=before.plan.slots[0].problem;
   if(source==='normal'){assert.equal(before.plan.slots[0].source,'followup');assert.equal(before.plan.slots[0].problem.isReview,false);}
   row.controls=await assertControls(p);
   row.questionGeometry=await p.locator('.park-question').evaluate(el=>{const q=el.getBoundingClientRect(),caption=el.querySelector('[data-visual-caption]')?.getBoundingClientRect();return {top:q.top,bottom:q.bottom,captionTop:caption?.top,captionBottom:caption?.bottom,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};});
   assert(row.questionGeometry.captionTop>=row.questionGeometry.top && row.questionGeometry.captionBottom<=row.questionGeometry.bottom,'The complete question is visible before input');row.metadata=await runtimeMetadata(p);
   assert.equal(row.metadata.appRoot.islandFeatureEnabled,true);assert.equal(row.metadata.appRoot.natureTownFeatureEnabled,false);
   const strips=await p.locator('[data-parts]').evaluateAll(bars=>bars.map(el=>({width:el.getBoundingClientRect().width,parts:el.dataset.parts,filled:el.dataset.filled})));
   if(strips.length>1) assert(strips.every(s=>Math.abs(s.width-strips[0].width)<1),'The whole is the same width for each fraction');
   row.strips=strips;
   assert(await p.locator('.park-question').innerText().then(text=>text.includes(row.problem.questionText)),'The actual concept question remains visible');
   await p.screenshot({path:out+'/'+captureName+'.png'});row.screenshot=captureName+'.png';
   if(skill==='foundation_decimal') assert(await p.getByRole('button',{name:'しょうすうてん',exact:true}).isVisible());
   await answerUI(p,before.plan,{touch:true,dev:false});
   const after=await readNative(p,id);assert.equal(after.logs.length,before.logs.length+1);
   assert.equal(after.logs.at(-1).itemId,skill);assert.equal(after.logs.at(-1).result,'correct');
   assert.equal(after.logs.at(-1).learningEvidence.assistance,'independent');
   row.log=after.logs.at(-1);let frozen=after.plan;
   if(source==='normal'){
    assert.equal(after.plan.slots[after.plan.cursor].problem.inputType,'choice');
    await answerUI(p,after.plan,{touch:true,dev:false});const second=await readNative(p,id);assert.equal(second.logs.length,before.logs.length+2);assert.equal(second.memoryMath.find(m=>m.id===skill).independentCorrectAnswers,2);frozen=second.plan;
    row.mainWindow=await p.evaluate(async id=>{const r=indexedDB.open('SansuDatabase');const d=await new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error)});const q=d.transaction('profiles').objectStore('profiles').get(id);const profile=await new Promise((a,b)=>{q.onsuccess=()=>a(q.result);q.onerror=()=>b(q.error)});d.close();return profile.mathLevels.find(l=>l.level===19).recentIndependentAnswersNonReview??[];},id);assert.equal(row.mainWindow.length,0);
   }
   await p.reload();await waitMode(p,'learning');await waitLearningReady(p,frozen);
   assert.deepEqual((await readNative(p,id)).plan,frozen,'Reload keeps the next frozen reservation');
   row.pass=row.errors.length===0;
  }catch(e){row.error=e.stack;await p.screenshot({path:out+'/'+captureName+'-FAIL.png'}).catch(()=>{});console.error('FAIL',width,skill,e.message);}
  await c.close();if(row.pass)console.log('PASS',width,skill,source??'due');
 }
}finally{await browser.close();report.sourceEnd=await hashes();report.stable=JSON.stringify(report.sourceStart)===JSON.stringify(report.sourceEnd);report.pass=report.stable&&report.cases.every(x=>x.pass);report.finishedAt=new Date().toISOString();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log('REPORT',out,report.pass);}
if(!report.pass)process.exitCode=1;
