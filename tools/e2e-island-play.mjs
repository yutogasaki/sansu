import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Matrix4, Vector3 } from 'three';
import assert from 'node:assert/strict';
import { activate, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, attempt, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5299';
const out = process.env.SANSU_ISLAND_PLAY_OUTPUT || 'output/playwright/island-loop-production/play';
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE || 'output/playwright/island-loop-production/build-source.json';
const filter = process.env.SANSU_ISLAND_PLAY_SCENARIO;
const layouts = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
].filter(layout => !filter || layout.name === filter);
assert(layouts.length, 'Scenario must be phone or tablet');
const sha = value => createHash('sha256').update(value).digest('hex');
const bundled = await build({ stdin: { contents: `
 export { isValidIslandPlacement, ISLAND_ITEMS } from './src/domain/island/catalog.ts';
 export { chooseReachableResident } from './src/components/island/three/residentInteraction.ts';
 export { getFurnitureAnchors } from './src/components/island/three/furnitureVisuals.ts';
 export { residentObstacles, residentPointIsClear } from './src/components/island/three/navigation.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const oracleSource = bundled.outputFiles[0].text;
const { isValidIslandPlacement, ISLAND_ITEMS, chooseReachableResident, getFurnitureAnchors, residentObstacles, residentPointIsClear } = await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
const sourceSnapshot = async () => {
    // Freeze every actual build input and this harness's import closure. Other
    // standalone QA scripts may be maintained concurrently without changing this run.
    const manifest = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    const paths = [...new Set([...manifest.files.map(file => file.path),
        'tools/e2e-island-play.mjs', 'tools/island-e2e-helpers.mjs',
        'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(out, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', candidate: ISLAND_CANDIDATE,
    startedAt: new Date().toISOString(), fixtureModuleHash, oracleHash: sha(oracleSource), sourceStart: await sourceSnapshot(),
    scenarios: [], captures: [], pass: false, browserClosed: false,
    scope: 'Production UI. Fresh native profile/memory setup only; four gifts and fox are earned through actual reserved learning. The earned bench is turned away from its nearby flowers with actual rotation controls so this harness preserves ordinary single-resident replay; furniture combinations are verified by e2e-island-sharing.mjs. No synthetic furniture/progress/events, DEV imports, route injection or UI bypass. Replay checks read every IndexedDB store before and after. Pure geometry selects legal coordinates, which are applied with actual direction buttons. Functional evidence only; no child observation or formal throughput claim.' };
report.interestMethod = { humanN: 0, visualReview: 'pending author review of actual images; no child-comprehension claim',
    sampling: 'MutationObserver of actual data-draw-count commits; consecutive physical frames only, with bounded per-action storage. No runtime imports or animation-clock manipulation in the browser.',
    poses: 'Rendered head Euler angles, actual handAnchor world positions and resident roots. Feet/seat contact remains an image-review gate; it is not measured by these attributes.',
    scope: 'Naturally selected flower/lantern visits in the existing four-gift journey, one existing real answer after recovery, then the existing paused-learning replay and its reduced-motion state. Missing species/context matches are listed, never inferred.',
    excluded: ['No fountain is earned in this four-gift fixture; jet/drop invariance belongs to the six-kind 3d suite.',
        'No added placement search or forced resident/learning-reply selection.', 'Screenshot metadata brackets capture; it is not an atomic GPU pixel/DOM snapshot.'] };
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});

async function scene(page) {
    return page.locator('[data-testid="island-stage"]').evaluate(stage => {
        const d = stage.dataset;
        return { renderer: d.renderer, requestId: d.playRequestId, status: d.playStatus, reason: d.playReason,
            residents: d.residentStates ? JSON.parse(d.residentStates) : [], selected: d.selectedItem,
            species: d.residentSpecies, target: d.residentItemId, action: d.residentAction,
            usePhase: Number(d.residentUsePhase), camera: d.cameraFrame,
            preview: d.previewState ? JSON.parse(d.previewState) : null, previewValid: d.previewValid,
            shared: d.sharedActivity ? JSON.parse(d.sharedActivity) : null,
            reactionId: d.reactionId, reactionPhase: d.reactionPhase,
            drawCount: Number(d.drawCount), frameTimestamp: Number(d.frameTimestamp),
            interest: d.residentInterest ? JSON.parse(d.residentInterest) : null,
            furniture: d.furnitureState ? JSON.parse(d.furnitureState) : [],
            expanded: d.expanded, lighthouse: d.lighthouse, calls: Number(d.drawCalls) };
    });
}
async function databaseSnapshot(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = [...database.objectStoreNames].sort();
        const transaction = database.transaction(names, 'readonly');
        const entries = await Promise.all(names.map(async name => {
            const store = transaction.objectStore(name), rows = store.getAll(), keys = store.getAllKeys();
            const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            const [allKeys, allRows] = await Promise.all([read(keys), read(rows)]);
            return [name, { keys: allKeys, rows: allRows }];
        }));
        database.close();
        return Object.fromEntries(entries);
    });
}
async function unchanged(page, before, row, reason) {
    const after = await databaseSnapshot(page);
    assert.deepEqual(after, before, `${reason}: all IndexedDB records and keys stay unchanged`);
    row.persistence.push({ reason, stores: Object.keys(after), sha256: sha(JSON.stringify(after)), unchanged: true });
}
async function capture(page, name, row) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision);
    assert.equal(metadata.candidate, report.manifest.island.candidate);
    assert.equal(metadata.artDirection, report.manifest.island.artDirection);
    const file = `${row.name}-${name}.png`, image = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata, scene: await scene(page) });
}

// One bounded observation window on this existing journey. A draw marker is
// emitted after renderer.render; stale attributes never receive a fresh timestamp.
async function armInterestFrames(page) {
    await page.evaluate(() => {
        window.__islandPlayInterestProbe?.observer.disconnect();
        const probe = { frames: [], overflow: false, last: '', observer: undefined };
        const observe = records => {
            if (!records.some(record => record.target.matches?.('[data-testid="island-stage"]'))) return;
            const stage = document.querySelector('[data-testid="island-stage"]'), d = stage?.dataset;
            if (!d || d.renderer !== 'three') return;
            const key = `${d.drawCount}:${d.frameTimestamp}`;
            if (key === probe.last) return;
            probe.last = key;
            if (probe.frames.length >= 512) { probe.overflow = true; return; }
            const parsed = key => d[key] ? JSON.parse(d[key]) : null;
            probe.frames.push({ drawCount: Number(d.drawCount), frameTimestamp: Number(d.frameTimestamp), observedAt: performance.now(),
                interest: parsed('residentInterest'), residents: parsed('residentStates'), furniture: parsed('furnitureState'),
                reactionId: d.reactionId, reactionPhase: d.reactionPhase, shared: parsed('sharedActivity') });
        };
        probe.observer = new MutationObserver(observe);
        probe.observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-draw-count'] });
        window.__islandPlayInterestProbe = probe;
    });
}
async function takeInterestFrames(page) {
    return page.evaluate(() => {
        const probe = window.__islandPlayInterestProbe;
        probe.observer.disconnect();
        return { frames: probe.frames, overflow: probe.overflow };
    });
}
const interestItem = item => ['flower', 'lantern'].includes(item.kind);
const finitePose = interest => [...interest.head, ...interest.hands.left, ...interest.hands.right, ...interest.target].every(Number.isFinite);
async function interestCapture(page, row, label, expected) {
    // Take the image before slower metadata reads. Preserve both surrounding
    // actual frames so a missed short phase stays an explicit visual gap.
    const before = await scene(page), file = `${row.name}-interest-${label}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    const after = await scene(page), metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision); assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, report.manifest.island.candidate); assert.equal(metadata.artDirection, 'moon-garden');
    const matches = frame => expected.context ? frame.interest?.context === expected.context
        && (!expected.itemId || frame.interest.itemId === expected.itemId)
        && (!expected.reactionId || frame.reactionId === expected.reactionId)
        && (expected.reduced ? frame.interest.reduced : !frame.interest.reduced && frame.interest.phase > .05 && frame.interest.phase < .98)
        : !expected.reactionId || frame.reactionId === expected.reactionId && frame.reactionPhase === expected.phase;
    const phaseBracketed = matches(before) && matches(after);
    const entry = { file, sha256: sha(bytes), ...metadata, scene: after, viewportCapture: true,
        requestedPhase: expected, phaseBracketed, before, after };
    report.captures.push(entry);
    if (!phaseBracketed) row.interestEvidence.visualGaps.push({ file, reason: 'The requested live phase did not bracket both sides of the screenshot; inspect actual pixels, do not label this a captured reply.' });
    return entry;
}
async function waitInterestReply(page, expected) {
    await page.waitForFunction(expected => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        const interest = d?.residentInterest && JSON.parse(d.residentInterest);
        return interest?.context === expected.context && (!expected.itemId || interest.itemId === expected.itemId)
            && (!expected.reactionId || d.reactionId === expected.reactionId)
            && !interest.reduced && interest.phase >= .2 && interest.phase < .78;
    }, expected);
}
function validateInterestFrames(observation, context, item, reactionId, before) {
    assert(!observation.overflow, 'The actual draw observation window must not silently truncate');
    const frames = observation.frames.filter(frame => frame.interest?.context === context
        && (!item || frame.interest.itemId === item.id) && (!reactionId || frame.reactionId === reactionId));
    const active = frames.filter(frame => !frame.interest.reduced && frame.interest.phase > 0 && frame.interest.phase < 1);
    assert(active.length >= 2, 'At least two actual drawn interest frames must exist');
    assert(frames.every(frame => finitePose(frame.interest)), 'Actual head, hands and target coordinates remain finite');
    assert(new Set(active.map(frame => JSON.stringify([frame.interest.head, frame.interest.hands]))).size > 1,
        'The rendered head/hand transforms change; sampler metadata alone is insufficient');
    for (let index = 1; index < observation.frames.length; index++) {
        assert(observation.frames[index].drawCount > observation.frames[index - 1].drawCount);
        assert(observation.frames[index].frameTimestamp > observation.frames[index - 1].frameTimestamp);
    }
    if (item) {
        const roots = frames.map(frame => frame.residents.find(resident => resident.species === frame.interest.species)?.position);
        assert(roots.every(root => root && JSON.stringify(root) === JSON.stringify(roots[0])), 'The ordinary response does not move its arrived navigation root');
        for (const frame of frames) {
            assert.equal(frame.shared, null, 'Ordinary interest never replaces a shared-controller pose');
            const furniture = frame.furniture.find(model => model.id === item.id);
            assert(furniture, 'The actual visited furniture is reported in the same draw');
            assert.deepEqual(furniture.rootScale, [1, 1, 1]);
            if (item.kind === 'flower') assert.equal(furniture.life.leafScale, 1, 'Ordinary flower interest preserves leaves');
            for (const previous of before.furniture.filter(model => model.id !== item.id)) {
                const other = frame.furniture.find(model => model.id === previous.id);
                if (other) assert.deepEqual(other.life, previous.life, 'Every non-target surface observed in both frames stays unchanged');
            }
        }
        assert(active.some(frame => {
            const life = frame.furniture.find(model => model.id === item.id).life;
            return item.kind === 'flower' ? life.bloomScale > 1 : life.emissive > .65;
        }), 'The permitted local flower/light surface actually responds');
    }
    return { species: frames[0].interest.species, context, frames: observation.frames, actualReplyFrames: active.length,
        observedNonTargetIds: item ? before.furniture.filter(model => model.id !== item.id
            && frames.some(frame => frame.furniture.some(other => other.id === model.id))).map(model => model.id) : [] };
}
async function observedVisit(page, row, island, item, options) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await scene(page);
    await interestCapture(page, row, `${row.interestEvidence.ordinary.length}-visit-before`, {});
    await armInterestFrames(page);
    const started = await invite(page, island, item, options);
    await waitInterestReply(page, { context: 'visit', itemId: item.id });
    await interestCapture(page, row, `${row.interestEvidence.ordinary.length}-visit-reply`, { context: 'visit', itemId: item.id });
    const resident = await waitSettled(page, item.id), observation = await takeInterestFrames(page);
    const settled = await scene(page), material = settled.furniture.find(model => model.id === item.id);
    assert.equal(settled.interest?.sample.life, 0, 'The ordinary pulse ends within the existing use clock');
    if (item.kind === 'flower') assert.equal(material.life.bloomScale, 1); else assert.equal(material.life.emissive, .65);
    await interestCapture(page, row, `${row.interestEvidence.ordinary.length}-visit-settled`, {});
    row.interestEvidence.ordinary.push({ itemId: item.id, kind: item.kind, before,
        ...validateInterestFrames(observation, 'visit', item, undefined, before) });
    return { started, resident };
}
async function observedLearningAnswer(page, row, state) {
    await waitLearningReady(page, state.plan); await assertControls(page);
    assert.equal((await scene(page)).interest?.context === 'visit', false, 'Entering learning removes the old ordinary-interest layer');
    await interestCapture(page, row, 'learning-before', {}); await armInterestFrames(page);
    const result = await attempt(page, state, { touch: row.touch, onCorrectContact: async receipt => {
        await waitInterestReply(page, { context: 'learning', reactionId: receipt.id });
        await interestCapture(page, row, 'learning-reply', { context: 'learning', reactionId: receipt.id });
    } });
    await page.waitForFunction(id => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.reactionId === id && d.reactionPhase === 'settled' && JSON.parse(d.residentInterest || 'null') === null;
    }, result.receipt.id);
    const observation = await takeInterestFrames(page);
    await interestCapture(page, row, 'learning-settled', { reactionId: result.receipt.id, phase: 'settled' });
    row.interestEvidence.learning.push({ receiptId: result.receipt.id, ...validateInterestFrames(observation, 'learning', undefined, result.receipt.id) });
    return result;
}
async function reducedInterest(page, row) {
    const before = await scene(page);
    if (before.interest?.context !== 'visit') {
        row.interestEvidence.visualGaps.push({ reason: 'The last naturally selected possession has no ordinary flower/light interest; reduced interest was not observed.' }); return;
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.residentInterest && JSON.parse(d.residentInterest)?.reduced === true;
    });
    const first = await scene(page);
    assert(finitePose(first.interest));
    const firstTarget = first.furniture.find(model => model.id === first.interest.itemId);
    if (firstTarget.kind === 'flower') assert.equal(firstTarget.life.leafScale, 1);
    await interestCapture(page, row, 'visit-reduced', { context: 'visit', itemId: first.interest.itemId, reduced: true });
    await page.waitForTimeout(180);
    const later = await scene(page);
    assert.deepEqual(later.interest, first.interest, 'Reduced interest remains a static head/hand state');
    assert.deepEqual(later.furniture, first.furniture, 'Reduced local surfaces do not oscillate');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset, interest = d?.residentInterest && JSON.parse(d.residentInterest);
        return interest && !interest.reduced && interest.sample.life === 0;
    });
    const restored = await scene(page), restoredTarget = restored.furniture.find(model => model.id === first.interest.itemId);
    if (restoredTarget.kind === 'flower') {
        assert.equal(restoredTarget.life.bloomScale, 1); assert.equal(restoredTarget.life.leafScale, 1);
    } else assert.equal(restoredTarget.life.emissive, .65);
    row.interestEvidence.reduced = { itemId: first.interest.itemId, species: first.interest.species, first, later, restored, observedStaticMs: 180 };
}
async function waitSettled(page, itemId) {
    await page.waitForFunction(itemId => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        const residents = d?.residentStates ? JSON.parse(d.residentStates) : [];
        return residents.some(resident => resident.itemId === itemId && resident.action !== 'walk' && resident.usePhase >= 1);
    }, itemId, { timeout: 15000 });
    return (await scene(page)).residents.find(resident => resident.itemId === itemId);
}
async function waitAllSettled(page) {
    await page.waitForFunction(() => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.residentStates && JSON.parse(d.residentStates).every(resident => resident.action !== 'walk' && resident.usePhase >= 1);
    }, undefined, { timeout: 15000 });
}
async function openPlay(page, touch) {
    await activate(button(page, 'どうぶつと あそぶ'), touch); await waitMode(page, 'play');
}
function playButton(page, island, item) {
    const index = island.items.filter(item => item.position).findIndex(candidate => candidate.id === item.id);
    assert(index >= 0);
    return button(page, `${ISLAND_ITEMS[item.kind].name} ${index + 1}で あそぶ`);
}
async function invite(page, island, item, { touch, keyboard = false, blocked = false } = {}) {
    const previous = (await scene(page)).requestId;
    const control = playButton(page, island, item);
    if (keyboard) { await control.focus(); await page.keyboard.press('Enter'); }
    else await activate(control, touch);
    await page.waitForFunction(({ previous, blocked, itemId }) => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.playRequestId && d.playRequestId !== previous && d.selectedItem === itemId
            && d.playStatus === (blocked ? 'blocked' : 'playing');
    }, { previous, blocked, itemId: item.id });
    assert.equal(await control.getAttribute('aria-pressed'), 'true');
    const actual = await scene(page);
    assert.equal(actual.shared, null, 'This deliberately nonmatching layout exercises ordinary single-resident play');
    return actual;
}
function candidates(actual) {
    return actual.residents.map(resident => ({ position: { x: resident.position[0], z: resident.position[2] }, visible: true,
        itemId: resident.itemId, departingId: resident.departingId }));
}

function facesNoFlower(island, bench, rotation) {
    return island.items.filter(item => item.kind === 'flower' && item.position).every(flower => {
        const dx = flower.position.x - bench.position.x, dz = flower.position.z - bench.position.z, distance = Math.hypot(dx, dz);
        return distance > ISLAND_ITEMS.bench.radius + ISLAND_ITEMS.flower.radius + 1.4
            || (Math.sin(rotation) * dx + Math.cos(rotation) * dz) / distance < .5;
    });
}
async function arrangeSinglePlay(page, profileId, state, row) {
    const bench = state.island.items.find(item => item.kind === 'bench' && item.position); assert(bench);
    const turns = [0, 1, 2, 3].find(turn => facesNoFlower(state.island, bench, bench.rotation + turn * Math.PI / 2));
    assert(turns !== undefined, 'A real quarter-turn can make this bench independent of both nearby flowers');
    if (turns) {
        await editFromInventory(page, state.island, bench, row.touch);
        for (let i = 0; i < turns; i++) await activate(button(page, 'まわす'), row.touch);
        state = await savePlacement(page, profileId, state, bench.id, row.touch); await waitAllSettled(page);
    }
    const saved = state.island.items.find(item => item.id === bench.id);
    assert(facesNoFlower(state.island, saved, saved.rotation));
    assert(!state.island.items.some(item => item.position && ['mushroom', 'fountain'].includes(item.kind)));
    row.singlePlayLayout = { benchId: bench.id, rotation: saved.rotation, turns, reason: 'No saved combination satisfies its distance/facing condition' };
    return state;
}
async function assertSafeResidents(page, island, row, reason) {
    const actual = await scene(page);
    const checks = actual.residents.map(resident => ({ species: resident.species, itemId: resident.itemId, position: resident.position,
        safe: residentPointIsClear({ x: resident.position[0], z: resident.position[2] }, island.completedSets >= 2,
            residentObstacles(island.items, resident.itemId)) }));
    assert(checks.length >= 2 && checks.every(check => check.safe), `${reason}: every visible resident starts on clear land or its own supporting seat`);
    row.spawnChecks ??= []; row.spawnChecks.push({ reason, checks });
}
async function waitPreview(page, itemId, position) {
    await page.waitForFunction(({ itemId, position }) => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        const preview = d?.previewState && JSON.parse(d.previewState);
        return preview?.id === itemId && (!position || Math.abs(preview.position[0] - position.x) < .0001
            && Math.abs(preview.position[2] - position.z) < .0001);
    }, { itemId, position });
    return (await scene(page)).preview;
}
async function movePreview(page, itemId, position, touch) {
    const before = await waitPreview(page, itemId);
    for (const [axis, index, negative, positive] of [['x', 0, 'ひだりへ', 'みぎへ'], ['z', 2, 'おくへ', 'てまえへ']]) {
        const delta = (position[axis] - before.position[index]) * 4;
        assert(Math.abs(delta - Math.round(delta)) < .0001, 'Real direction controls use quarter-unit positions');
        for (let i = 0; i < Math.abs(Math.round(delta)); i++) await activate(button(page, delta < 0 ? negative : positive), touch);
    }
    return waitPreview(page, itemId, position);
}
async function editFromInventory(page, island, item, touch) {
    await activate(button(page, 'もちもの'), touch); await waitMode(page, 'inventory');
    const index = island.items.findIndex(candidate => candidate.id === item.id);
    await activate(button(page, `${ISLAND_ITEMS[item.kind].name} ${index + 1}を うごかす`), touch);
    await waitMode(page, 'placement');
    const preview = await waitPreview(page, item.id);
    if (item.position) assert.deepEqual([preview.position[0], preview.position[2]], [item.position.x, item.position.z], 'Editing does not automatically relocate an existing possession');
    return preview;
}
async function savePlacement(page, profileId, before, itemId, touch) {
    assert(await button(page, 'ここに おく').isEnabled(), 'Placement chosen through actual controls is legal');
    const preview = (await scene(page)).preview;
    await activate(button(page, 'ここに おく'), touch); await waitMode(page, 'home');
    const after = await readNative(page, profileId);
    assert.equal(after.island.revision, before.island.revision + 1);
    const added = after.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
    assert.equal(added.length, 1); assert.equal(added[0].type, 'item_edited'); assert.equal(added[0].itemId, itemId);
    assert.deepEqual(after.islandPlans, before.islandPlans); assert.deepEqual(after.logs, before.logs);
    const saved = after.island.items.find(item => item.id === itemId);
    assert.deepEqual(saved.position, { x: preview.position[0], z: preview.position[2] });
    return after;
}
async function finishSection(page, profileId, row) {
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    assert(['home', 'play'].includes(mode));
    await activate(mode === 'home' ? page.locator('.island-start') : button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
    let state = await readNative(page, profileId), guard = 0;
    await waitLearningReady(page, state.plan); await assertControls(page);
    const set = state.island.completedSets, reservationId = state.plan.id;
    while (state.plan?.id === reservationId) {
        assert(++guard <= 12, 'A section completes with its actual reserved problems');
        const result = await attempt(page, state, { touch: row.touch });
        state = result.after; row.answers.push(result.sample);
    }
    assert.equal(state.islandPlans.find(plan => plan.id === reservationId)?.status, 'completed');
    assert.equal(state.island.completedSets, set + 1);
    if (set > 0) {
        assert.equal(state.plan?.id, JSON.stringify(['island-plan-v1', profileId, set + 1]));
        assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
        await waitMode(page, 'learning');
        await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
        await activate(page.getByRole('button', { name: /^おくりものを えらぶ/ }), row.touch);
        assert.deepEqual(await readNative(page, profileId), state, 'Opening earned gifts preserves the automatically reserved next section');
    }
    await waitMode(page, 'reward');
    return state;
}
async function earnAndPlace(page, profileId, row, kind) {
    let state = await finishSection(page, profileId, row);
    const reward = state.island.pendingRewards[0]; assert(reward.choices.includes(kind));
    if (state.island.completedSets === 4) await capture(page, 'fox-earned-reward', row);
    await activate(button(page, ISLAND_ITEMS[kind].name), row.touch); await waitMode(page, 'placement');
    state = await readNative(page, profileId);
    const item = state.island.items.find(item => item.id === `${reward.id}:item`); assert(item && !item.position);
    const preview = await waitPreview(page, item.id), point = { x: preview.position[0], z: preview.position[2] };
    assert(isValidIslandPlacement(state.island, item.id, point, preview.rotationY));
    const target = { ...item, position: point, rotation: preview.rotationY };
    assert(chooseReachableResident(candidates(await scene(page)), target,
        state.island.items.map(existing => existing.id === item.id ? target : existing), state.island.completedSets), 'The initial placement suggestion has an actual resident route');
    row.suggestions.push({ itemId: item.id, kind, position: point, legal: true, reachable: true });
    state = await savePlacement(page, profileId, state, item.id, row.touch);
    await waitSettled(page, item.id);
    row.earned.push({ itemId: item.id, kind, completedSets: state.island.completedSets });
    return state;
}
async function canvasInvite(page, item, touch) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await scene(page), bounds = await page.locator('[data-renderer="three"] canvas').boundingBox();
    const values = before.camera.split(',').map(Number);
    assert(bounds && values.length === 32);
    const anchor = getFurnitureAnchors(item.kind).seat ?? getFurnitureAnchors(item.kind).look;
    const point = new Vector3(anchor.x, anchor.y + .04, anchor.z).applyAxisAngle(new Vector3(0, 1, 0), item.rotation)
        .add(new Vector3(item.position.x, 0, item.position.z))
        .applyMatrix4(new Matrix4().fromArray(values.slice(0, 16)).invert()).applyMatrix4(new Matrix4().fromArray(values.slice(16)));
    assert(Math.abs(point.x) < .96 && Math.abs(point.y) < .96, 'The actual furniture contact surface is visible');
    const x = bounds.x + (point.x + 1) * bounds.width / 2, y = bounds.y + (1 - point.y) * bounds.height / 2;
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await page.waitForFunction(({ previous, id }) => {
        const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
        return d?.playRequestId !== previous && d?.playStatus === 'playing' && d?.selectedItem === id;
    }, { previous: before.requestId, id: item.id });
    assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'play', 'Canvas play tap does not enter editing');
    const actual = await scene(page); assert.equal(actual.shared, null, 'Canvas replay also remains an ordinary furniture visit');
    return { x, y, target: item.id, actual };
}

try {
    const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    report.buildSource = { path: buildSourcePath, revision: buildSource.revision, hash: buildSource.sourceHash, flags: buildSource.flags };
    const buildFiles = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    const common = report.sourceStart.files.filter(file => buildFiles.has(file.path));
    assert(common.some(file => file.path === 'src/components/island/three/residentInteraction.ts'));
    report.buildSourceMismatches = common.filter(file => buildFiles.get(file.path) !== file.sha256);
    assert.deepEqual(report.buildSourceMismatches, [], 'Application files match the immutable production build');
    for (const layout of layouts) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, serviceWorkers: 'block', reducedMotion: 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const row = { ...layout, earned: [], answers: [], suggestions: [], plays: [], persistence: [], errors: [], pass: false,
            interestEvidence: { ordinary: [], learning: [], visualGaps: [], visualReview: 'pending',
                unmeasured: ['Fountain surface/jet/drop effects: no fountain in this existing four-gift journey.',
                    'Feet/seat contact and species readability require actual image review; no human participants.'] } };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            // The initial empty-profile lookup must settle before fixture insertion.
            await page.locator('[data-onboarding-world="island"][data-mode="welcome"]').waitFor();
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development'));
            assert.equal(manifest.revision, buildSource.revision);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const profileId = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' }); row.profileId = profileId;
            await page.goto(`${base}/#/island`); await waitReady(page); await waitMode(page, 'home');
            let state;
            for (const kind of ['bench', 'swing', 'flower', 'lantern']) state = await earnAndPlace(page, profileId, row, kind);
            assert.equal(state.island.completedSets, 4); assert.equal((await scene(page)).residents.length, 3);
            await assertSafeResidents(page, state.island, row, 'Fox first arrival');
            state = await arrangeSinglePlay(page, profileId, state, row);
            await capture(page, 'four-gifts-home', row);
            const possessions = state.island.items;
            const bench = possessions.find(item => item.kind === 'bench');
            const beforePlay = await databaseSnapshot(page);
            await openPlay(page, row.touch);
            // Choose unoccupied objects in fair order. The actual renderer species,
            // route and arrival are observed; no requested prop is counted as a visit.
            for (let i = 0; i < 3; i++) {
                const actual = await scene(page), after = ['otter', 'rabbit', 'fox'].indexOf(actual.species);
                const options = possessions.filter(item => item.position && !actual.residents.some(resident => resident.itemId === item.id));
                const seen = new Set(row.plays.map(play => play.resident.species));
                const selected = options.map(item => ({ item, choice: chooseReachableResident(candidates(actual), item, possessions, 4, after) }))
                    .sort((left, right) => Number(!interestItem(left.item)) - Number(!interestItem(right.item)))
                    .find(option => option.choice && !seen.has(actual.residents[option.choice.index].species));
                assert(selected, 'A yet-unobserved resident has an unoccupied reachable possession for its ordinary turn');
                const target = selected.item;
                const invitationOptions = { touch: row.touch, keyboard: i === 1 };
                const { started, resident } = interestItem(target) ? await observedVisit(page, row, state.island, target, invitationOptions)
                    : { started: await invite(page, state.island, target, invitationOptions), resident: await waitSettled(page, target.id) };
                assert.equal(resident.species, actual.residents[selected.choice.index].species, 'The actual resident follows the reachable round-robin choice');
                row.plays.push({ type: i === 1 ? 'keyboard-list' : 'pointer-list', itemId: target.id, requestId: started.requestId, resident });
            }
            assert.deepEqual([...new Set(row.plays.map(play => play.resident.species))].sort(), ['fox', 'otter', 'rabbit'], 'Fair replay turns include the fox');
            await capture(page, 'fox-and-friends-play', row);
            await invite(page, state.island, bench, { touch: row.touch });
            const seated = await waitSettled(page, bench.id);
            const replay = await invite(page, state.island, bench, { touch: row.touch, keyboard: true });
            assert.equal(replay.action, 'sit'); assert(replay.usePhase < 1, 'A second invitation starts a new local use beat');
            assert.equal(replay.species, seated.species);
            assert.deepEqual(replay.residents.find(resident => resident.species === seated.species).position, seated.position, 'Same-seat replay stays grounded at the existing seat');
            assert.equal(replay.residents.filter(resident => resident.itemId === bench.id).length, 1, 'Only one resident occupies the seat');
            row.plays.push({ type: 'same-seat-keyboard-replay', itemId: bench.id, requestId: replay.requestId, usePhase: replay.usePhase, resident: seated });
            await capture(page, 'same-seat-replay', row); await waitSettled(page, bench.id);
            row.canvas = await canvasInvite(page, bench, row.touch); await waitSettled(page, bench.id);
            await unchanged(page, beforePlay, row, 'List, keyboard, same-seat and canvas replay');

            await activate(button(page, 'あそびを とじる'), row.touch); await waitMode(page, 'home');
            // Two legal saved positions leave this lamp with no safe approach:
            // coast/cottage bound one side, the bench closes the remaining gap.
            // Both objects were genuinely acquired above and are moved with UI arrows.
            for (const [itemId, position] of [['starter-lantern', { x: -4.25, z: -.75 }], [bench.id, { x: -4, z: .5 }]]) {
                state = await readNative(page, profileId);
                const item = state.island.items.find(item => item.id === itemId);
                assert(isValidIslandPlacement(state.island, item.id, position));
                await editFromInventory(page, state.island, item, row.touch);
                await movePreview(page, item.id, position, row.touch);
                state = await savePlacement(page, profileId, state, item.id, row.touch);
                await waitAllSettled(page);
            }
            const lamp = state.island.items.find(item => item.id === 'starter-lantern');
            await openPlay(page, row.touch);
            const beforeBlocked = await databaseSnapshot(page);
            const blocked = await invite(page, state.island, lamp, { keyboard: true, blocked: true });
            assert.equal(blocked.reason, 'unreachable');
            assert.match(await page.locator('.island-play-message').innerText(), /すきま/);
            row.blocked = blocked; await capture(page, 'blocked-recoverable', row);
            await unchanged(page, beforeBlocked, row, 'Unreachable replay explains the gap without saving');
            await activate(button(page, `${ISLAND_ITEMS[lamp.kind].name}を うごかす`), row.touch); await waitMode(page, 'placement');
            await waitPreview(page, lamp.id, lamp.position);
            const actual = await scene(page), points = [];
            for (let z = 2.5; z >= -.5; z -= .5) for (let x = -2; x <= 3; x += .5) points.push({ x, z });
            points.sort((a, b) => Math.hypot(a.x, a.z - 1) - Math.hypot(b.x, b.z - 1));
            const recoveredPosition = points.find(position => {
                const target = { ...lamp, position }, items = state.island.items.map(item => item.id === lamp.id ? target : item);
                return isValidIslandPlacement(state.island, lamp.id, position)
                    && chooseReachableResident(candidates(actual), target, items, 4);
            });
            assert(recoveredPosition, 'There is a legal reachable place to move the blocked lamp');
            await movePreview(page, lamp.id, recoveredPosition, row.touch);
            state = await savePlacement(page, profileId, state, lamp.id, row.touch);
            await waitSettled(page, lamp.id); await openPlay(page, row.touch);
            const beforeRecovered = await databaseSnapshot(page);
            const recoveredLamp = state.island.items.find(item => item.id === lamp.id);
            await invite(page, state.island, recoveredLamp, { touch: row.touch }); await waitSettled(page, lamp.id);
            await capture(page, 'moved-and-playable', row);
            await unchanged(page, beforeRecovered, row, 'Moving restores a real reachable replay');

            await activate(button(page, 'あそびを とじる'), row.touch); await waitMode(page, 'home');
            const beforeReload = await databaseSnapshot(page);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
            await unchanged(page, beforeReload, row, 'Reload preserves all earned items, edits and learning records');
            assert.equal((await scene(page)).requestId, '', 'Transient play requests do not replay after reload');
            await assertSafeResidents(page, state.island, row, 'Reload with edited furniture');
            await capture(page, 'reloaded-home', row);
            await openPlay(page, row.touch);
            const beforeFallback = await databaseSnapshot(page);
            const lost = await page.evaluate(() => {
                const canvas = document.querySelector('[data-renderer="three"] canvas');
                const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
                const extension = gl?.getExtension('WEBGL_lose_context');
                if (!extension) return false; extension.loseContext(); return true;
            });
            assert(lost, 'The actual renderer context can be lost for recovery verification');
            await button(page, 'もういちど みる').waitFor();
            await activate(playButton(page, state.island, recoveredLamp), row.touch);
            await page.locator('.island-play-message').filter({ hasText: '「もういちど みる」で、しまを ひらこう。' }).waitFor();
            await unchanged(page, beforeFallback, row, 'Renderer unavailable play returns a visible response without saving');
            await capture(page, 'renderer-unavailable', row);
            await activate(button(page, 'もういちど みる'), row.touch); await waitReady(page);
            await unchanged(page, beforeFallback, row, 'Renderer recovery does not award or edit possessions');
            await assertSafeResidents(page, state.island, row, 'Renderer context recreation');

            await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
            state = await readNative(page, profileId); const planId = state.plan.id;
            state = (await observedLearningAnswer(page, row, state)).after;
            assert.equal(state.plan.cursor, 1);
            await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
            const paused = await databaseSnapshot(page); await openPlay(page, row.touch);
            const pausedScene = await scene(page);
            const resumedPlayItem = [...state.island.items].sort((left, right) => Number(!interestItem(left)) - Number(!interestItem(right)))
                .find(item => item.position && chooseReachableResident(candidates(pausedScene), item,
                state.island.items, state.island.completedSets));
            assert(resumedPlayItem, 'At least one placed possession remains playable from the actual resumed scene');
            row.resumedPlayChoice = { itemId: resumedPlayItem.id, priorMovedLampId: recoveredLamp.id,
                scope: 'Free legal placement may enclose a particular item; resume uses an actually reachable possession, without changing saved furniture.' };
            // Observe this existing reachable replay without changing its naturally selected resident.
            if (interestItem(resumedPlayItem)) await observedVisit(page, row, state.island, resumedPlayItem, { touch: row.touch });
            else { await invite(page, state.island, resumedPlayItem, { touch: row.touch }); await waitSettled(page, resumedPlayItem.id); }
            await reducedInterest(page, row);
            await unchanged(page, paused, row, 'Replay while learning is paused preserves the exact reserved plan');
            const beforeLearning = await scene(page);
            await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
            const resumed = await readNative(page, profileId); assert.equal(resumed.plan.id, planId); assert.equal(resumed.plan.cursor, 1);
            assert.deepEqual(resumed.plan, state.plan, 'Continue from play keeps every question and saved cursor');
            await page.waitForFunction(drawCount => {
                const d = document.querySelector('[data-testid="island-stage"]')?.dataset;
                return Number(d?.drawCount) > drawCount && JSON.parse(d.residentInterest || 'null')?.context !== 'visit';
            }, beforeLearning.drawCount);
            row.interestEvidence.learningEntry = { before: beforeLearning, after: await scene(page),
                ordinaryLayerObservedBeforeEntry: beforeLearning.interest?.context === 'visit' };
            await waitLearningReady(page, resumed.plan); await capture(page, 'next-learning', row);
            const next = await attempt(page, resumed, { touch: row.touch }); assert.equal(next.after.plan.cursor, 2);
            row.nextLearning = { planId, cursor: next.after.plan.cursor, exactlyOneReceipt: true };
            const species = ['otter', 'rabbit', 'fox'];
            const ordinary = [...new Set(row.interestEvidence.ordinary.map(entry => entry.species))];
            const learning = [...new Set(row.interestEvidence.learning.map(entry => entry.species))];
            row.interestEvidence.coverage = { ordinarySpecies: ordinary, learningSpecies: learning,
                sameSpeciesContextPairs: species.filter(name => ordinary.includes(name) && learning.includes(name)),
                unobserved: species.flatMap(name => [!ordinary.includes(name) && `${name}: ordinary interest`,
                    !learning.includes(name) && `${name}: saved-light reply`].filter(Boolean)),
                interpretation: 'Observed contexts only. A shared species is available for author comparison; these attributes do not establish visual appeal or silent comprehension.' };
            assert.deepEqual(row.errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack ?? String(error);
            row.failureInterestFrames = await takeInterestFrames(page).catch(() => null);
            row.failureScene = await scene(page).catch(() => null);
            if (row.profileId) row.failurePersistence = await readNative(page, row.profileId).catch(() => null);
            await page.screenshot({ path: `${out}/${row.name}-failure.png` }).catch(() => {});
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => '')).catch(() => {});
            throw error;
        } finally { await context.close(); }
    }
    report.sourceEnd = await sourceSnapshot();
    assert.equal(report.sourceEnd.hash, report.sourceStart.hash, 'Application source stays fixed during production verification');
    report.pass = report.scenarios.every(row => row.pass);
} catch (error) { report.error = error.stack ?? String(error); process.exitCode = 1; }
finally {
    await browser.close(); report.browserClosed = true; report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ pass: report.pass, browserClosed: true, report: `${out}/report.json`, scenarios: report.scenarios.map(row => ({ name: row.name, pass: row.pass, error: row.error })) }, null, 2));
}
