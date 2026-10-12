import fs from 'node:fs';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='/Users/yutogasaki/Projects/sansu',require=createRequire(root+'/package.json'),T=require('three');
const buf=fs.readFileSync(root+'/docs/design/2026-10-10-island-final-3d/whole-island.glb'),len=buf.readUInt32LE(12),g=JSON.parse(buf.subarray(20,20+len)),bin=buf.subarray(28+len);
const acc=id=>{const a=g.accessors[id],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3}[a.type],fmt={5126:[4,'readFloatLE'],5125:[4,'readUInt32LE'],5123:[2,'readUInt16LE']}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bin[fmt[1]]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??fmt[0]*n)+j*fmt[0])));};
const world=JSON.parse(gunzipSync(fs.readFileSync(root+'/prototypes/place-qa/native05-world.json.gz'))),floors=world.districts.flatMap(d=>d.floors).filter(f=>f.id.startsWith('Island /'));
const node=g.nodes.find(n=>n.name==='Island / continuous sculpted mature terrain'),prims=g.meshes[node.mesh].primitives;
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,new T.Vector3(...a).normalize().dot(new T.Vector3(...b).normalize()))))*180/Math.PI;
const stats=a=>{a.sort((x,y)=>x-y);return {count:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
const positions=new Map(),parts=[];
for(let k=0;k<floors.length;k++){
 const f=floors[k],p=prims[k],srcNormals=acc(p.attributes.NORMAL),geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(f.vertices.flatMap(v=>[v.point.x,v.point.y,v.point.z]),3));geom.setIndex(f.indices);geom.computeVertexNormals();
 const all=[],central=[];for(const i of new Set(f.indices)){const v=f.vertices[i].point,n=Array.from(geom.attributes.normal.array.slice(i*3,i*3+3)),a=angle(n,srcNormals[i]);all.push(a);if(v.x>=6&&v.x<=10&&v.z>=-8&&v.z<=-5&&v.y>.3)central.push(a);
 const key=[v.x,v.y,v.z].map(v=>v.toFixed(7)).join(',');const ar=positions.get(key)??[];ar.push({part:k,normal:n,source:srcNormals[i],point:v});positions.set(key,ar);}
 parts.push({id:f.id,material:g.materials[p.material],sourceNormalComparedToRecomputedDegrees:stats(all),centralNormalDifferenceDegrees:central.length?stats(central):null});
}
const seams=[];for(const a of positions.values())if(new Set(a.map(x=>x.part)).size>1){for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i].part!==a[j].part)seams.push({point:a[i].point,sourceNormalAngle:angle(a[i].source,a[j].source),recomputedNormalAngle:angle(a[i].normal,a[j].normal)});}
const central=seams.filter(s=>s.point.x>=6&&s.point.x<=10&&s.point.z>=-8&&s.point.z<=-5);
const existingInput=root+'/docs/design/2026-10-12-authored-cove-entrance/author-audit-v4/independent-floor-input.json';let carved=[];
if(fs.existsSync(existingInput)){
 const d=JSON.parse(fs.readFileSync(existingInput));for(const f of d.wetPatched.filter(f=>f.id.includes('continuous sculpted mature terrain'))){
  const used=new Set(f.indices),groups=new Map();for(const i of used){const p=f.vertices[i],key=p.map(x=>x.toFixed(7)).join(',');const a=groups.get(key)??[];a.push(i);groups.set(key,a);}
  carved.push({id:f.id,usedVertices:used.size,uniquePositions:groups.size,duplicateCoordinateVertices:used.size-groups.size});
 }
}
const report={scope:'Read-only numerical source-normal/material comparison; no geometry, rights, app, source or browser changes',sourceSha256:createHash('sha256').update(buf).digest('hex'),terrainNode:node,parts,seams:{count:seams.length,source:stats(seams.map(s=>s.sourceNormalAngle)),recomputed:stats(seams.map(s=>s.recomputedNormalAngle)),centralCount:central.length,centralRecomputed:central.length?stats(central.map(s=>s.recomputedNormalAngle)):null,worst:seams.sort((a,b)=>b.recomputedNormalAngle-a.recomputedNormalAngle).slice(0,5)},carvedFloorDiagnosticFromFrozenV4AuthorInput:carved};
fs.writeFileSync('/private/tmp/sansu-floor-normal-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
const d=JSON.parse(fs.readFileSync(existingInput)),f=d.wetPatched.find(f=>f.id.includes('continuous sculpted mature terrain:1')),geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(f.vertices.flat(),3));geom.setIndex(f.indices);geom.computeVertexNormals();const groups=new Map();for(const i of new Set(f.indices)){const p=f.vertices[i];if(p[0]<6||p[0]>10||p[2]<-8||p[2]>-5||p[1]<=.3)continue;const key=p.map(x=>x.toFixed(7)).join(',');const a=groups.get(key)??[];a.push(i);groups.set(key,a);}const breaks=[];for(const indices of groups.values())if(indices.length>1){let max=0;for(let i=0;i<indices.length;i++)for(let j=i+1;j<indices.length;j++){const a=Array.from(geom.attributes.normal.array.slice(indices[i]*3,indices[i]*3+3)),b=Array.from(geom.attributes.normal.array.slice(indices[j]*3,indices[j]*3+3));if(new T.Vector3(...a).lengthSq()>.5&&new T.Vector3(...b).lengthSq()>.5)max=Math.max(max,angle(a,b));}breaks.push(max);}
report.carvedCentralDuplicateNormalDiscontinuityDegrees=stats(breaks);fs.writeFileSync('/private/tmp/sansu-floor-normal-audit.json',JSON.stringify(report,null,2)+'\n');console.log('CARVED_NORMAL_BREAKS',JSON.stringify(report.carvedCentralDuplicateNormalDiscontinuityDegrees));
