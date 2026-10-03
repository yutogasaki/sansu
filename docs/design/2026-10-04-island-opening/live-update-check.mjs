import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from '../../../tools/island-e2e-helpers.mjs';
const base=process.env.SANSU_OPENING_LIVE_URL||'https://sansu-seven.vercel.app',out=process.env.SANSU_OPENING_LIVE_OUTPUT;
assert(out,'Specify a fresh output directory');await fs.mkdir(out,{recursive:false});
const b=await chromium.launch(),c=await b.newContext({viewport:{width:768,height:1024},hasTouch:true,serviceWorkers:'allow'}),p=await c.newPage();p.setDefaultTimeout(60000);
const report={target:base,pass:false};const errors=[];p.on('pageerror',e=>errors.push(e.message));
const ready=async()=>{await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'})};
const stored=()=>p.evaluate(async()=>{
 const q=indexedDB.open('SansuDatabase'),db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 try{return Object.fromEntries(await Promise.all([...db.objectStoreNames].map(async name=>{const r=db.transaction(name).objectStore(name).getAll();return [name,await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})]})))}finally{db.close()}
});
try{
 await p.goto(`${base}/#/island`);await p.locator('.island-welcome .island-stage__viewport[aria-busy="false"]').waitFor();
 await p.getByRole('button',{name:'まなぶ',exact:true}).click();for(const name of ['小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).click();await ready();
 await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();let native=await readNative(p);native=(await answerUI(p,native.plan,{touch:true,dev:false})).state;
 await p.getByRole('button',{name:'とじる',exact:true}).tap();await ready();await p.evaluate(()=>navigator.serviceWorker.ready);
 await p.reload();await ready();await c.setOffline(true);await p.reload();await ready();
 report.oldMetadata=await runtimeMetadata(p);report.oldNative=await stored();await p.screenshot({path:`${out}/old-offline.png`});
 console.log('READY OLD',JSON.stringify({revision:report.oldMetadata.revision,version:report.oldMetadata.version,logs:native.logs.length}));
 const revision=await new Promise(resolve=>process.stdin.once('data',chunk=>resolve(String(chunk).trim())));assert(/^[a-f0-9]{40}$/.test(revision));report.expectedRevision=revision;
 let version;for(let i=0;i<120;i++){try{version=await fetch(`${base}/version.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json());if(version.revision===revision)break;}catch{}await new Promise(ok=>setTimeout(ok,5000))}assert.equal(version?.revision,revision);report.publicVersion=version;
 await c.setOffline(false);await p.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'))});
 // A real safe route ends the old playable session; no synthetic update event or cache clearing.
 await p.getByRole('button',{name:'きろく',exact:true}).tap();
 await p.waitForFunction(expected=>document.querySelector('.app-container')?.getAttribute('data-build-revision')===expected,revision,{timeout:90000});
 await p.getByRole('button',{name:'しま',exact:true}).tap();await ready();
 report.newMetadata=await runtimeMetadata(p);assert.equal(report.newMetadata.revision,revision);
 assert.deepEqual(await stored(),report.oldNative);await p.screenshot({path:`${out}/new-online.png`});
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await ready();await c.setOffline(true);await p.reload();await ready();assert.deepEqual(await stored(),report.oldNative);
 await p.locator('.island-shell-tab--learn').tap();await p.locator('[data-input-ready="true"]').waitFor();const before=await readNative(p);const after=(await answerUI(p,before.plan,{touch:true,dev:false})).state;
 assert.equal(after.logs.length,before.logs.length+1);report.newOfflineAnswer={before:before.logs.length,after:after.logs.length,plan:after.plan.id,cursor:after.plan.cursor};await p.screenshot({path:`${out}/new-offline-answer.png`});
 assert.deepEqual(errors,[]);report.pass=true;console.log('PASS LIVE UPDATE',revision);
}catch(error){report.error=error.stack||String(error);await p.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await b.close()}
