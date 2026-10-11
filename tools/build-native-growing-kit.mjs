import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import * as T from 'three';

const folder = 'docs/design/2026-10-11-native-owned-island';
const source = await readFile('docs/design/2026-10-10-island-final-3d/whole-island.glb');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceSha256 = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
if (sha(source) !== sourceSha256) throw Error('Approved native-05 source differs');
const jsonSize = source.readUInt32LE(12);
const original = JSON.parse(source.subarray(20, 20 + jsonSize));
const binary = source.subarray(28 + jsonSize);
const named = prefix => name => name.startsWith(prefix);
const parts = {
    cottage: named('Original home / '),
    home: named('Forest / blue home / '),
    'home-upper': named('Village / matured common house / '),
    'home-cap': named('Hill / blue terrace home / '),
    'home-leaf': named('Harbor / peninsula home / '),
    willow: name => name.startsWith('Grove tree 1 / ') || name.startsWith('Grove / living willow 1 / '),
    birch: named('Grove / silver birch 0 / '),
    spire: named('Grove / spire tree 0 / '),
    'fan-crown': name => /^Grove \/ (broad silver fan leaf|fan leaf raised midrib|fan crown grown bough)/.test(name),
    'hollow-trunk': name => /^Grove \/ (great root house trunk|hollow doorway grown edge|root house cobalt entry|root house window|grown doorway buttress)/.test(name),
    'flower-crown': name => /^Flowers \/ (shared giant petal canopy|scalloped upper petal|joined blossom heart)/.test(name),
    'shell-roof': name => /^Harbor \/ (continuous translucent shell hall|curved shell structural rib|shell longitudinal seam)/.test(name),
};
const matrix = node => node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
    new T.Vector3().fromArray(node.translation ?? [0, 0, 0]), new T.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new T.Vector3().fromArray(node.scale ?? [1, 1, 1]));
function bounds(nodes) {
    const box = new T.Box3(), point = new T.Vector3();
    for (const node of nodes) for (const primitive of original.meshes[node.mesh].primitives) {
        const accessor = original.accessors[primitive.attributes.POSITION], view = original.bufferViews[accessor.bufferView];
        const stride = view.byteStride ?? 12, start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), transform = matrix(node);
        for (let i = 0; i < accessor.count; i++) box.expandByPoint(point.set(binary.readFloatLE(start + i * stride), binary.readFloatLE(start + i * stride + 4), binary.readFloatLE(start + i * stride + 8)).applyMatrix4(transform));
    }
    return { min: box.min.toArray(), max: box.max.toArray() };
}

const model = { asset: { version: '2.0', generator: 'Sansu approved native-05 lossless parts' }, scene: 0,
    scenes: [{ name: 'native05-owned-kit-v1', nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], materials: [], buffers: [] };
if (original.extensionsUsed) model.extensionsUsed = original.extensionsUsed;
if (original.extensionsRequired) model.extensionsRequired = original.extensionsRequired;
const maps = { meshes: new Map(), accessors: new Map(), views: new Map(), materials: new Map() }, chunks = [];
let length = 0;
const copyView = index => {
    if (maps.views.has(index)) return maps.views.get(index);
    const old = original.bufferViews[index], bytes = binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength);
    const next = model.bufferViews.length; maps.views.set(index, next);
    const padding = (4 - length % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    model.bufferViews.push({ ...old, buffer: 0, byteOffset: length }); chunks.push(bytes); length += bytes.length; return next;
};
const copyAccessor = index => {
    if (maps.accessors.has(index)) return maps.accessors.get(index);
    const old = original.accessors[index]; if (old.sparse) throw Error('Sparse accessor requires explicit extraction');
    const next = model.accessors.length; maps.accessors.set(index, next);
    model.accessors.push({ ...old, bufferView: copyView(old.bufferView) }); return next;
};
const copyMaterial = index => {
    if (maps.materials.has(index)) return maps.materials.get(index);
    const material = original.materials[index];
    if (/Texture/.test(JSON.stringify(material))) throw Error('Owned kit must not silently drop textures');
    const next = model.materials.length; maps.materials.set(index, next); model.materials.push(material); return next;
};
const copyMesh = index => {
    if (maps.meshes.has(index)) return maps.meshes.get(index);
    const old = original.meshes[index], next = model.meshes.length; maps.meshes.set(index, next);
    model.meshes.push({ ...old, primitives: old.primitives.map(p => ({ ...p,
        attributes: Object.fromEntries(Object.entries(p.attributes).map(([key, value]) => [key, copyAccessor(value)])),
        indices: copyAccessor(p.indices), material: copyMaterial(p.material) })) }); return next;
};
const manifest = { candidate: 'native05-owned-kit-v1', sourceSha256, generation: 'none; lossless source geometry and materials', parts: {} };
for (const [id, matches] of Object.entries(parts)) {
    const nodes = original.nodes.filter(n => n.mesh !== undefined && matches(n.name));
    if (!nodes.length) throw Error(`No source parts: ${id}`);
    const children = [];
    for (const node of nodes) { children.push(model.nodes.length); model.nodes.push({ ...node, mesh: copyMesh(node.mesh) }); }
    model.scenes[0].nodes.push(model.nodes.length); model.nodes.push({ name: id, children, extras: { nativePart: id } });
    manifest.parts[id] = { ...bounds(nodes), sourceNames: nodes.map(n => n.name), meshes: nodes.length,
        triangles: nodes.reduce((n, node) => n + original.meshes[node.mesh].primitives.reduce((n, p) => n + original.accessors[p.indices].count / 3, 0), 0) };
}
// Keep the authored shore's asymmetry as a bank profile. This does not make its
// model cells into owned cells; the runtime wraps the preserved owned rectangle.
const coast = original.nodes.find(n => n.name === 'Coast / continuous layered shore');
const points = [];
for (const p of original.meshes[coast.mesh].primitives) {
    const a = original.accessors[p.attributes.POSITION], v = original.bufferViews[a.bufferView], transform = matrix(coast);
    for (let i = 0; i < a.count; i++) {
        const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? 12);
        const point = new T.Vector3(binary.readFloatLE(start), binary.readFloatLE(start + 4), binary.readFloatLE(start + 8)).applyMatrix4(transform);
        points.push([Math.atan2(point.z + 6.3, point.x - 3), Math.hypot(point.x - 3, point.z + 6.3)]);
    }
}
const radii = Array.from({ length: 96 }, (_, i) => {
    const angle = -Math.PI + i * Math.PI * 2 / 96;
    const values = points.filter(([a]) => Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle))) < .11).map(([, r]) => r);
    if (!values.length) throw Error('Unsampled native shore');
    return Math.max(...values);
});
const low = Math.min(...radii), high = Math.max(...radii);
manifest.shoreProfile = radii.map(r => Number(((r - low) / (high - low)).toFixed(6)));
const rawBinary = Buffer.concat(chunks); model.buffers.push({ byteLength: rawBinary.length });
const json = Buffer.from(JSON.stringify(model)), padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
const paddedBinary = Buffer.alloc(Math.ceil(rawBinary.length / 4) * 4); rawBinary.copy(paddedBinary);
const kit = Buffer.alloc(28 + padded.length + paddedBinary.length);
kit.write('glTF'); kit.writeUInt32LE(2, 4); kit.writeUInt32LE(kit.length, 8); kit.writeUInt32LE(padded.length, 12); kit.writeUInt32LE(0x4e4f534a, 16); padded.copy(kit, 20);
kit.writeUInt32LE(paddedBinary.length, 20 + padded.length); kit.writeUInt32LE(0x004e4942, 24 + padded.length); paddedBinary.copy(kit, 28 + padded.length);
const compressed = gzipSync(kit, { level: 9, mtime: 0 });
Object.assign(manifest, { sha256: sha(kit), gzipSha256: sha(compressed), bytes: kit.length, gzipBytes: compressed.length,
    sourceMeshes: Object.values(manifest.parts).reduce((n, p) => n + p.meshes, 0), triangles: Object.values(manifest.parts).reduce((n, p) => n + p.triangles, 0), materials: model.materials.length });
if (compressed.length > 3 * 1024 * 1024) throw Error('Owned kit exceeds its 3 MiB offline budget');
// Verify that every copied accessor still addresses the original bytes.
for (const [oldId, newId] of maps.views) {
    const old = original.bufferViews[oldId], next = model.bufferViews[newId];
    if (!binary.subarray(old.byteOffset ?? 0, (old.byteOffset ?? 0) + old.byteLength).equals(rawBinary.subarray(next.byteOffset, next.byteOffset + next.byteLength))) throw Error('Source buffer drift');
}
if (sha(await readFile('docs/design/2026-10-10-island-final-3d/whole-island.glb')) !== sourceSha256) throw Error('Source changed during build');
await mkdir(folder, { recursive: true });
await writeFile(`${folder}/native05-owned-kit.glb.gz`, compressed);
await writeFile(`${folder}/kit-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ candidate: manifest.candidate, bytes: kit.length, gzipBytes: compressed.length, parts: Object.keys(parts), triangles: manifest.triangles, sourceBuffersExact: true }));
