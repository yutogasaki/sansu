import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { readNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ANSWER_CELLS_URL || 'http://127.0.0.1:5632';
const out = path.resolve(process.env.SANSU_ANSWER_CELLS_OUTPUT || 'output/playwright/answer-cells');
await fs.mkdir(out, { recursive: true });
const lane = process.env.SANSU_ANSWER_CELLS_LANE;
const report = { base, lane: lane || 'all', scope: 'DEV fixed-ten Study fixture and native-profile Island generated numeric answers; no child or production-PWA claim', scenarios: [], pass: false };
const browser = await chromium.launch();
const pad = page => page.getByRole('group', { name: 'すうじ キーパッド', exact: true });
const digit = async (page, value, touch) => touch
    ? pad(page).getByRole('button', { name: value, exact: true }).tap()
    : page.keyboard.type(value, { delay: 35 });
async function capture(page, name) {
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    const boxes = await pad(page).getByRole('button').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); return { label: element.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    const viewport = page.viewportSize();
    for (const box of boxes.filter(box => /^\d$/.test(box.label))) assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1 && box.width >= 43 && box.height >= 43, JSON.stringify(box));
    assert(await page.locator('.answer-cell').count() > 0);
}
try {
    for (const viewport of lane === 'island' ? [] : [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
        const touch = viewport.width === 390;
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/onboarding`);
        await page.locator('.island-welcome').waitFor({ state: 'attached', timeout: 60000 });
        await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
        await page.goto(`${base}/#/study?session=dev&benchmark=cold-open-fixed-ten-v1`);
        const answers = ['2', '5', '6', '8', '8', '10', '12', '8', '6', '10'];
        for (let i = 0; i < answers.length; i++) {
            await page.locator(`[data-study-index="${i}"]`).waitFor();
            await pad(page).getByRole('button', { name: '1', exact: true }).waitFor({ state: 'visible' });
            assert.equal(await page.locator('.answer-cell').count(), answers[i].length);
            assert.equal(await page.locator('[data-keypad-submit]').isDisabled(), true);
            if (i === 0 || i === 6) await capture(page, `study-${viewport.width}-${answers[i].length}-digit`);
            for (let j = 0; j < answers[i].length; j++) {
                if (j < answers[i].length - 1) {
                    await digit(page, '9', touch);
                    await page.keyboard.press('Enter');
                    assert.equal(await page.locator('[data-study-index]').getAttribute('data-study-index'), String(i));
                    await pad(page).getByRole('button', { name: 'ひとつ もどす', exact: true }).click();
                }
                await digit(page, answers[i][j], touch);
            }
        }
        await page.locator('[data-benchmark-complete="true"]').waitFor();
        report.scenarios.push({ lane: 'study', viewport, correct: 10, enterRequired: false, errors: [...errors] });
        assert.deepEqual(errors, []);
        await seedLearningProfile(page, { skill: 'mul_2d1d', type: 'number' });
        await page.goto(`${base}/#/study?session=review&force_review=1&focus_subject=math&focus_ids=mul_2d1d`);
        await page.locator('[data-study-index="0"] [data-answer-shape]').waitFor();
        const question = await page.locator('[data-question-text]').getAttribute('data-question-text');
        const operands = question.match(/(\d+)\s*×\s*(\d+)/);
        assert(operands, question);
        const answer = String(Number(operands[1]) * Number(operands[2]));
        assert(answer.length > 1);
        await page.evaluate(() => {
            const put = IDBObjectStore.prototype.put;
            window.__answerCellAbort = true;
            IDBObjectStore.prototype.put = function(value, ...args) {
                const request = put.call(this, value, ...args);
                if (this.name === 'memoryMath' && window.__answerCellAbort) { window.__answerCellAbort = false; this.transaction.abort(); }
                return request;
            };
        });
        for (const value of answer) await digit(page, value, touch);
        await page.getByRole('alert').waitFor();
        assert.equal(await page.locator('[data-keypad-submit]').isDisabled(), false);
        await pad(page).getByRole('button', { name: 'ひとつ もどす', exact: true }).click();
        assert.equal(await page.locator('[data-keypad-submit]').isDisabled(), true);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-study-index]').getAttribute('data-study-index'), '0');
        await digit(page, answer.at(-1), touch);
        await page.locator('[data-study-index="1"]').waitFor();
        report.scenarios.push({ lane: 'study-save-retry', viewport, partialRetryBlocked: true });
        await context.close();
    }
    for (const viewport of lane === 'study' ? [] : [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) for (const skill of ['add_1d_1', 'mul_99_rand', 'dec_add', 'frac_add_same', 'div_rem_q1']) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${base}/#/onboarding`); await page.locator('.island-welcome').waitFor({ state: 'attached', timeout: 60000 });
            const id = await seedLearningProfile(page, { skill, type: 'number' });
            await page.goto(`${base}/#/island`);
            await page.bringToFront();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).press('Enter');
            await page.locator('[data-input-ready="true"] .park-answer').waitFor();
            let before = await readNative(page, id);
            const slot = before.plan.slots[before.plan.cursor];
            assert.equal(slot.problem.categoryId, skill);
            const answer = Array.isArray(slot.problem.correctAnswer) ? slot.problem.correctAnswer : [slot.problem.correctAnswer];
            assert.equal(await page.locator('.park-answer').getAttribute('data-answer-completion'), 'automatic');
            const shapes = await page.locator('[data-answer-shape]').evaluateAll(elements => elements.map(el => el.dataset.answerShape));
            assert.deepEqual(shapes, answer.map(value => value.replace(/\d/g, '□')));
            await capture(page, `island-${viewport.width}-${skill}`);
            // Same-width incorrect input must be saved once, followed by a correct retry.
            for (const incorrect of [true, false]) {
                const revision = before.plan.revision;
                const values = incorrect ? answer.map(value => value.replace(/\d/g, d => d === '9' ? '8' : '9')) : answer;
                const digits = values.join('').replace(/\./g, '');
                for (let i = 0; i < digits.length; i++) {
                    await digit(page, digits[i], viewport.width === 390);
                    if (i < digits.length - 1) assert.equal((await readNative(page, id)).plan.revision, revision);
                }
                await page.waitForFunction(async ({ planId, revision }) => {
                    const r = indexedDB.open('SansuDatabase');
                    const db = await new Promise(resolve => { r.onsuccess = () => resolve(r.result); });
                    const read = db.transaction('islandPlans').objectStore('islandPlans').get(planId);
                    const plan = await new Promise(resolve => { read.onsuccess = () => resolve(read.result); }); db.close();
                    return plan?.revision > revision;
                }, { planId: before.plan.id, revision });
                await page.locator('[data-input-ready="true"] .park-answer').waitFor();
                const after = await readNative(page, id);
                assert.equal(after.logs.length, before.logs.length + 1);
                assert.equal(after.plan.revision, revision + 1);
                if (incorrect) assert.equal(after.plan.cursor, before.plan.cursor);
                else assert.equal(after.plan.cursor, before.plan.cursor + 1);
                before = after;
            }
            assert.deepEqual(errors, []);
            report.scenarios.push({ lane: 'island', viewport, skill, shapes, incorrectThenCorrect: true, errors });
        } finally { await page.screenshot({ path: path.join(out, `last-${viewport.width}-${skill}.png`) }); await context.close(); }
    }
    report.pass = true;
} catch (error) { report.error = error.stack; throw error; }
finally { await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.length, out }));
