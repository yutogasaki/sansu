import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Vector3 } from 'three';

const root = new URL('./', import.meta.url), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(new URL('art-manifest.json', root), 'utf8'));
const input = JSON.parse(await readFile(new URL('owned-input.json', root), 'utf8'));
const bytes = await readFile(new URL('whole-landscape.glb', root));
assert.equal(bytes.toString('utf8', 0, 4), 'glTF'); assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length); assert.equal(sha(bytes), manifest.sha256);
const jsonLength = bytes.readUInt32LE(12), model = JSON.parse(bytes.subarray(20, 20 + jsonLength));
assert.equal(manifest.candidate, input.candidate); assert.equal(manifest.gameplayMapped, false);
assert.equal(sha(await readFile(new URL('whole-landscape.blend', root))), manifest.blendSha256);
assert.equal(sha(await readFile(new URL('whole-landscape-render.png', root))), manifest.renderSha256);
assert.equal(sha(await readFile(new URL('owned-parts.glb', root))), input.partsSha256);
assert.equal(sha(await readFile(new URL('../2026-10-10-island-final-3d/whole-island.glb', root))), input.sourceSha256);
assert.equal(sha(await readFile(new URL('../2026-10-10-island-final-3d/whole-island.blend', root))), manifest.sourceBlendSha256);
for (const [file, hash] of Object.entries(input.appInputs)) assert.equal(sha(await readFile(file)), hash, `Current owned art source changed: ${file}`);
assert.equal(input.owners.filter(o => o.kind === 'home').length, 8);
assert.equal(input.owners.filter(o => o.cell).length, 27); assert.equal(input.owners.filter(o => !o.cell).length, 2);
assert.deepEqual(manifest.ownerIds, input.owners.filter(o => o.cell).map(o => o.id).sort());
const homeRoots = model.nodes.filter(node => node.extras?.kind === 'home' && node.extras?.owner_id);
assert.equal(homeRoots.length, 8);
const partBytes = await readFile(new URL('owned-parts.glb', root));
const partJsonLength = partBytes.readUInt32LE(12), parts = JSON.parse(partBytes.subarray(20, 20 + partJsonLength));
// Compare the actual house surfaces below each root. Only the art root's
// translation and uniform sizing differ; Blender's import/export may reorder
// seams, so compare geometric vertices with a small float32 tolerance.
function houseGeometry(document, buffer, jsonLength, owner) {
    const rootNode = document.nodes.find(n => n.extras?.kind === 'home' && (n.extras.ownerId ?? n.extras.owner_id) === owner);
    assert(rootNode);
    const points = [], colors = []; let triangles = 0;
    function visit(index, parent) {
        const node = document.nodes[index], local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
            new Vector3(...(node.translation ?? [0,0,0])), new Quaternion(...(node.rotation ?? [0,0,0,1])), new Vector3(...(node.scale ?? [1,1,1])));
        const world = parent.clone().multiply(local);
        for (const primitive of document.meshes[node.mesh]?.primitives ?? []) {
            const accessor = document.accessors[primitive.attributes.POSITION], view = document.bufferViews[accessor.bufferView];
            assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, 'VEC3');
            const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12;
            for (let i=0; i<accessor.count; i++) points.push(new Vector3(...[0,1,2].map(k => buffer.readFloatLE(offset + i*stride + k*4))).applyMatrix4(world));
            triangles += document.accessors[primitive.indices].count / 3;
            colors.push(document.materials[primitive.material].pbrMetallicRoughness?.baseColorFactor ?? [1,1,1,1]);
        }
        for (const child of node.children ?? []) visit(child, world);
    }
    for (const child of rootNode.children ?? []) visit(child, new Matrix4());
    return { points, triangles, colors };
}
function assertSamePoints(expected, actual) {
    const tolerance = 1e-5, grid = new Map(), key = (x,y,z) => `${x},${y},${z}`;
    for (const point of expected) {
        const cell = point.toArray().map(v => Math.floor(v/tolerance)), id = key(...cell);
        if (!grid.has(id)) grid.set(id, []); grid.get(id).push(point);
    }
    for (const point of actual) {
        const cell = point.toArray().map(v => Math.floor(v/tolerance)); let found = false;
        for (let dx=-1; dx<=1 && !found; dx++) for (let dy=-1; dy<=1 && !found; dy++) for (let dz=-1; dz<=1 && !found; dz++) {
            found = (grid.get(key(cell[0]+dx,cell[1]+dy,cell[2]+dz)) ?? []).some(p => p.distanceTo(point) <= tolerance);
        }
        assert(found, `A house surface moved in local geometry: ${point.toArray()}`);
    }
}
const geometryEvidence = [];
const overlays = [];
for (const home of homeRoots) {
    const owner = input.owners.find(owner => owner.id === home.extras.owner_id);
    assert.equal(home.extras.stage, owner.stage); assert.equal(home.extras.style, owner.style);
    assert.equal(home.extras.roof ?? null, owner.roof);
    assert.deepEqual(JSON.parse(home.extras.saved_cell), owner.cell);
    const original = houseGeometry(parts, partBytes, partJsonLength, owner.id), exported = houseGeometry(model, bytes, jsonLength, owner.id);
    assert.equal(original.triangles, exported.triangles);
    assertSamePoints(original.points, exported.points); assertSamePoints(exported.points, original.points);
    const roundColors = colors => colors.map(c => c.map(v => Math.round(v*1e5)/1e5).join(',')).sort();
    assert.deepEqual(roundColors(original.colors), roundColors(exported.colors));
    geometryEvidence.push({ owner:owner.id, triangles:exported.triangles, localSurfaceTolerance:1e-5, colorsPreserved:true });
    const project = p => [p.x*.85 - p.z*.53, -p.y*.89 + (p.x*.53+p.z*.85)*.45];
    const projected = original.points.map(project), low = [0,1].map(k => Math.min(...projected.map(p => p[k]))), high = [0,1].map(k => Math.max(...projected.map(p => p[k])));
    const scale = 78 / Math.max(high[0]-low[0], high[1]-low[1]), tile = overlays.length;
    const dots = (points, fill, r) => [...new Map(points.map(p => [p.toArray().map(v => Math.round(v*1e4)).join(','),p])).values()].map(p => {
        const v = project(p); return `<circle cx="${(tile%4*130+26+(v[0]-low[0])*scale).toFixed(3)}" cy="${(Math.floor(tile/4)*128+36+(v[1]-low[1])*scale).toFixed(3)}" r="${r}" fill="${fill}"/>`;
    }).join('');
    overlays.push(`<text x="${tile%4*130+16}" y="${Math.floor(tile/4)*128+22}" font-size="12">${owner.id}</text>`+dots(original.points,'#258dbb',.75)+dots(exported.points,'#d267aa',.4));
}
const foundations = model.nodes.filter(node => node.extras?.art_assembly === 'home-foundation');
assert.equal(foundations.length, 8);
assert.equal(model.meshes.length, manifest.meshes);
let triangles = 0;
for (const mesh of model.meshes) for (const primitive of mesh.primitives) {
    const position = model.accessors[primitive.attributes.POSITION], index = model.accessors[primitive.indices];
    assert(position.min.every(Number.isFinite) && position.max.every(Number.isFinite));
    assert(position.max.every((value, i) => value >= position.min[i]));
    assert(index.count % 3 === 0); triangles += index.count / 3;
}
assert.equal(triangles, manifest.triangles);
assert(model.materials.some(m => m.extensions?.KHR_materials_transmission?.transmissionFactor > .3));
const binaryLength = bytes.readUInt32LE(20 + jsonLength);
for (const view of model.bufferViews) assert((view.byteOffset ?? 0) + view.byteLength <= binaryLength);
const report = { candidate: manifest.candidate, artifactPass: true, artOnly: true, gameplayMapped: false,
    modelSha256: manifest.sha256, sourceSha256: input.sourceSha256, sourceUnchanged: true,
    homes: homeRoots.length, placedOwners: 27, storedOwners: 2, foundations: foundations.length,
    meshes: model.meshes.length, triangles, ownedRoofStyleStageAndSavedCellsPreserved: true,
    ownedHouseActualSurfaceGeometry: geometryEvidence,
    currentOwnedSourceInputsUnchanged: true, scope: 'Native art file integrity; no gameplay, navigation or child-observation claim' };
await writeFile(new URL('artifact-check.json', root), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL('house-surface-overlay.svg', root), `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="278" viewBox="0 0 520 278"><title>同じ根座標の家の実mesh：現行kitは青、書出後は桃。位置と一様拡大は除外。</title><rect width="520" height="278" fill="white"/>${overlays.join('')}<text x="16" y="268" font-size="10">青＝現行kit / 桃＝書出後 · 家の同じ根座標 · 許容差0.00001</text></svg>\n`);
console.log(JSON.stringify(report));
