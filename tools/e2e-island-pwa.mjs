import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { answerUI, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', hookChecks: [], offline: null, pass: false };
const dispatch = (page, type, detail) => page.evaluate(({ type, detail }) => window.dispatchEvent(new CustomEvent(type, { detail })), { type, detail });
const markerRequest = (page, marker, timeout = 12000) => page.waitForRequest(request => request.isNavigationRequest()
    && new URL(request.url()).searchParams.get('__app-update') === marker, { timeout });
async function noReloadWhile(page, marker, action) {
    const request = markerRequest(page, marker, 750).then(() => true, error => {
        if (error.name !== 'TimeoutError') throw error;
        return false;
    });
    await action();
    assert.equal(await request, false, 'Protected session must not reload during the observation window');
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
        await button(page, 'ひかりを とどける').click();
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
            await dispatch(page, 'sansu:pwa-e2e-navigate', { to: '/study' });
            await page.waitForURL('**/#/study');
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

        const islandBeforeLegacy = (await readNative(page, id)).island;
        await page.goto(`${base}/#/explore`);
        await page.waitForFunction(async () => {
            const request = indexedDB.open('SansuDatabase');
            return new Promise(resolve => { request.onsuccess = () => {
                const database = request.result;
                const rows = database.transaction('exploreRuns').objectStore('exploreRuns').getAll();
                rows.onsuccess = () => { database.close(); resolve(rows.result.some(run => run.status === 'active' && run.activeCheckpoint)); };
            }; });
        });
        const old = (await readNative(page, id)).exploreRuns.find(run => run.status === 'active');
        await page.goto(`${base}/#/`);
        await page.waitForURL('**/#/explore');
        const restored = await readNative(page, id);
        assert.equal(restored.exploreRuns.find(run => run.status === 'active').runId, old.runId);
        assert.deepEqual(restored.island, islandBeforeLegacy);
        report.hookChecks.push('legacy active Explore run retains launch precedence and Island data');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }

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
        await button(offlinePage, 'ひかりを とどける').click();
        await waitMode(offlinePage, 'learning');
        let state = await readNative(offlinePage, id);
        state = (await answerUI(offlinePage, state.plan, { dev: false })).state;
        const storedPlan = state.plan;
        await offlinePage.reload();
        await waitReady(offlinePage);
        await waitMode(offlinePage, 'learning');
        assert.deepEqual((await readNative(offlinePage, id)).plan, storedPlan);
        await offlinePage.screenshot({ path: `${out}/offline-reduced-resume.png`, animations: 'disabled' });
        report.offline = { ...(await runtimeMetadata(offlinePage)), serviceWorker: 'real', offlineReload: true,
            answerPersisted: true, resumedSamePlan: true, soundEnabled: false };
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
