import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
const out=process.argv[2],d=process.argv[3]??'docs/design/2026-10-12-core-growth-terrain-source';assert(out);
const bundle=await build({stdin:{contents:"export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition';export {deriveAuthoredGrowthTerrainPlan,composeAuthoredGrowthTerrainWorld} from './src/domain/growingIsland/authoredGrowthTerrain';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const catalog=JSON.parse(gunzipSync(readFileSync(`${d}/authored-core-growth-terrain-kit.json.gz`))), manifest=JSON.parse(readFileSync(`${d}/authored-core-growth-terrain-manifest.json`));
const original=JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz'))),base=api.compileWorldDefinition(original);
const report={scope:'Source/domain diagnostic only; synthetic four owner cells, no UI commands or actor-obstruction acceptance',pass:false,cases:{}};
try{
 assert.deepEqual(catalog.template.district.floors,original.districts[0].floors);assert.deepEqual(catalog.template.district.sites,original.districts[0].sites);
 assert.equal(base.sites.filter(s=>s.placement).length,73);
 const reach=(world,start,allowed)=>{const key=p=>`${p.x},${p.z}`,seen=new Set([key(start)]),q=[start];for(let i=0;i<q.length;i++)for(const c of world.neighbors(q[i],'walk'))if(!seen.has(key(c))&&(!allowed||allowed.has(key(c)))){seen.add(key(c));q.push(c);}return seen;};
 for(const [id,c]of Object.entries(manifest.variationCases)){
  const state={landmarks:c.localCells.map((cell,i)=>({id:`source-${i}`,kind:'sapling',cell,growth:18}))},plan=api.deriveAuthoredGrowthTerrainPlan(state,base,catalog);
  assert.equal(plan.rejectedReason,undefined);assert.deepEqual(plan.assemblies.map(a=>a.socketId).sort(),c.expectedSockets.toSorted());assert(plan.assemblies.every(a=>a.shape===c.expectedShape));assert.deepEqual(plan.connections.map(c=>c.connectionId),c.expectedConnections);
  const world=api.composeAuthoredGrowthTerrainWorld(base,catalog,plan),added=world.sites.filter(s=>s.ref.districtId!==original.districts[0].id),walk=reach(world,{x:13.5,z:-8});
  assert.equal(world.sites.filter(s=>s.placement).length,73);assert(added.every(s=>walk.has(`${s.cell.x},${s.cell.z}`)));
  const a={x:13.5,z:-8},b={x:14,z:-4.5},allowed=new Set(added.map(s=>`${s.cell.x},${s.cell.z}`));allowed.add(`${a.x},${a.z}`);allowed.add(`${b.x},${b.z}`);
  const outerRoute=reach(world,a,allowed).has(`${b.x},${b.z}`);assert.equal(outerRoute,id==='loop');
  report.cases[id]={plan,addedSites:added.length,reachedAdded:added.filter(s=>walk.has(`${s.cell.x},${s.cell.z}`)).length,rights:73,outerRoute,bounds:world.bounds};
 }
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,error:report.error,cases:Object.keys(report.cases)}));
