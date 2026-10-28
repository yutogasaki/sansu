import {field,build,initial} from '../2026-10-22-contour-hypothesis-loop/terrain.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const results=[];
const cell=(x,z,material='soil',h=2)=>({x,z,material,h});
const pair=[cell(0,0),cell(1,1,'stone')];
const a=build(pair,'blend',{detail:8,finish:false}),b=build([...pair].reverse(),'blend',{detail:8,finish:false});
assert.deepEqual(a.positions,b.positions);
const changed=a.colors.reduce((n,v,i)=>n+(Math.abs(v-b.colors[i])>1e-10),0);
assert(changed>0,'held-out material-order counterexample should reproduce');
results.push({test:'same cells, reversed order',geometryEqual:true,changedColorComponents:changed,totalColorComponents:a.colors.length,verdict:'H2 material determinism FAIL; geometry PASS'});
// Canonical ordering is a candidate repair, not a change to the old prototype.
const canonical=xs=>[...xs].sort((a,b)=>a.z-b.z||a.x-b.x);
assert.deepEqual(build(canonical(pair),'blend',{detail:8,finish:false}).colors,build(canonical([...pair].reverse()),'blend',{detail:8,finish:false}).colors);
results.push({test:'canonical coordinate order repair',verdict:'PASS for held-out pair; production integration untested'});
const base=[cell(0,0)];
for(const d of [2,3,4,8]){
 const remote=[...base,cell(d,0)]; const before=field(base,'blend')(.5,0),after=field(remote,'blend')(.5,0);
 results.push({test:'remote contribution',remoteCellDistance:d,boundaryFieldDelta:after-before,verdict:'global tail exists; magnitude must be evaluated, not automatically visible failure'});
}
for(const width of [.15,.25,.35,.5]){
 const hole=field(initial('hole'),'blend',2,width)(0,0),gap=field(initial('gap'),'blend',2,width)(0,0),diagonal=field(initial('diagonal'),'blend',2,width)(.5,.5);
 results.push({test:'blend parameter trade-off',width,holeOpen:hole>0,gapOpen:gap>0,diagonalConnected:diagonal<=0,hole,gap,diagonal});
}
// Independent finite corner-field reconstruction. Not Townscaper's WFC or asset catalogue.
const rotate=a=>[a[3],a[0],a[1],a[2]];
function states(k){return Array.from({length:k**4},(_,n)=>Array.from({length:4},(_,i)=>Math.floor(n/k**i)%k));}
function orbit(a){let r=a,keys=[];for(let i=0;i<4;i++){keys.push(r.join(','));r=rotate(r);}return keys.sort()[0];}
for(const k of [2,3,4]) results.push({test:'four-corner state inventory',statesPerCorner:k,rawCases:k**4,rotationFamilies:new Set(states(k).map(orbit)).size,note:'combinatorial states, NOT required authored model count; excludes materials, topology, decoration'});
const interpolate=(v,u,w)=>v[0]*(1-u)*(1-w)+v[1]*u*(1-w)+v[2]*u*w+v[3]*(1-u)*w;
let seams=0,maxSeamError=0;
for(const left of states(3))for(const right of states(3))if(left[1]===right[0]&&left[2]===right[3])for(let i=0;i<=16;i++){
 const e=Math.abs(interpolate(left,1,i/16)-interpolate(right,0,i/16));maxSeamError=Math.max(maxSeamError,e);seams++;
}
assert.equal(maxSeamError,0);
const affected=[];for(let z=-3;z<=3;z++)for(let x=-3;x<=3;x++)if([[x,z],[x+1,z],[x+1,z+1],[x,z+1]].some(([a,b])=>a===0&&b===0))affected.push([x,z]);
assert.equal(affected.length,4);
results.push({test:'shared corner contract',seamSamples:seams,maxSeamError,affectedTilesPerCornerEdit:affected.length,verdict:'positional continuity/locality PASS; normal continuity, cliffs, nav, artwork NOT established'});
// A goal-relevant held-out counterexample: a connected footprint is not a usable route.
for(const heights of [[1,1],[1,2]]){
 const xs=[cell(0,0,'soil',heights[0]),cell(1,0,'soil',heights[1])];
 const mesh=build(xs,'blend',{detail:16,finish:false});
 const ys=Array.from({length:101},(_,i)=>mesh.floor(i/100,0));
 const maxJump=Math.max(...ys.slice(1).map((y,i)=>Math.abs(y-ys[i])));
 const supported=ys.every(Number.isFinite);
 results.push({test:'connected shape versus usable route',heights,supportedSamples:ys.filter(Number.isFinite).length,totalSamples:ys.length,maxJump,experimentalMaxStep:.2,routePass:supported&&maxJump<=.2,note:'independent point-walker proxy; 0.2 is a declared experiment threshold, not Sansu or benchmark specification; actor radius/slope/time not tested'});
 assert.equal(supported,true); assert.equal(maxJump<=.2,heights[0]===heights[1]);
}
const source=await readFile(new URL('../2026-10-22-contour-hypothesis-loop/terrain.mjs',import.meta.url));
const report={date:new Date().toISOString(),sourceSHA256:createHash('sha256').update(source).digest('hex'),environment:{node:process.version},scope:'independent hypothesis tests; not benchmark engine identification or product acceptance',results};
await writeFile(new URL('results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
