import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Two independent Vite production builds, served atomically on one origin.
// No injected app update/navigation events and no mocked Service Workers.
assert.equal(Boolean(process.env.SANSU_PWA_OLD_DIR), Boolean(process.env.SANSU_PWA_NEW_DIR), 'Specify both build directories or neither');
let buildRoot;
if (!process.env.SANSU_PWA_OLD_DIR) {
    await mkdir('output', { recursive: true });
    buildRoot = await mkdtemp(resolve('output/pwa-two-build-'));
    const vite = fileURLToPath(new URL('bin/vite.js', import.meta.resolve('vite/package.json')));
    for (const name of ['old', 'new']) {
        await new Promise((resolveBuild, reject) => {
            const child = spawn(process.execPath, [vite, 'build', '--outDir', `${buildRoot}/${name}`], {
                stdio: 'inherit',
                env: { ...process.env, VITE_ISLAND_ENABLED: 'false', VITE_BUILD_PLAY_ENABLED: 'false' },
            });
            child.once('error', reject);
            child.once('exit', code => code === 0 ? resolveBuild() : reject(new Error(`${name} build failed: ${code}`)));
        });
    }
}
const oldDir = resolve(process.env.SANSU_PWA_OLD_DIR || `${buildRoot}/old`);
const newDir = resolve(process.env.SANSU_PWA_NEW_DIR || `${buildRoot}/new`);
const output = resolve(process.env.SANSU_PWA_TWO_BUILD_OUTPUT || (buildRoot ? `${buildRoot}/report` : 'output/playwright/pwa-two-build'));
const oldVersion = JSON.parse(await readFile(`${oldDir}/version.json`, 'utf8'));
const newVersion = JSON.parse(await readFile(`${newDir}/version.json`, 'utf8'));
assert.notEqual(oldVersion.version, newVersion.version, 'Build twice; copied/edited version.json is not a second build');
for (const manifest of [oldVersion, newVersion]) {
    assert.equal(manifest.island.enabled, false, 'Build with VITE_ISLAND_ENABLED=false');
    assert.equal(manifest.park.enabled, false, 'Build with VITE_BUILD_PLAY_ENABLED=false');
}
const modulePath = html => html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
const expectedOldBundle = modulePath(await readFile(`${oldDir}/index.html`, 'utf8'));
const expectedNewBundle = modulePath(await readFile(`${newDir}/index.html`, 'utf8'));
assert(expectedOldBundle && expectedNewBundle);
assert.notEqual(expectedOldBundle, expectedNewBundle, 'The app bundle must change along with version.json');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
let deployed = oldDir;
let pinOldWorker = false;
const requests = [];
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const root = pinOldWorker && /^\/(sw\.js|workbox-[^/]+\.js)$/.test(name) ? oldDir : deployed;
    const file = resolve(root, `.${name}`);
    if (!file.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
    try {
        const bytes = await readFile(file);
        requests.push({ path: url.pathname, marker: url.searchParams.get('__app-update'), root });
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(bytes);
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const report = { target: base, oldVersion, newVersion, browser: browser.version(), scenarios: [], pass: false };
const pause = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const contexts = [];
const bundle = page => page.locator('script[type="module"][src]').first().getAttribute('src');

async function stored(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolveDb, reject) => { open.onsuccess = () => resolveDb(open.result); open.onerror = () => reject(open.error); });
        try {
            const result = {};
            for (const table of db.objectStoreNames) {
                const request = db.transaction(table).objectStore(table).getAll();
                result[table] = await new Promise((resolveRows, reject) => { request.onsuccess = () => resolveRows(request.result); request.onerror = () => reject(request.error); });
            }
            return result;
        } finally { db.close(); }
    });
}

async function openOld() {
    const context = await browser.newContext({ serviceWorkers: 'allow', reducedMotion: 'reduce' });
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const navigations = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()
            && new URL(request.url()).searchParams.has('__app-update')) navigations.push(request.url());
    });
    await page.goto(`${base}/#/onboarding`);
    await page.getByRole('button', { name: 'たんけんを はじめる', exact: true }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await bundle(page), expectedOldBundle);
    return { context, page, navigations, errors, oldBundle: await bundle(page) };
}

async function beginProfile(page, name) {
    await page.getByRole('button', { name: 'たんけんを はじめる', exact: true }).click();
    await page.getByRole('textbox', { name: 'あだ名でOK' }).fill(name);
}
async function finishProfile(page) {
    await page.getByRole('button', { name: '次へ', exact: true }).click();
    await page.getByRole('button', { name: /小学 1 年生/ }).click();
    await page.getByRole('button', { name: /さんすう だけ/ }).click();
    await page.getByRole('button', { name: /足し算まで/ }).click();
    // Wait through the transient root redirect before the next navigation.
    await page.waitForURL(url => url.hash === '#/battle');
    await page.getByRole('button', { name: 'すぐ たんけんを はじめる', exact: true }).click();
    await page.waitForURL(url => url.hash === '#/explore');
    await page.getByRole('button', { name: '1', exact: true }).first().waitFor();
}
async function makeSafe(tab) {
    await beginProfile(tab.page, 'PWA保存確認');
    await finishProfile(tab.page);
    await tab.page.goto(`${base}/#/settings`);
    await tab.page.getByRole('button', { name: /プロフィール.*PWA保存確認/ }).waitFor();
    await tab.page.evaluate(() => localStorage.setItem('pwa-retention-probe', 'retain'));
    return stored(tab.page);
}
async function waitForNew(tab) {
    await tab.page.waitForFunction(old => document.querySelector('script[type="module"][src]')?.getAttribute('src') !== old,
        tab.oldBundle, { timeout: 30_000 });
    await tab.page.locator('.app-container').waitFor();
    assert.equal(await bundle(tab.page), expectedNewBundle);
}
async function reconnect(tab) {
    await tab.context.setOffline(false);
    await tab.page.bringToFront();
}

try {
    const safe = await openOld();
    const before = await makeSafe(safe);
    const protectedTab = await openOld();
    await beginProfile(protectedTab.page, '更新途中の入力');
    await safe.context.setOffline(true);
    await protectedTab.context.setOffline(true);
    deployed = newDir;
    await reconnect(safe);
    await reconnect(protectedTab);
    await waitForNew(safe);
    await protectedTab.page.waitForFunction(async () => {
        const response = await fetch('/sw.js');
        return response.ok && Boolean(navigator.serviceWorker.controller);
    });
    await pause(5000); // Negative assertion spans the real recovery timer.
    assert.equal(await bundle(protectedTab.page), protectedTab.oldBundle);
    assert.equal(await protectedTab.page.getByRole('textbox', { name: 'あだ名でOK' }).inputValue(), '更新途中の入力');
    assert.equal(protectedTab.navigations.length, 0);
    assert.deepEqual(await stored(safe.page), before);
    assert.equal(await safe.page.evaluate(() => localStorage.getItem('pwa-retention-probe')), 'retain');
    assert.equal(new URL(safe.page.url()).hash, '#/settings');
    await finishProfile(protectedTab.page);
    await waitForNew(protectedTab);
    await pause(5000);
    assert.equal((await stored(protectedTab.page)).profiles[0].name, '更新途中の入力');
    assert.equal(safe.navigations.length, 1);
    assert.equal(protectedTab.navigations.length, 1);
    assert.deepEqual([...safe.errors, ...protectedTab.errors], []);
    report.scenarios.push({ name: 'real worker old→new; protected form; stored data; one reload', pass: true });
    console.log('PASS real two-build SW update, protected form, persistence, one reload');
    await safe.context.close();
    await protectedTab.context.close();

    deployed = oldDir;
    pinOldWorker = true;
    const recovery = await openOld();
    const recoveryBefore = await makeSafe(recovery);
    const cacheNames = await recovery.page.evaluate(() => caches.keys());
    assert(cacheNames.some(name => name.includes('workbox-precache')));
    const versionResponse = recovery.page.waitForResponse(response => response.url().includes('/version.json')
        && response.status() === 200);
    await recovery.context.setOffline(true);
    deployed = newDir;
    await reconnect(recovery);
    await versionResponse;
    // Losing connectivity after drift detection used to delete the offline pack.
    await recovery.context.setOffline(true);
    await pause(5000);
    assert.equal(recovery.navigations.length, 0);
    assert.deepEqual(await recovery.page.evaluate(() => caches.keys()), cacheNames);
    await recovery.page.reload();
    await recovery.page.getByRole('button', { name: /プロフィール.*PWA保存確認/ }).waitFor();
    assert.equal(await bundle(recovery.page), recovery.oldBundle);
    assert.deepEqual(await stored(recovery.page), recoveryBefore);
    await reconnect(recovery);
    await waitForNew(recovery);
    await pause(5000);
    assert.equal(recovery.navigations.length, 1);
    assert.deepEqual(await stored(recovery.page), recoveryBefore);
    assert.equal(await recovery.page.evaluate(() => localStorage.getItem('pwa-retention-probe')), 'retain');
    assert.deepEqual(await recovery.page.evaluate(() => caches.keys()), cacheNames);
    assert(requests.some(request => request.marker === newVersion.version && request.root === newDir));
    assert.deepEqual(recovery.errors, []);
    report.scenarios.push({ name: 'stale SW; disconnect after detection; offline reload; network recovery; caches retained', pass: true });
    console.log('PASS stale-worker network recovery and offline/cache/data retention');
    report.pass = true;
} catch (error) {
    report.failure = String(error);
    report.pages = [];
    for (const context of browser.contexts()) {
        for (const page of context.pages()) {
            report.pages.push({ url: page.url(), text: await page.locator('body').innerText().catch(() => ''),
                scripts: await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src)).catch(() => []) });
        }
    }
    throw error;
} finally {
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
