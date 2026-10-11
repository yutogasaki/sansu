import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(root, '../2026-10-10-island-final-3d');
const sha = b => createHash('sha256').update(b).digest('hex');
function glb(file) {
    const bytes = fs.readFileSync(file), length = bytes.readUInt32LE(12);
    assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
    return { bytes, model: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) };
}
function data(g, index) {
    const a = g.model.accessors[index], v = g.model.bufferViews[a.bufferView];
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const width = components * size, offset = (v.byteOffset || 0) + (a.byteOffset || 0);
    const bytes = Buffer.alloc(a.count * width);
    for (let i = 0; i < a.count; i++) g.bin.copy(bytes, i * width, offset + i * (v.byteStride || width), offset + i * (v.byteStride || width) + width);
    return { ...a, bytes };
}
function imageHashes(g) {
    return (g.model.images || []).map(image => {
        const view = g.model.bufferViews[image.bufferView];
        return sha(g.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
    }).sort();
}
const original = glb(path.join(source, 'whole-island.glb'));
assert.equal(sha(original.bytes), '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
const art = JSON.parse(fs.readFileSync(path.join(root, 'art-manifest.json')));
const report = { sourceGlbSha256: sha(original.bytes), sourceBlendSha256: sha(fs.readFileSync(path.join(source, 'whole-island.blend'))), states: [], pass: false };
const sourceNodes = new Map(original.model.nodes.map(node => [node.name, node]));
for (const expected of art.states) {
    const g = glb(path.join(root, `${expected.stage}-island.glb`));
    assert.equal(sha(g.bytes), expected.sha256);
    assert.equal(report.sourceBlendSha256, expected.sourceBlendSha256);
    assert.deepEqual(imageHashes(g), imageHashes(original), 'Original patchwork textures must remain exact');
    let retainedHomes = 0, retainedFigureMeshes = 0, maxUvDelta = 0;
    for (const node of g.model.nodes) {
        if (node.mesh === undefined) continue;
        const old = sourceNodes.get(node.name);
        const home = expected.unchangedHouseGeometry.includes(node.name);
        const figure = node.extras?.art_assembly?.startsWith('figure:');
        if (!home && !figure) continue;
        assert(old, `Source identity missing for ${node.name}`);
        assert.deepEqual(node.rotation, old.rotation, `Rotation changed: ${node.name}`);
        assert.deepEqual(node.scale, old.scale, `Scale changed: ${node.name}`);
        const nowMesh = g.model.meshes[node.mesh], oldMesh = original.model.meshes[old.mesh];
        assert.equal(nowMesh.primitives.length, oldMesh.primitives.length);
        for (let i = 0; i < nowMesh.primitives.length; i++) {
            const now = nowMesh.primitives[i], before = oldMesh.primitives[i];
            for (const key of ['POSITION', 'NORMAL']) {
                assert.deepEqual(data(g, now.attributes[key]).bytes, data(original, before.attributes[key]).bytes,
                    `Authored source geometry changed: ${node.name}/${key}`);
            }
            const uv = now.attributes.TEXCOORD_0, oldUv = before.attributes.TEXCOORD_0;
            if (uv !== undefined && oldUv !== undefined) {
                const a = data(g, uv).bytes, b = data(original, oldUv).bytes;
                assert.equal(a.length, b.length);
                for (let j = 0; j < a.length; j += 4) {
                    const delta = Math.abs(a.readFloatLE(j) - b.readFloatLE(j));
                    if (figure) assert.equal(delta, 0, `Figure cloth UV changed: ${node.name}`);
                    else { maxUvDelta = Math.max(maxUvDelta, delta); assert(delta <= 1e-7, `Unused cottage UV changed: ${node.name}`); }
                }
            }
        }
        if (home) retainedHomes++; else retainedFigureMeshes++;
    }
    assert.equal(retainedHomes, expected.unchangedHouseGeometry.length);
    assert(retainedFigureMeshes > 0);
    assert(expected.springLevels[0][2] > 2.35, 'The young spring must feed the lower pool downhill');
    for (let i = 1; i < expected.riverCenterline.length; i++) assert(expected.riverCenterline[i][2] <= expected.riverCenterline[i - 1][2], 'The river must descend at every authored control point');
    assert.deepEqual(expected.landmarkAnchors.greatTree, [-4.8, 17]);
    assert.deepEqual(expected.landmarkAnchors.lowerSpring, [.95, 13.15]);
    if (expected.stage === 'young') assert.deepEqual(expected.landmarkAnchors.shellHall, [13.9, -1.2]);
    const materials = new Set(g.model.materials.map(m => m.name));
    for (const material of ['grove / living violet and jade lamina', 'water / mineral blue tiered springs', 'growth / living meadow colour']) assert(materials.has(material));
    report.states.push({ state: expected.stage, sha256: expected.sha256, bytes: expected.bytes, meshes: expected.meshes,
        triangles: expected.triangles, coastArea: expected.coastArea, referenceHouses: expected.houses,
        retainedHomeMeshes: retainedHomes, retainedFigureMeshes, homeGeometryExact: true, figureGeometryAndClothUvExact: true,
        unusedHomeUvMaxDelta: maxUvDelta, clothTextureBytesExact: true, downhillSpring: true, landmarkAnchors: expected.landmarkAnchors });
}
assert(report.states[0].coastArea < report.states[1].coastArea);
report.pass = true;
fs.writeFileSync(path.join(root, 'artifact-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
