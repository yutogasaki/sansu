import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { answerUI, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertExploreCheckpoint, waitForExploreNumericReady, waitForPageState } from './async-state-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', hookChecks: [], offline: null, pass: false };
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
        await page.waitForURL('**/#/onboarding');
        const id = await seedNative(page, 'island-production-checkpoint');
        await page.goto(`${base}/#/`);
        await waitReady(page);
        assert.equal(new URL(page.url()).hash, '#/island');
        report.runtime = await runtimeMetadata(page);
        const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
        assert.equal(manifest.island.enabled, true);
        assert.equal(manifest.island.candidate, report.runtime.candidate);
        assert.equal(report.runtime.learningCandidate, 'mystic-island-learning-v2');
        assert.equal(manifest.island.learningCandidate, report.runtime.learningCandidate);
        assert.equal(manifest.version, report.runtime.version);
        assert.equal(manifest.revision, report.runtime.revision);
        report.manifest = manifest;
        await page.locator('.island-start').click();
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
        assert.equal(continuous.island.growth.progress.garden, 2);
        assert(continuous.island.items.some(item => item.kind === 'fountain' && item.position));
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
        report.hookChecks.push('automatic next section keeps update deferred; final answer, garden growth, east habitat and next reservation survive the voluntary checkpoint');
        report.automaticBoundary = { before: boundaryBefore, saved: continuous, restored: boundaryRestored };

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
    // remove additive growth fields to model an actual saved Island v1 plan.
    const legacyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const legacyPage = await legacyContext.newPage();
    legacyPage.setDefaultTimeout(15000);
    const legacyErrors = [];
    legacyPage.on('pageerror', error => legacyErrors.push(error.stack));
    await legacyPage.addInitScript(() => { window.__SANSU_PWA_E2E__ = true; });
    try {
        await legacyPage.goto(`${base}/#/island`); await legacyPage.waitForURL('**/#/onboarding');
        const id = await seedNative(legacyPage, 'island-legacy-gift-checkpoint');
        await legacyPage.goto(`${base}/#/island`); await waitReady(legacyPage);
        await legacyPage.locator('.island-start').click(); await waitMode(legacyPage, 'learning');
        const generated = await readNative(legacyPage, id);
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
                plan.onsuccess = () => { delete plan.result.growthTarget; transaction.objectStore('islandPlans').put(plan.result); };
                await done;
            } finally { database.close(); }
        }, { profileId: id, planId: generated.plan.id });
        const frozen = await readNative(legacyPage, id);
        assert.equal(frozen.plan.growthTarget, undefined); assert.equal(frozen.island.growth, undefined);
        assert.deepEqual(frozen.plan.slots, generated.plan.slots);
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
        report.legacyIsland = { fixture: 'Actual initial reserved questions with optional growth fields omitted; gift earned through actual UI',
            frozen, completed: oldState, migrated, runtime: legacyRuntime };
        report.hookChecks.push('legacy Island reservation and reward screen defer update; new reservation migrates once and keeps the unclaimed old gift');
    } finally { await legacyContext.close(); }

    const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const offlinePage = await offlineContext.newPage();
    offlinePage.setDefaultTimeout(15000);
    try {
        await offlinePage.goto(`${base}/#/island`);
        await offlinePage.waitForURL('**/#/onboarding');
        await offlinePage.evaluate(() => navigator.serviceWorker.ready);
        await offlinePage.reload();
        await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        const id = await seedNative(offlinePage, 'island-offline');
        await offlinePage.goto(`${base}/#/island`);
        await waitReady(offlinePage);
        await offlineContext.setOffline(true);
        await offlinePage.reload();
        await waitReady(offlinePage);
        await offlinePage.locator('.island-start').click();
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
