import {advance} from './motion.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {methods,fixtureNames,fixture,build,support,world,at,route} from './terrain.mjs';
assert.deepEqual(advance({x:1,z:2},{x:1,z:2},-.001),{x:1,z:2,arrived:true});assert.deepEqual(advance({x:0,z:0},{x:1,z:0},-.001),{x:0,z:0,arrived:false});
const report={startedAt:new Date().toISOString(),scope:'Pure geometry/footprint diagnostic, not rendered-model collision or browser evidence',rows:[]};
for(const method of methods)for(const name of Object.keys(fixtureNames)){
 const state=fixture(name),mesh=build(state,method);assert(mesh.positions.every(Number.isFinite));assert(mesh.positions.length===mesh.triangles.length*9);const replay=build(state,method);assert.deepEqual(mesh.positions,replay.positions);
 const owners=state.owners.map(o=>({id:o.id,supported:support(mesh,world(o.x),world(o.z),o.part==='home'?.45:.2)}));
 const start={x:world(state.owners[0].x),z:world(state.owners[0].z)+1.05},target={x:-.7,z:1.25};const path=route(mesh,state,start,target);
 const changed=structuredClone(state);changed.heights[at(12,11)]=0;const cut=build(changed,method);assert(cut.positions.every(Number.isFinite));assert.deepEqual(build(state,method).positions,mesh.positions);
 let maxResidual=0,samples=0;for(let i=0;i<mesh.triangles.length;i+=Math.max(1,Math.floor(mesh.triangles.length/250))){const t=mesh.triangles[i],x=t.reduce((a,p)=>a+p[0],0)/3,z=t.reduce((a,p)=>a+p[2],0)/3,y=t.reduce((a,p)=>a+p[1],0)/3,top=mesh.floor(x,z);if(Number.isFinite(top)&&Math.abs(top-y)<1e-5){maxResidual=Math.max(maxResidual,Math.abs(top-y));samples++;}}
 assert(samples>0);report.rows.push({method:method.id,fixture:name,triangles:mesh.triangles.length,buildMs:mesh.buildMs,owners,pathLength:path?.length||0,samples,maxResidual,families:mesh.families,cutTriangles:cut.triangles.length});console.log(method.id,name,owners.filter(o=>o.supported).length+'/7 owners',path?'route':'NO ROUTE');
}
report.completedAt=new Date().toISOString();writeFileSync(new URL('./logic-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('PASS finite geometry / deterministic reconstruction / triangle support sampling',report.rows.length);
