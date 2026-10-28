import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';

// Private diagnostic adapter only. The shared terrain-transform and mode union
// remain owned by the parent integration agent.
export function terraceDiagnosticTransform(source) {
    const needle = '    type Sample = Cell & { y: number };';
    if (!source.includes(needle) || !source.includes('const surfaceHeight = (cell: Cell) => {')) throw Error('D diagnostic integration changed');
    return "import { createTerraceField, TERRACE_FIELD_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/terrace-field';\n"
        + source.replace('const surfaceHeight = (cell: Cell) => {', 'const baselineSurfaceHeight = (cell: Cell) => {')
            .replace('return JSON.stringify([state.land, state.bridge?.x ?? null, heights]);', 'return JSON.stringify([TERRACE_FIELD_REVISION, state.land, state.bridge?.x ?? null, heights]);')
            .replace(needle, '    const surfaceHeight = createTerraceField(state, baselineSurfaceHeight, { minX, maxX, minZ, maxZ, detail, dryLevel: TERRAIN_DRY_LEVEL }).heightAt;\n' + needle);
}
let baseline;
const proofInputs = [
    'docs/design/2026-10-23-place-method-comparison/terrace-field.ts',
    'docs/design/2026-10-23-place-method-comparison/terrace-check.ts',
    'docs/design/2026-10-23-place-method-comparison/terrace-check.mjs',
    'docs/design/2026-10-22-place-strategy-trial/foundation-transform.mjs',
    'docs/design/2026-10-22-place-strategy-trial/foundation.ts',
    'src/domain/growingIsland/editableTerrainWorld.ts',
    'src/domain/growingIsland/terrainEditing.ts',
    'src/components/island/growing/growingLife.ts',
];
const inputHashes = Object.fromEntries(await Promise.all(proofInputs.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
for (const mode of ['A', 'D']) {
    const outfile = `/private/tmp/sansu-terrace-${mode}.mjs`;
    await build({ entryPoints: ['docs/design/2026-10-23-place-method-comparison/terrace-check.ts'], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', TERRACE_DIAGNOSTIC_MODE: JSON.stringify(mode) }, logLevel: 'silent',
        plugins: [{ name: 'terrace-diagnostic', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let contents = foundationTransform(await readFile(a.path, 'utf8'));
                if (mode === 'D') contents = terraceDiagnosticTransform(contents);
                return { loader: 'ts', contents };
            });
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        } }],
    });
    const output = execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 60_000 });
    const report = JSON.parse(output);
    if (mode === 'A') baseline = report;
    else for (let i = 0; i < report.runs.length; i++) {
        const a = baseline.runs[i].surfaceSamples, d = report.runs[i].surfaceSamples;
        let newlyDry = 0, outsideChanged = 0, maxDifference = 0, wetA = 0;
        assert.equal(a.length, d.length);
        for (let p = 0; p < a.length; p++) {
            const x = -1 + p % 71 / 10, z = -1 + Math.floor(p / 71) / 10;
            if (a[p] === null) { wetA++; if (d[p] !== null) newlyDry++; }
            if ((x < -.5 || x > 5.5 || z < -.5 || z > 4.5) && a[p] !== d[p]) outsideChanged++;
            if (a[p] !== null && d[p] !== null) maxDifference = Math.max(maxDifference, Math.abs(a[p] - d[p]));
        }
        assert.equal(newlyDry, 0, 'Actual D triangles must not fill any A opening');
        assert.equal(outsideChanged, 0, 'Actual unowned dry floor must remain exactly A');
        report.runs[i].surfaceComparison = { sampled: a.length, wetA, newlyDry, outsideChanged, maxDifference };
    }
    const compact = { ...report, date: new Date().toISOString(), inputHashes,
        command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/terrace-check.mjs',
        runs: report.runs.map(run => { const copy = { ...run }; delete copy.surfaceSamples; return copy; }) };
    await writeFile(`/private/tmp/sansu-terrace-${mode}.json`, JSON.stringify(compact, null, 2));
    console.log(JSON.stringify(compact, null, 2));
}
