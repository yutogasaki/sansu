import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { growthFixedFieldTransform } from './growth-fixed-transform.mjs';
import { growthRimTransform } from './growth-rim-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
const files = ['growth-rim-check.ts', 'growth-rim-check.mjs', 'growth-rim-transform.mjs', 'growth-fixed-field.ts', 'growth-fixed-transform.mjs', 'terrain-transform.mjs'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
const reports = [];
for (const candidate of ['A', 'fixed', 'rim']) {
    const outfile = `/private/tmp/sansu-growth-rim-${candidate}.mjs`;
    await build({ entryPoints: [`${folder}/growth-rim-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', RIM_CANDIDATE: JSON.stringify(candidate) }, plugins: [{ name: 'rim-diagnostic', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: candidate === 'A' ? 'A' : 'F' });
                if (candidate !== 'A') source = growthFixedFieldTransform(source, { alwaysFixed: true });
                if (candidate === 'rim') source = growthRimTransform(source);
                return { loader: 'ts', contents: source };
            });
        } }],
    });
    const report = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 180_000, maxBuffer: 16 * 1024 * 1024 }));
    reports.push(report);
    await writeFile(`${folder}/evidence/growth-rim-${candidate}.json`, JSON.stringify({ ...report, date: new Date().toISOString(), hashes }, null, 2));
}
const results = reports[0].scenarios.map((scenario, i) => ({ name: scenario.name,
    comparisons: reports.slice(1).map(report => ({ candidate: report.candidate,
        newDryOutside: report.scenarios[i].samples.filter((p, j) => p.x < -.5 && p.y !== null && scenario.samples[j].y === null).length,
        examples: report.scenarios[i].samples.filter((p, j) => p.x < -.5 && p.y !== null && scenario.samples[j].y === null).slice(0, 8),
        nearBoundary: report.scenarios[i].nearBoundary })) }));
const result = { date: new Date().toISOString(), hashes, counterexample: reports[0].pureBoundaryCounterexample, results,
    verdict: 'FAIL: fixed dry boundary against A wet boundary makes continuous no-new-exterior-dry impossible; cap triangulation leaves an exterior dry wedge.' };
await writeFile(`${folder}/evidence/growth-rim-comparison.json`, JSON.stringify(result, null, 2));
for (const file of ['false', 'true', 'comparison']) await copyFile(`/private/tmp/sansu-growth-fixed-${file}.json`, `${folder}/evidence/growth-fixed-${file}.json`);
console.log(JSON.stringify(result, null, 2));
