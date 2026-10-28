import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const files = ['high-garden-audit.ts', 'high-garden-audit.mjs', 'high-garden-recipe.ts', 'terrain-transform.mjs', 'terrace-convex-field.ts',
    'curved-grid.ts', 'curved-grid-transform.mjs', 'evidence/42-H-redone-state.json', 'evidence/high-garden-recipe.json'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${dir}${file}`)).digest('hex')])));
let canonical;
const results = [];
for (const mode of ['F', 'A', 'H']) {
    const outfile = `/private/tmp/sansu-high-garden-audit-${mode}.mjs`;
    await build({ entryPoints: [`${dir}high-garden-audit.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', HIGH_AUDIT_MODE: JSON.stringify(mode), HIGH_CANONICAL_JSON: canonical ? JSON.stringify(JSON.stringify(canonical)) : 'undefined' },
        logLevel: 'silent', plugins: [{ name: 'actual-high-garden-terrain', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            if (mode === 'H') {
                b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
                b.onLoad({ filter: /growing\/worldScene\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridWorldSceneTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
            }
        } }],
    });
    const result = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024 }));
    if (mode === 'F') canonical = result.canonicalState;
    const output = { ...result, date: new Date().toISOString(), hashes,
        integration: 'actual A/F/H terrain transform; H landscape/fixed cottage transforms enabled',
        command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/high-garden-audit.mjs' };
    await writeFile(`/private/tmp/sansu-high-garden-audit-${mode}.json`, JSON.stringify(output, null, 2)); results.push(output);
    console.log(JSON.stringify({ mode, replayFailure: result.replayFailure, owners: result.owners, coves: result.coves,
        receipts: result.life.map(l => ({ kind: l.kind, actorId: l.actorId, facts: l.receipts.map(f => ({ at: f.at, actor: f.receipt.actorId, target: f.receipt.targetId })) })) }));
}
await writeFile(`${dir}evidence/high-garden-audit.json`, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
