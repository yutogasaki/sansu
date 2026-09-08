import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertWorkshopDelta, assertSettingsSoundDelta, assertDiscoveryDelta } from './island-qualified-audit.mjs';
import { assertFocusedAcquisition, assertFocusedBellObservation, assertFocusedReservation, assertFocusedBaseline, assertFocusedAnswerIslands, assertNoLearningAmbienceStart, focusedSelection, SHELL_ITEM } from './island-expression-audio-focused-audit.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const frozenHelperFiles = ['tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs',
    'tools/island-learning-fixtures.mjs', 'tools/island-qualified-audit.mjs'];
const overlayFiles = ['tools/e2e-island-expression-audio-focused.mjs', 'tools/island-expression-audio-focused-audit.mjs',
    'tools/expression-audio/audio-probe.mjs', 'tools/expression-audio/audio-analysis.mjs', 'tools/expression-audio/expression-audio-phase.mjs'];
const scenarios = [
    'Fresh isolated DB -> real setup -> first ordinary learning section (normally 3 answers), no state restore or injected qualification.',
    'Real Settings sound OFF -> clean the three required specimens and observe only their identity result -> assemble/place straight, wheel and bell -> real visible flow and native bell receipt.',
    'Unqualified preview and connected-but-not-run negative -> actual zero-star acquire only shell -> owned but unequipped.',
    'Same document: existing audio phase checks native source PCM, gain output, absolute frame correspondence, full ports/gaps/routes, preview/replace, two loop phrases, header OFF/ON, same free OFF, three free sounds and removal.',
    'Headed same-window native hidden, no one-shot replay, active loop retirement/restart, Settings SPA exit/reentry and learning retirement -> same reserved actual answer -> save raw evidence before reload.',
];
const remaining = ['No 150-answer visitor route, butterfly/leaf-bird qualification, other purchases or populated-photo preservation; those remain in qualified QA.',
    'No fault injection/profile race/old-scene/PWA update/blocked learning writer/physical speaker or human listening proof.',
    'No throughput or child motivation claim; human N=0. Missing startup PCM remains unmeasured; prior qualified06/07 FAIL is unchanged.'];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, serverStarted: false, applicationDataInjected: false,
        viewports, scenarios, remaining, requiredEnvironment: ['SANSU_AUDIO_FOCUSED_URL', 'SANSU_AUDIO_FOCUSED_OUTPUT', 'SANSU_AUDIO_FOCUSED_BUILD_SOURCE', 'SANSU_AUDIO_FOCUSED_QA_ROOT', 'SANSU_AUDIO_FOCUSED_HEADED=1'],
        optionalEnvironment: { SANSU_AUDIO_FOCUSED_VIEWPORT: 'phone or tablet; single width is partial' },
        source: { fixedRevision: 'workshop-20260909-0db80c949ca3', app: 'All fixed20 manifest inputs and overlay app copies hash before/after',
            unchangedHelpers: frozenHelperFiles, explicitOverlay: overlayFiles, externalRuntime: 'qa-runtime.json pins Node and complete installed Playwright/core package files; verify before/after' },
        estimatedMinutes: { eachViewport: '3–5, unmeasured estimate; fail-fast at the real failing gate', both: '6–10' },
        passBoundary: 'Selected genuine bell/audio path only; no imported prior-state fixture; no fullSpec41 or physical listening PASS' }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_AUDIO_FOCUSED_URL || '').replace(/\/$/u, ''), out = process.env.SANSU_AUDIO_FOCUSED_OUTPUT;
assert(target && out && process.env.SANSU_AUDIO_FOCUSED_BUILD_SOURCE && process.env.SANSU_AUDIO_FOCUSED_QA_ROOT, 'Frozen URL/manifest/explicit QA overlay/fresh output required');
assert.equal(process.env.SANSU_AUDIO_FOCUSED_HEADED, '1', 'Actual native hidden requires headed mode');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_AUDIO_FOCUSED_BUILD_SOURCE, 'utf8'));
assert.equal(manifest.revision, 'workshop-20260909-0db80c949ca3', 'This focused QA targets immutable fixed20');
assert(manifest.sourceHash && manifest.snapshot && manifest.files?.length);
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_AUDIO_FOCUSED_QA_ROOT), 'Execute the named immutable QA overlay, not live tools');
assert.notEqual(await fs.realpath(sourceRoot), await fs.realpath(manifest.origin), 'Live project source is not an immutable QA overlay');
const { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } = await import(pathToFileURL(path.join(sourceRoot, 'tools/island-e2e-helpers.mjs')).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = [...frozenHelperFiles, ...overlayFiles].map(file => path.join(sourceRoot, file));
const runtimeManifestPath = path.join(sourceRoot, 'qa-runtime.json');
const runtimeManifest = JSON.parse(await fs.readFile(runtimeManifestPath, 'utf8'));
assert(runtimeManifest.files?.length && runtimeManifest.localRuntimeImports?.length, 'Complete QA/runtime closure is required');
assert.equal(runtimeManifest.node.version, process.version);
assert.equal(await fs.realpath(runtimeManifest.node.executable), await fs.realpath(process.execPath));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && manifest.files.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), qa: await hashFiles(qaFiles),
    overlayApp: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))),
    runtime: await hashFiles([runtimeManifestPath, ...runtimeManifest.files.map(file => file.path)]) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.overlayApp.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256, file.sha256, file.relative);
for (const file of runtimeManifest.files) assert.equal(initialSource.runtime.find(entry => entry.path === file.path)?.sha256, file.sha256, `Changed external runtime: ${file.path}`);
for (const relative of frozenHelperFiles) {
    const original = manifest.files.find(file => file.relative === relative); assert(original, relative);
    assert.equal(initialSource.qa.find(file => file.path === path.join(sourceRoot, relative))?.sha256, original.sha256, `Changed shared helper: ${relative}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec41Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, remaining,
    sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify({ qa: initialSource.qa, runtime: initialSource.runtime })), explicitOverlay: overlayFiles,
            runtime: { manifest: runtimeManifestPath, localRuntimeImports: runtimeManifest.localRuntimeImports,
                builtins: runtimeManifest.builtins, node: runtimeManifest.node, packages: runtimeManifest.packages } } },
    initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const panel = page => page.locator('section[aria-label="みじたくと コレクション"]');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const islandFor = (state, owner) => state.islands.find(value => value.profileId === owner);
const savedExpression = island => structuredClone(island.expression ?? { version: 1, ownedItemIds: [], selection: focusedSelection() });
const digestTables = state => Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, { rows: rows.length, sha256: sha(JSON.stringify(rows)) }]));
const expressionCandidate = 'island-expression-v1';
const catalog = [{ id: SHELL_ITEM, slot: 'soundscape', category: 'world', price: 0, requirement: 'bell' }], qualified = catalog;

const idle = page => page.waitForFunction(() => {
    const root = document.querySelector('.island-page');
    return root?.getAttribute('data-busy') === 'false' || root?.getAttribute('data-mode') === 'welcome'
        || root?.hasAttribute('data-onboarding-step') && root.querySelector('.island-setup-sheet')?.getAttribute('aria-busy') === 'false';
});
async function press(page, row, label, scope = page) { await idle(page); await activate(button(scope, label), row.touch); }
async function waitLearningInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const panel = document.querySelector('[data-island-plan-id][data-input-ready="true"]'), answer = document.querySelector('.park-answer');
        return panel && answer && answer.getBoundingClientRect().width > 20
            && (!expected || panel.getAttribute('data-island-plan-id') === expected.id && Number(panel.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(node => !node.disabled && node.getBoundingClientRect().height > 10);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
}
async function waitWorld(page) {
    await waitReady(page); await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        return document.querySelector('.island-page')?.getAttribute('data-mode') !== 'learning' && host?.dataset.renderer === 'three'
            && box?.width > 100 && box?.height > 100 && canvas.width > 1 && host.dataset.cameraFrame?.split(',').length === 32;
    }); await painted(page);
    assert.equal(await stage(page).evaluate(host => host.closest('figure')?.getAttribute('data-expression-candidate')), expressionCandidate,
        'The actual Stage figure must identify the frozen expression candidate');
}

async function tables(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const entries = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const read = tx.objectStore(name).getAll(); read.onsuccess = () => resolve([name, read.result]); read.onerror = () => reject(read.error);
            })));
            await done;
            const canonical = async value => {
                if (value instanceof Blob) return { mime: value.type, bytes: value.size,
                    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('') };
                if (value instanceof Date) return { nativeDate: value.toISOString() };
                if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
                    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                    return { nativeBinary: value.constructor.name, bytes: [...bytes] };
                }
                if (Array.isArray(value)) return Promise.all(value.map(canonical));
                if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await canonical(item)])));
                return value;
            };
            return Object.fromEntries(await Promise.all(entries.map(async ([name, rows]) => [name, await canonical(rows)])));
        } finally { db.close(); }
    });
}

async function checkDB(page, row, name, before, action, liveHome = false, surface = 'island') {
    assertFocusedBaseline(row.baseline, before, row.owner, row.expectedPlan);
    if (surface === 'settings') {
        assert.equal(new URL(page.url()).hash.startsWith('#/settings'), true);
        await page.locator('[data-setting-section="display"]').waitFor();
        assert.equal(await page.locator('.island-page').count(), 0, 'Settings ready is a separate mounted surface');
    } else { assert.equal(surface, 'island'); await idle(page); }
    const after = await tables(page), changedStores = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const file = `${row.name}-db-${String(row.databaseChecks.length + 1).padStart(3, '0')}-${name}.json`;
    const entry = { name, file, action: action ?? null, before: digestTables(before), after: digestTables(after), changedStores, pass: false };
    row.databaseChecks.push(entry);
    try {
        if (liveHome) {
            assert.equal(action, undefined); entry.liveHomeDiscoveries = assertDiscoveryDelta(before, after, row.owner);
            const audit = await page.evaluate(() => window.__qualifiedObservations);
            for (const discovery of entry.liveHomeDiscoveries) {
                const committed = audit.commits.find(value => value.event.type === 'discovery_observed' && value.event.profileId === row.owner && value.event.discoveryId === discovery.id);
                assert(committed && audit.frames.some(frame => !frame.hidden && frame.at <= committed.at && frame.activity.discoveryId === discovery.id
                    && frame.mode === 'home' && frame.activity.itemId === discovery.itemId && frame.activity.natureReady && frame.activity.natureVisible), 'Home discovery needs actual visible/native evidence');
            }
        }
        else if (action) { assert.deepEqual(action, { type: 'acquire', itemId: SHELL_ITEM }); assertFocusedAcquisition(before, after, row.owner); }
        else assert.deepEqual(after, before, 'Optional read/preview/navigation preserves every native table');
        assertFocusedReservation(after, row.owner, row.expectedPlan); row.baseline = after; entry.pass = true;
    }
    finally { await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...entry, revision: manifest.revision, sourceHash: manifest.sourceHash,
        changes: Object.fromEntries(changedStores.map(key => [key, { before: before[key], after: after[key] }])) }, null, 2)); }
    return after;
}
async function checkpoint(page, row, label, liveHome = false, surface = 'island') {
    return checkDB(page, row, label, row.baseline, undefined, liveHome, surface);
}
async function scene(page) {
    return stage(page).evaluate(host => {
        const read = key => { const value = host.getAttribute(key); return value ? JSON.parse(value) : null; };
        return { expressionCandidate: host.closest('figure')?.getAttribute('data-expression-candidate') ?? null,
            expression: read('data-island-expression'), environment: read('data-island-expression-environment'), flag: read('data-island-expression-flag'), flagFocus: read('data-island-expression-flag-focus'),
            activity: read('data-living-activity'), workshop: read('data-workshop'), appearance: read('data-island-appearance'), residents: read('data-resident-states'), furniture: read('data-furniture-state'),
            camera: host.dataset.cameraFrame, frameTimestamp: Number(host.dataset.frameTimestamp),
            hidden: document.hidden, mode: document.querySelector('.island-page')?.dataset.mode };
    });
}
async function waitScene(page, predicate, label, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await scene(page); if (predicate(value)) return value; await pause(40); }
    throw new Error(`Actual renderer did not reach ${label}: ${JSON.stringify(await scene(page))}`);
}

async function enterExpression(page, row) {
    await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
    await activate(page.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression'); await waitWorld(page);
}
async function closeExpression(page, row) {
    await press(page, row, 'みじたくを とじる', panel(page)); await waitMode(page, 'experience');
    await press(page, row, 'しまへ もどる', page.getByTestId('island-experience')); await waitMode(page, 'home'); await waitWorld(page);
}
async function selectItem(page, row, item, residentId = 'otter') {
    const tabs = { friends: 'なかま', world: 'けしきと おと', memories: 'おもいで' };
    await press(page, row, tabs[item.category], panel(page));
    await activate(panel(page).locator(`[data-expression-choice="${item.id}"]`), row.touch);
    if (item.category === 'friends') await activate(panel(page).locator(`[data-expression-resident-choice="${residentId}"]`), row.touch);
    await page.waitForFunction(({ itemId, residentId, friends }) => {
        const panel = document.querySelector('.island-expression');
        return panel?.getAttribute('data-expression-item') === itemId && (!friends || panel.getAttribute('data-expression-resident') === residentId);
    }, { itemId: item.id, residentId, friends: item.category === 'friends' });
    await page.waitForFunction(() => document.querySelector('.island-stage__caption')?.hidden === true);
    const expectedAria = item.slot === 'flag-trim' ? 'しまの はたと かざり' : 'なかまの みじたくと しまの けしき';
    await page.waitForFunction(expected => document.querySelector('[data-testid="island-stage"]')?.getAttribute('aria-label') === expected, expectedAria);
    assert.equal(await stage(page).getAttribute('aria-label'), expectedAria, 'A newly chosen trial must reflect its current inspection context');
}

async function earn(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, row, 'まなぶ'); await page.locator('.island-setup-name input').fill(`おと${row.name}`);
    await press(page, row, '年中'); await press(page, row, 'さんすう');
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page), answers = 0; row.owner = native.plan.profileId;
    while (native.island.completedSets < 1 || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers <= 12, 'First ordinary section exceeded the focused answer budget');
    }
    row.answerCount = answers; const receipts = native.islandEvents.filter(event => event.type === 'answer'); assert.equal(receipts.length, answers);
    row.earned = { fixture: false, answers, answerReceiptIds: receipts.map(event => event.id), points: native.island.customization.points,
        completedSets: native.island.completedSets, reservedPlan: structuredClone(native.plan) };
    row.expectedPlan = structuredClone(native.plan); row.baseline = await tables(page);
    assertFocusedReservation(row.baseline, row.owner, row.earned.reservedPlan);
    await fs.writeFile(`${out}/${row.name}-initial-earned-baseline.json`, JSON.stringify(row.baseline, null, 2));
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
    await checkpoint(page, row, 'first-home-return', true);
}

function installNativeFocusDriver() {
    const require = createRequire(import.meta.url);
    const { CRSession } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/crConnection.js'));
    const original = CRSession.prototype.send;
    const audit = { command: 'Emulation.setFocusEmulationEnabled', dependencyFilesModified: false, appVisibilityPropertyModified: false,
        commands: [], windowCommands: [], restored: false };
    report.driverFocus = audit;
    // A separate CDP session's false does not undo Playwright's own true.
    // Record every matching command, including unchanged false requests.
    CRSession.prototype.send = function (method, params) {
        const replacement = method === audit.command && params?.enabled === true ? { ...params, enabled: false } : params;
        if (method === audit.command) audit.commands.push({ sessionId: this._sessionId, at: new Date().toISOString(),
            method, original: structuredClone(params), sent: structuredClone(replacement), replaced: replacement !== params });
        return original.call(this, method, replacement);
    };
    return () => { CRSession.prototype.send = original; audit.restored = CRSession.prototype.send === original; };
}
async function audioWindow(context, page) {
    const session = await context.newCDPSession(page);
    const command = async (method, params) => {
        const record = { method, params: params ?? null, at: new Date().toISOString() }; report.driverFocus.windowCommands.push(record);
        const result = await session.send(method, params); record.result = result; return result;
    };
    try {
        const { targetInfo } = await command('Target.getTargetInfo');
        const { windowId } = await command('Browser.getWindowForTarget', { targetId: targetInfo.targetId });
        return { windowId, targetId: targetInfo.targetId };
    } finally { await session.detach(); }
}
async function adoptAudioDBChain(page, row, phase, label) {
    let previous = row.baseline;
    const entries = phase.report.db.slice(row.audioDBCursor ?? 0);
    for (const entry of entries) {
        assert(entry.exact, 'Audio module must pass its own exact oracle');
        const pair = JSON.parse(await fs.readFile(path.join(out, 'audio', row.name, entry.file), 'utf8'));
        assertFocusedBaseline(previous, pair.before, row.owner, row.expectedPlan);
        assertFocusedReservation(pair.after, row.owner, row.expectedPlan); previous = pair.after;
    }
    const current = await tables(page);
    await fs.writeFile(`${out}/${row.name}-${label}-module-chain.json`, JSON.stringify({ initial: row.baseline, pairs: entries,
        expectedCurrent: previous, actualCurrent: current }, null, 2));
    assertFocusedBaseline(previous, current, row.owner, row.expectedPlan);
    row.baseline = current; row.audioDBCursor = phase.report.db.length;
}
async function qualifiedAudio(context, page, row, createPhase) {
    await checkpoint(page, row, 'audio-entry');
    assertFocusedReservation(row.baseline, row.owner, row.earned.reservedPlan);
    const phase = await createPhase({ page, owner: row.owner, name: row.name, touch: row.touch, output: `${out}/audio/${row.name}`,
        provenance: { revision: manifest.revision, sourceHash: manifest.sourceHash, qaClosureHash: report.sources.qa.closureHash }, tables });
    row.audio = phase.report;
    const originalDocument = await page.evaluate(() => performance.timeOrigin), reserved = structuredClone(row.earned.reservedPlan);
    let background;
    try {
        await phase.runMain(); await adoptAudioDBChain(page, row, phase, 'audio-main');
        const main = await audioWindow(context, page); background = await context.newPage();
        const other = await audioWindow(context, background);
        row.audioCaller = { pass: false, originalDocument, sameWindow: { main, other }, reentry: null };
        assert.equal(other.windowId, main.windowId, 'The audio boundary requires genuine tabs in the same headed window');
        assert.notEqual(other.targetId, main.targetId); await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
        await phase.runHidden({ headed: true, hide: async () => { await background.bringToFront(); },
            restore: async () => { await page.bringToFront(); } });
        await adoptAudioDBChain(page, row, phase, 'audio-hidden');
        await background.close(); background = undefined;
        await phase.runExit({ leave: async () => {
            await activate(page.locator('.island-header').getByRole('button', { name: 'せってい', exact: true }), row.touch);
            await page.waitForURL(url => url.hash.startsWith('#/settings'));
            await page.locator('.island-page').waitFor({ state: 'detached' });
        } });
        await adoptAudioDBChain(page, row, phase, 'audio-exit');
        assert.equal(await page.evaluate(() => performance.timeOrigin), originalDocument, 'Settings exit must retain the original probe document');
        const beforeReturn = row.baseline;
        const returnControl = page.getByRole('navigation', { name: 'メインメニュー', exact: true }).getByRole('button', { name: 'しま', exact: true });
        assert.equal(await returnControl.count(), 1); await activate(returnControl, row.touch);
        await waitLearningInput(page, reserved); assert.deepEqual((await readNative(page, row.owner)).plan, reserved);
        await checkDB(page, row, 'audio-SPA-reentry-same-reservation', beforeReturn);
        await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterExpression(page, row);
        // Home can legitimately observe nature. Audit those exact receipts here,
        // outside the module's deliberately strict sound-only DB comparisons.
        const reentered = await checkDB(page, row, 'audio-reentry-home-discoveries', beforeReturn, undefined, true);
        assert.deepEqual((await readNative(page, row.owner)).plan, reserved);
        assert.equal(await page.evaluate(() => performance.timeOrigin), originalDocument, 'SPA reentry must retain the original probe document');
        row.audioCaller.reentry = { originalDocumentRetained: true, samePlanId: reserved.id, samePlanRevision: reserved.revision,
            before: digestTables(beforeReturn), after: digestTables(reentered), exactDiscoveryAudit: true };
        const beforeLearning = await checkpoint(page, row, 'before-audio-learning');
        row.learningAudioBefore = await page.evaluate(() => ({ at: performance.now(), probe: window.__expressionAudioProbe.snapshot() }));
        await fs.writeFile(`${out}/${row.name}-before-learning-audio.json`, JSON.stringify(row.learningAudioBefore, null, 2));
        const plan = await phase.runLearning();
        row.learningAudioAfterInput = await page.evaluate(() => ({ at: performance.now(), probe: window.__expressionAudioProbe.snapshot() }));
        await fs.writeFile(`${out}/${row.name}-after-learning-input-audio.json`, JSON.stringify(row.learningAudioAfterInput, null, 2));
        assertNoLearningAmbienceStart(row.learningAudioBefore, row.learningAudioAfterInput);
        assert.deepEqual(plan, reserved); await waitLearningInput(page, plan);
        await adoptAudioDBChain(page, row, phase, 'audio-learning');
        await checkDB(page, row, 'audio-learning-all-stores-before-answer', beforeLearning);
        // Persist raw PCM/events while the original document still exists.
        // Reload below intentionally creates a new probe; never overwrite these.
        await phase.save();
        await answerAndReload(page, row, { plan, before: beforeLearning, saved: savedExpression(islandFor(beforeLearning, row.owner)).selection });
        row.audioCaller.pass = true; row.audioCaller.actualAnswerAndReload = row.learning;
        row.coverage.actualAudio = 'pass-selected-digital-source-output-native-hidden-SPA-exit-learning; physical-speaker-and-human-unverified';
    } catch (error) {
        row.audioCaller ??= { pass: false, originalDocument };
        row.audioCaller.failure = error.stack;
        // Module failures retain their own raw checkpoint. Caller-only failures
        // (for example, a real reentry locator) need the same before-reload save.
        if (await page.evaluate(() => performance.timeOrigin).catch(() => null) === originalDocument) {
            try { await phase.save(); } catch (saveError) { row.audioCaller.saveFailure = saveError.stack; }
        }
        throw error;
    } finally { if (background) await background.close(); }
}



const workshopPanel = page => page.locator('.island-workshop');
const hasDiscovery = (island, id) => Boolean(island.growth?.discoveries.some(entry => entry.id === id));
const hasBell = island => Boolean(island.workshop?.creations.some(entry => entry.partId === 'bell'));
const eligible = (island, item) => item.requirement === 'bell' ? hasBell(island) : hasDiscovery(island, item.requirement);
async function waitIsland(page, row, predicate, label, timeout = 25000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await readNative(page, row.owner); if (predicate(value.island)) { await idle(page); return value; } await pause(40); }
    throw new Error(`Native island did not reach ${label}`);
}
async function negativeQualifications(page, row, ids, label) {
    await enterExpression(page, row); await checkpoint(page, row, `${label}-entry`, true);
    for (const item of qualified.filter(item => ids.includes(item.id))) {
        const before = await checkpoint(page, row, `${label}-before-preview`), island = islandFor(before, row.owner);
        assert.equal(eligible(island, item), false, `${label}: prior observation unexpectedly exists`);
        assert.equal(savedExpression(island).ownedItemIds.includes(item.id), false);
        await selectItem(page, row, item);
        assert(await panel(page).locator('[data-expression-action="acquire"]').isDisabled());
        await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch); await painted(page);
        assert(await panel(page).locator('[data-expression-action="acquire"]').isDisabled(), 'A free preview is not qualification');
        await capture(page, row, `${label}-${item.id}-unqualified-preview`);
        await press(page, row, 'いまに もどす', panel(page));
        await checkDB(page, row, `${label}-${item.id}-preview-cancel`, before);
        row.negative.push({ label, itemId: item.id, pass: true });
    }
    await closeExpression(page, row);
}

async function beginObservationProbe(page, kind, id) {
    await stage(page).evaluate((host, { kind, id }) => {
        window.__qualifiedProbe?.observer?.disconnect();
        const probe = window.__qualifiedProbe = { kind, id, frames: [], images: [], keys: [], gesture: null };
        const sample = () => {
            if (!probe.gesture || probe.frames.length >= 1024) return;
            const activity = JSON.parse(host.dataset.livingActivity || 'null'), workshop = JSON.parse(host.dataset.workshop || 'null');
            const frame = { timestamp: Number(host.dataset.frameTimestamp), capturedAt: performance.now(), hidden: document.hidden, activity, workshop };
            const key = kind === 'visitor' ? `${activity?.discoveryId}:${activity?.natureVisible}:${activity?.natureReady}`
                : `${workshop?.phase}:${workshop?.run?.beat}:${workshop?.run?.index}:${workshop?.run?.complete}`;
            probe.frames.push(frame);
            if (!probe.keys.includes(key) && probe.images.length < 32 && !frame.hidden) {
                probe.keys.push(key); probe.images.push({ ...frame, png: host.querySelector('canvas').toDataURL('image/png') });
            }
        };
        probe.observer = new MutationObserver(sample); probe.observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
    }, { kind, id });
}
async function trustedObservationGesture(locator, row) {
    await locator.evaluate(node => node.addEventListener('click', event => {
        window.__qualifiedProbe.gesture = { trusted: event.isTrusted, hidden: document.hidden, at: performance.now() };
    }, { once: true, capture: true }));
    await activate(locator, row.touch);
}
async function endObservationProbe(page, row, name) {
    const data = await page.evaluate(() => { const probe = window.__qualifiedProbe; probe?.observer?.disconnect();
        return probe ? { kind: probe.kind, id: probe.id, gesture: probe.gesture, frames: probe.frames, images: probe.images } : null; });
    if (!data) return null;
    const images = [];
    for (const [index, image] of data.images.entries()) {
        const { png, ...frame } = image, bytes = Buffer.from(png.split(',')[1], 'base64'), file = `${row.name}-${name}-${index}.png`;
        await fs.writeFile(`${out}/${file}`, bytes); images.push({ file, sha256: sha(bytes), ...frame });
    }
    const trace = { ...data, images, name, revision: manifest.revision, sourceHash: manifest.sourceHash };
    await fs.writeFile(`${out}/${row.name}-${name}-frames.json`, JSON.stringify(trace, null, 2)); row.traces.push(trace);
    return trace;
}
/** Capture actual ready frames continuously, including spontaneous home visits.
 * Native write methods keep their arguments/return values; listeners only record completed transactions. */
async function installObservationAudit(context) {
    await context.addInitScript(() => {
        const audit = window.__qualifiedObservations = { frames: [], commits: [], errors: [] };
        const latest = new Map(), transactions = new WeakMap(), frameKeys = new Set();
        const sample = () => {
            const host = document.querySelector('[data-testid="island-stage"]');
            if (!host || document.hidden) return;
            const activity = JSON.parse(host.dataset.livingActivity || 'null');
            if (!activity?.discoveryId || !activity.natureVisible || !activity.natureReady) return;
            const mode = document.querySelector('.island-page')?.dataset.mode;
            const key = `${activity.discoveryId}:${activity.itemId}:${mode}`;
            if (frameKeys.has(key)) return;
            const canvas = host.querySelector('canvas'), rect = canvas?.getBoundingClientRect();
            if (!rect || rect.width < 100 || rect.height < 100 || rect.bottom <= 0 || rect.top >= innerHeight
                || rect.right <= 0 || rect.left >= innerWidth) return;
            frameKeys.add(key);
            try { audit.frames.push({ at: performance.now(), timestamp: Number(host.dataset.frameTimestamp), mode,
                hidden: document.hidden, activity,
                observationFrame: JSON.parse(host.dataset.observationFrame || 'null'),
                cameraFrame: host.dataset.cameraFrame,
                playRequestId: host.dataset.playRequestId, playStatus: host.dataset.playStatus,
                viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
                canvas: { width: canvas.width, height: canvas.height, rect: rect.toJSON() },
                png: canvas.toDataURL('image/png') }); }
            catch (error) { audit.errors.push(String(error)); }
        };
        const observer = new MutationObserver(sample);
        observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-frame-timestamp'] });
        for (const method of ['put', 'add', 'delete', 'clear']) {
            const original = IDBObjectStore.prototype[method];
            IDBObjectStore.prototype[method] = function (...args) {
                const result = Reflect.apply(original, this, args);
                if (this.transaction.db.name !== 'SansuDatabase') return result;
                let pending = transactions.get(this.transaction);
                if (!pending) {
                    pending = []; transactions.set(this.transaction, pending);
                    this.transaction.addEventListener('complete', () => {
                        const events = pending.filter(value => value.store === 'islandEvents' && (value.value?.type === 'discovery_observed'
                            || value.value?.type === 'workshop_changed' && value.value.action?.type === 'observe-creation'));
                        for (const event of events) {
                            const owner = event.value.profileId;
                            audit.commits.push({ at: performance.now(), mode: document.querySelector('.island-page')?.dataset.mode,
                                event: event.value, before: latest.get(owner), operations: pending });
                        }
                        for (const value of pending) if (value.store === 'islands' && value.value?.profileId) latest.set(value.value.profileId, value.value);
                    });
                }
                pending.push({ store: this.name, method, value: structuredClone(args[0]) });
                return result;
            };
        }
    });
}

async function saveSettingsCheck(page, row, before, after, enabled) {
    const file = `${row.name}-settings-${enabled ? 'on' : 'off'}-db.json`;
    await fs.writeFile(`${out}/${file}`, JSON.stringify({ before, after, enabled }, null, 2));
    assertFocusedBaseline(row.baseline, before, row.owner, row.expectedPlan);
    assertSettingsSoundDelta(before, after, row.owner, enabled);
    assertFocusedReservation(after, row.owner, row.expectedPlan); row.baseline = after;
}
async function disableSoundThroughSettings(page, row) {
    const initialDocument = await page.evaluate(() => performance.timeOrigin);
    await activate(page.locator('.island-header').getByRole('button', { name: 'せってい', exact: true }), row.touch);
    await page.waitForURL(url => url.hash.startsWith('#/settings'));
    const display = page.locator('[data-setting-section="display"]'); await display.waitFor();
    if (await display.getAttribute('aria-expanded') !== 'true') await activate(display, row.touch);
    const setting = page.getByText(/^(おと・BGM|サウンド)$/).locator('..').locator('..');
    const control = setting.getByRole('button', { name: /^(ON|OFF)$/ }); assert.equal(await control.count(), 1);
    let before = await checkpoint(page, row, 'settings-entry', true, 'settings');
    const profile = before.profiles.find(profile => profile.id === row.owner); assert(profile);
    // Persist a real off action even when the profile began off; no DB edits.
    if (!profile.soundEnabled) { await activate(control, row.touch); await page.waitForFunction(async owner => {
        const req = indexedDB.open('SansuDatabase'); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
        try { return await new Promise(resolve => { const r = db.transaction('profiles').objectStore('profiles').get(owner); r.onsuccess = () => resolve(r.result?.soundEnabled === true); }); }
        finally { db.close(); }
    }, row.owner); await saveSettingsCheck(page, row, before, await tables(page), true); before = row.baseline; }
    await control.filter({ hasText: /^ON$/ }).waitFor(); await activate(control, row.touch);
    const deadline = Date.now() + 15000; let after;
    while (Date.now() < deadline) { after = await tables(page); if (after.profiles.find(profile => profile.id === row.owner)?.soundEnabled === false) break; await pause(40); }
    assert.equal(after.profiles.find(profile => profile.id === row.owner).soundEnabled, false);
    await saveSettingsCheck(page, row, before, after, false);
    row.sound = { method: 'actual Settings display/sound ON→OFF button', persistedOff: true, acousticOutput: 'UNVERIFIED', before: digestTables(before), after: digestTables(after) };
    await activate(page.getByRole('navigation', { name: 'メインメニュー', exact: true }).getByRole('button', { name: 'しま', exact: true }), row.touch);
    const native = await readNative(page, row.owner); await waitLearningInput(page, native.plan);
    assert.equal(await page.evaluate(() => performance.timeOrigin), initialDocument, 'Settings must not reset the native probe');
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
    await checkpoint(page, row, 'settings-home-return', true);
}
async function waitWorkshop(page, row, predicate, label) { return waitIsland(page, row, island => predicate(island.workshop), label); }
async function workshopChange(page, row, name, expectedActions, action, condition) {
    const before = await checkpoint(page, row, `${name}-before`); row.pendingWorkshop = { name, before, expectedActions }; await action(); await waitWorkshop(page, row, condition, name); const after = await tables(page);
    const current = islandFor(after, row.owner);
    const entry = { name, expectedActions, before: digestTables(before), after: digestTables(after), pass: false };
    row.workshopChanges.push(entry);
    try { entry.events = assertWorkshopDelta(before, after, row.owner, expectedActions);
        assertFocusedReservation(after, row.owner, row.expectedPlan); row.baseline = after; entry.pass = true; }
    finally { await fs.writeFile(`${out}/${row.name}-${name}-DB.json`, JSON.stringify({ ...entry, changes: { before, after } }, null, 2)); }
    delete row.pendingWorkshop; return current;
}
async function openDetails(page, row, text) { const summary = workshopPanel(page).locator('summary').filter({ hasText: text });
    if (!(await summary.evaluate(node => node.parentElement.open))) await activate(summary, row.touch); }
async function bellQualification(page, row) {
    await press(page, row, 'おためしの いりえ'); await waitMode(page, 'workshop'); await waitWorld(page);
    await checkpoint(page, row, 'workshop-entry', true);
    assert.equal(hasBell((await readNative(page, row.owner)).island), false);
    for (const id of ['driftwood', 'seaglass', 'striped-shell']) {
        await activate(workshopPanel(page).locator(`[data-specimen-id="${id}"]`), row.touch);
        await press(page, row, 'ブラシへ おく', workshopPanel(page));
        for (let section = 0; section < 6; section++) await workshopChange(page, row, `brush-${id}-${section}`, [{ type: 'brush', specimenId: id, section }, ...(section === 5 ? [{ type: 'observe-specimen', specimenId: id, result: 'clean', cleanedMask: 63 }] : [])],
            () => activate(workshopPanel(page).locator(`[data-brush-section="${section}"]`), row.touch),
            state => Boolean(state?.specimens[id].cleanedMask & (1 << section)) && (section !== 5 || state.specimens[id].observations.some(entry => entry.result === 'clean')));
        for (const [label, result] of (id === 'driftwood' ? [['みずへ おく', 'float']] : [['ひかりへ おく', id === 'seaglass' ? 'transmit' : 'opaque']])) {
            await workshopChange(page, row, `observe-${id}-${result}`, [{ type: 'observe-specimen', specimenId: id, result, cleanedMask: 63 }], () => press(page, row, label, workshopPanel(page)),
                state => state?.specimens[id].observations.some(entry => entry.result === result));
        }
        await capture(page, row, `${id}-actual-observed`);
    }
    await press(page, row, 'つくる', workshopPanel(page));
    for (const [id, material] of [['straight', 'ながれぎ'], ['wheel', 'いろガラス'], ['bell', 'しまもようの かい']]) {
        await activate(workshopPanel(page).locator(`[data-part-id="${id}"]`), row.touch);
        await workshopChange(page, row, `assemble-${id}`, [{ type: 'edit-draft', edit: { type: 'assemble', partId: id } }], () => press(page, row, `${material}を はめる`, workshopPanel(page)),
            state => state?.draftCheckpoint.draft.layout.parts[id].assembled);
    }
    assert.equal(hasBell((await readNative(page, row.owner)).island), false);
    for (const [col, id] of ['straight', 'wheel', 'bell'].entries()) {
        await activate(workshopPanel(page).locator(`[data-part-id="${id}"]`), row.touch); await openDetails(page, row, 'タップで おく');
        await workshopChange(page, row, `place-${id}`, [{ type: 'edit-draft', edit: { type: 'move', partId: id, position: { col, row: 1 } } }], () => activate(workshopPanel(page).locator(`[data-workshop-cell="${col},1"]`), row.touch),
            state => state?.draftCheckpoint.draft.layout.parts[id].position?.col === col && state.draftCheckpoint.draft.layout.parts[id].position?.row === 1);
    }
    await press(page, row, 'しまへ', workshopPanel(page)); await waitMode(page, 'home');
    await checkpoint(page, row, 'connected-workshop-home-return', true);
    await negativeQualifications(page, row, ['shell-three-notes'], 'connected-bell-before-rendered-flow');
    await press(page, row, 'おためしの いりえ'); await waitMode(page, 'workshop'); await press(page, row, 'つくる', workshopPanel(page));
    const native = await checkpoint(page, row, 'connected-workshop-reentry', true); assert.equal(native.profiles.find(profile => profile.id === row.owner).soundEnabled, false);
    await beginObservationProbe(page, 'workshop', 'bell');
    const layoutKey = JSON.stringify(islandFor(native, row.owner).workshop.draftCheckpoint.draft.layout);
    await workshopChange(page, row, 'real-flow-reached-bell-sound-off', ['wheel', 'bell'].map(partId => ({ type: 'observe-creation', partId, layoutKey })),
        () => trustedObservationGesture(button(workshopPanel(page), 'みずを ながす'), row), state => state?.creations.some(entry => entry.partId === 'bell'));
    await waitScene(page, state => state.workshop?.run?.complete && ['straight', 'wheel', 'bell'].every(id => state.workshop.run.reached.includes(id)), 'complete real flow');
    const trace = await endObservationProbe(page, row, 'bell-sound-off');
    assert(trace.gesture.trusted && !trace.gesture.hidden);
    const audit = await page.evaluate(() => window.__qualifiedObservations);
    await fs.writeFile(`${out}/${row.name}-bell-observation-audit.json`, JSON.stringify(audit, null, 2));
    row.bellObservation = assertFocusedBellObservation(trace, audit, row.owner, layoutKey);
    await capture(page, row, 'bell-qualified-sound-off');
    await press(page, row, 'しまへ', workshopPanel(page)); await waitMode(page, 'home');
    await checkpoint(page, row, 'qualified-workshop-home-return', true);
}

async function capture(page, row, name, extra = {}) {
    const mode = await page.locator('.island-page').getAttribute('data-mode'), learning = mode === 'learning';
    if (learning) await waitLearningInput(page); else await waitWorld(page);
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'input' : 'world'}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true });
    const frame = await (learning ? page.locator('.island-workbench') : stage(page)).screenshot({ path: `${out}/${frameFile}` });
    report.captures.push({ name, file, frameFile, sha256: sha(bytes), frameSha256: sha(frame), ...metadata, ...extra });
}
async function acquireShell(page, row) {
    await enterExpression(page, row); await selectItem(page, row, catalog[0]);
    const before = await checkpoint(page, row, 'qualified-shell-entry', true), old = islandFor(before, row.owner);
    assert(hasBell(old)); assert.equal(old.expression?.ownedItemIds.includes(SHELL_ITEM) ?? false, false);
    assert(await panel(page).locator('[data-expression-action="acquire"]').isEnabled());
    await activate(panel(page).locator('[data-expression-action="acquire"]'), row.touch);
    await waitIsland(page, row, island => island.revision === old.revision + 1 && island.expression?.ownedItemIds.includes(SHELL_ITEM), 'explicit shell acquisition');
    const after = await checkDB(page, row, 'acquire-only-shell-zero-stars', before, { type: 'acquire', itemId: SHELL_ITEM });
    assert.deepEqual(islandFor(after, row.owner).expression.selection, savedExpression(old).selection);
    await panel(page).locator('[data-expression-action="equip"]').waitFor();
    await capture(page, row, 'owned-not-equipped');
    row.acquisition = { itemId: SHELL_ITEM, price: 0, autoEquip: false, fixture: false, before: digestTables(before), after: digestTables(after) };
}
async function answerAndReload(page, row, { plan, before, saved }) {
    await waitLearningInput(page, plan); assert.deepEqual((await readNative(page, row.owner)).plan, plan);
    assert.equal(plan.cursor, 0, 'Focused entry preserves the first question of the next ordinary section');
    assert(plan.slots.length > 1, 'The resumed answer must not complete another section');
    const answer = await answerUI(page, plan, { touch: row.touch, dev: false }), afterAnswer = await tables(page);
    await fs.writeFile(`${out}/${row.name}-actual-answer-db.json`, JSON.stringify({ before, after: afterAnswer }, null, 2));
    assert.equal(answer.state.plan.id, plan.id); assert.equal(answer.state.plan.revision, plan.revision + 1);
    assertFocusedAnswerIslands(before, afterAnswer);
    for (const name of Object.keys(before)) if (!['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'profiles', 'appData'].includes(name)) {
        assert.deepEqual(afterAnswer[name], before[name], `One learning answer must preserve ${name}`);
    }
    const afterAnswerAudio = await page.evaluate(() => ({ at: performance.now(), probe: window.__expressionAudioProbe.snapshot(true) }));
    await fs.writeFile(`${out}/${row.name}-after-answer-audio-raw.json`, JSON.stringify(afterAnswerAudio, null, 2));
    assert.deepEqual(afterAnswerAudio.probe.errors, []);
    assertNoLearningAmbienceStart(row.learningAudioBefore, afterAnswerAudio);
    assertNoLearningAmbienceStart(row.learningAudioAfterInput, afterAnswerAudio);
    row.learning = { sameReservedPlan: plan.id, fromRevision: plan.revision, answeredRevision: answer.state.plan.revision, fixture: false,
        actualAnswerCueAudibility: 'UNVERIFIED; island source retirement is checked independently' };
    // Original native audio evidence is now saved; never overwrite it with the reloaded probe.
    row.expectedPlan = structuredClone(answer.state.plan); row.baseline = afterAnswer;
    await page.reload(); await waitLearningInput(page, answer.state.plan);
    assert.deepEqual((await readNative(page, row.owner)).plan, answer.state.plan);
    await checkDB(page, row, 'reload-all-stores', afterAnswer);
    assert.deepEqual(islandFor(await tables(page), row.owner).expression.selection, saved);
    await capture(page, row, 'same-reservation-reloaded');
}

const { chromium } = await import('playwright');
const { installExpressionAudioProbe } = await import('./expression-audio/audio-probe.mjs');
const { createExpressionAudioPhase, persistAudioEvidence } = await import('./expression-audio/expression-audio-phase.mjs');
let browser, restoreFocusDriver;
try {
    restoreFocusDriver = installNativeFocusDriver();
    browser = await chromium.launch({ headless: false });
    report.browser = { version: browser.version(), headed: true };
    const selected = viewports.filter(row => !process.env.SANSU_AUDIO_FOCUSED_VIEWPORT || row.name === process.env.SANSU_AUDIO_FOCUSED_VIEWPORT);
    assert(selected.length, 'Unknown viewport');
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion,
            serviceWorkers: 'allow', acceptDownloads: true });
        await installObservationAudit(context); await installExpressionAudioProbe(context);
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(25000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], traces: [], negative: [], workshopChanges: [], coverage: {},
            dataOrigin: 'Fresh empty context; real setup, real ordinary answers, real observations and zero-star UI acquisition; no restored or synthesized state' };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row); await capture(page, row, 'first-real-section');
            await disableSoundThroughSettings(page, row);
            await negativeQualifications(page, row, [SHELL_ITEM], 'before-real-bell');
            await bellQualification(page, row);
            await acquireShell(page, row);
            await qualifiedAudio(context, page, row, createExpressionAudioPhase);
            assert(row.bellObservation?.pass && row.acquisition && row.audioCaller.pass && row.learning);
            assert.deepEqual(row.errors, []); row.pass = true;
            row.coverage.selectedGenuineBellAndAudio = 'PASS';
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
        } catch (error) {
            row.failure = error.stack; process.exitCode = 1;
            const failureOutput = path.join(out, `failure-${row.name}`); await fs.mkdir(failureOutput);
            await persistAudioEvidence({ output: failureOutput, name: row.name, report: { status: 'failed', failure: row.failure, evidence: [] },
                readProbe: () => page.evaluate(() => window.__expressionAudioProbe?.snapshot(true)), readTables: () => tables(page), label: 'runner-failure' });
            await endObservationProbe(page, row, 'failure').catch(error => { row.observationCollectionFailure = String(error); });
            await page.screenshot({ path: `${out}/${row.name}-failure.png`, fullPage: true }).catch(error => { row.screenshotFailure = String(error); });
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            try { await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); }
            finally { await context.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
        }
    }
    report.pass = selected.length === viewports.length && report.layouts.every(row => row.pass);
    report.selectedViewportsPass = report.layouts.every(row => row.pass);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    try { if (browser) await browser.close(); report.browserClosed = true; }
    catch (error) { report.browserCloseFailure = error.stack; report.pass = false; process.exitCode = 1; }
    finally { if (restoreFocusDriver) restoreFocusDriver(); }
    try { report.finalFingerprints = await fingerprint(); assert.deepEqual(report.finalFingerprints, initialSource); report.sourceStable = true; }
    catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const shots = [...report.captures, ...report.layouts.flatMap(row => (row.audio?.captures ?? []).map(image => ({ ...image,
        name: `${row.name}: ${image.label}`, frameFile: `audio/${row.name}/${image.file}` })))];
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Focused genuine bell and digital audio</title><p>${escape(manifest.revision)} · ${escape(report.sources.qa.closureHash)}</p><p>Human N=0. Digital retained PCM only; unrecorded startup, physical listening, populated photos and full specification are not proven.</p>${shots.map(image => `<figure><img width="390" src="${escape(image.frameFile)}"><figcaption>${escape(image.name)}</figcaption></figure>`).join('')}`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
