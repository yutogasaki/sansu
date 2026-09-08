import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const base = process.env.SANSU_LEARNING_REINFORCEMENT_URL || 'http://127.0.0.1:5199';
const output = path.resolve(process.env.SANSU_LEARNING_REINFORCEMENT_OUTPUT || 'output/playwright/learning-reinforcement/report.json');
const out = path.dirname(output);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(output), { code: 'ENOENT' }, 'Use a fresh report path; preserve prior observations');

// An answer oracle runs in Node. The browser receives profile/memory fixtures,
// then uses the actual normal Study planner, keyboard and persistence writer.
const compiled = await build({ stdin: { contents: `
    export { createInitialProfile } from './src/domain/user/profile.ts';
    export { generateHissanGrid } from './src/domain/math/hissanEngine.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const sourcePaths = ['tools/e2e-learning-reinforcement.mjs', 'src/pages/Study.tsx', 'src/pages/StudyLayout.tsx',
    'src/hooks/useStudySession.ts', 'src/hooks/useHissanSession.ts', 'src/hooks/blockGenerators.ts',
    'src/domain/learningAttemptWriter.ts', 'src/domain/learning/context.ts', 'src/domain/learning/attemptContext.ts',
    'src/domain/math/hissanEngine.ts'];
const hashes = async () => Promise.all(sourcePaths.map(async file => ({ file,
    sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const runnerPath = fileURLToPath(import.meta.url);
const runnerSHA = createHash('sha256').update(await fs.readFile(runnerPath)).digest('hex');
const report = { target: base, startedAt: new Date().toISOString(), sourceStart: await hashes(),
    runner: { path: runnerPath, sha256: runnerSHA, cwd: process.cwd(),
        scope: 'Actual executing QA runner. sourceStart/sourceEnd describe the fixed app directory, including its original runner; a QA supplement can differ without changing that closure.' },
    oracleSHA: createHash('sha256').update(compiled.outputFiles[0].text).digest('hex'), scenarios: [], pass: false,
    scope: 'Disposable native profile and one overdue item per case. Newly generated normal Study questions are answered through the actual UI. No saved question replacement, browser app-module import, answer hook or direct writer call. Hissan corrections are partial-step attempts and must not create invented whole-question incorrect logs.' };
report.runner.matchesClosureRunner = runnerSHA === report.sourceStart.find(item => item.file === 'tools/e2e-learning-reinforcement.mjs')?.sha256;
const browser = await chromium.launch();

async function seed(page, scenario) {
    const profile = domain.createInitialProfile('はる', 2, 10, 1, 'math');
    profile.soundEnabled = false;
    profile.englishAutoRead = false;
    profile.uiTextMode = 'standard';
    profile.mathMainLevel = 11;
    profile.mathMaxUnlocked = 11;
    profile.mathMainLevelStartedAt = new Date().toISOString();
    profile.mathSkills = {};
    profile.vocabWords = {};
    profile.mathLevels = profile.mathLevels.map(level => ({ ...level, enabled: level.level === 11 }));
    if (scenario.mode === 'off') profile.hissanModeEnabled = false;
    else delete profile.hissanModeEnabled; // Exercise Study's default-on setting.
    const memory = { profileId: profile.id, id: scenario.skill, strength: 1,
        nextReview: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z',
        totalAnswers: 1, correctAnswers: 1, independentCorrectAnswers: 1,
        incorrectAnswers: 0, skippedAnswers: 0, status: 'active', isWeak: false };
    await page.evaluate(async ({ profile, memory }) => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = database.transaction(['profiles', 'appData', 'memoryMath'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        transaction.objectStore('memoryMath').put(memory);
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        database.close();
    }, { profile, memory });
    return { profileId: profile.id, memory };
}

async function state(page, profileId) {
    return page.evaluate(async profileId => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = ['profiles', 'logs', 'memoryMath'];
        const transaction = database.transaction(names, 'readonly');
        const rows = await Promise.all(names.map(name => new Promise((resolve, reject) => {
            const request = transaction.objectStore(name).getAll();
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        })));
        database.close();
        return Object.fromEntries(names.map((name, index) => [name,
            rows[index].filter(row => name === 'profiles' ? row.id === profileId : row.profileId === profileId)]));
    }, profileId);
}

async function capture(page, row, suffix) {
    const filename = `${path.basename(output, path.extname(output))}-${row.name}-${suffix}.png`;
    await page.screenshot({ path: path.join(out, filename), animations: 'disabled' });
    row.captures.push(filename);
}

const firstQuestion = page => page.locator('[data-study-index="0"][data-feedback="none"]');
// The existing addition/subtraction grid exposes its active cell through its
// visible cyan focus border. This is an observation of rendered UI, not React state.
const activeHissanCell = page => firstQuestion(page).locator('.font-mono.border-cyan-400');
// The mobile-only header toggle may be hidden. Observe the numeric answer field
// itself, and operate a visible responsive toggle when changing presentation.
const numberPreview = page => firstQuestion(page).locator('.app-glass.font-mono');
const visibleHissanToggle = page => firstQuestion(page).getByRole('button', { name: /^(?:筆算|筆算 → 暗算に切替)$/ });

async function answerHissan(page, row, grid, before, profileId) {
    for (const [index, step] of grid.steps.entries()) {
        await activeHissanCell(page).waitFor();
        if (row.mode === 'correction' && index === 0) {
            const wrong = step.correctValues.map((value, cell) => cell === 0 ? (value === '9' ? '8' : '9') : value);
            await page.keyboard.type(wrong.join(''));
            await page.keyboard.press('Enter');
            await activeHissanCell(page).waitFor(); // Actual retry reset, after the incorrect-step feedback.
            assert.deepEqual(await state(page, profileId), before, 'A wrong partial step does not fabricate a whole-question answer');
            await capture(page, row, 'retry-ready');
        }
        await page.keyboard.type(step.correctValues.join(''));
        await page.keyboard.press('Enter');
        if (index < grid.steps.length - 1) {
            await activeHissanCell(page).waitFor();
            assert.deepEqual(await state(page, profileId), before, 'Correct partial steps are not whole-question successes');
        }
    }
}

try {
    const cases = ['add_2d2d_nc', 'sub_2d2d'].flatMap(skill =>
        ['default-on', 'off', 'correction'].map(mode => ({ skill, mode })));
    cases.push({ skill: 'add_2d2d_nc', mode: 'toggle-off' });
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        for (const scenario of cases) {
            const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(15_000);
            const row = { ...scenario, name: `${viewport.width}-${scenario.skill}-${scenario.mode}`, viewport,
                errors: [], captures: [], pass: false };
            report.scenarios.push(row);
            page.on('pageerror', error => row.errors.push(error.message));
            try {
                await page.goto(`${base}/#/settings`);
                await page.waitForURL('**/#/onboarding');
                const fixture = await seed(page, scenario);
                row.profileId = fixture.profileId;
                row.fixtureMemory = fixture.memory;
                await page.goto(`${base}/#/study?session=normal&focus_subject=math`);
                await firstQuestion(page).waitFor();
                const questionId = await firstQuestion(page).getAttribute('data-study-question-id');
                const question = await firstQuestion(page).getAttribute('data-question-text');
                const match = question?.match(/^\s*(\d{2})\s*([+−-])\s*(\d{2})\s*=\s*$/);
                assert(match, `The actual requested two-digit equation must be visible: ${question}`);
                const answer = String(match[2] === '+' ? Number(match[1]) + Number(match[3]) : Number(match[1]) - Number(match[3]));
                assert.equal(match[2] === '+', scenario.skill === 'add_2d2d_nc');
                row.observed = { questionId, question, answer };
                const before = await state(page, fixture.profileId);
                assert.deepEqual(before.logs, []);
                assert.deepEqual(before.memoryMath, [fixture.memory]);
                row.before = before;
                if (scenario.mode === 'off') {
                    await numberPreview(page).waitFor();
                    assert.equal(await activeHissanCell(page).count(), 0);
                } else {
                    await activeHissanCell(page).waitFor();
                    if (scenario.mode === 'toggle-off') {
                        await visibleHissanToggle(page).first().click();
                        await numberPreview(page).waitFor();
                        assert.equal(await activeHissanCell(page).count(), 0);
                        assert.equal(await firstQuestion(page).getAttribute('data-study-question-id'), questionId);
                        assert.equal(await firstQuestion(page).getAttribute('data-question-text'), question);
                    }
                }
                await capture(page, row, 'ready');
                if (scenario.mode === 'off' || scenario.mode === 'toggle-off') {
                    await page.keyboard.type(answer);
                    await page.waitForFunction(expected => document.querySelector('[data-study-index="0"] .app-glass.font-mono')?.textContent === expected, answer);
                    row.observed.numericInput = await numberPreview(page).innerText();
                    await page.keyboard.press('Enter');
                } else {
                    const grid = domain.generateHissanGrid(scenario.skill, question, answer);
                    assert(grid && grid.steps.length > 0, 'The actual equation has a supported Hissan answer model');
                    row.steps = grid.steps;
                    await answerHissan(page, row, grid, before, fixture.profileId);
                }
                await page.locator('[data-study-index="1"][data-feedback="none"]').waitFor();
                const after = await state(page, fixture.profileId);
                assert.equal(after.logs.length, 1, 'Only the completed whole question is persisted');
                const log = after.logs[0];
                assert.equal(log.itemId, scenario.skill, 'The actual normal planner selected the requested eligible Due item');
                assert.equal(log.result, 'correct');
                assert.equal(log.isReview, true);
                const expectedAssistance = scenario.mode === 'correction' ? 'assisted' : scenario.mode === 'toggle-off' ? 'unknown' : 'independent';
                const evidence = log.learningEvidence;
                if (scenario.mode === 'toggle-off') {
                    assert.equal(evidence, undefined, 'Changing representation leaves the answer unknown instead of attributing it to the frozen method');
                } else {
                    assert(evidence, 'The real UI writer retained the new question context');
                    assert.equal(evidence.completion, 'whole-problem');
                    assert.equal(evidence.assistance, expectedAssistance);
                    assert.equal(evidence.problem.itemId, scenario.skill);
                    assert.equal(evidence.problem.representation, scenario.mode === 'off' ? 'symbol' : 'algorithm');
                    assert.equal(evidence.problem.inputType, scenario.mode === 'off' ? 'number' : 'hissan');
                    const frozen = JSON.parse(evidence.problem.problemKey);
                    assert.equal(frozen.question, question, 'Evidence describes the actual rendered equation');
                    assert.equal(frozen.answer, answer);
                }
                const memory = after.memoryMath.find(item => item.id === scenario.skill);
                assert(memory);
                assert.equal(memory.totalAnswers, fixture.memory.totalAnswers + 1);
                assert.equal(memory.correctAnswers, fixture.memory.correctAnswers + 1);
                assert.equal(memory.independentCorrectAnswers, fixture.memory.independentCorrectAnswers + (expectedAssistance === 'independent' ? 1 : 0));
                if (scenario.mode === 'correction') assert.equal(memory.needsRelearning, true);
                row.after = after;
                row.independentDelta = memory.independentCorrectAnswers - fixture.memory.independentCorrectAnswers;
                await capture(page, row, 'saved');
                assert.deepEqual(row.errors, []);
                row.pass = true;
                console.log(`PASS ${row.name}: ${evidence?.problem.representation ?? 'unknown'}/${expectedAssistance}, independent +${row.independentDelta}`);
            } catch (error) {
                row.error = error.stack || String(error);
                await capture(page, row, 'failure').catch(() => undefined);
                throw error;
            } finally { await context.close(); }
        }
    }
    report.sourceEnd = await hashes();
    assert.deepEqual(report.sourceEnd, report.sourceStart, 'Source files remain fixed throughout the run');
    report.runner.endSHA256 = createHash('sha256').update(await fs.readFile(runnerPath)).digest('hex');
    assert.equal(report.runner.endSHA256, runnerSHA, 'The separately identified executing runner remains fixed throughout the run');
    report.pass = true;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(output, JSON.stringify(report, null, 2));
    await browser.close();
}
