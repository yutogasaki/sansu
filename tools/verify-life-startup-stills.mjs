// Run against the disposable Vite QA fixture described in the startup-stills evidence.
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const target = 'http://127.0.0.1:5261/', out = process.env.SANSU_STILL_VERIFY_OUTPUT || 'output/playwright/life-startup-stills';
await mkdir(out, { recursive: true });
const report = { target, scope: 'Isolated component fixture plus actual app screenshots; no user storage', cases: [] };
const browser = await chromium.launch();
try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
        window.__stillCalls = { webgl: 0, png: 0 };
        const get = HTMLCanvasElement.prototype.getContext, encode = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.getContext = function (...args) { if (String(args[0]).startsWith('webgl')) window.__stillCalls.webgl++; return get.apply(this, args); };
        HTMLCanvasElement.prototype.toDataURL = function (...args) { window.__stillCalls.png++; return encode.apply(this, args); };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${target}startup-stills-qa.html`);
    const ready = () => page.waitForFunction(() => [...document.querySelectorAll('img')].length === 2 && [...document.querySelectorAll('img')].every(i => !i.hidden && i.complete && i.naturalWidth > 0));
    await ready();
    const initial = await page.evaluate(() => ({ calls: window.__stillCalls, images: [...document.querySelectorAll('img')].map(i => i.src) }));
    assert.deepEqual(initial.calls, { webgl: 0, png: 0 });
    const expected = ['pokomoko-original', 'flower-bloom-original'];
    for (const [i, name] of expected.entries()) {
        const served = await (await page.request.get(initial.images[i])).body();
        const source = await readFile(`docs/design/2026-09-19-life-startup-stills/source/${name}.png`);
        assert.equal(createHash('sha256').update(served).digest('hex'), createHash('sha256').update(source).digest('hex'));
    }
    report.cases.push({ name: 'default', ...initial, pngBytesMatch: true });
    for (const variant of ['seed', 'bud', 'sunshine']) {
        await page.evaluate(variant => window.renderStills(variant), variant);
        await page.locator(`[data-variant="${variant}"]`).waitFor(); await ready();
        const images = await page.locator('img').evaluateAll(images => images.map(i => i.src));
        assert(images[variant === 'sunshine' ? 0 : 1].startsWith('data:image/png'));
        report.cases.push({ name: variant, dynamicImage: true });
    }
    const before = await page.evaluate(() => window.__stillCalls);
    await page.evaluate(() => window.renderStills('default')); await page.locator('[data-variant="default"]').waitFor(); await ready();
    assert.deepEqual(await page.evaluate(() => window.__stillCalls), before);
    await page.route(/(flower-bloom-original|pokomoko-original).*\.png/, route => route.request().resourceType() === 'script' ? route.continue() : route.abort());
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll('img')].length === 2 && [...document.querySelectorAll('img')].every(i => i.hidden));
    assert.equal(await page.locator('.life-product-preview > span').isVisible(), true);
    assert.equal(await page.locator('.life-resident-portrait > span').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.__stillCalls), { webgl: 0, png: 0 });
    report.cases.push({ name: 'image-transfer-failure', visibleTextFallback: true, noWebGL: true });
    assert.deepEqual(errors, []); await context.close();
    for (const width of [390, 768]) {
        const c = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 } });
        await c.addInitScript(() => { window.__pngCalls = 0; const fn = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function (...args) { window.__pngCalls++; return fn.apply(this, args); }; });
        const p = await c.newPage(), pageErrors = [];
        p.on('pageerror', e => pageErrors.push(e.message));
        await p.goto(target); for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await p.getByRole('button', { name, exact: true }).first().click();
        await p.locator('.island-learning[data-input-ready="true"]').waitFor(); await p.getByRole('button', { name: 'とじる', exact: true }).click();
        await p.locator('.life-world[data-rendered="true"]').waitFor();
        await p.waitForFunction(() => [...document.querySelectorAll('.life-home-action img')].length === 2 && [...document.querySelectorAll('.life-home-action img')].every(i => i.complete && i.naturalWidth > 0));
        assert.equal(await p.evaluate(() => window.__pngCalls), 0);
        await p.screenshot({ path: `${out}/${width}-home.png` });
        await p.getByRole('button', { name: 'まなぶ', exact: true }).first().click(); await p.locator('.island-learning[data-input-ready="true"]').waitFor();
        await p.screenshot({ path: `${out}/${width}-learning.png` });
        assert.deepEqual(pageErrors, []); report.cases.push({ name: 'app', width, startupPngCalls: 0, learningReady: true, errors: pageErrors }); await c.close();
    }
    report.pass = true;
} catch (e) { report.error = String(e); throw e; }
finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
