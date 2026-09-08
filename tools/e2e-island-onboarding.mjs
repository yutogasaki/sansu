import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { activate, button, ISLAND_CANDIDATE, readNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, waitLearningReady } from './island-learning-checks.mjs';
import { armOnboardingObservation, assertFirstReservation, assertProfileFree, installOnboardingFault, ONBOARDING_CANDIDATE,
    onboardingControls, onboardingStores, untouchedStep, welcomePlay } from './island-onboarding-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL, buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
assert(base && buildSourcePath, 'Use an immutable production URL and its actual build-source manifest');
const out = process.env.SANSU_ISLAND_ONBOARDING_OUTPUT || 'output/playwright/island-onboarding';
const filter = process.env.SANSU_ISLAND_ONBOARDING_SCENARIO;
const cases = [
    { name: 'phone-math', width: 390, height: 844, touch: true, grade: -1, gradeLabel: '年中', subject: 'math', math: '数をかぞえる・くらべる', mathStart: 1, vocabStart: 1, nameInput: '', play: true, double: true, back: true, compatibility: true },
    { name: 'tablet-mix', width: 768, height: 1024, grade: 3, gradeLabel: '小学 3 年生', subject: 'mix', math: '筆算（2けたのたし算・ひき算）', english: 'すこし', mathStart: 14, vocabStart: 4, nameInput: 'あおい', play: true, double: true },
    { name: 'phone-vocab-no-play', width: 390, height: 844, touch: true, reduced: true, grade: 2, gradeLabel: '小学 2 年生', subject: 'vocab', english: 'はじめて', mathStart: 11, vocabStart: 1, nameInput: '' },
    { name: 'tablet-reduced-math', width: 768, height: 1024, reduced: true, soundOff: true, grade: 1, gradeLabel: '小学 1 年生', subject: 'math', math: '足し算まで', mathStart: 7, vocabStart: 1, nameInput: 'みなと', play: true },
    { name: 'phone-save-abort-retry', width: 390, height: 844, touch: true, grade: 2, gradeLabel: '小学 2 年生', subject: 'math', math: '引き算まで', mathStart: 10, vocabStart: 1, nameInput: '', fault: 'abort-once' },
    { name: 'tablet-save-pwa-hold', width: 768, height: 1024, grade: 1, gradeLabel: '小学 1 年生', subject: 'math', math: '足し算まで', mathStart: 7, vocabStart: 1, nameInput: '', fault: 'hold-completion' },
].filter(row => !filter || row.name === filter);
assert(cases.length, 'The filter must name a declared scenario');
const sha = value => createHash('sha256').update(value).digest('hex');
const buildSource = JSON.parse(await fs.readFile(buildSourcePath, 'utf8'));
const qaPaths = ['tools/e2e-island-onboarding.mjs', 'tools/island-onboarding-checks.mjs', 'tools/island-e2e-helpers.mjs',
    'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const sourceSnapshot = async () => {
    const paths = [...new Set([...buildSource.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
};
const compiled = await build({ stdin: { contents: "export { getAvailableSkills, MAX_MATH_LEVEL } from './src/domain/math/curriculum.ts';",
    resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const oracleSource = compiled.outputFiles[0].text;
const { getAvailableSkills, MAX_MATH_LEVEL } = await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
await fs.mkdir(`${out}/videos`, { recursive: true });
assert.equal(await fs.stat(`${out}/report.json`).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false,
    'Use a fresh output directory; preserve every prior onboarding result and failure');
const report = { target: base, startedAt: new Date().toISOString(), flag: 'VITE_ISLAND_ENABLED=true', candidate: ISLAND_CANDIDATE,
    onboardingCandidate: ONBOARDING_CANDIDATE, buildSource, sourceStart: await sourceSnapshot(), oracleHash: sha(oracleSource),
    scenarios: [], captures: [], diagnostic: Boolean(filter), humanN: 0, pass: false, browserClosed: false,
    scope: 'Hook-free native-empty primary flows. Real Welcome furniture controls, explicit setup choices and actual normal first reservation. Separate approved native transaction abort/completion-delay diagnostics test rollback/retry and the real onboarding critical-persistence hold with the existing PWA reload-request hook. No fabricated profiles, memories, progress, receipts, Explore runs, browser app imports or manual external persistence hold. PWA diagnostic is not a real service-worker/offline update test.' };
report.buildSourceMismatches = buildSource.files.filter(file => report.sourceStart.files.find(row => row.path === file.path)?.sha256 !== file.sha256);
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
assert.deepEqual(report.buildSourceMismatches, [], 'The QA source closure must match the actual production build');
const launchOptions = process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {};
report.browserOptions = launchOptions;
const browser = await chromium.launch(launchOptions);

async function record(page, row, name, { fullPage = false } = {}) {
    const file = `${row.name}-${name}.png`;
    const metadata = await page.evaluate(() => {
        const root = document.querySelector('.island-page'), d = root?.dataset, stage = document.querySelector('[data-testid="island-stage"]');
        return { url: location.href, mode: d?.mode, step: d?.onboardingStep, candidate: d?.visualCandidateId,
            onboardingCandidate: d?.onboardingCandidate, version: d?.buildVersion, revision: d?.buildRevision,
            delivery: d?.deliveryId, stage: stage ? { ...stage.dataset } : null };
    });
    if (metadata.revision) assert.equal(metadata.revision, report.manifest.revision);
    if (metadata.version) assert.equal(metadata.version, report.manifest.version);
    if (metadata.candidate) assert.equal(metadata.candidate, report.manifest.island.candidate);
    const stores = await onboardingStores(page), bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage });
    row.snapshots.push({ name, stores });
    report.captures.push({ file, sha256: sha(bytes), fullPage, ...metadata, sourceHash: report.sourceStart.hash,
        actualBuild: { version: report.manifest.version, revision: report.manifest.revision }, storesSHA: sha(JSON.stringify(stores)) });
}

function assertCreated(stores, scenario, count = 1) {
    const profiles = stores.profiles.rows, app = stores.appData.rows[0];
    assert.equal(profiles.length, count); assert.equal(stores.appData.rows.length, 1);
    assert.equal(Object.keys(app.profiles).length, count);
    const profile = profiles.find(profile => profile.id === app.activeProfileId);
    assert(profile); assert.deepEqual(app.profiles[profile.id], profile, 'Canonical active profile and profile row commit together');
    assert.equal(profile.name, scenario.nameInput || 'プレイヤー'); assert.equal(profile.grade, scenario.grade);
    assert.equal(profile.subjectMode, scenario.subject); assert.equal(profile.mathStartLevel, scenario.mathStart);
    assert.equal(profile.mathMainLevel, Math.min(MAX_MATH_LEVEL, scenario.mathStart + 1));
    assert.equal(profile.mathMaxUnlocked, profile.mathMainLevel);
    assert.equal(profile.vocabStartLevel, scenario.vocabStart); assert.equal(profile.vocabMainLevel, scenario.vocabStart);
    assert.equal(profile.vocabMaxUnlocked, scenario.vocabStart);
    for (const field of ['streak', 'todayCount']) assert.equal(profile[field], 0);
    assert.deepEqual(profile.recentAttempts, []);
    for (const level of [...profile.mathLevels, ...profile.vocabLevels]) assert.deepEqual(level.recentAnswersNonReview, []);
    const memories = stores.memoryMath.rows.filter(row => row.profileId === profile.id);
    const expected = scenario.subject === 'vocab' && count === 1 ? [] : getAvailableSkills(scenario.mathStart);
    assert.deepEqual(memories.map(row => row.id).sort(), expected.slice().sort());
    for (const memory of memories) {
        assert.equal(memory.status, 'retired'); assert.equal(memory.strength, 5);
        assert(memory.nextReview > new Date().toISOString());
        for (const field of ['totalAnswers', 'correctAnswers', 'incorrectAnswers', 'skippedAnswers']) assert.equal(memory[field], 0);
    }
    assert.equal(stores.memoryVocab.rows.filter(row => row.profileId === profile.id).length, 0);
    assert.equal(stores.logs.rows.filter(row => row.profileId === profile.id).length, 0,
        'The newly created profile has no learning logs of its own');
    return profile;
}

async function setupToFinal(page, row, baseline) {
    await activate(button(page, 'まなぶ'), row.touch);
    row.controls.grade = await untouchedStep(page, 'grade', baseline);
    assert.equal(await page.locator('.island-setup-name input').inputValue(), '');
    if (row.nameInput) await page.locator('.island-setup-name input').fill(row.nameInput);
    await record(page, row, 'grade');
    await activate(button(page, row.gradeLabel), row.touch);
    row.controls.subject = await untouchedStep(page, 'subject', baseline);
    if (row.back) {
        await activate(button(page, 'もどる'), row.touch); await untouchedStep(page, 'grade', baseline);
        assert.equal(await page.locator('.island-setup-name input').inputValue(), row.nameInput);
        await activate(button(page, row.gradeLabel), row.touch); await untouchedStep(page, 'subject', baseline);
    }
    await record(page, row, 'subject');
    const subject = { math: 'さんすう', vocab: 'えいご', mix: 'さんすう と えいご' }[row.subject];
    await activate(button(page, subject), row.touch);
    if (row.subject !== 'vocab') {
        row.controls.math = await untouchedStep(page, 'math', baseline); await record(page, row, 'math-range');
        if (row.subject === 'math') return row.math;
        await activate(button(page, row.math), row.touch);
    }
    row.controls.english = await untouchedStep(page, 'english', baseline); await record(page, row, 'english-range');
    return row.english;
}

async function completion(page, row, label, baseline) {
    const activeCacheBefore = row.fault === 'abort-once' ? await page.evaluate(() => localStorage.getItem('sansu_active_profile')) : undefined;
    let heldStores;
    if (row.fault) await page.evaluate(() => window.__armOnboardingFault());
    if (row.double) await button(page, label).dblclick({ delay: 0 }); else await activate(button(page, label), row.touch);
    if (row.fault === 'abort-once') {
        await page.getByRole('status').filter({ hasText: 'ほぞんできなかったよ。もういちど えらんでね。' }).waitFor();
        assert.deepEqual(await onboardingStores(page), baseline, 'Failure after the real profile add rolls back every initial memory, profile and active-id write');
        row.faultEvidence = await page.evaluate(() => window.__onboardingFault);
        const activeCacheAfterAbort = await page.evaluate(() => localStorage.getItem('sansu_active_profile'));
        assert.equal(activeCacheAfterAbort, activeCacheBefore, 'Failed creation preserves the active-profile cache before retry can repair it');
        Object.assign(row.faultEvidence, { activeCacheBefore, activeCacheAfterAbort });
        assert.equal(row.faultEvidence.hits, 1); assert(row.faultEvidence.abortedAt);
        await record(page, row, 'save-failed-rolled-back');
        assert(await button(page, label).isEnabled()); await activate(button(page, label), row.touch);
    } else if (row.fault === 'hold-completion') {
        await page.waitForFunction(() => Boolean(window.__releaseOnboardingCompletion));
        const committed = heldStores = await onboardingStores(page);
        row.heldProfile = assertCreated(committed, row).id;
        assert.equal(committed.islandPlans.rows.length, 0); assert.equal(committed.islandEvents.rows.length, 0);
        for (const [name, store] of Object.entries(committed)) if (!['profiles', 'appData', 'memoryMath'].includes(name)) {
            assert.deepEqual(store, baseline[name], `Native profile commit leaves unrelated ${name} unchanged`);
        }
        assert.equal(await page.locator('.island-setup-sheet').getAttribute('aria-busy'), 'true');
        assert.equal(await page.locator('.island-setup-options button:not(:disabled)').count(), 0);
        await record(page, row, 'native-commit-promise-held');
        const marker = 'island-onboarding-actual-save-hold';
        const premature = page.waitForRequest(request => request.isNavigationRequest() && new URL(request.url()).searchParams.get('__app-update') === marker,
            { timeout: 750 }).then(() => true, error => { if (error.name !== 'TimeoutError') throw error; return false; });
        await page.evaluate(marker => {
            window.dispatchEvent(new CustomEvent('sansu:pwa-e2e-reload', { detail: { version: marker } }));
            window.location.hash = '#/settings';
        }, marker);
        await page.waitForURL('**/#/settings');
        assert.equal(await premature, false, 'Actual onboarding save hold defers reload even after entering a neutral route');
        assert.deepEqual(await onboardingStores(page), committed);
        row.faultEvidence = await page.evaluate(() => window.__onboardingFault);
        const heldDocument = await page.evaluate(() => window.__onboardingDocument);
        assert(heldDocument?.id && Number.isFinite(heldDocument.timeOrigin));
        const deferred = page.waitForRequest(request => request.isNavigationRequest() && request.frame() === page.mainFrame()
            && new URL(request.url()).searchParams.get('__app-update') === marker);
        const newDocument = page.waitForFunction(({ id, timeOrigin, marker }) => {
            const observed = window.__onboardingDocument;
            return observed?.id && Number.isFinite(observed.timeOrigin) && observed.id !== id && observed.timeOrigin !== timeOrigin
                && new URL(observed.initialURL).searchParams.get('__app-update') === marker
                && document.readyState !== 'loading' ? { ...observed, currentURL: location.href, readyState: document.readyState } : false;
        }, { ...heldDocument, marker });
        await page.evaluate(() => window.__releaseOnboardingCompletion());
        const [request, documentHandle] = await Promise.all([deferred, newDocument]);
        const reloadedDocument = await documentHandle.jsonValue(); await documentHandle.dispose();
        assert.notEqual(reloadedDocument.id, heldDocument.id); assert.notEqual(reloadedDocument.timeOrigin, heldDocument.timeOrigin);
        assert.equal(new URL(reloadedDocument.initialURL).searchParams.get('__app-update'), marker);
        // This wait now belongs to the observed new document, so the following
        // root navigation cannot substitute for the deferred reload's commit.
        await page.waitForLoadState('domcontentloaded');
        assert.deepEqual(await onboardingStores(page), committed, 'The actual update document preserves every committed key and row before root launch');
        Object.assign(row.faultEvidence, { releasedThenReloaded: true, reloadURL: request.url(), heldDocument, reloadedDocument,
            committedStoresSHA: sha(JSON.stringify(committed)), reloadedStoresUnchanged: true });
        await page.goto(`${base}/#/`);
    }
    await page.waitForURL('**/#/island'); await waitReady(page);
    // The held-completion diagnostic intentionally left onboarding before its
    // promise resolved. It must stay cancelled and return through ordinary home.
    await waitMode(page, row.fault === 'hold-completion' ? 'home' : 'learning');
    const created = await onboardingStores(page), profile = assertCreated(created, row);
    if (row.fault === 'abort-once') assert.equal(profile.id, row.faultEvidence.profileId, 'Retry reuses the same stable completion identity');
    if (row.fault === 'hold-completion') {
        assert.equal(profile.id, row.heldProfile);
        assert.deepEqual(Object.keys(created).sort(), Object.keys(heldStores).sort());
        for (const [name, store] of Object.entries(heldStores)) {
            if (name !== 'islands') assert.deepEqual(created[name], store, `Completion and root launch preserve all committed ${name} keys and rows`);
        }
        // Only one new island for this just-created profile is permitted. Any
        // earlier island key/row must survive byte-for-byte, without deletion.
        const initialIsland = heldStores.islands.keys.includes(profile.id) ? -1 : created.islands.keys.indexOf(profile.id);
        const retainedIslands = { keys: created.islands.keys.filter((_, index) => index !== initialIsland),
            rows: created.islands.rows.filter((_, index) => index !== initialIsland) };
        assert.deepEqual(retainedIslands, heldStores.islands, 'Root launch may add its initial island but cannot alter existing island records');
        row.faultEvidence.rootLaunchPreservedCommittedStores = true;
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('sansu_active_profile')), profile.id);
    assert.equal(created.islands.rows.length, 1); assert.equal(created.islands.rows[0].profileId, profile.id);
    assert.equal(created.islands.rows[0].completedSets, 0); assert.deepEqual(created.islands.rows[0].pendingRewards, []);
    if (row.fault === 'hold-completion') {
        assert.equal(created.islandPlans.rows.length, 0); assert.equal(created.islandEvents.rows.length, 0);
        await record(page, row, 'cancelled-setup-root-home');
    } else {
        const plan = assertFirstReservation(created, profile.id);
        await waitLearningReady(page, plan);
        await record(page, row, 'created-first-learning');
    }
    row.profileId = profile.id;
    return created;
}

async function waitLegacyExploreReady(page, expected = {}) {
    const handle = await page.waitForFunction(expected => {
        const world = document.querySelector('.explore-world'), attempt = document.querySelector('[data-testid="explore-attempt"]');
        const stage = document.querySelector('.explore-immersive'), digit = document.querySelector('button[aria-label="1"]');
        const runId = world?.dataset.runId, problemId = attempt?.dataset.problemId;
        return location.hash === '#/explore' && world?.dataset.runPersistence === 'ready' && world.dataset.runStatus === 'active'
            && runId && problemId && attempt.dataset.runId === runId && attempt.dataset.saveState === 'idle'
            && (!expected.runId || runId === expected.runId) && (!expected.problemId || problemId === expected.problemId)
            && stage?.dataset.state === 'idle' && stage.querySelector('.explore-immersive-keypad-shell')?.getAttribute('aria-disabled') === 'false'
            && digit instanceof HTMLButtonElement && !digit.disabled && stage.querySelector('output')?.getAttribute('aria-label') === 'こたえ 未入力'
            ? { runId, problemId, revision: Number(world.dataset.checkpointRevision), url: location.href } : false;
    }, expected);
    const identity = await handle.jsonValue(); await handle.dispose(); return identity;
}

async function compatibility(page, row, created) {
    await page.goto(`${base}/#/onboarding`); await page.waitForURL('**/#/island'); await waitReady(page);
    assert.deepEqual(await onboardingStores(page), created, 'Existing profile plain onboarding redirects without creating or resetting anything');
    row.existingPlainRedirect = true;
    await page.goto(`${base}/#/settings`);
    await page.getByRole('button', { name: /^プロフィール/ }).click();
    await page.getByRole('button', { name: /^(追加|ついか)$/ }).click();
    await page.waitForURL('**/#/onboarding?mode=add'); await waitReady(page);
    await button(page, 'はじめる').click();
    await page.getByPlaceholder('あだ名でOK').waitFor();
    assert.equal(await button(page, '次へ').isEnabled(), false, 'Settings add retains the required-name legacy first step');
    assert.deepEqual(await onboardingStores(page), created);
    await record(page, row, 'settings-add-name', { fullPage: true });
    await page.getByPlaceholder('あだ名でOK').fill('ふたりめ'); await button(page, '次へ').click();
    await button(page, '年中さん').click(); await page.getByRole('button', { name: /さんすう だけ/ }).click();
    await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
    await page.waitForURL('**/#/island'); await waitReady(page);
    const added = await onboardingStores(page), second = assertCreated(added, { ...row, nameInput: 'ふたりめ' }, 2);
    assert.notEqual(second.id, row.profileId);
    assert.deepEqual(added.profiles.rows.find(profile => profile.id === row.profileId), created.profiles.rows[0]);
    assert.deepEqual(added.memoryMath.rows.filter(memory => memory.profileId === row.profileId), created.memoryMath.rows);
    for (const table of ['logs', 'islandPlans', 'islandEvents']) assert.deepEqual(added[table], created[table], `Add preserves existing ${table}`);
    row.settingsAdd = { secondProfileId: second.id, oldProfileUnchanged: true };
    await record(page, row, 'settings-add-complete');
    // A real old Explore reservation is created by its own UI route, never by a
    // minimal synthetic run. This deliberately separate compatibility journey
    // checks Island remains home and the old run resumes by explicit choice.
    await page.goto(`${base}/#/explore`);
    const beforeIdentity = await waitLegacyExploreReady(page), beforeLaunch = await onboardingStores(page);
    row.legacyExploreProbe = { beforeIdentity, beforeLaunch };
    const activeRun = beforeLaunch.exploreRuns.rows.find(run => run.runId === beforeIdentity.runId && run.profileId === second.id && run.status === 'active');
    assert(activeRun, 'The real enabled Explore input belongs to a committed active run for the added profile');
    assert.equal(activeRun.activeCheckpoint.state.runId, beforeIdentity.runId);
    assert.equal(activeRun.activeCheckpoint.state.profileId, second.id);
    assert.equal(activeRun.activeCheckpoint.state.pendingProblem.problem.id, beforeIdentity.problemId);
    assert.equal(activeRun.activeCheckpoint.revision, beforeIdentity.revision);
    await page.goto(`${base}/#/`); await page.waitForURL('**/#/island'); await waitReady(page);
    await button(page, 'ほかの あそび').click();
    await page.getByRole('button', { name: /ポッコの たんけん/ }).click();
    await page.waitForURL('**/#/explore');
    const restoredIdentity = await waitLegacyExploreReady(page, beforeIdentity);
    const restored = await onboardingStores(page);
    Object.assign(row.legacyExploreProbe, { restoredIdentity, restored });
    assert.deepEqual(restored.islands, beforeLaunch.islands); assert.deepEqual(restored.islandPlans, beforeLaunch.islandPlans);
    assert.deepEqual(restored.exploreRuns.rows.find(run => run.runId === activeRun.runId), activeRun);
    row.legacyExplore = { runId: activeRun.runId, provenance: 'Actual Explore UI generated active checkpoint after real Settings add', islandHomeWithExplicitResume: true };
    await record(page, row, 'legacy-explore-explicit-resume');
}

try {
    for (const scenario of cases) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: Boolean(scenario.touch),
            reducedMotion: scenario.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block',
            recordVideo: { dir: `${out}/videos`, size: { width: scenario.width, height: scenario.height } } });
        const page = await context.newPage(), row = { ...scenario, controls: {}, snapshots: [], playResults: [], pass: false }, errors = [];
        report.scenarios.push(row); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.stack));
        await armOnboardingObservation(page);
        if (scenario.fault) await installOnboardingFault(page, scenario.fault);
        if (scenario.fault === 'hold-completion') await page.addInitScript(() => {
            window.__SANSU_PWA_E2E__ = true;
            // Capture the navigation URL before the production PWA bootstrap
            // removes its marker. A fresh identity distinguishes real documents.
            window.__onboardingDocument = { id: crypto.randomUUID(), timeOrigin: performance.timeOrigin, initialURL: location.href };
        });
        try {
            await page.goto(`${base}/#/`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled); assert.equal(manifest.island.candidate, ISLAND_CANDIDATE); assert.equal(manifest.revision, buildSource.revision);
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            assert.equal(await page.locator('.island-welcome').getAttribute('data-onboarding-candidate'), ONBOARDING_CANDIDATE);
            const baseline = await onboardingStores(page); assertProfileFree(baseline);
            row.controls.welcome = await onboardingControls(page, '.island-welcome-play button, .island-start');
            await record(page, row, 'cold-welcome');
            if (row.play) for (const [id, label] of [['starter-flower', 'おはな'], ['starter-lantern', 'あかり']]) {
                row.playResults.push(await welcomePlay(page, id, label, row.touch, row.reduced, !row.touch));
                await record(page, row, id);
            }
            const finalLabel = await setupToFinal(page, row, baseline);
            await completion(page, row, finalLabel, baseline);
            row.setupObservation = await page.evaluate(() => window.__onboardingObservation);
            if (!row.fault) {
                const finalClicks = row.setupObservation.clicks.filter(click => click.label === finalLabel);
                assert(finalClicks.length >= 1 && finalClicks.every(click => click.trusted));
                row.finalSelectionClicks = finalClicks;
                assert(row.setupObservation.routes.some(route => {
                    const [path, query] = route.hash.split('?'), params = new URLSearchParams(query);
                    return path === '#/island' && params.get('start') === 'learn' && params.get('profile') === row.profileId
                        && route.at >= finalClicks[0].at;
                }),
                    'The actual final selection requests the first learning reservation directly');
                assert(row.setupObservation.routes.some(route => route.hash === '#/island' && route.at >= finalClicks[0].at),
                    'The successful real reservation consumes the start request');
                assert(row.setupObservation.clicks.filter(click => click.at >= finalClicks[0].at).every(click => click.label === finalLabel),
                    'No home start gesture is needed between the final selection and first operable problem');
            }
            if (row.soundOff) {
                await page.goto(`${base}/#/settings`);
                await page.getByRole('button', { name: /^表示とサウンド/ }).click();
                const sound = page.getByText('サウンド', { exact: true }).locator('../..');
                await sound.getByRole('button', { name: 'ON', exact: true }).click();
                await sound.getByRole('button', { name: 'OFF', exact: true }).waitFor();
                await page.goto(`${base}/#/`); await waitReady(page); await waitMode(page, 'learning');
                assert.equal((await onboardingStores(page)).profiles.rows.find(profile => profile.id === row.profileId).soundEnabled, false);
                row.soundOffEvidence = 'Actual Settings sound toggle persisted after automatic reservation and before the first answer';
            }
            if (row.fault === 'hold-completion') {
                await activate(page.locator('.island-start'), row.touch); await waitMode(page, 'learning');
            }
            let state = await readNative(page, row.profileId); await waitLearningReady(page, state.plan);
            assertFirstReservation(await onboardingStores(page), row.profileId);
            assert.equal(state.plan.slots.length, 3); assert.equal(state.plan.cursor, 0); assert.equal(state.logs.length, 0);
            for (const slot of state.plan.slots) if (row.subject !== 'mix') assert.equal(slot.problem.subject, row.subject);
            row.firstReservation = state.plan;
            await record(page, row, 'first-real-plan');
            const firstGrowthBefore = state;
            const firstFlowStart = await page.evaluate(() => {
                const at = performance.now();
                window.__onboardingObservation.modes.push({ at, mode: document.querySelector('.island-page').dataset.mode });
                return at;
            });
            if (row.subject === 'vocab') {
                const answered = await attempt(page, state, { touch: row.touch }); state = answered.after;
                assert.equal(answered.receipt.result, 'correct'); assert.equal(state.plan.cursor, 1);
                row.firstActualAnswer = { receipt: answered.receipt, sample: answered.sample };
                await record(page, row, 'first-answer-next-input');
            }
            const growthAnswers = [];
            for (let count = 0; count < 48 && state.plan?.id === row.firstReservation.id; count += 1) {
                const answered = await attempt(page, state, { touch: row.touch }); state = answered.after;
                growthAnswers.push({ receipt: answered.receipt, sample: answered.sample });
            }
            await waitMode(page, 'learning'); await waitLearningReady(page, state.plan);
            assert.notEqual(state.plan.id, row.firstReservation.id);
            assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
            assert.equal(state.island.completedSets, 1); assert.equal(state.island.growth.progress.garden, 1);
            assert.deepEqual(state.island.pendingRewards, [], 'First growth needs neither claim nor placement');
            assert(state.island.items.some(item => item.kind === 'bench' && item.position));
            assert.equal(state.islandEvents.filter(event => event.type === 'plan_completed' && event.planId === row.firstReservation.id).length, 1);
            assert.deepEqual(state.island.growth.memories[0], firstGrowthBefore.island.growth.memories[0], 'First growth preserves the initial snapshot');
            const firstFlow = await page.evaluate(start => ({
                modes: window.__onboardingObservation.modes.filter(entry => entry.at >= start),
                clicks: window.__onboardingObservation.clicks.filter(entry => entry.at >= start),
            }), firstFlowStart);
            assert(firstFlow.modes.every(entry => entry.mode === 'learning'), 'The first automatic upgrade never presents reward, placement or home');
            assert(firstFlow.clicks.every(entry => entry.answer), 'Only answer controls advance the introductory section');
            row.firstAutomaticGrowth = { before: firstGrowthBefore, after: state, answers: growthAnswers, flow: firstFlow,
                extraContinuationActions: 0, automaticRewardScreens: 0 };
            await record(page, row, 'first-growth-next-reservation');
            if (row.compatibility) await compatibility(page, row, await onboardingStores(page));
            assert.deepEqual(errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack; row.pageErrors = errors;
            row.failureStores = await onboardingStores(page).catch(() => undefined);
            row.failureProbe = await page.evaluate(() => ({ observation: window.__onboardingObservation, fault: window.__onboardingFault })).catch(() => undefined);
            await page.screenshot({ path: `${out}/${row.name}-failure.png`, fullPage: true }).catch(() => undefined);
            // Each case owns a fresh browser context. Retain this failure and
            // finish the other independent journeys before reporting failure.
        } finally {
            row.finalObservation = await page.evaluate(() => window.__onboardingObservation).catch(() => undefined);
            await context.close(); const file = await page.video().path(); row.video = { file, sha256: sha(await fs.readFile(file)) };
        }
    }
    report.pass = report.scenarios.length === cases.length && report.scenarios.every(row => row.pass);
} finally {
    report.sourceEnd = await sourceSnapshot(); report.sourceStable = report.sourceStart.hash === report.sourceEnd.hash;
    if (!report.sourceStable) report.pass = false;
    await browser.close(); report.browserClosed = true; report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
assert(report.pass && report.sourceStable);
