import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { seedNative, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_QUALITY_URL;
const out = process.env.SANSU_QUALITY_OUTPUT;
const initial = Number(process.env.SANSU_QUALITY_INITIAL ?? 1);
const ceiling = initial === .65 ? 1.25 : 1.5;
assert(base && out, 'Specify production SANSU_QUALITY_URL and a fresh SANSU_QUALITY_OUTPUT');
await fs.mkdir(out, { recursive: false });
const inputs = ['src/components/island/three/adaptiveIslandQuality.ts', 'src/components/island/growing/GrowingWorld.tsx', 'src/components/island/growing/GrowingIsland.tsx', 'tools/e2e-growing-quality.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const report = { at: new Date().toISOString(), base, initial, ceiling, inputs: await hashes(), scope: 'Production browser with simulated Apple device detection and DPR 3. Actual renderer and frames, disposable saved profile. Invalid shader is explicit fault injection. Not physical iPhone performance or battery evidence.', cases: [], pass: false };
const ready = async page => {
    await page.locator('[data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
try {
    for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
        const browser = await engine.launch();
        const result = { engine: name, version: browser.version(), pass: false };
        report.cases.push(result);
        let page;
        try {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce' });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
                Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26.6.1 Mobile/15E148 Safari/604.1' });
                window.__qualityStarts = [];
                const seen = new WeakSet();
                new MutationObserver(() => {
                    for (const canvas of document.querySelectorAll('[data-growing-world] canvas')) {
                        if (seen.has(canvas) || !canvas.dataset.pixelRatio) continue;
                        seen.add(canvas);
                        window.__qualityStarts.push({ ratio: Number(canvas.dataset.pixelRatio), ceiling: Number(canvas.dataset.qualityCeiling), quality: canvas.dataset.graphicsQuality, width: canvas.width, cssWidth: canvas.getBoundingClientRect().width });
                    }
                }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-pixel-ratio'] });
                const source = WebGL2RenderingContext.prototype.shaderSource;
                WebGL2RenderingContext.prototype.shaderSource = function (shader, text) {
                    if (sessionStorage.getItem('qa-quality-invalid') && this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) text += '\nQA_INVALID_SHADER';
                    return source.call(this, shader, text);
                };
            });
            page = await context.newPage(); page.setDefaultTimeout(30000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(`${base}/#/island`); await page.waitForLoadState('networkidle');
            const id = await seedNative(page, `quality-${name}`);
            await page.reload(); await ready(page);
            const saved = await readNative(page, id);
            result.starts = await page.evaluate(() => window.__qualityStarts);
            assert.equal(result.starts.length, 1);
            assert.equal(result.starts[0].ratio, initial);
            assert.equal(result.starts[0].ceiling, ceiling);
            assert.equal(result.starts[0].quality, 'compact');
            result.metadata = await runtimeMetadata(page);
            await page.screenshot({ path: `${out}/${name}-normal.png` });
            await page.waitForTimeout(6500);
            result.settledRatio = Number(await page.locator('[data-growing-world] canvas').getAttribute('data-pixel-ratio'));
            assert(result.settledRatio >= .65 && result.settledRatio <= ceiling);
            await page.screenshot({ path: `${out}/${name}-settled.png` });
            assert.deepEqual(await readNative(page, id), saved);
            await page.goto(`${base}/?__app-update=quality-check#/island`); await ready(page);
            assert.equal((await page.evaluate(() => window.__qualityStarts))[0].ratio, initial);
            assert.deepEqual(await readNative(page, id), saved);
            await page.evaluate(() => sessionStorage.setItem('qa-quality-invalid', '1')); await page.reload();
            const failure = page.getByRole('alert').filter({ hasText: 'しまの えを ひらけなかったよ' });
            await failure.waitFor();
            result.failure = await failure.locator('pre').textContent();
            assert.match(result.failure, /QA_INVALID_SHADER/);
            result.failedStarts = await page.evaluate(() => window.__qualityStarts);
            assert.equal(result.failedStarts.length, initial === .65 ? 1 : 2);
            if (initial === 1) {
                assert.equal(result.failedStarts[1].ratio, .65);
                assert.equal(result.failedStarts[1].ceiling, .8);
                assert.equal(result.failedStarts[1].quality, 'recovery');
            }
            await page.waitForTimeout(500);
            assert.deepEqual(await page.evaluate(() => window.__qualityStarts), result.failedStarts);
            await page.evaluate(() => sessionStorage.removeItem('qa-quality-invalid'));
            await failure.getByRole('button', { name: 'もういちど みる', exact: true }).click(); await ready(page);
            result.recovery = await page.evaluate(() => window.__qualityStarts.at(-1));
            assert.equal(result.recovery.ratio, .65); assert.equal(result.recovery.quality, 'recovery');
            assert.deepEqual(await readNative(page, id), saved); assert.deepEqual(errors, []);
            result.pass = true;
        } catch (error) {
            result.error = error.stack || String(error);
            if (page && !page.isClosed()) await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
            throw error;
        } finally { await browser.close(); }
    }
    assert.deepEqual(await hashes(), report.inputs);
    report.pass = true; console.log('PASS normal quality, bounded fallback, update URL and saved learning');
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
