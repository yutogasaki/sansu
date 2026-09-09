import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { readNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ANSWER_CELLS_URL || 'http://127.0.0.1:5632';
const out = path.resolve(process.env.SANSU_ANSWER_EDGES_OUTPUT || 'output/playwright/answer-cell-edges');
await fs.mkdir(out, { recursive: true });
const report = { base, scope: 'Native-profile generated mixed fractions; normal keyboard separators plus explicitly synthetic same-event cursor/digit burst', cases: [], pass: false };
const browser = await chromium.launch();
function expected(question) {
    const [a, b, n, c, d, m] = question.match(/\d+/g).map(Number);
    assert.equal(n, m);
    const integer = a + c + Math.floor((b + d) / n), numerator = (b + d) % n;
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const divisor = gcd(numerator, n);
    return [integer, numerator / divisor, n / divisor].map(String);
}
try {
    for (const lane of ['study', 'island']) for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) for (const burst of [false, true]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${base}/#/onboarding`);
            await page.locator('.island-welcome').waitFor({ state: 'attached', timeout: 60000 });
            const profileId = await seedLearningProfile(page, { skill: 'frac_mixed', type: 'number' });
            await page.goto(`${base}/#/${lane === 'study' ? 'study?session=review&force_review=1&focus_subject=math&focus_ids=frac_mixed' : 'island'}`);
            await page.bringToFront();
            if (lane === 'island') await page.getByRole('button', { name: 'まなぶ', exact: true }).press('Enter');
            const root = lane === 'study' ? '[data-study-question-id]' : '[data-input-ready="true"] .park-answer';
            const identity = lane === 'study' ? 'data-study-question-id' : 'data-problem-id';
                await page.locator(`${root} [data-answer-shape]`).first().waitFor();
                const problemId = await page.locator(root).getAttribute(identity);
                const before = await readNative(page, profileId);
                const answers = lane === 'study'
                    ? expected(await page.locator(root).getAttribute('data-question-text'))
                    : before.plan.slots[before.plan.cursor].problem.correctAnswer;
                assert.equal(answers.length, 3);
                if (burst) {
                    const keys = viewport.width === 390
                        ? ['ArrowRight', 'ArrowRight', ...answers[2], 'Backspace', answers[2].at(-1), ...answers[0], '/', ...answers[1]]
                        : ['ArrowRight', ...answers[1], 'ArrowLeft', 'ArrowLeft', ...answers[0], 'ArrowRight', 'Backspace', answers[0].at(-1), ...answers[2]];
                    // Dispatch without a React render between events to exercise the draft ref.
                    await page.evaluate(keys => {
                        for (const key of keys) document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
                    }, keys);
                } else {
                    for (const [index, answer] of answers.entries()) {
                        await page.keyboard.type(answer, { delay: 35 });
                        if (index < answers.length - 1) await page.keyboard.press('/');
                    }
                }
                await page.waitForFunction(({ selector, attribute, previous }) => {
                    const element = document.querySelector(selector);
                    return element && element.getAttribute(attribute) !== previous;
                }, { selector: root, attribute: identity, previous: problemId });
                const after = await readNative(page, profileId);
                assert.equal(after.logs.length, before.logs.length + 1);
                if (lane === 'island') assert.equal(after.plan.cursor, before.plan.cursor + 1);
                else assert.equal(await page.locator(root).getAttribute('data-feedback'), 'none');
                report.cases.push({ lane, viewport, burst, answers, oneSavedAnswer: true });
            assert.deepEqual(errors, []);
        } finally {
            await page.screenshot({ path: path.join(out, `${lane}-${viewport.width}-${burst ? 'burst' : 'keyboard'}.png`) });
            await context.close();
        }
    }
    report.pass = true;
} catch (error) { report.error = error.stack; throw error; }
finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, out }));
