import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { hash, loadDomain, ownedState, stableJSON, validatePack } from './growing-fixture-data.mjs';
import { readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { digestFiles } from './verify-growing.mjs';
import { CAPTURE_SCHEMA, captureConditions } from './growing-fixture-evidence.mjs';

export function parseOptions(args) {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        assert(['--url', '--build-dir', '--fixtures', '--output-dir'].includes(key) && args[i + 1] && !options[key], 'Specify --url --build-dir --fixtures --output-dir once each');
        options[key] = args[i + 1];
    }
    assert(Object.keys(options).length === 4, 'Specify --url --build-dir --fixtures --output-dir');
    const url = new URL(options['--url']);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Local loopback preview only');
    const build = path.resolve(options['--build-dir']), output = path.resolve(options['--output-dir']);
    const relative = path.relative(build, output);
    assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Keep evidence outside the build directory');
    return { base: url.origin, build, output, fixtures: path.resolve(options['--fixtures']) };
}

async function files(directory, prefix = '') {
    const result = [];
    for (const item of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
        const name = path.join(prefix, item.name);
        if (item.isDirectory()) result.push(...await files(directory, name));
        else { assert(item.isFile(), 'Build must contain regular files'); result.push(name); }
    }
    return result.sort();
}

async function ready(page) {
    await page.locator('[data-growing-island="ready"]').waitFor();
    await page.locator('[data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => { const box = document.querySelector('[data-growing-world] canvas')?.getBoundingClientRect(); return box && box.width > 0 && box.height > 0; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function islandRecord(page, profileId, value) {
    return page.evaluate(async ({ profileId, value }) => {
        const open = indexedDB.open('SansuGrowingIslandV1');
        const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            if (!database.objectStoreNames.contains('guidedIslands')) throw Error('Current Growing schema not initialized');
            const transaction = database.transaction('guidedIslands', value ? 'readwrite' : 'readonly');
            const done = new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error); });
            const request = value ? transaction.objectStore('guidedIslands').put(value) : transaction.objectStore('guidedIslands').get(profileId);
            const result = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            await done; return value ?? result;
        } finally { database.close(); }
    }, { profileId, value });
}

async function seedProfile(page, profile) {
    await page.evaluate(async profile => {
        const open = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const check = database.transaction('profiles').objectStore('profiles').count();
            const count = await new Promise((resolve, reject) => { check.onsuccess = () => resolve(check.result); check.onerror = () => reject(check.error); });
            if (count !== 0) throw Error('Refuse to seed a nonempty profile database');
            const transaction = database.transaction(['profiles', 'appData'], 'readwrite');
            const done = new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error); });
            transaction.objectStore('profiles').put(profile);
            transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
            await done; localStorage.setItem('sansu_active_profile', profile.id);
        } finally { database.close(); }
    }, profile);
}

export async function main(args = process.argv.slice(2)) {
    const options = parseOptions(args), loaded = await loadDomain();
    const fixtureBytes = await fs.readFile(options.fixtures), pack = validatePack(JSON.parse(fixtureBytes), loaded);
    const version = JSON.parse(await fs.readFile(path.join(options.build, 'version.json')));
    const served = await fetch(`${options.base}/version.json`, { signal: AbortSignal.timeout(5000) }).then(response => response.json());
    assert.deepEqual(served, version, 'Preview serves a different build');
    assert(typeof version.version === 'string' && version.version && typeof version.revision === 'string' && version.revision, 'Build identity required');
    assert.equal(version.island?.enabled, true); assert.equal(version.delivery, 'snap-root-v1');
    const buildFiles = await files(options.build), initialBuild = await digestFiles(options.build, buildFiles);
    const qaFiles = ['tools/e2e-growing-fixtures.mjs', 'tools/growing-fixture-data.mjs', 'tools/growing-fixture-evidence.mjs', 'tools/island-e2e-helpers.mjs', 'tools/verify-growing.mjs', 'package.json'];
    const initialQA = await digestFiles(process.cwd(), qaFiles);
    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.mkdir(options.output, { recursive: false });
    const report = { schema: CAPTURE_SCHEMA, conditions: captureConditions(pack), target: options.base, version, payloadHash: pack.payloadHash, sourceHash: pack.sourceHash,
        scope: 'Explicit synthetic Growing saves, fixed Date/Asia-Tokyo, fresh Chromium contexts. No earned learning, device/FPS, offline update or child evaluation.',
        fixtures: options.fixtures, initialBuild, initialQA, cases: [], pass: false,
        gates: { fixtureRuntime: 'NOT_EVALUATED', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED' } };
    const browser = await chromium.launch();
    try {
        for (const item of pack.cases) for (const width of [390, 768]) {
            const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, timezoneId: pack.timezone,
                reducedMotion: width === 768 ? 'reduce' : 'no-preference', hasTouch: true, deviceScaleFactor: 1 });
            const page = await context.newPage(), errors = [];
            page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
            try {
                await page.clock.setFixedTime(pack.epoch);
                await page.goto(`${options.base}/#/island`); await page.waitForURL('**/#/onboarding');
                assert.equal(new URL(page.url()).origin, options.base, 'Preview redirected outside loopback target');
                await seedProfile(page, item.profile);
                await page.goto(`${options.base}/#/island`); await ready(page);
                await islandRecord(page, item.profile.id, item.island);
                await page.reload(); await ready(page);
                const before = await islandRecord(page, item.profile.id), learning = await readNative(page, item.profile.id);
                assert.equal(stableJSON(ownedState(before.state)), stableJSON(ownedState(item.island.state)), 'Fixture changed while opening');
                await page.waitForTimeout(800);
                const file = `${item.id}-${width}.png`, imageHash = hash(await page.screenshot({ path: path.join(options.output, file) }));
                const metadata = await runtimeMetadata(page);
                assert.equal(metadata.version, version.version); assert.equal(metadata.revision, version.revision);
                assert.equal(metadata.appRoot.version, version.version); assert.equal(metadata.appRoot.islandFeatureEnabled, true);
                assert.equal(metadata.appRoot.revision, version.revision); assert.equal(metadata.islandFeatureEnabled, true);
                assert.equal(metadata.appRoot.natureTownFeatureEnabled, false); assert.equal(metadata.appRoot.configuredDelivery, 'snap-root-v1');
                assert.equal(await page.locator('[data-growing-world]').getAttribute('data-visual-candidate'), 'growing-island-v1');
                assert.equal(await page.locator('[data-growing-world]').getAttribute('data-growing-feature-enabled'), 'true');
                await page.reload(); await ready(page);
                const after = await islandRecord(page, item.profile.id);
                assert.equal(stableJSON(ownedState(after.state)), stableJSON(ownedState(before.state)), 'Fixture changed after reload');
                assert.equal(stableJSON(await readNative(page, item.profile.id)), stableJSON(learning), 'Learning stores changed while viewing fixture');
                assert.deepEqual(errors, []);
                const nativeFile = `${item.id}-${width}-native.json`;
                const nativeBytes = JSON.stringify({ before, after, learning }, null, 2), nativeHash = hash(nativeBytes);
                await fs.writeFile(path.join(options.output, nativeFile), nativeBytes);
                report.cases.push({ id: item.id, width, file, metadata, visualCandidate: 'growing-island-v1', payloadHash: pack.payloadHash,
                    nativeFile, imageHash, nativeHash, growingFeatureEnabled: true, objects: after.state.plots.length + after.state.landmarks.length, population: after.state.villagers.length, pass: true });
            } catch (error) {
                report.failure = { id: item.id, width, url: page.url(), error: String(error.stack || error), errors,
                    screen: await page.locator('body').innerText().catch(() => 'unavailable') };
                await page.screenshot({ path: path.join(options.output, `${item.id}-${width}-failure.png`) }).catch(() => {});
                throw error;
            } finally { await context.close(); }
        }
        assert.deepEqual(await digestFiles(options.build, await files(options.build)), initialBuild, 'Build changed during capture');
        assert.equal(hash(await fs.readFile(options.fixtures)), hash(fixtureBytes), 'Fixture pack changed during capture');
        assert.equal((await loadDomain()).sourceHash, loaded.sourceHash, 'Domain inputs changed during capture');
        assert.deepEqual(await digestFiles(process.cwd(), qaFiles), initialQA, 'QA inputs changed during capture');
        for (const item of report.cases) {
            assert.equal(hash(await fs.readFile(path.join(options.output, item.file))), item.imageHash, 'Capture image changed');
            assert.equal(hash(await fs.readFile(path.join(options.output, item.nativeFile))), item.nativeHash, 'Capture native evidence changed');
        }
        report.pass = true; report.gates.fixtureRuntime = 'PASS';
    } catch (error) {
        report.gates.fixtureRuntime = 'FAIL'; report.error = String(error.stack || error); throw error;
    } finally {
        await browser.close();
        await fs.writeFile(path.join(options.output, 'report.json'), JSON.stringify(report, null, 2));
        await fs.writeFile(path.join(options.output, 'contact-sheet.html'), `<!doctype html><meta charset="utf-8"><title>Explicit Growing QA fixtures</title><style>body{font-family:system-ui;background:#f5f6f8;color:#202530}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%;max-height:650px;object-fit:contain;background:white}figure{margin:0}code{overflow-wrap:anywhere}</style><h1>Explicit synthetic fixtures</h1><p>Fixed Date / Asia-Tokyo · visual/comprehension NOT EVALUATED</p><code>${pack.payloadHash}</code><main>${report.cases.map(item => `<figure><img src="${item.file}"><figcaption>${item.id} / ${item.width}px · ${item.population} residents · ${item.objects} objects</figcaption></figure>`).join('')}</main>`);
    }
    console.log(`PASS synthetic fixture restore/reload: ${report.cases.length} captures; ${options.output}/report.json`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    await main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
