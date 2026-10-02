import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedDev, appRootMetadata, readNative, waitMode, answerUI } from '../../../tools/island-e2e-helpers.mjs';
const url = process.env.SANSU_ATELIER_URL || 'http://127.0.0.1:5275';
const out = process.env.SANSU_ATELIER_OUTPUT || 'docs/design/2026-10-02-whole-app-atelier';
const before = process.env.SANSU_ATELIER_BEFORE === '1';
await fs.mkdir(out, {recursive:true});
const walk=async dir=>(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat();
const files=[...await walk('src'),...await walk('public'),...await walk('tools'),'index.html','package.json','package-lock.json','vite.config.ts'].sort();
const hash=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report={started:new Date().toISOString(),source:await hash(),fixture:'Disposable DEV profile; optional derived flags initialized false. Rich records come from existing seedDev fixture, not observed learning or child motivation.',cases:[]};
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal']});
const viewports=before?[{width:390,height:844}]:[{width:390,height:844},{width:768,height:1024},{width:320,height:568},{width:568,height:320},{width:1024,height:768}];
try {for(const viewport of viewports){
 const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:viewport.width===390?'no-preference':'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(25000);
 const row={viewport,captures:[],errors:[],pass:false};report.cases.push(row);page.on('pageerror',e=>row.errors.push(e.stack||e.message));
 const shot=async name=>{
  await page.waitForTimeout(650);await page.evaluate(()=>document.fonts.ready);
  const root=await appRootMetadata(page);assert.equal(root.islandFeatureEnabled,true);assert.equal(root.natureTownFeatureEnabled,false);assert.equal(root.configuredDelivery,'snap-root-v1');
  const identity=await page.locator('.app-container').evaluate(e=>({ ...e.dataset }));
  if(!before)assert.equal(identity.uiStyleCandidate,'whole-app-atelier-v1');
  const file=`${viewport.width}x${viewport.height}-${name}.png`;await page.screenshot({path:`${out}/${file}`,animations:'disabled'});
  const geometry=await page.evaluate(()=>({ viewport:innerWidth,bodyWidth:document.body.scrollWidth,overflows:[...document.querySelectorAll('main,.atelier-screen,.island-setup-sheet,.settings-panels,.finish-card')].filter(e=>e.checkVisibility()).map(e=>({class:e.className,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth})), controls:[...document.querySelectorAll('button')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width>0).map(e=>({label:e.getAttribute('aria-label')||e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))}));
  row.captures.push({file,url:page.url(),root,identity,geometry});assert(geometry.bodyWidth<=viewport.width+1,`${name}: body overflow`);
  console.log('CAPTURE',viewport.width,name);
 };
 try{
  await page.goto(`${url}/#/onboarding`);await page.locator('.island-welcome').waitFor();await page.locator('.island-stage canvas').waitFor();await shot('welcome');
  await page.locator('.island-start').tap();await page.locator('[data-onboarding-step=grade]').waitFor();await shot('setup-grade');
  await page.locator('.island-setup-grades button').first().tap();await shot('setup-subject');
  await page.locator('.island-setup-options button').filter({hasText:'さんすう'}).last().tap();await shot('setup-range');
  const id=await seedDev(page,{name:'Yu',familiar:true});row.profileId=id;
  await page.evaluate(async id=>{const {db}=await import('/src/db/index.ts');await db.memoryMath.where('profileId').equals(id).modify({isWeak:false});await db.memoryVocab.where('profileId').equals(id).modify({isWeak:false});},id);
  await page.evaluate(async id=>{await (await import('/src/domain/island/repository.ts')).openIsland(id);},id);
  const saved=await readNative(page,id);
  const routes=[['/stats','records'],['/settings','settings'],['/settings?section=profile','settings-profile'],['/settings?section=learning','settings-learning'],['/settings?section=display','settings-display'],['/settings?section=parent','settings-parent'],['/settings/curriculum','curriculum'],['/learn','learn-entry'],['/battle','other-games'],['/battle/play','battle-guidance'],['/parents','parent-gate'],['/onboarding?mode=add','add-profile']];
  for(const [route,name] of routes){
   await page.goto(`${url}/#${route}`);await page.waitForTimeout(650);
   if(name==='parent-gate'){
    const dialog=page.getByRole('dialog');await dialog.waitFor();await shot(name);
    const prompt=await dialog.locator('form').innerText();const values=prompt.match(/\d+/g)?.map(Number);assert(values?.length>=2,prompt);
    await dialog.locator('input').fill(String(prompt.includes('×') ? values[0]*values[1] : values[0]+values[1]));await dialog.getByRole('button',{name:'OK',exact:true}).tap();await dialog.waitFor({state:'hidden'});await shot('parents');
   } else await shot(name);
  }
  assert.deepEqual(await readNative(page,id),saved,'Browsing utility pages preserves seven canonical stores');
  await page.goto(`${url}/#/island?start=learn`);await waitMode(page,'learning');await page.locator('[data-input-ready=true]').waitFor();await shot('learning-ready');
  if(!before){row.learningSurface=await page.locator('.island-page[data-mode=learning]').evaluate(e=>({ink:getComputedStyle(e).getPropertyValue('--pop-ink').trim(),workbenchImage:getComputedStyle(e.querySelector('.island-workbench')).backgroundImage}));assert.equal(row.learningSurface.ink,'#30364f');assert.equal(row.learningSurface.workbenchImage,'none');}
  for(const digit of '0123456789'){const key=page.getByRole('button',{name:digit,exact:true});assert(await key.isVisible());const rect=await key.boundingBox();assert(rect.width>=44&&rect.height>=44&&rect.y+rect.height<=viewport.height+1,`Visible reachable ${digit}`);}
  if(!before){
   row.answerSamples=[];
   for(const incorrect of [true,false,false]){
    const state=await readNative(page,id);const result=await answerUI(page,state.plan,{incorrect,touch:incorrect,dev:true});
    const {state:next,...sample}=result;row.answerSamples.push(sample);
    await shot(incorrect?'learning-retry':`learning-next-${row.answerSamples.length}`);
   }
  }
  await page.getByRole('button',{name:'ヒントを みる',exact:true}).tap();await shot('learning-help');
  if(!before){
   await page.goto(`${url}/#/stats`);await page.locator('.stats-layout').waitFor();await shot('records-after-answers');
   const afterLearning=await readNative(page,id);
   await page.goto(`${url}/#/parents`);const dialog=page.getByRole('dialog');await dialog.waitFor();
   const prompt=await dialog.locator('form').innerText(),values=prompt.match(/\d+/g).map(Number);
   await dialog.locator('input').fill(String(prompt.includes('×')?values[0]*values[1]:values[0]+values[1]));
   await dialog.getByRole('button',{name:'OK',exact:true}).tap();await dialog.waitFor({state:'hidden'});await shot('parents-after-answers');
   assert.deepEqual(await readNative(page,id),afterLearning,'Reviewing actual answers preserves the stores');
  }
  assert.equal(row.errors.length,0,row.errors.join('\n'));row.pass=true;console.log('PASS',viewport);
 }catch(error){row.error=error.stack;await page.screenshot({path:`${out}/${viewport.width}x${viewport.height}-failure.png`}).catch(()=>{});console.error('FAIL',viewport,error.message);}
 await context.close();
}}finally{await browser.close();report.sourceEnd=await hash();report.stable=JSON.stringify(report.source)===JSON.stringify(report.sourceEnd);report.pass=report.stable&&report.cases.every(c=>c.pass);report.finished=new Date().toISOString();await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
if(!report.pass)process.exitCode=1;
