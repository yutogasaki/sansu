import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Matrix4, Vector3 } from 'three';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const scenarios = [
    'M01/M02: empty database -> named profile -> actual ordinary answers until three residents are available; no progress/geometry fixture',
    'M01/M02: three actual specimens and saved A; otter same-object pickup/lift/carry/release, rabbit three distinct petals, fox real glass or shadow surface',
    'M03: native IDB writes observed transparently; visible actual result frame must precede result-seen save, and stop/learning/exit/native hidden cancel unfinished work',
    'M03: cancel during walking/lifting/carrying/second petal/before illumination/optional return; original displayed Object3D and owner data survive',
    'M03: prepared request reload remains still until explicit UI continuation; no timed or automatic replay',
    'M04: three resident-specific memories revisit the same target after reload, including stored display; firstAt/order/count stay unchanged; current specimen rename keeps historical target name',
    'M05: 12 real distinct memories -> repeated combination -> 13th real result with full shelf -> explicit memory removal -> remember retained result without losing target or older first facts',
    'M12: optional work permits the same complete planner reservation to resume and accept a real answer; every native store is checked outside allowed shared/workshop changes',
    'Phone normal motion and tablet reduced motion; native background interruption is also exercised under explicit normal motion in both viewports',
];
const limitations = [
    'Prepared harness is not executed evidence. Human N=0; screenshots require independent visual and silent-comprehension review.',
    'Formal learning P95/throughput and pedagogical validation are not measured by this heavily instrumented optional-work run.',
    'Photo persistence, multi-owner CAS, offline migration and unknown-result retries belong to separate harnesses; no such pass is inferred here.',
    'Native background requires actual hidden/visible events in a headed same-window second tab. A synthetic hidden property/event is never substituted.',
    'M01-M05/M12 optional-work slice only; this does not complete the whole spec38 or the benchmark Goal.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, viewports, scenarios, limitations,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_SHARED_JOBS_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        headedDefault: true, optionalEnvironment: { SANSU_ISLAND_SHARED_JOBS_HEADED: '0 permits headless debugging but native background remains unverified', SANSU_ISLAND_SHARED_JOBS_VIEWPORT: 'phone or tablet for a bounded diagnostic; default runs both' },
        sourceRule: 'Fresh output only; immutable manifest files and exact QA dependencies fingerprinted before and after.',
        instrumentation: ['readonly all-store native IDB snapshots', 'transparent native put/add observer for shared receipts', 'MutationObserver samples of rendered host plus exact current canvas PNG', 'driver focus-emulation true to false without dependency file changes'],
        mutationRule: 'Only actual UI buttons, native pointer/key input and tab visibility. No page imports of app modules, app function calls, geometry/progress injection or persistence fault injection.',
    }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_SHARED_JOBS_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set frozen production URL, build manifest and fresh output');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
assert(manifest.revision && manifest.sourceHash && manifest.files?.length, 'Actual frozen source manifest required');
const sha = value => createHash('sha256').update(value).digest('hex');
const qaFiles = ['tools/e2e-island-shared-jobs.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...manifest.files.map(file => file.path), ...qaFiles].map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const initialSource = await fingerprint();
assert.deepEqual(initialSource.slice(0, manifest.files.length), manifest.files.map(({ path: file, sha256 }) => ({ path: file, sha256 })));
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec38Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, limitations,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    fingerprints: initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const shared = page => page.locator('section[aria-label="かざりと なかまの きおく"]');
const displayIds = ['display-1', 'display-2', 'display-3'];
const speciesNames = { otter: 'カワウソ', rabbit: 'ウサギ', fox: 'キツネ' };
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
            workshop: read('data-workshop'), residents: read('data-resident-states'), frame: node.getAttribute('data-camera-frame'), requestSeen: node.getAttribute('data-shared-request-seen') };
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
async function movePart(page, row, id, col, gridRow, rotation = 0) {
    await idle(page); await activate(page.locator(`[data-part-id="${id}"]`), row.touch);
    for (let count = 0; (await readNative(page)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation !== rotation; count++) {
        assert(count < 4); const old = (await readNative(page)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation;
        await press(page, 'まわす', row.touch); await waitNative(page, island => island.workshop.draftCheckpoint.draft.layout.parts[id].rotation !== old, `${id} rotated`);
    }
    await details(page, 'タップで おく', row.touch); await activate(page.locator(`[data-workshop-cell="${col},${gridRow}"]`), row.touch);
    await waitNative(page, island => { const point = island.workshop.draftCheckpoint.draft.layout.parts[id].position; return point?.col === col && point.row === gridRow; }, `${id} moved to ${col},${gridRow}`);
}
async function saveWork(page, row, workId, name) {
    await details(page, 'さくひんを のこす', row.touch); const slot = page.locator(`[data-work-id="${workId}"]`);
    await slot.locator('input').fill(name); await press(page, 'いまを のこす', row.touch, slot);
    return waitNative(page, island => island.workshop.works[workId]?.name === name, `${workId} ${name} saved`);
}

async function instrument(context) {
    await context.addInitScript(() => {
        const native = { put: IDBObjectStore.prototype.put, add: IDBObjectStore.prototype.add };
        const visibility = () => ({ ms: performance.now(), hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() });
        window.__sharedJobVisibility = [visibility()];
        document.addEventListener('visibilitychange', () => window.__sharedJobVisibility.push(visibility()));
        for (const method of ['put', 'add']) IDBObjectStore.prototype[method] = function (...args) {
            const result = native[method].apply(this, args), value = args[0], probe = window.__sharedJobProbe;
            if (!probe || probe.closed) return result;
            const request = this.name === 'islands' ? value?.sharedMemories?.activeRequest : undefined;
            const event = this.name === 'islandEvents' && ['shared_memory_changed', 'shared_memory_first'].includes(value?.type) ? value : undefined;
            if (!request && !event) return result;
            const host = document.querySelector('[data-testid="island-stage"]');
            const entry = { ms: performance.now(), method, store: this.name, key: value.id ?? value.profileId,
                request: request ? structuredClone(request) : undefined, event: event ? structuredClone(event) : undefined,
                hostFrameTimestamp: Number(host?.dataset.frameTimestamp), frame: probe.frames.at(-1), successMs: undefined };
            probe.writes.push(entry);
            result.addEventListener('success', () => { entry.successMs = performance.now(); });
            return result;
        };
    });
}
async function armProbe(page, label) {
    await page.evaluate(label => {
        window.__sharedJobProbe?.observer?.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]');
        const probe = window.__sharedJobProbe = { label, started: performance.now(), closed: false, frames: [], images: [], writes: [] };
        const images = new Set(); let last = '', carryOrigin;
        const sample = () => {
            if (probe.closed || probe.frames.length >= 6000) return;
            const timestamp = host.dataset.frameTimestamp; if (!timestamp || timestamp === last) return; last = timestamp;
            const read = key => { const value = host.getAttribute(key); return value ? JSON.parse(value) : null; };
            const canvas = host.querySelector('canvas'), box = canvas?.getBoundingClientRect(), job = read('data-shared-job');
            const cx = box ? box.x + box.width / 2 : -1, cy = box ? box.y + box.height / 2 : -1;
            const frame = { ms: performance.now(), timestamp: Number(timestamp), job, displays: read('data-shared-displays'),
                preview: read('data-shared-preview'), residents: read('data-resident-states'), camera: host.dataset.cameraFrame,
                requestSeen: host.dataset.sharedRequestSeen, visibility: document.visibilityState,
                canvas: { width: box?.width, height: box?.height, visible: Boolean(box && box.width > 100 && box.height > 100
                    && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth),
                    centerVisible: cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight && document.elementFromPoint(cx, cy) === canvas } };
            probe.frames.push(frame);
            if (!job || !frame.canvas.visible || document.hidden) return;
            const keys = [job.phase];
            if (job.phase === 'pickup-contact' && job.gripDistances?.every(distance => distance < .045)) keys.push('actual-both-hands');
            if (job.phase === 'carrying') {
                carryOrigin ??= job.targetPosition;
                if (Math.hypot(...job.targetPosition.map((n, i) => n - carryOrigin[i])) > .3) keys.push('carrying-along-route');
            }
            if (job.phase === 'hands-released' && job.gripDistances?.every(distance => distance > .06)) keys.push('actual-hands-released');
            if (job.light) keys.push('actual-light-surface-receiver');
            if (job.emitted) keys.push('visible-result-emitted');
            for (const key of keys) if (!images.has(key) && probe.images.length < 40) {
                images.add(key); probe.images.push({ key, frame, png: canvas.toDataURL('image/png') });
            }
        };
        const observer = new MutationObserver(sample); observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
        probe.observer = observer; sample();
    }, label);
}
async function saveProbe(page, row, label) {
    const probe = await page.evaluate(() => {
        const value = window.__sharedJobProbe; if (!value) return null;
        value.closed = true; value.observer.disconnect();
        return { label: value.label, frames: value.frames, images: value.images, writes: value.writes, visibility: window.__sharedJobVisibility };
    });
    if (!probe) return;
    const images = probe.images; delete probe.images;
    const file = `${row.name}-${label}-trace.json`;
    await fs.writeFile(`${out}/${file}`, JSON.stringify(probe, null, 2));
    row.traces.push({ label, file, frames: probe.frames.length, writes: probe.writes.length });
    for (const image of images) {
        const file = `${row.name}-${label}-${image.key}.png`, bytes = Buffer.from(image.png.split(',')[1], 'base64');
        assert(bytes.length > 10000, `${file}: an actual renderer image is required`);
        await fs.writeFile(`${out}/${file}`, bytes);
        report.captures.push({ name: label, file, sha256: sha(bytes), frameKind: 'actual-rendered-canvas',
            revision: manifest.revision, delivery: row.metadata.delivery, candidate: row.metadata.candidate, viewport: row.viewport,
            reducedMotion: row.currentMotion, actual: image.frame });
    }
    return probe;
}
async function waitJob(page, predicate, label, timeout = 45000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const value = await scene(page); if (predicate(value.job, value)) return value;
        const failure = await shared(page).locator('.island-shared-feedback').textContent().catch(() => '');
        assert(!failure?.includes('ばしょを かえて'), `${label}: actual controller could not find a safe route; ${failure}`);
        await pause(35);
    }
    throw new Error(`Actual shared job did not reach ${label}`);
}
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
const xyz = value => Array.isArray(value) ? value : [value.x, value.y, value.z];
async function stop(page, row, label = 'うごきを とめる') {
    await press(page, label, row.touch, shared(page)); await waitWorld(page);
    await waitJob(page, job => job === null, 'explicit stop restores idle');
}
async function chooseResident(page, row, species) {
    const control = shared(page).locator('.island-shared-residents').getByRole('button', { name: new RegExp(`^${speciesNames[species]}`) });
    assert.equal(await control.count(), 1, `${species}: only an actually available resident can be selected`);
    await activate(control, row.touch); await idle(page);
}
async function startAsk(page, row, species, label) {
    await chooseResident(page, row, species); await armProbe(page, label);
    const before = await tables(page), previous = before.islands[0].sharedMemories?.activeRequest?.requestId;
    await press(page, `${speciesNames[species]}に たのむ`, row.touch, shared(page));
    const native = await waitNative(page, island => island.sharedMemories?.activeRequest?.requestId !== previous
        && island.sharedMemories?.activeRequest?.residentId === species, `${label} prepared`);
    const request = native.island.sharedMemories.activeRequest;
    await waitJob(page, job => job?.requestId === request.requestId, `${label} actual renderer started`);
    return { before, request };
}
function inActualFrame(frame, points) {
    const values = frame.camera?.split(',').map(Number);
    assert(values?.length === 32 && values.every(Number.isFinite), 'Actual renderer camera matrix required');
    const view = new Matrix4().fromArray(values.slice(0, 16)).invert(), projection = new Matrix4().fromArray(values.slice(16));
    return points.every(point => {
        const projected = new Vector3(...xyz(point)).applyMatrix4(view).applyMatrix4(projection);
        return Math.abs(projected.x) <= .98 && Math.abs(projected.y) <= .98 && Math.abs(projected.z) <= 1;
    });
}
function validateJob(probe, request, saved, sourceUuid, requireTravel) {
    const frames = probe.frames.filter(frame => frame.job?.requestId === request.requestId), jobs = frames.map(frame => frame.job);
    assert(frames.length > 2, 'Actual job must have multiple rendered stages');
    assert.equal(new Set(jobs.map(job => job.targetUuid)).size, 1, 'One actual object through every job stage');
    if (sourceUuid) assert.equal(jobs[0].targetUuid, sourceUuid, 'Displayed source cannot be substituted with a fresh object');
    assert(jobs.every(job => job.targetKey === request.target.targetKey && job.actorId === request.residentId));
    assert.equal(new Set(jobs.map(job => job.actorUuid)).size, 1, 'Borrow one actual resident object throughout');
    const firstWrite = probe.writes.find(write => write.store === 'islands' && write.request?.requestId === request.requestId && write.request.status === 'result-seen');
    assert(firstWrite, 'Observe the native result-seen write, not just React success text');
    const emitted = frames.find(frame => frame.job.emitted);
    assert(emitted && emitted.ms <= firstWrite.ms, 'A rendered emitted-result frame must precede the native completed result write');
    assert(emitted.visibility === 'visible' && emitted.canvas.visible && emitted.canvas.centerVisible, 'Result must be displayed in the actual visible canvas');
    assert(saved.targetUuid === jobs[0].targetUuid, 'Actual held object survives saving into its destination');
    if (request.jobId === 'carry') {
        const contact = jobs.find(job => job.phase === 'pickup-contact' && job.gripDistances?.every(n => n < .045));
        const lifted = jobs.find(job => job.phase === 'carrying');
        const released = jobs.find(job => job.phase === 'hands-released' && job.gripDistances?.every(n => n > .06));
        assert(contact && lifted && released, 'Both actual hands contact, lift, carry, then separate');
        const contactFrame = frames.find(frame => frame.job === contact), releaseFrame = frames.find(frame => frame.job === released);
        assert(inActualFrame(contactFrame, [...contact.hands, ...contact.grips]) && inActualFrame(releaseFrame, [released.targetPosition, ...released.hands]), 'Actual contacts and released object remain inside the rendered crop');
        assert(lifted.targetPosition[1] > contact.targetPosition[1] + .08, 'The real object rises off its table');
        assert(distance(released.targetPosition, xyz(saved.anchors.destination)) < .045, 'Actual object reaches the actual destination before release');
        if (requireTravel) assert(jobs.some(job => job.phase === 'carrying' && distance(job.targetPosition, lifted.targetPosition) > .25), 'New tray delivery must visibly travel');
    } else if (request.jobId === 'gather') {
        const final = jobs.find(job => job.phase === 'three-petals-visible' && job.petals.every(petal => petal.visible));
        assert(final && final.petals.length === 3 && new Set(final.petals.map(petal => petal.uuid)).size === 3);
        for (let index = 0; index < 3; index++) {
            const pickup = jobs.find(job => job.phase === `petal-${index + 1}-pickup` && distance(job.hands[0], job.petals[index].position) < .045);
            assert(pickup, `Petal ${index + 1} must touch the actual hand`);
            assert(inActualFrame(frames.find(frame => frame.job === pickup), [pickup.hands[0], pickup.petals[index].position]));
            assert(distance(final.petals[index].position, xyz(saved.anchors.petals[index])) < .045, `Petal ${index + 1} reaches its own actual destination`);
            assert(jobs.every(job => job.petals[index].uuid === final.petals[index].uuid), 'Finite same petal objects are used throughout');
        }
    } else {
        const light = jobs.find(job => job.phase === 'surface-illuminated' && job.light)?.light;
        assert(light && light.uuid && distance(xyz(light.source), xyz(light.surface)) > .1 && distance(xyz(light.surface), xyz(light.receiver)) > .02);
        assert(inActualFrame(frames.find(frame => frame.job.light === light), [light.source, light.surface, light.receiver]), 'The physical source, surface and result must fit the same actual frame');
        assert.equal(light.effect, request.result.effect); // request passed here is the persisted completed request.
        assert(jobs.some(job => job.phase === 'lamp-pickup'), 'Actual hand first visits the prepared lamp');
    }
    return { actualFrames: frames.length, targetUuid: jobs[0].targetUuid, actorUuid: jobs[0].actorUuid,
        emittedMs: emitted.ms, nativeWriteMs: firstWrite.ms, stages: [...new Set(jobs.map(job => job.phase))] };
}
async function runJob(page, row, species, label, { optionalReturn = true } = {}) {
    const initial = await scene(page), selection = await shared(page).locator('.island-shared-slots button[aria-pressed="true"]').textContent();
    const { before, request } = await startAsk(page, row, species, label);
    const result = await waitNative(page, island => island.sharedMemories?.activeRequest?.requestId === request.requestId
        && island.sharedMemories.activeRequest.status === 'result-seen', `${label} visible result saved`, 90000);
    if (optionalReturn) await waitJob(page, job => job?.requestId === request.requestId && job.phase === 'settled', `${label} optional return`, 35000);
    else {
        const phase = (await scene(page)).job?.phase, declined = await tables(page);
        assert(phase && phase !== 'settled', 'Decline the optional return while it is actually unfinished');
        await stop(page, row); await checkDB(page, row, `${label}-optional-return-declined`, declined);
        row.optionalReturns.push({ label, phaseAtDecline: phase, savedResultPreserved: true });
    }
    const saved = (await scene(page)).displays.find(display => display.displayId === request.destination.displayId);
    assert(saved && !saved.carried && saved.targetKey === request.target.targetKey);
    const probe = await saveProbe(page, row, label);
    const source = initial.displays.find(display => display.targetKey === request.target.targetKey);
    const evidence = validateJob(probe, result.island.sharedMemories.activeRequest, saved, source?.targetUuid, request.source.kind === 'tray');
    await checkDB(page, row, label, before, ['shared']);
    row.jobs.push({ label, request: result.island.sharedMemories.activeRequest, selection, ...evidence, pass: true });
    await capture(page, row, `${label}-result`);
    return result.island.sharedMemories.activeRequest;
}

async function resumeLearningAnswer(page, row, label, before, plan) {
    await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page)).plan, plan, `${label}: retain the entire ordinary reservation`);
    unchanged(before, await tables(page));
    await capture(page, row, `${label}-same-learning`);
    const answered = await answerUI(page, plan, { touch: row.touch, dev: false });
    const after = await tables(page);
    assert.deepEqual(optionalState(after), optionalState(before), 'A real answer cannot modify optional work, receipts or workshop');
    row.learningReturns.push({ label, planId: plan.id, beforeRevision: plan.revision,
        afterRevision: answered.state.islandPlans.find(saved => saved.id === plan.id).revision, optionalStateSha256: sha(JSON.stringify(optionalState(after))), pass: true });
}
async function interruption(page, row, kind, species, phase) {
    row.currentMotion = 'no-preference'; await page.emulateMedia({ reducedMotion: row.currentMotion });
    let background, cdp;
    if (kind === 'native-hidden') {
        cdp = await page.context().newCDPSession(page);
        const main = await cdp.send('Target.getTargetInfo'), mainWindow = await cdp.send('Browser.getWindowForTarget', { targetId: main.targetInfo.targetId });
        background = await page.context().newPage(); await background.goto('about:blank');
        const otherCdp = await page.context().newCDPSession(background), other = await otherCdp.send('Target.getTargetInfo');
        const otherWindow = await otherCdp.send('Browser.getWindowForTarget', { targetId: other.targetInfo.targetId });
        assert.equal(mainWindow.windowId, otherWindow.windowId, 'Native visibility requires two tabs of the same Chromium window');
        row.backgroundWindows = { main: mainWindow.windowId, other: otherWindow.windowId }; await otherCdp.detach();
        await page.bringToFront(); await page.waitForFunction(() => !document.hidden && document.hasFocus()); await waitWorld(page);
    }
    const label = `cancel-${kind}-${species}-${phase}`, source = (await scene(page)).displays[0];
    const { request } = await startAsk(page, row, species, label);
    await waitJob(page, job => job?.requestId === request.requestId && job.phase === phase, label);
    const before = await tables(page), reservation = (await readNative(page)).plan;
    assert.equal(before.islands[0].sharedMemories.activeRequest.status, 'prepared');
    let nativeVisibility;
    if (kind === 'native-hidden') {
        await background.bringToFront();
        try {
            await page.waitForFunction(() => document.hidden && document.visibilityState === 'hidden', undefined, { polling: 25, timeout: 4000 });
            nativeVisibility = await page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() }));
            await pause(650); // Negative observation window only; no success inferred from elapsed time.
            unchanged(before, await tables(page));
        } catch (error) {
            row.nativeBackground = { status: 'UNVERIFIED', error: error.message, actual: await page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() })) };
            throw error;
        } finally {
            await background.close(); await cdp.detach(); await page.bringToFront();
            await page.waitForFunction(() => !document.hidden && document.visibilityState === 'visible');
        }
    } else if (kind === 'learning') {
        await press(page, 'まなぶ', row.touch, shared(page)); await resumeLearningAnswer(page, row, label, before, reservation);
        await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
    } else if (kind === 'exit') {
        await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
    } else if (kind === 'reload') {
        await saveProbe(page, row, `${label}-before-reload`); await page.reload();
        if (await page.locator('.island-page[data-mode="learning"]').count()) { await waitLearningInput(page, reservation); await goHome(page, row.touch); }
        else await waitWorld(page);
        await openShared(page, row.touch, 'display-1');
    } else await press(page, 'いったん とめる', row.touch, shared(page));
    await waitWorld(page); await waitJob(page, job => job === null, `${label} restores actual objects`);
    if (kind !== 'learning') await checkDB(page, row, `${label}-no-invisible-result`, before);
    else assert.deepEqual((await readNative(page)).island.sharedMemories, before.islands[0].sharedMemories);
    const restored = (await scene(page)).displays.find(display => display.targetKey === request.target.targetKey);
    assert(restored && !restored.carried, 'Cancelled real target returns to its saved table');
    if (kind !== 'reload') assert.equal(restored.targetUuid, source.targetUuid, 'Cancellation retains the original actual object');
    const probe = kind === 'reload' ? undefined : await saveProbe(page, row, label);
    if (probe) assert(!probe.writes.some(write => write.request?.requestId === request.requestId && write.request.status === 'result-seen'), 'Unfinished result never reaches native persistence');
    await pause(350); // A forbidden auto-replay observation window, not a success timer.
    assert.equal((await scene(page)).job, null, 'Foreground/reentry does not automatically replay a consumed command');
    assert.equal((await readNative(page)).island.sharedMemories.activeRequest.status, 'prepared');
    row.cancellations.push({ kind, phase, species, requestId: request.requestId, restoredUuid: restored.targetUuid, nativeVisibility, pass: true });
    await capture(page, row, `${label}-restored`);
    // Only this explicit real control may restart the retained prepared intent.
    const resumeBaseline = await tables(page);
    await armProbe(page, `${label}-explicit-resume`);
    await press(page, 'おねがいを つづける', row.touch, shared(page));
    const after = await waitNative(page, island => island.sharedMemories?.activeRequest?.requestId === request.requestId
        && island.sharedMemories.activeRequest.status === 'result-seen', `${label} explicit restart result`, 90000);
    await waitJob(page, job => job?.phase === 'settled', `${label} resumed return`, 35000);
    const resume = await saveProbe(page, row, `${label}-explicit-resume`), saved = (await scene(page)).displays.find(display => display.targetKey === request.target.targetKey);
    validateJob(resume, after.island.sharedMemories.activeRequest, saved, restored.targetUuid, false);
    await checkDB(page, row, `${label}-resume-only-shared`, resumeBaseline, ['shared']);
    row.currentMotion = row.reducedMotion; await page.emulateMedia({ reducedMotion: row.currentMotion }); await stop(page, row);
}
async function showSource(page, row, index) {
    await selectSlot(page, row.touch, 'display-1');
    const sources = shared(page).locator('.island-shared-sources');
    if (!await sources.count()) await press(page, 'かざる ものを えらぶ', row.touch, shared(page));
    await activate(sources.locator('button').nth(index), row.touch); await page.locator('.island-shared-preview').waitFor();
    if (!await button(shared(page), 'じぶんで おく').isEnabled()) {
        const trials = [], origin = (await scene(page)).preview[0]?.anchors.destination;
        let legal = false;
        for (const [direction, reverse] of [['てまえへ', 'おくへ'], ['ひだりへ', 'みぎへ'], ['みぎへ', 'ひだりへ'], ['おくへ', 'てまえへ']]) {
            let steps = 0;
            for (; steps < 8; steps++) {
                await press(page, direction, row.touch, shared(page)); await painted(page);
                const preview = (await scene(page)).preview[0];
                legal = await button(shared(page), 'じぶんで おく').isEnabled();
                trials.push({ direction, step: steps + 1, destination: preview?.anchors.destination, legal });
                if (legal) break;
            }
            if (legal) break;
            for (let n = 0; n < steps; n++) await press(page, reverse, row.touch, shared(page));
        }
        row.placementTrials.push({ sourceIndex: index, origin, trials });
        assert(legal, 'Real preview arrow controls must find a legal placement; no helper or geometry injection is used');
    }
    return (await scene(page)).preview[0];
}
async function memoryRevisit(page, row, memory, label, { store = false } = {}) {
    await stop(page, row); await selectSlot(page, row.touch, 'display-1');
    let before = await tables(page);
    if (store) {
        await press(page, 'この かざりを はずす', row.touch, shared(page));
        await press(page, 'はずす', row.touch, shared(page).locator('.island-shared-confirm'));
        await waitNative(page, island => !island.sharedMemories.displays['display-1'], 'display stored before remembered reaction');
        await checkDB(page, row, `${label}-store-display-only`, before, ['shared']); before = await tables(page);
    }
    await press(page, 'なかまの きおく', row.touch, shared(page));
    const memories = before.islands[0].sharedMemories.memories.slice().sort((a, b) => a.firstOrder - b.firstOrder || a.memoryKey.localeCompare(b.memoryKey));
    const index = memories.findIndex(value => value.memoryKey === memory.memoryKey); assert(index >= 0);
    const card = shared(page).locator('.island-shared-memory').nth(index);
    assert((await card.textContent()).includes(memory.targetName), 'Historical target name remains visible');
    await armProbe(page, label); await press(page, 'いっしょに みる', row.touch, card);
    await waitJob(page, job => job?.targetKey === memory.target.targetKey && job.actorId === memory.residentId, `${label} actual remembered actor and object`);
    await waitJob(page, job => job?.phase === 'settled', `${label} remembered reaction finishes`, 50000);
    const probe = await saveProbe(page, row, label), jobs = probe.frames.filter(frame => frame.job).map(frame => frame.job);
    assert(jobs.length && jobs.every(job => job.targetKey === memory.target.targetKey && job.actorId === memory.residentId));
    assert.equal(new Set(jobs.map(job => job.targetUuid)).size, 1);
    const expected = memory.jobId === 'carry' ? 'together-resting' : memory.jobId === 'gather' ? 'snack-offered' : 'surface-illuminated';
    assert(jobs.some(job => job.phase === expected), 'The remembered resident gives its corresponding physical reaction');
    await checkDB(page, row, label, before);
    row.memories.push({ label, key: memory.memoryKey, firstAt: memory.firstAt, firstOrder: memory.firstOrder, targetUuid: jobs[0].targetUuid, stored: store, pass: true });
    await capture(page, row, label); await press(page, 'しまに かざる', row.touch, shared(page)); await selectSlot(page, row.touch, 'display-1');
}
async function setupWorks(page, row) {
    await goHome(page, row.touch); await openWorkshop(page, row.touch); await press(page, 'つくる', row.touch);
    for (const [index, id] of ['straight', 'wheel', 'bell'].entries()) {
        await activate(page.locator(`[data-part-id="${id}"]`), row.touch);
        await press(page, `${id === 'straight' ? 'ながれぎ' : id === 'wheel' ? 'いろガラス' : 'しまもようの かい'}を はめる`, row.touch);
        await waitNative(page, island => island.workshop.draftCheckpoint.draft.layout.parts[id].assembled, `${id} assembled through UI`);
        await movePart(page, row, id, index, 1);
    }
    await saveWork(page, row, 'work-1', 'いっしょの みち A');
    await movePart(page, row, 'bell', 2, 2); await saveWork(page, row, 'work-2', 'いっしょの みち B');
    await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
}
async function shelfCapacity(page, row) {
    const before13 = await tables(page), memories = before13.islands[0].sharedMemories.memories;
    assert.equal(memories.length, 12, 'Twelve distinct actually performed memories required');
    await showSource(page, row, 4); const thirteenth = await runJob(page, row, 'otter', 'thirteenth-real-result');
    assert.equal(thirteenth.memoryOutcome, 'not-stored-full');
    const full = await tables(page); assert.deepEqual(full.islands[0].sharedMemories.memories, memories, 'Full shelf never evicts older memories');
    assert.equal(full.islands[0].sharedMemories.displays['display-1'].target.targetKey, thirteenth.target.targetKey, 'Real work and display succeed even with a full memory shelf');
    assert((await shared(page).locator('.island-shared-request').textContent()).includes('いっぱい'));
    await press(page, 'なかまの きおく', row.touch, shared(page));
    const first = shared(page).locator('.island-shared-memory').first();
    await press(page, 'この きおくを たなから はずす', row.touch, first);
    await press(page, 'はずす', row.touch, first.locator('.island-shared-confirm'));
    await waitNative(page, island => island.sharedMemories.memories.length === 11, 'explicit memory removal');
    const removed = await checkDB(page, row, 'remove-only-one-memory', full, ['shared']);
    assert.deepEqual(removed.islands[0].sharedMemories.displays, full.islands[0].sharedMemories.displays);
    assert.deepEqual(removed.islands[0].sharedMemories.memories, memories.slice(1));
    await press(page, 'この きおくを のこす', row.touch, shared(page));
    const restored = await waitNative(page, island => island.sharedMemories.memories.some(memory => memory.memoryKey === thirteenth.memoryKey), 'remember retained result explicitly');
    assert.equal(restored.island.sharedMemories.memories.length, 12);
    assert.deepEqual(restored.island.sharedMemories.memories.filter(memory => memory.memoryKey !== thirteenth.memoryKey), memories.slice(1));
    await checkDB(page, row, 'remember-existing-result-only', removed, ['shared']);
    row.capacity = { pass: true, countBefore: 12, thirteenthRequest: thirteenth.requestId, outcomeAtFull: thirteenth.memoryOutcome,
        removed: memories[0].memoryKey, remembered: thirteenth.memoryKey };
    await capture(page, row, 'finite-shelf-after-explicit-choice');
    await press(page, 'しまに かざる', row.touch, shared(page)); await selectSlot(page, row.touch, 'display-1');
}

async function renameCurrentSpecimen(page, row, memory) {
    const before = await tables(page);
    await goHome(page, row.touch); await openWorkshop(page, row.touch); await selectSpecimen(page, row, 'driftwood');
    await details(page, 'たなに かざる・なまえを つける', row.touch);
    await page.locator('#workshop-specimen-name').fill('いっしょの ふね');
    await press(page, 'きめる', row.touch, page.locator('.island-workshop-name'));
    await waitNative(page, island => island.workshop.specimens.driftwood.name === 'いっしょの ふね', 'current specimen renamed');
    const after = await checkDB(page, row, 'rename-current-preserves-historical-memory', before, ['workshop']);
    assert.deepEqual(after.islands[0].sharedMemories.memories.find(item => item.memoryKey === memory.memoryKey), memory);
    await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
}
async function prepareEarnedIsland(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, 'まなぶ', row.touch); await page.locator('.island-setup-name input').fill(`なかま${row.name}`);
    await press(page, '年中', row.touch); await press(page, 'さんすう', row.touch);
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page), answers = 0;
    row.owner = native.plan.profileId;
    while (native.island.completedSets < 1) { native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; assert(++answers < 200); }
    await goHome(page, row.touch); await openShared(page, row.touch, 'display-1'); await showSource(page, row, 0);
    assert.equal(await shared(page).locator('.island-shared-residents').getByRole('button', { name: /^キツネ/ }).count(), 0, 'First earned section cannot use an unavailable fox');
    const unavailable = await tables(page); await press(page, 'まなぶ', row.touch, shared(page)); await waitLearningInput(page, native.plan);
    unchanged(unavailable, await tables(page));
    while (native.island.completedSets < 4 || (native.island.growth?.expansionLevel ?? 0) < 1) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers < 200, 'Actual ordinary answers must unlock the waterside in a bounded run');
    }
    row.earned = { answerCount: answers, completedSets: native.island.completedSets, expansionLevel: native.island.growth?.expansionLevel,
        receiptIds: native.islandEvents.filter(event => event.type === 'answer').map(event => event.id), fixture: false };
    assert.equal(row.earned.receiptIds.length, answers, 'Every earned step is backed by its real answer receipt');
    await goHome(page, row.touch); await openWorkshop(page, row.touch);
    const beforeWorkshop = await tables(page);
    for (const id of ['driftwood', 'seaglass', 'striped-shell']) await finishSpecimen(page, row, id);
    await checkDB(page, row, 'real-specimen-preparation-only-workshop', beforeWorkshop, ['workshop']);
    await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
    await capture(page, row, 'earned-three-residents-and-actual-specimens');
}

const { chromium } = await import('playwright');
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
let browser;
try {
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_SHARED_JOBS_HEADED === '0' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_SHARED_JOBS_HEADED !== '0' };
    const selectedViewports = viewports.filter(row => !process.env.SANSU_ISLAND_SHARED_JOBS_VIEWPORT || row.name === process.env.SANSU_ISLAND_SHARED_JOBS_VIEWPORT);
    assert(selectedViewports.length, 'Unknown viewport selection');
    for (const layout of selectedViewports) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow' });
        await instrument(context); await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(25000);
        const row = { ...layout, currentMotion: layout.reducedMotion, pass: false, errors: [], databaseChecks: [], learningReturns: [], jobs: [], memories: [], placementTrials: [], optionalReturns: [], cancellations: [], traces: [] };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await waitReady(page); row.metadata = await runtimeMetadata(page);
            assert.equal(row.metadata.revision, manifest.revision); console.log(`${row.name}: actual onboarding and earned resident unlock`);
            await prepareEarnedIsland(page, row);
            const firstMemories = [];
            for (const [index, id] of ['driftwood', 'seaglass', 'striped-shell'].entries()) {
                await showSource(page, row, index);
                for (const species of ['otter', 'rabbit', 'fox']) {
                    console.log(`${row.name}: ${id} / ${species}`);
                    const result = await runJob(page, row, species, `${id}-${species}`, { optionalReturn: species !== 'rabbit' || id === 'driftwood' });
                    if (id === 'driftwood') firstMemories.push((await readNative(page)).island.sharedMemories.memories.find(memory => memory.memoryKey === result.memoryKey));
                }
            }
            assert.equal((await readNative(page)).island.sharedMemories.memories.length, 9);
            // Repeat an existing combination and check the actual first receipt.
            await showSource(page, row, 0); const previousFacts = (await readNative(page)).island.sharedMemories.memories;
            await runJob(page, row, 'otter', 'repeat-same-memory');
            assert.deepEqual((await readNative(page)).island.sharedMemories.memories, previousFacts);
            await renameCurrentSpecimen(page, row, firstMemories[0]);
            for (const memory of firstMemories) await memoryRevisit(page, row, memory, `remember-${memory.residentId}`);
            // A document restart must preserve the immutable memory key and require
            // an explicit memory gesture; UUID equality is only within a scene lifetime.
            await page.reload(); await waitLearningInput(page); await goHome(page, row.touch); await openShared(page, row.touch, 'display-1');
            assert.equal((await scene(page)).job, null);
            await memoryRevisit(page, row, firstMemories[0], 'remember-after-reload-and-storage', { store: true });
            await showSource(page, row, 0); await runJob(page, row, 'otter', 'restore-existing-memory-target');
            const cancellationCases = [
                ['stop', 'otter', 'walking'], ['stop', 'otter', 'lifting'], ['native-hidden', 'otter', 'carrying'],
                ['learning', 'rabbit', 'petal-2-pickup'], ['exit', 'fox', 'lamp-pickup'], ['reload', 'otter', 'carrying'],
            ];
            for (const [kind, species, phase] of cancellationCases) {
                console.log(`${row.name}: ${kind} during ${species}/${phase}`); await interruption(page, row, kind, species, phase);
            }
            const beforeWorks = await tables(page); await setupWorks(page, row); await checkDB(page, row, 'two-actual-snapshot-works', beforeWorks, ['workshop']);
            await showSource(page, row, 3);
            for (const species of ['otter', 'rabbit', 'fox']) await runJob(page, row, species, `work-A-${species}`);
            await shelfCapacity(page, row);
            const finalOptional = await tables(page), plan = (await readNative(page)).plan;
            await press(page, 'まなぶ', row.touch, shared(page)); await resumeLearningAnswer(page, row, 'full-shared-flow', finalOptional, plan);
            assert.deepEqual(row.errors, [], 'No browser exceptions during the real critical path');
            row.pass = true;
        } catch (error) {
            row.failure = error.stack; await capture(page, row, 'failure').catch(() => {});
            await saveProbe(page, row, 'failure-last-frames').catch(() => {});
            await fs.writeFile(`${out}/${row.name}-failure-dom.txt`, await page.locator('body').innerText().catch(() => 'Page unavailable'));
            await fs.writeFile(`${out}/${row.name}-failure-native.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            throw error;
        } finally {
            await context.tracing.stop({ path: `${out}/${row.name}-playwright-trace.zip` }).catch(() => {}); await context.close();
        }
    }
    report.sourceUnchanged = JSON.stringify(await fingerprint()) === JSON.stringify(initialSource);
    assert(report.sourceUnchanged, 'Immutable app source or QA harness changed during the run');
    report.pass = report.layouts.length === 2 && report.layouts.every(row => row.pass);
    report.gates.runtimeIntegrity = report.pass ? 'PASS' : 'PARTIAL: a bounded viewport subset ran';
} catch (error) { report.failure = error.stack; report.gates.runtimeIntegrity = 'FAIL'; process.exitCode = 1; }
finally {
    await browser?.close(); CRSession.prototype.send = driverSend;
    report.finishedAt = new Date().toISOString();
    report.finalFingerprints = await fingerprint(); report.sourceUnchanged = JSON.stringify(report.finalFingerprints) === JSON.stringify(initialSource);
    if (!report.sourceUnchanged) { report.pass = false; report.gates.runtimeIntegrity = 'FAIL: source changed'; process.exitCode = 1; }
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Shared actual jobs</title><style>body{font:14px system-ui;margin:24px;background:#f8f0de;color:#173b40}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}figure{margin:0}img{width:100%;height:420px;object-fit:contain;background:#eee4cc}figcaption{overflow-wrap:anywhere}</style><h1>Shared work ${report.pass ? 'PASS' : 'FAIL / INCOMPLETE'}</h1><p>${escape(target)} · ${escape(report.revision)} · actual UI earning; no application-data injection · human N=0 · visual review required</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.file)}"></a><figcaption>${escape(item.file)}<br>${escape(item.frameKind)}<br>SHA256 ${escape(item.sha256)}</figcaption></figure>`).join('')}</main>`);
    console.log(JSON.stringify({ pass: report.pass, gates: report.gates, layouts: report.layouts.map(row => ({ name: row.name, pass: row.pass, jobs: row.jobs.length, cancellations: row.cancellations.length })), report: `${out}/report.json` }));
}
