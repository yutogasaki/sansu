// Actual native source geometry, pure Node diagnostic. No app or source writes.
import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const repo='/private/tmp/sansu-authored-cove-c4/candidate',out='/private/tmp/sansu-central-shoulder-source-audit',data='/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/raw/south-west-v3',art='/Users/yutogasaki/Projects/sansu/docs/design/2026-10-12-authored-central-shoulder',require=createRequire(`${repo}/package.json`),{build}=require('esbuild');
const T=await import(`${repo}/node_modules/three/build/three.module.js`);
const{GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const read=p=>fs.readFileSync(p.startsWith('/')?p:`${repo}/${p.replace(/^\//,'')}`),json=p=>JSON.parse(read(p)),sha=p=>createHash('sha256').update(read(p)).digest('hex');
const b=await build({stdin:{contents:`
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
const inputs=[...Object.keys(b.metafile.inputs).filter(p=>p!=='<stdin>'),'prototypes/place-qa/authored-flower-reference-mature.json','prototypes/place-qa/native05-world.json.gz','docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz','prototypes/place-qa/native-flower-support.json.gz',coveManifest.artifact.path,'/private/tmp/sansu-authored-cove-c1/shape/report.json',`${data}/candidate-state.json`,`${data}/candidate-world.json.gz`,`${data}/candidate-frame-plans.json`];
inputs.push(`${art}/central-shoulder-components.glb`,`${art}/geometry-profile.json.gz`);
const hashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));
const parse=async p=>(await new GLTFLoader().parseAsync(Uint8Array.from(gunzipSync(read(p))).buffer,'')).scene;
const kit=a.makeNativeGrowingKit(await parse('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'),kitManifest),flower=a.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read('prototypes/place-qa/native-flower-support.json.gz'))));
const source=await parse(coveManifest.artifact.path);source.userData.sourceId=coveManifest.source.id;source.userData.sourceSha256=coveManifest.source.sha256;
const cove=a.makeNativeAuthoredCove(source,coveManifest),base=a.withNative05WaterCarvingScope(a.compileWorldDefinition(JSON.parse(gunzipSync(read('prototypes/place-qa/native05-world.json.gz')))));
const original=json('prototypes/place-qa/authored-flower-reference-mature.json').state,candidate=json(`${data}/candidate-state.json`).state;
const capture=json('/private/tmp/sansu-authored-cove-c1/shape/report.json').captures[0],envelope=JSON.parse(capture.metadata.authoredFlowerWalking).envelope;
const result={scope:'Independent selected-v3 source audit with actual new root GLB. Fixed c4 code, no browser. Trees intentionally added to diagnostic obstruction index via eligible name; current runtime does not yet index grove roots. Not live app/visual acceptance.',inputs:hashes,envelope,results:[]};
for(const[id,state]of[['selected-v3',candidate],['with-actual-glb-roots',candidate]]){
 const frame=id==='baseline'?a.authoredWorldFrame(state,base,{water:true,cove:true}):{...json(`${data}/candidate-frame-plans.json`),world:a.compileWorldDefinition(JSON.parse(gunzipSync(read(`${data}/candidate-world.json.gz`))))},layout=a.sceneLayout(state,false,frame.world,frame.waterPlan,base,{options:{water:true,cove:true},covePlan:frame.covePlan,revision:frame.revision}),materials=new a.IslandMaterials('moon-garden');
 const layer=a.buildObjectLayer(materials,state,layout,undefined,undefined,[],kit,flower,cove);layer.root.updateMatrixWorld(true);
 const added=state.landmarks.filter(l=>!original.landmarks.some(o=>o.id===l.id)),trees=[];
 for(const owner of added){const obj=layer.objects.get(owner.id),box=new T.Box3().setFromObject(obj);const toAuth=p=>[p.x+layout.center,p.y,p.z+2];trees.push({id:owner.id,cell:owner.cell,min:toAuth(box.min),max:toAuth(box.max),houseAabbOverlaps:state.plots.filter(p=>p.kind==='home'&&p.cell&&box.intersectsBox(new T.Box3().setFromObject(layer.objects.get(p.id)))).map(p=>p.id)});}
 const giant=layer.root.getObjectByName('place-native-shared-tree'),giantBox=giant?new T.Box3().setFromObject(giant):null;let diagnosticTreeRoots=0;layer.root.traverse(object=>{if(object.name.startsWith('growing-tree-')||['place-native-shared-tree','place-native-mature-branch'].includes(object.name)){object.name='authored-cove-shell';diagnosticTreeRoots++;}});
 let addedRootTriangles=0;
 if(id==='with-actual-glb-roots'){
  const glb=(await new GLTFLoader().parseAsync(Uint8Array.from(read(`${art}/central-shoulder-components.glb`)).buffer,'')).scene;
  glb.updateMatrixWorld(true);const root=new T.Group();root.name='authored-cove-shell';root.position.set(-layout.center,0,-2);
  glb.traverse(n=>{if(!(n instanceof T.Mesh)||!/^l3[345]/.test(n.name)&&!n.parent?.name?.match(/^l3[345]/))return;const geometry=n.geometry.clone().applyMatrix4(n.matrixWorld),mesh=new T.Mesh(geometry,n.material);root.add(mesh);addedRootTriangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;});
  layer.root.add(root);layer.root.updateMatrixWorld(true);if(addedRootTriangles!==108)throw Error('Actual root triangle inclusion mismatch '+addedRootTriangles);
 }
 const guard=a.authoredFlowerWalkSet(a.walkableCells(state,frame.world),frame.world,layout,layer.root,envelope),reached=a.reachableFromHome(state,guard.walkable,frame.world);
 const access=[...state.plots,...state.landmarks].filter(o=>o.cell).map(o=>{const approaches=a.approachCells(o.cell,frame.world).filter(c=>reached.has(a.key(c)));return{id:o.id,approaches:approaches.length,clearToOwner:approaches.filter(c=>guard.clearGroundPath(c,o.cell)).length};});
 const frontBand=Array.from({length:13},(_,i)=>({x:6+i*.25,z:-5.25}));const frontBandProof=frontBand.map((cell,i)=>({cell,open:guard.walkable.has(a.key(cell)),reached:reached.has(a.key(cell)),nextClear:i<frontBand.length-1?guard.clearGroundPath(cell,frontBand[i+1]):null}));const record={id,addedRootTriangles,frontBandProof,giantBounds:giantBox?{min:giantBox.min.toArray(),max:giantBox.max.toArray()}:null,worldRevision:frame.world.definition.revision,diagnosticTreeRoots,triangles:guard.proof.triangles,excludedRefs:guard.proof.excludedRefs,reached:reached.size,access,trees};result.results.push(record);console.log(JSON.stringify(record));layer.dispose();materials.dispose();
}
kit.dispose();flower.dispose();cove.dispose();result.finalInputs=Object.fromEntries(inputs.map(p=>[p,sha(p)]));result.inputsUnchanged=JSON.stringify(result.inputs)===JSON.stringify(result.finalInputs);fs.writeFileSync(`${out}/actual-root-guard.json`,JSON.stringify(result,null,2)+'\n');console.log('input identity unchanged',result.inputsUnchanged);
