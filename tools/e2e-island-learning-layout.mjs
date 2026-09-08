import { chromium, webkit } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, waitLearningReady } from './island-learning-checks.mjs';
import { expectedLearningAnswer, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_LEARNING_LAYOUT_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_LEARNING_LAYOUT_OUTPUT || 'output/playwright/learning-focus/layout';
const engine = process.env.SANSU_LEARNING_LAYOUT_BROWSER || 'chromium';
const scenarios = [
    { name: 'number', skill: 'add_1d_1', type: 'number' },
    { name: 'base-ten', skill: 'sub_2d1d_nc_bridge', type: 'number' },
    { name: 'fraction', skill: 'frac_add_same', type: 'multi-number' },
    { name: 'written-add', skill: 'add_2d1d_hissan_c', type: 'hissan' },
    { name: 'written-multiply', skill: 'mul_2d2d', type: 'hissan' },
    { name: 'written-divide', skill: 'div_3d1d_exact', type: 'hissan' },
    { name: 'vocabulary', skill: '', subject: 'vocab', type: 'choice' },
].filter(row => !process.env.SANSU_LEARNING_LAYOUT_SCENARIO || row.name === process.env.SANSU_LEARNING_LAYOUT_SCENARIO);
const viewports = [
    { width: 1024, height: 768 }, { width: 1024, height: 640 },
    { width: 1180, height: 720 }, { width: 768, height: 1024 },
    { width: 820, height: 1080 }, { width: 390, height: 844 }, { width: 390, height: 640 },
];
assert(scenarios.length);
await fs.mkdir(out, { recursive: true });
const report = { target: base, engine, startedAt: new Date().toISOString(), pass: false, scenarios: [],
    scope: 'Isolated native profile/memory fixtures with normal reserved problems. Real touch/keyboard input and viewport rotation. Local browser layout evidence, not physical iPad or child observation.' };
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });

async function capture(page, name) {
    await page.screenshot({ path: `${out}/${name}.png` });
    return { file: `${name}.png`, ...await runtimeMetadata(page) };
}

async function assertViewport(page, model = false) {
    assert.equal(await page.locator('.island-stage').isVisible(), false, 'Learning gives the island area back to the problem');
    const geometry = await page.locator('.island-page').evaluate(root => ({
        height: root.clientHeight, scrollHeight: root.scrollHeight, scrollTop: root.scrollTop,
        width: root.clientWidth, scrollWidth: root.scrollWidth,
    }));
    assert(geometry.scrollHeight <= geometry.height + 1, `The learning page must fit: ${JSON.stringify(geometry)}`);
    assert(geometry.scrollWidth <= geometry.width + 1 && geometry.scrollTop === 0, 'The learning page does not scroll');
    if (model) {
        assert.equal(await page.locator('.park-keypad').isVisible(), false, 'The existing model has no answer input');
        const next = await button(page, 'つぎへ すすむ').evaluate(element => {
            const r = element.getBoundingClientRect();
            return { height: r.height, top: r.top, bottom: r.bottom, viewport: innerHeight };
        });
        assert(next.height >= 44 && next.top >= 0 && next.bottom <= next.viewport, 'Model continuation stays visible');
        return geometry;
    }
    const controls = await assertControls(page); // Never scroll a key into view to pass.
    const scrollers = page.locator('.park-question, .park-support, .written-history');
    for (const scroller of await scrollers.all()) {
        const scrollable = await scroller.evaluate(element => element.scrollHeight > element.clientHeight + 1);
        if (!scrollable) continue;
        await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
        assert.deepEqual(await assertControls(page), controls, 'Scrolling problem content must never move input controls');
        await scroller.evaluate(element => { element.scrollTop = 0; });
    }
    return { ...geometry, controls, keypad: await page.locator('.park-keypad').count() ? await page.locator('.park-keypad').boundingBox() : null };
}

async function viewportMatrix(page, row, phase) {
    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const check = { phase, ...viewport, ...await assertViewport(page, phase === 'model') };
        row.checks.push(check);
        if (phase === 'hint') {
            const ready = row.checks.find(prior => prior.phase === 'next-ready' && prior.width === check.width && prior.height === check.height);
            assert.deepEqual(check.keypad, ready.keypad, 'Opening a hint must not move or shrink the keypad');
        }
        if (phase === 'ready' || viewport.width === 1024 && viewport.height === 640 || viewport.width === 390 && viewport.height === 844) {
            row.captures.push(await capture(page, `${row.name}-${phase}-${viewport.width}x${viewport.height}`));
        }
    }
}

async function answerStep(page, state, touch) {
    const slot = state.plan.slots[state.plan.cursor];
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    const expected = expectedLearningAnswer(slot, type);
    const automatic = await page.locator('.park-answer').getAttribute('data-answer-completion') === 'automatic';
    if (type === 'choice') {
        const choice = slot.problem.inputConfig.choices.find(choice => choice.value === expected.values);
        await page.locator('.park-choices').getByRole('button', { name: choice.label, exact: true }).tap();
    } else {
        const values = Array.isArray(expected.values) ? expected.values : [expected.values];
        for (const [index, value] of values.entries()) {
            if (type !== 'hissan') await page.locator('.park-input').nth(index).tap();
            for (const digit of String(value)) {
                if (touch) await page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }).tap();
                else await page.keyboard.type(digit);
            }
        }
        if (!automatic) await page.locator('.park-keypad [data-keypad-submit]').tap();
    }
    await waitLearningReady(page, { ...state.plan, revision: state.plan.revision + 1 });
    return readNative(page, state.plan.profileId);
}

try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: viewports[1], hasTouch: true, serviceWorkers: 'block',
            reducedMotion: scenario.name === 'written-divide' ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const row = { ...scenario, checks: [], captures: [], errors: [], pass: false };
        report.scenarios.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            const profileId = await seedLearningProfile(page, scenario);
            await page.goto(`${base}/#/island`);
            await waitReady(page);
            if (scenario.name === 'written-multiply') row.captures.push(await capture(page, `${row.name}-home-before`));
            await page.locator('.island-start').tap();
            await waitMode(page, 'learning');
            let state = await readNative(page, profileId);
            await waitLearningReady(page, state.plan);
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            const frozen = state.plan;
            await viewportMatrix(page, row, 'ready');
            assert.deepEqual((await readNative(page, profileId)).plan, frozen, 'Resizing and scrolling never change learning');
            await page.setViewportSize(viewports[1]);
            let steps = 0;
            while (state.plan.cursor === 0 && steps < 30) {
                await assertViewport(page);
                state = await answerStep(page, state, steps % 2 === 0);
                steps++;
                if (state.plan.cursor === 0) {
                    await assertViewport(page);
                    row.captures.push(await capture(page, `${row.name}-step-${steps}`));
                }
            }
            assert.equal(state.plan.cursor, 1, 'The real first problem completes');
            row.answerSteps = steps;
            await viewportMatrix(page, row, 'next-ready');
            await button(page, 'ヒントを みる').tap();
            state = await readNative(page, profileId);
            await page.locator('.island-answer-stage[data-support-stage=hint]').waitFor();
            await viewportMatrix(page, row, 'hint');
            await button(page, 'おてほんを みる').tap();
            await page.locator('.island-answer-stage[data-support-stage=model]').waitFor();
            await viewportMatrix(page, row, 'model');
            await button(page, 'つぎへ すすむ').tap();
            await page.locator('.island-answer-stage[data-support-stage=none]').waitFor();
            state = await readNative(page, profileId);
            await button(page, 'しまへ').tap();
            await waitMode(page, 'home'); await waitReady(page);
            row.captures.push(await capture(page, `${row.name}-home-return`));
            assert.deepEqual((await readNative(page, profileId)).plan, state.plan);
            await page.locator('.island-start').tap();
            await waitLearningReady(page, state.plan);
            await assertViewport(page);
            await page.reload();
            await waitLearningReady(page, state.plan);
            await assertViewport(page);
            assert.deepEqual((await readNative(page, profileId)).plan, state.plan, 'Reload resumes the same reserved problem');
            assert.deepEqual(row.errors, []);
            row.pass = true;
            console.log(`PASS ${scenario.name}: ${row.checks.length} layouts, ${steps} answer steps, return/reload`);
        } catch (error) {
            row.error = error.stack;
            await page.screenshot({ path: `${out}/${row.name}-failure.png` }).catch(() => {});
            throw error;
        } finally {
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
            await context.close();
        }
    }
    report.pass = true;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
