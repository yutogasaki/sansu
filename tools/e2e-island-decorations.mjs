import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readNative} from './island-e2e-helpers.mjs';
import {attempt} from './island-learning-checks.mjs';
import {inventory,closeMenu,putCell} from './island-life-ui-helpers.mjs';
const target=process.env.DECORATIONS_URL||'http://127.0.0.1:5252',out=process.env.DECORATIONS_OUTPUT;assert(out);
assert(['127.0.0.1','localhost'].includes(new URL(target).hostname));await mkdir(out,{recursive:false});
const bundle=await build({stdin:{contents:"export {replayLife,commandLife} from './src/domain/islandLife/simulation.ts';export {landCells} from './src/domain/islandLife/space.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
const {replayLife,commandLife,landCells}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fingerprint(){
 const walk=async dir=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]))).flat();
 const paths=[...await walk('src'),...await walk('dist'),'vite.config.ts','package.json','package-lock.json','tools/e2e-island-decorations.mjs','tools/island-learning-checks.mjs','tools/island-life-ui-helpers.mjs','tools/island-e2e-helpers.mjs'].sort();
 const files=await Promise.all(paths.map(async path=>({path,sha256:hash(await readFile(path))})));return {sha256:hash(JSON.stringify(files)),files};
}
const sourceStart=await fingerprint();
const version=await(await fetch(target+'/version.json')).json();
const report={target,version,candidate:'island-placeable-decorations-v1',humanN:0,sourceStart,fixture:'Actual six earned problem completions and UI purchases. Native abort is fault injection; 30-item stress world is a separate synthetic fixture.',cases:[],pass:false};
async function record(p,value){return p.evaluate(async value=>{
 const open=indexedDB.open('SansuIslandLifeV1'),db=await new Promise((a,b)=>{open.onsuccess=()=>a(open.result);open.onerror=()=>b(open.error);});
 const tx=db.transaction('worlds',value?'readwrite':'readonly'),store=tx.objectStore('worlds');
 const done=new Promise((a,b)=>{tx.oncomplete=a;tx.onabort=()=>b(tx.error);});
 const request=value?store.put(value):store.getAll();const result=await new Promise((a,b)=>{request.onsuccess=()=>a(request.result);request.onerror=()=>b(request.error);});await done;db.close();return value||result[0];
},value);}
async function until(read,accept){const end=Date.now()+45000;while(Date.now()<end){const value=await read();if(accept(value))return value;await new Promise(r=>setTimeout(r,120));}throw Error('Saved boundary timed out');}
const ready=p=>p.locator('.life-world[data-rendered="true"]').waitFor();
const assets=p=>p.waitForFunction(()=>{try{return JSON.parse(document.querySelector('.life-world').dataset.runtimeAssets).pending.length===0;}catch{return false;}});
async function buy(p,kind,cell){const previous=await record(p);await closeMenu(p);await p.getByRole('button',{name:'つくる',exact:true}).click();await p.getByRole('group',{name:'しまの ていれ'}).getByRole('button',{name:'つくる',exact:true}).click();
 const index=await p.locator('[data-life-buy]').evaluateAll((nodes,k)=>nodes.findIndex(n=>n.dataset.lifeBuy===k),kind);assert(index>=0);
 await p.getByRole('button',{name:`${Math.floor(index/2)+1}ページめ`,exact:true}).click();if(kind==='fence')await p.screenshot({path:`${out}/${p.viewportSize().width}-catalog.png`});await p.locator(`[data-life-buy="${kind}"]`).click();
 await putCell(p,cell);const next=await until(()=>record(p),r=>r.actions.slice(previous.actions.length).some(a=>a.command.type==='buy'&&a.command.kind===kind));return next.actions.find(a=>a.command.type==='buy'&&a.command.kind===kind).id;
}
async function metrics(p){return p.evaluate(async()=>{
 const times=[];let last=performance.now();for(let i=0;i<65;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>=5)times.push(now-last);last=now;}times.sort((a,b)=>a-b);
 const n=document.querySelector('.life-world');return {assets:JSON.parse(n.dataset.runtimeAssets),render:JSON.parse(n.dataset.lifeRender),rafMedianMs:times[30],rafP95Ms:times[57],samples:60,resources:performance.getEntriesByType('resource').filter(r=>/\.glb/.test(r.name)).map(r=>({url:r.name,bytes:r.encodedBodySize,duration:r.duration}))};
});}
const browser=await chromium.launch();
try{for(const width of [390,768]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:width===768?'reduce':'no-preference'}),p=await context.newPage(),errors=[];p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(target);for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).first().click();await p.locator('.island-learning[data-input-ready="true"]').waitFor();
 let native=await readNative(p),completed=0,inputs=0;while(completed<6){const result=await attempt(p,native,{touch:true});native=result.after;if(result.sample.completed)completed++;assert(++inputs<100);}
 await p.getByRole('button',{name:'とじる',exact:true}).click();await ready(p);await assets(p);await until(()=>record(p),r=>r.credits.length===6);
 const earned=await record(p);assert.equal(replayLife(earned).drops,12);const learning=await readNative(p);
 const zero=await metrics(p);await p.screenshot({path:`${out}/${width}-earned.png`});
 const fence=await buy(p,'fence',{x:1,z:3}),planter=await buy(p,'planter',{x:3,z:3});await assets(p);
 assert.equal(replayLife(await record(p)).drops,2);const two=await metrics(p);assert.equal(two.assets.instances,6);assert.equal(two.assets.loaded.length,4);
 await p.screenshot({path:`${out}/${width}-placed.png`});
 await inventory(p,fence);assert.equal(await p.getByRole('button',{name:'ぽこもこを よぶ',exact:true}).count(),0);assert(!await p.getByRole('button',{name:'ぽこもこを よぶ',exact:true}).isVisible());
 await p.screenshot({path:`${out}/${width}-item-menu.png`});const prior=await record(p);await p.getByRole('button',{name:'むきを かえる',exact:true}).click();await until(()=>record(p),r=>replayLife(r).items.find(i=>i.id===fence)?.rotation===1);await closeMenu(p);await p.screenshot({path:`${out}/${width}-rotated.png`});
 await inventory(p,fence);await p.getByRole('button',{name:'うごかす',exact:true}).click();await putCell(p,{x:1,z:4});await until(()=>record(p),r=>replayLife(r).items.find(i=>i.id===fence)?.cell?.z===4);
 await inventory(p,fence);await p.getByRole('button',{name:'しまう',exact:true}).click();await until(()=>record(p),r=>!replayLife(r).items.find(i=>i.id===fence)?.cell);
 await p.getByRole('button',{name:'おく',exact:true}).click();await putCell(p,{x:0,z:3});let kept=await until(()=>record(p),r=>replayLife(r).items.find(i=>i.id===fence)?.cell?.x===0);assert.equal(replayLife(kept).items.find(i=>i.id===fence).rotation,1);
 await inventory(p,planter);const beforeFailure=await record(p);
 await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='worlds'&&value.actions?.at(-1)?.command.type==='rotate'){IDBObjectStore.prototype.put=put;this.transaction.abort();}return put.call(this,value,...args);};});
 await p.getByRole('button',{name:'むきを かえる',exact:true}).click();await p.locator('.life-error').waitFor();assert.deepEqual((await record(p)).actions,beforeFailure.actions);assert.equal(replayLife(await record(p)).drops,2);
 await p.getByRole('button',{name:'もういちど',exact:true}).click();kept=await until(()=>record(p),r=>replayLife(r).items.find(i=>i.id===planter)?.rotation===1);assert.equal(kept.actions.length,beforeFailure.actions.length+1);
 await closeMenu(p);await p.reload();await ready(p);await assets(p);assert.deepEqual((await record(p)).actions,kept.actions);assert.deepEqual(await readNative(p),learning);
 await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload();await ready(p);await context.setOffline(true);await p.reload();await ready(p);assert.deepEqual((await record(p)).actions,kept.actions);await p.screenshot({path:`${out}/${width}-offline.png`});
 await p.getByRole('button',{name:'まなぶ',exact:true}).first().click();await p.locator('.island-learning[data-input-ready="true"]').waitFor();assert.deepEqual(await readNative(p),learning);await p.screenshot({path:`${out}/${width}-learning-resume.png`});
 await context.setOffline(false);await p.getByRole('button',{name:'とじる',exact:true}).click();await ready(p);
 // Separate stress fixture: retain the earned record, but add explicitly synthetic credits and legal purchases.
 let stress=await record(p);const now=stress.now;stress={...stress,credits:[...stress.credits,...Array.from({length:200},(_,i)=>({id:'qa-stress-'+i,at:now,day:'qa-stress'}))]};
 for(const side of ['west','east','south'])stress=commandLife(stress,{type:'expand',side},'qa-expand-'+side,now);
 for(const cell of landCells(replayLife(stress))){if(replayLife(stress).items.length>=30)break;try{stress=commandLife(stress,{type:'buy',kind:replayLife(stress).items.length%2?'planter':'fence',cell},'qa-prop-'+cell.x+'-'+cell.z,now);}catch{/* Real validator protects occupants and home. */}}
 assert.equal(replayLife(stress).items.length,30);await record(p,stress);const start=performance.now();await p.reload();await ready(p);await assets(p);const openingMs=performance.now()-start;const thirty=await metrics(p);assert.equal(thirty.assets.instances,34);assert.equal(thirty.assets.loaded.length,4);assert.equal(thirty.render.textures,two.render.textures);
 await p.screenshot({path:`${out}/${width}-thirty.png`});assert.equal(thirty.resources.length,8);
 await p.locator('.life-camera-tools summary').click();await p.getByRole('button',{name:'しま全体を みる',exact:true}).click();const smaller=p.getByRole('button',{name:'しまを ちいさく',exact:true});for(let i=0;i<10&&await smaller.isEnabled();i++)await smaller.click();const distant=await metrics(p);assert(distant.assets.far>0);await p.screenshot({path:`${out}/${width}-distant.png`});
 assert.deepEqual(errors,[]);report.cases.push({width,completed,inputs,fence,planter,version:(await record(p)).version,zero,two,thirty,distant,openingMs,ownershipAndLearningPreserved:true,abortRetriedExactlyOnce:true,stressFixture:'200 synthetic credits; legal commands; 30 purchased items plus 4 fixed decorations',priorActions:prior.actions.length,errors});
 }catch(e){await p.screenshot({path:`${out}/${width}-failure.png`}).catch(()=>{});report.failure={width,message:e.stack,body:await p.locator('body').innerText(),record:await record(p).catch(()=>null),errors};throw e;}finally{await context.close();}
}assert.equal((await fingerprint()).sha256,sourceStart.sha256,'Frozen app and harness inputs');report.pass=true;
}finally{report.harnessSha256=hash(await readFile(new URL(import.meta.url)));await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({pass:report.pass,cases:report.cases.length}));
