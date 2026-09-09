import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { activate, assertIslandSectionGrowth, button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertControls, attempt, waitLearningReady } from './island-learning-checks.mjs';
import { armOnboardingObservation, assertProfileFree, onboardingStores, untouchedStep, welcomePlay } from './island-onboarding-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL;
const buildSourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_ISLAND_RHYTHM_OUTPUT;
assert(base && buildSourcePath && out, 'Set explicit production URL, build-source manifest and fresh rhythm output directory');
const cases = [
    { name: 'phone-math', viewport: { width: 390, height: 844 }, touch: true, grade: '小学 1 年生', range: '足し算まで', mathStart: 7 },
    { name: 'tablet-written', viewport: { width: 768, height: 1024 }, touch: false, grade: '小学 3 年生', range: '筆算（2けたのたし算・ひき算）', mathStart: 11 },
].filter(row => !process.env.SANSU_ISLAND_RHYTHM_SCENARIO || row.name === process.env.SANSU_ISLAND_RHYTHM_SCENARIO);
assert(cases.length, 'Select phone-math or tablet-written');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await fs.readFile(buildSourcePath), manifest = JSON.parse(manifestBytes);
const qaPaths = ['tools/e2e-island-rhythm.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs',
    'tools/island-learning-fixtures.mjs', 'tools/island-onboarding-checks.mjs'];
async function sourceSnapshot() {
    const paths = [...new Set([...manifest.files.map(file => file.path), ...qaPaths])].sort();
    const files = await Promise.all(paths.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
    return { files, hash: sha(JSON.stringify(files)) };
}
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' }, 'Preserve earlier reports; use a new output directory');
const report = { target: base, startedAt: new Date().toISOString(), candidate: ISLAND_CANDIDATE,
    flag: 'VITE_ISLAND_ENABLED=true', humanN: 0, pass: false, browserClosed: false,
    execution: { kind: cases.length === 2 ? 'full-rhythm' : 'diagnostic-subset', requestedCases: cases.map(row => row.name) },
    buildSource: { path: resolve(buildSourcePath), manifestSHA: sha(manifestBytes), sourceHash: manifest.sourceHash,
        revision: manifest.revision, flags: manifest.flags },
    runner: { cwd: process.cwd(), command: process.argv }, sourceStart: await sourceSnapshot(), scenarios: [], captures: [],
    scope: 'Two Chromium viewport flows from empty native databases through actual Welcome/setup and normal planner reservations. No profile, memory, completedSets, question, resident, receipt or clock injection. Introduction and ordinary section transitions are reported separately. Diagnostic per-answer times do not replace the formal 80-run benchmark or child observation.',
    notCovered: ['Real device installation and PWA update', 'Second-transaction failure/retry and concurrent tabs',
        'Optional editing, discoveries and album comparison; dedicated living-island UI suite covers these'] };
report.buildSourceMismatches = manifest.files.filter(file =>
    report.sourceStart.files.find(actual => actual.path === file.path)?.sha256 !== file.sha256);
await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
assert.deepEqual(report.buildSourceMismatches, [], 'All frozen application inputs match before the production run');

async function capture(page, row, label) {
    const metadata = await runtimeMetadata(page), file = `${row.name}-${label}.png`;
    assert.equal(metadata.revision, report.manifest.revision); assert.equal(metadata.version, report.manifest.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE); assert.equal(metadata.delivery, 'mystic-island-v1');
    const input = await page.locator('.island-learning').evaluateAll(nodes => nodes.map(root => ({
        id: root.dataset.islandPlanId, revision: root.dataset.islandPlanRevision, intro: root.dataset.intro,
        ready: root.dataset.inputReady, count: root.querySelector('.island-light-trail')?.getAttribute('aria-label'),
    })));
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, input, sourceHash: manifest.sourceHash });
}

async function armNormalFlow(page) {
    await page.evaluate(() => {
        const probe = window.__islandRhythmFlow = { modes: [], actions: [], overflow: false };
        const save = (key, value) => { if (probe[key].length < 1024) probe[key].push(value); else probe.overflow = true; };
        const root = document.querySelector('.island-page'); save('modes', root.dataset.mode);
        const observer = new MutationObserver(records => {
            for (const record of records) save('modes', record.oldValue);
            save('modes', root.dataset.mode);
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-mode'], attributeOldValue: true });
        const onClick = event => {
            if (event.isTrusted) save('actions', { type: 'click', answer: Boolean(event.target.closest?.('.park-answer')), text: event.target.textContent });
        };
        const onKey = event => { if (event.isTrusted) save('actions', { type: 'keydown', key: event.key }); };
        document.addEventListener('click', onClick, true); document.addEventListener('keydown', onKey, true);
        window.__stopIslandRhythmFlow = () => {
            observer.disconnect(); document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey, true);
            return probe;
        };
    });
}

async function finishPlan(page, row, state, introduction) {
    const plan = structuredClone(state.plan), before = structuredClone(state);
    let submissions = 0, final;
    while (state.plan?.id === plan.id) {
        assert(++submissions <= 96, 'Complete only the actual reserved problems and written rows');
        await assertControls(page);
        final = await attempt(page, state, { touch: row.touch });
        row.answers.push({ section: introduction ? 'introduction' : 'ordinary', beforePlanId: state.plan.id,
            beforeCursor: state.plan.cursor, receipt: final.receipt, timingDiagnostic: final.sample });
        state = final.after;
    }
    assert.equal(final.saved.id, plan.id); assert.equal(final.saved.status, 'completed');
    assert.equal(final.saved.cursor, plan.slots.length);
    assert.deepEqual(final.saved.slots.map(slot => slot.problem), plan.slots.map(slot => slot.problem));
    assert.equal(state.island.completedSets, before.island.completedSets + 1);
    assert(plan.growthTarget, 'Real new reservations fix their automatic growth destination');
    assert.deepEqual(state.island.pendingRewards, before.island.pendingRewards, 'Learning grows a place without minting possessions');
    assertIslandSectionGrowth(before, state, plan);
    const added = state.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
    assert.equal(added.filter(event => event.type === 'plan_completed' && event.planId === plan.id).length, 1);
    assert.equal(final.sample.autoContinued, true); assert.equal(final.sample.terminal, false);
    assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', plan.profileId, state.island.completedSets]));
    assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
    assert.equal(added.filter(event => event.type === 'plan_started' && event.planId === state.plan.id).length, 1);
    await waitMode(page, 'learning'); await waitLearningReady(page, state.plan);
    return { state, proof: { planId: plan.id, reservedCount: plan.slots.length, actualSubmissions: submissions,
        addedEvents: added, completed: final.saved, nextPlan: state.plan, pendingRewards: state.island.pendingRewards,
        finalTimingDiagnostic: final.sample } };
}

function assertVisitPreservesLearning(current, baseline, message) {
    for (const name of Object.keys(baseline).filter(name => name !== 'islands' && name !== 'islandEvents')) assert.deepEqual(current[name], baseline[name], `${message}: ${name}`);
    assert.deepEqual(current.islandEvents.rows.filter(event => event.type !== 'discovery_observed'), baseline.islandEvents.rows.filter(event => event.type !== 'discovery_observed'), `${message}: learning events`);
    assert.deepEqual(current.islands.keys, baseline.islands.keys);
    for (const before of baseline.islands.rows) {
        const after = current.islands.rows.find(row => row.profileId === before.profileId);
        assert(after);
        const content = island => { const copy = structuredClone(island); delete copy.revision; delete copy.updatedAt; delete copy.growth.discoveries; return copy; };
        assert.deepEqual(content(after), content(before), message);
        assert(before.growth.discoveries.every(entry => after.growth.discoveries.some(saved => JSON.stringify(saved) === JSON.stringify(entry))), 'A visit preserves every earlier discovery');
        assert.equal(after.revision - before.revision, after.growth.discoveries.length - before.growth.discoveries.length, 'Only actual new discovery saves change a quiet visit revision');
    }
}

async function nativeIntroduction(page, row) {
    await armOnboardingObservation(page);
    await page.goto(`${base}/#/`); await page.waitForURL('**/#/onboarding');
    await page.locator('[data-onboarding-world="island"][data-mode="welcome"]').waitFor();
    await waitReady(page);
    const actualManifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
    assert.equal(actualManifest.revision, manifest.revision); assert(actualManifest.island.enabled);
    assert.equal(actualManifest.island.candidate, ISLAND_CANDIDATE);
    assert(!actualManifest.revision.includes('development'));
    if (report.manifest) assert.deepEqual(actualManifest, report.manifest); else report.manifest = actualManifest;
    const empty = await onboardingStores(page); assertProfileFree(empty);
    row.welcomePlay = await welcomePlay(page, 'starter-flower', 'おはな', row.touch);
    await activate(button(page, 'まなぶ'), row.touch); await untouchedStep(page, 'grade', empty);
    await activate(button(page, row.grade), row.touch); await untouchedStep(page, 'subject', empty);
    await activate(button(page, 'さんすう'), row.touch); await untouchedStep(page, 'math', empty);
    await activate(button(page, row.range), row.touch);
    await waitMode(page, 'learning'); await waitReady(page);
    await page.locator('.island-learning[data-intro="true"][data-input-ready="true"]').waitFor();
    await page.waitForURL('**/#/island');
    const created = await onboardingStores(page), profile = created.profiles.rows[0];
    assert.equal(created.profiles.rows.length, 1); assert.equal(profile.name, 'プレイヤー');
    assert.equal(profile.mathStartLevel, row.mathStart); assert.equal(profile.subjectMode, 'math');
    assert.equal(created.appData.rows[0].activeProfileId, profile.id);
    assert.deepEqual(created.appData.rows[0].profiles[profile.id], profile);
    assert.equal(created.logs.rows.length, 0); assert.equal(created.islandPlans.rows.length, 1);
    assert.deepEqual(created.islandEvents.rows.map(event => event.type), ['plan_started']);
    row.profileId = profile.id;
    const state = await readNative(page, profile.id);
    assert.equal(state.island.completedSets, 0); assert.deepEqual(state.island.pendingRewards, []);
    assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', profile.id, 0]));
    assert.equal(state.plan.slots.length, 3); assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
    const observation = await page.evaluate(() => window.__onboardingObservation);
    const startRoute = observation.routes.find(route => {
        const url = new URL(route.hash.slice(1), 'https://rhythm.invalid');
        return url.pathname === '/island' && url.searchParams.get('start') === 'learn' && url.searchParams.get('profile') === profile.id;
    });
    assert(startRoute, 'Actual setup completion requests learning for the profile it just created');
    assert.equal(observation.clicks.filter(click => click.hash.startsWith('#/island')).length, 0,
        'No extra Island home click occurs between setup completion and the first ready problem');
    row.introduction = { profileFixture: false, startRoute, setup: { grade: row.grade, range: row.range, blankName: true },
        createdStores: created, firstPlan: state.plan, setupActions: observation.clicks };
    await capture(page, row, 'intro-first-ready');
    return state;
}

const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
report.browser = { name: 'chromium', version: browser.version() };
try {
    for (const scenario of cases) {
        const row = { ...scenario, answers: [], errors: [], persistence: [], pass: false };
        report.scenarios.push(row);
        const context = await browser.newContext({ viewport: scenario.viewport, hasTouch: scenario.touch,
            locale: 'ja-JP', reducedMotion: 'no-preference', serviceWorkers: 'block', recordVideo: { dir: `${out}/videos` } });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => row.errors.push(error.stack));
        try {
            let state = await nativeIntroduction(page, row);
            await armNormalFlow(page);
            const intro = await finishPlan(page, row, state, true); state = intro.state;
            const introFlow = await page.evaluate(() => window.__stopIslandRhythmFlow());
            assert(!introFlow.overflow); assert(introFlow.modes.every(mode => mode === 'learning'), 'First automatic upgrade never presents rewards or home');
            assert(introFlow.actions.every(action => action.type === 'click' ? action.answer : /^[0-9]$|^Enter$|^\.$/.test(action.key)), 'Only answers advance the first section');
            row.introduction.completion = { ...intro.proof, flow: introFlow, extraContinuationActions: 0, automaticRewardScreens: 0 };
            await capture(page, row, 'intro-auto-growth');
            await page.locator('.island-learning[data-intro="false"][data-input-ready="true"]').waitFor();
            state = await readNative(page, row.profileId); await waitLearningReady(page, state.plan);
            assert.deepEqual(state.island.pendingRewards, []); assert.equal(state.island.growth.progress.garden, 1);
            assert(state.island.items.some(item => item.kind === 'bench' && item.position), 'First growth automatically makes a usable garden');
            assert([3, 6].includes(state.plan.slots.length));
            await capture(page, row, 'normal-first-ready'); await armNormalFlow(page);
            const normal = await finishPlan(page, row, state, false); state = normal.state;
            const flow = await page.evaluate(() => window.__stopIslandRhythmFlow());
            assert(!flow.overflow); assert(flow.modes.every(mode => mode === 'learning'), 'Normal boundary never presents rewards or home');
            assert(flow.actions.every(action => action.type === 'click' ? action.answer : /^[0-9]$|^Enter$|^\.$/.test(action.key)),
                'Only answer controls are used during the ordinary section and its boundary');
            row.ordinary = { ...normal.proof, flow, extraContinuationActions: 0, automaticRewardScreens: 0 };
            await capture(page, row, 'normal-next-plan-ready');
            const nextPlanId = state.plan.id; let guard = 0;
            while (state.plan.cursor === 0) {
                assert(++guard <= 32);
                const answer = await attempt(page, state, { touch: row.touch }); state = answer.after;
                row.answers.push({ section: 'next-plan-first-problem', receipt: answer.receipt, timingDiagnostic: answer.sample });
            }
            assert.equal(state.plan.id, nextPlanId); assert.equal(state.plan.cursor, 1);
            const paused = await onboardingStores(page);
            await activate(page.locator('.island-learning-pause'), row.touch); await waitMode(page, 'home');
            assertVisitPreservesLearning(await onboardingStores(page), paused, 'Voluntary home preserves saved learning and automatic growth');
            await capture(page, row, 'voluntary-home');
            assert.equal(await page.locator('.island-home-secondary button').filter({ hasText: 'おくりものを えらぶ' }).count(), 0);
            await activate(button(page, 'アルバム'), row.touch); await waitMode(page, 'album');
            assertVisitPreservesLearning(await onboardingStores(page), paused, 'Viewing immutable memories preserves learning and current island');
            await capture(page, row, 'growth-album');
            await activate(button(page, 'アルバムから もどる'), row.touch); await waitMode(page, 'home');
            await activate(page.locator('.island-start'), row.touch); await waitMode(page, 'learning');
            await waitLearningReady(page, state.plan);
            assertVisitPreservesLearning(await onboardingStores(page), paused, 'One explicit home start resumes the exact pending reservation');
            const resumed = await onboardingStores(page);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning'); await waitLearningReady(page, state.plan);
            assert.deepEqual(await onboardingStores(page), resumed, 'Reload resumes the exact saved slot without another start or answer');
            await capture(page, row, 'reloaded-pending-learning');
            row.persistence.push({ phase: 'voluntary-home/album/resume/reload', before: paused,
                after: await onboardingStores(page), learningAndGrowthUnchanged: true });
            row.resume = { planId: state.plan.id, cursor: state.plan.cursor, revision: state.plan.revision,
                pendingRewards: state.island.pendingRewards, automaticReload: true, homeStartActions: 1 };
            assert.deepEqual(row.errors, []); row.pass = true;
        } catch (error) {
            row.error = error.stack ?? String(error); process.exitCode = 1;
            row.failureStores = await onboardingStores(page).catch(() => null);
            await page.screenshot({ path: `${out}/${row.name}-failure.png` }).catch(() => {});
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => '')).catch(() => {});
        } finally { await context.close(); }
        await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    }
} catch (error) {
    report.error = error.stack ?? String(error); process.exitCode = 1;
} finally {
    await browser.close(); report.browserClosed = true;
    try {
        report.sourceEnd = await sourceSnapshot();
        report.sourceStable = report.sourceStart.hash === report.sourceEnd.hash;
    } catch (error) { report.error = [report.error, error.stack].filter(Boolean).join('\n'); report.sourceStable = false; }
    report.finishedAt = new Date().toISOString();
    report.pass = !report.error && report.sourceStable && report.scenarios.length === cases.length && report.scenarios.every(row => row.pass);
    if (!report.pass) process.exitCode = 1;
    await fs.writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ pass: report.pass, sourceStable: report.sourceStable, browserClosed: report.browserClosed,
        report: `${out}/report.json`, cases: report.scenarios.map(row => ({ name: row.name, pass: row.pass, error: row.error })) }, null, 2));
}
