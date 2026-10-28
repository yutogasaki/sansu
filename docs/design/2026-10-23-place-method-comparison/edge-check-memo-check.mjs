import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { singleCompileWorldTransform } from './single-compile-transform.mjs';
import { edgeCheckMemoTransform } from './edge-check-memo-transform.mjs';
import { trialTimingTransform } from './timing-transform.mjs';
const folder = path.resolve('docs/design/2026-10-23-place-method-comparison');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(folder, 'vite.config.ts'));
const plugins = (await Promise.all(loaded.config.plugins.flat(Infinity))).flat(Infinity);
const plugin = plugins.find(p => p?.name === 'place-method-comparison');
const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform.handler;
const worldPath = path.resolve('src/domain/growingIsland/worldDefinition.ts');
const baseline = await readFile(worldPath, 'utf8');
const candidate = edgeCheckMemoTransform(singleCompileWorldTransform(baseline));
assert.throws(() => edgeCheckMemoTransform(candidate), /already transformed/);
assert.throws(() => edgeCheckMemoTransform(baseline), /source mismatch/);
assert.equal(candidate.split('const isWalkEdgeSupported = (from: Cell, to: Cell) => !walkEdgeError(').length, 2, 'Published query remains uncached');
const parsed = ts.transpileModule(candidate, { fileName: worldPath, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
assert.equal(parsed.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const outfile = '/private/tmp/sansu-edge-check-memo-check.mjs';
const sourceHashes = {};
await build({ entryPoints: [path.join(folder, 'edge-check-memo-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-edge-check-memo', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            let source = await readFile(args.path, 'utf8');
            if (args.path === worldPath) source = trialTimingTransform(candidate, args.path);
            else { const result = await transform.call({}, source, args.path); source = typeof result === 'string' ? result : result?.code ?? source; }
            if (/growingIsland\/(?:worldDefinition|editableTerrainWorld)\.ts$/.test(args.path))
                sourceHashes[path.relative(process.cwd(), args.path)] = createHash('sha256').update(source).digest('hex');
            return { contents: source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
function run(enabled, benchOnly = false) {
    const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen' + (enabled ? '&edgeTrial=memo' : '');
    const bootstrap = `globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`;
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', bootstrap], { encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, EDGE_CHECK_BENCH_ONLY: benchOnly ? '1' : '0' } }));
}
const reports = [run(false), run(true)];
for (const [i, expected] of reports[0].reports.entries()) {
    assert.equal(reports[1].reports[i].name, expected.name);
    assert.deepEqual(reports[1].reports[i].hashes, expected.hashes, expected.name);
}
assert.equal(reports[0].benchmark.resultHash, reports[1].benchmark.resultHash);
assert.deepEqual(reports[0].errors, reports[1].errors);
assert.deepEqual(reports[0].directionalQueries, reports[1].directionalQueries);
assert.deepEqual(reports[0].optionalAPI, reports[1].optionalAPI);
assert.deepEqual(reports[0].timings.map(t => [t.status, t.message]), reports[1].timings.map(t => [t.status, t.message]));
const benchmarks = [];
for (const enabled of [true, false, false, true, true, false]) benchmarks.push(run(enabled, true));
assert(benchmarks.every(r => r.benchmark.resultHash === reports[0].benchmark.resultHash));
const files = ['edge-check-memo-transform.mjs', 'edge-check-memo-check.ts', 'edge-check-memo-check.mjs', 'evidence/69-H-wide-shore-final-state.json', 'single-compile-transform.mjs', 'frozen-query.ts'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(path.join(folder, file))).digest('hex')])));
const report = { status: 'PASS', date: new Date().toISOString(), command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/edge-check-memo-check.mjs',
    hashes, transformedSourceHashes: sourceHashes, reports, benchmarks,
    checks: { fourFixtureHashesExactlyEqual: true, sameColdCommandResult: true, invalidErrorMessagesExactlyEqual: true, callbackExceptionIdentity: true,
        immutablePublishedAPI: true, callbackOnce: true, callbackEdgesCloned: true, directedChecksPreserved: true, publishedWalkCheckUncached: true, duplicateTransformRejected: true },
    limitations: ['Node CPU with frozen query; not browser frame/GPU timing.', 'Same UI69 raw input is used, but process isolation and fixture initialization are diagnostic.',
        'No safety check removed. Body corridor check remains separate. No claim that all compile cost is eliminated.'] };
await writeFile(path.join(folder, 'evidence/edge-check-memo-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, fixtures: reports[0].reports.map((r, i) => ({ name: r.name, edges: r.edges, offColdMs: r.coldMs, onColdMs: reports[1].reports[i].coldMs })),
    benchmarks: benchmarks.map(r => ({ enabled: r.enabled, ms: r.benchmark.coldEditMs, compileMs: r.benchmark.compileMs })), errors: reports[0].errors }));
