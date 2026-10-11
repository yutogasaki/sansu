import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as T from 'three';

// Extract only approved geometry. This tool never runs Blender or edits its input.
const sourceArtifact = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const sourceSha256 = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const root = new URL('../', import.meta.url);
const sourceUrl = new URL(sourceArtifact, root);
const outputUrl = new URL('src/domain/growingIsland/nativeWaterSource.json', root);
const scale = .45;
const stable = value => {
    assert(Number.isFinite(value), 'Non-finite source value');
    return Math.round(value * 1e8) / 1e8 || 0;
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--check'), 'Use node tools/extract-native-water-profile.mjs [--check]');
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

function namedMesh(name) {
    const matches = gltf.nodes.map((node, index) => ({ node, index })).filter(({ node }) => node.name === name);
    assert.equal(matches.length, 1, `Expected one source mesh: ${name}`);
    const { node, index } = matches[0];
    assert(node.mesh !== undefined && matrices.has(index), `Source mesh is outside the active scene: ${name}`);
    return { node, primitives: gltf.meshes[node.mesh].primitives, matrix: matrices.get(index) };
}

function geometry(primitive, matrix) {
    assert.equal(primitive.mode ?? 4, 4, 'Expected source triangles');
    const vertices = accessor(primitive.attributes.POSITION, 'VEC3').map(values => new T.Vector3().fromArray(values).applyMatrix4(matrix));
    const indices = accessor(primitive.indices, 'SCALAR').flat();
    assert(indices.length % 3 === 0 && indices.every(index => Number.isInteger(index) && index >= 0 && index < vertices.length), 'Invalid source triangle indices');
    assert(vertices.every(point => [point.x, point.y, point.z].every(Number.isFinite)), 'Invalid transformed source geometry');
    return { vertices, indices };
}

function boundaryLoop(indices, vertexCount) {
    const edges = new Map(), neighbours = Array.from({ length: vertexCount }, () => new Set());
    for (let i = 0; i < indices.length; i += 3) for (let side = 0; side < 3; side++) {
        const a = indices[i + side], b = indices[i + (side + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const edge = edges.get(key) ?? { count: 0, a, b }; edge.count++; edges.set(key, edge);
        neighbours[a].add(b); neighbours[b].add(a);
    }
    assert([...edges.values()].every(edge => edge.count <= 2), 'Source water is non-manifold');
    const boundary = [...edges.values()].filter(edge => edge.count === 1), next = new Map();
    assert.equal(boundary.length, 72, 'Expected the source outer 72-point water ring');
    for (const edge of boundary) { assert(!next.has(edge.a), 'Source boundary branches'); next.set(edge.a, edge.b); }
    const start = Math.min(...next.keys()), loop = [], used = new Set();
    let index = start;
    do { assert(next.has(index) && !used.has(index), 'Source boundary is open or repeated'); used.add(index); loop.push(index); index = next.get(index); } while (index !== start);
    assert.equal(loop.length, boundary.length, 'Source water has more than one boundary');
    const centers = neighbours.map((set, index) => ({ count: set.size, index })).filter(item => item.count === 72);
    assert.equal(centers.length, 1, 'Expected the source central fan vertex');
    return { loop, centerIndex: centers[0].index };
}

function colorHex(values) {
    assert(values.length >= 3 && values.slice(0, 3).every(value => Number.isFinite(value) && value >= 0 && value <= 1), 'Invalid source linear colour');
    return `#${new T.Color().fromArray(values).getHexString()}`;
}
function material(index, name) {
    const sourceMaterial = gltf.materials[index];
    assert.equal(sourceMaterial.name, name, 'Source material identity differs');
    assert(!/Texture/.test(JSON.stringify(sourceMaterial)), 'Unexpected source texture');
    assert.equal(sourceMaterial.alphaMode ?? 'OPAQUE', 'OPAQUE', 'Expected an opaque source material');
    const pbr = sourceMaterial.pbrMetallicRoughness;
    const roughness = stable(pbr.roughnessFactor ?? 1), metalness = stable(pbr.metallicFactor ?? 1);
    assert(roughness >= 0 && roughness <= 1 && metalness >= 0 && metalness <= 1, 'Invalid source material factors');
    assert.equal((pbr.baseColorFactor ?? [1, 1, 1, 1])[3], 1, 'Expected full source opacity');
    return { color: colorHex(pbr.baseColorFactor ?? [1, 1, 1, 1]), roughness, metalness };
}

const authoredBasins = [
    { role: 'upper', x: 4.35, z: -18.2, waterY: 5.42 },
    { role: 'middle', x: 2.55, z: -15.95, waterY: 4.76 },
    { role: 'lower', x: .95, z: -13.15, waterY: 3.74 },
];
let water;
const pools = authoredBasins.map((basin, serial) => {
    const sourceMesh = namedMesh(`Ocean / joined terrace pool ${serial + 1}`);
    assert.equal(sourceMesh.primitives.length, 1, 'Expected one source water primitive');
    const primitive = sourceMesh.primitives[0];
    assert.equal(gltf.materials[primitive.material].name, 'water / mineral blue tiered springs');
    const { vertices, indices } = geometry(primitive, sourceMesh.matrix);
    const { loop, centerIndex } = boundaryLoop(indices, vertices.length), center = vertices[centerIndex];
    assert(Math.abs(center.x - basin.x) < 1e-6 && Math.abs(center.z - basin.z) < 1e-6 && Math.abs(center.y - basin.waterY) < 1e-6, 'Source pool centre differs');
    const outline = loop.map(index => ({ x: stable((vertices[index].x - center.x) * scale), z: stable((vertices[index].z - center.z) * scale) }));
    const signedArea = outline.reduce((sum, point, index) => { const next = outline[(index + 1) % outline.length]; return sum + point.x * next.z - next.x * point.z; }, 0) / 2;
    assert(signedArea < -.5 && outline.every(point => Math.abs(point.x) < 1 && Math.abs(point.z) < 1), 'Invalid source water outline extent or winding');
    const colors = accessor(primitive.attributes.COLOR_0, 'VEC3');
    assert.equal(colors.length, vertices.length, 'Source water colours differ from geometry');
    const candidate = { deepColor: colorHex(colors[centerIndex]), shoreColor: colorHex(colors[loop[0]]) };
    assert(loop.every(index => colorHex(colors[index]) === candidate.shoreColor), 'Source shore colours differ');
    if (water) assert.deepEqual(candidate, water, 'Source pools have different depth palettes');
    water = candidate;
    return { role: basin.role, outline, radiusX: stable(Math.max(...outline.map(point => Math.abs(point.x)))), radiusZ: stable(Math.max(...outline.map(point => Math.abs(point.z)))) };
});

// Native-04/05's four authored ring ratios and heights, relative to the .875
// water ring. The GLB verifies the four actual levels; .45 is already baked.
const authoredRings = [{ scale: 1.05, height: -.51 }, { scale: .99, height: .095 }, { scale: .88, height: .07 }, { scale: .83, height: -.24 }];
let rimMaterials;
for (const [serial, basin] of authoredBasins.entries()) {
    const mesh = namedMesh(`Hill / open water terrace ${serial + 1}`);
    assert.equal(mesh.primitives.length, 2, 'Expected source body and lip primitives');
    const vertices = mesh.primitives.flatMap(primitive => geometry(primitive, mesh.matrix).vertices);
    const levels = new Set(vertices.map(point => stable(point.y)));
    assert.equal(levels.size, 4, 'Expected four source rim levels');
    const rings = authoredRings.map(ring => {
        const points = vertices.filter(point => Math.abs(point.y - basin.waterY - ring.height) < 1e-6);
        const unique = new Map(points.map(point => [`${stable(point.x)}:${stable(point.z)}`, point]));
        assert.equal(unique.size, 96, 'Expected a full 96-point source rim ring');
        const expectedRadius = Math.hypot(pools[serial].radiusX, pools[serial].radiusZ) * ring.scale / .875;
        assert(points.every(point => Math.hypot(point.x - basin.x, point.z - basin.z) * scale < expectedRadius * 1.04), 'Source rim exceeds its profile bounds');
        return [...unique.values()].sort((a, b) => Math.atan2(a.z - basin.z, a.x - basin.x) - Math.atan2(b.z - basin.z, b.x - basin.x));
    });
    // Check the actual proportional rings, including native05's mineral noise,
    // instead of treating nominal radii as proof of the exported mesh shape.
    // Float32 source Z positions near 20 have a 1.9e-6 ULP; subtracting the
    // authored centre and dividing the smaller ring can differ by 3.91e-6.
    for (let ring = 1; ring < rings.length; ring++) for (let index = 0; index < 96; index++) {
        const reference = rings[0][index], point = rings[ring][index];
        for (const axis of ['x', 'z']) assert(Math.abs((point[axis] - basin[axis]) / authoredRings[ring].scale
            - (reference[axis] - basin[axis]) / authoredRings[0].scale) < 5e-6, 'Source rim proportions differ');
    }
    const candidate = {
        body: material(mesh.primitives[0].material, 'garden / porcelain water terraces'),
        lip: material(mesh.primitives[1].material, 'garden / pearl terrace lip'),
    };
    if (rimMaterials) assert.deepEqual(candidate, rimMaterials, 'Source rim palettes differ');
    assert.equal(candidate.body.metalness, 0, 'Source rim body metalness differs');
    assert.equal(candidate.lip.metalness, 0, 'Source rim lip metalness differs');
    rimMaterials = candidate;
}
const rim = { rings: authoredRings.map(ring => ({ scale: stable(ring.scale / .875), height: stable(ring.height * scale) })),
    body: { color: rimMaterials.body.color, roughness: rimMaterials.body.roughness },
    lip: { color: rimMaterials.lip.color, roughness: rimMaterials.lip.roughness } };

const pivot = { x: 4.35, y: 5.26, z: -19.18 }, pivotVector = new T.Vector3(pivot.x, pivot.y, pivot.z);
const grottoMesh = namedMesh('Hill / grown mineral headwater grotto');
assert.equal(grottoMesh.primitives.length, 3, 'Expected the three source mineral faces');
const materialNames = ['spring / mineral violet outer face', 'spring / mineral blue inner face', 'spring / warm lilac seams'];
const grotto = { pivot, primitives: grottoMesh.primitives.map((primitive, serial) => {
    const sourceGeometry = geometry(primitive, grottoMesh.matrix);
    const vertices = sourceGeometry.vertices.map(point => {
        const local = point.clone().sub(pivotVector).multiplyScalar(scale);
        return { x: stable(local.x), y: stable(local.y), z: stable(local.z) };
    });
    assert(vertices.every(point => Math.abs(point.x) < .7 && point.y >= -1e-6 && point.y < .7 && Math.abs(point.z) < .3), 'Source grotto exceeds expected local bounds');
    return { vertices, indices: sourceGeometry.indices, material: material(primitive.material, materialNames[serial]) };
}) };
assert.equal(grotto.primitives.reduce((sum, primitive) => sum + primitive.indices.length / 3, 0), 116, 'Source grotto triangles differ');
const profile = { version: 1, source: { artifact: sourceArtifact, sha256: sourceSha256 }, scale, pools, rim, water, grotto };
const output = `${JSON.stringify(profile)}\n`;
assert.equal(hash(await readFile(sourceUrl)), sourceSha256, 'Source changed during extraction');
if (check) assert.equal(await readFile(outputUrl, 'utf8'), output, 'Native water profile differs; run extraction to update it');
else await writeFile(outputUrl, output);
console.log(JSON.stringify({ mode: check ? 'check' : 'extract', output: fileURLToPath(outputUrl), bytes: Buffer.byteLength(output), sha256: hash(output),
    sourceSha256, sourceUnchanged: true, pools: pools.map(pool => ({ role: pool.role, outline: pool.outline.length })), rimRings: rim.rings.length,
    grottoPrimitives: grotto.primitives.length, grottoVertices: grotto.primitives.map(primitive => primitive.vertices.length), grottoTriangles: 116 }));
