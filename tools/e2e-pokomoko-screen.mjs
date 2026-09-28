import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile, fixtureModuleHash } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

// Real disposable-profile UI acquisition. No injected celebration, party reward,
// clock or visibility state. This focused journey does not establish throughput,
// physical sound, child comprehension or production/offline acceptance.
const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_SCREEN_OUTPUT || `output/playwright/pokomoko-screen-${Date.now()}`;
const candidate = 'pokomoko-pop-live-v8';
await fs.mkdir(out, { recursive: true });
async function hashSource() {
    const hash = createHash('sha256');
    async function walk(path) {
        for (const entry of (await fs.readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const child = `${path}/${entry.name}`;
            if (entry.isDirectory()) await walk(child); else hash.update(child).update(await fs.readFile(child));
        }
    }
    await walk('src');
    for (const file of ['package-lock.json', 'vite.config.ts', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-fixtures.mjs', 'tools/e2e-pokomoko-screen.mjs']) {
        hash.update(file).update(await fs.readFile(file));
    }
    return hash.digest('hex');
}
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceStart: await hashSource(), fixtureModuleHash,
    evidence: 'Seeded profile and memory; generated problems answered through real UI. No fake progress. Sound disabled. Focused integration, not visual approval, throughput or PWA evidence.', runs: [], pass: false };
const browser = await chromium.launch();
let page;
try {
    for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]
        .filter(value => !process.env.SANSU_SCREEN_LAYOUT || value.name === process.env.SANSU_SCREEN_LAYOUT)) {
        for (const reduced of [false, true]) {
            const name = `${viewport.name}-${reduced ? 'reduced' : 'motion'}`;
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
            page = await context.newPage(); page.setDefaultTimeout(10000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            const row = { name, viewport, reduced, answers: [], captures: [], screens: [], pass: false }; report.runs.push(row);
            const capture = async label => {
                const file = `${name}-${label}.png`;
                await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page) });
            };
            const screen = async label => {
                await page.locator('.pokomoko-screen-celebration canvas').waitFor({ state: 'attached' });
                await page.waitForFunction(reduced => {
                    const canvas = document.querySelector('.pokomoko-screen-celebration canvas');
                    return canvas?.dataset.running === String(!reduced);
                }, reduced);
                const value = await page.locator('.pokomoko-screen-celebration').evaluate(element => {
                    const canvas = element.querySelector('canvas'), rect = element.getBoundingClientRect(), size = canvas.getBoundingClientRect();
                    const key = document.querySelector('.park-keypad button[aria-label="こたえを けす"]');
                    const k = key.getBoundingClientRect(), hit = document.elementFromPoint(k.x + k.width / 2, k.y + k.height / 2);
                    return { kind: element.dataset.screenBurst, running: canvas.dataset.running, display: getComputedStyle(element).display,
                        pointerEvents: getComputedStyle(element).pointerEvents, canvasPointerEvents: getComputedStyle(canvas).pointerEvents,
                        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        canvas: { width: canvas.width, height: canvas.height, cssWidth: size.width, cssHeight: size.height },
                        viewport: { width: innerWidth, height: innerHeight }, keyHit: hit === key || key.contains(hit) };
                });
                row.screens.push({ label, ...value });
                assert.equal(value.pointerEvents, 'none'); assert.equal(value.canvasPointerEvents, 'none'); assert(value.keyHit);
                assert.equal(value.running, String(!reduced));
                if (reduced) assert.equal(value.display, 'none');
                else {
                    assert.deepEqual(value.rect, { x: 0, y: 0, ...value.viewport });
                    assert.equal(value.canvas.cssWidth, viewport.width); assert.equal(value.canvas.cssHeight, viewport.height);
                    assert(value.canvas.width >= viewport.width && value.canvas.height >= viewport.height);
                }
                // Tap a real keypad control through the active layer. An empty clear
                // cannot submit/advance a problem, but still proves actual targeting.
                await page.evaluate(() => {
                    window.__screenKeyHit = null;
                    document.addEventListener('click', event => { window.__screenKeyHit = event.target.closest('button')?.getAttribute('aria-label'); }, { once: true, capture: true });
                });
                await page.getByRole('button', { name: 'こたえを けす', exact: true }).tap();
                assert.equal(await page.evaluate(() => window.__screenKeyHit), 'こたえを けす');
            };
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            await page.waitForFunction(() => document.querySelector('.pokomoko-learning-actor-live')?.dataset.renderer === 'live-original');
            assert.equal(await page.locator('.island-workbench').getAttribute('data-learning-candidate'), candidate);
            await page.evaluate(() => document.fonts.ready);
            await capture('ready');
            let saved = await readNative(page, id);
            for (let i = 1; i <= 5; i++) {
                const answer = await answerUI(page, saved.plan, { touch: true, dev: false }); saved = answer.state;
                assert.equal(saved.island.learningParty.streak, i);
                const level = Number(await page.locator('.island-workbench').getAttribute('data-show-level'));
                assert.equal(level, Math.min(3, Math.floor(i / 3)));
                row.answers.push({ i, ms: answer.ms, party: saved.island.learningParty, level });
                if (i === 1) {
                    const receipt = page.locator('.pokomoko-answer-receipt');
                    await receipt.waitFor({ state: 'attached' });
                    row.ordinaryReceipt = await receipt.evaluate(element => {
                        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
                        return { text: element.textContent, role: element.getAttribute('role'), live: element.getAttribute('aria-live'),
                            atomic: element.getAttribute('aria-atomic'), clipPath: style.clipPath, animation: style.animationName,
                            width: rect.width, height: rect.height, display: style.display, visibility: style.visibility };
                    });
                    assert.equal(row.ordinaryReceipt.text, 'せいかい');
                    assert.equal(row.ordinaryReceipt.role, 'status'); assert.equal(row.ordinaryReceipt.live, 'polite');
                    assert.equal(row.ordinaryReceipt.atomic, 'true');
                    if (reduced) {
                        assert.equal(row.ordinaryReceipt.clipPath, 'none'); assert.equal(row.ordinaryReceipt.animation, 'none');
                        assert(row.ordinaryReceipt.width > 20 && row.ordinaryReceipt.height > 15);
                        assert.notEqual(row.ordinaryReceipt.display, 'none'); assert.equal(row.ordinaryReceipt.visibility, 'visible');
                    } else {
                        assert.equal(row.ordinaryReceipt.width, 1); assert.equal(row.ordinaryReceipt.height, 1);
                        assert.notEqual(row.ordinaryReceipt.clipPath, 'none');
                    }
                    await capture('ordinary-correct');
                }
                if ([3, 5].includes(i)) {
                    await screen(`streak-${i}`);
                    await page.waitForTimeout(220);
                    await capture(`streak-${i}`);
                }
            }
            const earned = saved.island.learningParty;
            await page.waitForTimeout(1750);
            assert.equal(await page.locator('.pokomoko-screen-celebration').count(), 0);
            assert.equal(await page.locator('.pokomoko-combo-number').count(), 0, 'Saved combo is not a permanent duplicate heading');
            assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), '1');
            await capture('settled');
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            assert.equal(await page.locator('.pokomoko-screen-celebration').count(), 0);
            await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            await page.reload();
            await page.locator('[data-input-ready=true]').waitFor();
            saved = await readNative(page, id);
            assert.deepEqual(saved.island.learningParty, earned);
            assert.equal(await page.locator('.pokomoko-screen-celebration').count(), 0, 'Saved five-streak resume does not replay the earned peak');
            assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), '0');
            await capture('saved-five-resume');
            for (let i = 6; i <= 8; i++) {
                saved = (await answerUI(page, saved.plan, { touch: true, dev: false })).state;
                assert.equal(saved.island.learningParty.streak, i);
            }
            const levelBeforeMiss = await page.locator('.island-workbench').getAttribute('data-show-level');
            assert.equal(levelBeforeMiss, '1');
            saved = (await answerUI(page, saved.plan, { incorrect: true, touch: true, dev: false })).state;
            assert.equal(saved.island.learningParty.streak, 0);
            assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), levelBeforeMiss);
            assert.equal(await page.locator('.pokomoko-screen-celebration').count(), 0, 'A retry cancels the old peak');
            await capture('retry');
            await page.waitForTimeout(1750);
            assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), levelBeforeMiss, 'Session visual progress survives a miss and settlement');
            // Complete the next real boundary without changing a reservation. At
            // most one six-question section is required after the initial answers.
            let section = false;
            for (let n = 0; n < 6; n++) {
                const previous = saved.plan;
                saved = (await answerUI(page, saved.plan, { touch: true, dev: false })).state;
                const kind = await page.locator('.pokomoko-screen-celebration').getAttribute('data-screen-burst').catch(() => null);
                if (kind === 'section') {
                    assert.notEqual(saved.plan.id, previous.id);
                    assert.equal(saved.islandPlans.find(plan => plan.id === previous.id).status, 'completed');
                    await screen('section');
                    assert.equal(await page.locator('.pokomoko-last-banner').textContent(), 'ひかりを とどけた！');
                    await page.waitForTimeout(260); await capture('section'); section = true;
                    break;
                }
            }
            assert(section, 'A real completed section presents its boundary banner');
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            assert.equal(await page.locator('.pokomoko-screen-celebration').count(), 0, 'Exit removes the viewport portal immediately');
            assert.deepEqual(errors, []);
            row.pass = true;
            await context.close();
        }
    }
    report.sourceEnd = await hashSource();
    assert.equal(report.sourceEnd, report.sourceStart, 'Application/harness sources changed during the journey; do not present mixed evidence as acceptance');
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error);
    if (page && !page.isClosed()) await page.screenshot({ path: `${out}/failure.png`, animations: 'allow' }).catch(() => {});
    throw error;
} finally {
    report.sourceEnd ??= await hashSource();
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(out);
}
