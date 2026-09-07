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
    scope: 'Production UI. Fresh native profile/memory setup only; four gifts and fox are earned through actual reserved learning. No synthetic furniture/progress/events, DEV imports, route injection or UI bypass. Replay checks read every IndexedDB store before and after. Pure geometry selects legal coordinates, which are applied with actual direction buttons. Functional evidence only; no child observation or formal throughput claim.' };
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});

async function scene(page) {
    return page.locator('[data-testid="island-stage"]').evaluate(stage => {
        const d = stage.dataset;
        return { renderer: d.renderer, requestId: d.playRequestId, status: d.playStatus, reason: d.playReason,
            residents: d.residentStates ? JSON.parse(d.residentStates) : [], selected: d.selectedItem,
            species: d.residentSpecies, target: d.residentItemId, action: d.residentAction,
            usePhase: Number(d.residentUsePhase), camera: d.cameraFrame,
            preview: d.previewState ? JSON.parse(d.previewState) : null, previewValid: d.previewValid,
            reactionId: d.reactionId, reactionPhase: d.reactionPhase,
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
    return scene(page);
}
function candidates(actual) {
    return actual.residents.map(resident => ({ position: { x: resident.position[0], z: resident.position[2] }, visible: true, itemId: resident.itemId }));
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
    await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
    let state = await readNative(page, profileId), guard = 0;
    await waitLearningReady(page, state.plan); await assertControls(page);
    const set = state.island.completedSets;
    while (state.plan) {
        assert(++guard <= 12, 'A section completes with its actual reserved problems');
        const result = await attempt(page, state, { touch: row.touch });
        state = result.after; row.answers.push(result.sample);
    }
    await waitMode(page, 'reward'); assert.equal(state.island.completedSets, set + 1);
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
    return { x, y, target: item.id, actual: await scene(page) };
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
        const row = { ...layout, earned: [], answers: [], suggestions: [], plays: [], persistence: [], errors: [], pass: false };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
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
                const target = options.find(item => chooseReachableResident(candidates(actual), item, possessions, 4, after));
                assert(target, 'At least one unoccupied possession is reachable');
                const started = await invite(page, state.island, target, { touch: row.touch, keyboard: i === 1 });
                const resident = await waitSettled(page, target.id);
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
            await page.reload(); await waitReady(page); await waitMode(page, 'home');
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
            state = (await attempt(page, state, { touch: row.touch })).after;
            assert.equal(state.plan.cursor, 1);
            await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
            const paused = await databaseSnapshot(page); await openPlay(page, row.touch);
            const pausedScene = await scene(page);
            const resumedPlayItem = state.island.items.find(item => item.position && chooseReachableResident(candidates(pausedScene), item,
                state.island.items, state.island.completedSets));
            assert(resumedPlayItem, 'At least one placed possession remains playable from the actual resumed scene');
            row.resumedPlayChoice = { itemId: resumedPlayItem.id, priorMovedLampId: recoveredLamp.id,
                scope: 'Free legal placement may enclose a particular item; resume uses an actually reachable possession, without changing saved furniture.' };
            await invite(page, state.island, resumedPlayItem, { touch: row.touch }); await waitSettled(page, resumedPlayItem.id);
            await unchanged(page, paused, row, 'Replay while learning is paused preserves the exact reserved plan');
            await activate(button(page, 'ひかりを とどける'), row.touch); await waitMode(page, 'learning');
            const resumed = await readNative(page, profileId); assert.equal(resumed.plan.id, planId); assert.equal(resumed.plan.cursor, 1);
            assert.deepEqual(resumed.plan, state.plan, 'Continue from play keeps every question and saved cursor');
            await waitLearningReady(page, resumed.plan); await capture(page, 'next-learning', row);
            const next = await attempt(page, resumed, { touch: row.touch }); assert.equal(next.after.plan.cursor, 2);
            row.nextLearning = { planId, cursor: next.after.plan.cursor, exactlyOneReceipt: true };
            assert.deepEqual(row.errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack ?? String(error);
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
