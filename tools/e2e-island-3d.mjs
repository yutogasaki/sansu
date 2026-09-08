import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Matrix4, Vector3 } from 'three';
import assert from 'node:assert/strict';
import { activate, button, ISLAND_CANDIDATE, percentile, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, assertProblemMeaning, assertReaction, attempt, typeDuringCue, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5299';
const out = process.env.SANSU_ISLAND_3D_OUTPUT || 'output/playwright/island-3d';
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE || 'output/playwright/island-3d-production/build-source.json';
const filter = process.env.SANSU_ISLAND_3D_SCENARIO;
const layouts = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
].filter(layout => !filter || layout.name === filter);
assert(layouts.length, 'Scenario must be phone or tablet');

// The test uses the real placement constraints only to choose reachable UI targets.
// No browser domain imports, island fixtures, plan replacements or synthetic rewards.
const bundled = await build({ stdin: { contents: `export { isValidIslandPlacement } from './src/domain/island/catalog.ts';
export { residentObstacles, residentPointIsClear } from './src/components/island/three/navigation.ts';
export { chooseReachableResident } from './src/components/island/three/residentInteraction.ts';`,
    resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const placementSource = bundled.outputFiles[0].text;
const { isValidIslandPlacement, chooseReachableResident, residentObstacles, residentPointIsClear } = await import(`data:text/javascript;base64,${Buffer.from(placementSource).toString('base64')}`);
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceSnapshot = async () => {
    // Freeze every actual build input and this harness's import closure. Other
    // standalone QA scripts may be maintained concurrently without changing this run.
    const manifest = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    const paths = [...new Set([...manifest.files.map(file => file.path),
        'tools/e2e-island-3d.mjs', 'tools/island-e2e-helpers.mjs',
        'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};

await fs.mkdir(out, { recursive: true });
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', candidate: ISLAND_CANDIDATE,
    startedAt: new Date().toISOString(), sourceStart: await sourceSnapshot(), fixtureModuleHash,
    placementOracleHash: sha(placementSource), scenarios: [], captures: [], pass: false, browserClosed: false,
    evidenceScope: 'Production UI, isolated native profile/memory setup only. All six furniture kinds are earned through actual reserved learning and reward buttons in each viewport. Real pointer input, persistence receipts, rendered Object3D/material observations and renderer resource counts. Seat geometry/rig correctness has separate unit coverage; all-input coverage and formal throughput remain separate gates.',
    loadScope: 'Frame CPU measures renderer work; CDP TaskDuration measures page main-thread activity including QA observation. No synthetic 50-item stress, hardware frame-rate claim or child behavior claim.' };
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});

async function installProbe(page) {
    await page.evaluate(() => {
        window.__island3dRead = () => {
            const stage = document.querySelector('[data-testid="island-stage"]');
            if (!stage) return null;
            const data = stage.dataset;
            return { at: performance.now(), drawCount: Number(data.drawCount), cpuMs: Number(data.frameCpuMs),
                calls: Number(data.drawCalls), triangles: Number(data.triangles), geometries: Number(data.geometries), textures: Number(data.textures),
                previewBuildCount: Number(data.previewBuildCount), previewValid: data.previewValid,
                preview: data.previewState ? JSON.parse(data.previewState) : null,
                furniture: data.furnitureState ? JSON.parse(data.furnitureState) : [],
                interest: data.residentInterest ? JSON.parse(data.residentInterest) : null,
                reactionId: data.reactionId, reactionKind: data.reactionKind, reactionPhase: data.reactionPhase,
                reactionTarget: data.reactionTarget, completed: Number(data.sectionCompleted),
                residentAction: data.residentAction, residentItemId: data.residentItemId, usePhase: Number(data.residentUsePhase),
                residentSpecies: data.residentSpecies, residentStates: data.residentStates ? JSON.parse(data.residentStates) : [],
                residentPoint: { x: Number(data.residentX), y: Number(data.residentY), z: Number(data.residentZ) },
                visibility: document.visibilityState, camera: data.cameraFrame,
                expanded: data.expanded, lighthouse: data.lighthouse, residents: Number(data.residents) };
        };
        window.__island3dProbe?.stop();
        const rows = [];
        let handle = 0, stopped = false, lastCount = -1;
        const tick = () => {
            if (stopped) return;
            const row = window.__island3dRead();
            if (row && row.drawCount !== lastCount) { lastCount = row.drawCount; rows.push(row); }
            if (rows.length > 6000) rows.shift();
            handle = requestAnimationFrame(tick);
        };
        window.__island3dProbe = { rows, stop: () => { stopped = true; cancelAnimationFrame(handle); } };
        tick();
    });
    await page.waitForFunction(() => {
        const stage = document.querySelector('[data-testid="island-stage"]');
        return stage?.hasAttribute('data-furniture-state') && stage.hasAttribute('data-preview-state') && Number(stage.dataset.drawCount) > 0;
    });
}
const scene = page => page.evaluate(() => window.__island3dRead());
const probeRows = page => page.evaluate(() => window.__island3dProbe.rows);
const closeTo = (actual, expected, reason, tolerance = .0001) => assert(Math.abs(actual - expected) <= tolerance, `${reason}: ${actual} vs ${expected}`);

async function capture(page, name, state) {
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision);
    assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, report.manifest.island.candidate);
    assert.equal(metadata.artDirection, report.manifest.island.artDirection);
    assert.equal(metadata.learningCandidate, 'mystic-island-learning-v2');
    const file = `${name}.png`, image = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata, scene: await scene(page),
        islandRevision: state?.island.revision, completedSets: state?.island.completedSets });
}

async function projection(page) {
    const canvas = await page.locator('[data-renderer="three"] canvas').boundingBox();
    const values = (await scene(page)).camera.split(',').map(Number);
    assert(canvas && values.length === 32);
    const view = new Matrix4().fromArray(values.slice(0, 16)).invert(), projection = new Matrix4().fromArray(values.slice(16));
    return point => {
        const projected = new Vector3(point.x, point.y ?? 0, point.z).applyMatrix4(view).applyMatrix4(projection);
        return { x: canvas.x + (projected.x + 1) * canvas.width / 2,
            y: canvas.y + (1 - projected.y) * canvas.height / 2,
            inside: Math.abs(projected.x) < .93 && Math.abs(projected.y) < .93 };
    };
}

async function tapPoint(page, point, touch) {
    assert(point.inside !== false, 'The real pointer target must be visible inside the canvas');
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
}

async function drag(page, cdp, from, to, touch) {
    assert(from.inside !== false && to.inside !== false);
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
    else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
    for (let i = 1; i <= 24; i++) {
        const x = from.x + (to.x - from.x) * i / 24, y = from.y + (to.y - from.y) * i / 24;
        if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
        else await page.mouse.move(x, y);
        await page.waitForTimeout(12);
    }
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
}

async function waitPreview(page, id, expected) {
    await page.waitForFunction(({ id, expected }) => {
        const state = window.__island3dRead();
        return state?.preview?.id === id && (!expected || Math.abs(state.preview.position[0] - expected.x) < .0001
            && Math.abs(state.preview.position[2] - expected.z) < .0001);
    }, { id, expected });
    return scene(page);
}

async function legalTargets(page, state, item) {
    const project = await projection(page), options = [];
    for (let z = .5; z <= 2.25; z += .25) for (let x = -2.25; x <= 2.75; x += .25) {
        const point = { x, z };
        if (isValidIslandPlacement(state.island, item.id, point, item.rotation) && project(point).inside
            && Math.hypot(x - item.position.x, z - item.position.z) > .55) options.push(point);
    }
    options.sort((a, b) => Math.hypot(a.x - item.position.x, a.z - item.position.z) - Math.hypot(b.x - item.position.x, b.z - item.position.z));
    assert(options.length > 2, 'This earned island has visible legal room for a real drag');
    return options;
}

async function waitResident(page, id, action) {
    await page.waitForFunction(({ id, action }) => {
        const state = window.__island3dRead();
        return state?.residentItemId === id && state.residentAction === action;
    }, { id, action }, { timeout: 15000 });
}

async function rememberResident(page, row, item) {
    const actual = await scene(page);
    assert.equal(actual.residentItemId, item.id);
    assert(['otter', 'rabbit', 'fox'].includes(actual.residentSpecies));
    row.residentOrigins[actual.residentSpecies] = { itemId: item.id, point: actual.residentPoint };
}

async function chooseReachablePreview(page, state, item, layout, row) {
    const original = (await waitPreview(page, item.id)).preview;
    const actual = await scene(page);
    const residents = actual.residentStates.map(resident => ({ position: { x: resident.position[0], z: resident.position[2] },
        visible: true, itemId: resident.itemId }));
    const afterIndex = ['otter', 'rabbit', 'fox'].indexOf(actual.residentSpecies);
    const project = await projection(page);
    const suggested = { x: original.position[0], z: original.position[2] };
    const candidates = [suggested];
    for (let z = 2.5; z >= -2.5; z -= .5) for (let x = -3.5; x <= 7.5; x += .5) candidates.push({ x, z });
    candidates.sort((a, b) => Math.hypot(a.x - suggested.x, a.z - suggested.z) - Math.hypot(b.x - suggested.x, b.z - suggested.z));
    const options = [];
    for (const position of candidates) {
        if (!project(position).inside || !isValidIslandPlacement(state.island, item.id, position, original.rotationY)) continue;
        const target = { ...item, position, rotation: original.rotationY };
        const items = state.island.items.map(existing => existing.id === item.id ? target : existing);
        const choice = chooseReachableResident(residents, target, items, state.island.completedSets, afterIndex);
        if (!choice) continue;
        const route = choice.route, end = route.points.at(-1);
        // A legal footprint can be too narrow for the resident. Also leave its arrival
        // clear of the former seat so a subsequent visit starts from walkable ground.
        if (!residentPointIsClear(end, state.island.completedSets >= 2, residentObstacles(items, item.id))) continue;
        options.push({ position, route, species: actual.residentStates[choice.index].species, origin: residents[choice.index],
            distance: Math.hypot(position.x - suggested.x, position.z - suggested.z) });
        break;
    }
    options.sort((a, b) => a.distance - b.distance);
    assert(options.length, `A visible, physically reachable placement exists for ${item.kind}`);
    const selected = options[0];
    row.placementChoices.push({ itemId: item.id, kind: item.kind, suggested, selected,
        reason: 'Real UI placement with a resident route and an arrival clear of the former furniture; no saved state or route is injected.' });
    if (selected.distance > .0001) {
        await tapPoint(page, project(selected.position), layout.touch);
        await waitPreview(page, item.id, selected.position);
    }
}

async function selectItem(page, item, touch) {
    const project = await projection(page);
    // Raycast only world furniture; select the visible seat/contact portion of the earned bench.
    await tapPoint(page, project({ ...item.position, y: item.kind === 'bench' ? .5 : .35 }), touch);
    await waitMode(page, 'placement');
    const state = await waitPreview(page, item.id);
    assert.equal(state.preview.sourceVisible, false, 'Lifting hides the original furniture mesh');
    return state;
}

async function oneSavedEdit(page, profileId, before, itemId, touch) {
    const preview = (await scene(page)).preview;
    assert(await button(page, 'ここに おく').isEnabled());
    await activate(button(page, 'ここに おく'), touch);
    await waitMode(page, 'home');
    const after = await readNative(page, profileId);
    assert.equal(after.island.revision, before.island.revision + 1);
    assert.equal(after.islandEvents.length, before.islandEvents.length + 1);
    const event = after.islandEvents.find(event => !before.islandEvents.some(old => old.id === event.id));
    assert.equal(event.type, 'item_edited'); assert.equal(event.itemId, itemId);
    assert.deepEqual(after.logs, before.logs); assert.deepEqual(after.islandPlans, before.islandPlans);
    const item = after.island.items.find(item => item.id === itemId);
    closeTo(item.position.x, preview.position[0], 'Saved x equals final real preview');
    closeTo(item.position.z, preview.position[2], 'Saved z equals final real preview');
    closeTo(item.rotation, ((preview.rotationY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), 'Saved rotation');
    return after;
}

async function exercisePlacement(page, cdp, profileId, layout, row, bench) {
    const before = await readNative(page, profileId);
    const resting = await scene(page);
    const lifted = await selectItem(page, bench, layout.touch);
    const originalPreview = lifted.preview, project = await projection(page), targets = await legalTargets(page, before, bench);
    const obstacle = before.island.items.find(item => item.id === 'starter-lantern');
    // WebGL uploads each marker on its first visible frame. Exercise both once before
    // measuring repeated drag reuse, so a first upload is not mistaken for a leak.
    await tapPoint(page, project(obstacle.position), layout.touch);
    await waitPreview(page, bench.id, obstacle.position);
    await tapPoint(page, project(targets[0]), layout.touch);
    const start = await waitPreview(page, bench.id, targets[0]);
    const dragStart = (await scene(page)).at;
    await drag(page, cdp, project(targets[0]), project(targets[1]), layout.touch);
    await waitPreview(page, bench.id, targets[1]);
    for (const point of targets.slice(2, 5)) {
        const current = (await scene(page)).preview;
        await drag(page, cdp, project({ x: current.position[0], z: current.position[2] }), project(point), layout.touch);
        await waitPreview(page, bench.id, point);
    }
    for (let i = 1; i <= 4; i++) {
        await activate(button(page, 'まわす'), layout.touch);
        await page.waitForFunction(({ rotation }) => Math.abs(window.__island3dRead().preview.rotationY - rotation) < .0001,
            { rotation: originalPreview.rotationY + i * Math.PI / 2 });
    }
    // Keyboard users retain the accessible arrows; touch users use the same visible controls.
    const prior = (await scene(page)).preview.position;
    await button(page, 'みぎへ').focus();
    await page.keyboard.press('Enter');
    await waitPreview(page, bench.id, { x: prior[0] + .25, z: prior[2] });
    await tapPoint(page, project(obstacle.position), layout.touch);
    const invalid = await waitPreview(page, bench.id, obstacle.position);
    assert.equal(invalid.previewValid, 'false'); assert.equal(invalid.preview.marker, 'broken');
    assert.equal(await button(page, 'ここに おく').isEnabled(), false);
    await capture(page, `${layout.name}-invalid-placement`, before);
    await tapPoint(page, project(targets[0]), layout.touch);
    const recovered = await waitPreview(page, bench.id, targets[0]);
    assert.equal(recovered.previewValid, 'true'); assert.equal(recovered.preview.marker, 'solid');
    assert.equal(recovered.preview.uuid, originalPreview.uuid);
    assert.equal(recovered.previewBuildCount, start.previewBuildCount, 'Move/rotate/validity reuse one preview model');
    const dragFrames = (await probeRows(page)).filter(sample => sample.at >= dragStart && sample.preview?.id === bench.id);
    assert(dragFrames.length > 3, 'Observe the actual drag frames');
    assert(dragFrames.every(sample => sample.preview.uuid === originalPreview.uuid && !sample.preview.sourceVisible));
    assert(dragFrames.every(sample => sample.geometries === start.geometries && sample.textures === start.textures), 'Drag never accumulates geometry or textures');
    assert.deepEqual(await readNative(page, profileId), before, 'Tap, drag, arrows and rotation never write before Save');
    await capture(page, `${layout.name}-drag-preview`, before);
    await activate(button(page, 'いどうを やめる'), layout.touch);
    await waitMode(page, 'home');
    assert.deepEqual(await readNative(page, profileId), before, 'Cancel restores the exact earned island');
    await waitResident(page, bench.id, 'sit');
    const canceled = await scene(page);
    assert.equal(canceled.geometries, resting.geometries, 'Cancel disposes the temporary preview geometry');
    assert.equal(canceled.textures, resting.textures, 'Cancel does not retain preview textures');
    row.liftCancelRestoredResident = true;
    await selectItem(page, bench, layout.touch);
    let state = await oneSavedEdit(page, profileId, before, bench.id, layout.touch);
    await waitResident(page, bench.id, 'sit');
    row.samePositionSaveRestoredResident = true;
    const samePosition = state;
    await selectItem(page, state.island.items.find(item => item.id === bench.id), layout.touch);
    await drag(page, cdp, project(bench.position), project(targets[0]), layout.touch);
    await waitPreview(page, bench.id, targets[0]);
    state = await oneSavedEdit(page, profileId, samePosition, bench.id, layout.touch);
    await waitResident(page, bench.id, 'sit');
    await capture(page, `${layout.name}-moved-bench`, state);
    const saved = state.island;
    await page.reload(); await waitReady(page); await waitMode(page, 'home'); await installProbe(page);
    state = await readNative(page, profileId);
    assert.deepEqual(state.island, saved, 'Saved drag and rotation survive a real reload');
    await waitResident(page, bench.id, 'sit');
    await rememberResident(page, row, bench);
    // After a seat restore, the fair reachable resident must still use the rotated lamp.
    await activate(button(page, 'もちもの'), layout.touch);
    await activate(page.getByRole('button', { name: /^ほしあかり \d+を うごかす$/ }), layout.touch);
    await waitMode(page, 'placement');
    const lampPreview = await waitPreview(page, obstacle.id);
    await activate(button(page, 'まわす'), layout.touch);
    await page.waitForFunction(rotation => Math.abs(window.__island3dRead().preview.rotationY - rotation) < .0001,
        lampPreview.preview.rotationY + Math.PI / 2);
    // The selected resident may now differ under fair turns. Its actual lamp
    // arrival must still clear the former bench and allow a later furniture visit.
    state = await oneSavedEdit(page, profileId, state, obstacle.id, layout.touch);
    await waitResident(page, obstacle.id, 'admire');
    await rememberResident(page, row, obstacle);
    const lampResident = await scene(page);
    assert(residentPointIsClear(lampResident.residentPoint, state.island.completedSets >= 2,
        residentObstacles(state.island.items, obstacle.id)), 'The lamp arrival is outside the former bench, allowing the following mushroom visit');
    row.residentReachedNextFurniture = { species: lampResident.residentSpecies, arrivalClearOfFormerSeat: true };
    await capture(page, `${layout.name}-lamp-use-after-seat`, state);
    row.placement = { previewReused: true, beforeSaveStateUnchanged: true, sourceHidden: true, fourRotations: true,
        tap: true, drag: true, arrowKeyboard: true, invalidRecovered: true, cancelUnchanged: true, savedOnce: true,
        reloadUnchanged: true, dragFrames };
    return state;
}

async function verifyLocalReaction(page, before, result, row, layout) {
    await assertReaction(page, result.receipt, 'correct', result.saved.cursor);
    await page.waitForFunction(id => {
        const state = window.__island3dRead();
        return state.reactionId === id && state.reactionPhase === 'contact';
    }, result.receipt.id);
    await capture(page, `${layout.name}-light-${result.saved.cursor}`, result.after);
    await page.waitForFunction(id => {
        const state = window.__island3dRead();
        return state.reactionId === id && state.reactionPhase === 'settled';
    }, result.receipt.id);
    const frames = (await probeRows(page)).filter(frame => frame.reactionId === result.receipt.id);
    const changed = new Set();
    for (const frame of frames) for (const object of frame.furniture) {
        assert.deepEqual(object.rootScale, [1, 1, 1], 'A correct answer never scales the furniture root');
        const life = object.life;
        if (life?.bloomScale > 1.0001 || life?.leafScale > 1.0001 || life?.emissive > .6501
            || life?.waterScaleY > 1.0001 || life?.rippleScale > 1.0001) changed.add(object.kind);
    }
    row.life.push({ receiptId: result.receipt.id, cursorBefore: before.plan.cursor, cursorAfter: result.saved.cursor,
        target: frames.find(frame => frame.reactionTarget)?.reactionTarget, changedKinds: [...changed], frames });
    return changed;
}

function ordinaryMaterialAtRest(object) {
    assert(object?.visible && object.life, 'Read the actual visible furniture from a rendered frame');
    assert.deepEqual(object.rootScale, [1, 1, 1]);
    for (const key of ['bloomScale', 'leafScale', 'waterScaleY', 'rippleScale']) {
        if (object.life[key] !== undefined) closeTo(object.life[key], 1, `Ordinary ${object.kind} restores ${key}`);
    }
    if (object.life.emissive !== undefined) closeTo(object.life.emissive, .65, 'Ordinary light restores its own emission');
}

async function verifyOrdinaryMaterial(page, item, since, row) {
    if (!['flower', 'lantern', 'fountain'].includes(item.kind)) return;
    await page.waitForFunction(({ id, since }) => window.__island3dProbe.rows.some(frame => frame.at >= since
        && frame.interest?.context === 'visit' && frame.interest.itemId === id
        && !frame.interest.reduced && frame.interest.phase >= 1), { id: item.id, since });
    const frames = (await probeRows(page)).filter(frame => frame.at >= since && frame.interest?.context === 'visit'
        && frame.interest.itemId === item.id && !frame.interest.reduced);
    assert(frames.length > 1, 'The existing probe observed multiple actual ordinary-use draws');
    const parts = frames.map(frame => frame.furniture.find(object => object.id === item.id));
    for (const object of parts) {
        assert(object?.visible && object.life); assert.deepEqual(object.rootScale, [1, 1, 1]);
        if (item.kind === 'flower') closeTo(object.life.leafScale, 1, 'Ordinary flower leaves do not expand');
        if (item.kind === 'fountain') closeTo(object.life.waterScaleY, 1, 'Ordinary fountain jets and droplets do not stretch');
    }
    const changedPart = { flower: 'bloomScale', lantern: 'emissive', fountain: 'rippleScale' }[item.kind];
    const restValue = item.kind === 'lantern' ? .65 : 1;
    assert(parts.some(object => object.life[changedPart] > restValue + .0001), `Actual ordinary ${item.kind} responds through ${changedPart}`);
    const settled = frames.find(frame => frame.interest.phase >= 1);
    ordinaryMaterialAtRest(settled.furniture.find(object => object.id === item.id));
    row.ordinaryLife.push({ itemId: item.id, kind: item.kind, changedPart, frames, settled,
        scope: 'Actual rendered bloom/leaf X scale, jet/drop Y scale, ripple X scale and owned emission. Full mesh/material invariants have separate unit coverage.' });
}

async function verifyOrdinaryClearedForLearning(page, row) {
    const visit = row.ordinaryLife.at(-1);
    if (!visit || visit.clearedForLearning) return;
    await page.waitForFunction(({ id, after }) => {
        const frame = window.__island3dRead();
        return frame?.drawCount > after && frame.furniture.some(object => object.id === id)
            && !(frame.interest?.context === 'visit' && frame.interest.itemId === id);
    }, { id: visit.itemId, after: visit.settled.drawCount });
    const frame = await scene(page);
    ordinaryMaterialAtRest(frame.furniture.find(object => object.id === visit.itemId));
    visit.clearedForLearning = frame;
}

async function finishSection(page, profileId, layout, row, inspectLife = false) {
    let state = await readNative(page, profileId), attempts = 0;
    const lifeKinds = new Set(), reservationId = state.plan.id, previousSets = state.island.completedSets;
    while (state.plan?.id === reservationId) {
        assert(attempts++ < 40, 'The actual reserved section terminates');
        await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]);
        const before = state, result = await attempt(page, before, { touch: layout.touch });
        row.samples.push(result.sample);
        state = result.after;
        if (inspectLife && result.sample.completed && result.saved.cursor <= 2 && !result.sample.terminal) {
            if (result.saved.cursor === 1 && await page.locator('.park-input span').count()) row.parallelInput = await typeDuringCue(page, result.receipt);
            for (const kind of await verifyLocalReaction(page, before, result, row, layout)) lifeKinds.add(kind);
        }
    }
    assert.equal(state.islandPlans.find(plan => plan.id === reservationId)?.status, 'completed');
    assert.equal(state.island.completedSets, previousSets + 1);
    if (previousSets > 0) {
        assert.equal(state.plan?.id, JSON.stringify(['island-plan-v1', profileId, previousSets + 1]));
        assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
        await waitMode(page, 'learning');
        await activate(button(page, 'しまへ'), layout.touch); await waitMode(page, 'home');
        await activate(page.getByRole('button', { name: /^おくりものを えらぶ/ }), layout.touch);
        assert.deepEqual(await readNative(page, profileId), state, 'Collecting the earned object leaves the automatic next reservation intact');
    }
    await waitMode(page, 'reward');
    if (inspectLife) {
        assert(lifeKinds.has('flower'), 'The saved first answers visibly animate flower parts');
        assert(lifeKinds.has('lantern'), 'The saved first answers visibly brighten the owned lantern bulb');
    }
    return state;
}

async function claimAndPlace(page, profileId, state, kind, label, action, layout, row) {
    const reward = state.island.pendingRewards[0];
    assert(reward?.choices.includes(kind));
    await activate(button(page, label), layout.touch); await waitMode(page, 'placement');
    state = await readNative(page, profileId);
    const item = state.island.items.find(item => item.id === `${reward.id}:item`);
    assert.equal(item.kind, kind); assert.equal(item.position, undefined);
    await waitPreview(page, item.id);
    await chooseReachablePreview(page, state, item, layout, row);
    await capture(page, `${layout.name}-${kind}-placement`, state);
    await activate(button(page, 'まわす'), layout.touch);
    await capture(page, `${layout.name}-${kind}-placement-rotated`, state);
    assert.deepEqual(await readNative(page, profileId), state, `${kind}: rotation is only a preview`);
    await activate(button(page, 'いどうを やめる'), layout.touch); await waitMode(page, 'home');
    assert.deepEqual(await readNative(page, profileId), state, `${kind}: cancel restores saved possessions`);
    await activate(button(page, 'もちもの'), layout.touch); await waitMode(page, 'inventory');
    const inventoryIndex = state.island.items.findIndex(existing => existing.id === item.id);
    await activate(button(page, `${label} ${inventoryIndex + 1}を うごかす`), layout.touch); await waitMode(page, 'placement');
    await waitPreview(page, item.id);
    await chooseReachablePreview(page, state, item, layout, row);
    const visitStart = (await scene(page)).at;
    state = await oneSavedEdit(page, profileId, state, item.id, layout.touch);
    await waitResident(page, item.id, action);
    await rememberResident(page, row, item);
    if (kind === 'swing') {
        // A Playwright round-trip may finish after this short gesture under
        // concurrent QA load. The already-running RAF probe records actual draws,
        // so verify the original use beat rather than waiting for it to repeat.
        await page.waitForFunction(id => window.__island3dProbe.rows.some(state => {
            const object = state.furniture.find(item => item.id === id);
            return state.residentItemId === id && state.usePhase > .03 && state.usePhase < .9 && Math.abs(object?.swingAngle ?? 0) > .002;
        }), item.id);
        row.swing = (await probeRows(page)).find(state => state.residentItemId === item.id && state.usePhase > .03
            && state.usePhase < .9 && Math.abs(state.furniture.find(object => object.id === item.id)?.swingAngle ?? 0) > .002);
    }
    await capture(page, `${layout.name}-${kind}-earned-use`, state);
    await verifyOrdinaryMaterial(page, item, visitStart, row);
    row.earned.push({ kind, itemId: item.id, rewardId: reward.id, completedSets: state.island.completedSets, action });
    return { state, item: state.island.items.find(candidate => candidate.id === item.id) };
}

async function loadSample(page, cdp, label, duration = 1400) {
    const before = await scene(page), metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    await page.waitForTimeout(duration);
    const after = await scene(page), later = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    const frames = (await probeRows(page)).filter(frame => frame.at >= before.at && frame.at <= after.at);
    assert(after.drawCount - before.drawCount <= duration / 1000 * 36 + 3, 'The renderer preserves its throttled update cadence');
    return { label, durationMs: after.at - before.at, frames, drawCountDelta: after.drawCount - before.drawCount,
        frameCpuP95Ms: frames.length ? percentile(frames.map(frame => frame.cpuMs), .95) : null,
        taskDurationMs: (later.TaskDuration - metrics.TaskDuration) * 1000,
        scriptDurationMs: (later.ScriptDuration - metrics.ScriptDuration) * 1000,
        geometries: after.geometries, textures: after.textures, calls: after.calls, triangles: after.triangles };
}

async function offscreenPause(page, profileId, layout) {
    const before = await readNative(page, profileId);
    // Exercise the real scroll container and IntersectionObserver without changing app styles/state.
    await page.setViewportSize({ width: layout.viewport.width, height: 180 });
    await page.locator('.island-footer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-testid="island-stage"]').getBoundingClientRect().bottom <= 0);
    await page.waitForTimeout(70);
    const start = await scene(page);
    await page.waitForTimeout(650);
    const end = await scene(page);
    assert.equal(end.drawCount, start.drawCount, 'Offscreen rendering stops while the actual page stays visible');
    assert.equal(end.visibility, 'visible');
    await page.setViewportSize(layout.viewport);
    await page.locator('[data-testid="island-stage"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(count => window.__island3dRead().drawCount > count, end.drawCount);
    assert.deepEqual(await readNative(page, profileId), before);
    return { start, end, resumed: await scene(page), persistenceUnchanged: true };
}

try {
    report.buildSourcePath = buildSourcePath;
    const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    report.buildSource = { revision: buildSource.revision, hash: buildSource.sourceHash, flags: buildSource.flags };
    const buildFiles = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    const common = report.sourceStart.files.filter(file => buildFiles.has(file.path));
    assert(common.some(file => file.path === 'src/components/island/three/runtime.ts'));
    report.buildSourceMatch = { commonFiles: common.length,
        mismatches: common.filter(file => buildFiles.get(file.path) !== file.sha256) };
    assert.deepEqual(report.buildSourceMatch.mismatches, [], 'All common application files match the immutable production build');
    for (const layout of layouts) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch,
            serviceWorkers: 'block', reducedMotion: 'no-preference' });
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        const row = { ...layout, samples: [], life: [], ordinaryLife: [], earned: [], load: [], residentOrigins: {}, placementChoices: [], pass: false, errors: [] };
        report.scenarios.push(row); page.setDefaultTimeout(15000);
        page.on('pageerror', error => row.errors.push(error.stack));
        try {
            await cdp.send('Performance.enable');
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development'));
            assert.equal(manifest.revision, buildSource.revision);
            assert.equal(manifest.island.candidate, ISLAND_CANDIDATE);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const profileId = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            row.profileId = profileId;
            await page.goto(`${base}/#/island`); await waitReady(page); await waitMode(page, 'home'); await installProbe(page);
            row.gpu = await page.locator('[data-renderer="three"] canvas').evaluate(canvas => {
                const gl = canvas.getContext('webgl2'), info = gl?.getExtension('WEBGL_debug_renderer_info');
                return info ? { vendor: gl.getParameter(info.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(info.UNMASKED_RENDERER_WEBGL) } : { unavailable: true };
            });
            let state = await readNative(page, profileId);
            assert.equal(state.logs.length, 0); assert.equal(state.island.completedSets, 0);
            await capture(page, `${layout.name}-home`, state);
            row.load.push(await loadSample(page, cdp, 'initial-home'));
            await activate(page.locator('.island-start'), layout.touch); await waitMode(page, 'learning');
            state = await readNative(page, profileId); await waitLearningReady(page, state.plan); await assertControls(page);
            const original = state;
            const wrong = await attempt(page, state, { wrong: true, touch: layout.touch });
            row.samples.push(wrong.sample); state = wrong.after;
            await assertReaction(page, wrong.receipt, 'retry', original.plan.cursor);
            assert.equal(state.plan.cursor, original.plan.cursor);
            await activate(button(page, 'ヒントを みる'), layout.touch);
            await waitLearningReady(page, { ...state.plan, revision: state.plan.revision + 1 });
            const supported = await readNative(page, profileId);
            assert.equal(supported.plan.cursor, state.plan.cursor); assert.deepEqual(supported.logs, state.logs);
            assert(supported.plan.slots[supported.plan.cursor].assisted);
            assert.equal(supported.plan.slots[supported.plan.cursor].supportStage, 'hint');
            assert.equal(await page.locator('.island-support-model, .island-support-example, .island-support-answer').count(), 0,
                'The neutral support reaction opens a hint, without displaying the full answer');
            const supportReceipt = supported.islandEvents.find(event => !state.islandEvents.some(old => old.id === event.id));
            await assertReaction(page, supportReceipt, 'support', state.plan.cursor);
            const neutral = await scene(page);
            assert(neutral.furniture.every(object => object.rootScale.every(value => value === 1)));
            assert(neutral.furniture.every(object => !object.life?.bloomScale || object.life.bloomScale === 1));
            assert(neutral.furniture.every(object => !object.life?.leafScale || object.life.leafScale === 1));
            assert(neutral.furniture.every(object => object.life?.emissive === undefined || object.life.emissive <= .6501));
            row.neutralSupport = neutral;
            state = await finishSection(page, profileId, layout, row, true);
            assert.equal(state.island.completedSets, 1);
            const bench = await claimAndPlace(page, profileId, state, 'bench', 'ベンチ', 'sit', layout, row);
            state = await exercisePlacement(page, cdp, profileId, layout, row, bench.item);
            await activate(page.locator('.island-start'), layout.touch); await waitMode(page, 'learning');
            state = await finishSection(page, profileId, layout, row);
            assert.equal(state.island.completedSets, 2);
            state = (await claimAndPlace(page, profileId, state, 'swing', 'ブランコ', 'swing', layout, row)).state;
            row.load.push(await loadSample(page, cdp, 'swing-use-and-settle'));
            const saved = state.island;
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await activate(button(page, 'もちもの'), layout.touch);
            await activate(page.getByRole('button', { name: /^ブランコ \d+を うごかす$/ }), layout.touch);
            await waitMode(page, 'placement'); await waitPreview(page, row.earned[1].itemId);
            await activate(button(page, 'いどうを やめる'), layout.touch); await waitMode(page, 'home');
            await waitResident(page, row.earned[1].itemId, 'swing');
            const reduced = await scene(page);
            assert.equal(reduced.usePhase, 1);
            closeTo(reduced.furniture.find(item => item.id === row.earned[1].itemId).swingAngle, 0, 'Reduced motion rests the swing');
            assert.deepEqual((await readNative(page, profileId)).island, saved);
            row.reduced = reduced; await capture(page, `${layout.name}-reduced-swing`, state);
            row.load.push(await loadSample(page, cdp, 'reduced-rest'));
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            for (const [kind, label, action] of [
                ['flower', 'ひかる おはな', 'sniff'], ['mushroom', 'きのこの いす', 'rest'],
                ['lantern', 'ほしあかり', 'admire'], ['fountain', 'ふんすい', 'watch'],
            ]) {
                await activate(page.locator('.island-start'), layout.touch); await waitMode(page, 'learning');
                await verifyOrdinaryClearedForLearning(page, row);
                state = await finishSection(page, profileId, layout, row);
                state = (await claimAndPlace(page, profileId, state, kind, label, action, layout, row)).state;
            }
            assert.equal(state.island.completedSets, 6);
            assert.deepEqual(new Set(row.earned.map(item => item.kind)), new Set(['bench', 'swing', 'flower', 'mushroom', 'lantern', 'fountain']));
            const expanded = await scene(page);
            assert.equal(expanded.expanded, 'true'); assert.equal(expanded.lighthouse, 'true'); assert.equal(expanded.residents, 3);
            row.load.push(await loadSample(page, cdp, 'six-earned-expanded-island'));
            await capture(page, `${layout.name}-six-earned-expanded-island`, state);
            await activate(button(page, 'どうぶつと あそぶ'), layout.touch); await waitMode(page, 'play');
            const playList = page.getByRole('group', { name: 'あそぶ もの' });
            assert.equal(await playList.getByRole('button').count(), state.island.items.filter(item => item.position).length);
            const listBox = await playList.boundingBox(), returnBox = await button(page, 'ひかりを とどける').boundingBox();
            assert(listBox && returnBox && listBox.y + listBox.height <= returnBox.y + 1 && returnBox.y + returnBox.height <= layout.viewport.height,
                'All earned toys remain in a bounded list with the learning return below and in reach');
            await playList.getByRole('button').last().scrollIntoViewIfNeeded();
            await capture(page, `${layout.name}-six-earned-play-list`, state);
            await activate(button(page, 'ひかりを とどける'), layout.touch); await waitMode(page, 'learning');
            await verifyOrdinaryClearedForLearning(page, row);
            assert.deepEqual(row.ordinaryLife.map(visit => visit.kind), ['flower', 'lantern', 'fountain']);
            assert(row.ordinaryLife.every(visit => visit.clearedForLearning), 'Each actual ordinary response clears on the existing learning return');
            state = await readNative(page, profileId); await waitLearningReady(page, state.plan); await assertControls(page);
            const returnFrame = await scene(page);
            for (const resident of returnFrame.residentStates) {
                const bounds = resident.frameBounds;
                assert(bounds && bounds.left >= -1 && bounds.right <= 1 && bounds.bottom >= -1 && bounds.top <= 1,
                    `Expanded island keeps the complete ${resident.species} in learning: ${JSON.stringify(bounds)}`);
            }
            row.expandedLearning = returnFrame;
            await capture(page, `${layout.name}-six-earned-return-learning`, state);
            await activate(button(page, 'しまへ'), layout.touch); await waitMode(page, 'home');
            row.offscreen = await offscreenPause(page, profileId, layout);
            const earnedSaved = state.island;
            await page.reload(); await waitReady(page); await waitMode(page, 'learning'); await installProbe(page);
            state = await readNative(page, profileId);
            assert.deepEqual(state.island, earnedSaved, 'Every earned and placed furniture survives reload');
            await waitLearningReady(page, state.plan); await assertControls(page);
            await capture(page, `${layout.name}-six-earned-reloaded`, state);
            const allFrames = await probeRows(page);
            assert(allFrames.every(frame => Number.isFinite(frame.cpuMs) && frame.cpuMs >= 0));
            row.frames = allFrames;
            row.metrics = { correctP95Ms: percentile(row.samples.filter(sample => !sample.wrong && !sample.terminal).map(sample => sample.ms), .95),
                retryMs: wrong.sample.ms, scope: 'Focused diagnostic only; formal fixed-ten measurement is separate.' };
            assert(row.metrics.correctP95Ms <= 650); assert(row.metrics.retryMs <= 550);
            assert.deepEqual(row.errors, []);
            row.finalPersistence = await readNative(page, profileId);
            row.pass = true;
            console.log(`PASS ${layout.name}: all six earned, drag/rotate/cancel/save/reload, local life, resource reuse and offscreen pause`);
        } catch (error) {
            row.failure = error.stack;
            row.failureScene = await scene(page).catch(() => null);
            row.partialFrames = await probeRows(page).catch(() => []);
            if (row.profileId) row.failurePersistence = await readNative(page, row.profileId).catch(() => null);
            await page.screenshot({ path: `${out}/${layout.name}-failure.png`, animations: 'disabled', fullPage: true }).catch(() => undefined);
            throw error;
        } finally { await context.close(); }
    }
    report.pass = report.scenarios.every(row => row.pass);
} finally {
    await browser.close(); report.browserClosed = true;
    report.sourceEnd = await sourceSnapshot();
    report.sourceStable = report.sourceStart.hash === report.sourceEnd.hash;
    report.pass &&= report.sourceStable;
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
assert(report.pass, '3D QA gates and one stable source version must pass');
