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
assert.equal(model.nodes.filter(node => node.name.endsWith('/ rounded walls')).length, 8);
assert(model.nodes.some(node => node.name.startsWith('Original Pokomoko /')));
assert(model.nodes.some(node => node.name.startsWith('Rabbit /')));
assert(model.nodes.some(node => node.name.startsWith('Fox /')));
assert.equal(model.images.length, 2);
assert(model.images.every(image => image.bufferView !== undefined && !image.uri));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = ['whole-island.blend', 'whole-island.glb', 'whole-island-render.png', 'build-scene.py', 'editor-layout.py', 'export-residents.ts', 'residents.json', 'resident-texture-0.png', 'resident-texture-1.png', 'viewer.js', 'viewer.bundle.js', 'index.html', 'check-native.py', 'viewer-whole-desktop.png', 'viewer-whole-phone.png', 'viewer-whole-tablet.png', 'viewer-grove-phone.png', 'viewer-orbit-phone.png', 'viewer-garden-tablet.png', 'viewer-village-tablet.png'];
const sources = ['islandCharacters.ts', 'residentRig.ts', 'residentFabric.ts', 'primitives.ts', 'worldPalette.ts'].map(file => path.join('src/components/island/three', file));
const report = {
  result: 'PASS', candidate: manifest.candidate,
  target: 'standalone editable 3D art + local GLB viewer',
  delivery: 'standalone-art-viewer', gameFlags: 'not an application build',
  capturedTarget: 'http://127.0.0.1:8230/design/2026-10-10-island-final-3d/',
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceState: 'shared dirty working tree; exact artifact inputs hashed below',
  meshes: model.meshes.length, triangles, materials: model.materials.length, embeddedTextures: model.images.length,
  files: Object.fromEntries(files.map(file => [file, { bytes: fs.statSync(path.join(root, file)).size, sha256: sha(path.join(root, file)) }])),
  residentSources: Object.fromEntries(sources.map(file => [file, sha(path.join(repo, file))])),
  gates: { artifactIntegrity: 'PASS', visualAppeal: 'author inspection only; user adoption pending', silentComprehension: 'NOT_EVALUATED', gameRuntime: 'NOT_EVALUATED' },
};
fs.writeFileSync(path.join(root, 'artifact-check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ result: report.result, meshes: report.meshes, triangles, materials: report.materials, embeddedTextures: report.embeddedTextures }));
