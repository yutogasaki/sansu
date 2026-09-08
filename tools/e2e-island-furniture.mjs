import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
// Audited UI/domain contract. Runtime code is never imported or called in the page.
const products = [
    { kind: 'telescope', id: 'optional-telescope', price: 30, radius: .90 },
    { kind: 'hammock', id: 'optional-hammock', price: 25, radius: 1.05 },
    { kind: 'tea-table', id: 'optional-tea-table', price: 40, radius: 1.20 },
];
const residents = ['otter', 'rabbit', 'fox'];
const scenarios = [
    'Empty DB, actual onboarding and ordinary answers earn at least 95 stars and all three residents; no application-data fixtures',
    'Three unowned tools x three explicitly selected residents; tea uses an explicitly selected distinct partner and the same cup through actual handoff',
    'Every trial/selection/cancel/exit preserves all native stores, including Blob bytes; actual phase PNGs and world contacts accompany controller diagnostics',
    'Each tool acquired once for 30/25/40 stars, initially stored; placement cancellation keeps ownership; actual arrow/rotation gestures place it',
    'Each owned tool is used and rearranged without reselecting its resident after saving; each viewport must exercise a physically unreachable legal preview, explicit usable-place search, unsaved suggestion, save and actual use by the same resident',
    'An actual no-space search preserves every store; the surroundings entry cancels only the preview, then real inventory arrows relocate the owned telescope before the same tool/resident explicitly searches and uses it again',
    'Each purchase path returns to the exact full learning reservation and submits one actual answer; reload preserves all stores and the current reservation',
];
const remaining = [
    'Native abort, lost completion/same-receipt retry, competing cosmetic CAS, profile switch, real background, offline and PWA update/hold require a separate persistence phase',
    'Dense legacy duplicates/three displays, all maturity stages, later-growth collisions and old full-scene restoration are not covered by this main UI path',
    'All six ordered tea pairs, all outfit combinations, autonomous home use and interruption at every individual phase require further coverage',
    'Human N=0. Contact coordinates and screenshots do not certify visual appeal, occlusion-free contact, silent child comprehension, motivation or learning effects',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, viewports, products, residents, scenarios, remaining,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_FURNITURE_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_ISLAND_FURNITURE_QA_ROOT: 'Explicit immutable QA bundle; all app inputs and existing helpers match the frozen build',
            SANSU_ISLAND_FURNITURE_VIEWPORT: 'phone or tablet; a single viewport is a partial diagnostic, never overall PASS', SANSU_ISLAND_FURNITURE_HEADED: '1 enables headed inspection' },
        sourceRule: 'Execute snapshot/tools or an explicit immutable QA bundle. App manifest, bundle app inputs and QA closure are hashed before and after.',
        recoveryRule: 'Record ready and no-space as separate actual search results. No-space -> unchanged DB -> surroundings/inventory -> actual telescope arrows to (-0.5,-2.5), legal preview and explicit one-item save -> same tool/resident/partner -> new trusted search -> ready -> explicit save -> same actual rig use. A second no-space remains FAIL. Telescope rearrangement searches at most 24 offsets x 3 orientations. No blocked candidate leaves the recovery gate not-exercised and the overall main-path result partial; fullSpec40Passed remains false.',
        inputRule: 'Only actual UI buttons/keypad/pointer input; read-only native DB, actual renderer matrices/contacts and actual canvas PNGs. No app function dispatch.',
        outputRule: 'Fresh output directory only; report, per-action exact native deltas and table hashes, phase traces, PNGs/contact sheet, Playwright traces. No output or browser on --plan.',
    }, null, 2));
    process.exit(0);
}

const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_FURNITURE_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set frozen URL, manifest and fresh output');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length, 'Frozen build manifest required');
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_FURNITURE_QA_ROOT || manifest.snapshot), 'Run snapshot/tools or explicitly identify the immutable QA bundle');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = ['tools/e2e-island-furniture.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'].map(file => path.join(sourceRoot, file));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), qa: await hashFiles(qaFiles),
    bundleAppInputs: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleAppInputs.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256,
    file.sha256, `QA bundle app differs: ${file.relative}`);
for (const file of qaFiles.slice(1)) {
    const relative = path.relative(sourceRoot, file), original = manifest.files.find(entry => entry.relative === relative);
    assert(original, `Missing frozen helper: ${relative}`);
    assert.equal(initialSource.qa.find(entry => entry.path === file)?.sha256, original.sha256, `Changed helper: ${relative}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec40Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, remaining,
    gates: { runtimeIntegrity: 'not-run', reachabilityRecovery: 'not-exercised', surroundingsRecovery: 'not-exercised', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)), explicitBundle: Boolean(process.env.SANSU_ISLAND_FURNITURE_QA_ROOT) } },
    fingerprints: initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const shop = page => page.locator('section[aria-label="くらしの どうぐ"]');
const placement = page => page.locator('section[aria-label="おく ばしょを えらぶ"]');
const inventory = page => page.locator('section[aria-label="しまの もちもの"]');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
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
async function scene(page) {
    return stage(page).evaluate(host => {
        const read = key => { const value = host.getAttribute(key); return value ? JSON.parse(value) : null; };
        return { optional: read('data-optional-furniture'), placement: read('data-furniture-placement'), preview: read('data-preview-state'), previewValid: host.dataset.previewValid,
            residents: read('data-resident-states'), rigs: read('data-island-expression')?.residents?.map(resident => ({ id: resident.id, uuid: resident.uuid })),
            furniture: read('data-furniture-state'), appearance: read('data-island-appearance'),
            camera: host.dataset.cameraFrame, candidate: host.dataset.optionalFurnitureCandidate,
            requestId: host.dataset.playRequestId, status: host.dataset.playStatus, reason: host.dataset.playReason };
    });
}
async function waitScene(page, predicate, label, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await scene(page); if (predicate(value)) return value; await pause(40); }
    throw new Error(`Actual renderer did not reach ${label}: ${JSON.stringify(await scene(page))}`);
}
async function waitNative(page, row, predicate, label) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) { const value = await readNative(page, row.owner); if (predicate(value.island, value)) { await idle(page); return value; } await pause(60); }
    throw new Error(`Native state did not reach ${label}`);
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
const itemFor = (island, product) => island.items.find(item => item.id === product.id);
function exactDelta(before, after, owner, action) {
    assert.deepEqual(Object.keys(after), Object.keys(before));
    if (!action) { assert.deepEqual(after, before, 'Optional viewing/playing/cancellation must not write any table'); return; }
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name], `${name}: optional action changed unrelated data`);
    const old = islandFor(before, owner), updated = islandFor(after, owner);
    assert(old && updated); assert.equal(updated.revision, old.revision + 1); assert(Number.isFinite(updated.updatedAt));
    const expected = structuredClone(old); expected.revision++; expected.updatedAt = updated.updatedAt;
    if (action.type === 'acquire-furniture') {
        const product = products.find(product => product.kind === action.kind); assert(product && !itemFor(old, product));
        expected.customization.points -= product.price;
        expected.items.push({ id: product.id, kind: product.kind, rotation: 0 });
    } else {
        expected.items = expected.items.map(item => item.id !== action.itemId ? item : action.type === 'store'
            ? { ...item, position: undefined, autoPlacementBlocked: undefined }
            : { ...item, position: { ...action.position }, rotation: ((action.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), autoPlacementBlocked: undefined });
    }
    assert.deepEqual(after.islands, before.islands.map(island => island.profileId === owner ? expected : island), 'Only exact authorized wallet/ownership/pose changes are allowed');
    const priorIds = new Set(before.islandEvents.map(event => event.id)), added = after.islandEvents.filter(event => !priorIds.has(event.id));
    assert.deepEqual(after.islandEvents.filter(event => priorIds.has(event.id)), before.islandEvents, 'Existing receipts are immutable');
    assert.equal(added.length, 1);
    const receipt = added[0], product = products.find(product => product.kind === action.kind);
    assert.deepEqual(receipt, { id: JSON.stringify([product ? 'island-furniture-v1' : 'island-edit-v1', owner, old.revision]), profileId: owner,
        type: product ? 'furniture_acquired' : 'item_edited', timestamp: updated.updatedAt, action,
        itemId: product?.id ?? action.itemId, ...(product ? { kind: product.kind } : {}) });
}
async function checkDB(page, row, name, before, action) {
    await idle(page); const after = await tables(page), changedStores = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const file = `${row.name}-db-${String(row.databaseChecks.length + 1).padStart(2, '0')}-${name}.json`;
    const entry = { name, file, action: action ?? null, before: digestTables(before), after: digestTables(after), changedStores, pass: false };
    row.databaseChecks.push(entry);
    try { exactDelta(before, after, row.owner, action); entry.pass = true; }
    finally { await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...entry, revision: manifest.revision, sourceHash: manifest.sourceHash,
        changes: Object.fromEntries(changedStores.map(key => [key, { before: before[key], after: after[key] }])) }, null, 2)); }
    return after;
}
async function capture(page, row, name) {
    const learning = await page.locator('.island-page').getAttribute('data-mode') === 'learning';
    if (learning) await waitLearningInput(page); else await waitWorld(page);
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'input' : 'world'}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await (learning ? page.locator('.island-workbench') : stage(page)).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    report.captures.push({ name, file, frameFile, sha256: sha(bytes), frameSha256: sha(frame), ...metadata,
        frameKind: learning ? 'actual-learning-input' : 'actual-world', actual: learning ? null : await scene(page) });
}

/** Sample the renderer's completed frame and encode that exact canvas once per phase. */
async function armProbe(page, label) {
    await page.evaluate(label => {
        window.__furnitureProbe?.observer?.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]'), images = new Set(); let last = '';
        const probe = window.__furnitureProbe = { label, frames: [], images: [], started: performance.now(), closed: false };
        const sample = () => {
            const stamp = host.dataset.frameTimestamp;
            if (probe.closed || probe.frames.length >= 6000 || !stamp || stamp === last) return; last = stamp;
            const read = key => { const value = host.getAttribute(key); return value ? JSON.parse(value) : null; };
            const canvas = host.querySelector('canvas'), box = canvas?.getBoundingClientRect(), optional = read('data-optional-furniture');
            const cx = box ? box.x + box.width / 2 : -1, cy = box ? box.y + box.height / 2 : -1;
            const frame = { timestamp: Number(stamp), ms: performance.now() - probe.started, optional, camera: host.dataset.cameraFrame,
                residents: read('data-resident-states'), hidden: document.hidden, canvas: { width: box?.width, height: box?.height,
                    centerVisible: Boolean(box && box.width > 100 && box.height > 100 && cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight && document.elementFromPoint(cx, cy) === canvas) } };
            probe.frames.push(frame);
            if (!optional?.active || !frame.canvas.centerVisible || frame.hidden) return;
            const keys = [optional.phase, ...(optional.contactSeen ? ['contact-seen'] : []), ...(optional.transferSeen ? ['transfer-seen'] : [])];
            for (const key of keys) if (!images.has(key) && probe.images.length < 20) {
                images.add(key); probe.images.push({ key, frame, png: canvas.toDataURL('image/png') });
            }
        };
        const observer = new MutationObserver(sample); observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
        probe.observer = observer; sample();
    }, label);
}
async function saveProbe(page, row) {
    const value = await page.evaluate(() => {
        const probe = window.__furnitureProbe; if (!probe || probe.closed) return null;
        probe.closed = true; probe.observer.disconnect(); return { label: probe.label, gesture: probe.gesture, frames: probe.frames, images: probe.images };
    });
    if (!value) return;
    const images = value.images; delete value.images;
    const file = `${row.name}-${value.label}-phases.json`; await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...value,
        target, revision: manifest.revision, sourceHash: manifest.sourceHash, metadata: row.metadata, optionalFurnitureCandidate: row.rendererCandidate }, null, 2));
    row.traces.push({ label: value.label, file, frames: value.frames.length });
    for (const image of images) {
        const file = `${row.name}-${value.label}-${image.key}.png`, bytes = Buffer.from(image.png.split(',')[1], 'base64');
        assert(bytes.length > 10000, 'An actual rendered phase PNG is required'); await fs.writeFile(`${out}/${file}`, bytes);
        report.captures.push({ name: `${value.label}-${image.key}`, file, frameFile: file, sha256: sha(bytes), frameSha256: sha(bytes),
            ...row.metadata, optionalFurnitureCandidate: row.rendererCandidate, frameKind: 'actual-rendered-phase', actual: image.frame });
    }
    return value;
}
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
function inFrame(frame, points) {
    const numbers = frame.camera?.split(',').map(Number); assert(numbers?.length === 32 && numbers.every(Number.isFinite));
    const view = new Matrix4().fromArray(numbers.slice(0, 16)).invert(), projection = new Matrix4().fromArray(numbers.slice(16));
    return frame.canvas.centerVisible && !frame.hidden && points.every(point => {
        assert(Array.isArray(point) && point.length === 3 && point.every(Number.isFinite));
        const p = new Vector3(...point).applyMatrix4(view).applyMatrix4(projection);
        return Math.abs(p.x) < .985 && Math.abs(p.y) < .985 && Math.abs(p.z) <= 1;
    });
}
function validateUse(probe, product, actor, partner, borrowed, requestId) {
    assert(probe.gesture?.trusted && !probe.gesture.hidden, 'Actual trusted gesture required');
    const frames = probe.frames.filter(frame => frame.optional?.requestId === requestId), visits = frames.map(frame => frame.optional);
    assert(frames.length > 2); const actorIds = partner ? [actor, partner] : [actor];
    for (const visit of visits) {
        assert.equal(visit.itemId, product.id); assert.equal(visit.kind, product.kind); assert.equal(visit.borrowed, borrowed);
        assert.deepEqual(visit.actorIds, actorIds); assert.equal(visit.radius, product.radius);
        assert.deepEqual(visit.actors.map(actor => actor.id), actorIds);
        assert.deepEqual(visit.actors.map(actor => actor.uuid), visits[0].actors.map(actor => actor.uuid), 'Reuse the same actual resident rigs');
    }
    assert(visits.some(visit => visit.phase === 'walking')); assert(visits.some(visit => visit.phase === 'settled'));
    const contact = frames.find(frame => frame.optional.contactSeen && ['contact', 'pickup'].includes(frame.optional.phase));
    assert(contact, 'Observe actual rendered contact before the controller advances');
    const first = contact.optional.actors[0], anchors = contact.optional.anchors;
    if (product.kind === 'telescope') {
        assert(distance(first.eye, anchors.eye) < .005); assert(first.hands.every((hand, i) => distance(hand, anchors.grips[i]) < .005));
        assert(inFrame(contact, [first.eye, anchors.eye, ...first.hands, ...anchors.grips]));
    } else if (product.kind === 'hammock') {
        assert(inFrame(contact, [anchors.seat]));
    } else {
        const handoff = frames.find(frame => frame.optional.phase === 'handoff' && frame.optional.transferSeen);
        assert(handoff, 'Both actual hands must contact the same cup in a rendered handoff');
        assert.equal(new Set(visits.map(visit => visit.cup.uuid)).size, 1, 'A single cup is carried and returned');
        assert(visits.some(visit => visit.cup.holder === actor)); assert(visits.some(visit => visit.cup.holder === partner));
        assert.equal(visits.at(-1).cup.holder, 'table');
        const grips = handoff.optional.anchors.cupGrips, hands = [handoff.optional.actors[0].hands[1], handoff.optional.actors[1].hands[0]];
        assert(hands.every((hand, i) => distance(hand, grips[i]) < .008)); assert(inFrame(handoff, [...hands, ...grips]));
    }
    return { requestId, actorIds, actorUuids: visits[0].actors.map(actor => actor.uuid), borrowed,
        contactFrame: contact.timestamp, phases: [...new Set(visits.map(visit => visit.phase))], pass: true };
}
async function selectProduct(page, row, product) {
    await idle(page); await activate(shop(page).locator(`[data-furniture-choice="${product.kind}"]`), row.touch);
    await page.waitForFunction(kind => document.querySelector('[data-furniture-kind]')?.getAttribute('data-furniture-kind') === kind, product.kind);
    await waitWorld(page); await waitScene(page, state => !state.optional?.active, 'previous actor released');
}
async function useTool(page, row, product, actor, partner, borrowed, label) {
    if (borrowed) {
        await activate(shop(page).locator(`[data-furniture-resident="${actor}"]`), row.touch);
        if (partner) await activate(shop(page).locator(`[data-furniture-partner="${partner}"]`), row.touch);
    }
    // Do not repair an owned selection here: a reset during save must fail before
    // the trusted use gesture instead of being hidden by a second selection.
    assert.equal(await shop(page).locator(`[data-furniture-resident="${actor}"]`).getAttribute('aria-pressed'), 'true', `${label}: preserve selected resident`);
    if (partner) assert.equal(await shop(page).locator(`[data-furniture-partner="${partner}"]`).getAttribute('aria-pressed'), 'true', `${label}: preserve selected partner`);
    const before = await tables(page), oldRequest = (await scene(page)).requestId;
    await armProbe(page, label);
    const control = button(shop(page), borrowed ? 'つかう ところを ためす' : 'ここで ためす');
    await control.evaluate(node => node.addEventListener('click', event => {
        window.__furnitureProbe.gesture = { trusted: event.isTrusted, hidden: document.hidden, at: performance.now() };
    }, { capture: true, once: true }));
    await activate(control, row.touch);
    const started = await waitScene(page, state => state.requestId && state.requestId !== oldRequest, `${label} new request`);
    assert.equal(started.status, 'playing', `${label}: ${started.reason}`);
    await waitScene(page, state => state.optional?.requestId === started.requestId && state.optional.phase === 'settled', `${label} settled`);
    const probe = await saveProbe(page, row), use = { label, kind: product.kind, ...validateUse(probe, product, actor, partner, borrowed, started.requestId) };
    row.uses.push(use);
    await checkDB(page, row, label, before); await capture(page, row, `${label}-settled`);
    return use;
}
async function enterShop(page, row, from = 'home') {
    if (from === 'home') { await press(page, row, 'もちもの'); await waitMode(page, 'inventory'); }
    await press(page, row, 'くらしの どうぐを みる'); await waitMode(page, 'furniture'); await waitWorld(page);
}
async function earn(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, row, 'まなぶ'); await page.locator('.island-setup-name input').fill(`どうぐ${row.name}`);
    await press(page, row, '年中'); await press(page, row, 'さんすう');
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page), answers = 0; row.owner = native.plan.profileId;
    while ((native.island.customization?.points ?? 0) < 95 || native.island.completedSets < 4 || (native.island.growth?.expansionLevel ?? 0) < 1 || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers < 300, 'Bounded ordinary answers must earn 95 stars and the second land');
    }
    const receipts = native.islandEvents.filter(event => event.type === 'answer'); assert.equal(receipts.length, answers);
    row.earned = { fixture: false, answers, answerReceiptIds: receipts.map(event => event.id), points: native.island.customization.points,
        completedSets: native.island.completedSets, growth: native.island.growth, reservedPlan: native.plan };
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterShop(page, row);
    assert.deepEqual(await shop(page).locator('[data-furniture-resident]').evaluateAll(nodes => nodes.map(node => node.dataset.furnitureResident)), residents);
    row.metadata = await runtimeMetadata(page); assert.equal(row.metadata.revision, manifest.revision);
    row.rendererCandidate = (await scene(page)).candidate; assert(row.rendererCandidate, 'Actual optional furniture candidate required');
    await capture(page, row, 'earned-before-trial');
}
async function trialMatrix(page, row) {
    for (const product of products) {
        const before = await tables(page); await selectProduct(page, row, product);
        const trial = (await waitScene(page, state => state.optional?.trial?.id === product.id && state.optional.trial.visible, `${product.kind} actual borrowed model`)).optional.trial;
        assert(trial.uuid); assert.equal(itemFor(islandFor(before, row.owner), product), undefined);
        assert(await button(shop(page), `${product.price}ほしで むかえる`).isEnabled());
        await capture(page, row, `${product.kind}-unowned`);
        for (const [index, actor] of residents.entries()) await useTool(page, row, product, actor,
            product.kind === 'tea-table' ? residents[(index + 1) % residents.length] : undefined, true, `trial-${product.kind}-${actor}`);
        await selectProduct(page, row, product); await checkDB(page, row, `trial-${product.kind}-cancel`, before);
        await press(page, row, 'もちものを うごかす', shop(page)); await waitMode(page, 'inventory'); await waitWorld(page);
        await waitScene(page, state => !state.optional?.active && !state.optional?.trial, 'trial disposed on exit');
        await checkDB(page, row, `trial-${product.kind}-exit`, before); await enterShop(page, row, 'inventory');
    }
}
function matchingPlacement(state, product, actor) {
    const value = state.placement, preview = state.preview;
    return value?.itemId === product.id && value.residentId === actor.residentId && value.partnerId === actor.partnerId
        && preview && value.key === JSON.stringify([product.id, product.kind, preview.position[0], preview.position[2], preview.rotationY, actor.residentId, actor.partnerId]);
}
async function searchUsablePlace(page, row, product, label, actor, recovery) {
    const attempt = { label, status: 'pending', trusted: false, states: [] };
    recovery.searchAttempts ??= []; recovery.searchAttempts.push(attempt);
    const control = button(placement(page), 'つかえる ばしょを さがす');
    // Retain the real searching frame even if a one-candidate search finishes
    // between driver calls. An old ready result cannot satisfy the new gesture.
    await control.evaluate(node => {
        window.__furnitureSearchProbe?.observer?.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]');
        const probe = window.__furnitureSearchProbe = { states: [], gesture: null };
        const sample = () => {
            if (!probe.gesture) return;
            const value = JSON.parse(host.getAttribute('data-furniture-placement') || 'null');
            if (!value || probe.states.length >= 1024) return;
            if (JSON.stringify(value) !== JSON.stringify(probe.states.at(-1)?.value)) probe.states.push({ value, frameTimestamp: host.dataset.frameTimestamp });
        };
        probe.observer = new MutationObserver(sample);
        probe.observer.observe(host, { attributes: true, attributeFilter: ['data-furniture-placement'] });
        node.addEventListener('click', event => { probe.gesture = { trusted: event.isTrusted, hidden: document.hidden }; }, { capture: true, once: true });
    });
    try {
        await press(page, row, 'つかえる ばしょを さがす', placement(page));
        await page.waitForFunction(() => window.__furnitureSearchProbe?.states.some(state => state.value.status === 'searching'));
        // The search emits ready + suggestion before React applies that pose.
        // Capture this gesture's terminal result from the finite frame history;
        // an old preview whose old key still matches is not an applied result.
        const terminalHandle = await page.waitForFunction(({ itemId, residentId, partnerId }) => {
            const states = window.__furnitureSearchProbe?.states ?? [];
            const matches = value => value.itemId === itemId && value.residentId === residentId && value.partnerId === partnerId;
            const start = states.findIndex(state => matches(state.value) && state.value.status === 'searching');
            if (start < 0) return false;
            return states.slice(start + 1).find(state => matches(state.value)
                && (state.value.status === 'no-space' || state.value.status === 'ready' && state.value.suggestion?.requestId)) ?? false;
        }, { itemId: product.id, ...actor });
        const terminal = await terminalHandle.jsonValue(); await terminalHandle.dispose();
        attempt.terminal = terminal;
        const suggestion = terminal.value.suggestion;
        if (terminal.value.status === 'ready') {
            assert(suggestion?.requestId, 'A successful explicit search must identify its own suggestion');
            attempt.requestId = suggestion.requestId; attempt.suggestion = suggestion;
        }
        const resolved = await waitScene(page, state => {
            if (!matchingPlacement(state, product, actor) || state.placement.busy) return false;
            if (terminal.value.status === 'no-space') return state.placement.status === 'no-space';
            return state.placement.status === 'ready'
                && (!state.placement.suggestion || state.placement.suggestion.requestId === suggestion.requestId)
                && Math.abs(state.preview.position[0] - suggestion.position.x) < 1e-8
                && Math.abs(state.preview.position[2] - suggestion.position.z) < 1e-8
                && Math.abs(state.preview.rotationY - suggestion.rotation) < 1e-8;
        }, `${label} same-search suggestion applied to the actual preview and assessment (or terminal no-space)`);
        attempt.appliedFrameTimestamp = await stage(page).getAttribute('data-frame-timestamp');
        attempt.status = resolved.placement.status; attempt.result = resolved.placement; attempt.preview = resolved.preview;
        return resolved;
    } finally {
        const observed = await page.evaluate(() => {
            const probe = window.__furnitureSearchProbe; probe?.observer?.disconnect();
            return probe ? { gesture: probe.gesture, states: probe.states } : null;
        });
        attempt.states = observed?.states ?? []; attempt.trusted = Boolean(observed?.gesture?.trusted && !observed.gesture.hidden);
        const file = `${row.name}-${label}-search.json`; attempt.file = file;
        await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...attempt, revision: manifest.revision, sourceHash: manifest.sourceHash }, null, 2));
        assert(attempt.trusted, 'Recovery search must begin from an actual trusted, visible gesture');
    }
}
async function arrangeAfterNoSpace(page, row, product, label, actor, recovery, before) {
    assert.notEqual(product.kind, 'telescope', 'This bounded surroundings recovery moves an existing telescope for a different tool');
    const telescope = products.find(item => item.kind === 'telescope'), stored = itemFor(islandFor(before, row.owner), telescope);
    assert(stored?.position, 'Surroundings recovery requires the actual previously placed telescope');
    const blocked = await scene(page);
    assert(matchingPlacement(blocked, product, actor)); assert.equal(blocked.placement.status, 'no-space');
    const selectedIds = [actor.residentId, ...(actor.partnerId ? [actor.partnerId] : [])];
    const actorUuids = selectedIds.map(id => blocked.rigs?.find(rig => rig.id === id)?.uuid);
    assert(actorUuids.every(uuid => typeof uuid === 'string' && uuid.length > 0), 'Capture the actual selected rig before leaving');
    const correction = recovery.surroundings = { status: 'incomplete', target: { x: -.5, z: -2.5 }, telescopeBefore: stored,
        selectedIds, actorUuids, noSpace: blocked.placement, unsavedBeforeExit: true, inventoryUnchanged: false, saved: false, returned: false };
    row.coverage.surroundingsRecovery = 'incomplete';
    await checkDB(page, row, `${label}-no-space-no-save`, before);
    correction.presentation = { captionHidden: await page.locator('.island-stage__caption').evaluate(caption => caption.hidden),
        sceneLabel: await stage(page).getAttribute('aria-label') };
    assert.equal(correction.presentation.captionHidden, true, 'A placement preview must hide the stale furniture-trial caption');
    assert.equal(correction.presentation.sceneLabel, 'しまの ものを おく ばしょを えらんでいるよ');
    await capture(page, row, `${label}-no-space`);
    await press(page, row, 'まわりの ものを うごかす', placement(page));
    await waitMode(page, 'inventory'); await waitWorld(page);
    await waitScene(page, state => !state.preview && !state.optional?.active && !state.optional?.trial, 'surroundings entry cancels only the unsaved preview');
    await checkDB(page, row, `${label}-surroundings-entry-no-save`, before); correction.inventoryUnchanged = true;
    await capture(page, row, `${label}-surroundings-inventory`);

    const index = islandFor(before, row.owner).items.findIndex(item => item.id === telescope.id);
    await press(page, row, `ぼうえんきょう ${index + 1}を うごかす`, inventory(page));
    await waitMode(page, 'placement'); await waitWorld(page);
    const origin = (await waitScene(page, state => state.preview?.id === telescope.id, 'the actual owned telescope from inventory')).preview;
    assert.equal(origin.position[0], stored.position.x); assert.equal(origin.position[2], stored.position.z);
    const dx = (correction.target.x - origin.position[0]) / .25, dz = (correction.target.z - origin.position[2]) / .25;
    assert(Number.isInteger(dx) && Number.isInteger(dz) && Math.abs(dx) + Math.abs(dz) > 0
        && Math.abs(dx) + Math.abs(dz) <= 64, 'Use a finite real-arrow route to the diagnosed candidate; never inject a pose');
    correction.controls = [...Array(Math.abs(dx)).fill(dx > 0 ? 'みぎへ' : 'ひだりへ'), ...Array(Math.abs(dz)).fill(dz > 0 ? 'てまえへ' : 'おくへ')];
    const point = [...origin.position]; correction.steps = [];
    for (const control of correction.controls) {
        await press(page, row, control, placement(page)); await painted(page);
        if (control === 'みぎへ') point[0] += .25; else if (control === 'ひだりへ') point[0] -= .25;
        else if (control === 'てまえへ') point[2] += .25; else point[2] -= .25;
        const value = await scene(page); assert.equal(value.preview?.id, telescope.id);
        assert(distance(value.preview.position, point) < 1e-8); assert.equal(value.preview.rotationY, origin.rotationY);
        correction.steps.push({ control, position: value.preview.position, valid: value.previewValid });
    }
    const candidate = await scene(page);
    assert.equal(candidate.previewValid, 'true', 'The diagnosed candidate must be actually legal in this frozen world');
    assert(await button(placement(page), 'ここに おく').isEnabled());
    await checkDB(page, row, `${label}-telescope-arrows-unsaved`, before);
    await capture(page, row, `${label}-telescope-candidate`);
    const action = { type: 'place', itemId: telescope.id, position: { ...correction.target }, rotation: candidate.preview.rotationY };
    await press(page, row, 'ここに おく', placement(page)); await waitMode(page, 'home');
    await waitNative(page, row, island => itemFor(island, telescope)?.position?.x === action.position.x
        && itemFor(island, telescope)?.position?.z === action.position.z, 'only telescope explicitly moved');
    const after = await checkDB(page, row, `${label}-telescope-moved`, before, action);
    correction.saved = true; correction.savedAction = action; correction.telescopeAfter = itemFor(islandFor(after, row.owner), telescope);
    assert.deepEqual(itemFor(islandFor(after, row.owner), product), itemFor(islandFor(before, row.owner), product), 'The original tool keeps its saved pose/ownership');
    row.placements.push({ label: `${label}-surroundings-telescope`, item: correction.telescopeAfter });
    await enterShop(page, row);
    // Do not select a product or resident here: the retained UI choice is the
    // behavior under test, not something the harness is allowed to repair.
    assert.equal(await shop(page).getAttribute('data-furniture-kind'), product.kind);
    assert.equal(await shop(page).locator(`[data-furniture-resident="${actor.residentId}"]`).getAttribute('aria-pressed'), 'true');
    if (actor.partnerId) assert.equal(await shop(page).locator(`[data-furniture-partner="${actor.partnerId}"]`).getAttribute('aria-pressed'), 'true');
    const returned = await scene(page);
    assert.deepEqual(selectedIds.map(id => returned.rigs?.find(rig => rig.id === id)?.uuid), actorUuids, 'Returning reuses the same actual resident rigs');
    await checkDB(page, row, `${label}-same-choice-return-no-save`, after); correction.returned = true;
    await press(page, row, itemFor(islandFor(after, row.owner), product).position ? 'おく ばしょを かえる' : 'おく ばしょを えらぶ', shop(page));
    await waitMode(page, 'placement'); await waitWorld(page);
    await waitScene(page, state => matchingPlacement(state, product, actor) && ['ready', 'blocked'].includes(state.placement.status), 'same tool and resident reassessed after surroundings move');
    const resolved = await searchUsablePlace(page, row, product, `${label}-after-surroundings`, actor, recovery);
    await checkDB(page, row, `${label}-after-surroundings-search-unsaved`, after);
    await capture(page, row, `${label}-after-surroundings-${resolved.placement.status}`);
    correction.result = resolved.placement;
    assert.equal(resolved.placement.status, 'ready', 'If the actual same-resident search still has no space, preserve FAIL rather than skip or change actors');
    correction.status = 'ready-awaiting-save-and-use';
    return { resolved, before: after };
}
async function moveAndSave(page, row, product, label, actor) {
    await waitMode(page, 'placement'); await waitWorld(page);
    let before = await tables(page);
    const initial = (await waitScene(page, state => state.preview?.id === product.id, 'actual placement preview')).preview;
    const matchingAssessment = state => matchingPlacement(state, product, actor);
    const assess = () => waitScene(page, state => matchingAssessment(state) && ['ready', 'blocked'].includes(state.placement.status), `${label} selected-resident availability`);
    // Intentionally seek an actual blocked preview on telescope rearrangement.
    // A finite search finding only ready candidates is evidence of an unexercised
    // recovery gate, never a reason to fabricate rejection or weaken collision.
    const seekBlocked = product.kind === 'telescope' && label.endsWith('-reposition');
    const search = { label, origin: initial.position, maxStepsPerAxis: 3, maxRotations: seekBlocked ? 3 : 1,
        objective: seekBlocked ? 'actual-legal-but-blocked' : 'different-legal-position', candidates: [] };
    row.placementSearches.push(search);
    const inverse = { 'みぎへ': 'ひだりへ', 'ひだりへ': 'みぎへ', 'てまえへ': 'おくへ', 'おくへ': 'てまえへ' };
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
    const offsets = [1, 2, 3].flatMap(steps => directions.map(([x, z]) => [x * steps, z * steps]));
    const applyControls = async controls => { for (const control of controls) { await press(page, row, control, placement(page)); await painted(page); } };
    const rotate = async () => { await press(page, row, 'まわす', placement(page)); await painted(page); };
    let chosen, assessed, fallback, turns = 0;
    for (let orientation = 1; orientation <= search.maxRotations && !chosen; orientation++) {
        await rotate(); turns++;
        for (const [x, z] of offsets) {
            const controls = [...Array(Math.abs(x)).fill(x > 0 ? 'みぎへ' : 'ひだりへ'), ...Array(Math.abs(z)).fill(z > 0 ? 'てまえへ' : 'おくへ')];
            await applyControls(controls);
            const value = await scene(page);
            assert.equal(value.preview?.id, product.id);
            const expected = [initial.position[0] + x * .25, initial.position[1], initial.position[2] + z * .25];
            assert(distance(value.preview.position, expected) < 1e-8, 'Real arrows must reach the intended candidate');
            const candidate = { steps: { x, z }, turns, controls, position: value.preview.position, rotation: value.preview.rotationY, valid: value.previewValid === 'true' };
            search.candidates.push(candidate);
            if (candidate.valid && distance(value.preview.position, initial.position) > .1) {
                const current = await assess(); candidate.availability = current.placement;
                fallback ??= candidate;
                if (!seekBlocked || current.placement.status === 'blocked') { chosen = current.preview; assessed = current; break; }
            }
            await applyControls([...controls].reverse().map(control => inverse[control]));
            const restored = await scene(page);
            assert.equal(restored.preview?.id, product.id);
            assert(distance(restored.preview.position, initial.position) < 1e-8, 'Rejected candidate must return to the original preview position');
            assert.equal(restored.preview.rotationY, value.preview.rotationY, 'Undoing movement preserves the deliberately selected rotation');
        }
    }
    if (!chosen && fallback) {
        search.blockedSearch = 'not-found-within-finite-budget';
        for (let extra = (fallback.turns - turns + 4) % 4; extra > 0; extra--) await rotate();
        await applyControls(fallback.controls);
        assessed = await assess(); chosen = assessed.preview;
        assert(distance(chosen.position, fallback.position) < 1e-8, 'Fallback is reached through the same actual UI arrows');
        assert.equal(assessed.previewValid, 'true');
    }
    assert(chosen, `No different legal location found in the ${offsets.length * search.maxRotations}-candidate real-UI search; preserve blocked-placement evidence`);
    assert(Math.abs(Math.sin((chosen.rotationY - initial.rotationY) / 2)) > .1, 'Actually change orientation, not just a full turn');
    await capture(page, row, `${label}-preview`); await checkDB(page, row, `${label}-unsaved`, before);
    search.availability = assessed.placement;
    if (assessed.placement.status === 'blocked') {
        assert.equal(assessed.previewValid, 'true', 'Storage validity and actual-body reachability are separate');
        assert((await placement(page).getByRole('status').allTextContents()).some(text => text.includes('ここには おけるけれど、つかうには すきまが いるよ。')), 'Show the actual legal-but-blocked explanation');
        await capture(page, row, `${label}-legal-but-unreachable`);
        const recovery = { label, itemId: product.id, kind: product.kind, rejectedPose: assessed.preview, rejectedAvailability: assessed.placement,
            sameResident: actor, legalButBlocked: true, explicitSearch: false, unsaved: false, saved: false, pass: false };
        search.recovery = recovery; row.recoveries.push(recovery); row.coverage.reachabilityRecovery = 'incomplete';
        let resolved = await searchUsablePlace(page, row, product, `${label}-initial`, actor, recovery);
        recovery.explicitSearch = true;
        await checkDB(page, row, `${label}-initial-search-unsaved`, before);
        if (resolved.placement.status === 'no-space') {
            const arranged = await arrangeAfterNoSpace(page, row, product, label, actor, recovery, before);
            resolved = arranged.resolved; before = arranged.before;
        } else assert(distance(resolved.preview.position, recovery.rejectedPose.position) > .001
            || Math.abs(resolved.preview.rotationY - recovery.rejectedPose.rotationY) > .001, 'An initially blocked pose must actually change before becoming a usable suggestion');
        chosen = resolved.preview; recovery.suggestedPose = chosen; recovery.availability = resolved.placement;
        await checkDB(page, row, `${label}-suggestion-is-not-a-save`, before); recovery.unsaved = true;
        await capture(page, row, `${label}-usable-suggestion`);
    }
    const action = { type: 'place', itemId: product.id, position: { x: chosen.position[0], z: chosen.position[2] }, rotation: chosen.rotationY };
    await press(page, row, 'ここに おく', placement(page)); await waitMode(page, 'furniture');
    await waitNative(page, row, island => itemFor(island, product)?.position?.x === action.position.x && itemFor(island, product)?.position?.z === action.position.z, `${label} exact position`);
    const after = await checkDB(page, row, label, before, action); row.placements.push({ label, item: itemFor(islandFor(after, row.owner), product) });
    if (search.recovery) { search.recovery.saved = true; search.recovery.savedAction = action; }
    await waitWorld(page); return search.recovery;
}
function completeRecovery(row, recovery, use) {
    if (!recovery) return;
    assert(recovery.legalButBlocked && recovery.explicitSearch && recovery.unsaved && recovery.saved);
    assert.equal(use.kind, recovery.kind); assert.equal(use.borrowed, false); assert(use.pass);
    assert.deepEqual(use.actorIds, [recovery.sameResident.residentId, ...(recovery.sameResident.partnerId ? [recovery.sameResident.partnerId] : [])]);
    if (recovery.surroundings) {
        assert(recovery.surroundings.inventoryUnchanged && recovery.surroundings.saved && recovery.surroundings.returned);
        assert.equal(recovery.surroundings.result.status, 'ready');
        assert.deepEqual(use.actorUuids, recovery.surroundings.actorUuids, 'The actor observed before no-space recovery must actually use the saved tool');
        recovery.surroundings.status = 'pass'; row.coverage.surroundingsRecovery = 'pass';
    }
    recovery.use = use; recovery.pass = true; row.coverage.reachabilityRecovery = 'pass';
}
async function returnLearning(page, row, label) {
    const before = await tables(page), plan = (await readNative(page, row.owner)).plan; assert(plan?.status === 'active');
    await press(page, row, 'まなぶ', shop(page)); await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page, row.owner)).plan, plan); await checkDB(page, row, `${label}-same-reservation`, before);
    // Hidden learning intentionally does not render fresh world diagnostics. Check
    // the actual input now and verify released actors after the world is visible again.
    assert(await stage(page).locator('canvas').evaluate(canvas => {
        const box = canvas.getBoundingClientRect(); return box.width === 0 || box.height === 0;
    }), 'Learning hides the island instead of waiting for the tool performance');
    await capture(page, row, `${label}-same-reservation`);
    const answered = await answerUI(page, plan, { touch: row.touch, dev: false });
    const saved = answered.state.islandPlans.find(candidate => candidate.id === plan.id); assert.equal(saved.revision, plan.revision + 1);
    const after = await tables(page), oldIsland = islandFor(before, row.owner), updated = islandFor(after, row.owner);
    for (const product of products) assert.deepEqual(itemFor(updated, product), itemFor(oldIsland, product), 'A normal answer never changes optional furniture');
    for (const field of ['experience', 'workshop', 'sharedMemories']) assert.deepEqual(updated[field], oldIsland[field]);
    for (const field of ['appearance', 'ownedItemIds', 'themeId', 'accentId', 'desiredItemId']) assert.deepEqual(updated.customization?.[field], oldIsland.customization?.[field]);
    for (const name of Object.keys(before).filter(name => /Photo/u.test(name))) assert.deepEqual(after[name], before[name]);
    row.learningReturns.push({ label, planId: plan.id, revisionBefore: plan.revision, revisionAfter: saved.revision, pass: true });
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterShop(page, row);
    await waitScene(page, state => !state.optional?.active && !state.optional?.trial, 'returning from learning does not resume the old performance');
}
async function purchases(page, row) {
    for (const [index, product] of products.entries()) {
        await selectProduct(page, row, product); const before = await tables(page), initial = islandFor(before, row.owner);
        const actor = residents[index], partner = product.kind === 'tea-table' ? residents[(index + 1) % residents.length] : undefined;
        await activate(shop(page).locator(`[data-furniture-resident="${actor}"]`), row.touch);
        if (partner) await activate(shop(page).locator(`[data-furniture-partner="${partner}"]`), row.touch);
        assert(!itemFor(initial, product)); assert(initial.customization.points >= product.price);
        await press(page, row, `${product.price}ほしで むかえる`, shop(page)); await waitMode(page, 'placement');
        await waitNative(page, row, island => Boolean(itemFor(island, product)), `${product.kind} earned possession`);
        const purchased = await checkDB(page, row, `purchase-${product.kind}`, before, { type: 'acquire-furniture', kind: product.kind });
        assert.equal(itemFor(islandFor(purchased, row.owner), product).position, undefined);
        await capture(page, row, `${product.kind}-acquired-stored`);
        await press(page, row, 'いどうを やめる', placement(page)); await waitMode(page, 'furniture'); await waitWorld(page);
        await checkDB(page, row, `${product.kind}-stored-cancel`, purchased);
        assert.equal(await button(shop(page), `${product.price}ほしで むかえる`).count(), 0);
        assert(await button(shop(page), 'ここで ためす').isDisabled());
        await press(page, row, 'おく ばしょを えらぶ', shop(page));
        const firstRecovery = await moveAndSave(page, row, product, `${product.kind}-first-place`, { residentId: actor, partnerId: partner });
        completeRecovery(row, firstRecovery, await useTool(page, row, product, actor, partner, false, `owned-${product.kind}-${actor}`));
        await press(page, row, 'おく ばしょを かえる', shop(page));
        const repositionRecovery = await moveAndSave(page, row, product, `${product.kind}-reposition`, { residentId: actor, partnerId: partner });
        completeRecovery(row, repositionRecovery, await useTool(page, row, product, actor, partner, false, `repositioned-${product.kind}-${actor}`));
        await press(page, row, 'おく ばしょを かえる', shop(page)); await waitMode(page, 'placement');
        const beforeStore = await tables(page); await press(page, row, 'いまは しまっておく', placement(page)); await waitMode(page, 'furniture');
        await checkDB(page, row, `${product.kind}-store`, beforeStore, { type: 'store', itemId: product.id });
        assert(await button(shop(page), 'ここで ためす').isDisabled());
        await press(page, row, 'おく ばしょを えらぶ', shop(page));
        const replaceRecovery = await moveAndSave(page, row, product, `${product.kind}-free-replace`, { residentId: actor, partnerId: partner });
        if (replaceRecovery) completeRecovery(row, replaceRecovery, await useTool(page, row, product, actor, partner, false, `free-replaced-${product.kind}-${actor}`));
        row.purchases.push({ kind: product.kind, itemId: product.id, price: product.price, acquisitionRevision: initial.revision, pass: true });
        await returnLearning(page, row, product.kind);
    }
}

const { chromium } = await import('playwright');
let browser;
try {
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_FURNITURE_HEADED !== '1' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_FURNITURE_HEADED === '1' };
    const selected = viewports.filter(row => !process.env.SANSU_ISLAND_FURNITURE_VIEWPORT || row.name === process.env.SANSU_ISLAND_FURNITURE_VIEWPORT);
    assert(selected.length, 'Unknown viewport');
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow' });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], traces: [], uses: [], placements: [], placementSearches: [], recoveries: [], purchases: [], learningReturns: [],
            coverage: { realEarned: 'not-run', trials3x3: 'not-run', ownedPlacementUse: 'not-run', reachabilityRecovery: 'not-exercised', surroundingsRecovery: 'not-exercised', reload: 'not-run', persistenceFaults: 'not-run', offlineProfileBackground: 'not-run', humanObservation: 'not-run' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row); row.coverage.realEarned = 'pass'; console.log(`${row.name}: ${row.earned.answers} actual answers earned ${row.earned.points} stars`);
            await trialMatrix(page, row); row.coverage.trials3x3 = 'pass-rendered-contact-and-exact-DB; image-review-pending';
            await purchases(page, row); row.coverage.ownedPlacementUse = 'pass-main-path';
            const before = await tables(page), plan = (await readNative(page, row.owner)).plan;
            assert.equal(products.reduce((total, product) => total + product.price, 0), 95);
            const events = before.islandEvents.filter(event => event.profileId === row.owner && event.type === 'furniture_acquired');
            assert.equal(events.length, 3); assert.deepEqual(events.map(event => event.kind).sort(), products.map(product => product.kind).sort());
            await page.reload(); await waitLearningInput(page, plan); assert.deepEqual((await readNative(page, row.owner)).plan, plan);
            await checkDB(page, row, 'reload-all-stores', before); await capture(page, row, 'reload-same-learning');
            await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterShop(page, row);
            for (const product of products) { await selectProduct(page, row, product); assert.equal(await button(shop(page), `${product.price}ほしで むかえる`).count(), 0); }
            await capture(page, row, 'all-three-owned-after-reload'); row.coverage.reload = 'pass';
            assert.equal(row.uses.filter(use => use.borrowed).length, 9);
            const extraRecoveryUses = row.recoveries.filter(recovery => recovery.pass && recovery.label.endsWith('-free-replace')).length;
            assert.equal(row.uses.filter(use => !use.borrowed).length, 6 + extraRecoveryUses);
            assert.equal(row.learningReturns.length, 3); assert.deepEqual(row.errors, []);
            row.finalTables = digestTables(await tables(page)); row.mainPathPass = true;
            row.pass = row.recoveries.some(recovery => recovery.pass) && row.coverage.reachabilityRecovery === 'pass';
            if (!row.pass) { row.coverage.reachabilityRecovery = 'not-exercised'; process.exitCode = 1; }
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
            console.log(`${row.pass ? 'PASS' : 'PARTIAL'} ${row.name}: furniture main path; recovery ${row.coverage.reachabilityRecovery}; persistence faults and human image review remain separate`);
        } catch (error) {
            row.failure = error.stack; process.exitCode = 1;
            await saveProbe(page, row).catch(() => {}); await capture(page, row, 'failure').catch(async () => {
                await page.screenshot({ path: `${out}/${row.name}-failure-raw.png`, fullPage: true }).catch(() => {});
            });
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = selected.length === viewports.length && report.layouts.every(row => row.pass);
    report.gates.reachabilityRecovery = selected.length === viewports.length && report.layouts.every(row => row.coverage.reachabilityRecovery === 'pass') ? 'pass'
        : report.layouts.some(row => row.recoveries.length) ? 'incomplete' : 'not-exercised';
    const surroundings = report.layouts.flatMap(row => row.recoveries.map(recovery => recovery.surroundings).filter(Boolean));
    report.gates.surroundingsRecovery = surroundings.length ? surroundings.every(recovery => recovery.status === 'pass') ? 'pass-observed-paths' : 'incomplete' : 'not-exercised';
    report.gates.runtimeIntegrity = report.pass ? 'passed-selected-main-scenarios' : 'failed-or-partial';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    try {
        report.finalFingerprints = await fingerprint();
        assert.deepEqual(report.finalFingerprints, initialSource, 'Frozen app, bundle app inputs or QA closure changed'); report.sourceStable = true;
    } catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; report.gates.runtimeIntegrity = 'source-changed'; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Furniture UI evidence</title><style>body{font:16px system-ui;margin:24px;background:#f5f2e9}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;padding:12px}img{width:100%}small{display:block;overflow-wrap:anywhere}</style><h1>Furniture main path — image review pending</h1><p>${escape(target)} · ${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Human N=0. Actual UI learning earns all ownership. Phase/contact checks do not certify appeal, silent comprehension or learning effects. Persistence-fault and dense-world coverage remains unexecuted.</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.frameFile)}" alt="${escape(item.name)}"></a><figcaption>${escape(item.name)}</figcaption><small>${escape(item.candidate)} · ${escape(item.delivery)} · ${escape(item.revision)} · ${escape(item.frameSha256)}</small></figure>`).join('')}</main>`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
