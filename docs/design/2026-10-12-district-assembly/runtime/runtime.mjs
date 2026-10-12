import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(process.cwd()+'/package.json'), {chromium}=require('playwright');
const output='/private/tmp/sansu-districts-c7/runtime'; mkdirSync(output,{recursive:false});
const target='http://127.0.0.1:5364/prototypes/place-qa/authored.html?art=whole&districts=1';
const report={pass:false,target,revision:'district-assembly-c7',scope:'DEV same two terrain assets through actual preview/cancel/confirm; personal purchase/save, actor traversal and art acceptance not proved',steps:[],captures:[],errors:[]};
const browser=await chromium.launch({headless:true}); let page;
const stable=state=>{const value=structuredClone(state);delete value.applied;delete value.placeProgress;return value;};
async function data(){return page.locator('[data-authored-island]').evaluate(node=>({...node.dataset}));}
async function ready(){await page.waitForFunction(()=>{
 const h=document.querySelector('[data-authored-island]')?.dataset,w=document.querySelector('[data-growing-world]')?.dataset;
 return !document.querySelector('.authored-status') && h?.districtsEnabled==='true' && w?.growingCamera && w.worldRevision===h.worldRevision;
}); await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function step(name,fn){report.phase=name;writeFileSync(output+'/progress.json',JSON.stringify(report,null,2));console.log(name);const started=Date.now();await fn();report.steps.push({name,elapsedMs:Date.now()-started});}
async function capture(name){await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/'+name+'.png',scale:'css'});report.captures.push({name,viewport:page.viewportSize(),host:await data(),renderer:await page.locator('[data-growing-world]').evaluate(n=>({...n.dataset}))});}
async function preview(template,which){await page.locator('[data-district-port]').scrollIntoViewIfNeeded();await page.locator('[data-district-port]').selectOption(JSON.stringify(which));await page.locator('[data-district-template="'+template+'"]').click();await page.waitForFunction(()=>document.querySelector('[data-authored-island]')?.dataset.districtPreview!=='null');await ready();const host=await data();assert(host.districtPreview!=='null');return host;}
async function confirm(){const before=await data(), planned=JSON.parse(before.districtPreview);await page.locator('[data-district-confirm]').scrollIntoViewIfNeeded();await page.locator('[data-district-confirm]').click();await ready();const after=await data();assert.equal(after.districtPreview,'null');assert.equal(after.districtWorldRevision,before.districtWorldRevision);assert.deepEqual(JSON.parse(after.districtGrants).at(-1),planned.grant);}
try{
 const shore='native05-harbor-lowland-v1',hill='native05-northern-hill-v1';
 const cases=[{id:'east-chain',first:shore,port:'east-entry',second:hill,child:true},{id:'north-chain',first:shore,port:'north-entry',second:hill,child:true},{id:'two-arms',first:hill,port:'east-entry',second:shore,child:false}];
 for(const scenario of cases){
  page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(180000);page.on('pageerror',error=>report.errors.push({scenario:scenario.id,error:String(error)}));
  await step(scenario.id+'-load',async()=>{await page.goto(target);await ready();const h=await data();assert.equal(h.buildRevision,report.revision);assert.equal(h.districtCandidate,'native05-district-shapes-rough-v1');if(scenario.id==='east-chain')await capture('whole-before');});
  const original=await data(), state=stable(JSON.parse(original.authoredState));
  if(scenario.id==='east-chain')await step('preview-cancel',async()=>{await preview(shore,['native05-inlet-core','east-entry']);assert.equal((await data()).districtGrants,'[]');assert(await page.locator('[data-owner-id]').first().isDisabled());await capture('preview-east-shore');await page.locator('[data-district-cancel]').scrollIntoViewIfNeeded();await page.locator('[data-district-cancel]').click();await ready();const after=await data();assert.equal(after.districtWorldRevision,original.districtWorldRevision);assert.deepEqual(stable(JSON.parse(after.authoredState)),state);});
  await step(scenario.id+'-first',async()=>{await preview(scenario.first,['native05-inlet-core',scenario.port]);await confirm();});
  await step(scenario.id+'-second',async()=>{
   const values=await page.locator('[data-district-port] option').evaluateAll(nodes=>nodes.map(n=>n.value));
   const selected=scenario.child?values.find(value=>JSON.parse(value)[0]==='diagnostic-district-1'):JSON.stringify(['native05-inlet-core','north-entry']);assert(selected);
   await preview(scenario.second,JSON.parse(selected));await confirm();const after=await data();assert.equal(JSON.parse(after.districtGrants).length,2);assert.deepEqual(stable(JSON.parse(after.authoredState)),state);await capture(scenario.id);
  });
  if(scenario.id==='two-arms')await step('phone-view',async()=>{await page.setViewportSize({width:390,height:844});await ready();await capture('two-arms-phone');});
  await page.close();page=undefined;
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=String(error.message??error);if(page){await page.screenshot({path:output+'/failure.png',scale:'css'}).catch(()=>{});report.failureHost=await data().catch(()=>null);report.failureRenderer=await page.locator('[data-growing-world]').evaluate(n=>({...n.dataset})).catch(()=>null);}process.exitCode=1;}
finally{writeFileSync(output+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,phase:report.phase,captures:report.captures.length,failure:report.failure}));}
