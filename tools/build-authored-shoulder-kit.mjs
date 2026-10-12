import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { build } from 'esbuild';

// Never writes into the frozen source folder. Both locations are explicit so a
// diagnostic checkout can read the live source without following its docs link.
assert(process.argv.length === 6 && process.argv[2] === '--source-dir' && process.argv[4] === '--output',
    'Use --source-dir SOURCE_DIRECTORY --output OUTPUT_DIRECTORY');
const sourceFolder = path.resolve(process.argv[3]), output = path.resolve(process.argv[5]);
assert(output !== sourceFolder && !output.startsWith(`${sourceFolder}${path.sep}`), 'Output must not replace source evidence');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceName = 'central-shoulder-components-normal-v2.glb', source = await readFile(path.join(sourceFolder, sourceName));
const sourceSha256 = 'c79e2cd7a228b24ff526e6d78913f6a07880e35dec1532d4c278dd7cbf10411e';
assert.equal(hash(source), sourceSha256, 'Reviewed shoulder component source differs');
const inputPaths = ['scene-manifest.json', 'root-continuations-manifest.json', 'geometry-profile.json.gz', 'input/candidate-world.json.gz'];
const inputs = Object.fromEntries(await Promise.all(inputPaths.map(async name => [name, await readFile(path.join(sourceFolder, name))])));
const scene = JSON.parse(inputs['scene-manifest.json']), roots = JSON.parse(inputs['root-continuations-manifest.json']);
const profile = JSON.parse(gunzipSync(inputs['geometry-profile.json.gz'])), definition = JSON.parse(gunzipSync(inputs['input/candidate-world.json.gz']));
assert.equal(hash(inputs['root-continuations-manifest.json']), scene.artifacts['root-continuations-manifest.json'].sha256);
assert.equal(hash(inputs['geometry-profile.json.gz']), roots.profile.sha256);
assert.equal(hash(inputs['input/candidate-world.json.gz']), scene.world.sha256);
const jsonBytes = source.readUInt32LE(12), original = JSON.parse(source.subarray(20, 20 + jsonBytes)), binary = source.subarray(28 + jsonBytes);
assert.equal(original.nodes.length, 4); assert.equal(original.meshes.length, 4);
const model = { asset: { ...original.asset }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
const maps = { views: new Map(), accessors: new Map(), materials: new Map() }, chunks = []; let offset = 0;
const copyView = index => {
    if (maps.views.has(index)) return maps.views.get(index);
    const view = original.bufferViews[index]; assert.equal(view.buffer, 0);
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const next = model.bufferViews.length; maps.views.set(index, next);
    model.bufferViews.push({ ...view, buffer: 0, byteOffset: offset }); chunks.push(bytes); offset += bytes.length;
    const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } return next;
};
const copyAccessor = index => {
    if (maps.accessors.has(index)) return maps.accessors.get(index);
    const accessor = original.accessors[index]; assert(!accessor.sparse, 'Sparse source accessor is unsupported');
    const next = model.accessors.length; maps.accessors.set(index, next);
    model.accessors.push({ ...accessor, bufferView: copyView(accessor.bufferView) }); return next;
};
const copyMaterial = index => {
    if (maps.materials.has(index)) return maps.materials.get(index);
    const material = original.materials[index]; assert(!/Texture/.test(JSON.stringify(material)), 'Cannot omit a source texture');
    const next = model.materials.length; maps.materials.set(index, next); model.materials.push(material); return next;
};
const expected = [{ node: scene.terrain.node, primitive: 2, triangles: 8569 }, ...roots.roots.map(root => ({ node: root.node, primitive: 0, triangles: 36 }))];
for (const selected of expected) {
    const node = original.nodes.find(node => node.name === selected.node); assert(node && node.mesh !== undefined);
    assert(!node.children?.length && !node.matrix && !node.translation && !node.rotation && !node.scale, 'Components must remain authored-world identity nodes');
    const originalMesh = original.meshes[node.mesh], primitive = originalMesh.primitives[selected.primitive];
    assert.equal(original.accessors[primitive.indices].count / 3, selected.triangles);
    assert.deepEqual(Object.keys(primitive.attributes).sort(), ['NORMAL', 'POSITION']);
    model.scenes[0].nodes.push(model.nodes.length); model.nodes.push({ ...node, mesh: model.meshes.length });
    model.meshes.push({ ...originalMesh, primitives: [{ ...primitive,
        attributes: Object.fromEntries(Object.entries(primitive.attributes).map(([name, value]) => [name, copyAccessor(value)])),
        indices: copyAccessor(primitive.indices), material: copyMaterial(primitive.material) }] });
}
const rawBinary = Buffer.concat(chunks); model.buffers.push({ byteLength: rawBinary.length });
for (const [oldId, newId] of maps.views) {
    const old = original.bufferViews[oldId], next = model.bufferViews[newId];
    assert(binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength)
        .equals(rawBinary.subarray(next.byteOffset, next.byteOffset + next.byteLength)), 'Source attribute/index bytes changed');
}
const json = Buffer.from(JSON.stringify(model)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
const paddedBinary = Buffer.alloc(Math.ceil(rawBinary.length / 4) * 4); rawBinary.copy(paddedBinary);
const kit = Buffer.alloc(28 + padded.length + paddedBinary.length);
kit.write('glTF'); kit.writeUInt32LE(2, 4); kit.writeUInt32LE(kit.length, 8); kit.writeUInt32LE(padded.length, 12); kit.writeUInt32LE(0x4e4f534a, 16); padded.copy(kit, 20);
kit.writeUInt32LE(paddedBinary.length, 20 + padded.length); kit.writeUInt32LE(0x004e4942, 24 + padded.length); paddedBinary.copy(kit, 28 + padded.length);
const compressed = gzipSync(kit, { level: 9, mtime: 0 }); assert(compressed.length < 256 * 1024, 'Shoulder components exceed 256 KiB');

// Use the runtime's exact geometry canonicalization against the source final
// world. Source normal/material/floor IDs deliberately do not enter the hash.
const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { shoulderFloorFingerprint } from './src/components/island/growing/native/nativeAuthoredShoulder.ts';`, resolveDir: process.cwd() },
bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { compileWorldDefinition, shoulderFloorFingerprint } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const world = compileWorldDefinition(definition), districtId = scene.world.replacementDistrict;
const district = definition.districts.find(district => district.id === districtId); assert(district);
const topIds = new Set(district.floors.map(floor => JSON.stringify([districtId, floor.id]))), top = world.floors.filter(floor => topIds.has(floor.id));
assert.equal(top.reduce((n, floor) => n + floor.indices.length / 3, 0), 6615);
const manifest = {
    version: 1, source: { id: scene.candidate, sha256: sourceSha256, artifact: `docs/design/2026-10-12-authored-central-shoulder/${sourceName}` },
    artifact: { path: '/prototypes/place-qa/native-shoulder-components.glb.gz', sha256: hash(compressed), expandedSha256: hash(kit), expandedBytes: kit.length, gzipBytes: compressed.length },
    extension: { worldId: world.id, districtId, topFingerprint: shoulderFloorFingerprint(top), topTriangles: 6615 },
    soil: { node: expected[0].node, triangles: 8569 },
    roots: roots.roots.map(root => {
        const original = profile.rootContinuations.find(value => value.ownerId === root.diagnosticOwnerId); assert(original);
        const x = original.positions.map(point => point[0]), z = original.positions.map(point => point[2]);
        const bounds = { minX: Math.min(...x), maxX: Math.max(...x), minZ: Math.min(...z), maxZ: Math.max(...z) };
        const binding = root.binding;
        return { node: root.node, ownerId: root.diagnosticOwnerId, triangles: 36,
            binding: { cell: binding.ownerRecord.cell, sourcePart: binding.sourcePart, sourcePivot: binding.sourcePivot,
                sourceId: binding.sourceId, sourceSha256: binding.sourceSha256, kitExpandedSha256: binding.kitExpandedSha256, kitGzipSha256: binding.kitGzipSha256,
                authoredMatrixWorld: binding.authoredMatrixWorld, floorWorldId: binding.floorWorldId,
                localFloor: { ...bounds, fingerprint: shoulderFloorFingerprint(world.floors, bounds) } } };
    }),
    counts: { nodes: 4, primitives: 4, triangles: 8677, materials: 3 },
    excluded: { topPrimitives: [0, 1], topTriangles: 6615, reason: 'Common world floors render and hit the top once. Only source primitive 2 closes the soil.' },
    limits: ['Soil is omitted when water carving or another change alters the source shoulder top union.',
        'Roots require unchanged actual tree/source identity/full matrix/cell and local physical floor; timestamps are not geometry.',
        'No new owner, floor, placement or walk grant; no full-source/background model.'],
    inputs: Object.fromEntries(Object.entries(inputs).map(([name, bytes]) => [name, hash(bytes)])),
};
assert.equal(hash(await readFile(path.join(sourceFolder, sourceName))), sourceSha256, 'Source changed during extraction');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'native-shoulder-components.glb.gz'), compressed);
await writeFile(path.join(output, 'native-shoulder-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({ output, artifact: manifest.artifact, counts: manifest.counts, extension: manifest.extension,
    roots: manifest.roots.map(root => ({ id: root.ownerId, floor: root.binding.localFloor.fingerprint })) }, null, 2) + '\n');
