import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { seedLearningProfile, expectedLearningAnswer } from './island-learning-fixtures.mjs';
import { button, readNative, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';
import { waitLearningReady } from './island-learning-checks.mjs';

const base = process.env.SANSU_WRITTEN_BASE_URL || 'http://127.0.0.1:5201';
const out = process.env.SANSU_WRITTEN_OUTPUT || 'output/playwright/written-arithmetic';
const sources = ['src/components/domain/WrittenArithmeticGrid.tsx', 'src/components/domain/WrittenArithmeticGrid.css',
    'src/components/domain/LearningAnswerForm.tsx', 'src/domain/math/writtenArithmetic.ts', 'src/domain/park/learning.ts',
    'src/hooks/useHissanSession.ts', 'src/pages/Study.tsx', 'src/pages/StudyLayout.tsx'];
const hashes = () => Promise.all(sources.map(async path => ({ path, sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') })));
const report = { target: base, startedAt: new Date().toISOString(), sourceStart: await hashes(), scenarios: [], captures: [], errors: [], pass: false,
    evidenceScope: 'Actual Island UI and atomic writer. Ordinary scenarios use the normal planner with only isolated profile/memory setup. Explicit fixture scenarios replace the first reserved problem through native IndexedDB to cover rare numeric edges; they do not prove planner selection. No browser app-module imports. Expected step values execute in Node. Full layout checks apply at each step.' };
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const scenarios = [
    { name: 'phone-multiply', width: 390, height: 844, skill: 'mul_3d2d', touch: true, resume: true, wrong: true },
    { name: 'tablet-multiply', width: 768, height: 1024, skill: 'mul_2d2d' },
    { name: 'phone-division', width: 390, height: 844, skill: 'div_3d1d_exact', reduced: true, resume: true },
    { name: 'tablet-division', width: 768, height: 1024, skill: 'div_3d2d_exact', touch: true },
    { name: 'phone-remainder', width: 390, height: 844, skill: 'div_rem_q2', touch: true },
    { name: 'tablet-remainder', width: 768, height: 1024, skill: 'div_rem_q2', support: true },
    { name: 'phone-support', width: 390, height: 844, skill: 'div_rem_q2', support: true },
    { name: 'phone-zero-quotient', width: 390, height: 844, skill: 'div_3d1d_exact', resume: true,
        fixture: { questionText: '816 ÷ 8 =', correctAnswer: '102' } },
    { name: 'phone-max-multiply', width: 390, height: 844, skill: 'mul_3d2d',
        fixture: { questionText: '999 × 99 =', correctAnswer: '98901' } },
].filter(s => !process.env.SANSU_WRITTEN_SCENARIO || s.name === process.env.SANSU_WRITTEN_SCENARIO);
assert(scenarios.length);

async function capture(page, name) {
    const file = `${name}.png`;
    const metadata = await runtimeMetadata(page);
    if (process.env.SANSU_WRITTEN_EXPECTED_REVISION) assert.equal(metadata.revision, process.env.SANSU_WRITTEN_EXPECTED_REVISION);
    await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, ...metadata });
}
async function controls(page) {
    const result = await page.locator('.park-keypad button, [data-written-input], .island-learning-actions button').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { name: element.getAttribute('aria-label'), width: r.width, height: r.height, x: r.x, y: r.y,
            visible: r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5,
            hit: hit === element || element.contains(hit), disabled: element.disabled };
    }));
    for (const geometry of result) {
        assert(geometry.width >= 43.5 && geometry.height >= 43.5, `Touch target: ${JSON.stringify(geometry)}`);
        assert(geometry.visible && (geometry.hit || geometry.disabled), `Visible input: ${JSON.stringify(geometry)}`);
    }
    for (const key of [...'7894561230']) assert(result.some(item => item.name === key));
    const at = key => result.find(item => item.name === key);
    for (const row of ['789', '456', '123']) {
        assert([...row].every(key => Math.abs(at(key).y - at(row[0]).y) < 1));
        assert(at(row[0]).x < at(row[1]).x && at(row[1]).x < at(row[2]).x);
    }
    assert(at('7').y < at('4').y && at('4').y < at('1').y && at('1').y < at('0').y);
    assert(Math.abs(at('0').x - at('8').x) < 1);
    return result;
}
async function enterValues(page, values, touch) {
    if (touch) for (const value of values) await button(page, value).tap();
    else await page.keyboard.type(values.join(''));
}
async function submit(page, state, touch) {
    const key = page.locator('[data-keypad-submit]');
        if (touch) await key.tap(); else await key.click();
    await page.waitForFunction(revision => Number(document.querySelector('[data-island-plan-revision]')?.getAttribute('data-island-plan-revision')) > revision,
        state.plan.revision);
    const next = await readNative(page, state.plan.profileId);
    await waitLearningReady(page, next.plan);
    return next;
}

try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: Boolean(scenario.touch), reducedMotion: scenario.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
        const page = await context.newPage();
        page.on('pageerror', e => report.errors.push(e.stack));
        page.setDefaultTimeout(15000);
        const row = { ...scenario, steps: [], pass: false }; report.scenarios.push(row);
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            const id = await seedLearningProfile(page, { ...scenario, type: 'hissan' });
            await page.goto(`${base}/#/island`); await waitReady(page);
            await button(page, 'ひかりを とどける').click();
            await page.locator('.written-arithmetic').waitFor();
            let state = await readNative(page, id); await waitLearningReady(page, state.plan);
            if (scenario.fixture) {
                state.plan.slots[0].problem = { ...state.plan.slots[0].problem, ...scenario.fixture };
                await page.evaluate(async plan => {
                    const request = indexedDB.open('SansuDatabase');
                    const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
                    const transaction = database.transaction('islandPlans', 'readwrite');
                    transaction.objectStore('islandPlans').put(plan);
                    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
                    database.close();
                }, state.plan);
                await page.reload(); await waitReady(page);
                if (await button(page, 'つづきから とく').count()) await button(page, 'つづきから とく').click();
                await waitLearningReady(page, state.plan);
            }
            const problem = state.plan.slots[0].problem;
            assert.equal(problem.categoryId, scenario.skill);
            assert.equal(problem.hissanVersion, scenario.skill.startsWith('div') ? 3 : 2);
            row.question = problem.questionText; row.answer = problem.correctAnswer; row.planId = state.plan.id;
            const originalSlots = state.plan.slots.map(slot => slot.problem);
            await capture(page, `${scenario.name}-ready`);
            await page.keyboard.press('Enter');
            assert.equal((await readNative(page, id)).plan.revision, state.plan.revision, 'Incomplete Enter does not submit');
            if (scenario.support) {
                await button(page, 'ヒントを みる').click();
                await page.waitForFunction(revision => Number(document.querySelector('[data-island-plan-revision]')?.getAttribute('data-island-plan-revision')) > revision, state.plan.revision);
                state = await readNative(page, id); await waitLearningReady(page, state.plan);
                assert(state.plan.slots[0].assisted);
                assert.equal(state.plan.slots[0].supportStage, 'hint');
                assert.equal(await page.locator('.island-support-model, .island-support-example, .island-support-answer').count(), 0,
                    'The existing written-input scenarios remain hint-assisted row submissions; models have a separate full-grid journey');
            }
            const total = expectedLearningAnswer(state.plan.slots[0], 'hissan').totalSteps;
            for (let index = 0; index < total; index++) {
                const slot = state.plan.slots[0], expected = expectedLearningAnswer(slot, 'hissan');
                assert.equal(slot.hissanStep ?? 0, index);
                assert.equal(await page.locator('.written-arithmetic').getAttribute('data-written-step'), String(index));
                row.steps.push({ index, ...expected, controls: await controls(page) });
                if (index === 1 && scenario.resume) {
                    const before = state.plan;
                    await page.reload(); await waitReady(page);
                    const resume = page.getByRole('button', { name: /つづき/ });
                    if (await resume.count()) await resume.first().click();
                    await waitLearningReady(page, before);
                    state = await readNative(page, id);
                    assert.deepEqual(state.plan, before, 'Reload resumes the exact reserved step and work');
                    await capture(page, `${scenario.name}-resume`);
                }
                if (index === 1 && scenario.wrong) {
                    const incorrect = expected.values.map((value, i) => i === 0 ? value === '9' ? '8' : '9' : value);
                    await enterValues(page, incorrect, scenario.touch);
                    const previous = state;
                    state = await submit(page, state, scenario.touch);
                    assert.equal(state.plan.cursor, 0);
                    assert.equal(state.plan.slots[0].hissanStep, index);
                    assert.deepEqual(state.plan.slots[0].hissanValues, previous.plan.slots[0].hissanValues);
                    assert.equal(state.logs.length, previous.logs.length + 1);
                    await capture(page, `${scenario.name}-retry`);
                }
                if (expected.values.length > 1) {
                    await enterValues(page, [expected.values[0]], scenario.touch);
                    await button(page, 'ひとつ もどす').click();
                    assert.equal(await page.locator('[data-written-input]').filter({ hasText: /^\d$/ }).count(), 0);
                    await button(page, 'こたえを けす').click();
                }
                await enterValues(page, expected.values, scenario.touch);
                for (let i = 0; i < expected.values.length; i++) {
                    assert.equal(await page.locator(`[data-written-input="${expected.step.row}-${expected.step.columns[i]}"]`).innerText(), expected.values[i]);
                }
                if (index === total - 1 || index === 1 || index === 3) await capture(page, `${scenario.name}-step-${index}`);
                const previousLogCount = state.logs.length;
                state = await submit(page, state, scenario.touch);
                assert.deepEqual(state.plan.slots.map(slot => slot.problem), originalSlots);
                assert.equal(state.plan.cursor, expected.final ? 1 : 0, 'Only the final step completes a problem');
                assert.equal(state.logs.length, previousLogCount + (expected.final && !scenario.support ? 1 : 0), 'Only an independent final answer records a correct learning log');
            }
            await capture(page, `${scenario.name}-next-question`);
            row.pass = true;
        } finally { await context.close(); }
    }
    report.sourceEnd = await hashes();
    assert.deepEqual(report.sourceEnd, report.sourceStart, 'Verify one unchanged source revision');
    assert.equal(report.errors.length, 0);
    report.pass = true;
} catch (error) { report.errors.push(error.stack); }
finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.map(s => ({ name: s.name, pass: s.pass, steps: s.steps.length })), errors: report.errors, out }, null, 2));
if (!report.pass) process.exitCode = 1;
