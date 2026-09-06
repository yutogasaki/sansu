import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5188';
const out = process.env.SANSU_PARK_THREE_OUTPUT || 'output/playwright/park-three/audit';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.SANSU_PARK_BROWSER_GPU === 'metal' ? { headless: true, args: ['--use-angle=metal'] } : {});
const report = { target: base, candidate: 'park-three-resin-v1', delivery: 'build-play-v1',
    flags: 'VITE_BUILD_PLAY_ENABLED=true VITE_PARK_RENDERER=three', browser: browser.version(),
    device: 'Playwright Chromium desktop host, viewport emulation; not physical mobile', gpuMode: process.env.SANSU_PARK_BROWSER_GPU || 'default', scenarios: [], errors: [] };

async function seed(page) {
    await page.goto(`${base}/#/park`); await page.waitForURL(/#\/onboarding/);
    await page.evaluate(async () => {
        const { createInitialProfile } = await import('/src/domain/user/profile.ts');
        const { saveProfile, setActiveProfileId } = await import('/src/domain/user/repository.ts');
        const p = createInitialProfile('つむぎ', 2, 1, 1, 'math'); p.soundEnabled = false;
        await saveProfile(p); await setActiveProfileId(p.id);
    });
    await page.goto(`${base}/#/park`); await page.locator('[data-game-id]').waitFor();
}
async function fixture(page, layout) {
    // Fresh test profile only. Fixture provisioning never exists in the shipped app.
    await page.evaluate(async layout => {
        const { db } = await import('/src/db/index.ts'); const app = await db.appData.get('app'); const park = await db.parks.get(app.activeProfileId);
        park.parts = layout.filter(Boolean).map((kind, i) => ({ id: `fixture-${i}`, kind }));
        let cursor = 0; park.courses[0].slots = layout.map(kind => kind ? park.parts[cursor++].id : null);
        park.revision++; await db.parks.put(park);
    }, layout);
    await page.reload(); await page.locator('[data-game-id]').waitFor();
}
const snapshot = page => page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts'); const app = await db.appData.get('app');
    return { park: await db.parks.get(app.activeProfileId), logs: await db.logs.toArray(), plans: await db.parkPlans.toArray(), events: await db.parkEvents.toArray() };
});
const shot = async (page, name) => { await page.screenshot({ path: `${out}/${name}.png` }); };
const play = async page => {
    await page.getByRole('button', { name: /^▷ (あそばせる|もういっかい)$/ }).click();
    await page.getByRole('button', { name: 'とめて つくりなおす', exact: true }).waitFor();
};
const done = page => page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 25000 });
const ready = page => page.locator('canvas[data-frames]').waitFor();
const progress = (page, action, min, max = 1) => page.waitForFunction(({ action, min, max }) => {
    const c = document.querySelector('canvas[data-toy-action]'); const p = Number(c?.dataset.progress);
    return c?.dataset.toyAction === action && p >= min && p < max;
}, { action, min, max });

try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 2 }); const page = await context.newPage();
        page.on('pageerror', error => report.errors.push(error.message));
        await seed(page); await ready(page); await page.waitForTimeout(150);
        assert.equal(await page.locator('[data-art-candidate]').getAttribute('data-art-candidate'), report.candidate);
        const revision = await page.locator('[data-game-id]').getAttribute('data-build-revision');
        const info = JSON.parse(await page.locator('canvas').getAttribute('data-render-info'));
        const initial = await snapshot(page); assert.equal(initial.park.parts.length, 2);
        assert.equal(initial.park.courses[0].slots[2], null);
        await shot(page, `${viewport.width}-initial`);
        const frames = await page.locator('canvas').getAttribute('data-frames'); await page.waitForTimeout(300);
        assert.equal(await page.locator('canvas').getAttribute('data-frames'), frames, 'Idle rendering did not stop');
        await play(page); await progress(page, 'slide', .25, .65); await shot(page, `${viewport.width}-slide`); await done(page);
        assert.equal((await snapshot(page)).logs.length, 0);
        // Add one owned test gate, then use real HTML placement and swapping for A and B.
        await page.evaluate(async () => {
            const { db } = await import('/src/db/index.ts'); const app = await db.appData.get('app'); const park = await db.parks.get(app.activeProfileId);
            park.parts.push({ id: 'fixture-gate', kind: 'bubble' }); park.revision++; await db.parks.put(park);
        });
        await page.getByRole('button', { name: 'ならべかえる', exact: true }).click();
        await page.locator('.park-inventory').getByRole('button').filter({ hasText: 'シャボンゲート' }).click();
        await page.getByRole('button', { name: 'ばしょ 3 あき', exact: true }).click();
        await page.evaluate(() => document.querySelector('.park-page').scrollTo(0, 0));
        const controls = await page.locator('.park-slots button, .park-inventory button').evaluateAll(buttons => buttons.map(b => {
            const r = b.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height };
        }));
        assert(controls.every(r => r.top >= 0 && r.bottom <= viewport.height && r.left >= 0 && r.right <= viewport.width && r.width >= 44 && r.height >= 44), `Mandatory placement controls outside viewport: ${JSON.stringify(controls)}`);
        await shot(page, `${viewport.width}-edit`);
        await page.evaluate(() => document.querySelector('.park-page').scrollTo(0, 0));
        await play(page); await progress(page, 'jump', .42, .6);
        assert.equal(await page.locator('canvas').getAttribute('data-bubble-visible'), 'false'); await shot(page, `${viewport.width}-A-apex`);
        await done(page); await shot(page, `${viewport.width}-A-finish`);
        await page.getByRole('button', { name: 'ならべかえる', exact: true }).click();
        await page.getByRole('button', { name: 'ばしょ 3 シャボンゲート', exact: true }).click();
        await page.getByRole('button', { name: 'ばしょ 2 トランポリン', exact: true }).click();
        await page.evaluate(() => document.querySelector('.park-page').scrollTo(0, 0));
        await play(page); await progress(page, 'bubble', .65, .9); await shot(page, `${viewport.width}-B-attached`);
        await progress(page, 'jump', .1, .18); await shot(page, `${viewport.width}-B-compress`);
        await progress(page, 'jump', .42, .6);
        assert.equal(await page.locator('canvas').getAttribute('data-bubble-visible'), 'true'); await shot(page, `${viewport.width}-B-apex`);
        await progress(page, 'jump', .78, .94); await shot(page, `${viewport.width}-B-pop`); await done(page);
        assert.equal(await page.locator('canvas').getAttribute('data-bubble-visible'), 'false'); await shot(page, `${viewport.width}-B-finish`);
        const saved = await snapshot(page); await page.reload(); await ready(page);
        assert.deepEqual((await snapshot(page)).park, saved.park);
        // Stop/replay cleanup; the detached canvas must never draw again.
        await play(page); await progress(page, 'slide', .1, .8);
        await page.evaluate(() => { window.oldParkCanvas = document.querySelector('canvas'); });
        await page.getByRole('button', { name: 'とめて つくりなおす', exact: true }).click(); await ready(page);
        const stopped = await page.evaluate(() => window.oldParkCanvas.dataset.frames); await page.waitForTimeout(250);
        assert.equal(await page.evaluate(() => window.oldParkCanvas.dataset.frames), stopped);
        // Actual WebGL context loss -> usable legacy course -> ordinary learning.
        const beforeLoss = await snapshot(page);
        await page.locator('canvas').evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await page.locator('.park-stage svg[role="img"]').waitFor();
        assert.deepEqual((await snapshot(page)).park, beforeLoss.park);
        await page.getByRole('button', { name: 'つくる', exact: true }).click();
        await page.getByRole('button', { name: '▷ うごきを みる', exact: true }).click();
        await progress(page, 'jump', .42, .6); await shot(page, `${viewport.width}-workshop-preview`);
        await page.getByRole('button', { name: 'シャボンゲートを つくる', exact: true }).click(); await page.locator('.park-answer').waitFor();
        assert.equal(await page.locator('canvas').count(), 0); await shot(page, `${viewport.width}-learning`);
        // Existing six-slot and extra-part saves are preserved with explicit legacy fallback.
        await fixture(page, ['slide', 'trampoline', 'bubble', 'bubble', 'trampoline', 'bell']);
        await page.locator('.park-stage svg[role="img"]').waitFor(); assert.equal(await page.locator('canvas').count(), 0);
        const six = await snapshot(page); await play(page); await done(page); assert.deepEqual((await snapshot(page)).park, six.park);
        report.scenarios.push({ viewport, revision, initialRender: info, idleStopped: true, actualUiSwap: true,
            replayNoLearningWrites: true, stopDisposed: true, contextLossFallback: true, learningNoCanvas: true, sixSlotPreserved: true });
        console.log(`PASS viewport ${viewport.width}`); await context.close();
    }
    // Weak bounce and ground-bubble ending, using the same sampler and model.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); await seed(page);
    await fixture(page, ['trampoline', 'bubble', null]); await ready(page); await play(page);
    await progress(page, 'hop', .35, .7); const x = Number(await page.locator('canvas').getAttribute('data-world-x')); assert.equal(x, 0);
    await done(page); assert.equal(await page.locator('canvas').getAttribute('data-bubble-visible'), 'true'); await shot(page, '390-ground-bubble-finish');
    // Performance: no screenshots/video or CPU throttle during the measured replay.
    await fixture(page, ['slide', 'bubble', 'trampoline']); await ready(page); await play(page); await done(page);
    await page.evaluate(() => {
        window.parkSamples = []; window.parkMeasuring = true; let previousFrame, previousTime;
        function sample(now) {
            const c = document.querySelector('canvas'); const frame = Number(c?.dataset.frames);
            if (c && frame !== previousFrame) {
                if (previousTime && c.dataset.progress !== '1') window.parkSamples.push(now - previousTime);
                previousTime = now; previousFrame = frame;
            }
            if (window.parkMeasuring) requestAnimationFrame(sample);
        } requestAnimationFrame(sample);
    });
    await play(page); await done(page);
    report.performance = await page.evaluate(() => {
        window.parkMeasuring = false; const samples = window.parkSamples.sort((a,b) => a-b);
        const c = document.querySelector('canvas'), gl = c.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio, userAgent: navigator.userAgent,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            sampleCount: samples.length, gapsOver250ms: samples.filter(ms => ms >= 250).length,
            averageIntervalMs: samples.reduce((a,b) => a+b, 0) / samples.length,
            p95IntervalMs: samples[Math.floor(samples.length * .95)],
            averageFps: 1000 / (samples.reduce((a,b) => a+b, 0) / samples.length),
            render: JSON.parse(c.dataset.renderInfo), warmupReplays: 1, measuredReplays: 1, cpuThrottle: 1,
            video: false, screenshots: false, physicalMobile: false };
    });
    // Deliberately stall JS during an active jump: ordered final state must still be correct.
    await play(page); await progress(page, 'jump', .3, .65);
    await page.evaluate(() => { const end = performance.now() + 700; while (performance.now() < end) { /* emulate a busy main thread */ } });
    await done(page); assert.equal(await page.locator('canvas').getAttribute('data-bubble-visible'), 'false');
    assert.equal((await snapshot(page)).logs.length, 0); await context.close();
    // Reduced motion is demand-rendered and keeps outcome readable.
    const reduced = await browser.newContext({ viewport: { width: 768, height: 1024 }, reducedMotion: 'reduce' }); const reducedPage = await reduced.newPage(); await seed(reducedPage); await ready(reducedPage);
    await fixture(reducedPage, ['slide', 'bubble', 'trampoline']); await ready(reducedPage); await play(reducedPage); await done(reducedPage);
    assert.equal(await reducedPage.locator('canvas').getAttribute('data-bubble-visible'), 'false'); await shot(reducedPage, '768-reduced-finish'); await reduced.close();
    // WebGL unavailable and failed dynamic module must both retain the old UI.
    for (const failure of ['webgl-unavailable', 'module-load']) {
        const ctx = await browser.newContext();
        if (failure === 'webgl-unavailable') await ctx.addInitScript(() => {
            const get = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
        });
        const p = await ctx.newPage(); if (failure === 'module-load') await p.route('**/three/ThreeParkStage.tsx*', route => route.abort());
        await seed(p); await p.locator('.park-stage svg[role="img"]').waitFor(); await p.waitForTimeout(200);
        assert.equal(await p.locator('canvas').count(), 0); await play(p); await done(p);
        assert.equal((await snapshot(p)).park.parts.length, 2); report.scenarios.push({ failure, fallback: true }); await ctx.close();
    }
    assert.deepEqual(report.errors, []);
    // Separate short recordings from the running application, one for each arrangement.
    for (const [name, layout] of [['A', ['slide','trampoline','bubble']], ['B', ['slide','bubble','trampoline']]]) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: `${out}/raw-video`, size: { width: 390, height: 844 } } });
        const p = await ctx.newPage(), opened = Date.now(); await seed(p); await fixture(p, layout); await ready(p); await p.waitForTimeout(300);
        const start = (Date.now() - opened) / 1000; await play(p); await done(p); await p.waitForTimeout(650);
        const duration = (Date.now() - opened) / 1000 - start;
        const video = p.video(); await ctx.close(); const raw = await video.path();
        execFileSync('ffmpeg', ['-loglevel','error','-y','-ss',String(Math.max(0,start - .15)),'-i',raw,'-t',String(duration + .25),'-c:v','libvpx-vp9','-crf','30','-b:v','0',`${out}/${name}.webm`]);
        report.scenarios.push({ recording: name, source: 'actual /park application playback', seconds: duration });
    }
    report.pass = true;
} catch (error) { report.pass = false; report.failure = error.stack; throw error; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
