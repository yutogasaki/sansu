import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { digestFiles } from './verify-growing.mjs';

const base = process.env.SANSU_NATIVE_OWNED_URL, out = process.env.SANSU_NATIVE_OWNED_OUTPUT, build = process.env.SANSU_NATIVE_OWNED_BUILD;
assert(base && out && build, 'Specify a fixed local build, URL and fresh output directory');
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use an isolated local test origin');
const version = JSON.parse(await fs.readFile(path.join(build, 'version.json')));
assert.equal(version.island.nativeOwnedArt.enabled, true);
assert.deepEqual(await fetch(`${base}/version.json`).then(response => response.json()), version);
const kit = JSON.parse(await fs.readFile('docs/design/2026-10-11-native-owned-island/kit-manifest.json'));
const qaFiles = ['tools/e2e-native-owned-island.mjs', 'tools/island-e2e-helpers.mjs', 'tools/verify-growing.mjs'];
const initialQA = await digestFiles(process.cwd(), qaFiles);
await fs.mkdir(out, { recursive: false });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { target: base, version, browser: browser.version(), kit: { sha256: kit.sha256, sourceSha256: kit.sourceSha256, gzipSha256: kit.gzipSha256 }, scope: 'Disposable real-onboarding profiles; explicit corrupt asset and WebGL context loss. Service workers blocked only in this fault diagnostic; actual offline/update is a separate normal-SW run.', initialQA, scenarios: [], captures: [], pass: false };
let activePage;
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const world = await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
    assert.equal(world.artCandidate, 'native05-owned-runtime-v1'); assert.equal(world.nativeKitSha256, kit.sha256);
    assert.equal(await page.locator('[data-growing-world] canvas').count(), 1);
};
async function owned(page) {
    return page.evaluate(async () => {
        const req = indexedDB.open('SansuGrowingIslandV1');
        const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
        try { const get = db.transaction('placedIslands').objectStore('placedIslands').getAll();
            const rows = await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); });
            const { state, profileId, version, createdAt, migratedFrom } = rows[0];
            // Ordinary reload sync may advance the record revision/updatedAt and
            // natural clock. Compare rights and learning, not that clock metadata.
            return { profileId, version, createdAt, migratedFrom, state: { plots: state.plots, landmarks: state.landmarks,
                keepsakes: state.keepsakes, villagers: state.villagers, character: state.character,
                islandName: state.islandName, flagColor: state.flagColor, flagPattern: state.flagPattern, bridge: state.bridge,
                learned: state.learned, drops: state.drops, land: state.land, town: state.town } };
        } finally { db.close(); }
    });
}
async function capture(page, name) {
    const file = `${name}.png`; await page.screenshot({ path: path.join(out, file) });
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.appRoot.version, version.version); assert.equal(metadata.appRoot.revision, version.revision);
    const world = await page.locator('[data-growing-world]').count() ? await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset })) : undefined;
    report.captures.push({ file, metadata, world, owned: await owned(page) }); console.log(`Captured ${file}`);
}
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true,
            reducedMotion: width === 768 ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
        try {
            const page = activePage = await context.newPage(); page.setDefaultTimeout(45000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            let corrupt = true;
            await page.route('**/native05-owned-kit*.gz', route => corrupt ? route.fulfill({ status: 200, body: 'explicit corrupt QA asset', contentType: 'application/octet-stream' }) : route.continue());
            await page.goto(`${base}/#/island`); await page.getByRole('button', { name: /^まなぶ/ }).first().tap();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).tap();
            const retry = page.getByRole('button', { name: 'もういちど みる', exact: true }); await retry.waitFor();
            const before = await owned(page), learning = await readNative(page);
            await capture(page, `${width}-asset-rejected`);
            corrupt = false; await retry.tap(); await ready(page); await capture(page, `${width}-asset-retry-ready`);
            assert.deepEqual(await owned(page), before); assert.deepEqual(await readNative(page), learning);
            await page.locator('[data-growing-world] canvas').evaluate(canvas => {
                const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
                if (!extension) throw Error('Explicit context-loss fault cannot run'); extension.loseContext();
            });
            await retry.waitFor(); await capture(page, `${width}-context-lost`);
            await retry.tap(); await ready(page); await capture(page, `${width}-context-retry-ready`);
            assert.deepEqual(await owned(page), before); assert.deepEqual(await readNative(page), learning);
            await page.reload(); await ready(page); assert.deepEqual(await owned(page), before); assert.deepEqual(await readNative(page), learning);
            assert.deepEqual(errors, []);
            report.scenarios.push({ width, corruptAssetRejected: true, contextLossRetry: true, oneCanvas: true, ownedAndLearningUnchanged: true, errors, pass: true });
        } finally { await context.close(); }
    }
    report.finalQA = await digestFiles(process.cwd(), qaFiles); assert.deepEqual(report.finalQA, initialQA); report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, 'first-failure.png') }).catch(() => {});
} finally { await browser.close(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
