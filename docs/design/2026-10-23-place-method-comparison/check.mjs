import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';

const directory = new URL('.', import.meta.url).pathname;
await mkdir(`${directory}evidence`, { recursive: true });
const source = await readFile('src/domain/growingIsland/editableTerrainWorld.ts', 'utf8');
const results = { date: new Date().toISOString(), node: process.version,
    sourceSHA256: createHash('sha256').update(source).digest('hex'),
    scope: 'Independent labelled fixtures using real domain/life logic. UI, DB reload, native actor, and art are separate.', checks: [] };

for (const entry of ['geometry-check', 'coastal-check', 'life-check']) for (const method of entry === 'life-check' ? ['A', 'B', 'C'] : ['A']) {
    const outfile = `/private/tmp/sansu-place-method-${entry}-${method}.mjs`;
    await build({ entryPoints: [`${directory}${entry}.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false' }, logLevel: 'silent',
        plugins: [{ name: 'same-generator-as-browser', setup(builder) {
            builder.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async args => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(args.path, 'utf8')), { mode: method }) }));
            builder.onLoad({ filter: /terrainEditing\.ts$/ }, async args => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(args.path, 'utf8')) }));
        } }],
    });
    try {
        const output = execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 60_000 });
        await writeFile(`${directory}evidence/${entry}-${method}.json`, output);
        results.checks.push({ entry, method: entry === 'geometry-check' ? 'A/B (explicit arguments)' : entry === 'coastal-check' ? 'A/C (explicit arguments)' : method, status: 'PASS' });
    } catch (error) {
        await writeFile(`${directory}evidence/${entry}-${method}-failure.txt`, `${error.stderr ?? error.message}`);
        results.checks.push({ entry, method, status: 'FAIL' });
        process.exitCode = 1;
    }
}
await writeFile(`${directory}evidence/diagnostics.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
