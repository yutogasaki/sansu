import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, expectedAnswer, waitLearningReady } from './island-learning-checks.mjs';

const scenarios = [
    'Empty database -> real onboarding -> one normal learning section -> workshop',
    'One released canvas brush stroke -> individually saved touched surface regions',
    'Native IndexedDB abort -> every table rolls back -> retry preserves the receipt',
    'Failed move A, then B, then A -> gesture FIFO saves all three in that order',
    'Committed save-work/undo with lost completion delivery -> another tab moves -> original receipt replay',
    'Actual document.hidden during a visible tool operation -> no hidden workshop writes or observations',
    'Tool operation -> ordinary learning -> no late workshop writer; same reserved question remains answerable',
    'Installed service worker -> offline reload -> saved draft/name/undo retained -> normal offline answer',
    'Real second-profile onboarding -> independent first learning/workshop -> switch back preserves first owner',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, scenarios }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_WORKSHOP_PERSISTENCE_URL || process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_WORKSHOP_PERSISTENCE_OUTPUT;
assert(target && out, 'Set SANSU_WORKSHOP_PERSISTENCE_URL and a fresh SANSU_WORKSHOP_PERSISTENCE_OUTPUT');
assert(process.env.SANSU_ISLAND_BUILD_SOURCE, 'Use a frozen production target and SANSU_ISLAND_BUILD_SOURCE for real offline evidence');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const qaFiles = ['tools/e2e-island-workshop-persistence.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...manifest.files.map(file => file.path), ...qaFiles].map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const initialSource = await fingerprint();
assert.deepEqual(initialSource.slice(0, manifest.files.length), manifest.files.map(({ path, sha256 }) => ({ path, sha256 })), 'Frozen source must match the build manifest');
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, preparedScenarios: scenarios, captures: [], layouts: [],
    scope: 'Real UI acquisition and real IndexedDB persistence. No profile/progress/specimen/draft fixtures and no app action dispatch from evaluate. Native transaction abort and a separately labelled post-commit completion-delivery fault exercise recovery. Native hidden state is required, never replaced with a synthetic visibility property. This is integrity evidence, not child motivation, speaker quality, or causal learning evidence.' };
const require = createRequire(import.meta.url);
const { CRSession } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/crConnection.js'));
const driverSend = CRSession.prototype.send;
report.driverFocus = { command: 'Emulation.setFocusEmulationEnabled', originalEnabled: true, replacementEnabled: false,
    dependencyFilesModified: false, appVisibilityPropertyModified: false, overrides: [] };
// Restore native tab visibility in Playwright's OWN main-frame protocol session.
// Sending false from an additional CDP session leaves the driver's original true
// setting active. This interception changes only the test process, never files.
CRSession.prototype.send = function (method, params) {
    if (method === report.driverFocus.command && params?.enabled === true) {
        report.driverFocus.overrides.push({ sessionId: this._sessionId, at: new Date().toISOString() });
        return driverSend.call(this, method, { ...params, enabled: false });
    }
    return driverSend.call(this, method, params);
};
const browser = await chromium.launch({ headless: process.env.SANSU_WORKSHOP_PERSISTENCE_HEADED !== '1' });
report.browser = browser.version();
const stage = page => page.getByTestId('island-stage').first();
const panel = page => page.locator('.island-workshop');
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Read every native table; observation only, including when another page is hidden. */
async function allTables(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = [...database.objectStoreNames], transaction = database.transaction(names, 'readonly');
        const rows = await Promise.all(names.map(name => new Promise((resolve, reject) => {
            const get = transaction.objectStore(name).getAll(); get.onsuccess = () => resolve([name, get.result]); get.onerror = () => reject(get.error);
        })));
        database.close(); return Object.fromEntries(rows);
    });
}
const workshopEvents = (state, id) => state.islandEvents.filter(event => event.profileId === id && event.type === 'workshop_changed');
const receiptRevision = event => JSON.parse(event.id.slice('island-workshop:v1:operation:'.length))[1];
const eventDelta = (before, after, id) => workshopEvents(after, id).filter(event => !workshopEvents(before, id).some(old => old.id === event.id))
    .sort((left, right) => receiptRevision(left) - receiptRevision(right));
function unchangedLearningAndWorld(before, after) {
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name], `${name} changed in optional workshop`);
    const strip = island => { const copy = structuredClone(island); delete copy.workshop; delete copy.revision; delete copy.updatedAt; return copy; };
    assert.deepEqual(after.islands.map(strip), before.islands.map(strip), 'Workshop cannot change growth, items, wallet, customization, experience or reservation');
    assert.deepEqual(after.islandEvents.filter(event => event.type !== 'workshop_changed'), before.islandEvents.filter(event => event.type !== 'workshop_changed'));
}
function unchangedOtherProfile(before, after, id) {
    for (const name of Object.keys(before)) {
        if (name === 'appData' || name === 'profiles') continue; // UI profile creation/selection legitimately changes these two tables.
        assert.deepEqual(after[name].filter(row => row.profileId === id), before[name].filter(row => row.profileId === id), `${name} changed for inactive profile ${id}`);
    }
    assert.deepEqual(after.profiles.find(row => row.id === id), before.profiles.find(row => row.id === id));
}
async function capture(page, name) {
    await stage(page).scrollIntoViewIfNeeded(); const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, workshop: await stage(page).getAttribute('data-workshop') });
}
async function waitWorkshop(page, id, predicate, label, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const state = await readNative(page, id);
        if (state.island?.workshop && predicate(state.island.workshop)) { await idle(page); return state; }
        await sleep(80);
    }
    throw new Error(`Workshop did not reach ${label}`);
}
async function openDetails(page, text) {
    const summary = panel(page).locator('summary').filter({ hasText: text });
    if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
async function command(page, label) { await idle(page); await panel(page).getByRole('button', { name: label, exact: true }).click(); }
async function enterWorkshop(page) {
    await waitReady(page);
    if (await page.locator('.island-page[data-mode="learning"]').count()) { await button(page, 'しまへ').click(); await waitMode(page, 'home'); }
    await idle(page); await button(page, 'おためしの いりえ').click(); await waitMode(page, 'workshop');
}
async function setName(page, value) {
    await openDetails(page, 'たなに かざる'); await page.locator('#workshop-specimen-name').fill(value);
    await panel(page).getByRole('button', { name: 'きめる', exact: true }).click();
}
async function failed(page, count) {
    await panel(page).locator('.island-workshop-error').waitFor(); await idle(page);
    if (count !== undefined) await page.waitForFunction(count => window.__workshopPersistence.faults.length >= count, count);
}

/** Same real first-section/keypad flow as e2e-island-workshop.mjs. The complete
 * automatic last digit is already the submit gesture; do not submit twice. */
async function answerLearning(page, before, touch) {
    await waitLearningReady(page, before.plan);
    const submit = page.locator('.park-answer .park-keypad [data-keypad-submit]');
    if (!await submit.count() || await submit.getAttribute('data-confirmation-mode') !== 'automatic') return (await attempt(page, before, { touch })).after;
    const inputType = await page.locator('.park-answer').getAttribute('data-input-type');
    const expected = await expectedAnswer(page, before.plan.slots[before.plan.cursor]);
    const values = Array.isArray(expected.values) ? expected.values : [expected.values];
    for (const [index, value] of values.entries()) {
        if (inputType !== 'hissan') await page.locator('.park-input').nth(index).click();
        for (const digit of String(value)) {
            if (touch) await page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }).tap();
            else await page.keyboard.type(digit);
        }
    }
    await page.waitForFunction(({ id, revision }) => {
        const root = document.querySelector('[data-island-plan-id]');
        return document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward'
            || root?.getAttribute('data-input-ready') === 'true' && (root.getAttribute('data-island-plan-id') !== id || Number(root.getAttribute('data-island-plan-revision')) === revision + 1);
    }, { id: before.plan.id, revision: before.plan.revision });
    const after = await readNative(page, before.island.profileId), saved = after.islandPlans.find(plan => plan.id === before.plan.id);
    assert.equal(saved.revision, before.plan.revision + 1);
    assert.deepEqual(saved.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.equal(after.islandEvents.filter(event => event.type === 'answer' && !before.islandEvents.some(old => old.id === event.id)).length, 1);
    return after;
}
async function finishFirstSection(page, touch) {
    let state = await readNative(page), profileId = state.island.profileId;
    if (!state.plan) { await button(page, 'まなぶ').click(); await waitMode(page, 'learning'); state = await readNative(page, profileId); }
    const reservation = state.plan.id;
    for (let count = 0; state.plan?.id === reservation; count++) { assert(count < 80); state = await answerLearning(page, state, touch); }
    assert.equal(state.island.completedSets, 1);
    assert.equal(state.island.customization.points, state.islandPlans.find(plan => plan.id === reservation).slots.length, 'Stars come from the actual normal completed questions');
    return state;
}

/** Instrument native storage, without importing an app module or manufacturing a
 * saved action. A lost completion is explicitly a delivery fault, not a native
 * abort: the native transaction really commits and its receipt remains on disk. */
async function instrument(context) {
    await context.addInitScript(() => {
        const nativeTransaction = IDBDatabase.prototype.transaction, nativeAdd = IDBObjectStore.prototype.add;
        const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
        if (!complete?.get || !complete?.set) throw new Error('Native completion instrumentation unavailable');
        const meta = new WeakMap(); let armed;
        const sample = () => ({ at: performance.now(), hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus(),
            mode: document.querySelector('.island-page')?.getAttribute('data-mode') ?? null });
        const diagnostic = window.__workshopPersistence = { documentId: crypto.randomUUID(), transactions: [], faults: [], visibility: [sample()],
            arm(value) { armed = value; }, disarm() { armed = undefined; } };
        document.addEventListener('visibilitychange', () => diagnostic.visibility.push(sample()));
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = nativeTransaction.apply(this, args);
            if (transaction.mode !== 'readwrite' || !transaction.objectStoreNames.contains('islands')) return transaction;
            const entry = { start: sample(), nativeOutcome: 'pending', actions: [] }; meta.set(transaction, entry);
            diagnostic.transactions.push(entry);
            transaction.addEventListener('complete', () => { entry.nativeOutcome = 'complete'; entry.end = sample(); });
            transaction.addEventListener('abort', () => { entry.nativeOutcome = 'abort'; entry.end = sample(); });
            return transaction;
        };
        IDBObjectStore.prototype.add = function (value, ...args) {
            const entry = meta.get(this.transaction);
            if (this.name === 'islandEvents' && value?.type === 'workshop_changed' && entry) {
                entry.actions.push(structuredClone(value));
                if (armed && (!armed.profileId || armed.profileId === value.profileId) && (!armed.type || armed.type === value.action.type)
                    && (!armed.editType || armed.editType === value.action.edit?.type)) {
                    const mode = armed.mode; if (--armed.remaining === 0) armed = undefined;
                    entry.fault = mode; diagnostic.faults.push({ ...sample(), mode, receiptId: value.id, action: structuredClone(value.action) });
                    if (mode === 'abort') this.transaction.abort();
                }
            }
            return nativeAdd.call(this, value, ...args);
        };
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: complete.configurable, enumerable: complete.enumerable,
            get() { return complete.get.call(this); },
            set(handler) {
                complete.set.call(this, typeof handler !== 'function' ? handler : function (event) {
                    const entry = meta.get(this);
                    if (entry?.fault === 'lost-completion') {
                        entry.applicationOutcome = 'injected-abort-delivery-after-native-commit';
                        // Dexie owns this handler. Deliver a failure instead of its
                        // successful completion; do not abort/modify the committed DB.
                        this.onabort?.call(this, new Event('abort', { cancelable: true }));
                    } else handler.call(this, event);
                });
            } });
    });
}
const arm = (page, mode, profileId, type, editType, remaining = 1) => page.evaluate(value => window.__workshopPersistence.arm(value), { mode, profileId, type, editType, remaining });
const diagnostics = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__workshopPersistence)));
async function retainDiagnostics(page, row) {
    const latest = await diagnostics(page), index = row.diagnosticDocuments.findIndex(entry => entry.documentId === latest.documentId);
    if (index < 0) row.diagnosticDocuments.push(latest); else row.diagnosticDocuments[index] = latest;
}

async function touchStroke(page, context, specimenId, sections, touch) {
    await stage(page).scrollIntoViewIfNeeded(); await idle(page);
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-workshop') || 'null')?.phase === 'idle');
    const box = await stage(page).boundingBox(), anchors = JSON.parse(await stage(page).getAttribute('data-workshop-anchors'));
    assert(box && anchors?.specimens[specimenId]?.sand, 'Rendered sand anchors are required');
    const points = sections.map(section => ({ x: box.x + anchors.specimens[specimenId].sand[section][0], y: box.y + anchors.specimens[specimenId].sand[section][1] }));
    for (const point of points) assert(point.x > 0 && point.y > 0 && point.x < page.viewportSize().width && point.y < page.viewportSize().height, 'Actual sand contact must be visible');
    if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
        for (const point of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else {
        await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
        for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 3 });
        await page.mouse.up();
    }
    return points;
}
async function identifyDriftwood(page, id) {
    await command(page, 'ブラシへ おく');
    for (let section = 0; section < 6; section++) {
        const control = page.locator(`[data-brush-section="${section}"]`);
        if (await control.isEnabled()) await control.click();
        await waitWorkshop(page, id, state => state.specimens.driftwood.cleanedMask & 1 << section, `brush region ${section}`);
    }
    for (const [tool, result] of [['ブラシへ おく', 'clean'], ['ひかりへ おく', 'opaque'], ['みずへ おく', 'float']]) {
        await command(page, tool); await waitWorkshop(page, id, state => state.specimens.driftwood.observations.some(entry => entry.result === result), `real ${result}`);
    }
    await waitWorkshop(page, id, state => state.specimens.driftwood.identity, 'actual driftwood identity');
}
async function building(page) {
    await command(page, 'つくる'); await page.locator('[data-part-id="straight"]').click(); await openDetails(page, 'タップで おく');
}
async function movePart(page, col, row) {
    await idle(page); await page.locator(`[data-workshop-cell="${col},${row}"]`).click();
}
async function waitPart(page, id, col, row) {
    return waitWorkshop(page, id, state => { const position = state.draftCheckpoint.draft.layout.parts.straight.position; return position?.col === col && position.row === row; }, `straight at ${col},${row}`);
}
async function realTab(context, page) {
    const cdp = await context.newCDPSession(page);
    // Playwright enables synthetic focus at page creation. Restore Chromium's
    // native tab focus so bringToFront also exercises real visibility changes.
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    const info = await cdp.send('Target.getTargetInfo');
    const window = await cdp.send('Browser.getWindowForTarget', { targetId: info.targetInfo.targetId });
    await cdp.detach(); await page.bringToFront(); return window.windowId;
}
async function concurrentMove(page, id, col, row) {
    await movePart(page, col, row); let retried = false;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const state = await readNative(page, id), pose = state.island.workshop.draftCheckpoint.draft.layout.parts.straight.position;
        if (pose?.col === col && pose.row === row) { await idle(page); return { retriedKnownCAS: retried }; }
        const error = panel(page).locator('.island-workshop-error');
        if (await error.isVisible()) {
            assert(!retried && (await error.innerText()).includes('いまの きろくに なったよ'), 'A lost notification permits one explicit retry after a confirmed CAS refresh');
            retried = true; await retry(page);
        }
        await sleep(80);
    }
    throw new Error('The other tab did not save its real move after CAS recovery');
}
async function retry(page) { await panel(page).getByRole('button', { name: 'もういちど のこす', exact: true }).click(); await idle(page); }
async function profileFromName(page, name) { return (await allTables(page)).profiles.find(profile => profile.name === name)?.id; }

try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference', serviceWorkers: 'allow' });
        await instrument(context);
        const page = await context.newPage(); page.setDefaultTimeout(15000); const windowId = await realTab(context, page);
        const row = { name: layout.name, pass: false, applicationDataInjected: false, errors: [], checks: [], diagnosticDocuments: [] }; report.layouts.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        let other;
        try {
            await page.goto(`${target}/#/island`); await waitReady(page); assert.equal(await button(page, 'おためしの いりえ').count(), 0);
            await button(page, 'まなぶ').click(); await page.locator('.island-setup-name input').fill(`いりえA${layout.name}`);
            await button(page, '年中').click(); await button(page, 'さんすう').click(); await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitReady(page); await waitMode(page, 'learning');
            const earned = await finishFirstSection(page, layout.name === 'phone'), id = earned.island.profileId;
            row.profileId = id; row.normalEarnedSections = earned.island.completedSets; row.reservationId = earned.plan.id;
            await enterWorkshop(page); const baseline = await allTables(page);
            await capture(page, `${layout.name}-01-earned-inlet`);
            await command(page, 'ブラシへ おく'); await stage(page).scrollIntoViewIfNeeded();
            row.stroke = await touchStroke(page, context, 'driftwood', [0, 1, 2], layout.name === 'phone');
            await waitWorkshop(page, id, state => (state.specimens.driftwood.cleanedMask & 7) === 7, 'three contacts of one released stroke');
            const stroked = await allTables(page); unchangedLearningAndWorld(baseline, stroked);
            assert.equal(eventDelta(baseline, stroked, id).filter(event => event.action.type === 'brush').length >= 3, true);
            row.checks.push('real canvas stroke persists every touched region');

            const beforeAbort = await allTables(page); await arm(page, 'abort', id, 'name-specimen');
            await setName(page, 'ほぞんを ためす'); await failed(page, 1);
            assert.deepEqual(await allTables(page), beforeAbort, 'Native abort rolls back every table');
            await capture(page, `${layout.name}-02-native-abort`); await retry(page);
            await waitWorkshop(page, id, state => state.specimens.driftwood.name === 'ほぞんを ためす', 'same name retry');
            assert.equal(eventDelta(beforeAbort, await allTables(page), id).length, 1);
            row.checks.push('native abort and retry: one receipt, no learning/world changes');
            await identifyDriftwood(page, id); await building(page);
            await command(page, 'ながれぎを はめる'); await waitWorkshop(page, id, state => state.draftCheckpoint.draft.layout.parts.straight.assembled, 'actual wood fitted');
            await movePart(page, 2, 1); await waitPart(page, id, 2, 1);
            const beforeFifo = await allTables(page), faultCount = (await diagnostics(page)).faults.length;
            await arm(page, 'abort', id, 'edit-draft', 'move', 3);
            for (const [index, col] of [0, 1, 0].entries()) { await movePart(page, col, 1); await failed(page, faultCount + index + 1); }
            assert.deepEqual(await allTables(page), beforeFifo, 'All three injected failures roll back');
            await retry(page); await waitPart(page, id, 0, 1);
            await page.waitForFunction(({ id, revision }) => new Promise((resolve, reject) => {
                const open = indexedDB.open('SansuDatabase'); open.onerror = () => reject(open.error); open.onsuccess = () => {
                    const database = open.result, get = database.transaction('islands').objectStore('islands').get(id);
                    get.onsuccess = () => { database.close(); resolve(get.result?.revision === revision + 3); }; get.onerror = () => { database.close(); reject(get.error); };
                };
            }), { id, revision: beforeFifo.islands.find(island => island.profileId === id).revision });
            const afterFifo = await allTables(page), moves = eventDelta(beforeFifo, afterFifo, id);
            assert.deepEqual(moves.map(event => event.action.edit.position), [{ col: 0, row: 1 }, { col: 1, row: 1 }, { col: 0, row: 1 }]);
            unchangedLearningAndWorld(beforeFifo, afterFifo); row.checks.push('failed A -> B -> A drains in exact gesture order');
            await capture(page, `${layout.name}-03-fifo-A-B-A`);

            other = await context.newPage(); other.setDefaultTimeout(15000); other.on('pageerror', error => row.errors.push(error.message));
            assert.equal(await realTab(context, other), windowId, 'The native visibility check requires two tabs in the same browser window');
            await other.goto(`${target}/#/island`); await enterWorkshop(other); await building(other); await page.bringToFront();
            for (const type of ['save-work', 'undo']) {
                const before = await allTables(page), oldLayout = before.islands.find(island => island.profileId === id).workshop.draftCheckpoint.draft.layout;
                await arm(page, 'lost-completion', id, type === 'undo' ? 'edit-draft' : type, type === 'undo' ? 'undo' : undefined);
                if (type === 'save-work') {
                    await openDetails(page, 'さくひんを のこす'); const slot = page.locator('[data-work-id="work-1"]');
                    await slot.locator('input').fill('そのときの かたち'); await slot.getByRole('button', { name: 'いまを のこす', exact: true }).click();
                } else await command(page, 'ひとつ もどす');
                await failed(page); const committed = await allTables(page), receipt = eventDelta(before, committed, id);
                assert.equal(receipt.length, 1, 'Native commit really happened before completion delivery was lost');
                await other.bringToFront(); row.checks.push({ type: `${type}-other-tab-move`, ...await concurrentMove(other, id, type === 'undo' ? 1 : 2, 2) });
                const concurrent = await allTables(other); await page.bringToFront(); await retry(page);
                await panel(page).locator('.island-workshop-error').waitFor({ state: 'hidden' });
                const recovered = await allTables(page); assert.deepEqual(recovered, concurrent, 'Original receipt replay cannot execute undo twice or recapture a newer work');
                if (type === 'save-work') assert.deepEqual(recovered.islands.find(island => island.profileId === id).workshop.works['work-1'].layout, oldLayout);
                unchangedLearningAndWorld(before, recovered); row.checks.push(`lost ${type} completion -> concurrent real move -> original receipt replay`);
            }
            await capture(page, `${layout.name}-04-unknown-receipts`);

            // Report this gate separately when the driver cannot yield native
            // hidden state, so offline/profile coverage can still continue.
            // Never fake document.hidden or dispatch a visibility event.
            await command(page, 'しらべる'); await page.locator('[data-specimen-id="seaglass"]').click();
            const beforeHidden = await allTables(page); await command(page, 'みずへ おく'); await other.bringToFront();
            const hidden = await page.waitForFunction(() => document.hidden, undefined, { timeout: 3000 }).then(() => true, () => false);
            row.background = { status: hidden ? 'pending' : 'unverified-driver',
                inactiveTab: await page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() })),
                activeTab: await other.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() })) };
            if (hidden) {
                await sleep(1600);
                try { assert.deepEqual(await allTables(other), beforeHidden, 'A hidden tool cannot save an unseen observation'); row.background.status = 'pass'; }
                catch (error) { row.background.status = 'failed'; row.background.failure = error.stack; }
            }
            await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
            row.background.visibilityEvents = (await diagnostics(page)).visibility;
            if (hidden) assert(row.background.visibilityEvents.some(sample => sample.hidden), 'Actual hidden state also emits a native visibilitychange');
            row.checks.push(`background gate: ${row.background.status}; see separate background-report.json`);
            await fs.writeFile(`${out}/background-report.json`, JSON.stringify({ target, revision: manifest.revision, driverFocus: report.driverFocus,
                layouts: report.layouts.map(layout => ({ name: layout.name, ...layout.background })) }, null, 2));

            await page.locator('[data-specimen-id="striped-shell"]').click();
            const beforeLearning = await allTables(page); await command(page, 'ひかりへ おく');
            row.learningBoundaryStart = JSON.parse(await stage(page).getAttribute('data-workshop'));
            await command(page, 'まなぶ'); await waitMode(page, 'learning');
            await sleep(1400); assert.deepEqual(await allTables(page), beforeLearning, 'Starting a reserved question cancels the unfinished tool and starts no late workshop writer');
            let learning = await readNative(page, id); assert.equal(learning.plan.id, earned.plan.id);
            const workshopBeforeAnswer = structuredClone(learning.island.workshop); learning = await answerLearning(page, learning, layout.name === 'phone');
            assert.deepEqual(learning.island.workshop, workshopBeforeAnswer); row.checks.push('same reserved ordinary UI question answers once; workshop stays unchanged');
            await retainDiagnostics(other, row); await other.close(); other = undefined;

            await page.evaluate(() => navigator.serviceWorker.ready); await retainDiagnostics(page, row);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Real installed service worker is required');
            const beforeOffline = await readNative(page, id); await retainDiagnostics(page, row);
            await context.setOffline(true); await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            const offline = await readNative(page, id); assert.deepEqual(offline, beforeOffline, 'Offline reload preserves the current reservation, history and workshop');
            const afterOfflineAnswer = await answerLearning(page, offline, layout.name === 'phone'); assert.deepEqual(afterOfflineAnswer.island.workshop, beforeOffline.island.workshop);
            await enterWorkshop(page); await capture(page, `${layout.name}-05-offline-restored`);
            const beforeOfflineEdit = await allTables(page); await page.locator('[data-specimen-id="driftwood"]').click(); await setName(page, 'オフラインの たから');
            await waitWorkshop(page, id, state => state.specimens.driftwood.name === 'オフラインの たから', 'offline name saved');
            unchangedLearningAndWorld(beforeOfflineEdit, await allTables(page)); await context.setOffline(false);
            row.checks.push('actual service worker offline reload, normal answer, and local workshop save');

            // Real add-profile/settings UI; do not seed a second profile or copy the first island.
            await command(page, 'しまへ'); await button(page, 'せってい').click(); const firstOwner = await allTables(page);
            await page.locator('[data-setting-section="profile"]').click(); await page.getByRole('button', { name: /^(追加|ついか)$/ }).click();
            await button(page, 'はじめる').click(); await page.getByPlaceholder('あだ名でOK').fill(`いりえB${layout.name}`); await button(page, '次へ').click();
            await page.getByRole('button', { name: /年中/ }).click(); await page.getByRole('button', { name: /さんすう だけ/ }).click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitReady(page);
            const otherId = await profileFromName(page, `いりえB${layout.name}`); assert(otherId && otherId !== id);
            assert.equal((await readNative(page, otherId)).island.completedSets, 0); assert.equal((await readNative(page, otherId)).island.workshop, undefined);
            assert.equal(await button(page, 'おためしの いりえ').count(), 0);
            await button(page, 'まなぶ').click(); await waitMode(page, 'learning');
            // readNative without a profile selects the oldest island; pass the actual new owner here.
            let newState = await readNative(page, otherId), newPlan = newState.plan.id;
            for (let count = 0; newState.plan?.id === newPlan; count++) { assert(count < 80); newState = await answerLearning(page, newState, layout.name === 'phone'); }
            assert.equal(newState.island.completedSets, 1); await enterWorkshop(page);
            await setName(page, 'べつの たから'); await waitWorkshop(page, otherId, state => state.specimens.driftwood.name === 'べつの たから', 'independent new owner');
            unchangedOtherProfile(firstOwner, await allTables(page), id);
            assert.equal(newState.island.workshop, undefined, 'Ordinary learning does not materialize another workshop');
            await command(page, 'しまへ'); await button(page, 'せってい').click(); const secondOwner = await allTables(page);
            await page.locator('[data-setting-section="profile"]').click();
            const firstCard = page.locator('.space-y-3.px-4.py-4').filter({ hasText: `いりえA${layout.name}` });
            await firstCard.getByRole('button', { name: /切替|きりかえ/ }).click(); await waitReady(page); await enterWorkshop(page);
            assert.deepEqual((await readNative(page, id)).island.workshop, firstOwner.islands.find(island => island.profileId === id).workshop);
            unchangedOtherProfile(secondOwner, await allTables(page), otherId);
            row.secondProfileId = otherId; row.checks.push('real profile creation/learning/switch preserves both separate owned workshops');
            await capture(page, `${layout.name}-06-original-profile-restored`);
            await retainDiagnostics(page, row);
            const transactions = row.diagnosticDocuments.flatMap(document => document.transactions), workshopTransactions = transactions.filter(transaction => transaction.actions.length);
            assert(workshopTransactions.every(transaction => transaction.start.mode === 'workshop' && !transaction.start.hidden), 'No workshop writer may start in learning or background');
            assert(transactions.some(transaction => transaction.fault === 'lost-completion' && transaction.nativeOutcome === 'complete'), 'Post-commit failure must not be confused with rollback');
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS ${layout.name}: real UI workshop persistence, native faults, hidden/learning/offline/profile boundaries`);
        } catch (error) {
            row.failure = error.stack; await capture(page, `${layout.name}-failure`).catch(() => {});
            await retainDiagnostics(page, row).catch(() => {});
            if (other) await retainDiagnostics(other, row).catch(() => {});
            await fs.writeFile(`${out}/${layout.name}-failure-native.json`, JSON.stringify(await allTables(page).catch(() => null), null, 2));
            throw error;
        } finally { await context.close(); }
    }
    assert.deepEqual(await fingerprint(), initialSource, 'Frozen application and harness sources must remain unchanged'); report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    await browser.close(); CRSession.prototype.send = driverSend;
    report.finishedAt = new Date().toISOString();
    report.backgroundGatePassed = report.layouts.length === 2 && report.layouts.every(layout => layout.background?.status === 'pass');
    report.fullPersistenceMatrixPassed = report.pass && report.backgroundGatePassed;
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Workshop persistence</title><style>body{font:16px sans-serif;background:#edf1e7}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}</style><h1>Workshop persistence — ${report.pass ? 'PASS' : 'INCOMPLETE'}</h1><p>${manifest.revision}; human n=0; no progression fixtures.</p><main>${report.captures.map(capture => `<figure><figcaption>${capture.file}</figcaption><img src="${capture.file}"></figure>`).join('')}</main>`);
}
