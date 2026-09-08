import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const legacyOffscreenGate = process.argv.includes('--legacy-offscreen-gate');
const scenarios = [
    'Empty DB -> named profile -> actual first ordinary learning section; no island, specimen, work, display or photo fixtures',
    'Half-clean unknown specimen -> same reserved learning -> three actual specimens on three main-island tables',
    'Learning waits for actual ready inputs with its intentionally hidden canvas; real しまへ returns to a visible full-size island canvas',
    'Real canvas selection; same-instance move; occupied-table replacement preview cancelled; remove display without losing its specimen',
    'Shared command below the scene -> actual button click -> application scroll and two animation frames -> visible command delivery and actual result',
    'Revisit the same individual; finish real brush/light/water observations; main display follows that individual and keeps its name',
    'Display photograph -> real captured canvas pixels equal saved PNG -> downloaded PNG equals persisted bytes; every other DB store unchanged',
    'Fit four real parts; directly build and run A -> save and display A -> build/run B -> overwrite and delete A source slot',
    'Read-only A replay still reaches its own straight/wheel/bell while B draft/undo/redo and all DB rows stay unchanged',
    'Preview A and current B, cancel replacement, return to ordinary learning, reload and revisit A after its source slot is deleted',
];
const limitations = [
    'Resident carry/gather/illuminate jobs and their memory receipts are NOT run or passed by this harness version; available phase diagnostics are recorded only.',
    'Native offline/background, owner switching, concurrent CAS and unknown-result fault injection use their separate persistence harnesses; no such pass is inferred here.',
    'Screenshots and rendered phase evidence require human visual review. This harness does not certify visual appeal, silent child comprehension, motivation or learning effects.',
    'This is the F01/F02 display/revisit/photography slice, not completion of all spec38 or the 104-item benchmark Goal.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, viewports, scenarios, limitations,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_SHARED_MEMORIES_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_ISLAND_SHARED_MEMORIES_HEADED: '1 launches headed; default is headless' },
        optionalArguments: { '--legacy-offscreen-gate': 'Require a real phone command with the canvas initially offscreen. Use only for an explicitly selected pre-sticky delivery-gate regression; default records actual visibility without requiring it to be offscreen.' },
        sourceRule: 'Frozen manifest files must match before AND after. App revision, delivery flag, visual candidates, viewport and QA hashes accompany every run.',
        outputRule: 'Fresh directory only; report.json, per-check all-table digests/deltas, phase traces, PNGs and contact-sheet.html. --plan does not create output.',
        inputRule: 'Only real UI buttons/keypad/native canvas pointers. Readonly IndexedDB and actual canvas output/DOM diagnostics may be observed; no app imports or app actions in the page.',
    }, null, 2));
    process.exit(0);
}

const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_SHARED_MEMORIES_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set a frozen target, fresh output and SANSU_ISLAND_BUILD_SOURCE');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
assert(manifest.revision && manifest.sourceHash && Array.isArray(manifest.files) && manifest.files.length, 'Build manifest must identify the actual source');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = ['tools/e2e-island-shared-memories.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...manifest.files.map(file => file.path), ...qaFiles].map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const initialSource = await fingerprint();
assert.deepEqual(initialSource.slice(0, manifest.files.length), manifest.files.map(({ path: file, sha256 }) => ({ path: file, sha256 })), 'App source must match the frozen build manifest');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec38Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, legacyOffscreenGate, scenarios, limitations,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    jobs: { status: 'not-run', reason: limitations[0] }, fingerprints: initialSource, captures: [], layouts: [] };
const { chromium } = await import('playwright');
let browser;
const stage = page => page.getByTestId('island-stage');
const shared = page => page.locator('section[aria-label="かざりと なかまの きおく"]');
const replay = page => page.locator('section[aria-label="のこした さくひんを ためす"]');
const specimenIds = ['driftwood', 'seaglass', 'striped-shell'];
const partIds = ['straight', 'elbow', 'wheel', 'bell'];
const displayIds = ['display-1', 'display-2', 'display-3'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const idle = page => page.waitForFunction(() => {
    const host = document.querySelector('.island-page');
    return host?.getAttribute('data-busy') === 'false' || host?.getAttribute('data-mode') === 'welcome'
        || host?.hasAttribute('data-onboarding-step') && host.querySelector('.island-setup-sheet')?.getAttribute('aria-busy') === 'false';
});
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitLearningInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const panel = document.querySelector('[data-island-plan-id][data-input-ready="true"]');
        const answer = document.querySelector('.park-answer');
        return panel && answer && answer.getBoundingClientRect().width > 20
            && (!expected || panel.getAttribute('data-island-plan-id') === expected.id
                && Number(panel.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(control => !control.disabled && control.getBoundingClientRect().height > 10);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
}
async function waitWorld(page) {
    await waitReady(page);
    await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas');
        const box = canvas?.getBoundingClientRect();
        return document.querySelector('.island-page')?.getAttribute('data-mode') !== 'learning'
            && host?.getAttribute('data-renderer') === 'three' && box && box.width > 100 && box.height > 100
            && canvas.width > 1 && canvas.height > 1 && host.getAttribute('data-camera-frame')?.split(',').length === 32;
    });
    await painted(page);
}
async function press(page, label, touch, scope = page) { await idle(page); await activate(button(scope, label), touch); }
async function details(page, text, touch) {
    const summary = page.locator('summary').filter({ hasText: text });
    if (!await summary.evaluate(node => node.parentElement.open)) await activate(summary, touch);
}
async function scene(page) {
    return stage(page).evaluate(node => {
        const read = name => { const value = node.getAttribute(name); return value ? JSON.parse(value) : null; };
        return { displays: read('data-shared-displays'), preview: read('data-shared-preview'), job: read('data-shared-job'),
            workshop: read('data-workshop'), frame: node.getAttribute('data-camera-frame'), requestSeen: node.getAttribute('data-shared-request-seen') };
    });
}
async function waitNative(page, predicate, label, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const state = await readNative(page);
        if (predicate(state.island, state)) { await idle(page); await painted(page); return await readNative(page); }
        await pause(80);
    }
    throw new Error(`Native state did not reach ${label}`);
}
async function waitScene(page, predicate, label, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const value = await scene(page);
        if (predicate(value)) { await painted(page); return await scene(page); }
        await pause(80);
    }
    throw new Error(`Rendered scene did not reach ${label}`);
}

/** One readonly transaction covers every native store. Hash actual Blob bytes
 * afterwards; these reads never seed progress or dispatch application actions. */
async function tables(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const entries = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve([name, request.result]); request.onerror = () => reject(request.error);
            })));
            await done;
            const canonical = async value => {
                if (value instanceof Blob) return { mime: value.type, bytes: value.size,
                    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
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
function unchanged(before, after, allowed = []) {
    assert.deepEqual(Object.keys(after), Object.keys(before), 'Optional actions cannot change the set of native stores');
    const events = new Set(allowed.flatMap(kind => kind === 'shared' ? ['shared_memory_changed', 'shared_memory_first'] : kind === 'workshop' ? ['workshop_changed'] : ['photo_changed']));
    for (const name of Object.keys(before)) {
        if (allowed.includes('photos') && ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs'].includes(name)) continue;
        const strip = rows => {
            if (name === 'islandEvents') return rows.filter(event => !events.has(event.type));
            if (name !== 'islands' || !allowed.some(kind => kind !== 'photos')) return rows;
            return rows.map(row => { const value = structuredClone(row); delete value.revision; delete value.updatedAt;
                if (allowed.includes('shared')) delete value.sharedMemories;
                if (allowed.includes('workshop')) delete value.workshop;
                return value;
            });
        };
        assert.deepEqual(strip(after[name]), strip(before[name]), `${name} changed outside ${allowed.join('+') || 'a read-only preview'}`);
    }
}
async function checkDB(page, row, name, before, allowed = []) {
    await idle(page); await painted(page); const after = await tables(page);
    unchanged(before, after, allowed);
    row.databaseChecks.push({ name, allowed, before: digestTables(before), after: digestTables(after),
        changedStores: Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table])), pass: true });
    return after;
}
function optionalState(state) {
    return { islands: state.islands.map(island => ({ profileId: island.profileId, workshop: island.workshop, sharedMemories: island.sharedMemories })),
        photos: state.islandPhotos, blobs: state.islandPhotoBlobs, albums: state.islandPhotoAlbums,
        events: state.islandEvents.filter(event => ['workshop_changed', 'shared_memory_changed', 'shared_memory_first', 'photo_changed'].includes(event.type)) };
}
async function capture(page, row, name) {
    const learning = await page.locator('.island-page').getAttribute('data-mode') === 'learning';
    if (learning) await waitLearningInput(page); else await waitWorld(page);
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    if (!learning) assert.equal(await stage(page).locator('canvas').count(), 1, 'One island renderer must show the actual shared object');
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'learning-input' : 'world'}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await (learning ? page.locator('.island-workbench') : stage(page)).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    report.captures.push({ name, file, frameFile, sha256: sha(bytes), frameSha256: sha(frame), ...metadata,
        frameKind: learning ? 'actual-learning-input' : 'actual-world',
        sharedCandidate: await stage(page).getAttribute('data-shared-candidate'),
        scene: learning ? null : await scene(page), sceneOmittedReason: learning ? 'Learning intentionally hides its retained canvas; no world screenshot is claimed.' : undefined });
}
async function trace(page, label) {
    await page.evaluate(label => {
        const token = crypto.randomUUID(), started = performance.now(); window.__sharedTrace = { label, token, animationFrame: 0, frames: [] }; let previous = '';
        const view = () => {
            const canvas = document.querySelector('[data-testid="island-stage"] canvas'), box = canvas?.getBoundingClientRect();
            if (!box) return { visible: false, centerVisible: false };
            const visible = box.width > 1 && box.height > 1 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
            const x = box.x + box.width / 2, y = box.y + box.height / 2;
            return { x: box.x, y: box.y, width: box.width, height: box.height, visible,
                centerVisible: visible && x > 0 && x < innerWidth && y > 0 && y < innerHeight && document.elementFromPoint(x, y) === canvas };
        };
        window.__sharedCanvasView = view;
        const sample = () => {
            if (window.__sharedTrace.token !== token || performance.now() - started > 35000) return;
            window.__sharedTrace.animationFrame += 1;
            const host = document.querySelector('[data-testid="island-stage"]');
            const parse = name => { const value = host?.getAttribute(name); return value ? JSON.parse(value) : null; };
            const value = { workshop: parse('data-workshop'), displays: parse('data-shared-displays'), preview: parse('data-shared-preview'), job: parse('data-shared-job'),
                requestSeen: host?.getAttribute('data-shared-request-seen'), canvas: view() };
            const key = JSON.stringify(value);
            if (key !== previous && window.__sharedTrace.frames.length < 1800) { previous = key; window.__sharedTrace.frames.push({ ms: performance.now() - started, animationFrame: window.__sharedTrace.animationFrame, ...value }); }
            requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
    }, label);
}
async function saveTrace(page, row) {
    const value = await page.evaluate(() => { const value = window.__sharedTrace; if (value) value.token = ''; return value; });
    if (value) { delete value.token; row.traces.push(value); }
    return value;
}
async function armSharedGesture(page) {
    const control = button(shared(page), 'じぶんで おく');
    await control.scrollIntoViewIfNeeded();
    await control.evaluate(control => control.addEventListener('click', event => {
        window.__sharedTrace.gesture = { trusted: event.isTrusted, animationFrame: window.__sharedTrace.animationFrame,
            requestSeen: document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-shared-request-seen'),
            hidden: document.hidden, canvas: window.__sharedCanvasView() };
    }, { capture: true, once: true }));
}
function assertSharedDelivery(row, record) {
    assert(record?.gesture?.trusted && !record.gesture.hidden, 'Shared command must originate from a real visible-document button gesture');
    const first = record.frames.find(frame => frame.requestSeen && frame.requestSeen !== record.gesture.requestSeen && frame.job?.id === frame.requestSeen);
    assert(first, 'A new command must actually reach the shared scene controller');
    const elapsedFrames = first.animationFrame - record.gesture.animationFrame;
    assert(elapsedFrames >= 2, 'Shared scene must not receive the command before the scroll/two-RAF gate');
    assert(first.canvas.visible && first.canvas.centerVisible, 'Application scroll must expose the actual canvas before shared command delivery');
    row.sharedGates.push({ label: record.label, gesture: record.gesture, firstDelivery: first, elapsedFrames, pass: true });
}
async function goHome(page, touch) { await press(page, 'しまへ', touch); await waitMode(page, 'home'); await waitWorld(page); }
async function openWorkshop(page, touch) { await press(page, 'おためしの いりえ', touch); await waitMode(page, 'workshop'); await idle(page); await waitWorld(page); }
async function openShared(page, touch, slot) {
    await press(page, 'かざりと きおく', touch); await waitMode(page, 'shared');
    if (slot) await selectSlot(page, touch, slot);
    await idle(page); await painted(page);
}
async function selectSlot(page, touch, id) {
    await idle(page); await activate(shared(page).locator('.island-shared-slots button').nth(displayIds.indexOf(id)), touch);
    await painted(page);
}
async function returnLearning(page, row, label) {
    const before = await tables(page), native = await readNative(page), plan = native.plan;
    await press(page, 'まなぶ', row.touch); await waitLearningInput(page, plan);
    const resumed = await readNative(page); assert.deepEqual(resumed.plan, plan, `${label}: same full reserved problem/plan must resume`);
    assert.deepEqual(optionalState(await tables(page)), optionalState(before), `${label}: entering learning cannot change optional content`);
    await capture(page, row, `${label}-same-learning`);
    const answered = await answerUI(page, resumed.plan, { touch: row.touch, dev: false });
    const after = await tables(page); assert.deepEqual(optionalState(after), optionalState(before), `${label}: normal answer must preserve exhibits, drafts, undo, memories and image bytes`);
    row.learningReturns.push({ label, planId: plan.id, revisionBefore: plan.revision,
        revisionAfter: answered.state.islandPlans.find(item => item.id === plan.id).revision, preservedOptionalSha256: sha(JSON.stringify(optionalState(after))) });
    await goHome(page, row.touch);
}
async function selectSpecimen(page, row, id) {
    await press(page, 'しらべる', row.touch); await idle(page);
    await activate(page.locator(`[data-specimen-id="${id}"]`), row.touch);
    await page.waitForFunction(id => document.querySelector(`[data-specimen-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
}
async function brush(page, row, id, sections) {
    await selectSpecimen(page, row, id); await press(page, 'ブラシへ おく', row.touch);
    for (const section of sections) {
        const control = page.locator(`[data-brush-section="${section}"]`);
        if (await control.isEnabled()) await activate(control, row.touch);
        await waitNative(page, island => Boolean(island.workshop?.specimens[id].cleanedMask & (1 << section)), `${id} brushed ${section}`);
    }
}
async function finishSpecimen(page, row, id) {
    await brush(page, row, id, [0, 1, 2, 3, 4, 5]);
    for (const [label, result] of [['ひかりへ おく', id === 'seaglass' ? 'transmit' : 'opaque'], ['みずへ おく', id === 'driftwood' ? 'float' : 'sink']]) {
        await press(page, label, row.touch);
        await waitNative(page, island => island.workshop?.specimens[id].observations.some(entry => entry.result === result), `${id} actual ${result}`);
    }
    await waitNative(page, island => Boolean(island.workshop?.specimens[id].identity), `${id} identified`);
    await capture(page, row, `${id}-revisited-identified`);
}
async function displaySelectedSpecimen(page, row, id) {
    await selectSpecimen(page, row, id); await press(page, 'しまに かざる', row.touch);
    await waitMode(page, 'shared'); await page.locator('.island-shared-preview').waitFor(); await painted(page);
}
async function commitPreview(page, row, label) {
    // A scrolled-out renderer intentionally sleeps. Inspect its real preview
    // only after bringing the canvas into view; armSharedGesture below then
    // scrolls back to the actual button before testing application delivery.
    await waitWorld(page);
    await waitScene(page, state => state.preview?.length === 1, `${label} actual visible preview`);
    const before = await tables(page), diagnostic = await scene(page);
    assert.equal(diagnostic.preview?.length, 1, 'The preview must contain the actual target, not just a placement card');
    const preview = diagnostic.preview[0];
    assert(await button(shared(page), 'じぶんで おく').isEnabled(), `${label}: visible placement suggestion must be legal`);
    await trace(page, label); await armSharedGesture(page); await press(page, 'じぶんで おく', row.touch, shared(page));
    const native = await waitNative(page, island => island.sharedMemories?.displays[preview.displayId]?.target.targetKey === preview.targetKey
        && island.revision > before.islands[0].revision, label);
    await page.locator('.island-shared-preview').waitFor({ state: 'detached' });
    const settled = await waitScene(page, state => state.displays?.some(item => item.displayId === preview.displayId && item.targetKey === preview.targetKey && !item.carried), `${label} released on real table`);
    assertSharedDelivery(row, await saveTrace(page, row));
    const display = settled.displays.find(item => item.displayId === preview.displayId);
    const previous = diagnostic.displays.find(item => item.targetKey === preview.targetKey);
    assert.equal(display.targetUuid, previous?.targetUuid ?? preview.targetUuid, `${label}: placement must retain the actual target Object3D, including preview-to-saved ownership`);
    await checkDB(page, row, label, before, ['shared']);
    await capture(page, row, label); return { native, display };
}
async function pointerSelect(page, row, displayId) {
    await stage(page).scrollIntoViewIfNeeded(); await painted(page);
    const diagnostic = await scene(page), display = diagnostic.displays.find(item => item.displayId === displayId);
    assert(display, 'Saved target must have actual geometry');
    const frame = diagnostic.frame.split(',').map(Number); assert.equal(frame.length, 32);
    const anchor = display.anchors.surface;
    const point = new Vector3(anchor.x, anchor.y, anchor.z).applyMatrix4(new Matrix4().fromArray(frame.slice(0, 16)).invert())
        .applyMatrix4(new Matrix4().fromArray(frame.slice(16)));
    const box = await stage(page).locator('canvas').boundingBox();
    assert(box && Math.abs(point.x) < .98 && Math.abs(point.y) < .98 && Math.abs(point.z) <= 1, 'Actual exhibit surface must be in frame');
    const x = box.x + (point.x + 1) * box.width / 2, y = box.y + (1 - point.y) * box.height / 2;
    const hitIsCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', { x, y });
    assert(hitIsCanvas, 'Actual canvas target must not be covered by UI');
    if (row.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await page.waitForFunction(index => document.querySelectorAll('.island-shared-slots button')[index]?.getAttribute('aria-pressed') === 'true', displayIds.indexOf(displayId));
    row.pointerSelections.push({ displayId, targetUuid: display.targetUuid, anchor, x, y, native: row.touch ? 'touch' : 'mouse' });
}
async function moveDisplay(page, row, displayId) {
    await selectSlot(page, row.touch, displayId);
    const before = await tables(page), old = before.islands[0].sharedMemories.displays[displayId];
    await press(page, 'ばしょを かえる', row.touch, shared(page));
    // Reversible UI trials use the same collision verdict visible to the user.
    // Never import placement helpers or teleport the domain into a legal pose.
    let moved = false;
    const reverse = { みぎへ: 'ひだりへ', ひだりへ: 'みぎへ', てまえへ: 'おくへ', おくへ: 'てまえへ' };
    const candidates = [['みぎへ'], ['ひだりへ'], ['てまえへ'], ['おくへ'],
        ['みぎへ', 'てまえへ'], ['みぎへ', 'おくへ'], ['ひだりへ', 'てまえへ'], ['ひだりへ', 'おくへ']];
    for (const commands of candidates) {
        for (const command of commands) await press(page, command, row.touch, shared(page));
        await painted(page);
        const legal = await button(shared(page), 'じぶんで おく').isEnabled();
        row.placementTrials.push({ displayId, commands, legal, preview: (await scene(page)).preview });
        if (legal) { moved = true; break; }
        for (const command of [...commands].reverse()) await press(page, reverse[command], row.touch, shared(page));
    }
    assert(moved, 'UI trials must find a legal cardinal or diagonal destination before committing a move');
    await press(page, 'まわす', row.touch, shared(page));
    const result = await commitPreview(page, row, `${displayId}-move`);
    const current = result.native.island.sharedMemories.displays;
    assert.notDeepEqual(current[displayId].position, old.position); assert.equal(current[displayId].target.targetKey, old.target.targetKey);
    assert.equal(current[displayId].rotation, (old.rotation + Math.PI / 2) % (Math.PI * 2));
    for (const id of displayIds.filter(id => id !== displayId)) assert.deepEqual(current[id], before.islands[0].sharedMemories.displays[id]);
    await checkDB(page, row, 'move-only-selected-display', before, ['shared']);
}
async function photograph(page, row, expectedTarget) {
    await press(page, 'この かざりを とる', row.touch, shared(page)); await waitMode(page, 'camera'); await idle(page); await painted(page);
    const before = await tables(page), camera = page.getByTestId('island-photo-camera');
    await activate(camera.locator('[data-photo-action="capture"]'), row.touch);
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'saved');
    const after = await checkDB(page, row, 'display-photo-all-stores', before, ['photos']);
    const added = after.islandPhotos.filter(photo => !before.islandPhotos.some(old => old.id === photo.id)); assert.equal(added.length, 1);
    const photo = added[0]; assert.equal(photo.targetKey, expectedTarget.targetKey); assert.equal(photo.composition, 'display'); assert.equal(photo.profileId, row.owner);
    assert.equal(photo.targetName, 'うみの ふね', 'Photo records the current name of the same specimen');
    const pixels = await page.evaluate(async id => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        let stored;
        try { const request = db.transaction('islandPhotoBlobs', 'readonly').objectStore('islandPhotoBlobs').get(id);
            stored = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        } finally { db.close(); }
        const original = window.__sharedPhotoFrames.at(-1); if (!original) throw new Error('No actual stage canvas capture was observed');
        const url = URL.createObjectURL(stored.image), source = new Image(), image = new Image();
        try {
            source.src = original; image.src = url; await Promise.all([source.decode(), image.decode()]);
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(source, 0, 0, image.width, image.height);
            const expected = context.getImageData(0, 0, image.width, image.height).data;
            context.clearRect(0, 0, image.width, image.height); context.drawImage(image, 0, 0);
            const actual = context.getImageData(0, 0, image.width, image.height).data;
            let different = 0; for (let index = 0; index < actual.length; index++) if (actual[index] !== expected[index]) different++;
            return { width: image.width, height: image.height, samples: actual.length, different };
        } finally { URL.revokeObjectURL(url); }
    }, photo.id);
    assert.equal(pixels.different, 0, 'Saved PNG must preserve every decoded pixel of the actual captured renderer frame');
    assert(pixels.samples > 100000, 'Photo comparison must cover a real image');
    const downloadPromise = page.waitForEvent('download'); await press(page, 'PNGで とりだす', row.touch, camera);
    const download = await downloadPromise, file = `${row.name}-display-export.png`; await download.saveAs(`${out}/${file}`);
    assert.equal(sha(await fs.readFile(`${out}/${file}`)), photo.image.sha256, 'Export must use the already saved PNG');
    const blob = after.islandPhotoBlobs.find(blob => blob.id === photo.id); assert.equal(blob.image.sha256, photo.image.sha256); assert.equal(blob.thumbnail.sha256, photo.thumbnail.sha256);
    row.photo = { id: photo.id, targetKey: photo.targetKey, pixels, export: file, imageSha256: photo.image.sha256 };
    await capture(page, row, 'display-photo-saved'); await press(page, 'カメラを とじる', row.touch); await waitMode(page, 'shared');
}
async function movePart(page, row, id, col, gridRow, rotation = 0) {
    await idle(page); await activate(page.locator(`[data-part-id="${id}"]`), row.touch);
    for (let count = 0; (await readNative(page)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation !== rotation; count++) {
        assert(count < 4); const old = (await readNative(page)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation;
        await press(page, 'まわす', row.touch); await waitNative(page, island => island.workshop.draftCheckpoint.draft.layout.parts[id].rotation !== old, `${id} rotated`);
    }
    await details(page, 'タップで おく', row.touch); await activate(page.locator(`[data-workshop-cell="${col},${gridRow}"]`), row.touch);
    await waitNative(page, island => { const point = island.workshop.draftCheckpoint.draft.layout.parts[id].position; return point?.col === col && point.row === gridRow; }, `${id} moved to ${col},${gridRow}`);
}
async function runWork(page, row, label, expectedReached, readonly = false) {
    const before = await tables(page); await trace(page, label); await press(page, 'みずを ながす', row.touch);
    await page.waitForFunction(() => window.__sharedTrace?.frames.some(frame => frame.workshop?.run?.complete === false
        && frame.workshop.phase?.startsWith('run-')), undefined, { timeout: 10000 });
    const observed = await waitScene(page, state => state.workshop?.run?.complete && state.workshop.phase === 'idle'
        && expectedReached.every(id => state.workshop.run.reached.includes(id)), `${label} rendered completed run`, 30000);
    assert.deepEqual(observed.workshop.run.reached, expectedReached, 'Use actual afterRender arrivals, never an old creation receipt or simulator prediction');
    assert.equal(observed.workshop.replay, readonly);
    await saveTrace(page, row); await checkDB(page, row, label, before, readonly ? [] : ['workshop']); await capture(page, row, label);
}
async function saveWork(page, row, workId, name) {
    await details(page, 'さくひんを のこす', row.touch); const slot = page.locator(`[data-work-id="${workId}"]`);
    await slot.locator('input').fill(name); await press(page, 'いまを のこす', row.touch, slot);
    return waitNative(page, island => island.workshop.works[workId]?.name === name, `${workId} ${name} saved`);
}
async function readonlyA(page, row, aTarget, draftB, label) {
    await selectSlot(page, row.touch, 'display-3'); await press(page, 'いりえで ためす', row.touch, shared(page));
    await waitMode(page, 'workshop'); await replay(page).waitFor();
    assert.equal(await replay(page).locator('h2').textContent(), aTarget.name);
    const before = await tables(page); assert.deepEqual(before.islands[0].workshop.draftCheckpoint, draftB);
    await runWork(page, row, label, ['straight', 'wheel', 'bell'], true);
    await checkDB(page, row, `${label}-B-checkpoint-preserved`, before);
}

try {
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_SHARED_MEMORIES_HEADED !== '1' }); report.browser = browser.version();
    for (const layout of viewports) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow', acceptDownloads: true });
        // Transparent recording only: the application receives the untouched
        // real canvas result and all native timing/visibility remains intact.
        await context.addInitScript(() => {
            window.__sharedPhotoFrames = [];
            const original = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (...args) {
                const result = original.apply(this, args);
                if (this.closest('[data-testid="island-stage"]')) { window.__sharedPhotoFrames.push(result); if (window.__sharedPhotoFrames.length > 4) window.__sharedPhotoFrames.shift(); }
                return result;
            };
        });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], learningReturns: [], pointerSelections: [], placementTrials: [], sharedGates: [], traces: [], jobs: { status: 'not-run' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            const empty = await tables(page);
            assert.equal(empty.islands.length, 0); assert.equal(empty.islandPhotos.length, 0); assert.equal(empty.logs.length, 0);
            await press(page, 'まなぶ', row.touch); await page.locator('.island-setup-name input').fill(`かざり${row.name}`);
            await press(page, '年中', row.touch); await press(page, 'さんすう', row.touch);
            await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
            let native = await readNative(page); const firstPlan = native.plan.id; row.owner = native.plan.profileId;
            for (let count = 0; native.plan.id === firstPlan; count++) { assert(count < 80); native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; }
            assert.equal(native.island.completedSets, 1); row.earnedSections = 1;
            await goHome(page, row.touch); await openWorkshop(page, row.touch);
            let baseline = await tables(page);
            await brush(page, row, 'driftwood', [0, 1, 2]); await checkDB(page, row, 'half-clean-only-workshop', baseline, ['workshop']);
            const half = (await readNative(page)).island.workshop.specimens.driftwood; assert.equal(half.cleanedMask, 7); assert.equal(half.identity, undefined);
            await capture(page, row, 'half-clean-before-first-display'); await returnLearning(page, row, 'half-clean'); await openWorkshop(page, row.touch);
            await displaySelectedSpecimen(page, row, 'driftwood');
            baseline = await tables(page); await capture(page, row, 'unknown-display-preview');
            assert.equal((await scene(page)).preview[0].cleanedMask, 7); assert.equal((await scene(page)).preview[0].identified, false);
            await returnLearning(page, row, 'uncommitted-display-preview');
            assert.equal((await readNative(page)).island.sharedMemories?.displays['display-1'], undefined);
            await openWorkshop(page, row.touch); await displaySelectedSpecimen(page, row, 'driftwood');
            const placed = {};
            placed.driftwood = (await commitPreview(page, row, 'driftwood-main-display')).display;
            for (const id of specimenIds.slice(1)) {
                await goHome(page, row.touch); await openWorkshop(page, row.touch); await displaySelectedSpecimen(page, row, id);
                placed[id] = (await commitPreview(page, row, `${id}-main-display`)).display;
            }
            assert.equal((await scene(page)).displays.length, 3); assert.equal(new Set(Object.values(placed).map(item => item.targetUuid)).size, 3);
            await goHome(page, row.touch); await openShared(page, row.touch);
            await capture(page, row, 'all-three-main-displays');
            baseline = await tables(page); await pointerSelect(page, row, 'display-1');
            await checkDB(page, row, 'actual-canvas-select-readonly', baseline);
            await moveDisplay(page, row, 'display-1');

            await selectSlot(page, row.touch, 'display-1'); baseline = await tables(page); const identities = (await scene(page)).displays.map(item => [item.displayId, item.targetUuid]);
            await press(page, 'かざる ものを えらぶ', row.touch, shared(page)); await activate(shared(page).locator('.island-shared-sources button').nth(1), row.touch);
            await waitWorld(page);
            await waitScene(page, state => state.preview?.[0]?.targetKey === placed.seaglass.targetKey, 'replacement preview uses the selected existing specimen');
            await capture(page, row, 'occupied-table-replacement-preview'); await press(page, 'やめる', row.touch, shared(page));
            await waitWorld(page);
            await waitScene(page, state => state.preview?.length === 0, 'cancelled replacement removes only preview');
            await checkDB(page, row, 'occupied-table-replacement-cancel', baseline);
            assert.deepEqual((await scene(page)).displays.map(item => [item.displayId, item.targetUuid]), identities);

            await selectSlot(page, row.touch, 'display-3'); baseline = await tables(page); const shell = baseline.islands[0].workshop.specimens['striped-shell'];
            await press(page, 'この かざりを はずす', row.touch, shared(page)); await press(page, 'はずす', row.touch, shared(page).locator('.island-shared-confirm'));
            await waitNative(page, island => !island.sharedMemories.displays['display-3'], 'shell removed from main table');
            await checkDB(page, row, 'remove-display-retains-owned-specimen', baseline, ['shared']);
            assert.deepEqual((await readNative(page)).island.workshop.specimens['striped-shell'], shell);
            await capture(page, row, 'shell-stored-without-loss');

            for (const [index, id] of specimenIds.entries()) {
                if (index < 2) {
                    await selectSlot(page, row.touch, displayIds[index]); baseline = await tables(page);
                    await press(page, 'いりえで ためす', row.touch, shared(page)); await waitMode(page, 'workshop');
                    assert.equal(await page.locator(`[data-specimen-id="${id}"]`).getAttribute('aria-pressed'), 'true');
                    await checkDB(page, row, `${id}-same-individual-revisit`, baseline);
                    assert.equal((await readNative(page)).island.workshop.specimens[id].id, placed[id].targetKey);
                } else { await goHome(page, row.touch); await openWorkshop(page, row.touch); }
                baseline = await tables(page); await finishSpecimen(page, row, id);
                if (id === 'driftwood') {
                    await details(page, 'たなに かざる', row.touch); await page.locator('#workshop-specimen-name').fill('うみの ふね');
                    await press(page, 'きめる', row.touch); await waitNative(page, island => island.workshop.specimens.driftwood.name === 'うみの ふね', 'personal specimen name');
                }
                await checkDB(page, row, `${id}-revisit-observations-only`, baseline, ['workshop']);
                await goHome(page, row.touch); await openShared(page, row.touch, index < 2 ? displayIds[index] : 'display-1');
                if (index < 2) {
                    const actual = (await waitScene(page, state => state.displays?.some(item => item.targetKey === placed[id].targetKey && item.cleanedMask === 63 && item.identified), 'same main specimen updated')).displays.find(item => item.targetKey === placed[id].targetKey);
                    assert.equal(actual.targetUuid, placed[id].targetUuid); assert.deepEqual(actual.visibleSand, []);
                    if (id === 'driftwood') assert.equal(actual.name, 'うみの ふね');
                }
            }
            await selectSlot(page, row.touch, 'display-1'); await photograph(page, row, placed.driftwood);
            await returnLearning(page, row, 'display-photo'); await openWorkshop(page, row.touch); await press(page, 'つくる', row.touch);

            baseline = await tables(page);
            const materials = { straight: 'ながれぎ', elbow: 'ながれぎ', wheel: 'いろガラス', bell: 'しまもようの かい' };
            for (const id of partIds) {
                await activate(page.locator(`[data-part-id="${id}"]`), row.touch); await press(page, `${materials[id]}を はめる`, row.touch);
                await waitNative(page, island => island.workshop.draftCheckpoint.draft.layout.parts[id].assembled, `${id} material actually fitted`);
            }
            for (const [id, col, gridRow] of [['straight', 0, 1], ['wheel', 1, 1], ['bell', 2, 1]]) await movePart(page, row, id, col, gridRow);
            await runWork(page, row, 'work-A-original-run', ['straight', 'wheel', 'bell']);
            native = await saveWork(page, row, 'work-1', 'よこへ ながれる A'); const savedA = structuredClone(native.island.workshop.works['work-1']);
            await checkDB(page, row, 'fit-build-run-save-A-only-workshop', baseline, ['workshop']);
            await press(page, 'しまに かざる', row.touch, page.locator('[data-work-id="work-1"]')); await waitMode(page, 'shared');
            const aPlaced = await commitPreview(page, row, 'work-A-main-display'); assert.equal(aPlaced.display.displayId, 'display-3');
            const aTarget = structuredClone(aPlaced.native.island.sharedMemories.displays['display-3'].target);
            assert.deepEqual(aTarget.layout, savedA.layout); assert.equal(aTarget.name, savedA.name);

            await goHome(page, row.touch); await openWorkshop(page, row.touch); await press(page, 'つくる', row.touch); baseline = await tables(page);
            await details(page, 'さくひんを のこす', row.touch); await press(page, 'ばんを あける', row.touch);
            await waitNative(page, island => Object.values(island.workshop.draftCheckpoint.draft.layout.parts).every(part => !part.position), 'clear A board, retain four assemblies');
            for (const [id, col, gridRow, rotation] of [['elbow', 0, 1, 0], ['wheel', 0, 2, 1], ['bell', 0, 3, 1]]) await movePart(page, row, id, col, gridRow, rotation);
            await runWork(page, row, 'work-B-new-run', ['elbow', 'wheel', 'bell']);
            await saveWork(page, row, 'work-1', 'したへ ながれる B'); await saveWork(page, row, 'work-2', 'とっておく B');
            native = await readNative(page); assert.notDeepEqual(native.island.workshop.works['work-1'].layout, aTarget.layout);
            assert.deepEqual(native.island.sharedMemories.displays['display-3'].target, aTarget);
            const slot = page.locator('[data-work-id="work-1"]'); await press(page, 'あける', row.touch, slot); await press(page, 'わくを あける', row.touch, slot);
            await waitNative(page, island => !island.workshop.works['work-1'], 'A original source slot deleted after B overwrite');
            await movePart(page, row, 'bell', 1, 3, 1); await press(page, 'ひとつ もどす', row.touch);
            native = await waitNative(page, island => island.workshop.draftCheckpoint.draft.redo.length > 0, 'B undo/redo history retained');
            const draftB = structuredClone(native.island.workshop.draftCheckpoint); assert(draftB.draft.undo.length > 0 && draftB.draft.redo.length > 0);
            assert.deepEqual(draftB.draft.layout, native.island.workshop.works['work-2'].layout);
            await checkDB(page, row, 'B-overwrite-delete-and-undo-only-workshop', baseline, ['workshop']);
            await goHome(page, row.touch); await openShared(page, row.touch, 'display-3');
            assert.equal((await scene(page)).displays.find(item => item.displayId === 'display-3').targetUuid, aPlaced.display.targetUuid);
            await readonlyA(page, row, aTarget, draftB, 'A-replay-after-source-overwrite-delete');
            baseline = await tables(page); await press(page, 'この あんから つくる', row.touch, replay(page));
            await press(page, 'いまの つくりかけ', row.touch, replay(page)); await runWork(page, row, 'preview-current-B-readonly', ['elbow', 'wheel', 'bell'], true);
            await press(page, 'かざった さくひん', row.touch, replay(page)); await runWork(page, row, 'preview-saved-A-readonly', ['straight', 'wheel', 'bell'], true);
            await press(page, 'やめる', row.touch, replay(page)); await checkDB(page, row, 'start-from-A-comparison-cancel', baseline);
            await press(page, 'この あんから つくる', row.touch, replay(page)); await press(page, 'いまの つくりかけ', row.touch, replay(page));
            await returnLearning(page, row, 'A-B-uncommitted-comparison');
            const beforeReload = await tables(page), reserved = (await readNative(page)).plan;
            await page.reload(); await waitLearningInput(page, reserved);
            assert.deepEqual((await readNative(page)).plan, reserved);
            assert.deepEqual(optionalState(await tables(page)), optionalState(beforeReload));
            await answerUI(page, reserved, { touch: row.touch, dev: false }); assert.deepEqual(optionalState(await tables(page)), optionalState(beforeReload));
            await goHome(page, row.touch); await openShared(page, row.touch, 'display-3');
            await readonlyA(page, row, aTarget, draftB, 'A-replay-after-reload-and-normal-answer');
            const final = await tables(page); assert.deepEqual(final.islands[0].sharedMemories.displays['display-3'].target, aTarget);
            assert.equal(final.islands[0].workshop.works['work-1'], undefined); assert.deepEqual(final.islands[0].workshop.draftCheckpoint, draftB);
            assert(final.islandPhotoBlobs.some(blob => blob.id === row.photo.id && blob.image.sha256 === row.photo.imageSha256));
            row.offscreenDeliveryExercised = row.sharedGates.some(gate => !gate.gesture.canvas.visible);
            // An explicit legacy regression can require a real offscreen start.
            // Always-visible layouts retain the same delivery assertions without
            // manufacturing an offscreen scene or inferring behavior from a hash.
            if (row.touch && legacyOffscreenGate) assert(row.offscreenDeliveryExercised,
                'Selected legacy gate regression must exercise a real below-scene button with the canvas initially outside the viewport');
            assert.deepEqual(row.errors, []); row.pass = true; row.finalTables = digestTables(final);
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(final, null, 2));
            console.log(`PASS ${row.name}: real displays, same individuals, immutable A/current B, all-store isolation and saved photo pixels; jobs not run`);
        } catch (error) {
            await capture(page, row, 'failure').catch(() => {}); row.failure = error.stack;
            await saveTrace(page, row).catch(() => {});
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true; report.gates.runtimeIntegrity = 'passed-selected-display-and-replay-scenarios';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    try { assert.deepEqual(await fingerprint(), initialSource, 'Frozen app or QA source changed during verification'); report.sourceStable = true; }
    catch (error) { report.sourceStable = false; report.pass = false; report.gates.runtimeIntegrity = 'source-changed'; report.sourceFailure = error.stack; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Shared display critical path</title><style>body{font:16px system-ui;margin:24px;background:#f5f2e9}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;padding:12px}img{width:100%}small{display:block;overflow-wrap:anywhere}</style><h1>Shared display critical path — human review pending</h1><p>${escape(target)} · ${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Resident jobs are not verified by this run. Technical assertions do not certify visual appeal or silent comprehension.</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.frameFile)}" alt="${escape(item.name)}"></a><figcaption>${escape(item.file)}</figcaption><small>${escape(item.candidate)} · ${escape(item.delivery)} · ${escape(item.revision)} · ${escape(item.frameSha256)}</small></figure>`).join('')}</main>`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
