import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
const out = process.argv[2]; assert(out && !out.includes('..'));
const bundle = await build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition'; export { deriveAuthoredGrowthTerrainPlan, composeAuthoredGrowthTerrainWorld } from './src/domain/growingIsland/authoredGrowthTerrain'; export { planAuthoredDistrict } from './src/domain/growingIsland/authoredDistrictWorld';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const domain = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const c = JSON.parse(gunzipSync(readFileSync('docs/design/2026-10-12-growth-terrain-source/rounded-coast-v2/authored-growth-terrain-kit.json.gz'))), m = JSON.parse(readFileSync('docs/design/2026-10-12-growth-terrain-source/rounded-coast-v2/authored-growth-terrain-manifest.json'));
const result = { scope: 'Source geometry/domain composition diagnostic. Synthetic two-owner poses only; not ordinary UI purchase or maturity evidence.', cases: {}, pass: false };
try {
 const def = { version: 1, id: 'growth-source-test', source: c.source, districts: [c.template.district], edges: c.template.edges };
 const base = domain.compileWorldDefinition(def);
 assert.deepEqual(c.template, JSON.parse(gunzipSync(readFileSync('docs/design/2026-10-12-growth-terrain-source/rounded-coast-v2/v1-input/authored-growth-terrain-kit.json.gz'))).template);
 result.baseline = { sites: base.sites.length, rights: base.sites.filter(s=>s.placement).length };
 const reachable = (world,start) => { const key = p=>`${p.x},${p.z}`, seen = new Set([key(start)]), q=[start]; for(let i=0;i<q.length;i++)for(const v of world.neighbors(q[i],'walk'))if(!seen.has(key(v))){seen.add(key(v));q.push(v);}return seen; };
 const reached = reachable(base,{x:0,z:0});
 for(const p of m.authoring.fixedRights){ assert(reached.has(`${p.x},${p.z}`), `base ownership unreachable ${JSON.stringify(p)}`); const h=base.floorAt(p).point.y; for(const dx of [-.46,0,.46])for(const dz of [-.46,0,.46]) { const s=base.floorAt({x:p.x+dx,z:p.z+dz}); assert(s&&Math.abs(s.point.y-h)<=.28,'unsupported footprint'); } }
 for(const [id,entry] of Object.entries(m.diagnosticCases)){
  const state={landmarks:entry.localCells.map((cell,i)=>({id:`source-${i}`,kind:'sapling',growth:18,cell}))};
  const plan=domain.deriveAuthoredGrowthTerrainPlan(state,base,c);
  assert.equal(plan.assemblies.length,1); assert.equal(plan.assemblies[0].shape,entry.expectedShape); assert.equal(plan.assemblies[0].socketId,entry.expectedSocket);
  const world=domain.composeAuthoredGrowthTerrainWorld(base,c,plan); const reached=reachable(world,{x:0,z:0});
  const added=world.sites.filter(s=>s.ref.districtId!==c.template.id);
  result.cases[id]={plan,sites:world.sites.length,added:added.length,reachedAdded:added.filter(s=>reached.has(`${s.cell.x},${s.cell.z}`)).length};
  assert(added.some(s=>reached.has(`${s.cell.x},${s.cell.z}`)),'no route from base to patch');
  assert.equal(world.sites.filter(s=>s.placement).length,6);
 }
 const existing=JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz'))), catalog=JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/authored-district-kit.json.gz')));
 const acquired=domain.planAuthoredDistrict(domain.compileWorldDefinition(existing),{...catalog,templates:[...catalog.templates,c.template]},[],{id:'source-growing-shore',templateId:c.template.id,parent:{districtId:catalog.basePorts[0].districtId,portId:catalog.basePorts[0].id}});
 result.acquisition={grant:acquired.grant,rights:acquired.world.sites.filter(s=>s.placement).length};
 result.pass=true;
} catch(error){result.error=String(error.message);process.exitCode=1;}
writeFileSync(out,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({pass:result.pass,error:result.error,cases:Object.keys(result.cases)}));
