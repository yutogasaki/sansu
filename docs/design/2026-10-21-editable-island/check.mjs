import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TerrainHistory, initialState, SIZE, world, sampleHeight, countIslands, protectedCell } from './terrain.mjs';
const h=new TerrainHistory(), start=structuredClone(h.state);let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('同じ場所を2回盛り、描画用高さが上がる',()=>{
  const before=sampleHeight(h.state,world(9),world(8));
  assert(h.edit(9,8,'raise').changed);assert(h.edit(9,8,'raise').changed);
  assert.equal(h.state.heights[8*SIZE+9],3);assert(sampleHeight(h.state,world(9),world(8))>before+1);
  assert.equal(h.state.bird,null,'丘だけを盛っても水鳥の登場を捏造しない');
});
check('海から離れ小島を造成し、陸をつないで一島へ戻せる',()=>{
  assert.equal(countIslands(h.state),1);h.edit(14,8,'raise');assert.equal(countIslands(h.state),2);
  h.edit(13,8,'raise');h.edit(12,8,'raise');assert.equal(countIslands(h.state),1);
});
check('掘ると水際に水鳥が現れ、Undo/Redoで地形・植物・水鳥が一致復元',()=>{
  const before=structuredClone(h.state);h.edit(11,8,'lower');h.edit(10,8,'lower');
  assert.equal(h.state.heights[8*SIZE+10],0);assert(h.state.bird);
  const after=structuredClone(h.state);h.undo();h.undo();assert.deepEqual(h.state,before);
  h.redo();h.redo();assert.deepEqual(h.state,after);
});
check('家と入口の支持床を全道具から保護し、失敗を履歴へ追加しない',()=>{
  const before=structuredClone(h.state),n=h.past.length;
  for(let z=1;z<SIZE-1;z++)for(let x=1;x<SIZE-1;x++)if(protectedCell(x,z))for(const tool of ['raise','lower','plant'])assert.equal(h.edit(x,z,tool).changed,false);
  assert.deepEqual(h.state,before);assert.equal(h.past.length,n);
});
check('植えた木の地点は水没中も保持し、地形Undoで同じ木を戻せる',()=>{
  h.edit(9,9,'plant');const before=structuredClone(h.state);h.edit(9,9,'lower');
  assert(h.state.plants.includes(9*SIZE+9));assert.equal(h.state.heights[9*SIZE+9],0);h.undo();assert.deepEqual(h.state,before);
});
check('Undo後の新編集でRedo枝を捨て、元の状態を破壊しない',()=>{
  h.undo();assert(h.future.length);h.edit(10,6,'raise');assert.equal(h.future.length,0);assert.deepEqual(start,initialState());
});
check('高さの上下限・範囲外・非整数・未知の道具を扱う',()=>{
  for(let i=0;i<8;i++)h.edit(14,14,'raise');assert.equal(h.state.heights[14*SIZE+14],4);
  for(let i=0;i<8;i++)h.edit(14,14,'lower');assert.equal(h.state.heights[14*SIZE+14],0);
  for(const [x,z,t] of [[0,5,'raise'],[99,5,'raise'],[2.5,5,'raise'],[4,4,'surprise']])assert.equal(h.edit(x,z,t).changed,false);
});
check('最初へ戻す操作もUndoでき、再生成は初期状態',()=>{
  const before=structuredClone(h.state);h.restart();assert.deepEqual(h.state,initialState());h.undo();assert.deepEqual(h.state,before);
});
check('本体保存・外部通信・PWAへの接続がない',()=>{
  const source=fs.readFileSync(new URL('./viewer.js',import.meta.url),'utf8')+fs.readFileSync(new URL('./terrain.mjs',import.meta.url),'utf8');
  assert(!/indexedDB|localStorage|sessionStorage|serviceWorker|fetch\(|XMLHttpRequest|Dexie|\/src\//.test(source));
});
console.log(JSON.stringify({pass:true,checks}));
