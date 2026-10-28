import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { readNative, runtimeMetadata, seedNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_SHADER_URL, out = process.env.SANSU_SHADER_OUTPUT;
assert(base && out, 'Specify a fixed production preview and fresh SANSU_SHADER_OUTPUT');
await fs.mkdir(out, { recursive: false });
const expectOldFailure = process.env.SANSU_SHADER_EXPECT_FAILURE === '1';
const report = { at: new Date().toISOString(), target: base, expectOldFailure,
    scope: 'Disposable saved profile, real production renderer/SW and normal opening sync. Explicit delayed KHR completion and invalid-shader diagnostics; not a physical iPhone.',
    cases: [], pass: false };
async function hashes() {
    const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public', 'dist'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'postcss.config.js', 'tools/e2e-growing-shader-startup.mjs', 'tools/island-e2e-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
}
const ready = async page => {
    await page.locator('[data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
async function owned(page, id) {
    return page.evaluate(async id => {
        const request = indexedDB.open('SansuGrowingIslandV1');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
            const read = db.transaction('terrainIslands').objectStore('terrainIslands').get(id);
            const record = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
            return Object.fromEntries(['drops', 'land', 'terrain', 'plots', 'landmarks', 'keepsakes', 'villagers', 'learned', 'room'].map(key => [key, record.state[key]]));
        } finally { db.close(); }
    }, id);
}
report.initialHashes = await hashes();
try {
    // Baseline reproduction needs a native parallel compiler. Chromium on this
    // host may omit KHR; the candidate still exercises its sequential path.
    for (const [name, engine] of expectOldFailure ? [['webkit', webkit]] : [['webkit', webkit], ['chromium', chromium]]) {
        const browser = await engine.launch();
        const result = { engine: name, browser: browser.version(), pass: false };
        report.cases.push(result);
        let page;
        try {
            const context = await browser.newContext({ viewport: { width: name === 'webkit' ? 390 : 768, height: name === 'webkit' ? 844 : 1024 }, hasTouch: true, reducedMotion: 'reduce' });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
                Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26.6.1 Mobile/15E148 Safari/604.1' });
                Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
                const prototype = WebGL2RenderingContext.prototype;
                const create = prototype.createProgram, parameter = prototype.getProgramParameter, isProgram = prototype.isProgram;
                const remove = prototype.deleteProgram, source = prototype.shaderSource;
                const created = new WeakMap();
                window.__shaderStartup = { delayed: 0, deletedWhileLoading: 0, staleQueries: 0, contexts: 0, parallel: false };
                const contexts = new WeakSet();
                prototype.createProgram = function () {
                    if (!contexts.has(this)) { contexts.add(this); window.__shaderStartup.contexts++; }
                    window.__shaderStartup.parallel = Boolean(this.getExtension('KHR_parallel_shader_compile'));
                    const program = create.call(this); created.set(program, performance.now()); return program;
                };
                prototype.getProgramParameter = function (program, key) {
                    if (!isProgram.call(this, program)) window.__shaderStartup.staleQueries++;
                    const value = parameter.call(this, program, key);
                    // Delay completion only; never fake LINK_STATUS or delete a
                    // program. The application performs its real saved-state sync.
                    if (key === 37297 && sessionStorage.getItem('qa-shader-startup') === 'slow' && performance.now() - created.get(program) < 1500) {
                        window.__shaderStartup.delayed++; return false;
                    }
                    return value;
                };
                prototype.deleteProgram = function (program) {
                    if (document.querySelector('[data-loading-step="scene"]')) window.__shaderStartup.deletedWhileLoading++;
                    return remove.call(this, program);
                };
                prototype.shaderSource = function (shader, text) {
                    if (sessionStorage.getItem('qa-shader-startup') === 'invalid' && this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) text += '\nQA_INVALID_SHADER';
                    return source.call(this, shader, text);
                };
            });
            page = await context.newPage(); page.setDefaultTimeout(30000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(`${base}/#/island`); await page.waitForLoadState('networkidle');
            const id = await seedNative(page, `shader-startup-${name}`);
            await page.reload(); await ready(page);
            // A returning island must have elapsed natural time to synchronize.
            // An immediate reload in the same clock tick may legitimately reuse
            // the scenery and never exercise the disposal race.
            await page.waitForTimeout(2000);
            const learning = await readNative(page, id), ownership = await owned(page, id);
            await page.evaluate(() => sessionStorage.setItem('qa-shader-startup', 'slow'));
            await page.reload();
            const failure = page.getByRole('alert').filter({ hasText: 'しまの えを ひらけなかったよ' });
            if (expectOldFailure) {
                await failure.waitFor(); result.detail = await failure.locator('pre').textContent();
                assert.match(result.detail, /Growing shader failed to link:/);
                result.trace = await page.evaluate(() => window.__shaderStartup);
                assert(result.trace.staleQueries > 0, 'Must reproduce inspection of a deleted program');
            } else {
                await ready(page);
                result.trace = await page.evaluate(() => window.__shaderStartup);
                if (result.trace.parallel) assert(result.trace.delayed > 0 && result.trace.deletedWhileLoading > 0, 'Must actually overlap slow preparation and disposal');
                assert.equal(result.trace.staleQueries, 0); assert.equal(result.trace.contexts, 1, 'Open on the first context, without recovery');
                assert.equal(await page.locator('[data-growing-world] canvas').getAttribute('data-graphics-quality'), 'compact');
                assert.deepEqual(await readNative(page, id), learning); assert.deepEqual(await owned(page, id), ownership);
                result.metadata = await runtimeMetadata(page);
                await page.screenshot({ path: `${out}/${name}-first-context.png` });
                // The update URL must also open directly with the same saved island.
                await page.goto(`${base}/?__app-update=shader-startup-check#/island`); await ready(page);
                assert.deepEqual(await readNative(page, id), learning); assert.deepEqual(await owned(page, id), ownership);
                assert.equal(await page.evaluate(() => window.__shaderStartup.staleQueries), 0);
                assert.equal(await page.evaluate(() => window.__shaderStartup.contexts), 1);
                // Keep genuine compiler failure visible; this fix must not turn
                // all link errors into success or trigger an automatic retry loop.
                await page.evaluate(() => sessionStorage.setItem('qa-shader-startup', 'invalid')); await page.reload(); await failure.waitFor();
                result.trueFailure = await failure.locator('pre').textContent();
                assert.match(result.trueFailure, /Growing shader failed to link:/); assert.match(result.trueFailure, /program:/); assert.match(result.trueFailure, /QA_INVALID_SHADER/);
                await page.waitForTimeout(500); assert.equal(await page.evaluate(() => window.__shaderStartup.contexts), 1);
                assert.deepEqual(await readNative(page, id), learning); assert.deepEqual(await owned(page, id), ownership);
                await failure.locator('summary').click(); await page.screenshot({ path: `${out}/${name}-real-shader-error.png` });
                await page.evaluate(() => sessionStorage.removeItem('qa-shader-startup'));
                await failure.getByRole('button', { name: 'もういちど みる', exact: true }).click(); await ready(page);
                assert.deepEqual(await readNative(page, id), learning); assert.deepEqual(await owned(page, id), ownership);
            }
            assert.deepEqual(errors, []); result.pass = true;
        } catch (error) {
            result.error = error.stack || String(error);
            if (page && !page.isClosed()) {
                result.failureDetails = await page.locator('.growing-loading-details pre').allTextContents();
                result.trace = await page.evaluate(() => window.__shaderStartup);
                await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => {});
            }
            throw error;
        } finally { await browser.close(); }
    }
    report.finalHashes = await hashes(); assert.deepEqual(report.finalHashes, report.initialHashes);
    report.pass = true; console.log(`PASS shader startup ${expectOldFailure ? 'baseline reproduction' : 'first-context opening and genuine-error handling'}`);
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
