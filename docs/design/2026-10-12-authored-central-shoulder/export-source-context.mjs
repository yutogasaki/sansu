import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// Offline static construction using the same objectLayer. No browser/server/build output.
const output = path.dirname(fileURLToPath(import.meta.url));
const repo = process.cwd();
const runtimeRepo = '/private/tmp/sansu-authored-cove-c4/candidate';
const require = createRequire(`${repo}/package.json`), { build } = require('esbuild');
const T = await import(`${repo}/node_modules/three/build/three.module.js`);
const { GLTFLoader } = await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const { GLTFExporter } = await import(require.resolve('three/addons/exporters/GLTFExporter.js'));
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const hash = p => createHash('sha256').update(read(p)).digest('hex');
const asset = p => `${runtimeRepo}/${p.replace(/^\//, '')}`;
const source = `${repo}/docs/design/2026-10-10-island-final-3d/whole-island.glb`;
assert.equal(hash(source), '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d');
const b = await build({ stdin: { contents: `
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
export { sceneLayout } from './src/components/island/growing/sceneLayout.ts';
export { buildObjectLayer } from './src/components/island/growing/objectLayer.ts';
export { IslandMaterials } from './src/components/island/three/primitives.ts';
export { makeNativeGrowingKit } from './src/components/island/growing/native/nativeGrowingKit.ts';
export { makeNativeAuthoredFlower } from './src/components/island/growing/native/nativeAuthoredFlower.ts';
export { makeNativeAuthoredCove } from './src/components/island/growing/native/nativeAuthoredCove.ts';
export { buildAuthoredGrowingGround } from './src/components/island/growing/native/authoredGrowingGround.ts';
`, resolveDir: runtimeRepo, loader: 'ts' }, write: false, bundle: true, packages: 'external', platform: 'node', format: 'cjs', logLevel: 'silent', metafile: true });
const m = { exports: {} };
new Function('require', 'module', 'exports', b.outputFiles[0].text)(name => name === 'three' ? T : require(name), m, m.exports);
const a = m.exports;
const kitManifestPath = asset('docs/design/2026-10-11-native-owned-island/kit-manifest.json');
const coveManifestPath = asset('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
const coveManifest = json(coveManifestPath);
const used = [...Object.keys(b.metafile.inputs).filter(p => p !== '<stdin>').map(p => path.resolve(runtimeRepo, p)), source,
    `${repo}/docs/design/2026-10-10-island-final-3d/whole-island.blend`, kitManifestPath, coveManifestPath,
    asset('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'), asset('prototypes/place-qa/native-flower-support.json.gz'),
    asset(coveManifest.artifact.path), asset('prototypes/place-qa/native05-world.json.gz'), asset('prototypes/place-qa/native05-coast.json.gz'), asset('prototypes/place-qa/native-water-bridge.json.gz'),
    ...['candidate-state.json', 'candidate-world.json.gz', 'candidate-frame-plans.json'].map(p => `${output}/input/${p}`), `${repo}/package-lock.json`];
const initialInputs = Object.fromEntries([...new Set(used)].sort().map(p => [p, hash(p)]));
const parse = async p => (await new GLTFLoader().parseAsync(Uint8Array.from(gunzipSync(read(p))).buffer, '')).scene;
const kit = a.makeNativeGrowingKit(await parse(asset('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz')), json(kitManifestPath));
const flower = a.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read(asset('prototypes/place-qa/native-flower-support.json.gz')))));
const coveSource = await parse(asset(coveManifest.artifact.path));
coveSource.userData.sourceId = coveManifest.source.id; coveSource.userData.sourceSha256 = coveManifest.source.sha256;
const cove = a.makeNativeAuthoredCove(coveSource, coveManifest);
const base = a.withNative05WaterCarvingScope(a.compileWorldDefinition(JSON.parse(gunzipSync(read(asset('prototypes/place-qa/native05-world.json.gz'))))));
const state = json(`${output}/input/candidate-state.json`).state;
const frame = { ...json(`${output}/input/candidate-frame-plans.json`), world: a.compileWorldDefinition(JSON.parse(gunzipSync(read(`${output}/input/candidate-world.json.gz`)))) };
const layout = a.sceneLayout(state, false, frame.world, frame.waterPlan, base, { options: { water: true, cove: true }, covePlan: frame.covePlan, revision: frame.revision });
const materials = new a.IslandMaterials('moon-garden');
const layer = a.buildObjectLayer(materials, state, layout, undefined, undefined, [], kit, flower, cove);
const ground = a.buildAuthoredGrowingGround(layout,
    JSON.parse(gunzipSync(read(asset('prototypes/place-qa/native05-coast.json.gz')))),
    JSON.parse(gunzipSync(read(asset('prototypes/place-qa/native-water-bridge.json.gz')))));
// The exact world floor is authored separately, with explicit source-normal provenance.
ground.floor.removeFromParent();
const scene = new T.Scene(); scene.name = 'central-shoulder-source-context';
const world = new T.Group(); world.name = 'same-runtime-objects-in-authored-world'; world.position.set(layout.center, 0, 2);
world.add(layer.root, ground.root); scene.add(world); scene.updateMatrixWorld(true);
const objects = [], textures = [];
scene.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of materials) for (const [key, value] of Object.entries(mat)) if (value instanceof T.Texture) textures.push({ object: o.name, material: mat.name, property: key });
    objects.push({ name: o.name, uuid: o.uuid, vertices: o.geometry.attributes.position?.count, triangles: (o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3,
        ownerId: o.userData.ownerId ?? o.userData.objectId ?? null, ownerIds: o.userData.ownerIds ?? null,
        materials: materials.map(mat => ({ name: mat.name, color: mat.color?.toArray(), roughness: mat.roughness, metalness: mat.metalness, transmission: mat.transmission, vertexColors: mat.vertexColors })),
        matrixWorld: o.matrixWorld.toArray() });
});
assert.equal(textures.length, 0, `Context texture export requires explicit preservation: ${JSON.stringify(textures)}`);
globalThis.FileReader = class {
    async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
    async readAsDataURL(blob) { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const exported = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, includeCustomExtensions: true });
fs.writeFileSync(`${output}/source-context.glb`, Buffer.from(exported));
const floors = frame.world.floors.filter(f => f.kind === 'ground' || f.kind === 'deck').map(f => ({ id: f.id, kind: f.kind, color: f.color, vertices: f.vertices, indices: f.indices }));
fs.writeFileSync(`${output}/input/compiled-floors.json`, `${JSON.stringify({ source: 'same compiled candidate world', floors })}\n`);
const finalInputs = Object.fromEntries(Object.keys(initialInputs).map(p => [p, hash(p)]));
assert.deepEqual(finalInputs, initialInputs);
const report = { scope: 'Offline source context using fixed c4 objectLayer and selected SW v3 state/world. Not browser evidence, lighting parity or app acceptance.',
    runtimeRepo, rendererToAuthored: { translation: [layout.center, 0, 2] }, sceneId: scene.name,
    initialInputs, finalInputs, sourceFixed: true, sourceSha256: hash(source), objects, meshCount: objects.length,
    triangles: objects.reduce((n, o) => n + o.triangles, 0), textures, owners: [...state.plots, ...state.landmarks, ...state.keepsakes].filter(o => o.cell).map(o => ({ id: o.id, cell: o.cell })),
    outputSha256: hash(`${output}/source-context.glb`), excluded: ['shared floor rebuilt from identical compiled positions/indices with authored normals', 'residents and real-time animation', 'runtime lighting, camera, ocean shader and UI'] };
fs.writeFileSync(`${output}/context-manifest.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ sourceFixed: true, meshes: report.meshCount, triangles: report.triangles, owners: report.owners.length, outputSha256: report.outputSha256 }));
ground.dispose(); layer.dispose(); materials.dispose(); kit.dispose(); flower.dispose(); cove.dispose();
