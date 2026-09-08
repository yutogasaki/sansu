import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, assertKeypad, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_SUBJECT_OUTPUT;
const sourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
assert(base && out && sourcePath, 'Set production URL, source manifest and a fresh subject QA output directory');
await fs.mkdir(out, { recursive: false });
const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceSnapshot = () => Promise.all(source.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) })));
const report = { target: base, startedAt: new Date().toISOString(), sourceHash: source.sourceHash,
    sourceStart: await sourceSnapshot(), scenarios: [], captures: [], pass: false,
    evidenceScope: 'Isolated native profile/memory fixtures; actual planner, answers, choices and automatic section boundaries. No saved problem replacement. Not a study of child comprehension or retention.' };
assert.deepEqual(report.sourceStart, source.files, 'Every frozen application input must match');
const browser = await chromium.launch();

async function capture(page, name, state) {
    const file = `${name}.png`, metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, source.revision);
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, planId: state?.plan?.id, subject: state?.plan?.subject,
        choice: state?.island?.nextSubjectChoice, completedSets: state?.island?.completedSets });
}
const ready = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false'
    && document.querySelector('.island-learning')?.getAttribute('data-input-ready') === 'true');
async function finish(page, id) {
    let state = await readNative(page, id), steps = 0;
    const planId = state.plan.id;
    while (state.plan.id === planId) {
        assert(++steps < 70, 'A real section must terminate');
        state = (await answerUI(page, state.plan, { dev: false })).state;
    }
    await ready(page);
    assert.equal(state.islandPlans.find(plan => plan.id === planId).status, 'completed');
    assert.equal(state.island.pendingRewards.length, 0);
    assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'learning');
    return state;
}
async function adjustFixture(page, id, mode) {
    await page.evaluate(async ({ id, mode }) => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const tx = database.transaction(['memoryMath', 'memoryVocab'], 'readwrite');
        let dueWords = 0;
        for (const name of ['memoryMath', 'memoryVocab']) {
            const store = tx.objectStore(name), rows = store.openCursor();
            rows.onsuccess = () => {
                const cursor = rows.result;
                if (!cursor) return;
                if (cursor.value.profileId === id) {
                    if (mode === 'new') cursor.delete();
                    else {
                        const value = { ...cursor.value, independentCorrectAnswers: 18 };
                        if (mode === 'overdue' && name === 'memoryVocab' && dueWords++ < 8) value.nextReview = '2000-01-01';
                        cursor.update(value);
                    }
                }
                cursor.continue();
            };
        }
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
        database.close();
    }, { id, mode });
}
async function toggle(page, selected) {
    if (page.viewportSize().width < 700) await page.locator('.island-subject-choice').tap();
    else await page.locator('.island-subject-choice').click();
    await page.locator(`.island-subject-choice[aria-pressed="${selected}"]`).waitFor();
    await ready(page);
}

try {
    for (const layout of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
        for (const mode of ['choice', 'overdue', 'new']) {
            const name = `${layout.name}-${mode}`;
            const context = await browser.newContext({ viewport: layout, hasTouch: layout.name === 'phone',
                reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
            const page = await context.newPage(), errors = [];
            page.setDefaultTimeout(15000);
            page.on('pageerror', error => errors.push(error.stack));
            try {
                await page.goto(`${base}/#/island`);
                await page.waitForURL('**/#/onboarding');
                const id = await seedLearningProfile(page, { skill: 'add_1d_1', subject: 'mix', type: 'number' });
                await adjustFixture(page, id, mode);
                await page.goto(`${base}/#/island`); await waitReady(page);
                if (mode === 'choice') await capture(page, `${name}-home`);
                await page.locator('.island-start').click(); await waitMode(page, 'learning'); await ready(page);
                let state = await readNative(page, id);
                assert.equal(state.plan.slots.length, 3);
                assert.equal(await page.locator('.island-subject-choice').getAttribute('aria-pressed'), 'false');
                const box = await page.locator('.island-subject-choice').boundingBox();
                assert(box.height >= 44 && box.width >= 44 && box.x >= 0 && box.x + box.width <= layout.width);
                if (state.plan.subject === 'math') await assertKeypad(page, true);
                await capture(page, `${name}-first`, state);
                if (mode === 'choice') {
                    assert.equal(state.plan.subject, 'math');
                    const before = structuredClone(state);
                    await page.locator('.park-input').click(); await page.keyboard.type('7');
                    await toggle(page, true);
                    assert.equal((await page.locator('.park-input').innerText()).trim(), '7', 'Choosing the next subject preserves the current draft');
                    state = await readNative(page, id);
                    assert.deepEqual(state.plan, before.plan); assert.deepEqual(state.logs, before.logs);
                    assert.deepEqual(state.memoryMath, before.memoryMath); assert.deepEqual(state.memoryVocab, before.memoryVocab);
                    assert.deepEqual(state.island.growth, before.island.growth);
                    await page.locator('.island-subject-choice').focus();
                    await page.keyboard.press('Enter');
                    await page.locator('.island-subject-choice[aria-pressed="false"]').waitFor(); await ready(page);
                    assert.deepEqual((await readNative(page, id)).plan, before.plan, 'Enter toggles the focused preference, without submitting the answer');
                    assert.equal((await page.locator('.park-input').innerText()).trim(), '7');
                    await page.getByRole('button', { name: 'こたえを けす', exact: true }).click();
                    await toggle(page, true);
                    await capture(page, `${name}-selected`, state);
                    await page.reload(); await waitReady(page); await ready(page);
                    assert.equal(await page.locator('.island-subject-choice').getAttribute('aria-pressed'), 'true');
                    assert.deepEqual((await readNative(page, id)).plan, before.plan);
                    await capture(page, `${name}-resumed`, await readNative(page, id));
                    await toggle(page, false);
                    assert.equal((await readNative(page, id)).island.nextSubjectChoice, undefined);
                    // One explicit native storage fault; no application hooks or fake answers.
                    await page.evaluate(() => {
                        const original = IDBObjectStore.prototype.put;
                        IDBObjectStore.prototype.put = function (value, ...args) {
                            if (this.name === 'islands' && value.nextSubjectChoice) {
                                IDBObjectStore.prototype.put = original;
                                this.transaction.abort();
                            }
                            return original.call(this, value, ...args);
                        };
                    });
                    await page.locator('.island-subject-choice').click();
                    await page.locator('.island-error').waitFor(); await ready(page);
                    assert.equal(await page.locator('.island-subject-choice').getAttribute('aria-pressed'), 'false');
                    assert.deepEqual((await readNative(page, id)).plan, before.plan);
                    await toggle(page, true);
                    state = await finish(page, id);
                    assert.equal(state.plan.subject, 'math');
                    assert.equal(state.island.nextSubjectChoice, undefined);
                    assert.equal(await page.locator('.island-subject-choice').getAttribute('aria-pressed'), 'false');
                    await capture(page, `${name}-continued`, state);
                    state = await finish(page, id);
                    assert.equal(state.plan.subject, 'vocab');
                    assert.equal(await page.locator('.island-subject-choice').getAttribute('aria-label'), 'つぎも えいたんご');
                    await capture(page, `${name}-english`, state);
                    await page.getByRole('button', { name: 'しまへ', exact: true }).click();
                    await waitMode(page, 'home'); await capture(page, `${name}-return`, state);
                } else {
                    const expected = mode === 'new' ? 'math' : 'vocab';
                    assert.equal(state.plan.subject, expected);
                    state = await finish(page, id); assert.equal(state.plan.subject, expected);
                    await capture(page, `${name}-continued`, state);
                    state = await finish(page, id); assert.notEqual(state.plan.subject, expected);
                    await capture(page, `${name}-switched`, state);
                }
                assert.deepEqual(errors, []);
                report.scenarios.push({ name, pass: true, completedSets: state.island.completedSets, ...await runtimeMetadata(page) });
                console.log(`PASS ${name}`);
            } catch (error) {
                await page.screenshot({ path: `${out}/${name}-failure.png` }).catch(() => undefined);
                report.scenarios.push({ name, pass: false, error: error.stack, pageErrors: errors });
                throw error;
            } finally { await context.close(); }
        }
    }
    report.sourceEnd = await sourceSnapshot();
    assert.deepEqual(report.sourceEnd, report.sourceStart);
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
