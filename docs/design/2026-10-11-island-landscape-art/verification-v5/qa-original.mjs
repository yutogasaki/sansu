import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const folder = 'docs/design/2026-10-11-island-landscape-art';
const out = process.env.SANSU_LANDSCAPE_ART_OUTPUT;
const target = process.env.SANSU_LANDSCAPE_ART_URL;
assert(out && target && ['127.0.0.1', 'localhost'].includes(new URL(target).hostname), 'Fresh output and local art viewer required');
await mkdir(out, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = async () => Object.fromEntries(await Promise.all(['index.html', 'viewer.js', 'viewer.bundle.js', 'whole-landscape.glb',
    'whole-landscape.blend', 'whole-landscape-render.png', 'owned-input.json', 'art-manifest.json'].map(async name => [name, sha(await readFile(`${folder}/${name}`))])));
const manifest = JSON.parse(await readFile(`${folder}/art-manifest.json`, 'utf8'));
const report = { target, candidate: manifest.candidate, evidenceType: 'actual standalone art viewer, not the game',
    initialInputs: await inputs(), qaSha256: sha(await readFile('tools/qa-landscape-art-viewer.mjs')), captures: [], scenarios: [], errors: [], pass: false };
const browser = await chromium.launch({ channel: 'chrome' });
let activePage;
const rendered = async page => {
    await page.locator('#stage[data-loading="false"]').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function capture(page, width, view, phase, light) {
    const metadata = await page.locator('#stage').evaluate(el => ({ ...el.dataset, rect: el.getBoundingClientRect().toJSON() }));
    assert.equal(metadata.model, phase === 'grown' ? manifest.candidate : 'whole-island-native-3d-05');
    assert.equal(metadata.gameplayMapped, 'false');
    assert.equal(metadata.modelSha256, phase === 'grown' ? manifest.sha256 : manifest.sourceGlbSha256);
    assert.equal(metadata.loadedModelSha256, metadata.modelSha256, 'The renderer must hash the bytes passed into GLTFLoader');
    assert.equal(metadata.view, view); assert.equal(metadata.lighting, light);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const file = `${width}-${phase}-${view}-${light}-${String(report.captures.length+1).padStart(2,'0')}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, width, ...metadata });
}
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.goto(target); await rendered(page);
        for (const light of ['day','dusk']) {
            await page.locator(`[data-light="${light}"]`).tap();
            for (const view of ['whole','grove','village','harbor','garden']) {
                const button = page.locator(`[data-view="${view}"]`); await button.scrollIntoViewIfNeeded(); await button.tap(); await rendered(page);
                await capture(page, viewport.width, view, 'grown', light);
            }
        }
        await page.locator('[data-light="day"]').tap(); await page.locator('[data-view="whole"]').tap(); await rendered(page);
        const cameraBefore = await page.locator('#stage').getAttribute('data-camera');
        await page.locator('canvas').press('ArrowRight'); await rendered(page);
        assert.notEqual(await page.locator('#stage').getAttribute('data-camera'), cameraBefore);
        await page.locator('canvas').press('Home'); await rendered(page);
        const wholeCamera = await page.locator('#stage').getAttribute('data-camera');
        await page.getByRole('button', { name: '拡大', exact: true }).tap(); await rendered(page);
        assert(JSON.parse(await page.locator('#stage').getAttribute('data-camera')).zoom > 1);
        await page.locator('[data-view="whole"]').tap(); await rendered(page);
        await page.getByRole('button', { name: '採用原本', exact: true }).tap(); await rendered(page);
        assert.equal(await page.locator('#stage').getAttribute('data-camera'), wholeCamera);
        await capture(page, viewport.width, 'whole', 'previous', 'day');
        assert((await page.locator('#model-file').getAttribute('href')).includes('2026-10-10-island-final-3d'));
        await page.getByRole('button', { name: '今回の造形', exact: true }).tap(); await rendered(page);
        await capture(page, viewport.width, 'whole', 'grown', 'day');
        const actualDownloads = report.captures.filter(c => c.width === viewport.width).map(c => ({phase:c.phase,sha256:c.loadedModelSha256,bytes:Number(c.loadedModelBytes)}));
        assert(actualDownloads.some(d => d.sha256 === manifest.sha256), 'Actual downloaded model must match candidate bytes');
        assert(actualDownloads.some(d => d.sha256 === manifest.sourceGlbSha256), 'Original comparison must be exact source');
        assert.deepEqual(errors, []);
        report.scenarios.push({ width: viewport.width, passed: true, controls: '5 views / day and dusk / keyboard rotate and Home / zoom / same-camera source switch',
            downloadedModels: actualDownloads, reducedMotion: viewport.width === 768, errors });
        await context.close(); activePage = undefined;
    }
    report.finalInputs = await inputs(); assert.deepEqual(report.initialInputs, report.finalInputs);
    assert.equal(sha(await readFile('tools/qa-landscape-art-viewer.mjs')), report.qaSha256); report.pass = true;
} catch (error) {
    report.errors.push(error.stack || String(error));
    if (activePage) await activePage.screenshot({ path: `${out}/first-failure.png` }).catch(() => {});
} finally {
    await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: report.pass, captures: report.captures.length, scenarios: report.scenarios.length, firstError: report.errors[0] }));
if (!report.pass) process.exitCode = 1;
