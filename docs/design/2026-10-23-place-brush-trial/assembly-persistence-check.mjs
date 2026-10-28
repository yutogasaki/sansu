import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const directory = path.resolve('docs/design/2026-10-23-place-brush-trial');
const label = process.argv[2] ?? 'current'; if (!/^[a-zA-Z0-9-]+$/.test(label)) throw Error('Plain label required');
const sha = value => createHash('sha256').update(value).digest('hex');
const watched = ['assembly-store.ts', 'assembly-mode.ts', 'assembly-section.ts', 'coastal-section.ts', 'bay-section.ts', 'directional-field.ts', 'composite-store.ts', 'composite-field.ts', 'composite-model.ts', 'assembly-persistence-check.ts', 'assembly-persistence-check.mjs', 'TrialIsland.ts', 'vite.config.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(watched.map(async file => [file, sha(await readFile(path.join(directory, file)))])));
const before = await hashes(), loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(plugin => plugin?.name === 'place-method-comparison'), outfile = '/private/tmp/sansu-assembly-persistence.mjs';
await build({ entryPoints: [path.join(directory, 'assembly-persistence-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"', '__APP_VERSION__': '"composite-save-diagnostic"', '__LIFE_REPLAY_VERSION__': '"composite-save-diagnostic"' },
    plugins: [{ name: 'actual-assembly-persistence', setup(builder) { builder.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
        const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
        return { contents: typeof result === 'string' ? result : result?.code ?? source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
    }); } }] });
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo&placeSetTrial=two&assemblyTrial=bay&trialSave=assembly-local';
let output;
try { output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window=globalThis;globalThis.location={search:${JSON.stringify(query)},hash:'#/island'};await import(${JSON.stringify(outfile)});`],
    { encoding: 'utf8', timeout: 300000, maxBuffer: 6 * 1024 * 1024 }); }
catch (error) { await writeFile(path.join(directory, 'evidence', `assembly-persistence-${label}-failure.txt`), `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`); throw error; }
const result = JSON.parse(output), after = await hashes();
result.metadata = { node: process.version, command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/assembly-persistence-check.mjs ${label}`,
    inputSHA256: before, changedInputs: watched.filter(file => before[file] !== after[file]), bundleSHA256: sha(await readFile(outfile)) };
await writeFile(path.join(directory, 'evidence', `assembly-persistence-${label}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2)); if (result.metadata.changedInputs.length) process.exitCode = 1;
