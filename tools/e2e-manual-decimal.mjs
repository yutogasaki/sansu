import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedLearningProfile, expectedLearningModel } from './island-learning-fixtures.mjs';
import { readNative } from './island-e2e-helpers.mjs';
const url = process.env.SANSU_MANUAL_DECIMAL_URL || 'http://127.0.0.1:5697';
const out = process.env.SANSU_MANUAL_DECIMAL_OUTPUT || 'output/manual-decimal';
async function writtenEntry(root, problem) {
    const grid = expectedLearningModel({ problem }); assert(grid);
    const step = grid.steps[0];
    const ordered = step.inputCellIndices.map((col, i) => ({ col, value: step.correctValues[i] })).sort((a, b) => a.col - b.col);
    const editable = await root.locator('[data-written-input]').evaluateAll(elements => elements.map(el => el.getAttribute('data-written-input')));
    return { editable, entry: ordered.filter(cell => editable.includes(`${step.rowIndex}-${cell.col}`)).map(cell => cell.value).join('') };
}
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), report = [];
try {
    for (const width of [390, 768]) for (const lane of ['island', 'study']) for (const scenario of ['decimal', 'written-decimal', 'written-retry']) {
        const row = { width, lane, scenario, errors: [] }; report.push(row);
        let context, page;
        try {
            const written = scenario !== 'decimal', skill = scenario === 'written-retry' ? 'mul_2d1d' : 'dec_add';
            // Keep actual planner draws. Two-digit products are uncommon; exhaustion
            // is a missing eligible sample, never permission to test a three-digit one.
            const maxAttempts = scenario === 'written-retry' ? 96 : 15;
            row.sampling = { method: 'fresh-profile-normal-planner', maxAttempts, history: [] };
            let id, root, problem, oldId, selected = false;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                if (context) await context.close();
                context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: 'reduce' });
                page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => row.errors.push(e.message));
                await page.goto(url + '/#/onboarding'); await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
                id = await seedLearningProfile(page, { skill, type: written ? 'hissan' : 'number' });
                await page.goto(url + (lane === 'island' ? '/#/island' : '/#/study?session=review&force_review=1&focus_subject=math&focus_ids=' + skill));
                if (lane === 'island') await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
                root = page.locator(lane === 'island' ? '.park-answer' : '[data-study-question-id]');
                await root.locator(written ? '[data-written-input]' : '[data-answer-shape]').first().waitFor();
                oldId = await root.getAttribute(lane === 'island' ? 'data-problem-id' : 'data-study-question-id');
                if (lane === 'island') { const state = await readNative(page, id); problem = state.plan.slots[state.plan.cursor].problem; }
                else {
                    const questionText = await root.getAttribute('data-question-text');
                    const m = questionText.match(/([\d.]+)\s*([+×])\s*([\d.]+)/); assert(m, questionText);
                    const answer = Math.round((m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) * Number(m[3])) * 10000) / 10000;
                    problem = { questionText, correctAnswer: String(answer), categoryId: skill, ...(skill === 'mul_2d1d' ? { hissanVersion: 2 } : {}) };
                }
                const answer = String(problem.correctAnswer), writtenSample = written ? await writtenEntry(root, problem) : undefined;
                const rejectionReasons = [];
                if (scenario === 'written-retry') {
                    if (!/^\d{2}$/.test(answer)) rejectionReasons.push('answer-is-not-two-digits');
                } else {
                    if (!answer.includes('.')) rejectionReasons.push('answer-has-no-decimal-point');
                }
                row.sampleAttempts = attempt;
                row.sampling.history.push({ attempt, profileId: id, problemId: oldId, question: problem.questionText,
                    answer, categoryId: problem.categoryId, ...(writtenSample ?? {}), eligible: rejectionReasons.length === 0, rejectionReasons });
                if (rejectionReasons.length === 0) {
                    selected = true; row.sampling.acceptedAttempt = attempt; row.sampling.status = 'selected';
                    // A matching question with incorrect controls is an app failure,
                    // not a reason to discard the draw and seek a passing sample.
                    if (scenario === 'written-retry') {
                        assert.match(writtenSample.entry, /^\d{2}$/);
                        assert.equal(writtenSample.editable.length, 2);
                    }
                    break;
                }
            }
            if (!selected) {
                row.sampling.status = 'exhausted'; row.failureKind = 'sample-exhausted';
                throw new Error(`SAMPLE_EXHAUSTED: ${lane}/${width}/${scenario} found no eligible sample in ${maxAttempts} normal planner draws; regression was not exercised`);
            }
            row.question = problem.questionText; row.answer = problem.correctAnswer;
            const keypad = page.getByRole('group', { name: 'すうじ キーパッド' });
            const input = async text => { for (const ch of text) { if (width === 390) await keypad.getByRole('button', { name: ch === '.' ? 'しょうすうてん' : ch, exact: true }).tap(); else await page.keyboard.type(ch); } };
            const backspace = async () => keypad.getByRole('button', { name: 'ひとつ もどす', exact: true }).tap();
            const before = await readNative(page, id);
            if (!written) {
                const [integer, fraction] = String(problem.correctAnswer).split('.'); assert(fraction);
                await input(integer);
                await root.getByRole('button', { name: 'こたえ', exact: true }).tap();
                await input('.');
                assert.equal((await root.locator('.answer-cell[data-filled=true]').allTextContents()).join(''), integer);
                await input(integer);
                assert.equal(await root.locator('.answer-cells-point').innerText(), '□');
                await input('.'); assert.equal(await root.locator('.answer-cells-point').innerText(), '.');
                await backspace(); assert.equal(await root.locator('.answer-cells-point').innerText(), '□');
                await input('.');
                await page.screenshot({ path: `${out}/${lane}-${width}-${scenario}.png` });
                await input(fraction);
            } else {
                const { entry } = await writtenEntry(root, problem);
                if (scenario === 'written-retry') assert.equal(entry.length, 2);
                const wrong = String((Number(entry[0]) + 1) % 10) + entry.slice(1);
                await input(wrong);
                await root.getByText('このだんを もういちど', { exact: true }).waitFor();
                const values = await root.locator('[data-written-input]').allTextContents();
                assert(values.every(text => !/[0-9.]/.test(text)), 'Every entered cell must clear: ' + values);
                await page.screenshot({ path: `${out}/${lane}-${width}-${scenario}-retry.png` });
                if (entry.includes('.')) {
                    const point = entry.indexOf('.');
                    await input(entry.slice(0, point)); await input('.'); await backspace();
                    assert.equal((await root.locator('[data-written-input]').allTextContents()).filter(text => text === '.').length, 0);
                    await input('.');
                    await page.screenshot({ path: `${out}/${lane}-${width}-${scenario}-point.png` });
                    await input(entry.slice(point + 1));
                } else {
                    await input(entry[0]);
                    assert.equal(await root.locator('[data-written-input]').count(), 2);
                    assert.equal(await root.getAttribute(lane === 'island' ? 'data-problem-id' : 'data-study-question-id'), oldId);
                    await input(entry.slice(1));
                }
            }
            await page.waitForFunction(({ lane, oldId }) => document.querySelector(lane === 'island' ? '.park-answer' : '[data-study-question-id]')?.getAttribute(lane === 'island' ? 'data-problem-id' : 'data-study-question-id') !== oldId, { lane, oldId });
            const after = await readNative(page, id);
            if (lane === 'island') assert.equal(after.plan.cursor, before.plan.cursor + 1);
            if (!written) { assert.equal(after.logs.length, before.logs.length + 1); assert.equal(after.logs.at(-1).result, 'correct'); }
            row.beforeLogs = before.logs.length; row.afterLogs = after.logs.length; row.pass = true;
            console.log('PASS', lane, width, scenario);
        } catch (e) {
            row.pass = false; row.error = e.stack;
            if (page) await page.screenshot({ path: `${out}/FAIL-${lane}-${width}-${scenario}.png` }).catch(() => {});
            console.log('FAIL', lane, width, scenario, e.message);
        } finally { if (context) await context.close(); }
    }
} finally { await browser.close(); await writeFile(out + '/report.json', JSON.stringify(report, null, 2)); }
if (report.some(row => !row.pass || row.errors.length)) process.exitCode = 1;
