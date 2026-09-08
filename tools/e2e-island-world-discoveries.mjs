import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, waitLearningReady } from './island-learning-checks.mjs';

if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: true,
        photoContract: 'Open camera -> actual frame -> save metadata/PNG/thumbnail and one receipt -> explicit PNG export -> close camera',
        invariant: 'Only photo stores/receipt change; ordinary learning tables stay strict. Existing labelled world fixtures and showcase discovery allowances remain separate.',
        frameEvidence: 'Actual frame and exported PNG saved; every resized pixel and saved SHA-256 compared'
    }, null, 2)); process.exit(0);
}
const target = process.env.SANSU_ISLAND_PRODUCTION_URL ?? process.env.SANSU_ISLAND_DIAGNOSTIC_URL;
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_ISLAND_WORLD_OUTPUT;
assert(target && out, 'Set target URL and a fresh world-discovery output directory');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = manifestPath ? JSON.parse(await fs.readFile(manifestPath)) : undefined;
const qa = ['tools/e2e-island-world-discoveries.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const compiled = await build({ stdin: { contents: `
    export { createIsland, isValidIslandPlacement } from './src/domain/island/catalog.ts';
    export { ISLAND_DISCOVERIES } from './src/domain/island/growth.ts';
    export { islandVisitorAvailability } from './src/domain/island/visitors.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', metafile: true });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const inputPaths = [...new Set([...(source?.files.map(file => file.path) ?? Object.keys(compiled.metafile.inputs).filter(path => !path.includes('node_modules') && path !== '<stdin>')),
    ...qa, 'src/components/island/three/runtime.ts', 'src/components/island/three/natureVisuals.ts', 'src/components/island/three/livingActivities.ts',
    'src/components/island/three/natureObservationFrame.ts', 'src/pages/Island.tsx', 'src/components/island/IslandDiscoveryGuide.tsx'])].sort();
const fingerprint = async () => Promise.all(inputPaths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const inputsBefore = await fingerprint();
if (source) assert.deepEqual(source.files.filter(file => inputsBefore.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const versionResponse = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).text();
const version = versionResponse.trim().startsWith('{') ? JSON.parse(versionResponse) : { diagnostic: true, versionEndpoint: 'DEV HTML fallback; per-capture runtime metadata follows' };
if (source) assert.equal(version.revision, source.revision);
const report = { target, version, sourceHash: source?.sourceHash, manifestPath, diagnostic: !source, fixtureModuleHash: sha(compiled.outputFiles[0].text),
    scope: 'Explicit native-DB maturity/placement/visitor-cycle fixture, never earned learning. Real guide clicks, rendered events, native discovery persistence, replay across reload/outside offer cycle, and one subsequent actual normal-planner answer. N=0; diagnostic mutable DEV is not final frozen-build evidence. Automated pass does not establish visual appeal or silent understanding.',
    startedAt: new Date().toISOString(), inputsBefore, humanN: 0, captures: [], cases: [], pass: false };
const browser = await chromium.launch();
const stage = page => page.locator('[data-testid="island-stage"]').first();
const tap = (page, locator) => page.viewportSize().width === 390 ? locator.tap() : locator.click();
async function capture(page, name) {
    const metadata = await runtimeMetadata(page), file = `${name}.png`;
    if (source) { assert.equal(metadata.version, version.version); assert.equal(metadata.revision, source.revision); }
    const state = await stage(page).evaluate(element => ({ activity: JSON.parse(element.dataset.livingActivity ?? 'null'),
        observationFrame: element.dataset.observationFrame ? JSON.parse(element.dataset.observationFrame) : undefined,
        caption: element.getAttribute('aria-label'), cameraFrame: element.dataset.cameraFrame,
        geometries: +element.dataset.geometries, textures: +element.dataset.textures, drawCount: +element.dataset.drawCount,
        residents: JSON.parse(element.dataset.residentStates ?? '[]') }));
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, ...state });
    return state;
}
function fixture(profileId, discoveryId) {
    const island = domain.createIsland(profileId, 1);
    island.completedSets = 24;
    island.growth = { ...island.growth, expansionLevel: 2, progress: { garden: 6, waterside: 6, grove: 6, village: 6 } };
    island.items = [
        { id: 'starter-flower', kind: 'flower', habitatId: 'garden', growthLevel: 3, position: { x: 1.5, z: .8 }, rotation: 0 },
        { id: 'starter-lantern', kind: 'lantern', habitatId: 'village', growthLevel: 3, position: { x: -1, z: .25 }, rotation: 0 },
        { id: 'world-water', kind: 'fountain', habitatId: 'waterside', growthLevel: 3, position: { x: .25, z: 0 }, rotation: 0 },
        { id: 'living-mushroom', kind: 'mushroom', habitatId: 'grove', growthLevel: 3, position: { x: -5.8, z: 1.3 }, rotation: 0 },
    ];
    const definition = domain.ISLAND_DISCOVERIES.find(entry => entry.id === discoveryId);
    const host = island.items.find(item => item.habitatId === definition.habitatId && definition.kinds.includes(item.kind));
    assert(host);
    if (['ribbon-butterfly', 'pond-firefly', 'leaf-bird'].includes(discoveryId)) {
        while (!domain.islandVisitorAvailability(island, discoveryId, host.id).offered) island.completedSets++;
        assert(island.completedSets <= 27);
    }
    for (const item of island.items) assert(domain.isValidIslandPlacement(island, item.id, item.position, item.rotation), `Fixture placement must be legal: ${item.id}`);
    return { island, host, definition };
}
async function installFixture(page, island) {
    await page.evaluate(async island => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const tx = db.transaction('islands', 'readwrite'); tx.objectStore('islands').put(island);
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
    }, island);
}
async function selectDiscovery(page, definition) {
    await tap(page, page.getByRole('group', { name: 'みつける ばしょ', exact: true }).getByRole('button', {
        name: ({ garden: 'にわ', waterside: 'みずべ', grove: '木かげ', village: 'いえの まわり' })[definition.habitatId], exact: true }));
    const index = domain.ISLAND_DISCOVERIES.filter(entry => entry.habitatId === definition.habitatId).findIndex(entry => entry.id === definition.id);
    await tap(page, page.getByRole('group', { name: 'みつけものを えらぶ', exact: true }).getByRole('button').nth(index));
    await page.locator(`[data-guide-id="${definition.id}"][data-guide-status="try"]`).waitFor();
}
async function waitNature(page, discoveryId, ready = true) {
    await page.waitForFunction(({ discoveryId, ready }) => {
        const element = document.querySelector('[data-testid="island-stage"]');
        const activity = JSON.parse(element?.getAttribute('data-living-activity') ?? 'null');
        return activity?.discoveryId === discoveryId && activity.natureVisible && activity.natureReady === ready;
    }, { discoveryId, ready }, { timeout: 20000 });
}
async function waitNoObservation(page) {
    await page.waitForFunction(() => {
        const root = document.querySelector('[data-testid="island-stage"]');
        return root?.getAttribute('data-living-activity') === 'null' && !root?.getAttribute('data-observation-frame');
    });
}
async function waitRecorded(page, profileId, discoveryId) {
    await page.waitForFunction(async ({ profileId, discoveryId }) => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const request = db.transaction('islands').objectStore('islands').get(profileId);
        const island = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close(); return island?.growth?.discoveries.some(entry => entry.id === discoveryId);
    }, { profileId, discoveryId });
}
async function armRenderedFrames(page, discoveryId) {
    await page.evaluate(discoveryId => {
        const root = document.querySelector('[data-testid="island-stage"]');
        window.__worldRenderFrames = [];
        const observer = new MutationObserver(() => {
            const activity = JSON.parse(root.getAttribute('data-living-activity') ?? 'null');
            if (activity?.discoveryId !== discoveryId || !activity.natureVisible) return;
            const timestamp = Number(root.dataset.frameTimestamp), frames = window.__worldRenderFrames;
            const butterfly = discoveryId === 'butterfly-visit';
            const elapsed = timestamp - activity.arrivedAt;
            if (butterfly ? frames.length && timestamp < frames[0].timestamp + frames.length * 1000 / 30
                : activity.natureReady || elapsed < (discoveryId === 'petal-ripple' ? 1000 : 250)) return;
            frames.push({ timestamp, elapsed, activity, png: root.querySelector('canvas').toDataURL('image/png') });
            if (frames.length >= (butterfly ? 30 : 1)) observer.disconnect();
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
    }, discoveryId);
}
async function saveRenderedFrames(page, name) {
    const frames = await page.evaluate(() => window.__worldRenderFrames ?? []);
    const saved = [];
    for (const [index, { png, ...frame }] of frames.entries()) {
        const bytes = Buffer.from(png.split(',')[1], 'base64'), file = `${name}-motion-${String(index + 1).padStart(2, '0')}.png`;
        await fs.writeFile(`${out}/${file}`, bytes); saved.push({ file, sha256: sha(bytes), ...frame });
    }
    return saved;
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
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
        { name: 'tablet', viewport: { width: 768, height: 1024 }, reducedMotion: 'reduce' }]) {
        for (const discoveryId of (process.env.SANSU_ISLAND_WORLD_CASES?.split(',') ?? ['petal-ripple', 'lantern-reflection', 'ribbon-butterfly', 'pond-firefly', 'leaf-bird'])) {
            const name = `${layout.name}-${discoveryId}`, errors = [], context = await browser.newContext({ viewport: layout.viewport,
                hasTouch: layout.name === 'phone', reducedMotion: layout.reducedMotion, serviceWorkers: 'block', acceptDownloads: true });
            await context.addInitScript(() => {
                window.__worldWrites = []; window.__worldAudio = [];
                const original = IDBObjectStore.prototype.put;
                IDBObjectStore.prototype.put = function (value, ...args) {
                    if (this.name === 'islands' && value.growth?.discoveries.length) window.__worldWrites.push({
                        records: structuredClone(value.growth.discoveries), time: performance.now(),
                        activity: JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-living-activity') ?? 'null') });
                    return original.call(this, value, ...args);
                };
                const play = HTMLMediaElement.prototype.play;
                HTMLMediaElement.prototype.play = function (...args) { window.__worldAudio.push('media-play'); return play.apply(this, args); };
                if (window.speechSynthesis) {
                    const speak = speechSynthesis.speak.bind(speechSynthesis);
                    speechSynthesis.speak = (...args) => { window.__worldAudio.push('speech'); return speak(...args); };
                }
            });
            const page = await context.newPage(); await installPhotoProbe(page); page.on('pageerror', error => errors.push(error.message));
            try {
                await page.goto(`${target}/#/island`); await waitPageReady(page);
                const profileId = await seedNative(page, `world-${name}`), seeded = fixture(profileId, discoveryId);
                await installFixture(page, seeded.island);
                await page.reload(); await waitPageReady(page); await waitMode(page, 'home');
                const worldCamera = await stage(page).getAttribute('data-camera-frame');
                await tap(page, button(page, 'みつける')); await waitMode(page, 'guide'); await selectDiscovery(page, seeded.definition);
                const before = await readNative(page, profileId);
                assert(!before.island.growth.discoveries.some(entry => entry.id === discoveryId), 'Maturity and guide eligibility never mark the target discovery');
                await capture(page, `${name}-01-unseen-guide`);
                const recordFrames = layout.reducedMotion !== 'reduce' && ['petal-ripple', 'lantern-reflection', 'butterfly-visit'].includes(discoveryId);
                if (recordFrames) await armRenderedFrames(page, discoveryId);
                await tap(page, button(page, 'みにいく')); await waitMode(page, 'play');
                if (layout.reducedMotion !== 'reduce' && ['petal-ripple', 'lantern-reflection'].includes(discoveryId)) {
                    await page.waitForFunction(() => window.__worldRenderFrames?.length === 1);
                    await capture(page, `${name}-02-before-arrival`);
                }
                await waitNature(page, discoveryId); const rendered = await capture(page, `${name}-03-rendered`);
                if (recordFrames && discoveryId === 'butterfly-visit') await page.waitForFunction(() => window.__worldRenderFrames?.length === 30);
                const renderedFrames = recordFrames ? await saveRenderedFrames(page, name) : [];
                assert.equal(rendered.observationFrame?.discoveryId, discoveryId);
                assert.equal(rendered.observationFrame.visibleTargets, rendered.observationFrame.totalTargets, 'Actual world and residents leave every causal target unobscured in the chosen observation angle');
                assert.notEqual(rendered.cameraFrame, worldCamera, 'Explicit observation frames the actual host closely');
                const captionWord = ({ 'petal-ripple': '花びら', 'lantern-reflection': 'あかり', 'ribbon-butterfly': 'リボン',
                    'pond-firefly': 'ほたる', 'leaf-bird': 'ことり', 'butterfly-visit': 'ちょう', 'leaf-boat': 'ふね' })[discoveryId];
                await page.waitForFunction(word => document.querySelector('[data-testid="island-stage"]')?.getAttribute('aria-label')?.includes(word), captionWord);
                if (['petal-ripple', 'lantern-reflection'].includes(discoveryId)) {
                    assert.equal(rendered.activity.setting.supportingItemId, 'world-water');
                    assert.equal(rendered.activity.setting.sourceItemId, seeded.host.id);
                    assert(Math.abs(rendered.activity.naturePoints[1][0] - .25) < .0001);
                    assert(Math.abs(rendered.activity.naturePoints[1][1] - .315) < .0001);
                    assert(Math.abs(rendered.activity.naturePoints[1][2] - -.32) < .0001);
                }
                await waitRecorded(page, profileId, discoveryId);
                const after = await readNative(page, profileId), records = after.island.growth.discoveries.filter(entry => entry.id === discoveryId);
                assert.equal(records.length, 1); assert.equal(records[0].itemId, seeded.host.id);
                assert.equal(after.island.completedSets, before.island.completedSets); assert.deepEqual(after.logs, before.logs);
                assert.deepEqual(after.island.items, before.island.items); assert.deepEqual(after.island.customization, before.island.customization);
                const writes = await page.evaluate(() => window.__worldWrites);
                const write = writes.find(write => write.records.some(record => record.id === discoveryId));
                assert.equal(write?.activity?.discoveryId, discoveryId); assert.equal(write.activity.natureReady, true, 'Native save follows rendered outcome readiness');
                const photo = await saveAndExportPhoto(page, `${name}-03b-observed-photo`, button(page, 'いまを しゃしんに'));
                assert.equal(photo.evidence.shutter.observationFrame?.discoveryId, discoveryId, 'Camera keeps this actual observation in frame');
                await tap(page, button(page, 'みつけものを みる')); await waitMode(page, 'guide');
                await waitNoObservation(page);
                await page.locator(`[data-guide-id="${discoveryId}"][data-observed="true"]`).waitFor();
                await capture(page, `${name}-04-recorded-guide`);
                const visitor = ['ribbon-butterfly', 'pond-firefly', 'leaf-bird'].includes(discoveryId);
                if (visitor) {
                    const cycleFixture = structuredClone(after.island); cycleFixture.completedSets++;
                    const hypotheticalUnseen = { ...cycleFixture, growth: { ...cycleFixture.growth, discoveries: [] } };
                    assert.equal(domain.islandVisitorAvailability(hypotheticalUnseen, discoveryId, seeded.host.id).offered, false);
                    await installFixture(page, cycleFixture); await page.reload(); await waitPageReady(page); await waitMode(page, 'home');
                    await tap(page, button(page, 'みつける')); await waitMode(page, 'guide'); await selectDiscovery(page, seeded.definition);
                    assert.equal(await page.locator(`[data-guide-id="${discoveryId}"]`).getAttribute('data-observed'), 'true');
                }
                await tap(page, button(page, 'もういちど ためす')); await waitMode(page, 'play'); await waitNature(page, discoveryId);
                const replay = await readNative(page, profileId);
                assert.deepEqual(replay.island.growth.discoveries, after.island.growth.discoveries);
                await capture(page, `${name}-05-replay`);
                if (discoveryId === 'petal-ripple') {
                    await tap(page, page.locator('.island-play-actions').getByRole('button', { name: /を うごかす$/ }));
                    await waitMode(page, 'placement'); await waitNoObservation(page);
                    assert.deepEqual((await readNative(page, profileId)).island.items, replay.island.items);
                    await capture(page, `${name}-05b-placement-restored`);
                    await tap(page, button(page, 'いどうを やめる')); await waitMode(page, 'home'); await waitNoObservation(page);
                    await capture(page, `${name}-05c-home-restored`);
                    await tap(page, button(page, 'みつける')); await waitMode(page, 'guide'); await selectDiscovery(page, seeded.definition);
                    await tap(page, button(page, 'もういちど ためす')); await waitMode(page, 'play'); await waitNature(page, discoveryId);
                }
                await tap(page, button(page, 'ひかりを とどける')); await waitMode(page, 'learning');
                await waitNoObservation(page);
                const actualPlan = await readNative(page, profileId);
                assert(actualPlan.plan?.slots.length, 'Normal planner reserves real questions after observation');
                const answered = (await attempt(page, actualPlan)).after;
                assert.equal(answered.plan.cursor, actualPlan.plan.cursor + 1);
                assert.deepEqual(answered.island.growth.discoveries, replay.island.growth.discoveries);
                assert.equal(await stage(page).getAttribute('data-living-activity'), 'null');
                await capture(page, `${name}-06-learning-return`);
                assert.deepEqual(await page.evaluate(() => window.__worldAudio), []);
                assert.deepEqual(errors, []);
                report.cases.push({ name, syntheticMaturity: true, seededCompletedSets: seeded.island.completedSets, fixture: seeded.island,
                    renderedFrames, photoEvidence: photo.evidence,
                    sequenceCapture: renderedFrames.length > 1 ? { requestedFramesPerSecond: 30,
                        measuredFramesPerSecond: (renderedFrames.length - 1) * 1000 / (renderedFrames.at(-1).timestamp - renderedFrames[0].timestamp) } : undefined,
                    sourceItemId: seeded.host.id, supportingItemId: rendered.activity.setting?.supportingItemId,
                    nativeWrite: write, callbackOnly: true, replayNoDuplicate: true, soundOff: true, actualSubsequentAnswers: 1,
                    observedFrame: rendered.observationFrame, visitorReloadOutsideOffer: visitor, placementAndHomeReset: discoveryId === 'petal-ripple',
                    reducedMotion: layout.reducedMotion, pass: true });
            } catch (error) {
                await capture(page, `${name}-failure`).catch(() => {});
                report.cases.push({ name, pass: false, error: String(error), errors, pageText: await page.locator('body').innerText().catch(() => ''),
                    native: await readNative(page).catch(() => undefined) });
                throw error;
            } finally { await context.close(); }
        }
    }
    const inputsAfter = await fingerprint(); report.inputsAfter = inputsAfter;
    report.inputsChanged = inputsAfter.filter(file => inputsBefore.find(before => before.path === file.path)?.sha256 !== file.sha256);
    if (source) assert.deepEqual(inputsAfter, inputsBefore, 'Frozen application and QA remain unchanged');
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString(); await browser.close(); report.browserClosed = true;
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
