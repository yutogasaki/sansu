import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { runtimeMetadata, openGrowingMenu } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_NATIVE_ART_URL;
const out = process.env.SANSU_NATIVE_ART_OUTPUT;
const dist = process.env.SANSU_NATIVE_ART_DIST;
const reference = process.env.SANSU_NATIVE_ART_REFERENCE_URL;
const growthArt = process.env.SANSU_NATIVE_ART_GROWTH === 'true';
const artStates = {
    grown: { candidate: 'native-05-art-transfer-v1', meshes: 3690, triangles: 1396299,
        sha256: '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d' },
    ...(growthArt ? Object.fromEntries(await Promise.all(['small', 'young'].map(async state => [state,
        JSON.parse(await fs.readFile(`docs/design/2026-10-11-island-growth-art/${state}-manifest.json`, 'utf8'))]))) : {}),
};
assert(base && out && dist && reference, 'Specify the local art preview, fresh output, fixed dist and original viewer URL');
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local isolated QA only');
await fs.mkdir(out, { recursive: false });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function inputs() {
    const files = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public', dist], { encoding: 'utf8' }).trim().split('\n');
    files.push('vite.config.ts', 'package.json', 'package-lock.json', 'tools/e2e-native-island-art.mjs',
        'tools/island-e2e-helpers.mjs', 'docs/design/2026-10-10-island-final-3d/whole-island.glb',
        'docs/design/2026-10-10-native-art-transfer/runtime-manifest.json');
    if (growthArt) for (const state of ['small', 'young']) files.push(
        `docs/design/2026-10-11-island-growth-art/${state}-island.glb`,
        `docs/design/2026-10-11-island-growth-art/${state}-manifest.json`);
    return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, hash(await fs.readFile(file))])));
}
const report = { target: base, reference, scope: 'Completed-island art confirmation in the actual app; isolated real onboarding profiles; no ownership/growth completion claim',
    initialInputs: await inputs(), captures: [], scenarios: [], errors: [], pass: false };
const browser = await chromium.launch();
let activePage;
const ready = page => page.locator('[data-native-art-stage][data-loading="false"]').waitFor();
const growingReady = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
const owned = page => page.evaluate(async () => {
    const request = indexedDB.open('SansuGrowingIslandV1');
    const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
    try {
        return await Promise.all(['placedIslands', 'gifts', 'moments'].map(async name => {
            const get = db.transaction(name).objectStore(name).getAll();
            return [name, await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); })];
        }));
    } finally { db.close(); }
});
async function capture(page, file) {
    await page.screenshot({ path: `${out}/${file}` });
    const metadata = await runtimeMetadata(page);
    const stage = await page.locator('[data-native-art-stage]').evaluate(element => ({ ...element.dataset,
        bounds: element.getBoundingClientRect().toJSON() }));
    assert.equal(metadata.appRoot.islandFeatureEnabled, true);
    assert.equal(metadata.revision, report.version.revision);
    assert.equal(metadata.version, report.version.version);
    const expected = artStates[stage.artStage];
    assert(expected, `Unknown authored state: ${stage.artStage}`);
    assert.equal(stage.artCandidate, expected.candidate);
    assert.equal(stage.gameplayMapped, 'false');
    assert.equal(stage.sourceMeshes, String(expected.meshes));
    assert.equal(stage.sourceTriangles, String(expected.triangles));
    assert.equal(stage.modelSha256, expected.sha256);
    assert.equal(stage.loadedModelSha256, expected.sha256, 'Captured art must match the fetched GLB bytes');
    assert.equal(stage.renderedArtStage, stage.artStage);
    if (stage.artStage === 'grown') assert.equal(stage.materialBatches, '80');
    report.captures.push({ file, ...metadata, stage, cache: await page.evaluate(() => ({
        online: navigator.onLine, swControlled: Boolean(navigator.serviceWorker.controller),
    })) });
}
try {
    const probe = await browser.newPage();
    report.version = await (await probe.request.get(`${base}/version.json`)).json();
    assert.equal(report.version.island.nativeArtStudy.enabled, true);
    await probe.close();
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true,
            reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(60000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.stack || String(error)));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(`${base}/#/island`);
        await page.getByRole('button', { name: /^まなぶ/ }).first().tap();
        for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).tap();
        await growingReady(page);
        await page.goto(`${base}/?islandArt=native05#/island`); await ready(page);
        assert.equal(await page.locator('[data-growing-island]').count(), 0, 'Reference must not mount the player-owned world');
        const before = await owned(page);
        const controls = await page.locator('[data-native-art-study] button').evaluateAll(elements => elements.map(e => ({
            name: e.getAttribute('aria-label') || e.textContent, bounds: e.getBoundingClientRect().toJSON(),
        })));
        for (const control of controls) {
            assert(control.bounds.height >= 44 && control.bounds.width >= 44, `Small hit area: ${control.name}`);
            assert(control.bounds.x >= 0 && control.bounds.right <= viewport.width + 1, `Clipped control: ${control.name}`);
        }
        const views = [['whole', '島全体', 'whole'], ['grove', '森と大樹', 'grove'], ['spring', '段泉と丘', 'village'],
            ['harbor', '入り江', 'harbor'], ['garden', '花の庭', 'garden']];
        const sameCameras = [];
        for (const state of growthArt ? ['small', 'young', 'grown'] : ['grown']) {
            if (growthArt) {
                await page.getByRole('button', { name: { small: '小さな島', young: '育ち途中', grown: '育った島' }[state], exact: true }).tap();
                await ready(page);
                await page.waitForFunction(state => document.querySelector('[data-native-art-stage]')?.dataset.renderedArtStage === state, state);
                assert.equal(await page.locator('[data-native-art-stage] canvas').count(), 1, 'Switch must dispose its previous canvas');
                sameCameras.push(JSON.parse(await page.locator('[data-native-art-stage]').getAttribute('data-camera')));
            }
            for (const [view, label] of views) {
                await page.getByRole('button', { name: label, exact: true }).tap();
                for (const [light, label] of [['day', '昼'], ['evening', '夕']]) {
                    await page.getByRole('button', { name: label, exact: true }).tap();
                    await page.waitForFunction(({ view, light }) => {
                        const stage = document.querySelector('[data-native-art-stage]');
                        return stage?.dataset.renderedView === view && stage?.dataset.renderedLight === light;
                    }, { view, light });
                    await capture(page, `${viewport.width}-${growthArt ? `${state}-` : ''}${view}-${light}.png`);
                }
            }
        }
        if (growthArt) {
            assert.deepEqual(sameCameras[0], sameCameras[1], 'Growth comparison must keep its whole camera');
            assert.deepEqual(sameCameras[1], sameCameras[2], 'Mature whole camera must keep the same scale');
        }
        // Original and runtime use exactly the same camera and canvas crop for comparison.
        const original = await context.newPage(); await original.goto(reference);
        await original.locator('#stage[data-loading="false"][data-revision="8398eda9ac084a6e"]').waitFor();
        const stageBounds = await page.locator('[data-native-art-stage]').boundingBox();
        await original.setViewportSize({ width: Math.round(stageBounds.width),
            height: Math.round(stageBounds.height / (viewport.width <= 650 ? .72 : .78)) });
        // Match only the comparison canvas, not the production app CSS or original art files.
        await original.locator('#stage').evaluate((element, height) => { element.style.height = `${height}px`; element.style.minHeight = '0'; }, stageBounds.height);
        for (const [view, label, originalView] of views) {
            await page.getByRole('button', { name: label, exact: true }).tap();
            await page.getByRole('button', { name: '昼', exact: true }).tap();
            await original.locator(`button[data-view="${originalView}"]`).click();
            await original.locator('button[data-light="day"]').click();
            await page.waitForFunction(view => {
                const stage = document.querySelector('[data-native-art-stage]');
                return stage?.dataset.renderedView === view && stage?.dataset.renderedLight === 'day';
            }, view);
            await original.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const runtimeCamera = JSON.parse(await page.locator('[data-native-art-stage]').getAttribute('data-camera'));
            const originalCamera = JSON.parse(await original.locator('#stage').getAttribute('data-camera'));
            for (const key of ['position', 'target', 'frustum']) for (let i = 0; i < runtimeCamera[key].length; i++) {
                assert(Math.abs(runtimeCamera[key][i] - originalCamera[key][i]) < .001, `Comparison camera differs: ${view}/${key}`);
            }
            const sourceFile = `${viewport.width}-${view}-source-crop.png`, runtimeFile = `${viewport.width}-${view}-runtime-crop.png`;
            await original.locator('#stage').screenshot({ path: `${out}/${sourceFile}` });
            await page.locator('[data-native-art-stage]').screenshot({ path: `${out}/${runtimeFile}` });
            report.captures.push({ sourceFile, runtimeFile, view, light: 'day', runtimeCamera, originalCamera,
                canvasBounds: stageBounds, comparison: 'Matched actual canvas and camera; controls differ; no pixel-equality claim' });
        }
        await original.close();
        const canvas = page.locator('[data-native-art-stage] canvas');
        await canvas.press('+');
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-native-art-stage]').dataset.camera).zoom > 1);
        await canvas.press('Home');
        await page.getByRole('button', { name: '島全体', exact: true }).getAttribute('aria-pressed').then(value => assert.equal(value, 'true'));
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-native-art-stage]').dataset.camera).zoom === 1);
        assert.deepEqual(await owned(page), before, 'Art study must not alter ownership, growth, figures, gifts or moments');
        await page.getByRole('button', { name: 'いまの島へ', exact: true }).tap(); await growingReady(page);
        await page.screenshot({ path: `${out}/${viewport.width}-returned-owned-island.png` });
        await openGrowingMenu(page, { touch: true });
        await page.getByRole('button', { name: 'まなぶ', exact: true }).tap();
        await page.locator('[data-input-ready="true"]').waitFor();
        await page.screenshot({ path: `${out}/${viewport.width}-learning.png` });
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await growingReady(page);
        report.scenarios.push({ viewport, controls, ownershipUnchangedDuringArt: true, keyboard: true, growthArt, sameCameras,
            normalIslandAndLearningReturn: true, reducedMotion: viewport.width === 768, errors });
        report.errors.push(...errors);
        await context.close();
    }
    // Deliberate load failure and retry, on a new QA context and real onboarding.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = activePage = await context.newPage(); page.setDefaultTimeout(60000);
    await page.goto(`${base}/#/island`);
    await page.getByRole('button', { name: /^まなぶ/ }).first().click();
    for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).click();
    await growingReady(page);
    await page.route('**/*.glb', route => route.abort('failed'));
    await page.goto(`${base}/?islandArt=native05${growthArt ? '&artStage=young' : ''}#/island`);
    await page.getByRole('alert').filter({ hasText: '3Dを表示できませんでした。' }).waitFor();
    await page.screenshot({ path: `${out}/390-load-failure.png` });
    await page.unroute('**/*.glb'); await page.getByRole('button', { name: 'もう一度表示する', exact: true }).click(); await ready(page);
    await capture(page, '390-retry-ready.png');
    assert.equal(await page.locator('[data-native-art-stage] canvas').count(), 1, 'Retry must dispose the old renderer');
    const beforeLoss = await owned(page);
    await page.locator('[data-native-art-stage] canvas').evaluate(canvas => {
        const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
        if (!extension) throw Error('Context-loss fault cannot be exercised on this QA renderer');
        extension.loseContext();
    });
    await page.getByRole('alert').filter({ hasText: '3Dを表示できませんでした。' }).waitFor();
    await page.screenshot({ path: `${out}/390-context-loss.png` });
    await page.getByRole('button', { name: 'もう一度表示する', exact: true }).click(); await ready(page);
    await capture(page, '390-context-retry-ready.png');
    assert.equal(await page.locator('[data-native-art-stage] canvas').count(), 1);
    assert.deepEqual(await owned(page), beforeLoss);
    await context.close(); report.loadFailureRetry = true; report.contextLossRetry = true;
    report.finalInputs = await inputs(); assert.deepEqual(report.finalInputs, report.initialInputs, 'Tested inputs changed');
    assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) {
    report.error = error.stack || String(error);
    if (activePage && !activePage.isClosed()) {
        await activePage.screenshot({ path: `${out}/failed.png` }).catch(() => undefined);
        report.failedDom = await activePage.locator('body').innerText().catch(() => 'unavailable');
    }
    process.exitCode = 1;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
}
console.log(JSON.stringify({ pass: report.pass, captures: report.captures.length, scenarios: report.scenarios.length, error: report.error, out }));
