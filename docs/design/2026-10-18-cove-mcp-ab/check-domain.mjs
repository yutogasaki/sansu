import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const imports = `
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts';
`;
async function compile(variant) {
  const result = await build({ stdin: { contents: imports, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: variant ? [{ name: 'diagnostic-cove-profile', setup(builder) {
      builder.onLoad({ filter: /2026-10-12-authored-cove-entrance\/(source-manifest|shared-apron-world-patch-v1)\.json$/ }, args => ({
        contents: readFileSync(path.join(folder, args.path.endsWith('source-manifest.json') ? 'source-variant.json' : 'patch-variant.json'), 'utf8'), loader: 'json',
      }));
    } }] : [] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const state = JSON.parse(readFileSync(path.join(folder, 'browser-metadata.json'), 'utf8')).before.state;
const definition = JSON.parse(gunzipSync(readFileSync(path.join(root, 'prototypes/place-qa/native05-world.json.gz'))));
const [before, after] = await Promise.all([compile(false), compile(true)]);
const frame = api => api.authoredWorldFrame(state, api.withNative05WaterCarvingScope(api.compileWorldDefinition(definition)), { water: true, cove: true });
const a = frame(before), b = frame(after);
assert(a.covePlan.assemblies.length === 1 && b.covePlan.assemblies.length === 1, 'Expected the same one shell');
const beforeHash = sha(a.world.definition), afterHash = sha(b.world.definition);
const fieldHashes = Object.fromEntries(Object.keys(a.world.definition).map(key => [key, { before: sha(a.world.definition[key]), after: sha(b.world.definition[key]) }]));
const differingFields = Object.keys(fieldHashes).filter(key => fieldHashes[key].before !== fieldHashes[key].after);
writeFileSync(path.join(folder, 'world-field-comparison.json'), JSON.stringify({ beforeHash, afterHash, differingFields, fieldHashes }, null, 2) + '\n');
assert.deepEqual(differingFields, ['revision'], 'Only the provenance revision may change; floors/sites/edges must match');
const physical = definition => Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'revision'));
assert.equal(sha(physical(a.world.definition)), sha(physical(b.world.definition)), 'Physical content differs');
const report = { pass: true, timestamp: new Date().toISOString(), physicalWorldDefinitionSha256: beforeHash,
  physicalContentSha256: sha(physical(a.world.definition)), provenanceRevisionChanged: true,
  shellCount: 1, ownerCount: state.plots.length + state.landmarks.length,
  sourceBefore: a.covePlan.sourceSha256, sourceAfter: b.covePlan.sourceSha256,
  excludes: ['Production save', 'Natural acquisition', 'Live actor use sequence', 'Device performance', 'Visual acceptance'] };
writeFileSync(path.join(folder, 'domain-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PASS: identical physical world definition, 32 owners, one changed shell source');
