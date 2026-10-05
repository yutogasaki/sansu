import assert from 'node:assert/strict';
import { promises as fs, createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const inside = (directory, file) => { const relative = path.relative(directory, file); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };

export async function newOutput(file, root, sources = []) {
    let ancestor = path.dirname(file);
    for (;;) {
        try { file = path.resolve(await fs.realpath(ancestor), path.relative(ancestor, file)); break; }
        catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
    }
    root = await fs.realpath(root);
    if (inside(root, file)) {
        assert(inside(path.join(root, 'output'), file) && file !== path.join(root, 'output'), 'Repository evidence must be inside output/');
        execFileSync('git', ['check-ignore', '-q', '--', file], { cwd: root });
    }
    for (const source of sources) assert(!inside(await fs.realpath(source), file), 'Keep output outside input directories');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(file, { recursive: false });
    return file;
}

export function localRuntime(cwd, output) {
    const children = new Set(); let interrupted;
    const stop = async child => {
        if (!child?.pid) return;
        if (process.platform === 'win32' && (child.exitCode !== null || child.signalCode !== null)) return;
        const kill = signal => {
            try {
                if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
                else process.kill(-child.pid, signal);
            } catch (error) { if (error.code !== 'ESRCH') throw error; }
        };
        const alive = () => {
            if (process.platform === 'win32') return child.exitCode === null && child.signalCode === null;
            try { process.kill(-child.pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
        };
        kill('SIGTERM');
        for (let i = 0; i < 40 && alive(); i++) await delay(50);
        if (alive()) kill('SIGKILL');
        await child.done.catch(() => {});
    };
    const onSignal = signal => { interrupted = signal; for (const child of children) void stop(child).catch(() => {}); };
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    const start = (command, args, logName, env) => {
        assert(!interrupted, `Interrupted by ${interrupted}`);
        const stream = createWriteStream(path.join(output, logName), { flags: 'wx' });
        const child = spawn(command, args, { cwd: typeof cwd === 'function' ? cwd() : cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
        children.add(child); child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
        child.done = new Promise((resolve, reject) => {
            let spawnError;
            child.once('error', error => { spawnError = error; });
            stream.once('error', error => { spawnError = error; void stop(child).catch(() => {}); });
            child.once('close', (code, signal) => {
                stream.end(() => {
                    if (!spawnError && code === 0) resolve();
                    else reject(spawnError || Error(`${command} failed (${signal || code}); see ${logName}`));
                });
            });
        });
        child.done.catch(() => {}); return child;
    };
    return {
        start,
        async run(command, args, log, env, timeoutMs = 15 * 60_000) {
            const child = start(command, args, log, env); let expired = false;
            const timer = setTimeout(() => { expired = true; void stop(child).catch(() => {}); }, timeoutMs);
            try { await child.done; assert(!expired, `Timed out; see ${log}`); }
            catch (error) { if (expired) throw Error(`Timed out; see ${log}`, { cause: error }); throw error; }
            finally { clearTimeout(timer); await stop(child); children.delete(child); }
        },
        assertActive() { assert(!interrupted, `Interrupted by ${interrupted}`); },
        async cleanup() {
            const results = await Promise.allSettled([...children].map(stop));
            process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
            return { interrupted, errors: results.filter(result => result.status === 'rejected').map(result => String(result.reason)) };
        },
    };
}
