import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';

const folder = 'docs/design/2026-10-23-place-method-comparison';
const files = ['terrace-convex-field.ts', 'high-garden-recipe.ts', 'high-garden-recipe.mjs', 'terrain-transform.mjs', 'evidence/42-H-redone-state.json'];
const inputHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
const outfile = '/private/tmp/sansu-high-garden-recipe.mjs';
await build({ entryPoints: [`${folder}/high-garden-recipe.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
    define: { 'import.meta.env.DEV': 'false' }, logLevel: 'silent', plugins: [{ name: 'actual-browser-F', setup(b) {
        b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: 'F' }) }));
        b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
    } }],
});
const report = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 120_000 }));
const result = { ...report, date: new Date().toISOString(), inputHashes, integration: 'actual browser terrainMethodTransform mode F',
    command: `fnm exec --using=22.23.3 node ${folder}/high-garden-recipe.mjs` };
await writeFile('/private/tmp/sansu-high-garden-recipe.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
