import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const baseline = 'eb65d7c';
const oldRules = execFileSync('git', ['show', `${baseline}:src/domain/islandLife/economyRules.ts`], { encoding: 'utf8' });
const initial = JSON.parse(await readFile('docs/design/2026-09-20-life-replay-snapshot/storage-report.json')).cases[0].initial;
const runs = [];
for (const label of ['before', 'after']) {
    const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] },
        plugins: label === 'before' ? [{ name: 'frozen-growth-baseline', enforce: 'pre', transform(_code, id) { if (id.endsWith('/src/domain/islandLife/economyRules.ts')) return oldRules; } }] : [] });
    try {
        const { replayLife, commandLife } = await server.ssrLoadModule('/src/domain/islandLife/simulation.ts');
        const { clearLifeReplayCache } = await server.ssrLoadModule('/src/domain/islandLife/replayCache.ts');
        const { learningDay, HOUR } = await server.ssrLoadModule('/src/domain/islandLife/model.ts');
        let record = structuredClone(initial); delete record.replaySnapshot;
        const at = record.now + 1;
        record.credits.push(...Array.from({ length: 100 }, (_, i) => ({ id: `synthetic-${i}`, at, day: learningDay(at) })));
        for (const [i, [kind, x, z]] of [['flower', 0, 3], ['bench', 1, 3], ['lantern', 4, 2], ['flower', 0, 1], ['swing', 4, 4], ['flower', 2, 4]].entries()) {
            let placed = false;
            for (let retry = 0; retry < 60; retry++) {
                try { record = commandLife(record, { type: 'buy', kind, cell: { x, z } }, `synthetic-item-${i}`, record.now + 1 + retry * 30000); placed = true; break; }
                catch (e) { if (!String(e).includes('あるいている')) throw e; }
            }
            assert(placed);
        }
        const results = [];
        for (const hours of [24, 168]) {
            clearLifeReplayCache();
            const start = performance.now(), state = replayLife(record, record.now + hours * HOUR);
            results.push({ hours, ms: performance.now() - start, stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex') });
        }
        runs.push({ label, results });
    } finally { await server.close(); }
}
assert.deepEqual(runs[0].results.map(r => r.stateHash), runs[1].results.map(r => r.stateHash));
const report = { baseline, scope: 'Synthetic CPU replay; six items/100 credits; only growth implementation substituted in before run; not browser latency', runs };
console.log(JSON.stringify(report));
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
