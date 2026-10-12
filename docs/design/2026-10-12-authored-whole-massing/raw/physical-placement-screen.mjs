// Actual native source geometry, pure Node diagnostic. No app or source writes.
import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const repo='/Users/yutogasaki/Projects/sansu',out='/private/tmp/sansu-forest-composition-plan',require=createRequire(`${repo}/package.json`),{build}=require('esbuild');
const T=await import(`${repo}/node_modules/three/build/three.module.js`);
const{GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const read=p=>fs.readFileSync(p.startsWith('/private/')?p:`${repo}/${p.replace(/^\//,'')}`),json=p=>JSON.parse(read(p)),sha=p=>createHash('sha256').update(read(p)).digest('hex');
const b=await build({stdin:{contents:`
export{canPlace,applyIntent}from'./src/domain/growingIsland/commands.ts';
export{derivePlaces}from'./src/domain/growingIsland/places.ts';
export{compileWorldDefinition}from'./src/domain/growingIsland/worldDefinition.ts';
export{withNative05WaterCarvingScope}from'./src/domain/growingIsland/authoredWaterCarving.ts';
export{authoredWorldFrame}from'./src/domain/growingIsland/authoredWorldFrame.ts';
export{walkableCells,reachableFromHome,approachCells,key}from'./src/domain/growingIsland/space.ts';
export{sceneLayout}from'./src/components/island/growing/sceneLayout.ts';
export{buildObjectLayer}from'./src/components/island/growing/objectLayer.ts';
export{IslandMaterials}from'./src/components/island/three/primitives.ts';
export{makeNativeGrowingKit}from'./src/components/island/growing/native/nativeGrowingKit.ts';
export{makeNativeAuthoredFlower}from'./src/components/island/growing/native/nativeAuthoredFlower.ts';
export{makeNativeAuthoredCove}from'./src/components/island/growing/native/nativeAuthoredCove.ts';
export{authoredFlowerWalkSet}from'./src/components/island/growing/authoredFlowerObstructions.ts';
`,resolveDir:repo,loader:'ts'},write:false,bundle:true,packages:'external',platform:'node',format:'cjs',logLevel:'silent',metafile:true});
const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(name=>name==='three'?T:require(name),m,m.exports);const a=m.exports;
const kitManifest=json('docs/design/2026-10-11-native-owned-island/kit-manifest.json'),coveManifest=json('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
const inputs=[...Object.keys(b.metafile.inputs).filter(p=>p!=='<stdin>'),'prototypes/place-qa/authored-flower-reference-mature.json','prototypes/place-qa/native05-world.json.gz','docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz','prototypes/place-qa/native-flower-support.json.gz',coveManifest.artifact.path,'/private/tmp/sansu-authored-cove-c1/shape/report.json',`${out}/four-layer-final-state.json`];
const hashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));
const parse=async p=>(await new GLTFLoader().parseAsync(Uint8Array.from(gunzipSync(read(p))).buffer,'')).scene;
const kit=a.makeNativeGrowingKit(await parse('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'),kitManifest),flower=a.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read('prototypes/place-qa/native-flower-support.json.gz'))));
const source=await parse(coveManifest.artifact.path);source.userData.sourceId=coveManifest.source.id;source.userData.sourceSha256=coveManifest.source.sha256;
const cove=a.makeNativeAuthoredCove(source,coveManifest),base=a.withNative05WaterCarvingScope(a.compileWorldDefinition(JSON.parse(gunzipSync(read('prototypes/place-qa/native05-world.json.gz')))));
const original=json('prototypes/place-qa/authored-flower-reference-mature.json').state,candidate=json(`${out}/four-layer-final-state.json`).state;
const capture=json('/private/tmp/sansu-authored-cove-c1/shape/report.json').captures[0],envelope=JSON.parse(capture.metadata.authoredFlowerWalking).envelope;
const result={scope:'Read-only native geometry screen, no browser. Trees intentionally added to diagnostic obstruction index via eligible name; current runtime does not yet index grove roots. Not live app/visual acceptance.',inputs:hashes,envelope,results:[]};
for(const[id,state]of[['baseline',original]]){
 const frame=a.authoredWorldFrame(state,base,{water:true,cove:true}),layout=a.sceneLayout(state,false,frame.world,frame.waterPlan,base,{options:{water:true,cove:true},covePlan:frame.covePlan,revision:frame.revision}),materials=new a.IslandMaterials('moon-garden');
 const layer=a.buildObjectLayer(materials,state,layout,undefined,undefined,[],kit,flower,cove);layer.root.updateMatrixWorld(true);
 const added=state.landmarks.filter(l=>!original.landmarks.some(o=>o.id===l.id)),trees=[];
 for(const owner of added){const obj=layer.objects.get(owner.id),box=new T.Box3().setFromObject(obj);const toAuth=p=>[p.x+layout.center,p.y,p.z+2];trees.push({id:owner.id,cell:owner.cell,min:toAuth(box.min),max:toAuth(box.max),houseAabbOverlaps:state.plots.filter(p=>p.kind==='home'&&p.cell&&box.intersectsBox(new T.Box3().setFromObject(layer.objects.get(p.id)))).map(p=>p.id)});}
 let diagnosticTreeRoots=0;layer.root.traverse(object=>{if(object.name.startsWith('growing-tree-')||['place-native-shared-tree','place-native-mature-branch'].includes(object.name)){object.name='authored-cove-shell';diagnosticTreeRoots++;}});
 const guard=a.authoredFlowerWalkSet(a.walkableCells(state,frame.world),frame.world,layout,layer.root,envelope),reached=a.reachableFromHome(state,guard.walkable,frame.world);
 const placementScreen=[];
 const baselineLost=new Set([...original.plots,...original.landmarks].filter(o=>o.cell&&!a.approachCells(o.cell,frame.world).some(c=>reached.has(a.key(c)))).map(o=>o.id));
 const inspect=s=>{const allowed=a.walkableCells(s,frame.world),intersection=new Set([...guard.walkable].filter(k=>allowed.has(k))),reach=a.reachableFromHome(s,intersection,frame.world);return{reached:reach.size,lost:[...original.plots,...original.landmarks].filter(o=>o.cell&&!baselineLost.has(o.id)&&!a.approachCells(o.cell,frame.world).some(c=>reach.has(a.key(c)))).map(o=>o.id),places:a.derivePlaces(s,frame.world).filter(p=>['P02','P03','P04'].includes(p.ruleId)).map(p=>({id:p.id,stage:p.stage,main:p.mainIds}))};};
 for(const[x,z]of [[6,-7],[12,-9],[12,-8],[13,-8],[10,-7],[12,-7],[13,-7],[13,-6],[12,-5],[13,-5],[13,-4],[7,-4],[14,-3]]){const cell={x,z};if(!a.canPlace(original,cell,undefined,frame.world))continue;const s=a.applyIntent(original,{id:'m1-physical-placement',command:{type:'place',kind:'sapling',cell}},undefined,frame.world).state;placementScreen.push({cell,...inspect(s)});}
 console.log('placementScreen',JSON.stringify(placementScreen));
 const masks=[];
 for(const remove of ['l33','l34','l35','l36']){const s=structuredClone(candidate);s.landmarks=s.landmarks.filter(l=>l.id!==remove);masks.push({removed:remove,...inspect(s)});}
 console.log('masks',JSON.stringify(masks));
 const access=[...state.plots,...state.landmarks].filter(o=>o.cell).map(o=>{const approaches=a.approachCells(o.cell,frame.world).filter(c=>reached.has(a.key(c)));return{id:o.id,approaches:approaches.length,clearToOwner:approaches.filter(c=>guard.clearGroundPath(c,o.cell)).length};});
 const record={id,placementScreen,masks,worldRevision:frame.world.definition.revision,diagnosticTreeRoots,triangles:guard.proof.triangles,excludedRefs:guard.proof.excludedRefs,reached:reached.size,access,trees};result.results.push(record);console.log(JSON.stringify(record));layer.dispose();materials.dispose();
}
kit.dispose();flower.dispose();cove.dispose();result.finalInputs=Object.fromEntries(inputs.map(p=>[p,sha(p)]));result.inputsUnchanged=JSON.stringify(result.inputs)===JSON.stringify(result.finalInputs);fs.writeFileSync(`${out}/physical-placement-screen.json`,JSON.stringify(result,null,2)+'\n');console.log('input identity unchanged',result.inputsUnchanged);
