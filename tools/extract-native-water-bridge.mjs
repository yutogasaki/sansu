import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { gzipSync } from 'node:zlib';

// Extract only approved geometry. This tool never runs Blender or edits its input.
const sourceArtifact = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const sourceSha256 = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const root = new URL('../', import.meta.url);
const sourceUrl = new URL(sourceArtifact, root);
const outputUrl = new URL('src/domain/growingIsland/nativeWaterBridgeProfile.json', root);
const artifactPath = 'prototypes/place-qa/native-water-bridge.json.gz';
const artifactUrl = new URL(artifactPath, root);
const scale = .45;
const stable = value => {
    assert(Number.isFinite(value), 'Non-finite source value');
    return Math.round(value * 1e8) / 1e8 || 0;
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--check'), 'Use node tools/extract-native-water-bridge.mjs [--check]');
const check = process.argv[2] === '--check';
const source = await readFile(sourceUrl);
assert.equal(hash(source), sourceSha256, 'Approved native05 source differs');
assert.equal(source.readUInt32LE(0), 0x46546c67, 'Expected GLB');
assert.equal(source.readUInt32LE(4), 2, 'Expected GLB version 2');
assert.equal(source.readUInt32LE(8), source.length, 'GLB length differs');
const jsonSize = source.readUInt32LE(12), binaryHeader = 20 + jsonSize;
assert.equal(source.readUInt32LE(16), 0x4e4f534a, 'Expected GLB JSON chunk');
assert.equal(source.readUInt32LE(binaryHeader + 4), 0x004e4942, 'Expected GLB binary chunk');
const binarySize = source.readUInt32LE(binaryHeader);
assert.equal(binaryHeader + 8 + binarySize, source.length, 'Unexpected GLB chunks');
const gltf = JSON.parse(source.subarray(20, binaryHeader));
const binary = source.subarray(binaryHeader + 8);
assert.equal(gltf.buffers.length, 1, 'Expected one embedded source buffer');
assert(!gltf.buffers[0].uri && gltf.buffers[0].byteLength <= binary.length, 'Source buffer is external or truncated');

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

const sourceId = 'native05-forest-garden-bridge', pivot = new T.Vector3(.25, 1, -4.45);
const nodes = gltf.nodes.map((node, index) => ({ node, index })).filter(({ node }) => /^Inlet \/ forest garden bridge \/ (arched plank|rounded post|curved handrail|curved structural beam)(?:\.\d+)?$/.test(node.name));
assert.equal(nodes.length, 33, 'Expected all source bridge pieces');
const parts = nodes.map(({ node, index }) => {
    const matrix = matrices.get(index), normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
    assert(matrix && node.mesh !== undefined, 'Bridge is outside the active scene');
    const primitives = gltf.meshes[node.mesh].primitives;
    assert.equal(primitives.length, 1, 'Expected one bridge primitive per source piece');
    const primitive = primitives[0], shape = geometry(primitive, matrix), sourceMaterial = gltf.materials[primitive.material];
    assert(['house / honey wood', 'sculpted tree wood'].includes(sourceMaterial.name), 'Unknown bridge material');
    assert(!/Texture/.test(JSON.stringify(sourceMaterial)) && (sourceMaterial.alphaMode ?? 'OPAQUE') === 'OPAQUE', 'Unexpected bridge texture/transparency');
    const pbr = sourceMaterial.pbrMetallicRoughness;
    const material = { name: sourceMaterial.name, color: `#${new T.Color().fromArray(pbr.baseColorFactor).getHexString()}`,
        roughness: stable(pbr.roughnessFactor), metalness: stable(pbr.metallicFactor) };
    const positions = shape.vertices.flatMap(point => point.clone().sub(pivot).multiplyScalar(scale).toArray().map(stable));
    const normals = accessor(primitive.attributes.NORMAL, 'VEC3').flatMap(row => new T.Vector3().fromArray(row).applyNormalMatrix(normalMatrix).toArray().map(stable));
    assert.equal(normals.length, positions.length);
    return { name: node.name, positions, normals, indices: shape.indices, material };
});
const boards = parts.filter(part => part.name.includes('/ arched plank'));
assert.equal(boards.length, 18);
const deckRows = boards.map(part => {
    const points = [], sections = [];
    for (let i = 0; i < part.indices.length; i += 3) {
        const ids = part.indices.slice(i, i + 3);
        if (ids.some(id => part.normals[id * 3 + 1] < .75)) continue;
        const [a, b, c] = ids.map(id => ({ x: part.positions[id * 3], y: part.positions[id * 3 + 1], z: part.positions[id * 3 + 2] }));
        const minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
        if (minZ > 1e-8 || maxZ < -1e-8) continue;
        const section = [];
        for (const [start, end] of [[a, b], [b, c], [c, a]]) {
            if (Math.abs(start.z) <= 1e-8) section.push({ x: start.x, y: start.y });
            if ((start.z < 0) !== (end.z < 0)) {
                const t = -start.z / (end.z - start.z); section.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
            }
        }
        points.push(...section); sections.push(section);
    }
    assert(points.length, 'Source board has no top at its centreline');
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const centreX = (minX + maxX) / 2;
    const heights = sections.map(section => {
        const sorted = section.toSorted((a, b) => a.x - b.x), a = sorted[0], b = sorted.at(-1);
        if (!a || b.x - a.x < 1e-10 || centreX < a.x - 1e-9 || centreX > b.x + 1e-9) return;
        return a.y + (b.y - a.y) * (centreX - a.x) / (b.x - a.x);
    }).filter(y => y !== undefined);
    assert(heights.length, 'Source board centre is unsupported');
    const topY = Math.max(...heights);
    return { x: stable(centreX), y: stable(topY), minX: stable(minX), maxX: stable(maxX) };
}).sort((a, b) => a.x - b.x);
assert(deckRows.every((row, i) => !i || row.x > deckRows[i - 1].x), 'Source boards are not ordered');
const deckBaseY = Math.min(deckRows[0].y, deckRows.at(-1).y);
const span = stable(deckRows.at(-1).maxX - deckRows[0].minX);
const width = stable(Math.max(...boards.flatMap(part => part.positions.filter((_, i) => i % 3 === 2))) - Math.min(...boards.flatMap(part => part.positions.filter((_, i) => i % 3 === 2))));
const bounds = { min: [0, 1, 2].map(axis => Math.min(...parts.flatMap(part => part.positions.filter((_, i) => i % 3 === axis)))),
    max: [0, 1, 2].map(axis => Math.max(...parts.flatMap(part => part.positions.filter((_, i) => i % 3 === axis)))) };
assert(span > 1.4 && span < 1.6 && width > .35 && width < .5, 'Source deck dimensions differ');
const counts = { parts: parts.length, vertices: parts.reduce((sum, part) => sum + part.positions.length / 3, 0), triangles: parts.reduce((sum, part) => sum + part.indices.length / 3, 0) };
assert.deepEqual(counts, { parts: 33, vertices: 9465, triangles: 8568 });
const skin = { version: 1, source: { artifact: sourceArtifact, sha256: sourceSha256, id: sourceId }, scale, parts };
const expanded = Buffer.from(`${JSON.stringify(skin)}\n`), compressed = gzipSync(expanded, { level: 9 });
const profile = { version: 1, source: skin.source, scale, span, width, archHeight: .126, deckBaseY: stable(deckBaseY),
    deckRows: [{ x: deckRows[0].minX, y: deckRows[0].y }, ...deckRows.map(({ x, y }) => ({ x, y })), { x: deckRows.at(-1).maxX, y: deckRows.at(-1).y }],
    bounds, material: boards[0].material, counts,
    artifact: { path: `/${artifactPath}`, sha256: hash(compressed), expandedSha256: hash(expanded), bytes: expanded.length, gzipBytes: compressed.length } };
const output = `${JSON.stringify(profile)}\n`;
assert.equal(hash(await readFile(sourceUrl)), sourceSha256, 'Source changed during bridge extraction');
if (check) {
    assert.equal(await readFile(outputUrl, 'utf8'), output, 'Native bridge profile differs');
    assert.equal(hash(await readFile(artifactUrl)), hash(compressed), 'Native bridge artifact differs');
} else { await writeFile(outputUrl, output); await writeFile(artifactUrl, compressed); }
console.log(JSON.stringify({ mode: check ? 'check' : 'extract', profile: fileURLToPath(outputUrl), sourceUnchanged: true, span, width, deckBaseY, counts, artifact: profile.artifact }));

