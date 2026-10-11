import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as T from 'three';

const sourcePath = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const sourceSha = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(sourcePath); assert.equal(hash(source), sourceSha);
const jsonSize = source.readUInt32LE(12), gltf = JSON.parse(source.subarray(20, jsonSize + 20)), binary = source.subarray(28 + jsonSize);
const worldManifest = JSON.parse(await readFile('docs/design/2026-10-11-authored-world-foundation/world-manifest.json', 'utf8'));
assert.equal(worldManifest.source.sha256, sourceSha);
const { scale, origin } = worldManifest.transform;
const matrices = new Map();
function visit(index, parent) {
    const node = gltf.nodes[index], local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(new T.Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
    const matrix = parent.clone().multiply(local); matrices.set(index, matrix);
    for (const child of node.children ?? []) visit(child, matrix);
}
for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, new T.Matrix4());
function accessor(index, components) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView]; assert(!a.sparse && view.buffer === 0);
    const formats = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] };
    const [width, read] = formats[a.componentType] ?? []; assert(width);
    const stride = view.byteStride ?? width * components, offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: components }, (_, j) => binary[read](offset + i * stride + j * width)));
}
const drySupport = new Set(['Grove / rounded living terrace', 'Garden / rounded flower terrace', 'Village / shared sunny court', 'Grove / sheltered open room',
    'Flowers / open sky gathering court', 'Harbor / shared waterfront court', 'Water town / shared frontage court']);
const parts = [], extraction = [];
for (const [index, node] of gltf.nodes.entries()) {
    const coast = node.name === 'Coast / continuous layered shore';
    if (!coast && !drySupport.has(node.name)) continue;
    assert(matrices.has(index));
    for (const [serial, primitive] of gltf.meshes[node.mesh].primitives.entries()) {
        const matrix = matrices.get(index), normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
        const points = accessor(primitive.attributes.POSITION, 3).map(values => new T.Vector3().fromArray(values).applyMatrix4(matrix).multiplyScalar(scale).add(new T.Vector3(origin.x, origin.y, origin.z)));
        const normals = accessor(primitive.attributes.NORMAL, 3).map(values => new T.Vector3().fromArray(values).applyNormalMatrix(normalMatrix));
        const sourceIndices = accessor(primitive.indices, 1).flat(), indices = [];
        for (let i = 0; i < sourceIndices.length; i += 3) {
            const [a, b, c] = sourceIndices.slice(i, i + 3).map(id => points[id]);
            const upward = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
            // Upward dry triangles are already in the evaluator. Keep only the
            // actual support sides here; never duplicate its top or fill an inlet.
            if (coast || upward <= 1e-12) indices.push(...sourceIndices.slice(i, i + 3));
        }
        if (!indices.length) continue;
        const used = [...new Set(indices)], remap = new Map(used.map((id, i) => [id, i]));
        const material = gltf.materials[primitive.material], pbr = material.pbrMetallicRoughness;
        assert(!/Texture/.test(JSON.stringify(material)), 'Coast extraction cannot drop a texture');
        parts.push({ name: `${node.name}:${serial}`, positions: used.flatMap(i => points[i].toArray()), normals: used.flatMap(i => normals[i].toArray()),
            indices: indices.map(i => remap.get(i)), material: { name: material.name, color: pbr.baseColorFactor.slice(0, 3), roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 1 } });
        extraction.push({ name: node.name, primitive: serial, triangles: indices.length / 3, vertices: used.length, material: material.name });
    }
}
assert.equal(new Set(extraction.map(item => item.name)).size, drySupport.size + 1);
const skin = { version: 1, worldId: worldManifest.candidate, source: worldManifest.source, parts };
const bytes = Buffer.from(JSON.stringify(skin)), gzip = gzipSync(bytes, { level: 9 });
const folder = 'docs/design/2026-10-11-authored-coast-skin'; await mkdir(folder, { recursive: true });
const manifest = { worldId: skin.worldId, source: skin.source, transform: worldManifest.transform, extraction,
    artifact: { file: 'native05-coast.json.gz', bytes: bytes.length, sha256: hash(bytes), gzipBytes: gzip.length, gzipSha256: hash(gzip) },
    scope: 'Exact authored coastline and non-upward support sides only. No owner, water, plant, character or placement right.' };
await writeFile(`${folder}/${manifest.artifact.file}`, gzip); await writeFile(`${folder}/skin-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ sourceSha, worldId: skin.worldId, gzipBytes: gzip.length, triangles: extraction.reduce((n, part) => n + part.triangles, 0), parts: parts.length }));
