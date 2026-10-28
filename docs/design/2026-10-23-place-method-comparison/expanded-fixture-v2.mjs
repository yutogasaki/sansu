import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const parentFile = 'evidence/expanded-fixture.json', parentText = await readFile(`${dir}${parentFile}`, 'utf8'), parent = JSON.parse(parentText);
const parentSha256 = createHash('sha256').update(parentText).digest('hex');
const files = ['expanded-fixture-v2.ts', 'expanded-fixture-v2.mjs', 'terrain-transform.mjs', 'terrace-convex-field.ts', 'curved-grid.ts', 'curved-grid-transform.mjs'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${dir}${file}`)).digest('hex')])));
const runs = [];
for (const mode of ['F', 'H']) {
    const outfile = `/private/tmp/sansu-expanded-fixture-v2-${mode}.mjs`;
    await build({ entryPoints: [`${dir}expanded-fixture-v2.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', EXPANDED_V2_MODE: JSON.stringify(mode) }, logLevel: 'silent', plugins: [{ name: 'expanded-v2-actual-mode', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            if (mode === 'H') {
                b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
                b.onLoad({ filter: /growing\/worldScene\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridWorldSceneTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
            }
        } }],
    });
    runs.push(JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 120_000 })));
}
assert.deepEqual(runs[0].state, runs[1].state);
assert.equal(createHash('sha256').update(await readFile(`${dir}${parentFile}`)).digest('hex'), parentSha256, 'Frozen v1 must stay unchanged');
const result = { state: runs[0].state, fixture: 'Expanded v1 plus exactly one ordinary (0,1)+1 command; explicit inherited budget fixture; no DB writes.',
    date: new Date().toISOString(), parent: { path: parentFile, sha256: parentSha256, status: parent.status }, hashes,
    commands: [...parent.commands, { command: runs[0].command, accepted: true, before: -1, after: 0 }],
    stats: { accepted: parent.stats.accepted + 1, rejected: parent.stats.rejected, onlyAdditionalHeightChange: '0,1:-1→0', ownersAndCurrencyUnchanged: true },
    physicalChecks: runs.map(({ state: _state, ...run }) => run), status: runs.every(run => run.status === 'PASS') ? 'PASS' : 'PHYSICAL_FOOTING_REMAINS',
    command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/expanded-fixture-v2.mjs' };
await writeFile(`${dir}evidence/expanded-fixture-v2.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, parentSha256, stats: result.stats, physicalChecks: result.physicalChecks }, null, 2));
