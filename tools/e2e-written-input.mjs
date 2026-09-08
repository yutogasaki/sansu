import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { seedLearningProfile, expectedLearningModel } from './island-learning-fixtures.mjs';
import { readNative, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_WRITTEN_URL || 'http://127.0.0.1:5620';
const parkBase = process.env.SANSU_WRITTEN_PARK_URL || base;
const out = path.resolve(process.env.SANSU_WRITTEN_OUTPUT || 'output/playwright/written-input');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.access(path.join(out, 'report.json')), { code: 'ENOENT' });
const report = { target: base, parkTarget: parkBase, scenarios: [], pass: false,
    scope: 'Disposable native profile fixtures; real generated questions, DOM input and saved receipts. A one-shot native transaction abort tests failed saves. Author inspection is not a child usability study.' };
const browser = await chromium.launch();
const pad = page => page.getByRole('group', { name: 'すうじ キーパッド' });
const cell = (page, step, index) => page.locator(`[data-written-input="${step.rowIndex}-${step.inputCellIndices[index]}"]`);
const rowValues = (page, step) => Promise.all(step.inputCellIndices.map((_, i) => cell(page, step, i).innerText().then(text => /^[0-9.]$/.test(text) ? text : '')));
const active = page => page.locator('[data-written-input][data-active="true"]').getAttribute('data-written-input');
async function assertActiveVisible(page) {
    assert(await page.locator('[data-written-input][data-active="true"]').evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'The current input cell is visible and receives a center hit, including inside clipped scroll areas');
}
const digitPositions = page => pad(page).locator('button').evaluateAll(buttons => buttons.filter(b => /^\d$/.test(b.getAttribute('aria-label')))
    .map(b => { const r = b.getBoundingClientRect(); return { digit: b.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height }; }));
async function type(page, text, touch) {
    if (!touch) return page.keyboard.type(text, { delay: 35 });
    for (const digit of text) await pad(page).getByRole('button', { name: digit, exact: true }).tap();
}
async function capture(page, entry, state) {
    const file = `${entry.name}-${state}.png`;
    await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
    entry.captures.push(file);
}
async function readPark(page, profileId) {
    return page.evaluate(async id => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('SansuDatabase'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        const get = name => new Promise(resolve => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result.filter(row => row.profileId === id)); });
        const [parks, plans, logs] = await Promise.all(['parks', 'parkPlans', 'logs'].map(get)); db.close();
        return { plan: plans.find(plan => plan.id === parks[0]?.pendingPlanId), logs };
    }, profileId);
}
async function saved(page, profileId, before, lane) {
    const read = lane === 'park' ? readPark : readNative;
    await page.waitForFunction(async ({ id, revision, lane }) => {
        const db = await new Promise(resolve => { const r = indexedDB.open('SansuDatabase'); r.onsuccess = () => resolve(r.result); });
        const r = db.transaction(lane === 'park' ? 'parkPlans' : 'islandPlans').objectStore(lane === 'park' ? 'parkPlans' : 'islandPlans').get(id);
        const plan = await new Promise(resolve => { r.onsuccess = () => resolve(r.result); }); db.close();
        return plan?.revision > revision;
    }, { id: before.plan.id, revision: before.plan.revision, lane });
    await pad(page).locator('[aria-label="7"]:enabled').waitFor();
    return read(page, profileId);
}

try {
    for (const lane of ['island', 'study', 'park']) for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
        const touch = viewport.width === 390;
        const entry = { name: `${lane}-${viewport.width}`, captures: [], errors: [], pass: false };
        report.scenarios.push(entry);
        const context = await browser.newContext({ viewport, hasTouch: touch, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => entry.errors.push(error.message));
        try {
            await page.addInitScript(() => {
                const put = IDBObjectStore.prototype.put;
                IDBObjectStore.prototype.put = function(value, ...args) {
                    const result = put.call(this, value, ...args);
                    if (this.name === 'islandPlans' && window.__abortWrittenOnce) {
                        window.__abortWrittenOnce = false; this.transaction.abort();
                    }
                    return result;
                };
            });
            const target = lane === 'park' ? parkBase : base;
            await page.goto(`${target}/#/settings`); await page.waitForURL('**/#/onboarding');
            const profileId = await seedLearningProfile(page, { skill: 'mul_3d2d', type: 'hissan' });
            let state, grid;
            if (lane === 'island') {
                await page.goto(`${target}/#/island`); await waitReady(page);
                await page.locator('.island-start').click(); await page.locator('[data-input-ready="true"] .written-arithmetic').waitFor();
                state = await readNative(page, profileId); grid = expectedLearningModel(state.plan.slots[0]);
                entry.runtime = await runtimeMetadata(page);
            } else if (lane === 'park') {
                await page.goto(`${target}/#/park`); await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('button', { name: 'シャボンゲートを つくる', exact: true }).click();
                await page.locator('.written-arithmetic').waitFor();
                state = await readPark(page, profileId); grid = expectedLearningModel(state.plan.slots[0]);
            } else {
                await page.goto(`${target}/#/study?session=review&force_review=1&focus_subject=math&focus_ids=mul_3d2d`);
                await page.locator('[data-study-index="0"] .written-arithmetic').waitFor();
                const questionText = await page.locator('[data-study-index="0"]').getAttribute('data-question-text');
                const [, a, b] = questionText.match(/(\d+)\s*×\s*(\d+)/);
                grid = expectedLearningModel({ problem: { questionText, correctAnswer: String(Number(a) * Number(b)), hissanVersion: 2 } });
            }
            assert(grid.steps.length >= 3);
            const correctionIndex = grid.steps.findIndex(step => step.correctValues.length >= 3 && step.index < grid.steps.length - 1);
            assert(correctionIndex >= 0);
            // A generated multiplier may end in 0. Complete that short row normally.
            for (let i = 0; i < correctionIndex; i++) {
                await type(page, grid.steps[i].correctValues.join(''), touch);
                if (state) state = await saved(page, profileId, state, lane);
                await page.locator(`[data-written-step="${i + 1}"]`).waitFor();
            }
            const first = grid.steps[correctionIndex];
            const positions = await digitPositions(page);
            assert.equal(positions.length, 10);
            for (const p of positions) assert(p.width >= 44 && p.height >= 44 && p.x >= 0 && p.y >= 0 && p.x + p.width <= viewport.width + 1 && p.y + p.height <= viewport.height + 1, JSON.stringify(p));
            assert.equal(await page.locator('[data-keypad-submit]').count(), 0);
            assert.equal(await pad(page).getByRole('button', { name: /カーソル/ }).count(), 0);
            await capture(page, entry, 'ready');
            await assertActiveVisible(page);

            const last = first.correctValues.length - 1;
            const wrong = first.correctValues.map((v, i) => i === 0 || i === last ? String((Number(v) + 1) % 10) : v);
            await type(page, wrong.join(''), touch);
            if (state) state = await saved(page, profileId, state, lane);
            await page.locator('[data-written-correction="true"]').waitFor();
            const retained = first.correctValues.map((v, i) => i === 0 || i === last ? '' : v);
            assert.deepEqual(await rowValues(page, first), retained);
            assert.equal(await active(page), `${first.rowIndex}-${first.inputCellIndices[0]}`);
            await capture(page, entry, 'two-holes');
            await assertActiveVisible(page);
            await type(page, first.correctValues[0], touch);
            assert.equal(await active(page), `${first.rowIndex}-${first.inputCellIndices[last]}`);
            await pad(page).getByRole('button', { name: 'ひとつ もどす', exact: true }).click();
            assert.deepEqual(await rowValues(page, first), retained, 'Backspace undoes the last typed digit, preserving skipped correct cells');
            await type(page, first.correctValues[0], touch);
            if (lane !== 'study') {
                const beforeHelp = await rowValues(page, first);
                await page.getByRole('button', { name: lane === 'island' ? 'ヒントを みる' : 'いっしょに みる', exact: true }).click();
                state = await saved(page, profileId, state, lane);
                assert.deepEqual(await rowValues(page, first), beforeHelp, 'Opening support retains the corrected draft');
                assert.equal(await active(page), `${first.rowIndex}-${first.inputCellIndices[last]}`);
            }
            await type(page, first.correctValues[last], touch);
            if (state) state = await saved(page, profileId, state, lane);
            await page.locator(`[data-written-step="${correctionIndex + 1}"]`).waitFor();
            assert.deepEqual(await digitPositions(page), positions, 'Digit targets stay put through retry and step changes');
            await capture(page, entry, 'next-row');
            await assertActiveVisible(page);
            entry.correctionDigits = 2; entry.rowDigits = first.correctValues.length;

            let start = correctionIndex + 1;
            if (lane === 'island') {
                const second = grid.steps[start];
                await page.evaluate(() => { window.__abortWrittenOnce = true; });
                await type(page, second.correctValues.join(''), touch);
                await page.locator('.island-error').waitFor();
                await page.locator('[data-keypad-submit]:enabled').waitFor();
                assert.deepEqual(await rowValues(page, second), second.correctValues);
                assert.equal((await readNative(page, profileId)).plan.revision, state.plan.revision);
                await capture(page, entry, 'save-retry');
                await page.keyboard.press('Enter'); state = await saved(page, profileId, state, lane);
                start++;
                if (start < grid.steps.length) await page.locator(`[data-written-step="${start}"]`).waitFor();
            }
            // One continuous physical typing run spans row boundaries; no Enter or row wait.
            if (!touch) await type(page, grid.steps.slice(start).flatMap(step => step.correctValues).join(''), false);
            else for (let i = start; i < grid.steps.length; i++) {
                await page.locator(`[data-written-step="${i}"]`).waitFor();
                await type(page, grid.steps[i].correctValues.join(''), true);
            }
            if (lane === 'study') await page.locator('[data-study-index="1"][data-feedback="none"]').waitFor();
            else {
                state = await saved(page, profileId, state, lane);
                assert.equal(state.plan.cursor, 1);
            }
            const logs = lane === 'park' ? (await readPark(page, profileId)).logs : (await readNative(page, profileId)).logs;
            const correct = logs.filter(log => log.result === 'correct');
            if (correct.length) assert.equal(correct[0].learningEvidence.assistance, 'assisted');
            assert.deepEqual(entry.errors, []);
            await capture(page, entry, 'completed'); entry.pass = true;
            console.log(`PASS ${entry.name}: ${entry.rowDigits} digit row, ${entry.correctionDigits} correction digits`);
        } catch (error) { entry.error = error.stack; await capture(page, entry, 'failure').catch(() => {}); throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const cards = report.scenarios.flatMap(s => s.captures.map(file => `<figure><figcaption>${file}</figcaption><img src="${file}"></figure>`)).join('');
    await fs.writeFile(path.join(out, 'review.html'), `<!doctype html><meta charset="utf-8"><title>筆算の入力・訂正</title><style>body{font:16px system-ui;background:#eef3ef;color:#183c40;margin:24px}main{display:flex;gap:20px;flex-wrap:wrap}figure{margin:0;width:340px}img{width:100%;border:1px solid #aab}figcaption{padding:12px 0}</style><h1>筆算の入力・訂正</h1><p>実アプリの入力、部分訂正、次段、保存失敗からの再送。</p><main>${cards}</main>`);
    await browser.close();
}
