import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { answerUI, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady as waitSceneReady } from './island-e2e-helpers.mjs';
import { assertExploreCheckpoint, waitForExploreNumericReady, waitForPageState } from './async-state-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island';
const comparisonStores = ['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns'];
const scope = {
    comparisonStores, bootstrapOwnerStores: ['profiles', 'appData'],
    fixture: 'Native profile only; real UI creates reservations/answers. Legacy additionally omits growth and reward-pacing fields from its actual first reservation.',
    scenarios: ['Profile-free Island welcome -> seeded owner home -> protected learning/growth checkpoints',
        'Legacy frozen questions/gift/10 stars -> one explicit migration with unchanged balance',
        'Hook-free real SW control and cached home bundles -> offline first reservation/answers/reload'],
    limits: 'Seven-store learning/Island comparisons; not every database store, photo-Blob persistence, real two-build update, or human/normal-speed evidence.',
};
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, target: base, output: out,
        environment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_OUTPUT'],
        sourceRule: 'External fingerprint verifies the frozen app and explicit immutable QA overlay before/after execution.', ...scope }, null, 2));
    process.exit(0);
}
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', scope, bootstrapChecks: [], hookChecks: [], offline: null, pass: false };
async function waitReady(page) {
    const island = page.locator('.island-page[data-visual-candidate-id="mystic-island-shore-garden-v6"]');
    await island.waitFor();
    if (await island.getAttribute('data-mode') === 'learning') {
        // The learning focus layout keeps the scene mounted but intentionally
        // hidden. Verify the restored input, not visibility of that canvas.
        await page.locator('[data-renderer="three"] canvas').waitFor({ state: 'attached' });
        await page.locator('.island-workbench[data-input-ready="true"]').waitFor();
    } else {
        await waitSceneReady(page);
    }
}
async function nativeOwner(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const transaction = database.transaction(['profiles', 'appData']);
            const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            const [profiles, app] = await Promise.all([read(transaction.objectStore('profiles').getAll()), read(transaction.objectStore('appData').get('app'))]);
            return { profiles, app, localActiveId: localStorage.getItem('sansu_active_profile') };
        } finally { database.close(); }
    });
}
async function waitEmptyWelcome(page) {
    await page.waitForURL('**/#/onboarding');
    await page.locator('.island-welcome[data-mode="welcome"][data-onboarding-candidate="island-touch-first-v1"]').waitFor();
    await waitSceneReady(page);
    const owner = await nativeOwner(page), state = await readNative(page);
    assert.deepEqual(owner.profiles, []); assert.deepEqual(owner.app?.profiles, {});
    assert.equal(owner.app.activeProfileId, null); assert.equal(owner.localActiveId, null);
    for (const store of comparisonStores) assert.deepEqual(state[store], [], `Welcome must not create ${store}`);
    assert.equal(new URL(page.url()).hash, '#/onboarding');
}
async function waitSeededHome(page, profileId) {
    await page.waitForURL('**/#/island'); await waitMode(page, 'home'); await waitReady(page);
    await page.waitForFunction(() => {
        const root = document.querySelector('.island-page[data-mode="home"]');
        const renderer = root?.querySelector('[data-renderer="three"]');
        const canvas = renderer?.querySelector('canvas'), rect = canvas?.getBoundingClientRect();
        return Boolean(rect && rect.width > 1 && rect.height > 1 && Number(renderer.getAttribute('data-draw-calls')) > 0);
    });
    const owner = await nativeOwner(page), state = await readNative(page);
    assert.equal(owner.localActiveId, profileId); assert.equal(owner.app.activeProfileId, profileId);
    assert.deepEqual(owner.profiles.map(profile => profile.id), [profileId]);
    assert.deepEqual(Object.keys(owner.app.profiles), [profileId]);
    assert.equal(owner.app.profiles[profileId].id, profileId); assert.equal(owner.app.profiles[profileId].soundEnabled, false);
    assert.equal(state.islands.length, 1); assert.equal(state.island.profileId, profileId);
    assert.equal(state.island.completedSets, 0); assert.equal(state.island.pendingPlanId, undefined);
    assert.equal(state.plan, undefined);
    for (const store of comparisonStores.filter(name => name !== 'islands')) assert.deepEqual(state[store], [], `Seeded home must not create ${store}`);
    assert.equal(new URL(page.url()).hash, '#/island');
    return state;
}
async function offlineHomeBundles(page) {
    const evidence = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name).filter(name => {
            const url = new URL(name);
            return url.origin === location.origin && /\/assets\/.*\.(?:js|css)$/.test(url.pathname);
        }))];
        const resources = await Promise.all(urls.map(async url => ({ url, cached: Boolean(await caches.match(url, { ignoreSearch: true })) })));
        return { controlled: Boolean(navigator.serviceWorker.controller), active: registration.active?.state,
            hookEnabled: window.__SANSU_PWA_E2E__ === true, resources };
    });
    assert.equal(evidence.hookEnabled, false); assert.equal(evidence.controlled, true); assert.equal(evidence.active, 'activated');
    assert(evidence.resources.some(resource => new URL(resource.url).pathname.endsWith('.js')), 'The real home and renderer JavaScript must load before disconnecting');
    assert(evidence.resources.some(resource => new URL(resource.url).pathname.endsWith('.css')), 'The real home styles must load before disconnecting');
    assert(evidence.resources.every(resource => resource.cached), 'Every loaded home JS/CSS bundle must be in the real SW cache before disconnecting');
    return evidence;
}
const dispatch = (page, type, detail) => page.evaluate(({ type, detail }) => window.dispatchEvent(new CustomEvent(type, { detail })), { type, detail });
const markerRequest = (page, marker, timeout = 12000) => page.waitForRequest(request => request.isNavigationRequest()
    && new URL(request.url()).searchParams.get('__app-update') === marker, { timeout });
async function noReloadWhile(page, marker, action) {
    const navigations = [];
    const observe = request => {
        if (request.isNavigationRequest() && new URL(request.url()).searchParams.get('__app-update') === marker) navigations.push(request.url());
    };
    page.on('request', observe);
    try {
        await action();
        // Keep the observer attached for the entire real action, however long
        // its writes take, and a quiet window after the resulting UI is ready.
        await new Promise(resolve => setTimeout(resolve, 750));
        assert.deepEqual(navigations, [], 'Protected session must not reload during the complete action or its settled window');
    } finally { page.off('request', observe); }
}

try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.addInitScript(() => { window.__SANSU_PWA_E2E__ = true; });
    try {
        await page.goto(`${base}/#/island`);
        await waitEmptyWelcome(page);
        const id = await seedNative(page, 'island-production-checkpoint');
        await page.goto(`${base}/#/`);
        await waitSeededHome(page, id);
        report.bootstrapChecks.push({ scenario: 'current', profileId: id, emptyWelcome: true, seededHome: true, reservedPlanBeforeStart: false });
        report.runtime = await runtimeMetadata(page);
        const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
        assert.equal(manifest.island.enabled, true);
        assert.equal(manifest.island.candidate, report.runtime.candidate);
        assert.equal(report.runtime.learningCandidate, 'mystic-island-learning-v2');
        assert.equal(manifest.island.learningCandidate, report.runtime.learningCandidate);
        assert.equal(manifest.version, report.runtime.version);
        assert.equal(manifest.revision, report.runtime.revision);
        report.manifest = manifest;
        await page.locator('.island-page[data-mode="home"] .island-start').click();
        await waitMode(page, 'learning');
        let before = await readNative(page, id);
        const protectedMarker = 'island-active-learning';
        await noReloadWhile(page, protectedMarker, () => dispatch(page, 'sansu:pwa-e2e-reload', { version: protectedMarker }));
        const checkpointNavigation = markerRequest(page, protectedMarker);
        const checkpointLoaded = page.waitForEvent('domcontentloaded');
        await button(page, 'しまへ').click();
        await checkpointNavigation;
        await checkpointLoaded;
        await waitReady(page);
        await waitMode(page, 'learning');
        assert.deepEqual((await readNative(page, id)).plan, before.plan);
        assert.deepEqual((await readNative(page, id)).logs, before.logs);
        report.hookChecks.push('active learning defers update; user home checkpoint reloads with reserved plan preserved');
        await page.screenshot({ path: `${out}/pwa-restored-learning.png`, animations: 'disabled' });

        // Exercise the real global hold across a React Router navigation. Hooks inject only the hold/update signal.
        await dispatch(page, 'sansu:pwa-e2e-persistence', { active: true });
        const saveMarker = 'island-save-navigation-hold';
        await noReloadWhile(page, saveMarker, async () => {
            await dispatch(page, 'sansu:pwa-e2e-reload', { version: saveMarker });
            await dispatch(page, 'sansu:pwa-e2e-navigate', { to: '/stats' });
            await page.waitForURL('**/#/stats');
        });
        const releasedNavigation = markerRequest(page, saveMarker);
        const releasedLoaded = page.waitForEvent('domcontentloaded');
        await dispatch(page, 'sansu:pwa-e2e-persistence', { active: false });
        await releasedNavigation;
        await releasedLoaded;
        await page.locator('.app-container').waitFor();
        assert.deepEqual((await readNative(page, id)).plan, before.plan);
        report.hookChecks.push('critical persistence hold spans navigation and releases deferred update afterwards');

        await page.goto(`${base}/#/island`);
        await waitReady(page);
        await button(page, 'しまへ').click();
        await waitMode(page, 'home');
        await button(page, 'つづきから とく').click();
        await waitMode(page, 'learning');
        const freshMarker = 'island-fresh-checkpoint-session';
        await noReloadWhile(page, freshMarker, () => dispatch(page, 'sansu:pwa-e2e-reload', { version: freshMarker }));
        before = await readNative(page, id);
        const answer = await answerUI(page, before.plan, { dev: false });
        assert(answer.state.plan.cursor > before.plan.cursor);
        assert.equal(answer.state.logs.length, before.logs.length + 1);
        const answered = answer.state.plan;
        const answerCheckpoint = markerRequest(page, freshMarker);
        const answerLoaded = page.waitForEvent('domcontentloaded');
        await button(page, 'しまへ').click();
        await answerCheckpoint;
        await answerLoaded;
        await waitReady(page);
        await waitMode(page, 'learning');
        assert.deepEqual((await readNative(page, id)).plan, answered);
        report.hookChecks.push('continue pointer protects fresh session; answer receipt survives next user checkpoint');

        // First and ordinary growth boundaries both remain in the protected
        // learning session. No gift selection or building click is needed.
        let continuous = await readNative(page, id);
        const firstPlanId = continuous.plan.id;
        // The checkpoint above created a fresh document, where updates are
        // allowed until real input resumes. Answer its next question before
        // queuing the marker; the final introductory answer then crosses the
        // protected growth boundary without an artificial interaction.
        continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
        assert.equal(continuous.plan.id, firstPlanId);
        assert.equal(continuous.plan.cursor, continuous.plan.slots.length - 1);
        const firstMarker = 'island-first-automatic-growth-protected';
        await noReloadWhile(page, firstMarker, async () => {
            await dispatch(page, 'sansu:pwa-e2e-reload', { version: firstMarker });
            for (let attempt = 0; attempt < 12 && continuous.plan?.id === firstPlanId; attempt += 1) {
                continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
            }
        });
        await waitMode(page, 'learning');
        assert.equal(continuous.island.completedSets, 1);
        assert.equal(continuous.island.growth.progress.garden, 1);
        assert.deepEqual(continuous.island.pendingRewards, []);
        assert.notEqual(continuous.plan.id, firstPlanId);
        assert.equal(continuous.plan.cursor, 0);
        const firstNavigation = markerRequest(page, firstMarker), firstLoaded = page.waitForEvent('domcontentloaded');
        await button(page, 'しまへ').click();
        await firstNavigation; await firstLoaded; await waitReady(page); await waitMode(page, 'learning');
        const firstRestored = await readNative(page, id);
        assert.deepEqual(firstRestored.plan, continuous.plan);
        assert.deepEqual(firstRestored.island, continuous.island);
        assert.deepEqual(firstRestored.logs, continuous.logs);
        report.hookChecks.push('first automatic growth defers update; growth, auto placement and next reservation survive user checkpoint');
        report.firstBoundary = { saved: continuous, restored: firstRestored };
        continuous = firstRestored;
        const normalPlanId = continuous.plan.id;
        for (let attempt = 0; attempt < 12 && continuous.plan.cursor < continuous.plan.slots.length - 1; attempt += 1) {
            continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
        }
        assert.equal(continuous.plan.id, normalPlanId);
        assert.equal(continuous.plan.cursor, continuous.plan.slots.length - 1);
        const boundaryBefore = continuous;
        const boundaryMarker = 'island-automatic-section-protected';
        await noReloadWhile(page, boundaryMarker, async () => {
            await dispatch(page, 'sansu:pwa-e2e-reload', { version: boundaryMarker });
            continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
        });
        await waitMode(page, 'learning');
        assert.equal(continuous.island.completedSets, 2);
        assert.deepEqual(continuous.island.pendingRewards, []);
        assert.equal(continuous.island.growth.progress.garden, boundaryBefore.plan.slots.length === 6 ? 2 : 1);
        assert.equal(continuous.island.growth.pendingAnswers.garden, boundaryBefore.plan.slots.length === 6 ? 0 : 3);
        assert.equal(continuous.island.growth.expansionLevel, 0);
        assert.equal(continuous.island.items.length, 3);
        assert.deepEqual(continuous.island.growth.memories.map(memory => memory.completedSets), [0]);
        assert.equal(continuous.plan.cursor, 0);
        assert.equal(continuous.plan.revision, 0);
        assert.notEqual(continuous.plan.id, normalPlanId);
        assert.equal(continuous.logs.length, boundaryBefore.logs.length + 1);
        const boundaryNavigation = markerRequest(page, boundaryMarker);
        const boundaryLoaded = page.waitForEvent('domcontentloaded');
        await button(page, 'しまへ').click();
        await boundaryNavigation; await boundaryLoaded; await waitReady(page); await waitMode(page, 'learning');
        const boundaryRestored = await readNative(page, id);
        assert.deepEqual(boundaryRestored.plan, continuous.plan);
        assert.deepEqual(boundaryRestored.island, continuous.island);
        assert.deepEqual(boundaryRestored.logs, continuous.logs);
        report.hookChecks.push('ordinary second section keeps update deferred; minor growth, unchanged land and album, and next reservation survive the voluntary checkpoint');
        report.automaticBoundary = { before: boundaryBefore, saved: continuous, restored: boundaryRestored };

        // The first real maturity is now the land-expansion checkpoint.
        continuous = boundaryRestored;
        for (let step = 0; !(continuous.island.growth.progress.garden === 5 && continuous.island.growth.pendingAnswers.garden + continuous.plan.slots.length >= 18); step++) {
            assert(step < 500, 'Real answers must reach the first maturity');
            continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
        }
        assert.equal(continuous.island.growth.expansionLevel, 0);
        const matureBefore = continuous, maturePlanId = continuous.plan.id;
        const matureMarker = 'island-maturity-expansion-protected';
        await noReloadWhile(page, matureMarker, async () => {
            await dispatch(page, 'sansu:pwa-e2e-reload', { version: matureMarker });
            for (let step = 0; continuous.plan?.id === maturePlanId; step++) {
                assert(step < 70, 'The first mature section must finish');
                continuous = (await answerUI(page, continuous.plan, { dev: false })).state;
            }
        });
        assert.equal(continuous.island.completedSets, matureBefore.island.completedSets + 1);
        assert.equal(continuous.island.growth.progress.garden, 6);
        assert.equal(continuous.island.growth.expansionLevel, 1);
        assert.deepEqual(continuous.island.growth.memories.map(memory => memory.completedSets), [0, continuous.island.completedSets]);
        assert.equal(continuous.island.items.length, 5);
        assert(continuous.island.items.some(item => item.kind === 'swing' && item.position));
        const matureNavigation = markerRequest(page, matureMarker), matureLoaded = page.waitForEvent('domcontentloaded');
        await button(page, 'しまへ').click();
        await matureNavigation; await matureLoaded; await waitReady(page); await waitMode(page, 'learning');
        const matureRestored = await readNative(page, id);
        assert.deepEqual(matureRestored.plan, continuous.plan);
        assert.deepEqual(matureRestored.island, continuous.island);
        assert.deepEqual(matureRestored.logs, continuous.logs);
        report.hookChecks.push('first maturity defers update; east expansion, combined album record, stable items and next reservation survive the voluntary checkpoint');
        report.matureBoundary = { before: matureBefore, saved: continuous, restored: matureRestored };

        const islandBeforeLegacy = (await readNative(page, id)).island;
        await page.goto(`${base}/#/explore`);
        const readyDeadline = performance.now() + 15000;
        await waitForPageState(page, async profileId => {
            const request = indexedDB.open('SansuDatabase');
            return new Promise((resolve, reject) => { request.onerror = () => reject(request.error); request.onsuccess = () => {
                const database = request.result;
                const rows = database.transaction('exploreRuns').objectStore('exploreRuns').getAll();
                rows.onerror = () => { database.close(); reject(rows.error); };
                rows.onsuccess = () => { database.close(); resolve(rows.result.some(run => run.profileId === profileId && run.status === 'active' && run.activeCheckpoint)); };
            }; });
        }, id, { timeout: 15000, description: 'this profile saved an active Explore checkpoint' });
        const oldReady = await waitForExploreNumericReady(page, { timeout: Math.max(1, readyDeadline - performance.now()) });
        const beforeLaunch = await readNative(page, id);
        report.legacy = { profileId: id, oldReady, beforeLaunch };
        const old = beforeLaunch.exploreRuns.find(run => run.runId === oldReady.runId && run.profileId === id && run.status === 'active');
        assertExploreCheckpoint(old, id, oldReady);
        await page.goto(`${base}/#/`);
        await page.waitForURL('**/#/island'); await waitReady(page);
        if (await button(page, 'しまへ').isVisible()) { await button(page, 'しまへ').click(); await waitMode(page, 'home'); }
        await button(page, 'ほかの あそび').click();
        await page.getByRole('button', { name: /ポッコの たんけん/ }).click();
        await page.waitForURL('**/#/explore');
        const sameReady = await waitForExploreNumericReady(page, { runId: old.runId, problemId: oldReady.problemId, timeout: 15000 });
        const restored = await readNative(page, id);
        report.legacy.sameReady = sameReady; report.legacy.restored = restored;
        const same = restored.exploreRuns.find(run => run.runId === old.runId && run.profileId === id && run.status === 'active');
        assertExploreCheckpoint(same, id, sameReady);
        assert.equal(same.runId, old.runId);
        assert.deepEqual(same, old, 'Root launch preserves the complete ready Explore run');
        const stableIsland = island => { const copy = structuredClone(island); delete copy.revision; delete copy.updatedAt; delete copy.growth.discoveries; return copy; };
        assert.deepEqual(stableIsland(restored.island), stableIsland(islandBeforeLegacy));
        assert(islandBeforeLegacy.growth.discoveries.every(entry => restored.island.growth.discoveries.some(saved => JSON.stringify(saved) === JSON.stringify(entry))));
        assert.equal(restored.island.revision - islandBeforeLegacy.revision,
            restored.island.growth.discoveries.length - islandBeforeLegacy.growth.discoveries.length, 'Returning home can only record actual new discoveries');
        report.hookChecks.push('Island home keeps the legacy Explore run for explicit resume and preserves Island data');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }

    // Explicit pre-growth Island compatibility, separate from the new-player
    // flow and the old Explore route. Keep the real reserved questions; only
    // remove additive growth/reward-pacing fields to model an actual saved Island v1 plan.
    const legacyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const legacyPage = await legacyContext.newPage();
    legacyPage.setDefaultTimeout(15000);
    const legacyErrors = [];
    legacyPage.on('pageerror', error => legacyErrors.push(error.stack));
    await legacyPage.addInitScript(() => { window.__SANSU_PWA_E2E__ = true; });
    try {
        await legacyPage.goto(`${base}/#/island`); await waitEmptyWelcome(legacyPage);
        const id = await seedNative(legacyPage, 'island-legacy-gift-checkpoint');
        await legacyPage.goto(`${base}/#/island`); await waitSeededHome(legacyPage, id);
        report.bootstrapChecks.push({ scenario: 'legacy', profileId: id, emptyWelcome: true, seededHome: true, reservedPlanBeforeStart: false });
        await legacyPage.locator('.island-page[data-mode="home"] .island-start').click(); await waitMode(legacyPage, 'learning');
        const generated = await readNative(legacyPage, id);
        assert.equal(generated.plan.rewardPacing, 'answers-v1');
        await legacyPage.evaluate(async ({ profileId, planId }) => {
            const open = indexedDB.open('SansuDatabase');
            const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
            try {
                const transaction = database.transaction(['islands', 'islandPlans'], 'readwrite');
                const done = new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error); transaction.onerror = () => reject(transaction.error); });
                const island = transaction.objectStore('islands').get(profileId);
                island.onsuccess = () => {
                    const row = island.result;
                    delete row.growth;
                    row.items = row.items.map(({ id, kind, position, rotation }) => ({ id, kind, position, rotation }));
                    transaction.objectStore('islands').put(row);
                };
                const plan = transaction.objectStore('islandPlans').get(planId);
                plan.onsuccess = () => { delete plan.result.growthTarget; delete plan.result.rewardPacing; transaction.objectStore('islandPlans').put(plan.result); };
                await done;
            } finally { database.close(); }
        }, { profileId: id, planId: generated.plan.id });
        const frozen = await readNative(legacyPage, id);
        assert.equal(frozen.plan.growthTarget, undefined); assert.equal(frozen.island.growth, undefined);
        assert.equal(frozen.plan.rewardPacing, undefined);
        assert.deepEqual(frozen.plan.slots, generated.plan.slots);
        const legacyPoints = frozen.island.customization?.points ?? frozen.island.completedSets * 10;
        await legacyPage.reload(); await waitReady(legacyPage); await waitMode(legacyPage, 'learning');
        assert.deepEqual(await readNative(legacyPage, id), frozen, 'Opening an old reservation must not migrate or replace it');
        let oldState = (await answerUI(legacyPage, frozen.plan, { dev: false })).state;
        const marker = 'island-legacy-gift-protected';
        await noReloadWhile(legacyPage, marker, async () => {
            await dispatch(legacyPage, 'sansu:pwa-e2e-reload', { version: marker });
            for (let attempt = 0; attempt < 12 && oldState.plan?.id === frozen.plan.id; attempt++) {
                oldState = (await answerUI(legacyPage, oldState.plan, { dev: false })).state;
            }
            await waitMode(legacyPage, 'reward');
        });
        const oldCompleted = oldState.islandPlans.find(plan => plan.id === frozen.plan.id);
        assert.equal(oldCompleted.status, 'completed'); assert.equal(oldCompleted.growthTarget, undefined);
        assert.equal(oldCompleted.rewardPacing, undefined);
        assert.equal(oldState.island.customization.points, legacyPoints + 10, 'The absent frozen pacing field earns the original ten stars, not the new question count');
        assert.deepEqual(oldCompleted.slots.map(slot => slot.problem), frozen.plan.slots.map(slot => slot.problem));
        assert.equal(oldState.island.growth, undefined); assert.equal(oldState.island.completedSets, 1);
        assert.equal(oldState.island.pendingRewards.length, 1); assert.equal(oldState.plan, undefined);
        assert.equal(oldState.island.pendingRewards[0].id, frozen.plan.rewardId);
        assert.deepEqual(oldState.island.pendingRewards[0].choices, frozen.plan.rewardChoices);
        const completedEvent = oldState.islandEvents.find(event => event.type === 'plan_completed' && event.planId === frozen.plan.id);
        assert.equal(completedEvent.rewardId, frozen.plan.rewardId); assert.equal(completedEvent.habitatId, undefined);
        await legacyPage.screenshot({ path: `${out}/pwa-legacy-deferred-gift.png`, animations: 'disabled' });
        const legacyNavigation = markerRequest(legacyPage, marker), legacyLoaded = legacyPage.waitForEvent('domcontentloaded');
        await button(legacyPage, 'つづけて とく').click();
        await legacyNavigation; await legacyLoaded; await waitReady(legacyPage); await waitMode(legacyPage, 'learning');
        const migrated = await readNative(legacyPage, id);
        assert.equal(migrated.plan.id, JSON.stringify(['island-plan-v1', id, 1]));
        assert.equal(migrated.plan.growthTarget, 'garden'); assert.equal(migrated.plan.cursor, 0);
        assert.equal(migrated.plan.rewardPacing, 'answers-v1');
        assert.equal(migrated.island.customization.points, oldState.island.customization.points, 'New reservation and update cannot re-award the old ten stars');
        assert.equal(migrated.island.completedSets, 1);
        assert.deepEqual(migrated.island.pendingRewards, oldState.island.pendingRewards, 'The unclaimed old gift survives new reservation and update');
        assert.deepEqual(migrated.island.growth.progress, { garden: 0, waterside: 0, grove: 0, village: 0 });
        assert.equal(migrated.island.growth.memories.length, 1);
        assert.equal(migrated.island.growth.memories[0].completedSets, 1);
        for (const item of oldState.island.items) {
            const current = migrated.island.items.find(candidate => candidate.id === item.id);
            assert(current); assert.deepEqual(current.position, item.position); assert.equal(current.rotation, item.rotation);
        }
        assert.deepEqual(migrated.logs, oldState.logs); assert.deepEqual(migrated.memoryMath, oldState.memoryMath);
        assert.deepEqual(migrated.islandPlans.find(plan => plan.id === frozen.plan.id), oldCompleted);
        for (const event of oldState.islandEvents) assert.deepEqual(migrated.islandEvents.find(current => current.id === event.id), event);
        const added = migrated.islandEvents.filter(event => !oldState.islandEvents.some(old => old.id === event.id));
        assert.equal(added.length, 1); assert.equal(added[0].type, 'plan_started');
        const legacyRuntime = await runtimeMetadata(legacyPage);
        assert.equal(legacyRuntime.version, report.manifest.version);
        assert.deepEqual(legacyErrors, []);
        report.legacyIsland = { fixture: 'Actual initial reserved questions with optional growth/reward-pacing fields omitted; original gift and ten stars earned through actual UI',
            frozen, completed: oldState, migrated, runtime: legacyRuntime };
        report.hookChecks.push('legacy Island reservation and reward screen defer update; new reservation migrates once and keeps the unclaimed old gift');
    } finally { await legacyContext.close(); }

    const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const offlinePage = await offlineContext.newPage();
    offlinePage.setDefaultTimeout(15000);
    try {
        await offlinePage.goto(`${base}/#/island`);
        await waitEmptyWelcome(offlinePage);
        await offlinePage.evaluate(() => navigator.serviceWorker.ready);
        await offlinePage.reload();
        await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await waitEmptyWelcome(offlinePage);
        const id = await seedNative(offlinePage, 'island-offline');
        await offlinePage.goto(`${base}/#/island`);
        const offlineHome = await waitSeededHome(offlinePage, id);
        const bundles = await offlineHomeBundles(offlinePage);
        report.bootstrapChecks.push({ scenario: 'offline', profileId: id, emptyWelcome: true, seededHome: true, reservedPlanBeforeStart: false, bundles });
        await offlineContext.setOffline(true);
        await offlinePage.reload();
        assert.deepEqual(await waitSeededHome(offlinePage, id), offlineHome, 'Offline home reload preserves the seven-store pre-reservation fixture');
        await offlinePage.locator('.island-page[data-mode="home"] .island-start').click();
        await waitMode(offlinePage, 'learning');
        let state = await readNative(offlinePage, id);
        const firstPlanId = state.plan.id;
        for (let attempt = 0; attempt < 12 && state.plan?.id === firstPlanId; attempt += 1) {
            state = (await answerUI(offlinePage, state.plan, { dev: false })).state;
        }
        assert.equal(state.island.completedSets, 1);
        assert.equal(state.island.growth.progress.garden, 1);
        assert.deepEqual(state.island.pendingRewards, []);
        assert.notEqual(state.plan.id, firstPlanId);
        const storedPlan = state.plan;
        await offlinePage.reload();
        await waitReady(offlinePage);
        await waitMode(offlinePage, 'learning');
        const offlineRestored = await readNative(offlinePage, id);
        assert.deepEqual(offlineRestored.plan, storedPlan);
        assert.deepEqual(offlineRestored.island, state.island);
        assert.deepEqual(offlineRestored.logs, state.logs);
        await offlinePage.screenshot({ path: `${out}/offline-reduced-resume.png`, animations: 'disabled' });
        report.offline = { ...(await runtimeMetadata(offlinePage)), serviceWorker: 'real', offlineReload: true,
            answerPersisted: true, automaticGrowthPersisted: true, resumedSamePlan: true, soundEnabled: false };
        assert.equal(report.offline.serviceWorkerControlled, true);
        assert.equal(report.offline.renderer, 'three');
        assert.equal(report.offline.learningCandidate, report.manifest.island.learningCandidate);
        assert.equal(report.offline.version, report.manifest.version);
        console.log('PASS real service-worker offline reload, answer, and resume');
    } finally { await offlineContext.close(); }
    report.pass = true;
    console.log(`PASS Island production PWA: ${report.hookChecks.length} protected-flow checks`);
} finally {
    await fs.writeFile(`${out}/pwa-report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
