import { build } from 'esbuild';
let domain;
export async function expandRuntimeFixture(page) {
 if(!domain){const built=await build({stdin:{contents:"export {commandLife,replayLife} from './src/domain/islandLife/simulation.ts'; export {learningDay} from './src/domain/islandLife/model.ts'; export {landCells} from './src/domain/islandLife/space.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env.DEV':'false'},logLevel:'silent'});domain=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);}
 const record=await page.evaluate(async()=>{
  const names=await indexedDB.databases(),name=names.find(d=>d.name.startsWith('SansuIslandLife'))?.name;
  const req=indexedDB.open(name),db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
  const get=db.transaction('worlds').objectStore('worlds').getAll();const rows=await new Promise((r,j)=>{get.onsuccess=()=>r(get.result);get.onerror=()=>j(get.error);});db.close();return rows[0];
 });
 let at=Math.max(Date.now(),record.now)+1,next={...record,credits:[...record.credits,...Array.from({length:200},(_,i)=>({id:`qa-expanded-${i}`,at,day:domain.learningDay(at)}))]};
 for(const side of ['west','east','south'])next=domain.commandLife(next,{type:'expand',side},`qa-expanded-land-${side}`,++at);
 for(const cell of domain.landCells(domain.replayLife(next))){
  if(cell.z%2!==0||cell.x%2!==0||domain.replayLife(next).items.length>=30)continue;
  try {next=domain.commandLife(next,{type:'buy',kind:'bench',cell},`qa-expanded-bench-${cell.x}-${cell.z}`,++at);}catch{/* Occupied cells/house stay protected by the real command validator. */}
 }
 next={...next,realAt:Date.now()};const state=domain.replayLife(next);
 if(state.items.length<20)throw new Error(`Expanded fixture incomplete: ${state.items.length}`);
 await page.evaluate(async row=>{
  const names=await indexedDB.databases(),name=names.find(d=>d.name.startsWith('SansuIslandLife'))?.name;
  const req=indexedDB.open(name),db=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
  const tx=db.transaction('worlds','readwrite');tx.objectStore('worlds').put(row);await new Promise((r,j)=>{tx.oncomplete=r;tx.onabort=()=>j(tx.error);});db.close();
 },next);
 return {items:state.items.length,landCells:domain.landCells(state).length,expansions:[state.expanded,...state.extraLand],fixture:'200 synthetic credits; real commandLife validation; disposable browser only'};
}
