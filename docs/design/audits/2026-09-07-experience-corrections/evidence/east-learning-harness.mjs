import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { activate, answerUI, assertKeypad, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady }
    from '/tmp/sansu-84d3ddf-experience-3535575a1ce3-inputs/tools/island-e2e-helpers.mjs';

const require = createRequire('/tmp/sansu-84d3ddf-experience-3535575a1ce3-inputs/package.json');
const { chromium } = require('playwright');
const target = 'http://127.0.0.1:5399';
const output = '/Users/yutogasaki/Projects/sansu/output/playwright/84d3ddf-experience-3535575a1ce3/east-learning';
const expected = {
    revision: '84d3ddf-experience-3535575a1ce3',
    version: '84d3ddf-experience-3535575a1ce3:7dc2ff9e-dc44-4734-a2b8-bdc9f4b1e995',
    delivery: 'mystic-island-v1', candidate: 'mystic-island-procedural-v2',
    learningCandidate: 'mystic-island-learning-v2', artDirection: 'moon-garden',
};
const report = { target, expected, startedAt: new Date().toISOString(), captures: [], scenarios: [], pass: false,
    scope: 'Fresh native profile only; two sections answered in the actual production UI; second earned swing moved to the east through UI arrows. Capture return to learning during its real route, then re-enter learning after seating. No island, plan, reward, resident, or path injection. Geometry/camera evidence is separate from visual judgment and child observation.',
    fixture: '/tmp/sansu-84d3ddf-experience-3535575a1ce3-inputs/tools/island-e2e-helpers.mjs:seedNative',
    answerOracle: 'Same helper answerUI(dev:false), using correctAnswer from each actual persisted reserved problem.' };

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
    while (state.plan) {
        assert(++attempts <= 30, 'Native learning section must terminate');
        const slot = state.plan.slots[state.plan.cursor];
        const answer = await answerUI(page, state.plan, { dev: false, touch: row.touch });
        row.answers.push({ section: sequence, planId: state.plan.id, cursor: state.plan.cursor,
            problemId: slot.problem.id, inputType: answer.inputType, ms: answer.ms,
            beforeRevision: answer.beforeRevision, afterRevision: answer.afterRevision });
        state = answer.state;
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
const browser = await chromium.launch();
try {
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
            assert.equal(manifest.version, expected.version); assert.equal(manifest.revision, expected.revision);
            assert.equal(manifest.island.enabled, true);
            for (const key of ['delivery', 'candidate', 'learningCandidate', 'artDirection']) assert.equal(manifest.island[key], expected[key]);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const id = await seedNative(page, `east-learning-${layout.name}`); row.profileId = id;
            await page.goto(`${target}/#/island`); await waitReady(page); await waitMode(page, 'home'); await identity(page);
            let state = await readNative(page, id);
            assert.equal(state.island.completedSets, 0); assert.equal(state.logs.length, 0); assert.equal(state.island.items.length, 2);
            await capture(page, row, 'fresh-home');

            await activate(button(page, 'ひかりを とどける'), row.touch); await learningReady(page); await assertKeypad(page);
            state = await finishSection(page, id, row, 1);
            await capture(page, row, 'first-earned-reward');
            await activate(button(page, 'ベンチ'), row.touch); await waitMode(page, 'placement');
            await activate(button(page, 'いまは しまっておく'), row.touch); await waitMode(page, 'home');
            state = await readNative(page, id);
            assert(state.island.items.some(item => item.kind === 'bench' && !item.position));
            await activate(button(page, 'ひかりを とどける'), row.touch); await learningReady(page);
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
            await activate(button(page, 'ひかりを とどける'), row.touch); await learningReady(page);
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
            await activate(button(page, 'つづきから とく'), row.touch); await learningReady(page); await assertKeypad(page);
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
            await page.evaluate(() => { if (window.__sansuEastTrace) window.__sansuEastTrace.running = false; }).catch(() => undefined);
            row.failureScene = await scene(page).catch(() => undefined);
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
