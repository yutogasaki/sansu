import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/yutogasaki/Projects/sansu/node_modules/playwright/index.mjs';
import { readNative,answerUI,runtimeMetadata } from '/Users/yutogasaki/Projects/sansu/tools/island-e2e-helpers.mjs';
const base='http://127.0.0.1:5277',out='/Users/yutogasaki/Projects/sansu/output/playwright/ipad-growing-migration-chromium';
const report={target:base,cases:[],pass:false};
async function read(page,name,table,id){return page.evaluate(async({name,table,id})=>{const q=indexedDB.open(name);const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});try{const r=db.transaction(table).objectStore(table).get(id);return await new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}finally{db.close()}},{name,table,id})}
for(const engine of [chromium]){
const b=await engine.launch();
try{
const context=await b.newContext({viewport:{width:768,height:1024},hasTouch:true,serviceWorkers:'allow'});
await context.addInitScript(()=>{
window.migrationMessages=[];window.migrationFrames=0;
const NativeWorker=Worker;
window.Worker=class extends NativeWorker{
 constructor(url,options){
 if(String(url).includes('lifeMigration.worker') && sessionStorage.getItem('migration-fault')) throw new Error('explicit worker fault');
 super(url,options);
 if(String(url).includes('lifeMigration.worker')) this.addEventListener('message',e=>window.migrationMessages.push(e.data));
 }
};
const frame=()=>{if(document.querySelector('[data-loading-step="saving"]'))window.migrationFrames++;requestAnimationFrame(frame)};requestAnimationFrame(frame);
});
const p=await context.newPage();p.setDefaultTimeout(130000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(base+'/#/island');await p.getByRole('button',{name:'まなぶ',exact:true}).waitFor();
await p.getByRole('button',{name:'まなぶ',exact:true}).click();
for(const name of ['小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).click();
await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'});
const id=(await readNative(p)).island.profileId;
const fixturePage=await context.newPage();await fixturePage.goto('http://127.0.0.1:5276/version.json');
const fixture=await fixturePage.evaluate(async profileId=>{
const {IslandLifeDatabase,updateLife}=await import('/src/domain/islandLife/repository.ts');
const {HOUR}=await import('/src/domain/islandLife/model.ts');
const t=Date.now()-20*24*HOUR,db=new IslandLifeDatabase('fixture-'+profileId);
const facts=Array.from({length:15},(_,i)=>({id:`fixture-${i}`,at:t+i}));
let r=await updateLife(profileId,facts,undefined,t+1000,db,t);
r=await updateLife(profileId,facts,{id:'flower',revision:r.revision,command:{type:'buy',kind:'flower',cell:{x:1,z:3}}},t+1001,db);
r=await updateLife(profileId,facts,{id:'water',revision:r.revision,command:{type:'buy',kind:'water-bowl',cell:{x:4,z:3}}},t+1002,db);
await db.delete();return r;
},id);
await fixturePage.close();await p.goto(base+'/version.json');
await p.evaluate(()=>new Promise((ok,no)=>{const q=indexedDB.deleteDatabase('SansuGrowingIslandV1');q.onsuccess=ok;q.onerror=()=>no(q.error)}));
await p.evaluate(async record=>{const q=indexedDB.open('SansuIslandLifeV1',10);q.onupgradeneeded=()=>q.result.createObjectStore('worlds',{keyPath:'profileId'});const db=await new Promise((ok,no)=>{q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});const tx=db.transaction('worlds','readwrite');tx.objectStore('worlds').put(record);await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});db.close();sessionStorage.setItem('migration-fault','1')},fixture);
const nativeBefore=await readNative(p,fixture.profileId);
await p.goto(base+'/#/island');await p.getByRole('alert').waitFor();assert.match(await p.getByRole('alert').innerText(),/もういちど/);
assert.deepEqual(await read(p,'SansuIslandLifeV1','worlds',fixture.profileId),fixture);
assert.equal(await read(p,'SansuGrowingIslandV1','guidedIslands',fixture.profileId),undefined);
assert.deepEqual(await readNative(p,fixture.profileId),nativeBefore);
await p.screenshot({path:out+'/'+engine.name()+'-retry.png'});
await p.evaluate(()=>sessionStorage.removeItem('migration-fault'));const start=Date.now();await p.getByRole('button',{name:'もういちど',exact:true}).click();
await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'});
const took=Date.now()-start, migration=await p.evaluate(()=>({messages:window.migrationMessages,frames:window.migrationFrames}));
assert(migration.messages.length);const state=migration.messages.at(-1).state;assert.equal(state.now,fixture.now+7*24*3600000);
const record=await read(p,'SansuGrowingIslandV1','guidedIslands',fixture.profileId);
assert.equal(record.state.drops,state.drops);assert.deepEqual(record.state.landmarks.map(l=>[l.id,l.kind,l.cell,l.growth]),state.items.map(l=>[l.id,l.kind,l.cell,l.growth]));
assert.deepEqual(await read(p,'SansuIslandLifeV1','worlds',fixture.profileId),fixture);assert.deepEqual(await readNative(p,fixture.profileId),nativeBefore);
await p.screenshot({path:out+'/'+engine.name()+'-ready.png'});
await p.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await p.evaluate(()=>navigator.serviceWorker.ready);
const cachesBefore=await p.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>({key,urls:(await (await caches.open(key)).keys()).map(r=>r.url)}))))});
assert(cachesBefore.some(c=>c.urls.some(u=>u.includes('lifeMigration.worker'))));
console.log('MIGRATION PASS',engine.name(),took,migration.frames);
report.migrationPass ??= []; report.migrationPass.push({engine:engine.name(),tookMs:took,frames:migration.frames,legacyPreserved:true,clockCap:true,retry:true});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
await context.setOffline(true);await p.goto(base+'/#/island',{waitUntil:'domcontentloaded'});await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'});
await p.locator('.island-shell-tab--learn').click();await p.locator('[data-input-ready="true"]').waitFor();
const native=await readNative(p,fixture.profileId);const learned=(await answerUI(p,native.plan,{touch:true,dev:false})).state;assert.equal(learned.logs.length,native.logs.length+1);
await p.getByRole('button',{name:'とじる',exact:true}).click();await p.locator('[data-growing-island="ready"] canvas').waitFor();await p.locator('.growing-loading--overlay').waitFor({state:'hidden'});
await p.screenshot({path:out+'/'+engine.name()+'-offline.png'});
assert.deepEqual(await read(p,'SansuIslandLifeV1','worlds',fixture.profileId),fixture);
assert.deepEqual(errors,[]);report.cases.push({engine:engine.name(),tookMs:took,framesDuringMigration:migration.frames,workerLogicalNow:state.now,nativePreserved:true,legacyPreserved:true,workerCached:true,offlineAnswer:true,metadata:await runtimeMetadata(p)});
await context.close();
}catch(e){report.failure=String(e.stack);throw e}finally{await b.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2))}
}
report.pass=true;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
