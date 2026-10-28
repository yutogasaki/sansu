import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve('docs/design/2026-10-23-place-brush-trial');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const watched = ['field.ts', 'directional-field.ts', 'directional-check.ts', 'directional-check.mjs', 'model.ts', 'vite.config.ts', 'flat-support.ts'];
const fingerprint = async () => Object.fromEntries(await Promise.all(watched.map(async name => [name, sha(await readFile(path.join(dir, name)))])));
const before = await fingerprint();
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(dir, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(p => p?.name === 'place-method-comparison');
const outfile = '/private/tmp/sansu-directional-check.mjs';
await build({ entryPoints: [path.join(dir, 'directional-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-domain-directional-diagnostic', setup(b) {
        b.onResolve({ filter: /(?:^|\/)field$/ }, args => {
            const resolved = path.resolve(args.resolveDir, args.path + '.ts');
            if (resolved !== path.join(dir, 'field.ts') || ['directional-field.ts', 'directional-check.ts'].some(name => args.importer.endsWith('/' + name))) return;
            return { path: path.join(dir, 'directional-field.ts') };
        });
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            return { contents: typeof result === 'string' ? result : result?.code ?? source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`], { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
const result = JSON.parse(output), after = await fingerprint();
const changedInputs = watched.filter(name => before[name] !== after[name]);
result.metadata = { node: process.version, command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/directional-check.mjs',
    actualTransforms: 'current place trial Vite transform; field imports replaced only in this diagnostic bundle',
    inputSHA256: before, changedInputs, bundleSHA256: sha(await readFile(outfile)) };
await writeFile(path.join(dir, `evidence/directional-check-${process.argv[2] ?? 'current'}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (changedInputs.length) process.exitCode = 1;
