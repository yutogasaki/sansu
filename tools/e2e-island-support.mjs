import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { activate, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, attempt, LEARNING_CANDIDATE, waitLearningReady } from './island-learning-checks.mjs';
import { expectedLearningAnswer, fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';
import { assertModelKeyboardBlocked, assertModelSurface, assertSupportedIntegrity, assertWrittenSupportControls, enterSupportDraft,
    omitLegacySupportField, readSupportDraft, readSupportStores, supportAction } from './island-support-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL;
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
assert(base && buildSourcePath, 'Run against an immutable production URL with its build-source manifest');
const out = process.env.SANSU_ISLAND_SUPPORT_OUTPUT || 'output/playwright/island-support';
const filter = process.env.SANSU_ISLAND_SUPPORT_SCENARIO;
const scenarios = [
    { name: 'phone-number', width: 390, height: 844, skill: 'add_1d_2', mathAnswerCount: 21, type: 'number', touch: true, worked: true },
    { name: 'tablet-count', width: 768, height: 1024, skill: 'count_10', type: 'number' },
    { name: 'phone-fraction', width: 390, height: 844, skill: 'frac_add_same', type: 'multi-number', touch: true },
    { name: 'tablet-choice', width: 768, height: 1024, skill: 'count_shape', type: 'choice' },
    { name: 'phone-written-multiply', width: 390, height: 844, skill: 'mul_2d2d', type: 'hissan', touch: true, partial: true },
    { name: 'tablet-written-divide', width: 768, height: 1024, skill: 'div_3d1d_exact', type: 'hissan', partial: true },
    { name: 'phone-vocabulary', width: 390, height: 844, skill: '', subject: 'vocab', type: 'choice', touch: true },
    { name: 'tablet-reduced-skip', width: 768, height: 1024, skill: 'add_1d_1', type: 'number', reduced: true, skip: true },
    { name: 'phone-legacy-model', width: 390, height: 844, skill: 'add_1d_1', type: 'number', touch: true, legacy: true },
].filter(row => !filter || row.name === filter);
assert(scenarios.length, 'The support scenario filter must match a declared case');
const sha = value => createHash('sha256').update(value).digest('hex');
const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
const qaPaths = ['tools/e2e-island-support.mjs', 'tools/island-support-checks.mjs', 'tools/island-e2e-helpers.mjs',
    'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const sourceSnapshot = async () => {
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(`${out}/videos`, { recursive: true });
assert.equal(await fs.stat(`${out}/report.json`).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }),
    false, 'Use a new output directory so earlier support results/failures remain immutable');
const report = { target: base, startedAt: new Date().toISOString(), sourceStart: await sourceSnapshot(), fixtureModuleHash,
    flag: 'VITE_ISLAND_ENABLED=true', candidate: LEARNING_CANDIDATE,
    buildSource, diagnostic: Boolean(filter), scenarios: [], captures: [], pass: false, browserClosed: false, humanN: 0,
    scope: 'Native profile/memory fixtures and normal frozen 3/6-slot planner. All support, retry, model and completion events use trusted UI controls. No browser app imports, overridden questions, synthetic receipts, reward or progress injection. One separate labeled legacy case omits only optional supportStage after genuine UI model opening. This complements, and does not replace, the unchanged 23-scenario ordinary learning regression suite and formal fixed-ten timing.' };
report.buildSourceMismatches = buildSource.files.filter(file => report.sourceStart.files.find(row => row.path === file.path)?.sha256 !== file.sha256);
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
assert.deepEqual(report.buildSourceMismatches, [], 'QA local app sources must match the actual frozen production build');
const browser = await chromium.launch();

async function capture(page, name, state, fullPage = false) {
    const metadata = await runtimeMetadata(page), file = `${name}.png`;
    assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.revision, report.manifest.revision);
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, fullPage,
        planId: state.plan?.id, cursor: state.plan?.cursor, planRevision: state.plan?.revision,
        supportStage: await page.locator('.island-answer-stage').count() ? await page.locator('.island-answer-stage').getAttribute('data-support-stage') : null });
}

async function reloadSaved(page, state) {
    const before = await readSupportStores(page);
    await page.reload(); await waitReady(page); await waitLearningReady(page, state.plan);
    assert.deepEqual(await readSupportStores(page), before, 'Reload never creates support/answer receipts or changes the frozen reservation');
    return readNative(page, state.plan.profileId);
}

async function answerWrittenRow(page, before, touch, wrong = false) {
    const slot = before.plan.slots[before.plan.cursor], expected = expectedLearningAnswer(slot, 'hissan');
    await activate(button(page, 'こたえを けす'), touch);
    const values = wrong ? expected.values.map(value => value === '9' ? '8' : '9') : expected.values;
    for (const value of values) if (touch) await activate(button(page, value), true); else await page.keyboard.type(value);
    await activate(page.locator('[data-keypad-submit]'), touch);
    await page.waitForFunction(revision => Number(document.querySelector('[data-island-plan-revision]')?.getAttribute('data-island-plan-revision')) > revision
        || document.querySelector('.island-page')?.dataset.mode === 'reward', before.plan.revision);
    const after = await readNative(page, before.plan.profileId), saved = after.islandPlans.find(plan => plan.id === before.plan.id);
    if (after.plan) await waitLearningReady(page, after.plan);
    assert.equal(saved.revision, before.plan.revision + 1);
    assert.deepEqual(saved.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.equal(saved.cursor, before.plan.cursor + Number(!wrong && expected.final));
    const receipts = after.islandEvents.filter(event => !before.islandEvents.some(prior => prior.id === event.id) && event.type === 'answer');
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].result, slot.assisted ? wrong ? 'assisted-incorrect' : 'assisted-correct' : wrong ? 'incorrect' : 'correct');
    if (slot.assisted || (!expected.final && !wrong)) assert.deepEqual(after.logs, before.logs);
    else {
        const logs = after.logs.filter(log => !before.logs.some(previous => previous.id === log.id));
        assert.equal(logs.length, 1); assert.equal(logs[0].result, wrong ? 'incorrect' : 'correct');
        assert.equal(receipts[0].learningLogId, logs[0].id);
    }
    return { after, saved, receipt: receipts[0] };
}

try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: Boolean(scenario.touch), reducedMotion: scenario.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block',
            recordVideo: { dir: `${out}/videos`, size: { width: scenario.width, height: scenario.height } } });
        const page = await context.newPage(), row = { ...scenario, supportActions: [], pass: false }, errors = [];
        report.scenarios.push(row); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled); assert.equal(manifest.island.learningCandidate, LEARNING_CANDIDATE);
            assert.equal(manifest.revision, buildSource.revision);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const id = await seedLearningProfile(page, scenario);
            await page.goto(`${base}/#/island`); await waitReady(page);
            await activate(button(page, 'ひかりを とどける'), scenario.touch); await waitMode(page, 'learning');
            let state = await readNative(page, id); await waitLearningReady(page, state.plan);
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            if (scenario.skill) assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill);
            assert([3, 6].includes(state.plan.slots.length));
            row.planId = state.plan.id; row.reservedWorkload = state.plan.slots.length;
            row.readyControls = scenario.partial ? await assertWrittenSupportControls(page) : await assertControls(page);
            if (scenario.partial) {
                assert.equal(state.plan.slots[0].problem.hissanVersion, 2);
                assert(expectedLearningAnswer(state.plan.slots[0], 'hissan').totalSteps > 1);
                state = (await answerWrittenRow(page, state, scenario.touch)).after;
                assert.equal(state.plan.cursor, 0); assert.equal(state.plan.slots[0].hissanStep, 1);
                assert.equal(state.logs.length, 0, 'A real completed first row does not create independent mastery');
                row.savedPartialCells = structuredClone(state.plan.slots[0].hissanValues);
            }
            const draft = await enterSupportDraft(page, state, scenario.touch);
            await page.evaluate(() => { window.__islandSupportForm = document.querySelector('.park-answer'); });
            let result = await supportAction(page, state, scenario.skip ? 'わからない' : 'ヒントを みる', scenario.skip ? 'skipped' : 'support_opened', scenario.touch, { double: Boolean(scenario.skip) });
            state = result.after; row.supportActions.push(result.timing);
            assert(await page.evaluate(() => window.__islandSupportForm === document.querySelector('.park-answer')), 'Opening a hint preserves the mounted input instance');
            if (draft.applicable) assert.deepEqual(await readSupportDraft(page), draft.value, 'Hint preserves the exact typed values and active field/cell');
            row.hintDraft = draft;
            row.hintControls = scenario.partial ? await assertWrittenSupportControls(page, { allowScroll: true })
                : await assertControls(page, { allowScroll: scenario.type === 'multi-number' });
            assert.equal(await page.locator('.island-support-example, .island-support-answer, .island-support-model').count(), 0);
            assert.equal(await button(page, 'わからない').count(), 0, 'A saved skip/help cannot be repeated through the new stage');
            await capture(page, `${scenario.name}-hint-draft`, state, Boolean(scenario.partial));
            // A real retry is available immediately after the hint. It is an
            // assisted answer, distinct from the later no-answer completion.
            if (scenario.type !== 'choice') await activate(button(page, 'こたえを けす'), scenario.touch);
            const retry = scenario.partial ? await answerWrittenRow(page, state, scenario.touch, true)
                : await attempt(page, state, { wrong: true, touch: scenario.touch });
            assert.equal(retry.receipt.result, 'assisted-incorrect');
            assert.deepEqual(retry.after.logs, state.logs); state = retry.after;
            state = await reloadSaved(page, state);
            assert.equal(state.plan.slots[0].supportStage, 'hint');
            const modelDraft = await enterSupportDraft(page, state, scenario.touch);
            await page.evaluate(() => { window.__islandSupportForm = document.querySelector('.park-answer'); });
            result = await supportAction(page, state, 'おてほんを みる', 'model_opened', scenario.touch);
            state = result.after; row.supportActions.push(result.timing);
            assert(await page.evaluate(() => window.__islandSupportForm === document.querySelector('.park-answer')), 'Model opening retains the draft form instance');
            if (modelDraft.applicable) assert.deepEqual(await readSupportDraft(page), modelDraft.value);
            row.modelSurface = await assertModelSurface(page, state.plan.slots[0]);
            if (scenario.worked) assert.equal(await page.locator('.island-support-example').innerText(), '2 + 8 = 10 → 10 + 1 = 11');
            row.keyboardBlockade = await assertModelKeyboardBlocked(page);
            await capture(page, `${scenario.name}-model`, state, true);
            if (scenario.legacy) { row.legacyFixture = await omitLegacySupportField(page, state); state = await readNative(page, id); }
            state = await reloadSaved(page, state);
            await assertModelSurface(page, state.plan.slots[0]);
            await capture(page, `${scenario.name}-model-resumed`, state, true);
            const stores = await readSupportStores(page), shown = state.plan;
            result = await supportAction(page, state, 'つぎへ すすむ', 'supported_completed', scenario.touch);
            state = result.after; row.supportActions.push(result.timing);
            row.supportedIntegrity = assertSupportedIntegrity(stores, await readSupportStores(page), shown, shown.cursor);
            assert.equal(state.plan.cursor, 1); assert.equal(state.island.completedSets, 0);
            assert.equal(state.island.pendingRewards.length, 0, 'One supported problem does not prematurely award a whole section');
            assert.equal(await page.locator('[data-island-plan-id]').getAttribute('data-learning-feedback'), 'supported');
            assert.deepEqual(result.saved.slots[0].hissanValues, row.savedPartialCells);
            await capture(page, `${scenario.name}-supported-next-input`, state);
            let steps = 0;
            while (state.plan) {
                assert(++steps <= 80, 'The normal fixed reservation finishes in its actual bounded steps');
                state = state.plan.slots[state.plan.cursor].problem.hissanVersion === 2
                    ? (await answerWrittenRow(page, state, scenario.touch)).after
                    : (await attempt(page, state, { touch: scenario.touch })).after;
            }
            await waitMode(page, 'reward');
            assert.equal(state.island.completedSets, 1); assert.equal(state.island.pendingRewards.length, 1);
            assert.equal(state.islandEvents.filter(event => event.type === 'supported_completed').length, 1);
            assert.equal(state.islandEvents.filter(event => event.type === 'plan_completed').length, 1);
            if (scenario.skip) assert.equal(state.logs.filter(log => log.result === 'skipped').length, 1);
            await capture(page, `${scenario.name}-reward`, state);
            await activate(button(page, 'つづけて とく'), scenario.touch); await waitMode(page, 'learning');
            state = await readNative(page, id); await waitLearningReady(page, state.plan);
            assert.equal(state.island.pendingRewards.length, 1);
            row.completedSets = state.island.completedSets; row.pendingRewards = state.island.pendingRewards.length;
            assert.deepEqual(errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack; row.pageErrors = errors;
            row.failureStores = await readSupportStores(page).catch(() => undefined);
            row.failureTiming = await page.evaluate(() => window.__islandSupportTiming).catch(() => undefined);
            await page.screenshot({ path: `${out}/${scenario.name}-failure.png`, fullPage: true }).catch(() => undefined);
            throw error;
        } finally {
            await context.close(); const file = await page.video().path();
            row.video = { file, sha256: sha(await fs.readFile(file)) };
        }
    }
    report.pass = true;
} finally {
    report.sourceEnd = await sourceSnapshot(); report.sourceStable = report.sourceEnd.hash === report.sourceStart.hash;
    if (!report.sourceStable) { report.pass = false; report.sourceError = 'Source changed during the production run'; }
    await browser.close(); report.browserClosed = true; report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
assert(report.pass && report.sourceStable);
