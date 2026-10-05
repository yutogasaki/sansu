import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildArchiveFiles, copyCandidate, digestFiles, executeSteps, growingEnvironment, previewURL } from './verify-growing.mjs';
import { hash, loadDomain, validatePack } from './growing-fixture-data.mjs';
import { readCapture, readRegular } from './growing-fixture-evidence.mjs';
import { localRuntime, newOutput } from './local-qa-runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gaps = ['実取得/学習/既存利用者の保存', '実機/FPS・音/写真', 'PWA更新・offline復旧・公開', '美術の魅力・子どもの理解/安全・翌日再訪', '一時通知・保存待機・動作位相のpixel一致'];

export function parseOptions(args) {
    const values = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        assert(['--fixtures', '--before', '--output-dir'].includes(key) && args[i + 1] && !args[i + 1].startsWith('--') && !values[key], 'Use --fixtures FILE --before REPORT --output-dir NEW_DIRECTORY once each');
        values[key] = path.resolve(args[i + 1]);
    }
    assert(!values['--before'] || values['--fixtures'], '--before requires the same --fixtures pack');
    return { fixtures: values['--fixtures'], before: values['--before'], output: values['--output-dir'] || path.join(root, 'output/growing-snapshots', randomUUID()) };
}

async function walk(directory, prefix = '') {
    const files = [];
    for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
        const file = path.join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...await walk(directory, file));
        else { assert(entry.isFile(), 'Candidate build must contain regular files'); files.push(file); }
    }
    return files.sort();
}

export async function main(args = process.argv.slice(2)) {
    if (args.length === 1 && args[0] === '--help') {
        console.log('npm run snapshot:growing [-- --fixtures FILE --before REPORT --output-dir NEW_DIRECTORY]\nIsolated build and synthetic screenshots; no core/release approval.'); return;
    }
    const options = parseOptions(args);
    const output = await newOutput(options.output, root, [options.fixtures, options.before].filter(Boolean).map(file => path.dirname(file)));
    const report = { schema: 'sansu-growing-snapshot-v1', startedAt: new Date().toISOString(), checks: 'FAIL', release: 'NOT_EVALUATED',
        gaps, steps: [], gates: { fixtureRuntime: 'NOT_EVALUATED', comparisonIntegrity: 'NOT_EVALUATED', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED' } };
    let candidate;
    const runtime = localRuntime(() => candidate || root, output);
    try {
        await fs.access(path.join(root, 'node_modules'));
        const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        const names = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))]
            .filter(file => !/^\.env(?:\.|$)/.test(file));
        const files = [];
        for (const file of names) { try { await fs.lstat(path.join(root, file)); files.push(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        const inputs = await digestFiles(root, files), sourceHash = hash(JSON.stringify(inputs));
        report.candidate = { head: git(['rev-parse', 'HEAD']).trim(), sourceHash, status: git(['status', '--porcelain=v1']), node: process.version };
        report.candidate.revision = `${report.candidate.head}-snapshot-${sourceHash.slice(0, 12)}`;
        const env = growingEnvironment(process.env, report.candidate.revision);
        report.flags = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_')));
        candidate = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-snapshot-growing-'));
        report.candidate.directory = candidate;
        await copyCandidate(root, candidate, files, inputs);
        await fs.symlink(path.join(root, 'node_modules'), path.join(candidate, 'node_modules'), 'junction');
        await fs.writeFile(path.join(output, 'inputs.json'), JSON.stringify(inputs, null, 2));
        await fs.writeFile(path.join(output, 'archive-files.txt'), buildArchiveFiles(files).join('\n') + '\n');
        const packDir = path.join(output, 'fixtures'), packFile = path.join(packDir, 'fixtures.json');
        let pack, original = {};
        if (options.fixtures) {
            const bytes = await readRegular(options.fixtures); pack = validatePack(JSON.parse(bytes), await loadDomain(candidate));
            original[options.fixtures] = hash(bytes); await fs.mkdir(packDir); await fs.writeFile(packFile, bytes, { flag: 'wx' });
        } else {
            await runtime.run(process.execPath, ['tools/growing-fixture-data.mjs', '--output-dir', packDir], 'fixtures.log', env);
            pack = validatePack(JSON.parse(await readRegular(packFile)), await loadDomain(candidate));
        }
        if (options.before) original = { ...original, ...(await readCapture(options.before, pack)).fingerprints };
        report.originalInputs = original; report.payloadHash = pack.payloadHash; report.fixtureSourceHash = pack.sourceHash;
        const fixedPackHash = hash(await readRegular(packFile));
        const steps = report.steps = [{ id: 'archive' }, { id: 'build' }, { id: 'capture' }, ...(options.before ? [{ id: 'compare' }] : [])].map(step => ({ ...step, status: 'NOT_RUN' }));
        let built;
        await executeSteps(steps, async step => {
            runtime.assertActive(); console.log(`[snapshot:growing] ${step.id}… (${output})`);
            if (step.id === 'archive') await runtime.run('tar', ['-czf', path.join(output, 'build-inputs.tar.gz'), '-T', path.join(output, 'archive-files.txt')], 'archive.log', env);
            if (step.id === 'build') {
                await runtime.run(npm, ['run', 'build'], 'build.log', env);
                report.version = JSON.parse(await readRegular(path.join(candidate, 'dist/version.json')));
                assert.equal(report.version.revision, report.candidate.revision); assert.equal(report.version.island.enabled, true);
                built = await digestFiles(path.join(candidate, 'dist'), await walk(path.join(candidate, 'dist')));
                await fs.writeFile(path.join(output, 'dist-inputs.json'), JSON.stringify(built, null, 2));
            }
            if (step.id === 'capture') {
                const preview = runtime.start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], 'preview.log', env);
                report.target = await previewURL(async () => {
                    runtime.assertActive(); if (preview.exitCode !== null || preview.signalCode !== null) await preview.done;
                    return fs.readFile(path.join(output, 'preview.log'), 'utf8');
                });
                const served = await fetch(`${report.target}/version.json`, { signal: AbortSignal.timeout(5000) }).then(response => response.json());
                assert.deepEqual(served, report.version, 'Preview serves a different build');
                await runtime.run(npm, ['run', 'e2e:growing-fixtures', '--', '--url', report.target, '--build-dir', path.join(candidate, 'dist'), '--fixtures', packFile, '--output-dir', path.join(output, 'captures')], 'capture.log', env);
                const capture = await readCapture(path.join(output, 'captures/report.json'), pack);
                assert.deepEqual(capture.report.version, report.version); report.gates.fixtureRuntime = 'PASS';
            }
            if (step.id === 'compare') {
                await runtime.run(npm, ['run', 'compare:growing-fixtures', '--', '--before', options.before, '--after', path.join(output, 'captures/report.json'), '--fixtures', packFile, '--output-dir', path.join(output, 'comparison')], 'compare.log', env);
                const comparison = JSON.parse(await readRegular(path.join(output, 'comparison/report.json')));
                assert.equal(comparison.pass, true); assert.equal(comparison.gates.comparisonIntegrity, 'PASS'); report.gates.comparisonIntegrity = 'PASS';
            }
            if (built) assert.deepEqual(await digestFiles(path.join(candidate, 'dist'), await walk(path.join(candidate, 'dist'))), built, 'Build changed during snapshot');
            assert.deepEqual(await digestFiles(candidate, files), inputs, 'Candidate inputs changed');
            for (const [file, fingerprint] of Object.entries(original)) assert.equal(hash(await readRegular(file)), fingerprint, 'Original comparison input changed');
            assert.equal(hash(await readRegular(packFile)), fixedPackHash, 'Fixed pack changed'); runtime.assertActive();
        });
        report.checks = 'PASS';
    } catch (error) {
        report.error = String(error.stack || error); process.exitCode = 1;
        if (report.steps.find(step => step.id === 'capture')?.status === 'FAIL') report.gates.fixtureRuntime = 'FAIL';
        if (report.steps.find(step => step.id === 'compare')?.status === 'FAIL') report.gates.comparisonIntegrity = 'FAIL';
    }
    finally {
        report.cleanup = runtime ? await runtime.cleanup() : { errors: [] };
        if (candidate) {
            try { await fs.rm(candidate, { recursive: true, force: true }); report.cleanup.candidateRemoved = true; }
            catch (error) { report.cleanup.errors.push(String(error)); report.cleanup.candidateRemoved = false; }
        }
        if (report.cleanup.errors.length || report.cleanup.interrupted) { report.checks = 'FAIL'; process.exitCode = 1; }
        report.finishedAt = new Date().toISOString();
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        await fs.writeFile(path.join(output, 'summary.md'), `# Growing snapshot\n\nChecks: ${report.checks}\nRelease: NOT_EVALUATED\n\n${report.steps.map(step => `- ${step.id}: ${step.status}`).join('\n')}\n\n${report.error || ''}\n\n## Not evaluated\n${gaps.map(gap => `- ${gap}`).join('\n')}\n`);
        console.log(`[snapshot:growing] checks=${report.checks}; ${path.join(output, 'report.json')}`);
    }
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
