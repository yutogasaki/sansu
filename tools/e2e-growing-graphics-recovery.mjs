import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { answerUI, readNative, runtimeMetadata, seedDev } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_GRAPHICS_URL, out = process.env.SANSU_GRAPHICS_OUTPUT;
assert(base && out, 'Specify a fixed DEV preview and fresh SANSU_GRAPHICS_OUTPUT');
await fs.mkdir(out, { recursive: false });
const report = { target: base, source: 'DEV disposable profile; explicit GPU allocation failures and actual context loss; not a physical old iPad', scenarios: [], captures: [], pass: false };
async function hashes() {
    const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-growing-graphics-recovery.mjs', 'tools/island-e2e-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
}
report.initialHashes = await hashes();
let active;
const ready = async page => { await page.locator('[data-growing-island="ready"] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
async function capture(page, engine, name) {
    const file = `${engine}-${name}.png`; await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page) });
}
try {
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
        const browser = await engine.launch();
        try {
            const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, reducedMotion: 'reduce' });
            await context.addInitScript(() => {
                const original = HTMLCanvasElement.prototype.getContext;
                window.__graphicsAttempts = [];
                HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
                    if (kind === 'webgl2') {
                        const mode = sessionStorage.getItem('qa-gpu'); window.__graphicsAttempts.push({ mode, antialias: args[0]?.antialias, powerPreference: args[0]?.powerPreference });
                        if (mode === 'none' || (mode === 'no-msaa' && args[0]?.antialias) || (mode === 'default-only' && args[0]?.powerPreference !== 'default')) return null;
                    }
                    return original.call(this, kind, ...args);
                };
                const draw = WebGL2RenderingContext.prototype.drawElements;
                WebGL2RenderingContext.prototype.drawElements = function (...args) {
                    if (sessionStorage.getItem('qa-gpu') === 'small-buffer-only' && this.canvas.width * this.canvas.height > 400000) throw new Error('QA drawing buffer limit');
                    return draw.apply(this, args);
                };
                // Test both classic and desktop-UA iPad detection without claiming this is an actual iPad.
                Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
                Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
            });
            const page = active = await context.newPage(); page.setDefaultTimeout(45000);
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await page.goto(`${base}/#/island`); const id = await seedDev(page, { familiar: false });
            await page.evaluate(() => sessionStorage.setItem('qa-gpu', 'no-msaa')); await page.reload(); await ready(page);
            assert.equal(await page.locator('[data-growing-world] canvas').getAttribute('data-graphics-quality'), 'compact');
            await capture(page, name, 'compact-island');
            await page.getByRole('button', { name: 'いえ', exact: true }).tap();
            await page.locator('.island-stage__viewport[aria-busy="false"] canvas').waitFor();
            assert.equal(await page.locator('.island-stage__viewport canvas').getAttribute('data-graphics-quality'), 'compact');
            await capture(page, name, 'compact-house');
            await page.getByRole('button', { name: 'しま', exact: true }).tap(); await ready(page);
            const before = await readNative(page, id);
            // Keep the native allocation restriction active: recovery must change its attributes.
            await page.evaluate(() => sessionStorage.setItem('qa-gpu', 'default-only')); await page.reload(); await ready(page);
            assert.equal(await page.locator('[data-growing-world] canvas').getAttribute('data-graphics-quality'), 'recovery');
            await capture(page, name, 'automatic-recovery-island');
            await page.getByRole('button', { name: 'いえ', exact: true }).tap();
            await page.locator('.island-stage__viewport[aria-busy="false"] canvas').waitFor();
            assert.equal(await page.locator('.island-stage__viewport canvas').getAttribute('data-graphics-quality'), 'recovery');
            await capture(page, name, 'automatic-recovery-house');
            await page.getByRole('button', { name: 'しま', exact: true }).tap(); await ready(page);
            assert.deepEqual(await readNative(page, id), before);
            // A compact iPad still needs a genuinely smaller surface on manual retry.
            await page.evaluate(() => sessionStorage.setItem('qa-gpu', 'small-buffer-only')); await page.reload();
            const limited = page.getByRole('alert').filter({ hasText: 'しまの えを ひらけなかったよ' }); await limited.waitFor();
            await limited.locator('summary').tap();
            assert.match(await limited.locator('pre').innerText(), /render \(compact\): QA drawing buffer limit/);
            await capture(page, name, 'compact-surface-failed');
            await limited.getByRole('button', { name: 'もういちど みる', exact: true }).tap(); await ready(page);
            assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-gpu')), 'small-buffer-only');
            assert.equal(await page.locator('[data-growing-world] canvas').getAttribute('data-graphics-quality'), 'recovery');
            assert(await page.locator('[data-growing-world] canvas').evaluate(canvas => canvas.width * canvas.height <= 400000));
            assert.deepEqual(await readNative(page, id), before);
            await capture(page, name, 'smaller-surface-recovered');
            report.scenarios.push({ engine: name, name: 'unchanged context attribute restriction and drawing buffer limit recover with distinct profiles; native data preserved', pass: true });
            await page.evaluate(() => sessionStorage.setItem('qa-gpu', 'none')); await page.reload();
            const failure = page.getByRole('alert').filter({ hasText: 'しまの えを ひらけなかったよ' }); await failure.waitFor();
            assert.equal(await page.getByRole('progressbar', { name: /70%/ }).count(), 0);
            await failure.locator('summary').tap();
            assert.match(await failure.locator('pre').innerText(), /initialization: Initial: WebGL2 context unavailable; Recovery: WebGL2 context unavailable/);
            // Permanent GPU refusal must remain visible on a second bounded attempt.
            await failure.getByRole('button', { name: 'もういちど みる', exact: true }).tap(); await failure.waitFor();
            await failure.locator('summary').tap();
            assert.match(await failure.locator('pre').innerText(), /initialization: WebGL2 context unavailable/);
            assert.deepEqual(await readNative(page, id), before); await capture(page, name, 'gpu-unavailable');
            const [response] = await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                failure.getByRole('button', { name: '最新版を ひらく', exact: true }).tap(),
            ]);
            assert(response?.url().includes('__app-update='), 'A real network navigation must follow the recovery tap');
            await failure.waitFor(); assert.deepEqual(await readNative(page, id), before);
            await capture(page, name, 'network-reopened-with-gpu-unavailable');
            await failure.getByRole('button', { name: 'まなぶ', exact: true }).tap(); await page.locator('[data-input-ready="true"]').waitFor();
            const native = await readNative(page, id), answered = (await answerUI(page, native.plan, { touch: true })).state;
            assert.equal(answered.logs.length, before.logs.length + 1); await capture(page, name, 'learning-without-gpu');
            await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await failure.waitFor();
            await page.evaluate(() => sessionStorage.removeItem('qa-gpu'));
            await failure.getByRole('button', { name: 'もういちど みる', exact: true }).tap(); await ready(page);
            assert.equal((await readNative(page, id)).logs.length, answered.logs.length); await capture(page, name, 'retry-recovered');
            report.scenarios.push({ engine: name, browser: browser.version(), name: 'Apple compact island/house; unsupported GPU ends wait; network reopening; learning saves; retry retains data', pass: true });
            if (name === 'chromium') {
                await page.evaluate(() => {
                    const canvas = document.querySelector('[data-growing-world] canvas');
                    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
                    if (!extension) throw Error('No real context loss extension'); extension.loseContext();
                });
                await failure.waitFor(); await capture(page, name, 'actual-context-lost');
                await failure.getByRole('button', { name: 'もういちど みる', exact: true }).tap(); await ready(page);
                assert.equal((await readNative(page, id)).logs.length, answered.logs.length);
                await capture(page, name, 'context-recovered');
                report.scenarios.push({ engine: name, name: 'actual GPU context loss ends drawing; fresh compact renderer recovers', pass: true });
            }
            assert.deepEqual(errors, []); await context.close();
        } catch (error) {
            if (active && !active.isClosed()) report.failureDetails = await active.locator('.growing-loading-details pre').allTextContents().catch(() => []);
            if (active && !active.isClosed()) report.failureDetails = await active.locator('.growing-loading-details pre').allTextContents().catch(() => []);
            if (active && !active.isClosed()) await active.screenshot({ path: `${out}/failure.png` }).catch(() => {});
            throw error;
        } finally { await browser.close(); }
    }
    report.finalHashes = await hashes(); assert.deepEqual(report.finalHashes, report.initialHashes);
    report.pass = true; console.log('PASS graphics recovery');
} catch (error) {
    report.error = error.stack || String(error);
    if (active && !active.isClosed()) await active.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
