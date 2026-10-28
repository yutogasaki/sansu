import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';

// Private diagnostic adapter only. The shared terrain-transform and mode union
// remain owned by the parent integration agent.
export function convexTerraceDiagnosticTransform(source) {
    const start = source.indexOf('    const sx = ');
    const end = source.indexOf('    return baseTerrainHeightAt(state, cell)', start);
    if (start < 0 || end < start) throw Error('F diagnostic raw interpolation changed');
    return "import { convexTerraceOffset, coarseTriangleValue, CONVEX_TERRACE_FIELD_REVISION } from '../../../docs/design/2026-10-23-place-method-comparison/terrace-convex-field';\n"
        + (source.slice(0, start) + '    const offset = convexTerraceOffset(state.terrain?.heights ?? {}, cell, bounds);\n' + source.slice(end))
            .replace('const detail = 6, margin = 1.5;', 'const detail = 12, margin = 1.5;')
            .replace('const physical = (cell: Cell) => curved ? landscapePoint(cell) : cell;',
                'const exterior = (cell: Cell) => cell.x <= bounds.minX || cell.x >= bounds.maxX || cell.z <= 0 || cell.z >= bounds.depth - 1;\n'
                + '    const physical = (cell: Cell) => { const sample = (p: Cell) => curved ? landscapePoint(p) : p; return exterior(cell) ? { x: coarseTriangleValue(p => sample(p).x, cell), z: coarseTriangleValue(p => sample(p).z, cell) } : sample(cell); };')
            .replace('const surfaceHeight = (cell: Cell) => {', 'const rawSurfaceHeight = (cell: Cell) => {')
            .replace('    type Sample = Cell & { y: number };',
                '    const surfaceHeight = (cell: Cell) => exterior(cell) ? coarseTriangleValue(rawSurfaceHeight, cell) : rawSurfaceHeight(cell);\n    type Sample = Cell & { y: number };')
            .replace('return JSON.stringify([state.land, state.bridge?.x ?? null, heights]);', 'return JSON.stringify([CONVEX_TERRACE_FIELD_REVISION, state.land, state.bridge?.x ?? null, heights]);');
}
let baseline;
let privateReport;
const proofInputs = [
    'docs/design/2026-10-23-place-method-comparison/terrace-convex-field.ts',
    'docs/design/2026-10-23-place-method-comparison/terrace-convex-check.ts',
    'docs/design/2026-10-23-place-method-comparison/terrace-convex-check.mjs',
    'docs/design/2026-10-23-place-method-comparison/terrain-transform.mjs',
    'docs/design/2026-10-23-place-method-comparison/section-profile.ts',
    'docs/design/2026-10-22-place-strategy-trial/foundation-transform.mjs',
    'docs/design/2026-10-22-place-strategy-trial/foundation.ts',
    'src/domain/growingIsland/editableTerrainWorld.ts',
    'src/domain/growingIsland/terrainEditing.ts',
    'src/components/island/growing/growingLife.ts',
];
const inputHashes = Object.fromEntries(await Promise.all(proofInputs.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
for (const mode of ['A', 'F', 'F-shared']) {
    const outfile = `/private/tmp/sansu-terrace-convex-${mode}.mjs`;
    await build({ entryPoints: ['docs/design/2026-10-23-place-method-comparison/terrace-convex-check.ts'], outfile, bundle: true, platform: 'node', format: 'esm',
        define: { 'import.meta.env.DEV': 'false', CONVEX_TERRACE_DIAGNOSTIC_MODE: JSON.stringify(mode === 'A' ? 'A' : 'F') }, logLevel: 'silent',
        plugins: [{ name: 'terrace-diagnostic', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let contents = foundationTransform(await readFile(a.path, 'utf8'));
                if (mode === 'F') contents = convexTerraceDiagnosticTransform(contents);
                if (mode === 'F-shared') contents = terrainMethodTransform(contents, { mode: 'F' });
                return { loader: 'ts', contents };
            });
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        } }],
    });
    const output = execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 120_000 });
    const report = JSON.parse(output);
    if (mode === 'F') privateReport = structuredClone(report);
    if (mode === 'F-shared') assert.deepEqual(report, privateReport, 'The actual browser F transform must match the private floor/route/support/response diagnostic');
    if (mode === 'A') baseline = report;
    else for (let i = 0; i < report.runs.length; i++) {
        const a = baseline.runs[i].surfaceSamples, d = report.runs[i].surfaceSamples;
        let newlyDry = 0, outsideChanged = 0, outsideMaxDifference = 0, maxDifference = 0, wetA = 0;
        assert.equal(a.length, d.length);
        for (let p = 0; p < a.length; p++) {
            const x = -1 + p % 71 / 10, z = -1 + Math.floor(p / 71) / 10;
            if (a[p] === null) { wetA++; if (d[p] !== null) newlyDry++; }
            if (x < -.5 || x > 5.5 || z < -.5 || z > 4.5) {
                const difference = a[p] === null || d[p] === null ? (a[p] === d[p] ? 0 : Infinity) : Math.abs(a[p] - d[p]);
                outsideMaxDifference = Math.max(outsideMaxDifference, difference);
                if (difference > 1e-7) outsideChanged++;
            }
            if (a[p] !== null && d[p] !== null) maxDifference = Math.max(maxDifference, Math.abs(a[p] - d[p]));
        }
        // A wet-sample equality is diagnostic, not the F contract.
        assert.equal(outsideChanged, 0, 'F must preserve the exterior floor despite finer interior detail');
        report.runs[i].surfaceComparison = { sampled: a.length, wetA, newlyDry, outsideChanged, outsideMaxDifference, maxDifference };
    }
    const compact = { ...report, integration: mode === 'F-shared' ? 'actual terrainMethodTransform(mode F); exact diagnostic equality PASS' : 'private diagnostic',
        date: new Date().toISOString(), inputHashes,
        command: 'fnm exec --using=22.23.3 node docs/design/2026-10-23-place-method-comparison/terrace-convex-check.mjs',
        runs: report.runs.map(run => { const copy = { ...run }; delete copy.surfaceSamples; return copy; }) };
    await writeFile(`/private/tmp/sansu-terrace-convex-${mode}.json`, JSON.stringify(compact, null, 2));
    console.log(JSON.stringify(compact, null, 2));
}
