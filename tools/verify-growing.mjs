#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream, constants, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function growingEnvironment(source, revision) {
    return {
        ...Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'NODE_ENV' && !/^(VITE_|SANSU_)/.test(key))),
        SANSU_BUILD_REVISION: revision,
        VITE_ISLAND_ENABLED: 'true', VITE_ISLAND_LIFE_ENABLED: 'true',
        VITE_GROWING_ISLAND_ENABLED: 'true', VITE_ISLAND_FANTASY_ENABLED: 'true',
        VITE_ISLAND_LIFE_PREVIEW: 'false', VITE_NATURE_TOWN_ENABLED: 'false',
        VITE_HOME_JOURNEY_PREVIEW: 'false', VITE_ISLAND_LIFE_DISCOVERY_ENABLED: 'false',
        VITE_BUILD_PLAY_ENABLED: 'false', VITE_EXPLORE_EXPERIENCE: 'snap-root-v1',
    };
}

export async function digestFiles(directory, files) {
    const result = {};
    for (const file of [...new Set(files)].sort()) {
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(path.join(directory, file))) hash.update(chunk);
        result[file] = hash.digest('hex');
    }
    return result;
}

export function buildArchiveFiles(files) {
    return files.filter(file => !file.includes('/') || /^(src|public|tools)\//.test(file)
        || /^assets\/.*\.json$/.test(file) || file.startsWith('prototypes/place-qa/') || file === 'docs/product/island-place-goals.json');
}

export async function copyCandidate(source, target, files, expected) {
    for (const file of files) {
        const from = path.join(source, file), to = path.join(target, file);
        const stat = await fs.lstat(from);
        assert(stat.isFile(), `Candidate input must be a regular file: ${file}`);
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.copyFile(from, to, constants.COPYFILE_FICLONE);
    }
    assert.deepEqual(await digestFiles(target, files), expected, 'Source changed while candidate was copied');
    assert.deepEqual(await digestFiles(source, files), expected, 'Working inputs changed while candidate was copied');
}

export async function executeSteps(steps, run) {
    for (const step of steps) {
        step.status = 'RUNNING'; step.startedAt = new Date().toISOString();
        const start = Date.now();
        try { await run(step); step.status = 'PASS'; }
        catch (error) { step.status = 'FAIL'; step.error = String(error.stack || error); throw error; }
        finally { step.durationMs = Date.now() - start; }
    }
}

export async function previewURL(readLog, timeoutMs = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        let log = '';
        try { log = await readLog(); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const base = log.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
        if (base) return base;
        await delay(100);
    }
    throw new Error('Preview did not start in time');
}

export function assertJourney(report, version) {
    assert.equal(report.pass, true, 'Journey did not report PASS');
    assert.deepEqual(report.version, version, 'Journey used a different build');
    assert.deepEqual(report.scenarios.map(s => s.viewport.width).sort(), [390, 768]);
    assert(report.scenarios.every(s => s.pass === true), 'A viewport scenario failed');
    const worlds = report.captures.filter(c => c.world);
    assert(worlds.length > 0, 'Missing rendered Growing identity');
    for (const width of [390, 768]) assert(worlds.some(c => c.file.startsWith(`${width}-`)), `Missing rendered Growing identity for ${width}`);
    for (const capture of worlds) {
        assert.equal(capture.appRoot.revision, version.revision);
        assert.equal(capture.appRoot.version, version.version);
        assert.equal(capture.appRoot.islandFeatureEnabled, true);
        assert.equal(capture.appRoot.natureTownFeatureEnabled, false);
        assert.equal(capture.world.growingFeatureEnabled, 'true');
        assert.equal(capture.world.visualCandidate, 'growing-island-v1');
    }
}

async function walk(directory, prefix = '') {
    const files = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const relative = path.posix.join(prefix, entry.name);
        if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
        else files.push(relative);
    }
    return files.sort();
}

const gaps = [
    'Growing実two-build更新・更新中断復旧・旧writer/rollback',
    '既存利用者の実保存引き継ぎ・本人切替の故障診断',
    '実iOS/Android・音/写真・人口と物が増えた島の性能',
    '採用美術とのcritical-path比較・子どもの無説明理解/安全・翌日の再訪',
];

export async function main(args = process.argv.slice(2)) {
    if (args[0] === '--help' && args.length === 1) {
        console.log('npm run verify:growing [-- --output-dir NEW_DIRECTORY]\nRuns an isolated Growing candidate; automated PASS is not release approval.');
        return;
    }
    assert(args.length === 0 || (args.length === 2 && args[0] === '--output-dir'), 'Use --output-dir NEW_DIRECTORY or --help');
    const output = path.resolve(args[1] || path.join(root, 'output', 'verify-growing', `${Date.now()}-${randomUUID().slice(0, 8)}`));
    // Output must be ignored or outside the repo, so it cannot become a candidate input.
    if (output === root.slice(0, -1) || output.startsWith(root)) {
        assert(output.startsWith(path.join(root, 'output') + path.sep), 'Repository output must be inside output/');
    }
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(output); // EEXIST deliberately refuses overwriting evidence.
    const children = new Set();
    let interrupted;
    const stop = async child => {
        if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
        const kill = signal => {
            try {
                if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
                else process.kill(-child.pid, signal);
            } catch (error) { if (error.code !== 'ESRCH') throw error; }
        };
        kill('SIGTERM');
        for (let i = 0; i < 40 && child.exitCode === null && child.signalCode === null; i++) await delay(50);
        if (child.exitCode === null && child.signalCode === null) kill('SIGKILL');
    };
    const onSignal = signal => {
        interrupted = signal;
        for (const child of children) void stop(child);
    };
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    const report = {
        schema: 'sansu-growing-verification-v1', startedAt: new Date().toISOString(),
        output, checks: 'FAIL', release: 'PARTIAL', gaps, steps: [],
        gates: { runtime: 'NOT_RUN', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED' },
    };
    let candidate;
    const startChild = (command, commandArgs, log, env) => {
        assert(!interrupted, `Interrupted by ${interrupted}`);
        const stream = createWriteStream(path.join(output, log), { flags: 'wx' });
        const child = spawn(command, commandArgs, { cwd: candidate, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
        children.add(child);
        child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
        child.done = new Promise((resolve, reject) => {
            child.once('error', error => { stream.end(); reject(error); });
            child.once('close', (code, signal) => {
                stream.end(); children.delete(child);
                if (code === 0) resolve();
                else reject(new Error(`${command} ${commandArgs.join(' ')} failed (${signal || code}); see ${log}`));
            });
        });
        // A preview can fail before the readiness loop awaits its completion.
        child.done.catch(() => {});
        return child;
    };
    const run = async (command, commandArgs, log, env) => {
        const child = startChild(command, commandArgs, log, env);
        const timer = setTimeout(() => { void stop(child); }, 15 * 60_000);
        try { await child.done; } finally { clearTimeout(timer); }
    };
    try {
        await fs.access(path.join(root, 'node_modules'));
        const git = commandArgs => execFileSync('git', commandArgs, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        const files = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))]
            .filter(file => !/^\.env(?:\.|$)/.test(file));
        const existing = [];
        for (const file of files) {
            try { await fs.lstat(path.join(root, file)); existing.push(file); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        const inputs = await digestFiles(root, existing);
        const sourceHash = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
        report.candidate = { head: git(['rev-parse', 'HEAD']).trim(), sourceHash,
            status: git(['status', '--porcelain=v1']), node: process.version, lockHash: inputs['package-lock.json'] };
        report.candidate.revision = `${report.candidate.head}-candidate-${sourceHash.slice(0, 12)}`;
        const env = growingEnvironment(process.env, report.candidate.revision);
        report.flags = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_')));
        candidate = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-verify-growing-'));
        await copyCandidate(root, candidate, existing, inputs);
        await fs.symlink(path.join(root, 'node_modules'), path.join(candidate, 'node_modules'), 'junction');
        await fs.writeFile(path.join(output, 'inputs.json'), JSON.stringify(inputs, null, 2));
        // Keep imported authoring manifests for typecheck, and shipped public
        // assets, without archiving hundreds of MB of unshipped source meshes.
        const buildInputs = buildArchiveFiles(existing);
        await fs.writeFile(path.join(output, 'archive-files.txt'), buildInputs.join('\n') + '\n');
        await run('tar', ['-czf', path.join(output, 'build-inputs.tar.gz'), '-T', path.join(output, 'archive-files.txt')], 'archive.log', env);
        const steps = report.steps = [
            { id: 'core', status: 'NOT_RUN', command: ['run', 'verify:core'] },
            { id: 'classic-smoke', status: 'NOT_RUN', command: ['run', 'e2e:smoke'] },
            { id: 'growing-guidance-production', status: 'NOT_RUN', script: 'tools/e2e-growing-guidance-production.mjs' },
            { id: 'growing-balance-production', status: 'NOT_RUN', script: 'tools/e2e-growing-balance-production.mjs' },
        ];
        let initialDist;
        await executeSteps(steps, async step => {
            console.log(`[verify:growing] ${step.id}… (${output})`);
            if (step.command) {
                await run(npm, step.command, `${step.id}.log`, step.id === 'classic-smoke' ? {
                    ...env, SANSU_E2E_DIAGNOSTIC_DIR: path.join(output, 'classic-smoke-diagnostics'),
                    SANSU_E2E_CAPTURE_DIR: path.join(output, 'classic-smoke-screens'),
                } : env);
                if (step.id === 'core') {
                    report.version = JSON.parse(await fs.readFile(path.join(candidate, 'dist/version.json'), 'utf8'));
                    assert.equal(report.version.revision, report.candidate.revision);
                    assert.equal(report.version.island.enabled, true);
                    initialDist = await digestFiles(path.join(candidate, 'dist'), await walk(path.join(candidate, 'dist')));
                    await fs.writeFile(path.join(output, 'dist-inputs.json'), JSON.stringify(initialDist, null, 2));
                }
            } else {
                if (!report.target) {
                    const preview = startChild(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '0'], 'preview.log', env);
                    const base = await previewURL(async () => {
                        if (preview.exitCode !== null || preview.signalCode !== null) await preview.done;
                        return fs.readFile(path.join(output, 'preview.log'), 'utf8');
                    });
                    const served = await fetch(`${base}/version.json`, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
                    assert.deepEqual(served, report.version, 'Preview serves a stale candidate');
                    report.target = base;
                }
                await run(process.execPath, [step.script], `${step.id}.log`, {
                    ...env, SANSU_GUIDANCE_PRODUCTION_URL: report.target,
                    SANSU_GUIDANCE_PRODUCTION_OUTPUT: path.join(output, step.id),
                    SANSU_GROWING_PRODUCTION_URL: report.target,
                    SANSU_GROWING_PRODUCTION_OUTPUT: path.join(output, step.id),
                });
                assertJourney(JSON.parse(await fs.readFile(path.join(output, step.id, 'report.json'), 'utf8')), report.version);
                assert.deepEqual(await digestFiles(path.join(candidate, 'dist'), await walk(path.join(candidate, 'dist'))), initialDist, 'Built artifact changed during verification');
            }
            assert.deepEqual(await digestFiles(candidate, existing), inputs, 'Isolated candidate inputs changed during verification');
        });
        report.checks = 'PASS'; report.gates.runtime = 'PASS';
    } catch (error) {
        report.error = String(error.stack || error); report.gates.runtime = 'FAIL'; process.exitCode = 1;
    } finally {
        const cleanup = await Promise.allSettled([...children].map(stop));
        report.cleanupErrors = cleanup.filter(r => r.status === 'rejected').map(r => String(r.reason));
        if (candidate) await fs.rm(candidate, { recursive: true, force: true }).catch(error => report.cleanupErrors.push(String(error)));
        if (report.cleanupErrors.length) { report.checks = 'FAIL'; process.exitCode = 1; }
        process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
        if (interrupted) { report.interrupted = interrupted; report.checks = 'FAIL'; process.exitCode = 1; }
        report.finishedAt = new Date().toISOString();
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        await fs.writeFile(path.join(output, 'summary.md'), `# Growing verification\n\nChecks: ${report.checks}\nRelease: PARTIAL\n\n${report.steps.map(s => `- ${s.id}: ${s.status}`).join('\n')}\n\n${report.error || ''}\n\n## Not verified\n\n${gaps.map(g => `- ${g}`).join('\n')}\n`);
        console.log(`[verify:growing] checks=${report.checks}, release=PARTIAL; ${path.join(output, 'report.json')}`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
