import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const directory = path.resolve('docs/design/2026-10-23-place-brush-trial');
const sourcePath = path.resolve('src/components/island/growing/GrowingTray.tsx');
const sha = value => createHash('sha256').update(value).digest('hex');
const files = ['catalog-check.ts', 'catalog-check.mjs', 'vite.config.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async file => [file, sha(await readFile(path.join(directory, file)))])));
const before = await hashes(), productBefore = sha(await readFile(sourcePath));
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(plugin => plugin?.name === 'place-method-comparison');
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const reports = [];
for (const transformed of [false, true]) {
    const outfile = `/private/tmp/sansu-catalog-${transformed ? 'trial' : 'reference'}.mjs`;
    await build({ entryPoints: [path.join(directory, 'catalog-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent',
        banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
        define: { 'import.meta.env.DEV': 'false', '__CATALOG_TRIAL_FILTER__': String(transformed) },
        plugins: [{ name: 'actual-catalog-diagnostic', setup(builder) { builder.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8');
            const result = !transformed && args.path === sourcePath ? source : await plugin.transform.call({}, source, args.path);
            return { contents: typeof result === 'string' ? result : result?.code ?? source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        }); } }] });
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window=globalThis;globalThis.location={search:${JSON.stringify(query)},hash:'#/island'};await import(${JSON.stringify(outfile)});`],
        { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    reports.push({ ...JSON.parse(output), bundleSHA256: sha(await readFile(outfile)) });
}
for (const name of ['product-like', 'single-memory', 'single-saved']) {
    assert.equal(reports[0].results.find(item => item.name === name).htmlSHA256, reports[1].results.find(item => item.name === name).htmlSHA256);
}
const after = await hashes(), changedInputs = files.filter(file => before[file] !== after[file]);
assert.equal(productBefore, sha(await readFile(sourcePath)), 'production source remains untouched');
const result = { status: 'PASS', at: new Date().toISOString(), command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/catalog-check.mjs',
    scope: 'SSR catalog against unmodified GrowingTray reference plus actual domain purchase; no application build or browser claim',
    inputSHA256: before, productionTraySHA256: productBefore, changedInputs, reports };
await writeFile(path.join(directory, 'evidence/catalog-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (changedInputs.length) process.exitCode = 1;
