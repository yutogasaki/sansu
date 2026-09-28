import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, assertKeypad, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5230';
const candidate = 'pokomoko-pop-live-v7';
const out = process.env.SANSU_POKOMOKO_OUTPUT || `output/playwright/pokomoko-feedback-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
async function sourceHash() {
    const hash = createHash('sha256');
    async function walk(path) { for (const entry of (await fs.readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = `${path}/${entry.name}`; if (entry.isDirectory()) await walk(file); else hash.update(file).update(await fs.readFile(file));
    } }
    await walk('src'); hash.update(await fs.readFile('package-lock.json')); return hash.digest('hex');
}

// Scope these readings to the learning actor: the hidden island world may also
// own a THREE canvas and renderer metadata.
async function assertLiveActor(page, reduced) {
    const actor = page.locator('.pokomoko-learning-actor-live');
    await actor.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.pokomoko-learning-actor-live')?.dataset.renderer === 'live-original');
    const state = await actor.evaluate(async element => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const surface = element.querySelector('canvas'), hand = element.querySelector('.pokomoko-hand-anchor');
        const a = element.getBoundingClientRect(), c = surface?.getBoundingClientRect(), h = hand?.getBoundingClientRect();
        return {
            renderer: element.dataset.renderer, reducedMotion: element.dataset.reducedMotion,
            renderCount: Number(element.dataset.renderCount), fallbackUrl: element.dataset.fallbackUrl,
            canvas: surface && { width: surface.width, height: surface.height, cssWidth: c.width, cssHeight: c.height,
                visible: getComputedStyle(surface).visibility !== 'hidden' },
            hand: h && { x: h.left - a.left, y: h.top - a.top,
                contained: h.left >= a.left && h.top >= a.top && h.right <= a.right && h.bottom <= a.bottom },
        };
    });
    assert.equal(state.renderer, 'live-original', 'Normal journeys must render the original live model; fallback is separate evidence');
    assert.equal(state.reducedMotion, String(reduced));
    assert(state.renderCount > 0, 'The actor must have rendered a real frame');
    assert(state.canvas?.visible && state.canvas.width > 0 && state.canvas.height > 0
        && state.canvas.cssWidth >= 100 && state.canvas.cssHeight >= 100, JSON.stringify(state));
    assert(state.hand?.contained, `The projected paw contact must remain on the actor: ${JSON.stringify(state.hand)}`);
    return state;
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
            assert.equal(await page.locator('.island-workbench').getAttribute('data-learning-candidate'), candidate);
            row.actor = await assertLiveActor(page, reduced);
            await assertKeypad(page);
            if (reduced) {
                const surface = page.locator('.pokomoko-learning-actor-live canvas');
                const before = await surface.screenshot({ animations: 'allow' });
                await page.waitForTimeout(120);
                const after = await surface.screenshot({ animations: 'allow' });
                assert.equal(createHash('sha256').update(before).digest('hex'), createHash('sha256').update(after).digest('hex'), 'Reduced motion keeps the rendered actor stable');
                row.reducedActorStable = true;
            }
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
            row.answerActor = await assertLiveActor(page, reduced);
            await capture('answer');
            // Physical input is accepted while the previous answer still celebrates.
            const beforeInput = await readNative(page, id);
            const digit = String(beforeInput.plan.slots[beforeInput.plan.cursor].problem.correctAnswer)[0];
            await page.evaluate(() => {
                window.__digitCues = [];
                const observer = new MutationObserver(() => {
                    const cue = document.querySelector('.pokomoko-input-flight');
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
            await page.locator('.pokomoko-burst').waitFor({ state: 'attached' });
            assert(['section', 'jump', 'ride', 'stamp'].includes(await page.locator('.pokomoko-burst').getAttribute('data-burst')));
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
            // A separate rendering-fault diagnostic: the learning transaction
            // remains usable while the original model's fallback is visible.
            if (layout.name === 'phone' && !reduced) {
                const actor = page.locator('.pokomoko-learning-actor-live');
                await assertLiveActor(page, false);
                const canLose = await actor.locator('canvas').evaluate(surface => {
                    const extension = surface.getContext('webgl2')?.getExtension('WEBGL_lose_context');
                    if (!extension) return false;
                    window.__learningContextLoss = extension;
                    extension.loseContext(); return true;
                });
                assert(canLose, 'This WebGL diagnostic requires WEBGL_lose_context');
                await page.waitForFunction(() => document.querySelector('.pokomoko-learning-actor-live')?.dataset.renderer === 'original-fallback');
                row.contextLoss = await actor.evaluate(async element => {
                    const fallback = [...element.children].find(child => getComputedStyle(child).backgroundImage !== 'none');
                    const image = new Image(); image.src = element.dataset.fallbackUrl; await image.decode();
                    return { renderer: element.dataset.renderer, fallbackUrl: image.src, width: image.naturalWidth,
                        fallbackVisible: Boolean(fallback && getComputedStyle(fallback).visibility === 'visible'),
                        canvasHidden: getComputedStyle(element.querySelector('canvas')).visibility === 'hidden' };
                });
                assert(row.contextLoss.fallbackVisible && row.contextLoss.canvasHidden && row.contextLoss.width > 0);
                await capture('context-lost');
                const pending = await readNative(page, id);
                row.contextLoss.answerMs = (await answerUI(page, pending.plan, { touch: true })).ms;
                assert.equal(await page.locator('[data-input-ready=true]').count(), 1);
                await page.evaluate(() => window.__learningContextLoss.restoreContext());
                row.contextRestored = await assertLiveActor(page, false);
            }
            assert.deepEqual(errors, []);
            row.pass = true; await context.close(); console.log(`${name}: PASS`);
        }
    }
    for (const viewport of (process.env.SANSU_POKOMOKO_SMALL_INPUTS ? [{ width: 320, height: 568 }, { width: 844, height: 390 }] : [{ width: 390, height: 844 }, { width: 768, height: 1024 }])) {
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
            // A fraction sum may legitimately be a whole number (e.g. 5/12 + 7/12).
            // Answer those real questions until the planner offers a two-cell fraction.
            for (let n = 0; scenario.name === 'fraction' && n < 12 && await page.locator('.park-answer').getAttribute('data-input-type') !== scenario.type; n++) {
                const preparation = await readNative(page, id);
                await answerUI(page, preparation.plan, { touch: true });
            }
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            const capture = async label => {
                const file = `${row.name}-${label}.png`;
                await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page) });
            };
            assert.equal(await page.locator('.island-workbench').getAttribute('data-learning-candidate'), candidate);
            row.actor = process.env.SANSU_POKOMOKO_SMALL_INPUTS ? { renderer: await page.locator('.pokomoko-learning-actor-live').getAttribute('data-renderer') } : await assertLiveActor(page, false);
            await assertKeypad(page);
            row.inputHitTargets = await page.locator('.park-keypad button, .park-input, .island-learning-actions button').evaluateAll(buttons => buttons.map(button => {
                const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return { name: button.getAttribute('aria-label') || button.textContent, width: r.width, height: r.height,
                    reachable: r.top >= 0 && r.bottom <= innerHeight && (hit === button || button.contains(hit)) };
            }));
            for (const target of row.inputHitTargets) assert(target.width >= 44 && target.height >= 44 && target.reachable, JSON.stringify(target));
            await capture('ready');
            let saved = await readNative(page, id);
            const initialCursor = saved.plan.cursor, initialParty = saved.island.learningParty;
            let steps = 0;
            do {
                const result = await answerUI(page, saved.plan, { touch: true }); saved = result.state;
                if (saved.plan.cursor === initialCursor) {
                    steps++;
                    assert.deepEqual(saved.island.learningParty, initialParty, 'An intermediate row does not advance play');
                    // Read the short-lived pose and its message in one browser turn.
                    // Separate protocol round trips can outlive this 500 ms cue.
                    const stepCue = await page.locator('[data-burst=step]').evaluate(el => ({
                        pose: el.dataset.pose, text: el.querySelector('[data-result=step]')?.textContent,
                    }));
                    assert.equal(stepCue.text, 'このだんは せいかい');
                    assert.equal(stepCue.pose, 'step');
                    if (steps === 1) await capture('step');
                }
            } while (saved.plan.cursor === initialCursor && steps < 10);
            assert.notEqual(saved.plan.cursor, initialCursor);
            assert.equal(saved.island.learningParty.streak, (initialParty?.streak ?? 0) + 1);
            assert.equal(saved.island.learningParty.light, Math.min(30, (initialParty?.light ?? 0) + (initialParty?.rideRemaining > 0 ? 2 : 1)));
            if (scenario.intermediateSteps) assert(steps > 0, 'Multi-row arithmetic must exercise intermediate feedback');
            await page.locator('.pokomoko-burst:not([data-burst=step])').waitFor({ state: 'attached' });
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
            assert.equal(await page.locator('.pokomoko-input-flight').count(), 0);
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
