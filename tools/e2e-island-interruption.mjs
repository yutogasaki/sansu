import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Matrix4, Vector3 } from 'three';
import assert from 'node:assert/strict';
import { activate as activateControl, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_INTERRUPTION_OUTPUT || 'output/playwright/island-interruption';
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE || 'output/playwright/island-interruption/build-source.json';
const filter = process.env.SANSU_ISLAND_INTERRUPTION_SCENARIO;
const part = process.env.SANSU_ISLAND_INTERRUPTION_PART || 'full';
assert(['full', 'clearance', 'learning-clearance'].includes(part), 'Interruption part must be full, clearance or learning-clearance');
const launchOptions = process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {};
const actionCalls = [], actionContexts = new WeakMap();
async function activate(control, touch = false) {
    const call = { index: actionCalls.length, context: actionContexts.get(control.page()), control: String(control),
        method: touch ? 'locator.tap' : 'locator.click', startedAtEpochMs: Date.now() };
    actionCalls.push(call);
    try { return await activateControl(control, touch); }
    catch (error) { call.error = error.message; throw error; }
    finally { call.finishedAtEpochMs = Date.now(); call.milliseconds = call.finishedAtEpochMs - call.startedAtEpochMs; }
}
const layouts = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
].filter(layout => !filter || layout.name === filter);
assert(layouts.length, 'Scenario must be phone or tablet');
const sha = value => createHash('sha256').update(value).digest('hex');
const compiled = await build({ stdin: { contents: `
    export { ISLAND_ITEMS, isValidIslandPlacement } from './src/domain/island/catalog.ts';
    export { residentGroundIsSafe } from './src/components/island/three/navigation.ts';
    export { planFurnitureClearance } from './src/components/island/three/furnitureClearance.ts';
    export { getFurnitureAnchors } from './src/components/island/three/furnitureVisuals.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const oracleSource = compiled.outputFiles[0].text;
const { ISLAND_ITEMS, isValidIslandPlacement, residentGroundIsSafe, planFurnitureClearance, getFurnitureAnchors } = await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
const sourceSnapshot = async () => {
    const manifest = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    const paths = [...new Set([...manifest.files.map(file => file.path), 'tools/e2e-island-interruption.mjs',
        'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(`${out}/videos`, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', candidate: ISLAND_CANDIDATE,
    startedAt: new Date().toISOString(), sourceStart: await sourceSnapshot(), fixtureModuleHash, oracleHash: sha(oracleSource),
    scenarios: [], captures: [], pass: false, browserClosed: false, diagnostic: part !== 'full', part, actionCalls,
    browserContext: { launchOptions, requestedGpu: process.env.SANSU_ISLAND_BROWSER_GPU || 'default', headless: true,
        controlTiming: 'Node wall-clock call start/end; trusted browser events use performance.timeOrigin + event.at. Locator actionability remains enabled.' },
    coverage: { walkingEditCancel: part === 'full', interruptedDeparture: part === 'full', crossPageEdit: part === 'full', latestInvitationDuringClearance: part !== 'learning-clearance', learningDuringClearance: true },
    timing: 'One MutationObserver row per actual draw-count change. Use the runtime frame timestamp when exposed; older builds use the mutation observation time. Record frameCpuMs separately when available. Click snapshots retain their separate event time and last rendered frame timestamp. Start and ready boundaries use the earliest actual recorded matching draw, never a later sampled pose.',
    scope: `${part !== 'full' ? `DIAGNOSTIC ${part === 'learning-clearance' ? 'LEARNING CLEARANCE' : 'CLEARANCE'} ONLY: after earning the bench and waiting for its real arrival, omit the original walking edit/cancel, interrupted departure and cross-page edit cases.${part === 'learning-clearance' ? ' Also omit latest-invitation coverage.' : ''} This cannot pass full interruption coverage. ` : ''}Production UI with one actually earned bench per isolated phone/tablet profile. The full run cancels a placement while walking, interrupts a seat approach and later leaves legally, and updates an occupied bench from another app page. Clearance cases use real toy visits/storage and legal bench placement to exercise a saved-furniture side step, latest-only invitation, and learning entry while two serial side steps are active. Native data writes set up only the initial profile/memory. Pure geometry chooses a legal UI placement and predicts routes; it never injects actors or runtime state. Real click snapshots, actual draw observations, video and all-store comparisons document continuity. Time-sensitive invitations and learning resume precede database comparisons; the subsequent all-store comparison requires exactly the saved furniture edit relative to the pre-save baseline, so unexpected play or resume writes still fail. Explicit placement/storage, a real reserved plan and one real answer have separate expected-write checks; only animation/play/pause intervals claim unchanged DB. Existing .12 boundary and elapsed-time motion tolerances remain. Functional evidence only, not child observation or a formal benchmark.` };
const browser = await chromium.launch(launchOptions);
report.browserContext.version = browser.version();
const browserSession = await browser.newBrowserCDPSession();
try {
    report.browserContext.arguments = (await browserSession.send('Browser.getBrowserCommandLine')).arguments;
    const { gpu } = await browserSession.send('SystemInfo.getInfo');
    report.browserContext.gpu = { devices: gpu.devices, renderer: gpu.auxAttributes?.glRenderer, vendor: gpu.auxAttributes?.glVendor };
} catch (error) {
    report.browserContext.inspectionError = error.message;
} finally { await browserSession.detach(); }
const groundDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function installProbe(page) {
    await page.evaluate(() => {
        window.__islandInterruptionProbe?.stop();
        const rows = [], events = {}, pendingClicks = new Map();
        const read = () => {
            const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
            if (!d) return null;
            const frameTimestamp = d.frameTimestamp === undefined ? undefined : Number(d.frameTimestamp);
            const frameCpuMs = d.frameCpuMs === undefined ? undefined : Number(d.frameCpuMs);
            return { at: performance.now(), timeOrigin: performance.timeOrigin, frameTimestamp: Number.isFinite(frameTimestamp) ? frameTimestamp : undefined,
                frameCpuMs: Number.isFinite(frameCpuMs) ? frameCpuMs : undefined,
                drawCount: Number(d.drawCount), visibility: document.visibilityState, mode: document.querySelector('.island-page')?.dataset.mode,
                residents: d.residentStates ? JSON.parse(d.residentStates) : [],
                furniture: d.furnitureState ? JSON.parse(d.furnitureState) : [],
                preview: d.previewState ? JSON.parse(d.previewState) : null,
                shared: d.sharedActivity ? JSON.parse(d.sharedActivity) : null,
                clearance: d.furnitureClearance ? JSON.parse(d.furnitureClearance) : null,
                camera: d.cameraFrame, inputReady: document.querySelector('[data-island-plan-id]')?.getAttribute('data-input-ready') === 'true',
                requestId: d.playRequestId, status: d.playStatus, selectedId: d.selectedItem };
        };
        let host = null, lastDraw = -1;
        const record = () => {
            if (!host?.hasAttribute('data-draw-count')) return;
            const draw = Number(host.dataset.drawCount);
            if (draw === lastDraw) return;
            lastDraw = draw;
            const row = read();
            if (row) rows.push({ ...row, observedAt: row.at, at: row.frameTimestamp ?? row.at,
                timingMethod: row.frameTimestamp === undefined ? 'draw-mutation-observed-at' : 'runtime-frame-timestamp' });
            if (rows.length > 4000) rows.splice(0, rows.length - 4000);
        };
        // Read after a synchronous draw has updated all datasets. Polling the
        // same old pose with a fresh time can mismeasure the next physical step.
        const drawObserver = new MutationObserver(record);
        const connect = () => {
            const next = document.querySelector('[data-testid="island-stage"]');
            if (next === host) return;
            drawObserver.disconnect(); host = next;
            lastDraw = host?.hasAttribute('data-draw-count') ? Number(host.dataset.drawCount) : -1;
            if (host) drawObserver.observe(host, { attributes: true, attributeFilter: ['data-draw-count'] });
        };
        const hostObserver = new MutationObserver(connect);
        hostObserver.observe(document.documentElement, { childList: true, subtree: true });
        connect();
        const normalizeName = name => name.replace(/\s+/g, ' ').trim();
        const controlClick = event => {
            const control = event.target instanceof Element ? event.target.closest('button') : null;
            if (!control) return;
            const name = normalizeName(control.getAttribute('aria-label') ?? control.textContent ?? '');
            const tag = pendingClicks.get(name);
            if (!tag) return;
            events[tag] = { ...read(), inputEvent: { type: event.type, clientX: event.clientX, clientY: event.clientY,
                isTrusted: event.isTrusted, controlName: name } };
            pendingClicks.delete(name);
        };
        document.addEventListener('click', controlClick, true);
        window.__islandInterruptionProbe = { read, rows, events, reset: () => { rows.length = 0; },
            armClicks: controls => controls.forEach(({ name, tag }) => { delete events[tag]; pendingClicks.set(normalizeName(name), tag); }),
            stop: () => { drawObserver.disconnect(); hostObserver.disconnect(); document.removeEventListener('click', controlClick, true); } };
    });
}
const scene = page => page.evaluate(() => window.__islandInterruptionProbe.read());
async function observeClick(control, tag) {
    await control.evaluate((element, tag) => {
        element.addEventListener('click', event => { window.__islandInterruptionProbe.events[tag] = { ...window.__islandInterruptionProbe.read(),
            inputEvent: { type: event.type, clientX: event.clientX, clientY: event.clientY, isTrusted: event.isTrusted } }; }, { capture: true, once: true });
    }, tag);
}
const eventScene = (page, tag) => page.evaluate(tag => window.__islandInterruptionProbe.events[tag], tag);
const armControlClicks = (page, controls) => page.evaluate(controls => window.__islandInterruptionProbe.armClicks(controls), controls);
const residentAt = (actual, species) => actual.residents.find(resident => resident.species === species);
async function databaseSnapshot(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = [...db.objectStoreNames].sort(), transaction = db.transaction(names, 'readonly');
        const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const entries = await Promise.all(names.map(async name => {
            const store = transaction.objectStore(name), keys = read(store.getAllKeys()), rows = read(store.getAll());
            return [name, { keys: await keys, rows: await rows }];
        }));
        db.close(); return Object.fromEntries(entries);
    });
}
async function unchanged(page, before, row, reason) {
    const after = await databaseSnapshot(page); assert.deepEqual(after, before, `${reason}: every IndexedDB record and key stays unchanged`);
    row.persistence.push({ reason, stores: Object.keys(after), sha256: sha(JSON.stringify(after)), unchanged: true });
}
async function capture(page, row, name) {
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision); assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE); assert.equal(metadata.artDirection, report.manifest.island.artDirection);
    const file = `${row.name}-${name}.png`, image = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata, scene: await scene(page) });
}
async function openPlay(page, row) {
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    if (mode === 'play') return;
    assert.equal(mode, 'home'); await activate(button(page, 'どうぶつと あそぶ'), row.touch); await waitMode(page, 'play');
}
function playControlName(island, id) {
    const items = island.items.filter(item => item.position), index = items.findIndex(item => item.id === id); assert(index >= 0);
    return `${ISLAND_ITEMS[items[index].kind].name} ${index + 1}で あそぶ`;
}
const playControl = (page, island, id) => button(page, playControlName(island, id));
async function invite(page, row, island, id) {
    const previous = (await scene(page)).requestId;
    await activate(playControl(page, island, id), row.touch);
    await page.waitForFunction(({ previous, id }) => {
        const actual = window.__islandInterruptionProbe.read();
        return actual?.requestId && actual.requestId !== previous && actual.status === 'playing' && actual.selectedId === id;
    }, { previous, id });
    const actual = await scene(page); assert.equal(actual.shared, null, 'These distant toys use ordinary resident visits');
    return actual;
}
async function waitResident(page, id, action) {
    await page.waitForFunction(({ id, action }) => window.__islandInterruptionProbe.read()?.residents.some(resident => resident.itemId === id
        && (action === 'walk' ? resident.action === 'walk' : resident.action !== 'walk' && resident.usePhase >= 1)), { id, action }, { timeout: 18000 });
    return (await scene(page)).residents.find(resident => resident.itemId === id);
}
async function beginEdit(page, row, state, id, eventTag) {
    if (await page.locator('.island-page').getAttribute('data-mode') === 'play') {
        await activate(button(page, 'あそびを とじる'), row.touch); await waitMode(page, 'home');
    }
    await activate(button(page, 'もちもの'), row.touch); await waitMode(page, 'inventory');
    const index = state.island.items.findIndex(item => item.id === id), item = state.island.items[index]; assert(item);
    const control = button(page, `${ISLAND_ITEMS[item.kind].name} ${index + 1}を うごかす`);
    if (eventTag) await observeClick(control, eventTag);
    await activate(control, row.touch); await waitMode(page, 'placement');
    await page.waitForFunction(id => window.__islandInterruptionProbe.read()?.preview?.id === id, id);
}
async function movePreview(page, row, id, position) {
    const preview = (await scene(page)).preview; assert.equal(preview.id, id);
    for (const [axis, index, negative, positive] of [['x', 0, 'ひだりへ', 'みぎへ'], ['z', 2, 'おくへ', 'てまえへ']]) {
        const count = (position[axis] - preview.position[index]) * 4;
        assert(Math.abs(count - Math.round(count)) < .0001, 'Quarter-unit arrow controls can reach the intended position');
        for (let step = 0; step < Math.abs(Math.round(count)); step++) await activate(button(page, count < 0 ? negative : positive), row.touch);
    }
    await page.waitForFunction(({ id, position }) => {
        const p = window.__islandInterruptionProbe.read()?.preview;
        return p?.id === id && Math.abs(p.position[0] - position.x) < .0001 && Math.abs(p.position[2] - position.z) < .0001;
    }, { id, position });
}
async function save(page, row, state, id) {
    assert(await button(page, 'ここに おく').isEnabled());
    const preview = (await scene(page)).preview;
    await activate(button(page, 'ここに おく'), row.touch); await waitMode(page, 'home');
    const after = await readNative(page, row.profileId);
    assert.equal(after.island.revision, state.island.revision + 1);
    assert.deepEqual(after.island.items.find(item => item.id === id).position, { x: preview.position[0], z: preview.position[2] });
    assert.deepEqual(after.logs, state.logs); assert.deepEqual(after.islandPlans, state.islandPlans);
    return after;
}
async function earnBench(page, row) {
    await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
    let state = await readNative(page, row.profileId), guard = 0;
    await waitLearningReady(page, state.plan);
    while (state.plan) {
        assert(++guard <= 12); const answered = await attempt(page, state, { touch: row.touch });
        row.answers.push(answered.sample); state = answered.after;
    }
    await waitMode(page, 'reward'); assert.equal(state.island.completedSets, 1);
    const reward = state.island.pendingRewards[0]; assert(reward.choices.includes('bench'));
    await activate(button(page, ISLAND_ITEMS.bench.name), row.touch); await waitMode(page, 'placement');
    state = await readNative(page, row.profileId); const id = `${reward.id}:item`;
    await page.waitForFunction(id => window.__islandInterruptionProbe.read()?.preview?.id === id, id);
    const position = { x: -3.5, z: .5 };
    assert(isValidIslandPlacement(state.island, id, position)); await movePreview(page, row, id, position);
    await page.evaluate(() => window.__islandInterruptionProbe.reset());
    state = await save(page, row, state, id);
    row.earned = { itemId: id, rewardId: reward.id, completedSets: 1, position };
    return state;
}
async function saveTrace(page, row, name, species) {
    const trace = await page.evaluate(() => window.__islandInterruptionProbe.rows);
    const visible = trace.filter(frame => frame.visibility === 'visible');
    let maximumStep = 0, movingSamples = 0;
    for (let index = 0; index < visible.length; index++) {
        const frame = visible[index], resident = residentAt(frame, species); if (!resident) continue;
        const point = resident.position;
        assert(residentGroundIsSafe({ x: point[0], z: point[2] }, false), 'The interrupted resident stays on the main island');
        if (resident.action === 'walk') movingSamples++;
        const previousFrame = visible[index - 1], previous = previousFrame && residentAt(previousFrame, species);
        if (previous && frame.at - previousFrame.at <= 120) {
            const step = groundDistance(point, previous.position); maximumStep = Math.max(maximumStep, step);
            // Existing motion is at most 1/620 units per ms before easing. The
            // .12 frame allowance also covers a stale dataset at a UI boundary.
            assert(step <= (frame.at - previousFrame.at) * .005 + .12, 'No seat-sized position jump occurs between observed frames');
        }
    }
    const file = `${row.name}-${name}-trace.json`;
    await fs.writeFile(`${out}/${file}`, `${JSON.stringify(trace)}\n`);
    return { file, sha256: sha(JSON.stringify(trace)), samples: trace.length, movingSamples, maximumStep, species };
}

async function liftWalkingBench(page, row, id) {
    const canvas = page.locator('[data-renderer="three"] canvas');
    const [rect, actual] = await Promise.all([canvas.boundingBox(), scene(page)]);
    assert.equal(actual.mode, 'home');
    const model = actual.furniture.find(item => item.id === id);
    assert(model?.visible && model.kind === 'bench', 'The earned bench is an actual visible world target');
    const values = actual.camera?.split(',').map(Number);
    assert(rect && values?.length === 32 && values.every(Number.isFinite), 'Actual camera matrices and canvas bounds are available');
    const anchor = getFurnitureAnchors('bench').seat;
    const world = new Vector3(anchor.x, anchor.y, anchor.z).multiply(new Vector3(...model.rootScale))
        .applyAxisAngle(new Vector3(0, 1, 0), model.rotationY).add(new Vector3(...model.position));
    const point = world.clone().applyMatrix4(new Matrix4().fromArray(values.slice(0, 16)).invert())
        .applyMatrix4(new Matrix4().fromArray(values.slice(16)));
    assert(Math.abs(point.x) < .93 && Math.abs(point.y) < .93, 'The bench contact surface is comfortably inside the visible canvas');
    const target = { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
    row.walkingEditTarget = { method: 'real-world-bench-surface', model, world: world.toArray(), camera: actual.camera, rect, target };
    await canvas.evaluate((element, target) => {
        if (document.elementFromPoint(target.x, target.y) !== element) throw new Error('An interface layer covers the visible bench tap');
        for (const [type, tag] of [['pointerup', 'lift-walking'], ['click', 'lift-walking-click']]) {
            element.addEventListener(type, event => { window.__islandInterruptionProbe.events[tag] = { ...window.__islandInterruptionProbe.read(),
                inputEvent: { type: event.type, clientX: event.clientX, clientY: event.clientY, isTrusted: event.isTrusted } }; }, { capture: true, once: true });
        }
    }, target);
    if (row.touch) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y);
    await waitMode(page, 'placement');
    await page.waitForFunction(id => window.__islandInterruptionProbe.read()?.preview?.id === id, id);
    assert.equal((await scene(page)).preview.sourceVisible, false, 'The actual surface hit lifts the intended earned bench');
}

async function cancelWalkingEdit(page, row) {
    const id = row.earned.itemId, moving = await waitResident(page, id, 'walk'), species = moving.species;
    const seat = [row.earned.position.x, 0, row.earned.position.z];
    assert(groundDistance(moving.position, seat) > 1, 'The new bench starts an actual journey before editing');
    const before = await databaseSnapshot(page);
    // One real world-surface tap preserves the midwalk interval. The other
    // scenarios continue to cover inventory navigation and its move control.
    await liftWalkingBench(page, row, id);
    const clickScene = await eventScene(page, 'lift-walking'), liftScene = await scene(page);
    const clicked = residentAt(clickScene, species), lifted = residentAt(liftScene, species);
    row.walkingCancelBoundary = { clickScene, liftScene, species, seat,
        clickDistance: groundDistance(clicked.position, seat), liftDistance: groundDistance(lifted.position, seat),
        boundaryDistance: groundDistance(lifted.position, clicked.position) };
    assert.equal(clicked.action, 'walk', 'The real lift click occurs before arrival');
    assert(groundDistance(clicked.position, seat) > .62, 'The actual lift input leaves the original half-unit travel margin plus the boundary allowance');
    assert(groundDistance(lifted.position, clicked.position) <= .12, 'Lifting keeps the currently rendered x/z');
    assert(groundDistance(lifted.position, seat) > .5, 'Lifted resident was not moved to the destination');
    await capture(page, row, 'walking-lifted');
    const cancel = button(page, 'いどうを やめる'); await observeClick(cancel, 'cancel-walking');
    await activate(cancel, row.touch); await waitMode(page, 'home');
    const resumed = await waitResident(page, id, 'walk'), cancelPoint = residentAt(await eventScene(page, 'cancel-walking'), species);
    assert.equal(resumed.species, species);
    assert(groundDistance(resumed.position, cancelPoint.position) <= .12, 'Cancelling resumes from the held point rather than the seat');
    assert(groundDistance(resumed.position, seat) > .5, 'Ordinary motion resumes with distance still to travel');
    await capture(page, row, 'walking-cancel-resumed');
    const arrived = await waitResident(page, id, 'settled'); assert.equal(arrived.action, 'sit');
    assert(groundDistance(arrived.position, seat) < .0001);
    await unchanged(page, before, row, 'Walking lift/cancel and resumed arrival');
    row.walkingCancel = { clicked, lifted, resumed, arrived, trace: await saveTrace(page, row, 'walking-cancel', species) };
    assert(row.walkingCancel.trace.movingSamples > 10);
}

async function interruptedDeparture(page, row, state) {
    const benchId = row.earned.itemId, flowerId = 'starter-flower', lampId = 'starter-lantern';
    await openPlay(page, row);
    // Two actual visits move the bench occupant away and leave the other
    // resident available for the next long approach. No actor is repositioned.
    await invite(page, row, state.island, flowerId); await waitResident(page, flowerId, 'settled');
    await invite(page, row, state.island, lampId); const lampOccupant = await waitResident(page, lampId, 'settled');
    const before = await databaseSnapshot(page);
    await page.evaluate(() => window.__islandInterruptionProbe.reset());
    await invite(page, row, state.island, benchId);
    const walker = await waitResident(page, benchId, 'walk'), species = walker.species;
    assert.notEqual(species, lampOccupant.species);
    const control = playControl(page, state.island, lampId); await observeClick(control, 'inside-footprint-interrupt');
    await page.waitForFunction(({ benchId, position }) => {
        const resident = window.__islandInterruptionProbe.read()?.residents.find(resident => resident.itemId === benchId && resident.action === 'walk');
        const d = resident && Math.hypot(resident.position[0] - position.x, resident.position[2] - position.z);
        return resident && d < 1.02 && d > .6;
    }, { benchId, position: row.earned.position }, { timeout: 18000 });
    await activate(control, row.touch);
    await page.waitForFunction(({ species, benchId }) => {
        const resident = window.__islandInterruptionProbe.read()?.residents.find(resident => resident.species === species);
        return resident && resident.itemId === '' && resident.departingId === benchId && resident.action !== 'walk';
    }, { species, benchId });
    const event = residentAt(await eventScene(page, 'inside-footprint-interrupt'), species), stopped = residentAt(await scene(page), species);
    assert.equal(event.action, 'walk');
    assert(Math.hypot(event.position[0] - row.earned.position.x, event.position[2] - row.earned.position.z) < ISLAND_ITEMS.bench.radius + .42,
        'The actual interruption occurs inside the old seat clearance');
    assert(groundDistance(stopped.position, event.position) <= .12, 'A different invitation stops at the actual foot position');
    await capture(page, row, 'inside-seat-footprint-stopped');
    await invite(page, row, state.island, flowerId);
    const leaving = await waitResident(page, flowerId, 'walk'); assert.equal(leaving.species, species);
    const arrived = await waitResident(page, flowerId, 'settled'); assert.equal(arrived.species, species);
    assert.equal(arrived.action, 'sniff'); assert(!arrived.departingId, 'Temporary seat departure permission clears on safe land');
    await capture(page, row, 'left-seat-footprint-legally');
    await unchanged(page, before, row, 'Near-arrival interruption, other-resident replay and later legal departure');
    row.departure = { event, stopped, leaving, arrived, trace: await saveTrace(page, row, 'interrupted-departure', species) };
}

async function crossPageEdit(context, page, row, state) {
    const id = row.earned.itemId;
    await invite(page, row, state.island, id); const seated = await waitResident(page, id, 'settled');
    assert.equal(seated.action, 'sit'); const before = await databaseSnapshot(page);
    await page.evaluate(() => window.__islandInterruptionProbe.reset());
    const editor = await context.newPage(); editor.setDefaultTimeout(16000);
    actionContexts.set(editor, { scenario: row.name, surface: 'cross-page-editor' });
    editor.on('pageerror', error => row.errors.push(error.stack ?? String(error)));
    try {
        await editor.goto(`${base}/#/island`); await waitReady(editor); await waitMode(editor, 'home'); await installProbe(editor);
        const current = await readNative(editor, row.profileId); assert.deepEqual(current.island, state.island);
        await beginEdit(editor, row, current, id);
        const position = { x: -.75, z: 1.5 }; assert(isValidIslandPlacement(current.island, id, position));
        await movePreview(editor, row, id, position); const after = await save(editor, row, current, id);
        await capture(editor, row, 'other-page-saved-bench');
        await page.bringToFront();
        await page.waitForFunction(({ id, position }) => {
            const furniture = window.__islandInterruptionProbe.read()?.furniture.find(item => item.id === id);
            return furniture && Math.abs(furniture.position[0] - position.x) < .0001 && Math.abs(furniture.position[2] - position.z) < .0001;
        }, { id, position });
        const observed = residentAt(await scene(page), seated.species);
        assert(!(observed.action === 'sit' && groundDistance(observed.position, seated.position) < .1),
            'A changed saved item with the same ID releases its old sitting target');
        if (observed.action === 'sit') assert(groundDistance(observed.position, [position.x, 0, position.z]) < .1);
        await capture(page, row, 'original-page-live-bench-change');
        await page.waitForFunction(() => window.__islandInterruptionProbe.read()?.residents.every(resident => resident.action !== 'walk' && resident.usePhase >= 1),
            undefined, { timeout: 18000 });
        const final = residentAt(await scene(page), seated.species);
        assert(!(final.action === 'sit' && groundDistance(final.position, seated.position) < .1));
        const saved = await databaseSnapshot(page);
        for (const [name, records] of Object.entries(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(saved[name], records, `${name} unchanged by legitimate cross-page edit`);
        assert.equal(after.island.revision, state.island.revision + 1);
        const added = after.islandEvents.filter(event => !state.islandEvents.some(old => old.id === event.id));
        assert.equal(added.length, 1); assert.equal(added[0].type, 'item_edited'); assert.equal(added[0].itemId, id);
        assert.deepEqual((await readNative(page, row.profileId)).island, after.island);
        row.crossPage = { before: seated, after: observed, final, position, itemId: id, revision: after.island.revision,
            event: added[0], unchangedOtherStores: Object.keys(before).filter(name => !['islands', 'islandEvents'].includes(name)),
            trace: await saveTrace(page, row, 'cross-page', seated.species) };
    } finally { await editor.close(); row.editorVideo = await editor.video()?.path(); }
}

const ground = position => ({ x: position[0], z: position[2] });
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const candidates = actual => actual.residents.map(resident => ({ position: ground(resident.position), visible: true,
    itemId: resident.itemId, departingId: resident.departingId }));
async function allSettled(page) {
    await page.waitForFunction(() => {
        const actual = window.__islandInterruptionProbe.read();
        return actual && !actual.clearance?.active && actual.residents.every(resident => resident.action !== 'walk' && resident.usePhase >= 1);
    }, undefined, { timeout: 18000 });
}
function separated(actual) {
    let minimum = Infinity;
    for (let index = 0; index < actual.residents.length; index++) for (const other of actual.residents.slice(index + 1)) {
        const d = groundDistance(actual.residents[index].position, other.position); minimum = Math.min(minimum, d);
        assert(d >= .84 - .00001, `Actual residents already overlap: ${actual.residents[index].species}/${other.species} distance ${d}`);
    }
    return minimum;
}
async function explicitEdit(page, row, before, state, action, reason) {
    const after = await databaseSnapshot(page), next = await readNative(page, row.profileId);
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name], `${reason}: ${name} unchanged`);
    const updated = next.island, old = state.island;
    assert.deepEqual(updated, { ...old, revision: old.revision + 1, updatedAt: updated.updatedAt,
        items: old.items.map(item => item.id !== action.itemId ? item : action.type === 'store'
            ? { ...item, position: undefined } : { ...item, position: action.position, rotation: action.rotation }) },
    `${reason}: exactly the explicit furniture edit changes the island`);
    assert.deepEqual(after.islands.keys, before.islands.keys);
    for (const island of before.islands.rows.filter(island => island.profileId !== row.profileId)) {
        assert.deepEqual(after.islands.rows.find(next => next.profileId === island.profileId), island);
    }
    const added = next.islandEvents.filter(event => !state.islandEvents.some(prior => prior.id === event.id));
    assert.equal(added.length, 1); assert.equal(added[0].type, 'item_edited'); assert.deepEqual(added[0].action, action);
    assert.equal(after.islandEvents.rows.length, before.islandEvents.rows.length + 1);
    for (const event of before.islandEvents.rows) assert.deepEqual(after.islandEvents.rows.find(next => next.id === event.id), event);
    row.clearanceEdits.push({ reason, action, revision: updated.revision, event: added[0],
        unchangedStores: Object.keys(before).filter(name => !['islands', 'islandEvents'].includes(name)),
        beforeHash: sha(JSON.stringify(before)), afterHash: sha(JSON.stringify(after)) });
    return { state: next, database: after };
}
async function storeForClearance(page, row, id) {
    const state = await readNative(page, row.profileId);
    if (!state.island.items.find(item => item.id === id)?.position) return state;
    const before = await databaseSnapshot(page);
    await beginEdit(page, row, state, id);
    await activate(button(page, 'いまは しまっておく'), row.touch); await waitMode(page, 'home');
    const edited = await explicitEdit(page, row, before, state, { type: 'store', itemId: id }, 'Fixture storage with a real control');
    await allSettled(page); return edited.state;
}
async function placeForClearance(page, row, id, position) {
    const state = await readNative(page, row.profileId), before = await databaseSnapshot(page);
    assert(isValidIslandPlacement(state.island, id, position));
    await beginEdit(page, row, state, id); await movePreview(page, row, id, position);
    const rotation = (await scene(page)).preview.rotationY;
    await save(page, row, state, id);
    const edited = await explicitEdit(page, row, before, state, { type: 'place', itemId: id, position, rotation }, 'Fixture placement with real arrows/save');
    await allSettled(page); return edited.state;
}

/** The first episode leaves the lamp available as a replaced invitation.
 * The second gives both residents nearby ordinary visits, then stores both
 * toys so the earned bench can legally cover their actual standing roots. */
async function prepareClearance(page, row, two, name) {
    let state = await readNative(page, row.profileId);
    for (const item of state.island.items.filter(item => item.position)) state = await storeForClearance(page, row, item.id);
    const positions = two ? [{ x: -.5, z: 1.25 }, { x: .5, z: 1.25 }] : [{ x: 1, z: 1.25 }, { x: -1.25, z: .75 }];
    state = await placeForClearance(page, row, 'starter-flower', positions[0]);
    const flowerUser = await waitResident(page, 'starter-flower', 'settled');
    state = await placeForClearance(page, row, 'starter-lantern', positions[1]);
    const lampUser = await waitResident(page, 'starter-lantern', 'settled');
    assert.notEqual(flowerUser.species, lampUser.species, 'Actual ordinary visits position different residents');
    assert.equal(residentAt(await scene(page), flowerUser.species).itemId, 'starter-flower');
    state = await storeForClearance(page, row, 'starter-flower');
    if (two) state = await storeForClearance(page, row, 'starter-lantern');
    const held = await scene(page); separated(held);
    const intended = [flowerUser.species, ...(two ? [lampUser.species] : [])];
    intended.forEach(species => { const actor = residentAt(held, species); assert.equal(actor.action, 'idle'); assert.equal(actor.itemId, ''); });
    const target = state.island.items.find(item => item.id === row.earned.itemId), points = [];
    for (let x = -4; x <= 4; x += .25) for (let z = -3; z <= 3; z += .25) points.push({ x, z });
    const midpoint = intended.map(species => ground(residentAt(held, species).position)).reduce((a, p) => ({ x: a.x + p.x / intended.length, z: a.z + p.z / intended.length }), { x: 0, z: 0 });
    points.sort((a, b) => pointDistance(a, midpoint) - pointDistance(b, midpoint) || a.x - b.x || a.z - b.z);
    let fixture;
    for (const position of points) {
        if (!isValidIslandPlacement(state.island, target.id, position)) continue;
        const items = state.island.items.map(item => item.id === target.id ? { ...item, position } : item);
        const plan = planFurnitureClearance(items, candidates(held), state.island.completedSets);
        if (plan.blocked.length || plan.moves.length !== intended.length
            || plan.moves.some(move => !intended.includes(held.residents[move.index].species))) continue;
        fixture = { position, items, plan }; break;
    }
    assert(fixture, 'Actual standing roots have a legal reachable quarter-grid bench placement for the intended side steps');
    const before = await databaseSnapshot(page);
    await beginEdit(page, row, state, target.id); await movePreview(page, row, target.id, fixture.position);
    await page.waitForTimeout(120);
    const preview = await scene(page); assert(!preview.clearance?.active, 'An overlapping preview does not start a side step');
    for (const actor of held.residents) assert(groundDistance(residentAt(preview, actor.species).position, actor.position) < .00001, 'Preview keeps every actual root in place');
    await unchanged(page, before, row, `${name}: covering preview alone`);
    if (!two) {
        await activate(button(page, 'いどうを やめる'), row.touch); await waitMode(page, 'home');
        const cancelled = await scene(page); assert(!cancelled.clearance?.active);
        for (const actor of held.residents) assert(groundDistance(residentAt(cancelled, actor.species).position, actor.position) < .00001);
        await unchanged(page, before, row, `${name}: covering preview cancelled`);
        await beginEdit(page, row, state, target.id); await movePreview(page, row, target.id, fixture.position);
    }
    return { ...fixture, id: target.id, state, before, held, intended, name };
}
async function commitClearance(page, row, fixture, afterSaveInput) {
    const saveControl = button(page, 'ここに おく'), rotation = (await scene(page)).preview.rotationY;
    await observeClick(saveControl, `${fixture.name}-save`);
    await page.evaluate(() => window.__islandInterruptionProbe.reset());
    await activate(saveControl, row.touch);
    // Native inputs run immediately after save, before any mode, scene, route,
    // database or screenshot inspection consumes the actual movement window.
    await afterSaveInput();
    const { started, clicked } = await page.evaluate(tag => {
        const probe = window.__islandInterruptionProbe, clicked = probe.events[tag];
        const started = probe.rows.find(frame => frame.clearance?.active && frame.clearance.startedAt >= clicked.at);
        return { started, clicked };
    }, `${fixture.name}-save`);
    row.clearanceStartBoundaries ??= [];
    row.clearanceStartBoundaries.push({ name: fixture.name, started, clicked });
    assert(started, 'The observer captured the first actual saved-placement clearance draw');
    const moves = [started.clearance.current, ...started.clearance.queue].filter(Boolean);
    assert.equal(moves.length, fixture.plan.moves.length); assert.deepEqual(started.clearance.blocked, []);
    for (const move of moves) {
        assert(groundDistance(residentAt(started, move.species).position, residentAt(clicked, move.species).position) <= .12, 'Saved placement starts walking at the actual held root');
        assert.deepEqual(move.route, fixture.plan.moves.find(expected => expected.index === move.index).route, 'Runtime uses the preflighted real-root route');
    }
    // Keep the real one-second side-step window for input. The fixture already
    // contains the exact post-save layout used only to locate visible controls.
    // Validate all persisted records against the pre-save baseline after input.
    return { ...fixture, started, clicked,
        editAction: { type: 'place', itemId: fixture.id, position: fixture.position, rotation } };
}
async function verifyClearanceCommit(page, row, episode) {
    const edited = await explicitEdit(page, row, episode.before, episode.state, episode.editAction,
        `${episode.name}: saved overlapping bench and subsequent non-writing input`);
    return { ...episode, state: edited.state, database: edited.database };
}

async function clearanceTrace(page, row, episode) {
    const rows = await page.evaluate(() => window.__islandInterruptionProbe.rows), visible = rows.filter(frame => frame.visibility === 'visible');
    const sourceDepartures = Object.fromEntries(episode.held.residents.map(actor => [actor.species, episode.items.filter(item => item.position
        && pointDistance(ground(actor.position), item.position) < ISLAND_ITEMS[item.kind].radius + .42).map(item => item.id)]));
    const exited = new Map(), walked = new Set(); let minimumSeparation = Infinity, maximumStep = 0;
    for (let index = 0; index < visible.length; index++) {
        const frame = visible[index]; minimumSeparation = Math.min(minimumSeparation, separated(frame));
        for (const actor of frame.residents) {
            const point = ground(actor.position); assert(residentGroundIsSafe(point, false), 'All real roots stay on the unlocked main land');
            const previous = index && residentAt(visible[index - 1], actor.species);
            if (previous && frame.at - visible[index - 1].at <= 120) {
                const step = groundDistance(actor.position, previous.position); maximumStep = Math.max(maximumStep, step);
                assert(step <= (frame.at - visible[index - 1].at) * .005 + .12, 'Side steps and their following visits do not teleport');
            }
            if (frame.clearance?.active && actor.action === 'walk') walked.add(actor.species);
            for (const item of episode.items.filter(item => item.position)) {
                const d = pointDistance(point, item.position), edge = ISLAND_ITEMS[item.kind].radius + .42, key = `${actor.species}:${item.id}`;
                if (actor.itemId === item.id) continue; // An actual ordinary use may re-enter its own seat after the side step.
                if (sourceDepartures[actor.species].includes(item.id) && !exited.has(key)) {
                    if (d >= edge) exited.set(key, true);
                    continue;
                }
                assert(d >= edge - .00001, `Only the initial departure may overlap ${item.id}: ${actor.species} at ${JSON.stringify(point)}`);
            }
        }
    }
    for (const species of episode.intended) assert(walked.has(species), `${species} has observed actual clearance walking frames`);
    assert(visible.some(frame => frame.clearance?.active)); assert(visible.some(frame => frame.clearance?.phase === 'settled'));
    const file = `${row.name}-${episode.name}-trace.json`;
    await fs.writeFile(`${out}/${file}`, `${JSON.stringify(rows)}\n`);
    return { file, sha256: sha(JSON.stringify(rows)), samples: rows.length, minimumSeparation, maximumStep,
        sourceDepartures, walked: [...walked], rows };
}

async function latestInvitationDuringClearance(page, row) {
    const fixture = await prepareClearance(page, row, false, 'clearance-latest');
    const savedLayout = { ...fixture.state.island, items: fixture.items };
    const firstName = playControlName(savedLayout, 'starter-lantern'), latestName = playControlName(savedLayout, fixture.id);
    await armControlClicks(page, [{ name: 'どうぶつと あそぶ', tag: 'clearance-open-play' },
        { name: firstName, tag: 'clearance-replaced-click' }, { name: latestName, tag: 'clearance-latest-click' }]);
    let episode = await commitClearance(page, row, fixture, async () => {
        await activate(button(page, 'どうぶつと あそぶ'), row.touch);
        await activate(button(page, firstName), row.touch);
        await activate(button(page, latestName), row.touch);
    });
    const beforeRequest = episode.started.requestId;
    const replacedClick = await eventScene(page, 'clearance-replaced-click'), latestClick = await eventScene(page, 'clearance-latest-click');
    assert(replacedClick?.inputEvent.isTrusted && latestClick?.inputEvent.isTrusted, 'Both invitations came from real native input');
    assert(replacedClick.clearance?.active && latestClick.clearance?.active, 'Both real invitations occur during the side step');
    assert.equal(replacedClick.requestId, beforeRequest); assert.equal(latestClick.requestId, beforeRequest, 'The replaced invitation has not executed');
    episode = await verifyClearanceCommit(page, row, episode);
    await capture(page, row, 'clearance-latest-after-invitations');
    await page.waitForFunction(({ beforeRequest, id }) => {
        const actual = window.__islandInterruptionProbe.read();
        return !actual?.clearance?.active && actual?.requestId && actual.requestId !== beforeRequest && actual.status === 'playing' && actual.selectedId === id;
    }, { beforeRequest, id: episode.id });
    const executed = await scene(page); assert.equal(executed.shared, null);
    await waitResident(page, episode.id, 'settled'); await allSettled(page);
    await page.waitForTimeout(1500); await allSettled(page);
    await unchanged(page, episode.database, row, 'One latest invitation and complete side steps after the explicit save');
    await capture(page, row, 'clearance-latest-invitation-complete');
    const { rows, ...trace } = await clearanceTrace(page, row, episode);
    const results = [...new Set(rows.map(frame => frame.requestId).filter(id => id && id !== beforeRequest))];
    assert.deepEqual(results, [executed.requestId], 'Exactly one new request result is observed; the replaced click is never queued');
    assert.equal((await scene(page)).requestId, executed.requestId);
    const drained = rows.find(frame => frame.requestId === executed.requestId && !frame.clearance?.active);
    const visitor = drained?.residents.find(actor => actor.itemId === episode.id && actor.action === 'walk');
    assert(visitor, 'The deferred invitation starts an actual ordinary walk immediately after clearance drains');
    const continued = rows.find(frame => frame.at > drained.at && frame.at <= drained.at + 200 && frame.drawCount > drained.drawCount
        && groundDistance(residentAt(frame, visitor.species).position, visitor.position) > .003);
    assert(continued, 'The newly started ordinary walk draws and advances within 200 ms, without waiting for the idle timer');
    row.latestClearance = { position: episode.position, plan: episode.plan, clicked: episode.clicked, started: episode.started,
        replacedClick, latestClick, executed, completed: await scene(page), requestResults: results,
        ordinaryContinuation: { species: visitor.species, firstResultAt: drained.at, firstMovingDrawAt: continued.at,
            milliseconds: continued.at - drained.at, distance: groundDistance(residentAt(continued, visitor.species).position, visitor.position) }, trace };
}

async function learningDuringClearance(page, row) {
    if (await page.locator('.island-page').getAttribute('data-mode') === 'play') {
        await activate(button(page, 'あそびを とじる'), row.touch); await waitMode(page, 'home');
    }
    const beforeReservation = await databaseSnapshot(page), beforeState = await readNative(page, row.profileId);
    await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
    const reserved = await readNative(page, row.profileId); await waitLearningReady(page, reserved.plan);
    const afterReservation = await databaseSnapshot(page);
    for (const name of Object.keys(beforeReservation)) if (!['islands', 'islandPlans', 'islandEvents'].includes(name)) assert.deepEqual(afterReservation[name], beforeReservation[name]);
    const reservationEvents = reserved.islandEvents.filter(event => !beforeState.islandEvents.some(prior => prior.id === event.id));
    assert.equal(reservationEvents.length, 1); assert.equal(reservationEvents[0].type, 'plan_started');
    assert.equal(reserved.island.revision, beforeState.island.revision + 1);
    assert.equal(reserved.islandPlans.length, beforeState.islandPlans.length + 1);
    for (const plan of beforeState.islandPlans) assert.deepEqual(reserved.islandPlans.find(next => next.id === plan.id), plan);
    for (const event of beforeState.islandEvents) assert.deepEqual(reserved.islandEvents.find(next => next.id === event.id), event);
    assert.equal(reserved.plan.cursor, 0); assert.equal(reserved.plan.revision, 0);
    assert.deepEqual(reserved.island.items, beforeState.island.items);
    await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
    await unchanged(page, afterReservation, row, 'Pausing the explicitly reserved learning plan');
    const fixture = await prepareClearance(page, row, true, 'clearance-learning');
    await armControlClicks(page, [{ name: 'つづきから とく', tag: 'clearance-learning-entry' }]);
    let episode = await commitClearance(page, row, fixture, () => activate(button(page, 'つづきから とく'), row.touch));
    await waitMode(page, 'learning'); await waitLearningReady(page, reserved.plan);
    await page.waitForFunction(() => {
        const probe = window.__islandInterruptionProbe, clicked = probe.events['clearance-learning-entry'];
        return !!clicked && probe.rows.some(frame => frame.observedAt >= clicked.at && frame.mode === 'learning'
            && frame.inputReady && frame.residents.every(actor => actor.frameBounds));
    }, undefined, { timeout: 10000 });
    const { clicked, ready } = await page.evaluate(() => {
        const probe = window.__islandInterruptionProbe, clicked = probe.events['clearance-learning-entry'];
        const ready = probe.rows.find(frame => frame.observedAt >= clicked.at && frame.mode === 'learning' && frame.inputReady
            && frame.residents.every(actor => actor.frameBounds));
        return { clicked, ready };
    });
    row.clearanceLearningBoundary = { clicked, ready };
    assert(clicked?.inputEvent.isTrusted, 'Learning resume came from real native input');
    assert(clicked.clearance?.active && clicked.clearance.queue.length >= 1, 'Learning is requested while a real mover and a queued mover remain');
    assert(ready?.clearance?.active && ready.inputReady, 'The actual answer input is ready before clearance finishes');
    const completeBody = frame => frame.residents.forEach(actor => {
        const bounds = actor.frameBounds;
        assert(bounds && bounds.left >= -1 && bounds.right <= 1 && bounds.bottom >= -1 && bounds.top <= 1,
            `The real ${actor.species} ears and feet fit during queued side steps: ${JSON.stringify(bounds)}`);
    });
    completeBody(ready); const camera = ready.camera; assert(camera);
    episode = await verifyClearanceCommit(page, row, episode);
    await unchanged(page, episode.database, row, 'Learning resume during clearance preserves the exact paused plan and saved edit');
    await capture(page, row, 'clearance-learning-ready');
    const answerBefore = await readNative(page, row.profileId); assert.deepEqual(answerBefore.plan, reserved.plan);
    const answerBeforeDatabase = await databaseSnapshot(page), answered = await attempt(page, answerBefore, { touch: row.touch });
    assert.equal(answered.after.plan.cursor, 1); assert.deepEqual(answered.after.island.items, episode.state.island.items);
    const answerAfterDatabase = await databaseSnapshot(page);
    const changedStores = Object.keys(answerBeforeDatabase).filter(name => JSON.stringify(answerBeforeDatabase[name]) !== JSON.stringify(answerAfterDatabase[name]));
    const answerStores = ['profiles', 'appData', 'logs', 'memoryMath', 'memoryVocab', 'islands', 'islandPlans', 'islandEvents'];
    assert(changedStores.every(name => answerStores.includes(name)), `Only normal answer stores change: ${changedStores.join(', ')}`);
    await allSettled(page); await waitLearningReady(page, answered.after.plan);
    await unchanged(page, answerAfterDatabase, row, 'Remaining side steps after the one real answer');
    await capture(page, row, 'clearance-learning-next-answer');
    const { rows, ...trace } = await clearanceTrace(page, row, episode);
    const learning = rows.filter(frame => frame.mode === 'learning' && frame.residents.every(actor => actor.frameBounds));
    assert(learning.length > 2);
    learning.forEach(frame => { completeBody(frame); assert.equal(frame.camera, camera, 'The learning camera remains fixed through both serial paths and the next answer'); });
    for (const species of episode.intended) assert(learning.some(frame => residentAt(frame, species).action === 'walk'), `${species} really walks within the fixed learning frame`);
    row.learningClearance = { reservation: { event: reservationEvents[0], planId: reserved.plan.id, cursor: 0,
        changedStores: ['islands', 'islandPlans', 'islandEvents'] }, position: episode.position, plan: episode.plan,
        clicked, ready, completed: await scene(page), answer: { receipt: answered.receipt, sample: answered.sample, changedStores,
            unchangedFurniture: true, cursor: answered.after.plan.cursor }, learningFrames: learning.length, trace };
}

try {
    const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    report.buildSource = { path: buildSourcePath, revision: buildSource.revision, hash: buildSource.sourceHash, flags: buildSource.flags };
    const files = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    report.buildSourceMismatches = report.sourceStart.files.filter(file => files.has(file.path) && files.get(file.path) !== file.sha256);
    assert.deepEqual(report.buildSourceMismatches, [], 'Actual source matches the immutable build');
    for (const layout of layouts) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, serviceWorkers: 'block',
            reducedMotion: 'no-preference', recordVideo: { dir: `${out}/videos`, size: layout.viewport } });
        const page = await context.newPage(); page.setDefaultTimeout(16000);
        actionContexts.set(page, { scenario: layout.name, surface: 'main' });
        const row = { ...layout, profileId: null, answers: [], persistence: [], clearanceEdits: [], errors: [], pass: false };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.stack ?? String(error)));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development')); assert.equal(manifest.revision, buildSource.revision);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            row.profileId = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.goto(`${base}/#/island`); await waitReady(page); await waitMode(page, 'home'); await installProbe(page);
            const state = await earnBench(page, row);
            if (part === 'full') {
                await cancelWalkingEdit(page, row);
                await interruptedDeparture(page, row, state);
                await crossPageEdit(context, page, row, state);
            } else {
                const arrived = await waitResident(page, row.earned.itemId, 'settled');
                assert.equal(arrived.action, 'sit');
                await allSettled(page);
                row.diagnosticSetup = { skipped: ['walkingEditCancel', 'interruptedDeparture', 'crossPageEdit',
                    ...(part === 'learning-clearance' ? ['latestInvitationDuringClearance'] : [])], arrived };
            }
            if (part !== 'learning-clearance') await latestInvitationDuringClearance(page, row);
            await learningDuringClearance(page, row);
            assert.deepEqual(row.errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack ?? String(error); row.failureScene = await scene(page).catch(() => null);
            await page.screenshot({ path: `${out}/${row.name}-failure.png` }).catch(() => {});
            const probe = await page.evaluate(() => ({ rows: window.__islandInterruptionProbe?.rows ?? [], events: window.__islandInterruptionProbe?.events ?? {} }))
                .catch(() => ({ rows: [], events: {} }));
            const trace = probe.rows; row.failureEvents = probe.events;
            await fs.writeFile(`${out}/${row.name}-failure-trace.json`, JSON.stringify(trace));
            await fs.writeFile(`${out}/${row.name}-failure-events.json`, JSON.stringify(probe.events));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => '')); throw error;
        } finally { await context.close(); row.video = await page.video()?.path(); }
    }
    report.sourceEnd = await sourceSnapshot(); assert.equal(report.sourceEnd.hash, report.sourceStart.hash, 'Source stays fixed throughout verification');
    report.pass = report.scenarios.every(row => row.pass);
} catch (error) { report.error = error.stack ?? String(error); process.exitCode = 1; }
finally {
    await browser.close(); report.browserClosed = true; report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ pass: report.pass, browserClosed: true, report: `${out}/report.json`,
        scenarios: report.scenarios.map(row => ({ name: row.name, pass: row.pass, error: row.error, video: row.video })) }, null, 2));
}
