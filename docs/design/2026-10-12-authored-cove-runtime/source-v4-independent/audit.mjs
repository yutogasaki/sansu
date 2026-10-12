// Independent v4 floor/source audit. Never writes application or source artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const repo='/Users/yutogasaki/Projects/sansu', out=path.dirname(fileURLToPath(import.meta.url));
const dir=`${repo}/docs/design/2026-10-12-authored-cove-entrance`;
const old='/private/tmp/sansu-authored-cove-c1/candidate/docs/design/2026-10-12-authored-cove-entrance';
const require=createRequire(`${repo}/package.json`), T=require('three'), {build}=require('esbuild');
const read=p=>fs.readFileSync(p), sha=p=>createHash('sha256').update(read(p)).digest('hex'), digest=v=>createHash('sha256').update(v).digest('hex');
const source=`
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition.ts';
export {withNative05WaterCarvingScope} from './src/domain/growingIsland/authoredWaterCarving.ts';
export {authoredWaterFrame} from './src/domain/growingIsland/authoredWaterFrame.ts';
export {authoredWorldFrame} from './src/domain/growingIsland/authoredWorldFrame.ts';
export {AUTHORED_COVE_SOURCE_PROFILE,authoredCoveGroundRevision} from './src/domain/growingIsland/authoredCoveWorld.ts';
export {makeVillagerActor,wrapPokomoko,disposeActor} from './src/components/island/growing/actors.ts';
export {makePokomokoRig} from './src/components/island/three/islandCharacters.ts';
export {IslandMaterials} from './src/components/island/three/primitives.ts';
export {setActorVisualScale} from './src/components/island/growing/actorScale.ts';
export {measureAuthoredWalkingEnvelope} from './src/components/island/growing/authoredFlowerObstructions.ts';
`;
const bundle=()=>build({stdin:{contents:source,resolveDir:repo,loader:'ts'},write:false,bundle:true,packages:'external',format:'cjs',platform:'node',metafile:true,logLevel:'silent'});
const discover=await bundle();
const manifest=JSON.parse(read(`${dir}/assembly-manifest.json`));
const inputPaths=[...Object.keys(discover.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>path.resolve(repo,p)),
 ...['package.json','package-lock.json','prototypes/place-qa/authored-flower-reference-mature.json','prototypes/place-qa/native05-world.json.gz','prototypes/place-qa/native-cove-corner.glb.gz'].map(p=>`${repo}/${p}`),
 ...['assembly-manifest.json','source-manifest.json','cove-delivery-manifest.json','ground-input.json',...Object.keys(manifest.outputs)].map(p=>`${dir}/${p}`),
 `${old}/cove-corner-v3.glb`,`${old}/assembly-manifest.json`,`${out}/audit.mjs`,`${out}/floor-audit.py`,`${out}/freeze-inputs.json`];
const inputHashes=Object.fromEntries([...new Set(inputPaths)].sort().map(p=>[p,sha(p)]));
fs.writeFileSync(`${out}/initial-inputs.json`,JSON.stringify(inputHashes,null,2)+'\n');
const bundled=await bundle();
if(discover.outputFiles[0].text!==bundled.outputFiles[0].text) throw Error('Source changed while collecting inputs');
const mod={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(require,mod,mod.exports);const api=mod.exports;
const patch=JSON.parse(read(`${dir}/shared-apron-world-patch-v1.json`)), sourceManifest=JSON.parse(read(`${dir}/source-manifest.json`)), delivery=JSON.parse(read(`${dir}/cove-delivery-manifest.json`));
const state=JSON.parse(read(`${repo}/prototypes/place-qa/authored-flower-reference-mature.json`)).state;
const immutable=api.withNative05WaterCarvingScope(api.compileWorldDefinition(JSON.parse(gunzipSync(read(`${repo}/prototypes/place-qa/native05-world.json.gz`)))));
const water=api.authoredWorldFrame(state,immutable,{water:true,cove:false});
const dry=api.authoredWorldFrame(state,immutable,{water:false,cove:true}), wet=api.authoredWorldFrame(state,immutable,{water:true,cove:true});
function applyPatch(world){const d=structuredClone(world.definition);d.revision='independent-v4';
 for(const addition of patch.siteAdditions??[]) {const district=d.districts.find(x=>x.id===addition.districtId);if(!district)throw Error('Missing patch district');district.sites.push(...structuredClone(addition.sites));}
 d.districts.push(structuredClone(patch.district));d.edges.push(...structuredClone(patch.edges));return api.compileWorldDefinition(d);}
const independentDry=applyPatch(immutable), independentWet=applyPatch(water.world);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const defGeometry=d=>{const c=structuredClone(d);delete c.revision;return c;};
function invariants(before,after){const failures=[];
 for(const site of before.sites){const a=before.floorAt(site.cell),b=after.floorAt(site.cell);if(!eq(a,b))failures.push({ref:site.ref,before:a,after:b});}
 const grants=w=>w.sites.filter(s=>s.placement).map(s=>({ref:s.ref,placement:s.placement}));
 return {floorsUnchanged:before.definition.districts.every((d,i)=>eq(d.floors,after.definition.districts[i].floors)),
 anchorFloorsUnchanged:before.definition.districts.every((d,i)=>eq(d.anchorFloors,after.definition.districts[i].anchorFloors)),
 oldSitesUnchanged:before.definition.districts.every((d,i)=>eq(d.sites,after.definition.districts[i].sites.slice(0,d.sites.length))),
 oldEdgesUnchanged:eq(before.definition.edges,after.definition.edges.slice(0,before.definition.edges.length)),
 definitionSourceUnchanged:eq(before.definition.source,after.definition.source),oldSiteSupportFailures:failures,sitesChecked:before.sites.length,
 grantsUnchanged:eq(grants(before),grants(after)),grantsBefore:grants(before).length,grantsAfter:grants(after).length,
 addedRefs:after.sites.length-before.sites.length,addedEdges:after.definition.edges.length-before.definition.edges.length};}
function decode(file){const buf=read(file);if(buf.readUInt32LE(0)!==0x46546c67)throw Error('GLB magic');let json,bin;
 for(let off=12;off<buf.length;){const n=buf.readUInt32LE(off),kind=buf.readUInt32LE(off+4),chunk=buf.subarray(off+8,off+8+n);if(kind===0x4e4f534a)json=JSON.parse(chunk);if(kind===0x004e4942)bin=chunk;off+=8+n;}
 function accessor(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],dim={SCALAR:1,VEC3:3}[a.type];if(!size||!dim)throw Error('Accessor format');
 return Array.from({length:a.count},(_,i)=>Array.from({length:dim},(_,j)=>{const at=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*dim)+j*size;return a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt8(at);}));}
 const parts=[];function visit(id,parent){const n=json.nodes[id],local=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation??[0,0,0]),new T.Quaternion().fromArray(n.rotation??[0,0,0,1]),new T.Vector3().fromArray(n.scale??[1,1,1]));const matrix=parent.clone().multiply(local);
 if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const points=accessor(p.attributes.POSITION).map(v=>new T.Vector3(...v).applyMatrix4(matrix));const indices=p.indices===undefined?points.map((_,i)=>i):accessor(p.indices).flat();parts.push({name:n.name,points,indices,material:json.materials?.[p.material]});}
 for(const child of n.children??[])visit(child,matrix);}
 for(const id of json.scenes[json.scene??0].nodes)visit(id,new T.Matrix4());return {parts,json};}
const transform=manifest.common_transform,pivot=new T.Vector3(...transform.source_gltf_pivot),pos=new T.Vector3(...transform.authored_position),scale=new T.Vector3(...transform.scale);
const toWorld=v=>v.clone().sub(pivot).multiply(scale).applyAxisAngle(new T.Vector3(0,1,0),transform.yaw).add(pos);
const shellFile=`${dir}/${manifest.source_parts.shell}`, combinedFile=`${dir}/${manifest.source_parts.shell_and_apron}`;
const shell=decode(shellFile),combined=decode(combinedFile),apron=combined.parts.filter(p=>p.name===manifest.apron.name);
const triangles=(p,convert=v=>v)=>Array.from({length:p.indices.length/3},(_,i)=>p.indices.slice(i*3,i*3+3).map(id=>convert(p.points[id])));
const patchFloor=patch.district.floors.find(f=>f.id===manifest.apron.floor_id),points=patchFloor.vertices.map(v=>new T.Vector3(v.point.x,v.point.y,v.point.z)),topY=points[0].y;
const expectedTriangles=Array.from({length:patchFloor.indices.length/3},(_,i)=>patchFloor.indices.slice(i*3,i*3+3).sort((a,b)=>a-b).join(','));
const apronTriangles=apron.flatMap(p=>triangles(p,toWorld)),top=apronTriangles.filter(tri=>tri.every(v=>Math.abs(v.y-topY)<1e-6));let maxVertexError=0;
const actualTriangles=top.map(tri=>tri.map(v=>{let distance=Infinity,id=-1;points.forEach((p,i)=>{const d=p.distanceTo(v);if(d<distance){distance=d;id=i;}});maxVertexError=Math.max(maxVertexError,distance);return id;}).sort((a,b)=>a-b).join(','));
const canon=p=>({name:p.name,material:p.material,triangles:triangles(p).map(t=>t.map(v=>v.toArray().map(n=>n.toFixed(6)).join(',')).sort().join('|')).sort()});
const sorted=parts=>parts.map(canon).sort((a,b)=>a.name.localeCompare(b.name)||a.material.name.localeCompare(b.material.name));
const shellInCombined=combined.parts.filter(p=>p.name!==manifest.apron.name);
const socketBottomTriangles=shell.parts.filter(p=>p.name.includes('grounded runner socket')).flatMap(p=>triangles(p,toWorld).filter(t=>new T.Triangle(...t).getNormal(new T.Vector3()).y<-.5).map(t=>({name:p.name,points:t.map(v=>v.toArray())})));
// Re-measure the current fixture rigs; do not import the author's numeric envelope.
const materials=new api.IslandMaterials('moon-garden'),rig=api.makePokomokoRig(materials),hero=api.wrapPokomoko(rig.hero,rig.heroBody,rig.heroFeet);
api.setActorVisualScale(hero,.45);const actors=[hero,...state.villagers.map(v=>api.makeVillagerActor(materials,v,.45))];
const envelope=api.measureAuthoredWalkingEnvelope(actors);actors.forEach(api.disposeActor);materials.dispose();
const floorData=world=>world.floors.filter(f=>f.kind!=='water').map(f=>({id:f.id,vertices:f.vertices.map(v=>[v.point.x,v.point.y,v.point.z]),indices:f.indices}));
const edgeCells=patch.edges.map(e=>[e.from,e.to].map(r=>{const s=wet.world.sites.find(s=>s.ref.districtId===r.districtId&&s.ref.siteId===r.siteId);if(!s)throw Error('Missing edge ref');return s.cell;}));
fs.writeFileSync(`${out}/independent-floor-input.json`,JSON.stringify({base:floorData(immutable),water:floorData(water.world),patched:floorData(dry.world),wetPatched:floorData(wet.world),patch:patchFloor,edges:edgeCells,envelope,socketBottomTriangles}));
const linearHex=hex=>{const value=parseInt(hex.slice(1),16);return [16,8,0].map(shift=>{const v=((value>>shift)&255)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});};
const topParts=apron.filter(p=>triangles(p,toWorld).some(t=>t.every(v=>Math.abs(v.y-topY)<1e-6)));
const materialInfo=apron.map(p=>({name:p.material.name,material:p.material,top:topParts.includes(p)}));
const topColor=patchFloor.color,bank=patch.district.surfaces.find(s=>s.kind==='bank'),bankColor=bank.material.color;
const bankPoints=bank.vertices.map(v=>new T.Vector3(v.x,v.y,v.z));
let bankMaxVertexError=0;
const bankTriangles=apronTriangles.filter(t=>Math.max(...t.map(v=>v.y))-Math.min(...t.map(v=>v.y))>1e-6);
const bankActual=bankTriangles.map(t=>t.map(v=>{let distance=Infinity,id=-1;bankPoints.forEach((p,i)=>{const d=p.distanceTo(v);if(d<distance){distance=d;id=i;}});bankMaxVertexError=Math.max(bankMaxVertexError,distance);return id;}).sort((a,b)=>a-b).join(',')).sort();
const bankExpected=Array.from({length:bank.indices.length/3},(_,i)=>bank.indices.slice(i*3,i*3+3).sort((a,b)=>a-b).join(',')).sort();
const colorMatches=(parts,color)=>parts.length>0&&parts.every(p=>p.material.pbrMetallicRoughness.baseColorFactor.slice(0,3).every((v,i)=>Math.abs(v-linearHex(color)[i])<1e-6));
const shellWorldPoints=shell.parts.flatMap(p=>p.points.map(toWorld));
const bounds=ps=>({min:{x:Math.min(...ps.map(p=>p.x)),z:Math.min(...ps.map(p=>p.z))},max:{x:Math.max(...ps.map(p=>p.x)),z:Math.max(...ps.map(p=>p.z))}});
// Reduce large source arrays without spreading them into argument limits.
const boundsOf=ps=>ps.reduce((b,p)=>({min:{x:Math.min(b.min.x,p.x),z:Math.min(b.min.z,p.z)},max:{x:Math.max(b.max.x,p.x),z:Math.max(b.max.z,p.z)}}),{min:{x:Infinity,z:Infinity},max:{x:-Infinity,z:-Infinity}});
const sourceBounds=boundsOf([...points,...bankPoints,...shellWorldPoints]);
const sweepPoints=edgeCells.flatMap(edge=>edge.flatMap(p=>[-1,1].flatMap(x=>[-1,1].map(z=>({x:p.x+x*(envelope.radius+.04),z:p.z+z*(envelope.radius+.04)})))));
const requiredBounds=boundsOf([...points,...bankPoints,...shellWorldPoints,...sweepPoints]);
const currentProfile=api.AUTHORED_COVE_SOURCE_PROFILE;
const expand=(current,required)=>({min:{x:Math.min(current.min.x,Math.floor((required.min.x-.05)*20)/20),z:Math.min(current.min.z,Math.floor((required.min.z-.05)*20)/20)},max:{x:Math.max(current.max.x,Math.ceil((required.max.x+.05)*20)/20),z:Math.max(current.max.z,Math.ceil((required.max.z+.05)*20)/20)}});
const proposedLocalGround=expand(currentProfile.localGround,requiredBounds),proposedClearCourt=expand(currentProfile.clearCourt,requiredBounds);
const covers=(b,r)=>b.min.x<=r.min.x&&b.min.z<=r.min.z&&b.max.x>=r.max.x&&b.max.z>=r.max.z;
const applicability={currentLocalGround:currentProfile.localGround,currentClearCourt:currentProfile.clearCourt,sourceBounds,actorSweepBounds:boundsOf(sweepPoints),requiredBounds,localGroundCoversSourceAndSweeps:covers(currentProfile.localGround,requiredBounds),clearCourtCoversSourceAndSweeps:covers(currentProfile.clearCourt,requiredBounds),proposedLocalGround,proposedClearCourt,proposedLocalGroundRevision:{base:api.authoredCoveGroundRevision(immutable,proposedLocalGround),water:api.authoredCoveGroundRevision(water.world,proposedLocalGround)},proposalMethod:'Union exact patch/bank/shell bounds and measured actor radius + .04 edge sweeps; expand existing source applicability rectangles with .05 guard rounded outward to .05 grid. Root must implement/test any required eligibility adjustment.'};
const geometricEdges=new Map(),usedVertices=new Set();
for(const triangle of apronTriangles){const ids=triangle.map(p=>p.toArray().join(','));ids.forEach(id=>usedVertices.add(id));for(let i=0;i<3;i++){const key=[ids[i],ids[(i+1)%3]].sort().join('|');geometricEdges.set(key,(geometricEdges.get(key)??0)+1);}}
const glbTopology={vertices:usedVertices.size,triangles:apronTriangles.length,edges:geometricEdges.size,boundaryEdges:[...geometricEdges.values()].filter(n=>n===1).length,nonManifoldEdges:[...geometricEdges.values()].filter(n=>n!==2).length,allFinite:apronTriangles.every(t=>t.every(p=>p.toArray().every(Number.isFinite)))};
const frozen=JSON.parse(read(`${out}/freeze-inputs.json`));
const report={schema:'sansu-independent-cove-v4-source-audit-v1',scope:'Independent changed shore/floor audit; actual runtime domain and actor rigs, no browser, art or full runtime acceptance.',candidate:patch.candidate,shellSourceId:sourceManifest.candidate,
 inputHashes,sourceClosureCount:inputPaths.length,bundleSha256:digest(bundled.outputFiles[0].text),
 authorFreezeHashesAgree:Object.entries(frozen.hashes).every(([name,h])=>sha(`${dir}/${name}`)===h),glbTopology,manifestHashesAgree:Object.entries(manifest.outputs).every(([name,h])=>sha(`${dir}/${name}`)===h),
 shell:{sha256:sha(shellFile),sameAsFixedV3:sha(shellFile)===sha(`${old}/cove-corner-v3.glb`),transformSameAsFixedV3:eq(transform,JSON.parse(read(`${old}/assembly-manifest.json`)).common_transform),sourceIdMatchesDelivery:sourceManifest.candidate===delivery.source.id,matchesDelivery:sha(shellFile)===delivery.source.sha256,compressedArtifactMatchesDelivery:sha(`${repo}${delivery.artifact.path}`)===delivery.artifact.sha256,expandedArtifactMatchesShell:digest(gunzipSync(read(`${repo}${delivery.artifact.path}`)))===sha(shellFile),combinedGeometryAndMaterialsPreserved:eq(sorted(shell.parts),sorted(shellInCombined)),priorHomeCollisionAuditReuse:'Only unchanged shell geometry/transform allows prior v3 shell/house collision findings to carry. This run rechecks floor and socket support.'},
 transform,applicability,frames:{dry:{revision:dry.revision,assemblies:dry.covePlan?.assemblies},water:{revision:wet.revision,assemblies:wet.covePlan?.assemblies},dryMatchesIndependentPatch:eq(defGeometry(dry.world.definition),defGeometry(independentDry.definition)),waterMatchesIndependentPatch:eq(defGeometry(wet.world.definition),defGeometry(independentWet.definition))},
 base:invariants(immutable,dry.world),water:invariants(water.world,wet.world),
 apron:{parts:apron.length,triangles:apronTriangles.length,topTriangles:top.length,expectedTopTriangles:expectedTriangles.length,triangleParity:eq(expectedTriangles.sort(),actualTriangles.sort()),maxVertexError,upwardTopTriangles:top.filter(t=>new T.Triangle(...t).getNormal(new T.Vector3()).y>0).length,nonUpwardTopTriangles:top.filter(t=>new T.Triangle(...t).getNormal(new T.Vector3()).y<=0).map(t=>({area:new T.Triangle(...t).getArea(),points:t.map(p=>p.toArray())})),bankTriangles:bankTriangles.length,expectedBankTriangles:bankExpected.length,bankTriangleParity:eq(bankActual,bankExpected),bankMaxVertexError,materialInfo,patchTopColor:topColor,patchBankColor:bankColor,topMaterialsMatchPatch:colorMatches(topParts,topColor),bankMaterialsMatchPatch:colorMatches(apron.filter(p=>!topParts.includes(p)),bankColor)},envelope,
 finalHashes:Object.fromEntries(Object.keys(inputHashes).map(p=>[p,sha(p)])),inputHashesUnchanged:Object.entries(inputHashes).every(([p,h])=>sha(p)===h)};
fs.writeFileSync(`${out}/independent-audit.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,inputHashes:undefined,finalHashes:undefined,apron:{...report.apron,materialInfo:undefined},envelope:{...envelope,bands:undefined}},null,2));
