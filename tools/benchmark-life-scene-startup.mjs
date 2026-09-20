// Compare actual Life scene construction with/without discarded legacy scenery.
import { BufferGeometry } from 'three';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.env.SANSU_SCENE_OUTPUT || 'output/playwright/life-scene-startup';
await mkdir(out, { recursive: true });
const baseline = '788db3f', oldScene = execFileSync('git', ['show', `${baseline}:src/components/island/life/scene.ts`], { encoding: 'utf8' });
const oldHeritage = execFileSync('git', ['show', `${baseline}:src/components/island/life/heritageScenery.ts`], { encoding: 'utf8' });
const report = { baseline, scope: 'Synthetic actual Life scene; CPU construction and allocated geometry, not GPU memory or phone latency', runs: [] };
for (const mode of ['before', 'after']) {
 const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] }, plugins: mode === 'before' ? [{name:'old-life-scene',enforce:'pre',transform(_code,id){if(id.endsWith('/src/components/island/life/scene.ts'))return oldScene;if(id.endsWith('/src/components/island/life/heritageScenery.ts'))return oldHeritage;}}] : [] });
 try {
  const { buildLifeScene } = await server.ssrLoadModule('/src/components/island/life/scene.ts');
  const { newLife } = await server.ssrLoadModule('/src/domain/islandLife/model.ts');
  const { replayLife } = await server.ssrLoadModule('/src/domain/islandLife/simulation.ts');
  for (const count of [0, 30, 100]) {
   const state = replayLife(newLife('scene-budget', 100));
   state.extraLand = [];
   for(let z=0;z<15;z++)for(let x=0;x<16;x++)if(x>5||z>4)state.extraLand.push({x,z});
   if(count===0)delete state.extraLand;
   state.items = Array.from({length:count},(_,i)=>({id:`item-${i}`,kind:['flower','bench','lantern'][i%3],cell:{x:i%16,z:5+Math.floor(i/16)},growth:6,style:'original'}));
   const times=[];let scene;const allocations=[];
   for(let n=0;n<4;n++){const first=new BufferGeometry();const start=performance.now();scene=buildLifeScene(state);times.push(performance.now()-start);const last=new BufferGeometry();allocations.push(last.id-first.id-1);first.dispose();last.dispose();if(n<3)scene.dispose();}
   const hash=createHash('sha256'),geometries=new Set(),textures=new Set();let meshes=0,geometryBytes=0,triangles=0;
   scene.root.traverse(o=>{
    hash.update(JSON.stringify([o.name,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.visible,o.castShadow,o.receiveShadow]));
    if(!o.isMesh)return;meshes++;geometries.add(o.geometry);
    triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    for(const [key,a]of Object.entries(o.geometry.attributes)){hash.update(key);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
    if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
     hash.update(JSON.stringify([m.type,m.color?.toArray(),m.roughness,m.metalness,m.transparent,m.opacity,m.depthWrite,m.side]));
     for(const [k,t]of Object.entries(m))if(t?.isTexture){textures.add(t);hash.update(k);hash.update(JSON.stringify([t.name,t.image?.width,t.image?.height,t.repeat.toArray(),t.offset.toArray()]));if(t.image?.data)hash.update(Buffer.from(t.image.data.buffer));}
    }
   });
   for(const g of geometries){geometryBytes+=g.index?.array.byteLength??0;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;}
   const samples=times.slice(1).sort((a,b)=>a-b), row={mode,count,constructionMedianMs:samples[1],samples:times,geometryConstructions:allocations,meshes,triangles,geometryBytes,textures:textures.size,sceneHash:hash.digest('hex')};
   report.runs.push(row);console.log(JSON.stringify(row));scene.dispose();
  }
 }finally{await server.close();}
}
for(const count of [0,30,100]){const pair=report.runs.filter(r=>r.count===count);assert.equal(pair[0].sceneHash,pair[1].sceneHash);}
report.pass=true;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
