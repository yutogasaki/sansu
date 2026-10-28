import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { memoSamplesTransform } from './memo-samples-transform.mjs';
const folder = path.resolve('docs/design/2026-10-23-place-method-comparison');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(folder, 'vite.config.ts'));
const plugins = (await Promise.all(loaded.config.plugins.flat(Infinity))).flat(Infinity);
const plugin = plugins.find(p => p?.name === 'place-method-comparison');
const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform.handler;
const outfile = '/private/tmp/sansu-memo-samples-check.mjs';
const inputHashes = {};
const count = name => `globalThis.__memoCount('${name}');`;
const once = (source, before, after) => { if (source.split(before).length !== 2) throw Error(`Memo check source mismatch: ${before}`); return source.replace(before, after); };
await build({ entryPoints: [path.join(folder, 'memo-samples-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false' }, plugins: [{ name: 'actual-memo-samples', setup(b) {
        b.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            let source = await readFile(args.path, 'utf8');
            inputHashes[path.relative(process.cwd(), args.path)] = createHash('sha256').update(source).digest('hex');
            const result = await transform.call({}, source, args.path); source = typeof result === 'string' ? result : result?.code ?? source;
            if (args.path.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) {
                if (!source.includes('function memoTerrainSamples<T>')) source = memoSamplesTransform(source);
                const raw = 'function rawHeight(state: TerrainLand, cell: Cell, curved: boolean, mode: TerrainMethod): number {';
                source = once(source, raw, raw + count('rawHeight'));
                const height = 'const calculateSurfaceHeightFor = (input: TerrainLand, cell: Cell) => {';
                source = once(source, height, height + count('surfaceHeight'));
                const wrapper = 'const baselineSurfaceHeightFor = (input: TerrainLand, cell: Cell): number => {';
                source = once(source, wrapper, wrapper + count('surfaceRequests'));
                const factory = 'function memoTerrainSamples<T>(sample: (cell: Cell) => T): (cell: Cell) => T {';
                source = once(source, factory, factory + count('factories'));
                source = once(source, 'if (known) return known.value;', `if (known) { ${count('hits')} return known.value; }`);
                source = once(source, 'row.set(z, { value }); return value;', `${count('entries')} row.set(z, { value }); return value;`);
                source += '\nglobalThis.__memoSamplesFactory = memoTerrainSamples;\n';
            }
            if (args.path.endsWith('/src/domain/growingIsland/landscape.ts')) {
                const signature = 'export function landscapePoint(cell: Cell): Cell {';
                source = once(source, signature, signature + count('landscapePoint'));
            }
            return { contents: source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }] });
inputHashes['memo-samples-transform.mjs'] = createHash('sha256').update(await readFile(path.join(folder, 'memo-samples-transform.mjs'))).digest('hex');
const compared = [];
for (const mode of ['H', 'A']) {
    const pair = [];
    for (const enabled of [false, true]) {
        const query = `?terrainTrial=${mode}&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&queryTrial=frozen&trialScene=shore${enabled ? '&memoTrial=samples' : ''}`;
        const bootstrap = `globalThis.__memoSamplesCounts={};globalThis.__memoCount=name=>{const c=globalThis.__memoSamplesCounts;c[name]=(c[name]??0)+1;};globalThis.window={location:{search:${JSON.stringify(query)}}};globalThis.location=window.location;await import(${JSON.stringify(outfile)});`;
        const report = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', bootstrap], { encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }));
        pair.push(report);
        await writeFile(path.join(folder, `evidence/memo-samples-${mode}-${enabled}.json`), JSON.stringify({ mode, enabled, query, date: new Date().toISOString(), inputHashes, ...report }, null, 2));
    }
    for (const [i, before] of pair[0].reports.entries()) {
        const after = pair[1].reports[i]; assert.equal(after.name, before.name); assert.deepEqual(after.hashes, before.hashes, `${mode}/${before.name} geometry/command mismatch`);
        compared.push({ mode, name: before.name, exactHashesEqual: true, queries: before.queries, routes: before.routes,
            baseline: { coldMs: before.coldMs, counts: before.counts, heapBytes: before.heapBytes },
            memo: { coldMs: after.coldMs, counts: after.counts, heapBytes: after.heapBytes } });
    }
}
const report = { status: 'PASS', date: new Date().toISOString(), inputHashes, compared,
    limits: ['Local maps exist only during synchronous cold generation; no cross-state reuse', 'Heap deltas include other allocations and GC noise, not an exact cache size or peak', 'Single Node timings include counters; browser causal pair remains required'] };
await writeFile(path.join(folder, 'evidence/memo-samples-comparison.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, compared }, null, 2));
