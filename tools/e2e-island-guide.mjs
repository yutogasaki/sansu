import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
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
const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_GUIDE_OUTPUT;
assert(target && out, 'Set target and a fresh SANSU_ISLAND_GUIDE_OUTPUT directory');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = process.env.SANSU_ISLAND_BUILD_SOURCE
    ? JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE)) : undefined;
const sourceInputs = async () => manifest ? Promise.all(manifest.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) }))) : [];
const started = await sourceInputs();
if (manifest) assert.deepEqual(started, manifest.files.map(({ path, sha256 }) => ({ path, sha256 })));
const report = { target, source: manifest?.sourceHash ?? 'unfrozen-development-diagnostic', formal: Boolean(manifest),
    startedAt: new Date().toISOString(), humanN: 0, pass: false, captures: [], scenarios: [],
    scope: 'Real empty-database onboarding, three normal answered garden sections, readonly discovery guide and next-growth preview, real observation/replay, actual frame photo, no repeated download after scene remount, same reserved learning resumes. No maturity/learning fixture.' };
const browser = await chromium.launch();
const stage = page => page.locator('[data-testid="island-stage"]').first();
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
async function capture(page, name) {
    if (await page.locator('.island-page').getAttribute('data-mode') !== 'learning') await stage(page).scrollIntoViewIfNeeded();
    const metadata = await runtimeMetadata(page);
    if (manifest) assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, image = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata,
        experienceCandidate: await page.locator('.island-stage').first().getAttribute('data-experience-candidate') });
}
async function selectDiscovery(page, id) {
    await page.locator(`.island-guide-index [data-discovery-id="${id}"]`).click();
    await page.locator(`[data-guide-id="${id}"]`).waitFor();
}
async function finish(page, state) {
    const previous = state.island.completedSets, id = state.plan.id;
    for (let count = 0; state.plan?.id === id; count++) {
        assert(count < 80, 'Normal section must finish');
        state = (await attempt(page, state)).after;
    }
    assert.equal(state.island.completedSets, previous + 1);
    assert.equal(state.island.pendingRewards.length, 0);
    await waitMode(page, 'learning');
    return state;
}
async function openGuide(page) {
    await idle(page); await button(page, 'みつける').click(); await waitMode(page, 'guide'); await idle(page);
}
async function controls(page) {
    const measured = await page.locator('.island-field-guide').evaluate(root => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        controls: [...root.querySelectorAll('button')].map(button => { const r = button.getBoundingClientRect(); return { text: button.textContent.trim(), width: r.width, height: r.height }; }) }));
    assert(!measured.overflow, 'Guide must not cause horizontal overflow');
    for (const control of measured.controls) assert(control.width >= 44 && control.height >= 44, JSON.stringify(control));
    return measured;
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
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block',
            reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference', acceptDownloads: true });
        const page = await context.newPage(), errors = [], downloads = []; await installPhotoProbe(page);
        page.on('pageerror', error => errors.push(error.message)); page.on('download', download => downloads.push(download.suggestedFilename()));
        try {
            await page.goto(`${target}/#/island`); await waitPageReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitPageReady(page); await waitMode(page, 'learning');
            let state = await readNative(page), profileId = state.island.profileId;
            state = await finish(page, state);
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await openGuide(page);
            const beforeGuide = await readNative(page, profileId);
            await selectDiscovery(page, 'butterfly-visit');
            assert.equal(await page.locator('[data-guide-id]').getAttribute('data-guide-status'), 'grow');
            await button(page, 'てがかり').click(); await capture(page, `${layout.name}-01-unseen-hint`);
            const geometry = await controls(page);
            assert.deepEqual(await readNative(page, profileId), beforeGuide, 'Guide/hint reads cannot grant a discovery or reward');
            await button(page, '育つ すがたを みる').click(); await waitMode(page, 'growth');
            await page.locator('.island-growth-preview-notice').waitFor();
            await capture(page, `${layout.name}-02-next-real-growth`);
            const previewCamera = await stage(page).getAttribute('data-camera-frame');
            assert.deepEqual(await readNative(page, profileId), beforeGuide, 'Next-stage preview cannot mutate a reservation, unlock, wallet or discovery');
            await button(page, 'いまの すがたへ').click();
            await page.locator('.island-growth-preview-notice').waitFor({ state: 'hidden' });
            await capture(page, `${layout.name}-03-current-growth`);
            assert.equal(await stage(page).getAttribute('data-camera-frame'), previewCamera, 'Current and next growth use the same close framing');
            assert.deepEqual(await readNative(page, profileId), beforeGuide);
            await button(page, 'ばしょえらびを とじる').click(); await waitMode(page, 'home');
            await openGuide(page); await button(page, 'みずべ').click(); await selectDiscovery(page, 'leaf-boat');
            assert.match(await page.locator('.island-guide-story').innerText(), /しまが ひろがる/);
            assert.equal(await button(page, '育つ すがたを みる').count(), 0, 'Locked land cannot promise an unavailable real preview');
            await button(page, 'みつけものを とじる').click(); await waitMode(page, 'home');
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            state = await readNative(page, profileId);
            assert.deepEqual(state.plan, beforeGuide.plan, 'Optional reading returns to the same reserved question');
            for (let sections = 0; state.island.growth.progress.garden < 3; sections++) {
                assert(sections < 6, 'Whole-problem effort reaches the butterfly stage');
                state = await finish(page, state);
            }
            assert.equal(state.island.growth.progress.garden, 3);
            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await openGuide(page);
            await selectDiscovery(page, 'butterfly-visit');
            assert.equal(await page.locator('[data-guide-id]').getAttribute('data-guide-status'), 'try');
            const beforeObservation = await readNative(page, profileId);
            await page.locator('.island-guide-actions .island-primary').click(); await waitMode(page, 'play');
            await page.waitForFunction(() => {
                const life = JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-living-activity') || 'null');
                return life?.discoveryId === 'butterfly-visit' && life.arrivedAt > 0 && life.natureReady;
            }, undefined, { timeout: 30000 });
            await capture(page, `${layout.name}-04-observed-butterfly`); await idle(page);
            state = await readNative(page, profileId);
            assert(state.island.growth.discoveries.some(entry => entry.id === 'butterfly-visit'));
            assert.deepEqual(state.plan, beforeObservation.plan);
            assert.deepEqual(state.island.customization, beforeObservation.island.customization);
            const afterObservation = state;
            const photo = await saveAndExportPhoto(page, `${layout.name}-05-observed-photo`, button(page, 'いまを しゃしんに'));
            assert.equal(photo.evidence.shutter.observationFrame?.discoveryId, 'butterfly-visit', 'Current-camera keeps the observed butterfly framing');
            const afterPhoto = await readNative(page, profileId);
            await button(page, 'みつけものを みる').click(); await waitMode(page, 'guide');
            await selectDiscovery(page, 'butterfly-visit'); await button(page, 'もういちど ためす').click(); await waitMode(page, 'play');
            await page.waitForFunction(() => {
                const life = JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-living-activity') || 'null');
                return life?.discoveryId === 'butterfly-visit' && life.natureReady;
            }, undefined, { timeout: 30000 });
            await capture(page, `${layout.name}-06-replay`); await idle(page);
            assert.deepEqual(await readNative(page, profileId), afterPhoto, 'Recorded discovery replay grants no duplicate rewards/observations');
            assert.deepEqual(await photoTables(page), photo.after, 'Replay/remount creates no additional photos or receipts');
            await button(page, 'あそびを とじる').click(); await waitMode(page, 'home');
            await idle(page); await button(page, 'アルバム').click(); await waitMode(page, 'album');
            await button(page, 'アルバムを とじる').click(); await waitMode(page, 'home'); await waitPageReady(page);
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            assert.deepEqual((await readNative(page, profileId)).plan, afterObservation.plan);
            state = (await attempt(page, await readNative(page, profileId))).after;
            assert.equal(downloads.length, 1, 'Remounting the stage cannot dispatch a second photo download');
            assert.deepEqual(errors, []);
            await capture(page, `${layout.name}-07-same-learning-resumed`);
            report.scenarios.push({ name: layout.name, pass: true, fixture: false, earnedSections: 3, geometry,
                discoveryAlreadyObservedOnEntry: beforeObservation.island.growth.discoveries.some(entry => entry.id === 'butterfly-visit'),
                photos: downloads, photoEvidence: photo.evidence, resumedPlanId: state.plan.id });
            console.log(`PASS ${layout.name}: earned growth, guide, real preview, observation/replay, photo/remount, learning`);
        } catch (error) {
            await capture(page, `${layout.name}-failure`).catch(() => {});
            await fs.writeFile(`${out}/${layout.name}-failure-native.json`, JSON.stringify(await readNative(page).catch(() => null), null, 2));
            report.errors = errors; throw error;
        } finally { await context.close(); }
    }
    if (manifest) assert.deepEqual(await sourceInputs(), started, 'Frozen app source changed during verification');
    report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
