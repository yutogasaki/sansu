import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { seedNative, readNative, answerUI, waitMode } from './island-e2e-helpers.mjs';

const oldDir=resolve(process.env.SANSU_TOWN_OLD_DIR||'/tmp/sansu-nt3-index-t1bn4rns/dist');
const newDir=resolve(process.env.SANSU_TOWN_NEW_DIR||'/tmp/sansu-nt4-new-dist');
const out=process.env.SANSU_TOWN_OUTPUT||'output/playwright/nature-town-two-build';
await mkdir(out,{recursive:false});
// Compile the oracle from the same isolated source used for both builds, never the dirty checkout.
const sourceRoot=resolve(process.env.SANSU_TOWN_SOURCE_ROOT||'/tmp/sansu-nt3-index-t1bn4rns');
const compiled=await build({stdin:{contents:"export {stepWorld} from './src/domain/natureTown/simulation'; export {context} from './src/domain/natureTown/world'; export {capabilities} from './src/domain/natureTown/progress';",resolveDir:sourceRoot},bundle:true,platform:'node',format:'esm',write:false});
const engine=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const versions=await Promise.all([oldDir,newDir].map(async d=>JSON.parse(await readFile(`${d}/version.json`,'utf8'))));
const modulePath=html=>html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
const bundles=await Promise.all([oldDir,newDir].map(async d=>modulePath(await readFile(`${d}/index.html`,'utf8'))));
assert.notEqual(versions[0].version,versions[1].version);assert.ok(bundles.every(Boolean));assert.notEqual(bundles[0],bundles[1]);
for(const v of versions)assert.equal(v.island.enabled,true);
const hash=x=>createHash('sha256').update(x).digest('hex');
async function files(root,dir=root){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())result.push(...await files(root,path));else result.push({path:relative(root,path),sha256:hash(await readFile(path))});}return result.sort((a,b)=>a.path.localeCompare(b.path));}
const distHashes=await Promise.all([oldDir,newDir].map(d=>files(d)));
let deployed=oldDir;
const requests=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const root=deployed,file=resolve(root,`.${path}`);if(!file.startsWith(`${root}/`)){res.writeHead(403).end();return;}try{const bytes=await readFile(file);requests.push({path,revision:root===oldDir?'old':'new'});res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const report={target:base,versions,bundles,distHashes,browser:browser.version(),scope:'Two independently compiled builds on one local origin. Disposable profile only; actual UI placements, six native learning sections, both purchased tools, partial seventh section, genuine SW update, protected learning, one update reload and offline continuation. No world/credit/clock/update-event injection. Same source commit, different compiled revision.',cases:[],pass:false};
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const bundle=p=>p.locator('script[type="module"][src]').first().getAttribute('src');
async function waitUntil(predicate,label,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timeout ${label}`);}
async function snapshot(page){return page.evaluate(async()=>{const result={};for(const name of ['SansuDatabase','SansuNatureTownV02']){const open=indexedDB.open(name);const db=await new Promise((res,rej)=>{open.onsuccess=()=>res(open.result);open.onerror=()=>rej(open.error);});try{result[name]={};for(const store of db.objectStoreNames){const q=db.transaction(store).objectStore(store).getAll();result[name][store]=await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}}finally{db.close();}}return result;});}
const town=s=>JSON.parse(s.SansuNatureTownV02.saves[0].current.payload);
async function ready(page){await page.locator('.nature-town').waitFor();await waitUntil(()=>button(page,'れんしゅう').isEnabled(),'town writer');if(await button(page,'一時停止').count())await button(page,'一時停止').click();}
function retainedTown(before,after,maxActiveTicks=0){
 const expected=structuredClone(town(before)),actual=town(after),ticks=actual.world.tick-expected.world.tick;
 assert.ok(Number.isInteger(ticks)&&ticks>=0&&ticks<=maxActiveTicks,`active ticks after reload: ${ticks}`);
 for(let i=0;i<ticks;i++)expected.world=engine.stepWorld(expected.world,engine.context(engine.capabilities(expected.progress))).state;
 assert.deepEqual(actual,expected,'full snapshot equals saved state plus only legitimate active ticks');
 return ticks;
}
function retained(before,after,maxActiveTicks=0){retainedTown(before,after,maxActiveTicks);assert.deepEqual(after.SansuDatabase,before.SansuDatabase,'all native stores');}
try{
 for(const width of [390,768]){
  deployed=oldDir;const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:width===768?'reduce':'no-preference',serviceWorkers:'allow'}),page=await context.newPage();
  page.setDefaultTimeout(20000);const errors=[],reloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',q=>{if(q.isNavigationRequest()&&q.frame()===page.mainFrame()&&new URL(q.url()).searchParams.has('__app-update'))reloads.push(q.url());});
  try{
   await page.goto(base);await page.waitForURL('**/#/onboarding');await page.locator('.island-welcome').waitFor();const profileId=await seedNative(page,`Update ${width}`);await page.goto(`${base}/#/nature-town`);await ready(page);
   assert.equal(await bundle(page),bundles[0]);
   for(const [name,pos] of [['家',[8,6]],['畑',[10,3]]]){await button(page,'どうぐ').click();await page.locator('.town-tools').getByRole('button',{name,exact:true}).click();await page.locator(`[data-cell="${pos.join(',')}"]`).click();await button(page,'ここにする').click();await button(page,'ここにする').waitFor({state:'detached'});}
   await button(page,'れんしゅう').click();await waitMode(page,'learning');
   for(let i=0;i<100;i++){const n=await readNative(page,profileId);if(n.islandPlans.filter(p=>p.status==='completed').length>=6)break;await answerUI(page,n.plan,{dev:false});}
   assert.equal((await readNative(page,profileId)).islandPlans.filter(p=>p.status==='completed').length,6);
   await button(page,'とじる').click();await ready(page);await waitUntil(async()=>town(await snapshot(page)).progress.awards.length===6,'six earned units');
   await button(page,'どうぐ').click();
   for(const text of ['水路 —','台車 —']){await page.locator('.town-unlock').filter({hasText:text}).getByRole('button',{name:'ひらく',exact:true}).click();await waitUntil(async()=>town(await snapshot(page)).progress.unlocks.length===(text==='水路 —'?1:2),'unlock committed');}
   await page.locator('.town-tools').getByRole('button',{name:'水路',exact:true}).click();await page.locator('[data-cell="11,3"]').click();await button(page,'ここにする').click();await button(page,'ここにする').waitFor({state:'detached'});await button(page,'せかい').click();
   await page.screenshot({path:`${out}/${width}-old-town.png`});
   await button(page,'れんしゅう').click();await waitMode(page,'learning');await answerUI(page,(await readNative(page,profileId)).plan,{dev:false});
   const partial=(await readNative(page,profileId)).plan;assert.equal(partial.status,'active');assert.ok(partial.slots.some(s=>s.completed));
   await page.evaluate(async()=>{await navigator.serviceWorker.ready;});assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);
   const before=await snapshot(page);await writeFile(`${out}/${width}-before.json`,JSON.stringify(before,null,2));
   await context.setOffline(true);deployed=newDir;
   const detected=page.waitForResponse(r=>r.url().includes('/version.json')&&r.status()===200);
   await context.setOffline(false);await page.bringToFront();await detected;
   await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;await reg.update();});
   await new Promise(r=>setTimeout(r,5000));
   assert.equal(await bundle(page),bundles[0]);assert.equal(reloads.length,0);retained(before,await snapshot(page));assert.deepEqual((await readNative(page,profileId)).plan,partial);
   await page.screenshot({path:`${out}/${width}-protected-learning.png`});console.log(width,'update held during partial learning');
   await button(page,'とじる').click();
   await page.waitForFunction(expected=>document.querySelector('script[type="module"][src]')?.getAttribute('src')===expected,bundles[1],{timeout:30000});await ready(page);
   retained(before,await snapshot(page),2);assert.equal(reloads.length,1);await page.screenshot({path:`${out}/${width}-new-town.png`});
   await context.setOffline(true);await page.reload();await ready(page);
   assert.equal(await bundle(page),bundles[1]);assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);retained(before,await snapshot(page),4);
   await button(page,'れんしゅう').click();await waitMode(page,'learning');assert.deepEqual((await readNative(page,profileId)).plan,partial);
   await answerUI(page,partial,{dev:false});const advanced=(await readNative(page,profileId)).plan;assert.equal(advanced.id,partial.id);assert.ok(advanced.revision>partial.revision);assert.equal(advanced.status,'active');
   await button(page,'とじる').click();await ready(page);await page.reload();await ready(page);assert.deepEqual((await readNative(page,profileId)).plan,advanced);
   const resumed=await snapshot(page),activeTicks=retainedTown(before,resumed,6);await page.screenshot({path:`${out}/${width}-offline-resumed.png`});
   assert.deepEqual(errors,[]);
   report.cases.push({width,profileId,oldWorldHash:hash(JSON.stringify(town(before).world)),finalWorldHash:hash(JSON.stringify(town(resumed).world)),activeTicks,exactTransitionMatch:true,awards:6,unlocks:town(before).progress.unlocks.map(x=>x.capability),partialPlanId:partial.id,partialRevision:partial.revision,continuedRevision:advanced.revision,updateReloads:reloads.length,offline:true,pass:true});console.log('PASS',width,'two-build + offline continuation');
  }catch(e){await page.screenshot({path:`${out}/${width}-failure.png`}).catch(()=>{});await writeFile(`${out}/${width}-failure.json`,JSON.stringify(await snapshot(page).catch(()=>({})),null,2));throw e;}finally{await context.close();}
 }
 assert.deepEqual(await Promise.all([oldDir,newDir].map(d=>files(d))),distHashes,'served build files unchanged');report.pass=true;
}catch(e){report.error=e.stack;throw e;}finally{report.workerRequests=requests.filter(r=>r.path==='/sw.js');await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(done=>server.close(done));}
