import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { hash, ownedState, stableJSON } from './growing-fixture-data.mjs';

export const CAPTURE_SCHEMA = 'sansu-growing-captures-v1';
export const captureConditions = pack => ({ epoch: pack.epoch, timezone: pack.timezone, soundEnabled: false,
    hasTouch: true, deviceScaleFactor: 1, browser: 'chromium' });

export async function readRegular(file) {
    assert((await fs.lstat(file)).isFile(), `Evidence must be a regular file: ${file}`);
    return fs.readFile(file);
}

export async function readCapture(file, pack) {
    const directory = await fs.realpath(path.dirname(file)), reportFile = path.join(directory, path.basename(file));
    const reportBytes = await readRegular(reportFile), report = JSON.parse(reportBytes);
    assert.equal(report.schema, CAPTURE_SCHEMA, 'Unsupported capture report; recapture with image/native hashes');
    assert.equal(report.pass, true, 'Capture did not pass');
    assert.equal(report.gates?.fixtureRuntime, 'PASS', 'Fixture runtime gate did not pass');
    assert.equal(report.payloadHash, pack.payloadHash, 'Different fixture payload');
    assert.equal(report.sourceHash, pack.sourceHash, 'Different fixture source');
    assert.deepEqual(report.conditions, captureConditions(pack), 'Different capture conditions');
    const version = report.version;
    assert(version?.version && version.revision, 'Build identity missing');
    assert.equal(version.delivery, 'snap-root-v1'); assert.equal(version.island?.enabled, true);
    for (const value of [version.version, version.revision, version.visualLineage, version.island.delivery, version.island.candidate, version.island.learningCandidate]) {
        assert(typeof value === 'string' && value.length, 'Build candidate/identity missing');
    }
    for (const key of ['enabled', 'discovery', 'fantasy']) assert.equal(typeof version.island.life?.[key], 'boolean', 'Feature condition missing');
    assert(Number.isInteger(version.island.life?.saveVersion), 'Save version condition missing');
    for (const manifest of [report.initialBuild, report.initialQA]) {
        assert(manifest && Object.keys(manifest).length, 'Input manifest missing');
        assert(Object.values(manifest).every(value => /^[a-f0-9]{64}$/.test(value)), 'Invalid input manifest hash');
    }
    assert(report.initialBuild['version.json'], 'Build version hash missing');
    const target = new URL(report.target);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && ['http:', 'https:'].includes(target.protocol)
        && !target.username && !target.password && target.href === `${target.origin}/`, 'Expected loopback capture target');
    assert.equal(report.cases?.length, 6, 'Expected all six captures');
    const fingerprints = { [reportFile]: hash(reportBytes) }, cases = [];
    for (const fixture of pack.cases) for (const width of [390, 768]) {
        const matches = report.cases.filter(item => item.id === fixture.id && item.width === width);
        assert.equal(matches.length, 1, 'Missing or duplicate capture');
        const item = matches[0], height = width === 390 ? 844 : 1024, metadata = item.metadata, root = metadata?.appRoot;
        assert.equal(item.pass, true); assert.equal(item.payloadHash, pack.payloadHash);
        assert.equal(item.file, `${fixture.id}-${width}.png`, 'Unexpected image filename');
        assert.equal(item.nativeFile, `${fixture.id}-${width}-native.json`, 'Unexpected native filename');
        assert.equal(item.visualCandidate, 'growing-island-v1');
        assert.equal(item.growingFeatureEnabled, true, 'Growing flag missing');
        assert.equal(item.objects, fixture.island.state.plots.length + fixture.island.state.landmarks.length);
        assert.equal(item.population, fixture.island.state.villagers.length);
        const url = new URL(metadata.url);
        assert.equal(url.href, `${target.origin}/#/island`, 'Wrong capture route/target');
        assert.deepEqual(metadata.viewport, { width, height });
        assert.equal(metadata.reducedMotion, width === 768); assert.equal(metadata.mode, 'home');
        assert.equal(typeof metadata.serviceWorkerControlled, 'boolean');
        for (const identity of [metadata, root]) {
            assert.equal(identity?.version, version.version, 'Mixed capture version');
            assert.equal(identity.revision, version.revision, 'Mixed capture revision');
            assert.equal(identity.islandFeatureEnabled, true, 'Island flag missing');
        }
        assert.equal(root.configuredDelivery, version.delivery); assert.equal(root.natureTownFeatureEnabled, false);
        assert.equal(root.visualLineage, version.visualLineage);
        assert.equal(metadata.delivery, version.island.delivery); assert.equal(metadata.candidate, version.island.candidate);
        assert.equal(metadata.learningCandidate, version.island.learningCandidate);
        const imageFile = path.join(directory, item.file), nativeFile = path.join(directory, item.nativeFile);
        const image = await readRegular(imageFile), nativeBytes = await readRegular(nativeFile);
        assert.equal(hash(image), item.imageHash, 'Capture image hash mismatch');
        assert.equal(hash(nativeBytes), item.nativeHash, 'Capture native hash mismatch');
        assert(image.length > 24 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            && image.toString('ascii', 12, 16) === 'IHDR', 'Expected PNG capture');
        assert.equal(image.readUInt32BE(16), width, 'PNG width mismatch');
        assert.equal(image.readUInt32BE(20), height, 'PNG height mismatch');
        const native = JSON.parse(nativeBytes);
        for (const record of [native.before, native.after]) {
            assert.equal(record?.profileId, fixture.profile.id, 'Mixed native owner'); assert.equal(record.version, fixture.island.version);
            assert.equal(stableJSON(ownedState(record.state)), stableJSON(ownedState(fixture.island.state)), 'Native fixture ownership changed');
        }
        for (const table of ['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) {
            assert(Array.isArray(native.learning?.[table]), 'Learning evidence missing');
            assert(native.learning[table].every(row => row.profileId === fixture.profile.id), 'Mixed learning owner');
        }
        for (const table of ['islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) {
            assert.equal(native.learning[table].length, 0, 'Fixture contains learning/game history');
        }
        fingerprints[imageFile] = hash(image); fingerprints[nativeFile] = hash(nativeBytes);
        cases.push({ ...item, image, native, imageFile, nativePath: nativeFile });
    }
    return { file: reportFile, directory, report, cases, fingerprints };
}
