import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { chromium } from 'playwright';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const output = process.env.SANSU_ISLAND_OBSERVATION_OUTPUT;
assert(output, 'Set SANSU_ISLAND_OBSERVATION_OUTPUT to a new evidence directory');
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaPaths = ['tools/e2e-island-observation.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs',
    'tools/island-learning-fixtures.mjs', 'tools/island-support-checks.mjs'];
const scenarios = [
    { name: 'phone-number', width: 390, height: 844, touch: true, skill: 'add_1d_2', type: 'number', mathAnswerCount: 21 },
    { name: 'tablet-written-multiply', width: 768, height: 1024, touch: false, skill: 'mul_2d2d', type: 'hissan' },
];
let buildSource, browser, helpers, learning, fixtures, support, auditIslandObservations;
const report = { target, buildSourcePath, startedAt: new Date().toISOString(), pass: false, browserLaunched: false,
    browserClosed: false, humanN: 0, deviceEvidence: 'Chromium viewports, not physical phone/tablet devices',
    scope: 'Actual production-mounted DOM and native UI operations, compared with saved prospective Island envelopes. Disposable explicit profile/memory fixtures only; normal fixed 3/6-slot reservations. No question, plan, receipt, reward, progress or observer injection. No learning-effect, mastery, attention or no-help inference. This complements the existing input/PWA/reward/throughput suites; it does not replace them.',
    scenarios: [], captures: [] };
await fs.mkdir(output, { recursive: true });
assert.equal(await fs.stat(resolve(output, 'report.json')).then(() => true, error => {
    if (error.code === 'ENOENT') return false; throw error;
}), false, 'Preserve previous evidence: use a fresh output directory');
const writeReport = () => fs.writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
await writeReport();

async function sourceSnapshot() {
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(resolve(sourceRoot, path))) })));
    const expected = new Map(buildSource.files.map(file => [file.path, file.sha256]));
    return { files, closureHash: sha(JSON.stringify(files)),
        closureHashMethod: 'SHA-256 of JSON.stringify(sorted actual app+QA path/sha256 records), separate from build generator sourceHash',
        manifestSha256: sha(await fs.readFile(buildSourcePath)),
        mismatches: files.filter(file => expected.has(file.path) && expected.get(file.path) !== file.sha256),
        qaFiles: files.filter(file => qaPaths.includes(file.path)) };
}
function validateBuild() {
    assert(target && buildSourcePath, 'Explicit immutable production URL and build-source manifest are required');
    assert(Array.isArray(buildSource.files) && buildSource.files.length > 0);
    assert.equal(new Set(buildSource.files.map(file => file.path)).size, buildSource.files.length);
    for (const file of buildSource.files) {
        assert(typeof file.path === 'string' && !isAbsolute(file.path) && !file.path.split('/').includes('..'));
        assert(/^[a-f0-9]{64}$/.test(file.sha256));
    }
    assert(/^[a-f0-9]{64}$/.test(buildSource.sourceHash), 'Record original sourceHash; do not re-normalize the Python manifest');
    assert.equal(buildSource.sourceStableAtBuildEnd, true);
    for (const [key, value] of Object.entries({ VITE_ISLAND_ENABLED: 'true', VITE_BUILD_PLAY_ENABLED: 'true',
        VITE_PARK_RENDERER: 'three', VITE_ISLAND_ART_DIRECTION: 'moon-garden' })) assert.equal(buildSource.flags?.[key], value);
    const version = buildSource.version;
    assert(version && version.revision === buildSource.revision && !version.revision.includes('development'));
    assert(version.version.startsWith(`${version.revision}:`));
    assert.equal(version.island?.enabled, true); assert.equal(version.park?.enabled, true); assert.equal(version.park?.renderer, 'three');
    assert.equal(version.island.delivery, 'mystic-island-v1');
    assert.equal(version.island.candidate, 'mystic-island-shore-garden-v13');
    assert.equal(version.island.learningCandidate, 'mystic-island-learning-v2');
    assert.equal(version.island.artDirection, 'moon-garden');
    report.buildSource = { revision: buildSource.revision, sourceHash: buildSource.sourceHash,
        sourceFileCount: buildSource.files.length, flags: buildSource.flags, version };
}
async function identity(page) {
    const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
    assert.deepEqual(manifest, buildSource.version, 'Actual served version/flags must match this immutable build');
    const actual = await helpers.runtimeMetadata(page);
    assert.equal(actual.version, manifest.version); assert.equal(actual.revision, manifest.revision);
    assert.equal(actual.delivery, manifest.island.delivery); assert.equal(actual.candidate, manifest.island.candidate);
    assert.equal(actual.learningCandidate, manifest.island.learningCandidate); assert.equal(actual.artDirection, 'moon-garden');
    assert.equal(actual.renderer, 'three'); assert.equal(actual.serviceWorkerControlled, false);
    return actual;
}
async function dom(page) {
    return page.locator('.island-learning').evaluate(panel => {
        const form = panel.querySelector('.park-answer');
        const rect = node => { if (!node) return undefined; const r = node.getBoundingClientRect();
            return { width: r.width, height: r.height, display: getComputedStyle(node).display }; };
        const hint = form?.querySelector('.island-learning-support[data-support-kind="hint"]');
        const model = form?.querySelector('.island-support-model');
        return { at: Date.now(), monotonic: performance.now(), timeOrigin: performance.timeOrigin,
            planId: panel.dataset.islandPlanId, revision: Number(panel.dataset.islandPlanRevision),
            problemId: form?.dataset.problemId, inputMode: form?.dataset.inputType,
            referenceVisual: form?.querySelector('.park-question [data-visual-surface]') ? 'present' : 'absent',
            stage: form?.closest('.island-answer-stage')?.dataset.supportStage,
            form: rect(form), hint: hint ? rect(hint) : null, model: model ? rect(model) : null,
            enabledInputs: form?.querySelectorAll('.park-keypad button:not(:disabled), .park-choices button:not(:disabled)').length,
            questionText: form?.querySelector('.park-question')?.textContent };
    });
}
async function capture(page, row, label) {
    const metadata = await identity(page), file = `${row.name}-${label}.png`;
    const bytes = await page.screenshot({ path: resolve(output, file), fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, row: row.name, phase: label });
}
function newPresentation(row, lowerBound, documentChange) {
    const previous = row.current;
    row.current = { lowerBound, support: {}, previousDocumentId: previous?.documentId,
        documentChange: documentChange ?? false };
}
function observeDOM(row, actual, plan) {
    const slot = plan.slots[plan.cursor];
    assert.equal(actual.planId, plan.id); assert.equal(actual.revision, plan.revision);
    assert.equal(actual.problemId, slot.problem.id); assert(actual.form.width > 0 && actual.form.height > 0);
    assert(['number', 'multi-number', 'choice', 'hissan'].includes(actual.inputMode));
    if (actual.inputMode === 'hissan') assert(fixtures.expectedLearningAnswer(slot, 'hissan').step);
    assert.equal(actual.stage, slot.supportStage ?? (slot.assisted ? 'model' : 'none'));
    if (actual.stage === 'model') assert.equal(actual.enabledInputs, 0);
    else assert(actual.enabledInputs > 0, 'Current actual input is operable');
    for (const kind of ['hint', 'model']) {
        if (actual[kind]) {
            assert(actual[kind].width > 0 && actual[kind].height > 0 && actual[kind].display !== 'none', `${kind} has actual rendered bounds`);
            row.current.support[kind] ??= { min: row.current.lowerBound, max: actual.at };
        }
    }
    return actual;
}
async function armNativeAction(page) {
    await page.evaluate(() => {
        window.__islandObservationQaGesture = undefined;
        const listen = event => {
            const target = event.target.closest?.('button');
            if (!target?.matches('.park-keypad [data-keypad-submit], .park-choices button, .island-learning-actions button')) return;
            document.removeEventListener('click', listen, true);
            window.__islandObservationQaGesture = { trusted: event.isTrusted, at: Date.now(), monotonic: performance.now(),
                label: target.getAttribute('aria-label') || target.textContent.trim() };
        };
        document.addEventListener('click', listen, true);
    });
}
function assertEnvelope(row, before, actualDOM, result, operation, actionEnd, gesture) {
    const plan = before.plan, slot = plan.slots[plan.cursor], event = result.receipt, value = event.observation;
    const written = actualDOM.inputMode === 'hissan';
    const answer = operation.type === 'answer';
    const final = answer && !operation.wrong && fixtures.expectedLearningAnswer(slot, actualDOM.inputMode).final;
    assert(gesture?.trusted, 'Every recorded operation comes from a trusted real UI gesture');
    assert.equal(event.id, JSON.stringify(['island-action-v1', plan.profileId, plan.id, plan.revision]));
    assert.equal(event.profileId, plan.profileId); assert.equal(event.planId, plan.id); assert.equal(event.slotIndex, plan.cursor);
    assert(value, 'The new candidate must persist the optional observation envelope');
    assert.equal(value.version, 1); assert.equal(value.problemId, slot.problem.id); assert.equal(value.revisionBefore, plan.revision);
    assert.equal(value.supportBefore, slot.supportStage ?? (slot.assisted ? 'legacy-assisted-unknown-stage' : 'unassisted-slot'));
    assert.equal(value.answerScope, answer ? written ? 'hissan-step' : 'whole' : 'not-an-answer');
    assert.equal(value.stepIndexBefore, written ? slot.hissanStep ?? 0 : undefined, 'Only real Hissan operations have a pre-operation step');
    assert.equal(value.wholeCompleted, Boolean(final || operation.type === 'supported_completed'));
    assert.equal(value.adapterVersion, 'island-dom-v1');
    assert(Number.isFinite(value.eventAt) && value.eventAt >= gesture.at && value.eventAt <= actionEnd);
    assert.equal(value.coverage, 'current-presentation'); assert.deepEqual(value.gaps, []);
    const shown = value.presentation;
    assert(shown && typeof shown.id === 'string' && typeof shown.documentId === 'string');
    assert.equal(shown.inputVersion, 'island-input-v1'); assert.equal(shown.inputMode, actualDOM.inputMode);
    assert.equal(shown.referenceVisual, actualDOM.referenceVisual);
    assert(shown.observedAt >= row.current.lowerBound && shown.observedAt <= value.eventAt);
    assert(Number.isFinite(value.elapsedSincePresentationMs) && value.elapsedSincePresentationMs >= 0);
    if (row.current.id) {
        assert.equal(shown.id, row.current.id, 'Same-slot rerenders and answers retain presentation identity');
        assert.equal(shown.documentId, row.current.documentId);
    } else {
        assert(!row.presentations.some(prior => prior.id === shown.id), 'New slot/re-entry/reload creates a distinct presentation');
        if (row.current.previousDocumentId) {
            if (row.current.documentChange) assert.notEqual(shown.documentId, row.current.previousDocumentId);
            else assert.equal(shown.documentId, row.current.previousDocumentId);
        }
        row.current.id = shown.id; row.current.documentId = shown.documentId;
        row.presentations.push({ ...shown, firstEventId: event.id });
    }
    for (const [kind, key] of [['hint', 'hintAt'], ['model', 'modelAt']]) {
        const observedAt = value.observedSupport?.[key], expected = row.current.support[kind];
        if (expected) assert(Number.isFinite(observedAt) && observedAt >= expected.min && observedAt <= expected.max,
            `${key}: actual DOM commit must be inside its independently observed UI transition`);
        else assert.equal(observedAt, undefined, `Unobserved ${kind} remains unknown; a saved request does not prove its future DOM`);
    }
    if (answer) {
        const expectedResult = slot.assisted ? operation.wrong ? 'assisted-incorrect' : 'assisted-correct' : operation.wrong ? 'incorrect' : 'correct';
        assert.equal(event.result, expectedResult);
        if (slot.assisted || (written && !operation.wrong && !final)) assert.deepEqual(result.after.logs, before.logs);
        else {
            const logs = result.after.logs.filter(log => !before.logs.some(previous => previous.id === log.id));
            assert.equal(logs.length, 1); assert.equal(logs[0].result, operation.wrong ? 'incorrect' : 'correct');
            assert.equal(event.learningLogId, logs[0].id);
        }
    }
}
function assertOperationStores(before, after, plan) {
    const allowed = new Set(['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'profiles', 'appData']);
    for (const [name, rows] of Object.entries(before)) if (!allowed.has(name)) assert.deepEqual(after[name], rows, `${name} is outside this math learning operation`);
    for (const previous of before.islandEvents) assert.deepEqual(after.islandEvents.find(event => event.id === previous.id), previous, 'Existing receipts are immutable; no observation backfill');
    for (const previous of before.islandPlans) if (previous.id !== plan.id) assert.deepEqual(after.islandPlans.find(item => item.id === previous.id), previous);
    for (const previous of before.islands) assert.deepEqual(after.islands.find(item => item.profileId === previous.profileId).items, previous.items);
}
async function operate(page, row, before, operation) {
    await learning.waitLearningReady(page, before.plan);
    const actualDOM = observeDOM(row, await dom(page), before.plan);
    if (operation.type === 'answer' && actualDOM.inputMode !== 'choice') await helpers.activate(helpers.button(page, 'こたえを けす'), row.touch);
    const stores = await support.readSupportStores(page);
    await armNativeAction(page);
    const lowerBound = await page.evaluate(() => Date.now());
    const result = operation.type === 'answer'
        ? await learning.attempt(page, before, { wrong: operation.wrong, touch: row.touch, double: operation.double })
        : await support.supportAction(page, before, operation.label, operation.type, row.touch);
    const gesture = await page.evaluate(() => window.__islandObservationQaGesture), actionEnd = await page.evaluate(() => Date.now());
    assertEnvelope(row, before, actualDOM, result, operation, actionEnd, gesture);
    const afterStores = await support.readSupportStores(page);
    assertOperationStores(stores, afterStores, before.plan);
    if (operation.type === 'supported_completed') row.supportedIntegrity = support.assertSupportedIntegrity(stores, afterStores, before.plan, before.plan.cursor);
    row.operations.push({ operation, before: { planId: before.plan.id, revision: before.plan.revision, cursor: before.plan.cursor,
        step: before.plan.slots[before.plan.cursor].hissanStep }, actualDOM, gesture, event: result.receipt,
        after: { revision: result.saved.revision, cursor: result.saved.cursor, step: result.saved.slots[before.plan.cursor].hissanStep },
        existingTiming: result.sample ?? result.timing });
    if (result.after.plan) {
        await learning.waitLearningReady(page, result.after.plan);
        if (result.saved.cursor !== before.plan.cursor) newPresentation(row, lowerBound, false);
        observeDOM(row, await dom(page), result.after.plan);
    }
    return result.after;
}
async function reenter(page, row, before, reload) {
    const stores = await support.readSupportStores(page), lowerBound = await page.evaluate(() => Date.now());
    if (reload) { await page.reload(); await helpers.waitReady(page); }
    else {
        await helpers.activate(helpers.button(page, 'しまへ'), row.touch); await helpers.waitMode(page, 'home');
        await helpers.activate(helpers.button(page, 'つづきから とく'), row.touch); await helpers.waitMode(page, 'learning');
    }
    await learning.waitLearningReady(page, before.plan);
    assert.deepEqual(await support.readSupportStores(page), stores, 'Pause/re-entry/reload writes no learning operation or observation backfill');
    newPresentation(row, lowerBound, reload);
    const after = await helpers.readNative(page, before.plan.profileId);
    observeDOM(row, await dom(page), after.plan); await identity(page);
    return after;
}

try {
    assert(target && buildSourcePath, 'Explicit SANSU_ISLAND_PRODUCTION_URL and SANSU_ISLAND_BUILD_SOURCE required');
    buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8')); validateBuild();
    assert.equal(resolve(process.cwd()), resolve(sourceRoot), 'Run in this fixed source root; the shared Node fixture compiler uses cwd');
    report.sourceStart = await sourceSnapshot(); await writeReport();
    assert.deepEqual(report.sourceStart.mismatches, []);
    [helpers, learning, fixtures, support] = await Promise.all([import('./island-e2e-helpers.mjs'), import('./island-learning-checks.mjs'),
        import('./island-learning-fixtures.mjs'), import('./island-support-checks.mjs')]);
    report.fixtureModuleHash = fixtures.fixtureModuleHash;
    const { build } = await import('esbuild');
    const compiled = await build({ stdin: { contents: "export { auditIslandObservations } from './src/domain/island/learningObservation.ts';", resolveDir: sourceRoot },
        bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    report.readerModuleHash = sha(compiled.outputFiles[0].text);
    ({ auditIslandObservations } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`));
    browser = await chromium.launch(); report.browserLaunched = true;
    for (const scenario of scenarios) {
        const row = { ...scenario, pass: false, fixture: 'seedLearningProfile: explicit disposable profile + scheduled memory; no saved learning events',
            operations: [], presentations: [] }; report.scenarios.push(row);
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: scenario.touch, reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.stack));
        try {
            await page.goto(`${target}/#/island`); await page.waitForURL('**/#/onboarding');
            // URL entry precedes the async empty-profile check. Seed only after the actual Welcome commit.
            await page.locator('[data-onboarding-world="island"][data-mode="welcome"]').waitFor();
            const actualVersion = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert.deepEqual(actualVersion, buildSource.version);
            const profileId = await fixtures.seedLearningProfile(page, scenario);
            row.fixtureStores = await support.readSupportStores(page);
            assert.equal(row.fixtureStores.islandEvents.length, 0); assert.equal(row.fixtureStores.islandPlans.length, 0);
            assert.equal(row.fixtureStores.logs.length, 0); assert.equal(row.fixtureStores.islands.length, 0);
            await page.goto(`${target}/#/island`); await helpers.waitReady(page); await identity(page);
            const lowerBound = await page.evaluate(() => Date.now());
            await helpers.activate(page.locator('.island-start'), scenario.touch); await helpers.waitMode(page, 'learning');
            let state = await helpers.readNative(page, profileId); await learning.waitLearningReady(page, state.plan);
            assert.equal(state.island.completedSets, 0); assert.equal(state.plan.slots.length, 3);
            assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill);
            assert.equal((await dom(page)).inputMode, scenario.type);
            row.reservedPlan = structuredClone(state.plan); newPresentation(row, lowerBound, false);
            observeDOM(row, await dom(page), state.plan); await capture(page, row, 'initial');
            if (scenario.type === 'number') {
                state = await operate(page, row, state, { type: 'answer', wrong: true, double: true });
                state = await operate(page, row, state, { type: 'answer' });
                assert.equal(state.plan.cursor, 1);
            } else {
                assert.equal(state.plan.slots[0].problem.hissanVersion, 2);
                assert(fixtures.expectedLearningAnswer(state.plan.slots[0], 'hissan').totalSteps > 1);
                state = await operate(page, row, state, { type: 'answer' });
                assert.equal(state.plan.cursor, 0); assert.equal(state.plan.slots[0].hissanStep, 1);
                assert.equal(state.logs.length, 0);
            }
            const draftStores = await support.readSupportStores(page);
            const draft = await support.enterSupportDraft(page, state, row.touch);
            assert.deepEqual(await support.readSupportStores(page), draftStores, 'Typing a draft adds no events or state writes');
            state = await operate(page, row, state, { type: 'support_opened', label: 'ヒントを みる' });
            if (draft.applicable) assert.deepEqual(await support.readSupportDraft(page), draft.value);
            await capture(page, row, 'hint');
            if (scenario.type === 'number') state = await reenter(page, row, state, false);
            state = await operate(page, row, state, { type: 'answer', wrong: true });
            state = await operate(page, row, state, { type: 'model_opened', label: 'おてほんを みる' });
            await support.assertModelSurface(page, state.plan.slots[state.plan.cursor]);
            await capture(page, row, 'model');
            if (scenario.type === 'hissan') {
                state = await reenter(page, row, state, true);
                await support.assertModelSurface(page, state.plan.slots[state.plan.cursor]);
                await capture(page, row, 'model-reloaded');
            }
            state = await operate(page, row, state, { type: 'supported_completed', label: 'つぎへ すすむ' });
            assert.equal(state.island.completedSets, 0); assert.equal(state.island.pendingRewards.length, 0);
            await capture(page, row, 'supported-next');
            state = await operate(page, row, state, { type: 'answer' });
            await capture(page, row, 'next-answer');
            row.finalStores = await support.readSupportStores(page);
            row.audit = auditIslandObservations(state.islandEvents, state.islandPlans);
            assert.equal(row.audit.denominator, 'saved-island-learning-operations');
            assert.equal(row.audit.savedOperations, row.operations.length); assert.equal(row.audit.scopeKnown, row.operations.length);
            assert.equal(row.audit.presentationObserved, row.operations.length); assert.equal(row.audit.unknown, 0);
            assert.equal(row.audit.partial, 0); assert.equal(row.audit.clockOrderUncertain, 0);
            assert(row.audit.rows.some(item => item.observedSupport === 'unknown'), 'No observed hint/model remains unknown, never no-help');
            if (scenario.type === 'number') {
                assert.equal(row.audit.rows.find(item => item.eventId === row.operations[0].event.id).priorIncorrect, 'unknown');
                assert.equal(row.audit.rows.find(item => item.eventId === row.operations[1].event.id).priorIncorrect, 'recorded');
            }
            assert.deepEqual(errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack; row.pageErrors = errors;
            row.failureStores = await support.readSupportStores(page).catch(() => undefined);
            row.failureDOM = await dom(page).catch(() => undefined);
            await page.screenshot({ path: resolve(output, `${row.name}-failure.png`), fullPage: true }).catch(() => undefined);
        } finally { delete row.current; await context.close(); await writeReport(); }
    }
    report.pass = report.scenarios.length === scenarios.length && report.scenarios.every(row => row.pass);
} catch (error) { report.error = error.stack; report.pass = false; }
finally {
    if (buildSource?.files) {
        try {
            report.sourceEnd = await sourceSnapshot();
            report.sourceStable = report.sourceStart?.closureHash === report.sourceEnd.closureHash
                && report.sourceStart?.manifestSha256 === report.sourceEnd.manifestSha256 && report.sourceEnd.mismatches.length === 0;
            if (!report.sourceStable) report.pass = false;
        } catch (error) { report.sourceError = error.stack; report.pass = false; }
    }
    if (browser) {
        try { await browser.close(); report.browserClosed = true; }
        catch (error) { report.closeError = error.stack; report.pass = false; }
    }
    report.completedAt = new Date().toISOString(); await writeReport();
}
if (!report.pass || !report.sourceStable || !report.browserClosed) process.exitCode = 1;
