import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { digestFiles } from './verify-growing.mjs';

const paths = [process.env.SANSU_GROWING_OLD_MANIFEST, process.env.SANSU_GROWING_NEW_MANIFEST];
const output = process.env.SANSU_GROWING_LEGACY_OUTPUT;
assert(paths.every(Boolean) && output, 'Specify OLD/NEW manifests and a fresh SANSU_GROWING_LEGACY_OUTPUT file');
const manifests = await Promise.all(paths.map(async path => JSON.parse(await fs.readFile(path, 'utf8'))));
for (const m of manifests) assert.deepEqual(await digestFiles(m.sourceDir, Object.keys(m.inputs)), m.inputs);
async function load(root) {
    const result = await build({ stdin: { contents: `
        export { GrowingIslandDatabase, syncGrowingIsland, commandGrowingIsland } from './src/domain/growingIsland/repository.ts';
        export { IslandLifeDatabase } from './src/domain/islandLife/repository.ts';`, resolveDir: root },
        bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
        define: { 'import.meta.env': JSON.stringify({ DEV: false, BASE_URL: '/' }),
            __LIFE_REPLAY_VERSION__: '"growing-legacy-diagnostic"', __APP_VERSION__: '"growing-legacy-diagnostic"' } });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const [old, current] = await Promise.all(manifests.map(m => load(m.sourceDir)));
const name = `growing-legacy-diagnostic-${crypto.randomUUID()}`;
const priorDb = new old.GrowingIslandDatabase(name), nextDb = new current.GrowingIslandDatabase(name);
const life = new current.IslandLifeDatabase(`${name}-life`);
const report = { scope: 'Actual old/new source writers, isolated fake IndexedDB; diagnostic commands, not real browser actions or user migration.',
    revisions: manifests.map(m => m.version.revision), sourceHashes: manifests.map(m => m.sourceHash), pass: false };
try {
    await old.syncGrowingIsland('kid', [], 1000, priorDb, life);
    await old.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }], 1002, priorDb, life);
    const owned = await old.commandGrowingIsland('kid', { id: 'first-home', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }, 1003, priorDb);
    const before = structuredClone(owned.record); assert.equal(before.version, 1);
    priorDb.close();
    const migrated = (await current.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }], 1003, nextDb, life)).record;
    assert.equal(migrated.version, 3);
    assert.deepEqual(migrated.state.plots, before.state.plots);
    assert.deepEqual(migrated.state.villagers, before.state.villagers);
    nextDb.close();
    // Dexie can reopen without its old schema version. Its actual commands must
    // remain in the old table and never overwrite the current guided lineage.
    await priorDb.open();
    await old.commandGrowingIsland('kid', { id: 'old-flag', command: { type: 'flag', color: 2 } }, 1004, priorDb);
    await old.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }, { id: 'old-tab-answer', at: 1004 }], 1005, priorDb, life);
    priorDb.close();
    await nextDb.open();
    assert.deepEqual(await nextDb.islands.get('kid'), migrated, 'Actual old writer must not overwrite guidedIslands');
    const recovered = (await current.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }, { id: 'old-tab-answer', at: 1004 }], 1005, nextDb, life)).record;
    assert.deepEqual(recovered.state.learned, ['answer-1', 'old-tab-answer']);
    const repeated = (await current.syncGrowingIsland('kid', [{ id: 'answer-1', at: 1001 }, { id: 'old-tab-answer', at: 1004 }], 1005, nextDb, life)).record;
    assert.deepEqual(repeated, recovered, 'Old-tab learning fact must only be ingested once');
    assert.deepEqual(repeated.state.plots, migrated.state.plots);
    for (const m of manifests) assert.deepEqual(await digestFiles(m.sourceDir, Object.keys(m.inputs)), m.inputs);
    report.oldWriterIsolated = true; report.learningRecoveredOnce = true; report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
    priorDb.close(); nextDb.close(); await nextDb.delete(); await life.delete();
    report.qaHash = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
    await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(report.pass ? 'PASS actual old Growing writer is isolated; learning recovered once' : report.error);
