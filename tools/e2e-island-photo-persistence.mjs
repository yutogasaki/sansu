import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { waitLearningReady } from './island-learning-checks.mjs';

const scenarios = [
    'Empty database -> actual onboarding and first ordinary learning section -> real canvas camera',
    'Native photo save and delete abort after row writes -> all-table rollback -> identical receipt retry from UI',
    'Native photo commit with completion delivery lost -> same frozen metadata/PNG retry -> no duplicate',
    'Native committed photo with lost response -> real UI deletion in another visible window -> old UI retry does not resurrect',
    'Delayed actual PNG conversion -> genuine native hidden in another tab -> no new save; foreground camera and reserved learning still work',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, scenarios,
        requiredEnvironment: ['SANSU_PHOTO_PERSISTENCE_URL', 'SANSU_PHOTO_PERSISTENCE_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        headedDefault: true, diagnosticOnly: ['native IDB abort', 'post-commit completion delivery loss', 'held real toBlob callback', 'driver focus-emulation true -> false'],
        concurrentWindowRule: 'Both documents must remain natively visible so leaving the camera does not discard its pending intent.' }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_PHOTO_PERSISTENCE_URL || process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_PHOTO_PERSISTENCE_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set a frozen app target, fresh output and build manifest');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = ['tools/e2e-island-photo-persistence.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...manifest.files.map(file => file.path), ...qaFiles].map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const initialSource = await fingerprint();
assert.deepEqual(initialSource.slice(0, manifest.files.length), manifest.files.map(({ path, sha256 }) => ({ path, sha256 })), 'Frozen app must match its build manifest');
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, captures: [], layouts: [], fingerprints: initialSource,
    scope: 'Real empty onboarding, earned section and real camera bytes. Driver faults alter only native abort/completion delivery and timing of an actual encoded Blob. No progress/photo fixture, app module import, or app action dispatch. Real native visibility is required for background evidence; v7 migration remains covered by source unit tests. Not child motivation or learning-effect evidence.' };
const require = createRequire(import.meta.url);
const { CRSession } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/crConnection.js'));
const driverSend = CRSession.prototype.send;
report.driverFocus = { command: 'Emulation.setFocusEmulationEnabled', originalEnabled: true, replacementEnabled: false,
    dependencyFilesModified: false, appVisibilityPropertyModified: false, overrides: [] };
CRSession.prototype.send = function (method, params) {
    if (method === report.driverFocus.command && params?.enabled === true) {
        report.driverFocus.overrides.push({ sessionId: this._sessionId, at: new Date().toISOString() });
        return driverSend.call(this, method, { ...params, enabled: false });
    }
    return driverSend.call(this, method, params);
};
const browser = await chromium.launch({ headless: process.env.SANSU_PHOTO_PERSISTENCE_HEADED === '0' });
report.browser = browser.version();
const camera = page => page.getByTestId('island-photo-camera');
const gallery = page => page.getByTestId('island-photo-gallery');
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visibility = page => page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() }));
const diagnostics = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__photoPersistence)));
const photoEvents = state => state.islandEvents.filter(event => event.type === 'photo_changed');
const eventDelta = (before, after) => photoEvents(after).filter(event => !photoEvents(before).some(old => old.id === event.id));

/** Snapshot all stores in one readonly transaction, then digest actual Blob bytes
 * outside it. Read-only probes do not import or invoke the application domain. */
async function tables(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const names = [...database.objectStoreNames], transaction = database.transaction(names, 'readonly');
            const rows = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const read = transaction.objectStore(name).getAll(); read.onsuccess = () => resolve([name, read.result]); read.onerror = () => reject(read.error);
            })));
            const result = Object.fromEntries(rows);
            const digest = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
            result.islandPhotoBlobs = await Promise.all(result.islandPhotoBlobs.map(async row => ({ id: row.id, profileId: row.profileId,
                image: { mime: row.image.type, bytes: row.image.size, sha256: await digest(row.image) },
                thumbnail: { mime: row.thumbnail.type, bytes: row.thumbnail.size, sha256: await digest(row.thumbnail) } })));
            return result;
        } finally { database.close(); }
    });
}
function untouched(before, after) {
    for (const name of Object.keys(before)) {
        if (['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs'].includes(name)) continue;
        const strip = rows => name === 'islandEvents' ? rows.filter(event => event.type !== 'photo_changed') : rows;
        assert.deepEqual(strip(after[name]), strip(before[name]), `${name} changed during photography`);
    }
}
function paired(state) {
    assert.deepEqual(state.islandPhotos.map(photo => photo.id).sort(), state.islandPhotoBlobs.map(blob => blob.id).sort(), 'Metadata and both Blob images are atomic');
    for (const photo of state.islandPhotos) {
        const blobs = state.islandPhotoBlobs.find(blob => blob.id === photo.id); assert.equal(blobs.profileId, photo.profileId);
        for (const kind of ['image', 'thumbnail']) assert.deepEqual(blobs[kind], { mime: photo[kind].mime, bytes: photo[kind].bytes, sha256: photo[kind].sha256 });
    }
}
async function capture(page, name) {
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata });
}
async function openGallery(page) {
    await page.locator('.island-page[data-mode]').waitFor();
    if (await page.locator('.island-page[data-mode="learning"]').count()) {
        const state = await readNative(page); assert(state.plan, 'The ordinary reservation must remain available');
        await waitLearningReady(page, state.plan);
        await button(page, 'しまへ').click(); await waitMode(page, 'home');
    }
    await waitReady(page);
    await button(page, 'アルバム').click(); await waitMode(page, 'album'); await button(page, 'しゃしん').click(); await waitMode(page, 'photos');
    await gallery(page).locator('.island-photo-empty, .island-photo-card').first().waitFor(); await idle(page);
}
async function openCamera(page) {
    await gallery(page).getByRole('button', { name: 'しゃしんを とる', exact: true }).click(); await waitMode(page, 'camera'); await waitReady(page); await idle(page);
}
async function shoot(page, status = 'saved') {
    await camera(page).locator('[data-photo-action="capture"]').click();
    await page.waitForFunction(status => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === status, status); await idle(page);
}
async function retryCamera(page, status = 'saved') {
    await camera(page).getByRole('button', { name: 'もういちど のこす', exact: true }).click();
    await page.waitForFunction(status => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === status, status); await idle(page);
}
async function selectPhoto(page, id) {
    const cards = gallery(page).locator('.island-photo-card');
    await page.waitForFunction(id => [...document.querySelectorAll('.island-photo-card')].some(card => card.getAttribute('data-photo-id') === id), id);
    const ids = await cards.evaluateAll(cards => cards.map(card => card.getAttribute('data-photo-id'))), index = ids.indexOf(id); assert(index >= 0);
    await cards.nth(index).click(); await gallery(page).locator('.island-photo-detail').waitFor();
}
async function removeSelected(page) {
    await gallery(page).getByRole('button', { name: 'この しゃしんを はずす', exact: true }).click();
    await gallery(page).locator('.island-photo-delete').getByRole('button', { name: 'はずす', exact: true }).click(); await idle(page);
}
async function instrument(context) {
    await context.addInitScript(() => {
        const nativeTransaction = IDBDatabase.prototype.transaction, nativeAdd = IDBObjectStore.prototype.add;
        const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete'), toBlob = HTMLCanvasElement.prototype.toBlob;
        if (!complete?.get || !complete?.set) throw new Error('Native completion instrumentation unavailable');
        const meta = new WeakMap(); let armed;
        const sample = () => ({ at: performance.now(), hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus(),
            mode: document.querySelector('.island-page')?.getAttribute('data-mode') ?? null });
        const probe = window.__photoPersistence = { documentId: crypto.randomUUID(), transactions: [], faults: [], visibility: [sample()], conversion: [], held: [], delayNext: false,
            arm(value) { armed = value; }, release() { for (const deliver of this.held.splice(0)) deliver(); } };
        document.addEventListener('visibilitychange', () => probe.visibility.push(sample()));
        HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
            const delay = probe.delayNext; probe.delayNext = false;
            return toBlob.call(this, blob => {
                if (delay) {
                    probe.conversion.push({ event: 'encoded-held', ...sample(), bytes: blob?.size });
                    probe.held.push(() => { probe.conversion.push({ event: 'delivered', ...sample(), bytes: blob?.size }); callback(blob); });
                } else callback(blob);
            }, ...args);
        };
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = nativeTransaction.apply(this, args);
            if (transaction.mode !== 'readwrite' || !transaction.objectStoreNames.contains('islandPhotoAlbums')) return transaction;
            const entry = { start: sample(), stores: [...transaction.objectStoreNames], nativeOutcome: 'pending', actions: [] };
            meta.set(transaction, entry); probe.transactions.push(entry);
            transaction.addEventListener('complete', () => { entry.nativeOutcome = 'complete'; entry.end = sample(); });
            transaction.addEventListener('abort', () => { entry.nativeOutcome = 'abort'; entry.end = sample(); }); return transaction;
        };
        IDBObjectStore.prototype.add = function (value, ...args) {
            const entry = meta.get(this.transaction);
            if (this.name === 'islandEvents' && value?.type === 'photo_changed' && entry) {
                entry.actions.push(structuredClone(value));
                if (armed && armed.profileId === value.profileId && armed.type === value.action.type) {
                    const mode = armed.mode; armed = undefined; entry.fault = mode;
                    probe.faults.push({ ...sample(), mode, receiptId: value.id, action: structuredClone(value.action), photoReceipt: structuredClone(value.photoReceipt) });
                    if (mode === 'abort') this.transaction.abort();
                }
            }
            return nativeAdd.call(this, value, ...args);
        };
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: complete.configurable, enumerable: complete.enumerable,
            get() { return complete.get.call(this); }, set(handler) {
                complete.set.call(this, typeof handler !== 'function' ? handler : function (event) {
                    const entry = meta.get(this);
                    if (entry?.fault === 'lost-completion') {
                        entry.applicationOutcome = 'injected-abort-delivery-after-native-commit';
                        this.onabort?.call(this, new Event('abort', { cancelable: true }));
                    } else handler.call(this, event);
                });
            } });
    });
}
const arm = (page, mode, profileId, type) => page.evaluate(value => window.__photoPersistence.arm(value), { mode, profileId, type });
async function windowInfo(context, page) {
    const session = await context.newCDPSession(page);
    try { const { targetInfo } = await session.send('Target.getTargetInfo'); return { ...await session.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId }), targetInfo }; }
    finally { await session.detach(); }
}
async function visiblePair(page, other, row, label) {
    const sample = { label, main: await visibility(page), other: await visibility(other) }; row.concurrentVisibility.push(sample);
    assert(!sample.main.hidden && sample.main.visibility === 'visible' && !sample.other.hidden && sample.other.visibility === 'visible', 'Both concurrent windows must be really visible; do not forge pending intent after native cancellation');
}
async function separateWindow(context, page, viewport) {
    const main = await windowInfo(context, page), session = await browser.newBrowserCDPSession();
    try {
        const pending = context.waitForEvent('page');
        const created = await session.send('Target.createTarget', { url: 'about:blank', newWindow: true, browserContextId: main.targetInfo.browserContextId });
        const other = await pending, info = await windowInfo(context, other); assert.equal(info.targetInfo.targetId, created.targetId); assert.notEqual(info.windowId, main.windowId);
        await session.send('Browser.setWindowBounds', { windowId: main.windowId, bounds: { windowState: 'normal', left: 10, top: 20, width: viewport.width + 30, height: viewport.height + 100 } });
        await session.send('Browser.setWindowBounds', { windowId: info.windowId, bounds: { windowState: 'normal', left: viewport.width + 50, top: 20, width: viewport.width + 30, height: viewport.height + 100 } });
        // Make viewport and foreground explicit for this protocol-created window.
        await other.setViewportSize(viewport); await other.bringToFront();
        await other.waitForFunction(size => !document.hidden && innerWidth === size.width && innerHeight === size.height, viewport);
        return { other, mainWindowId: main.windowId, otherWindowId: info.windowId };
    } finally { await session.detach(); }
}

try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const touch = layout.name === 'phone', context = await browser.newContext({ viewport: layout.viewport, hasTouch: touch,
            reducedMotion: touch ? 'no-preference' : 'reduce', serviceWorkers: 'allow', acceptDownloads: true });
        await instrument(context);
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const row = { name: layout.name, pass: false, errors: [], checks: [], concurrentVisibility: [], diagnosticDocuments: [] }; report.layouts.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        let other, background;
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            await button(page, 'まなぶ').click(); await page.locator('.island-setup-name input').fill(`しゃしんA${layout.name}`);
            await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitMode(page, 'learning');
            let native = await readNative(page); const firstPlan = native.plan.id, owner = native.plan.profileId;
            for (let count = 0; native.plan.id === firstPlan; count++) { assert(count < 80); native = (await answerUI(page, native.plan, { touch, dev: false })).state; }
            assert.equal(native.island.completedSets, 1); row.owner = owner; row.normalEarnedSections = 1; row.reservedPlanId = native.plan.id;
            await button(page, 'しまへ').click(); await waitMode(page, 'home'); await openGallery(page); await openCamera(page);
            const earned = await tables(page); assert.equal(earned.islandPhotos.length, 0); await capture(page, `${layout.name}-01-earned-camera`);

            await arm(page, 'abort', owner, 'save-photo'); await shoot(page, 'error');
            await camera(page).getByRole('button', { name: 'もういちど のこす', exact: true }).waitFor();
            const abortedSave = (await diagnostics(page)).faults.at(-1); assert.equal(abortedSave.mode, 'abort');
            assert.deepEqual(await tables(page), earned, 'Native save abort restores every learning, world and photo table');
            await capture(page, `${layout.name}-02-native-save-abort`); await retryCamera(page);
            let saved = await tables(page); paired(saved); untouched(earned, saved);
            const savedReceipt = eventDelta(earned, saved); assert.equal(savedReceipt.length, 1);
            assert.equal(savedReceipt[0].id, abortedSave.receiptId); assert.deepEqual(savedReceipt[0].action, abortedSave.action); assert.deepEqual(savedReceipt[0].photoReceipt, abortedSave.photoReceipt);
            row.checks.push('native save abort rolls back all rows; UI retry retains the exact capture, byte digests, revision and receipt');

            await camera(page).getByRole('button', { name: 'しゃしんを みる', exact: true }).click(); await waitMode(page, 'photos');
            await selectPhoto(page, savedReceipt[0].action.photo.id); await arm(page, 'abort', owner, 'delete-photo');
            await removeSelected(page); await gallery(page).locator('.island-photo-error').waitFor(); assert.deepEqual(await tables(page), saved);
            const abortedDelete = (await diagnostics(page)).faults.at(-1); assert.equal(abortedDelete.action.type, 'delete-photo');
            await gallery(page).getByRole('button', { name: 'もういちど ためす', exact: true }).click(); await idle(page);
            await gallery(page).locator('.island-photo-empty').waitFor();
            const deleted = await tables(page); paired(deleted); untouched(saved, deleted); assert.equal(deleted.islandPhotos.length, 0);
            const deletion = eventDelta(saved, deleted); assert.equal(deletion.length, 1); assert.equal(deletion[0].id, abortedDelete.receiptId); assert.deepEqual(deletion[0].action, abortedDelete.action);
            row.checks.push('native delete abort retains both images and metadata; UI retry deletes once with the original receipt');
            await openCamera(page);

            const beforeLost = await tables(page); await arm(page, 'lost-completion', owner, 'save-photo'); await shoot(page, 'error');
            const committed = await tables(page); paired(committed); untouched(beforeLost, committed); assert.equal(eventDelta(beforeLost, committed).length, 1);
            const lost = (await diagnostics(page)).faults.at(-1); assert.equal(lost.mode, 'lost-completion');
            assert.equal(committed.islandPhotos.length, 1, 'Native commit happened despite failed application delivery');
            await retryCamera(page); assert.deepEqual(await tables(page), committed, 'Replay must not allocate a new ID, image or receipt');
            await capture(page, `${layout.name}-03-committed-reply-recovered`);
            row.checks.push('native commit + lost completion delivery retries the frozen PNG and metadata without duplicate rows');
            // Verify the repaired cursor independently before any second-window setup.
            await shoot(page); const nextShutter = await tables(page); paired(nextShutter); untouched(committed, nextShutter);
            const nextReceipt = eventDelta(committed, nextShutter); assert.equal(nextReceipt.length, 1);
            assert.equal(nextReceipt[0].action.type, 'save-photo');
            assert.notEqual(nextReceipt[0].action.photo.id, lost.action.photo.id);
            assert.equal(nextReceipt[0].photoReceipt.albumRevision, lost.photoReceipt.albumRevision + 1);
            assert.equal(nextShutter.islandPhotos.length, committed.islandPhotos.length + 1);
            row.checks.push('recovered unknown receipt -> next real shutter saves with the latest album revision in the same visible window');
            await capture(page, `${layout.name}-03b-next-shutter-after-retry`);

            // Prepare a second real window before the next shutter. Both remain
            // visible: a native hidden event intentionally cancels pending intent.
            const windows = await separateWindow(context, page, layout.viewport); other = windows.other;
            row.windows = { main: windows.mainWindowId, concurrent: windows.otherWindowId };
            other.setDefaultTimeout(15000); other.on('pageerror', error => row.errors.push(error.message));
            await other.goto(`${target}/#/island`); await openGallery(other); await page.bringToFront();
            await visiblePair(page, other, row, 'before lost response');
            const beforeRemovedReplay = await tables(page); await arm(page, 'lost-completion', owner, 'save-photo'); await shoot(page, 'error');
            const awaiting = await tables(page), pendingReceipt = eventDelta(beforeRemovedReplay, awaiting); assert.equal(pendingReceipt.length, 1);
            const pendingId = pendingReceipt[0].action.photo.id; await other.bringToFront(); await visiblePair(page, other, row, 'before other-window delete');
            // The explicit completion-delivery fault also suppresses Dexie's
            // cross-window mutation notice. Reload is the real UI read recovery.
            await other.reload(); await openGallery(other);
            row.checks.push('other window explicitly reloads after diagnostic lost mutation notification');
            await visiblePair(page, other, row, 'after other-window explicit reload');
            await selectPhoto(other, pendingId); await removeSelected(other);
            await other.waitForFunction(id => ![...document.querySelectorAll('.island-photo-card, .island-photo-detail')].some(element => element.getAttribute('data-photo-id') === id), pendingId);
            const removed = await tables(other); paired(removed); untouched(beforeRemovedReplay, removed); assert(!removed.islandPhotos.some(photo => photo.id === pendingId));
            assert.equal(eventDelta(awaiting, removed).length, 1); await visiblePair(page, other, row, 'after other-window delete');
            await page.bringToFront(); await camera(page).getByRole('button', { name: 'もういちど のこす', exact: true }).click(); await idle(page);
            await camera(page).getByText('この しゃしんは アルバムから はずされているよ。', { exact: true }).waitFor();
            assert.equal(await camera(page).getByRole('button', { name: 'もういちど のこす', exact: true }).count(), 0);
            assert.deepEqual(await tables(page), removed, 'Old save replay after another window deletes it must never resurrect');
            row.checks.push('real other-window deletion while both documents remain visible; old pending save reports deletion and changes no table');
            await capture(page, `${layout.name}-04-old-retry-stays-deleted`); row.diagnosticDocuments.push(await diagnostics(other)); await other.close(); other = undefined;

            // This case requires a real same-window tab switch. Never replace
            // document.hidden or dispatch a synthetic visibilitychange event.
            const mainWindow = await windowInfo(context, page); background = await context.newPage();
            const backgroundWindow = await windowInfo(context, background); assert.equal(backgroundWindow.windowId, mainWindow.windowId);
            await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
            const beforeHidden = await tables(page), beforeHiddenTransactions = (await diagnostics(page)).transactions.length;
            await page.evaluate(() => { window.__photoPersistence.delayNext = true; });
            await camera(page).locator('[data-photo-action="capture"]').click(); await page.waitForFunction(() => window.__photoPersistence.held.length === 1);
            assert.equal((await diagnostics(page)).transactions.length, beforeHiddenTransactions, 'Encoding has not begun a photo writer');
            await background.bringToFront();
            const hidden = await page.waitForFunction(() => document.hidden, undefined, { timeout: 3000 }).then(() => true, () => false);
            row.background = { status: hidden ? 'pending' : 'unverified-driver', main: await visibility(page), foreground: await visibility(background),
                windowId: mainWindow.windowId, applicationVisibilityModified: false };
            await page.evaluate(() => window.__photoPersistence.release()); await sleep(700);
            const released = await tables(page), backgroundDiagnostic = await diagnostics(page);
            if (hidden) {
                try {
                    assert.deepEqual(released, beforeHidden, 'Hidden conversion delivery cannot begin a new save');
                    assert.equal(backgroundDiagnostic.transactions.length, beforeHiddenTransactions);
                    assert(backgroundDiagnostic.visibility.some(sample => sample.hidden && sample.visibility === 'hidden'));
                    assert(backgroundDiagnostic.conversion.some(sample => sample.event === 'delivered' && sample.hidden));
                    row.background.status = 'pass';
                } catch (cause) { row.background.status = 'failed'; row.background.failure = cause.stack; }
            }
            await page.bringToFront(); await page.waitForFunction(() => !document.hidden); await background.close(); background = undefined;
            row.background.visibilityEvents = (await diagnostics(page)).visibility;
            await fs.writeFile(`${out}/background-report.json`, JSON.stringify({ target, revision: manifest.revision, driverFocus: report.driverFocus,
                layouts: report.layouts.map(layout => ({ name: layout.name, ...layout.background })) }, null, 2));
            if (hidden) {
                await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'idle');
                assert.equal(await camera(page).locator('.island-photo-preview').count(), 0);
            }
            await shoot(page); saved = await tables(page); paired(saved); untouched(released, saved);
            await capture(page, `${layout.name}-05-foreground-camera-restored`);
            await camera(page).getByRole('button', { name: 'まなぶ', exact: true }).click(); await waitMode(page, 'learning');
            native = await readNative(page, owner); assert.equal(native.plan.id, row.reservedPlanId);
            await answerUI(page, native.plan, { touch, dev: false });
            assert.deepEqual((await tables(page)).islandPhotoBlobs, saved.islandPhotoBlobs);
            row.checks.push(`native background conversion gate: ${row.background.status}; foreground recapture and the same reserved normal input work`);
            row.diagnosticDocuments.push(await diagnostics(page));
            const transactions = row.diagnosticDocuments.flatMap(document => document.transactions).filter(transaction => transaction.actions.length);
            assert(transactions.some(transaction => transaction.fault === 'abort' && transaction.nativeOutcome === 'abort'));
            assert(transactions.some(transaction => transaction.fault === 'lost-completion' && transaction.nativeOutcome === 'complete'));
            for (const transaction of transactions) {
                assert(!transaction.start.hidden && ['camera', 'photos'].includes(transaction.start.mode), 'No photo writer starts during learning or native hidden');
                assert.deepEqual([...transaction.stores].sort(), ['appData', 'islandPhotoAlbums', 'islandPhotoBlobs', 'islandPhotos', 'islandEvents'].sort());
            }
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS ${layout.name}: native photo abort/replay/deletion integrity; background ${row.background.status}`);
        } catch (cause) {
            row.failure = cause.stack;
            row.failurePages = await Promise.all([page, other, background].filter(Boolean).map(async view => ({ url: view.url(), viewport: view.viewportSize(),
                visibility: await visibility(view).catch(() => null),
                geometry: await view.evaluate(() => ({ width: innerWidth, height: innerHeight, mode: document.querySelector('.island-page')?.getAttribute('data-mode'),
                    canvas: [...document.querySelectorAll('canvas')].map(canvas => ({ width: canvas.width, height: canvas.height, rect: canvas.getBoundingClientRect().toJSON() })) })).catch(() => null),
                text: (await view.locator('body').innerText().catch(() => '')).slice(0, 4000) })));
            await capture(page, `${layout.name}-failure`).catch(() => {});
            row.diagnosticDocuments.push(await diagnostics(page).catch(() => null));
            if (other) row.diagnosticDocuments.push(await diagnostics(other).catch(() => null));
            await fs.writeFile(`${out}/${layout.name}-failure-native.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            throw cause;
        } finally { await context.close(); }
    }
    assert.deepEqual(await fingerprint(), initialSource, 'Frozen application and QA sources must remain unchanged'); report.pass = true;
} catch (cause) { report.failure = cause.stack; process.exitCode = 1; }
finally {
    await browser.close(); CRSession.prototype.send = driverSend; report.finishedAt = new Date().toISOString();
    report.finalFingerprints = await fingerprint();
    report.sourcesUnchanged = JSON.stringify(report.finalFingerprints) === JSON.stringify(initialSource);
    if (!report.sourcesUnchanged) { report.pass = false; report.sourceFailure = 'Frozen application or QA source changed during this run'; process.exitCode = 1; }
    report.backgroundGatePassed = report.layouts.length === 2 && report.layouts.every(layout => layout.background?.status === 'pass');
    report.fullPersistenceMatrixPassed = report.pass && report.backgroundGatePassed;
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Photo persistence</title><style>body{font:16px sans-serif;background:#f1eff6}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}</style><h1>Photo persistence — ${report.fullPersistenceMatrixPassed ? 'PASS' : 'INCOMPLETE'}</h1><p>${manifest.revision}; human n=0; no application data fixtures; driver faults are integrity diagnostics.</p><main>${report.captures.map(item => `<figure><figcaption>${item.file}</figcaption><img src="${item.file}"></figure>`).join('')}</main>`);
}
