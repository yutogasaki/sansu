import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { activate, button, ISLAND_CANDIDATE, percentile, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, LEARNING_CANDIDATE, waitLearningReady } from './island-learning-checks.mjs';
import { assertFirstReservation, assertProfileFree, onboardingStores, untouchedStep } from './island-onboarding-checks.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const output = process.env.SANSU_ISLAND_ENTRY_TIMING_OUTPUT;
assert(target && buildSourcePath && output, 'Set an immutable production URL, build-source manifest and fresh entry-timing output directory');
const repetitions = 10;
const layouts = [{ name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false }];
const phases = ['setup-selection-to-input', 'home-start-to-input', 'reload-navigation-to-input'];
const sha = value => createHash('sha256').update(value).digest('hex');
const manifestBytes = await fs.readFile(buildSourcePath), buildSource = JSON.parse(manifestBytes);
const qaPaths = ['tools/e2e-island-entry-timing.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs',
    'tools/island-learning-fixtures.mjs', 'tools/island-onboarding-checks.mjs'];
const sourceSnapshot = async () => {
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(output, { recursive: true });
await assert.rejects(fs.readFile(`${output}/report.json`), { code: 'ENOENT' }, 'Preserve previous reports and failures');
const report = { target, startedAt: new Date().toISOString(), pass: false, browserClosed: false, humanN: 0,
    buildSource: { path: resolve(buildSourcePath), manifestSHA: sha(manifestBytes), sourceHash: buildSource.sourceHash,
        revision: buildSource.revision, flags: buildSource.flags },
    sourceStart: await sourceSnapshot(), runner: { cwd: process.cwd(), command: process.argv }, runs: [], measurements: [],
    setup: { grade: 1, gradeLabel: '小学 1 年生', subject: 'math', subjectLabel: 'さんすう',
        rangeLabel: '足し算まで', mathStartLevel: 7, blankName: true },
    protocol: { repetitionsPerLayout: repetitions, phases,
        start: 'Setup and home start begin at the actual trusted click in document capture phase, excluding Playwright actionability and transport waits.',
        end: 'First requestAnimationFrame observation of the correct learning candidate, learning mode, plan/revision input-ready=true and a visible enabled real input control; no extra stable-frame wait.',
        polling: 'One requestAnimationFrame sample per rendered frame. Raw frame gaps are reported; detection has frame quantization. No fixed sleep, DB read, screenshot or video during measurement.',
        reload: 'A real new document reload uses its PerformanceNavigationTiming start (relative 0 / performance.timeOrigin), not the prior document or Node clock. Observer installation delay is recorded.',
        quantiles: 'Nearest rank, matching the existing percentile helper: sorted values at ceil(fraction * count) - 1.',
        cache: 'Each repetition uses a fresh isolated browser context and actual setup. Reload is the same-context browser reload with normal browser cache and service workers blocked; it is not device cold launch or PWA installation.',
        thresholds: 'No latency pass/fail threshold is added. PASS covers protocol, saved state, operation counts and source identity only.',
        timeout: 'A 30-second operability watchdog records failure if input never appears; this is not a latency acceptance target.',
        input: 'The same explicit setup is used at both viewports. Normal planner problems and default sound settings are retained; no profile, question, receipt, progress or clock injection.' } };
report.buildSourceMismatches = buildSource.files.filter(file => report.sourceStart.files.find(row => row.path === file.path)?.sha256 !== file.sha256);
const writeReport = () => fs.writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
await writeReport();
assert.deepEqual(report.buildSourceMismatches, [], 'Frozen application inputs must match before measurement');

/** Observation only: no app imports, persistence hooks, clock overrides or app state writes. */
async function installTimingObserver(page) {
    await page.addInitScript(({ candidate, learningCandidate }) => {
        const probe = window.__islandEntryTiming = { documentId: crypto.randomUUID(), timeOrigin: performance.timeOrigin,
            installedAt: performance.now(), initialURL: location.href, current: null };
        let cleanup = () => {};
        const ready = expected => {
            const shell = document.querySelector('.island-page'), panel = shell?.querySelector('.island-learning');
            const form = panel?.querySelector('.park-answer');
            if (shell?.dataset.mode !== 'learning' || shell.dataset.visualCandidateId !== candidate
                || shell.dataset.learningCandidate !== learningCandidate || panel?.dataset.inputReady !== 'true' || !form) return null;
            const planId = panel.dataset.islandPlanId, revision = Number(panel.dataset.islandPlanRevision), problemId = form.dataset.problemId;
            if (!planId || !Number.isSafeInteger(revision) || !problemId) return null;
            if (expected && (planId !== expected.planId || revision !== expected.revision || problemId !== expected.problemId)) return null;
            const control = form.querySelector('.park-choices button:not(:disabled), .park-keypad button[aria-label="1"]:not(:disabled)');
            if (!(control instanceof HTMLButtonElement)) return null;
            const rect = control.getBoundingClientRect(), style = getComputedStyle(control);
            if (rect.width <= 0 || rect.height <= 0 || rect.top < 0 || rect.left < 0 || rect.bottom > innerHeight + .5
                || rect.right > innerWidth + .5 || style.visibility === 'hidden' || style.display === 'none') return null;
            return { planId, revision, problemId, inputType: form.dataset.inputType, intro: panel.dataset.intro,
                candidate: shell.dataset.visualCandidateId, learningCandidate: shell.dataset.learningCandidate,
                delivery: shell.dataset.deliveryId, version: shell.dataset.buildVersion, revisionBuild: shell.dataset.buildRevision,
                viewport: { width: innerWidth, height: innerHeight }, inputControl: { label: control.getAttribute('aria-label') || control.textContent.trim(),
                    x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                serviceWorkerControlled: Boolean(navigator.serviceWorker.controller), renderer: document.querySelector('[data-renderer]')?.dataset.renderer };
        };
        window.__armIslandEntryTiming = (kind, expected, label) => {
            cleanup();
            const run = probe.current = { kind, expected, label, documentId: probe.documentId, timeOrigin: probe.timeOrigin,
                observerInstalledAt: probe.installedAt, armedAt: performance.now(), actions: [], frameGapsMs: [], frameSamples: 0, finished: false };
            let previousFrame, frameId;
            const tick = () => {
                const now = performance.now();
                if (previousFrame !== undefined) run.frameGapsMs.push(now - previousFrame);
                previousFrame = now; run.frameSamples++;
                const actual = ready(expected);
                if (actual || now - run.startedAt > 30000) {
                    run.endedAt = performance.now(); run.endedWallAt = Date.now(); run.ms = run.endedAt - run.startedAt;
                    run.actual = actual; run.finished = true;
                    if (!actual) run.error = 'The operability watchdog ended before a ready input was observed';
                    cleanup(); return;
                }
                frameId = requestAnimationFrame(tick);
            };
            const start = at => {
                run.startedAt = at; run.startedWallAt = kind === 'reload-navigation-to-input' ? performance.timeOrigin : Date.now();
                frameId = requestAnimationFrame(tick);
            };
            const onClick = event => {
                if (!event.isTrusted) return;
                const control = event.target.closest?.('button');
                const action = { type: 'click', trusted: event.isTrusted, at: performance.now(), label: control?.textContent.trim(),
                    hash: location.hash, x: event.clientX, y: event.clientY };
                run.actions.push(action);
                const matches = kind === 'setup-selection-to-input'
                    ? control?.matches('.island-setup-options button') && action.label === label
                    : kind === 'home-start-to-input' && control?.matches('.island-start');
                if (matches && run.startedAt === undefined) { run.trigger = action; start(action.at); }
            };
            const onKey = event => { if (event.isTrusted) run.actions.push({ type: 'keydown', trusted: true, at: performance.now(), key: event.key }); };
            document.addEventListener('click', onClick, true); document.addEventListener('keydown', onKey, true);
            cleanup = () => {
                cancelAnimationFrame(frameId); document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey, true);
            };
            if (kind === 'reload-navigation-to-input') start(0);
        };
        // A new-document reload has no app state injected into it. Its observed
        // binding is later checked against the exact pre-reload native snapshot.
        const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload' || performance.navigation?.type === 1;
        if (reloading) window.__armIslandEntryTiming('reload-navigation-to-input');
    }, { candidate: ISLAND_CANDIDATE, learningCandidate: LEARNING_CANDIDATE });
}

const binding = plan => ({ planId: plan.id, revision: plan.revision, problemId: plan.slots[plan.cursor].problem.id });
async function actualIdentity(page) {
    const actual = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
    assert.equal(actual.revision, buildSource.revision); assert(!actual.revision.includes('development'));
    assert.equal(actual.island.enabled, true); assert.equal(actual.island.candidate, ISLAND_CANDIDATE);
    assert.equal(actual.island.learningCandidate, LEARNING_CANDIDATE); assert.equal(actual.island.delivery, 'mystic-island-v1');
    if (buildSource.version) assert.deepEqual(actual, buildSource.version);
    if (report.manifest) assert.deepEqual(actual, report.manifest, 'Every run uses the same served build'); else report.manifest = actual;
    return actual;
}
async function measurement(page, row, kind, expected) {
    await page.waitForFunction(kind => window.__islandEntryTiming?.current?.kind === kind && window.__islandEntryTiming.current.finished, kind,
        { timeout: 35000, polling: 'raf' });
    const measured = await page.evaluate(() => {
        const probe = window.__islandEntryTiming, navigation = performance.getEntriesByType('navigation')[0];
        return { ...probe.current, navigation: navigation?.toJSON(), documentId: probe.documentId, timeOrigin: probe.timeOrigin,
            pageURL: location.href, userAgent: navigator.userAgent };
    });
    Object.assign(measured, { layout: row.name, repetition: row.repetition, protocolPass: false });
    row.measurements.push(measured); report.measurements.push(measured);
    assert(!measured.error, measured.error); assert(measured.actual);
    assert(Number.isFinite(measured.ms) && measured.ms >= 0);
    const expectedActions = kind === 'reload-navigation-to-input' ? 0 : 1;
    measured.extraOperations = measured.actions.length - expectedActions;
    assert.equal(measured.extraOperations, 0, 'No extra operation is required between the start and actual input readiness');
    if (expectedActions) assert(measured.trigger?.trusted && measured.actions[0].at === measured.startedAt);
    else { assert.equal(measured.navigation?.type, 'reload'); assert.equal(measured.navigation.startTime, 0); assert.equal(measured.startedAt, 0); }
    assert.equal(measured.actual.version, report.manifest.version); assert.equal(measured.actual.revisionBuild, report.manifest.revision);
    assert.equal(measured.actual.candidate, ISLAND_CANDIDATE); assert.equal(measured.actual.learningCandidate, LEARNING_CANDIDATE);
    assert.deepEqual(measured.actual.viewport, row.viewport); assert.equal(measured.actual.serviceWorkerControlled, false);
    if (expected) assert.deepEqual({ planId: measured.actual.planId, revision: measured.actual.revision, problemId: measured.actual.problemId }, expected);
    measured.protocolPass = true;
    return measured;
}

const launchOptions = process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {};
let browser;
try {
    browser = await chromium.launch(launchOptions);
    report.browser = { name: 'chromium', version: browser.version(), launchOptions };
    for (let repetition = 1; repetition <= repetitions; repetition++) for (const layout of layouts) {
        const row = { ...layout, repetition, startedAt: new Date().toISOString(), measurements: [], errors: [], answers: [], pass: false };
        report.runs.push(row);
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, locale: 'ja-JP',
            reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => row.errors.push(error.stack ?? error.message));
        try {
            await installTimingObserver(page);
            await page.goto(`${target}/#/`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            await actualIdentity(page);
            const empty = await onboardingStores(page); assertProfileFree(empty);
            await activate(button(page, 'まなぶ'), layout.touch); await untouchedStep(page, 'grade', empty);
            await activate(button(page, report.setup.gradeLabel), layout.touch); await untouchedStep(page, 'subject', empty);
            await activate(button(page, report.setup.subjectLabel), layout.touch); await untouchedStep(page, 'math', empty);
            // The interval starts inside the native event, after any actionability wait.
            await page.evaluate(label => window.__armIslandEntryTiming('setup-selection-to-input', undefined, label), report.setup.rangeLabel);
            await activate(button(page, report.setup.rangeLabel), layout.touch);
            const firstTiming = await measurement(page, row, phases[0]);
            const created = await onboardingStores(page), profile = created.profiles.rows[0];
            assert.equal(created.profiles.rows.length, 1); assert.equal(profile.name, 'プレイヤー'); assert.equal(profile.grade, 1);
            assert.equal(profile.subjectMode, 'math'); assert.equal(profile.mathStartLevel, 7);
            assert.equal(created.appData.rows[0].activeProfileId, profile.id); assert.deepEqual(created.appData.rows[0].profiles[profile.id], profile);
            const firstPlan = assertFirstReservation(created, profile.id);
            assert.deepEqual({ planId: firstTiming.actual.planId, revision: firstTiming.actual.revision, problemId: firstTiming.actual.problemId }, binding(firstPlan));
            assert.equal(firstTiming.actual.intro, 'true'); assert.equal(new URL(page.url()).hash, '#/island');
            assert(!report.runs.some(prior => prior !== row && prior.profileId === profile.id), 'Every repetition creates a distinct real profile');
            row.profileId = profile.id; row.profile = profile; row.firstPlan = firstPlan; row.createdStoresSHA = sha(JSON.stringify(created));
            await waitReady(page); await waitLearningReady(page, firstPlan);
            let state = await readNative(page, profile.id), steps = 0;
            while (state.plan.cursor === 0) {
                assert(++steps <= 32, 'The first actual problem completes in bounded written rows');
                const result = await attempt(page, state, { touch: layout.touch });
                row.answers.push({ receipt: result.receipt, sampleOutsideEntryTiming: result.sample }); state = result.after;
            }
            assert.equal(state.plan.id, firstPlan.id); assert.equal(state.plan.cursor, 1); assert.equal(state.logs.length, 1);
            assert.equal(state.logs[0].result, 'correct'); assert.equal(row.answers.at(-1).receipt.learningLogId, state.logs[0].id);
            assert.deepEqual(state.plan.slots.map(slot => slot.problem), firstPlan.slots.map(slot => slot.problem));
            const paused = await onboardingStores(page); row.savedPlan = state.plan; row.savedAnswerLog = state.logs[0];
            await activate(button(page, 'しまへ'), layout.touch); await waitMode(page, 'home');
            assert.deepEqual(await onboardingStores(page), paused, 'Returning home changes none of the saved work');
            await page.evaluate(expected => window.__armIslandEntryTiming('home-start-to-input', expected), binding(state.plan));
            await activate(page.locator('.island-start'), layout.touch);
            await measurement(page, row, phases[1], binding(state.plan));
            assert.deepEqual(await onboardingStores(page), paused, 'One home start resumes the exact saved plan without another receipt');
            const previousDocument = await page.evaluate(() => ({ id: window.__islandEntryTiming.documentId, timeOrigin: performance.timeOrigin }));
            await page.reload({ waitUntil: 'commit' });
            const reloadTiming = await measurement(page, row, phases[2], binding(state.plan));
            assert.notEqual(reloadTiming.documentId, previousDocument.id); assert.notEqual(reloadTiming.timeOrigin, previousDocument.timeOrigin);
            row.reloadDocuments = { before: previousDocument, after: { id: reloadTiming.documentId, timeOrigin: reloadTiming.timeOrigin } };
            const reloaded = await onboardingStores(page);
            assert.deepEqual(reloaded, paused, 'New-document reload preserves all stores, reserved problems, cursor and real answer receipts');
            row.persistence = { beforeHomeSHA: sha(JSON.stringify(paused)), afterReloadSHA: sha(JSON.stringify(reloaded)),
                homeUnchanged: true, resumedUnchanged: true, reloadedUnchanged: true };
            await waitReady(page); row.runtime = await runtimeMetadata(page); await actualIdentity(page);
            assert.equal(row.runtime.version, report.manifest.version); assert.deepEqual(row.errors, []);
            row.pass = true;
            console.log(`PASS ${layout.name} ${repetition}/${repetitions}: ${row.measurements.map(value => `${value.kind}=${value.ms.toFixed(1)}ms`).join(', ')}`);
        } catch (error) {
            row.error = error.stack ?? String(error); process.exitCode = 1;
            row.failureProbe = await page.evaluate(() => window.__islandEntryTiming).catch(() => null);
            row.failureStores = await onboardingStores(page).catch(() => null);
            await page.screenshot({ path: `${output}/${layout.name}-${repetition}-failure.png`, fullPage: true }).catch(() => {});
        } finally { row.finishedAt = new Date().toISOString(); await context.close(); }
        await writeReport();
    }
} catch (error) { report.error = error.stack ?? String(error); process.exitCode = 1; }
finally {
    if (browser) { await browser.close(); report.browserClosed = true; }
    try { report.sourceEnd = await sourceSnapshot(); report.sourceStable = report.sourceStart.hash === report.sourceEnd.hash; }
    catch (error) { report.sourceError = error.stack ?? String(error); report.sourceStable = false; }
    report.distributions = layouts.flatMap(layout => phases.map(phase => {
        const samples = report.runs.filter(row => row.name === layout.name && row.pass).flatMap(row => row.measurements)
            .filter(value => value.kind === phase && value.protocolPass);
        const values = samples.map(sample => sample.ms);
        return { layout: layout.name, phase, samples: values.length, expectedSamples: repetitions,
            p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), minMs: values.length ? Math.min(...values) : null,
            maxMs: values.length ? Math.max(...values) : null, rawMs: values,
            extraOperations: samples.map(sample => sample.extraOperations), performanceThreshold: null,
            denominator: 'Protocol-valid complete repetitions; all unsuccessful or incomplete raw measurements remain in runs and measurements.' };
    }));
    report.eligible = report.distributions.every(value => value.samples === repetitions) && report.sourceStable
        && report.runs.length === repetitions * layouts.length && report.runs.every(row => row.pass);
    report.pass = !report.error && report.eligible && report.browserClosed;
    report.finishedAt = new Date().toISOString();
    if (!report.pass) process.exitCode = 1;
    await writeReport();
    console.log(JSON.stringify({ pass: report.pass, eligible: report.eligible, report: `${output}/report.json`, distributions: report.distributions }, null, 2));
}
