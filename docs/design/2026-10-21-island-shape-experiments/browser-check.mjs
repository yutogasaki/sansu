import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const folder=fileURLToPath(new URL('./',import.meta.url));
const out=process.env.SANSU_SHAPE_OUTPUT||path.join(folder,'evidence');
await fs.mkdir(out,{recursive:true});
try{await fs.access(path.join(out,'report.json'));throw Error('Use a fresh SANSU_SHAPE_OUTPUT');}catch(e){if(e.code!=='ENOENT')throw e;}
const manifest=JSON.parse(await fs.readFile(path.join(folder,'source-manifest.json'),'utf8'));
const target='http://127.0.0.1:5264/docs/design/2026-10-21-island-shape-experiments/';
const report={target,candidate:manifest.candidate,revision:manifest.revision,sourceHashes:manifest.sourceHashes,runnerHash:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),startedAt:new Date().toISOString(),scenarios:[],pass:false,scope:'Isolated static prototype, new Chromium contexts, reduced motion, sound initially off. Not child/physical-device observation, audio listening, art approval, main-app save/PWA verification.'};
const browser=await chromium.launch();
try{
 for(const viewport of [{width:390,height:844},{width:768,height:1024}])for(const id of ['cove','terrace','forest']){
  console.log('start',viewport.width,id);
  const ctx=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'});await ctx.addInitScript(()=>localStorage.setItem('other-work','keep'));
  const page=await ctx.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
  const row={viewport,id,checks:[],captures:[],errors:[]};report.scenarios.push(row);
  page.on('pageerror',e=>row.errors.push(e.message));
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('body[data-ready="true"]').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-revision'),manifest.revision);
  const heights=()=>page.locator('#map button').evaluateAll(cells=>cells.map(c=>c.dataset.height).join(','));
  // A real custom edit must survive trying and returning from a recipe.
  await page.locator('canvas').focus();await page.locator('canvas').press('Enter');const before=await heights();
  assert.equal(await page.locator('body').getAttribute('data-soil'),'1');
  await page.locator(`button[data-experiment="${id}"]`).tap();
  await page.locator(`body[data-experiment="${id}"][data-playing="false"]`).waitFor();
  assert.match(await page.locator('#reaction').innerText(),/できました/);
  assert.equal(await page.locator('body').getAttribute('data-soil'),'12');assert.equal(await page.locator('body').getAttribute('data-trees'),'10');
  assert.equal(await page.locator('body').getAttribute('data-islands'),id==='forest'?'2':'1');
  assert.equal(await page.locator('body').getAttribute('data-high'),id==='terrace'?'true':'false');
  assert.equal(await page.locator('body').getAttribute('data-forest'),id==='forest'?'true':'false');
  if(id==='cove')assert(Number(await page.locator('body').getAttribute('data-water'))>0);
  row.checks.push('replayed valid edits reach different intended topology/place with soil +12 and 10 trees');
  const same=await heights(),prefix=`${viewport.width}-${id}`;
  const on=`${prefix}-on.png`;const onBytes=await page.locator('#stage').screenshot({path:path.join(out,on),animations:'disabled'});row.captures.push(on);
  const full=`${prefix}-context.png`;await page.screenshot({path:path.join(out,full),fullPage:true,animations:'disabled'});row.captures.push(full);
  await page.locator('#ecology').tap();assert.equal(await page.locator('body').getAttribute('data-reactive'),'false');assert.equal(await heights(),same);
  const off=`${prefix}-off.png`;const offBytes=await page.locator('#stage').screenshot({path:path.join(out,off),animations:'disabled'});row.captures.push(off);
  assert(!onBytes.equals(offBytes),'environment on/off must visibly change the scene');
  row.checks.push('environment toggle changes real image while preserving every height and material budget');
  await page.locator('#ecology').tap();
  await page.locator('button[data-camera="place"]').tap();assert.equal(await heights(),same);const detail=`${prefix}-detail.png`;await page.locator('#stage').screenshot({path:path.join(out,detail),animations:'disabled'});row.captures.push(detail);await page.locator('button[data-camera="overview"]').tap();assert.equal(await heights(),same);row.checks.push('overview/place focus changes camera without editing the shared terrain');
  await page.locator('#light').tap();const evening=`${prefix}-evening.png`;await page.locator('#stage').screenshot({path:path.join(out,evening),animations:'disabled'});row.captures.push(evening);
  await page.locator('#light').tap();
  // Undo and redo affect the final planting, including any derived place.
  await page.locator('#undo').tap();assert.equal(await page.locator('body').getAttribute('data-trees'),'9');
  if(id==='forest')assert.equal(await page.locator('body').getAttribute('data-forest'),'false');
  await page.locator('#redo').tap();assert.equal(await page.locator('body').getAttribute('data-trees'),'10');assert.equal(await heights(),same);
  row.checks.push('Undo/Redo includes trees and recalculated places');
  // Protected support remains intact through the same public map controls.
  await page.locator('[data-tool="lower"]').tap();await page.locator('#map-details summary').click();
  await page.locator('#map button[data-x="6"][data-z="7"]').tap();assert.match(await page.locator('#reaction').innerText(),/家と入口/);
  await page.locator('#map-details summary').click();row.checks.push('house support remains protected');
  for(const kind of ['soil','water','leaf']){await page.locator(`[data-sound="${kind}"]`).tap();assert.match(await page.locator('#reaction').innerText(),/試しています/);}
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');row.checks.push('three preview controls activate without enabling ongoing edit sounds; not a listening test');
  await page.locator('#return-shape').tap();assert.equal(await heights(),before);assert.equal(await page.locator('body').getAttribute('data-soil'),'1');assert.equal(await page.locator('body').getAttribute('data-trees'),'6');
  row.checks.push('return restores the real custom shape from before playback');
  // Cancellation must stop future timed edits and still allow restoration.
  await page.locator('button[data-experiment="cove"]').tap();await page.locator('#stop-replay').tap();
  const stopped=await heights();await new Promise(resolve=>setTimeout(resolve,190));assert.equal(await heights(),stopped);
  await page.locator('#return-shape').tap();assert.equal(await heights(),before);row.checks.push('cancel prevents pending replay edits and restores custom state');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.evaluate(()=>localStorage.getItem('other-work')),'keep');assert.equal(await page.evaluate(async()=>(await indexedDB.databases()).length),0);
  assert.equal(await page.evaluate(async()=>('serviceWorker' in navigator?(await navigator.serviceWorker.getRegistrations()).length:0)),0);
  assert.deepEqual(row.errors,[]);row.checks.push('no horizontal page overflow, no DB/SW, unrelated storage preserved, no page errors');row.pass=true;
  await ctx.close();console.log('PASS',viewport.width,id);
 }
 report.pass=true;
}finally{report.completedAt=new Date().toISOString();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({pass:report.pass,scenarios:report.scenarios.length,revision:report.revision}));
