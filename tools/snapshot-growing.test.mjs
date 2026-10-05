import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { localRuntime, newOutput } from './local-qa-runtime.mjs';
import { main, parseOptions } from './snapshot-growing.mjs';

let directory, runtime;
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-snapshot-test-')); });
afterEach(async () => { if (runtime) { await runtime.cleanup(); runtime = undefined; } vi.restoreAllMocks(); process.exitCode = undefined; await fs.rm(directory, { recursive: true, force: true }); });
const node = code => [process.execPath, ['-e', code]];
const waitFile = async file => {
    for (let count = 0; count < 100; count++) { try { return await fs.readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; await new Promise(resolve => setTimeout(resolve, 20)); } }
    throw Error('Child never became ready');
};

describe('one-command Growing snapshot boundaries', () => {
    it('uses an optional explicit pack, requires it for a baseline, and rejects malformed arguments', () => {
        expect(parseOptions([]).output).toContain('output/growing-snapshots/');
        expect(parseOptions(['--fixtures', 'pack.json', '--before', 'before/report.json']).fixtures).toBe(path.resolve('pack.json'));
        for (const args of [['--before', 'report.json'], ['--output-dir'], ['--fixtures', '--before'], ['--unknown', 'yes'], ['--fixtures', 'a', '--fixtures', 'b']]) {
            expect(() => parseOptions(args)).toThrow();
        }
    });
    it('prints a diagnostic help message without running or creating evidence', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {}); await main(['--help']);
        expect(log).toHaveBeenCalledWith(expect.stringContaining('no core/release approval'));
    });
    it('refuses existing output without altering it', async () => {
        await fs.writeFile(path.join(directory, 'report.json'), 'original');
        await expect(main(['--output-dir', directory])).rejects.toThrow('EEXIST');
        expect(await fs.readFile(path.join(directory, 'report.json'), 'utf8')).toBe('original');
    });
    it('permits only ignored output/ paths inside a git repository, including path aliases', async () => {
        execFileSync('git', ['init', '-q', directory]); await fs.writeFile(path.join(directory, '.gitignore'), 'output/\n');
        await expect(newOutput(path.join(directory, 'tracked/new'), directory)).rejects.toThrow('inside output/');
        await expect(fs.stat(path.join(directory, 'tracked'))).rejects.toThrow('ENOENT');
        const result = await newOutput(path.join(directory, 'output/new'), directory); expect(await fs.stat(result)).toBeDefined();
        const alias = path.join(directory, 'alias'); await fs.symlink(directory, alias);
        await expect(newOutput(path.join(alias, 'tracked/new'), directory)).rejects.toThrow('inside output/');
    });
    it('refuses outputs inside baseline/pack directories before creating parents', async () => {
        const source = path.join(directory, 'source'); await fs.mkdir(source);
        await expect(newOutput(path.join(source, 'new/nested'), process.cwd(), [source])).rejects.toThrow('outside input');
        await expect(fs.stat(path.join(source, 'new'))).rejects.toThrow('ENOENT');
    });
});

describe('local QA process lifecycle', () => {
    it('flushes stdout/stderr and propagates a real child failure', async () => {
        runtime = localRuntime(directory, directory);
        await runtime.run(...node('console.log("ready"); console.error("detail")'), 'pass.log', process.env);
        expect(await fs.readFile(path.join(directory, 'pass.log'), 'utf8')).toBe('ready\ndetail\n');
        await expect(runtime.run(...node('console.error("build failed");process.exit(7)'), 'fail.log', process.env)).rejects.toThrow('7');
        expect(await fs.readFile(path.join(directory, 'fail.log'), 'utf8')).toContain('build failed');
        expect((await runtime.cleanup()).errors).toEqual([]);
    });
    it('propagates spawn and log-open errors without leaving a running child', async () => {
        runtime = localRuntime(directory, directory);
        await expect(runtime.run('/nonexistent/sansu-qa-node', [], 'missing.log', process.env)).rejects.toThrow('ENOENT');
        await fs.writeFile(path.join(directory, 'existing.log'), 'original');
        await expect(runtime.run(...node('setInterval(()=>{},1000)'), 'existing.log', process.env)).rejects.toThrow('EEXIST');
        expect(await fs.readFile(path.join(directory, 'existing.log'), 'utf8')).toBe('original');
    });
    it('stops a hung child on deadline and records a timeout', async () => {
        runtime = localRuntime(directory, directory);
        await expect(runtime.run(...node('setInterval(()=>{},1000)'), 'timeout.log', process.env, 150)).rejects.toThrow('Timed out');
        expect((await runtime.cleanup()).errors).toEqual([]);
    });
    it('escalates cleanup for a child that ignores SIGTERM', async () => {
        runtime = localRuntime(directory, directory); const ready = path.join(directory, 'ready');
        const child = runtime.start(...node(`process.on('SIGTERM',()=>{});require('fs').writeFileSync(${JSON.stringify(ready)},'ready');setInterval(()=>{},1000)`), 'stubborn.log', process.env);
        await waitFile(ready); expect((await runtime.cleanup()).errors).toEqual([]); expect(child.signalCode).toBe('SIGKILL');
    });
    it('cleans its preview and removes signal handlers', async () => {
        const before = process.listenerCount('SIGINT'); runtime = localRuntime(directory, directory);
        const child = runtime.start(...node('setInterval(()=>{},1000)'), 'preview.log', process.env);
        const cleanup = await runtime.cleanup(); expect(cleanup.errors).toEqual([]);
        expect(child.signalCode).toBe('SIGTERM'); expect(process.listenerCount('SIGINT')).toBe(before);
    });
    it('marks interruption, stops its child and refuses later work', async () => {
        runtime = localRuntime(directory, directory);
        const child = runtime.start(...node('setInterval(()=>{},1000)'), 'interrupt.log', process.env);
        process.emit('SIGTERM', 'SIGTERM'); await child.done.catch(() => {});
        expect(() => runtime.assertActive()).toThrow('SIGTERM');
        await expect(runtime.run(...node('console.log("must not run")'), 'later.log', process.env)).rejects.toThrow('SIGTERM');
        expect((await runtime.cleanup()).interrupted).toBe('SIGTERM');
        await expect(fs.stat(path.join(directory, 'later.log'))).rejects.toThrow('ENOENT');
    });
    it.skipIf(process.platform === 'win32')('terminates descendants even after their launcher exits', async () => {
        runtime = localRuntime(directory, directory); const pidFile = path.join(directory, 'descendant.pid');
        const descendant = `require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
        const launcher = `const p=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'});p.unref();setTimeout(()=>{},100)`;
        await runtime.run(...node(launcher), 'descendant.log', process.env);
        const pid = Number(await waitFile(pidFile));
        expect(() => process.kill(pid, 0)).toThrow();
    });
});
