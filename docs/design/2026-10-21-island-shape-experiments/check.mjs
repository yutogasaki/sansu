import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SIZE, initialState, protectedCell, countIslands } from './terrain.mjs';
import { buildExperiment, recipeActions, soilAmount, derivePlaces, plantKind } from './experiments.mjs';
import { noiseSamples } from './sounds.mjs';
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const baseline=initialState();
test('初期の6本に乾いた支持がある',()=>{assert.equal(baseline.plants.length,6);assert(baseline.plants.every(i=>baseline.heights[i]>0));});
for(const id of ['cove','terrace','forest']) {
 test(`${id}: 同じ材料・有効な編集・足場保護`,()=>{
  const h=buildExperiment(id);assert.equal(soilAmount(h.state),12);assert.equal(h.state.plants.length,10);assert(h.state.plants.every(i=>h.state.heights[i]>0));
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)if(protectedCell(x,z))assert.equal(h.state.heights[z*SIZE+x],baseline.heights[z*SIZE+x]);
  assert.equal(h.past.length,recipeActions(id).length);
 });
 test(`${id}: 全操作Undo/Redoで形・木・水鳥と派生条件を一致復元`,()=>{
  const h=buildExperiment(id),after=structuredClone(h.state),places=derivePlaces(h.state);
  while(h.undo()){}assert.deepEqual(h.state,baseline);while(h.redo()){}assert.deepEqual(h.state,after);assert.deepEqual(derivePlaces(h.state),places);
 });
}
test('三つの異なる形と、意図した派生条件が成立',()=>{
 const a=buildExperiment('cove').state,b=buildExperiment('terrace').state,c=buildExperiment('forest').state;
 assert.notDeepEqual(a.heights,b.heights);assert.notDeepEqual(b.heights,c.heights);assert.equal(countIslands(a),1);assert.equal(countIslands(b),1);assert.equal(countIslands(c),2);
 assert(derivePlaces(a).water.length);assert.equal(derivePlaces(a).high,null);assert.equal(derivePlaces(a).forest,null);
 assert(derivePlaces(b).high);assert.equal(derivePlaces(b).water.length,0);assert.equal(derivePlaces(b).forest,null);assert(derivePlaces(c).forest);
});
test('高台を削ると見晴らしが外れ、Undoで戻る',()=>{const h=buildExperiment('terrace');assert(derivePlaces(h.state).high);h.edit(9,7,'lower');assert.equal(derivePlaces(h.state).high,null);h.undo();assert(derivePlaces(h.state).high);});
test('森の一本を水没させるとまとまりが外れ、Undoで戻る',()=>{const h=buildExperiment('forest');h.edit(12,11,'lower');h.edit(12,11,'lower');assert.equal(derivePlaces(h.state).forest,null);h.undo();h.undo();assert.equal(derivePlaces(h.state).forest.count,4);});
test('小島は編集で接続でき、Undoで分離できる',()=>{const h=buildExperiment('forest');h.edit(8,10,'raise');assert.equal(countIslands(h.state),1);h.undo();assert.equal(countIslands(h.state),2);});
test('木の形は環境から決まり、高い木も実支持がある',()=>{const h=buildExperiment('terrace');assert.equal(plantKind(h.state,8,6),'high');assert.equal(plantKind(h.state,5,10),'water');});
test('音素材のノイズが決定的で有限かつ範囲内',()=>{const a=noiseSamples(24000),b=noiseSamples(24000);assert.equal(a.length,16800);assert.deepEqual(a,b);assert(a.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));});
test('本体の保存と外部通信へ接続しない',()=>{const source=['viewer.js','terrain.mjs','experiments.mjs','habitats.js','sounds.mjs'].map(f=>fs.readFileSync(new URL(f,import.meta.url),'utf8')).join('\n');assert(!/indexedDB|localStorage|sessionStorage|serviceWorker|fetch\(|XMLHttpRequest|Dexie|\/src\//.test(source));});
console.log(JSON.stringify({pass:true,checks}));
