import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { button, percentile, readNative, runtimeMetadata, seedDev, waitMode, waitReady } from './island-e2e-helpers.mjs';

const FIXTURE = 'cold-open-fixed-ten-v1';
const ISLAND_SETUP = 'normal-existing-island-v1';
const INITIAL_COMPLETED_SETS = 1;
const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const output = resolve(process.env.SANSU_ISLAND_THROUGHPUT_OUTPUT || 'output/playwright/island-throughput/latest.json');
const repetitions = Math.max(1, Number.parseInt(process.env.SANSU_ISLAND_THROUGHPUT_REPETITIONS || '10', 10) || 10);
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
assert(buildSourcePath, 'Bind the benchmark to its frozen application build-source manifest');
const buildSourceBytes = await readFile(buildSourcePath);
const buildSource = JSON.parse(buildSourceBytes);
const sha = value => createHash('sha256').update(value).digest('hex');
const baselinePath = process.env.SANSU_ISLAND_THROUGHPUT_BASELINE;
const baselineBytes = baselinePath ? await readFile(baselinePath) : undefined;
const baseline = baselineBytes ? JSON.parse(baselineBytes) : undefined;
await assert.rejects(readFile(output), { code: 'ENOENT' }, 'Use a fresh report path; never overwrite a prior run');
const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]
    .filter(layout => !process.env.SANSU_ISLAND_THROUGHPUT_LAYOUT || layout.name === process.env.SANSU_ISLAND_THROUGHPUT_LAYOUT);
assert(layouts.length, 'Layout filter must select phone or tablet');
const scenarios = ['all-correct', 'miss-at-q4-q8'];
const questions = ['1 + 1 =', '2 + 3 =', '4 + 2 =', '5 + 3 =', '7 + 1 =', '8 + 2 =', '9 + 3 =', '6 + 2 =', '3 + 3 =', '9 + 1 ='];
const answers = [2, 5, 6, 8, 8, 10, 12, 8, 6, 10];
const median = values => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const git = args => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
async function sourceFingerprint() {
    const collect = async directory => {
        const entries = await readdir(directory, { withFileTypes: true });
        return (await Promise.all(entries.map(entry => entry.isDirectory() ? collect(join(directory, entry.name))
            : /\.(ts|tsx|css)$/.test(entry.name) ? [join(directory, entry.name)] : []))).flat();
    };
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...await collect('src'),
        'vite.config.ts', 'postcss.config.js', 'tailwind.config.js', '.gitignore', '.nvmrc', 'package.json', 'package-lock.json',
        'tools/e2e-island-throughput.mjs', 'tools/island-e2e-helpers.mjs'])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, hash: createHash('sha256').update(await readFile(path)).digest('hex') })));
    return { hash: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}
const report = {
    fixtureId: FIXTURE, fixtureHash: createHash('sha256').update(JSON.stringify({ questions, answers })).digest('hex'),
    islandSetup: { id: ISLAND_SETUP, initialCompletedSets: INITIAL_COMPLETED_SETS, synthetic: true,
        scope: 'A disposable existing-island fixture, not a real first-time child or an observed completed introduction. No fabricated answer logs or completed-plan receipts.' },
    buildSource: { path: resolve(buildSourcePath), manifestSHA: sha(buildSourceBytes), sourceHash: buildSource.sourceHash,
        revision: buildSource.revision, flags: buildSource.flags },
    runner: { cwd: process.cwd(), command: process.argv },
    baseline: baseline ? { path: resolve(baselinePath), sha256: sha(baselineBytes), pass: baseline.pass,
        evidence: baseline.evidence, runtime: baseline.runtime, comparisons: baseline.comparisons,
        comparisonBoundary: 'Earlier reports include one explicit continuation after Q6. This run measures automatic continuation including Q6 in operable latency. Preserve both methods; an old PASS does not meet the new gate.' } : undefined,
    target: base, startedAt: new Date().toISOString(), repetitions, layouts,
    git: { revision: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])) },
    sourceSnapshotStart: await sourceFingerprint(),
    method: {
        setup: 'Wait for the empty-profile Island welcome to commit before inserting each disposable profile; retain the same document for fixture hooks and navigate only after that lookup has resolved.',
        input: 'physical-keyboard digits and Enter, identical answers and ordinary actions in both lanes',
        order: 'Study/Island alternates by repetition and scenario within each viewport',
        timing: 'Browser performance.now; answer delay begins at actual Enter keydown. Total includes typing and automated observation overhead. Q6 ends only when the exact next plan is operable; no continuation action is performed.',
        fixtureScope: 'Isolated disposable browser profiles only. Before timing, one explicitly synthetic existing-island completion bypasses the introduction. Island creates real six-slot plans, with a test-only Dexie creating hook replacing newly created slots before display; existing reservations are never changed.',
        plannerTruth: 'Not production planner evidence. All fixed slots are explicit test-fixture main assignments with no review or maintenance flags.',
        learningDifference: 'Island records the real atomic writer and reward receipts in its disposable profile. Study uses its existing nonrecording DEV fixture. Neither lane reads or changes a real user profile.',
        islandTail: 'Six slots in each of two newly saved sets, after the declared synthetic existing-island baseline. Only the first four slots of the second new set are answered. Two repeated fixture tail slots remain pending and unsubmitted.',
        missDifference: 'Island retries and corrects Q4/Q8 on the same saved Problem. Study retains its correction panel and explicit next action. Only all-correct throughput is compared for the >=1.0 gate.',
        rendering: 'Both lanes use reduced-motion and sound off. Before timed input, every initial Island keypad control must fit and preserve a 44px target; active digit/edit keys must receive a center hit, while empty submit must remain disabled. Normal-motion, touch and full-input fidelity are separate Island E2E gates.',
    },
    runs: [], comparisons: [], gates: {}, evidence: {}, pass: false, browserClosed: false,
};
report.buildSourceMismatches = buildSource.files.filter(file =>
    report.sourceSnapshotStart.files.find(actual => actual.path === file.path)?.hash !== file.sha256);
assert.deepEqual(report.buildSourceMismatches, [], 'Every frozen application input must match before measurement');

async function learningSnapshot(page) {
    return page.evaluate(async () => {
        const { db } = await import('/src/db/index.ts');
        return { profiles: await db.profiles.toArray(), logs: await db.logs.toArray(), math: await db.memoryMath.toArray(), vocab: await db.memoryVocab.toArray() };
    });
}

async function installIslandFixture(page, profileId) {
    return page.evaluate(async ({ profileId, fixture, initialCompletedSets, setup }) => {
        const { db } = await import('/src/db/index.ts');
        const { createColdOpenFixedTenProblem } = await import('/src/domain/benchmark/coldOpenFixedTen.ts');
        const { createLearningProblemContext } = await import('/src/domain/learning/context.ts');
        const { openIsland, startIslandPlan } = await import('/src/domain/island/repository.ts');
        window.__islandFixturePlans = [];
        db.islandPlans.hook('creating', (_key, plan) => {
            if (plan.profileId !== profileId) return;
            if (plan.cursor !== 0 || plan.revision !== 0 || plan.slots.length !== 6) throw new Error('Fixture must replace a new real six-question reservation only');
            const sequence = window.__islandFixturePlans.length;
            if (sequence > 1) throw new Error('Only two isolated fixture sets may be reserved');
            plan.slots = Array.from({ length: 6 }, (_, index) => {
                const problem = createColdOpenFixedTenProblem((sequence * 6 + index) % 10, `${plan.id}:slot-${index}`);
                if (!problem) throw new Error('Missing fixed-ten fixture problem');
                return {
                    problem: { ...problem, learningContext: createLearningProblemContext('math', problem) },
                    source: 'main', countsTowardReviewCap: false, assisted: false,
                    learningEvidenceAssistance: 'independent', completed: false,
                };
            });
            // The synthetic familiar profile has already learned this fixture
            // item. Metadata from the replaced production slots cannot survive.
            plan.introducedItemIds = [];
            window.__islandFixturePlans.push({ fixture, originalWorkload: 6, plan: structuredClone(plan) });
        });
        const opened = await openIsland(profileId);
        if (opened.pendingPlanId || opened.completedSets || opened.pendingRewards.length) throw new Error('Normal fixture must start in a fresh disposable island');
        await db.islands.put({ ...opened, completedSets: initialCompletedSets });
        window.__islandFixtureSetup = { id: setup, synthetic: true, before: opened, after: await db.islands.get(profileId) };
        return startIslandPlan(profileId);
    }, { profileId, fixture: FIXTURE, initialCompletedSets: INITIAL_COMPLETED_SETS, setup: ISLAND_SETUP });
}

async function waitStudy(page, index) {
    await page.waitForFunction(({ fixture, index }) => {
        const root = document.querySelector(`[data-benchmark-id="${fixture}"]`);
        return root?.getAttribute('data-study-index') === String(index) && root.getAttribute('data-feedback') === 'none';
    }, { fixture: FIXTURE, index });
}

async function assertLayout(page, lane) {
    const controls = [];
    for (const name of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'こたえを けす', 'ひとつ もどす', 'こたえる']) {
        const control = button(page, name);
        const box = await control.boundingBox();
        const viewport = page.viewportSize();
        assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
            `${lane}: control ${name} must fit in the viewport: ${JSON.stringify(box)}`);
        const interaction = await control.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return { hit: target === element || element.contains(target), disabled: element.disabled };
        });
        if (lane === 'island') {
            assert(box.width >= 44 && box.height >= 44,
                `Island initial control ${name} must preserve the 44px touch target: ${JSON.stringify(box)}`);
            if (name === 'こたえる') assert(interaction.disabled, 'The empty initial answer cannot be submitted');
            else assert(interaction.hit && !interaction.disabled, `Island initial control ${name} must receive a real center hit`);
        }
        controls.push({ name, box, ...interaction });
    }
    return controls;
}

async function armAnswer(page, lane, index, wrong) {
    await page.evaluate(({ lane, index, wrong, fixture }) => {
        window.__islandThroughputSample = undefined;
        const root = document.querySelector(lane === 'island' ? '[data-island-plan-revision]' : `[data-benchmark-id="${fixture}"]`);
        const revision = Number(root?.getAttribute('data-island-plan-revision'));
        const planId = root?.getAttribute('data-island-plan-id');
        const boundary = lane === 'island' && index === 5 && !wrong;
        const expectedNextPlanId = boundary ? JSON.stringify(['island-plan-v1', JSON.parse(planId)[1], JSON.parse(planId)[2] + 1]) : undefined;
        const input = lane === 'island' ? document.querySelector('.park-input span') : document.querySelector('.app-glass.font-mono');
        if (!input || !['', '□'].includes(input.textContent.trim())) throw new Error('Input leaked from the previous answer');
        const onKey = event => {
            if (/^[0-9]$/.test(event.key) && window.__islandThroughputStarted === undefined) window.__islandThroughputStarted = performance.now();
            if (event.key !== 'Enter') return;
            document.removeEventListener('keydown', onKey, true);
            const started = performance.now();
            window.__islandThroughputPending = { lane, index, wrong, started, revision, planId,
                activeElement: document.activeElement?.outerHTML, input: input.textContent,
                question: root?.getAttribute('data-question-text'), feedback: root?.getAttribute('data-feedback') };
            const tick = () => {
                const current = document.querySelector(lane === 'island' ? '[data-island-plan-revision]' : `[data-benchmark-id="${fixture}"]`);
                let ready = false;
                let terminal = false;
                if (lane === 'island') {
                    terminal = document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward';
                    ready = !terminal && current?.getAttribute('data-input-ready') === 'true' && (boundary
                        ? current.getAttribute('data-island-plan-id') === expectedNextPlanId
                            && Number(current.getAttribute('data-island-plan-revision')) === 0
                            && current.querySelector('.island-light-trail')?.getAttribute('aria-label')?.startsWith('1もんめ、')
                        : current.getAttribute('data-island-plan-id') === planId
                            && Number(current.getAttribute('data-island-plan-revision')) === revision + 1);
                } else {
                    terminal = current?.getAttribute('data-benchmark-complete') === 'true';
                    ready = wrong ? current?.getAttribute('data-feedback') === 'incorrect' && [...document.querySelectorAll('button')].some(button => /^(次へ|つぎへ)/.test(button.textContent.trim()))
                        : terminal || (Number(current?.getAttribute('data-study-index')) === index + 1 && current?.getAttribute('data-feedback') === 'none');
                }
                if (!ready) { requestAnimationFrame(tick); return; }
                const nextInput = lane === 'island' ? document.querySelector('.park-input span') : document.querySelector('.app-glass.font-mono');
                const empty = terminal || (lane === 'study' && wrong) || ['', '□'].includes(nextInput?.textContent.trim());
                window.__islandThroughputSample = { question: index + 1, wrong, ms: performance.now() - started, terminal, inputEmpty: empty,
                    revision, planId, boundary, expectedNextPlanId,
                    nextPlanId: current?.getAttribute('data-island-plan-id'), nextRevision: Number(current?.getAttribute('data-island-plan-revision')),
                    endedAt: performance.now() };
                if (index === 9 && !wrong) window.__islandThroughputEnded = performance.now();
            };
            requestAnimationFrame(tick);
        };
        document.addEventListener('keydown', onKey, true);
    }, { lane, index, wrong, fixture: FIXTURE });
}

async function submit(page, lane, index, wrong = false) {
    await armAnswer(page, lane, index, wrong);
    await page.keyboard.type(String(answers[index] + (wrong ? 1 : 0)));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Boolean(window.__islandThroughputSample));
    const sample = await page.evaluate(() => window.__islandThroughputSample);
    assert(sample.inputEmpty, `${lane} Q${index + 1}: prior input must not leak`);
    return sample;
}

async function runLane(browser, lane, scenario, repetition, layout) {
    const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, locale: 'ja-JP', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    let activeQuestion = -1;
    page.on('pageerror', error => errors.push(error.stack));
    try {
        await page.goto(`${base}/#/onboarding`, { waitUntil: 'domcontentloaded' });
        // Resolve the empty-profile onboarding lookup before inserting the disposable fixture.
        await page.locator('[data-onboarding-world="island"][data-mode="welcome"]').waitFor();
        const profileId = await seedDev(page, { name: `Benchmark ${lane} ${repetition}`, skill: 'add_1d_1' });
        let firstPlan;
        let metadata;
        if (lane === 'island') {
            firstPlan = await installIslandFixture(page, profileId);
            await page.evaluate(() => { location.hash = '/island'; });
            await waitReady(page);
            await waitMode(page, 'learning');
            metadata = await runtimeMetadata(page);
            metadata.islandEnabled = await page.evaluate(async () => (await import('/src/domain/island/feature.ts')).islandEnabled());
            assert(metadata.islandEnabled, 'Formal Island lane must run with the delivery flag enabled');
        } else {
            await page.evaluate(fixture => { location.hash = `/study?session=dev&benchmark=${fixture}`; }, FIXTURE);
            await waitStudy(page, 0);
            metadata = await page.evaluate(() => ({
                fixtureId: 'cold-open-fixed-ten-v1',
                route: location.hash, viewport: { width: innerWidth, height: innerHeight }, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
                serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
            }));
        }
        const controls = await assertLayout(page, lane);
        if (lane === 'island') await page.evaluate(() => {
            const probe = window.__islandNormalFlow = { modes: [], actions: [], overflow: false };
            const save = (key, value) => { if (probe[key].length < 256) probe[key].push(value); else probe.overflow = true; };
            const root = document.querySelector('.island-page');
            save('modes', root.dataset.mode);
            const observer = new MutationObserver(records => {
                for (const record of records) if (record.attributeName === 'data-mode') save('modes', record.oldValue);
                save('modes', root.dataset.mode);
            });
            observer.observe(root, { attributes: true, attributeFilter: ['data-mode'], attributeOldValue: true });
            document.addEventListener('click', event => { if (event.isTrusted) save('actions', { type: 'click', text: event.target.textContent }); }, true);
            document.addEventListener('keydown', event => { if (event.isTrusted) save('actions', { type: 'keydown', key: event.key }); }, true);
        });
        const before = await learningSnapshot(page);
        const samples = [];
        const interruptions = [];
        const renderedQuestions = [];
        const snapshots = [];
        for (let index = 0; index < 10; index += 1) {
            activeQuestion = index;
            if (lane === 'study') {
                await waitStudy(page, index);
                const text = await page.locator(`[data-benchmark-id="${FIXTURE}"]`).getAttribute('data-question-text');
                assert.equal(text, questions[index]);
                renderedQuestions.push(text);
            } else {
                const actual = await page.evaluate(({ index }) => {
                    const root = document.querySelector('[data-island-plan-id]');
                    const id = root?.getAttribute('data-island-plan-id');
                    const saved = window.__islandFixturePlans.find(entry => entry.plan.id === id)?.plan;
                    return { problem: saved?.slots[index % 6]?.problem, visible: document.querySelector('.park-question')?.textContent };
                }, { index });
                assert.equal(actual.problem?.questionText, questions[index]);
                assert(actual.visible?.replace(/\s+/g, '').includes(questions[index].replace(/\s+/g, '')), 'The fixture question must be visibly rendered');
                renderedQuestions.push(actual.problem.questionText);
            }
            if (scenario === 'miss-at-q4-q8' && [3, 7].includes(index)) {
                samples.push(await submit(page, lane, index, true));
                if (lane === 'study') {
                    const start = await page.evaluate(() => performance.now());
                    const next = page.getByRole('button', { name: /次へ|つぎへ/ });
                    await next.focus(); await page.keyboard.press('Enter'); await waitStudy(page, index + 1);
                    interruptions.push({ afterQuestion: index + 1, kind: 'correction-next', ms: await page.evaluate(start => performance.now() - start, start) });
                    continue;
                }
                const state = await readNative(page, profileId);
                const current = state.plan;
                assert.equal(current.cursor, index % 6, 'Wrong answer must retry the same slot');
                assert.equal(current.slots[current.cursor].problem.questionText, questions[index]);
                snapshots.push({ afterWrongQuestion: index + 1, planId: current.id, revision: current.revision, cursor: current.cursor, problem: current.slots[current.cursor].problem });
            }
            samples.push(await submit(page, lane, index));
        }
        const timing = await page.evaluate(() => ({ start: window.__islandThroughputStarted, end: window.__islandThroughputEnded }));
        assert(Number.isFinite(timing.start) && Number.isFinite(timing.end) && timing.end > timing.start, 'Browser timing must have measured start and end');
        const after = await learningSnapshot(page);
        let persistence;
        if (lane === 'island') {
            const state = await readNative(page, profileId);
            const normalFlow = await page.evaluate(() => window.__islandNormalFlow);
            assert(!normalFlow.overflow, 'Normal flow observation must not truncate');
            assert(normalFlow.modes.every(mode => mode === 'learning'), 'No automatic reward, home or other mode may interrupt normal answers');
            assert(normalFlow.actions.every(action => action.type === 'keydown' && /^[0-9]$|^Enter$/.test(action.key)), 'Only answer digits and Enter are permitted in the timed normal flow');
            const actionEvents = state.islandEvents.filter(event => event.type === 'answer');
            const expectedAttempts = scenario === 'all-correct' ? 10 : 12;
            assert.equal(actionEvents.length, expectedAttempts, 'Exactly one persisted event per keyboard answer');
            assert.equal(new Set(actionEvents.map(event => event.id)).size, expectedAttempts);
            assert.equal(state.logs.length, expectedAttempts, 'Exactly one real learning log per fixture attempt');
            assert.equal(new Set(actionEvents.map(event => event.learningLogId)).size, expectedAttempts);
            assert(actionEvents.every(event => state.logs.some(log => log.id === event.learningLogId)), 'Every answer receipt must identify its learning log');
            assert.equal(state.logs.filter(log => log.result === 'correct').length, 10);
            assert.equal(normalFlow.actions.filter(action => action.key === 'Enter').length, expectedAttempts);
            assert.equal(state.island.completedSets, INITIAL_COMPLETED_SETS + 1);
            assert.equal(state.island.pendingRewards.length, 0, 'The section grows its place without a deferred gift');
            assert(firstPlan.growthTarget, 'The benchmark exercises the current automatic growth contract');
            assert.equal(state.island.growth.progress[firstPlan.growthTarget], 1, 'Exactly one real section grows the reserved place');
            assert.equal(new Set(state.island.items.map(item => item.id)).size, state.island.items.length);
            assert.equal(state.plan.cursor, 4, 'The second real six-question section remains pending after Q10');
            assert.equal(state.plan.slots.length, 6);
            assert.equal(state.islandPlans.length, 2);
            assert.equal(state.islandPlans.find(plan => plan.id === firstPlan.id).status, 'completed');
            const reservations = await page.evaluate(() => window.__islandFixturePlans);
            assert.equal(reservations.length, 2);
            for (const entry of reservations) {
                const saved = state.islandPlans.find(plan => plan.id === entry.plan.id);
                assert.deepEqual(saved.slots.map(slot => slot.problem), entry.plan.slots.map(slot => slot.problem), 'Full reserved Problems remain byte-for-byte stable throughout the run');
            }
            const starts = state.islandEvents.filter(event => event.type === 'plan_started');
            const completions = state.islandEvents.filter(event => event.type === 'plan_completed');
            assert.equal(starts.length, 2); assert.equal(completions.length, 1);
            assert.equal(completions[0].planId, firstPlan.id);
            persistence = { expectedAttempts, uniqueEvents: actionEvents.length, uniqueLearningLogs: state.logs.length,
                initialCompletedSets: INITIAL_COMPLETED_SETS, completedSets: state.island.completedSets, realCompletedSets: 1, deferredRewards: 0,
                growthTarget: firstPlan.growthTarget, growth: state.island.growth,
                setup: await page.evaluate(() => window.__islandFixtureSetup), normalFlow,
                pendingPlanId: state.plan.id, pendingCursor: state.plan.cursor, reservations, events: state.islandEvents, logs: state.logs, wrongSnapshots: snapshots };
        } else {
            assert.deepEqual(after, before, 'Study DEV fixture must not change learning data');
            assert.equal(await page.locator(`[data-benchmark-id="${FIXTURE}"]`).getAttribute('data-benchmark-complete'), 'true');
            persistence = { learningStateUnchanged: true, receiptScope: 'nonrecording-study-dev-fixture' };
        }
        assert.equal(errors.length, 0, `Browser errors: ${JSON.stringify(errors)}`);
        const durationMs = timing.end - timing.start;
        return { lane, scenario, repetition, layout: layout.name, metadata, controls, questions: renderedQuestions,
            durationMs, completedProblemsPerMinute: 600000 / durationMs, samples, interruptions, persistence, errors };
    } catch (error) {
        const failure = { lane, scenario, repetition, layout: layout.name, question: activeQuestion + 1, errors };
        try {
            failure.dom = await page.evaluate(() => ({
                pending: window.__islandThroughputPending, sample: window.__islandThroughputSample,
                study: document.querySelector('[data-study-index]')?.outerHTML,
                island: document.querySelector('.island-page')?.outerHTML,
                activeElement: document.activeElement?.outerHTML,
            }));
            await mkdir(dirname(output), { recursive: true });
            failure.screenshot = `${dirname(output)}/failure-${lane}-${layout.name}-${repetition}-${scenario}.png`;
            await page.screenshot({ path: failure.screenshot });
        } catch (diagnosticError) { failure.diagnosticError = diagnosticError.message; }
        report.failure = failure;
        throw error;
    } finally { await context.close(); }
}

function summarize() {
    const islandMetadata = report.runs.filter(run => run.lane === 'island').map(run => run.metadata);
    report.runtime = {
        revisions: [...new Set(islandMetadata.map(metadata => metadata.revision))],
        versions: [...new Set(islandMetadata.map(metadata => metadata.version))],
        candidates: [...new Set(islandMetadata.map(metadata => metadata.candidate))],
        learningCandidates: [...new Set(islandMetadata.map(metadata => metadata.learningCandidate))],
        deliveryIds: [...new Set(islandMetadata.map(metadata => metadata.delivery))],
        flag: 'VITE_ISLAND_ENABLED=true',
        evidenceSource: 'Actual rendered Island data attributes on the shared Vite target; Study fixture runs against the same server.',
    };
    for (const layout of layouts) {
        const select = (lane, scenario = 'all-correct') => report.runs.filter(run => run.layout === layout.name && run.lane === lane && run.scenario === scenario);
        const study = select('study');
        const island = select('island');
        const correct = report.runs.filter(run => run.layout === layout.name && run.lane === 'island').flatMap(run => run.samples.filter(sample => !sample.wrong && !sample.terminal).map(sample => sample.ms));
        const incorrect = select('island', 'miss-at-q4-q8').flatMap(run => run.samples.filter(sample => sample.wrong).map(sample => sample.ms));
        const boundaries = report.runs.filter(run => run.layout === layout.name && run.lane === 'island')
            .flatMap(run => run.samples.filter(sample => sample.boundary && !sample.wrong).map(sample => sample.ms));
        const studyRate = median(study.map(run => run.completedProblemsPerMinute));
        const islandRate = median(island.map(run => run.completedProblemsPerMinute));
        report.comparisons.push({ layout: layout.name,
            studyMedianProblemsPerMinute: studyRate, islandMedianProblemsPerMinute: islandRate,
            allCorrectIslandToStudyRatio: islandRate / studyRate,
            correctOperableP95Ms: percentile(correct, .95), incorrectRetryP95Ms: percentile(incorrect, .95),
            correctSamples: correct.length, incorrectSamples: incorrect.length,
            automaticSectionTransitionMedianMs: median(island.flatMap(run => run.samples.filter(sample => sample.boundary).map(sample => sample.ms))),
            automaticSectionTransitionSamples: island.flatMap(run => run.samples.filter(sample => sample.boundary)).length,
            sectionBoundaryP95Ms: percentile(boundaries, .95), sectionBoundarySamples: boundaries.length,
            rawStudyDurationMedianMs: median(study.map(run => run.durationMs)), rawIslandDurationMedianMs: median(island.map(run => run.durationMs)),
        });
    }
    report.gates = {
        tenAlternatingRepetitions: repetitions >= 10 && report.runs.length === layouts.length * repetitions * 4,
        allCorrectIslandThroughputNotBelowStudy: report.comparisons.every(comparison => comparison.allCorrectIslandToStudyRatio >= 1),
        correctP95AtMost650Ms: report.comparisons.every(comparison => comparison.correctOperableP95Ms <= 650),
        incorrectP95AtMost550Ms: report.comparisons.every(comparison => comparison.incorrectRetryP95Ms <= 550),
        sectionBoundaryP95AtMost650Ms: report.comparisons.every(comparison => comparison.sectionBoundarySamples >= 20 && comparison.sectionBoundaryP95Ms <= 650),
        twentySameQuestionIncorrectSamplesPerLayout: report.comparisons.every(comparison => comparison.incorrectSamples >= 20),
        noExtraOrdinaryQuestionActions: report.runs.filter(run => run.lane === 'island').every(run => run.interruptions.length === 0),
        automaticSectionBoundaryIncluded: report.runs.filter(run => run.lane === 'island').every(run =>
            run.samples.filter(sample => sample.boundary && !sample.terminal && sample.nextPlanId === sample.expectedNextPlanId && sample.nextRevision === 0).length === 1),
        emptyInputAfterEveryTransition: report.runs.every(run => run.samples.every(sample => sample.inputEmpty)),
        initialIslandControlsUsable: report.runs.filter(run => run.lane === 'island')
            .every(run => run.controls.length === 13 && run.controls.every(control => control.box.width >= 44 && control.box.height >= 44
                && (control.name === 'こたえる' ? control.disabled : control.hit && !control.disabled))),
        exactFixtureAndAtomicReceipts: report.runs.every(run => run.questions.length === 10 && run.persistence),
        phoneAndTablet: layouts.length === 2,
        noBrowserErrors: report.runs.every(run => run.errors.length === 0),
        oneRenderedBuildAndCandidate: report.runtime.revisions.length === 1 && report.runtime.versions.length === 1
            && report.runtime.candidates.length === 1 && report.runtime.candidates[0] === 'mystic-island-shore-garden-v16'
            && report.runtime.learningCandidates.length === 1 && report.runtime.learningCandidates[0] === 'mystic-island-learning-v2',
        sourceFilesUnchangedDuringBenchmark: report.sourceSnapshotStart.hash === report.sourceSnapshotEnd.hash,
    };
    report.evidence = { eligible: report.gates.tenAlternatingRepetitions && report.gates.twentySameQuestionIncorrectSamplesPerLayout
            && report.gates.phoneAndTablet && report.gates.sourceFilesUnchangedDuringBenchmark,
        confidence: repetitions >= 10 ? 'formal repeated UI timing; automated keyboard throughput, not child behavior evidence' : 'diagnostic below ten repetitions',
        productionPlannerEvidence: false, userLearningStateTouched: false };
    report.pass = report.evidence.eligible && Object.values(report.gates).every(Boolean);
}

const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
report.browser = { name: 'chromium', version: browser.version() };
try {
    for (const layout of layouts) {
        for (let repetition = 1; repetition <= repetitions; repetition += 1) {
            for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex += 1) {
                const scenario = scenarios[scenarioIndex];
                const order = (repetition + scenarioIndex) % 2 ? ['study', 'island'] : ['island', 'study'];
                for (const lane of order) {
                    console.log(`Island throughput ${layout.name} ${repetition}/${repetitions} ${scenario} ${lane}`);
                    report.runs.push(await runLane(browser, lane, scenario, repetition, layout));
                }
            }
        }
    }
} catch (error) {
    report.error = error.stack;
    process.exitCode = 1;
} finally {
    await browser.close(); report.browserClosed = true;
    try {
        report.sourceSnapshotEnd = await sourceFingerprint();
        if (!report.error) summarize();
    } catch (error) { report.error = [report.error, error.stack].filter(Boolean).join('\n'); report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ output, comparisons: report.comparisons, gates: report.gates, evidence: report.evidence, pass: report.pass, error: report.error }, null, 2));
    if (repetitions >= 10 && layouts.length === 2 && !report.pass) process.exitCode = 1;
}
