import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { curvedGridLandscapeTransform } from './curved-grid-transform.mjs';
import { singleCompileTerrainTransform, singleCompileWorldTransform } from './single-compile-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
const files = ['single-compile-transform.mjs', 'single-compile-check.ts', 'single-compile-check.mjs', 'terrain-transform.mjs',
    'stable-base-transform.mjs', 'ramp-plane-transform.mjs', 'evidence/61-H-linear-stable-before-edit.json',
    '../../../src/domain/growingIsland/worldDefinition.ts', '../../../src/domain/growingIsland/editableTerrainWorld.ts'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
const reports = [];
for (const single of [false, true]) {
    const outfile = `/private/tmp/sansu-single-compile-${single}.mjs`;
    await build({ entryPoints: [`${folder}/single-compile-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', SINGLE_COMPILE_DIAGNOSTIC: String(single) }, plugins: [{ name: 'single-compile', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = rampPlaneTerrainTransform(stableBaseWorldTransform(terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: 'H' }), { alwaysStable: true }), { alwaysLinear: true });
                if (single) source = singleCompileTerrainTransform(source, { alwaysSingle: true });
                return { loader: 'ts', contents: source };
            });
            b.onLoad({ filter: /domain\/growingIsland\/worldDefinition\.ts$/ }, async a => ({ loader: 'ts', contents: singleCompileWorldTransform(await readFile(a.path, 'utf8')) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            b.onLoad({ filter: /domain\/growingIsland\/placeTerrain\.ts$/ }, async a => ({ loader: 'ts', contents: stableBaseTerrainTransform(await readFile(a.path, 'utf8'), { alwaysStable: true }) }));
            b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
        } }],
    });
    const report = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024 }));
    reports.push(report);
    await writeFile(`${folder}/evidence/single-compile-${single}.json`, JSON.stringify({ ...report, date: new Date().toISOString(), hashes }, null, 2));
    console.log(JSON.stringify(report));
}
for (const [i, expected] of reports[0].reports.entries()) {
    assert.equal(reports[1].reports[i].name, expected.name);
    assert.deepEqual(reports[1].reports[i].hashes, expected.hashes, `${expected.name}: floor/graph/closure/API mismatch`);
}
assert.deepEqual(reports[1].timings.map(t => [t.status, t.message]), reports[0].timings.map(t => [t.status, t.message]));
const result = { status: 'PASS', date: new Date().toISOString(), hashes,
    compared: reports[0].reports.map((r, i) => ({ name: r.name, queries: r.queryCount, routes: r.routeCount, allHashesEqual: true,
        baselineColdMs: r.coldMs, singleColdMs: reports[1].reports[i].coldMs })),
    timings: reports.map(r => ({ single: r.singleCompile, edits: r.timings })) };
await writeFile(`${folder}/evidence/single-compile-comparison.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
