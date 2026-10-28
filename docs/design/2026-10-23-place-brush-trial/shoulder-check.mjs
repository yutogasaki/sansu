import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const directory = path.resolve('docs/design/2026-10-23-place-brush-trial'), label = process.argv[2] ?? 'current';
if (!/^[a-zA-Z0-9-]+$/.test(label)) throw Error('Plain label required');
const sha = value => createHash('sha256').update(value).digest('hex');
const watched = ['directional-field.ts', 'composite-field.ts', 'shoulder-section.ts', 'shoulder-check.ts', 'shoulder-check.mjs', 'composite-store.ts', 'vite.config.ts', 'PlaceEvidence.tsx'];
const hashes = async () => Object.fromEntries(await Promise.all(watched.map(async file => [file, sha(await readFile(path.join(directory, file)))])));
const before = await hashes(), loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(plugin => plugin?.name === 'place-method-comparison'), results = [];
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo&placeSetTrial=two';
for (const reference of [true, false]) {
    const outfile = `/private/tmp/sansu-shoulder-check-${reference}.mjs`;
    await build({ entryPoints: [path.join(directory, 'shoulder-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"', '__APP_VERSION__': '"shoulder-diagnostic"', '__LIFE_REPLAY_VERSION__': '"shoulder-diagnostic"', '__SHOULDER_REFERENCE__': String(reference), '__SHOULDER_MODE__': '"northHermite"' },
        plugins: [{ name: 'actual-shoulder-check', setup(builder) { builder.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const name = path.basename(args.path), baseline = reference && args.path.startsWith(directory + '/') && ['directional-field.ts', 'composite-field.ts', 'shoulder-section.ts'].includes(name);
            const source = await readFile(baseline ? `/private/tmp/sansu-hermite-before-${name}` : args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            return { contents: typeof result === 'string' ? result : result?.code ?? source, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        }); } }] });
    let output;
    try { output = execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.window=globalThis;globalThis.location={search:${JSON.stringify(query)},hash:'#/island'};await import(${JSON.stringify(outfile)});`], { encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024 }); }
    catch (error) { await writeFile(path.join(directory, 'evidence', `shoulder-${label}-failure.txt`), `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`); throw error; }
    results.push({ ...JSON.parse(output), bundleSHA256: sha(await readFile(outfile)) });
}
assert.deepEqual(results[1].standard, results[0].standard, 'all default compiled floors/routes/revisions remain exactly equal to pre-shoulder field sources');
assert.deepEqual(results[1].standardWide, results[0].standardWide, 'existing northWide floors/routes/revision remain exactly equal to frozen v16');
const after = await hashes(), result = { status: 'PASS', at: new Date().toISOString(), scope: 'Actual transformed memory world/commands and DB guards; no browser or visual acceptance',
    command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-brush-trial/shoulder-check.mjs ${label}`, inputSHA256: before,
    referenceSHA256: Object.fromEntries(await Promise.all(['directional-field.ts', 'composite-field.ts', 'shoulder-section.ts'].map(async name => [name, sha(await readFile(`/private/tmp/sansu-hermite-before-${name}`))]))),
    changedInputs: watched.filter(file => before[file] !== after[file]), results };
await writeFile(path.join(directory, 'evidence', `shoulder-${label}.json`), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2)); if (result.changedInputs.length) process.exitCode = 1;
