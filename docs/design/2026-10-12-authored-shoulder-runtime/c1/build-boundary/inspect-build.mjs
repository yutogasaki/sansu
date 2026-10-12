// Preparation only. --start is authorized separately after frozen c1 core PASS.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const base = '/private/tmp/sansu-authored-shoulder-c1', candidate = path.join(base, 'candidate');
const dist = path.join(candidate, 'dist'), output = path.join(base, 'build-boundary');
const revision = 'authored-shoulder-c1';
const baselinePath = 'docs/design/2026-10-12-authored-cove-runtime/c4/core/report.json';
const sourceRoot = 'docs/design/2026-10-12-authored-central-shoulder';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = async file => sha(await readFile(file));
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
async function inventory(root) {
    const files = [];
    async function visit(relative) {
        for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
            const next = path.join(relative, entry.name);
            if (entry.isDirectory()) await visit(next);
            else if (entry.isFile()) files.push(next);
            else throw Error(`Unexpected non-file dist entry: ${next}`);
        }
    }
    await visit('');
    return Object.fromEntries(await Promise.all(files.sort().map(async file => {
        const bytes = await readFile(path.join(root, file)); return [file, { bytes: bytes.length, sha256: sha(bytes) }];
    })));
}

if (!process.argv.includes('--start')) {
    console.log(json({ prepared: true, executionStarted: false, inventoryCollected: false, candidate, dist, output,
        requires: 'Terminal frozen c1 core PASS; inherited 2137 c4 input names plus final new closure',
        scope: 'One read-only dist/precache/asset-budget inspection; no browser, build or core invocation' }));
} else {
    await mkdir(output); // Refuse overwriting either failed or completed evidence.
    const script = await readFile(fileURLToPath(import.meta.url));
    await writeFile(path.join(output, 'inspect-build.mjs'), script, { flag: 'wx' });
    const report = { pass: false, candidate, expectedRevision: revision, inspectionScriptSha256: sha(script),
        scope: 'Normal native=false production payload inspection after core. Named JS, metadata and inline JSON are separately inventoried; this does not claim all authored/native code or data is absent.' };
    try {
        const corePath = path.join(base, 'core/report.json'), snapshotPath = path.join(base, 'snapshot.json'), closurePath = path.join(base, 'closure/inputs.json');
        const [core, snapshot, closure, baseline] = await Promise.all([readJSON(corePath), readJSON(snapshotPath), readJSON(closurePath), readJSON(path.join(candidate, baselinePath))]);
        assert(core.pass === true && core.phase === 'complete' && core.exitCode === 0 && core.sourceFixed === true, 'Requires terminal core PASS');
        assert.equal(core.target, candidate); assert.equal(core.revision, revision);
        assert.equal(snapshot.dest, candidate); assert.deepEqual(snapshot.changedDuringCopy, []); assert.deepEqual(snapshot.closureDifferences, []);
        assert(baseline.pass === true && baseline.sourceFixed === true, 'Durable c4 baseline must be a fixed PASS');
        assert.deepEqual(baseline.initialInputs, baseline.finalInputs);
        assert.equal(Object.keys(baseline.initialInputs).length, 2137, 'Expected the actual inherited c4 2137-file closure');
        assert.deepEqual(core.initialInputs, closure); assert.deepEqual(core.finalInputs, closure);
        assert.equal(core.closureSha256, await hashFile(closurePath)); assert.equal(snapshot.closureSha256, core.closureSha256);
        const missingInherited = Object.keys(baseline.initialInputs).filter(file => !Object.hasOwn(closure, file));
        assert.deepEqual(missingInherited, []);
        for (const file of [`${sourceRoot}/central-shoulder-components-normal-v2.glb`, `${sourceRoot}/central-shoulder-source-normal-v2.glb`,
            `${sourceRoot}/central-shoulder-source.blend`, `${sourceRoot}/geometry-profile.json.gz`,
            'prototypes/place-qa/authored-shoulder-profile.json.gz', 'prototypes/place-qa/native-shoulder-components.glb.gz',
            'prototypes/place-qa/native-shoulder-manifest.json', 'prototypes/place-qa/native05-world-source-shading.json.gz'])
            assert(Object.hasOwn(closure, file), `Required new source absent from core closure: ${file}`);
        const inputDifferences = [];
        for (const [file, expected] of Object.entries(closure))
            if (snapshot.files[file] !== expected || await hashFile(path.join(candidate, file)) !== expected) inputDifferences.push(file);
        assert.deepEqual(inputDifferences, [], 'Current source must match snapshot/core/closure');
        const inherited = new Set(Object.keys(baseline.initialInputs));
        report.inputs = { count: Object.keys(closure).length, inheritedCount: inherited.size,
            newInputNames: Object.keys(closure).filter(file => !inherited.has(file)), differences: inputDifferences,
            comparedTo: ['core.initialInputs', 'core.finalInputs', 'snapshot.files', 'closure/inputs.json', 'current candidate'],
            coreReportSha256: await hashFile(corePath), closureSha256: await hashFile(closurePath), snapshotSha256: await hashFile(snapshotPath),
            inheritedBaselineReport: baselinePath, inheritedBaselineSha256: await hashFile(path.join(candidate, baselinePath)) };
        const { ASSET_BUDGETS, extractPrecacheUrls } = await import(pathToFileURL(path.join(candidate, 'tools/asset-policy.mjs')).href);
        const files = await inventory(dist), version = await readJSON(path.join(dist, 'version.json'));
        const precache = extractPrecacheUrls(await readFile(path.join(dist, 'sw.js'), 'utf8'));
        const missingPrecache = precache.filter(file => !files[file]);
        const precacheBytes = precache.reduce((sum, file) => sum + (files[file]?.bytes ?? 0), 0);
        const artPayloadPath = file => /\.(?:glb|gltf|blend\d*|bin)(?:\.gz)?$/i.test(file)
            || /(?:native05|native-(?:cove|water|flower|shoulder)|authored-(?:cove|shoulder|floor)|central-shoulder|whole-island).*\.(?:gz|json|png|jpe?g|webp|avif)$/i.test(file)
            || /(?:^|\/)(?:prototypes\/place-qa|docs\/design)(?:\/|$)/.test(file);
        const actualArtPayloads = Object.keys(files).filter(artPayloadPath), payloadHashes = new Map(), encodedSignatures = [];
        const addPayload = (digest, entry) => payloadHashes.set(digest, [...(payloadHashes.get(digest) ?? []), entry]);
        for (const [file, digest] of Object.entries(closure)) {
            if (!/^(?:prototypes\/place-qa|docs\/design)\//.test(file) || !/\.(?:glb|gltf|blend\d*|gz)$/i.test(file)) continue;
            addPayload(digest, { source: file, representation: 'original bytes' });
            const bytes = await readFile(path.join(candidate, file));
            if (bytes.length >= 48) encodedSignatures.push({ source: file, prefix: bytes.subarray(0, 48).toString('base64') });
            if (file.endsWith('.gz')) addPayload(sha(gunzipSync(bytes)), { source: file, representation: 'expanded gzip bytes' });
        }
        const renamedPayloadMatches = Object.entries(files).filter(([, entry]) => payloadHashes.has(entry.sha256))
            .map(([file, entry]) => ({ file, ...entry, sources: payloadHashes.get(entry.sha256) }));
        const patch = await readJSON(path.join(candidate, 'docs/design/2026-10-12-authored-cove-entrance/shared-apron-world-patch-v1.json'));
        const shoulderProfile = JSON.parse(gunzipSync(await readFile(path.join(candidate, 'prototypes/place-qa/authored-shoulder-profile.json.gz'))));
        const shadedWorld = JSON.parse(gunzipSync(await readFile(path.join(candidate, 'prototypes/place-qa/native05-world-source-shading.json.gz'))));
        const probes = [
            { label: 'shared cove apron district', value: patch.district, payload: false },
            { label: 'shoulder complete geometry profile', value: shoulderProfile, payload: true },
            { label: 'shoulder replacement district', value: shoulderProfile.district, payload: true },
            { label: 'source shading complete world', value: shadedWorld, payload: true },
            { label: 'source shading floor arrays', value: shadedWorld.districts.flatMap(district => district.floors), payload: true },
            { label: 'shoulder delivery manifest metadata', value: await readJSON(path.join(candidate, 'prototypes/place-qa/native-shoulder-manifest.json')), payload: false },
        ].map(probe => { const serialized = JSON.stringify(probe.value); return { ...probe, serialized,
            escaped: JSON.stringify(serialized).slice(1, -1), characters: serialized.length, sha256: sha(serialized) }; });
        const tokens = ['native-cove-corner', 'native05-owned-kit', 'native05-world', 'native05-authored-cove',
            'native-shoulder-components', 'authored-shoulder-profile', 'native05-world-source-shading', 'central-shoulder',
            'Authored cove diagnostic requires development', 'Authored shoulder diagnostic requires development'];
        const textMatches = [], inlineJSONMatches = [], embeddedPayloadMatches = [];
        for (const file of Object.keys(files).filter(file => /\.(?:js|html|json|css)$/.test(file))) {
            const text = await readFile(path.join(dist, file), 'utf8');
            const matches = tokens.filter(token => text.includes(token)).map(token => ({ token, occurrences: text.split(token).length - 1 }));
            if (matches.length) textMatches.push({ file, bytes: files[file].bytes, matches });
            for (const probe of probes) if (text.includes(probe.serialized) || text.includes(probe.escaped))
                inlineJSONMatches.push({ file, bytes: files[file].bytes, label: probe.label, payload: probe.payload,
                    exactSerializedJSONPresent: true, characters: probe.characters, sha256: probe.sha256 });
            const encoded = encodedSignatures.filter(signature => text.includes(signature.prefix));
            const glbMagic = /data:(?:model\/(?:gltf-binary|gltf\+json)|application\/octet-stream);base64,Z2xURg|Z2xURgIAAAA/.test(text);
            if (encoded.length || glbMagic) embeddedPayloadMatches.push({ file, glbMagic, matchingSourceBase64Prefixes: encoded.map(signature => signature.source) });
        }
        const namedCodeChunks = Object.keys(files).filter(file => /\.(?:js|css)$/.test(file) && /^(?:native|_native|authored|cove)/i.test(path.basename(file)))
            .map(file => ({ file, ...files[file] }));
        const authoredLoaders = Object.keys(files).filter(file => /\/authoredGrowingAssets-[^/]+\.js$/.test(file));
        const nativeStubs = Object.keys(files).filter(file => /\/_native-owned-art-disabled-[^/]+\.js$/.test(file));
        const loaderChecks = [];
        for (const file of [...authoredLoaders, ...nativeStubs]) {
            const source = await readFile(path.join(dist, file), 'utf8');
            loaderChecks.push({ file, bytes: files[file].bytes, source, hasFetch: /\bfetch\s*\(/.test(source),
                hasCoveThrow: source.includes('Authored cove diagnostic requires development'),
                hasShoulderThrow: source.includes('Authored shoulder diagnostic requires development') });
        }
        // Exactly one official read-only budget invocation; never starts a build.
        const budget = spawnSync(process.execPath, ['tools/check-asset-budget.mjs'], { cwd: candidate, encoding: 'utf8', timeout: 120000 });
        const budgetLog = (budget.stdout ?? '') + (budget.stderr ?? '') + (budget.error ? `\n${budget.error.stack}\n` : '');
        await writeFile(path.join(output, 'asset-budget.log.txt'), budgetLog, { flag: 'wx' });
        const finalFiles = await inventory(dist), outputFixed = JSON.stringify(files) === JSON.stringify(finalFiles);
        const finalInputs = {};
        for (const file of Object.keys(closure)) finalInputs[file] = await hashFile(path.join(candidate, file));
        const sourceFixed = Object.entries(closure).every(([file, digest]) => finalInputs[file] === digest);
        const flagsPass = version.revision === revision && version.island?.enabled === true
            && version.island?.nativeOwnedArt?.enabled === false && version.island?.nativeArtStudy?.enabled === false;
        await writeFile(path.join(output, 'input-hashes.json'), json(closure), { flag: 'wx' });
        await writeFile(path.join(output, 'dist-files.json'), json(files), { flag: 'wx' });
        Object.assign(report, { version, flagsPass,
            output: { files: Object.keys(files).length, bytes: Object.values(files).reduce((sum, entry) => sum + entry.bytes, 0),
                inventorySha256: await hashFile(path.join(output, 'dist-files.json')), unchangedDuringReadOnlyChecks: outputFixed },
            sourceFixedAfterInspection: sourceFixed,
            precache: { count: precache.length, bytes: precacheBytes, maxBytes: ASSET_BUDGETS.maxPrecacheBytes, missing: missingPrecache, urls: precache },
            payloadBoundary: { actualArtPayloads, renamedPayloadMatches, comparedPayloadHashes: payloadHashes.size, embeddedPayloadMatches,
                namedCodeChunks, textMatches, inlineJSONMatches, loaderChecks,
                requiredNewSourceInputs: Object.keys(closure).filter(file => file.startsWith(sourceRoot + '/') || /(?:authored-shoulder-profile|native-shoulder-|native05-world-source-shading)/.test(file)),
                interpretation: 'Exact JSON matches are positive evidence only; minifier-rewritten JSON may not match. Existing cove inline district geometry and delivered metadata are reported, not described as excluded. The boundary rejects source GLB/Blender/gzip, renamed or embedded GLB payloads, and exact large shoulder geometry profiles.' },
            officialAssetBudget: { command: 'node tools/check-asset-budget.mjs', invocations: 1, exitCode: budget.status, signal: budget.signal,
                log: 'asset-budget.log.txt', logSha256: sha(budgetLog) },
            anchors: Object.fromEntries(['version.json', 'index.html', 'sw.js'].map(file => [file, files[file]])) });
        report.pass = flagsPass && !missingPrecache.length && precache.length > 0 && precacheBytes <= ASSET_BUDGETS.maxPrecacheBytes
            && !actualArtPayloads.length && !renamedPayloadMatches.length && !embeddedPayloadMatches.length
            && !inlineJSONMatches.some(match => match.payload) && budget.status === 0 && outputFixed && sourceFixed
            && authoredLoaders.length === 1 && nativeStubs.length === 1 && loaderChecks.every(item => !item.hasFetch)
            && loaderChecks.some(item => item.hasCoveThrow && item.hasShoulderThrow);
    } catch (error) { report.error = error.stack ?? String(error); }
    await writeFile(path.join(output, 'report.json'), json(report), { flag: 'wx' });
    console.log(json({ pass: report.pass, output, inputs: report.inputs?.count, inherited: report.inputs?.inheritedCount,
        dist: report.output, error: report.error }));
    if (!report.pass) process.exitCode = 1;
}
