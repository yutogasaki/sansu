import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const catalogPath=resolve(root,'docs/product/island-place-goals.json');
const data=JSON.parse(await readFile(catalogPath,'utf8'));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const checks=[];
const check=(label,fn)=>{fn();checks.push(label);};
const unique=arr=>new Set(arr).size===arr.length;
const ids=data.goals.map(g=>g.id), families=new Set(data.goals.map(g=>g.family));
check('design scope and preserved ownership/rewards',()=>{
 assert.equal(data.status,'RUNTIME_INTEGRATED');assert.equal(data.common.ownedOnly,true);
 assert.equal(data.common.consumeMembers,false);assert.equal(data.common.clockResetOnReconnect,false);
 assert.equal(data.common.goalMandatory,false);assert.equal(data.common.learningRewardChange,false);
 assert.equal(data.common.additionalCurrency,false);
});
check('6 goals / 15 layouts / 4 relations / 4 delivery stages',()=>{
 assert.equal(data.goals.length,6);assert(unique(ids));
 assert.equal(data.goals.reduce((n,g)=>n+g.variants.length,0),15);
 assert.equal(data.combinations.length,4);assert.equal(data.delivery.length,4);
 assert(unique(data.combinations.map(c=>c.id)));assert(unique(data.delivery.map(d=>d.id)));
 assert.equal(data.common.attachmentMaxWalkCells,2);assert.equal(data.common.relationMaxWalkCells,3);
});
const kindSource=await readFile(resolve(root,'src/domain/islandLife/model.ts'),'utf8');
const plotSource=await readFile(resolve(root,'src/domain/growingIsland/types.ts'),'utf8');
const union=(src,name)=>new Set([...src.match(new RegExp('export type '+name+' = ([^;]+);'))[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
const itemKinds=union(kindSource,'ItemKind'), plotKinds=union(plotSource,'SeedKind');
const blocking=p=>['tree','home','seat','play'].includes(p.role);
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
function joined(a,b,demo,water=false){
 const dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
 if(dx+dz===1)return true;
 if(water)return false;
 if((dx===2&&dz===0)||(dx===0&&dz===2)){
  const mid=demo.find(p=>p.x===(a.x+b.x)/2&&p.z===(a.z+b.z)/2);
  return !mid||!blocking(mid);
 }
 return false;
}
function allConnected(nodes,demo,water=false){
 if(!nodes.length)return true;
 const reached=new Set([nodes[0]]),queue=[nodes[0]];
 for(const a of queue)for(const b of nodes)if(!reached.has(b)&&joined(a,b,demo,water)){reached.add(b);queue.push(b);}
 return reached.size===nodes.length;
}
for(const g of data.goals) {
 check(g.id+' catalog and existing material types',()=>{
  assert.equal(g.stages.length,4);assert(unique(g.stages.map(s=>s.id)));
  for(const s of g.stages)for(const field of ['label','condition','changes','play'])assert(s[field]?.trim());
  assert(unique(g.variants.map(v=>v.id)));
  for(const i of g.inputs){
   assert(Number.isInteger(i.count)&&i.count>0);assert(i.state);
   const [prefix,kind]=i.kind.split(':');
   assert((prefix==='landmark'&&itemKinds.has(kind))||(prefix==='plot'&&plotKinds.has(kind)),i.kind);
  }
  for(const next of g.next)assert(ids.includes(next));
 });
 for(const v of g.variants) {
  check(g.id+'/'+v.id+' same inputs and valid layout',()=>{
   const counts=Object.fromEntries(g.inputs.map(i=>[i.role,i.count]));
   const actual={};const cells=[];
   for(const p of v.demo){
    assert(Number.isInteger(p.x)&&p.x>=0&&p.x<=6);
    assert(Number.isInteger(p.z)&&p.z>=0&&p.z<=5);
    actual[p.role]=(actual[p.role]||0)+1;cells.push(p.x+','+p.z);
   }
   assert.deepEqual(actual,counts);assert(unique(cells));
   const nature=v.demo.filter(p=>['tree','flower'].includes(p.role));
   assert(allConnected(nature,v.demo),'disconnected nature layout');
   if(g.id==='P03'){
    const water=v.demo.filter(p=>['water','channel'].includes(p.role));
    assert(allConnected(water,v.demo,true),'water path not edge-connected');
    for(const channel of water.filter(p=>p.role==='channel'))assert(water.some(p=>p.role==='water'&&manhattan(p,channel)<=8));
    const flower=v.demo.find(p=>p.role==='flower');
    assert(water.some(p=>manhattan(p,flower)<4),'flower outside current water influence');
   }
   if(g.id==='P04'){
    assert.equal(v.terrain,'shore');
    assert(manhattan(v.demo.find(p=>p.role==='water'),v.demo.find(p=>p.role==='play'))<4,'play outside water influence');
   }
   if(['P02','P05'].includes(g.id)&&v.id==='court')assert(!v.demo.some(p=>p.x===2&&p.z===2&&blocking(p)),'courtyard center blocked');
   assert(['any','slope','shore'].includes(v.terrain));
  });
 }
 await access(resolve(dirname(catalogPath),g.image));
}
check('relations reference different available families',()=>{
 for(const c of data.combinations){assert.equal(c.families.length,2);assert(unique(c.families));for(const f of c.families)assert(families.has(f));for(const key of ['condition','visible','play','noStack'])assert(c[key]?.trim());}
});
const glb=resolve(root,'docs/design/2026-10-10-island-final-3d/whole-island.glb');
const glbHash=await hash(glb);
check('accepted art baseline revision',()=>assert(glbHash.startsWith(data.artBaseline.glbRevision)));
await access(resolve(dirname(catalogPath),data.artBaseline.image));
const decision=JSON.parse(await readFile(resolve(root,'docs/design/2026-10-10-island-final-3d/art-decision.json'),'utf8'));
check('direct user decision matches art baseline',()=>{assert.equal(decision.candidate,data.artBaseline.candidate);assert.equal(decision.glbRevision,data.artBaseline.glbRevision);assert.equal(decision.status,'ACCEPTED_FOR_MECHANISM_DESIGN');});
const report={
 id:'place-goals-catalog-check-v1',status:'PASS',scope:'Catalog consistency only; runtime integration and natural play require separate evidence.',
 catalog:data.id,catalogSha256:await hash(catalogPath),artCandidate:data.artBaseline.candidate,artGlbSha256:glbHash,
 checks,counts:{goals:6,layouts:15,relations:4,stagesPerGoal:4,delivery:4},
 runtimeImplementation:'INTEGRATED_SEPARATE_VERIFICATION'
};
await writeFile(new URL('./catalog-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,...report.counts,catalogSha256:report.catalogSha256}));

