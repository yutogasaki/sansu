import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
const dir = new URL('.', import.meta.url).pathname;
const sourceFiles = ['curved-grid.ts', 'curved-grid-transform.mjs', 'curved-grid-check.ts', 'curved-grid-check.mjs', 'terrain-transform.mjs', 'terrace-convex-recipe.ts', 'evidence/18-terrace-input-state.json', 'evidence/terrace-F2-recipe.json', 'evidence/33-F2-used-state.json'];
const hashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(`${dir}${file}`)).digest('hex')])));
let baseline;
for (const mode of ['F', 'H']) {
    const plugins = [{ name: 'fixed-space-projection', setup(b) {
        b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode }) }));
        b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        if (mode === 'H') {
            b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
            b.onLoad({ filter: /growing\/worldScene\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridWorldSceneTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
        }
    } }];
    const outfile = `/private/tmp/sansu-curved-grid-${mode}.mjs`;
    await build({ entryPoints: [`${dir}curved-grid-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', CURVED_GRID_MODE: JSON.stringify(mode) }, logLevel: 'silent', plugins });
    const result = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024 }));
    if (mode === 'F') baseline = result;
    const contactRegressions = [];
    if (mode === 'H') for (let i = 0; i < result.runs.length; i++) {
        const f = baseline.runs[i], h = result.runs[i];
        assert.deepEqual(h.samples, f.samples, 'H must preserve logical dry floor and saved height interpretation');
        assert.deepEqual(h.placementCells, f.placementCells, 'H must retain exact acquired rights');
        const compare = (id, old, next) => {
            if (next.absent > old.absent) contactRegressions.push({ fixture: h.name, id, reason: 'additional unsupported near-ground native mesh vertices', f: old, h: next });
            if (old.minGap !== null && next.minGap !== null && next.minGap < old.minGap - .13 || old.maxGap !== null && next.maxGap !== null && next.maxGap > old.maxGap + .13)
                contactRegressions.push({ fixture: h.name, id, reason: 'footing height deteriorated by >.13m', f: old, h: next });
        };
        compare('fixed-native-cottage', f.houseContact, h.houseContact);
        for (let j = 0; j < h.owners.length; j++) { assert.equal(h.owners[j].legal, f.owners[j].legal); compare(h.owners[j].id, f.owners[j].contact, h.owners[j].contact); }
        if (h.pierJoin.some((point, j) => f.pierJoin[j].dry && !point.dry)) contactRegressions.push({ fixture: h.name, id: 'pier-join', reason: 'first pier plank loses a previously dry support sample', f: f.pierJoin, h: h.pierJoin });
    }
    const compact = { ...result, hashes, status: contactRegressions.length ? 'FAIL' : 'PASS', contactRegressions,
        integration: 'actual terrainMethodTransform F/H plus explicit alwaysH landscape and fixed-cottage transforms',
        command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/curved-grid-check.mjs',
        runs: result.runs.map(({ samples: _samples, placementCells: _placementCells, ...run }) => run) };
    await writeFile(`${dir}evidence/curved-grid-${mode}.json`, JSON.stringify(compact, null, 2));
    console.log(JSON.stringify(compact, null, 2));
    if (mode === 'H') {
        const recipeFile = '/private/tmp/sansu-curved-grid-H-recipe.mjs';
        await build({ entryPoints: [`${dir}terrace-convex-recipe.ts`], outfile: recipeFile, bundle: true, platform: 'node', format: 'esm', define: { 'import.meta.env.DEV': 'false' }, logLevel: 'silent', plugins });
        const recipe = JSON.parse(execFileSync(process.execPath, [recipeFile], { encoding: 'utf8', timeout: 90_000 }));
        await writeFile(`${dir}evidence/curved-grid-H-recipe.json`, JSON.stringify({ ...recipe, at: new Date().toISOString(), hashes, projection: 'alwaysH:true; F2 height basis' }, null, 2));
        console.log(JSON.stringify({ recipe: recipe.status, actors: recipe.actors, failure: recipe.failure }));
        if (contactRegressions.length || recipe.status !== 'PASS') process.exitCode = 1;
    }
}
