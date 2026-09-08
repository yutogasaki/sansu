import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { activate, button, percentile, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, assertFieldNavigation, assertHissanPartialInput, assertInputFidelity, assertProblemMeaning, assertReaction, assertSameControlPositions,
    attempt, LEARNING_CANDIDATE, sceneState, typeDuringCue, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const production = Boolean(process.env.SANSU_ISLAND_PRODUCTION_URL);
const base = process.env.SANSU_ISLAND_PRODUCTION_URL || process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_ISLAND_LEARNING_OUTPUT || 'output/playwright/island-learning';
const filter = process.env.SANSU_ISLAND_LEARNING_SCENARIO;
const scenarios = [
    { name: 'phone-number', width: 390, height: 844, skill: 'add_1d_1', type: 'number', full: true, inputFidelity: true },
    { name: 'tablet-number', width: 768, height: 1024, skill: 'add_1d_1', type: 'number', keyboardDouble: true },
    { name: 'phone-worked-support', width: 390, height: 844, skill: 'add_1d_2', mathAnswerCount: 21, type: 'number', workedExample: true, touch: true },
    { name: 'tablet-worked-support', width: 768, height: 1024, skill: 'add_1d_2', mathAnswerCount: 21, type: 'number', workedExample: true },
    { name: 'phone-count-touch', width: 390, height: 844, skill: 'count_10', type: 'number', touch: true },
    { name: 'tablet-count', width: 768, height: 1024, skill: 'count_10', type: 'number', productionOnly: true },
    { name: 'tablet-addition-art', width: 768, height: 1024, skill: 'add_finger', type: 'number' },
    { name: 'phone-subtraction-art', width: 390, height: 844, skill: 'sub_tiny', type: 'number', touch: true },
    { name: 'phone-base10-subtraction', width: 390, height: 844, skill: 'sub_2d1d_nc_bridge', type: 'number', visual: 'operation-base10', touch: true },
    { name: 'phone-shape-choice', width: 390, height: 844, skill: 'count_shape', type: 'choice', touch: true },
    { name: 'phone-pattern-choice', width: 390, height: 844, skill: 'pattern_copy', type: 'choice', touch: true },
    { name: 'tablet-comparison', width: 768, height: 1024, skill: 'compare_2d', type: 'choice' },
    { name: 'phone-fraction', width: 390, height: 844, skill: 'frac_add_same', type: 'multi-number' },
    { name: 'tablet-fraction', width: 768, height: 1024, skill: 'frac_add_same', type: 'multi-number', productionOnly: true },
    { name: 'tablet-decimal', width: 768, height: 1024, skill: 'dec_add', type: 'number', touch: true },
    { name: 'phone-decimal', width: 390, height: 844, skill: 'dec_add', type: 'number', touch: true, productionOnly: true },
    { name: 'tablet-hissan', width: 768, height: 1024, skill: 'add_2d1d_hissan_c', type: 'hissan' },
    { name: 'phone-hissan', width: 390, height: 844, skill: 'add_2d1d_hissan_c', type: 'hissan', productionOnly: true },
    { name: 'phone-vocabulary', width: 390, height: 844, skill: '', subject: 'vocab', type: 'choice', touch: true },
    { name: 'tablet-vocabulary', width: 768, height: 1024, skill: '', subject: 'vocab', type: 'choice', productionOnly: true },
    { name: 'tablet-reduced', width: 768, height: 1024, skill: 'add_1d_1', type: 'number', reduced: true },
    { name: 'phone-fallback', width: 390, height: 844, skill: 'add_1d_1', type: 'number', fallback: true },
    { name: 'phone-short-fallback', width: 390, height: 700, skill: 'add_2d1d_hissan_c', type: 'hissan', shortRecovery: true },
].filter(scenario => (!scenario.productionOnly || production || filter) && (!filter || scenario.name === filter));
assert(scenarios.length, 'Scenario filter must match a focused learning scenario');
await fs.mkdir(out, { recursive: true });
const sourcePaths = ['src/pages/Island.tsx', 'src/components/island/IslandLearningPanel.tsx', 'src/components/island/IslandLearningPanel.css',
    'src/components/island/IslandAnswerForm.tsx', 'src/components/island/IslandAnswerForm.css', 'src/components/island/IslandProblemPrompt.tsx',
    'src/components/island/IslandGlyph.tsx', 'src/components/island/islandGlyphs.ts', 'src/components/island/Island.css',
    'src/components/domain/LearningAnswerForm.tsx', 'src/components/domain/MathProblemPrompt.tsx', 'src/components/domain/TenKey.tsx',
    'src/components/island/IslandLearningSupport.tsx', 'src/components/island/learningGuidance.ts',
    'src/components/island/IslandStage.tsx', 'src/components/island/IslandStage.css', 'src/components/island/three/runtime.ts',
    'src/components/island/three/learningReaction.ts', 'src/components/island/learningFeedback.ts',
    'src/domain/math/hissanEngine.ts', 'src/domain/math/curriculum.ts', 'src/domain/user/profile.ts', 'src/domain/english/words.ts',
    'src/domain/island/types.ts', 'src/domain/island/learningSupport.ts', 'src/domain/island/commit.ts',
    'src/domain/island/repository.ts', 'src/domain/island/learningChecks.ts', 'src/domain/island/learningSession.ts',
    'tools/e2e-island-learning.mjs', 'tools/island-learning-fixtures.mjs', 'tools/island-learning-checks.mjs'];
const sourceSnapshot = async () => Promise.all(sourcePaths.map(async path => ({ path, sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') })));
const report = { target: base, startedAt: new Date().toISOString(), candidate: LEARNING_CANDIDATE,
    flag: 'VITE_ISLAND_ENABLED=true', production, fixtureModuleHash, sourceStart: await sourceSnapshot(), scenarios: [], captures: [], pass: false,
    evidenceScope: 'Native isolated profile/memory setup; actual normal planner and atomic writer, with no saved-plan replacement or browser DEV imports. Pure Hissan expected values execute in Node only. Layout, semantic content and keyboard/touch/reaction checks are independent of the fixed-ten throughput comparison.' };
const browser = await chromium.launch();

async function capture(page, name, state, allowScroll = false) {
    const file = `${name}.png`;
    const metadata = await runtimeMetadata(page);
    const learningCandidate = await page.locator('.island-page').getAttribute('data-learning-candidate');
    assert.equal(learningCandidate, LEARNING_CANDIDATE);
    if (production) {
        assert.equal(metadata.version, report.manifest.version);
        assert.equal(metadata.revision, report.manifest.revision);
        assert.equal(metadata.candidate, report.manifest.island.candidate);
        assert.equal(metadata.delivery, report.manifest.island.delivery);
        assert.equal(learningCandidate, report.manifest.island.learningCandidate);
    }
    const buffer = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage: allowScroll });
    report.captures.push({ file, sha256: createHash('sha256').update(buffer).digest('hex'), ...metadata, learningCandidate,
        scene: await sceneState(page), planId: state?.plan?.id, cursor: state?.plan?.cursor,
        completedSets: state?.island?.completedSets, fullPage: allowScroll });
    console.log(`CAPTURE ${out}/${file}`);
}

async function openSupport(page, before, touch, skipped = false) {
    const plan = before.plan;
    await activate(button(page, skipped ? 'わからない' : 'ヒントを みる'), touch);
    await waitLearningReady(page, { ...plan, revision: plan.revision + 1 });
    const after = await readNative(page, plan.profileId);
    assert.equal(after.plan.revision, plan.revision + 1);
    assert.equal(after.plan.cursor, plan.cursor);
    assert(after.plan.slots[plan.cursor].assisted);
    assert.equal(after.plan.slots[plan.cursor].supportStage, 'hint');
    assert.equal(await page.locator('.island-answer-stage').getAttribute('data-support-stage'), 'hint');
    assert.equal(await page.locator('.island-support-example, .island-support-answer, .island-support-model').count(), 0,
        'A first hint does not expose the answer or full worked model');
    assert.deepEqual(after.plan.slots.map(slot => slot.problem), plan.slots.map(slot => slot.problem));
    if (!skipped) assert.deepEqual(after.logs, before.logs, 'Opening support does not fabricate a learning answer');
    const receipts = after.islandEvents.filter(event => !before.islandEvents.some(previous => previous.id === event.id));
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].type, skipped ? 'skipped' : 'support_opened');
    if (skipped) {
        const logs = after.logs.filter(log => !before.logs.some(previous => previous.id === log.id));
        assert.equal(logs.length, 1);
        assert.equal(logs[0].result, 'skipped');
        assert.equal(receipts[0].learningLogId, logs[0].id);
    }
    return { after, receipt: receipts[0] };
}

try {
    for (const scenario of scenarios) {
        const recording = scenario.full && (production || process.env.SANSU_ISLAND_LEARNING_VIDEO === '1');
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: Boolean(scenario.touch), reducedMotion: scenario.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block',
            ...(recording ? { recordVideo: { dir: `${out}/video`, size: { width: scenario.width, height: scenario.height } } } : {}) });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.stack));
        const row = { ...scenario, samples: [], semantics: [], reactions: [], controls: [], pass: false };
        report.scenarios.push(row);
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            if (production) {
                const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
                assert.equal(manifest.island.enabled, true);
                assert.equal(manifest.island.learningCandidate, LEARNING_CANDIDATE);
                assert(!manifest.revision.includes('development'));
                if (report.manifest) assert.deepEqual(manifest, report.manifest, 'All final captures use one immutable production build');
                else report.manifest = manifest;
            }
            const profileId = await seedLearningProfile(page, scenario);
            await page.goto(`${base}/#/island`);
            await waitReady(page);
            await activate(page.locator('.island-start'), scenario.touch);
            await waitMode(page, 'learning');
            let state = await readNative(page, profileId);
            await waitLearningReady(page, state.plan);
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            if (scenario.skill) assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill);
            if (scenario.visual) assert.equal(state.plan.slots[0].problem.questionVisual?.kind, scenario.visual);
            assert.equal(state.island.completedSets, 0);
            assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', profileId, 0]));
            assert.equal(state.plan.slots.length, 3, 'Every new island begins with three real planner problems, including familiar numeric and vocabulary profiles');
            row.reservedWorkload = state.plan.slots.length;
            assert.equal(state.logs.length, 0);
            await page.waitForFunction(id => document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-section-id') === id, state.plan.id);
            const initialScene = await sceneState(page);
            assert.equal(initialScene.reactionId, '', 'Opening a reserved section does not replay a success');
            assert.equal(initialScene.completed, 0);
            assert.equal(initialScene.total, state.plan.slots.length);
            if (scenario.shortRecovery) {
                const stage = await page.locator('.island-stage').boundingBox();
                assert.equal(stage.height, 115, 'Short-screen recovery exercises the actual 115px learning scene');
                const lost = await page.locator('[data-renderer="three"] canvas').evaluate(canvas => {
                    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
                    extension?.loseContext();
                    return Boolean(extension);
                });
                assert(lost);
                const retry = button(page, 'もういちど みる');
                await retry.waitFor();
                row.retryGeometry = await retry.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        inViewport: rect.top >= 0 && rect.bottom <= innerHeight, hit: hit === element || element.contains(hit) };
                });
                assert(row.retryGeometry.inViewport && row.retryGeometry.hit && row.retryGeometry.height >= 44,
                    '115px fallback visibly exposes a real operable retry target');
                await capture(page, `${scenario.name}-lost-context`, state);
                await retry.click();
                await waitReady(page);
                await waitLearningReady(page, state.plan);
                assert.deepEqual((await readNative(page, profileId)).plan, state.plan);
                row.controls.push({ state: 'recovered', controls: await assertControls(page, { allowScroll: true }) });
                const result = await attempt(page, state);
                row.samples.push(result.sample);
                assert.equal(result.saved.cursor, 1, 'The actual answer form works after short-screen renderer recovery');
                await capture(page, `${scenario.name}-recovered-answer`, result.after);
                assert.deepEqual(pageErrors, []);
                row.runtime = await runtimeMetadata(page);
                row.pass = true;
                console.log(`PASS ${scenario.name}: 115px fallback retry and actual recovered answer`);
                continue;
            }
            row.semantics.push(await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]));
            row.controls.push({ state: 'ready', controls: await assertControls(page) });
            await capture(page, `${scenario.name}-ready`, state);
            if (scenario.inputFidelity) { await assertInputFidelity(page, state); row.inputFidelity = true; }
            if (scenario.type === 'multi-number') { await assertFieldNavigation(page, state); row.fieldNavigation = true; }
            if (scenario.type === 'hissan') row.hissanInputBoundary = await assertHissanPartialInput(page, state);

            // Every primary input type is retried in place, with no keypad or choice movement.
            const beforeWrong = row.controls[0].controls;
            let result = await attempt(page, state, { wrong: true, touch: scenario.touch });
            row.samples.push(result.sample);
            state = result.after;
            row.reactions.push(await assertReaction(page, result.receipt, 'retry', result.saved.cursor, { reduced: scenario.reduced }));
            assert.equal((await sceneState(page)).cameraFrame, initialScene.cameraFrame, 'Retry does not resize or move the learning camera');
            assert.equal(await page.locator('[data-island-plan-id]').getAttribute('data-learning-feedback'), 'retry');
            const afterWrong = await assertControls(page);
            assertSameControlPositions(beforeWrong, afterWrong);
            row.controls.push({ state: 'retry', controls: afterWrong });
            row.semantics.push(await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]));
            await capture(page, `${scenario.name}-retry`, state);

            {
                const allowSupportScroll = ['hissan', 'multi-number'].includes(scenario.type);
                const support = await openSupport(page, state, scenario.touch);
                state = support.after;
                if (scenario.workedExample) {
                    // Keep the real planner's reservation; a past PRNG sample is not the contract.
                    const problem = state.plan.slots[0].problem;
                    const operands = problem.questionText.match(/^(\d+) \+ (\d+) =$/);
                    assert(operands, 'This scenario reserves ordinary addition');
                    const a = Number(operands[1]), b = Number(operands[2]);
                    assert.equal(String(a + b), problem.correctAnswer);
                    const hint = await page.locator('.island-learning-support').innerText();
                    const method = a % 10 + b > 10 ? `${b}を ${10 - a % 10}と ${b - (10 - a % 10)}に わけて`
                        : `${a}から ${b}こ すすんで`;
                    assert(hint.includes(method), 'The hint must explain the actual reserved operands');
                    assert.equal(await page.locator('.island-support-example').count(), 0);
                }
                row.reactions.push(await assertReaction(page, support.receipt, 'support', state.plan.cursor, { reduced: scenario.reduced }));
                assert.equal((await sceneState(page)).cameraFrame, initialScene.cameraFrame, 'Opening support keeps the same learning camera');
                row.controls.push({ state: 'support', controls: await assertControls(page, { allowScroll: allowSupportScroll }) });
                await capture(page, `${scenario.name}-support`, state, allowSupportScroll);
                const saved = structuredClone(state.plan);
                await page.reload();
                await waitReady(page);
                state = await readNative(page, profileId);
                await waitLearningReady(page, state.plan);
                assert.deepEqual(state.plan, saved, 'Support and reserved work survive reload');
                assert.equal(state.plan.slots[state.plan.cursor].supportStage, 'hint');
                await page.locator('.park-support strong').waitFor();
                await page.waitForFunction(id => document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-section-id') === id, saved.id);
                assert.equal((await sceneState(page)).reactionId, '', 'Reload initializes saved progress without a fabricated success');
                row.controls.push({ state: 'support-resumed', controls: await assertControls(page, { allowScroll: allowSupportScroll }) });
                await capture(page, `${scenario.name}-support-resumed`, state, allowSupportScroll);
            }

            const initialCursor = state.plan.cursor;
            const assistedSkill = state.plan.slots[initialCursor].problem.categoryId;
            const independentCorrectBefore = state.logs.filter(log => log.itemId === assistedSkill && log.result === 'correct').length;
            let attempts = 0;
            do {
                const beforeScene = await sceneState(page);
                const before = state;
                result = await attempt(page, state, { touch: scenario.touch, double: scenario.full && attempts === 0,
                    keyboardDouble: scenario.keyboardDouble && attempts === 0,
                    onOperable: scenario.full && !scenario.reduced ? async receipt => {
                        row.nextInputDuringCue = await typeDuringCue(page, receipt);
                    } : undefined,
                    onCorrectContact: !scenario.reduced ? async (receipt, frame) => {
                        assert.equal(frame.completed, before.plan.cursor + 1);
                        const expectedState = { ...before, plan: { ...before.plan, cursor: before.plan.cursor + 1 } };
                        await capture(page, `${scenario.name}-correct-contact`, expectedState);
                        const captured = report.captures[report.captures.length - 1];
                        assert.equal(captured.scene.reactionId, receipt.id);
                        assert.equal(captured.scene.phase, 'contact', 'The contact screenshot finishes inside the real reply phase');
                        assert.equal(captured.scene.residentReaction, 'delight');
                        row.contactFrames ??= [];
                        row.contactFrames.push({ receiptId: receipt.id, ...frame });
                    } : undefined });
                row.samples.push(result.sample);
                state = result.after;
                if (!result.sample.completed) {
                    assert.equal(scenario.type, 'hissan');
                    assert.equal(result.saved.cursor, before.plan.cursor);
                    assert.equal((await sceneState(page)).reactionId, beforeScene.reactionId, 'A correct Hissan row creates no new completion reaction');
                    assert.equal((await sceneState(page)).completed, beforeScene.completed, 'A Hissan row lights no completed-problem seed');
                    assert.equal(await page.locator('[data-island-plan-id]').getAttribute('data-learning-feedback'), 'step');
                    assert.equal(state.logs.length, before.logs.length, 'Partial Hissan work is not independently mastered');
                    row.hissanPartialRows = (row.hissanPartialRows ?? 0) + 1;
                } else {
                    row.reactions.push(await assertReaction(page, result.receipt, 'correct', result.saved.cursor, { reduced: scenario.reduced }));
                    if (!scenario.reduced) {
                        assert.equal(result.contactFrame.reactionId, result.receipt.id, 'Observed contact belongs to the committed receipt');
                        row.reactionFrames ??= [];
                        row.reactionFrames.push(...result.reactionFrames);
                    } else await capture(page, `${scenario.name}-correct-contact`, state);
                    row.controls.push({ state: 'correct-next-input', controls: await assertControls(page) });
                    row.semantics.push(await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]));
                    await capture(page, `${scenario.name}-correct-next-input`, state);
                }
                assert(++attempts < 12, 'The current real problem must finish in bounded Hissan steps');
            } while (state.plan.cursor === initialCursor);
            assert.equal(state.logs.filter(log => log.itemId === assistedSkill && log.result === 'correct').length, independentCorrectBefore,
                'Assisted completion never manufactures independent mastery');
            const memory = scenario.subject === 'vocab' ? state.memoryVocab : state.memoryMath;
            assert(memory.find(item => item.id === assistedSkill).nextReview <= new Date().toISOString(), 'Independent Due remains due after support');
            if (scenario.full) {
                const skipped = await openSupport(page, state, false, true);
                state = skipped.after;
                row.reactions.push(await assertReaction(page, skipped.receipt, 'support', state.plan.cursor));
                row.controls.push({ state: 'skipped-to-support', controls: await assertControls(page) });
                await capture(page, `${scenario.name}-skipped-to-support`, state);
                let count = 0;
                const introductoryPlanId = state.plan.id;
                while (state.plan?.id === introductoryPlanId) {
                    assert(++count < 30, 'The actual learning section must finish');
                    row.semantics.push(await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]));
                    row.controls.push({ state: `ordinary-${state.plan.cursor}`, controls: await assertControls(page) });
                    result = await attempt(page, state);
                    row.samples.push(result.sample);
                    state = result.after;
                }
                await waitMode(page, 'learning');
                assert.equal(state.island.completedSets, 1);
                assert.equal(state.island.pendingRewards.length, 0, 'New growth reservations never require gift acceptance');
                assert.notEqual(state.plan.id, introductoryPlanId, 'The next real reservation opens without a continuation tap');
                assert.equal(state.islandPlans.find(plan => plan.id === introductoryPlanId).status, 'completed');
                state = await readNative(page, profileId);
                await waitLearningReady(page, state.plan);
                assert.equal(state.island.pendingRewards.length, 0);
                row.controls.push({ state: 'next-section', controls: await assertControls(page) });
                await capture(page, `${scenario.name}-next-section`, state);
            }
            if (scenario.reduced) {
                const prior = await sceneState(page);
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const later = await sceneState(page);
                assert.equal(later.reduced, 'true');
                assert.notEqual(later.phase, 'travel');
                assert.equal(later.residentX, prior.residentX);
                assert.equal(later.residentZ, prior.residentZ);
                assert.equal(later.cameraFrame, initialScene.cameraFrame, 'Reduced feedback does not move or zoom the camera');
                row.reducedStatic = true;
            }
            if (scenario.fallback) {
                const lost = await page.locator('[data-renderer="three"] canvas').evaluate(canvas => {
                    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
                    extension?.loseContext();
                    return Boolean(extension);
                });
                assert(lost, 'Browser supports real context loss');
                await button(page, 'もういちど みる').waitFor();
                row.fallbackRetry = await button(page, 'もういちど みる').evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        inViewport: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
                        hit: hit === element || element.contains(hit) };
                });
                assert(row.fallbackRetry.inViewport && row.fallbackRetry.hit && row.fallbackRetry.height >= 44,
                    `Renderer recovery remains visible and operable: ${JSON.stringify(row.fallbackRetry)}`);
                row.controls.push({ state: 'fallback', controls: await assertControls(page) });
                result = await attempt(page, state);
                row.samples.push(result.sample);
                state = result.after;
                assert.equal(result.saved.cursor, initialCursor + 2, 'Answering remains usable during renderer failure');
                await capture(page, `${scenario.name}-answer-in-fallback`, state);
                await button(page, 'もういちど みる').click();
                await waitReady(page);
                await waitLearningReady(page, state.plan);
                row.rendererRecovered = true;
                await capture(page, `${scenario.name}-recovered`, state);
            }
            assert.deepEqual(pageErrors, []);
            const correct = row.samples.filter(sample => !sample.wrong && !sample.terminal && sample.completed).map(sample => sample.ms);
            const wrong = row.samples.filter(sample => sample.wrong).map(sample => sample.ms);
            row.metrics = { correctP95Ms: percentile(correct, .95), retryP95Ms: percentile(wrong, .95), correctSamples: correct.length, retrySamples: wrong.length,
                scope: 'Focused normal-planner diagnostics; formal fixed-ten measurements are a separate artifact.' };
            if (correct.length) assert(row.metrics.correctP95Ms <= 650);
            assert(row.metrics.retryP95Ms <= 550);
            row.runtime = await runtimeMetadata(page);
            row.pass = true;
            console.log(`PASS ${scenario.name}: content, input, saved feedback and ${JSON.stringify(row.metrics)}`);
        } catch (error) {
            row.error = error.stack;
            row.pageErrors = pageErrors;
            row.failureState = await readNative(page, await page.evaluate(() => localStorage.getItem('sansu_active_profile'))).catch(() => undefined);
            row.failureGeometry = await page.locator('.island-learning, .island-problem-prompt, .park-keypad, .park-keypad button, .island-learning-actions').evaluateAll(elements => elements.map(element => {
                const rect = element.getBoundingClientRect();
                return { selector: element.className, text: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 30),
                    x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
            })).catch(() => undefined);
            await page.screenshot({ path: `${out}/${scenario.name}-failure-viewport.png` }).catch(() => undefined);
            await page.screenshot({ path: `${out}/${scenario.name}-failure.png`, fullPage: true }).catch(() => undefined);
            throw error;
        } finally {
            await context.close();
            if (recording) {
                const file = `${scenario.name}-actual-learning.webm`;
                await page.video().saveAs(`${out}/${file}`);
                row.video = { file, sha256: createHash('sha256').update(await fs.readFile(`${out}/${file}`)).digest('hex'),
                    version: report.manifest?.version ?? row.runtime?.version, learningCandidate: LEARNING_CANDIDATE };
            }
        }
    }
    report.acceptanceMatrix = [
        ['count', 'phone-count-touch', 'tablet-count'], ['number', 'phone-number', 'tablet-number'],
        ['choice', 'phone-shape-choice', 'tablet-comparison'], ['fraction', 'phone-fraction', 'tablet-fraction'],
        ['hissan', 'phone-hissan', 'tablet-hissan'], ['vocab', 'phone-vocabulary', 'tablet-vocabulary'],
    ].map(([format, phone, tablet]) => ({ format, phone: report.scenarios.find(row => row.name === phone)?.pass ?? false,
        tablet: report.scenarios.find(row => row.name === tablet)?.pass ?? false }));
    if (production && !filter) assert(report.acceptanceMatrix.every(row => row.phone && row.tablet), 'Final production matrix covers all six input forms at both viewports');
    report.pass = true;
} finally {
    report.sourceEnd = await sourceSnapshot();
    report.sourceStable = JSON.stringify(report.sourceStart) === JSON.stringify(report.sourceEnd);
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
