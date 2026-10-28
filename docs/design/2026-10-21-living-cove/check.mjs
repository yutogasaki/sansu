import assert from 'node:assert/strict';
import { TerrainHistory, SIZE, world, sampleHeight, elevation } from './terrain.mjs';
import { recipeActions } from './experiments.mjs';
import { canStand, canTraverse, shoreRoute, homeRoute } from './walk.mjs';
const results=[];
const test=(name,run)=>{run();results.push(name);};
const home={x:world(6),z:world(9)};
const cove=()=>{const h=new TerrainHistory();for(const a of recipeActions('cove').filter(a=>a.tool!=='plant'))assert(h.edit(a.x,a.z,a.tool).changed);return h;};
test('interpolated land crosses sea continuously, keeping original integer elevations',()=>{
  assert.equal(elevation(0),-.48);assert(Math.abs(elevation(1)-.42)<1e-10);assert.equal(elevation(4),2.13);assert(Math.abs(elevation(.5)+.03)<1e-10);
});
test('same six trees and protected house floor survive the cove editing recipe',()=>{
  const h=cove();assert.equal(h.state.plants.length,6);for(const i of h.state.plants)assert(h.state.heights[i]>0);
  for(let z=6;z<=9;z++)for(let x=5;x<=7;x++)assert.equal(h.state.heights[z*SIZE+x],1);
  assert(!h.edit(9,10,'lower').changed);
});
test('shore path uses dry support and every traversed segment is safe',()=>{
  const h=cove(),r=shoreRoute(h.state,home,{x:8,z:8});assert(r);assert(r.path.length>2);
  for(const p of r.path)assert(canStand(h.state,p.x,p.z));
  for(let i=1;i<r.path.length;i++)assert(canTraverse(h.state,r.path[i-1],r.path[i]));
  assert(sampleHeight(h.state,r.look.x,r.look.z)<.08);
  assert(homeRoute(h.state,r.path.at(-1),home));
});
test('water, tree trunk, house volume, and steep slope are not walkable',()=>{
  const h=cove();assert(!canStand(h.state,world(8),world(8)));assert(!canStand(h.state,world(9),world(10)));assert(!canStand(h.state,world(6),world(7.3)));
  h.state.heights[10*SIZE+7]=4;assert(!canTraverse(h.state,home,{x:world(7),z:world(10)}));
});
test('unreachable isolated island never becomes a route across water',()=>{
  const h=new TerrainHistory();h.state.heights.fill(0);for(let z=6;z<=9;z++)for(let x=5;x<=7;x++)h.state.heights[z*SIZE+x]=1;
  h.state.heights[12*SIZE+13]=1;assert.equal(shoreRoute(h.state,home,{x:13,z:12}),null);
});
test('support guard rejects the edit atomically with unchanged history',()=>{
  const h=cove(),p={x:world(9),z:world(9)};assert(canStand(h.state,p.x,p.z));h.guard=state=>canStand(state,p.x,p.z);
  const before=structuredClone(h.state),count=h.past.length;
  const result=h.edit(9,9,'lower');assert(!result.changed);assert.match(result.message,/足場/);assert.deepEqual(h.state,before);assert.equal(h.past.length,count);
});
test('every edit Undo/Redo restores geometry and derived reachability',()=>{
  const h=cove(),before=structuredClone(h.state),r=shoreRoute(h.state,home,{x:8,z:8});const n=h.past.length;
  for(let i=0;i<n;i++)assert(h.undo());for(let i=0;i<n;i++)assert(h.redo());
  assert.deepEqual(h.state,before);assert.deepEqual(shoreRoute(h.state,home,{x:8,z:8}),r);
});
console.log(JSON.stringify({pass:true,checks:results.length,results},null,2));
