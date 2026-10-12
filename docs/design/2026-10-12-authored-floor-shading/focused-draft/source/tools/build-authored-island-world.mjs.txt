import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import * as T from 'three';

assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output NEW_DIRECTORY');
const output = path.resolve(process.argv[3]);
const sourcePath = 'docs/design/2026-10-10-island-final-3d/whole-island.glb';
const sourceSha = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(sourcePath); assert.equal(hash(source), sourceSha, 'Approved native05 source differs');
const size = source.readUInt32LE(12), gltf = JSON.parse(source.subarray(20, size + 20)), binary = source.subarray(28 + size);
const names = new Set(['Island / continuous sculpted mature terrain', 'Grove / rounded living terrace', 'Garden / rounded flower terrace',
    'Village / shared sunny court', 'Grove / sheltered open room', 'Flowers / open sky gathering court', 'Harbor / shared waterfront court', 'Water town / shared frontage court']);
const matrices = new Map();
const visit = (index, parent) => {
    const node = gltf.nodes[index], local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
        new T.Vector3().fromArray(node.translation ?? [0, 0, 0]), new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
    const matrix = parent.clone().multiply(local); matrices.set(index, matrix);
    for (const child of node.children ?? []) visit(child, matrix);
};
for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, new T.Matrix4());
function accessor(index, components) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    assert(!a.sparse && view.buffer === 0, 'Unsupported source accessor');
    const formats = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] };
    const [width, read] = formats[a.componentType] ?? []; assert(width, 'Unsupported source component');
    const stride = view.byteStride ?? width * components, offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: components }, (_, j) => binary[read](offset + i * stride + j * width)));
}
// A source home is about 2.2 units wide: .45 makes its real footprint one
// placement unit. Keep this scale shared by the forthcoming owned art renderer.
const scale = .45, origin = { x: 2.5 - (-7 * scale), z: .5 - (3.4 * scale), y: -.81 * scale };
const stable = n => Math.round(n * 1e9) / 1e9 || 0;
const floors = [], extraction = [];
for (const [index, node] of gltf.nodes.entries()) {
    if (!names.has(node.name)) continue;
    assert(matrices.has(index), 'Source floor is outside the active scene');
    for (const [serial, primitive] of gltf.meshes[node.mesh].primitives.entries()) {
        assert((primitive.mode ?? 4) === 4, 'Floor primitive must be triangles');
        const points = accessor(primitive.attributes.POSITION, 3).map(values => {
            const point = new T.Vector3().fromArray(values).applyMatrix4(matrices.get(index)).multiplyScalar(scale);
            return { x: stable(point.x + origin.x), y: stable(point.y + origin.y), z: stable(point.z + origin.z) };
        });
        const normalMatrix = new T.Matrix3().getNormalMatrix(matrices.get(index));
        const normals = accessor(primitive.attributes.NORMAL, 3).map(values => {
            const normal = new T.Vector3().fromArray(values).applyMatrix3(normalMatrix);
            assert(normal.toArray().every(Number.isFinite) && normal.lengthSq() > 1e-24, 'Invalid source floor normal');
            return { x: normal.x, y: normal.y, z: normal.z };
        });
        assert.equal(normals.length, points.length, 'Source floor normals differ from vertices');
        const originalIndices = accessor(primitive.indices, 1).flat(), indices = [];
        for (let i = 0; i < originalIndices.length; i += 3) {
            const [a, b, c] = originalIndices.slice(i, i + 3).map(id => points[id]);
            // Vertical banks remain visual skin. Only real upward-facing surfaces
            // enter the floor evaluator; no convex hull or rectangle fills an inlet.
            const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
            if (normalY > 1e-12) indices.push(...originalIndices.slice(i, i + 3));
        }
        if (!indices.length) continue;
        const sourceMaterial = gltf.materials[primitive.material], pbr = sourceMaterial.pbrMetallicRoughness;
        const color = new T.Color().fromArray(pbr.baseColorFactor).getHexString();
        floors.push({ id: `${node.name}:${serial}`, kind: 'ground', color: `#${color}`,
            vertices: points.map((point, i) => ({ cell: { x: point.x, z: point.z }, point, normal: normals[i] })), indices,
            material: { roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 1, doubleSided: sourceMaterial.doubleSided === true } });
        extraction.push({ name: node.name, primitive: serial, material: gltf.materials[primitive.material].name,
            sourceTriangles: originalIndices.length / 3, floorTriangles: indices.length / 3, vertices: points.length });
    }
}
assert.equal(new Set(extraction.map(item => item.name)).size, names.size, 'A required native05 floor was omitted');
const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const { compileWorldDefinition } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const districtId = 'native05-inlet-core', definition = { version: 1, id: 'native05-authored-world-m0-v2', source: { artifact: sourcePath, sha256: sourceSha },
    revision: `native05-source-shading-v1:${hash(Buffer.from(JSON.stringify(floors.map(floor => [floor.id, floor.vertices.map(vertex => vertex.normal), floor.material]))))}`,
    districts: [{ id: districtId, templateId: 'native05-inlet-core-v1', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0, floors, sites: [], ports: [] }], edges: [] };
const floorWorld = compileWorldDefinition(definition), district = definition.districts[0];
const cellKey = cell => `${cell.x},${cell.z}`;
const walkStep = .25;
for (let zi = Math.ceil(floorWorld.bounds.min.z / walkStep); zi <= Math.floor(floorWorld.bounds.max.z / walkStep); zi++) {
    for (let xi = Math.ceil(floorWorld.bounds.min.x / walkStep); xi <= Math.floor(floorWorld.bounds.max.x / walkStep); xi++) {
        const x = xi * walkStep, z = zi * walkStep;
        const center = floorWorld.floorAt({ x, z }); if (!center) continue;
        // A planting site needs its actual footprint, including a small dry door
        // band. Sampling rejects thin shores and high steps, rather than adding land.
        const fits = Number.isInteger(x) && Number.isInteger(z) && [-.46, 0, .46].every(dx => [-.46, 0, .46].every(dz => {
            const floor = floorWorld.floorAt({ x: x + dx, z: z + dz }); return floor && Math.abs(floor.point.y - center.point.y) <= .28;
        }));
        const walkable = [-.12, 0, .12].every(dx => [-.12, 0, .12].every(dz => {
            const floor = floorWorld.floorAt({ x: x + dx, z: z + dz }); return floor && Math.abs(floor.point.y - center.point.y) <= .2;
        }));
        if (!fits && !walkable) continue;
        const floorId = JSON.parse(center.floorId)[1];
        district.sites.push({ id: cellKey({ x, z }), cell: { x, z }, floorId, placement: fits });
    }
}
const sites = new Map(district.sites.map(site => [site.id, site]));
const addEdge = (site, other, allows) => definition.edges.push({ from: { districtId, siteId: site.id }, to: { districtId, siteId: other.id }, allows });
for (const site of district.sites) for (const d of [{ x: walkStep, z: 0 }, { x: 0, z: walkStep }]) {
    const other = sites.get(cellKey({ x: site.cell.x + d.x, z: site.cell.z + d.z })); if (!other) continue;
    let previous, safe = true;
    for (let i = 0; i <= 8; i++) for (const side of [-.12, 0, .12]) {
        const floor = floorWorld.floorAt({ x: site.cell.x + d.x * i / 8 - d.z / walkStep * side, z: site.cell.z + d.z * i / 8 + d.x / walkStep * side });
        if (!floor || side === 0 && previous !== undefined && Math.abs(floor.point.y - previous) > .25) safe = false;
        if (side === 0 && floor) previous = floor.point.y;
    }
    if (safe) addEdge(site, other, ['walk']);
}
for (const site of district.sites.filter(site => site.placement)) for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
    const other = sites.get(cellKey({ x: site.cell.x + d.x, z: site.cell.z + d.z }));
    if (other?.placement) addEdge(site, other, ['join', 'water']);
}
const world = compileWorldDefinition(definition);
for (const cell of [{ x: 2, z: 0 }, { x: 3, z: 0 }, { x: 2, z: 1 }]) {
    assert(world.owns(cell), `Original cottage site is not owned: ${cellKey(cell)} ${JSON.stringify([-.46, 0, .46].flatMap(dx => [-.46, 0, .46].map(dz => ({ dx, dz, y: floorWorld.floorAt({ x: cell.x + dx, z: cell.z + dz })?.point.y }))))}`);
}
const open = new Set(world.sites.map(site => cellKey(site.cell))), home = { x: 2, z: 1 };
const queue = [home], seen = new Set([cellKey(home)]);
for (let i = 0; i < queue.length; i++) for (const cell of world.neighbors(queue[i])) {
    const id = cellKey(cell); if (!open.has(id) || seen.has(id)) continue; seen.add(id); queue.push(cell);
}
const plantingSites = world.sites.filter(site => site.placement), reachable = plantingSites.filter(site => seen.has(cellKey(site.cell)));
const missing = plantingSites.filter(site => !seen.has(cellKey(site.cell)));
const bytes = Buffer.from(JSON.stringify(definition)), compressed = gzipSync(bytes, { level: 9 });
const sourceFiles = [...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>' && !file.startsWith('node_modules/')),
    'tools/build-authored-island-world.mjs', 'src/domain/growingIsland/worldTypes.ts', 'package-lock.json'].sort();
const inputs = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(file))])));
const manifest = { candidate: definition.id, stage: 'M0-foundation', source: definition.source, transform: { scale, origin },
    artifact: { file: 'native05-world.json.gz', bytes: compressed.length, sha256: hash(compressed), expandedBytes: bytes.length, expandedSha256: hash(bytes) },
    inputs, extraction, sites: plantingSites.length, walkingPoints: world.sites.length - plantingSites.length, reachableFromHome: reachable.length, isolatedSites: missing.map(site => site.ref.siteId),
    edges: definition.edges.length, bounds: world.bounds,
    scope: 'Actual native05 floor triangles and explicit diagnostic placement sites. No owner save, gameplay integration, art acceptance, earned acquisition or release claim.' };
await mkdir(output, { recursive: false });
await writeFile(path.join(output, manifest.artifact.file), compressed);
await writeFile(path.join(output, 'world-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ candidate: manifest.candidate, floorTriangles: extraction.reduce((n, item) => n + item.floorTriangles, 0), sites: manifest.sites,
    reachable: manifest.reachableFromHome, isolated: manifest.isolatedSites, compressedBytes: compressed.length }));
