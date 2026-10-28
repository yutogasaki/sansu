import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {sampleHeight} from './terrain.mjs';
import {canStand} from './walk.mjs';
const folder=fileURLToPath(new URL('./',import.meta.url)),root=path.resolve(folder,'../../..');
const out=process.env.SANSU_COVE_OUTPUT||path.join(folder,'evidence');await fs.mkdir(out,{recursive:true});
try{await fs.access(path.join(out,'report.json'));throw Error('Use fresh SANSU_COVE_OUTPUT');}catch(e){if(e.code!=='ENOENT')throw e;}
const manifest=JSON.parse(await fs.readFile(folder+'source-manifest.json','utf8'));
const target='http://127.0.0.1:5264/docs/design/2026-10-21-living-cove/';
const report={target,...manifest,browser:'installed Chrome / Playwright isolated contexts',runnerHash:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),startedAt:new Date().toISOString(),scope:'Standalone study, empty Chromium contexts, no PWA or main-app storage. Author art inspection, physical device, child observation and audio listening are separate.',scenarios:[],pass:false};
const browser=await chromium.launch({channel:'chrome'});
try{
 for(const [width,height,motion] of [[390,844,'no-preference'],[768,1024,'reduce']]){
  console.log('START',width,motion);
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:motion});await ctx.addInitScript(()=>localStorage.setItem('unrelated-cove-check','keep'));
  const page=await ctx.newPage();page.setDefaultTimeout(60000);
  const row={width,height,motion,checks:[],captures:[],errors:[],walkSamples:[]};report.scenarios.push(row);page.on('pageerror',e=>row.errors.push(e.message));
  const body=page.locator('body'),data=name=>body.getAttribute('data-'+name);
  const heights=()=>page.locator('#map button').evaluateAll(c=>c.map(b=>b.dataset.height).join(','));
  const capture=async name=>{const file=`${width}-${name}.png`;await page.locator('#stage').screenshot({path:path.join(out,file)});row.captures.push(file);};
  await page.goto(target,{waitUntil:'domcontentloaded'});await page.locator('body[data-ready="true"]').waitFor();assert.equal(await data('revision'),manifest.revision);
  assert.equal(await data('candidate'),'living-cove-v1');assert.equal(await data('delivery'),'standalone-study-only');assert.equal(await data('actor-safe'),'true');
  await capture('ready');row.checks.push('correct candidate/revision and original actor supported at launch');
  await page.locator('[data-experiment="cove"]').tap();await page.locator('body[data-playing="false"][data-transition="false"]').waitFor();assert.match(await page.locator('#reaction').innerText(),/できました/);
  assert.equal(await data('trees'),'6');assert.equal(await data('soil'),'12');const coveHeights=await heights();await capture('open');
  await page.locator('[data-camera="overview"]').tap();await capture('overview');await page.locator('#ecology').tap();assert.equal(await heights(),coveHeights);await capture('old-tree-overview');
  await page.locator('[data-camera="place"]').tap();await capture('old-tree-near');await page.locator('#ecology').tap();await capture('new-tree-near');row.checks.push('same six trees and soil +12; old/new tree comparison preserves every height');
  await page.locator('#call-water').tap();
  if(motion==='no-preference'){
    const started=Date.now();while(await data('actor-mode')==='walking'){
      const sample=await body.evaluate(b=>({...b.dataset}));row.walkSamples.push({x:sample.actorX,z:sample.actorZ,y:sample.actorY,safe:sample.actorSafe});assert.equal(sample.actorSafe,'true');assert(Math.abs(Number(sample.actorY)-Number(sample.actorGround))<.0001);
      if(Date.now()-started>60000)throw Error('walk did not finish');await page.waitForTimeout(120);
    }
    assert(row.walkSamples.length>0);
  }
  assert.equal(await data('actor-mode'),'observing');assert.equal(await data('actor-safe'),'true');assert(Number(await data('route-length'))>0);await capture('observing');
  row.checks.push(motion==='reduce'?'reduced motion shows validated endpoint/path without movement animation':'real walking samples remain grounded and dry before observing');
  await page.locator('#call-home').tap();await page.locator('body[data-actor-mode="home"]').waitFor();assert.equal(await data('actor-safe'),'true');row.checks.push('return to house follows supported route');
  if(motion==='no-preference'){
    await page.locator('#call-water').tap();assert.equal(await data('actor-mode'),'walking');
    await page.locator('#undo').tap();assert.equal(await data('actor-mode'),'idle');await page.locator('#redo').tap();assert.equal(await heights(),coveHeights);
    const frozen=[await data('actor-x'),await data('actor-z')];await page.waitForTimeout(350);assert.deepEqual([await data('actor-x'),await data('actor-z')],frozen);assert.equal(await data('actor-safe'),'true');
    row.checks.push('Undo during real walking cancels old route; Redo cannot resume it or move the grounded actor');
  }
  await page.locator('#map-details summary').click();await page.locator('[data-tool="lower"]').tap();
  const edit=page.locator('#map button[data-x="9"][data-z="8"]');await edit.tap();assert.equal(await heights(),coveHeights); // already sea
  await page.locator('#map button[data-x="9"][data-z="10"]').tap();assert.match(await page.locator('#reaction').innerText(),/木が根/);assert.equal(await heights(),coveHeights);
  await page.locator('#map button[data-x="6"][data-z="7"]').tap();assert.match(await page.locator('#reaction').innerText(),/家と入口/);
  await page.locator('[data-tool="raise"]').tap();const free=page.locator('#map button[data-x="11"][data-z="9"]');await free.tap();await free.tap();await free.tap();await page.locator('body[data-transition="false"]').waitFor();
  const edited=await heights();assert.notEqual(edited,coveHeights);await page.locator('#undo').tap();await page.locator('#redo').tap();assert.equal(await heights(),edited);assert.equal(await data('actor-mode'),'idle');
  await page.locator('#map-details summary').click();row.checks.push('tree/house support protected; rapid edits settle; Undo/Redo restores terrain and stops stale acting');
  await page.locator('#return-shape').tap();assert.equal(await data('soil'),'0');assert.equal(await data('trees'),'6');assert.equal(await data('actor-safe'),'true');row.checks.push('return restores actual pre-replay shape and actor');
  await page.locator('[data-experiment="cove"]').tap();await page.locator('#stop-replay').tap();await page.locator('body[data-transition="false"]').waitFor();const stopped=await heights();await page.waitForTimeout(350);assert.equal(await heights(),stopped);row.checks.push('stopping replay prevents late edits');
  await page.locator('#return-shape').tap();await page.locator('#light').tap();await capture('evening');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-cove-check')),'keep');assert.equal(await page.evaluate(async()=>(await indexedDB.databases()).length),0);assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),0);
  const state={heights:Array(289).fill(0),plants:[]};await page.locator('#map button').evaluateAll(c=>c.map(b=>[b.dataset.x,b.dataset.z,b.dataset.height])).then(c=>c.forEach(([x,z,h])=>state.heights[Number(z)*17+Number(x)]=Number(h)));
  assert(canStand(state,Number(await data('actor-x')),Number(await data('actor-z'))));assert(Math.abs(Number(await data('actor-y'))-sampleHeight(state,Number(await data('actor-x')),Number(await data('actor-z'))))<.0001);
  assert.deepEqual(row.errors,[]);row.checks.push('sound-off, page width, no DB/SW, unrelated storage retained and no page errors');row.pass=true;await ctx.close();console.log('PASS',width,row.checks.length);
 }
 for(const [file,hash] of Object.entries(manifest.sourceHashes))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),hash,file+' changed during capture');
 report.pass=true;
}finally{report.completedAt=new Date().toISOString();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({pass:report.pass,revision:report.revision,scenarios:report.scenarios.length}));
