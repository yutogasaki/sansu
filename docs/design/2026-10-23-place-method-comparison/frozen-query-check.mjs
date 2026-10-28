import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { frozenQueryTransform } from './frozen-query-transform.mjs';
const folder = path.resolve('docs/design/2026-10-23-place-method-comparison');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(folder, 'vite.config.ts'));
const plugins = (await Promise.all(loaded.config.plugins.flat(Infinity))).flat(Infinity);
const plugin = plugins.find(p => p?.name === 'place-method-comparison');
const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform.handler;
const outfile = '/private/tmp/sansu-frozen-query-check.mjs';
const touched = [];
await build({ entryPoints: [path.join(folder, 'frozen-query-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-frozen-query', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            let source = await readFile(args.path, 'utf8');
            const result = await transform.call({}, source, args.path); source = typeof result === 'string' ? result : result?.code ?? source;
            // Parent may already have integrated the exact same final adapter.
            if (!source.includes("import { trialQuery } from '")) source = frozenQueryTransform(source, args.path);
            if (source.includes("import { trialQuery } from '")) touched.push(path.relative(process.cwd(), args.path));
            return { contents: source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
const reports = [];
for (const enabled of [false, true]) {
    const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore' + (enabled ? '&queryTrial=frozen' : '');
    const bootstrap = `let reads=0,parses=0;const Q=globalThis.URLSearchParams;globalThis.URLSearchParams=class extends Q{constructor(...args){super(...args);parses++;}};globalThis.window={location:{get search(){reads++;return ${JSON.stringify(query)};}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});console.log(JSON.stringify({reads,parses}));`;
    const lines = execFileSync(process.execPath, ['--input-type=module', '-e', bootstrap], { encoding: 'utf8', timeout: 60_000 }).trim().split('\n').map(line => JSON.parse(line));
    reports.push({ ...lines[0], ...lines[1] });
}
assert.equal(reports[0].hash, reports[1].hash);
assert.deepEqual(reports[0].queryFlags, reports[1].queryFlags);
assert.equal(reports[0].mode, reports[1].mode);
assert(reports[0].reads > 1000); assert.equal(reports[1].reads, 1);
const report = { status: 'PASS', date: new Date().toISOString(), touched, reports,
    scope: 'Actual Vite transforms, same 69 input and query flags. Node simulated location/parse counts; browser timing must be measured separately.' };
await writeFile(path.join(folder, 'evidence/frozen-query-check.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
