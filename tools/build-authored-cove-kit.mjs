import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Lossless delivery of the reviewed shell. This deliberately does not export
// the combined apron, simplify primitives, or run the original scene builder.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = 'docs/design/2026-10-12-authored-cove-entrance';
const sourcePath = `${directory}/cove-corner-v3.glb`;
const profilePath = `${directory}/profile-boundaries.json`;
const sourceManifestPath = `${directory}/source-manifest.json`;
const artifactPath = 'prototypes/place-qa/native-cove-corner.glb.gz';
const manifestPath = `${directory}/cove-delivery-manifest.json`;
const expectedSha256 = 'f08ada4907c76a617e2c22090049b9b2880dde2d75fa11ad61f6e76c7eec7146';
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const read = path => readFile(resolve(root, path));
if (process.argv.slice(2).some(argument => argument !== '--check')) fail('Usage: node tools/build-authored-cove-kit.mjs [--check]');
const [bytes, profileBytes, sourceManifestBytes] = await Promise.all([read(sourcePath), read(profilePath), read(sourceManifestPath)]);
const profile = JSON.parse(profileBytes), sourceManifest = JSON.parse(sourceManifestBytes);
if (sha(bytes) !== expectedSha256 || profile.sourceGLBSha256 !== expectedSha256
    || sourceManifest.outputs['cove-corner-v3.glb'] !== expectedSha256) fail('Authored cove source hash differs');
if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length
    || bytes.readUInt32LE(16) !== 0x4e4f534a) fail('Authored cove source is not a complete GLB v2');
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
if (gltf.buffers.length !== 1 || gltf.buffers[0].uri || gltf.images?.length || gltf.textures?.length
    || gltf.animations?.length || gltf.skins?.length) fail('Authored cove must be a self-contained static shell');
const nodes = gltf.nodes.map(node => {
    if (node.mesh === undefined || node.children?.length) fail('Unexpected non-shell source node');
    return {
        name: node.name,
        primitives: gltf.meshes[node.mesh].primitives.map(primitive => {
            if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined
                || primitive.attributes.POSITION === undefined || primitive.attributes.NORMAL === undefined)
                fail('Authored cove requires indexed triangles and source normals');
            return { material: gltf.materials[primitive.material].name, triangles: gltf.accessors[primitive.indices].count / 3 };
        }),
    };
});
const expectedNodes = profile.nodes.map(({ name, primitives }) => ({ name, primitives }));
if (JSON.stringify(nodes) !== JSON.stringify(expectedNodes) || JSON.stringify(gltf.materials) !== JSON.stringify(profile.materials))
    fail('Authored cove geometry/material boundary differs from its reviewed profile');
const primitiveCount = nodes.reduce((total, node) => total + node.primitives.length, 0);
const triangleCount = nodes.reduce((total, node) => total + node.primitives.reduce((sum, primitive) => sum + primitive.triangles, 0), 0);
if (nodes.length !== 18 || primitiveCount !== 19 || triangleCount !== 79384 || gltf.materials.length !== 4)
    fail('Authored cove source counts differ');
const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
const manifest = {
    version: 1,
    source: { id: profile.candidate, sha256: expectedSha256, artifact: sourcePath },
    artifact: { path: `/${artifactPath}`, sha256: sha(compressed), expandedSha256: sha(bytes), expandedBytes: bytes.length, gzipBytes: compressed.length },
    counts: { nodes: nodes.length, primitives: primitiveCount, triangles: triangleCount, materials: gltf.materials.length },
    coordinateContract: {
        source: 'original native GLTF coordinates; source node transforms are baked before instancing',
        pivot: profile.coordinateContract.sourcePivot,
        uniformScale: profile.coordinateContract.uniformScale,
        authoredFormula: 'world = position + rotateY(yaw, uniformScale * (source - pivot))',
        rendererOffset: 'X -= layout.center; Z -= 2; Y unchanged',
    },
    nodes,
    materialNames: gltf.materials.map(material => material.name),
    provenance: {
        profile: { path: profilePath, sha256: sha(profileBytes) },
        sourceManifest: { path: sourceManifestPath, sha256: sha(sourceManifestBytes) },
        originalSource: { path: 'docs/design/2026-10-10-island-final-3d/whole-island.glb', sha256: sourceManifest.original_hashes['whole-island.glb'] },
        delivery: 'Byte-identical shell-only GLB expanded from deterministic gzip; no geometry or material rewrite.',
        floor: 'No apron or bank in this artifact. The composed WorldDefinition owns and draws its visible floor/bank once.',
        feasibility: 'Fixed audited P04 arrangement only; domain plan determines eligibility and apron lifecycle.',
    },
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (process.argv.includes('--check')) {
    const [savedArtifact, savedManifest] = await Promise.all([read(artifactPath), read(manifestPath)]);
    if (!savedArtifact.equals(compressed) || !savedManifest.equals(manifestBytes)) fail('Authored cove delivery is stale; run the builder without --check');
    console.log(`Authored cove delivery check PASS: ${nodes.length} nodes, ${primitiveCount} primitives, ${triangleCount} triangles; ${compressed.length} gzip bytes`);
} else {
    await writeFile(resolve(root, artifactPath), compressed);
    await writeFile(resolve(root, manifestPath), manifestBytes);
    console.log(`Authored cove delivery written: ${artifactPath}; ${compressed.length} gzip bytes`);
}
