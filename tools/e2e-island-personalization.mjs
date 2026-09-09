import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, waitLearningReady } from './island-learning-checks.mjs';

if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false,
        photoContract: 'Open camera -> actual frame -> save metadata/PNG/thumbnail and one receipt -> explicit PNG export -> close camera',
        invariant: 'Only photo stores/receipt change; ordinary learning tables stay strict. Existing labelled world fixtures and showcase discovery allowances remain separate.',
        frameEvidence: 'Actual frame and exported PNG saved; every resized pixel and saved SHA-256 compared'
    }, null, 2)); process.exit(0);
}
const target = process.env.SANSU_PERSONALIZATION_URL || process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5372';
const out = process.env.SANSU_PERSONALIZATION_OUTPUT;
assert(out, 'Set a fresh SANSU_PERSONALIZATION_OUTPUT directory');
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = process.env.SANSU_ISLAND_BUILD_SOURCE ? JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE)) : undefined;
async function pathsUnder(root) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? pathsUnder(`${root}/${entry.name}`) : [`${root}/${entry.name}`]))).flat();
}
const qaFiles = ['tools/e2e-island-personalization.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const files = manifest?.files.map(file => file.path) ?? (await pathsUnder('src')).filter(file => !/\.(test|spec)\./.test(file));
const fingerprint = async () => Promise.all([...new Set([...files, ...qaFiles])].sort().map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const sourceStart = await fingerprint();
if (manifest) assert.deepEqual(manifest.files.filter(file => sourceStart.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
const report = { target, startedAt: new Date().toISOString(), humanN: 0, pass: false, fixedSource: Boolean(manifest),
    sourceHash: manifest?.sourceHash, sourceStart: sha(JSON.stringify(sourceStart)), qaStart: sourceStart.filter(file => qaFiles.includes(file.path)),
    evidence: 'Real empty-profile onboarding and normal reserved UI answers on two viewports. Personal names, geometric flag/outfits, real looped audio, named layout capture/preview/cancel/apply, later earned growth, showcase and downloaded actual-render PNG are inspected. One native IDB abort is a labelled save-failure diagnostic; no learning/world state fixtures. The parallel silent audio analyser measures digital output, not physical speakers. DEV runs are integration diagnostics, not frozen release or timing evidence.',
    timingEvidenceEligible: false, applicationDataInjected: false, captures: [], scenarios: [], errors: [] };
const browser = await chromium.launch();
report.browser = browser.version();
const panel = page => page.getByTestId('island-experience');
const stage = page => page.getByTestId('island-stage').first();
const slot = (page, id = 'slot-1') => panel(page).locator(`[data-layout-slot="${id}"]`);
const tap = (page, locator) => page.viewportSize().width === 390 ? locator.tap() : locator.click();
const learning = state => ({ plans: state.islandPlans, logs: state.logs, math: state.memoryMath, vocab: state.memoryVocab, explore: state.exploreRuns,
    completedSets: state.island.completedSets, pendingPlanId: state.island.pendingPlanId, pendingRewards: state.island.pendingRewards,
    growth: state.island.growth, points: state.island.customization?.points, owned: state.island.customization?.ownedItemIds, desired: state.island.customization?.desiredItemId });
async function allTables(page, includeIsland = true) {
    return page.evaluate(async includeIsland => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = [...database.objectStoreNames].filter(name => includeIsland || !['islands', 'islandEvents'].includes(name));
        const transaction = database.transaction(names, 'readonly');
        const result = await Promise.all(names.map(name => new Promise((resolve, reject) => {
            const get = transaction.objectStore(name).getAll(); get.onsuccess = () => resolve([name, get.result]); get.onerror = () => reject(get.error);
        })));
        database.close(); return Object.fromEntries(result);
    }, includeIsland);
}

async function capture(page, name) {
    const learningMode = await page.locator('.island-page').getAttribute('data-mode') === 'learning';
    if (!learningMode) await stage(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    const metadata = await runtimeMetadata(page);
    if (manifest) assert.equal(metadata.revision, manifest.revision);
    const rendered = await stage(page).evaluate(root => ({ personal: JSON.parse(root.dataset.personalScenery || 'null'),
        portrait: JSON.parse(root.dataset.residentPortrait || 'null'),
        residents: JSON.parse(root.dataset.residentStates || '[]'), geometryCount: +root.dataset.geometries, textures: +root.dataset.textures,
        items: JSON.parse(root.dataset.furnitureState || '[]'), theme: root.dataset.islandTheme, accent: root.dataset.islandAccent,
        canvasCount: document.querySelectorAll('[data-testid="island-stage"] canvas').length }));
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    // Learning intentionally hides the world. Keep its real screen screenshot
    // instead of manufacturing an offscreen scene capture.
    const sceneFile = learningMode ? undefined : `${name}-scene.png`;
    const sceneBytes = sceneFile ? await stage(page).screenshot({ path: `${out}/${sceneFile}`, animations: 'disabled' }) : undefined;
    report.captures.push({ file, sha256: sha(bytes), sceneFile, sceneSha256: sceneBytes ? sha(sceneBytes) : undefined, worldHiddenForLearning: learningMode, ...metadata, ...rendered });
    assert.equal(rendered.canvasCount, 1, 'Personalization reuses the one live scene');
    if (rendered.portrait) {
        const bounds = rendered.portrait.bounds;
        assert(bounds.left >= -.98 && bounds.right <= .98 && bounds.bottom >= -.98 && bounds.top <= .98, `Actual ${rendered.portrait.id} portrait must remain in frame: ${JSON.stringify(bounds)}`);
        assert(bounds.top - bounds.bottom >= .6, 'Actual portrait geometry must occupy at least 30% of the stage height');
    }
    return rendered;
}
async function finishSection(page, state) {
    const id = state.plan.id, count = state.island.completedSets;
    for (let step = 0; state.plan?.id === id; step++) { assert(step < 80); state = (await attempt(page, state)).after; }
    assert.equal(state.island.completedSets, count + 1); assert.equal(state.plan.cursor, 0);
    await waitMode(page, 'learning'); return state;
}
async function home(page) {
    if (await panel(page).count()) await tap(page, panel(page).getByRole('button', { name: 'なまえ・けしきから もどる', exact: true }));
    else await tap(page, button(page, 'しまへ'));
    await waitMode(page, 'home');
}
async function open(page) { await tap(page, button(page, 'しまづくり')); await waitMode(page, 'experience'); }
async function tab(page, name) { await tap(page, panel(page).getByRole('group', { name: 'かえたい もの' }).getByRole('button', { name, exact: true })); }
async function named(page, label, name) {
    const input = panel(page).getByLabel(label, { exact: true }); await input.fill(name);
    await tap(page, input.locator('xpath=ancestor::form').getByRole('button'));
}
async function saved(page, test) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { const state = await readNative(page); if (test(state.island)) return state; await page.waitForTimeout(60); }
    throw new Error('Expected native saved state was not observed');
}
async function waitActualAppearance(page, residentId, look) {
    await page.waitForFunction(({ residentId, look }) => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.residentStates || '[]')
        .some(resident => resident.species === residentId && resident.look === look), { residentId, look });
    await page.waitForFunction(residentId => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.residentPortrait || 'null')?.id === residentId, residentId);
}
async function geometry(page) {
    const result = await panel(page).evaluate(root => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        controls: [...root.querySelectorAll('button,input')].map(element => { const rect = element.getBoundingClientRect();
            return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height }; }) }));
    assert.equal(result.overflow, false); result.controls.forEach(control => assert(control.width >= 43.5 && control.height >= 43.5, JSON.stringify(control)));
    return result;
}

async function instrument(page) {
    await page.addInitScript(() => {
        const probe = window.__personalizationProbe = { voices: [], outputs: [], visibility: [], frames: [], downloads: 0 };
        const voices = new WeakMap();
        const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop, disconnect = AudioNode.prototype.disconnect, connect = AudioNode.prototype.connect;
        AudioBufferSourceNode.prototype.start = function (...args) {
            if (this.loop && this.buffer?.duration >= 5) {
                const values = this.buffer.getChannelData(0); let peak = 0, energy = 0;
                for (const value of values) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
                const entry = { index: probe.voices.length, startedAt: performance.now(), duration: this.buffer.duration, peak,
                    rms: Math.sqrt(energy / values.length), stopAt: null, disconnectAt: null };
                voices.set(this, entry); probe.voices.push(entry);
            }
            return start.apply(this, args);
        };
        AudioBufferSourceNode.prototype.stop = function (...args) { const voice = voices.get(this); if (voice) voice.stopAt = performance.now(); return stop.apply(this, args); };
        AudioNode.prototype.disconnect = function (...args) { const voice = voices.get(this); if (voice) voice.disconnectAt = performance.now(); return disconnect.apply(this, args); };
        AudioNode.prototype.connect = function (destination, ...args) {
            const result = connect.call(this, destination, ...args);
            if (destination === this.context.destination) {
                const analyser = this.context.createAnalyser(), silent = this.context.createGain(); silent.gain.value = 0;
                connect.call(this, analyser); connect.call(analyser, silent); connect.call(silent, destination);
                const entry = { peak: 0, lastPeak: 0, context: this.context.state, createdAt: performance.now(), closedAt: null }; probe.outputs.push(entry);
                const values = new Float32Array(analyser.fftSize), context = this.context;
                const sample = () => {
                    if (context.state === 'closed') { entry.closedAt = performance.now(); entry.lastPeak = 0; analyser.disconnect(); silent.disconnect(); return; }
                    analyser.getFloatTimeDomainData(values); entry.lastPeak = 0;
                    for (const value of values) { entry.lastPeak = Math.max(entry.lastPeak, Math.abs(value)); entry.peak = Math.max(entry.peak, Math.abs(value)); }
                    entry.context = context.state; requestAnimationFrame(sample);
                }; requestAnimationFrame(sample);
            }
            return result;
        };
        document.addEventListener('visibilitychange', () => probe.visibility.push({ at: performance.now(), state: document.visibilityState }));
        const encode = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (...args) {
            const data = encode.apply(this, args);
            if (this.closest('[data-testid="island-stage"]') && data.startsWith('data:image/png')) probe.frames.push({ data, width: this.width, height: this.height });
            return data;
        };
    });
}
async function audio(page) {
    return page.evaluate(() => { const probe = window.__personalizationProbe; return { voices: probe.voices, outputs: probe.outputs,
        active: probe.voices.filter(voice => voice.stopAt === null && voice.disconnectAt === null).length, visibility: probe.visibility }; });
}
async function waitAudio(page, active) {
    await page.waitForFunction(active => window.__personalizationProbe.voices.filter(voice => voice.stopAt === null && voice.disconnectAt === null).length === active, active);
    return audio(page);
}
async function toggleSoundThroughSettings(page, enabled) {
    await home(page); await tap(page, button(page, 'せってい'));
    await page.getByRole('button', { name: /みため と おと|表示とサウンド/ }).click();
    const row = page.getByText(/^(おと・BGM|サウンド)$/).locator('xpath=../..');
    const toggle = row.getByRole('button', { name: /^(ON|OFF)$/ });
    if ((await toggle.innerText()) !== (enabled ? 'ON' : 'OFF')) await tap(page, toggle);
    await page.waitForTimeout(150);
    assert.equal(await toggle.innerText(), enabled ? 'ON' : 'OFF');
    await tap(page, page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'しま', exact: true })); await waitPageReady(page);
    if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
    await waitMode(page, 'home'); await open(page);
}
async function photo(page, name, action, liveShowcase = false) {
    const captured = await saveAndExportPhoto(page, name, action, liveShowcase);
    const before = withoutPhotography(captured.before), after = withoutPhotography(captured.after), concurrentDiscoveryEvents = [];
    if (liveShowcase) {
        const omitIslandTables = tables => Object.fromEntries(Object.entries(tables).filter(([name]) => !['islands', 'islandEvents'].includes(name)));
        const stableIsland = island => { const copy = structuredClone(island); delete copy.revision; delete copy.updatedAt; if (copy.growth) delete copy.growth.discoveries; return copy; };
        assert.deepEqual(omitIslandTables(after), omitIslandTables(before), 'A showcase photograph preserves all non-island tables');
        assert.deepEqual(after.islands.map(stableIsland), before.islands.map(stableIsland), 'A showcase photograph preserves every island field except concurrent real discoveries and their revision');
        const oldEvents = new Map(before.islandEvents.map(event => [event.id, event]));
        assert.deepEqual(after.islandEvents.filter(event => oldEvents.has(event.id)), before.islandEvents);
        concurrentDiscoveryEvents.push(...after.islandEvents.filter(event => !oldEvents.has(event.id)));
        assert(concurrentDiscoveryEvents.every(event => event.type === 'discovery_observed'), 'Only independently observed living discoveries may save during a showcase photo');
        const discoveries = after.islands[0].growth?.discoveries ?? [], oldDiscoveries = before.islands[0].growth?.discoveries ?? [];
        const oldIds = new Set(oldDiscoveries.map(discovery => discovery.id));
        assert.deepEqual(discoveries.filter(discovery => oldIds.has(discovery.id)), oldDiscoveries);
        const added = discoveries.filter(discovery => !oldIds.has(discovery.id));
        assert.equal(added.length, concurrentDiscoveryEvents.length);
        assert(added.every(discovery => concurrentDiscoveryEvents.some(event => event.discoveryId === discovery.id && event.itemId === discovery.itemId)));
        assert.equal(after.islands[0].revision - before.islands[0].revision, concurrentDiscoveryEvents.length);
    } else assert.deepEqual(after, before, 'Photography preserves all non-photo rows');
    return { ...captured.evidence, concurrentDiscoveryEvents };
}

async function abortNextExperience(page) {
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, ...args) {
            if (this.name === 'islands' && value.experience?.islandName === 'ほぞんを ためす') {
                IDBObjectStore.prototype.put = put; this.transaction.abort();
            }
            return put.call(this, value, ...args);
        };
    });
}


async function waitPageReady(page) {
    await page.locator('.island-page[data-mode]').waitFor();
    if (await page.locator('.island-page[data-mode="learning"]').count()) {
        const state = await readNative(page); assert(state.plan, 'Learning keeps its ordinary reservation');
        await waitLearningReady(page, state.plan);
    } else await waitReady(page);
}
async function photoTables(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
            const names = [...database.objectStoreNames], transaction = database.transaction(names, 'readonly');
            const rows = Object.fromEntries(await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const get = transaction.objectStore(name).getAll(); get.onsuccess = () => resolve([name, get.result]); get.onerror = () => reject(get.error);
            }))));
            const hash = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
            rows.islandPhotoBlobs = await Promise.all(rows.islandPhotoBlobs.map(async row => ({ id: row.id, profileId: row.profileId,
                image: { mime: row.image.type, bytes: row.image.size, sha256: await hash(row.image) },
                thumbnail: { mime: row.thumbnail.type, bytes: row.thumbnail.size, sha256: await hash(row.thumbnail) } })));
            return rows;
        } finally { database.close(); }
    });
}
function withoutPhotography(rows) {
    return Object.fromEntries(Object.entries(rows).filter(([name]) => !['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs'].includes(name))
        .map(([name, entries]) => [name, name === 'islandEvents' ? entries.filter(event => event.type !== 'photo_changed') : entries]));
}
function assertOnePhotoSave(before, after) {
    const added = after.islandPhotos.filter(photo => !before.islandPhotos.some(old => old.id === photo.id)); assert.equal(added.length, 1);
    const photo = added[0], id = photo.id;
    assert.deepEqual(after.islandPhotos.filter(entry => entry.id !== id), before.islandPhotos, 'Existing photographs stay unchanged');
    assert.deepEqual(after.islandPhotoBlobs.filter(entry => entry.id !== id), before.islandPhotoBlobs, 'Existing PNG and thumbnail bytes stay unchanged');
    const blob = after.islandPhotoBlobs.find(entry => entry.id === id); assert(blob); assert.equal(blob.profileId, photo.profileId);
    for (const kind of ['image', 'thumbnail']) assert.deepEqual(blob[kind], { mime: photo[kind].mime, bytes: photo[kind].bytes, sha256: photo[kind].sha256 });
    assert.equal(after.islandPhotoBlobs.length, before.islandPhotoBlobs.length + 1);
    const revision = before.islandPhotoAlbums.find(album => album.profileId === photo.profileId)?.revision ?? 0;
    assert.deepEqual(after.islandPhotoAlbums.find(album => album.profileId === photo.profileId), { profileId: photo.profileId, version: 1, revision: revision + 1 });
    assert.deepEqual(after.islandPhotoAlbums.filter(album => album.profileId !== photo.profileId), before.islandPhotoAlbums.filter(album => album.profileId !== photo.profileId));
    const oldEvents = new Set(before.islandEvents.map(event => event.id));
    const receipts = after.islandEvents.filter(event => event.type === 'photo_changed' && !oldEvents.has(event.id)); assert.equal(receipts.length, 1);
    assert.deepEqual(after.islandEvents.filter(event => event.type === 'photo_changed' && oldEvents.has(event.id)), before.islandEvents.filter(event => event.type === 'photo_changed'));
    assert.equal(receipts[0].id, JSON.stringify(['island-photo:v1:operation', photo.profileId, revision]));
    assert.deepEqual(receipts[0].action, { type: 'save-photo', photo });
    assert.equal(receipts[0].photoReceipt.photoId, id); assert.equal(receipts[0].photoReceipt.albumRevision, revision); assert.equal(receipts[0].photoReceipt.result, 'saved');
    return { photo, receiptId: receipts[0].id };
}
async function installPhotoProbe(page) {
    await page.addInitScript(() => {
        window.__verifiedPhotoFrames = [];
        const original = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (...args) {
            const data = original.apply(this, args), root = this.closest('[data-testid="island-stage"]');
            if (root && data.startsWith('data:image/png')) window.__verifiedPhotoFrames.push({ data,
                observationFrame: JSON.parse(root.getAttribute('data-observation-frame') ?? 'null'),
                activity: JSON.parse(root.getAttribute('data-living-activity') ?? 'null') });
            return data;
        };
    });
}
async function saveAndExportPhoto(page, name, action, allowLiveDiscovery = false) {
    const before = await photoTables(page), origin = await page.locator('.island-page').getAttribute('data-mode');
    await page.evaluate(() => { window.__verifiedPhotoFrames = []; }); await action.click(); await waitMode(page, 'camera'); await waitPageReady(page);
    const camera = page.getByTestId('island-photo-camera');
    await camera.locator('[data-photo-action="capture"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'saved');
    await page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
    const saved = await photoTables(page), { photo, receiptId } = assertOnePhotoSave(before, saved);
    const pending = page.waitForEvent('download'); await camera.getByRole('button', { name: 'PNGで とりだす', exact: true }).click();
    const download = await pending, file = `${name}.png`; await download.saveAs(`${out}/${file}`);
    const bytes = await fs.readFile(`${out}/${file}`); assert.equal(sha(bytes), photo.image.sha256, 'Explicit export is the saved original PNG');
    const frames = await page.evaluate(() => window.__verifiedPhotoFrames); assert.equal(frames.length, 1, 'One shutter consumes exactly one actual frame');
    const frameFile = `${name}-frame.png`, frameBytes = Buffer.from(frames[0].data.split(',')[1], 'base64'); await fs.writeFile(`${out}/${frameFile}`, frameBytes);
    const pixels = await page.evaluate(async photoData => {
        const frame = window.__verifiedPhotoFrames[0], decode = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
        const [source, exported] = await Promise.all([decode(frame.data), decode(photoData)]);
        const canvas = document.createElement('canvas'); canvas.width = exported.width; canvas.height = exported.height;
        const context = canvas.getContext('2d'); context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
        context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(exported, 0, 0);
        const actual = context.getImageData(0, 0, canvas.width, canvas.height).data; let different = 0; const colors = new Set();
        for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) different++;
        for (let i = 0; i < expected.length; i += 68) colors.add(`${expected[i]},${expected[i + 1]},${expected[i + 2]}`);
        return { different, samples: actual.length, colors: colors.size, width: exported.width, height: exported.height, frameWidth: source.width, frameHeight: source.height };
    }, `data:image/png;base64,${bytes.toString('base64')}`);
    assert.equal(pixels.different, 0, 'Saved/exported pixels equal the actual frame at the allowed resize'); assert(pixels.colors > 50, 'Actual frame is not empty');
    assert.deepEqual(await photoTables(page), saved, 'PNG export starts no writer');
    await camera.getByRole('button', { name: 'カメラを とじる', exact: true }).click(); await waitMode(page, origin);
    const after = await photoTables(page); assertOnePhotoSave(before, after);
    if (!allowLiveDiscovery) assert.deepEqual(withoutPhotography(after), withoutPhotography(before), 'Photography preserves every ordinary learning and island table');
    return { before, after, evidence: { file, sha256: sha(bytes), bytes: bytes.length, frameFile, frameSha256: sha(frameBytes),
        photoId: photo.id, receiptId, suggestedFilename: download.suggestedFilename(), shutter: { observationFrame: frames[0].observationFrame, activity: frames[0].activity }, ...pixels } };
}

try {
    for (const layout of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, hasTouch: layout.width === 390,
            reducedMotion: layout.width === 768 ? 'reduce' : 'no-preference', serviceWorkers: manifest ? 'allow' : 'block', acceptDownloads: true });
        const page = await context.newPage(); page.setDefaultTimeout(15000); await instrument(page); await installPhotoProbe(page);
        const row = { name: layout.name, synthetic: false, captures: [], audio: [], photos: [], controls: [], pass: false, errors: [] };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await waitPageReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitMode(page, 'learning');
            let state = await finishSection(page, await readNative(page)); assert.equal(state.island.completedSets, 1); assert.equal(state.island.customization.points, 10);
            await home(page); await capture(page, `${layout.name}-01-before`); await open(page);
            const initial = await readNative(page), initialOtherTables = await allTables(page, false); row.runtime = await runtimeMetadata(page);
            await named(page, 'しまの なまえ', 'あいうえおかきくけこさしすせそた'); await saved(page, island => island.experience?.islandName === 'あいうえおかきくけこさしすせそた');
            await capture(page, `${layout.name}-02-long-name`);
            await named(page, 'しまの なまえ', 'ひかりの しま'); await saved(page, island => island.experience?.islandName === 'ひかりの しま');
            for (const emblem of ['star', 'flower', 'wave', 'leaf']) {
                await tap(page, panel(page).locator(`[data-emblem="${emblem}"]`)); await saved(page, island => island.experience?.emblem === emblem);
                await page.waitForFunction(emblem => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.personalScenery || 'null')?.emblem === emblem, emblem);
                if (emblem !== 'leaf') await capture(page, `${layout.name}-flag-${emblem}`);
            }
            const beforeInvalid = await readNative(page); await named(page, 'しまの なまえ', 'あ'.repeat(17));
            await panel(page).getByRole('alert').waitFor(); assert.deepEqual(await readNative(page), beforeInvalid);
            await named(page, 'しまの なまえ', 'ひかりの しま'); await page.waitForTimeout(120);
            row.controls.push(await geometry(page));
            await tab(page, 'なかま');
            for (const [residentId, label, name] of [['otter', 'カワウソ', 'かわちゃん'], ['rabbit', 'ウサギ', 'うーちゃん']]) {
                await tap(page, panel(page).locator(`[data-resident-id="${residentId}"]`)); await named(page, `${label}の よびなまえ`, name);
                await saved(page, island => island.experience?.residents[residentId].name === name);
                for (const look of ['scarf', 'cap', 'original', residentId === 'otter' ? 'scarf' : 'cap']) {
                    await tap(page, panel(page).locator(`[data-resident-look="${look}"]`)); await saved(page, island => island.experience?.residents[residentId].look === look);
                    await waitActualAppearance(page, residentId, look);
                    await capture(page, `${layout.name}-${residentId}-${look}-${report.captures.length}`);
                }
            }
            assert.deepEqual(learning(await readNative(page)), learning(initial));
            assert.deepEqual(await allTables(page, false), initialOtherTables, 'Identity changes preserve every non-island table, including profile mastery and progression');
            row.controls.push(await geometry(page));
            await tab(page, 'けしき'); await named(page, 'けしき 1の なまえ', 'はじめの にわ');
            state = await saved(page, island => island.experience?.layouts.length === 1); const remembered = structuredClone(state.island.experience.layouts[0]);
            await capture(page, `${layout.name}-03-layout-saved`); await home(page);
            await tap(page, button(page, 'もちもの')); await waitMode(page, 'inventory');
            await tap(page, page.getByRole('button', { name: 'ひかる おはな 1を うごかす', exact: true })); await waitMode(page, 'placement');
            await tap(page, button(page, 'いまは しまっておく')); await waitMode(page, 'home'); await open(page); await tab(page, 'けしき');
            await named(page, 'けしき 2の なまえ', 'ひろい にわ'); await saved(page, island => island.experience?.layouts.length === 2);
            const beforePreview = await readNative(page), previewTables = await allTables(page); assert.equal(beforePreview.island.items[0].position, undefined);
            await tap(page, slot(page).locator('[data-experience-action="preview-layout"]'));
            await panel(page).getByText('おためしの けしき', { exact: true }).waitFor(); await capture(page, `${layout.name}-04-layout-preview`);
            assert.deepEqual(await allTables(page), previewTables, 'Trying a layout does not write any table');
            await tap(page, slot(page).locator('[data-experience-action="preview-layout"]')); assert.deepEqual(await allTables(page), previewTables);
            await capture(page, `${layout.name}-05-layout-cancelled`);
            await tap(page, slot(page).locator('[data-experience-action="apply-layout"]'));
            state = await saved(page, island => Boolean(island.items[0].position));
            assert.deepEqual(state.island.items[0].position, remembered.poses[0].position); assert.deepEqual(learning(state), learning(beforePreview));
            await named(page, 'けしき 3の なまえ', 'あそぶ にわ'); await saved(page, island => island.experience?.layouts.length === 3);
            row.controls.push(await geometry(page)); await capture(page, `${layout.name}-06-layout-applied`);
            row.photos.push(await photo(page, `${layout.name}-photo-panel`, panel(page).getByRole('button', { name: 'しゃしんを とる', exact: true })));
            await tap(page, panel(page).getByRole('button', { name: 'しまを ながめる', exact: true })); await waitMode(page, 'showcase');
            assert.equal(await page.locator('.island-header').count(), 0); assert.equal(await panel(page).count(), 0);
            await capture(page, `${layout.name}-07-showcase`);
            row.photos.push(await photo(page, `${layout.name}-photo-showcase`, button(page, 'しゃしんに のこす'), true));
            await tap(page, button(page, 'けんがくを おわる')); await waitMode(page, 'experience');
            await toggleSoundThroughSettings(page, true);
            for (const ambience of ['breeze', 'brook', 'evening']) {
                await tap(page, panel(page).locator(`[data-ambience="${ambience}"]`)); await saved(page, island => island.experience?.ambience === ambience);
                await waitAudio(page, 1); await page.waitForTimeout(250); const actual = await audio(page);
                assert(actual.voices.at(-1).peak > 0 && actual.voices.at(-1).rms > 0);
                assert(actual.outputs.some(output => output.context === 'running' && output.lastPeak > .0001), 'The selected ambience reaches the live output now');
                row.audio.push({ mode: ambience, ...actual });
            }
            await capture(page, `${layout.name}-08-ambience`);
            await toggleSoundThroughSettings(page, false); await tap(page, panel(page).getByRole('button', { name: 'おとを きく', exact: true }));
            row.audio.push({ mode: 'device-sound-off', ...await waitAudio(page, 0) });
            await toggleSoundThroughSettings(page, true); await tap(page, panel(page).getByRole('button', { name: /おとを (きく|きいているよ)/ }));
            await waitAudio(page, 1); await home(page); await tap(page, page.locator('.island-start')); await waitMode(page, 'learning');
            row.audio.push({ mode: 'learning-stops-ambience', ...await waitAudio(page, 0) });
            state = await readNative(page); while (state.island.completedSets < 6) state = await finishSection(page, state);
            await capture(page, `${layout.name}-09-learning-grown`); await home(page); await open(page); await tab(page, 'なかま');
            await tap(page, panel(page).locator('[data-resident-id="fox"]')); await named(page, 'キツネの よびなまえ', 'こんちゃん');
            await saved(page, island => island.experience?.residents.fox.name === 'こんちゃん');
            for (const look of ['original', 'scarf', 'cap']) {
                await tap(page, panel(page).locator(`[data-resident-look="${look}"]`)); await saved(page, island => island.experience?.residents.fox.look === look);
                await waitActualAppearance(page, 'fox', look);
                await capture(page, look === 'cap' ? `${layout.name}-10-three-friends` : `${layout.name}-fox-${look}`);
            }
            await tab(page, 'けしき'); const grown = await readNative(page), grownOtherTables = await allTables(page, false);
            await tap(page, slot(page).locator('[data-experience-action="apply-layout"]')); state = await saved(page, island => island.revision > grown.island.revision);
            assert.deepEqual(learning(state), learning(grown)); assert.equal(state.island.items.length, 5);
            assert.deepEqual(await allTables(page, false), grownOtherTables, 'Applying an old layout preserves every non-island table after later learning');
            const oldIds = new Set(remembered.poses.map(pose => pose.id));
            assert.deepEqual(state.island.items.filter(item => !oldIds.has(item.id)), grown.island.items.filter(item => !oldIds.has(item.id)));
            await capture(page, `${layout.name}-11-old-layout-new-growth`);
            await tab(page, 'しま'); const beforeAbort = await allTables(page); await abortNextExperience(page);
            await named(page, 'しまの なまえ', 'ほぞんを ためす'); await panel(page).getByRole('alert').waitFor();
            assert.deepEqual(await allTables(page), beforeAbort, 'A native abort preserves every database table'); await capture(page, `${layout.name}-12-native-abort`);
            await named(page, 'しまの なまえ', 'ほぞんを ためす'); await saved(page, island => island.experience?.islandName === 'ほぞんを ためす');
            await named(page, 'しまの なまえ', 'ひかりの しま'); await saved(page, island => island.experience?.islandName === 'ひかりの しま');
            await home(page); await page.reload(); await waitPageReady(page);
            if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
            await open(page); state = await readNative(page);
            assert.equal(state.island.completedSets, 6); assert.equal(state.island.customization.points, 60); assert.equal(state.island.experience.layouts.length, 3);
            await capture(page, `${layout.name}-13-reloaded`);
            row.completedSets = state.island.completedSets; row.stars = state.island.customization.points; row.savedLayouts = state.island.experience.layouts.length;
            row.nativeAbortDiagnosticPassed = true; row.laterGrowthPreserved = true; row.allTableInvariance = true;
            assert.deepEqual(row.errors, []);
            row.pass = true;
        } catch (error) { row.error = { message: error.message, stack: error.stack }; await capture(page, `${layout.name}-failure`).catch(() => {}); throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
    await browser.close(); const end = await fingerprint(); report.sourceEnd = sha(JSON.stringify(end));
    report.sourceUnchanged = report.sourceStart === report.sourceEnd;
    report.changedFiles = end.filter(file => sourceStart.find(first => first.path === file.path)?.sha256 !== file.sha256).map(file => file.path);
    report.qaEnd = end.filter(file => qaFiles.includes(file.path));
    if (manifest && !report.sourceUnchanged) { report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const escape = value => String(value ?? 'not-applicable').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Island personalization — actual runtime</title><style>body{margin:24px;background:#f9f0d9;color:#173b40;font:14px system-ui}h1{font-size:24px}p{max-width:100ch;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0}img{width:100%;height:650px;object-fit:contain;object-position:top;background:#efdfb6}figcaption{line-height:1.5;overflow-wrap:anywhere}</style><h1>Island personalization / ${report.pass ? 'PASS' : 'INCOMPLETE / FAILED'}</h1><p>${escape(target)} · ${escape(report.startedAt)} · human N=0 · ${manifest ? 'Fixed source' : 'DEV integration diagnostic'} · timing evidence ineligible</p><p>${escape(report.evidence)}</p><p>Source start ${escape(report.sourceStart)} / end ${escape(report.sourceEnd)} · unchanged ${report.sourceUnchanged}. Visual appeal, child comprehension, and actual device audio remain separate review gates.</p><div class="grid">${report.captures.map(capture => `<figure><a href="${escape(capture.file)}"><img src="${escape(capture.file)}" alt="${escape(capture.file)}"></a><figcaption>${escape(capture.file)}<br>${escape(capture.viewport.width)}×${escape(capture.viewport.height)} · ${escape(capture.mode)} · ${escape(capture.revision)}<br>${escape(capture.delivery)} · ${escape(capture.candidate)}<br>SHA256 ${escape(capture.sha256)}</figcaption></figure>`).join('')}</div></html>`);
    console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.length, captures: report.captures.length, error: report.error?.message, out }));
}
