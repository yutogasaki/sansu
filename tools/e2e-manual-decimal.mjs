import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedLearningProfile, expectedLearningModel } from './island-learning-fixtures.mjs';
import { readNative } from './island-e2e-helpers.mjs';
const url = process.env.SANSU_MANUAL_DECIMAL_URL || 'http://127.0.0.1:5697';
const out = process.env.SANSU_MANUAL_DECIMAL_OUTPUT || 'output/manual-decimal';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), report = [];
try {
    for (const width of [390, 768]) for (const lane of ['island', 'study']) for (const scenario of ['decimal', 'written-decimal', 'written-retry']) {
        const row = { width, lane, scenario, errors: [] }; report.push(row);
        let context, page;
        try {
            const written = scenario !== 'decimal', skill = scenario === 'written-retry' ? 'mul_2d1d' : 'dec_add';
            let id, root, problem, oldId;
            for (let attempt = 0; attempt < 15; attempt++) {
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
                if (scenario === 'written-retry' ? String(problem.correctAnswer).length === 2 : String(problem.correctAnswer).includes('.')) { row.sampleAttempts = attempt + 1; break; }
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
                const grid = expectedLearningModel({ problem }); assert(grid);
                const step = grid.steps[0];
                const ordered = step.inputCellIndices.map((col, i) => ({ col, value: step.correctValues[i] })).sort((a, b) => a.col - b.col);
                const editable = await root.locator('[data-written-input]').evaluateAll(elements => elements.map(el => el.getAttribute('data-written-input')));
                const entry = ordered.filter(cell => editable.includes(`${step.rowIndex}-${cell.col}`)).map(cell => cell.value).join('');
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
