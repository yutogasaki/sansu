import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve('docs/design/2026-10-23-place-brush-trial');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const watched = ['bay-section.ts', 'bay-check.ts', 'bay-check.mjs', 'coastal-section.ts', 'directional-field.ts', 'composite-field.ts', 'model.ts', 'persistent-model.ts', 'vite.config.ts',
    '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json'];
const fingerprint = async () => Object.fromEntries(await Promise.all(watched.map(async name => [name, sha(await readFile(path.join(dir, name)))])));
const before = await fingerprint();
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(dir, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(p => p?.name === 'place-method-comparison');
const outfile = '/private/tmp/sansu-bay-check.mjs';
const buildDiagnostic = async (target, originals) => build({ entryPoints: [path.join(dir, 'bay-check.ts')], outfile: target, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-bay-diagnostic', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = originals?.get(args.path) ?? await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            const contents = typeof result === 'string' ? result : result?.code ?? source;
            if (args.path.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts') && !contents.includes('coastalBypassesPlaceField(state'))
                throw Error('Actual bay raw-field bypass has not been integrated');
            return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
await buildDiagnostic(outfile);
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const run = (bundle, mode) => {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window={location:{search:${JSON.stringify(query + '&shoreTrial=' + mode)}}};globalThis.location=window.location;await import(${JSON.stringify(bundle)});`],
        { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(output);
};
const reports = ['bay08', 'bay12', 'bay08spread'].map(mode => run(outfile, mode));
let oldModeParity;
const baselineDirectory = process.argv.find(arg => arg.startsWith('--baseline-dir='))?.slice('--baseline-dir='.length);
if (baselineDirectory) {
    // Optional prior-source replay: same current world transform and checks,
    // with only the two pre-experiment coast modules restored in memory.
    const originals = new Map(), sourceSHA256 = {};
    for (const name of ['bay-section.ts', 'coastal-section.ts']) {
        const source = await readFile(path.join(baselineDirectory, name), 'utf8');
        originals.set(path.join(dir, name), source); sourceSHA256[name] = sha(source);
    }
    const oldBundle = '/private/tmp/sansu-bay-before-spread-check.mjs';
    await buildDiagnostic(oldBundle, originals);
    const checks = [];
    for (const mode of ['bay08', 'bay12']) {
        const old = run(oldBundle, mode), current = reports.find(report => report.mode === mode);
        assert.deepEqual(current.reports, old.reports, `${mode}: prior source must preserve exact mesh hashes, routes, sections and controls`);
        assert.deepEqual(current.originalOwners, old.originalOwners);
        assert.deepEqual(current.negativeControls, old.negativeControls);
        checks.push({ mode, exactReportParity: true, floorSHA256: current.reports.map(report => ({ name: report.name, sha256: report.floorSHA256 })) });
    }
    oldModeParity = { sourceSHA256, bundleSHA256: sha(await readFile(oldBundle)), checks };
}
const after = await fingerprint(), changedInputs = watched.filter(name => before[name] !== after[name]);
const result = { at: new Date().toISOString(), status: changedInputs.length ? 'STALE' : 'PASS', reports, oldModeParity,
    metadata: { node: process.version, command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/bay-check.mjs',
        actualTransforms: 'current root Vite including negative-field bypass and completed-surface bay wrapper; no diagnostic substitutions',
        inputSHA256: before, changedInputs, bundleSHA256: sha(await readFile(outfile)) } };
await writeFile(path.join(dir, `evidence/bay-check-${process.argv[2] ?? 'current'}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (changedInputs.length) process.exitCode = 1;
