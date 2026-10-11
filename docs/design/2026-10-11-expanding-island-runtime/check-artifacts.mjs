import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { digestFiles } from '../../../tools/verify-growing.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url)), manifest = JSON.parse(await fs.readFile(dir + 'models.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.candidate, 'native05-expanding-runtime-v2');
assert.deepEqual(await digestFiles(process.cwd(), Object.keys(manifest.sources)), manifest.sources);
const actual = [];
for (const model of manifest.models) {
    const gzip = await fs.readFile(dir + model.gzipFile), bytes = gunzipSync(gzip);
    assert.equal(gzip.length, model.gzipBytes); assert.equal(sha(gzip), model.gzipSha256);
    assert.equal(bytes.length, model.bytes); assert.equal(sha(bytes), model.sha256);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const root = gltf.nodes.find(node => node.name === model.id), record = root?.extras?.ownedRecord;
    assert.equal(record.profileId, model.id); assert.equal(record.state.seed, model.id); assert.equal(record.version, 4);
    const homes = record.state.plots.filter(owner => owner.kind === 'home' && owner.cell);
    assert.equal(homes.length, model.homes); assert.equal(record.state.villagers.length, model.homes);
    const renderedOwners = new Set(gltf.nodes.map(node => node.extras?.objectId));
    for (const owner of [...record.state.plots, ...record.state.landmarks]) {
        assert.equal(renderedOwners.has(owner.id), Boolean(owner.cell), `${model.file}: actual placed owner ${owner.id}`);
    }
    assert.equal(root.extras.projection, manifest.projection);
    actual.push({ file: model.gzipFile, homes: homes.length, nodes: gltf.nodes.length, meshCount: gltf.meshes.length, pass: true });
}
const blend = await fs.readFile(dir + 'expanding-islands.blend');
const result = { candidate: manifest.candidate, models: actual, editable: { file: 'expanding-islands.blend', bytes: blend.length, sha256: sha(blend) }, pass: true };
await fs.writeFile(dir + 'artifact-check.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
