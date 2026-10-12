// Independent read-only audit. Only writes diagnostic data next to this script.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const repo='/Users/yutogasaki/Projects/sansu', out='/private/tmp/sansu-authored-cove-plan';
const require=createRequire(`${repo}/package.json`), T=require('three'), {build}=require('esbuild');
const dir=`${repo}/docs/design/2026-10-12-authored-cove-entrance`;
const read=p=>fs.readFileSync(p), sha=p=>createHash('sha256').update(read(p)).digest('hex');
const manifest=JSON.parse(read(`${dir}/assembly-manifest.json`)), patch=JSON.parse(read(`${dir}/shared-apron-world-patch-v1.json`));
const original=`${repo}/docs/design/2026-10-10-island-final-3d`;
const fixed=[`${dir}/cove-corner-v3.glb`,`${dir}/cove-corner-with-apron-v3.glb`,`${dir}/shared-apron-world-patch-v1.json`,`${original}/whole-island.glb`,`${original}/whole-island.blend`,`${original}/whole-island-render.png`];
const hashes=Object.fromEntries(fixed.map(p=>[p,sha(p)]));
const bundled=await build({stdin:{contents:`
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition.ts';
export {withNative05WaterCarvingScope} from './src/domain/growingIsland/authoredWaterCarving.ts';
export {authoredWaterFrame} from './src/domain/growingIsland/authoredWaterFrame.ts';
export {sceneLayout} from './src/components/island/growing/sceneLayout.ts';
export {authoredFlowerWalkSet} from './src/components/island/growing/authoredFlowerObstructions.ts';
export {walkableCells,reachableFromHome,approachCells,key} from './src/domain/growingIsland/space.ts';
`,resolveDir:repo,loader:'ts'},write:false,bundle:true,packages:'external',format:'cjs',platform:'node',metafile:true,logLevel:'silent'});
const mod={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(require,mod,mod.exports);const api=mod.exports;
const sourceHashes=Object.fromEntries(Object.keys(bundled.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>[p,sha(`${repo}/${p}`)]));
const state=JSON.parse(read(`${repo}/prototypes/place-qa/authored-flower-reference-mature.json`)).state;
const base=api.compileWorldDefinition(JSON.parse(gunzipSync(read(`${repo}/prototypes/place-qa/native05-world.json.gz`))));
const waterFrame=api.authoredWaterFrame(state,api.withNative05WaterCarvingScope(base));
function applyPatch(world){const d=structuredClone(world.definition);d.revision=`independent:${world.revision??'base'}:cove-v3`;
for(const addition of patch.siteAdditions??[]) {const district=d.districts.find(x=>x.id===addition.districtId);if(!district)throw Error('missing district');district.sites.push(...structuredClone(addition.sites));}
d.districts.push(structuredClone(patch.district));d.edges.push(...structuredClone(patch.edges));return api.compileWorldDefinition(d);}
const patched=applyPatch(base), wetPatched=applyPatch(waterFrame.world);
function decode(file){const buf=read(file);if(buf.readUInt32LE(0)!==0x46546c67)throw Error('GLB magic');let json,bin;
for(let off=12;off<buf.length;){const n=buf.readUInt32LE(off),kind=buf.readUInt32LE(off+4),chunk=buf.subarray(off+8,off+8+n);if(kind===0x4e4f534a)json=JSON.parse(chunk);if(kind===0x004e4942)bin=chunk;off+=8+n;}
function accessor(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],dim={SCALAR:1,VEC3:3}[a.type];if(!size||!dim)throw Error('accessor format');
return Array.from({length:a.count},(_,i)=>Array.from({length:dim},(_,j)=>{const at=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*dim)+j*size;return a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt8(at);}));}
const parts=[];function visit(id,parent){const n=json.nodes[id],local=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation??[0,0,0]),new T.Quaternion().fromArray(n.rotation??[0,0,0,1]),new T.Vector3().fromArray(n.scale??[1,1,1]));const matrix=parent.clone().multiply(local);
if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const points=accessor(p.attributes.POSITION).map(v=>new T.Vector3(...v).applyMatrix4(matrix));const indices=p.indices===undefined?points.map((_,i)=>i):accessor(p.indices).flat();parts.push({name:n.name,points,indices,material:json.materials?.[p.material]?.name});}
for(const child of n.children??[])visit(child,matrix);}
for(const id of json.scenes[json.scene??0].nodes)visit(id,new T.Matrix4());return parts;}
const transform=manifest.common_transform,pivot=new T.Vector3(...transform.source_gltf_pivot),pos=new T.Vector3(...transform.authored_position),scale=new T.Vector3(...transform.scale);
const toWorld=v=>v.clone().sub(pivot).multiply(scale).applyAxisAngle(new T.Vector3(0,1,0),transform.yaw).add(pos);
const shell=decode(`${dir}/cove-corner-v3.glb`),combined=decode(`${dir}/cove-corner-with-apron-v3.glb`),apron=combined.filter(p=>p.name===manifest.apron.name);
function triangles(part,convert=v=>v){return Array.from({length:part.indices.length/3},(_,i)=>part.indices.slice(i*3,i*3+3).map(id=>convert(part.points[id])));}
const patchFloor=patch.district.floors[0],points=patchFloor.vertices.map(v=>new T.Vector3(v.point.x,v.point.y,v.point.z)),topY=points[0].y;
const expectedTriangles=Array.from({length:patchFloor.indices.length/3},(_,i)=>patchFloor.indices.slice(i*3,i*3+3).sort((a,b)=>a-b).join(','));
const apronTriangles=apron.flatMap(p=>triangles(p,toWorld)),top=apronTriangles.filter(tri=>tri.every(v=>Math.abs(v.y-topY)<1e-6));let maxVertexError=0;
const actualTriangles=top.map(tri=>tri.map(v=>{let distance=Infinity,id=-1;points.forEach((p,i)=>{const d=p.distanceTo(v);if(d<distance){distance=d;id=i;}});maxVertexError=Math.max(maxVertexError,distance);return id;}).sort((a,b)=>a-b).join(','));
const triangleParity=JSON.stringify(expectedTriangles.sort())===JSON.stringify(actualTriangles.sort());
const canonPart=p=>({name:p.name,material:p.material,triangles:triangles(p).map(t=>t.map(v=>v.toArray().map(n=>n.toFixed(6)).join(',')).sort().join('|')).sort()});
const shellCanonical=shell.map(canonPart).sort((a,b)=>a.name.localeCompare(b.name)||a.material.localeCompare(b.material));
const combinedShell=combined.filter(p=>p.name!==manifest.apron.name).map(canonPart).sort((a,b)=>a.name.localeCompare(b.name)||a.material.localeCompare(b.material));
// Independently check all candidate skin/frame/socket triangles against actual
// original home meshes, using triangle SAT (including coplanar separating axes).
const kit=JSON.parse(read(`${repo}/docs/design/2026-10-11-native-owned-island/kit-manifest.json`)).parts['home-cap'];
const homeOrigin=new T.Vector3((kit.min[0]+kit.max[0])/2,kit.min[1],(kit.min[2]+kit.max[2])/2),originalParts=decode(`${original}/whole-island.glb`);
const homes=state.plots.filter(p=>['p6','p7'].includes(p.id)).flatMap(owner=>originalParts.filter(p=>kit.sourceNames.includes(p.name)).flatMap(p=>triangles(p,v=>v.clone().sub(homeOrigin).multiply(new T.Vector3(.45,.5625,.45)).add(new T.Vector3(owner.cell.x,base.floorAt(owner.cell).point.y+.04,owner.cell.z))).map(points=>({owner:owner.id,name:p.name,points,box:new T.Box3().setFromPoints(points)}))));
function hierarchy(ts){const box=new T.Box3();ts.forEach(t=>box.union(t.box));if(ts.length<=24)return {box,ts};const size=box.getSize(new T.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';ts.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=ts.length>>1;return {box,left:hierarchy(ts.slice(0,mid)),right:hierarchy(ts.slice(mid))};}
function candidates(tree,box,out=[]){if(!tree.box.intersectsBox(box))return out;if(tree.ts)out.push(...tree.ts.filter(t=>t.box.intersectsBox(box)));else{candidates(tree.left,box,out);candidates(tree.right,box,out);}return out;}
function overlaps(a,b){const edges=t=>t.map((p,i)=>t[(i+1)%3].clone().sub(p)),ea=edges(a),eb=edges(b),na=ea[0].clone().cross(ea[1]),nb=eb[0].clone().cross(eb[1]);if(na.lengthSq()<1e-24||nb.lengthSq()<1e-24)return false;
const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>x.clone().cross(y))),...ea.map(x=>x.clone().cross(na)),...eb.map(x=>x.clone().cross(nb))];
for(const axis of axes){if(axis.lengthSq()<1e-24)continue;axis.normalize();const ap=a.map(p=>p.dot(axis)),bp=b.map(p=>p.dot(axis));if(Math.max(...ap)<Math.min(...bp)-1e-8||Math.max(...bp)<Math.min(...ap)-1e-8)return false;}return true;}
const homeTree=hierarchy(homes),houseHits=[],socketBottomTriangles=[];let testedPairs=0;
for(const part of shell)for(const tri of triangles(part,toWorld)){const box=new T.Box3().setFromPoints(tri);for(const home of candidates(homeTree,box)){testedPairs++;if(overlaps(tri,home.points))houseHits.push({shell:part.name,home:home.owner,homePart:home.name});}
if(part.name.includes('grounded runner socket')&&new T.Triangle(...tri).getNormal(new T.Vector3()).y<-.5)socketBottomTriangles.push({name:part.name,points:tri.map(p=>p.toArray())});}
const envelope=JSON.parse(read(`${dir}/feasibility-with-apron-v3.json`)).actorEnvelope;
function obstruction(world){const layout=api.sceneLayout(state,false,world),root=new T.Group(),diagnostic=new T.Group();diagnostic.name='authored-flower-owned-stock';root.add(diagnostic);
for(const p of shell){const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(p.points.flatMap(v=>{const w=toWorld(v);return [w.x-layout.center,w.y,w.z-2];}),3));geom.setIndex(p.indices);diagnostic.add(new T.Mesh(geom,new T.MeshBasicMaterial()));}
const guard=api.authoredFlowerWalkSet(api.walkableCells(state,world),world,layout,root,envelope),reached=api.reachableFromHome(state,guard.walkable,world);
const access=['p6','p7','p9'].map(id=>{const owner=state.plots.find(p=>p.id===id),approaches=api.approachCells(owner.cell,world).filter(c=>reached.has(api.key(c)));return {id,reachable:approaches.length,clearToOwner:approaches.filter(c=>guard.clearGroundPath(c,owner.cell)).length};});
root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});return {triangles:guard.proof.triangles,excluded:guard.proof.excludedRefs,access};}
function invariants(upstream,after){return {floorsUnchanged:upstream.definition.districts.every((d,i)=>JSON.stringify(d.floors)===JSON.stringify(after.definition.districts[i].floors)),
anchorFloorsUnchanged:upstream.definition.districts.every((d,i)=>JSON.stringify(d.anchorFloors)===JSON.stringify(after.definition.districts[i].anchorFloors)),
oldSitesUnchanged:upstream.definition.districts.every((d,i)=>JSON.stringify(d.sites)===JSON.stringify(after.definition.districts[i].sites.slice(0,d.sites.length))),
oldEdgesUnchanged:JSON.stringify(upstream.definition.edges)===JSON.stringify(after.definition.edges.slice(0,upstream.definition.edges.length)),
grantsBefore:upstream.sites.filter(s=>s.placement).length,grantsAfter:after.sites.filter(s=>s.placement).length,addedRefs:after.sites.length-upstream.sites.length,addedEdges:after.definition.edges.length-upstream.definition.edges.length};}
const floorData=world=>world.floors.filter(f=>f.kind!=='water').map(f=>({id:f.id,vertices:f.vertices.map(v=>[v.point.x,v.point.y,v.point.z]),indices:f.indices}));
const edgeCells=patch.edges.map(e=>[e.from,e.to].map(r=>wetPatched.sites.find(s=>s.ref.districtId===r.districtId&&s.ref.siteId===r.siteId).cell));
fs.writeFileSync(`${out}/independent-floor-input.json`,JSON.stringify({base:floorData(base),water:floorData(waterFrame.world),patched:floorData(patched),wetPatched:floorData(wetPatched),patch:patchFloor,edges:edgeCells,envelope,socketBottomTriangles}));
const report={scope:'Independent source/definition audit, no browser, no full mixed-obstruction runtime or app acceptance',candidate:patch.candidate,hashes,sourceHashes,manifestHashesAgree:Object.entries(manifest.outputs).every(([name,hash])=>sha(`${dir}/${name}`)===hash),
apron:{parts:apron.length,triangles:apronTriangles.length,topTriangles:top.length,expectedTopTriangles:expectedTriangles.length,triangleParity,maxVertexError,unit:'world units',upwardTopTriangles:top.filter(t=>new T.Triangle(...t).getNormal(new T.Vector3()).y>0).length,nonUpwardTopTriangles:top.filter(t=>new T.Triangle(...t).getNormal(new T.Vector3()).y<=0).map(t=>({area:new T.Triangle(...t).getArea(),points:t.map(p=>p.toArray())}))},
houses:{method:'AABB hierarchy and full triangle SAT including coplanar axes, tolerance 1e-8 world',testedPairs,intersections:houseHits},
combinedPreservesShell:JSON.stringify(shellCanonical)===JSON.stringify(combinedShell),transform,base:invariants(base,patched),water:{revision:waterFrame.world.revision,owners:waterFrame.plan.ownerIds,...invariants(waterFrame.world,wetPatched)},baseObstruction:obstruction(patched),waterObstruction:obstruction(wetPatched),
finalHashes:Object.fromEntries(fixed.map(p=>[p,sha(p)])),inputHashesUnchanged:fixed.every(p=>sha(p)===hashes[p])&&Object.entries(sourceHashes).every(([p,h])=>sha(`${repo}/${p}`)===h)};
fs.writeFileSync(`${out}/independent-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,hashes:undefined,sourceHashes:undefined,finalHashes:undefined},null,2));
