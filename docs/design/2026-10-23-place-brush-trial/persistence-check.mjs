import { build } from 'esbuild';
import { loadConfigFromFile } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const directory = path.resolve('docs/design/2026-10-23-place-brush-trial');
const revision = process.argv[2] ?? 'current';
if (!/^[a-zA-Z0-9-]+$/.test(revision)) throw Error('Use a plain diagnostic revision');
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'));
const plugin = loaded.config.plugins.find(plugin => plugin?.name === 'place-method-comparison');
const outfile = '/private/tmp/sansu-place-persistence-check.mjs';
const touched = new Set();
await build({ entryPoints: [path.join(directory, 'persistence-check.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"', '__APP_VERSION__': '"place-persistence-diagnostic"', '__LIFE_REPLAY_VERSION__': '"place-persistence-diagnostic"' },
    plugins: [{ name: 'actual-place-persistence', setup(builder) {
        builder.onLoad({ filter: /\.(?:ts|tsx)$/ }, async args => {
            const source = await readFile(args.path, 'utf8'), result = await plugin.transform.call({}, source, args.path);
            const contents = typeof result === 'string' ? result : result?.code ?? source;
            if (args.path.endsWith('/src/domain/growingIsland/commands.ts')) {
                if (!contents.includes('applyTrialPlaceCommand(state, intent.command)')) throw Error('Trial command integration missing');
                touched.add('commands');
            }
            if (args.path.endsWith('/src/domain/growingIsland/syncProjection.ts')) {
                if (!contents.includes('validateTrialPlaceState(record.state)')) throw Error('Trial read validator integration missing');
                touched.add('readable');
            }
            return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
    } }],
});
if (touched.size !== 2) throw Error('Expected actual writer dependencies');
const query = '?terrainTrial=H&baseTrial=stable&rampTrial=linear&growthTrial=inherit&compileTrial=single&trialScene=shore&queryTrial=frozen&memoTrial=samples&edgeTrial=memo';
const bootstrap = `globalThis.window=globalThis;globalThis.location={search:${JSON.stringify(query)},hash:'#/island'};await import(${JSON.stringify(outfile)});`;
let output;
try { output = execFileSync(process.execPath, ['--input-type=module', '-e', bootstrap], { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }); }
catch (error) {
    await writeFile(path.join(directory, 'evidence', `persistence-${revision}-failure.txt`), `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`);
    throw error;
}
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const fixture = path.resolve('docs/design/2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json');
const sourceHashes = Object.fromEntries(await Promise.all(['persistence-check.ts', 'persistence-check.mjs', 'persistent-model.ts', 'trial-store.ts',
    'field.ts', 'directional-field.ts', 'model.ts'].map(async file => [file, await digest(path.join(directory, file))])));
const report = { ...JSON.parse(output), command: `node docs/design/2026-10-23-place-brush-trial/persistence-check.mjs ${revision}`,
    runtime: process.version, expected: 'Every assertion passes through the actual trial-transformed repository writer and reader', actual: 'pass',
    inputs: { fixture: path.relative(process.cwd(), fixture), fixtureSha256: await digest(fixture),
        transformedBundleSha256: await digest(outfile), transformConfigSha256: await digest(path.join(directory, 'vite.config.ts')), sourceHashes } };
const evidence = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(path.join(directory, 'evidence', `persistence-${revision}.json`), evidence);
console.log(evidence);
