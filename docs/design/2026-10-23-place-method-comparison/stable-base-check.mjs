import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
import { curvedGridLandscapeTransform } from './curved-grid-transform.mjs';
const folder = 'docs/design/2026-10-23-place-method-comparison';
const files = ['stable-base-field.ts', 'stable-base-transform.mjs', 'stable-base-check.ts', 'stable-base-check.mjs',
    'terrain-transform.mjs', 'growth-seam.ts', 'evidence/expanded-fixture-v2.json', 'evidence/33-F2-used-state.json'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash('sha256').update(await readFile(`${folder}/${file}`)).digest('hex')])));
const reports = [];
for (const mode of ['F', 'H']) for (const stable of [false, true]) {
    const outfile = `/private/tmp/sansu-stable-base-${mode}-${stable}.mjs`;
    await build({ entryPoints: [`${folder}/stable-base-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        define: { 'import.meta.env.DEV': 'false', STABLE_BASE_CANDIDATE: String(stable), STABLE_BASE_MODE: JSON.stringify(mode) },
        plugins: [{ name: 'stable-base-diagnostic', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async a => {
                let source = terrainMethodTransform(foundationTransform(await readFile(a.path, 'utf8')), { mode });
                if (stable) source = stableBaseWorldTransform(source, { alwaysStable: true });
                return { loader: 'ts', contents: source };
            });
            if (stable) b.onLoad({ filter: /domain\/growingIsland\/placeTerrain\.ts$/ }, async a => ({ loader: 'ts', contents: stableBaseTerrainTransform(await readFile(a.path, 'utf8'), { alwaysStable: true }) }));
            b.onLoad({ filter: /commands\.ts$/ }, async a => ({ loader: 'ts', contents: growthSeamCommandTransform(await readFile(a.path, 'utf8'), { alwaysInherit: true }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async a => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(a.path, 'utf8')) }));
            if (mode === 'H') b.onLoad({ filter: /domain\/growingIsland\/landscape\.ts$/ }, async a => ({ loader: 'ts', contents: curvedGridLandscapeTransform(await readFile(a.path, 'utf8'), { alwaysH: true }) }));
        } }],
    });
    const report = JSON.parse(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 300_000, maxBuffer: 16 * 1024 * 1024 }));
    reports.push(report);
    await writeFile(`${folder}/evidence/stable-base-${mode}-${stable}.json`, JSON.stringify({ ...report, date: new Date().toISOString(), hashes }, null, 2));
    console.log(JSON.stringify({ ...report, initialExteriorSamples: undefined, expandedReachable: report.expandedReachable.length }));
}
const comparisons = ['F', 'H'].map(mode => {
    const a = reports.find(r => r.mode === mode && !r.stable), b = reports.find(r => r.mode === mode && r.stable);
    return { mode, initialNewExteriorDry: b.initialExteriorSamples.filter((p, i) => (p.x < -.5 || p.x > 5.5 || p.z < -.5 || p.z > 4.5)
        && p.y !== null && a.initialExteriorSamples[i].y === null).length,
    expandedLostReachable: a.expandedReachable.filter(id => !b.expandedReachable.includes(id)) };
});
await writeFile(`${folder}/evidence/stable-base-comparison.json`, JSON.stringify({ date: new Date().toISOString(), hashes, comparisons }, null, 2));
console.log(JSON.stringify(comparisons));
