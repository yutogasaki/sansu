import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { activate, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, assertProblemMeaning, attempt, LEARNING_CANDIDATE, waitLearningReady } from './island-learning-checks.mjs';
import { fixtureModuleHash, seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5299';
const out = process.env.SANSU_ISLAND_RECOVERY_OUTPUT || 'output/playwright/island-loop-production/recovery';
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE || 'output/playwright/island-loop-production/build-source.json';
const filter = process.env.SANSU_ISLAND_RECOVERY_SCENARIO;
const layouts = [{ name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false }];
const scenarios = layouts.flatMap(layout => ['math', 'vocab'].map(subject => ({ ...layout, subject, name: `${layout.name}-${subject}` })))
    .filter(scenario => !filter || scenario.name === filter);
assert(scenarios.length, 'Recovery scenario filter must match phone/tablet-math/vocab');
const sha = value => createHash('sha256').update(value).digest('hex');

// Pure expected-value functions run only in Node. Native writes below create
// an isolated profile and memories before any island or plan exists.
const bundled = await build({ stdin: { contents: `
    export { createInitialProfile } from './src/domain/user/profile.ts';
    export { ENGLISH_WORDS } from './src/domain/english/words.ts';
    export { getMathSkillMetadata } from './src/domain/math/curriculum.ts';
    export { mathCheckQuestionKey } from './src/domain/island/learningChecks.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const oracleSource = bundled.outputFiles[0].text;
const domain = await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
const snapshot = async () => {
    const files = await Promise.all(buildSource.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
await fs.mkdir(out, { recursive: true });
const report = { target: base, startedAt: new Date().toISOString(), flag: 'VITE_ISLAND_ENABLED=true',
    buildSourcePath, buildSource: { revision: buildSource.revision, hash: buildSource.sourceHash, flags: buildSource.flags },
    sourceStart: await snapshot(), fixtureModuleHash, oracleModuleHash: sha(oracleSource), scriptHash: sha(await fs.readFile(import.meta.filename)),
    scenarios: [], captures: [], pass: false, eligible: false, browserClosed: true,
    evidenceScope: 'Implementation verification of persisted rechecks, frozen reservations, independent final-answer boundaries, Due fairness and actual UI receipts. Native isolated profile/memory setup only; no plan replacement, fabricated reward or browser domain imports. This does not measure academic learning gains or replace formal fixed-ten throughput evidence.' };
const manifestFiles = new Map(buildSource.files.map(file => [file.path, file.sha256]));
report.buildSourceMatch = { commonFiles: report.sourceStart.files.length,
    mismatches: report.sourceStart.files.filter(file => file.sha256 !== manifestFiles.get(file.path)) };
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
assert(report.sourceStart.files.some(file => file.path === 'src/domain/island/learningChecks.ts'));
assert.deepEqual(report.buildSourceMatch.mismatches, [], 'Every immutable build source file must match before recovery QA');

async function seedVocab(page) {
    const profile = domain.createInitialProfile('つむぎ', 2, 0, 2, 'vocab');
    profile.soundEnabled = false;
    const vocab = domain.ENGLISH_WORDS.filter(word => word.level <= 2).map(word => ({ id: word.id, profileId: profile.id,
        strength: 2, nextReview: word.id === 'apple' ? '2000-01-01' : word.id === 'orange' ? '2001-01-01' : '2099-01-01',
        updatedAt: '2000-01-01', totalAnswers: 20, correctAnswers: 18, incorrectAnswers: 2, skippedAnswers: 0, isWeak: false }));
    await page.evaluate(async ({ profile, vocab }) => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = database.transaction(['profiles', 'appData', 'memoryVocab'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        for (const row of vocab) transaction.objectStore('memoryVocab').put(row);
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        database.close();
    }, { profile, vocab });
    return profile.id;
}

const pending = (state, skill) => state.island.pendingMathChecks?.find(check => check.skillId === skill);
const current = state => state.plan.slots[state.plan.cursor];
async function capture(page, row, label, state) {
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.manifest.revision);
    assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE);
    assert.equal(metadata.delivery, report.manifest.island.delivery);
    assert.equal(metadata.learningCandidate, LEARNING_CANDIDATE);
    assert.equal(metadata.artDirection, report.manifest.island.artDirection);
    const file = `${row.name}-${label}.png`, image = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(image), ...metadata, planId: state.plan?.id, cursor: state.plan?.cursor,
        completedSets: state.island.completedSets, checks: state.island.pendingMathChecks, vocabDueCursor: state.island.vocabDueCursor });
    console.log(`CAPTURE ${out}/${file}`);
}
function recordPlan(row, state) {
    assert([3, 6].includes(state.plan.slots.length));
    if (!row.reservations.some(plan => plan.id === state.plan.id)) row.reservations.push(structuredClone(state.plan));
}
async function support(page, row, before) {
    await activate(button(page, 'ヒントを みる'), row.touch);
    await waitLearningReady(page, { ...before.plan, revision: before.plan.revision + 1 });
    const after = await readNative(page, row.profileId);
    assert.equal(after.plan.cursor, before.plan.cursor);
    assert(current(after).assisted);
    assert.equal(current(after).supportStage, 'hint');
    assert.equal(await page.locator('.island-support-model, .island-support-example, .island-support-answer').count(), 0,
        'Recovery retains its genuine assisted-answer path after a short hint');
    assert.deepEqual(after.plan.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.deepEqual(after.logs, before.logs, 'Support never manufactures a learning answer');
    const events = after.islandEvents.filter(event => !before.islandEvents.some(prior => prior.id === event.id));
    assert.equal(events.length, 1); assert.equal(events[0].type, 'support_opened');
    row.actions.push({ receipt: events[0], problem: current(before).problem, checks: after.island.pendingMathChecks });
    return after;
}
async function answer(page, row, before, wrong = false) {
    const result = await attempt(page, before, { wrong, touch: row.touch });
    const newLogs = result.after.logs.filter(log => !before.logs.some(prior => prior.id === log.id));
    const writesLog = !current(before).assisted && (wrong || result.sample.completed);
    assert.equal(newLogs.length, Number(writesLog));
    if (writesLog) {
        assert.equal(result.receipt.learningLogId, newLogs[0].id);
        assert.equal(newLogs[0].result, wrong ? 'incorrect' : 'correct');
    }
    row.actions.push({ receipt: result.receipt, sample: result.sample, problem: current(before).problem,
        checks: result.after.island.pendingMathChecks });
    return result.after;
}
async function reload(page, row, before, label) {
    await page.reload(); await waitReady(page);
    const after = await readNative(page, row.profileId);
    await waitLearningReady(page, after.plan);
    assert.deepEqual(after, before, 'Reload preserves the same reservation, assistance, checks, cursor, receipts and Due state');
    row.reloads.push({ label, planId: after.plan.id, revision: after.plan.revision,
        mathReviewTurn: after.island.mathReviewTurn, vocabDueCursor: after.island.vocabDueCursor });
    await capture(page, row, label, after);
    return after;
}
async function nextSection(page, row, before) {
    if (before.plan) {
        assert(before.island.completedSets >= 2, 'Only ordinary completed sections continue automatically');
        await waitMode(page, 'learning');
        await waitLearningReady(page, before.plan);
    } else {
        assert.equal(before.island.completedSets, 1, 'Only the introductory gift waits for an explicit continue');
        await waitMode(page, 'reward');
        await activate(button(page, 'つづけて とく'), row.touch); await waitMode(page, 'learning');
    }
    const after = await readNative(page, row.profileId);
    await waitLearningReady(page, after.plan); recordPlan(row, after);
    assert.equal(after.plan.id, JSON.stringify(['island-plan-v1', row.profileId, before.island.completedSets]));
    assert.equal(after.plan.cursor, 0); assert.equal(after.plan.revision, 0);
    if (before.plan) assert.deepEqual(after, before, 'Observing the automatically opened next section adds no action or persistence');
    assert.deepEqual(after.island.pendingRewards, before.island.pendingRewards, 'Continuing defers the actual earned rewards');
    assert.deepEqual(after.island.items, before.island.items);
    return after;
}

async function mathRecovery(page, row, initial) {
    const skill = 'add_2d1d_nc', bridgeSkills = domain.getMathSkillMetadata(skill).reviewFallbackSkillIds;
    assert(bridgeSkills.length); assert.equal(current(initial).problem.categoryId, skill);
    const failed = current(initial).problem;
    let state = await answer(page, row, initial, true);
    assert.equal(pending(state, skill)?.failedProblemId, failed.id);
    assert.equal(pending(state, skill)?.stage, 'bridge');
    await capture(page, row, 'wrong-retained', state);
    state = await answer(page, row, state);
    assert(pending(state, skill), 'Correcting the failed question does not erase its independent check');
    state = await reload(page, row, state, 'same-question-corrected-reloaded');
    let sawBridge = false;
    // Complete this already frozen section. If it naturally contains the original
    // skill again, request real support so the next-section recheck stays observable.
    while (state.plan?.id === initial.plan.id) {
        const slot = current(state);
        if (slot.problem.categoryId === skill && !slot.assisted) state = await support(page, row, state);
        if (bridgeSkills.includes(slot.problem.categoryId)) sawBridge = true;
        state = await answer(page, row, state);
        assert(pending(state, skill));
    }
    await capture(page, row, 'first-section-completed', state);
    let independent;
    for (let section = 0; section < 12 && !independent; section++) {
        state = await nextSection(page, row, state);
        const reservationId = state.plan.id;
        while (state.plan?.id === reservationId && !independent) {
            const slot = current(state), check = pending(state, skill);
            assert(check, 'The recheck persists until a genuinely different original problem is completed independently');
            if (bridgeSkills.includes(slot.problem.categoryId)) {
                sawBridge = true;
                await capture(page, row, `bridge-section-${section + 2}-slot-${state.plan.cursor + 1}`, state);
            }
            const canClear = slot.problem.categoryId === skill && !slot.assisted && check.failedProblemId !== slot.problem.id
                && check.failedQuestionKey !== domain.mathCheckQuestionKey(slot.problem);
            const before = state;
            state = await answer(page, row, state);
            if (canClear && !pending(state, skill)) {
                independent = { failed, checkedProblem: slot.problem, receipt: row.actions.at(-1).receipt,
                    checkBefore: check, section: section + 2 };
                assert.notEqual(independent.checkedProblem.id, independent.checkBefore.failedProblemId);
                assert.notEqual(domain.mathCheckQuestionKey(independent.checkedProblem), independent.checkBefore.failedQuestionKey);
            } else {
                assert(pending(state, skill));
                if (slot.problem.categoryId === skill) row.sameContentChecks.push({ problem: slot.problem,
                    persisted: pending(state, skill), didComplete: state.islandPlans.find(plan => plan.id === before.plan.id).cursor > before.plan.cursor });
            }
        }
    }
    assert(sawBridge, 'Actual reserved bridge content is served before this recovery is considered complete');
    assert(independent, 'A bounded sequence of actual sections must reach and clear an independent different-question check');
    row.independent = independent; row.bridgeObserved = sawBridge;
    await capture(page, row, 'independent-check-cleared', state);
    return state;
}

async function vocabRecovery(page, row, initial) {
    let state = initial;
    const dueIds = ['apple', 'orange'], baseline = initial.memoryVocab.filter(memory => dueIds.includes(memory.id));
    row.extraDueWordSupports = [];
    for (let section = 0; section < 3; section++) {
        const reservationId = state.plan.id;
        const expected = section % 2 === 0 ? 'apple' : 'orange';
        assert.equal(current(state).problem.categoryId, expected); assert.equal(current(state).source, 'due');
        row.dueSequence.push(expected);
        state = await support(page, row, state);
        await capture(page, row, `due-${section + 1}-${expected}-supported`, state);
        if (section === 1) state = await reload(page, row, state, 'second-due-supported-reloaded');
        while (state.plan?.id === reservationId) {
            // A protected Due word can also occur in a later main slot. Keep
            // this guided-only scenario true through real UI support, rather
            // than mistaking a legitimate independent answer for a writer bug.
            const protectedWord = dueIds.includes(current(state).problem.categoryId);
            if (protectedWord && !current(state).assisted) {
                const slot = current(state), planId = state.plan.id, slotIndex = state.plan.cursor;
                state = await support(page, row, state);
                assert(current(state).assisted, 'Every protected word is supported before answering');
                row.extraDueWordSupports.push({ planId, slotIndex, word: slot.problem.categoryId,
                    source: slot.source, supportReceiptId: row.actions.at(-1).receipt.id });
            }
            if (protectedWord) assert(current(state).assisted);
            state = await answer(page, row, state);
            if (protectedWord) {
                const receipt = row.actions.at(-1).receipt;
                assert.equal(receipt.result, 'assisted-correct');
                assert.equal(receipt.learningLogId, undefined, 'Guided protected words never write an independent log');
            }
        }
        for (const old of baseline) {
            const memory = state.memoryVocab.find(memory => memory.id === old.id);
            assert.equal(memory.correctAnswers, old.correctAnswers, 'Guided answers never become independent mastery');
            assert.equal(memory.nextReview, old.nextReview, 'Both old supported words remain Due');
        }
        assert.equal(state.logs.filter(log => dueIds.includes(log.itemId)).length, 0);
        assert.equal(state.island.mathReviewTurn, undefined, 'English does not advance the math review turn');
        assert.equal(state.islandPlans.find(plan => plan.id === reservationId).status, 'completed');
        // Reservation, rather than completion, rotates the Due cursor. Ordinary
        // completion now already includes the next real reservation transaction.
        const reservedDue = state.plan ? dueIds[(section + 1) % 2] : expected;
        assert.equal(state.island.vocabDueCursor, reservedDue);
        if (state.plan) {
            assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', row.profileId, section + 1]));
            assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
            assert.equal(current(state).problem.categoryId, reservedDue); assert.equal(current(state).source, 'due');
        }
        if (section < 2) state = await nextSection(page, row, state);
    }
    assert.deepEqual(row.dueSequence, ['apple', 'orange', 'apple']);
    assert.equal(state.island.completedSets, 3); assert.equal(state.island.pendingRewards.length, 3);
    row.dueBefore = baseline; row.dueAfter = state.memoryVocab.filter(memory => dueIds.includes(memory.id));
    await capture(page, row, 'three-supported-sections-completed', state);
    return state;
}

const browser = await chromium.launch();
report.browserClosed = false;
try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: scenario.viewport, hasTouch: scenario.touch, serviceWorkers: 'block',
            ...(process.env.SANSU_ISLAND_RECOVERY_VIDEO === '1' ? { recordVideo: { dir: `${out}/video`, size: scenario.viewport } } : {}) });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const row = { ...scenario, reservations: [], actions: [], reloads: [], sameContentChecks: [], dueSequence: [], errors: [], pass: false };
        report.scenarios.push(row); page.on('pageerror', error => row.errors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development'));
            assert.equal(manifest.revision, buildSource.revision); assert.equal(manifest.island.learningCandidate, LEARNING_CANDIDATE);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            row.profileId = scenario.subject === 'math' ? await seedLearningProfile(page, { skill: 'add_2d1d_nc', type: 'number' }) : await seedVocab(page);
            const empty = await readNative(page, row.profileId);
            assert.equal(empty.islands.length, 0); assert.equal(empty.islandPlans.length, 0); assert.equal(empty.logs.length, 0);
            await page.goto(`${base}/#/island`); await waitReady(page);
            await activate(page.locator('.island-start'), row.touch); await waitMode(page, 'learning');
            let state = await readNative(page, row.profileId); await waitLearningReady(page, state.plan); recordPlan(row, state);
            assert.equal(state.island.completedSets, 0); assert.equal(state.plan.slots.length, 3);
            row.initialControls = await assertControls(page); row.initialMeaning = await assertProblemMeaning(page, current(state));
            row.initialPersistence = state; await capture(page, row, 'initial-reservation', state);
            state = scenario.subject === 'math' ? await mathRecovery(page, row, state) : await vocabRecovery(page, row, state);
            row.finalPersistence = state;
            assert.equal(new Set(state.islandEvents.map(event => event.id)).size, state.islandEvents.length);
            assert.deepEqual(row.errors, []); row.pass = true;
            console.log(`PASS ${row.name}: ${row.actions.length} actual actions, ${row.reservations.length} frozen sections`);
        } catch (error) {
            row.failure = error.stack;
            row.failurePersistence = row.profileId ? await readNative(page, row.profileId).catch(() => null) : null;
            await page.screenshot({ path: `${out}/${row.name}-failure.png`, animations: 'disabled', fullPage: true }).catch(() => undefined);
            throw error;
        } finally { await context.close(); }
    }
    report.pass = report.scenarios.every(row => row.pass);
} finally {
    await browser.close(); report.browserClosed = true;
    report.sourceEnd = await snapshot(); report.sourceStable = report.sourceStart.hash === report.sourceEnd.hash;
    report.eligible = report.sourceStable && report.buildSourceMatch.mismatches.length === 0 && scenarios.length === 4;
    report.pass &&= report.sourceStable;
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
assert(report.pass, 'Recovery runtime and stable-source gates must pass');
