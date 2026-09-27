import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5230';
const out = process.env.SANSU_POKOMOKO_OUTPUT || `output/playwright/pokomoko-feedback-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
async function sourceHash() {
    const hash = createHash('sha256');
    async function walk(path) { for (const entry of (await fs.readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = `${path}/${entry.name}`; if (entry.isDirectory()) await walk(file); else hash.update(file).update(await fs.readFile(file));
    } }
    await walk('src'); hash.update(await fs.readFile('package-lock.json')); return hash.digest('hex');
}
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceStart: await sourceHash(), qaHash: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),
    evidence: 'Disposable profile/memory fixture; normal planner and actual UI answers. Live animation screenshots. No physical device, speaker, or child evaluation.', runs: [], pass: false };
const browser = await chromium.launch();
let page;
try {
    for (const layout of (process.env.SANSU_POKOMOKO_INPUTS_ONLY ? [] : [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'landscape', width: 844, height: 390 }])) {
        for (const reduced of [false, true]) {
            const name = `${layout.name}-${reduced ? 'reduced' : 'motion'}`;
            const context = await browser.newContext({ viewport: layout, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
            page = await context.newPage(); page.setDefaultTimeout(20000);
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            const row = { name, captures: [], answers: [], pass: false }; report.runs.push(row);
            async function capture(label) {
                const file = `${name}-${label}.png`;
                if (['answer', 'section', 'supported'].includes(label)) await page.waitForTimeout(240);
                await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page) });
            }
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            await capture('home');
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            const actor = page.locator('.pokomoko-learning-actor > img');
            await actor.waitFor({ state: 'visible' });
            await actor.evaluate(img => img.decode());
            await capture('ready');
            row.runtime = await runtimeMetadata(page);
            row.layout = await page.locator('.park-keypad').evaluate(el => [...el.querySelectorAll('button')].map(button => {
                const r = button.getBoundingClientRect(); return { key: button.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height, visible: r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
            }));
            for (const key of row.layout.filter(k => /^\d$/.test(k.key))) assert(key.width >= 44 && key.height >= 44 && key.visible, JSON.stringify(key));
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            let saved = await readNative(page, id);
            await answerUI(page, saved.plan, { incorrect: true, touch: true });
            assert.equal(await page.locator('.pokomoko-burst').count(), 0, 'Wrong answers never get a success burst');
            assert.equal(await page.locator('.pokomoko-learning-feedback').getAttribute('data-pose'), 'ready');
            await capture('retry');
            saved = await readNative(page, id);
            row.answers.push((await answerUI(page, saved.plan, { touch: true })).ms);
            await page.locator('[data-burst=answer]').waitFor({ state: 'attached' });
            assert.equal(await page.locator('[data-input-ready=true]').count(), 1, 'Input is ready during the burst');
            const animation = await actor.evaluate(el => getComputedStyle(el).animationName);
            assert.equal(animation === 'none', reduced);
            await capture('answer');
            // Physical input is accepted while the previous answer still celebrates.
            const beforeInput = await readNative(page, id);
            const digit = String(beforeInput.plan.slots[beforeInput.plan.cursor].problem.correctAnswer)[0];
            await page.evaluate(() => {
                window.__digitCues = [];
                const observer = new MutationObserver(() => {
                    const cue = document.querySelector('.pokomoko-input-spark');
                    if (cue) window.__digitCues.push({ x: cue.style.left, y: cue.style.top });
                });
                observer.observe(document.querySelector('.island-workbench'), { childList: true, subtree: true });
            });
            await page.keyboard.type(digit);
            await page.waitForFunction(() => window.__digitCues.length > 0);
            row.physicalDigitCues = await page.evaluate(() => window.__digitCues);
            // Clear an incomplete draft; completed answers remain saved.
            await page.locator('[data-input-ready=true]').waitFor();
            await page.getByRole('button', { name: 'こたえを けす', exact: true }).click();
            saved = await readNative(page, id);
            const section = saved.plan.id;
            while (saved.plan.id === section) { const result = await answerUI(page, saved.plan, { touch: true }); row.answers.push(result.ms); saved = result.state; }
            await page.locator('[data-burst=section]').waitFor({ state: 'attached' });
            assert.equal(await page.locator('.pokomoko-confetti').count(), 28);
            await capture('section');
            // Opening help immediately clears success; completing with it still celebrates.
            await page.getByRole('button', { name: 'わからない', exact: true }).click();
            await page.getByRole('button', { name: 'おてほんを みる', exact: true }).click();
            await page.getByRole('button', { name: 'つぎへ すすむ', exact: true }).click();
            await page.locator('[data-result=supported]').waitFor();
            await page.locator('.pokomoko-burst').waitFor({ state: 'attached' });
            await capture('supported');
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).waitFor();
            await capture('return');
            await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).click();
            assert.equal(await page.locator('.pokomoko-burst').count(), 0, 'Returning does not replay old success');
            const resume = await readNative(page, id);
            await page.reload();
            await page.locator('.island-page').waitFor();
            if (await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).isVisible()) await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            const reloaded = await readNative(page, id);
            assert.equal(reloaded.plan.id, resume.plan.id); assert.equal(reloaded.plan.cursor, resume.plan.cursor);
            assert.equal(await page.locator('.pokomoko-burst').count(), 0);
            assert.deepEqual(errors, []);
            row.pass = true; await context.close(); console.log(`${name}: PASS`);
        }
    }
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        for (const scenario of [{ name: 'hissan', skill: 'add_2d1d_hissan_c', type: 'hissan' },
            { name: 'hissan-multi', skill: 'mul_2d2d', type: 'hissan', intermediateSteps: true },
            { name: 'fraction', skill: 'frac_add_same', type: 'multi-number' }, { name: 'english', subject: 'vocab', type: 'choice' }]
            .filter(scenario => !process.env.SANSU_POKOMOKO_INPUT_CASE || scenario.name === process.env.SANSU_POKOMOKO_INPUT_CASE)) {
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'no-preference' });
            page = await context.newPage(); page.setDefaultTimeout(20000);
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            const row = { name: `${viewport.width}-${scenario.name}`, captures: [], pass: false }; report.runs.push(row);
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, scenario);
            await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            const capture = async label => {
                const file = `${row.name}-${label}.png`;
                await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page) });
            };
            await capture('ready');
            let saved = await readNative(page, id);
            const initialCursor = saved.plan.cursor;
            let steps = 0;
            do {
                const result = await answerUI(page, saved.plan, { touch: true }); saved = result.state;
                if (saved.plan.cursor === initialCursor) {
                    steps++;
                    await page.locator('[data-burst=step]').waitFor({ state: 'attached' });
                    assert.equal(await page.locator('[data-result=step]').innerText(), 'このだんは せいかい');
                    assert.equal(await page.locator('.pokomoko-confetti').count(), 6);
                    if (steps === 1) await capture('step');
                }
            } while (saved.plan.cursor === initialCursor && steps < 10);
            assert.notEqual(saved.plan.cursor, initialCursor);
            if (scenario.intermediateSteps) assert(steps > 0, 'Multi-row arithmetic must exercise intermediate feedback');
            await page.locator('[data-burst=answer]').waitFor({ state: 'attached' });
            await page.waitForTimeout(180); await capture('answer');
            const geometry = await page.locator('.park-answer').evaluate(root => [...root.querySelectorAll('.park-keypad button, .park-choices button')].map(el => {
                const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, bottom: r.bottom, max: innerHeight };
            }));
            assert(geometry.every(r => r.w >= 44 && r.h >= 44 && r.bottom <= r.max));
            await page.getByRole('button', { name: 'わからない', exact: true }).click();
            await page.getByRole('button', { name: 'おてほんを みる', exact: true }).click();
            await page.locator('[data-support-stage=model]').waitFor();
            const model = await readNative(page, id);
            await page.keyboard.type('2');
            assert.equal((await readNative(page, id)).plan.revision, model.plan.revision, 'Model keeps physical answer input disabled');
            assert.equal(await page.locator('.pokomoko-input-spark').count(), 0);
            await capture('model');
            assert.deepEqual(errors, []);
            row.steps = steps; row.pass = true; console.log(`${row.name}: PASS`); await context.close();
        }
    }
    report.sourceEnd = await sourceHash(); assert.equal(report.sourceStart, report.sourceEnd);
    report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (page && !page.isClosed()) await page.screenshot({ path: `${out}/failure.png` });
    throw error;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(out);
}
