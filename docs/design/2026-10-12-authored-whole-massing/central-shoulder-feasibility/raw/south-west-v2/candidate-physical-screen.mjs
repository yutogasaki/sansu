// Actual native source geometry, pure Node diagnostic. No app or source writes.
import fs from 'node:fs';import{gunzipSync}from'node:zlib';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const repo='/Users/yutogasaki/Projects/sansu',out='/private/tmp/sansu-whole-massing-c-terrain/south-west-v2',require=createRequire(`${repo}/package.json`),{build}=require('esbuild');
const T=await import(`${repo}/node_modules/three/build/three.module.js`);
const{GLTFLoader}=await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const read=p=>fs.readFileSync(p.startsWith('/private/')?p:`${repo}/${p.replace(/^\//,'')}`),json=p=>JSON.parse(read(p)),sha=p=>createHash('sha256').update(read(p)).digest('hex');
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
const inputs=[...Object.keys(b.metafile.inputs).filter(p=>p!=='<stdin>'),'prototypes/place-qa/authored-flower-reference-mature.json','prototypes/place-qa/native05-world.json.gz','docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz','prototypes/place-qa/native-flower-support.json.gz',coveManifest.artifact.path,'/private/tmp/sansu-authored-cove-c1/shape/report.json',`${out}/candidate-state.json`,`${out}/candidate-world.json.gz`,`${out}/candidate-frame-plans.json`];
const hashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));
const parse=async p=>(await new GLTFLoader().parseAsync(Uint8Array.from(gunzipSync(read(p))).buffer,'')).scene;
const kitSource=await parse('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz');kitSource.updateMatrixWorld(true);const leafParts=[];for(const[partName,x,y,z]of[['willow',6,1.207569681,-7],['birch',7,1.585,-6],['spire',8,1.615,-6]]){const part=kitSource.children.find(o=>o.userData.nativePart===partName),desc=kitManifest.parts[partName],origin=partName==='willow'?[-8,1.24,-2.7]:[(desc.min[0]+desc.max[0])/2,desc.min[1],(desc.min[2]+desc.max[2])/2];const triangles=[];part.traverse(o=>{if(!(o instanceof T.Mesh)||!/canopy|tapered.*leaf|airy.*crown|foliage/.test(o.name))return;const pos=o.geometry.getAttribute('position'),idx=o.geometry.index;for(let i=0;i<(idx?.count??pos.count);i+=3)triangles.push([0,1,2].map(k=>{const v=new T.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+k):i+k).applyMatrix4(o.matrixWorld).sub(new T.Vector3(...origin)).multiplyScalar(.45);return[v.x+x,v.y+y+.04,v.z+z]}));});leafParts.push({part:partName,triangles});}fs.writeFileSync(`${out}/leaf-source-triangles.json`,JSON.stringify({scope:'Actual source leaf triangles under unchanged native kit transforms; diagnostic projection, not model export',parts:leafParts}));const kit=a.makeNativeGrowingKit(kitSource,kitManifest),flower=a.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read('prototypes/place-qa/native-flower-support.json.gz'))));
const source=await parse(coveManifest.artifact.path);source.userData.sourceId=coveManifest.source.id;source.userData.sourceSha256=coveManifest.source.sha256;
const cove=a.makeNativeAuthoredCove(source,coveManifest),base=a.withNative05WaterCarvingScope(a.compileWorldDefinition(JSON.parse(gunzipSync(read('prototypes/place-qa/native05-world.json.gz')))));
const original=json('prototypes/place-qa/authored-flower-reference-mature.json').state,candidate=json(`${out}/candidate-state.json`).state;
const capture=json('/private/tmp/sansu-authored-cove-c1/shape/report.json').captures[0],envelope=JSON.parse(capture.metadata.authoredFlowerWalking).envelope;
const result={scope:'Read-only native geometry screen, no browser. Trees intentionally added to diagnostic obstruction index via eligible name; current runtime does not yet index grove roots. Not live app/visual acceptance.',inputs:hashes,envelope,results:[]};
for(const[id,state]of[['baseline',original],['numeric-C',candidate]]){
 const frame=id==='baseline'?a.authoredWorldFrame(state,base,{water:true,cove:true}):{...json(`${out}/candidate-frame-plans.json`),world:a.compileWorldDefinition(JSON.parse(gunzipSync(read(`${out}/candidate-world.json.gz`))))},layout=a.sceneLayout(state,false,frame.world,frame.waterPlan,base,{options:{water:true,cove:true},covePlan:frame.covePlan,revision:frame.revision}),materials=new a.IslandMaterials('moon-garden');
 const layer=a.buildObjectLayer(materials,state,layout,undefined,undefined,[],kit,flower,cove);layer.root.updateMatrixWorld(true);
 const added=state.landmarks.filter(l=>!original.landmarks.some(o=>o.id===l.id)),trees=[];
 for(const owner of added){const obj=layer.objects.get(owner.id),box=new T.Box3().setFromObject(obj);const toAuth=p=>[p.x+layout.center,p.y,p.z+2];trees.push({id:owner.id,cell:owner.cell,min:toAuth(box.min),max:toAuth(box.max),houseAabbOverlaps:state.plots.filter(p=>p.kind==='home'&&p.cell&&box.intersectsBox(new T.Box3().setFromObject(layer.objects.get(p.id)))).map(p=>p.id)});}
 const giant=layer.root.getObjectByName('place-native-shared-tree'),giantBox=giant?new T.Box3().setFromObject(giant):null;let diagnosticTreeRoots=0;layer.root.traverse(object=>{if(object.name.startsWith('growing-tree-')||['place-native-shared-tree','place-native-mature-branch'].includes(object.name)){object.name='authored-cove-shell';diagnosticTreeRoots++;}});
 const guard=a.authoredFlowerWalkSet(a.walkableCells(state,frame.world),frame.world,layout,layer.root,envelope),reached=a.reachableFromHome(state,guard.walkable,frame.world);
 const access=[...state.plots,...state.landmarks].filter(o=>o.cell).map(o=>{const approaches=a.approachCells(o.cell,frame.world).filter(c=>reached.has(a.key(c)));return{id:o.id,approaches:approaches.length,clearToOwner:approaches.filter(c=>guard.clearGroundPath(c,o.cell)).length};});
 const frontBand=Array.from({length:13},(_,i)=>({x:6+i*.25,z:-5.25}));const frontBandProof=frontBand.map((cell,i)=>({cell,open:guard.walkable.has(a.key(cell)),reached:reached.has(a.key(cell)),nextClear:i<frontBand.length-1?guard.clearGroundPath(cell,frontBand[i+1]):null}));const record={id,frontBandProof,giantBounds:giantBox?{min:giantBox.min.toArray(),max:giantBox.max.toArray()}:null,worldRevision:frame.world.definition.revision,diagnosticTreeRoots,triangles:guard.proof.triangles,excludedRefs:guard.proof.excludedRefs,reached:reached.size,access,trees};result.results.push(record);console.log(JSON.stringify(record));layer.dispose();materials.dispose();
}
kit.dispose();flower.dispose();cove.dispose();result.finalInputs=Object.fromEntries(inputs.map(p=>[p,sha(p)]));result.inputsUnchanged=JSON.stringify(result.inputs)===JSON.stringify(result.finalInputs);fs.writeFileSync(`${out}/candidate-physical-screen.json`,JSON.stringify(result,null,2)+'\n');console.log('input identity unchanged',result.inputsUnchanged);
