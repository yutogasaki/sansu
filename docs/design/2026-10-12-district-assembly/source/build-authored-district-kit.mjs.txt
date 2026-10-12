import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import * as T from 'three';

assert(process.argv.slice(2).every(arg => arg === '--check'), 'Use --check or no arguments');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = { artifact: 'docs/design/2026-10-10-island-final-3d/whole-island.glb', sha256: '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d' };
const bytes = await readFile(source.artifact); assert.equal(sha(bytes), source.sha256);
const jsonSize = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize)), binary = bytes.subarray(28 + jsonSize);
const compiled = await build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';", resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { compileWorldDefinition } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const baseBytes = await readFile('prototypes/place-qa/native05-world-source-shading.json.gz'), baseDefinition = JSON.parse(gunzipSync(baseBytes));
assert.equal(baseDefinition.source.sha256, source.sha256);
const scale = .45, authoredOrigin = { x: 5.65, y: -.3645, z: -1.03 }, bottomY = -.83 * scale + authoredOrigin.y;
const stable = value => Math.round(value * 1e9) / 1e9 || 0;
const cellKey = cell => `${cell.x},${cell.z}`;
function accessor(index, size) {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView]; assert(!a.sparse && view.buffer === 0);
    const formats = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] };
    const [width, read] = formats[a.componentType] ?? []; assert(width);
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? width * size;
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) => binary[read](start + i * stride + j * width)));
}
const matrices = new Map();
function visit(index, parent) {
    const node = gltf.nodes[index], local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
        new T.Vector3().fromArray(node.translation ?? [0, 0, 0]), new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
    const matrix = parent.clone().multiply(local); matrices.set(index, matrix);
    for (const child of node.children ?? []) visit(child, matrix);
}
for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, new T.Matrix4());
const terrainIndex = gltf.nodes.findIndex(node => node.name === 'Island / continuous sculpted mature terrain'), terrain = gltf.nodes[terrainIndex];
assert(terrain && matrices.has(terrainIndex));
const material = index => {
    const input = gltf.materials[index], pbr = input.pbrMetallicRoughness;
    assert(!/Texture/.test(JSON.stringify(input)), 'Do not silently drop source textures');
    return { color: `#${new T.Color().fromArray(pbr.baseColorFactor).getHexString()}`, roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 1 };
};
const definitionFor = district => ({ version: 1, id: district.id, source, districts: [district], edges: [] });
const dryBand = (world, cell, radius, maximumRise) => {
    const center = world.floorAt(cell); return center && [-radius, 0, radius].every(dx => [-radius, 0, radius].every(dz => {
        const sample = world.floorAt({ x: cell.x + dx, z: cell.z + dz }); return sample && Math.abs(sample.point.y - center.point.y) <= maximumRise;
    }));
};
function largestWalkComponent(world) {
    const remaining = new Set(world.sites.map(site => cellKey(site.cell))); let largest = new Set();
    const sites = new Map(world.sites.map(site => [cellKey(site.cell), site]));
    while (remaining.size) {
        const start = remaining.values().next().value, found = new Set([start]), queue = [sites.get(start).cell]; remaining.delete(start);
        for (let i = 0; i < queue.length; i++) for (const next of world.neighbors(queue[i])) {
            const key = cellKey(next); if (!remaining.delete(key)) continue; found.add(key); queue.push(next);
        }
        if (found.size > largest.size) largest = found;
    }
    return largest;
}
function choosePorts(world, facings, base = false) {
    const component = largestWalkComponent(world), used = new Set();
    const candidates = world.sites.filter(site => Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)
        && component.has(cellKey(site.cell)) && dryBand(world, site.cell, .12, .2));
    return facings.flatMap(facing => {
        const direction = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }][facing];
        const selected = candidates.filter(site => !used.has(cellKey(site.cell)) && dryBand(world, site.cell, .22, .2)
            && [-.22, 0, .22].every(side => {
                const extent = Math.hypot(world.bounds.max.x - world.bounds.min.x, world.bounds.max.z - world.bounds.min.z) + 1;
                for (let distance = .51; distance <= extent; distance += .25)
                    if (world.floorAt({ x: site.cell.x + direction.x * distance - direction.z * side,
                        z: site.cell.z + direction.z * distance + direction.x * side })) return false;
                return true;
            })).sort((a, b) =>
            (b.cell.x - a.cell.x) * direction.x + (b.cell.z - a.cell.z) * direction.z || a.cell.x - b.cell.x || a.cell.z - b.cell.z)[0];
        if (!selected) return []; used.add(cellKey(selected.cell));
        return [{ id: `${['east', 'south', 'west', 'north'][facing]}-entry`, ...(base ? { districtId: selected.ref.districtId } : {}), siteId: selected.ref.siteId, facing }];
    });
}
function edgeSupported(world, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz); let previous;
    for (let i = 0; i <= 8; i++) for (const side of [-.12, 0, .12]) {
        const sample = world.floorAt({ x: a.x + dx * i / 8 - dz / length * side, z: a.z + dz * i / 8 + dx / length * side });
        if (!sample || side === 0 && previous !== undefined && Math.abs(sample.point.y - previous) > .25) return false;
        if (side === 0) previous = sample.point.y;
    }
    return true;
}

const templates = [], provenance = [];
for (const [primitiveIndex, id, label, bankMaterialName] of [[2, 'native05-harbor-lowland-v1', '丸い入り江の低地', 'shore / pale sand'],
    [1, 'native05-northern-hill-v1', '起伏のある北の丘', 'ridge / light stratified stone']]) {
    const primitive = gltf.meshes[terrain.mesh].primitives[primitiveIndex], matrix = matrices.get(terrainIndex), normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
    const points = accessor(primitive.attributes.POSITION, 3).map(values => new T.Vector3().fromArray(values).applyMatrix4(matrix).multiplyScalar(scale)
        .add(new T.Vector3(authoredOrigin.x, authoredOrigin.y, authoredOrigin.z)));
    const normals = accessor(primitive.attributes.NORMAL, 3).map(values => new T.Vector3().fromArray(values).applyMatrix3(normalMatrix));
    const indices = accessor(primitive.indices, 1).flat(), minimum = new T.Box3().setFromPoints(points).min;
    const origin = { x: Math.floor(minimum.x), y: 0, z: Math.floor(minimum.z) };
    const vertices = points.map((p, i) => {
        const point = { x: stable(p.x - origin.x), y: stable(p.y), z: stable(p.z - origin.z) };
        return { cell: { x: point.x, z: point.z }, point, normal: { x: normals[i].x, y: normals[i].y, z: normals[i].z } };
    });
    const appearance = material(primitive.material), floor = { id: 'source-terrain', kind: 'ground', vertices, indices, color: appearance.color,
        material: { roughness: appearance.roughness, metalness: appearance.metalness, doubleSided: gltf.materials[primitive.material].doubleSided === true } };
    // Source material boundaries cut the original shared terrain. Give every
    // exposed edge a real visible side and a bottom, without adding a dry floor.
    const welded = new Map(), canonical = [], ids = vertices.map(({ point }) => {
        const key = `${point.x},${point.y},${point.z}`; if (!welded.has(key)) { welded.set(key, canonical.length); canonical.push(point); } return welded.get(key);
    });
    const boundary = new Map();
    for (let i = 0; i < indices.length; i += 3) {
        const triangle = indices.slice(i, i + 3).map(index => ids[index]);
        for (let j = 0; j < 3; j++) {
            const a = triangle[j], b = triangle[(j + 1) % 3], key = [a, b].sort((x, y) => x - y).join(':');
            const edge = boundary.get(key); if (edge) edge.count++; else boundary.set(key, { a, b, count: 1 });
        }
    }
    assert([...boundary.values()].every(edge => edge.count <= 2), 'Source terrain is non-manifold');
    const boundaryDegree = new Map();
    for (const { a, b, count } of boundary.values()) if (count === 1)
        for (const index of [a, b]) boundaryDegree.set(index, (boundaryDegree.get(index) ?? 0) + 1);
    const sourceBoundaryPinches = [...boundaryDegree].filter(([, degree]) => degree > 2)
        .map(([index, degree]) => ({ point: canonical[index], boundaryDegree: degree }));
    const sides = [], sideIndices = [];
    for (const { a, b, count } of boundary.values()) {
        if (count !== 1) continue; const offset = sides.length, p = canonical[a], q = canonical[b];
        sides.push(p, q, { ...p, y: bottomY }, { ...q, y: bottomY });
        sideIndices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
    const bankMaterial = material(gltf.materials.findIndex(value => value.name === bankMaterialName));
    const bottom = canonical.map(point => ({ ...point, y: bottomY })), bottomIndices = [];
    for (let i = 0; i < indices.length; i += 3) bottomIndices.push(ids[indices[i]], ids[indices[i + 2]], ids[indices[i + 1]]);
    const surfaces = [{ id: 'authored-source-boundary-sides', kind: 'bank', vertices: sides, indices: sideIndices, material: bankMaterial },
        { id: 'authored-source-bottom', kind: 'bank', vertices: bottom, indices: bottomIndices, material: bankMaterial }];
    const district = { id, templateId: id, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [floor], surfaces, sites: [], ports: [] };
    const floorWorld = compileWorldDefinition(definitionFor(district));
    for (let zi = Math.ceil(floorWorld.bounds.min.z * 4); zi <= Math.floor(floorWorld.bounds.max.z * 4); zi++)
        for (let xi = Math.ceil(floorWorld.bounds.min.x * 4); xi <= Math.floor(floorWorld.bounds.max.x * 4); xi++) {
            const cell = { x: xi / 4, z: zi / 4 };
            if (!dryBand(floorWorld, cell, .12, .2)) continue;
            const placement = Number.isInteger(cell.x) && Number.isInteger(cell.z) && Boolean(dryBand(floorWorld, cell, .46, .28));
            district.sites.push({ id: cellKey(cell), cell, floorId: floor.id, placement });
        }
    const sites = new Map(district.sites.map(site => [site.id, site])), edges = [];
    const add = (a, b, allows) => edges.push({ from: { districtId: id, siteId: a.id }, to: { districtId: id, siteId: b.id }, allows });
    for (const site of district.sites) {
        for (const d of [{ x: .25, z: 0 }, { x: 0, z: .25 }]) {
            const neighbor = sites.get(cellKey({ x: site.cell.x + d.x, z: site.cell.z + d.z }));
            if (neighbor && edgeSupported(floorWorld, site.cell, neighbor.cell)) add(site, neighbor, ['walk']);
        }
        if (site.placement) for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }]) {
            const neighbor = sites.get(cellKey({ x: site.cell.x + d.x, z: site.cell.z + d.z }));
            if (neighbor?.placement) add(site, neighbor, ['join', 'water']);
        }
    }
    const world = compileWorldDefinition({ ...definitionFor(district), edges }), ports = choosePorts(world, [2, 0, 3, 1]);
    assert(ports.length >= 2, 'A district needs two genuine edge ports');
    ports.sort((a, b) => world.sites.find(site => site.ref.siteId === a.siteId).point.y - world.sites.find(site => site.ref.siteId === b.siteId).point.y);
    district.ports = ports.map(({ id, siteId }) => ({ id, siteId }));
    templates.push({ id, label, district, edges, ports });
    provenance.push({ id, sourceNode: terrain.name, sourcePrimitive: primitiveIndex, sourceMaterial: gltf.materials[primitive.material].name,
        transform: { scale, authoredOrigin, localOrigin: origin }, sourceTriangles: indices.length / 3, sourceNormalsAndIndices: 'preserved',
        authoredClosure: { boundaryEdges: sideIndices.length / 6, sideTriangles: sideIndices.length / 3, bottomTriangles: bottomIndices.length / 3,
            bottomY, material: bankMaterialName, sourceBoundaryPinches, manifold: sourceBoundaryPinches.length === 0,
            normals: 'runtime computed, not original source normals' },
        placementSites: district.sites.filter(site => site.placement).length, walkingSites: district.sites.length, edges: edges.length,
        ports: ports.map(port => ({ ...port, cell: world.sites.find(site => site.ref.siteId === port.siteId).cell,
            point: world.sites.find(site => site.ref.siteId === port.siteId).point })), bounds: world.bounds });
}
const base = compileWorldDefinition(baseDefinition), basePorts = choosePorts(base, [0, 2, 3], true);
assert(basePorts.length >= 2, 'The base needs two genuine edge ports');
const catalog = { version: 1, candidate: 'native05-district-shapes-rough-v1', source, templates, basePorts };
const path = 'prototypes/place-qa/authored-district-kit.json.gz', manifestPath = 'prototypes/place-qa/authored-district-kit-manifest.json';
const expanded = Buffer.from(JSON.stringify(catalog)), gzip = gzipSync(expanded, { level: 9, mtime: 0 });
const manifest = { version: 1, candidate: catalog.candidate, source, artifact: { path: `/${path}`, sha256: sha(gzip), expandedSha256: sha(expanded), expandedBytes: expanded.length, gzipBytes: gzip.length },
    base: { artifact: 'prototypes/place-qa/native05-world-source-shading.json.gz', sha256: sha(baseBytes), ports: basePorts.map(port => ({ ...port,
        cell: base.sites.find(site => site.ref.districtId === port.districtId && site.ref.siteId === port.siteId).cell })) }, templates: provenance,
    status: { visual: 'HOLD', rough: true, acquisition: 'diagnostic only', independentObservers: 0 },
    limitations: ['Top triangles retain the original source material-region boundary, including its straight interior cuts.',
        'Sides and bottom are newly authored closure from the real top boundary; original whole-island coast is not duplicated.',
        'Harbor retains one source boundary pinch: two bank side fans meet on a vertical line. There are no open edges, but this closure is not a manifold solid.',
        'Closure normals are computed by the existing bank renderer. Port connectors and render/guard review belong to the composer integration.'] };
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
if (process.argv.includes('--check')) { assert((await readFile(path)).equals(gzip), 'District kit is stale'); assert((await readFile(manifestPath)).equals(manifestBytes), 'District manifest is stale'); }
else { await writeFile(path, gzip); await writeFile(manifestPath, manifestBytes); }
console.log(JSON.stringify({ candidate: catalog.candidate, artifact: manifest.artifact, templates: provenance.map(({ id, sourceTriangles, authoredClosure, placementSites, walkingSites, ports }) => ({ id, sourceTriangles, authoredClosure, placementSites, walkingSites, ports })), basePorts: manifest.base.ports }));
