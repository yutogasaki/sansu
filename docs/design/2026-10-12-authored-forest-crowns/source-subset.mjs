import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => digest(JSON.stringify(value));
/** Prune reachability only. Keep selected node IDs, ancestors and every binary byte. */
export function subsetOriginalTrees(bytes, selectedIds, T) {
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF'); assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const chunks = [];
    for (let offset = 12; offset < bytes.length;) {
        const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
        chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) }); offset += 8 + length;
    }
    assert.equal(chunks[0].type, 0x4e4f534a);
    const original = JSON.parse(chunks[0].bytes.toString('utf8')), subset = structuredClone(original);
    const parentMap = model => {
        const parents = new Map();
        model.nodes.forEach((node, i) => { for (const child of node.children ?? []) { assert(!parents.has(child)); parents.set(child, i); } });
        return parents;
    };
    const beforeParents = parentMap(original), selected = new Set(selectedIds), needed = new Set(selected);
    for (const id of selected) for (let parent = beforeParents.get(id); parent !== undefined; parent = beforeParents.get(parent)) needed.add(parent);
    const pruned = [];
    for (const id of needed) {
        const node = subset.nodes[id];
        if (node.children) {
            const removed = node.children.filter(child => !needed.has(child));
            node.children = node.children.filter(child => needed.has(child));
            if (removed.length) pruned.push({ parent: id, removedChildren: removed });
        }
    }
    const sceneRoots = [];
    for (const [index, scene] of subset.scenes.entries()) {
        const before = [...scene.nodes]; scene.nodes = scene.nodes.filter(id => needed.has(id));
        sceneRoots.push({ scene: index, before, after: [...scene.nodes] });
    }
    const reached = new Set();
    const visit = id => { if (reached.has(id)) return; reached.add(id); for (const child of subset.nodes[id].children ?? []) visit(child); };
    for (const scene of subset.scenes) scene.nodes.forEach(visit);
    assert.deepEqual([...reached].sort((a, b) => a - b), [...needed].sort((a, b) => a - b));
    const matrices = model => {
        const parents = parentMap(model), cache = new Map();
        const at = id => {
            if (cache.has(id)) return cache.get(id);
            const node = model.nodes[id];
            const local = node.matrix ? new T.Matrix4().fromArray(node.matrix) : new T.Matrix4().compose(
                new T.Vector3(...(node.translation ?? [0, 0, 0])), new T.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new T.Vector3(...(node.scale ?? [1, 1, 1])));
            const value = parents.has(id) ? at(parents.get(id)).clone().multiply(local) : local;
            cache.set(id, value); return value;
        };
        return Object.fromEntries([...selected].map(id => [id, at(id).toArray()]));
    };
    const beforeMatrices = matrices(original), afterMatrices = matrices(subset);
    assert.deepEqual(afterMatrices, beforeMatrices);
    const usedMaterials = [...new Set([...selected].flatMap(id => original.meshes[original.nodes[id].mesh].primitives.map(primitive => primitive.material)))].sort((a, b) => a - b);
    const textureRefs = [];
    const check = (value, location) => {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (/texture$/i.test(key) && child && typeof child === 'object' && 'index' in child) textureRefs.push(`${location}.${key}`);
            check(child, `${location}.${key}`);
        }
    };
    usedMaterials.forEach(index => check(subset.materials[index], `materials[${index}]`));
    assert.deepEqual(textureRefs, [], 'Selected native materials must not require a texture mock');
    const unchangedJson = Object.fromEntries(['accessors', 'meshes', 'materials', 'bufferViews', 'buffers', 'images', 'textures'].map(key => {
        assert.deepEqual(subset[key], original[key]); return [key, jsonHash(original[key] ?? null)];
    }));
    const text = Buffer.from(JSON.stringify(subset));
    const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20); text.copy(padded);
    const outputChunks = [{ type: chunks[0].type, bytes: padded }, ...chunks.slice(1)];
    const header = Buffer.alloc(12); header.write('glTF'); header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.bytes.length, 0), 8);
    const output = Buffer.concat([header, ...outputChunks.flatMap(chunk => {
        const head = Buffer.alloc(8); head.writeUInt32LE(chunk.bytes.length); head.writeUInt32LE(chunk.type, 4); return [head, chunk.bytes];
    })]);
    return { bytes: output, proof: { scope: 'Reachability-only source subset; no mesh/material/accessor/binary edits',
        originalSha256: digest(bytes), subsetSha256: digest(output), selectedNodeIds: [...selected], ancestorNodeIds: [...needed].filter(id => !selected.has(id)),
        selectedMatrixWorldBefore: beforeMatrices, selectedMatrixWorldAfter: afterMatrices, matrixWorldIdentical: true,
        nonJsonChunks: chunks.slice(1).map(chunk => ({ type: chunk.type, bytes: chunk.bytes.length, beforeSha256: digest(chunk.bytes), afterSha256: digest(chunk.bytes) })),
        unchangedJson, usedMaterials, usedMaterialTextureReferences: textureRefs, sceneRoots, prunedChildren: pruned } };
}
