import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activate, answerUI, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertDiscoveryDelta } from './island-qualified-audit.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const candidate = 'island-home-interior-v4';
const scope = [
    'Only an empty-history native profile fixture; no island, progress, currency, qualifications, plans, answers or geometry injected.',
    'First three actual UI answers earn the certificate. Read, display, store, redisplay, actual-object close-up and house overview, then one real photo.',
    'Enter the actual house overview, read its genuine notice state, and open the learning shelf without changing saved data. World-object entrance taps are a separate diagnostic.',
    'Continue ordinary UI answers only until five completed sections. The first trophy remains stored until an explicit display operation.',
    'Display all two currently earned awards, store one, reload, redisplay and resume the identical reservation.',
    'One non-final ordinary answer preserves every island row, including the entire learningKeepsakes selection; reload is an exact all-store read.',
    'Canonical native transaction receipts and every native store are compared at display/photo boundaries; actual home discoveries require saved visible-frame evidence.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, candidate, viewports, scope,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_KEEPSAKES_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: ['SANSU_ISLAND_KEEPSAKES_QA_ROOT', 'SANSU_ISLAND_KEEPSAKES_HEADED'],
        runtimeClosure: ['tools/e2e-island-keepsakes.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-qualified-audit.mjs'],
        limits: ['No claim for all sixteen real qualifications, human motivation, audio, PWA, or whole-goal completion.',
            'Human N=0. A separate fixture may show all sixteen awards; this run does not use it.',
            'Offscreen DOM operations may save, but geometry evidence requires a fresh, visible rendered room.'] }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, ''), out = process.env.SANSU_ISLAND_KEEPSAKES_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Frozen URL, manifest and fresh output required');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length);
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_KEEPSAKES_QA_ROOT || manifest.snapshot));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const helpers = ['tools/island-e2e-helpers.mjs', 'tools/island-qualified-audit.mjs'];
const qaFiles = ['tools/e2e-island-keepsakes.mjs', ...helpers];
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)),
    qa: await hashFiles(qaFiles.map(file => path.join(sourceRoot, file))),
    bundleApp: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleApp.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256, file.sha256, file.relative);
for (const relative of helpers) assert.equal(initialSource.qa.find(entry => entry.path === path.join(sourceRoot, relative))?.sha256,
    manifest.files.find(file => file.relative === relative)?.sha256, `Frozen helper differs: ${relative}`);
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { pass: false, target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(),
    fullGoalPassed: false, humanN: 0, progressFixture: false, nativeProfileFixture: true, scope,
    sources: { app: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)) } }, initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const idle = page => page.waitForFunction(() => {
    const root = document.querySelector('.island-page');
    return root?.getAttribute('data-busy') === 'false' || root?.getAttribute('data-mode') === 'welcome'
        || root?.hasAttribute('data-onboarding-step') && root.querySelector('.island-setup-sheet')?.getAttribute('aria-busy') === 'false';
});
async function press(page, row, label, scope = page) { await idle(page); await activate(button(scope, label), row.touch); }
async function waitLearningInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const panel = document.querySelector('[data-island-plan-id][data-input-ready="true"]'), answer = document.querySelector('.park-answer');
        return panel && answer && answer.getBoundingClientRect().width > 20
            && (!expected || panel.getAttribute('data-island-plan-id') === expected.id && Number(panel.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(node => !node.disabled && node.getBoundingClientRect().height > 10);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
}
async function waitWorld(page) {
    await waitReady(page); await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        return document.querySelector('.island-page')?.getAttribute('data-mode') !== 'learning' && host?.dataset.renderer === 'three'
            && box?.width > 100 && box?.height > 100 && canvas.width > 1 && host.dataset.cameraFrame?.split(',').length === 32;
    }); await painted(page);
}

/** One transaction reads every native store; actual Blob bytes are hashed after it completes. */
async function tables(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const entries = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const read = tx.objectStore(name).getAll(); read.onsuccess = () => resolve([name, read.result]); read.onerror = () => reject(read.error);
            })));
            await done;
            const canonical = async value => {
                if (value instanceof Blob) return { mime: value.type, bytes: value.size,
                    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('') };
                if (value instanceof Date) return { nativeDate: value.toISOString() };
                if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
                    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                    return { nativeBinary: value.constructor.name, bytes: [...bytes] };
                }
                if (Array.isArray(value)) return Promise.all(value.map(canonical));
                if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await canonical(item)])));
                return value;
            };
            return Object.fromEntries(await Promise.all(entries.map(async ([name, rows]) => [name, await canonical(rows)])));
        } finally { db.close(); }
    });
}
const digestTables = state => Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, { rows: rows.length, sha256: sha(JSON.stringify(rows)) }]));
const islandFor = (state, owner) => state.islands.find(island => island.profileId === owner);


/** Capture actual ready frames continuously, including spontaneous home visits.
 * Native write methods keep their arguments/return values; listeners only record completed transactions. */
async function installObservationAudit(context) {
    await context.addInitScript(() => {
        const audit = window.__qualifiedObservations = { frames: [], commits: [], errors: [] };
        const latest = new Map(), transactions = new WeakMap(), frameKeys = new Set();
        const sample = () => {
            const host = document.querySelector('[data-testid="island-stage"]');
            if (!host || document.hidden) return;
            const activity = JSON.parse(host.dataset.livingActivity || 'null');
            if (!activity?.discoveryId || !activity.natureVisible || !activity.natureReady) return;
            const mode = document.querySelector('.island-page')?.dataset.mode;
            const key = `${activity.discoveryId}:${activity.itemId}:${mode}`;
            if (frameKeys.has(key)) return;
            const canvas = host.querySelector('canvas'), rect = canvas?.getBoundingClientRect();
            if (!rect || rect.width < 100 || rect.height < 100 || rect.bottom <= 0 || rect.top >= innerHeight
                || rect.right <= 0 || rect.left >= innerWidth) return;
            frameKeys.add(key);
            try { audit.frames.push({ at: performance.now(), timestamp: Number(host.dataset.frameTimestamp), mode,
                hidden: document.hidden, activity,
                observationFrame: JSON.parse(host.dataset.observationFrame || 'null'),
                cameraFrame: host.dataset.cameraFrame,
                playRequestId: host.dataset.playRequestId, playStatus: host.dataset.playStatus,
                viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
                canvas: { width: canvas.width, height: canvas.height, rect: rect.toJSON() },
                png: canvas.toDataURL('image/png') }); }
            catch (error) { audit.errors.push(String(error)); }
        };
        const observer = new MutationObserver(sample);
        observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-frame-timestamp'] });
        for (const method of ['put', 'add', 'delete', 'clear']) {
            const original = IDBObjectStore.prototype[method];
            IDBObjectStore.prototype[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                if (this.transaction.db.name !== 'SansuDatabase') return result;
                let pending = transactions.get(this.transaction);
                if (!pending) {
                    pending = []; transactions.set(this.transaction, pending);
                    this.transaction.addEventListener('complete', () => {
                        const events = pending.filter(value => value.store === 'islandEvents' && (value.value?.type === 'discovery_observed'
                            || value.value?.type === 'workshop_changed' && value.value.action?.type === 'observe-creation'));
                        for (const event of events) {
                            const owner = event.value.profileId;
                            audit.commits.push({ at: performance.now(), mode: document.querySelector('.island-page')?.dataset.mode,
                                event: event.value, before: latest.get(owner), operations: pending });
                        }
                        for (const value of pending) if (value.store === 'islands' && value.value?.profileId) latest.set(value.value.profileId, value.value);
                    });
                }
                pending.push({ store: this.name, method, value: structuredClone(args[0]) });
                return result;
            };
        }
    });
}
async function checkRead(page, row, name, before) {
    const after = await tables(page); let records;
    try {
        records = assertDiscoveryDelta(before, after, row.owner);
        const audit = await page.evaluate(() => window.__qualifiedObservations);
        assert.deepEqual(audit.errors, []);
        for (const record of records) {
            const commit = audit.commits.find(entry => entry.event.profileId === row.owner && entry.event.discoveryId === record.id);
            assert(commit?.before, 'Only native complete discovery transactions may accompany a read/navigation');
            assert.deepEqual(commit.operations.map(entry => entry.store).sort(), ['islandEvents', 'islands']);
            const saved = commit.operations.find(entry => entry.store === 'islands').value;
            assertDiscoveryDelta({ islands: [commit.before], islandEvents: [] }, { islands: [saved], islandEvents: [commit.event] }, row.owner);
            const frame = audit.frames.find(entry => entry.activity.discoveryId === record.id && entry.activity.itemId === record.itemId
                && !entry.hidden && entry.at <= commit.at && ['home', 'play', 'viewing', 'camera'].includes(entry.mode));
            assert(frame && Number.isFinite(frame.timestamp) && frame.activity.natureVisible && frame.activity.natureReady);
            if (!row.observations.some(entry => entry.id === record.id)) {
                const file = `${row.name}-${record.id}-natural-ready.png`; await fs.writeFile(path.join(out, file), Buffer.from(frame.png.split(',')[1], 'base64'));
                row.observations.push({ id: record.id, itemId: record.itemId, nativeCommit: commit.event, commitAt: commit.at, frame: { ...frame, png: undefined, file } });
            }
        }
        row.databaseChecks.push({ name, pass: true, permittedDiscoveries: records.map(record => record.id), before: digestTables(before), after: digestTables(after) });
    } finally { await fs.writeFile(`${out}/${row.name}-DB-${row.databaseChecks.length}-${name}.json`, JSON.stringify({ before, after }, null, 2)); }
    return after;
}
async function readOnly(page, row, name, action) { const before = await tables(page); await action(); await idle(page); await painted(page); return checkRead(page, row, name, before); }

const panel = page => page.getByTestId('island-learning-keepsakes');
const choice = (page, id) => panel(page).locator(`[data-keepsake-choice="${id}"]`);
const shown = state => state.learningKeepsakes?.displayed ?? [];
const order = rows => rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
async function roomGeometry(page) {
    return stage(page).evaluate(host => {
        const canvas = host.querySelector('canvas'), rect = canvas?.getBoundingClientRect();
        return { room: JSON.parse(host.dataset.keepsakeRoom || 'null'), frame: Number(host.dataset.frameTimestamp),
            camera: host.dataset.cameraFrame?.split(',').map(Number), mode: document.querySelector('.island-page')?.dataset.mode,
            section: document.querySelector('[data-testid="island-learning-keepsakes"]')?.dataset.keepsakeSection,
            projectionViewport: { width: host.clientWidth, height: host.clientHeight },
            viewport: { width: innerWidth, height: innerHeight }, canvas: rect?.toJSON(), hidden: document.hidden,
            onscreen: Boolean(rect && rect.width > 100 && rect.height > 100 && rect.bottom > 0 && rect.top < innerHeight
                && rect.right > 0 && rect.left < innerWidth) };
    });
}
async function waitRoom(page, displayed, selectedId = null, previousFrame) {
    await waitWorld(page);
    await page.waitForFunction(({ displayed, selectedId, previousFrame, candidate }) => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        const room = JSON.parse(host?.dataset.keepsakeRoom || 'null'), mode = document.querySelector('.island-page')?.dataset.mode;
        return !document.hidden && ['keepsakes', 'camera'].includes(mode) && box?.height > 100 && box.bottom > 0 && box.top < innerHeight
            && room?.candidate === candidate && room.visible && room.selectedId === selectedId
            && JSON.stringify(room.awards.filter(award => award.visible).map(award => award.id)) === JSON.stringify(displayed)
            && Number.isFinite(Number(host.dataset.frameTimestamp)) && (!previousFrame || Number(host.dataset.frameTimestamp) > previousFrame)
            && host.dataset.cameraFrame?.split(',').length === 32;
    }, { displayed, selectedId, previousFrame, candidate });
    // Observe the actual camera reaching a stable composition; an elapsed entry
    // transition alone is not evidence that the visible interior has settled.
    await page.evaluate(() => new Promise((resolve, reject) => {
        let previous, unchanged = 0, stopped = false;
        const timeout = setTimeout(() => { stopped = true; reject(new Error('Visible keepsake camera did not settle')); }, 15000);
        const sample = () => {
            if (stopped) return;
            const host = document.querySelector('[data-testid="island-stage"]'), rect = host?.querySelector('canvas')?.getBoundingClientRect();
            const camera = host?.dataset.cameraFrame, room = JSON.parse(host?.dataset.keepsakeRoom || 'null');
            if (!document.hidden && room?.visible && rect?.bottom > 0 && rect.top < innerHeight && camera?.split(',').length === 32) {
                unchanged = camera === previous ? unchanged + 1 : 0; previous = camera;
                if (unchanged >= 4) { stopped = true; clearTimeout(timeout); resolve(); return; }
            } else { previous = undefined; unchanged = 0; }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    }));
    const actual = await roomGeometry(page);
    assert(actual.onscreen && !actual.hidden); assert.equal(actual.room.awards.length, 16);
    assert.equal(actual.room.selectedId, selectedId); assert.deepEqual(actual.room.awards.filter(award => award.visible).map(award => award.id), displayed);
    assert.equal(actual.camera.length, 32); assert(actual.camera.every(Number.isFinite)); return actual;
}
async function capture(page, row, name) {
    const file = `${row.name}-${String(row.captures++).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const actual = await roomGeometry(page).catch(() => null), entry = { name, file, metadata, actual };
    if (actual?.onscreen && !actual.hidden && ['keepsakes', 'camera'].includes(actual.mode)) {
        entry.stageFile = file.replace('.png', '-stage.png');
        await stage(page).screenshot({ path: path.join(out, entry.stageFile) });
    }
    report.captures.push(entry);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ viewport: row.name, checkpoint: name, answers: row.answerCount, file, stageFile: entry.stageFile }));
}
async function exactBoundary(page, row, name, before, validate) {
    const after = await tables(page);
    try {
        validate(after);
        row.databaseChecks.push({ name, pass: true, before: digestTables(before), after: digestTables(after) });
    } finally { await fs.writeFile(`${out}/${row.name}-DB-${row.databaseChecks.length}-${name}.json`, JSON.stringify({ before, after }, null, 2)); }
    return after;
}
async function select(page, row, id) {
    await readOnly(page, row, `select-${id}-${row.databaseChecks.length}`, async () => {
        await activate(choice(page, id), row.touch);
        await page.waitForFunction(id => document.querySelector('[data-testid="island-learning-keepsakes"]')?.dataset.keepsakeSelected === id
            && document.querySelector(`[data-keepsake-choice="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
    });
}
async function display(page, row, action, expectedIds) {
    const control = panel(page).locator(`[data-keepsake-action="${action.type === 'display-earned' ? 'display-earned' : action.displayed ? 'display' : 'store'}"]`);
    await control.scrollIntoViewIfNeeded(); await idle(page);
    const geometryBefore = await roomGeometry(page), before = await tables(page), prior = islandFor(before, row.owner);
    assert.equal(await control.isDisabled(), false);
    await activate(control, row.touch);
    await page.waitForFunction(async ({ owner, revision }) => {
        const opened = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { opened.onsuccess = () => resolve(opened.result); opened.onerror = () => reject(opened.error); });
        try { const request = db.transaction('islands').objectStore('islands').get(owner);
            const value = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            return value?.revision === revision + 1;
        } finally { db.close(); }
    }, { owner: row.owner, revision: prior.revision });
    await idle(page); await painted(page);
    const after = await exactBoundary(page, row, `display-${row.databaseChecks.length}`, before, after => {
        const next = islandFor(after, row.owner), expected = structuredClone(before);
        expected.islands = expected.islands.map(value => value.profileId === row.owner ? { ...prior,
            learningKeepsakes: { version: 1, displayed: expectedIds }, revision: prior.revision + 1, updatedAt: next.updatedAt } : value);
        const receipt = { id: JSON.stringify(['island-learning-keepsakes-v1', row.owner, prior.revision]), profileId: row.owner,
            type: 'learning_keepsakes_changed', timestamp: next.updatedAt, action };
        expected.islandEvents = order([...expected.islandEvents, receipt]);
        assert.deepEqual(after, expected, 'Only the memorial selection, revision, timestamp and one canonical receipt may change');
    });
    const selected = await panel(page).getAttribute('data-keepsake-selected');
    // Storing the focused object falls back to the room. Other selections remain the same actual object.
    const previousFocus = geometryBefore.room?.selectedId;
    const expectedFocus = previousFocus && expectedIds.includes(previousFocus) ? previousFocus : null;
    const actual = await waitRoom(page, expectedIds, expectedFocus, geometryBefore.frame);
    row.displayWrites.push({ action, selected, inputWasOnscreen: geometryBefore.onscreen, before: geometryBefore, after: actual,
        revision: islandFor(after, row.owner).revision });
    return actual;
}
async function enterRoom(page, row, expectedIds) {
    await readOnly(page, row, `room-entry-${row.databaseChecks.length}`, async () => {
        await activate(page.locator('[data-home-action="keepsakes"]'), row.touch); await waitMode(page, 'keepsakes');
        await waitHouseSection(page, 'home');
        const home = await waitRoom(page, expectedIds);
        if (!row.houseOverview) {
            for (const action of ['album', 'shared', 'notices', 'open-keepsakes']) {
                const entry = panel(page).locator(`[data-keepsake-action="${action}"]`);
                assert.equal(await entry.count(), 1); assert(await entry.isVisible()); assert(await entry.isEnabled());
            }
            row.houseOverview = home; await capture(page, row, 'house-interior-overview');
            const pendingCount = (await readNative(page, row.owner)).island.pendingRewards.length;
            await activate(panel(page).locator('[data-keepsake-action="notices"]'), row.touch);
            await waitHouseSection(page, 'notices');
            const reward = panel(page).locator('[data-keepsake-action="rewards"]');
            if (pendingCount === 0) {
                assert.equal(await reward.count(), 0);
                await panel(page).getByText('いまは あたらしい おしらせは ないよ', { exact: true }).waitFor();
            } else {
                assert.equal(await reward.count(), 1);
                await panel(page).getByText(`おくりものが ${pendingCount}こ あるよ。`, { exact: true }).waitFor();
            }
            row.houseNotices = { pendingCount, rewardActions: await reward.count() };
            await waitRoom(page, expectedIds); await capture(page, row, 'house-genuine-notices');
            await activate(panel(page).locator('[data-keepsake-action="home"]'), row.touch); await waitHouseSection(page, 'home');
            const returned = await waitRoom(page, expectedIds);
            assert.equal(returned.room.uuid, home.room.uuid);
            assert.deepEqual(returned.room.awards.map(award => award.uuid), home.room.awards.map(award => award.uuid));
        }
        await activate(panel(page).locator('[data-keepsake-action="open-keepsakes"]'), row.touch); await waitHouseSection(page, 'keepsakes');
        await waitRoom(page, expectedIds);
    });
}
async function waitHouseSection(page, section) {
    await page.waitForFunction(section => document.querySelector('.island-page')?.dataset.mode === 'keepsakes'
        && document.querySelector('[data-testid="island-learning-keepsakes"]')?.dataset.keepsakeSection === section, section);
    assert(await panel(page).isVisible());
}
async function closeRoom(page, row) {
    await readOnly(page, row, `room-exit-${row.databaseChecks.length}`, async () => {
        const expectedIds = shown((await readNative(page, row.owner)).island);
        await activate(panel(page).locator('[data-keepsake-action="home"]'), row.touch); await waitHouseSection(page, 'home');
        await waitRoom(page, expectedIds);
        await activate(panel(page).locator('[data-keepsake-action="close"]'), row.touch); await waitMode(page, 'home'); await waitWorld(page);
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.keepsakeRoom || 'null')?.visible === false);
    });
}
async function finishSection(page, row) {
    let native = await readNative(page, row.owner), original = native.plan; assert(original?.status === 'active');
    const initialCount = native.island.completedSets, previousSelection = native.island.learningKeepsakes;
    const answerCount = row.answerCount;
    while (native.plan.id === original.id) {
        await waitLearningInput(page, native.plan);
        const result = await answerUI(page, native.plan, { touch: row.touch, dev: false });
        row.answerCount++; assert(row.answerCount <= 32, 'Only five ordinary sections plus one final check answer are in scope');
        row.answers.push({ planId: native.plan.id, revision: native.plan.revision, autoContinued: result.autoContinued,
            ms: result.ms, additionalContinueTaps: 0 }); native = result.state;
        assert.deepEqual(native.island.learningKeepsakes, previousSelection);
    }
    assert.equal(native.island.completedSets, initialCount + 1);
    assert.equal(row.answerCount - answerCount, original.slots.length);
    const complete = native.islandPlans.find(value => value.id === original.id), event = native.islandEvents.find(value => value.id === `${original.id}:completed`);
    assert.equal(complete.status, 'completed'); assert.equal(complete.cursor, complete.slots.length); assert(complete.slots.every(slot => slot.completed));
    assert.equal(event?.type, 'plan_completed'); assert.equal(event.timestamp, complete.completedAt);
    row.sections.push({ plan: complete, completion: event, answers: original.slots.length, completedSets: native.island.completedSets });
    return native;
}
async function enterLearning(page, row, fromRoom = false) {
    const before = await readNative(page, row.owner), plan = before.plan;
    assert.equal(before.island.pendingPlanId, plan.id); assert.equal(plan.status, 'active');
    await readOnly(page, row, `resume-${row.databaseChecks.length}`, async () => {
        const control = fromRoom ? panel(page).locator('[data-keepsake-action="learn"]') : page.locator('.island-home-controls .island-start');
        if (!fromRoom) assert.equal((await control.innerText()).trim(), 'つづきから とく');
        await activate(control, row.touch); await waitLearningInput(page, plan);
        assert.deepEqual((await readNative(page, row.owner)).plan, plan);
    });
    return plan;
}
async function saveRoomPhoto(page, row) {
    const beforeEntry = await tables(page), geometry = await waitRoom(page, ['first-completion']);
    const camera = page.getByTestId('island-photo-camera');
    await activate(button(panel(page), 'しゃしんに のこす'), row.touch); await waitMode(page, 'camera');
    const actual = await waitRoom(page, ['first-completion']);
    row.photoFraming = { before: geometry, after: actual };
    assert.deepEqual(actual.camera.slice(0, 16), geometry.camera.slice(0, 16), 'Photography keeps the same world camera position and rotation inside the house');
    assert.deepEqual(actual.room, geometry.room, 'Photography keeps the same actual house and award objects');
    assert.deepEqual(actual.camera.slice(16).filter((_, index) => ![0, 5].includes(index)),
        geometry.camera.slice(16).filter((_, index) => ![0, 5].includes(index)), 'Only Perspective projection scales may adapt to the changed canvas');
    for (const frame of [geometry, actual]) {
        const { width, height } = frame.projectionViewport, aspect = width / height;
        const x = frame.camera[16], y = frame.camera[21];
        assert(width > 0 && height > 0 && x > 0 && y > 0);
        // Both projection entries are serialized by the app to five decimals;
        // account only for their rounding, using the renderer's actual client size.
        assert(Math.abs(y - x * aspect) <= .000005 * (1 + aspect) + Number.EPSILON,
            'Perspective projection must match the actual renderer viewport aspect');
    }
    assert.equal(await button(camera.locator('.island-photo-targets'), 'いえ').getAttribute('aria-pressed'), 'true');
    const before = await checkRead(page, row, 'camera-entry-read', beforeEntry);
    await activate(camera.locator('[data-photo-action="capture"]'), row.touch);
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.dataset.photoStatus === 'saved');
    await idle(page); const after = await tables(page), previousIds = new Set(before.islandPhotos.map(photo => photo.id));
    const additions = after.islandPhotos.filter(photo => !previousIds.has(photo.id)); assert.equal(additions.length, 1);
    const photo = additions[0], blob = after.islandPhotoBlobs.find(value => value.id === photo.id);
    await exactBoundary(page, row, 'actual-room-photo', before, measured => {
        assert.equal(photo.profileId, row.owner); assert.equal(photo.composition, 'island'); assert.equal(photo.targetName, 'いえ');
        assert(blob && blob.profileId === row.owner);
        for (const kind of ['image', 'thumbnail']) {
            assert.equal(blob[kind].mime, 'image/png'); assert(blob[kind].bytes > 0);
            assert.equal(blob[kind].sha256, photo[kind].sha256); assert.equal(blob[kind].bytes, photo[kind].bytes);
        }
        const expected = structuredClone(before), previousAlbum = expected.islandPhotoAlbums.find(value => value.profileId === row.owner);
        const revision = previousAlbum?.revision ?? 0;
        if (previousAlbum) previousAlbum.revision++; else expected.islandPhotoAlbums.push({ profileId: row.owner, version: 1, revision: 1 });
        expected.islandPhotos = order([...expected.islandPhotos, photo]); expected.islandPhotoBlobs = order([...expected.islandPhotoBlobs, blob]);
        const receipts = measured.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id)); assert.equal(receipts.length, 1);
        const receipt = receipts[0]; assert.equal(receipt.id, JSON.stringify(['island-photo:v1:operation', row.owner, revision]));
        assert.equal(receipt.type, 'photo_changed'); assert.equal(receipt.profileId, row.owner); assert.deepEqual(receipt.action, { type: 'save-photo', photo });
        assert.equal(receipt.photoReceipt.photoId, photo.id); assert.equal(receipt.photoReceipt.albumRevision, revision);
        assert.equal(receipt.photoReceipt.result, 'saved'); assert.equal(receipt.photoReceipt.intentDigest, sha(JSON.stringify({ type: 'save-photo', photo })));
        expected.islandEvents = order([...expected.islandEvents, receipt]); assert.deepEqual(measured, expected);
    });
    const pending = page.waitForEvent('download'); await activate(button(camera, 'PNGで とりだす'), row.touch);
    const download = await pending, file = `${row.name}-room-original.png`; await download.saveAs(path.join(out, file));
    assert.equal(sha(await fs.readFile(path.join(out, file))), photo.image.sha256);
    row.photo = { metadata: photo, blob, file, room: actual };
    await waitRoom(page, ['first-completion']); await capture(page, row, 'actual-room-photo');
    await readOnly(page, row, 'camera-exit-read', async () => {
        await activate(button(camera, 'カメラを とじる'), row.touch); await waitMode(page, 'keepsakes'); await waitRoom(page, ['first-completion']);
    });
}
async function run(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    row.owner = `keepsakes-${row.name}`; await seedNative(page, row.owner);
    const seeded = await tables(page);
    for (const name of Object.keys(empty).filter(name => !['profiles', 'appData'].includes(name))) assert.deepEqual(seeded[name], empty[name]);
    await fs.writeFile(`${out}/${row.name}-native-profile-fixture.json`, JSON.stringify({ before: empty, after: seeded, progressInjected: false }, null, 2));
    await page.reload(); await waitMode(page, 'home'); await waitReady(page);
    let state = await readNative(page, row.owner); assert.equal(state.island.completedSets, 0); assert.equal(state.plan, undefined);
    const start = page.locator('.island-home-controls .island-start'); assert.equal((await start.innerText()).trim(), 'まなぶ');
    await activate(start, row.touch); await waitLearningInput(page);
    state = await finishSection(page, row); assert.equal(row.answerCount, 3); assert.equal(state.island.customization.points, 3);
    assert.equal(state.island.learningKeepsakes, undefined);
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await waitWorld(page); await capture(page, row, 'first-three-real-answers');
    await enterRoom(page, row, []);
    assert.equal(await choice(page, 'first-completion').getAttribute('data-keepsake-state'), 'stored');
    assert.equal(await panel(page).locator('[data-keepsake-state="locked"]').count(), 15);
    await select(page, row, 'first-completion');
    await readOnly(page, row, 'open-earned-history', async () => {
        const history = panel(page).locator('[data-keepsake-history]');
        assert.equal(await history.getAttribute('open'), null);
        await activate(history.locator(':scope > summary'), row.touch);
        await panel(page).locator('[data-keepsake-earned-date]').waitFor();
    });
    const date = new Date(row.sections[0].plan.completedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
    assert((await panel(page).locator('[data-keepsake-earned-date]').innerText()).includes(date));
    await display(page, row, { type: 'display', keepsakeId: 'first-completion', displayed: true }, ['first-completion']);
    await select(page, row, 'first-completion'); const close = await waitRoom(page, ['first-completion'], 'first-completion');
    await capture(page, row, 'certificate-closeup');
    await readOnly(page, row, 'whole-room', async () => { await activate(panel(page).locator('[data-keepsake-action="room"]'), row.touch); });
    const wide = await waitRoom(page, ['first-completion']); assert.notDeepEqual(close.camera, wide.camera);
    assert.equal(close.room.awards.find(award => award.id === 'first-completion').uuid, wide.room.awards.find(award => award.id === 'first-completion').uuid);
    await capture(page, row, 'certificate-in-room');
    await readOnly(page, row, 'reopen-certificate-shelf', async () => { await activate(panel(page).locator('[data-keepsake-action="open-keepsakes"]'), row.touch); });
    await display(page, row, { type: 'display', keepsakeId: 'first-completion', displayed: false }, []);
    await capture(page, row, 'certificate-stored');
    await display(page, row, { type: 'display', keepsakeId: 'first-completion', displayed: true }, ['first-completion']);
    await saveRoomPhoto(page, row); await closeRoom(page, row);
    await enterLearning(page, row);
    while ((await readNative(page, row.owner)).island.completedSets < 5) await finishSection(page, row);
    state = await readNative(page, row.owner); assert.equal(state.island.completedSets, 5); assert.deepEqual(shown(state.island), ['first-completion']);
    assert.equal(row.answerCount, row.sections.reduce((sum, section) => sum + section.plan.slots.length, 0));
    assert.equal(state.island.customization.points, row.answerCount, 'All display and photo operations are free; only whole completed problems earn stars');
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterRoom(page, row, ['first-completion']);
    assert.equal(await choice(page, 'completed-5').getAttribute('data-keepsake-state'), 'stored');
    assert.equal(await panel(page).locator('[data-keepsake-state="locked"]').count(), 14);
    await select(page, row, 'completed-5');
    await display(page, row, { type: 'display-earned' }, ['first-completion', 'completed-5']);
    await select(page, row, 'completed-5'); await waitRoom(page, ['first-completion', 'completed-5'], 'completed-5');
    await capture(page, row, 'earned-trophy-closeup');
    await readOnly(page, row, 'two-earned-whole-room', async () => { await activate(panel(page).locator('[data-keepsake-action="room"]'), row.touch); });
    await waitRoom(page, ['first-completion', 'completed-5']); await capture(page, row, 'two-earned-awards');
    await readOnly(page, row, 'reopen-earned-shelf', async () => { await activate(panel(page).locator('[data-keepsake-action="open-keepsakes"]'), row.touch); });
    await select(page, row, 'first-completion'); await display(page, row, { type: 'display', keepsakeId: 'first-completion', displayed: false }, ['completed-5']);
    await closeRoom(page, row); const beforeReload = await tables(page), reserved = (await readNative(page, row.owner)).plan;
    await page.reload(); await waitLearningInput(page, reserved); // A live pending reservation is the route's reload destination.
    await checkRead(page, row, 'reload-retains-selection-and-photo', beforeReload);
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterRoom(page, row, ['completed-5']);
    await select(page, row, 'first-completion'); await display(page, row, { type: 'display', keepsakeId: 'first-completion', displayed: true }, ['first-completion', 'completed-5']);
    const plan = await enterLearning(page, row, true), beforeAnswer = await tables(page), island = islandFor(beforeAnswer, row.owner);
    assert.equal(plan.id, reserved.id); assert.equal(plan.revision, reserved.revision);
    assert(plan.cursor < plan.slots.length - 1 && !island.pendingMathChecks?.length, 'Require a non-final answer with no pending independent check');
    const result = await answerUI(page, plan, { touch: row.touch, dev: false }); row.answerCount++;
    assert.equal(result.state.plan.id, plan.id); assert.equal(result.state.plan.revision, plan.revision + 1); assert.equal(result.state.plan.status, 'active');
    const answered = await tables(page); assert.deepEqual(answered.islands, beforeAnswer.islands, 'A non-final ordinary answer preserves the entire islands store, including every keepsake');
    for (const name of ['islandPhotos', 'islandPhotoAlbums', 'islandPhotoBlobs']) assert.deepEqual(answered[name], beforeAnswer[name]);
    row.learning = { planId: plan.id, beforeRevision: plan.revision, afterRevision: result.state.plan.revision,
        nonFinal: true, allIslandRowsPreserved: true, additionalContinueTaps: 0 };
    await fs.writeFile(`${out}/${row.name}-ordinary-answer-fullDB.json`, JSON.stringify({ before: beforeAnswer, after: answered }, null, 2));
    await page.reload(); await waitLearningInput(page, result.state.plan); await checkRead(page, row, 'same-answer-reload', answered);
    await capture(page, row, 'same-reservation-resumed'); assert.deepEqual(row.errors, []); row.pass = true;
}
const { chromium } = await import('playwright'); let browser;
try {
    const version = await (await fetch(`${target}/version.json`)).json(); report.servedVersion = version;
    assert.equal(version.revision, manifest.revision, 'Served app revision must match the immutable source manifest');
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_KEEPSAKES_HEADED !== '1' }); report.browserVersion = browser.version();
    for (const layout of viewports) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion,
            serviceWorkers: 'allow', timezoneId: 'Asia/Tokyo' });
        await installObservationAudit(context); await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, answerCount: 0, captures: 0, errors: [], databaseChecks: [], sections: [], observations: [], answers: [], displayWrites: [] };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try { await run(page, row); }
        catch (error) { row.failure = error.stack; process.exitCode = 1; await capture(page, row, 'failure').catch(() => {});
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => '')); }
        finally {
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-natural-audit.json`, JSON.stringify(await page.evaluate(() => window.__qualifiedObservations).catch(() => null), null, 2));
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = report.layouts.length === 2 && report.layouts.every(row => row.pass);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    await browser?.close(); report.browserClosed = true;
    try { report.finalSource = await fingerprint(); assert.deepEqual(report.finalSource, initialSource); report.sourceStable = true; }
    catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Learning keepsakes</title><p>${manifest.revision}: five real completed sections; human N=0</p>${report.captures.map(entry => `<figure><img width="390" src="${entry.stageFile || entry.file}"><figcaption>${entry.name}</figcaption></figure>`).join('')}`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, sourceStable: report.sourceStable, browserClosed: report.browserClosed,
        layouts: report.layouts.map(row => ({ name: row.name, pass: row.pass, answers: row.answerCount, failure: row.failure?.split('\n')[0] })) }));
}
