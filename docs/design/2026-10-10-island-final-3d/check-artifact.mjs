import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = path.resolve(root, '../../..');
const bytes = fs.readFileSync(path.join(root, 'whole-island.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const triangles = model.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, primitive) => n + model.accessors[primitive.indices].count / 3, 0), 0);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scene-manifest.json')));
assert.equal(triangles, manifest.triangles);
assert(model.nodes.some(node => node.name.startsWith('Whole island / grown living arch')));
assert.equal(manifest.candidate, 'whole-island-native-3d-05');
assert(manifest.growth_comparison.area_ratio > 1.8);
assert(model.nodes.some(node => node.name === 'Island / continuous sculpted mature terrain'));
assert(model.nodes.some(node => node.name.startsWith('Grove / great root house trunk')));
assert(model.nodes.some(node => node.name === 'Harbor / continuous translucent shell hall'));
assert(model.nodes.some(node => node.name === 'Grove / continuous bough gallery'));
assert(model.nodes.some(node => node.name === 'Grove / hollow dwelling floor'));
assert.equal(model.nodes.filter(node => /^Ocean \/ joined terrace pool [123]$/.test(node.name)).length, 3);
const colouredLeaves = model.nodes.filter(node => node.name.startsWith('Grove / broad silver fan leaf'));
assert.equal(colouredLeaves.length, 12);
assert(colouredLeaves.every(node => model.meshes[node.mesh].primitives.every(primitive => primitive.attributes.COLOR_0 !== undefined)));
assert(model.nodes.some(node => node.name === 'Hill / grown mineral headwater grotto'));
assert(model.nodes.filter(node => /^Ocean \/ joined terrace pool [123]$/.test(node.name)).every(node => model.meshes[node.mesh].primitives.every(primitive => primitive.attributes.COLOR_0 !== undefined)));
assert(model.nodes.some(node => node.name === 'Hill / blue terrace home / broad scalloped cap roof'));
assert(model.nodes.some(node => node.name === 'Harbor / peninsula home / folded leaf roof'));
const shellMaterial = model.materials.find(material => material.name === 'harbor / translucent pearl shell');
assert(shellMaterial?.extensions?.KHR_materials_transmission?.transmissionFactor > .3);
const tideNode = model.nodes.find(node => node.name === 'Ocean / tide and reflected sky');
assert(tideNode && model.meshes[tideNode.mesh].primitives.every(primitive => primitive.attributes.COLOR_0 !== undefined));
assert(model.nodes.some(node => node.name.startsWith('Flowers / shared giant petal canopy')));
assert.equal(model.nodes.filter(node => node.name.startsWith('Inlet / continuous spring waterfall')).length, 7);
assert.equal(model.nodes.filter(node => node.name.endsWith('/ rounded walls')).length, 15);
const previousBytes = fs.readFileSync(path.join(root, 'history/native-02/whole-island.glb'));
const previous = JSON.parse(previousBytes.subarray(20, 20 + previousBytes.readUInt32LE(12)).toString());
const retainedHomes = previous.nodes.filter(node => node.name.endsWith('/ rounded walls'));
assert.equal(retainedHomes.length, 8);
function accessorDigest(glb, asset, index) {
  const accessor = asset.accessors[index];
  const view = asset.bufferViews[accessor.bufferView];
  const componentBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
  const elementBytes = componentBytes * components;
  const stride = view.byteStride || elementBytes;
  const binaryStart = 28 + glb.readUInt32LE(12);
  const start = binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const hash = crypto.createHash('sha256');
  for (let i = 0; i < accessor.count; i++) hash.update(glb.subarray(start + i * stride, start + i * stride + elementBytes));
  return `${accessor.componentType}/${accessor.type}/${accessor.count}/${hash.digest('hex')}`;
}
function uvDifference(glb, asset, index, oldGlb, oldAsset, oldIndex) {
  const pair = [[glb, asset, index], [oldGlb, oldAsset, oldIndex]].map(([buffer, model, id]) => {
    const accessor = model.accessors[id], view = model.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, 'VEC2');
    const start = 28 + buffer.readUInt32LE(12) + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    return { buffer, start, stride: view.byteStride || 8, count: accessor.count };
  });
  assert.equal(pair[0].count, pair[1].count);
  let max = 0;
  for (let i = 0; i < pair[0].count; i++) for (let k = 0; k < 2; k++) {
    const values = pair.map(p => p.buffer.readFloatLE(p.start + i * p.stride + k * 4));
    max = Math.max(max, Math.abs(values[0] - values[1]));
  }
  return max;
}
for (const old of retainedHomes) {
  const current = model.nodes.find(node => node.name === old.name);
  assert(current, `Original house missing: ${old.name}`);
  for (const transform of ['translation', 'rotation', 'scale', 'matrix']) assert.deepEqual(current[transform], old[transform]);
  const before = previous.accessors[previous.meshes[old.mesh].primitives[0].attributes.POSITION];
  const after = model.accessors[model.meshes[current.mesh].primitives[0].attributes.POSITION];
  assert.deepEqual(after.min, before.min); assert.deepEqual(after.max, before.max); assert.equal(after.count, before.count);
}
const preservedNodes = previous.nodes.filter(node => node.mesh !== undefined && (retainedHomes.some(home => node.name.startsWith(home.name.replace(' / rounded walls', '') + ' /')) || /^(Original Pokomoko|Pokomoko|Rabbit|Fox) \//.test(node.name)));
let maxUntexturedHomeUVDifference = 0;
for (const old of preservedNodes) {
  const current = model.nodes.find(node => node.name === old.name);
  assert(current, `Preserved native part missing: ${old.name}`);
  for (const transform of ['translation', 'rotation', 'scale', 'matrix']) assert.deepEqual(current[transform], old[transform], old.name);
  const before = previous.meshes[old.mesh].primitives;
  const after = model.meshes[current.mesh].primitives;
  assert.equal(after.length, before.length);
  before.forEach((primitive, i) => {
    for (const attribute of ['POSITION', 'TEXCOORD_0']) {
      if (primitive.attributes[attribute] === undefined) continue;
      if (attribute === 'TEXCOORD_0' && !/^(Original Pokomoko|Pokomoko|Rabbit|Fox) \//.test(old.name)) {
        assert(!previous.materials[primitive.material]?.pbrMetallicRoughness?.baseColorTexture);
        // Blender re-export rounds generated, unused house UVs by at most one Float32 ULP.
        const difference = uvDifference(bytes, model, after[i].attributes[attribute], previousBytes, previous, primitive.attributes[attribute]);
        assert(difference <= 1e-7, `${old.name} generated untextured UV changed`);
        maxUntexturedHomeUVDifference = Math.max(maxUntexturedHomeUVDifference, difference);
        continue;
      }
      assert.equal(accessorDigest(bytes, model, after[i].attributes[attribute]), accessorDigest(previousBytes, previous, primitive.attributes[attribute]), `${old.name} ${attribute}`);
    }
  });
}
assert(model.nodes.some(node => node.name.startsWith('Original Pokomoko /')));
assert(model.nodes.some(node => node.name.startsWith('Rabbit /')));
assert(model.nodes.some(node => node.name.startsWith('Fox /')));
assert.equal(model.images.length, 2);
assert(model.images.every(image => image.bufferView !== undefined && !image.uri));
function embeddedImageDigest(glb, asset, image) {
  const view = asset.bufferViews[image.bufferView];
  const start = 28 + glb.readUInt32LE(12) + (view.byteOffset || 0);
  return crypto.createHash('sha256').update(glb.subarray(start, start + view.byteLength)).digest('hex');
}
for (const old of previous.images) {
  const current = model.images.find(image => image.name === old.name);
  assert(current); assert.equal(embeddedImageDigest(bytes, model, current), embeddedImageDigest(previousBytes, previous, old));
}
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(manifest.base_art_input.sha256, sha(path.join(root, manifest.base_art_input.path)));
const native = JSON.parse(fs.readFileSync(path.join(root, 'native-check.json')));
assert.equal(native.candidate, manifest.candidate);
assert.equal(native.native_sha256, sha(path.join(root, 'whole-island.blend')));
assert.equal(native.hollow_trunk_entry_ray, 'PASS');
const files = ['whole-island.blend', 'whole-island.glb', 'whole-island-render.png', 'scene-manifest.json', 'native-check.json', 'build-final-scene.py', 'fantasy-colour-world.py', 'varied-world.py', 'build-scene.py', 'fantasy-landscape.py', 'editor-layout.py', 'export-residents.ts', 'residents.json', 'resident-texture-0.png', 'resident-texture-1.png', 'history/native-04/whole-island.blend', 'viewer.js', 'viewer.bundle.js', 'index.html', 'check-native.py', 'make-review-sheets.py', 'viewer-check.json', 'viewer-contact-sheet.png', 'viewer-comparison.png', 'viewer-previous-desktop.png', 'viewer-day-desktop.png', 'viewer-whole-desktop.png', 'viewer-whole-phone.png', 'viewer-whole-small.png', 'viewer-final.png', 'viewer-whole-tablet.png', 'viewer-grove-phone.png', 'viewer-orbit-phone.png', 'viewer-garden-tablet.png', 'viewer-village-tablet.png', 'viewer-harbor-tablet.png'];
const viewer = JSON.parse(fs.readFileSync(path.join(root, 'viewer-check.json')));
assert.equal(viewer.candidate, manifest.candidate);
assert.equal(viewer.modelRevision, sha(path.join(root, 'whole-island.glb')).slice(0, 16));
assert.equal(viewer.consoleErrors.length, 0);
assert(viewer.operations.every(operation => operation.result === 'PASS'));
assert(viewer.views.every(view => view.revision === viewer.modelRevision && view.candidate === manifest.candidate));
assert.equal(viewer.comparison.candidate, 'whole-island-native-3d-02');
assert.equal(viewer.comparison.revision, sha(path.join(root, 'history/native-02/whole-island.glb')).slice(0,16));
assert.equal(viewer.comparison.sameCamera, true);
assert.equal(viewer.comparison.sameWorldScale, true);
assert.deepEqual(viewer.comparison.previousCamera, viewer.comparison.grownCamera);
assert(viewer.views.filter(view => view.scrollWidth !== undefined).every(view => view.scrollWidth <= view.width));
assert(viewer.views.filter(view => view.buttons).every(view => view.buttons.every(button => button.height >= 43.95 && button.width >= 43.95)));
const sources = ['islandCharacters.ts', 'residentRig.ts', 'residentFabric.ts', 'primitives.ts', 'worldPalette.ts'].map(file => path.join('src/components/island/three', file));
const report = {
  result: 'PASS', candidate: manifest.candidate,
  target: 'standalone editable 3D art + local GLB viewer',
  delivery: 'standalone-art-viewer', gameFlags: 'not an application build',
  capturedTarget: 'http://127.0.0.1:8230/design/2026-10-10-island-final-3d/',
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceState: 'shared dirty working tree; exact artifact inputs hashed below',
  meshes: model.meshes.length, triangles, materials: model.materials.length, embeddedTextures: model.images.length, modelRevision: viewer.modelRevision,
  growthComparison: { retainedHomes: retainedHomes.map(node => node.name), originalTransformsAndDimensions: 'PASS', preservedHomeAndOriginalResidentParts: preservedNodes.length, originalPositions: 'EXACT_MATCH', residentPositionsUVsAndTextures: 'EXACT_MATCH', unusedHomeUVs: { tolerance: 1e-7, maximumDifference: maxUntexturedHomeUVDifference }, areaRatio: manifest.growth_comparison.area_ratio, comparisonRevision: viewer.comparison.revision },
  files: Object.fromEntries(files.map(file => [file, { bytes: fs.statSync(path.join(root, file)).size, sha256: sha(path.join(root, file)) }])),
  residentSources: Object.fromEntries(sources.map(file => [file, sha(path.join(repo, file))])),
  gates: { artifactIntegrity: 'PASS', visualAppeal: 'author inspection only; user adoption pending', silentComprehension: 'NOT_EVALUATED', gameRuntime: 'NOT_EVALUATED' },
};
fs.writeFileSync(path.join(root, 'artifact-check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ result: report.result, meshes: report.meshes, triangles, materials: report.materials, embeddedTextures: report.embeddedTextures }));
