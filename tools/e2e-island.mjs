import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { activate, answerUI, assertKeypad, button, percentile, readNative, runtimeMetadata, seedDev, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { verifyIslandProgression } from './island-e2e-progression.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', startedAt: new Date().toISOString(), growthCoveredSeparately: process.env.SANSU_ISLAND_SKIP_GROWTH === '1', scenarios: [], captures: [], pass: false };
const capture = async (page, name) => {
    // Home/district resizing is animated outside CSS; let the real camera settle.
    await page.waitForTimeout(850);
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    report.captures.push({ file: `${name}.png`, ...(await runtimeMetadata(page)) });
};

async function finishSet(page, profileId, samples, touch) {
    let count = 0;
    let state = await readNative(page, profileId);
    const planId = state.plan.id, completedSets = state.island.completedSets;
    while (state.plan?.id === planId) {
        assert(++count < 70, 'Learning section must terminate');
        const { state: next, ...sample } = await answerUI(page, state.plan, { touch });
        samples.push(sample);
        state = next;
    }
    assert.equal(state.islandPlans.find(plan => plan.id === planId)?.status, 'completed');
    assert.equal(state.island.completedSets, completedSets + 1);
    assert(state.plan, 'Every newly reserved section continues automatically, including the first');
    assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', profileId, completedSets + 1]));
    assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
    await waitMode(page, 'learning');
    assert.equal(state.island.pendingRewards.length, 0, 'Growth never requires gift collection');
    return state;
}

async function verifyOwnedLoop(page, profileId, state, samples, touch, prefix) {
    const firstCompleted = state.island.completedSets;
    const reserved = state.plan;
    await activate(button(page, 'しまへ'), touch); await waitMode(page, 'home');
    await page.reload(); await waitReady(page); await waitMode(page, 'learning');
    state = await readNative(page, profileId);
    assert.deepEqual(state.plan, reserved, 'Reload preserves the automatically reserved section');
    state = await finishSet(page, profileId, samples, touch);
    assert.equal(state.island.completedSets, firstCompleted + 1);
    assert.equal(state.island.growth.expansionLevel, 0);
    assert.equal(state.island.items.length, 3);
    await activate(button(page, 'しまへ'), touch); await waitMode(page, 'home');
    await page.locator('[data-renderer="three"][data-expanded="false"]').waitFor();
    await capture(page, `${prefix}-second-section-growing`);
    const bench = state.island.items.find(item => item.id === 'living-bench');
    assert(bench?.position, 'A usable bench is placed automatically');
    await activate(button(page, 'もちもの'), touch); await waitMode(page, 'inventory');
    await capture(page, `${prefix}-inventory`);
    await activate(page.getByRole('button', { name: /^ベンチ \d+を うごかす$/ }), touch);
    await waitMode(page, 'placement');
    await activate(button(page, 'はじめの すがた'), touch);
    await page.locator('.island-appearance button[aria-pressed="true"]').filter({ hasText: 'はじめの すがた' }).waitFor();
    await capture(page, `${prefix}-previous-appearance`);
    await activate(button(page, 'まわす'), touch);
    await activate(button(page, 'みぎへ'), touch);
    assert(await button(page, 'ここに おく').isEnabled());
    await activate(button(page, 'ここに おく'), touch); await waitMode(page, 'home');
    state = await readNative(page, profileId);
    const moved = state.island.items.find(item => item.id === bench.id);
    assert.deepEqual(moved.position, { x: bench.position.x + .25, z: bench.position.z });
    assert.equal(moved.rotation, bench.rotation + Math.PI / 2);
    assert.equal(moved.appearanceLevel, 0); assert.equal(moved.growthLevel, bench.growthLevel);
    await page.reload(); await waitReady(page); await waitMode(page, 'learning');
    assert.deepEqual((await readNative(page, profileId)).island.items.find(item => item.id === bench.id), moved);
    await activate(button(page, 'しまへ'), touch); await waitMode(page, 'home');
    await activate(button(page, 'もちもの'), touch);
    await activate(page.getByRole('button', { name: /^ベンチ \d+を うごかす$/ }), touch);
    await waitMode(page, 'placement');
    await activate(button(page, 'いまは しまっておく'), touch); await waitMode(page, 'home');
    await activate(page.locator('.island-start'), touch); await waitMode(page, 'learning');
    state = await finishSet(page, profileId, samples, touch);
    for (let extra = 0; state.island.items.find(item => item.id === bench.id).growthLevel < 2; extra++) {
        assert(extra < 6, 'Normal answers reach the second appearance');
        state = await finishSet(page, profileId, samples, touch);
    }
    const stored = state.island.items.find(item => item.id === bench.id);
    assert.equal(stored.position, undefined, 'A further upgrade honors deliberate storage');
    assert.equal(stored.appearanceLevel, 0, 'A further upgrade honors the chosen appearance');
    assert.equal(stored.growthLevel, 2, 'Storage and appearance do not discard earned growth');
    await page.reload(); await waitReady(page);
    state = await readNative(page, profileId);
    const previousIsland = state.island;
    const otherId = await seedDev(page, { skill: 'count_10', name: 'みなと' });
    await page.reload(); await waitReady(page);
    const other = await readNative(page, otherId);
    assert.equal(other.island.completedSets, 0); assert.equal(other.island.items.length, 2); assert.equal(other.logs.length, 0);
    assert.deepEqual((await readNative(page, profileId)).island, previousIsland);
    await page.evaluate(async id => {
        const { setActiveProfileId } = await import('/src/domain/user/repository.ts');
        await setActiveProfileId(id);
    }, profileId);
    await page.reload(); await waitReady(page); await waitMode(page, 'learning');
    await capture(page, `${prefix}-next-learning`);
}

try {
    if (process.env.SANSU_ISLAND_SKIP_GROWTH !== '1' && (!process.env.SANSU_ISLAND_SCENARIO || process.env.SANSU_ISLAND_SCENARIO === 'east-and-growth')) {
        report.scenarios.push(await verifyIslandProgression(browser, base, capture));
    }
    if (!process.env.SANSU_ISLAND_SCENARIO || process.env.SANSU_ISLAND_SCENARIO === 'renderer-recovery') {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            const id = await seedDev(page);
            await page.goto(`${base}/#/island`);
            await waitReady(page);
            await page.locator('.island-start').click();
            await waitMode(page, 'learning');
            const before = await readNative(page, id);
            const lost = await page.locator('[data-renderer="three"] canvas').evaluate(canvas => {
                const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
                if (!extension) return false;
                extension.loseContext();
                return true;
            });
            assert(lost, 'Test browser must support actual WebGL context-loss simulation');
            // The learning layout intentionally hides the whole world, including
            // its recovery control. Context loss must never cover the answer UI.
            await page.locator('.island-stage__retry').waitFor({ state: 'attached' });
            await capture(page, 'renderer-context-loss-learning');
            const during = await answerUI(page, before.plan);
            assert.equal(during.state.plan.cursor, before.plan.cursor + 1, 'Fallback keeps learning operational');
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, 'もういちど みる').click();
            await waitReady(page);
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            assert.deepEqual((await readNative(page, id)).plan, during.state.plan, 'World recovery preserves the identical learning reservation');
            const recovered = await answerUI(page, during.state.plan);
            assert.equal(recovered.state.plan.cursor, during.state.plan.cursor + 1);
            await capture(page, 'renderer-recovered-learning');
            report.scenarios.push({ name: 'renderer-recovery', ...(await runtimeMetadata(page)), passed: true,
                evidenceScope: 'Actual WebGL context loss keeps learning usable while the world stays hidden; an answer persists during fallback, then visible home retry restores Three and the identical reservation accepts another answer.' });
            console.log('PASS actual WebGL loss, learning in fallback, Three retry and subsequent answer');
        } finally { await context.close(); }
    }
    if (!process.env.SANSU_ISLAND_SCENARIO || process.env.SANSU_ISLAND_SCENARIO === 'onboarding') {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            await waitReady(page);
            await capture(page, 'onboarding-cold-welcome');
            await button(page, 'まなぶ').click();
            await page.locator('[data-onboarding-step="grade"] input').fill('あおい');
            await button(page, '年中').click();
            await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await page.waitForURL('**/#/island');
            await waitReady(page);
            const initial = await readNative(page);
            assert.equal(initial.islands.length, 1);
            assert.equal(initial.logs.length, 0);
            assert.equal(initial.island.items.length, 2);
            const profileId = initial.island.profileId;
            const profile = await page.evaluate(async id => {
                const { db } = await import('/src/db/index.ts');
                return db.profiles.get(id);
            }, profileId);
            assert.equal(profile.name, 'あおい');
            assert.equal(profile.grade, -1);
            assert.equal(profile.subjectMode, 'math');
            await waitMode(page, 'learning');
            assert.equal(initial.plan.id, JSON.stringify(['island-plan-v1', profileId, 0]));
            assert.equal(initial.plan.slots.length, 3);
            assert.equal(initial.plan.cursor, 0); assert.equal(initial.plan.revision, 0);
            await capture(page, 'onboarding-first-learning');
            const state = await finishSet(page, profileId, [], false);
            assert.equal(state.island.pendingRewards.length, 0);
            await capture(page, 'onboarding-first-growth');
            report.scenarios.push({ name: 'onboarding', ...(await runtimeMetadata(page)), passed: true,
                evidenceScope: 'Actual profile-free Welcome, optional nickname in the grade screen, explicit preschool grade/math/range and first reserved section; no profile fixture injected. Dedicated production onboarding QA verifies play, storage boundaries, all subjects and retry.' });
            console.log('PASS normal Island signup and first automatic growth');
        } catch (error) {
            await page.screenshot({ path: `${out}/onboarding-failure.png`, animations: 'disabled' }).catch(() => undefined);
            throw error;
        } finally { await context.close(); }
    }
    const scenarios = [
        { name: 'phone-keyboard', width: 390, height: 844, skill: 'add_1d_1', type: 'number', full: true },
        { name: 'phone-touch', width: 390, height: 844, skill: 'add_1d_1', type: 'number', touch: true, full: true },
        { name: 'tablet-fraction', width: 768, height: 1024, skill: 'frac_add_same', type: 'multi-number', complex: true },
        { name: 'phone-hissan', width: 390, height: 844, skill: 'add_2d1d_hissan_c', type: 'hissan', complex: true },
        { name: 'phone-math-choice', width: 390, height: 844, skill: 'compare_2d', type: 'choice' },
        { name: 'tablet-vocabulary', width: 768, height: 1024, skill: '', subject: 'vocab', type: 'choice' },
        { name: 'tablet-reduced', width: 768, height: 1024, skill: 'add_1d_1', type: 'number', reduced: true },
        { name: 'phone-first-learning', width: 390, height: 844, skill: 'add_1d_1', type: 'number', familiar: false, complex: true },
    ].filter(scenario => !process.env.SANSU_ISLAND_SCENARIO || scenario.name === process.env.SANSU_ISLAND_SCENARIO);
    assert(scenarios.length > 0 || ['onboarding', 'renderer-recovery', 'east-and-growth'].includes(process.env.SANSU_ISLAND_SCENARIO), 'Scenario filter must match a scenario');
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: Boolean(scenario.touch), reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.stack));
        const samples = [];
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            await waitReady(page);
            await capture(page, `${scenario.name}-cold-welcome`);
            const profileId = await seedDev(page, { ...scenario, name: 'つむぎ' });
            await page.goto(`${base}/#/`);
            await waitReady(page);
            assert.equal(new URL(page.url()).hash, '#/island', 'Enabled root launch enters Island');
            assert.equal(await page.locator('[data-renderer="three"]').getAttribute('data-expanded'), 'false');
            assert.equal((await readNative(page, profileId)).logs.length, 0, 'Visiting Island must not count learning');
            await capture(page, `${scenario.name}-home`);
            await activate(page.locator('.island-start'), scenario.touch);
            await waitMode(page, 'learning');
            let state = await readNative(page, profileId);
            assert.equal(state.island.completedSets, 0);
            assert.equal(state.plan.slots.length, 3, 'A new island reserves three real introductory problems before answering');
            if (scenario.skill) assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill, 'The real planner respects Due');
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            await assertKeypad(page, !scenario.complex);
            await capture(page, `${scenario.name}-learning`);
            const wrong = await answerUI(page, state.plan, { incorrect: true, touch: scenario.touch });
            samples.push({ ...wrong, state: undefined });
            state = wrong.state;
            if (scenario.full) {
                const originalProblems = state.plan.slots.map(slot => slot.problem);
                const assistedSkill = state.plan.slots[0].problem.categoryId;
                const independentCorrectBefore = state.logs.filter(log => log.result === 'correct').length;
                await activate(button(page, 'ヒントを みる'), scenario.touch);
                await page.locator('.park-support strong').waitFor();
                await page.reload();
                await waitReady(page);
                await page.locator('.park-support strong').waitFor();
                state = await readNative(page, profileId);
                assert.deepEqual(state.plan.slots.map(slot => slot.problem), originalProblems);
                assert(state.plan.slots[0].assisted, 'Assistance remains sticky after reload');
                assert.equal(state.plan.slots[0].supportStage, 'hint');
                assert.equal(await page.locator('.island-support-model, .island-support-example, .island-support-answer').count(), 0,
                    'Hint retry keeps the answer concealed; explicit model completion has separate QA');
                await capture(page, `${scenario.name}-support-resumed`);
                const supported = await answerUI(page, state.plan, { touch: scenario.touch });
                samples.push({ ...supported, state: undefined });
                state = supported.state;
                assert.equal(state.logs.filter(log => log.result === 'correct').length, independentCorrectBefore, 'Assisted correct must not create mastery');
                assert(state.memoryMath.find(memory => memory.id === assistedSkill).nextReview <= new Date().toISOString());
                await activate(button(page, 'わからない'), scenario.touch);
                await page.locator('.park-support strong').waitFor();
                state = await readNative(page, profileId);
                assert(state.plan.slots[state.plan.cursor].assisted, 'Skip opens support without abandoning the slot');
                assert.equal(state.plan.slots[state.plan.cursor].supportStage, 'hint');
                assert.equal(state.logs.at(-1).result, 'skipped');
            }
            state = await finishSet(page, profileId, samples, scenario.touch);
            assert.equal(state.island.completedSets, 1);
            assert.equal(state.island.pendingRewards.length, 0);
            assert.equal(state.islandEvents.filter(event => event.type === 'plan_completed').length, 1);
            assert.equal(await page.locator('[data-renderer="three"]').getAttribute('data-expanded'), 'false');
            await capture(page, `${scenario.name}-first-growth`);
            if (scenario.full) await verifyOwnedLoop(page, profileId, state, samples, scenario.touch, scenario.name);
            const ordinaryCorrect = samples.filter(sample => !sample.incorrect && !sample.completed && sample.inputType === 'number').map(sample => sample.ms);
            const wrongTimes = samples.filter(sample => sample.incorrect).map(sample => sample.ms);
            const metrics = { correctP95Ms: percentile(ordinaryCorrect, .95), incorrectP95Ms: percentile(wrongTimes, .95),
                correctSamples: ordinaryCorrect.length, incorrectSamples: wrongTimes.length };
            if (metrics.correctP95Ms !== null) assert(metrics.correctP95Ms <= 650, `Correct-to-input P95 exceeded 650ms: ${metrics.correctP95Ms}`);
            assert(metrics.incorrectP95Ms <= 550, `Wrong-to-retry P95 exceeded 550ms: ${metrics.incorrectP95Ms}`);
            assert.deepEqual(errors, []);
            report.scenarios.push({ ...scenario, ...(await runtimeMetadata(page)), metrics, samples, passed: true,
                evidenceScope: 'Normal reserved planner and UI integration; latency samples are diagnostic, not the fixed-ten comparison.' });
            console.log(`PASS ${scenario.name}: ${JSON.stringify(metrics)}`);
        } catch (error) {
            await page.screenshot({ path: `${out}/${scenario.name}-failure.png`, animations: 'disabled' }).catch(() => undefined);
            report.scenarios.push({ ...scenario, passed: false, error: error.stack, pageErrors: errors });
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
