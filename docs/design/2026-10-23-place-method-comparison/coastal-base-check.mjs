import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { coastalBaseTransform } from './coastal-base-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
const directory = new URL('.', import.meta.url).pathname;
const hashes = Object.fromEntries(await Promise.all(['coastal-base-field.ts', 'coastal-base-check.ts', 'coastal-base-transform.mjs', 'coastal-base-check.mjs'].map(async file => [file, createHash('sha256').update(await readFile(`${directory}${file}`)).digest('hex')])));
hashes['recorded-UI-input'] = createHash('sha256').update(await readFile(`${directory}evidence/18-terrace-input-state.json`)).digest('hex');
hashes['actual-terrain-transform'] = createHash('sha256').update(await readFile(`${directory}terrain-transform.mjs`)).digest('hex');
let a, privateG;
for (const mode of ['A', 'G', 'G-integrated']) {
    const outfile = `/private/tmp/sansu-coastal-base-${mode}.mjs`;
    await build({ entryPoints: [`${directory}coastal-base-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', COASTAL_BASE_MODE: JSON.stringify(mode === 'A' ? 'A' : 'G') }, logLevel: 'silent',
        plugins: [{ name: 'private-g-integration', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async args => {
                const source = foundationTransform(await readFile(args.path, 'utf8'));
                return { loader: 'ts', contents: mode === 'G-integrated' ? terrainMethodTransform(source, { mode: 'G' }) : mode === 'G' ? coastalBaseTransform(source) : source };
            });
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async args => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(args.path, 'utf8')) }));
        } }],
    });
    const result = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 90_000, maxBuffer: 8 * 1024 * 1024 }));
    if (mode === 'G') privateG = result;
    if (mode === 'G-integrated') {
        const comparable = report => ({ runs: report.runs.map(({ compileMs: _compileMs, comparison: _comparison, ...run }) => run), transitions: report.transitions, pureProbes: report.pureProbes });
        assert.deepEqual(comparable(result), comparable(privateG), 'Actual G integration differs from private G in geometry, support, graph or command results');
        await writeFile(`${directory}evidence/coastal-base-integration.json`, JSON.stringify({ passed: true, at: new Date().toISOString(), hashes, compared: 'all geometry/surface vertices/indices, graph edges, dense floor samples, ownership support, fixed support and command transitions; revision strings and timing excluded', runs: result.runs.map(run => ({ name: run.name, geometryHash: run.geometryHash, walkGraphHash: run.walkGraphHash })) }, null, 2));
        console.log(JSON.stringify({ mode, passed: true, geometryAndSupportAndNavigationEqual: true, runs: result.runs.length }));
        continue;
    }
    if (mode === 'A') a = result;
    else for (let i = 0; i < result.runs.length; i++) {
        const original = a.runs[i], run = result.runs[i];
        assert.deepEqual(run.pinSamples, original.pinSamples, 'Fixed support must remain A');
        for (let j = 0; j < run.owners.length; j++) if (original.owners[j].supported) assert(run.owners[j].supported, `G lost originally legal owner: ${run.name}/${run.owners[j].id}`);
        let newlyDry = 0, unownedNewlyDry = 0, newlyWet = 0, changedOver2cm = 0, maxLowering = 0;
        for (let j = 0; j < run.surfaceSamples.length; j++) {
            const sample = run.surfaceSamples[j], y = sample.height, old = original.surfaceSamples[j].height;
            if (old === null && y !== null) {
                newlyDry++;
                if (sample.x < run.bounds.minX - .5 || sample.x > run.bounds.maxX + .5 || sample.z < -.5 || sample.z > run.bounds.depth - .5) unownedNewlyDry++;
            }
            if (old !== null && y === null) newlyWet++;
            if (old !== null && y !== null) { maxLowering = Math.max(maxLowering, old - y); if (Math.abs(y - old) > .02) changedOver2cm++; }
        }
        assert.equal(unownedNewlyDry, 0);
        const centerDifferences = run.centers.map((center, j) => ({ ...center, aHeight: original.centers[j].height,
            delta: center.height !== null && original.centers[j].height !== null ? center.height - original.centers[j].height : null })).filter(center => center.delta !== 0);
        run.comparison = { newlyDry, unownedNewlyDry, newlyWet, approximateRemovedArea: newlyWet * .01, maxLowering, changedOver2cm,
            legalA: original.centers.filter(c => c.supported).length, legalG: run.centers.filter(c => c.supported).length, centerDifferences };
    }
    const compact = { ...result, hashes, command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/coastal-base-check.mjs',
        scope: 'Actual shared triangles/domain commands; labelled diagnostic fixtures, not UI/art/child usability evidence',
        runs: result.runs.map(({ surfaceSamples: _surfaceSamples, ...run }) => run) };
    await writeFile(`${directory}evidence/coastal-base-${mode}.json`, JSON.stringify(compact, null, 2));
    console.log(JSON.stringify({ mode, passed: true, pureProbes: result.pureProbes, runs: compact.runs.map(run => ({ name: run.name, compileMs: run.compileMs, comparison: run.comparison && { ...run.comparison, centerDifferences: run.comparison.centerDifferences.length }, owners: run.owners })), accepted: result.transitions.filter(t => t.accepted).length, refused: result.transitions.filter(t => !t.accepted) }, null, 2));
}
