import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {EDITS,sampleHeight,WATER} from './terrain.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url)),root=path.resolve(dir,'../../..');
const out=process.env.SANSU_MECHANISM_OUTPUT||path.join(dir,'evidence');await fs.mkdir(out,{recursive:true});
try{await fs.access(path.join(out,'report.json'));throw Error('Use fresh SANSU_MECHANISM_OUTPUT');}catch(e){if(e.code!=='ENOENT')throw e;}
const manifest=JSON.parse(await fs.readFile(dir+'source-manifest.json','utf8'));
const target=process.env.SANSU_MECHANISM_URL||'http://127.0.0.1:5276/docs/design/2026-10-21-cove-mechanism-v2/';
const report={target,...manifest,startedAt:new Date().toISOString(),scope:'Isolated study; real UI input and native mesh envelopes. Not main app, saved owners, art acceptance, physical device or child testing.',runnerSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),scenarios:[],pass:false};
const browser=await chromium.launch({channel:'chrome'});
try{
 for(const[width,height,motion]of[[390,844,'no-preference'],[768,1024,'reduce']]){
  console.log('START',width);const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion,recordVideo:{dir:path.join(out,'video'),size:{width,height}}});
  await ctx.addInitScript(()=>localStorage.setItem('unrelated-mechanism-check','keep'));
  const page=await ctx.newPage();page.setDefaultTimeout(25000);const row={width,height,motion,checks:[],states:[],walkSamples:[],errors:[]};report.scenarios.push(row);page.on('pageerror',e=>row.errors.push(e.message));
  const data=name=>page.locator('body').getAttribute('data-'+name);const audit=()=>page.evaluate(()=>window.coveAudit());
  const capture=async label=>{const a=await audit(),captures=[];for(const mode of ['overview','near']){await page.locator(`button[data-camera="${mode}"]`).click();const file=`${width}-${label}-${mode}.png`;await page.locator('#stage').screenshot({path:path.join(out,file)});captures.push({file,camera:(await audit()).camera});}await page.locator('button[data-camera="overview"]').click();row.states.push({label,...a,captures});return a;};
  const waitArrival=async mode=>{let n=0;while(await data('actor-mode')==='walking'){const a=await audit();assert(a.actor.safe);assert(Math.abs(a.actor.position[1]-a.actor.visibleFloorY)<.015,'visible mesh and foot differ');row.walkSamples.push({position:a.actor.position,visibleFloorY:a.actor.visibleFloorY,safe:a.actor.safe});if(n++>220)throw Error('walk timeout');await page.waitForTimeout(80);}assert.equal(await data('actor-mode'),mode);assert.equal(await data('actor-safe'),'true');};
  await page.goto(target);await page.locator('body[data-ready="true"]').waitFor();assert.equal(await data('revision'),manifest.revision);assert.equal(await data('candidate'),'cove-mechanism-v2');assert.equal(await data('delivery'),'standalone-study-only');assert.equal(await data('owners-safe'),'true');
  const first=await capture('initial'),identity=first.owners;row.checks.push('correct version, six fixed trees and one real home on supported ground');let previous=JSON.stringify(first.state.heights);const endpoints=[];
  for(const e of EDITS){
   await page.locator(`[data-edit="${e.id}"]`).click();assert.equal(await data('last-changed'),'true',e.id+' edit rejected');const a=await audit();assert.notEqual(JSON.stringify(a.state.heights),previous);previous=JSON.stringify(a.state.heights);assert.deepEqual(a.owners,identity,'owner IDs/instances/position/scale changed');assert.equal(await data('owners-safe'),'true');
   await page.locator('#call-water').click();await waitArrival('observing');assert.equal(await data('route-safe'),'true');const b=await capture(e.id);assert(sampleHeight(b.state,b.route.look.x,b.route.look.z)<WATER);endpoints.push(b.actor.position);
   // Returning through the same current world is part of every edit's journey.
   await page.locator('#call-home').click();await waitArrival('home');row.checks.push(e.id+': actual cumulative edit, new current shore, dry grounded route and return, same seven objects');
  }
  assert.equal(new Set(endpoints.map(p=>JSON.stringify(p))).size,3);row.checks.push('three edits have three distinct derived observation destinations');
  const final=await audit();await page.locator('#undo').click();assert.equal(await data('last-changed'),'true');const undone=await capture('undo');assert.notDeepEqual(undone.state,final.state);await page.locator('#redo').click();assert.deepEqual((await audit()).state,final.state);await capture('redo');row.checks.push('Undo/Redo restores exact terrain without moving owners');
  await page.locator('#reset').click();for(const e of EDITS.slice(0,2))await page.locator(`[data-edit="${e.id}"]`).click();await page.locator('#call-water').click();await waitArrival('observing');const occupied=await audit(),past=await data('edits');await page.locator('#undo').click();assert.equal(await data('last-changed'),'false');assert.deepEqual((await audit()).state,occupied.state);assert.deepEqual((await audit()).actor.position,occupied.actor.position);assert.equal(await data('edits'),past);assert.match(await page.locator('#reaction').innerText(),/足場/);await page.locator('#call-home').click();await waitArrival('home');await page.locator('#undo').click();assert.equal(await data('last-changed'),'true');row.checks.push('Undo removing occupied new land is atomically refused; return home then Undo works');
  await page.locator('#reset').click();await page.locator('summary').click();await page.locator('[data-tool="lower"]').click();const before=JSON.stringify((await audit()).state);for(const [x,z]of[[6,7],[4,6],[3,6]]){await page.locator(`#map button[data-x="${x}"][data-z="${z}"]`).click();assert.equal(await data('last-changed'),'false');assert.equal(JSON.stringify((await audit()).state),before);}await page.locator('summary').click();row.checks.push('house, trunk and adjacent root support reject through actual UI with no mutation');
  // An unreachable far island can be created without changing fixed owners.
  await page.locator('summary').click();await page.locator('[data-tool="raise"]').click();await page.locator('#map button[data-x="14"][data-z="13"]').click();assert.equal(await data('last-changed'),'true');await page.locator('summary').click();const pos=(await audit()).actor.position;await page.locator('#call-water').click();assert.equal(await data('actor-mode'),'unreachable');assert.deepEqual((await audit()).actor.position,pos);await page.locator('#undo').click();assert.equal(await data('last-changed'),'true');row.checks.push('separated land stays editable but cannot trigger an invisible route; Undo recovers');
  if(motion==='no-preference'){
   await page.locator('[data-edit="E1"]').click();await page.locator('#call-water').click();assert.equal(await data('actor-mode'),'walking');await page.locator('[data-edit="E2"]').click();assert.equal(await data('last-changed'),'true');assert.equal(await data('actor-mode'),'idle');const pos=(await audit()).actor.position;await page.waitForTimeout(300);assert.deepEqual((await audit()).actor.position,pos);row.checks.push('editing during real walking cancels stale movement without teleport');assert(row.walkSamples.length>0);
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-mechanism-check')),'keep');assert.equal(await page.evaluate(async()=>(await indexedDB.databases()).length),0);assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),0);assert.deepEqual(row.errors,[]);row.checks.push('responsive page, no DB/SW writes, unrelated storage kept, no page errors');
  const video=page.video();await ctx.close();row.video=path.relative(out,await video.path());row.pass=true;console.log('PASS',width,row.checks.length);
 }
 for(const[file,hash]of Object.entries(manifest.sourceHashes))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),hash,file+' changed during capture');
 report.pass=true;
}catch(error){report.failure={message:error.message,stack:error.stack};throw error;}finally{report.completedAt=new Date().toISOString();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log('PASS',report.scenarios.length,'scenarios');
