import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { seedLearningProfile, expectedLearningAnswer } from './island-learning-fixtures.mjs';
import { readNative, runtimeMetadata, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, assertProblemMeaning, waitLearningReady } from './island-learning-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = path.resolve(process.env.SANSU_ISLAND_LANDSCAPE_OUTPUT || 'output/playwright/island-landscape');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.access(path.join(out, 'report.json')), { code: 'ENOENT' }, 'Use a fresh output directory');
const report = { target: base, startedAt: new Date().toISOString(), scenarios: [], pass: false,
    scope: 'Disposable native profile/memory fixtures, real planner and input. Chromium/WebKit viewport checks are not physical iPad Safari or installed-PWA verification.' };
const scenarios = [
    { name: 'number', skill: 'add_2d1d_nc', type: 'number', rotate: true },
    { name: 'count', skill: 'count_10', type: 'number' },
    { name: 'base10', skill: 'sub_2d1d_nc_bridge', type: 'number', visual: 'operation-base10' },
    { name: 'decimal', skill: 'dec_add', type: 'number' },
    { name: 'fraction', skill: 'frac_add_same', type: 'multi-number' },
    { name: 'hissan', skill: 'add_2d1d_hissan_c', type: 'hissan' },
    { name: 'multiply', skill: 'mul_2d1d', type: 'hissan' },
    { name: 'divide', skill: 'div_2d1d_exact', type: 'hissan' },
    { name: 'choice', skill: 'compare_2d', type: 'choice' },
    { name: 'vocab', skill: '', subject: 'vocab', type: 'choice' },
].filter(scenario => !process.env.SANSU_ISLAND_LANDSCAPE_SCENARIOS
    || process.env.SANSU_ISLAND_LANDSCAPE_SCENARIOS.split(',').includes(scenario.name));
assert(scenarios.length > 0, 'Scenario filter must match a learning input');
report.filteredDiagnostic = Boolean(process.env.SANSU_ISLAND_LANDSCAPE_SCENARIOS);

async function capture(page, row, state, { model = false, portrait = false } = {}) {
    const geometry = await page.locator('.island-page').evaluate(root => {
        const rect = node => node?.getBoundingClientRect().toJSON();
        const question = root.querySelector('.park-question');
        return { viewport: { width: innerWidth, height: innerHeight }, pageHeight: root.clientHeight,
            contentHeight: root.scrollHeight, scrollTop: root.scrollTop, width: root.clientWidth, contentWidth: root.scrollWidth,
            question: rect(question), prompt: rect(question?.firstElementChild),
            questionOverflow: question ? question.scrollHeight - question.clientHeight : 0,
            support: rect(root.querySelector('.park-support')), actions: rect(root.querySelector('.island-learning-actions')) };
    });
    row.geometry.push({ state, ...geometry });
    assert(geometry.contentWidth <= geometry.width + 1, 'No horizontal page overflow');
    if (!portrait) {
        assert(geometry.contentHeight <= geometry.pageHeight + 1, `No page scrolling: ${JSON.stringify(geometry)}`);
        assert.equal(geometry.scrollTop, 0, 'Input does not scroll the page');
        assert(geometry.actions.bottom <= geometry.viewport.height, 'Help/continue stays visible');
        if (!model) assert(geometry.questionOverflow <= 1, `The current question stays fully visible: ${JSON.stringify(geometry)}`);
    }
    if (!model) await assertControls(page);
    else {
        const next = page.getByRole('button', { name: 'つぎへ すすむ', exact: true });
        const box = await next.boundingBox();
        assert(box && box.y >= 0 && box.y + box.height <= geometry.viewport.height, 'Model continuation stays visible');
    }
    const file = `${row.name}-${state}.png`;
    await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
    row.captures.push(file);
}

async function changed(page, before) {
    await page.waitForFunction(({ id, revision }) => {
        const panel = document.querySelector('[data-island-plan-id]');
        return panel?.getAttribute('data-input-ready') === 'true'
            && (panel.getAttribute('data-island-plan-id') !== id || Number(panel.getAttribute('data-island-plan-revision')) > revision);
    }, before.plan);
    return readNative(page, before.plan.profileId);
}

async function answer(page, before, wrong = false) {
    const slot = before.plan.slots[before.plan.cursor];
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    const automatic = await page.locator('.park-answer').getAttribute('data-answer-completion') === 'automatic';
    if (type === 'choice') {
        const choice = slot.problem.inputConfig.choices.find(choice => choice.value === slot.problem.correctAnswer);
        await page.locator('.park-choices').getByRole('button', { name: choice.label, exact: true }).tap();
    } else {
        const expected = expectedLearningAnswer(slot, type).values;
        const values = wrong ? ['9999'] : Array.isArray(expected) ? expected : [expected];
        for (const [index, value] of values.entries()) {
            if (type !== 'hissan') await page.locator('.park-input').nth(index).tap();
            for (const digit of String(value)) await page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }).tap();
        }
        if (!automatic) await page.locator('[data-keypad-submit]').tap();
    }
    return changed(page, before);
}

try {
    for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
        const browser = await browserType.launch();
        try {
            for (const scenario of scenarios) {
                const context = await browser.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: true,
                    reducedMotion: engine === 'webkit' ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
                const page = await context.newPage();
                page.setDefaultTimeout(15000);
                const row = { name: `${engine}-${scenario.name}`, captures: [], geometry: [], errors: [], pass: false };
                report.scenarios.push(row);
                page.on('pageerror', error => row.errors.push(error.message));
                try {
                    await page.goto(`${base}/#/island`);
                    await page.waitForURL('**/#/onboarding');
                    const profileId = await seedLearningProfile(page, scenario);
                    await page.goto(`${base}/#/island`); await waitReady(page);
                    if (scenario.rotate) {
                        const file = `${row.name}-home.png`;
                        await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
                        row.captures.push(file);
                    }
                    await page.locator('.island-start').tap();
                    await page.locator('[data-island-plan-id][data-input-ready="true"]').waitFor();
                    let state = await readNative(page, profileId);
                    assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill || state.plan.slots[0].problem.categoryId);
                    assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
                    if (scenario.visual) assert.equal(state.plan.slots[0].problem.questionVisual.kind, scenario.visual);
                    await assertProblemMeaning(page, state.plan.slots[0]);
                    await capture(page, row, 'ready-1024x640');
                    if (scenario.rotate) {
                        await page.keyboard.press('1');
                        const draft = await page.locator('.park-input').allTextContents();
                        for (const [width, height] of [[768, 1024], [390, 844], [1024, 600], [1024, 768], [1180, 820], [1366, 1024], [1024, 640]]) {
                            await page.setViewportSize({ width, height });
                            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                            assert.deepEqual(await page.locator('.park-input').allTextContents(), draft, 'Rotation preserves the draft');
                            assert.deepEqual((await readNative(page, profileId)).plan, state.plan, 'Rotation preserves the reserved question');
                            await capture(page, row, `rotate-${width}x${height}`, { portrait: width < height });
                        }
                        await page.locator('.park-keypad').getByRole('button', { name: 'こたえを けす', exact: true }).tap();
                        state = await answer(page, state, true);
                        await capture(page, row, 'retry');
                    }
                    await page.getByRole('button', { name: 'ヒントを みる', exact: true }).tap();
                    state = await changed(page, state);
                    await capture(page, row, 'hint');
                    state = await answer(page, state);
                    await capture(page, row, 'answered');
                    if (await page.locator('.island-answer-stage').getAttribute('data-support-stage') !== 'hint') {
                        await page.getByRole('button', { name: 'ヒントを みる', exact: true }).tap();
                        state = await changed(page, state);
                    }
                    await page.getByRole('button', { name: 'おてほんを みる', exact: true }).tap();
                    state = await changed(page, state);
                    await capture(page, row, 'model', { model: true });
                    await page.getByRole('button', { name: 'つぎへ すすむ', exact: true }).tap();
                    state = await changed(page, state);
                    await waitLearningReady(page, state.plan);
                    await capture(page, row, 'continued');
                    row.runtime = await runtimeMetadata(page);
                    if (process.env.SANSU_ISLAND_PRODUCTION_URL) {
                        report.manifest ??= await page.evaluate(async () => (await fetch('/version.json')).json());
                        assert.equal(row.runtime.version, report.manifest.version);
                        assert.equal(row.runtime.revision, report.manifest.revision);
                        assert.equal(row.runtime.candidate, report.manifest.island.candidate);
                        assert.equal(row.runtime.learningCandidate, report.manifest.island.learningCandidate);
                    }
                    assert.deepEqual(row.errors, []);
                    row.pass = true;
                    console.log(`PASS ${row.name}`);
                } catch (error) {
                    row.error = error.stack;
                    await page.screenshot({ path: path.join(out, `${row.name}-failure.png`) });
                    throw error;
                } finally { await context.close(); }
            }
        } finally { await browser.close(); }
    }
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
