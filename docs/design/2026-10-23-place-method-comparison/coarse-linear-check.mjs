import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform } from './curved-grid-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { coarseLinearTerrainTransform } from './coarse-linear-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const files = ['evidence/60-H-linear-stable-placed-state.json', 'evidence/69-H-wide-shore-final-state.json'];
const entry = `
import assert from 'node:assert/strict';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { landBounds } from '../../../src/domain/growingIsland/space';
import { readFileSync } from 'node:fs';
const base=JSON.parse(readFileSync(INPUT_FILE,'utf8'));
const fields=['land','terrain','plots','landmarks','villagers','keepsakes','placeProgress','town','drops','character'];
const state={...newIsland('coarse-read-only-fixture',1000),...structuredClone(Object.fromEntries(fields.map(k=>[k,base[k]])))};
if(EXTREME!==null){state.terrain.heights['4,4']=EXTREME;state.terrain.undo=[];state.terrain.redo=[];}
const original=JSON.stringify(state); validateTerrain(state);
const before=performance.now(), world=editableIslandWorld(state), coldMs=performance.now()-before, bounds=landBounds(state);
const owners=[...state.plots,...state.landmarks,...state.keepsakes].filter(o=>o.cell).map(o=>({id:o.id,cell:o.cell,supported:terrainOwnerSupported(state,o.cell)}));
const sites=world.sites.map(s=>({id:s.ref.siteId,cell:s.cell,placement:s.placement,supported:!!s.support,anchor:s.point}));
const key=p=>p.x+','+p.z;
const edges=world.definition.edges.map(e=>[e.from.siteId,e.to.siteId,e.allows.join(',')].join('|')).sort();
const components={};
for(const kind of ['walk','join','water']){const pending=new Set(sites.map(s=>key(s.cell))), groups=[];while(pending.size){const first=pending.values().next().value, queue=[world.sites.find(s=>key(s.cell)===first).cell];pending.delete(first);for(let i=0;i<queue.length;i++)for(const next of world.neighbors(queue[i],kind))if(pending.delete(key(next)))queue.push(next);groups.push(queue.map(key).sort().join('|'));}components[kind]=groups.sort();}
const waters=world.floors.filter(f=>f.kind==='water'), samples=[];
for(let zi=-10;zi<=bounds.depth*20+10;zi++)for(let xi=bounds.minX*20-10;xi<=bounds.maxX*20+30;xi++){
 const cell={x:xi/20,z:zi/20}, floor=world.floorAt(cell),water=waters.some(f=>!!world.sampleFloorAt(cell,f.id));
 samples.push({cell,dry:!!floor,water,point:floor?.point??null});
}
const commands=[];
for(const cell of [{x:4,z:4},{x:5,z:7}])for(const delta of [-1,1]){
 const command={type:'terrain-edit',cell,delta,actors:[]};let accepted=false,error;const started=performance.now();
 try{applyIntent(state,{id:'coarse-check-'+key(cell)+'-'+delta,command},1000);accepted=true;}catch(e){error=String(e);}
 commands.push({cell,delta,accepted,error,elapsedMs:performance.now()-started});
}
assert.equal(JSON.stringify(state),original);
console.log(JSON.stringify({coarse:COARSE,extreme:EXTREME,coldMs,owners,sites,edges,components,samples,commands,unchangedInput:true,
 counts:{sites:sites.length,edges:edges.length,triangles:world.floors.reduce((n,f)=>n+f.indices.length/3,0)},revision:world.revision}));
`;
const results=[];
for(const input of files)for(const extreme of [null,-4,12])for(const coarse of [false,true]){
 const output=`/private/tmp/sansu-coarse-linear-${coarse}.mjs`;
 await build({stdin:{contents:entry,resolveDir:dir,sourcefile:'coarse-linear-entry.ts',loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent',
 define:{'import.meta.env.DEV':'false',INPUT_FILE:JSON.stringify(dir+input),EXTREME:JSON.stringify(extreme),COARSE:String(coarse)},plugins:[{name:'coarse-linear-diagnostic',setup(b){
 b.onLoad({filter:/editableTerrainWorld\.ts$/},async a=>{let source=rampPlaneTerrainTransform(stableBaseWorldTransform(terrainMethodTransform(foundationTransform(await readFile(a.path,'utf8')),{mode:'H'}),{alwaysStable:true}),{alwaysLinear:true});if(coarse)source=coarseLinearTerrainTransform(source,{alwaysCoarse:true});return{loader:'ts',contents:source};});
 b.onLoad({filter:/terrainEditing\.ts$/},async a=>({loader:'ts',contents:foundationCommandTransform(await readFile(a.path,'utf8'))}));
 b.onLoad({filter:/placeTerrain\.ts$/},async a=>({loader:'ts',contents:stableBaseTerrainTransform(await readFile(a.path,'utf8'),{alwaysStable:true})}));
 b.onLoad({filter:/domain\/growingIsland\/landscape\.ts$/},async a=>({loader:'ts',contents:curvedGridLandscapeTransform(await readFile(a.path,'utf8'),{alwaysH:true})}));
 }}]});
 const result=JSON.parse(execFileSync(process.execPath,[output],{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024}));results.push({input,...result});
 console.log(JSON.stringify({input,extreme,coarse,coldMs:result.coldMs,counts:result.counts}));
}
const comparisons=[];
for(let i=0;i<results.length;i+=2){const a=results[i],b=results[i+1], changes={dryLost:[],dryGained:[],waterLost:[],waterGained:[]};let maxHeightDelta=0,maxPositionDelta=0,worst;
 a.samples.forEach((p,j)=>{const q=b.samples[j];for(const [property,lost,gained]of[['dry','dryLost','dryGained'],['water','waterLost','waterGained']]){if(p[property]&&!q[property])changes[lost].push(p.cell);if(!p[property]&&q[property])changes[gained].push(p.cell);}if(p.point&&q.point){const d=Math.abs(p.point.y-q.point.y),position=Math.hypot(p.point.x-q.point.x,p.point.z-q.point.z);if(d>maxHeightDelta){maxHeightDelta=d;worst=p.cell;}maxPositionDelta=Math.max(maxPositionDelta,position);}});
 const setdiff=(x,y)=>x.filter(v=>!y.includes(v));
 comparisons.push({input:a.input,extreme:a.extreme,coldMs:{detail12:a.coldMs,detail6:b.coldMs},counts:{detail12:a.counts,detail6:b.counts},
 sameSitesAndAnchors:JSON.stringify(a.sites.map(({supported,...s})=>s))===JSON.stringify(b.sites.map(({supported,...s})=>s)),
 siteSupportChanges:a.sites.filter((s,j)=>s.supported!==b.sites[j]?.supported).map(s=>s.id),ownerSupportChanges:a.owners.filter((s,j)=>s.supported!==b.owners[j]?.supported),
 owners:b.owners,edgesLost:setdiff(a.edges,b.edges),edgesGained:setdiff(b.edges,a.edges),sameConnectivity:Object.fromEntries(['walk','join','water'].map(k=>[k,JSON.stringify(a.components[k])===JSON.stringify(b.components[k])])),
 sampling:{step:.05,count:a.samples.length,maxHeightDelta,maxPositionDelta,worst,...Object.fromEntries(Object.entries(changes).map(([k,v])=>[k,{count:v.length,examples:v.slice(0,10)}]))},
 commandDifferences:a.commands.flatMap((c,j)=>c.accepted===b.commands[j].accepted&&c.error===b.commands[j].error?[]:[{detail12:c,detail6:b.commands[j]}]),commands:{detail12:a.commands,detail6:b.commands}});
}
const hashFiles=[...files,'coarse-linear-transform.mjs','coarse-linear-check.mjs','terrain-transform.mjs','stable-base-transform.mjs','ramp-plane-transform.mjs','curved-grid-transform.mjs','../../../src/domain/growingIsland/editableTerrainWorld.ts','../../../src/domain/growingIsland/worldDefinition.ts'];
const hashes=Object.fromEntries(await Promise.all(hashFiles.map(async f=>[f,createHash('sha256').update(await readFile(dir+f)).digest('hex')])));
const report={date:new Date().toISOString(),command:'node docs/design/2026-10-23-place-method-comparison/coarse-linear-check.mjs',hashes,scope:'Node CPU only; H + linear + stable, two actual UI input states, plus synthetic single-cell extrema at4,4 with cleared undo/redo. No UI, DB, natural-use or visual acceptance. Original double compile used equally in both mesh densities.',comparisons};
await writeFile(dir+'evidence/coarse-linear-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
