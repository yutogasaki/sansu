import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';

// Read-only source extraction. Output must be a new directory; no app build.
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output NEW_DIRECTORY from repository root');
const output = path.resolve(process.argv[3]);
assert(!fs.existsSync(output), 'Refuse to overwrite evidence');
const hash = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(path.resolve('package.json'));
const T = require('three');
const sourcePath = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const source = fs.readFileSync(sourcePath);
const sourceSha256 = hash(source);
assert.equal(sourceSha256, '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
const nodeIndex = gltf.nodes.findIndex(n => n.name === 'Island / continuous sculpted mature terrain');
const node = gltf.nodes[nodeIndex];
assert(gltf.scenes[gltf.scene ?? 0].nodes.includes(nodeIndex));
assert(!gltf.nodes.some(n => n.children?.includes(nodeIndex)));
assert(!node.matrix && !node.translation && !node.rotation && !node.scale, 'Audit assumes source node identity transform');
const world = JSON.parse(gunzipSync(fs.readFileSync('prototypes/place-qa/native05-world.json.gz')));
const scale = .45;
const origin = { x: 2.5 - (-7 * scale), y: -.81 * scale, z: .5 - (3.4 * scale) };
const stable = n => Math.round(n * 1e9) / 1e9 || 0;
function values(index, count) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    assert(!accessor.sparse && view.buffer === 0 && accessor.componentType === 5126);
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: count }, (_, j) => binary.readFloatLE(offset + i * (view.byteStride ?? count * 4) + j * 4)));
}
function textureFields(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => [
        ...(/texture/i.test(key) ? [`${prefix}${key}`] : []),
        ...(child && typeof child === 'object' && !Array.isArray(child) ? textureFields(child, `${prefix}${key}.`) : []),
    ]);
}
fs.mkdirSync(output, { recursive: false });
const primitives = [];
for (const [serial, primitive] of gltf.meshes[node.mesh].primitives.entries()) {
    const normals = values(primitive.attributes.NORMAL, 3);
    const positions = values(primitive.attributes.POSITION, 3);
    const floor = world.districts.flatMap(d => d.floors).find(f => f.id === `${node.name}:${serial}`);
    assert(floor && floor.vertices.length === positions.length && normals.length === positions.length);
    let positionMaxError = 0;
    for (let i = 0; i < positions.length; i++) {
        const [x, y, z] = positions[i];
        const expected = [stable(x * scale + origin.x), stable(y * scale + origin.y), stable(z * scale + origin.z)];
        const actual = floor.vertices[i].point;
        positionMaxError = Math.max(positionMaxError, ...expected.map((n, axis) => Math.abs(n - [actual.x, actual.y, actual.z][axis])));
    }
    assert.equal(positionMaxError, 0, 'Source vertex index and extracted position correspond exactly');
    const packed = Buffer.alloc(normals.length * 12);
    normals.flat().forEach((n, i) => packed.writeFloatLE(n, i * 4));
    // The f32le bytes are copied accessor values, without normalization or smoothing.
    const artifact = `terrain-${serial}-normal.f32le.gz`, compressed = gzipSync(packed, { level: 9 });
    fs.writeFileSync(path.join(output, artifact), compressed);
    const material = gltf.materials[primitive.material];
    const color = `#${new T.Color().fromArray(material.pbrMetallicRoughness.baseColorFactor).getHexString()}`;
    assert.equal(color, floor.color);
    primitives.push({ serial, attributes: primitive.attributes, indicesAccessor: primitive.indices, materialIndex: primitive.material,
        rawMaterial: material, textureFields: textureFields(material), hasVertexColors: primitive.attributes.COLOR_0 !== undefined,
        sourceNormal: { accessor: gltf.accessors[primitive.attributes.NORMAL], bufferView: gltf.bufferViews[gltf.accessors[primitive.attributes.NORMAL].bufferView],
            artifact, encoding: 'gzip of tightly packed little-endian Float32 xyz; source NORMAL vertex order', count: normals.length,
            bytes: packed.length, sha256: hash(packed), gzipBytes: compressed.length, gzipSha256: hash(compressed), firstThree: normals.slice(0, 3) },
        extractedFloor: { id: floor.id, color: floor.color, vertices: floor.vertices.length, triangles: floor.indices.length / 3,
            positionMaxError, hasNormalField: floor.vertices.some(v => 'normal' in v) || 'normals' in floor,
            roughness: floor.roughness ?? null, material: floor.material ?? null },
    });
}
const result = { scope: 'Source evidence only; no rendering, geometry, physics or ownership changes', source: { path: sourcePath, sha256: sourceSha256 },
    terrain: { nodeIndex, node, mesh: node.mesh, isActiveSceneRoot: true, sourceNodeTransform: 'identity' },
    sourceToWorld: { scale, origin, normals: 'unchanged direction under this positive uniform scale and translation' },
    rendererReadFromCode: { path: 'src/components/island/growing/native/authoredGrowingGround.ts', normal: 'computeVertexNormals after combining separately indexed floors',
        material: { type: 'MeshStandardMaterial', vertexColors: true, roughness: .95, metalnessDefault: 0, sideDefault: 'FrontSide' } },
    primitives,
};
fs.writeFileSync(path.join(output, 'source-normal-materials.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ sourceSha256, terrainNode: nodeIndex, normals: primitives.map(p => p.sourceNormal.count),
    sourceMaterialRoughness: primitives.map(p => p.rawMaterial.pbrMetallicRoughness.roughnessFactor),
    textureFields: primitives.map(p => p.textureFields), positionMaxError: primitives.map(p => p.extractedFloor.positionMaxError) }, null, 2));
