import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { singleCompileWorldTransform, singleCompileTerrainTransform } from './single-compile-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
import { liveUseTransform } from './live-use-transform.mjs';
import { trialTimingTransform } from './timing-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
function preceding(source, id) {
    if (id.endsWith('/editableTerrainWorld.ts')) return singleCompileTerrainTransform(rampPlaneTerrainTransform(stableBaseWorldTransform(terrainMethodTransform(foundationTransform(source), { mode: 'H' }), { alwaysStable: true }), { alwaysLinear: true }), { alwaysSingle: true });
    if (id.endsWith('/worldDefinition.ts')) return singleCompileWorldTransform(source);
    if (id.endsWith('/commands.ts')) return growthSeamCommandTransform(source);
    if (id.endsWith('/terrainEditing.ts')) return foundationCommandTransform(source);
    if (id.endsWith('/placeTerrain.ts')) return stableBaseTerrainTransform(source, { alwaysStable: true });
    if (id.endsWith('/landscape.ts')) return curvedGridLandscapeTransform(source, { alwaysH: true });
    if (id.endsWith('/GrowingWorld.tsx')) return liveUseTransform(source);
    if (id.endsWith('/worldScene.ts')) return curvedGridWorldSceneTransform(source, { alwaysH: true });
    return source;
}
const transformed = [];
for (const file of ['src/domain/growingIsland/commands.ts', 'src/domain/growingIsland/editableTerrainWorld.ts', 'src/domain/growingIsland/worldDefinition.ts', 'src/components/island/growing/GrowingWorld.tsx', 'src/components/island/growing/worldScene.ts']) {
    const source = trialTimingTransform(preceding(await readFile(file, 'utf8'), '/' + file), '/' + file);
    const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
    assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
    assert.throws(() => trialTimingTransform(source, '/' + file), /already transformed/);
    transformed.push({ file, sourceSha256: createHash('sha256').update(source).digest('hex') });
}
const results = [];
for (const enabled of [false, true]) {
    const outfile = `/private/tmp/sansu-timing-check-${enabled}.mjs`;
    await build({ entryPoints: [`${folder}/timing-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', TIMING_ENABLED: String(enabled) }, plugins: [{ name: 'actual-timing-trial', setup(b) {
            b.onLoad({ filter: /src\/domain\/growingIsland\/(editableTerrainWorld|worldDefinition|commands|terrainEditing|placeTerrain|landscape)\.ts$/ }, async a => ({ loader: 'ts', contents: trialTimingTransform(preceding(await readFile(a.path, 'utf8'), a.path), a.path) }));
        } }],
    });
    results.push(JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })));
}
assert.deepEqual(results[0].state, results[1].state);
assert.equal(results[0].rejectedMessage, results[1].rejectedMessage);
const report = { date: new Date().toISOString(), status: 'PASS', transformed, enabledDisabledStateEquality: true,
    command: `fnm exec --using=22.23.3 node ${folder}/timing-check.mjs`, results: results.map(({ state, ...r }) => ({ ...r, stateSha256: createHash('sha256').update(JSON.stringify(state)).digest('hex') })) };
await writeFile(`${folder}/evidence/timing-check.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, transformed: transformed.length, enabledAggregates: results[1].snapshot.aggregates, exceptionsRetained: true }));
