import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const files = ['ramp-plane-field.ts', 'ramp-plane-transform.mjs', 'ramp-plane-check.ts', 'ramp-plane-check.mjs', 'terrain-transform.mjs',
    'terrace-convex-field.ts', 'curved-grid.ts', 'curved-grid-transform.mjs', 'stable-base-field.ts', 'stable-base-transform.mjs', 'evidence/expanded-fixture-v2.json'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${dir}${file}`)).digest('hex')])));
const flowerX = process.argv.includes('--flower-x=2') ? 2 : 1;
const suffix = flowerX === 2 ? '-pair2' : '';
const results = []; let canonical;
for (const [mode, linear, stable] of [['F', false, false], ['F', true, false], ['H', false, false], ['H', true, false], ['F', false, true], ['H', false, true], ...(flowerX === 2 ? [['F', true, true], ['H', true, true]] : [])]) {
    const name = `${mode}-${linear ? 'linear' : 'default'}-${stable ? 'stable' : 'legacy'}`;
    const outfile = `/private/tmp/sansu-ramp-plane${suffix}-${name}.mjs`;
    await build({ entryPoints: [`${dir}ramp-plane-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', RAMP_AUDIT_MODE: JSON.stringify(name), RAMP_FLOWER_X: String(flowerX), RAMP_CANONICAL_JSON: canonical ? JSON.stringify(JSON.stringify(canonical)) : 'undefined' }, logLevel: 'silent', plugins: [{ name: 'independent-ramp-basis', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode });
                if (stable) source = stableBaseWorldTransform(source, { alwaysStable: true });
                if (linear) source = rampPlaneTerrainTransform(source, { alwaysLinear: true });
                return { loader: 'ts', contents: source };
            });
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            if (stable) b.onLoad({ filter: /domain\/growingIsland\/placeTerrain\.ts$/ }, async a => ({ loader: 'ts', contents: stableBaseTerrainTransform(await readFile(a.path, 'utf8'), { alwaysStable: true }) }));
            if (mode === 'H') {
                b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
                b.onLoad({ filter: /growing\/worldScene\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridWorldSceneTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
            }
        } }],
    });
    const result = { ...JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024 })),
        date: new Date().toISOString(), hashes, command: `fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/ramp-plane-check.mjs${flowerX === 2 ? ' --flower-x=2' : ''}` };
    if (!canonical) canonical = result.state;
    await writeFile(`/private/tmp/sansu-ramp-plane${suffix}-${name}.json`, JSON.stringify(result, null, 2)); results.push(result);
    console.log(JSON.stringify({ name, moves: result.moves, owners: result.owners, receipts: result.life.map(l => ({ kind: l.kind, actor: l.actorId,
        facts: l.receipts.map(f => ({ actor: f.receipt.actorId, target: f.receipt.targetId, at: f.at })) })) }));
}
await writeFile(`${dir}evidence/ramp-plane-check${suffix}.json`, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
