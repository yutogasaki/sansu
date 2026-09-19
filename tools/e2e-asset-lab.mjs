import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const garden = process.env.ASSET_LAB_SET === 'garden';
const out = process.env.ASSET_LAB_OUTPUT || 'output/playwright/asset-lab';
await mkdir(out, { recursive: true });
const target = `http://127.0.0.1:5243/prototypes/asset-lab/${garden ? '?set=garden' : ''}`;
const report = { target, candidate: garden ? 'island-asset-lab-garden-v1' : 'island-asset-lab-v1', delivery: 'dev-asset-lab',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceSha256: createHash('sha256').update(await readFile('src/prototypes/assetLab/main.ts')).digest('hex'),
    measuredAt: new Date().toISOString(), measurements: [], checks: [], errors: [] };
const browser = await chromium.launch();
try {
    for (const width of garden ? [390, 768] : [1280, 390]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: 'reduce', hasTouch: width === 390 });
        const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
        page.setDefaultTimeout(60000);
        page.on('console', m => { if (/GL_INVALID|THREE.WebGLProgram|too many errors/.test(m.text())) report.errors.push(m.text()); });
        await page.goto(target);
        const ready = q => page.waitForFunction(q => window.__assetLab?.ready && window.__assetLab.quality === q, q);
        await ready(garden ? 'runtime' : '1024');
        assert.equal(await page.evaluate(() => window.__assetLab.candidate), report.candidate);
        const coldResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\.glb(?:\?|$)/.test(r.name)).map(r => ({ url: r.name, bytes: r.encodedBodySize })));
        assert.equal(coldResources.length, garden ? 6 : 3);
        if (garden) assert(coldResources.every(r => r.url.includes('/runtime/near.glb')));
        report.checks.push({width, coldResources});
        for (const quality of garden ? ['2048', 'runtime'] : ['2048', '1024']) {
            await page.locator(`[data-quality="${quality}"]`).click(); await ready(quality);
            await page.locator('[data-focus="all"]').click();
            report.measurements.push({ width, quality, loadMs: await page.evaluate(() => window.__assetLab.loadMs), ...await page.evaluate(() => window.__assetLab.measure()) });
            await page.screenshot({ path: `${out}/${width}-${quality}-all.png`, fullPage: true });
            for (const focus of garden ? ['garden-hut', 'flowerbed', 'streetlamp'] : ['tree', 'rock', 'bench']) {
                await page.locator(`[data-focus="${focus}"]`).click();
                await page.screenshot({ path: `${out}/${width}-${quality}-${focus}.png`, fullPage: true });
            }
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.route('**/island-rock-v1/final/model.glb', route => route.abort());
        await page.locator('[data-quality="2048"]').click(); await page.locator('#retry').waitFor({ state: 'visible' });
        assert.match(await page.locator('#status').textContent(), /読み込めません/);
        await page.unroute('**/island-rock-v1/final/model.glb');
        await page.locator('#retry').click(); await ready('2048');
        await page.reload(); await ready(garden ? 'runtime' : '1024');
        report.checks.push(`${width}: both qualities, 4 views, no horizontal overflow, failed load and retry, reload, reduced motion`);
        await context.close();
    }
    assert.deepEqual(report.errors, []);
} finally {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
}
console.log(JSON.stringify(report, null, 2));
