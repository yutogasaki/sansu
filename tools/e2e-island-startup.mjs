import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
const target = process.env.STARTUP_URL ?? 'http://127.0.0.1:5298';
const out = process.env.STARTUP_OUTPUT;
assert(out); assert(['127.0.0.1', 'localhost'].includes(new URL(target).hostname));
await mkdir(out, { recursive: false });
const candidate = process.env.STARTUP_CANDIDATE === 'true';
const engine = process.env.STARTUP_ENGINE === 'webkit' ? webkit : chromium;
const dist = process.env.STARTUP_DIST ?? 'dist';
const hash = value => createHash('sha256').update(value).digest('hex');
async function fingerprint() {
    const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]))).flat();
    const paths = [...await walk(dist), 'tools/e2e-island-startup.mjs'].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
    return { sha256: hash(JSON.stringify(files)), files };
}
const sourceStart = await fingerprint();
const browser = await engine.launch();
const report = { sourceStart, target, candidate, engine: engine.name(), version: await (await fetch(target + '/version.json')).json(),
    scope: 'Disposable browser; real onboarding, empty island, cold optional assets. Local emulation, not installed iPhone timing. Failure cases explicitly abort GLBs.', cases: [], pass: false };
try {
    for (const width of process.env.STARTUP_PROFILE ? [390] : [390, 768]) for (const mode of process.env.STARTUP_PROFILE ? ['normal'] : candidate ? ['normal', 'interaction', 'failure'] : ['normal']) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        if (mode === 'failure') await page.route(/\.glb(?:\?|$)/, route => route.abort());
        try {
            await page.goto(target);
            for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            if (candidate) assert.equal(await page.locator('.island-stage').count(), 0, 'Life learning must not mount the hidden legacy world');
            await page.evaluate(() => {
                const start = performance.now(); let last = start;
                window.startupProbe = { start, firstFrame: null, ready: null, frames: [], transitions: [], last: '' };
                const frame = () => {
                    const probe = window.startupProbe, now = performance.now();
                    probe.frames.push(now - last); last = now;
                    const node = document.querySelector('.life-world');
                    if (node?.dataset.rendered === 'true' && probe.firstFrame === null) probe.firstFrame = now - start;
                    const raw = node?.dataset.runtimeAssets;
                    if (raw && raw !== probe.last) {
                        probe.last = raw;
                        try { const assets = JSON.parse(raw); probe.transitions.push({ at: now - start, ...assets });
                            if (assets.pending.length === 0 && probe.ready === null) probe.ready = now - start;
                        } catch { /* Dynamic module is still loading. */ }
                    }
                    if (now - start < 12000) requestAnimationFrame(frame);
                }; requestAnimationFrame(frame);
            });
            const profiler = process.env.STARTUP_PROFILE ? await context.newCDPSession(page) : undefined;
            if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.locator('.life-world[data-rendered="true"]').waitFor();
            if (mode === 'interaction') {
                // Repeated real pointer motion while assets are still optional;
                // after the first grace interval, no new kind may begin.
                const box = await page.locator('.life-world canvas').boundingBox(); assert(box);
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                for (let i = 0; i < 20; i++) { await page.mouse.move(box.x + box.width / 2 + i % 2, box.y + box.height / 2); await page.waitForTimeout(60); }
                const paused = await page.evaluate(() => window.startupProbe.transitions.map(t => ({ at: t.at, loading: t.loading })));
                const activeKinds = new Set(paused.flatMap(t => t.loading ?? []));
                assert(activeKinds.size <= 1, 'Interaction must not start additional kinds');
            }
            await page.waitForFunction(() => window.startupProbe.ready !== null);
            await page.screenshot({ path: `${out}/${width}-${mode}.png` });
            await page.waitForFunction(() => performance.now() - window.startupProbe.start >= 12000);
            if (profiler) { const { profile } = await profiler.send('Profiler.stop'); await writeFile(`${out}/${width}.cpuprofile`, JSON.stringify(profile)); }
            const sample = await page.evaluate(() => ({ ...window.startupProbe,
                phases: performance.getEntriesByType('measure').filter(e => e.name.startsWith('sansu-life:')).map(e => ({ name: e.name, start: e.startTime, duration: e.duration })),
                glbs: performance.getEntriesByType('resource').filter(e => /\.glb(?:\?|$)/.test(e.name)).map(e => ({ start: e.startTime, duration: e.duration, bytes: e.encodedBodySize })) }));
            const final = sample.transitions.at(-1); assert(final);
            assert.equal(final.failed.length, mode === 'failure' ? 4 : 0);
            assert.equal(final.instances, mode === 'failure' ? 0 : 4);
            if (candidate) {
                assert(sample.transitions.every(t => t.loading.length <= 1));
                assert(sample.phases.some(p => p.name === 'sansu-life:scene-build'));
                assert(sample.phases.some(p => p.name === 'sansu-life:initial-restore'));
                if (mode !== 'failure') assert(sample.glbs.every(r => r.start - sample.start > sample.firstFrame));
            }
            let reload;
            if (mode === 'normal') {
                await page.addInitScript(() => {
                    let last = performance.now(); window.reloadProbe = { firstFrameMs: null, gaps: [] };
                    const tick = () => { const now = performance.now(); if (now - last > 100) window.reloadProbe.gaps.push(now - last); last = now;
                        if (document.querySelector('.life-world')?.dataset.rendered === 'true') window.reloadProbe.firstFrameMs = now;
                        else requestAnimationFrame(tick);
                    }; requestAnimationFrame(tick);
                });
                await page.reload();
                await page.waitForFunction(() => window.reloadProbe.firstFrameMs !== null);
                reload = await page.evaluate(() => ({ ...window.reloadProbe, phases: performance.getEntriesByType('measure').filter(e => e.name.startsWith('sansu-life:')).map(e => ({ name: e.name, duration: e.duration })) }));
                await page.screenshot({ path: `${out}/${width}-reload.png` });
            }
            // Immediate learning return must remain usable even in the fallback case.
            await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            if (candidate) assert.equal(await page.locator('.island-stage').count(), 0, 'Life learning must not mount the hidden legacy world');
            assert.deepEqual(errors, []);
            sample.frames.sort((a,b) => a-b);
            report.cases.push({ width, mode, reload, firstFrameMs: sample.firstFrame, allAssetsMs: sample.ready,
                frameP95Ms: sample.frames[Math.floor(sample.frames.length * .95)], maxFrameMs: sample.frames.at(-1), gapsOver100ms: sample.frames.filter(n => n > 100),
                transitions: sample.transitions, phases: sample.phases, glbs: sample.glbs, errors });
            console.log(`${width} ${mode}: first frame ${Math.round(sample.firstFrame)}ms, assets ${Math.round(sample.ready)}ms`);
        } catch (e) { await page.screenshot({ path: `${out}/${width}-${mode}-failure.png` }).catch(() => {}); throw e; }
        finally { await context.close(); }
    }
    assert.equal((await fingerprint()).sha256, sourceStart.sha256, 'Build and probe must remain unchanged');
    assert.deepEqual(await (await fetch(target + '/version.json')).json(), report.version);
    report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
