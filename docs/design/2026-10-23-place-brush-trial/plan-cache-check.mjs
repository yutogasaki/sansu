import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const directory = path.resolve('docs/design/2026-10-23-place-brush-trial');
const mode = process.argv[2] ?? 'fixed';
if (!['fixed', 'without-reset'].includes(mode)) throw Error('Use fixed or without-reset');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const watched = ['plan-cache-check.ts', 'plan-cache-check.mjs', 'field.ts', 'directional-field.ts', 'persistent-model.ts', 'model.ts', 'vite.config.ts'];
const fingerprint = async () => Object.fromEntries(await Promise.all(watched.map(async file => [file, sha(await readFile(path.join(directory, file)))])));
const before = await fingerprint();
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(plugin => plugin?.name === 'place-method-comparison');
const outfile = `/private/tmp/sansu-plan-cache-${mode}.mjs`;
let verifiedReset = false;
await build({ entryPoints: [path.join(directory, 'plan-cache-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-plan-cache-check', setup(builder) {
        builder.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            let contents = typeof result === 'string' ? result : result?.code ?? source;
            if (args.path.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) {
                const reset = "trialTimingDetail(__trialTimingToken, 'cold');\n    resetPlacePlans(state);";
                const resetIndex = contents.indexOf(reset), returnIndex = contents.indexOf('return previous;');
                if (resetIndex < 0 || returnIndex < 0 || returnIndex > resetIndex) throw Error('Expected reset after compiled-world cache-hit return');
                verifiedReset = true;
                if (mode === 'without-reset') contents = contents.replace('    resetPlacePlans(state);', '    // Diagnostic negative control: omit only the reset.');
            }
            return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
if (!verifiedReset) throw Error('Actual world transform was not inspected');
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
let output, failed = false;
try { output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`],
    { encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024 }); }
catch (error) { failed = true; output = error.stdout; if (!output) throw error; }
const result = JSON.parse(output), after = await fingerprint();
const changedInputs = watched.filter(file => before[file] !== after[file]);
result.metadata = { node: process.version, mode, command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/plan-cache-check.mjs ${mode}`,
    inputSHA256: before, changedInputs, bundleSHA256: sha(await readFile(outfile)) };
await writeFile(path.join(directory, 'evidence', `plan-cache-${mode}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failed || changedInputs.length) process.exitCode = 1;
