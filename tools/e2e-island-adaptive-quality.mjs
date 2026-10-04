import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { seedDev, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_ADAPTIVE_URL, out = process.env.SANSU_ADAPTIVE_OUTPUT;
assert(base && out); await fs.mkdir(out, { recursive: false });
const report = { target: base, kind: 'DEV fixture and injected resource ceiling; not physical iPad performance', scenarios: [], captures: [], pass: false };
async function hashes() {
    const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-island-adaptive-quality.mjs', 'tools/island-e2e-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
}
report.initialHashes = await hashes();
const ready = async page => { await page.locator('[data-growing-world] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
const ratio = async (page, value) => page.waitForFunction(value => Number(document.querySelector('[data-growing-world] canvas')?.dataset.pixelRatio) === value, value, { timeout: 45000 });
async function capture(page, name) { const file = name + '.png'; await page.screenshot({ path: `${out}/${file}` }); report.captures.push({ file, ...await runtimeMetadata(page) }); }
try {
    for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
        const browser = await engine.launch();
        let page;
        try {
            page = await browser.newPage({ viewport: { width: 768, height: 1024 }, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
            page.setDefaultTimeout(45000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });
                Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
                const get = HTMLCanvasElement.prototype.getContext;
                window.__allocationAttempts = 0; window.__surfaceFailures = 0;
                HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
                    if (kind === 'webgl2') {
                        window.__allocationAttempts++;
                        if (args[0]?.powerPreference === 'low-power') return null;
                    }
                    return get.call(this, kind, ...args);
                };
                const draw = WebGL2RenderingContext.prototype.drawElements;
                WebGL2RenderingContext.prototype.drawElements = function (...args) {
                    if (sessionStorage.getItem('qa-surface-limit') === 'yes' && this.canvas.width * this.canvas.height > 400000) {
                        window.__surfaceFailures++; throw Error('QA surface limit');
                    }
                    return draw.apply(this, args);
                };
            });
            await page.goto(`${base}/#/island`); const id = await seedDev(page, { familiar: false });
            await page.reload(); await ready(page); await ratio(page, .65);
            const before = await readNative(page, id); await capture(page, `${name}-initial`);
            for (const value of [.8, 1, 1.25]) await ratio(page, value);
            await capture(page, `${name}-sharper`);
            assert.deepEqual(await readNative(page, id), before);
            report.scenarios.push({ engine: name, name: 'low quality opens first, actual frame cadence earns all steps, native save unchanged', pass: true });
            await page.evaluate(() => sessionStorage.setItem('qa-surface-limit', 'yes')); await page.reload(); await ready(page);
            await page.waitForFunction(() => document.querySelector('[data-growing-world] canvas')?.dataset.qualityCeiling === '0.65');
            await ready(page); await ratio(page, .65);
            const attempts = await page.evaluate(() => window.__allocationAttempts);
            await page.waitForTimeout(7000); // More than two promotion windows: no retry loop into the same limit.
            assert.equal(await page.evaluate(() => window.__allocationAttempts), attempts);
            assert.equal(await page.evaluate(() => window.__surfaceFailures), 1);
            assert.equal(await page.getByRole('alert').filter({ hasText: 'しまの えを ひらけなかったよ' }).count(), 0);
            assert.deepEqual(await readNative(page, id), before); await capture(page, `${name}-automatic-fallback`);
            report.scenarios.push({ engine: name, name: 'promotion fails under unchanged resource limit; automatic lower-ceiling restart stays playable without a loop', pass: true });
            if (name === 'chromium') {
                await page.evaluate(() => sessionStorage.removeItem('qa-surface-limit')); await page.reload(); await ready(page); await ratio(page, .8);
                await page.evaluate(() => document.querySelector('[data-growing-world] canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
                await page.waitForFunction(() => document.querySelector('[data-growing-world] canvas')?.dataset.qualityCeiling === '0.65');
                await ready(page); assert.deepEqual(await readNative(page, id), before); await capture(page, `${name}-context-recovered`);
                report.scenarios.push({ engine: name, name: 'real context loss after promotion automatically recreates a safer renderer', pass: true });
            }
            assert.deepEqual(errors, []);
        } catch (error) {
            report.failure = String(error);
            if (page && !page.isClosed()) {
                report.failureState = await page.evaluate(() => ({ text: document.body.innerText, canvas: document.querySelector('[data-growing-world] canvas')?.outerHTML, failures: window.__surfaceFailures, attempts: window.__allocationAttempts }));
                await page.screenshot({ path: `${out}/failure.png` });
            }
            throw error;
        }
        finally { await browser.close(); }
    }
    report.finalHashes = await hashes(); assert.deepEqual(report.finalHashes, report.initialHashes); report.pass = true;
    console.log('PASS adaptive quality', report.scenarios.length);
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
