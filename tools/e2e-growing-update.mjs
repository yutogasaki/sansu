import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { digestFiles } from './verify-growing.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { plantProduction } from './growing-production-helpers.mjs';

// This driver owns only a disposable local origin. Build manifests identify the
// reviewed sources and dist bytes; it never deploys or opens a user's profile.
const names = ['OLD', 'NEW', 'ROLLBACK'];
const output = process.env.SANSU_GROWING_UPDATE_OUTPUT;
assert(output && names.every(name => process.env[`SANSU_GROWING_${name}_MANIFEST`]),
    'Specify OLD/NEW/ROLLBACK build manifests and a fresh SANSU_GROWING_UPDATE_OUTPUT');
const builds = {};
for (const name of names) {
    const manifest = JSON.parse(await fs.readFile(process.env[`SANSU_GROWING_${name}_MANIFEST`], 'utf8'));
    assert(path.isAbsolute(manifest.sourceDir) && path.isAbsolute(manifest.distDir), 'Use absolute local directories');
    assert(Object.keys(manifest.inputs).length && Object.keys(manifest.distFiles).length, 'Manifest must identify source and dist inputs');
    assert.deepEqual(await digestFiles(manifest.sourceDir, Object.keys(manifest.inputs)), manifest.inputs);
    assert.deepEqual(await digestFiles(manifest.distDir, Object.keys(manifest.distFiles)), manifest.distFiles);
    assert.equal(createHash('sha256').update(JSON.stringify(manifest.inputs)).digest('hex'), manifest.sourceHash);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(manifest.distDir, 'version.json'), 'utf8')), manifest.version);
    assert.equal(manifest.version.island.enabled, true);
    const html = await fs.readFile(path.join(manifest.distDir, 'index.html'), 'utf8');
    const bundle = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
    assert(bundle && manifest.distFiles[bundle.replace(/^\//, '')], 'Missing entry JS fingerprint');
    builds[name] = { ...manifest, bundle };
}
assert.equal(new Set(names.map(name => builds[name].version.version)).size, 3, 'Use three independent builds');
assert.equal(new Set(names.map(name => builds[name].bundle)).size, 3, 'Entry JS must change, not just version.json');
await fs.mkdir(output, { recursive: false });
let deployed = 'OLD', pinWorker = false;
const requests = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const selected = pinWorker && /^\/(sw\.js|workbox-[^/]+\.js)$/.test(name) ? 'OLD' : deployed;
    // Retain content-hashed assets of prior releases, like an atomic deployment.
    const candidates = name.startsWith('/assets/') ? [...new Set([selected, ...names])] : [selected];
    for (const build of candidates) {
        const root = builds[build].distDir, file = path.resolve(root, `.${name}`);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try {
            const bytes = await fs.readFile(file);
            requests.push({ path: url.pathname, build, marker: url.searchParams.get('__app-update') });
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(bytes); return;
        } catch (error) { if (error.code !== 'ENOENT') { res.writeHead(500).end(); return; } }
    }
    res.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch().catch(async error => {
    await new Promise(resolve => server.close(resolve));
    throw error;
});
const report = { target: base, builds, browser: browser.version(), scenarios: [], captures: [], pass: false,
    scope: 'Real onboarding/answers/ownership; real SW upgrade and safe-writer rollback on one disposable origin. Worker pin is an explicit network fault. No profile, credits, clock or update-event injection; not real-device or real-user evidence.' };
const qaFiles = ['tools/e2e-growing-update.mjs', 'tools/island-e2e-helpers.mjs', 'tools/growing-production-helpers.mjs', 'tools/verify-growing.mjs'];
const qaInputs = await digestFiles(process.cwd(), qaFiles);
const ready = async page => {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
};
const currentBundle = page => page.locator('script[type="module"][src]').first().getAttribute('src');
const growing = page => page.evaluate(async () => {
    const req = indexedDB.open('SansuGrowingIslandV1');
    const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
    try {
        const table = db.objectStoreNames.contains('guidedIslands') ? 'guidedIslands' : 'islands';
        const get = db.transaction(table).objectStore(table).getAll();
        const rows = await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); });
        return { table, schema: db.version, record: rows[0] };
    } finally { db.close(); }
});
async function until(page, predicate) {
    const deadline = Date.now() + 45000;
    do { const result = await predicate(); if (result) return result; await page.waitForTimeout(100); } while (Date.now() < deadline);
    throw Error('Persisted Growing condition timed out');
}
const untilGrowing = (page, count) => until(page, async () => (await growing(page)).record.state.learned.length === count);
function assertLearningKept(before, after) {
    for (const table of ['islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns'])
        assert.deepEqual(after[table], before[table], `Learning store changed: ${table}`);
    assert.equal(after.island.pendingPlanId, before.island.pendingPlanId);
}
function assertOwnershipKept(before, after) {
    assert.equal(after.profileId, before.profileId);
    assert.deepEqual(after.state.plots, before.state.plots);
    assert.deepEqual(after.state.villagers, before.state.villagers);
    assert.deepEqual(after.state.learned, before.state.learned);
    assert.equal(after.state.drops, before.state.drops);
    assert.equal(after.state.town.level, before.state.town.level);
}
async function capture(page, label, build) {
    const file = `${label}.png`;
    await page.screenshot({ path: path.join(output, file) });
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.appRoot.version, builds[build].version.version);
    assert.equal(metadata.appRoot.revision, builds[build].version.revision);
    report.captures.push({ file, ...metadata, growing: await growing(page) });
}
async function updateProbe(page) {
    await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) throw Error('Missing real SW registration');
        await registration.update();
    });
}
async function waitBuild(page, name) {
    await page.waitForFunction(bundle => document.querySelector('script[type="module"][src]')?.getAttribute('src') === bundle,
        builds[name].bundle, { timeout: 45000 });
    await ready(page);
    assert.equal(await currentBundle(page), builds[name].bundle);
}
try {
    for (const width of [390, 768]) for (const interrupted of [false, true]) {
        deployed = 'OLD'; pinWorker = false;
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true,
            serviceWorkers: 'allow', reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = [], reloads = []; page.on('pageerror', e => errors.push(e.message));
        page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()
            && new URL(req.url()).searchParams.has('__app-update')) reloads.push(req.url()); });
        const label = `${width}-${interrupted ? 'interrupted' : 'normal'}`;
        const scenario = { width, interrupted, pass: false }; report.scenarios.push(scenario);
        try {
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: /^まなぶ/ }).first().tap();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).tap();
            await ready(page); const id = (await readNative(page)).island.profileId;
            await plantProduction(page, 'home', { x: 1, z: 3 }, (await growing(page)).record.state);
            await until(page, async () => (await growing(page)).record.state.villagers.length === 1);
            await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
            let native = await readNative(page, id);
            while (native.logs.length < 4) native = (await answerUI(page, native.plan, { dev: false, touch: true })).state;
            const earnedCount = native.logs.length;
            await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
            await untilGrowing(page, earnedCount);
            await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
            await page.evaluate(() => navigator.serviceWorker.ready);
            await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
            const before = await readNative(page, id), reservation = { id: before.plan.id, cursor: before.plan.cursor };
            await capture(page, `${label}-old-learning`, 'OLD');
            await context.setOffline(true); pinWorker = interrupted; deployed = 'NEW';
            const drift = page.waitForResponse(r => r.url().includes('/version.json') && r.status() === 200);
            await context.setOffline(false); await drift; await updateProbe(page);
            if (interrupted) await context.setOffline(true);
            await page.waitForTimeout(5000);
            assert.equal(await currentBundle(page), builds.OLD.bundle, 'Learning must defer update');
            assert.equal(reloads.length, 0);
            assertLearningKept(before, await readNative(page, id));
            await page.getByRole('button', { name: 'とじる', exact: true }).tap();
            if (interrupted) {
                await ready(page); const cachesBefore = await page.evaluate(() => caches.keys());
                await page.reload(); await ready(page);
                assert.equal(await currentBundle(page), builds.OLD.bundle);
                assertLearningKept(before, await readNative(page, id));
                assert.deepEqual(await page.evaluate(() => caches.keys()), cachesBefore);
                await capture(page, `${label}-old-offline`, 'OLD');
                pinWorker = false; await context.setOffline(false); await updateProbe(page);
            }
            await waitBuild(page, 'NEW'); await untilGrowing(page, earnedCount);
            assert.equal(reloads.length, 1, 'One reload at the safe checkpoint');
            const migrated = await growing(page); scenario.earnedCount = earnedCount;
            assert.equal(migrated.table, 'guidedIslands'); assert.equal(migrated.record.version, 3);
            assertLearningKept(before, await readNative(page, id));
            const oldCapture = report.captures.find(c => c.file === `${label}-old-learning.png`).growing;
            assertOwnershipKept(oldCapture.record, migrated.record);
            await capture(page, `${label}-new-home`, 'NEW');
            await context.setOffline(true); await page.reload(); await ready(page);
            assertLearningKept(before, await readNative(page, id));
            await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
            const resumed = await readNative(page, id); assert.deepEqual({ id: resumed.plan.id, cursor: resumed.plan.cursor }, reservation);
            const added = (await answerUI(page, resumed.plan, { dev: false, touch: true })).state;
            assert.equal(added.logs.length, before.logs.length + 1);
            await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page); await untilGrowing(page, earnedCount + 1);
            const rollbackBefore = await readNative(page, id), ownershipBefore = (await growing(page)).record;
            deployed = 'ROLLBACK'; await context.setOffline(false); await updateProbe(page);
            await waitBuild(page, 'ROLLBACK'); assert.equal(reloads.length, 2);
            assertLearningKept(rollbackBefore, await readNative(page, id));
            assertOwnershipKept(ownershipBefore, (await growing(page)).record);
            await context.setOffline(true); await page.reload(); await ready(page);
            assertLearningKept(rollbackBefore, await readNative(page, id));
            await capture(page, `${label}-rollback-offline`, 'ROLLBACK');
            assert.deepEqual(errors, []); scenario.reservation = reservation; scenario.reloads = reloads;
            scenario.migration = { from: oldCapture.record.version, to: migrated.record.version };
            scenario.pass = true; console.log(`PASS ${label}: upgrade, learning/reservation retention, offline continuation, safe rollback`);
        } catch (error) {
            scenario.error = String(error.stack || error); scenario.url = page.url(); scenario.errors = errors;
            scenario.screen = await page.locator('body').innerText().catch(() => 'unavailable');
            await page.screenshot({ path: path.join(output, `${label}-failure.png`) }).catch(() => {}); throw error;
        } finally { await context.close(); }
    }
    for (const name of names) {
        assert.deepEqual(await digestFiles(builds[name].sourceDir, Object.keys(builds[name].inputs)), builds[name].inputs);
        assert.deepEqual(await digestFiles(builds[name].distDir, Object.keys(builds[name].distFiles)), builds[name].distFiles);
    }
    assert.deepEqual(await digestFiles(process.cwd(), qaFiles), qaInputs);
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
    report.cleanup = { browserClosed: !browser.isConnected(), serverClosed: !server.listening };
    report.requests = requests; report.qaInputs = qaInputs;
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
