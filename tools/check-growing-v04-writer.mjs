import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { build } from 'esbuild';
import { digestFiles } from './verify-growing.mjs';

const manifests = await Promise.all(['OLD', 'NEW'].map(async name => JSON.parse(await fs.readFile(process.env[`SANSU_GROWING_${name}_MANIFEST`], 'utf8'))));
const output = process.env.SANSU_GROWING_LEGACY_OUTPUT;
assert(output, 'Specify a new diagnostic output file');
for (const m of manifests) assert.deepEqual(await digestFiles(m.sourceDir, Object.keys(m.inputs)), m.inputs);
async function load(root) {
    const result = await build({ stdin: { contents: `
        export { GrowingIslandDatabase, syncGrowingIsland, commandGrowingIsland, deleteGrowingOwner } from './src/domain/growingIsland/repository.ts';
        export { IslandLifeDatabase } from './src/domain/islandLife/repository.ts';`, resolveDir: root },
        bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
        define: { 'import.meta.env': JSON.stringify({ DEV: false, BASE_URL: '/' }), __LIFE_REPLAY_VERSION__: '"v04-writer-diagnostic"', __APP_VERSION__: '"v04-writer-diagnostic"' } });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const [old, current] = await Promise.all(manifests.map(m => load(m.sourceDir)));
const name = `growing-v04-writer-${crypto.randomUUID()}`, prior = new old.GrowingIslandDatabase(name), next = new current.GrowingIslandDatabase(name);
const life = new current.IslandLifeDatabase(`${name}-life`);
const report = { at: new Date().toISOString(), scope: 'Actual committed record4 writer and frozen record5 writer in isolated fake IndexedDB. Explicit commands and completion facts; not real browser learning or user DB evidence.', sourceHashes: manifests.map(m => m.sourceHash), pass: false };
try {
    await old.syncGrowingIsland('kid', [], 1000, prior, life);
    await old.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }], 1002, prior, life);
    const before = (await old.commandGrowingIsland('kid', { id: 'home', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }, 1003, prior)).record;
    assert.equal(before.version, 4);
    await prior.moments.add({ profileId: 'kid', at: 1003, width: 1, height: 1, image: new Blob(['kept-photo']) });
    prior.close();
    const migrated = (await current.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }], 1003, next, life)).record;
    assert.equal(migrated.version, 5);
    const pictures = await next.moments.toArray(); assert.equal(pictures.length, 1); assert.equal(await pictures[0].image.text(), 'kept-photo');
    next.close();
    await prior.open();
    await old.commandGrowingIsland('kid', { id: 'old-flag', command: { type: 'flag', color: 2 } }, 1004, prior);
    await assert.rejects(() => prior.moments.add({ profileId: 'kid', at: 1004, width: 1, height: 1, image: new Blob(['old-photo']) }));
    await assert.rejects(() => old.deleteGrowingOwner('kid', prior));
    await assert.rejects(() => old.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }, { id: 'old-tab-answer', at: 1004 }], 1005, prior, life));
    prior.close(); await next.open();
    assert.deepEqual(await next.islands.get('kid'), migrated);
    assert.equal((await next.moments.toArray()).length, 1);
    const facts = [{ id: 'answer-1', at: 1001 }, { id: 'old-tab-answer', at: 1004 }];
    const recovered = (await current.syncGrowingIsland('kid', facts, 1005, next, life)).record;
    assert.deepEqual(recovered.state.learned, ['answer-1', 'old-tab-answer']);
    assert.deepEqual((await current.syncGrowingIsland('kid', facts, 1005, next, life)).record, recovered);
    assert.deepEqual(recovered.state.plots, migrated.state.plots);
    report.oldPhotoAndDeleteRejected = true; report.actualOldWriterIsolated = true; report.learningRecoveredExactlyOnce = true; report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
    prior.close(); next.close(); await next.delete(); await life.delete();
    await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(report.pass ? 'PASS actual record4 writer fenced; photo retained; completions recovered once' : report.error);
