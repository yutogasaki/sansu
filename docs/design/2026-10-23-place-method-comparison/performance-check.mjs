import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
const directory = new URL('.', import.meta.url).pathname, entries = [];
const inputs = ['src/domain/growingIsland/editableTerrainWorld.ts', `${directory}section-profile.ts`, `${directory}coastal-field.ts`, `${directory}terrain-transform.mjs`, `${directory}performance-check.ts`];
const hashes = Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const selected = process.argv.includes('--c-only') ? ['C'] : ['A', 'B', 'C'];
for (const method of selected) {
    const outfile = `/private/tmp/sansu-method-performance-${method}.mjs`;
    await build({ entryPoints: [`${directory}performance-check.ts`], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
        plugins: [{ name: 'explicit-node-method', setup(b) {
            b.onLoad({ filter: /editableTerrainWorld\.ts$/ }, async args => ({ loader: 'ts', contents: terrainMethodTransform(foundationTransform(await readFile(args.path, 'utf8')), { mode: method }) }));
            b.onLoad({ filter: /terrainEditing\.ts$/ }, async args => ({ loader: 'ts', contents: foundationCommandTransform(await readFile(args.path, 'utf8')) }));
            b.onLoad({ filter: /section-profile\.ts$/ }, async args => ({ loader: 'ts', contents: (await readFile(args.path, 'utf8'))
                .replace("search = typeof window === 'undefined' ? '' : window.location.search", `search = '?terrainTrial=${method}'`) }));
        } }],
    });
    for (const kind of ['initial', 'expanded', 'multiple-bays']) for (let trial = 1; trial <= 3; trial++) {
        const result = JSON.parse(execFileSync(process.execPath, [outfile, kind], { encoding: 'utf8', timeout: 60_000 }));
        entries.push({ ...result, trial });
    }
    const scan = JSON.parse(execFileSync(process.execPath, [outfile, 'scan'], { encoding: 'utf8', timeout: 120_000 }));
    entries.push(scan);
}
await mkdir(`${directory}evidence`, { recursive: true });
const output = { at: new Date().toISOString(), node: process.version, scope: 'Fresh Node process per cold trial; all compilation and graph work included; no browser frame/GPU measurements', hashes, entries };
await writeFile(`${directory}evidence/performance-results.json`, JSON.stringify(output, null, 2) + '\n');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({ at: output.at, summary: selected.map(method => ({ method,
    cold: ['initial', 'expanded', 'multiple-bays'].map(kind => { const trials = entries.filter(e => e.method === method && e.kind === kind); return { kind,
        medianMs: median(trials.map(e => e.coldMs)), minMs: Math.min(...trials.map(e => e.coldMs)), maxMs: Math.max(...trials.map(e => e.coldMs)),
        cacheHitMedianMs: median(trials.map(e => e.cacheHitMedianMs)), heapDeltaMedianBytes: median(trials.map(e => e.heapDeltaBytes)) }; }),
    continuity: (() => { const scan = entries.find(e => e.method === method && e.kind === 'scan'), accepted = scan.tracks.flatMap(t => t.steps).filter(s => s.accepted);
        return { acceptedSteps: accepted.length, refusedTracks: scan.tracks.filter(t => t.steps.some(s => !s.accepted)).length, warnings: scan.warnings.length,
            maxCenterSuppressionVsA: Math.max(...accepted.map(s => s.center.suppressionVsA)), minRaiseCenterDelta: Math.min(...scan.tracks.filter(t => t.delta > 0).flatMap(t => t.steps).filter(s => s.accepted).map(s => s.center.delta)),
            maxRaiseReversal: Math.max(...accepted.map(s => s.maxRaiseReversal)), reversedRaiseSteps: accepted.filter(s => s.reversedRaiseProbes > 0).length,
            maxDryHeightJump: Math.max(...accepted.map(s => s.maxDryHeightJump)), maxExtraResponse: Math.max(...accepted.map(s => s.maxExtraResponse)),
            commandMedianMs: median(accepted.map(s => s.commandMs)), commandMaxMs: Math.max(...accepted.map(s => s.commandMs)), worstWarnings: scan.warnings.sort((a,b)=>b.maxExtraResponse-a.maxExtraResponse).slice(0,3) }; })(),
})) }, null, 2));
