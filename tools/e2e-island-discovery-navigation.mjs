import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { button, ISLAND_CANDIDATE, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_ISLAND_DISCOVERY_NAVIGATION_OUTPUT;
assert(target && manifestPath && out, 'Set fixed production URL, build-source manifest and fresh SANSU_ISLAND_DISCOVERY_NAVIGATION_OUTPUT');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out); // Never overwrite an earlier diagnostic, including a failure.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(await fs.readFile(manifestPath));
const qa = ['tools/e2e-island-discovery-navigation.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...new Set([...source.files.map(file => file.path), ...qa])].sort()
    .map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const start = await fingerprint();
const report = { target, manifestPath, sourceHash: source.sourceHash, sourceStart: sha(JSON.stringify(start)),
    qaStart: start.filter(file => qa.includes(file.path)), startedAt: new Date().toISOString(), humanN: 0,
    diagnosticOnly: true, timingEvidenceEligible: false, applicationDataInjected: false, pass: false,
    scope: 'Real empty-profile setup, six normal learning sections without returning home, and the first naturally observed discovery. Only its real native completion callback is delayed. Read-only album navigation must remain available while learning/exchange/editing stay locked. A second callback hold begins at the actual learning-resume click and confirms comparison stays locked for that interaction. Native records, problems, profile, growth and discovery are never fabricated. Not normal speed or child motivation evidence.',
    captures: [], scenarios: [], errors: [] };
let browser;

/** Install before the app opens Dexie, then arm only immediately before the
 * first return home. The native transaction commits normally; its real assigned
 * completion callback alone waits for an explicit diagnostic release. */
async function installDiscoveryCompletionHold(page) {
    await page.addInitScript(() => {
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
        if (!descriptor?.set || !descriptor?.get) throw new Error('Native oncomplete descriptor is unavailable');
        const originalAdd = IDBObjectStore.prototype.add;
        const selectedTransactions = new WeakSet(), transactionEvents = new WeakMap(), assignedCallbacks = new WeakMap();
        const probe = window.__islandDiscoveryCompletionProbe = { armed: false, marked: 0, held: false, released: false,
            hits: 0, installedAt: Date.now(), events: [] };
        const log = (type, detail = {}) => probe.events.push({ type, at: Date.now(), monotonic: performance.now(), ...detail });
        let restore;
        const wrappedAdd = function (value, ...args) {
            const request = originalAdd.call(this, value, ...args);
            if (probe.armed && !probe.marked && this.name === 'islandEvents' && this.transaction.db.name === 'SansuDatabase'
                && value?.type === 'discovery_observed') {
                probe.marked++;
                selectedTransactions.add(this.transaction);
                const actualEvent = structuredClone(value);
                transactionEvents.set(this.transaction, actualEvent); probe.actualEvent = actualEvent;
                log('real-discovery-add', { actualEvent });
            }
            return request;
        };
        const wrappedSetter = function (callback) {
            assignedCallbacks.set(this, callback);
            if (typeof callback !== 'function') { descriptor.set.call(this, callback); return; }
            descriptor.set.call(this, function (event) {
                if (selectedTransactions.has(this) && !probe.hits) {
                    probe.hits++; probe.held = true; probe.nativeCompletedAt = Date.now();
                    const transaction = this;
                    log('native-complete-callback-held', { actualEvent: transactionEvents.get(this) });
                    window.__releaseIslandDiscoveryCompletion = () => {
                        if (probe.released) return false;
                        probe.released = true; probe.held = false; probe.releasedAt = Date.now();
                        log('real-completion-callback-release'); restore();
                        window.__releaseIslandDiscoveryCompletion = undefined;
                        callback.call(transaction, event);
                        return true;
                    };
                } else callback.call(this, event);
            });
        };
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor,
            get() { return assignedCallbacks.has(this) ? assignedCallbacks.get(this) : descriptor.get.call(this); }, set: wrappedSetter });
        IDBObjectStore.prototype.add = wrappedAdd;
        restore = () => {
            if (IDBObjectStore.prototype.add === wrappedAdd) IDBObjectStore.prototype.add = originalAdd;
            if (Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')?.set === wrappedSetter) {
                Object.defineProperty(IDBTransaction.prototype, 'oncomplete', descriptor);
            }
        };
        window.__armIslandDiscoveryCompletion = () => { probe.armed = true; probe.armedAt = Date.now(); log('armed-before-first-home'); };
    });
}
async function probeState(page) {
    return page.evaluate(() => structuredClone(window.__islandDiscoveryCompletionProbe));
}
/** Dexie binds database.transaction during open, so observe the dynamically
 * assigned native completion handler. Arm synchronously at the actual start
 * click, before its React handler, to exclude an earlier ambient transaction. */
async function installStartCompletionHold(page) {
    await page.evaluate(() => {
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
        if (!descriptor?.set || !descriptor?.get) throw new Error('Native oncomplete descriptor is unavailable');
        const callbacks = new WeakMap();
        const probe = window.__islandStartCompletionProbe = { armed: false, hits: 0, held: false, released: false,
            installedAt: Date.now(), events: [] };
        const log = type => probe.events.push({ type, at: Date.now(), monotonic: performance.now() });
        const armAtActualClick = event => {
            if (!event.isTrusted || !event.target.closest?.('.island-start')) return;
            probe.armed = true; probe.trustedStartClick = true; log('armed-at-real-start-click');
            document.removeEventListener('click', armAtActualClick, true);
        };
        document.addEventListener('click', armAtActualClick, true);
        const wrappedSetter = function (callback) {
            callbacks.set(this, callback);
            if (!probe.armed || probe.hits || typeof callback !== 'function' || this.db.name !== 'SansuDatabase'
                || this.mode !== 'readwrite' || !this.objectStoreNames.contains('islands')) {
                descriptor.set.call(this, callback); return;
            }
            probe.hits++; probe.storeNames = [...this.objectStoreNames]; probe.transactionMode = this.mode;
            log('real-resume-transaction-selected');
            descriptor.set.call(this, function (event) {
                const transaction = this;
                probe.held = true; probe.nativeCompletedAt = Date.now(); log('native-complete-callback-held');
                window.__releaseIslandStartCompletion = () => {
                    if (probe.released) return false;
                    probe.released = true; probe.held = false; probe.releasedAt = Date.now(); log('real-completion-callback-release');
                    if (Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')?.set === wrappedSetter) {
                        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', descriptor);
                    }
                    window.__releaseIslandStartCompletion = undefined;
                    callback.call(transaction, event);
                    return true;
                };
            });
        };
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor,
            get() { return callbacks.has(this) ? callbacks.get(this) : descriptor.get.call(this); }, set: wrappedSetter });
    });
}
async function capture(page, name) {
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, report.version.revision); assert.equal(metadata.version, report.version.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE);
    const stages = await page.locator('[data-testid="island-stage"]').evaluateAll(elements => elements.map(el => ({
        theme: el.dataset.islandTheme, accent: el.dataset.islandAccent, candidate: el.dataset.customizationCandidate,
        readOnly: el.dataset.readOnly, cameraFrame: el.dataset.cameraFrame, renderer: el.dataset.renderer,
    })));
    const file = `${name}.png`, bytes = await page.screenshot({ fullPage: true, animations: 'disabled' });
    await fs.writeFile(path.join(out, file), bytes, { flag: 'wx' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, stages, probe: await probeState(page),
        startProbe: await page.evaluate(() => structuredClone(window.__islandStartCompletionProbe ?? null)) });
}
function learningInvariant(state) {
    return { completedSets: state.island.completedSets, customization: state.island.customization,
        pendingPlanId: state.island.pendingPlanId, pendingRewards: state.island.pendingRewards,
        items: state.island.items, memories: state.island.growth.memories, progress: state.island.growth.progress,
        plans: state.islandPlans, logs: state.logs, memoryMath: state.memoryMath, memoryVocab: state.memoryVocab, exploreRuns: state.exploreRuns };
}
async function assertHeld(page) {
    const probe = await probeState(page);
    assert.equal(probe.held, true); assert.equal(probe.released, false); assert.equal(probe.hits, 1);
    assert.equal(await page.locator('.island-page').getAttribute('data-busy'), 'true');
    return probe;
}
async function assertHomeBoundary(page) {
    await waitMode(page, 'home'); await assertHeld(page);
    const compare = page.locator('.island-growth-return'), album = button(page, 'アルバム');
    assert.equal(await compare.isEnabled(), true, 'Milestone comparison remains readable during a background save');
    assert.equal(await album.isEnabled(), true, 'The ordinary album entry remains readable during a background save');
    const blocked = [page.locator('.island-start'), button(page, 'きせかえ'), button(page, 'もちもの'), button(page, 'どうぶつと あそぶ')];
    const controls = [];
    for (const control of blocked) {
        assert.equal(await control.isDisabled(), true, `Interactive action stays locked: ${await control.innerText()}`);
        controls.push({ label: await control.innerText(), disabled: true });
    }
    return controls;
}
async function assertAlbumBoundary(page, comparison) {
    await waitMode(page, 'album'); await assertHeld(page);
    await page.locator('[data-memory-current] [data-renderer="three"]').waitFor();
    assert.equal(await page.locator('.island-album-compare').getAttribute('data-comparison-habitat'), comparison);
    assert.equal(await button(page, 'アルバムを とじる').isEnabled(), true, 'Read-only return remains available while discovery is held');
    const stages = await page.locator('.island-album-compare [data-testid="island-stage"]').evaluateAll(elements => elements.map(el => ({
        theme: el.dataset.islandTheme, accent: el.dataset.islandAccent, readOnly: el.dataset.readOnly,
    })));
    assert.equal(stages.length, 2);
    for (const stage of stages) assert.deepEqual(stage, { theme: 'moon-garden', accent: 'none', readOnly: 'true' });
    return stages;
}
async function finishSection(page, state) {
    const planId = state.plan.id, previous = state.island.completedSets;
    for (let steps = 0; state.plan.id === planId; steps++) {
        assert(steps < 80, 'A normal section must finish');
        state = (await attempt(page, state)).after;
    }
    assert.equal(state.island.completedSets, previous + 1);
    return state;
}

try {
    assert.deepEqual(source.files.filter(file => start.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
    report.version = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).json();
    assert.equal(report.version.revision, source.revision); assert.equal(report.version.island.enabled, true);
    assert.equal(report.version.island.candidate, ISLAND_CANDIDATE);
    const [actions, discoveries, album, islandPage] = await Promise.all(['src/components/island/useIslandActions.ts',
        'src/components/island/useIslandDiscoveries.ts', 'src/components/island/IslandAlbum.tsx', 'src/pages/Island.tsx'].map(file => fs.readFile(file, 'utf8')));
    assert.match(actions, /if\s*\(lock\.current\)\s*return/);
    assert.match(album, /disabled=\{disabled\s*\|\|\s*!item\}/);
    assert.match(islandPage, /<IslandAlbum[\s\S]*?disabled=\{busy\}/);
    // Record the new source boundary without requiring it before the behavioral
    // check: the same script can distinguish the older build as a negative control.
    report.interactionLockSourceBoundary = {
        defaultInteractionKindPresent: /kind:\s*IslandActionKind\s*=\s*'interaction'/.test(actions), synchronousLockRemains: true,
        discoveryQueueExplicitKindPresent: /run\(\(\)\s*=>\s*recordIslandDiscovery\(profileId, id, itemId\),\s*0,\s*'discovery'\)/.test(discoveries),
        albumTryAndPlaceRetainBusyDisabled: true, actionsSHA256: sha(actions), discoveryQueueSHA256: sha(discoveries),
        albumSHA256: sha(album), islandPageSHA256: sha(islandPage) };
    browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone',
            serviceWorkers: 'allow', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [];
        await installDiscoveryCompletionHold(page);
        page.on('pageerror', error => errors.push(error.message));
        const row = { name: layout.name, viewport: layout.viewport, explicitCompletionDelayDiagnostic: true, pass: false, errors };
        report.scenarios.push(row);
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            const empty = await readNative(page);
            assert.equal(empty.islands.length, 0); assert.equal(empty.islandPlans.length, 0); assert.equal(empty.logs.length, 0);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitReady(page); await waitMode(page, 'learning');
            let state = await readNative(page), id = state.island.profileId;
            while (state.island.completedSets < 6) state = await finishSection(page, state);
            assert.equal(state.island.completedSets, 6); assert.equal(state.island.customization.points, 60);
            assert.equal(state.island.growth.discoveries.length, 0, 'No prior island visit or fabricated discovery');
            assert.deepEqual(state.island.growth.memories.map(memory => memory.completedSets), [0, 6]);
            const invariant = learningInvariant(state);
            row.beforeLearningSHA256 = sha(JSON.stringify(invariant));
            await capture(page, `${layout.name}-01-six-real-sections`);
            await page.evaluate(() => window.__armIslandDiscoveryCompletion());
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await page.waitForFunction(() => window.__islandDiscoveryCompletionProbe?.held === true, undefined, { timeout: 60000 });
            const held = await assertHeld(page);
            row.actualDiscovery = held.actualEvent; row.controlsHeld = await assertHomeBoundary(page);
            const committedHeld = await readNative(page, id);
            assert.deepEqual(learningInvariant(committedHeld), invariant);
            assert.equal(committedHeld.islandEvents.filter(event => event.id === held.actualEvent.id).length, 1,
                'The held callback belongs to an already committed real discovery event');
            await capture(page, `${layout.name}-02-background-held-home`);
            // Each action is sent once. A failed first navigation stays a failure.
            await page.locator('.island-growth-return').click();
            row.milestoneAlbum = await assertAlbumBoundary(page, 'all');
            await capture(page, `${layout.name}-03-held-milestone-album`);
            await button(page, 'アルバムを とじる').click(); await assertHomeBoundary(page);
            await button(page, 'アルバム').click();
            row.ordinaryAlbum = await assertAlbumBoundary(page, 'garden');
            await capture(page, `${layout.name}-04-held-ordinary-album`);
            await button(page, 'みつけた くらし').click(); await assertHeld(page);
            row.discoveredActionsWhileHeld = await page.locator('[data-discovery-id] button').evaluateAll(elements => elements.map(el => ({ label: el.textContent.trim(), disabled: el.disabled })));
            assert(row.discoveredActionsWhileHeld.every(control => control.disabled), 'Discovery replay/placement actions retain the interactive lock');
            row.discoveryActionsPresentWhileHeld = row.discoveredActionsWhileHeld.length;
            await button(page, 'アルバムを とじる').click(); await assertHomeBoundary(page);
            assert.deepEqual(learningInvariant(await readNative(page, id)), invariant, 'Read-only navigation cannot change learning or history');
            await capture(page, `${layout.name}-05-held-returned-home`);
            assert.equal(await page.evaluate(() => window.__releaseIslandDiscoveryCompletion()), true);
            await page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
            const released = await probeState(page);
            assert.equal(released.hits, 1); assert.equal(released.released, true); assert.equal(released.held, false);
            state = await readNative(page, id);
            assert.equal(state.islandEvents.filter(event => event.id === held.actualEvent.id).length, 1);
            assert.equal(state.island.growth.discoveries.filter(discovery => discovery.id === held.actualEvent.discoveryId).length, 1);
            assert.deepEqual(learningInvariant(state), invariant); row.afterReleaseLearningSHA256 = sha(JSON.stringify(learningInvariant(state)));
            row.singleDiscoveryReceipt = true; row.starsAfterRelease = state.island.customization.points;
            await capture(page, `${layout.name}-06-released`);
            const beforeResume = await readNative(page, id);
            await installStartCompletionHold(page);
            await page.locator('.island-start').click();
            await page.waitForFunction(() => window.__islandStartCompletionProbe?.held === true);
            await waitMode(page, 'home');
            assert.equal(await page.locator('.island-page').getAttribute('data-busy'), 'true');
            const interactiveControls = [page.locator('.island-growth-return'), button(page, 'アルバム'),
                page.locator('.island-start'), button(page, 'きせかえ'), button(page, 'もちもの'), button(page, 'どうぶつと あそぶ')];
            row.controlsDuringManualStart = [];
            for (const control of interactiveControls) {
                assert.equal(await control.isDisabled(), true, 'An actual learning-resume transaction locks comparison and editing');
                row.controlsDuringManualStart.push({ label: await control.innerText(), disabled: true });
            }
            assert.deepEqual(learningInvariant(await readNative(page, id)), learningInvariant(beforeResume),
                'Resuming the existing reservation cannot replace it or alter learning/history while its callback is held');
            await capture(page, `${layout.name}-07-manual-start-held`);
            assert.equal(await page.evaluate(() => window.__releaseIslandStartCompletion()), true);
            await waitMode(page, 'learning');
            row.startProbe = await page.evaluate(() => structuredClone(window.__islandStartCompletionProbe));
            assert.equal(row.startProbe.hits, 1); assert.equal(row.startProbe.trustedStartClick, true);
            assert.equal(row.startProbe.released, true); assert.equal(row.startProbe.held, false);
            const previous = await readNative(page, id), cursor = previous.plan.cursor, planId = previous.plan.id;
            assert.equal(planId, beforeResume.plan.id);
            assert.deepEqual(learningInvariant(previous), learningInvariant(beforeResume));
            state = previous;
            for (let steps = 0; state.plan.id === planId && state.plan.cursor === cursor; steps++) {
                assert(steps < 20, 'The resumed real question must finish'); state = (await attempt(page, state)).after;
            }
            assert.equal(state.plan.id, planId); assert.equal(state.plan.cursor, cursor + 1);
            assert.equal(state.logs.length, previous.logs.length + 1);
            assert.equal(state.island.completedSets, 6); assert.equal(state.island.customization.points, 60);
            assert.deepEqual(state.island.growth.memories, invariant.memories);
            await capture(page, `${layout.name}-08-real-answer-resumed`);
            row.resumedQuestionCompleted = true; row.probe = await probeState(page);
            assert.deepEqual(errors, []); row.pass = true;
        } catch (error) {
            row.failure = { message: error.message, stack: error.stack }; row.probe = await probeState(page).catch(() => null);
            row.startProbe = await page.evaluate(() => structuredClone(window.__islandStartCompletionProbe ?? null)).catch(() => null);
            await capture(page, `${layout.name}-failure`).catch(captureError => { row.captureError = captureError.message; });
            await fs.writeFile(path.join(out, `${layout.name}-failure-state.json`), JSON.stringify(await readNative(page).catch(() => null), null, 2), { flag: 'wx' });
            throw error;
        } finally {
            // Cleanup only, after preserving any first failure and its held state.
            await page.evaluate(() => window.__releaseIslandDiscoveryCompletion?.()).catch(() => undefined);
            await page.evaluate(() => window.__releaseIslandStartCompletion?.()).catch(() => undefined);
            await context.close();
        }
    }
} catch (error) { report.errors.push({ message: error.message, stack: error.stack }); }
finally {
    if (browser) await browser.close().catch(error => report.errors.push({ message: error.message }));
    report.browserClosed = true;
    try {
        const end = await fingerprint(); report.sourceEnd = sha(JSON.stringify(end)); report.qaEnd = end.filter(file => qa.includes(file.path));
        report.sourceUnchanged = JSON.stringify(start) === JSON.stringify(end);
        assert.equal(report.sourceUnchanged, true, 'App and diagnostic closure changed during the run');
    } catch (error) { report.errors.push({ message: error.message, stack: error.stack }); }
    report.pass = report.errors.length === 0 && report.scenarios.length === 2 && report.scenarios.every(row => row.pass);
    report.completedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(JSON.stringify({ pass: report.pass, report: path.join(out, 'report.json'), scenarios: report.scenarios.map(row => ({ name: row.name, pass: row.pass, failure: row.failure?.message })) }));
if (!report.pass) process.exitCode = 1;
