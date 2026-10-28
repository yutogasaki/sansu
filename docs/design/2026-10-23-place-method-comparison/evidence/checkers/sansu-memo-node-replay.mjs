import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.resolve(here, '..');
const bundle = path.join(here, 'memo-samples-historical-bundle.mjs');
const provenance = JSON.parse(await readFile(path.join(here, 'memo-checker-provenance.json'), 'utf8'));
const hash = createHash('sha256').update(await readFile(bundle)).digest('hex');
assert.equal(hash, provenance.files.find(file => file.target.endsWith('/memo-samples-historical-bundle.mjs')).savedSHA256);
const output = await mkdtemp(path.join(tmpdir(), 'sansu-memo-replay-'));
const comparisons = [];
for (const mode of ['H', 'A', 'C', 'G']) {
    const pair = [];
    for (const enabled of [false, true]) {
        const query = `?terrainTrial=${mode}&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&queryTrial=frozen&trialScene=shore${enabled ? '&memoTrial=samples' : ''}`;
        const bootstrap = `globalThis.__memoSamplesCounts={};globalThis.__memoCount=name=>{const c=globalThis.__memoSamplesCounts;c[name]=(c[name]??0)+1;};globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(new URL('./memo-samples-historical-bundle.mjs', import.meta.url).href)});`;
        const report = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', bootstrap],
            { encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }));
        const original = JSON.parse(await readFile(path.join(evidence, `memo-samples-${mode}-${enabled}.json`), 'utf8'));
        assert.deepEqual(report.pureChecks, original.pureChecks);
        for (const [index, result] of report.reports.entries()) {
            const expected = original.reports[index];
            assert.equal(result.name, expected.name);
            assert.deepEqual(result.hashes, expected.hashes, `${mode}/${enabled}/${result.name} original hash mismatch`);
            assert.deepEqual(result.commands, expected.commands);
            assert.deepEqual(result.counts, expected.counts);
            assert.equal(result.ordinaryCycleAccepted, expected.ordinaryCycleAccepted);
        }
        pair.push(report);
        await writeFile(path.join(output, `memo-samples-${mode}-${enabled}.json`), JSON.stringify({ mode, enabled, query,
            replayedAt: new Date().toISOString(), originalEvidenceUnchanged: true, ...report }, null, 2));
    }
    for (const [index, result] of pair[0].reports.entries()) {
        assert.deepEqual(result.hashes, pair[1].reports[index].hashes);
        comparisons.push({ mode, name: result.name, hashesMatchOriginalAndOtherCondition: true, queries: result.queries, routes: result.routes });
    }
}
const summary = { status: 'PASS', replayedAt: new Date().toISOString(), bundleSHA256: hash, output, comparisons,
    scope: 'Historical diagnostic bundle replay; hashes, commands, counts and pure checks match saved originals. New timings and heap values are observations of this replay, not replacements for the original measurements.' };
await writeFile(path.join(output, 'memo-replay-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
