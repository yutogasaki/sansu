import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
import { growthFixedFieldTransform } from './growth-fixed-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
const hashes = Object.fromEntries(await Promise.all(['growth-fixed-field.ts', 'growth-fixed-transform.mjs', 'growth-fixed-check.ts',
    'growth-fixed-check.mjs', 'growth-seam.ts', 'growth-seam-transform.mjs', 'terrain-transform.mjs', 'evidence/33-F2-used-state.json']
    .map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
const reports = [];
for (const fixed of [false, true]) {
    const outfile = `/private/tmp/sansu-growth-fixed-${fixed}.mjs`;
    await build({ entryPoints: [`${folder}/growth-fixed-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', FIXED_GROWTH_CANDIDATE: String(fixed) },
        plugins: [{ name: 'growth-fixed', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode: 'F' });
                if (fixed) source = growthFixedFieldTransform(source, { alwaysFixed: true });
                return { loader: 'ts', contents: source };
            });
            b.onLoad({ filter: /commands\.ts$/ }, async a => ({ loader: 'ts', contents: growthSeamCommandTransform(await readFile(a.path, 'utf8'), { alwaysInherit: true }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
        } }],
    });
    const report = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 360_000, maxBuffer: 16 * 1024 * 1024 }));
    reports.push(report);
    await writeFile(`/private/tmp/sansu-growth-fixed-${fixed}.json`, JSON.stringify({ ...report, date: new Date().toISOString(), hashes }, null, 2));
    console.log(JSON.stringify({ ...report, initialSamples: undefined }, null, 2));
}
const [a, b] = reports; let newDryOutside = 0, lostDryOutside = 0, maxDelta = 0;
for (const [i, point] of a.initialSamples.entries()) {
    const next = b.initialSamples[i];
    if (point.y !== null && next.y !== null) maxDelta = Math.max(maxDelta, Math.abs(next.y - point.y));
    if (point.x >= -.5 && point.x <= 5.5 && point.z >= -.5 && point.z <= 4.5) continue;
    if (point.y === null && next.y !== null) newDryOutside++;
    if (point.y !== null && next.y === null) lostDryOutside++;
}
const comparison = { date: new Date().toISOString(), newDryOutside, lostDryOutside, maxInitialSurfaceDelta: maxDelta, hashes };
await writeFile('/private/tmp/sansu-growth-fixed-comparison.json', JSON.stringify(comparison, null, 2));
console.log(JSON.stringify(comparison, null, 2));
