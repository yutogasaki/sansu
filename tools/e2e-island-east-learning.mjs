import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { chromium } from 'playwright';
import { activate, answerUI, assertKeypad, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, seedNative, waitMode, waitReady }
    from './island-e2e-helpers.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const output = process.env.SANSU_ISLAND_EAST_OUTPUT;
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
assert(output, 'Set SANSU_ISLAND_EAST_OUTPUT to a new evidence directory');
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const qaPaths = ['tools/e2e-island-east-learning.mjs', 'tools/island-e2e-helpers.mjs'];
const sha = value => createHash('sha256').update(value).digest('hex');
let buildSource, expected, browser;
const report = { target, buildSourcePath, startedAt: new Date().toISOString(), captures: [], scenarios: [], pass: false,
    browserClosed: false,
    scope: 'Fresh native profile only; two sections answered in the actual production UI; second earned swing moved to the east through UI arrows. Capture return to learning during its real route, then re-enter learning after seating. No island, plan, reward, resident, or path injection. Geometry/camera evidence is separate from visual judgment and child observation.',
    fixture: 'tools/island-e2e-helpers.mjs:seedNative',
    answerOracle: 'Same helper answerUI(dev:false), using correctAnswer from each actual persisted reserved problem.' };

async function sourceSnapshot() {
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(resolve(sourceRoot, path))) })));
    const expectedFiles = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    return { files, closureHash: sha(JSON.stringify(files)), closureHashMethod: 'SHA-256 of JSON.stringify(sorted actual app+QA path/sha256 records); separate from build sourceHash',
        buildFileCount: buildSource.files.length, qaFiles: files.filter(file => qaPaths.includes(file.path)),
        buildSourceManifestSha256: sha(await fs.readFile(buildSourcePath)),
        mismatches: files.filter(file => expectedFiles.has(file.path) && expectedFiles.get(file.path) !== file.sha256) };
}
function assertBuildIdentity() {
    assert(buildSource && Array.isArray(buildSource.files) && buildSource.files.length > 0, 'Fixed build declares its complete source files');
    assert.equal(new Set(buildSource.files.map(file => file.path)).size, buildSource.files.length, 'Every declared source path is unique');
    for (const file of buildSource.files) {
        assert(typeof file.path === 'string' && !isAbsolute(file.path) && !file.path.split('/').includes('..'));
        assert(/^[a-f0-9]{64}$/.test(file.sha256), `Fixed SHA for ${file.path}`);
    }
    assert(/^[a-f0-9]{64}$/.test(buildSource.sourceHash), 'Record the build generator sourceHash without re-normalizing it');
    assert.equal(buildSource.sourceStableAtBuildEnd, true, 'Use a completed immutable build');
    const flags = { VITE_ISLAND_ENABLED: 'true', VITE_BUILD_PLAY_ENABLED: 'true', VITE_PARK_RENDERER: 'three', VITE_ISLAND_ART_DIRECTION: 'moon-garden' };
    for (const [key, value] of Object.entries(flags)) assert.equal(buildSource.flags?.[key], value, `Fixed build flag ${key}`);
    const version = buildSource.version;
    assert(version && version.revision === buildSource.revision && !version.revision.includes('development'));
    assert(typeof version.version === 'string' && version.version.startsWith(`${version.revision}:`));
    assert.equal(version.island?.enabled, true); assert.equal(version.park?.enabled, true); assert.equal(version.park?.renderer, 'three');
    assert.equal(version.island.delivery, 'mystic-island-v1'); assert.equal(version.island.candidate, ISLAND_CANDIDATE);
    assert.equal(version.island.learningCandidate, 'mystic-island-learning-v2'); assert.equal(version.island.artDirection, 'moon-garden');
    expected = { revision: version.revision, version: version.version, delivery: version.island.delivery,
        candidate: version.island.candidate, learningCandidate: version.island.learningCandidate, artDirection: version.island.artDirection };
    report.expected = expected;
    report.buildSource = { path: buildSourcePath, revision: buildSource.revision, sourceHash: buildSource.sourceHash,
        fileCount: buildSource.files.length, flags: buildSource.flags, version };
}

const scene = page => page.locator('[data-testid="island-stage"]').evaluate(stage => ({
    time: performance.now(), draw: Number(stage.dataset.drawCount),
    preview: stage.dataset.previewState ? JSON.parse(stage.dataset.previewState) : null,
    residents: stage.dataset.residentStates ? JSON.parse(stage.dataset.residentStates) : [],
    camera: stage.dataset.cameraFrame, previewValid: stage.dataset.previewValid,
    mode: document.querySelector('.island-page')?.dataset.mode,
    stageBox: (() => { const r = stage.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
}));
function assertFrame(frame, label) {
    assert.equal(frame.mode, 'learning', label);
    assert(frame.residents.length >= 2, `${label}: real residents present`);
    for (const resident of frame.residents) {
        const b = resident.frameBounds;
        assert(b && Object.values(b).every(Number.isFinite), `${label}: projected bounds recorded for ${resident.species}`);
        assert(b.left >= -1 && b.right <= 1 && b.bottom >= -1 && b.top <= 1,
            `${label}: full ${resident.species}, ears/head/feet, must fit: ${JSON.stringify(b)}`);
    }
}
async function identity(page) {
    const actual = await runtimeMetadata(page);
    for (const key of Object.keys(expected)) assert.equal(actual[key], expected[key], `Runtime identity ${key}`);
    assert.equal(actual.renderer, 'three');
    assert.equal(actual.reducedMotion, false, 'Observe a real ongoing route');
    assert.equal(actual.serviceWorkerControlled, false, 'Fresh isolated production browser context');
    return actual;
}
async function capture(page, row, name) {
    await page.evaluate(() => document.fonts.ready);
    const metadata = await identity(page), state = await scene(page);
    const file = `${row.name}-${name}.png`;
    const bytes = await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), ...metadata, scene: state });
    return state;
}
async function startTrace(page) {
    await page.evaluate(() => {
        window.__sansuEastTrace = { frames: [], running: true, phase: 'placement', lastDraw: -1 };
        const tick = () => {
            const trace = window.__sansuEastTrace, stage = document.querySelector('[data-testid="island-stage"]');
            if (!trace.running) return;
            const draw = Number(stage?.dataset.drawCount);
            if (stage && draw !== trace.lastDraw) {
                trace.lastDraw = draw;
                trace.frames.push({ time: performance.now(), draw, phase: trace.phase,
                    mode: document.querySelector('.island-page')?.dataset.mode, camera: stage.dataset.cameraFrame,
                    residents: JSON.parse(stage.dataset.residentStates || '[]') });
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}
async function markTrace(page, phase) { await page.evaluate(phase => { window.__sansuEastTrace.phase = phase; }, phase); }
async function learningReady(page) {
    await waitMode(page, 'learning');
    await page.waitForFunction(() => {
        const stage = document.querySelector('[data-testid="island-stage"]');
        const residents = JSON.parse(stage?.dataset.residentStates || '[]');
        return residents.length >= 2 && residents.every(resident => resident.frameBounds);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function finishSection(page, id, row, sequence) {
    let state = await readNative(page, id), attempts = 0;
    assert(state.plan && state.island.completedSets === sequence - 1);
    const reservationId = state.plan.id;
    while (state.plan?.id === reservationId) {
        assert(++attempts <= 30, 'Native learning section must terminate');
        const slot = state.plan.slots[state.plan.cursor];
        const answer = await answerUI(page, state.plan, { dev: false, touch: row.touch });
        row.answers.push({ section: sequence, planId: state.plan.id, cursor: state.plan.cursor,
            problemId: slot.problem.id, inputType: answer.inputType, ms: answer.ms,
            beforeRevision: answer.beforeRevision, afterRevision: answer.afterRevision });
        state = answer.state;
    }
    assert.equal(state.islandPlans.find(plan => plan.id === reservationId)?.status, 'completed');
    if (sequence > 1) {
        assert.equal(state.plan?.id, JSON.stringify(['island-plan-v1', id, sequence]));
        assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
        await waitMode(page, 'learning');
        await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
        await activate(page.getByRole('button', { name: /^おくりものを えらぶ/ }), row.touch);
        assert.deepEqual(await readNative(page, id), state, 'Voluntary reward collection preserves the next reserved section');
    }
    await waitMode(page, 'reward');
    assert.equal(state.island.completedSets, sequence, 'Growth must follow actual saved answers');
    assert.equal(state.island.pendingRewards.length, 1);
    row.earnedSections.push({ sequence, attempts, reward: state.island.pendingRewards[0], logs: state.logs.length });
    return state;
}
async function movePreview(page, row, targetPosition) {
    const before = await scene(page);
    assert(before.preview, 'Real preview already created by claiming the reward');
    row.placementMoves = [];
    for (const [axis, coordinate, positive, negative] of [['x', 0, 'みぎへ', 'ひだりへ'], ['z', 2, 'てまえへ', 'おくへ']]) {
        let count = 0;
        while (true) {
            const current = await scene(page), difference = targetPosition[axis] - current.preview.position[coordinate];
            if (Math.abs(difference) < .001) break;
            assert(++count <= 40, `Bounded UI movement along ${axis}`);
            const action = difference > 0 ? positive : negative;
            await activate(button(page, action), row.touch);
            const wanted = current.preview.position[coordinate] + Math.sign(difference) * .25;
            await page.waitForFunction(({ coordinate, wanted }) => {
                const value = document.querySelector('[data-testid="island-stage"]')?.dataset.previewState;
                return value && Math.abs(JSON.parse(value).position[coordinate] - wanted) < .001;
            }, { coordinate, wanted });
            row.placementMoves.push(action);
        }
    }
    const final = await scene(page);
    assert.equal(final.previewValid, 'true', 'App collision/land rules accept the east placement');
    assert(await button(page, 'ここに おく').isEnabled());
    assert.equal(final.preview.position[0], targetPosition.x); assert.equal(final.preview.position[2], targetPosition.z);
    return final;
}

await fs.mkdir(output, { recursive: true });
assert(!(await fs.readdir(output)).includes('report.json'), 'Use a fresh output directory; preserve every earlier result and failure');
try {
    assert(target, 'Set SANSU_ISLAND_PRODUCTION_URL to the fixed production target');
    assert(buildSourcePath, 'Set SANSU_ISLAND_BUILD_SOURCE to its completed build-source manifest');
    buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
    assertBuildIdentity();
    report.sourceStart = await sourceSnapshot();
    assert.deepEqual(report.sourceStart.mismatches, [], 'Every declared build input matches the immutable production source');
    browser = await chromium.launch();
    for (const layout of [
        { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
        { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
    ]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch,
            reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, answers: [], earnedSections: [], errors: [], pass: false };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert.deepEqual(manifest, buildSource.version, 'Served version, revision, delivery, candidates and flags match the exact fixed build');
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const id = await seedNative(page, `east-learning-${layout.name}`); row.profileId = id;
            await page.goto(`${target}/#/island`); await waitReady(page); await waitMode(page, 'home'); await identity(page);
            let state = await readNative(page, id);
            assert.equal(state.island.completedSets, 0); assert.equal(state.logs.length, 0); assert.equal(state.island.items.length, 2);
            await capture(page, row, 'fresh-home');

            await activate(page.locator('.island-start'), row.touch); await learningReady(page); await assertKeypad(page);
            state = await finishSection(page, id, row, 1);
            await capture(page, row, 'first-earned-reward');
            await activate(button(page, 'ベンチ'), row.touch); await waitMode(page, 'placement');
            await activate(button(page, 'いまは しまっておく'), row.touch); await waitMode(page, 'home');
            state = await readNative(page, id);
            assert(state.island.items.some(item => item.kind === 'bench' && !item.position));
            await activate(page.locator('.island-start'), row.touch); await learningReady(page);
            state = await finishSection(page, id, row, 2);
            await page.locator('[data-renderer="three"][data-expanded="true"]').waitFor();
            await capture(page, row, 'second-earned-reward');
            const reward = state.island.pendingRewards[0];
            assert(reward.choices.includes('swing'), 'Second genuinely earned reward offers the swing');
            await activate(button(page, 'ブランコ'), row.touch); await waitMode(page, 'placement');
            const itemId = `${reward.id}:item`; row.itemId = itemId;
            await page.waitForFunction(id => {
                const value = document.querySelector('[data-testid="island-stage"]')?.dataset.previewState;
                return value && JSON.parse(value)?.id === id;
            }, itemId);
            const beforeEdit = await readNative(page, id), east = { x: 6.25, z: 1 };
            row.placement = await movePreview(page, row, east);
            assert.deepEqual(await readNative(page, id), beforeEdit, 'Arrow preview does not mutate saved state');
            await capture(page, row, 'east-swing-preview');
            await startTrace(page);
            await activate(button(page, 'ここに おく'), row.touch); await waitMode(page, 'home');
            await page.waitForFunction(id => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.residentStates || '[]')
                .some(resident => resident.itemId === id && resident.action === 'walk'), itemId);
            row.walkBeforeLearning = await scene(page);
            state = await readNative(page, id);
            assert.deepEqual(state.island.items.find(item => item.id === itemId).position, east);
            assert.equal(state.island.completedSets, 2);
            await activate(page.locator('.island-start'), row.touch); await learningReady(page);
            row.walkingEntry = await scene(page); assertFrame(row.walkingEntry, 'mid-route learning entry');
            assert(row.walkingEntry.residents.some(resident => resident.itemId === itemId && resident.action === 'walk'),
                'Learning actually begins while the east-bound resident is still walking');
            await markTrace(page, 'walking-learning');
            await capture(page, row, 'east-walking-learning'); await assertKeypad(page);
            state = await readNative(page, id);
            assert(state.plan && state.plan.cursor + 1 < state.plan.slots.length);
            const answer = await answerUI(page, state.plan, { dev: false, touch: row.touch });
            row.walkingAnswer = { ms: answer.ms, beforeRevision: answer.beforeRevision, afterRevision: answer.afterRevision };
            const afterAnswer = await scene(page); assertFrame(afterAnswer, 'mid-route answer');
            assert.equal(afterAnswer.camera, row.walkingEntry.camera, 'Answer does not chase the moving resident');
            await page.waitForFunction(id => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.residentStates || '[]')
                .some(resident => resident.itemId === id && resident.action === 'swing' && resident.usePhase >= 1), itemId, { timeout: 20000 });
            row.settledInFirstFrame = await capture(page, row, 'east-seated-same-learning-frame');
            assertFrame(row.settledInFirstFrame, 'settled in frozen moving envelope');
            assert.equal(row.settledInFirstFrame.camera, row.walkingEntry.camera);
            assert.deepEqual(await readNative(page, id), answer.state, 'Walking and sitting do not write learning/game state');

            await markTrace(page, 'pause');
            await activate(button(page, 'しまへ'), row.touch); await waitMode(page, 'home');
            row.seatedHome = await capture(page, row, 'east-seated-home');
            assert(row.seatedHome.residents.some(resident => resident.itemId === itemId && resident.position[0] > 5 && resident.action === 'swing'));
            const reserved = await readNative(page, id);
            await activate(page.locator('.island-start'), row.touch); await learningReady(page); await assertKeypad(page);
            row.seatedEntry = await capture(page, row, 'east-seated-return-learning'); assertFrame(row.seatedEntry, 'seated learning return');
            assert.deepEqual((await readNative(page, id)).plan, reserved.plan, 'Return resumes the same real pending learning plan');
            await markTrace(page, 'seated-learning');
            const next = await answerUI(page, reserved.plan, { dev: false, touch: row.touch });
            row.seatedAnswer = { ms: next.ms, beforeRevision: next.beforeRevision, afterRevision: next.afterRevision };
            row.seatedAfterAnswer = await capture(page, row, 'east-seated-next-answer'); assertFrame(row.seatedAfterAnswer, 'seated next answer');
            assert.equal(row.seatedAfterAnswer.camera, row.seatedEntry.camera, 'Seated camera remains fixed after answering');
            assert.deepEqual(row.seatedAfterAnswer.stageBox, row.seatedEntry.stageBox, 'Answering preserves stage/answer layout');
            row.trace = await page.evaluate(() => { window.__sansuEastTrace.running = false; return window.__sansuEastTrace.frames; });
            const crossing = row.trace.flatMap(frame => frame.residents.filter(resident => resident.itemId === itemId && resident.action === 'walk')
                .map(resident => ({ ...frame, resident })));
            assert(crossing.length >= 10, 'Observe the real trajectory, not just its destination');
            const bridge = crossing.filter(frame => frame.resident.position[0] > 4.4 && frame.resident.position[0] < 5.15);
            assert(bridge.length > 0, 'Actual resident crosses the bridge');
            for (const frame of bridge) {
                assert(Math.abs(frame.resident.position[2]) <= .095, 'Crossing remains on the bridge');
                assert(frame.resident.position[1] >= .18, 'Feet follow the bridge deck');
            }
            for (const [phase, frozen] of [['walking-learning', row.walkingEntry.camera], ['seated-learning', row.seatedEntry.camera]]) {
                const frames = row.trace.filter(frame => frame.phase === phase && frame.mode === 'learning');
                assert(frames.length > 0, `${phase}: recorded rendered frames`);
                for (const frame of frames) { assertFrame(frame, phase); assert.equal(frame.camera, frozen, `${phase}: no continuous chase`); }
            }
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS ${row.name}: two real sections, legal east swing, ${crossing.length} walking samples, ${bridge.length} bridge samples; visual review required`);
        } catch (error) {
            row.failure = String(error?.stack || error);
            await page.screenshot({ path: `${output}/${row.name}-failure.png`, animations: 'disabled' }).catch(() => undefined);
            row.failureTrace = await page.evaluate(() => {
                if (!window.__sansuEastTrace) return [];
                window.__sansuEastTrace.running = false; return window.__sansuEastTrace.frames;
            }).catch(() => undefined);
            row.failureScene = await scene(page).catch(() => undefined);
            throw error;
        } finally { await context.close(); }
    }
    report.pass = report.scenarios.length === 2 && report.scenarios.every(row => row.pass);
} catch (error) {
    report.error = String(error?.stack || error); report.pass = false; process.exitCode = 1;
} finally {
    if (report.sourceStart) {
        try {
            report.sourceEnd = await sourceSnapshot();
            assert.deepEqual(report.sourceEnd.mismatches, [], 'Every build input remains fixed at completion, including after a failure');
            assert.equal(report.sourceEnd.buildSourceManifestSha256, report.sourceStart.buildSourceManifestSha256, 'The build-source manifest stays fixed');
            assert.equal(report.sourceEnd.closureHash, report.sourceStart.closureHash, 'All app inputs and the imported QA closure stay fixed');
        } catch (error) {
            report.sourceFailure = String(error?.stack || error); report.pass = false; process.exitCode = 1;
        }
    }
    try {
        await browser?.close(); report.browserClosed = true;
    } catch (error) {
        report.browserCloseFailure = String(error?.stack || error); report.pass = false; process.exitCode = 1;
    }
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ pass: report.pass, browserClosed: report.browserClosed, report: `${output}/report.json`,
        scenarios: report.scenarios.map(row => ({ name: row.name, pass: row.pass, failure: row.failure })) }, null, 2));
}
