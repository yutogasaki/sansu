import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ASSET_BUDGETS, extractPrecacheUrls } from '../candidate/tools/asset-policy.mjs';

const base = '/private/tmp/sansu-authored-cove-c2';
const candidate = path.join(base, 'candidate'), output = path.join(base, 'build-boundary'), dist = path.join(candidate, 'dist');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = async name => sha(await readFile(name));
const readJSON = async name => JSON.parse(await readFile(name, 'utf8'));
async function inventory(root) {
    const files = [];
    async function visit(relative) {
        for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
            const next = path.join(relative, entry.name);
            if (entry.isDirectory()) await visit(next);
            else if (entry.isFile()) files.push(next);
        }
    }
    await visit('');
    return Object.fromEntries(await Promise.all(files.sort().map(async file => {
        const bytes = await readFile(path.join(root, file));
        return [file, { bytes: bytes.length, sha256: sha(bytes) }];
    })));
}
const core = await readJSON(path.join(base, 'core/report.json'));
if (!(core.pass && core.phase === 'complete' && core.exitCode === 0 && core.sourceFixed)) throw Error('Requires terminal PASS for the immutable c2 candidate');
const snapshot = await readJSON(path.join(base, 'snapshot.json'));
const inputDifferences = [];
for (const [file, expected] of Object.entries(core.initialInputs)) {
    const actual = await hashFile(path.join(candidate, file));
    if (actual !== expected || core.finalInputs[file] !== expected || snapshot.files[file] !== expected) inputDifferences.push(file);
}
if (inputDifferences.length) throw Error(`Frozen input mismatch: ${inputDifferences.join(', ')}`);
const files = await inventory(dist), version = await readJSON(path.join(dist, 'version.json'));
const sw = await readFile(path.join(dist, 'sw.js'), 'utf8'), precache = extractPrecacheUrls(sw);
const missingPrecache = precache.filter(file => !files[file]);
const precacheBytes = precache.reduce((sum, file) => sum + (files[file]?.bytes ?? 0), 0);
const artPayloadPath = file => /\.(?:glb|gltf|blend|bin)(?:\.gz)?$/i.test(file)
    || /(?:native05|native-cove|native-water|native-flower|authored-cove|whole-island).*\.(?:gz|json|png|jpe?g|webp|avif)$/i.test(file)
    || /(?:^|\/)(?:prototypes\/place-qa|docs\/design)(?:\/|$)/.test(file);
const actualArtPayloads = Object.keys(files).filter(artPayloadPath);
const sourcePayloadHashes = new Map(Object.entries(core.initialInputs).filter(([file]) =>
    /^(?:prototypes\/place-qa|docs\/design)\//.test(file) && /\.(?:glb|gltf|blend|gz)$/i.test(file)).map(([file, digest]) => [digest, file]));
const renamedPayloadMatches = Object.entries(files).filter(([, item]) => sourcePayloadHashes.has(item.sha256))
    .map(([file, item]) => ({ file, source: sourcePayloadHashes.get(item.sha256), ...item }));
const textMatches = [], embeddedPayloadMatches = [];
const covePatch = await readJSON(path.join(candidate, 'docs/design/2026-10-12-authored-cove-entrance/shared-apron-world-patch-v1.json'));
const districtJSON = JSON.stringify(covePatch.district), inlineCoveDefinitions = [];
const tokens = ['native-cove-corner', 'cove-corner-v3.glb', 'native05-owned-kit', 'native05-world', 'native05-authored-cove', 'Authored cove diagnostic requires development'];
for (const file of Object.keys(files).filter(file => /\.(?:js|html|json|css)$/.test(file))) {
    const text = await readFile(path.join(dist, file), 'utf8');
    const matches = tokens.filter(token => text.includes(token)).map(token => ({ token, occurrences: text.split(token).length - 1 }));
    if (matches.length) textMatches.push({ file, bytes: files[file].bytes, matches });
    if (text.includes(districtJSON)) inlineCoveDefinitions.push({ file, bytes: files[file].bytes,
        exactSerializedDistrictPresent: true, serializedDistrictCharacters: districtJSON.length, districtSha256: sha(districtJSON),
        floorCount: covePatch.district.floors.length, vertices: covePatch.district.floors.reduce((sum, floor) => sum + floor.vertices.length, 0),
        triangles: covePatch.district.floors.reduce((sum, floor) => sum + floor.indices.length / 3, 0),
        districtSites: covePatch.district.sites.length, sourcePatchEdgeCount: covePatch.edges.length,
        interpretation: 'Actual shared-apron district geometry and walk-site data remains inline in JS. This is more than descriptive names, but is separate from absent native GLB/gzip/Blender art payloads.' });
    if (/data:(?:model\/(?:gltf-binary|gltf\+json)|application\/octet-stream);base64,Z2xURg|Z2xURgIAAAA/.test(text)) embeddedPayloadMatches.push(file);
}
const namedCodeChunks = Object.keys(files).filter(file => /\.(?:js|css)$/.test(file) && /^(?:native|_native|authored|cove)/i.test(path.basename(file)))
    .map(file => ({ file, ...files[file] }));
const authoredLoaders = Object.keys(files).filter(file => /\/authoredGrowingAssets-[^/]+\.js$/.test(file));
const nativeStubs = Object.keys(files).filter(file => /\/_native-owned-art-disabled-[^/]+\.js$/.test(file));
const loaderChecks = [];
for (const file of authoredLoaders) {
    const source = await readFile(path.join(dist, file), 'utf8');
    loaderChecks.push({ file, type: 'DEV diagnostic throws', source, hasFetch: /\bfetch\s*\(/.test(source), hasCoveThrow: source.includes('Authored cove diagnostic requires development') });
}
for (const file of nativeStubs) {
    const source = await readFile(path.join(dist, file), 'utf8');
    loaderChecks.push({ file, type: 'native disabled no-op', source, hasFetch: /\bfetch\s*\(/.test(source), hasCoveThrow: false });
}
const budget = spawnSync(process.execPath, [path.join(candidate, 'tools/check-asset-budget.mjs')], { cwd: candidate, encoding: 'utf8' });
await writeFile(path.join(output, 'asset-budget.log.txt'), (budget.stdout ?? '') + (budget.stderr ?? ''));
const finalFiles = await inventory(dist);
const outputFixed = JSON.stringify(files) === JSON.stringify(finalFiles);
const flagsPass = version.revision === 'authored-cove-c2' && version.island.enabled === true
    && version.island.nativeOwnedArt.enabled === false && version.island.nativeArtStudy.enabled === false;
const pass = flagsPass && !missingPrecache.length && precacheBytes <= ASSET_BUDGETS.maxPrecacheBytes && precache.length > 0
    && !actualArtPayloads.length && !renamedPayloadMatches.length && !embeddedPayloadMatches.length && budget.status === 0
    && authoredLoaders.length === 1 && nativeStubs.length === 1 && loaderChecks.every(item => !item.hasFetch)
    && loaderChecks.some(item => item.hasCoveThrow) && outputFixed;
await writeFile(path.join(output, 'input-hashes.json'), JSON.stringify(core.initialInputs, null, 2) + '\n');
await writeFile(path.join(output, 'dist-files.json'), JSON.stringify(files, null, 2) + '\n');
const report = {
    pass, scope: 'Read-only inspection after terminal core PASS. Native art false; actual source art payload absence is distinct from shipped JS adapters/metadata. No browser, build or core run was started here.',
    candidate, version, flagsPass,
    inputs: { count: Object.keys(core.initialInputs).length, comparedTo: ['core.initialInputs', 'core.finalInputs', 'snapshot.files', 'current candidate'], differences: inputDifferences,
        sha256: await hashFile(path.join(output, 'input-hashes.json')), coreReportSha256: await hashFile(path.join(base, 'core/report.json')),
        coreClosureSha256: core.closureSha256, snapshotSha256: await hashFile(path.join(base, 'snapshot.json')) },
    output: { files: Object.keys(files).length, bytes: Object.values(files).reduce((sum, file) => sum + file.bytes, 0), inventorySha256: await hashFile(path.join(output, 'dist-files.json')), unchangedDuringReadOnlyChecks: outputFixed },
    precache: { count: precache.length, bytes: precacheBytes, maxBytes: ASSET_BUDGETS.maxPrecacheBytes, missing: missingPrecache, urls: precache },
    payloadBoundary: { actualArtPayloads, renamedPayloadMatches, comparedSourcePayloadHashes: sourcePayloadHashes.size, embeddedPayloadMatches, namedCodeChunks,
        textMatches, inlineCoveDefinitions, loaderChecks, distinction: 'The 8,482-byte nativeAuthoredFlower adapter, disabled loader stubs, cove source metadata, and actual shared-apron district floor/walk-site definition remain in JS. They are distinct from absent native GLB/gzip/Blender source files. This result does not claim all authored code/data was tree-shaken or absent.' },
    officialAssetBudget: { command: 'node tools/check-asset-budget.mjs', exitCode: budget.status, log: 'asset-budget.log.txt', logSha256: await hashFile(path.join(output, 'asset-budget.log.txt')) },
    anchors: Object.fromEntries(['version.json', 'index.html', 'sw.js'].map(file => [file, files[file]])),
    inspectionScriptSha256: await hashFile(path.join(output, 'inspect-build.mjs')),
};
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ pass, revision: version.revision, native: version.island.nativeOwnedArt.enabled, dist: report.output,
    precache: { count: precache.length, bytes: precacheBytes, maxBytes: ASSET_BUDGETS.maxPrecacheBytes }, inputCount: report.inputs.count,
    payloadFileCount: actualArtPayloads.length, renamedPayloadCount: renamedPayloadMatches.length, embeddedPayloadCount: embeddedPayloadMatches.length,
    codeChunks: namedCodeChunks, inlineCoveDefinitions, assetBudgetExitCode: budget.status }, null, 2));
if (!pass) process.exitCode = 1;
