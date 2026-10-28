import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const files = ['expanded-fixture.ts', 'expanded-fixture.mjs', 'evidence/49-H-high-placed-state.json', 'terrain-transform.mjs',
    'terrace-convex-field.ts', 'growth-seam.ts', 'growth-seam-transform.mjs'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${dir}${file}`)).digest('hex')])));
const outfile = '/private/tmp/sansu-expanded-fixture.mjs';
await build({ entryPoints: [`${dir}expanded-fixture.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
    define: { 'import.meta.env.DEV': 'false' }, logLevel: 'silent', plugins: [{ name: 'actual-F-current-seam', setup(b) {
        b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: 'F' }) }));
        b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        b.onLoad({ filter: /commands\.ts$/ }, async a => ({ loader: 'ts', contents: growthSeamCommandTransform(await readFile(a.path, 'utf8'), { alwaysInherit: true }) }));
    } }],
});
const result = { ...JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })),
    date: new Date().toISOString(), hashes, command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/expanded-fixture.mjs' };
await writeFile(`${dir}evidence/expanded-fixture.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, stats: result.stats, unresolved: result.unresolved, owners: result.owners, drops: result.state.drops }, null, 2));
