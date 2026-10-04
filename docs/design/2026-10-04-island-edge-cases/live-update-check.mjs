import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { answerUI, readNative, runtimeMetadata, waitForAsync } from '../../../tools/island-e2e-helpers.mjs';
const base=process.env.SANSU_OPENING_LIVE_URL||'https://sansu-seven.vercel.app',out=process.env.SANSU_OPENING_LIVE_OUTPUT;
assert(out,'Specify a fresh output directory');await fs.mkdir(out,{recursive:false});
const b=await chromium.launch(),c=await b.newContext({viewport:{width:768,height:1024},hasTouch:true,serviceWorkers:'allow',userAgent:'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'}),p=await c.newPage();p.setDefaultTimeout(60000);
const freshOnly=process.env.SANSU_OPENING_LIVE_FRESH_ONLY==='1';
const report={target:base,mode:freshOnly?'fresh current release; not a cross-release update':'live old to new release',pass:false,device:'Chromium with iPad UA; not a physical iPad',qaHash:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),navigations:[],packWaitNavigations:[]};const errors=[];p.on('pageerror',e=>errors.push(e.message));
p.on('framenavigated',frame=>{if(frame===p.mainFrame())report.navigations.push({url:frame.url(),at:Date.now()})});
const ready=async()=>{await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'})};
const stored=()=>p.evaluate(async()=>{
 const q=indexedDB.open('SansuDatabase'),db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 try{return Object.fromEntries(await Promise.all([...db.objectStoreNames].map(async name=>{const r=db.transaction(name).objectStore(name).getAll();return [name,await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})]})))}finally{db.close()}
});
// ready can resolve to the previous active worker while a replacement still installs.
// Before an offline acceptance check, verify the current shell/bundle in precache
// and an active controller with no pending worker; do not clear or inject caches.
const offlinePackReady=async()=>{
 let script=await p.locator('script[type="module"][src]').getAttribute('src');
 const started=Date.now();
 const deadline=started+180000;
 for(;;){try{await waitForAsync(p,async script=>{
  const reg=await navigator.serviceWorker.getRegistration();
  if(!reg?.active||reg.installing||reg.waiting||navigator.serviceWorker.controller!==reg.active)return false;
  for(const name of await caches.keys()){
   if(!name.includes('workbox-precache'))continue;
   const cache=await caches.open(name),html=await cache.match(new URL('/index.html',location.href),{ignoreSearch:true});
   const bundle=await cache.match(new URL(script,location.href),{ignoreSearch:true});
   if(html&&bundle&&(await html.text()).includes(script))return true;
  }
  return false;
 },script,Math.max(1,deadline-Date.now()));break;}catch(error){
  if(!/Execution context was destroyed|Cannot find context/.test(String(error))||Date.now()>=deadline)throw error;
  report.packWaitNavigations.push({url:p.url(),at:Date.now()});
  await p.waitForLoadState('domcontentloaded');await ready();
  script=await p.locator('script[type="module"][src]').getAttribute('src');
 }}
 return {waitMs:Date.now()-started,script,...await p.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,caches:await caches.keys()}))};
};
try{
 await p.goto(`${base}/#/island`);await p.locator('.island-welcome .island-stage__viewport[aria-busy="false"]').waitFor();
 await p.getByRole('button',{name:'まなぶ',exact:true}).click();for(const name of ['小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).click();await ready();
 await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();let native=await readNative(p);native=(await answerUI(p,native.plan,{touch:true,dev:false})).state;
 await p.getByRole('button',{name:'とじる',exact:true}).tap();await ready();await p.evaluate(()=>navigator.serviceWorker.ready);
 await p.reload();await ready();report.oldOfflinePack=await offlinePackReady();await c.setOffline(true);await p.reload();await ready();
 report.oldMetadata=await runtimeMetadata(p);report.oldNative=await stored();await p.screenshot({path:`${out}/old-offline.png`});
 console.log(freshOnly?'READY CURRENT':'READY OLD',JSON.stringify({revision:report.oldMetadata.revision,version:report.oldMetadata.version,logs:native.logs.length}));
 const revision=freshOnly?report.oldMetadata.revision:await new Promise(resolve=>process.stdin.once('data',chunk=>resolve(String(chunk).trim())));assert(/^[a-f0-9]{40}$/.test(revision));report.expectedRevision=revision;
 if(!freshOnly)process.stdin.pause();
 let version;for(let i=0;i<120;i++){try{version=await fetch(`${base}/version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());if(version.revision===revision)break;}catch{}await new Promise(ok=>setTimeout(ok,5000))}assert.equal(version?.revision,revision);report.publicVersion=version;
 await c.setOffline(false);await p.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'))});
 // A real safe route ends the old playable session; no synthetic update event or cache clearing.
 await p.getByRole('button',{name:'きろく',exact:true}).tap();
 await p.waitForFunction(expected=>document.querySelector('.app-container')?.getAttribute('data-build-revision')===expected,revision,{timeout:90000});
 await p.getByRole('button',{name:'しま',exact:true}).tap();await ready();
 report.newMetadata=await runtimeMetadata(p);assert.equal(report.newMetadata.revision,revision);
 report.newGraphics=await p.locator('[data-growing-world] canvas').getAttribute('data-graphics-quality');assert.equal(report.newGraphics,'compact');
 assert.deepEqual(await stored(),report.oldNative);report.nativePreservedOnline=true;await p.screenshot({path:`${out}/new-online.png`});
 report.newOfflinePack=await offlinePackReady();await p.reload();await ready();await c.setOffline(true);await p.reload();await ready();assert.deepEqual(await stored(),report.oldNative);report.nativePreservedOffline=true;
 await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();const before=await readNative(p);const after=(await answerUI(p,before.plan,{touch:true,dev:false})).state;
 assert.equal(after.logs.length,before.logs.length+1);report.newOfflineAnswer={before:before.logs.length,after:after.logs.length,plan:after.plan.id,cursor:after.plan.cursor};await p.screenshot({path:`${out}/new-offline-answer.png`});
 assert.deepEqual(errors,[]);report.pass=true;console.log(freshOnly?'PASS LIVE FRESH':'PASS LIVE UPDATE',revision);
}catch(error){report.error=error.stack||String(error);await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await b.close()}
