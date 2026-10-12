import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { subsetOriginalTrees } from './source-subset.mjs';

// PREPARED ONLY. Parent schedules this single offline domain/GLB process.
assert.equal(process.env.SANSU_FOREST_RUN_APPROVED, '1', 'Offline execution remains held until parent schedules it');
const here = path.dirname(fileURLToPath(import.meta.url));
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const study = json(path.join(here, 'study.json')), repo = study.runtimeRepo;
const out = path.join(here, 'extraction-attempt02');
assert(!fs.existsSync(out), 'Fresh extraction only; preserve every prior attempt');
fs.mkdirSync(out);
const asset = file => path.join(repo, file.replace(/^\//, ''));
const require = createRequire(path.join(repo, 'package.json'));
const { build } = require('esbuild');
const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js');
const T = await import(threeModule);
const { GLTFLoader } = await import(require.resolve('three/addons/loaders/GLTFLoader.js'));
const { GLTFExporter } = await import(require.resolve('three/addons/exporters/GLTFExporter.js'));
for (const [file, entry] of Object.entries(study.inputs)) assert.equal(hash(file), entry.sha256, `Prepared source changed: ${file}`);
const compiled = await build({ absWorkingDir: repo, stdin: { contents: `
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts';
export { sceneLayout } from './src/components/island/growing/sceneLayout.ts';
export { buildObjectLayer } from './src/components/island/growing/objectLayer.ts';
export { IslandMaterials } from './src/components/island/three/primitives.ts';
export { makeNativeGrowingKit } from './src/components/island/growing/native/nativeGrowingKit.ts';
export { makeNativeAuthoredFlower } from './src/components/island/growing/native/nativeAuthoredFlower.ts';
export { makeNativeAuthoredCove } from './src/components/island/growing/native/nativeAuthoredCove.ts';
export { makeNativeAuthoredShoulder } from './src/components/island/growing/native/nativeAuthoredShoulder.ts';
export { buildAuthoredGrowingGround } from './src/components/island/growing/native/authoredGrowingGround.ts';
`, resolveDir: repo, loader: 'ts' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false, metafile: true, logLevel: 'silent' });
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(name => name === 'three' ? T : require(name), module, module.exports);
const api = module.exports;
const kitManifestPath = asset('docs/design/2026-10-11-native-owned-island/kit-manifest.json');
const kitManifest = json(kitManifestPath);
const coveManifestPath = asset('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
const coveManifest = json(coveManifestPath);
const shoulderManifestPath = asset('prototypes/place-qa/native-shoulder-manifest.json');
const shoulderManifest = json(shoulderManifestPath);
const raw = file => JSON.parse(gunzipSync(fs.readFileSync(asset(file))));
const used = new Set([...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>').map(file => path.resolve(repo, file)),
    ...Object.keys(study.inputs), kitManifestPath, coveManifestPath, shoulderManifestPath,
    asset('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'),
    asset('prototypes/place-qa/native-flower-support.json.gz'), asset(coveManifest.artifact.path), asset(shoulderManifest.artifact.path),
    ...['native05-world-source-shading.json.gz', 'authored-shoulder-profile.json.gz', 'native05-coast.json.gz', 'native-water-bridge.json.gz'].map(file => asset(`prototypes/place-qa/${file}`)),
    threeModule, require.resolve('three/addons/loaders/GLTFLoader.js'), require.resolve('three/addons/exporters/GLTFExporter.js'),
    asset('node_modules/.package-lock.json')]);
const before = Object.fromEntries([...used].sort().map(file => [file, hash(file)]));
const core = json('/private/tmp/sansu-authored-shoulder-c1/core/report.json');
assert(core.pass && core.sourceFixed);
for (const file of Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>')) {
    const absolute = path.resolve(repo, file), relative = path.relative(repo, absolute);
    assert(!relative.startsWith('../')); assert.equal(core.finalInputs[relative], hash(absolute), `C1 source closure: ${relative}`);
}
const parse = async (file, zipped = true) => {
    const bytes = fs.readFileSync(file), expanded = zipped ? gunzipSync(bytes) : bytes;
    return (await new GLTFLoader().parseAsync(Uint8Array.from(expanded).buffer, '')).scene;
};
const kit = api.makeNativeGrowingKit(await parse(asset('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz')), kitManifest);
const flower = api.makeNativeAuthoredFlower(raw('prototypes/place-qa/native-flower-support.json.gz'));
const coveSource = await parse(asset(coveManifest.artifact.path));
coveSource.userData.sourceId = coveManifest.source.id; coveSource.userData.sourceSha256 = coveManifest.source.sha256;
const cove = api.makeNativeAuthoredCove(coveSource, coveManifest);
const shoulderSource = await parse(asset(shoulderManifest.artifact.path));
shoulderSource.userData.sourceId = shoulderManifest.source.id; shoulderSource.userData.sourceSha256 = shoulderManifest.artifact.expandedSha256;
const shoulder = api.makeNativeAuthoredShoulder(shoulderSource, shoulderManifest);
const base = api.withNative05WaterCarvingScope(api.compileWorldDefinition(raw('prototypes/place-qa/native05-world-source-shading.json.gz')));
const profile = raw('prototypes/place-qa/authored-shoulder-profile.json.gz');
const state = json(study.referenceStatePath).state;
assert.deepEqual(state, study.referenceState);
const options = { water: true, cove: true, shoulder: profile };
const frame = api.authoredWorldFrame(state, base, options);
const layout = api.sceneLayout(state, false, frame.world, frame.waterPlan, base, { options, covePlan: frame.covePlan, revision: frame.revision });
const materials = new api.IslandMaterials('moon-garden');
const layer = api.buildObjectLayer(materials, state, layout, undefined, undefined, [], kit, flower, cove, shoulder);
const ground = api.buildAuthoredGrowingGround(layout, raw('prototypes/place-qa/native05-coast.json.gz'), raw('prototypes/place-qa/native-water-bridge.json.gz'));
const soil = shoulder.instanceSoil(layout); assert(soil, 'Exact committed shoulder soil must remain');
const context = new T.Scene(); context.name = 'fixed-c1-context-with-four-source-trees-extracted';
const world = new T.Group(); world.position.set(layout.center, 0, 2); world.name = 'renderer-to-authored-once';
world.add(layer.root, ground.root, soil); context.add(world); context.updateMatrixWorld(true);
const selectedNodeIds = [...new Set(Object.values(study.owners).flatMap(owner => owner.roles.map(role => role.nodeIndex)))];
assert.equal(selectedNodeIds.length, 115);
const subset = subsetOriginalTrees(fs.readFileSync(study.originalSource), selectedNodeIds, T);
fs.writeFileSync(path.join(out, 'original-tree-role-subset.glb'), subset.bytes);
fs.writeFileSync(path.join(out, 'source-subset-proof.json'), JSON.stringify(subset.proof, null, 2));
const original = await parse(path.join(out, 'original-tree-role-subset.glb'), false); original.updateMatrixWorld(true);
const roleScene = new T.Scene(); roleScene.name = 'four-original-owned-trees-separated-by-source-role';
const bindings = {};
const bytesHash = values => createHash('sha256').update(Buffer.from(values.buffer, values.byteOffset, values.byteLength)).digest('hex');
for (const [ownerId, owner] of Object.entries(study.owners)) {
    const matches = []; context.traverse(object => { if (object.name === 'place-native-owned-tree' && object.userData.ownerId === ownerId) matches.push(object); });
    assert.equal(matches.length, 1, `Unique real owner ${ownerId}`);
    const holder = matches[0], tree = holder.children.find(child => child.userData.nativePart === owner.species);
    assert(tree, `Original species for ${ownerId}`);
    assert(Math.abs(tree.scale.x - owner.expectedUniformScale) < 1e-10);
    const sourceToWorld = tree.matrixWorld.clone().multiply(new T.Matrix4().makeTranslation(...owner.pivotSourceGltf.map(value => -value)));
    const root = new T.Group(); root.name = `forest-role-owner-${ownerId}`; root.matrix.copy(sourceToWorld); root.matrixAutoUpdate = false;
    root.userData = { ownerId, ownerIds: [ownerId], species: owner.species, sourceSha256: study.sourceSha256, roleStudy: true };
    const parts = [];
    for (const role of owner.roles) {
        const candidates = []; original.traverse(object => { if (object instanceof T.Mesh && (object.userData.name ?? object.name) === role.name) candidates.push(object); });
        assert.equal(candidates.length, 1, `Exact source node ${role.name}`);
        const source = candidates[0], mesh = source.clone(false);
        mesh.name = `role-${ownerId}-${role.nodeIndex}`; mesh.matrix.copy(source.matrixWorld); mesh.matrixAutoUpdate = false;
        mesh.userData = { ownerId, ownerIds: [ownerId], sourceNodeIndex: role.nodeIndex, sourceName: role.name,
            forestRole: role.role, forestOrdinal: role.suffixOrdinal, forestFixed: role.fixed, sourceSha256: study.sourceSha256 };
        root.add(mesh);
        parts.push({ objectName: mesh.name, sourceNodeIndex: role.nodeIndex, sourceName: role.name, role: role.role, fixed: role.fixed,
            sourceMatrixWorld: source.matrixWorld.toArray(), geometry: { position: bytesHash(source.geometry.attributes.position.array),
                normal: bytesHash(source.geometry.attributes.normal.array), index: bytesHash(source.geometry.index.array) },
            materials: (Array.isArray(source.material) ? source.material : [source.material]).map(material => material.name) });
    }
    roleScene.add(root);
    bindings[ownerId] = { record: owner.record, species: owner.species, age: owner.age, sourcePivot: owner.pivotSourceGltf,
        sourceScale: owner.sourceScale, ageScale: owner.ageScale, authoredTreeMatrixWorld: tree.matrixWorld.toArray(),
        sourceToAuthoredMatrix: sourceToWorld.toArray(), parts };
    tree.removeFromParent(); // Replace exactly once, no old crown behind the role-separated tree.
}
assert.equal(Object.values(bindings).reduce((sum, value) => sum + value.parts.length, 0), 128);
const actualRoots = []; context.traverse(object => { if (object.name === 'authored-tree-root-continuation') actualRoots.push(object.userData.ownerId); });
assert.deepEqual(actualRoots.sort(), ['l33', 'l34', 'l35']);
const textures = []; context.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
        for (const [key, value] of Object.entries(material)) if (value instanceof T.Texture) textures.push({ node: object.name, key });
});
assert.deepEqual(textures, [], 'Never silently lose native texture data in offline export');
globalThis.FileReader = class {
    async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
    async readAsDataURL(blob) { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const exportGlb = async (scene, name) => {
    scene.updateMatrixWorld(true);
    fs.writeFileSync(path.join(out, name), Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, includeCustomExtensions: true })));
};
await exportGlb(context, 'fixed-c1-context.glb');
await exportGlb(roleScene, 'role-separated-originals.glb');
const after = Object.fromEntries(Object.keys(before).map(file => [file, hash(file)])); assert.deepEqual(after, before);
fs.writeFileSync(path.join(out, 'bindings.json'), JSON.stringify({ frameRevision: frame.revision, rendererToAuthored: [layout.center, 0, 2], bindings }, null, 2));
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ status: 'Offline extraction only; no modified geometry clearance or art approval',
    initialInputs: before, finalInputs: after, sourceFixed: true, frameRevision: frame.revision,
    owners: state.plots.length + state.landmarks.length, replacedWholeTreeOwners: Object.keys(bindings), fixedShoulderRootOwners: actualRoots,
    sourceSubset: subset.proof,
    files: Object.fromEntries(['fixed-c1-context.glb', 'role-separated-originals.glb', 'bindings.json', 'original-tree-role-subset.glb', 'source-subset-proof.json'].map(file => [file, hash(path.join(out, file))])),
    limitations: ['Owner layer only: no resident life rig or animation', 'Blender lighting/ocean/transmission shader differs from app',
        'Three water ripple line primitives may not survive Blender import/export', 'Exact branch/crown clearance not yet audited'], runtimeIntegrated: false, independentObservers: 0 }, null, 2));
console.log(JSON.stringify({ status: 'SOURCE_EXTRACTION_COMPLETE', output: out, frameRevision: frame.revision, roleNodes: 128 }));
ground.dispose(); layer.dispose(); materials.dispose(); kit.dispose(); flower.dispose(); cove.dispose(); shoulder.dispose();
