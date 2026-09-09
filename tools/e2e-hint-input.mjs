import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { seedLearningProfile, expectedLearningModel } from './island-learning-fixtures.mjs';
import { readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_HINT_URL ?? 'http://127.0.0.1:5689';
const out = path.resolve(process.env.SANSU_HINT_OUTPUT ?? 'output/playwright/hint-input');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.access(path.join(out, 'report.json')), { code: 'ENOENT' });
const report = { target: base, scope: 'Native profile fixtures, real planner and receipts. Delayed completion and aborted hint saves are explicit diagnostics.', cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const width of [390, 1024]) for (const scenario of ['immediate', 'delayed', 'failed']) {
        const entry = { width, scenario, pass: false, errors: [] }; report.cases.push(entry);
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 768 }, hasTouch: width === 390, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        page.on('pageerror', error => entry.errors.push(error.message));
        try {
            await page.addInitScript(() => {
                const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
                Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor, set(listener) {
                    descriptor.set.call(this, typeof listener !== 'function' ? listener : function(event) {
                        if (window.__hintDelay && this.mode === 'readwrite' && this.objectStoreNames.contains('islandPlans')) {
                            window.__hintDelay = false; window.__hintDelayUsed = true;
                            setTimeout(() => listener.call(this, event), 800);
                        } else listener.call(this, event);
                    });
                } });
                const put = IDBObjectStore.prototype.put;
                IDBObjectStore.prototype.put = function(value, ...args) {
                    const result = put.call(this, value, ...args);
                    if (window.__hintAbort && this.name === 'islandPlans') {
                        window.__hintAbort = false; window.__hintAbortUsed = true; this.transaction.abort();
                    }
                    return result;
                };
            });
            await page.goto(`${base}/#/onboarding`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const profile = await seedLearningProfile(page, { skill: 'mul_3d2d', type: 'hissan' });
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-written-input][data-active="true"]').waitFor();
            let before = await readNative(page, profile), slot = before.plan.slots[before.plan.cursor];
            let grid = expectedLearningModel(slot), step = grid.steps[slot.hissanStep ?? 0];
            // A zero units multiplier legitimately produces a one-cell row. Solve
            // it normally before the partial-draft failure diagnostic.
            while (step.correctValues.length < 2) {
                await page.keyboard.type(step.inputCellIndices.map((col, i) => ({ col, value: step.correctValues[i] })).sort((a, b) => a.col - b.col).map(cell => cell.value).join(''));
                await page.waitForFunction(index => Number(document.querySelector('.written-arithmetic')?.getAttribute('data-written-step')) === index + 1, slot.hissanStep ?? 0);
                before = await readNative(page, profile); slot = before.plan.slots[before.plan.cursor];
                grid = expectedLearningModel(slot); step = grid.steps[slot.hissanStep ?? 0];
            }
            entry.question = slot.problem.questionText; entry.runtime = await runtimeMetadata(page);
            const values = step.inputCellIndices.map((col, i) => ({ col, value: step.correctValues[i] })).sort((a, b) => a.col - b.col).map(cell => cell.value).join('');
            const keypad = page.getByRole('group', { name: 'すうじ キーパッド' });
            const firstKey = keypad.getByRole('button', { name: '7', exact: true });
            const position = await firstKey.boundingBox();
            await page.evaluate(mode => { window.__hintDelay = mode === 'delayed'; window.__hintAbort = mode === 'failed'; }, scenario);
            await page.getByRole('button', { name: 'ヒントを みる' }).click();
            if (scenario === 'failed') {
                await page.keyboard.type(values[0], { delay: 35 });
                await page.getByText('まだ ほぞんできなかったよ。', { exact: false }).waitFor();
                assert(await page.evaluate(() => window.__hintAbortUsed));
                const firstCell = page.locator(`[data-written-input="${step.rowIndex}-${Math.min(...step.inputCellIndices)}"]`);
                assert.equal(await firstCell.innerText(), values[0]);
                await page.screenshot({ path: path.join(out, `${width}-failed-draft.png`) });
                await page.getByRole('button', { name: 'ヒントを みる' }).click();
                await page.keyboard.type(values.slice(1), { delay: 35 });
            } else {
                if (scenario === 'delayed') { await page.keyboard.type('9'); await page.keyboard.press('Backspace'); }
                await page.keyboard.type(values, { delay: 35 });
                if (scenario === 'delayed') {
                    assert(await page.evaluate(() => window.__hintDelayUsed));
                    assert.equal(await page.locator('.island-page').getAttribute('data-busy'), 'true');
                    for (const [i, col] of step.inputCellIndices.entries()) assert.equal(await page.locator(`[data-written-input="${step.rowIndex}-${col}"]`).innerText(), step.correctValues[i]);
                    await page.screenshot({ path: path.join(out, `${width}-pending-draft.png`) });
                }
            }
            await page.waitForFunction(step => Number(document.querySelector('.written-arithmetic')?.getAttribute('data-written-step')) === step + 1, slot.hissanStep ?? 0);
            const after = await readNative(page, profile);
            assert.equal(after.plan.revision, before.plan.revision + 2);
            assert.equal(after.plan.slots[before.plan.cursor].hissanStep, (slot.hissanStep ?? 0) + 1);
            assert.equal(after.plan.slots[before.plan.cursor].assisted, true);
            const newEvents = after.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
            assert.equal(newEvents.filter(event => event.action?.type === 'answer').length, 1);
            assert.equal(newEvents.filter(event => event.action?.type === 'support_opened').length, 1);
            assert.deepEqual(await firstKey.boundingBox(), position);
            assert.equal(await keypad.locator('[data-keypad-submit]').count(), 0);
            // The following step remains editable, without an Enter or replayed stray digit.
            assert.equal(await page.locator('[data-written-input][data-active="true"]').innerText(), '▏');
            if (width === 390) {
                await keypad.getByRole('button', { name: '7', exact: true }).tap();
                await keypad.getByRole('button', { name: 'ひとつ もどす' }).tap();
                assert.equal(await page.locator('[data-written-input][data-active="true"]').innerText(), '▏');
            }
            const hintButton = page.getByRole('button', { name: 'ヒントを みる' });
            if (await hintButton.isVisible()) await hintButton.click();
            await page.locator('[data-support-kind="hint"]').waitFor();
            entry.hint = await page.locator('[data-support-kind="hint"]').innerText();
            assert(!entry.hint.includes(grid.steps[(slot.hissanStep ?? 0) + 1].hint));
            await page.screenshot({ path: path.join(out, `${width}-${scenario}-next-row.png`) });
            assert.deepEqual(entry.errors, []); entry.pass = true;
        } catch (error) {
            entry.error = error.stack;
            await page.screenshot({ path: path.join(out, `${width}-${scenario}-failure.png`) }).catch(() => {});
            throw error;
        } finally { await context.close(); }
        console.log(`PASS ${width} ${scenario}`);
    }
    report.pass = true;
} finally { await browser.close(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
