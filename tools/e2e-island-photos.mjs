import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL, out = process.env.SANSU_ISLAND_PHOTOS_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set a frozen target, fresh output, and build source manifest');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qa = ['tools/e2e-island-photos.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs'];
const fingerprint = async () => Promise.all([...manifest.files.map(file => file.path), ...qa].map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const original = await fingerprint();
assert.deepEqual(original.slice(0, manifest.files.length), manifest.files.map(({ path, sha256 }) => ({ path, sha256 })));
await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, captures: [], layouts: [],
    scope: 'Empty DB, real first learning section, actual world/portrait/inlet frames, PNG pixel comparison, bounded album, explicit deletion, cancelled conversion, actual service-worker offline and separate profile. Delayed PNG encoding is an explicit driver fault, not a performance measurement.' };
const browser = await chromium.launch();
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const camera = page => page.getByTestId('island-photo-camera');
const gallery = page => page.getByTestId('island-photo-gallery');
async function capture(page, name) {
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata });
}
async function tables(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
            return Object.fromEntries(await Promise.all([...database.objectStoreNames].map(async name => {
                const read = database.transaction(name).objectStore(name).getAll();
                const values = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
                if (name === 'islandPhotoBlobs') return [name, await Promise.all(values.map(async row => {
                    const digest = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
                    return { id: row.id, profileId: row.profileId, imageBytes: row.image.size, thumbnailBytes: row.thumbnail.size,
                        imageSha: await digest(row.image), thumbnailSha: await digest(row.thumbnail) };
                }))];
                return [name, values];
            })));
        } finally { database.close(); }
    });
}
function untouched(before, after) {
    for (const name of Object.keys(before)) {
        if (['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs'].includes(name)) continue;
        const withoutPhotos = rows => name === 'islandEvents' ? rows.filter(event => event.type !== 'photo_changed') : rows;
        assert.deepEqual(withoutPhotos(after[name]), withoutPhotos(before[name]), `${name} changed during optional photography`);
    }
}
async function openGallery(page) {
    await button(page, 'アルバム').click(); await waitMode(page, 'album');
    await button(page, 'しゃしん').click(); await waitMode(page, 'photos');
    await gallery(page).locator('.island-photo-empty, .island-photo-card').first().waitFor();
}
async function shoot(page) {
    await camera(page).locator('[data-photo-action="capture"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'saved');
    await idle(page);
}
async function comparePixels(page, photoId) {
    return page.evaluate(async photoId => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
        const read = database.transaction('islandPhotoBlobs').objectStore('islandPhotoBlobs').get(photoId);
        const stored = await new Promise(resolve => { read.onsuccess = () => resolve(read.result); }); database.close();
        const url = URL.createObjectURL(stored.image), source = new Image(), photo = new Image();
        try {
            source.src = window.__photoProbe.frames.at(-1); photo.src = url;
            await Promise.all([source.decode(), photo.decode()]);
            const canvas = document.createElement('canvas'); canvas.width = photo.width; canvas.height = photo.height;
            const context = canvas.getContext('2d'); context.drawImage(source, 0, 0, photo.width, photo.height);
            const expected = context.getImageData(0, 0, photo.width, photo.height).data;
            context.clearRect(0, 0, photo.width, photo.height); context.drawImage(photo, 0, 0);
            const actual = context.getImageData(0, 0, photo.width, photo.height).data;
            let different = 0; for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) different++;
            return { width: photo.width, height: photo.height, different, samples: actual.length };
        } finally { URL.revokeObjectURL(url); }
    }, photoId);
}
try {
    for (const name of ['phone', 'tablet']) {
        const touch = name === 'phone';
        const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 768, height: 1024 },
            hasTouch: touch, reducedMotion: touch ? 'no-preference' : 'reduce', serviceWorkers: 'allow', acceptDownloads: true });
        const page = await context.newPage(), row = { name, pass: false, checks: [], errors: [] }; report.layouts.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        await page.addInitScript(() => {
            window.__photoProbe = { frames: [], held: [], delayNext: false };
            const toDataURL = HTMLCanvasElement.prototype.toDataURL, toBlob = HTMLCanvasElement.prototype.toBlob;
            HTMLCanvasElement.prototype.toDataURL = function (...args) {
                const result = toDataURL.apply(this, args);
                if (this.closest('[data-testid="island-stage"]')) window.__photoProbe.frames.push(result);
                return result;
            };
            HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
                const delay = window.__photoProbe.delayNext; window.__photoProbe.delayNext = false;
                return toBlob.call(this, blob => delay ? window.__photoProbe.held.push(() => callback(blob)) : callback(blob), ...args);
            };
        });
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitMode(page, 'learning');
            let native = await readNative(page); const firstPlan = native.plan.id, owner = native.plan.profileId;
            for (let count = 0; native.plan.id === firstPlan; count++) { assert(count < 80); native = (await answerUI(page, native.plan, { touch, dev: false })).state; }
            assert.equal(native.island.completedSets, 1);
            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await openGallery(page);
            assert.equal(await gallery(page).locator('.island-photo-card').count(), 0);
            await gallery(page).getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera'); await waitReady(page); await idle(page);
            const baseline = await tables(page);
            await shoot(page); let saved = await tables(page); assert.equal(saved.islandPhotos.length, 1); untouched(baseline, saved);
            const fullFrame = (await page.getByTestId('island-stage').getAttribute('data-camera-frame')).split(',').map(Number);
            const first = saved.islandPhotos[0], firstBlob = saved.islandPhotoBlobs[0];
            row.firstPixels = await comparePixels(page, first.id); assert.equal(row.firstPixels.different, 0);
            await capture(page, `${name}-01-island-photo`);
            await camera(page).getByRole('button', { name: 'カワウソ', exact: true }).click(); await shoot(page);
            const portraitFrame = (await page.getByTestId('island-stage').getAttribute('data-camera-frame')).split(',').map(Number);
            assert(portraitFrame[16] > fullFrame[16] * 1.5, 'Choosing a resident must produce a real close view, not simply another full-island frame');
            row.camera = { fullFrame, portraitFrame };
            saved = await tables(page); assert.equal(saved.islandPhotos.length, 2); untouched(baseline, saved);
            const portrait = saved.islandPhotos.find(photo => photo.composition === 'resident'); assert(portrait);
            row.portraitPixels = await comparePixels(page, portrait.id); assert.equal(row.portraitPixels.different, 0);
            assert.notEqual(portrait.image.sha256, first.image.sha256);
            await capture(page, `${name}-02-resident-photo`);
            const pendingDownload = page.waitForEvent('download'); await camera(page).getByRole('button', { name: 'PNGで とりだす', exact: true }).click();
            const download = await pendingDownload; await download.saveAs(`${out}/${name}-download.png`);
            assert.equal(sha(await fs.readFile(`${out}/${name}-download.png`)), portrait.image.sha256);
            row.checks.push('real island and portrait frames retain every decoded pixel; export equals saved PNG');

            await camera(page).getByRole('button', { name: 'しゃしんを みる', exact: true }).click(); await waitMode(page, 'photos');
            await gallery(page).locator('.island-photo-card').first().click(); await gallery(page).locator('.island-photo-detail img').waitFor();
            await capture(page, `${name}-03-gallery-detail`);
            await gallery(page).getByRole('button', { name: 'しゃしんの アルバムを とじる', exact: true }).click(); await waitMode(page, 'home');
            await button(page, 'おためしの いりえ').click(); await waitMode(page, 'workshop');
            for (const composition of ['specimen', 'work']) {
                if (composition === 'work') await button(page, 'つくる').click();
                await page.locator('.island-workshop').getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera');
                assert.equal(JSON.parse(await page.getByTestId('island-stage').getAttribute('data-workshop')).active, true, 'Inlet camera must render the inlet, not the main island');
                await shoot(page); saved = await tables(page);
                const inlet = saved.islandPhotos.find(photo => photo.composition === composition); assert(inlet);
                assert.equal((await comparePixels(page, inlet.id)).different, 0);
                await capture(page, `${name}-inlet-${composition}`);
                await camera(page).getByRole('button', { name: 'カメラを とじる', exact: true }).click(); await waitMode(page, 'workshop');
            }
            row.checks.push('specimen/work camera keeps the actual inlet visible and saves that exact frame');
            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await openGallery(page);
            await gallery(page).getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera'); await waitReady(page);
            // Driver-only delayed PNG callback tests cancellation while actual encoding finishes.
            const beforeCancel = await tables(page);
            await page.evaluate(() => { window.__photoProbe.delayNext = true; });
            await camera(page).locator('[data-photo-action="capture"]').click();
            await page.waitForFunction(() => window.__photoProbe.held.length === 1);
            await camera(page).getByRole('button', { name: 'まなぶ', exact: true }).click(); await waitMode(page, 'learning');
            await page.evaluate(() => { for (const finish of window.__photoProbe.held.splice(0)) finish(); });
            await page.waitForTimeout(200); assert.deepEqual(await tables(page), beforeCancel);
            native = await readNative(page, owner); assert.equal(native.plan.id, baseline.islands[0].pendingPlanId);
            await answerUI(page, native.plan, { touch, dev: false });
            row.checks.push('delayed actual PNG conversion is cancelled by learning; same reserved input still answers');

            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, 'しまづくり').click(); await waitMode(page, 'experience');
            await page.getByLabel('しまの なまえ', { exact: true }).fill('しゃしんの しま');
            await page.getByTestId('island-experience').locator('form').first().getByRole('button', { name: 'なまえを つける', exact: true }).click(); await idle(page);
            await page.getByTestId('island-experience').getByRole('button', { name: 'しまへ もどる', exact: true }).click(); await waitMode(page, 'home');
            await openGallery(page); saved = await tables(page);
            assert.deepEqual(saved.islandPhotos.find(photo => photo.id === first.id), first);
            assert.deepEqual(saved.islandPhotoBlobs.find(photo => photo.id === first.id), firstBlob);
            await capture(page, `${name}-04-old-photo-after-name-change`);
            await gallery(page).getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera'); await waitReady(page);
            const beforeMany = await tables(page);
            for (let i = 4; i < 12; i++) await shoot(page);
            saved = await tables(page); assert.equal(saved.islandPhotos.length, 12); untouched(beforeMany, saved);
            const full = saved;
            await camera(page).locator('[data-photo-action="capture"]').click();
            await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'error');
            await camera(page).getByText(/しゃしんが いっぱい/).waitFor(); assert.deepEqual(await tables(page), full);
            await capture(page, `${name}-05-full-keeps-every-photo`);
            await camera(page).getByRole('button', { name: 'しゃしんを みる', exact: true }).click(); await waitMode(page, 'photos');
            await gallery(page).locator('.island-photo-card').first().click();
            const removing = await gallery(page).locator('.island-photo-detail').getAttribute('data-photo-id');
            await gallery(page).getByRole('button', { name: 'この しゃしんを はずす', exact: true }).click();
            await gallery(page).locator('.island-photo-delete').getByRole('button', { name: 'のこしておく', exact: true }).click(); assert.deepEqual(await tables(page), full);
            await gallery(page).getByRole('button', { name: 'この しゃしんを はずす', exact: true }).click();
            await gallery(page).locator('.island-photo-delete').getByRole('button', { name: 'はずす', exact: true }).click(); await idle(page);
            await page.waitForFunction(() => document.querySelectorAll('.island-photo-card').length === 11);
            saved = await tables(page); assert.equal(saved.islandPhotos.length, 11); assert.equal(saved.islandPhotoBlobs.length, 11);
            assert(!saved.islandPhotos.some(photo => photo.id === removing)); untouched(full, saved);
            row.checks.push('old name and pixels remain; 12-picture limit does not evict; cancel/delete are explicit and atomic');

            // A saved reservation reopens the focused learning screen, whose
            // world canvas is intentionally hidden. Assert input readiness there.
            const resumedInput = async () => {
                await waitMode(page, 'learning');
                await page.locator('.island-answer-stage').waitFor();
                await idle(page);
            };
            await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await resumedInput();
            assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
            const beforeOffline = await tables(page); await context.setOffline(true); await page.reload(); await resumedInput();
            assert.deepEqual(await tables(page), beforeOffline);
            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await openGallery(page);
            await gallery(page).locator('.island-photo-card').first().click(); await gallery(page).locator('.island-photo-detail img').waitFor();
            await capture(page, `${name}-06-offline-photo`);
            await gallery(page).getByRole('button', { name: 'まなぶ', exact: true }).click(); await waitMode(page, 'learning');
            native = await readNative(page, owner); await answerUI(page, native.plan, { touch, dev: false });
            assert.deepEqual((await tables(page)).islandPhotoBlobs, beforeOffline.islandPhotoBlobs); await context.setOffline(false);
            row.checks.push('actual installed service worker restores album and image offline; ordinary answer leaves pixels unchanged');

            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await button(page, 'せってい').click();
            const firstOwner = await tables(page), firstName = firstOwner.appData.find(row => row.id === 'app').profiles[owner].name;
            await page.locator('[data-setting-section="profile"]').click(); await page.getByRole('button', { name: /^(追加|ついか)$/ }).click();
            await button(page, 'はじめる').click(); await page.getByPlaceholder('あだ名でOK').fill(`しゃしんB${name}`); await button(page, '次へ').click();
            await page.getByRole('button', { name: /年中/ }).click(); await page.getByRole('button', { name: /さんすう だけ/ }).click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitReady(page); await waitMode(page, 'home');
            const secondOwner = (await tables(page)).appData.find(row => row.id === 'app').activeProfileId; assert.notEqual(secondOwner, owner);
            await openGallery(page); assert.equal(await gallery(page).locator('.island-photo-card').count(), 0);
            await gallery(page).getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera'); await waitReady(page); await shoot(page);
            saved = await tables(page); assert.equal(saved.islandPhotos.filter(photo => photo.profileId === secondOwner).length, 1);
            assert.deepEqual(saved.islandPhotoBlobs.filter(photo => photo.profileId === owner), firstOwner.islandPhotoBlobs.filter(photo => photo.profileId === owner));
            await camera(page).getByRole('button', { name: 'カメラを とじる', exact: true }).click(); await waitMode(page, 'photos');
            await gallery(page).getByRole('button', { name: 'しゃしんの アルバムを とじる', exact: true }).click(); await waitMode(page, 'home');
            await button(page, 'せってい').click(); await page.locator('[data-setting-section="profile"]').click();
            await page.locator('.space-y-3.px-4.py-4').filter({ hasText: firstName }).getByRole('button', { name: /切替|きりかえ/ }).click(); await resumedInput();
            if (await page.locator('.island-page[data-mode="learning"]').count()) { await button(page, 'しまへ').click(); await waitMode(page, 'home'); }
            await openGallery(page); assert.equal(await gallery(page).locator('.island-photo-card').count(), 11);
            assert.deepEqual((await tables(page)).islandPhotoBlobs, saved.islandPhotoBlobs);
            await capture(page, `${name}-07-original-owner-photos`);
            row.checks.push('real second profile has an empty album, owns its own frame, and cannot replace the first owner photos');
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS ${name}: real photography, album, bounded storage, cancellation and offline learning`);
        } catch (cause) { row.failure = cause.stack; await capture(page, `${name}-failure`).catch(() => {}); throw cause; }
        finally { await context.close(); }
    }
    assert.deepEqual(await fingerprint(), original); report.pass = true;
} catch (cause) { report.failure = cause.stack; process.exitCode = 1; }
finally {
    await browser.close(); report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Island photos</title><style>body{font:16px sans-serif;background:#f5f2fa}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}figure{margin:0}img{width:100%}</style><h1>Island photos — ${report.pass ? 'PASS' : 'INCOMPLETE'}</h1><p>${manifest.revision}; human N=0; no progress fixtures.</p><main>${report.captures.map(item => `<figure><figcaption>${item.file}</figcaption><img src="${item.file}"></figure>`).join('')}</main>`);
}
