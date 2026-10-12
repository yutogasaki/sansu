import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
const output = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const raw = fs.readFileSync(sourcePath), sha256 = createHash('sha256').update(raw).digest('hex');
assert.equal(sha256, '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
const length = raw.readUInt32LE(12), gltf = JSON.parse(raw.subarray(20, 20 + length)), bin = raw.subarray(28 + length);
function accessor(id, size) {
    const a = gltf.accessors[id], v = gltf.bufferViews[a.bufferView];
    const [width, read] = ({ 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'] })[a.componentType];
    assert(!a.sparse);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => bin[read]((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? width * size) + j * width)));
}
const matrices = new Map();
function visit(id, parent) {
    const n = gltf.nodes[id], local = n.matrix ? new T.Matrix4().fromArray(n.matrix) : new T.Matrix4().compose(new T.Vector3(...n.translation ?? [0, 0, 0]), new T.Quaternion(...n.rotation ?? [0, 0, 0, 1]), new T.Vector3(...n.scale ?? [1, 1, 1]));
    const world = parent.clone().multiply(local); matrices.set(id, world); for (const c of n.children ?? []) visit(c, world);
}
for (const id of gltf.scenes[gltf.scene ?? 0].nodes) visit(id, new T.Matrix4());
const handoff = JSON.parse(gunzipSync(fs.readFileSync(`${output}/input/selected-v3-handoff.json.gz`)));
const names = { willow: 'Grove tree 1 / planted trunk', birch: 'Grove / silver birch 0 / white planted trunk', spire: 'Grove / spire tree 0 / slender grown trunk' };
const owners = [];
for (const owner of handoff.ownerTransforms) {
    const root = owner.treeRoots[0], name = names[root.sourcePart], id = gltf.nodes.findIndex(n => n.name === name);
    assert(id >= 0, `Missing actual trunk ${name}`);
    const transform = new T.Matrix4().fromArray(root.authoredMatrixWorld).multiply(new T.Matrix4().makeTranslation(...root.sourceOrigin.map(n => -n))).multiply(matrices.get(id));
    const normalTransform = new T.Matrix3().getNormalMatrix(transform);
    const parts = gltf.meshes[gltf.nodes[id].mesh].primitives.map(p => {
        const positions = accessor(p.attributes.POSITION, 3).map(v => new T.Vector3(...v).applyMatrix4(transform).toArray());
        const normals = accessor(p.attributes.NORMAL, 3).map(v => new T.Vector3(...v).applyMatrix3(normalTransform).normalize().toArray());
        const indices = accessor(p.indices, 1).flat(), minY = Math.min(...positions.map(p => p[1]));
        const capCandidates = [];
        for (let i = 0; i < indices.length; i += 3) {
            const tri = indices.slice(i, i + 3), vs = tri.map(k => new T.Vector3(...positions[k]));
            const normal = vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).normalize();
            if (normal.y < -.5 && Math.max(...vs.map(v => v.y)) < minY + .12) capCandidates.push({ triangle: i / 3, indices: tri, normal: normal.toArray(), maxY: Math.max(...vs.map(v => v.y)) });
        }
        return { sourcePrimitive: p, material: gltf.materials[p.material], positions, normals, indices, minY, capCandidates };
    });
    owners.push({ ownerId: owner.id, cell: owner.cell, part: root.sourcePart, sourceNode: name, sourceNodeIndex: id,
        sourceToAuthoredMatrix: transform.toArray(), unchangedOwnerTransform: root, parts });
}
const result = { sourcePath, sourceSha256: sha256, scope: 'Exact source trunk data under fixed handed-off owner matrices; candidate lower caps only, no modification.', owners };
fs.writeFileSync(`${output}/input/native-trunk-bases.json`, `${JSON.stringify(result)}\n`);
console.log(JSON.stringify(owners.map(o => ({ ownerId: o.ownerId, name: o.sourceNode, parts: o.parts.map(p => ({ vertices: p.positions.length, triangles: p.indices.length / 3, minY: p.minY, capCandidates: p.capCandidates.length, capMaxY: Math.max(...p.capCandidates.map(p => p.maxY)) })) })), null, 2));
