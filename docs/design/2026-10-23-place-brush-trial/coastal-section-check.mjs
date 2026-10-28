import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve('docs/design/2026-10-23-place-brush-trial');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const watched = ['coastal-section.ts', 'coastal-section-check.ts', 'coastal-section-check.mjs', 'directional-field.ts', 'model.ts', 'vite.config.ts'];
const fingerprint = async () => Object.fromEntries(await Promise.all(watched.map(async name => [name, sha(await readFile(path.join(dir, name)))])));
const before = await fingerprint();
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(dir, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(p => p?.name === 'place-method-comparison');
const outfile = '/private/tmp/sansu-coastal-section-check.mjs';
const once = (source, needle, replacement) => {
    if (source.split(needle).length !== 2) throw Error(`Coastal integration changed: ${needle}`);
    return source.replace(needle, replacement);
};
await build({ entryPoints: [path.join(dir, 'coastal-section-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-coastal-diagnostic', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            let contents = typeof result === 'string' ? result : result?.code ?? source;
            if (args.path.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) {
                if (contents.includes("import { createCoastalPlaceSection,")) {
                    if (!contents.includes('coastMode: CoastalMode = coastalTrialMode()')
                        || !contents.includes('createCoastalPlaceSection(state, originalSurfaceHeight, coastMode).heightAt'))
                        throw Error('Integrated coastal wrapper differs from diagnostic contract');
                } else {
                contents = once(contents, 'mode: TerrainMethod = terrainMethod()): IslandWorld | undefined {',
                    'mode: TerrainMethod = terrainMethod(), coastMode: CoastalMode = coastalTrialMode()): IslandWorld | undefined {');
                contents = once(contents, 'const revision = `${curved}:${terrainRevision(state, mode)}`',
                    'const revision = `${curved}:${terrainRevision(state, mode)}:${coastMode}`');
                contents = once(contents, 'const surfaceHeight = coastBase ?', 'const originalSurfaceHeight = coastBase ?');
                contents = once(contents, '    type Sample = Cell & { y: number };',
                    '    const surfaceHeight = createCoastalPlaceSection(state, originalSurfaceHeight, coastMode).heightAt;\n    type Sample = Cell & { y: number };');
                contents = "import { createCoastalPlaceSection, coastalTrialMode, type CoastalMode } from '../../../docs/design/2026-10-23-place-brush-trial/coastal-section';\n" + contents;
                }
            }
            return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const reports = [];
for (const mode of ['off', 'soft08', 'soft12', 'contour']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window={location:{search:${JSON.stringify(query + '&shoreTrial=' + mode)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`],
        { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    reports.push(JSON.parse(output));
}
const after = await fingerprint(), changedInputs = watched.filter(name => before[name] !== after[name]);
const historical = JSON.parse(await readFile(path.join(dir, 'evidence/coastal-section-integrated.json'), 'utf8'));
for (const previous of historical.reports) {
    const current = reports.find(report => report.mode === previous.mode);
    for (let i = 0; i < previous.reports.length; i++) {
        assert.deepEqual(current.reports[i].geometry, previous.reports[i].geometry, `${previous.mode} geometry diagnostic changed`);
        assert.deepEqual(current.reports[i].centerSection, previous.reports[i].centerSection, `${previous.mode} section changed`);
    }
}
const result = { at: new Date().toISOString(), status: changedInputs.length ? 'STALE' : 'PASS', reports,
    metadata: { node: process.version, command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/coastal-section-check.mjs',
        actualTransforms: 'current place trial integrated coastal wrapper when present; diagnostic fallback otherwise. Completed surface wrapped once after exterior fade/coarse sampling.',
        inputSHA256: before, changedInputs, oldModeDiagnosticParity: true, bundleSHA256: sha(await readFile(outfile)) } };
await writeFile(path.join(dir, `evidence/coastal-section-${process.argv[2] ?? 'current'}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (changedInputs.length) process.exitCode = 1;
