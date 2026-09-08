import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const base = process.env.SANSU_ISLAND_PRODUCTION_URL, out = process.env.SANSU_ISLAND_SUPPORT_OUTPUT;
assert(base && out);
const helper = name => import(pathToFileURL(`${process.cwd()}/tools/${name}.mjs`));
const { activate, button, readNative, runtimeMetadata, waitMode, waitReady } = await helper('island-e2e-helpers');
const { assertControls, waitLearningReady } = await helper('island-learning-checks');
const { expectedLearningAnswer, seedLearningProfile } = await helper('island-learning-fixtures');
const { assertModelKeyboardBlocked, assertModelSurface, assertSupportedIntegrity, assertWrittenSupportControls,
    readSupportDraft, readSupportStores, supportAction } = await helper('island-support-checks');
const source = JSON.parse(await readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = async () => Promise.all(source.files.map(async item => ({ path: item.path, sha256: sha(await readFile(item.path)) })));
const scenarios = ['phone', 'tablet'].flatMap(device => [
    ['compose_5', 'number'], ['compose_10', 'number'], ['count_10', 'number'], ['add_1d_2', 'number'],
    ['sub_1d1d_c', 'number'], ['sub_tiny', 'number'], ['frac_add_same', 'multi-number'], ['pattern_copy', 'choice'],
].map(([skill, type]) => ({ skill, type, name: `${device}-${skill}`, width: device === 'phone' ? 390 : 768,
    height: device === 'phone' ? 844 : 1024, touch: device === 'phone' })));
scenarios.push({ skill: 'mul_2d2d', type: 'hissan', name: 'phone-written-multiply', width: 390, height: 844, touch: true },
    { skill: 'div_3d1d_exact', type: 'hissan', name: 'tablet-written-divide', width: 768, height: 1024 },
    { skill: '', subject: 'vocab', type: 'choice', name: 'phone-vocabulary', width: 390, height: 844, touch: true });
const report = { target: base, source, scenarios: [], captures: [], pass: false, humanN: 0,
    scope: '19 focused hint/support scenarios. Native profile fixtures; actual planner reservations and trusted UI answers. Tests hint/draft/retry/reload/model/input blockade/supported next question and preserved mastery. Includes automatic single-digit/written answers. No reward or performance benchmark claim.' };
await mkdir(out, { recursive: true });
assert.deepEqual(await sourceHashes(), source.files);
const browser = await chromium.launch();
async function capture(page, name, state) {
    await page.evaluate(() => scrollTo(0, 0));
    const file = `${name}.png`, metadata = await runtimeMetadata(page);
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, planId: state.plan.id, cursor: state.plan.cursor });
}
async function answer(page, before, scenario, wrong = false) {
    const current = before.plan.slots[before.plan.cursor];
    const expected = expectedLearningAnswer(current, scenario.type);
    const automatic = await page.locator('.park-answer').getAttribute('data-answer-completion') === 'automatic';
    await activate(button(page, 'こたえを けす'), scenario.touch);
    let values = Array.isArray(expected.values) ? [...expected.values] : [expected.values];
    if (wrong) values[0] = values[0] === '9' ? '8' : '9';
    if (scenario.type === 'multi-number') {
        for (let index = 0; index < values.length; index++) {
            await activate(page.locator('.park-input').nth(index), scenario.touch); await page.keyboard.type(values[index]);
        }
    } else await page.keyboard.type(values.join(''));
    if (!automatic) await activate(page.locator('[data-keypad-submit]'), scenario.touch);
    await page.waitForFunction(revision => Number(document.querySelector('[data-island-plan-revision]')?.getAttribute('data-island-plan-revision')) > revision, before.plan.revision);
    const after = await readNative(page, before.plan.profileId); await waitLearningReady(page, after.plan);
    assert.deepEqual(after.plan.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.equal(after.plan.cursor, before.plan.cursor + Number(!wrong && expected.final));
    return after;
}
async function draft(page, state, scenario) {
    const expected = expectedLearningAnswer(state.plan.slots[state.plan.cursor], scenario.type);
    const automatic = await page.locator('.park-answer').getAttribute('data-answer-completion') === 'automatic';
    if (scenario.type !== 'choice' && !(automatic && (scenario.type !== 'hissan' || expected.values.length === 1))) {
        await activate(button(page, 'こたえを けす'), scenario.touch); await page.keyboard.type('3');
    }
    return readSupportDraft(page);
}
try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: Boolean(scenario.touch), serviceWorkers: 'block' });
        const page = await context.newPage(), row = { ...scenario, pass: false }; report.scenarios.push(row);
        page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const id = await seedLearningProfile(page, scenario);
            await page.goto(`${base}/#/island`); await waitReady(page);
            await activate(page.locator('.island-start'), scenario.touch); await waitMode(page, 'learning');
            let state = await readNative(page, id); await waitLearningReady(page, state.plan);
            if (scenario.skill) assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill);
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            const meta = await runtimeMetadata(page); assert.equal(meta.revision, source.revision);
            row.problem = state.plan.slots[0].problem;
            if (scenario.type === 'hissan') state = await answer(page, state, scenario);
            const savedCells = structuredClone(state.plan.slots[0].hissanValues);
            const beforeDraft = await draft(page, state, scenario);
            await capture(page, `${scenario.name}-ready`, state);
            state = (await supportAction(page, state, 'ヒントを みる', 'support_opened', scenario.touch)).after;
            assert.deepEqual(await readSupportDraft(page), beforeDraft);
            row.hintText = await page.locator('[data-support-kind=hint]').innerText();
            assert.equal(await page.locator('.island-support-answer, .island-support-example').count(), 0);
            const allowScroll = ['hissan', 'multi-number'].includes(scenario.type);
            row.controls = [];
            for (const control of await page.locator('.park-keypad button, .park-choices button, .island-learning-actions button, .park-input').all()) {
                if (allowScroll) await control.scrollIntoViewIfNeeded();
                const rect = await control.evaluate(element => {
                    const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
                    return { name: element.getAttribute('aria-label') || element.textContent.trim(), width: r.width, height: r.height,
                        visible: r.top >= -.5 && r.left >= -.5 && r.bottom <= innerHeight+.5 && r.right <= innerWidth+.5,
                        hit: hit === element || element.contains(hit), disabled: element.disabled };
                });
                assert(rect.width >= 43.5 && rect.height >= 43.5 && rect.visible && (rect.disabled || rect.hit), JSON.stringify(rect));
                row.controls.push(rect);
            }
            if (scenario.type !== 'choice') for (const key of [...'7894561230', 'こたえを けす', 'ひとつ もどす']) assert(row.controls.some(control => control.name === key));
            await capture(page, `${scenario.name}-hint`, state);
            if (scenario.type !== 'choice') {
                const logs = structuredClone(state.logs); state = await answer(page, state, scenario, true); assert.deepEqual(state.logs, logs);
            }
            await page.reload(); await waitReady(page); await waitLearningReady(page, state.plan);
            state = await readNative(page, id); await waitLearningReady(page, state.plan);
            assert.equal(state.plan.slots[0].supportStage, 'hint');
            assert.equal(await page.locator('[data-support-kind=hint]').innerText(), row.hintText);
            const modelDraft = await draft(page, state, scenario);
            state = (await supportAction(page, state, 'おてほんを みる', 'model_opened', scenario.touch)).after;
            assert.deepEqual(await readSupportDraft(page), modelDraft);
            row.model = await assertModelSurface(page, state.plan.slots[0]); row.keyboard = await assertModelKeyboardBlocked(page);
            await capture(page, `${scenario.name}-model`, state);
            const stores = await readSupportStores(page), plan = state.plan;
            state = (await supportAction(page, state, 'つぎへ すすむ', 'supported_completed', scenario.touch)).after;
            const afterStores = await readSupportStores(page), table = plan.subject === 'math' ? 'memoryMath' : 'memoryVocab';
            const field = plan.subject === 'math' ? 'mathSkills' : 'vocabWords', skill = plan.slots[0].problem.categoryId;
            const previousMemory = stores[table].find(item => item.id === skill && item.profileId === id);
            const currentMemory = afterStores[table].find(item => item.id === skill && item.profileId === id);
            const receipt = afterStores.islandEvents.find(event => event.type === 'supported_completed' && event.planId === plan.id);
            assert.equal(currentMemory.relearningStartedAt, new Date(receipt.timestamp).toISOString());
            row.relearningClock = { before: previousMemory.relearningStartedAt, after: currentMemory.relearningStartedAt, eventAt: receipt.timestamp };
            // beginRelearning intentionally stamps the current assisted operation. Verify that clock above;
            // normalize only this bound memory's clock before reusing the older all-store invariant checker.
            const normalized = structuredClone(afterStores);
            const copyClock = memory => {
                if (previousMemory.relearningStartedAt === undefined) delete memory.relearningStartedAt;
                else memory.relearningStartedAt = previousMemory.relearningStartedAt;
            };
            copyClock(normalized[table].find(item => item.id === skill && item.profileId === id));
            copyClock(normalized.profiles.find(profile => profile.id === id)[field][skill]);
            for (const app of normalized.appData) if (app.profiles[id]) copyClock(app.profiles[id][field][skill]);
            row.integrity = assertSupportedIntegrity(stores, normalized, plan, 0);
            assert.equal(state.plan.cursor, 1); assert.deepEqual(state.plan.slots[0].hissanValues, savedCells);
            await capture(page, `${scenario.name}-next`, state); assert.deepEqual(errors, []); row.pass = true;
            console.log(`PASS ${scenario.name}: ${row.hintText}`);
        } catch (error) { row.error = error.stack; await page.screenshot({ path: `${out}/${scenario.name}-failure.png`, fullPage: true }); throw error; }
        finally { await context.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
    }
    assert.deepEqual(await sourceHashes(), source.files); report.pass = true;
} finally { await browser.close(); report.runnerHash = sha(await readFile(new URL(import.meta.url))); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
