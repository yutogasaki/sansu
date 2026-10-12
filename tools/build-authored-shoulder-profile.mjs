import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';

// Pure data extraction from the frozen source. Never writes source/docs or runs Blender.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source-root'), sourceRoot = sourceIndex >= 0 ? resolve(args[sourceIndex + 1]) : root;
if (sourceIndex >= 0 && !args[sourceIndex + 1] || args.some((arg, i) => arg !== '--check' && arg !== '--source-root' && !(sourceIndex >= 0 && i === sourceIndex + 1))) throw Error('Usage: node tools/build-authored-shoulder-profile.mjs [--check] [--source-root PATH]');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = path => readFile(resolve(sourceRoot, path));
const directory = 'docs/design/2026-10-12-authored-central-shoulder';
const handPath = 'docs/design/2026-10-12-authored-whole-massing/central-shoulder-feasibility/selected-v3-handoff.json.gz';
const [handBytes, geometryBytes, glb] = await Promise.all([read(handPath), read(`${directory}/geometry-profile.json.gz`), read(`${directory}/central-shoulder-components-normal-v2.glb`)]);
if (sha(handBytes) !== 'a5e947cf22a7a2ad02272902f5836da464f0f89630001eea4be95583103efdb8'
    || sha(geometryBytes) !== '7b4772489932b225d7b31ced5bd53c6835a47e8e63c71eeb43d7b59af1523d3b'
    || sha(glb) !== 'c79e2cd7a228b24ff526e6d78913f6a07880e35dec1532d4c278dd7cbf10411e') throw Error('Authored shoulder frozen source SHA differs');
const hand = JSON.parse(gunzipSync(handBytes)), geometry = JSON.parse(gunzipSync(geometryBytes));
const length = glb.readUInt32LE(12), gltf = JSON.parse(glb.subarray(20, 20 + length)), binary = glb.subarray(28 + length);
function vectors(index) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') throw Error('Expected raw Float32 source vectors');
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
    return Array.from({ length: accessor.count }, (_, i) => [0, 1, 2].map(k => binary.readFloatLE(start + i * stride + k * 4)));
}
const soilNode = gltf.nodes.find(node => node.name === 'Central shoulder / continuous closed supporting soil');
if (!soilNode || soilNode.matrix || soilNode.translation || soilNode.rotation || soilNode.scale) throw Error('Shoulder source must use identity authored coordinates');
const primitives = gltf.meshes[soilNode.mesh].primitives.slice(0, 2), normalMap = new Map();
for (const primitive of primitives) {
    const positions = vectors(primitive.attributes.POSITION), normals = vectors(primitive.attributes.NORMAL);
    positions.forEach((position, i) => {
        const key = position.join(','), previous = normalMap.get(key);
        if (previous && JSON.stringify(previous) !== JSON.stringify(normals[i])) throw Error('Source material seam normals differ');
        normalMap.set(key, normals[i]);
    });
}
const sourceFloor = hand.replacementDistrict.floors[0], district = structuredClone(hand.replacementDistrict), usedVertices = new Set(sourceFloor.indices);
const vertices = sourceFloor.vertices.map((vertex, index) => {
    const normal = normalMap.get([vertex.point.x, vertex.point.y, vertex.point.z].map(Math.fround).join(','));
    // Unindexed clip vertices have no source shading use. Preserve their geometry
    // and use the archived raw normal rather than inventing a direction.
    if (!normal && usedVertices.has(index)) throw Error('Indexed top vertex is absent from the frozen GLB');
    const raw = normal ?? geometry.newFloorAttributes.normals[index];
    if (!raw) throw Error('New floor normal is missing');
    return { ...vertex, normal: { x: raw[0], y: raw[1], z: raw[2] } };
});
district.floors = primitives.map((primitive, material) => {
    const id = `${sourceFloor.id}:${material}`, lineage = hand.triangleMaterialLineage.filter(item => item.sourceFloorId.endsWith(`:${material}`));
    const indices = lineage.flatMap(item => sourceFloor.indices.slice(item.triangle * 3, item.triangle * 3 + 3));
    const pbr = gltf.materials[primitive.material].pbrMetallicRoughness;
    return { ...sourceFloor, id, color: lineage[0].color, vertices, indices,
        material: { roughness: pbr.roughnessFactor, metalness: pbr.metallicFactor, doubleSided: gltf.materials[primitive.material].doubleSided ?? false } };
});
function contains(cell, floor) {
    for (let i = 0; i < floor.indices.length; i += 3) {
        const [a, b, c] = floor.indices.slice(i, i + 3).map(index => floor.vertices[index].cell);
        const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(denominator) <= 1e-12) continue;
        const u = ((b.z - c.z) * (cell.x - c.x) + (c.x - b.x) * (cell.z - c.z)) / denominator;
        const v = ((c.z - a.z) * (cell.x - c.x) + (a.x - c.x) * (cell.z - c.z)) / denominator;
        if (Math.min(u, v, 1 - u - v) >= -1e-7) return true;
    }
    return false;
}
district.sites = district.sites.map(site => {
    const floor = district.floors.find(floor => contains(site.cell, floor));
    if (!floor) throw Error(`Source site has no actual split-material floor: ${site.id}`);
    return { ...site, floorId: floor.id };
});
const require = createRequire(`${root}/package.json`), { build } = require('esbuild');
const compiled = await build({ stdin: { contents: `
export { authoredShoulderGroundRevision, authoredShoulderProfilePhysicalRevision } from './src/domain/growingIsland/authoredShoulderWorld.ts';
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
export { authoredWaterFrame } from './src/domain/growingIsland/authoredWaterFrame.ts';`, resolveDir: root }, write: false, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
const module = { exports: {} }; new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports);
const api = module.exports;
const nativeWorldBytes = await readFile(resolve(root, 'prototypes/place-qa/native05-world.json.gz'));
const referenceStateBytes = await readFile(resolve(root, 'prototypes/place-qa/authored-flower-reference-mature.json'));
const base = api.withNative05WaterCarvingScope(api.compileWorldDefinition(JSON.parse(gunzipSync(nativeWorldBytes))));
const state = JSON.parse(referenceStateBytes).state;
const water = api.authoredWaterFrame(state, base).world, localGround = { min: { x: 5.5, z: -7.4 }, max: { x: 9.5, z: -4.4 } };
const profile = { version: 1, candidate: geometry.candidate,
    source: { baseSha256: geometry.source.sha256, componentSha256: sha(glb), geometryProfileSha256: sha(geometryBytes) },
    localGround: { ...localGround, revision: api.authoredShoulderGroundRevision(water, localGround) },
    boundary: hand.boundary, sourceDistrictId: hand.sourceDistrictId, clipFloorIds: hand.clipSourceFloorIds,
    transferSiteIds: ['7,-6', '8,-6'], district, edges: hand.newEdges,
    triangleLineage: hand.triangleMaterialLineage.map(item => ({ sourceFloorId: item.sourceFloorId, sourceTriangle: item.sourceTriangle,
        targetFloorId: `${sourceFloor.id}:${item.sourceFloorId.endsWith(':0') ? 0 : 1}` })), physicalRevision: '' };
profile.physicalRevision = api.authoredShoulderProfilePhysicalRevision(profile);
const artifactPath = 'prototypes/place-qa/authored-shoulder-profile.json.gz', manifestPath = 'prototypes/place-qa/authored-shoulder-profile-manifest.json';
const artifact = resolve(root, artifactPath), expanded = Buffer.from(JSON.stringify(profile)), bytes = gzipSync(expanded, { level: 9, mtime: 0 });
const manifest = {
    version: 1, candidate: profile.candidate,
    artifact: { path: `/${artifactPath}`, sha256: sha(bytes), expandedSha256: sha(expanded), expandedBytes: expanded.length, gzipBytes: bytes.length },
    source: profile.source, physicalRevision: profile.physicalRevision, localGroundRevision: profile.localGround.revision,
    inputs: {
        handoff: { path: handPath, sha256: sha(handBytes) },
        geometryProfile: { path: `${directory}/geometry-profile.json.gz`, sha256: sha(geometryBytes) },
        components: { path: `${directory}/central-shoulder-components-normal-v2.glb`, sha256: sha(glb) },
        nativeWorld: { path: 'prototypes/place-qa/native05-world.json.gz', sha256: sha(nativeWorldBytes) },
        referenceState: { path: 'prototypes/place-qa/authored-flower-reference-mature.json', sha256: sha(referenceStateBytes) },
    },
    counts: { trianglesByMaterial: district.floors.map(floor => floor.indices.length / 3), sites: district.sites.length, addedRights: 2, addedWalkSites: 17, edges: profile.edges.length },
    scope: 'Explicit diagnostic terrain extension. Source double positions/indices and actual NORMAL-v2 Float32 attributes, no root geometry or owner lifecycle. Lazy-load only.',
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (args.includes('--check')) {
    if (!(await readFile(artifact)).equals(bytes) || !(await readFile(resolve(root, manifestPath))).equals(manifestBytes)) throw Error('Authored shoulder profile/manifest is stale');
} else { await writeFile(artifact, bytes); await writeFile(resolve(root, manifestPath), manifestBytes); }
console.log(JSON.stringify({ ...manifest.artifact, physicalRevision: profile.physicalRevision, localGroundRevision: profile.localGround.revision,
    ...manifest.counts, checked: args.includes('--check') }));
