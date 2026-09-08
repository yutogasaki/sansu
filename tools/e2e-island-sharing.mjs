import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { activate, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, attempt, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_SHARING_OUTPUT || 'output/playwright/island-sharing';
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE || 'output/playwright/island-sharing/build-source.json';
const filter = process.env.SANSU_ISLAND_SHARING_SCENARIO;
const combinationFilter = process.env.SANSU_ISLAND_SHARING_COMBINATION;
const diagnosticCase = process.env.SANSU_ISLAND_SHARING_CASE;
assert(!diagnosticCase || diagnosticCase === 'tablet-known-fox', 'Case must be tablet-known-fox');
const knownTabletFox = diagnosticCase === 'tablet-known-fox';
assert(!knownTabletFox || !combinationFilter && (!filter || filter === 'tablet'),
    'The known tablet case uses all three existing staging combinations and the tablet viewport');
assert(!combinationFilter || ['flower', 'star', 'bubble'].includes(combinationFilter), 'Combination must be flower, star or bubble');
const layouts = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
].filter(layout => (!filter || layout.name === filter) && (!knownTabletFox || layout.name === 'tablet'));
assert(layouts.length, 'Scenario must be phone or tablet');
const sha = value => createHash('sha256').update(value).digest('hex');
const compiled = await build({ stdin: { contents: `
    export { ISLAND_ITEMS, isValidIslandPlacement } from './src/domain/island/catalog.ts';
    export { chooseSharedActivity, sharedActivityDeliveryPlans } from './src/components/island/three/sharedActivities.ts';
    export { chooseReachableResident } from './src/components/island/three/residentInteraction.ts';
    export { residentGroundIsSafe, residentObstacles, residentPointIsClear } from './src/components/island/three/navigation.ts';
    export { getFurnitureAnchors } from './src/components/island/three/furnitureVisuals.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const oracleSource = compiled.outputFiles[0].text;
const { ISLAND_ITEMS, isValidIslandPlacement, chooseSharedActivity, sharedActivityDeliveryPlans, chooseReachableResident,
    residentGroundIsSafe, residentObstacles, residentPointIsClear, getFurnitureAnchors } =
    await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
const sourceSnapshot = async () => {
    const manifest = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    const paths = [...new Set([...manifest.files.map(file => file.path), 'tools/e2e-island-sharing.mjs',
        'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(`${out}/videos`, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', candidate: ISLAND_CANDIDATE,
    startedAt: new Date().toISOString(), sourceStart: await sourceSnapshot(), fixtureModuleHash, oracleHash: sha(oracleSource),
    scenarios: [], captures: [], pass: false, browserClosed: false, diagnostic: Boolean(combinationFilter),
    coverage: { viewports: layouts.map(layout => layout.name), combinations: combinationFilter ? [combinationFilter] : ['flower', 'star', 'bubble'],
        fullCombinationCoverage: !combinationFilter, foxTransfer: !combinationFilter, motionAndRecovery: !combinationFilter || combinationFilter === 'bubble',
        earlyWalkMotionPreference: !combinationFilter || combinationFilter === 'star' },
    scope: 'Production UI in isolated native profile/memory fixtures. Six gifts and the fox are earned through actual reserved learning. All storage, placement and quarter-turn rotation use visible controls. A separate placement sequence gives the fox a real ordinary seat visit followed by a complete recorded transfer; role preference is preserved. Node geometry validates UI layouts; no browser module imports, furniture/progress/route injection or synthetic learning receipts. MutationObserver records actual rendered sharing/hand/mesh and resident datasets after each draw update, with browser video. The focused camera is fixed from carry through settled. All-store DB comparison covers free play and cancellation with an existing paused learning reservation. This is functional and author-review evidence, not child observation, real-device performance or a formal throughput benchmark.' };
if (knownTabletFox) {
    report.diagnostic = true;
    report.coverage = { viewports: ['tablet'], combinations: ['flower', 'star', 'bubble'], fullCombinationCoverage: false,
        stagingCombinationCoverage: true, foxTransfer: true, knownLayoutCase: diagnosticCase,
        motionAndRecovery: false, earlyWalkMotionPreference: true };
    report.knownCaseMethod = {
        name: diagnosticCase, referenceRevision: '84d3ddf-experience2-5d7be27ceacb',
        scope: 'Separate known-layout diagnostic after the existing three staging combinations. Normal full-suite selection is unchanged. The exact stage must be reached by at most two natural UI preparation visits; another legal layout cannot pass this case.',
        timing: 'Trusted native click to the first actual gather draw observation includes routing, walking, computation and rendering. rAF timestamp and bounded longtask entries are separate observations, not pure fit time or a formal performance pass.',
        excluded: ['No old camera, hand, route, actor or learning-state injection.', 'No automatic art or child-comprehension pass; actual screenshots require author review.'] };
}
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
const screenshotSessions = new WeakMap(), captureIdentities = new WeakMap();
const phases = ['receiver-walk', 'gather-walk', 'gather', 'carry', 'share', 'enjoy', 'settled'];
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

async function installProbe(page) {
    await page.evaluate(() => {
        window.__islandSharingProbe?.stop();
        const rows = [];
        const read = () => {
            const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
            if (!d) return null;
            return { at: performance.now(), drawCount: Number(d.drawCount), mode: document.querySelector('.island-page')?.dataset.mode,
                shared: d.sharedActivity ? JSON.parse(d.sharedActivity) : null,
                clearancePresent: Object.hasOwn(d, 'furnitureClearance'),
                clearance: d.furnitureClearance ? JSON.parse(d.furnitureClearance) : null,
                residents: d.residentStates ? JSON.parse(d.residentStates) : [],
                preview: d.previewState ? JSON.parse(d.previewState) : null,
                status: d.playStatus, requestId: d.playRequestId, selectedId: d.selectedItem,
                species: d.residentSpecies, renderer: d.renderer, camera: d.cameraFrame,
                sharedCameraDiagnostics: d.sharedCameraDiagnostics ? JSON.parse(d.sharedCameraDiagnostics) : null,
                sharedPresentation: d.sharedPresentation ? JSON.parse(d.sharedPresentation) : null,
                frameTimestamp: d.frameTimestamp ? Number(d.frameTimestamp) : null,
                frameCpuMs: d.frameCpuMs ? Number(d.frameCpuMs) : null };
        };
        const captureProgress = (frame, route) => {
            if (!route) return { value: frame.shared.prop.progress, metric: 'prop-phase-progress' };
            const position = frame.residents[frame.shared.carrier]?.position;
            if (!position) return null;
            let total = 0, nearest;
            for (let i = 1; i < route.points.length; i++) {
                const from = route.points[i - 1], to = route.points[i], dx = to.x - from.x, dz = to.z - from.z;
                const length = Math.hypot(dx, dz);
                if (length < 1e-8) continue;
                const fraction = Math.max(0, Math.min(1, ((position[0] - from.x) * dx + (position[2] - from.z) * dz) / (length * length)));
                const error = Math.hypot(position[0] - from.x - fraction * dx, position[2] - from.z - fraction * dz);
                if (!nearest || error < nearest.error) nearest = { error, traveled: total + length * fraction };
                total += length;
            }
            // Distance is measured from the actual foot center along every
            // preflight segment, so turns and short walks use the same window.
            return nearest && total > .001 ? { value: nearest.traveled / total, metric: 'carrier-delivery-route-distance',
                distanceToRoute: nearest.error, routeLength: total } : null;
        };
        let host = null, lastDraw = -1, lastActivity;
        const record = () => {
            if (!host?.hasAttribute('data-draw-count')) return;
            const draw = Number(host.dataset.drawCount), activity = host.dataset.sharedActivity;
            if (draw === lastDraw && activity === lastActivity) return;
            lastDraw = draw; lastActivity = activity;
            const row = read();
            if (row) rows.push(row);
            if (rows.length > 3000) rows.splice(0, rows.length - 3000);
        };
        // A mutation callback runs after the synchronous draw has written all
        // dataset fields, so early pickup frames are not lost to a polling tick
        // and a row never mixes the new draw count with old hand transforms.
        const drawObserver = new MutationObserver(record);
        const connect = () => {
            const next = document.querySelector('[data-testid="island-stage"]');
            if (next === host) return;
            drawObserver.disconnect(); host = next; lastDraw = -1; lastActivity = undefined;
            if (host) {
                drawObserver.observe(host, { attributes: true, attributeFilter: ['data-draw-count', 'data-shared-activity'] });
                record();
            }
        };
        // Context recovery may replace the stage element. Reattach to that
        // actual host through DOM mutations; no interval or synthetic rows.
        const hostObserver = new MutationObserver(connect);
        hostObserver.observe(document.documentElement, { childList: true, subtree: true });
        connect();
        window.__islandSharingProbe = { rows, read, captureProgress, reset: () => { rows.length = 0; },
            stop: () => { drawObserver.disconnect(); hostObserver.disconnect(); } };
    });
}
const scene = page => page.evaluate(() => window.__islandSharingProbe.read());
const actors = actual => actual.residents.map(resident => ({ visible: true, itemId: resident.itemId, departingId: resident.departingId,
    position: { x: resident.position[0], z: resident.position[2] } }));
const afterIndex = actual => ['otter', 'rabbit', 'fox'].indexOf(actual.species);
const knownFoxStage = { sourcePosition: { x: 2.5, z: 1.25 }, seatPosition: { x: .5, z: 1.5 }, rotation: Math.PI / 2,
    carrier: 1, receiver: 2, thirdPosition: { x: 2.5, z: 2.02 }, gatherPosition: { x: 2.5, z: .48 }, tolerance: 1e-6 };
const sameKnownPoint = (a, b) => Boolean(a && b && Math.hypot(a.x - b.x, a.z - b.z) <= knownFoxStage.tolerance);
function matchesKnownFoxActors(residents, shared) {
    return shared?.carrier === knownFoxStage.carrier && shared.receiver === knownFoxStage.receiver
        && sameKnownPoint(residents[0]?.position, knownFoxStage.thirdPosition)
        && sameKnownPoint(residents[1]?.position, knownFoxStage.gatherPosition)
        && sameKnownPoint(residents[2]?.position, knownFoxStage.seatPosition);
}
function assertKnownFoxStage(actual, island, setup, shared) {
    const source = island.items.find(item => item.id === setup.sourceId), seat = island.items.find(item => item.id === setup.seatId);
    assert.equal(source?.kind, 'flower'); assert.equal(seat?.kind, 'bench');
    assert(sameKnownPoint(source.position, knownFoxStage.sourcePosition));
    assert(sameKnownPoint(seat.position, knownFoxStage.seatPosition));
    const angleError = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    assert(angleError(source.rotation, 0) <= knownFoxStage.tolerance);
    assert(angleError(seat.rotation, knownFoxStage.rotation) <= knownFoxStage.tolerance);
    assert.equal(island.items.filter(item => item.position).length, 2, 'Only the actual flower and bench remain placed');
    assert.deepEqual(actual.residents.map(resident => resident.species), ['otter', 'rabbit', 'fox']);
    assert(matchesKnownFoxActors(actors(actual), shared), 'The exact known source/seat roles and third-resident root must be reproduced');
    assert(Math.abs(actual.residents[0].position[1]) <= knownFoxStage.tolerance);
    assert(Math.abs(actual.residents[1].position[1]) <= knownFoxStage.tolerance);
}
async function armKnownFoxTiming(control) {
    await control.evaluate(element => {
        window.__islandKnownFoxTiming?.stop();
        const probe = { armedAt: performance.now(), timeOrigin: performance.timeOrigin, events: [], longTasks: [],
            eventOverflow: false, longTaskOverflow: false, observerSupported: false, stopped: false };
        const appendTasks = entries => {
            for (const entry of entries) {
                if (probe.longTasks.length >= 128) { probe.longTaskOverflow = true; continue; }
                probe.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
            }
        };
        const record = event => {
            if (!event.composedPath().includes(element)) return;
            if (probe.events.length >= 8) { probe.eventOverflow = true; return; }
            probe.events.push({ type: event.type, at: performance.now(), eventTimestamp: event.timeStamp, trusted: event.isTrusted });
        };
        document.addEventListener('pointerup', record, true); document.addEventListener('click', record, true);
        let observer;
        try {
            if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
                observer = new PerformanceObserver(list => appendTasks(list.getEntries()));
                observer.observe({ type: 'longtask', buffered: false }); probe.observerSupported = true;
            }
        } catch (error) { probe.observerError = String(error); }
        probe.stop = () => {
            if (probe.stopped) return;
            if (observer) { appendTasks(observer.takeRecords()); observer.disconnect(); }
            document.removeEventListener('pointerup', record, true); document.removeEventListener('click', record, true);
            probe.stopped = true; probe.stoppedAt = performance.now();
        };
        window.__islandKnownFoxTiming = probe;
    });
}
async function takeKnownFoxTiming(page, episode) {
    return page.evaluate(episode => {
        const probe = window.__islandKnownFoxTiming;
        if (!probe) return null;
        probe.stop();
        const click = probe.events.find(event => event.type === 'click' && event.trusted);
        const first = window.__islandSharingProbe.rows.find(frame => frame.shared?.phase === 'gather'
            && (!episode || frame.shared.activityStartedAt === episode) && (!click || frame.at >= click.at));
        const intervalTasks = click && first ? probe.longTasks.filter(task => task.startTime < first.at
            && task.startTime + task.duration > click.at) : [];
        return { armedAt: probe.armedAt, stoppedAt: probe.stoppedAt, timeOrigin: probe.timeOrigin,
            events: probe.events, eventOverflow: probe.eventOverflow, observerSupported: probe.observerSupported,
            observerError: probe.observerError, longTaskOverflow: probe.longTaskOverflow, longTasks: probe.longTasks,
            firstGather: first ? { observedAt: first.at, drawCount: first.drawCount, frameTimestamp: first.frameTimestamp,
                frameCpuMs: first.frameCpuMs, activityStartedAt: first.shared.activityStartedAt } : null,
            nativeClickToFirstGatherObservationMs: click && first ? first.at - click.at : null,
            nativeClickToFirstGatherRafTimestampMs: click && first && Number.isFinite(first.frameTimestamp) ? first.frameTimestamp - click.at : null,
            longTasksOverlappingClickToGather: intervalTasks,
            maximumObservedLongTaskDurationMs: intervalTasks.length ? Math.max(...intervalTasks.map(task => task.duration)) : null,
            sumLongTaskOverlapMs: click && first && probe.observerSupported ? intervalTasks.reduce((sum, task) => sum
                + Math.max(0, Math.min(first.at, task.startTime + task.duration) - Math.max(click.at, task.startTime)), 0) : null,
            interpretation: 'Observation only. Click-to-gather includes walking and the first rendered frame. Longtask entries do not measure all work or isolate camera fitting. No performance threshold or pass is assigned.' };
    }, episode);
}
function observedReplayPreference(actual, island, selectedId) {
    const settled = actual.shared;
    if (settled?.phase !== 'settled' || ![settled.sourceId, settled.seatId].includes(selectedId)) return undefined;
    const source = island.items.find(item => item.id === settled.sourceId), seat = island.items.find(item => item.id === settled.seatId);
    assert(source?.position && seat?.position, 'A replay oracle uses the actual settled pair’s saved furniture');
    assert.equal(settled.active, false);
    assert.notEqual(settled.carrier, settled.receiver);
    assert(actual.residents[settled.carrier] && actual.residents[settled.receiver]);
    return { kind: settled.kind, source: structuredClone(source), seat: structuredClone(seat),
        carrier: settled.carrier, receiver: settled.receiver };
}
function settledReplayPreflight(actual, island, selectedId) {
    const preference = observedReplayPreference(actual, island, selectedId);
    assert(preference, 'The replay starts from an observed settled episode of this exact saved pair');
    const prediction = chooseSharedActivity(island.items, actors(actual), island.completedSets, selectedId, afterIndex(actual), preference);
    assert(prediction, 'Replay has a new physical route preflight from the observed settled residents');
    assert.equal(prediction.carrier, preference.carrier, 'The legal previous carrier is preferred for this immediate replay');
    assert.equal(prediction.receiver, preference.receiver, 'The legal previous receiver is preferred for this immediate replay');
    for (const [index, route] of [[prediction.carrier, prediction.gatherRoute], [prediction.receiver, prediction.receiverRoute]]) {
        assert.deepEqual(route.points[0], actors(actual)[index].position, 'A replay route starts at the actor’s current foot center');
    }
    assert(Math.hypot(prediction.gatherRoute.points[0].x - prediction.gatherRoute.points.at(-1).x,
        prediction.gatherRoute.points[0].z - prediction.gatherRoute.points.at(-1).z) > .1,
    'The settled carrier must actually return to the source, not reuse its old source entry');
    return { preference, prediction, previousEpisode: actual.shared.activityStartedAt,
        observedStart: { drawCount: actual.drawCount, frameTimestamp: actual.frameTimestamp,
            residents: actual.residents.map(resident => ({ species: resident.species, position: resident.position })) },
        legalPlans: sharedActivityDeliveryPlans(prediction, island.items, actors(actual), island.completedSets) };
}
function assertReplayStarted(actual, replay) {
    assert(actual.shared?.activityStartedAt > replay.previousEpisode, 'A settled selection starts a fresh actual episode');
    assert.equal(actual.shared?.pairId, replay.prediction.pairId);
    assert.equal(actual.shared?.carrier, replay.preference.carrier, 'Actual replay preserves the previous carrier role');
    assert.equal(actual.shared?.receiver, replay.preference.receiver, 'Actual replay preserves the previous receiver role');
}
async function databaseSnapshot(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
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
    const after = await databaseSnapshot(page);
    assert.deepEqual(after, before, `${reason}: every IndexedDB key and record stays unchanged`);
    row.persistence.push({ reason, stores: Object.keys(after), sha256: sha(JSON.stringify(after)), unchanged: true });
}
async function capture(page, row, name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision); assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE);
    // WebGL-unavailable captures deliberately have no live art-direction attribute.
    if (metadata.renderer === 'three') assert.equal(metadata.artDirection, report.manifest.island.artDirection);
    captureIdentities.set(page, metadata);
    const file = `${row.name}-${name}.png`, state = await scene(page);
    const image = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata, scene: state });
}
async function home(page, touch) {
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    const names = { play: 'あそびを とじる', inventory: 'もちものを とじる', placement: 'いどうを やめる', learning: 'しまへ' };
    if (mode !== 'home') { assert(names[mode], `Can leave ${mode} through a real control`); await activate(button(page, names[mode]), touch); }
    await waitMode(page, 'home');
}
async function openPlay(page, touch) {
    if (await page.locator('.island-page').getAttribute('data-mode') !== 'play') {
        await home(page, touch); await activate(button(page, 'どうぶつと あそぶ'), touch); await waitMode(page, 'play');
    }
}
async function settled(page) {
    await page.waitForFunction(() => {
        const actual = window.__islandSharingProbe.read();
        return actual?.clearancePresent && !actual.clearance?.active && !actual.preview && actual.residents.length >= 2
            && actual.residents.every(resident => resident.action !== 'walk' && resident.usePhase >= 1);
    },
        undefined, { timeout: 16000 });
}
function playControl(page, island, id) {
    const placed = island.items.filter(item => item.position), index = placed.findIndex(item => item.id === id);
    assert(index >= 0); return button(page, `${ISLAND_ITEMS[placed[index].kind].name} ${index + 1}で あそぶ`);
}
async function invite(page, row, island, id) {
    const previous = (await scene(page)).requestId;
    await activate(playControl(page, island, id), row.touch);
    await page.waitForFunction(({ previous, id }) => {
        const actual = window.__islandSharingProbe.read();
        return actual?.requestId && actual.requestId !== previous && actual.selectedId === id && ['playing', 'blocked'].includes(actual.status);
    }, { previous, id });
    return scene(page);
}
async function edit(page, row, state, id) {
    await home(page, row.touch);
    await activate(button(page, 'もちもの'), row.touch); await waitMode(page, 'inventory');
    const index = state.island.items.findIndex(item => item.id === id), item = state.island.items[index]; assert(item);
    await activate(button(page, `${ISLAND_ITEMS[item.kind].name} ${index + 1}を うごかす`), row.touch); await waitMode(page, 'placement');
    await page.waitForFunction(id => window.__islandSharingProbe.read()?.preview?.id === id, id);
}
async function move(page, row, id, position, rotation) {
    const preview = (await scene(page)).preview; assert.equal(preview.id, id);
    for (const [axis, index, negative, positive] of [['x', 0, 'ひだりへ', 'みぎへ'], ['z', 2, 'おくへ', 'てまえへ']]) {
        const steps = (position[axis] - preview.position[index]) * 4;
        assert(Math.abs(steps - Math.round(steps)) < .0001, 'Chosen layouts are reachable with quarter-unit direction buttons');
        for (let i = 0; i < Math.abs(Math.round(steps)); i++) await activate(button(page, steps < 0 ? negative : positive), row.touch);
    }
    const turns = ((rotation - preview.rotationY) / (Math.PI / 2) % 4 + 4) % 4;
    assert(Math.abs(turns - Math.round(turns)) < .0001, 'Chosen rotations use actual quarter-turn controls');
    for (let i = 0; i < Math.round(turns); i++) await activate(button(page, 'まわす'), row.touch);
    await page.waitForFunction(({ id, position, rotation }) => {
        const p = window.__islandSharingProbe.read()?.preview;
        return p?.id === id && Math.abs(p.position[0] - position.x) < .0001 && Math.abs(p.position[2] - position.z) < .0001
            && Math.abs(Math.sin(p.rotationY - rotation)) < .0001 && Math.cos(p.rotationY - rotation) > .999;
    }, { id, position, rotation });
}
async function place(page, row, id, position, rotation = 0) {
    const before = await readNative(page, row.profileId);
    assert(isValidIslandPlacement(before.island, id, position, rotation), 'Actual saved layout permits the requested placement');
    await edit(page, row, before, id); await move(page, row, id, position, rotation);
    assert(await button(page, 'ここに おく').isEnabled());
    await activate(button(page, 'ここに おく'), row.touch); await waitMode(page, 'home'); await settled(page);
    const after = await readNative(page, row.profileId), saved = after.island.items.find(item => item.id === id);
    assert.equal(after.island.revision, before.island.revision + 1);
    assert.deepEqual(saved.position, position); assert(Math.abs(Math.sin(saved.rotation - rotation)) < .0001);
    assert.deepEqual(after.logs, before.logs); assert.deepEqual(after.islandPlans, before.islandPlans);
    row.edits.push({ id, position, rotation: saved.rotation, islandRevision: after.island.revision });
    return after;
}
async function storePlaced(page, row) {
    let state = await readNative(page, row.profileId);
    for (const item of state.island.items.filter(item => item.position)) {
        await edit(page, row, state, item.id);
        await activate(button(page, 'いまは しまっておく'), row.touch); await waitMode(page, 'home');
        const next = await readNative(page, row.profileId);
        assert(!next.island.items.find(other => other.id === item.id).position);
        assert.deepEqual(next.logs, state.logs); assert.deepEqual(next.islandPlans, state.islandPlans); state = next;
    }
    await settled(page); return state;
}
async function earnAll(page, row) {
    for (const kind of ['bench', 'swing', 'flower', 'mushroom', 'lantern', 'fountain']) {
        await activate(page.locator('.island-start'), row.touch); await waitMode(page, 'learning');
        let state = await readNative(page, row.profileId), guard = 0;
        await waitLearningReady(page, state.plan); await assertControls(page);
        const previousSets = state.island.completedSets, reservationId = state.plan.id;
        while (state.plan?.id === reservationId) {
            assert(++guard <= 12); const result = await attempt(page, state, { touch: row.touch });
            row.answers.push(result.sample); state = result.after;
        }
        assert.equal(state.islandPlans.find(plan => plan.id === reservationId)?.status, 'completed');
        assert.equal(state.island.completedSets, previousSets + 1);
        if (previousSets > 0) {
            assert.equal(state.plan?.id, JSON.stringify(['island-plan-v1', row.profileId, previousSets + 1]));
            assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
            await waitMode(page, 'learning'); await home(page, row.touch);
            await activate(page.getByRole('button', { name: /^おくりものを えらぶ/ }), row.touch);
            assert.deepEqual(await readNative(page, row.profileId), state, 'Earned-gift navigation keeps the automatic next reservation and all saved rows');
        }
        await waitMode(page, 'reward');
        const reward = state.island.pendingRewards[0]; assert(reward.choices.includes(kind));
        await activate(button(page, ISLAND_ITEMS[kind].name), row.touch); await waitMode(page, 'placement');
        const itemId = `${reward.id}:item`;
        await activate(button(page, 'いまは しまっておく'), row.touch); await waitMode(page, 'home');
        state = await readNative(page, row.profileId);
        assert(state.island.items.some(item => item.id === itemId && item.kind === kind && !item.position));
        row.earned.push({ kind, itemId, completedSets: state.island.completedSets, rewardId: reward.id });
    }
    const state = await readNative(page, row.profileId); assert.equal(state.island.completedSets, 6);
    assert.equal((await scene(page)).residents.length, 3);
    await capture(page, row, 'six-gifts-earned');
    // Later learning cancellation resumes the automatically saved reservation, so it can be
    // included in the same all-store no-write assertion as ordinary free play.
    await activate(page.locator('.island-start'), row.touch); await waitMode(page, 'learning');
    const paused = await readNative(page, row.profileId); await waitLearningReady(page, paused.plan);
    row.pausedPlan = { id: paused.plan.id, cursor: paused.plan.cursor };
    await home(page, row.touch);
}
async function phase(page, name) {
    await page.waitForFunction(name => window.__islandSharingProbe.read()?.shared?.phase === name, name, { timeout: 24000 });
    return (await scene(page)).shared;
}
async function gatherCapture(page, row, name) {
    return capturePhase(page, row, name, 'gather', .6, .95);
}
function sameRoute(a, b) {
    return a?.points.length === b.points.length && a.points.every((point, index) =>
        Math.hypot(point.x - b.points[index].x, point.z - b.points[index].z) < 1e-7)
        && Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw))) < 1e-7;
}
function verifiedDelivery(frame, legalPlans) {
    const selection = frame.sharedPresentation;
    assert(selection?.satisfied === true && !selection.fallback, 'A captured shared delivery must have a satisfied presentation');
    assert.equal(frame.sharedCameraDiagnostics?.readabilitySatisfied, true, 'The selected actual camera retains every independent visibility minimum');
    assert.equal(selection.pairId, legalPlans[0].pairId);
    const index = legalPlans.findIndex(plan => Math.hypot(plan.handoffPoint.x - selection.handoffPoint.x,
        plan.handoffPoint.z - selection.handoffPoint.z) < 1e-7 && sameRoute(selection.deliveryRoute, plan.deliveryRoute));
    assert(index >= 0, 'Runtime delivery exactly matches one independently preflighted legal alternative');
    assert.equal(selection.attemptedPlans, index + 1, 'Current-first fallback stops at the selected legal plan');
    const plan = legalPlans[index];
    assert.equal(frame.shared.carrier, plan.carrier); assert.equal(frame.shared.receiver, plan.receiver);
    assert.deepEqual(frame.shared.handoffPoint, selection.handoffPoint);
    return plan;
}
function capturedDelivery(row, name, legalPlans) {
    const capture = report.captures.at(-1);
    assert.equal(capture.file, `${row.name}-${name}-gather.png`);
    const plan = verifiedDelivery(capture.scene, legalPlans);
    verifiedDelivery(capture.afterCapture, legalPlans);
    return plan;
}
async function transferCaptures(page, row, name, plan) {
    await capturePhase(page, row, `${name}-carry`, 'carry', .35, .65, plan.deliveryRoute);
    await capturePhase(page, row, `${name}-share`, 'share', .4, .75);
    await capturePhase(page, row, `${name}-enjoy`, 'enjoy', .4, .75);
    return capturePhase(page, row, `${name}-settled`, 'settled');
}
async function capturePhase(page, row, name, wanted, minProgress = 0, maxProgress = Infinity, deliveryRoute = null) {
    const identity = captureIdentities.get(page), session = screenshotSessions.get(page);
    assert(identity && session, 'Phase capture is prepared before the live episode');
    // Resolve with the actual matching renderer frame in one protocol call.
    // Reading scroll state, metadata and then scene across separate calls used
    // to consume most of a short gather/share window on the tablet renderer.
    const matched = await page.evaluate(({ wanted, minProgress, maxProgress, deliveryRoute }) => new Promise((resolve, reject) => {
        const host = document.querySelector('[data-testid="island-stage"]');
        let timer;
        const finish = value => { observer.disconnect(); clearTimeout(timer); resolve(value); };
        const check = () => {
            const frame = window.__islandSharingProbe.read(), shared = frame?.shared;
            if (shared?.phase !== wanted) return;
            const progress = window.__islandSharingProbe.captureProgress(frame, deliveryRoute);
            if (progress && progress.value >= minProgress && progress.value < maxProgress
                && (!deliveryRoute || progress.distanceToRoute < .002)) finish({ frame, progress });
        };
        const observer = new MutationObserver(check);
        observer.observe(host, { attributes: true, attributeFilter: ['data-draw-count', 'data-shared-activity'] });
        timer = setTimeout(() => { observer.disconnect(); reject(new Error(`No current rendered ${wanted} frame remained for capture`)); }, 24000);
        check();
    }), { wanted, minProgress, maxProgress, deliveryRoute });
    const before = matched.frame;
    // Raw CDP captures the real current viewport without animation-style or
    // metadata round trips. The matching phase must still be current afterward.
    const { data } = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const captured = await page.evaluate(deliveryRoute => {
        const frame = window.__islandSharingProbe.read();
        return { frame, progress: frame?.shared ? window.__islandSharingProbe.captureProgress(frame, deliveryRoute) : null };
    }, deliveryRoute);
    const after = captured.frame, image = Buffer.from(data, 'base64'), file = `${row.name}-${name}.png`;
    const phaseStableDuringCapture = after.shared?.activityStartedAt === before.shared.activityStartedAt && after.shared?.phase === wanted;
    await fs.writeFile(`${out}/${file}`, image);
    report.captures.push({ file, sha256: sha(image), ...identity, mode: before.mode, scene: before, afterCapture: after,
        captureWindow: { minProgress, maxProgress: Number.isFinite(maxProgress) ? maxProgress : null,
            before: matched.progress, after: captured.progress, ...(deliveryRoute ? { deliveryRoute } : {}) },
        phaseStableDuringCapture, captureMethod: 'actual viewport CDP screenshot bracketed by renderer frames' });
    assert(phaseStableDuringCapture, `The ${wanted} screenshot must finish in the same actual episode/phase`);
    return after.shared;
}
async function noSharing(page) {
    await page.waitForFunction(() => !window.__islandSharingProbe.read()?.shared, undefined, { timeout: 3000 });
}
function segmentFraction(point, from, to) {
    const direction = to.map((value, index) => value - from[index]), length2 = direction.reduce((sum, value) => sum + value * value, 0);
    if (length2 < 1e-8) { assert(distance(point, from) < .002); return 1; }
    const t = direction.reduce((sum, value, index) => sum + value * (point[index] - from[index]), 0) / length2;
    const projection = from.map((value, index) => value + direction[index] * t);
    assert(distance(point, projection) < .002, 'The actual prop stays on the source/hand transfer segment');
    assert(t >= -.002 && t <= 1.002); return t;
}
function alongRoute(point, route) {
    let length = 0, nearest;
    for (let index = 1; index < route.points.length; index++) {
        const a = route.points[index - 1], b = route.points[index], x = b.x - a.x, z = b.z - a.z;
        const segment = Math.hypot(x, z);
        if (segment < 1e-8) continue;
        const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * x + (point.z - a.z) * z) / (segment * segment)));
        const error = Math.hypot(point.x - a.x - x * fraction, point.z - a.z - z * fraction);
        if (!nearest || error < nearest.error) nearest = { error, distance: length + fraction * segment };
        length += segment;
    }
    return { ...nearest, length };
}
async function validateTrace(page, row, name, item, episode, legalPlans, items) {
    const trace = await page.evaluate(() => window.__islandSharingProbe.rows);
    const frames = trace.filter(frame => frame.shared?.activityStartedAt === episode);
    assert(frames.length > 30, 'A full episode supplies a real time-series');
    const observed = [...new Set(frames.map(frame => frame.shared.phase))];
    for (const required of ['gather', 'carry', 'share', 'enjoy', 'settled']) assert(observed.includes(required), `Rendered ${required} was sampled`);
    let lastPhase = -1, minimumResidentDistance = Infinity, maxPropStep = 0;
    const shareFractions = [], gatherFractions = [];
    const focusedCameras = new Set(frames.filter(frame => ['carry', 'share', 'enjoy', 'settled'].includes(frame.shared.phase)).map(frame => frame.camera));
    assert.equal(focusedCameras.size, 1, 'The world camera stays fixed from carrying through the settled shared outcome');
    const presentationFrame = frames.find(frame => frame.shared.phase === 'gather');
    const selected = verifiedDelivery(presentationFrame, legalPlans), deliveryObstacles = residentObstacles(items, '', selected.source.id);
    let lastDeliverySample;
    const anchor = getFurnitureAnchors(item.kind).light ?? getFurnitureAnchors(item.kind).look;
    const source = [item.position.x + anchor.x * Math.cos(item.rotation) + anchor.z * Math.sin(item.rotation), anchor.y,
        item.position.z - anchor.x * Math.sin(item.rotation) + anchor.z * Math.cos(item.rotation)];
    for (let index = 0; index < frames.length; index++) {
        const frame = frames[index], shared = frame.shared, order = phases.indexOf(shared.phase);
        assert(order >= lastPhase, 'A repeated selection never restarts or rewinds the active episode'); lastPhase = order;
        assert.notEqual(shared.receiver, shared.carrier);
        assert(frame.residents[shared.receiver] && frame.residents[shared.carrier]);
        if (order >= phases.indexOf('gather')) {
            assert.equal(verifiedDelivery(frame, legalPlans), selected, 'The chosen presentation cannot change after its first rendered gather frame');
        }
        if (shared.phase === 'carry' || shared.phase === 'share') {
            const root = frame.residents[shared.carrier].position, point = { x: root[0], z: root[2] };
            const path = alongRoute(point, selected.deliveryRoute);
            assert(path.error < .002, 'Actual carrier foot center remains on the selected legal delivery route');
            assert(residentPointIsClear(point, true, deliveryObstacles), 'The selected delivery avoids real furniture footprints');
            assert(Number.isFinite(frame.frameTimestamp), 'Continuous route samples use actual renderer timestamps');
            if (lastDeliverySample) {
                const elapsed = frame.frameTimestamp - lastDeliverySample.time;
                const duration = Math.max(1050, Math.min(6500, path.length * 620));
                assert(path.distance >= lastDeliverySample.distance - .002, 'The carrier never reverses or restarts its selected route');
                // Cubic easing has maximum derivative 1.5. This bounds observed
                // displacement even when the renderer drops intermediate frames.
                assert(path.distance - lastDeliverySample.distance <= 1.5 * path.length / duration * Math.max(0, elapsed) + .002,
                    'Actual delivery advances continuously without an x/z teleport');
            }
            lastDeliverySample = { distance: path.distance, time: frame.frameTimestamp };
        }
        for (let i = 0; i < frame.residents.length; i++) {
            const p = frame.residents[i].position;
            assert(residentGroundIsSafe({ x: p[0], z: p[2] }, true), 'Observed resident foot center stays on land/bridge');
            for (let j = i + 1; j < frame.residents.length; j++) {
                const q = frame.residents[j].position, d = Math.hypot(p[0] - q[0], p[2] - q[2]);
                minimumResidentDistance = Math.min(minimumResidentDistance, d);
                assert(d >= .84 - 1e-7, 'Observed residents do not pass through a stationary resident');
            }
        }
        const prop = shared.prop;
        if (prop.visible) assert(prop.meshes.some(mesh => mesh.visible), 'Visibility reflects actual rendered meshes');
        if (shared.phase === 'gather') gatherFractions.push(segmentFraction(prop.position, source, shared.carrierHand));
        if (shared.phase === 'carry') { assert.equal(prop.owner, 'carrier'); assert(distance(prop.position, shared.carrierHand) < .002); }
        if (shared.phase === 'share') shareFractions.push(segmentFraction(prop.position, shared.carrierHand, shared.receiverHand));
        if (shared.phase === 'enjoy' && shared.kind !== 'bubble') {
            assert(prop.visible && prop.owner === 'receiver'); assert(distance(prop.position, shared.receiverHand) < .002);
        }
        const previous = frames[index - 1];
        if (previous?.shared.prop.visible && prop.visible && frame.at - previous.at < 150) maxPropStep = Math.max(maxPropStep, distance(prop.position, previous.shared.prop.position));
    }
    assert(Math.min(...gatherFractions) < .2 && Math.max(...gatherFractions) > .8, 'Object travels from actual source to carrier');
    assert(Math.min(...shareFractions) < .2 && Math.max(...shareFractions) > .8, 'Object crosses from carrier hand to receiver hand');
    if (frames[0].shared.kind === 'bubble') {
        assert(frames.some(frame => frame.shared.phase === 'enjoy' && frame.shared.prop.scale[0] > 1.2), 'Received water ball visibly grows');
        assert(frames.some(frame => frame.shared.prop.meshes.some(mesh => mesh.visible && mesh.name.startsWith('shared-water-droplet'))), 'Water ball produces rendered droplets');
        assert.equal(frames.at(-1).shared.prop.visible, false, 'Normal-motion water effect clears after its payoff');
    } else assert(frames.at(-1).shared.prop.visible, 'Flower/star remains with its recipient after completion');
    const file = `${row.name}-${name}-trace.json`;
    await fs.writeFile(`${out}/${file}`, `${JSON.stringify(frames)}\n`);
    return { file, sha256: sha(JSON.stringify(frames)), samples: frames.length, observed, minimumResidentDistance, maxPropStep,
        focusedCamera: [...focusedCameras][0], presentation: presentationFrame.sharedPresentation,
        actorSpecies: [frames[0].residents[frames[0].shared.receiver].species, frames[0].residents[frames[0].shared.carrier].species] };
}

async function validateReplayApproach(page, replay, episode) {
    const frames = await page.evaluate(episode => window.__islandSharingProbe.rows.filter(frame =>
        frame.shared?.activityStartedAt === episode && ['receiver-walk', 'gather-walk', 'gather'].includes(frame.shared.phase)), episode);
    assert(frames.some(frame => frame.shared.phase === 'gather-walk'), 'The same carrier visibly returns from the old handoff to the source');
    const routes = [[replay.prediction.receiver, replay.prediction.receiverRoute], [replay.prediction.carrier, replay.prediction.gatherRoute]];
    const last = new Map(routes.map(([index]) => [index, { time: episode, distance: 0 }]));
    let maxAdvance = 0;
    for (const frame of frames) {
        assertReplayStarted(frame, replay);
        assert(Number.isFinite(frame.frameTimestamp), 'Replay continuity uses actual renderer timestamps');
        for (const [index, route] of routes) {
            const root = frame.residents[index].position, point = { x: root[0], z: root[2] };
            const path = alongRoute(point, route), previous = last.get(index);
            if (path.length < 1e-8) {
                assert(Math.hypot(point.x - route.points[0].x, point.z - route.points[0].z) < .002, 'The settled receiver stays at its real seat');
                continue;
            }
            assert(path.error < .002, 'Actual replay approach follows the newly preflighted route from the previous handoff');
            const duration = Math.max(1050, Math.min(6500, path.length * 620));
            const advance = path.distance - previous.distance;
            assert(advance >= -.002, 'Replay approach never reverses or restarts');
            assert(advance <= 1.5 * path.length / duration * Math.max(0, frame.frameTimestamp - previous.time) + .002,
                'Replay approach advances continuously at the existing physical walk bound');
            maxAdvance = Math.max(maxAdvance, advance);
            last.set(index, { time: frame.frameTimestamp, distance: path.distance });
        }
        for (let index = 0; index < frame.residents.length; index++) {
            if (routes.some(([actor]) => actor === index)) continue;
            const before = replay.observedStart.residents[index].position, current = frame.residents[index].position;
            assert(Math.hypot(current[0] - before[0], current[2] - before[2]) < .002, 'Replay does not move a third resident to make room');
        }
    }
    return { samples: frames.length, maxAdvance, timing: 'actual frameTimestamp', previousEpisode: replay.previousEpisode,
        preference: replay.preference, observedStart: replay.observedStart,
        receiverRoute: replay.prediction.receiverRoute, gatherRoute: replay.prediction.gatherRoute };
}

async function reduceDuringInitialWalk(page, row, state, selectedId) {
    const initial = await scene(page), replay = settledReplayPreflight(initial, state.island, selectedId);
    const legalPlans = replay.legalPlans, before = await databaseSnapshot(page);
    await page.evaluate(() => window.__islandSharingProbe.reset());
    await activate(playControl(page, state.island, selectedId), row.touch);
    const pending = await page.waitForFunction(({ previous, selectedId }) => {
        const frame = window.__islandSharingProbe.read();
        return frame?.requestId !== previous && frame?.selectedId === selectedId && frame.status === 'playing'
            && ['receiver-walk', 'gather-walk'].includes(frame.shared?.phase) && !frame.sharedPresentation ? frame : false;
    }, { previous: initial.requestId, selectedId }, { timeout: 12000 });
    const walking = await pending.jsonValue(), episode = walking.shared.activityStartedAt;
    assertReplayStarted(walking, replay);
    assert(episode > initial.shared.activityStartedAt, 'The preference change exercises a fresh actual replay');
    assert.equal(walking.shared.reduced, false); assert.equal(walking.sharedPresentation, null);
    // This changes the browser's real media preference only after observing an
    // actual early walk with no chosen presentation. No animation state is set.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pending.dispose();
    const reduced = await phase(page, 'settled'), final = await scene(page), selected = verifiedDelivery(final, legalPlans);
    assert.equal(final.status, 'playing'); assert.equal(reduced.activityStartedAt, episode);
    assert.equal(reduced.reduced, true); assert.equal(reduced.active, false);
    assert(reduced.prop.visible && reduced.prop.owner === 'receiver');
    assert(distance(reduced.prop.position, reduced.receiverHand) < .002, 'Preference-change outcome is attached to the recipient’s actual selected hand');
    for (const [index, point] of [[selected.carrier, selected.handoffPoint], [selected.receiver, selected.receiverRoute.points.at(-1)]]) {
        const root = final.residents[index].position;
        assert(Math.hypot(root[0] - point.x, root[2] - point.z) < 1e-7, 'Reduced preference settles each actor at the selected legitimate destination');
    }
    const carrier = final.residents[selected.carrier].position;
    assert(residentPointIsClear({ x: carrier[0], z: carrier[2] }, true, residentObstacles(state.island.items, '')),
        'The reduced carrier finishes outside every furniture footprint');
    for (let i = 0; i < final.residents.length; i++) for (let j = i + 1; j < final.residents.length; j++) {
        const a = final.residents[i].position, b = final.residents[j].position;
        assert(Math.hypot(a[0] - b[0], a[2] - b[2]) >= .84 - 1e-7, 'Preference change preserves distinct resident bodies');
    }
    await capture(page, row, 'star-walk-preference-reduced');
    await page.waitForTimeout(350);
    assert(distance(reduced.prop.position, (await scene(page)).shared.prop.position) < .00001, 'Changed-preference payoff remains static');
    const frames = (await page.evaluate(() => window.__islandSharingProbe.rows)).filter(frame => frame.shared?.activityStartedAt === episode);
    const firstReduced = frames.findIndex(frame => frame.shared.reduced);
    assert(firstReduced > 0, 'Actual draw trace contains the normal walk followed by the reduced outcome');
    const lastNormal = frames[firstReduced - 1];
    assert(['receiver-walk', 'gather-walk'].includes(lastNormal.shared.phase) && !lastNormal.sharedPresentation,
        'The preference changed before any normal gather presentation was chosen');
    assert.equal(frames[firstReduced].shared.phase, 'settled');
    assert(frames.every(frame => frame.status !== 'blocked'), 'Preference change never reports a blocked interaction');
    verifiedDelivery(frames[firstReduced], legalPlans);
    const file = `${row.name}-star-walk-preference-trace.json`;
    await fs.writeFile(`${out}/${file}`, `${JSON.stringify(frames)}\n`);
    await unchanged(page, before, row, 'Early-walk reduced-motion preference change preserves every saved record');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), false);
    await unchanged(page, before, row, 'Restoring motion preference preserves every saved record');
    return { episode, replayPreference: replay.preference, observedPhase: walking.shared.phase, beforePreference: walking, firstReducedFrame: frames[firstReduced],
        presentation: final.sharedPresentation, staticAfterMs: 350, restoredMotion: true,
        trace: { file, sha256: sha(JSON.stringify(frames)), samples: frames.length } };
}

async function combination(page, row, kind, sourceKind, seatKind, cancellation) {
    await storePlaced(page, row);
    const sourceId = row.earned.find(item => item.kind === sourceKind).itemId, seatId = row.earned.find(item => item.kind === seatKind).itemId;
    await place(page, row, sourceId, { x: 1.5, z: 1.75 });
    let state = await place(page, row, seatId, { x: -1.5, z: .25 }, Math.PI / 2);
    const entry = { kind, sourceId, seatId, cancellation }; row.combinations.push(entry);
    for (const arrangement of ['separated', 'wrong-facing']) {
        if (arrangement === 'wrong-facing') state = await place(page, row, seatId, { x: -.5, z: .75 }, Math.PI * 1.5);
        const actual = await scene(page);
        assert.equal(chooseSharedActivity(state.island.items, actors(actual), 6, sourceId, afterIndex(actual)), undefined);
        await openPlay(page, row.touch); const before = await databaseSnapshot(page);
        const invited = await invite(page, row, state.island, sourceId);
        assert.equal(invited.status, 'playing', 'A nonmatching pair preserves reachable ordinary play');
        await noSharing(page); await settled(page); await capture(page, row, `${kind}-${arrangement}`);
        await unchanged(page, before, row, `${kind}: ${arrangement} ordinary fallback`);
    }
    state = await place(page, row, seatId, { x: -.5, z: .75 }, Math.PI / 2);
    const actual = await scene(page), prediction = chooseSharedActivity(state.island.items, actors(actual), 6, sourceId, afterIndex(actual));
    assert(prediction, `${kind}: real placed pair has all three physical routes from observed residents`);
    const legalPlans = sharedActivityDeliveryPlans(prediction, state.island.items, actors(actual), 6);
    entry.preflight = { receiver: prediction.receiver, carrier: prediction.carrier, handoffPoint: prediction.handoffPoint,
        receiverRoute: prediction.receiverRoute, gatherRoute: prediction.gatherRoute, deliveryRoute: prediction.deliveryRoute };
    await openPlay(page, row.touch); await capture(page, row, `${kind}-near-facing`);
    const before = await databaseSnapshot(page);
    await page.evaluate(() => window.__islandSharingProbe.reset());
    const started = await invite(page, row, state.island, sourceId);
    assert.equal(started.shared?.kind, kind); assert.equal(started.shared.pairId, prediction.pairId);
    assert.equal(started.shared.carrier, prediction.carrier); assert.equal(started.shared.receiver, prediction.receiver);
    const episode = started.shared.activityStartedAt; assert(Number.isFinite(episode));
    await gatherCapture(page, row, `${kind}-gather`);
    const selected = capturedDelivery(row, kind, legalPlans);
    entry.legalDeliveries = legalPlans.map(plan => ({ handoffPoint: plan.handoffPoint, deliveryRoute: plan.deliveryRoute }));
    const finished = await transferCaptures(page, row, kind, selected);
    assert.equal(finished.active, false); entry.trace = await validateTrace(page, row, kind, state.island.items.find(item => item.id === sourceId), episode, legalPlans, state.island.items);
    await unchanged(page, before, row, `${kind}: full transfer and payoff`);

    // A separate, real UI replay exercises repeated selection. Keeping these
    // control round trips outside the five screenshot windows preserves the
    // original transfer evidence when a browser is slow to dispatch input.
    await page.evaluate(() => window.__islandSharingProbe.reset());
    const spamActual = await scene(page), spamPreflight = settledReplayPreflight(spamActual, state.island, seatId);
    assert.notDeepEqual(spamPreflight.prediction.gatherRoute.points, prediction.gatherRoute.points,
        'The replay approach is newly computed from the completed handoff, not copied from the first episode');
    const spamPlans = spamPreflight.legalPlans;
    const spamStart = await invite(page, row, state.island, seatId), spamEpisode = spamStart.shared?.activityStartedAt;
    assertReplayStarted(spamStart, spamPreflight);
    assert(spamEpisode > episode, 'The spam check starts a real replay after completion');
    const repeatedRequests = [];
    for (const id of [sourceId, seatId, sourceId]) {
        const repeated = await invite(page, row, state.island, id);
        assert.equal(repeated.shared?.activityStartedAt, spamEpisode, 'Same-pair repeated taps continue the original episode');
        repeatedRequests.push({ requestId: repeated.requestId, phase: repeated.shared.phase, activityStartedAt: repeated.shared.activityStartedAt });
    }
    await phase(page, 'settled');
    entry.spam = { episode: spamEpisode, requests: repeatedRequests,
        approach: await validateReplayApproach(page, spamPreflight, spamEpisode),
        trace: await validateTrace(page, row, `${kind}-spam`, state.island.items.find(item => item.id === sourceId), spamEpisode, spamPlans, state.island.items) };
    await unchanged(page, before, row, `${kind}: same-pair active replay spam`);

    let previousEpisode = spamEpisode;
    if (kind === 'star') {
        entry.preferenceChange = await reduceDuringInitialWalk(page, row, state, seatId);
        previousEpisode = entry.preferenceChange.episode;
    }
    const replayPreflight = settledReplayPreflight(await scene(page), state.island, seatId);
    const replay = await invite(page, row, state.island, seatId);
    assertReplayStarted(replay, replayPreflight);
    assert.equal(replay.shared?.kind, kind); assert(replay.shared.activityStartedAt > previousEpisode, 'Selecting after settled starts a new real episode');
    entry.replay = { oldEpisode: previousEpisode, newEpisode: replay.shared.activityStartedAt, preference: replayPreflight.preference };
    await capturePhase(page, row, `${kind}-replay-before-${cancellation}`, 'carry');
    verifiedDelivery(report.captures.at(-1).scene, replayPreflight.legalPlans);
    if (cancellation === 'editing') {
        await activate(button(page, `${ISLAND_ITEMS[seatKind].name}を うごかす`), row.touch); await waitMode(page, 'placement');
        await noSharing(page); await capture(page, row, `${kind}-editing-cancel`);
        await activate(button(page, 'いどうを やめる'), row.touch); await waitMode(page, 'home');
    } else if (cancellation === 'learning') {
        const paused = await readNative(page, row.profileId);
        await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
        await noSharing(page); const resumed = await readNative(page, row.profileId);
        assert.deepEqual(resumed.plan, paused.plan); await waitLearningReady(page, resumed.plan); await assertControls(page);
        await page.waitForFunction(() => window.__islandSharingProbe.read()?.residents.every(resident => resident.frameBounds));
        const learningScene = await scene(page);
        for (const resident of learningScene.residents) {
            const bounds = resident.frameBounds;
            assert(bounds && bounds.left >= -1.002 && bounds.right <= 1.002 && bounds.bottom >= -1.002 && bounds.top <= 1.002,
                `Learning return keeps the whole ${resident.species} visible`);
        }
        await capture(page, row, `${kind}-learning-cancel`); await home(page, row.touch);
    } else { await home(page, row.touch); await noSharing(page); await capture(page, row, `${kind}-home-cancel`); }
    await unchanged(page, before, row, `${kind}: replay then ${cancellation} cancellation`);
    return state;
}

function findUiPairSetup(state, actual, sourceId, seatId, requiredSeatSpecies, knownLayout = false) {
    assert(state.island.items.every(item => !item.position), 'Setup starts with genuinely stored possessions');
    const source = state.island.items.find(item => item.id === sourceId), seat = state.island.items.find(item => item.id === seatId);
    const original = actors(actual), desiredSeat = actual.residents.findIndex(resident => resident.species === requiredSeatSpecies);
    if (requiredSeatSpecies) assert(desiredSeat >= 0, 'The requested resident is actually present');
    const sources = knownLayout ? [knownFoxStage.sourcePosition] : [{ x: 2.5, z: 1.25 }, { x: -2, z: 1.5 }];
    const seats = knownLayout ? [knownFoxStage.seatPosition] : [{ x: .5, z: 1.5 }, { x: .25, z: .25 }];
    if (!knownLayout) {
        for (let z = .25; z <= 2.25; z += .5) for (let x = -2.5; x <= 3; x += .5) sources.push({ x, z });
        for (let z = .25; z <= 2.25; z += .5) for (let x = -2.25; x <= 2.75; x += .5) seats.push({ x, z });
    }
    const clearResidents = (position, kind, residents) => residents.every(resident => Math.hypot(position.x - resident.position.x,
        position.z - resident.position.z) >= ISLAND_ITEMS[kind].radius + .42);
    // Finite, read-only Node search predicts the two ordinary placement visits.
    // Browser receives only these legal positions via its existing arrows.
    for (const sourcePosition of sources) {
        if (!isValidIslandPlacement(state.island, sourceId, sourcePosition, 0) || !clearResidents(sourcePosition, source.kind, original)) continue;
        const placedSource = { ...source, position: sourcePosition, rotation: 0 };
        const firstItems = state.island.items.map(item => item.id === sourceId ? placedSource : item);
        const sourceChoice = chooseReachableResident(original, placedSource, firstItems, state.island.completedSets, afterIndex(actual));
        if (!sourceChoice || knownLayout && sourceChoice.index !== knownFoxStage.carrier) continue;
        const gathered = original.map((resident, index) => index === sourceChoice.index
            ? { ...resident, position: sourceChoice.route.points.at(-1), itemId: sourceId, departingId: undefined } : resident);
        for (const seatPosition of seats) for (const rotation of knownLayout ? [knownFoxStage.rotation] : [Math.PI / 2, Math.PI * 1.5, 0, Math.PI]) {
            if (!isValidIslandPlacement({ ...state.island, items: firstItems }, seatId, seatPosition, rotation)
                || !clearResidents(seatPosition, seat.kind, gathered)) continue;
            const placedSeat = { ...seat, position: seatPosition, rotation };
            const items = firstItems.map(item => item.id === seatId ? placedSeat : item);
            const seatChoice = chooseReachableResident(gathered, placedSeat, items, state.island.completedSets, sourceChoice.index);
            if (!seatChoice || (requiredSeatSpecies && seatChoice.index !== desiredSeat)) continue;
            const seated = gathered.map((resident, index) => index === seatChoice.index
                ? { ...resident, position: seatChoice.route.points.at(-1), itemId: seatId, departingId: undefined } : resident);
            const shared = chooseSharedActivity(items, seated, state.island.completedSets, sourceId, seatChoice.index);
            if (knownLayout && (!matchesKnownFoxActors(seated, shared)
                || !sameKnownPoint(shared.gatherRoute?.points.at(-1), knownFoxStage.gatherPosition))) continue;
            if (shared) return { sourceId, seatId, sourcePosition, seatPosition, rotation, sourceResident: sourceChoice.index,
                seatResident: seatChoice.index, pairId: shared.pairId, expectedReceiver: shared.receiver, expectedCarrier: shared.carrier };
        }
    }
}
function chooseUiPairSetup(state, actual, sourceId, seatId, requiredSeatSpecies, knownLayout = false) {
    if (knownLayout) assert.deepEqual(actual.residents.map(resident => resident.species), ['otter', 'rabbit', 'fox']);
    const direct = findUiPairSetup(state, actual, sourceId, seatId, requiredSeatSpecies, knownLayout);
    if (direct) return direct;
    // A settled replay can leave any resident as the last ordinary visitor.
    // Keep direct and one-visit setups first; only then try two real placement
    // visits, each followed by storage. Every branch uses the resulting roots
    // and turn history, without changing selection rules or injecting state.
    const preparationItem = ['lantern', 'flower', 'fountain'].map(kind => state.island.items.find(item => item.kind === kind
        && item.id !== sourceId && item.id !== seatId)).find(Boolean);
    const candidates = [{ x: 2.5, z: 1.25 }, { x: -2, z: 1.5 }];
    for (let z = .25; z <= 2.25; z += .5) for (let x = -2.5; x <= 3; x += .5) candidates.push({ x, z });
    const preparations = before => {
        const options = [], original = actors(before);
        if (!preparationItem) return options;
        for (const position of candidates) {
            if (!isValidIslandPlacement(state.island, preparationItem.id, position, 0)
                || original.some(resident => Math.hypot(position.x - resident.position.x, position.z - resident.position.z)
                    < ISLAND_ITEMS[preparationItem.kind].radius + .42)) continue;
            const target = { ...preparationItem, position, rotation: 0 };
            const items = state.island.items.map(item => item.id === target.id ? target : item);
            const visit = chooseReachableResident(original, target, items, state.island.completedSets, afterIndex(before));
            if (!visit) continue;
            const end = visit.route.points.at(-1);
            const departingId = Math.hypot(end.x - position.x, end.z - position.z)
                <= ISLAND_ITEMS[target.kind].radius + .42 + 1e-8 ? target.id : undefined;
            const prepared = { ...before, species: before.residents[visit.index].species,
                residents: before.residents.map((resident, index) => index === visit.index
                    ? { ...resident, position: [end.x, 0, end.z], itemId: '', departingId } : resident) };
            options.push({ actual: prepared, preparation: { id: target.id, kind: target.kind, position, rotation: 0,
                resident: visit.index, route: visit.route, afterResident: afterIndex(before),
                origins: original.map(resident => resident.position) } });
            if (options.length >= 8) break;
        }
        return options;
    };
    const firstVisits = preparations(actual);
    for (const first of firstVisits) {
        const next = findUiPairSetup(state, first.actual, sourceId, seatId, requiredSeatSpecies, knownLayout);
        if (next) return { ...next, preparations: [first.preparation] };
    }
    for (const first of firstVisits) for (const second of preparations(first.actual)) {
        const next = findUiPairSetup(state, second.actual, sourceId, seatId, requiredSeatSpecies, knownLayout);
        if (next) return { ...next, preparations: [first.preparation, second.preparation] };
    }
    const source = state.island.items.find(item => item.id === sourceId), seat = state.island.items.find(item => item.id === seatId);
    if (knownLayout) assert.fail('Known tablet-fox stage is not reproducible from these actual roots within two UI preparations; an alternate layout cannot pass');
    assert.fail(`No legal UI placement sequence found within two preparatory visits gives ${requiredSeatSpecies ?? 'available residents'} this ${source.kind}/${seat.kind} pair`);
}
async function applyUiPairSetup(page, row, setup) {
    assert((setup.preparations?.length ?? 0) <= 2, 'Setup uses at most two actual preparatory visits');
    for (const [step, preparation] of (setup.preparations ?? []).entries()) {
        const before = await scene(page);
        assert.equal(afterIndex(before), preparation.afterResident, 'Each preparatory visit starts with the predicted turn history');
        before.residents.forEach((resident, index) => {
            assert.equal(resident.itemId, '', 'Each preparatory visit starts with genuinely stored possessions');
            assert(Math.hypot(resident.position[0] - preparation.origins[index].x,
                resident.position[2] - preparation.origins[index].z) < 1e-6, 'Each preparatory route uses the actual current roots');
        });
        const placed = await place(page, row, preparation.id, preparation.position, preparation.rotation);
        const visited = await scene(page), end = preparation.route.points.at(-1);
        assert.equal(visited.residents.findIndex(resident => resident.itemId === preparation.id), preparation.resident,
            'The extra actual placement preserves the ordinary resident turn');
        assert.equal(afterIndex(visited), preparation.resident);
        assert(Math.hypot(visited.residents[preparation.resident].position[0] - end.x,
            visited.residents[preparation.resident].position[2] - end.z) < 1e-6, 'The extra visit reaches its actual preflight endpoint');
        visited.residents.forEach((resident, index) => {
            if (index === preparation.resident) return;
            assert(Math.hypot(resident.position[0] - before.residents[index].position[0],
                resident.position[2] - before.residents[index].position[2]) < 1e-6, 'The preparatory visit leaves the other roots in place');
        });
        const afterStorage = await storePlaced(page, row);
        assert.equal(afterStorage.island.revision, placed.island.revision + 1, 'Each preparation stores exactly its one explicitly placed item');
        assert(afterStorage.island.items.every(item => !item.position));
        const stored = await scene(page);
        assert.equal(afterIndex(stored), preparation.resident, 'Storing the visited item preserves the ordinary turn history');
        stored.residents.forEach((resident, index) => {
            assert.equal(resident.itemId, '');
            assert(Math.hypot(resident.position[0] - visited.residents[index].position[0],
                resident.position[2] - visited.residents[index].position[2]) < 1e-6, 'Storage does not teleport any resident');
        });
        (row.preparatoryVisits ??= []).push({ sourceId: setup.sourceId, seatId: setup.seatId, step: step + 1,
            itemId: preparation.id, position: preparation.position, rotation: preparation.rotation,
            previousResident: afterIndex(before), chosenResident: preparation.resident,
            visitedResident: afterIndex(visited), storedResident: afterIndex(stored),
            before: before.residents.map(resident => ({ species: resident.species, position: resident.position })),
            arrived: visited.residents.map(resident => ({ species: resident.species, position: resident.position, itemId: resident.itemId })),
            stored: stored.residents.map(resident => ({ species: resident.species, position: resident.position,
                itemId: resident.itemId, departingId: resident.departingId })),
            placedRevision: placed.island.revision, storedRevision: afterStorage.island.revision });
    }
    await place(page, row, setup.sourceId, setup.sourcePosition);
    let actual = await scene(page);
    assert.equal(actual.residents.findIndex(resident => resident.itemId === setup.sourceId), setup.sourceResident,
        'The first actual placement uses the predicted ordinary resident turn');
    const state = await place(page, row, setup.seatId, setup.seatPosition, setup.rotation); actual = await scene(page);
    assert.equal(actual.residents.findIndex(resident => resident.itemId === setup.seatId), setup.seatResident,
        'The second actual placement seats the predicted resident');
    const plan = chooseSharedActivity(state.island.items, actors(actual), state.island.completedSets, setup.sourceId, afterIndex(actual));
    assert(plan && plan.pairId === setup.pairId, 'Observed post-placement actors have all three shared routes');
    return state;
}
async function foxTransfer(page, row, knownLayout = false) {
    let state = await storePlaced(page, row);
    const sourceId = row.earned.find(item => item.kind === 'flower').itemId, seatId = row.earned.find(item => item.kind === 'bench').itemId;
    const setupScene = await scene(page);
    if (knownLayout) row.knownLayout = { name: diagnosticCase, requestedStage: knownFoxStage, reproduced: false,
        status: 'preflight', before: setupScene, afterResident: afterIndex(setupScene), maximumPreparatoryVisits: 2 };
    const setup = chooseUiPairSetup(state, setupScene, sourceId, seatId, 'fox', knownLayout);
    row.foxSetup = setup;
    state = await applyUiPairSetup(page, row, setup);
    const actual = await scene(page), prediction = chooseSharedActivity(state.island.items, actors(actual), 6, sourceId, afterIndex(actual));
    assert(prediction && prediction.pairId === setup.pairId, 'Fox capture uses the actual post-placement delivery preflight');
    if (knownLayout) {
        assertKnownFoxStage(actual, state.island, setup, prediction);
        row.knownLayout.status = 'placed'; row.knownLayout.actualReady = actual;
    }
    const legalPlans = sharedActivityDeliveryPlans(prediction, state.island.items, actors(actual), 6);
    const capturePrefix = knownLayout ? 'known-fox' : 'fox-flower';
    await openPlay(page, row.touch); await capture(page, row, `${capturePrefix}-ready`);
    const before = await databaseSnapshot(page);
    await page.evaluate(() => window.__islandSharingProbe.reset());
    if (knownLayout) await armKnownFoxTiming(playControl(page, state.island, sourceId));
    const started = await invite(page, row, state.island, sourceId), shared = started.shared;
    assert.equal(started.residents[shared?.receiver]?.species, 'fox', 'The unlocked fox receives the actual transfer');
    assert.equal(shared.pairId, prediction.pairId); assert.equal(shared.carrier, prediction.carrier); assert.equal(shared.receiver, prediction.receiver);
    const episode = shared.activityStartedAt;
    await gatherCapture(page, row, `${capturePrefix}-gather`);
    if (knownLayout) {
        const captured = report.captures.at(-1);
        assertKnownFoxStage(captured.scene, state.island, setup, captured.scene.shared);
        assertKnownFoxStage(captured.afterCapture, state.island, setup, captured.afterCapture.shared);
        row.knownLayout.timing = await takeKnownFoxTiming(page, episode);
        assert(row.knownLayout.timing?.events.some(event => event.type === 'click' && event.trusted)
            && row.knownLayout.timing.firstGather, 'Known-case timing observes the actual native click and first drawn gather');
        row.knownLayout.status = 'gather-captured'; row.knownLayout.reproduced = true;
        row.knownLayout.gatherCapture = captured.file;
        row.knownLayout.authorReview = 'pending actual image comparison; technical visibility is not an art pass';
    }
    const selected = capturedDelivery(row, capturePrefix, legalPlans);
    await transferCaptures(page, row, capturePrefix, selected);
    const trace = await validateTrace(page, row, capturePrefix, state.island.items.find(item => item.id === sourceId), episode, legalPlans, state.island.items);
    assert(trace.actorSpecies.includes('fox'), 'Fox participation is measured across the complete physical transfer');
    await unchanged(page, before, row, 'Fox receives a full flower transfer without any saved reward or learning changes');
    row.foxTransfer = { setup, episode, preflight: { receiver: prediction.receiver, carrier: prediction.carrier,
        receiverRoute: prediction.receiverRoute, gatherRoute: prediction.gatherRoute, deliveryRoute: prediction.deliveryRoute }, trace };
    if (knownLayout) { row.knownLayout.status = 'transfer-complete'; return state; }
    // Restore a real bubble pair for the independent reduced-motion/recovery
    // gate, choosing clear land around these now-moved residents through UI.
    state = await storePlaced(page, row);
    const bubbleSource = row.earned.find(item => item.kind === 'fountain').itemId, bubbleSeat = row.earned.find(item => item.kind === 'swing').itemId;
    const recoverySetup = chooseUiPairSetup(state, await scene(page), bubbleSource, bubbleSeat);
    row.recoverySetup = recoverySetup;
    return applyUiPairSetup(page, row, recoverySetup);
}

async function reducedAndRecovery(page, row, state) {
    await openPlay(page, row.touch);
    const source = state.island.items.find(item => item.kind === 'fountain' && item.position);
    const actual = await scene(page), prediction = chooseSharedActivity(state.island.items, actors(actual), 6, source.id, afterIndex(actual),
        observedReplayPreference(actual, state.island, source.id));
    assert(prediction, 'Reduced-motion shared outcome has the same real route eligibility');
    const legalPlans = sharedActivityDeliveryPlans(prediction, state.island.items, actors(actual), 6);
    const before = await databaseSnapshot(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await invite(page, row, state.island, source.id); const reduced = await phase(page, 'settled');
    assert.equal(reduced.reduced, true); assert.equal(reduced.active, false); assert.equal(reduced.pairId, prediction.pairId);
    assert.equal(reduced.receiver, prediction.receiver); assert.equal(reduced.carrier, prediction.carrier);
    assert(reduced.prop.visible && reduced.prop.owner === 'receiver');
    await capture(page, row, 'bubble-reduced-static');
    verifiedDelivery(report.captures.at(-1).scene, legalPlans);
    await page.waitForTimeout(350); const next = (await scene(page)).shared;
    assert(distance(reduced.prop.position, next.prop.position) < .00001, 'Reduced-motion payoff remains static');
    row.reduced = { snapshot: reduced, presentation: report.captures.at(-1).scene.sharedPresentation, unchangedAfterMs: 350 };
    await unchanged(page, before, row, 'Reduced motion shares a static outcome without persistence');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const replayPreflight = settledReplayPreflight(await scene(page), state.island, source.id);
    assertReplayStarted(await invite(page, row, state.island, source.id), replayPreflight); await phase(page, 'carry');
    verifiedDelivery(await scene(page), replayPreflight.legalPlans);
    const cancelledCaption = await page.locator('.island-stage__caption').innerText();
    const loseContext = () => page.evaluate(() => {
        const canvas = document.querySelector('[data-renderer="three"] canvas');
        const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
        const extension = gl?.getExtension('WEBGL_lose_context');
        if (!extension) return false; extension.loseContext(); return true;
    });
    assert(await loseContext()); await button(page, 'もういちど みる').waitFor();
    await activate(playControl(page, state.island, source.id), row.touch);
    await page.locator('.island-play-message').filter({ hasText: '「もういちど みる」で、しまを ひらこう。' }).waitFor();
    assert.equal(await page.locator('.island-stage__caption').innerText(), 'しまが うまく みえないよ', 'Fallback describes the failed view, not a cancelled transfer');
    await capture(page, row, 'context-lost');
    await activate(button(page, 'もういちど みる'), row.touch); await waitReady(page); await noSharing(page);
    const recoveredMessages = async () => {
        await page.locator('.island-play-message').filter({ hasText: 'しまの ものか、したの えを えらんでね。' }).waitFor();
        const caption = await page.locator('.island-stage__caption').innerText();
        assert(![cancelledCaption, 'しまが うまく みえないよ', 'しまを ひらいているよ'].includes(caption),
            'Recreated view clears cancelled-transfer and failure guidance; a restored resident pose may supply its current caption');
        const renderedPlayResultRequestId = (await scene(page)).requestId;
        assert.equal(renderedPlayResultRequestId, '', 'Recovery does not generate a new play result or replay');
        return { caption, cancelledCaption, message: await page.locator('.island-play-message').innerText(), renderedPlayResultRequestId };
    };
    row.recoveryMessages = { first: await recoveredMessages() };
    await unchanged(page, before, row, 'Context loss and recreation cancel transient sharing and preserve every record');
    await capture(page, row, 'context-recovered');
    assert(await loseContext()); await button(page, 'もういちど みる').waitFor();
    await page.locator('.island-play-message').filter({ hasText: '「もういちど みる」で、しまを ひらこう。' }).waitFor();
    assert.equal(await page.locator('.island-stage__caption').innerText(), 'しまが うまく みえないよ');
    await capture(page, row, 'context-lost-again');
    await activate(button(page, 'もういちど みる'), row.touch); await waitReady(page); await noSharing(page);
    row.recoveryMessages.second = await recoveredMessages();
    await unchanged(page, before, row, 'A second failure/recovery of the same request updates the guidance without replay or writes');
    await capture(page, row, 'context-recovered-again');
    await home(page, row.touch); await page.reload(); await waitReady(page); await waitMode(page, 'learning'); await installProbe(page);
    await noSharing(page); await unchanged(page, before, row, 'Reload restores the reserved learning plan without replaying a transfer');
    const resumed = await readNative(page, row.profileId); await waitLearningReady(page, resumed.plan); await assertControls(page);
    const answered = await attempt(page, resumed, { touch: row.touch });
    assert.equal(answered.after.plan.cursor, resumed.plan.cursor + 1);
    row.nextLearning = { planId: resumed.plan.id, cursor: answered.after.plan.cursor, sample: answered.sample };
    await capture(page, row, 'next-learning-answer');
}

try {
    const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    report.buildSource = { path: buildSourcePath, revision: buildSource.revision, hash: buildSource.sourceHash, flags: buildSource.flags };
    const files = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    assert(files.has('src/components/island/three/sharedActivities.ts') && files.has('src/components/island/three/sharedActivityController.ts'));
    report.buildSourceMismatches = report.sourceStart.files.filter(file => files.has(file.path) && files.get(file.path) !== file.sha256);
    assert.deepEqual(report.buildSourceMismatches, [], 'Source and harness dependencies match the immutable production artifact');
    for (const layout of layouts) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, serviceWorkers: 'block',
            reducedMotion: 'no-preference', recordVideo: { dir: `${out}/videos`, size: layout.viewport } });
        const page = await context.newPage(); page.setDefaultTimeout(16000);
        screenshotSessions.set(page, await context.newCDPSession(page));
        const row = { ...layout, profileId: null, earned: [], answers: [], edits: [], combinations: [], persistence: [], errors: [], pass: false };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.stack ?? String(error)));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development'));
            assert.equal(manifest.revision, buildSource.revision);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            row.profileId = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.goto(`${base}/#/island`); await waitReady(page); await waitMode(page, 'home'); await installProbe(page);
            await earnAll(page, row);
            let state;
            for (const args of [['flower', 'flower', 'bench', 'editing'], ['star', 'lantern', 'mushroom', 'learning'], ['bubble', 'fountain', 'swing', 'home']]) {
                if (!combinationFilter || combinationFilter === args[0]) state = await combination(page, row, ...args);
            }
            if (!combinationFilter) {
                state = await foxTransfer(page, row, knownTabletFox);
                assert(row.foxTransfer.trace.actorSpecies.includes('fox'), 'The genuinely unlocked fox participates in a recorded transfer');
            }
            if (!knownTabletFox && (!combinationFilter || combinationFilter === 'bubble')) await reducedAndRecovery(page, row, state);
            assert.deepEqual(row.errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack ?? String(error); row.failureScene = await scene(page).catch(() => null);
            if (knownTabletFox && row.knownLayout && !row.knownLayout.timing)
                row.knownLayout.timing = await takeKnownFoxTiming(page).catch(() => null);
            await page.screenshot({ path: `${out}/${row.name}-failure.png` }).catch(() => {});
            const trace = await page.evaluate(() => window.__islandSharingProbe?.rows ?? []).catch(() => []);
            await fs.writeFile(`${out}/${row.name}-failure-trace.json`, JSON.stringify(trace));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
            throw error;
        } finally {
            await context.close(); row.video = await page.video()?.path();
        }
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
