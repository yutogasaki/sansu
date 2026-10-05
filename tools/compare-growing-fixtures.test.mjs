import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { deflateSync } from 'node:zlib';
import { hash, makePack } from './growing-fixture-data.mjs';
import { CAPTURE_SCHEMA, captureConditions, readCapture } from './growing-fixture-evidence.mjs';
import { main, parseOptions } from './compare-growing-fixtures.mjs';

let pack, directory, reports, args;
beforeAll(async () => { pack = await makePack(); });
// Valid plain PNGs for file-integrity tests, explicitly unrelated to app screenshots.
function png(width, height) {
    const chunk = (type, data) => {
        const bytes = Buffer.concat([Buffer.from(type), data]), result = Buffer.alloc(data.length + 12);
        result.writeUInt32BE(data.length); bytes.copy(result, 4);
        let crc = 0xffffffff;
        for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
        result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
    };
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-compare-fixtures-'));
    await fs.mkdir(path.join(directory, 'pack'));
    await fs.writeFile(path.join(directory, 'pack/fixtures.json'), JSON.stringify(pack)); reports = {};
    for (const side of ['before', 'after']) {
        const folder = path.join(directory, side); await fs.mkdir(folder);
        const version = { version: `${side}:test`, revision: side, delivery: 'snap-root-v1', visualLineage: 'test',
            island: { enabled: true, delivery: 'mystic-island-v1', candidate: `candidate-${side}`, learningCandidate: 'learning',
                life: { enabled: true, discovery: false, fantasy: true, saveVersion: 21 } } };
        const report = { schema: CAPTURE_SCHEMA, conditions: captureConditions(pack), target: 'http://127.0.0.1:5298', version,
            payloadHash: pack.payloadHash, sourceHash: pack.sourceHash, pass: true, gates: { fixtureRuntime: 'PASS' },
            initialBuild: { 'version.json': hash(JSON.stringify(version)) }, initialQA: { 'test-harness': hash('qa') }, cases: [] };
        for (const fixture of pack.cases) for (const width of [390, 768]) {
            const height = width === 390 ? 844 : 1024, file = `${fixture.id}-${width}.png`, nativeFile = `${fixture.id}-${width}-native.json`;
            const image = png(width, height), native = { before: fixture.island, after: fixture.island,
                learning: Object.fromEntries(['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns'].map(table => [table, []])) };
            const nativeBytes = JSON.stringify(native); await fs.writeFile(path.join(folder, file), image); await fs.writeFile(path.join(folder, nativeFile), nativeBytes);
            report.cases.push({ id: fixture.id, width, file, nativeFile, imageHash: hash(image), nativeHash: hash(nativeBytes),
                visualCandidate: 'growing-island-v1', growingFeatureEnabled: true, payloadHash: pack.payloadHash, pass: true,
                objects: fixture.island.state.plots.length + fixture.island.state.landmarks.length, population: fixture.island.state.villagers.length,
                metadata: { url: `${report.target}/#/island`, version: version.version, revision: version.revision, delivery: version.island.delivery,
                    candidate: version.island.candidate, learningCandidate: version.island.learningCandidate, islandFeatureEnabled: true, mode: 'home',
                    viewport: { width, height }, reducedMotion: width === 768, serviceWorkerControlled: true,
                    appRoot: { version: version.version, revision: version.revision, islandFeatureEnabled: true, natureTownFeatureEnabled: false,
                        configuredDelivery: version.delivery, visualLineage: version.visualLineage } } });
        }
        reports[side] = report; await fs.writeFile(path.join(folder, 'report.json'), JSON.stringify(report));
    }
    args = ['--before', path.join(directory, 'before/report.json'), '--after', path.join(directory, 'after/report.json'),
        '--fixtures', path.join(directory, 'pack/fixtures.json'), '--output-dir', path.join(directory, 'comparison')];
});
afterEach(async () => { vi.restoreAllMocks(); if (directory) await fs.rm(directory, { recursive: true, force: true }); });
const saveReport = async (side = 'after') => fs.writeFile(path.join(directory, side, 'report.json'), JSON.stringify(reports[side]));
const readAfter = () => readCapture(path.join(directory, 'after/report.json'), pack);

describe('Growing fixture comparison integrity', () => {
    it('pairs all six conditions, preserves both candidates and copies evidence without changing inputs', async () => {
        const source = await fs.readFile(args[1]); const result = await main(args);
        expect(result.pairs.map(item => [item.id, item.width])).toEqual(pack.cases.flatMap(item => [[item.id, 390], [item.id, 768]]));
        expect(result.before.version.island.candidate).toBe('candidate-before'); expect(result.after.version.island.candidate).toBe('candidate-after');
        expect(result.gates).toEqual({ comparisonIntegrity: 'PASS', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED' });
        expect(await fs.readFile(args[1])).toEqual(source);
        expect((await fs.readdir(args[7])).filter(file => file.endsWith('.png'))).toHaveLength(12);
        for (const pair of result.pairs) for (const side of ['before', 'after']) {
            expect(hash(await fs.readFile(path.join(args[7], pair[side].file)))).toBe(pair[side].imageHash);
        }
    });
    it.each([
        ['legacy report', report => { delete report.schema; }],
        ['failed capture', report => { report.pass = false; }],
        ['changed pack', report => { report.payloadHash = hash('other'); }],
        ['changed source', report => { report.sourceHash = hash('other'); }],
        ['missing case', report => { report.cases.pop(); }],
        ['duplicate case', report => { report.cases[1] = report.cases[0]; }],
        ['mixed version', report => { report.cases[0].metadata.version = 'other'; }],
        ['wrong route', report => { report.cases[0].metadata.url += '/settings'; }],
        ['missing flag', report => { delete report.cases[0].growingFeatureEnabled; }],
        ['wrong motion', report => { report.cases[0].metadata.reducedMotion = true; }],
        ['wrong timezone', report => { report.conditions.timezone = 'UTC'; }],
        ['wrong viewport', report => { report.cases[0].metadata.viewport.height--; }],
        ['path escape', report => { report.cases[0].file = '../outside.png'; }],
        ['missing provenance', report => { delete report.initialQA; }],
    ])('rejects %s', async (_, mutate) => { mutate(reports.after); await saveReport(); await expect(readAfter()).rejects.toThrow(); });
    it('rejects replaced or missing evidence and symlink escapes', async () => {
        const file = path.join(directory, 'after', reports.after.cases[0].file), bytes = await fs.readFile(file);
        await fs.appendFile(file, 'changed'); await expect(readAfter()).rejects.toThrow('image hash');
        await fs.unlink(file); await expect(readAfter()).rejects.toThrow('ENOENT');
        const outside = path.join(directory, 'outside.png'); await fs.writeFile(outside, bytes); await fs.symlink(outside, file);
        await expect(readAfter()).rejects.toThrow('regular file');
    });
    it.each(['owner', 'owned', 'learning'])('rejects changed native %s even with renewed file hash', async kind => {
        const item = reports.after.cases[0], file = path.join(directory, 'after', item.nativeFile), native = JSON.parse(await fs.readFile(file));
        if (kind === 'owner') native.after.profileId = 'other-child';
        if (kind === 'owned') native.after.state.drops++;
        if (kind === 'learning') native.learning.logs.push({ profileId: native.after.profileId });
        const bytes = JSON.stringify(native); await fs.writeFile(file, bytes); item.nativeHash = hash(bytes); await saveReport();
        await expect(readAfter()).rejects.toThrow();
    });
    it('rejects changed native bytes and mismatched PNG dimensions', async () => {
        const item = reports.after.cases[0], native = path.join(directory, 'after', item.nativeFile);
        await fs.appendFile(native, ' '); await expect(readAfter()).rejects.toThrow('native hash');
        item.nativeHash = hash(await fs.readFile(native)); const image = png(1, 1);
        await fs.writeFile(path.join(directory, 'after', item.file), image); item.imageHash = hash(image); await saveReport();
        await expect(readAfter()).rejects.toThrow('width mismatch');
    });
    it('rejects feature and service worker differences between individually valid captures', async () => {
        reports.after.version.island.life.fantasy = false; await saveReport(); await expect(main(args)).rejects.toThrow('feature conditions');
        reports.after.version.island.life.fantasy = true; reports.after.cases[0].metadata.serviceWorkerControlled = false;
        await saveReport(); await expect(main(args)).rejects.toThrow('service worker');
    });
    it('refuses overwrite, source-directory output and symlink aliases', async () => {
        await main(args); const outputReport = await fs.readFile(path.join(args[7], 'report.json'));
        await expect(main(args)).rejects.toThrow('EEXIST'); expect(await fs.readFile(path.join(args[7], 'report.json'))).toEqual(outputReport);
        await expect(main([...args.slice(0, 7), path.join(directory, 'before/nested')])).rejects.toThrow('outside input');
        await expect(main([...args.slice(0, 7), path.join(directory, 'before/new/nested')])).rejects.toThrow('outside input');
        await expect(fs.stat(path.join(directory, 'before/new'))).rejects.toThrow('ENOENT');
        const alias = path.join(directory, 'alias'); await fs.symlink(path.join(directory, 'before'), alias);
        await expect(main([...args.slice(0, 7), path.join(alias, 'nested')])).rejects.toThrow('outside input');
    });
    it('fails if input changes during copying and retains a failed report', async () => {
        const write = fs.writeFile.bind(fs), source = path.join(directory, 'after', reports.after.cases[0].file);
        let changed = false;
        vi.spyOn(fs, 'writeFile').mockImplementation(async (file, ...rest) => {
            const result = await write(file, ...rest);
            if (!changed && String(file).includes('comparison/before-starter-390.png')) { changed = true; await fs.appendFile(source, 'changed'); }
            return result;
        });
        await expect(main(args)).rejects.toThrow('input changed');
        const result = JSON.parse(await fs.readFile(path.join(args[7], 'report.json')));
        expect(result.pass).toBe(false); expect(result.gates.comparisonIntegrity).toBe('FAIL');
        await expect(fs.stat(path.join(args[7], 'comparison.html'))).rejects.toThrow('ENOENT');
    });
    it('escapes input identity in the standalone HTML', async () => {
        const value = '<script>alert("test")</script>'; reports.after.version.revision = value;
        for (const item of reports.after.cases) { item.metadata.revision = value; item.metadata.appRoot.revision = value; }
        await saveReport(); await main(args); const html = await fs.readFile(path.join(args[7], 'comparison.html'), 'utf8');
        expect(html).not.toContain(value); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Content-Security-Policy');
    });
    it('rejects incomplete, unknown and duplicate CLI options', () => {
        expect(parseOptions(args).before).toBe(args[1]);
        for (const invalid of [args.slice(0, -1), [...args, '--overwrite', 'true'], [...args, '--after', args[3]], ['--before', '--after']]) {
            expect(() => parseOptions(invalid)).toThrow();
        }
    });
});
