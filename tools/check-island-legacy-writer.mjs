import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

// Execute the actual previous production writer against the same disposable IDB.
const baseline = process.env.SANSU_LEGACY_REVISION || '67406a186e227ef3d66983d2b5dea72739c5d1db';
assert.match(baseline, /^[a-f0-9]{40}$/);
const scratch = await mkdtemp(join(tmpdir(), 'sansu-legacy-writer-'));
const archive = execFileSync('git', ['archive', baseline, 'src'], { maxBuffer: 32 * 1024 * 1024 });
execFileSync('tar', ['-x', '-C', scratch], { input: archive });
await symlink(resolve('node_modules'), join(scratch, 'node_modules'), 'dir');
async function load(root) {
    const result = await build({ stdin: {
        contents: "export { IslandLifeDatabase, updateLife } from './src/domain/islandLife/repository.ts'; export { replayLife } from './src/domain/islandLife/simulation.ts';",
        resolveDir: root,
    }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_ISLAND_LIFE_ENABLED: 'true', VITE_ISLAND_LIFE_DISCOVERY_ENABLED: 'true' }),
        __LIFE_REPLAY_VERSION__: JSON.stringify(`legacy-check:${root}`), __APP_VERSION__: '"legacy-check"' } });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const old = await load(scratch), next = await load(process.cwd());
const database = new next.IslandLifeDatabase(`legacy-writer-${crypto.randomUUID()}`);
try {
    let record = await old.updateLife('legacy', [], undefined, 1000, database);
    record = await old.updateLife('legacy', [{ id: 'earned', at: 1001 }], undefined, 1002, database);
    record = await old.updateLife('legacy', [], { id: 'flower', revision: record.revision,
        command: { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } } }, 1003, database);
    const prior = structuredClone(record), state = old.replayLife(prior);
    assert.equal(prior.version, 18);
    const migrated = await next.updateLife('legacy', [], undefined, 1003, database);
    assert.equal(migrated.version, 20);
    for (const key of ['actions', 'credits', 'createdAt']) assert.deepEqual(migrated[key], prior[key]);
    assert.equal(next.replayLife(migrated).drops, state.drops);
    assert.deepEqual(next.replayLife(migrated).items, state.items);
    await assert.rejects(old.updateLife('legacy', [{ id: 'new-answer', at: 1004 }], undefined, 1005, database), /新しい版/);
    assert.deepEqual(await database.worlds.get('legacy'), migrated, 'Old writer cannot lose food/soil or ownership');
    const recovered = await next.updateLife('legacy', [{ id: 'new-answer', at: 1004 }], undefined, 1005, database);
    assert.equal(recovered.credits.length, 2, 'Current writer recovers the old-tab learning fact once');
    assert.deepEqual((await next.updateLife('legacy', [{ id: 'new-answer', at: 1004 }], undefined, 1006, database)).credits, recovered.credits);
    const output = process.env.SANSU_LEGACY_OUTPUT || 'output/fantasy-production/legacy-writer.json';
    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, JSON.stringify({ baseline, oldVersion: prior.version, newVersion: migrated.version,
        oldWriterRejected: true, ownershipPreserved: true, learningFactRecoveredOnce: true,
        scope: 'Actual baseline source writer and new writer; disposable fake IndexedDB, no user data or browser update', pass: true }, null, 2));
    console.log('PASS: old production writer rejects migrated data; ownership and subsequent learning facts survive.');
} finally { await database.delete(); }
