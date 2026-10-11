import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/design/2026-10-10-island-final-3d/whole-island.glb');
const output = path.join(root, 'docs/design/2026-10-10-native-art-transfer');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedSource = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';

// Split semantic parts, never infer gameplay ownership from the model's count.
function moduleFor(name) {
    if (/^(Original Pokomoko|Pokomoko|Rabbit|Fox) \/ /.test(name)) return { id: `figure:${name.split(' / ').slice(0, -1).join(' / ')}`, role: 'reference-figure' };
    if (name.startsWith('Original home / ')) return { id: 'home:original', role: 'home' };
    const home = name.match(/^([^/]+) \/ ([^/]+(?:home|house)) \/ /);
    if (home) return { id: `home:${home[1]}:${home[2]}`, role: 'home' };
    if (/^(Island|Coast) \/ /.test(name) || /^(Ground \/ grown contour meadow|Garden \/ rounded flower terrace)/.test(name)) return { id: 'land', role: 'terrain' };
    if (/^Ocean \/ (tide and reflected sky|shore ripple|short quiet wave)/.test(name)) return { id: 'sea', role: 'water' };
    if (/^Grove \/ (great |fan |broad silver fan|hollow |grown doorway|root house|continuous bough|crescent gallery|gallery grown|spiral )/.test(name)) return { id: 'great-tree', role: 'place' };
    if (/^(Hill|Ocean) \/ /.test(name) || /^Inlet \/ (continuous spring|flowing spring|mineral|soft spray|spring impact|terrace connecting)/.test(name)) return { id: 'terraced-spring', role: 'place' };
    if (/^Harbor \/ /.test(name)) return { id: 'shell-hall', role: 'place' };
    if (/^(Flower tree \d+|Flowers) \/ /.test(name) || /^Garden \/ (connected flower|riverbank wildflower)/.test(name) || /^Whole island \/ flower meeting/.test(name)) return { id: 'flower-garden', role: 'place' };
    if (/^(Inlet|Village|Water town) \/ /.test(name) || /route|approach|stair|walk|ascent|bridge|living arch|willow span/.test(name)) return { id: 'connections', role: 'connection' };
    return { id: 'forest', role: 'place' };
}

const source = await readFile(sourcePath);
if (sha(source) !== expectedSource) throw new Error('Native-05 source revision differs; do not silently replace the benchmark.');
const jsonLength = source.readUInt32LE(12);
const original = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const model = structuredClone(original);
const scene = model.scenes[model.scene ?? 0];
if (scene.nodes.length !== 3690 || scene.nodes.some((node, index) => node !== index)
    || model.nodes.some(n => n.children?.length)) throw new Error('Unexpected native hierarchy or source order; revisit module extraction.');
const modules = new Map();
for (const index of scene.nodes) {
    const node = model.nodes[index];
    const part = moduleFor(node.name);
    if (!modules.has(part.id)) modules.set(part.id, { ...part, children: [], sourceNames: [], triangles: 0 });
    const module = modules.get(part.id);
    module.children.push(index); module.sourceNames.push(node.name);
    for (const primitive of model.meshes[node.mesh].primitives) module.triangles += model.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
}
scene.nodes = [];
for (const module of modules.values()) {
    scene.nodes.push(model.nodes.length);
    model.nodes.push({ name: `native05:${module.id}`, children: module.children,
        extras: { nativeModule: module.id, nativeRole: module.role, sourceRevision: expectedSource } });
}
scene.name = 'native-05-art-transfer-v1';
const json = Buffer.from(JSON.stringify(model));
const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(paddedJson);
const tail = source.subarray(20 + jsonLength);
const file = Buffer.alloc(20 + paddedJson.length + tail.length);
file.write('glTF'); file.writeUInt32LE(2, 4); file.writeUInt32LE(file.length, 8);
file.writeUInt32LE(paddedJson.length, 12); file.writeUInt32LE(0x4e4f534a, 16);
paddedJson.copy(file, 20); tail.copy(file, 20 + paddedJson.length);
// The entire source geometry, embedded image data and every original node survive.
if (!file.subarray(20 + paddedJson.length).equals(tail)) throw new Error('Native geometry buffer changed.');
for (let i = 0; i < original.nodes.length; i++) if (JSON.stringify(model.nodes[i]) !== JSON.stringify(original.nodes[i])) throw new Error(`Native transform changed: ${i}`);
for (const key of ['materials', 'meshes', 'accessors', 'bufferViews', 'buffers', 'images', 'textures', 'samplers']) {
    if (JSON.stringify(model[key]) !== JSON.stringify(original[key])) throw new Error(`Native data changed: ${key}`);
}
if (sha(await readFile(sourcePath)) !== expectedSource) throw new Error('Native source changed while exporting.');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'native05-modules.glb'), file);
const manifest = { candidate: scene.name, source: '../2026-10-10-island-final-3d/whole-island.glb', sourceSha256: expectedSource,
    modelSha256: sha(file), bufferSha256: sha(tail), preservedSourceNodes: original.nodes.length,
    preservedMaterials: original.materials.length, preservedTextures: original.images.length,
    preservedTriangles: [...modules.values()].reduce((n, m) => n + m.triangles, 0),
    invariants: { originalNodeTransforms: true, entireBinaryBuffer: true, materialDefinitions: true, sourceUnchanged: true },
    modules: [...modules.values()].map(({ children, ...module }) => ({ ...module, meshes: children.length })),
    gameplay: { ownershipMapped: false, navigationMapped: false, growthMapped: false, defaultDelivery: false } };
await writeFile(path.join(output, 'module-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(output, 'runtime-manifest.json'), JSON.stringify({ candidate: manifest.candidate,
    sourceSha256: expectedSource, modelSha256: manifest.modelSha256,
    meshes: manifest.preservedSourceNodes, triangles: manifest.preservedTriangles,
    meshModules: original.nodes.map(node => [...modules.keys()].indexOf(moduleFor(node.name).id)),
    modules: manifest.modules.map(({ id, role, meshes }) => ({ id, role, meshes })) }, null, 2) + '\n');
console.log(JSON.stringify({ candidate: manifest.candidate, modules: modules.size, meshes: manifest.preservedSourceNodes,
    triangles: manifest.preservedTriangles, bytes: file.length, invariants: manifest.invariants }));
