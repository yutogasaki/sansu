import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

assert(process.argv.length === 6 && process.argv[2] === '--source-dir' && process.argv[4] === '--output',
    'Use --source-dir V5_BUILD_DIRECTORY --output OUTPUT_DIRECTORY');
const sourceDir = path.resolve(process.argv[3]), output = path.resolve(process.argv[5]);
assert(output !== sourceDir && !output.startsWith(`${sourceDir}${path.sep}`), 'Do not overwrite frozen source');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = {
    component: path.join(sourceDir, 'runs/01-coarse-build/owner-use-components.glb'),
    profile: path.join(sourceDir, 'runs/01-coarse-build/owner-use-profile.json'),
    study: path.join(sourceDir, 'study.json'),
    native: path.resolve('docs/design/2026-10-11-native-owned-island/kit-manifest.json'),
};
const bytes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readFile(file)])));
assert.equal(hash(bytes.component), 'e7a8c6dee084c11c199b50b31798b3a8fcf33215252de375d03342da82807919');
const study = JSON.parse(bytes.study), profile = JSON.parse(bytes.profile), native = JSON.parse(bytes.native);
assert.deepEqual(profile.ownerIds, study.place.ownerIds); assert.equal(profile.placeId, study.place.id);
assert.deepEqual(profile.sourceTransformProvenance, study.transform); assert.equal(study.transform.scale, .45);
assert.equal(native.sourceSha256, '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
const jsonLength = bytes.component.readUInt32LE(12), model = JSON.parse(bytes.component.subarray(20, 20 + jsonLength));
assert.equal(model.nodes.length, 39); assert.equal(model.meshes.length, 39); assert.equal(model.materials.length, 2);
const names = new Set(), parts = model.nodes.map(node => {
    assert(!names.has(node.name)); names.add(node.name);
    assert(!node.children?.length && !node.matrix && !node.translation && !node.rotation && !node.scale);
    assert(/^(solid-body|solid-bough|solid-rail-post|solid-rail|walk-top)\//.test(node.name), 'Unexpected source context');
    assert.deepEqual(node.extras.ownerIds, profile.ownerIds); assert.equal(node.extras.placeId, profile.placeId);
    assert.equal(node.extras.sourceSha256, native.sourceSha256);
    const primitives = model.meshes[node.mesh].primitives.map(primitive => {
        assert.equal(primitive.mode ?? 4, 4); assert.deepEqual(Object.keys(primitive.attributes).sort(), ['NORMAL', 'POSITION']);
        return { triangles: model.accessors[primitive.indices].count / 3, material: model.materials[primitive.material].name };
    });
    assert.equal(primitives.length, 1);
    return { name: node.name, sourceRole: node.extras.useFloorRole, primitives };
});
const count = prefix => parts.filter(part => part.name.startsWith(prefix)).length;
assert.deepEqual([count('solid-body/'), count('solid-bough/'), count('solid-rail/'), count('solid-rail-post/'), count('walk-top/')], [5, 6, 3, 20, 5]);
const triangles = parts.reduce((sum, part) => sum + part.primitives.reduce((n, primitive) => n + primitive.triangles, 0), 0);
assert.equal(triangles, 10220);
const compressed = gzipSync(bytes.component, { level: 9, mtime: 0 });
assert(gunzipSync(compressed).equals(bytes.component), 'Every original GLB byte must survive');
assert(compressed.length < 256 * 1024, 'Gallery coarse kit exceeds 256 KiB');
const manifest = {
    version: 1,
    source: { id: study.candidate, sha256: hash(bytes.component), artifact: path.relative(process.cwd(), files.component) },
    artifact: { path: '/prototypes/place-qa/native-gallery-v5.glb.gz', sha256: hash(compressed), expandedSha256: hash(bytes.component), expandedBytes: bytes.component.length, gzipBytes: compressed.length },
    counts: { nodes: parts.length, primitives: parts.length, triangles, materials: model.materials.length },
    nodes: parts, materialNames: model.materials.map(material => material.name),
    binding: {
        placeId: profile.placeId,
        owners: study.place.ownerIds.map((id, i) => ({ id, cell: { x: study.place.supportCells[i][0], z: study.place.supportCells[i][1] } })),
        nativeKit: { candidate: native.candidate, sourceSha256: native.sourceSha256, sha256: native.sha256, gzipSha256: native.gzipSha256 },
        authoredOrigin: study.transform.authoredOrigin, sourcePivot: study.transform.sourceGltfPivot,
        sourceScale: study.transform.scale, crownLocalY: study.transform.fanLocalY,
    },
    coordinateContract: 'GLB already contains authored Y-up physical XYZ; apply only [-layout.center, 0, -2]. Do not reapply native pivot or .45 scale.',
    role: 'visible-owner-structure-and-obstruction-only',
    defaultGroundExcluded: true, galleryTraversalEnabled: false,
    limitations: ['Source visual/runtime HOLD remains; this is coarse whole-island presentation, not accepted stair traversal.',
        'Fixed original four-owner placement and actual native shared trunk/crown transform only.',
        'No default ground, placement right, upper walking route or use receipt is supplied.',
        'All 39 source components retain original attributes, indices, PBR and Float32 lineage; original source context is excluded.'],
    inputs: Object.fromEntries(Object.entries(files).map(([key, file]) => [path.relative(process.cwd(), file), hash(bytes[key])])),
};
for (const [key, file] of Object.entries(files)) assert.equal(hash(await readFile(file)), hash(bytes[key]), 'Input changed');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'native-gallery-v5.glb.gz'), compressed);
await writeFile(path.join(output, 'native-gallery-v5-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ artifact: manifest.artifact, counts: manifest.counts, role: manifest.role }, null, 2));
