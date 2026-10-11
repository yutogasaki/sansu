import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { makeExpansionPack } from './growing-expansion-fixtures.mjs';
import { digestFiles } from './verify-growing.mjs';

assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output NEW_DIRECTORY');
const out = path.resolve(process.argv[3]); await fs.mkdir(out, { recursive: false });
const compiled = await build({ stdin: { contents: `
    export * as T from 'three';
    export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    export { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
    export { makeNativeGrowingKit } from './src/components/island/growing/native/nativeGrowingKit.ts';
    export { sceneLayout } from './src/components/island/growing/sceneLayout.ts';
    export { buildNativeGrowingGround } from './src/components/island/growing/native/nativeGrowingGround.ts';
    export { buildObjectLayer } from './src/components/island/growing/objectLayer.ts';
    export { IslandMaterials } from './src/components/island/three/primitives.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const sourceFiles = Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>' && !file.startsWith('node_modules/')).sort();
const sources = await digestFiles(process.cwd(), [...sourceFiles, 'tools/export-growing-expansion.mjs', 'tools/growing-expansion-fixtures.mjs',
    'docs/design/2026-10-11-native-owned-island/kit-manifest.json', 'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz']);
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
// GLTFExporter uses the browser FileReader interface only to convert a Blob.
globalThis.FileReader = class {
    readAsArrayBuffer(blob) { void blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
    readAsDataURL(blob) { void blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const manifest = JSON.parse(await fs.readFile('docs/design/2026-10-11-native-owned-island/kit-manifest.json'));
const delivered = gunzipSync(await fs.readFile('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
assert.equal(createHash('sha256').update(delivered).digest('hex'), manifest.sha256);
const gltf = await new api.GLTFLoader().parseAsync(Uint8Array.from(delivered).buffer, ''), kit = api.makeNativeGrowingKit(gltf.scene, manifest);
const pack = await makeExpansionPack(), fixtures = pack.cases.filter(entry => entry.expansion || entry.id === 'qa-place-whole-island-v1');
const report = { candidate: 'native05-expanding-runtime-v2', projection: 'curved-owned-v1', sourceHash: createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
    sources, kit: manifest.sha256, fixtureSource: pack.sourceHash, fixturePayload: pack.payloadHash,
    scope: 'Editable GLB of the actual runtime floor and individually owned objects. Living actors, sea shader, UI and lighting are shown in real-app captures separately.', models: [] };
for (const entry of fixtures) {
    const layout = api.sceneLayout(entry.island.state, true), ground = api.buildNativeGrowingGround(layout, manifest.shoreProfile);
    const materials = new api.IslandMaterials('moon-garden'), objects = api.buildObjectLayer(materials, entry.island.state, layout, undefined, undefined, [], kit);
    const root = new api.T.Group(); root.name = entry.id; root.add(ground.root, objects.root);
    const cottage = kit.cottage(); cottage.position.copy(layout.point({ x: 2, z: 0 })); cottage.userData.objectId = 'house'; root.add(cottage);
    root.userData = { candidate: report.candidate, projection: report.projection, fixtureId: entry.id, synthetic: true, ownedRecord: entry.island, sourceHash: report.sourceHash };
    // Invisible finger targets and preview markers do not belong in editable art.
    root.traverse(object => { if (object.userData.placementHitOnly) object.visible = false; });
    root.updateMatrixWorld(true);
    const data = Buffer.from(await new api.GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true }));
    const file = entry.expansion ? `${entry.expansion.direction}-${entry.expansion.size}.glb` : 'center-8.glb';
    await fs.writeFile(path.join(out, file), data);
    const bounds = new api.T.Box3().setFromObject(root), count = { meshes: 0, triangles: 0 };
    root.traverse(object => { if (object instanceof api.T.Mesh && object.visible) { count.meshes++; count.triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
    report.models.push({ file, id: entry.id, name: entry.expansion?.name || '最初の中心', homes: entry.expected.homes,
        expansion: entry.expansion, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, ...count });
    objects.dispose(); ground.dispose(); materials.dispose(); console.log(`Exported ${file}`);
}
kit.dispose(); assert.deepEqual(await digestFiles(process.cwd(), Object.keys(sources)), sources);
await fs.writeFile(path.join(out, 'models.json'), JSON.stringify(report, null, 2) + '\n');
