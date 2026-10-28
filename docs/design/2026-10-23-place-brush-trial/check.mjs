import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const dir = path.resolve('docs/design/2026-10-23-place-brush-trial');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(dir, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(p => p?.name === 'place-method-comparison');
const outfile = '/private/tmp/sansu-place-outline-check.mjs';
await build({ entryPoints: [path.join(dir, 'check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-place-outline', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            return { contents: typeof result === 'string' ? result : result?.code ?? source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`], { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
await writeFile(path.join(dir, 'evidence/check.json'), output); console.log(output);
