import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makePlacePack } from './growing-place-fixtures.mjs';

const out = 'docs/design/2026-10-11-island-landscape-art';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const compiled = await build({ stdin: { contents: `export {makeNativeGrowingKit} from './src/components/island/growing/native/nativeGrowingKit.ts';
    export {buildObjectLayer} from './src/components/island/growing/objectLayer.ts';
    export {sceneLayout} from './src/components/island/growing/sceneLayout.ts';
    export {IslandMaterials} from './src/components/island/three/primitives.ts';`, resolveDir: process.cwd() }, bundle: true,
    packages: 'external', platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
await mkdir(out, { recursive: true });
const temporary = `${out}/.compiled-owned-export.mjs`;
await writeFile(temporary, compiled.outputFiles[0].text);
const { makeNativeGrowingKit, buildObjectLayer, sceneLayout, IslandMaterials } = await import(`../${temporary}`);
const manifest = JSON.parse(await readFile('docs/design/2026-10-11-native-owned-island/kit-manifest.json'));
const raw = gunzipSync(await readFile('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
assert.equal(sha(raw), manifest.sha256);
const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer, '');
const kit = makeNativeGrowingKit(gltf.scene, manifest);
const pack = await makePlacePack();
const sample = pack.cases.find(c => c.id === 'qa-place-whole-island-v1');
const state = sample.island.state, layout = sceneLayout(state), m = new IslandMaterials('moon-garden');
const layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit), root = new T.Group();
root.name = 'landscape-art-owned-parts';
const selected = [...state.plots.filter(p => p.kind === 'home'), ...state.landmarks.filter(l => ['sapling', 'bench', 'flower', 'water-bowl'].includes(l.kind) && l.cell),
    ...state.plots.filter(p => p.kind === 'play')];
for (const owner of selected) {
    const body = layer.objects.get(owner.id).children[0].clone(true); body.visible = true;
    const holder = new T.Group(); holder.name = `owned:${owner.id}`; holder.userData = { ownerId: owner.id, kind: owner.kind,
        savedCell: owner.cell, stage: owner.stage ?? null, roof: owner.roof ?? null, style: owner.style ?? null };
    holder.add(body); root.add(holder);
}
// No DOM/canvas or generated bitmap is needed for these actual meshes/materials.
root.traverse(object => { if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material])
    assert(!material.map, `Unexpected texture export: ${material.name}`); });
globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const bytes = Buffer.from(await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true }));
await writeFile(`${out}/owned-parts.glb`, bytes);
const appInputs = Object.fromEntries(await Promise.all(Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>').sort()
    .map(async file => [file, sha(await readFile(file))])));
const owners = [...state.plots, ...state.landmarks].map(owner => ({ id: owner.id, kind: owner.kind, cell: owner.cell ?? null,
    stage: owner.stage ?? null, growth: owner.growth ?? null, style: owner.style ?? null, roof: owner.roof ?? null }));
const report = { candidate: 'native05-landscape-owned-art-v6', artOnly: true, gameplayMapped: false,
    sourceSha256: manifest.sourceSha256, kitSha256: manifest.sha256, sample: sample.id, synthetic: true, conditions: sample.conditions,
    owners, homes: owners.filter(o => o.kind === 'home').length, placed: owners.filter(o => o.cell).length,
    stored: owners.filter(o => !o.cell).length, partsSha256: sha(bytes), appInputs, places: sample.projection.places };
assert.equal(report.homes, 8); assert.equal(report.placed, 27); assert.equal(report.stored, 2);
await writeFile(`${out}/owned-input.json`, JSON.stringify(report, null, 2) + '\n');
layer.dispose(); m.dispose(); kit.dispose();
const { unlink } = await import('node:fs/promises'); await unlink(temporary);
console.log(JSON.stringify({ candidate: report.candidate, homes: report.homes, placed: report.placed, stored: report.stored,
    actualGeometryExported: true, bytes: bytes.length, partsSha256: report.partsSha256 }));
