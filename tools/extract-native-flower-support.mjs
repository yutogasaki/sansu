import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { gzipSync } from 'node:zlib';

// Only the missing owned flower supports are extracted. The approved island and
// existing crown kit are immutable inputs; no scene, court or background plant is copied.
const root = new URL('../', import.meta.url);
const sourceArtifact = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const sourceSha256 = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const sourceUrl = new URL(sourceArtifact, root);
const folder = 'docs/design/2026-10-11-authored-flower-garden';
const profileUrl = new URL(`${folder}/native-flower-support-profile.json`, root);
const artifactPath = 'prototypes/place-qa/native-flower-support.json.gz';
const artifactUrl = new URL(artifactPath, root);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stable = value => { assert(Number.isFinite(value)); return Math.round(value * 1e8) / 1e8 || 0; };
const check = process.argv[2] === '--check';
assert(process.argv.length === 2 || (process.argv.length === 3 && check), 'Use node tools/extract-native-flower-support.mjs [--check]');
const source = await readFile(sourceUrl);
assert.equal(hash(source), sourceSha256, 'Approved native05 source differs');
assert.equal(source.readUInt32LE(0), 0x46546c67);
assert.equal(source.readUInt32LE(4), 2);
assert.equal(source.readUInt32LE(8), source.length);
const jsonSize = source.readUInt32LE(12), binaryHeader = 20 + jsonSize;
assert.equal(source.readUInt32LE(16), 0x4e4f534a);
assert.equal(source.readUInt32LE(binaryHeader + 4), 0x004e4942);
assert.equal(binaryHeader + 8 + source.readUInt32LE(binaryHeader), source.length);
const gltf = JSON.parse(source.subarray(20, binaryHeader)), binary = source.subarray(binaryHeader + 8);
assert.equal(gltf.buffers.length, 1);
assert(!gltf.buffers[0].uri && gltf.buffers[0].byteLength <= binary.length);

const matrices = new Map(), visiting = new Set();
function visit(index, parent) {
    assert(Number.isInteger(index) && index >= 0 && index < gltf.nodes.length, 'Invalid source node');
    assert(!visiting.has(index) && !matrices.has(index), 'Source hierarchy is cyclic or shared');
    visiting.add(index);
    const node = gltf.nodes[index];
    const local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
        new T.Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
    assert(local.elements.every(Number.isFinite) && Math.abs(local.determinant()) > 1e-12, 'Invalid source transform');
    const matrix = parent.clone().multiply(local); matrices.set(index, matrix);
    for (const child of node.children ?? []) visit(child, matrix);
    visiting.delete(index);
}
for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, new T.Matrix4());

function accessor(index, type) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a?.bufferView];
    assert(a && view && a.type === type && !a.sparse && !a.normalized && view.buffer === 0, 'Unsupported source accessor');
    const components = type === 'SCALAR' ? 1 : 3;
    const formats = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] };
    const [width, read] = formats[a.componentType] ?? [];
    assert(width && Number.isInteger(a.count) && a.count > 0, 'Invalid source accessor format');
    if (type === 'VEC3') assert.equal(a.componentType, 5126, 'Expected floating-point geometry or colour');
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? width * components;
    const end = start + (a.count - 1) * stride + width * components;
    assert(stride >= width * components && start >= (view.byteOffset ?? 0)
        && end <= (view.byteOffset ?? 0) + view.byteLength && end <= binary.length, 'Source accessor exceeds its buffer');
    const values = Array.from({ length: a.count }, (_, i) => Array.from({ length: components }, (_, j) => binary[read](start + i * stride + j * width)));
    assert(values.every(row => row.every(Number.isFinite)), 'Non-finite source accessor');
    if (a.min && a.max) for (const row of values) for (let component = 0; component < components; component++) {
        assert(row[component] >= a.min[component] - 1e-7 && row[component] <= a.max[component] + 1e-7, 'Source accessor exceeds declared bounds');
    }
    return values;
}

function geometry(primitive, matrix) {
    assert.equal(primitive.mode ?? 4, 4, 'Expected source triangles');
    const vertices = accessor(primitive.attributes.POSITION, 'VEC3').map(values => new T.Vector3().fromArray(values).applyMatrix4(matrix));
    const indices = accessor(primitive.indices, 'SCALAR').flat();
    assert(indices.length % 3 === 0 && indices.every(index => Number.isInteger(index) && index >= 0 && index < vertices.length), 'Invalid source triangle indices');
    assert(vertices.every(point => [point.x, point.y, point.z].every(Number.isFinite)), 'Invalid transformed source geometry');
    return { vertices, indices };
}

const sourceId = 'native05-owned-flower-support-v1', scale = .45;
// Blender Z-up recipe becomes Three Y-up; these joints are source recipe points,
// while the baked vertices below remain the actual exported geometry.
const pivot = new T.Vector3(3.75, 1.24, -4.4);
const relative = values => new T.Vector3(...values).sub(pivot).multiplyScalar(scale).toArray().map(stable);
const stockHeight = 3 * scale;
const controls = {
    trunk: [[3.75,1.24,-4.4],[3.57,2.14,-4.49],[3.678,3.19,-4.55],[3.63,4.24,-4.4]],
    'canopy-stem': [[3.75,3.49,-4.4],[5.0425,4.8,-4.62],[6.1,5.4,-4.8]],
    'joined-bough': [[3.75,3.65,-4.4],[4.025,4.5,-5.45],[4.3,3.65,-6.5]],
};
const selects = [
    { role:'trunk', name:'Flower tree 1 / planted trunk' },
    ...Array.from({length:4},(_,i)=>({role:'root',name:`Flower tree 1 / soft grounding root${i?'.'+String(i).padStart(3,'0'):''}`})),
    ...Array.from({length:3},(_,i)=>({role:'ridge',name:`Flower tree 1 / flowing bark ridge${i?'.'+String(i).padStart(3,'0'):''}`})),
    {role:'canopy-stem',name:'Flowers / canopy-reaching stem'},
    {role:'joined-bough',name:'Flowers / joined lateral bough'},
    ...Array.from({length:3},(_,i)=>({role:'grown-branch',name:`Flowers / supporting grown branch${i?'.'+String(i).padStart(3,'0'):''}`})),
    {role:'leaf',name:'Flowers / broad growing leaf'},
];
const parts = selects.map(({name,role})=>{
    const index=gltf.nodes.findIndex(node=>node.name===name), node=gltf.nodes[index], matrix=matrices.get(index);
    assert(node?.mesh!==undefined && matrix, `Missing source part: ${name}`);
    const primitives=gltf.meshes[node.mesh].primitives; assert.equal(primitives.length,1);
    const primitive=primitives[0], shape=geometry(primitive,matrix), sm=gltf.materials[primitive.material], pbr=sm.pbrMetallicRoughness;
    assert(!/Texture/.test(JSON.stringify(sm)) && (sm.alphaMode??'OPAQUE')==='OPAQUE');
    const material={name:sm.name,color:`#${new T.Color().fromArray(pbr.baseColorFactor).getHexString()}`,roughness:stable(pbr.roughnessFactor),metalness:stable(pbr.metallicFactor),doubleSided:sm.doubleSided===true};
    const positions=shape.vertices.flatMap(point=>point.clone().sub(pivot).multiplyScalar(scale).toArray().map(stable));
    const normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
    const normals=accessor(primitive.attributes.NORMAL,'VEC3').flatMap(row=>new T.Vector3().fromArray(row).applyNormalMatrix(normalMatrix).toArray().map(stable));
    assert.equal(positions.length,normals.length);
    const bounds={min:[0,1,2].map(axis=>Math.min(...positions.filter((_,i)=>i%3===axis))),max:[0,1,2].map(axis=>Math.max(...positions.filter((_,i)=>i%3===axis)))};
    let path=controls[role];
    if(role==='grown-branch'){
        const k=Number(name.split('.').at(-1))||0,a=k*1.8;
        path=[[3.75,3.19,-4.4],[3.75+.45*Math.cos(a),3.82,-4.4-.4*Math.sin(a)],[3.75+.75*Math.cos(a),4.24,-4.4-.65*Math.sin(a)]];
    }
    return {name,role,positions,normals,indices:shape.indices,material,bounds,...(path?{joints:path.map(relative)}:{}),...(role==='leaf'?{attach:relative([3.75,2.6,-4.4])}:{})};
});
const counts={parts:parts.length,vertices:parts.reduce((sum,p)=>sum+p.positions.length/3,0),triangles:parts.reduce((sum,p)=>sum+p.indices.length/3,0)};
assert.equal(counts.parts,14);
assert(parts.every(p=>!p.name.includes('petal')&&!p.name.includes('court')));
const skin={version:1,source:{artifact:sourceArtifact,sha256:sourceSha256,id:sourceId},scale,pivot:pivot.toArray(),stockHeight,parts};
const expanded=Buffer.from(`${JSON.stringify(skin)}\n`),compressed=gzipSync(expanded,{level:9});
assert(compressed.length<=150*1024,'Flower support exceeds its 150 KiB delivery budget');
const profile={version:1,source:skin.source,scale,pivot:skin.pivot,stockHeight,
    crown:{part:'flower-crown',sourcePivot:[6.1,4.990309081971645,-4.8],stemTip:relative([6.1,5.4,-4.8]),stemOffset:[0,stable((5.4-4.990309081971645)*scale),0]},
    parts:parts.map(({name,role,bounds,joints,attach,material,positions,indices})=>({name,role,bounds,...(joints?{joints}:{}),...(attach?{attach}:{}),material,vertices:positions.length/3,triangles:indices.length/3})),counts,
    artifact:{path:`/${artifactPath}`,sha256:hash(compressed),expandedSha256:hash(expanded),expandedBytes:expanded.length,gzipBytes:compressed.length}};
const text=`${JSON.stringify(profile)}\n`;
assert.equal(hash(await readFile(sourceUrl)),sourceSha256,'Source changed during extraction');
if(check){assert.equal(await readFile(profileUrl,'utf8'),text,'Flower support profile differs');assert.equal(hash(await readFile(artifactUrl)),hash(compressed),'Flower support asset differs');}
else{await mkdir(new URL(folder+'/',root),{recursive:true});await writeFile(profileUrl,text);await writeFile(artifactUrl,compressed);}
console.log(JSON.stringify({mode:check?'check':'extract',sourceUnchanged:true,sourceId,counts,artifact:profile.artifact}));
