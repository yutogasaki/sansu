import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, expectedAnswer, waitLearningReady } from './island-learning-checks.mjs';

// This harness never writes a profile, progress, specimen or layout fixture.
// Each viewport earns its own available residents through the normal answer UI.
const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_WORKSHOP_RESIDENTS_OUTPUT;
const onlySecondarySource = process.env.SANSU_ISLAND_WORKSHOP_RESIDENTS_CASE === 'secondary-source';
assert(target && out, 'Set SANSU_ISLAND_PRODUCTION_URL and a fresh SANSU_ISLAND_WORKSHOP_RESIDENTS_OUTPUT');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = process.env.SANSU_ISLAND_BUILD_SOURCE ? JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE)) : undefined;
const source = async () => manifest ? Promise.all(manifest.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) }))) : [];
const sourceStart = await source();
if (manifest) assert.deepEqual(sourceStart, manifest.files.map(({ path, sha256 }) => ({ path, sha256 })));
const report = { target, startedAt: new Date().toISOString(), source: manifest?.sourceHash ?? 'unfrozen-development-diagnostic',
    harness: { url: import.meta.url, sha256: sha(await fs.readFile(new URL(import.meta.url))),
        helpers: await Promise.all(['island-e2e-helpers.mjs', 'island-learning-checks.mjs', 'island-learning-fixtures.mjs'].map(async path => ({ path, sha256: sha(await fs.readFile(new URL(path, import.meta.url))) }))) },
    formal: Boolean(manifest), pass: false, humanN: 0, fixture: false, captures: [], scenarios: [], runs: [], cancellations: [],
    scope: 'Empty database; actual answers until garden maturity unlocks fox; actual specimens and assembled layouts A/B; explicit live residents, physical hand contact, self operation, replay and interruption. Browser automation is not child motivation or native-device evidence.',
    gates: { runtime: 'PENDING', visual: 'REVIEW_REQUIRED', silentComprehension: 'UNVERIFIED, human N=0' } };
const stage = page => page.locator('[data-testid="island-stage"]').first();
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const residentNames = { otter: 'カワウソ', rabbit: 'ウサギ', fox: 'キツネ' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function state(page) {
    return stage(page).evaluate(root => ({ mode: document.querySelector('.island-page')?.getAttribute('data-mode'),
        workshop: JSON.parse(root.dataset.workshop || 'null'), actor: JSON.parse(root.dataset.workshopResident || 'null'),
        residents: JSON.parse(root.dataset.residentStates || '[]'), frame: Number(root.dataset.frameTimestamp),
        anchors: JSON.parse(root.dataset.workshopAnchors || 'null') }));
}
async function capture(page, name) {
    await stage(page).scrollIntoViewIfNeeded();
    const metadata = await runtimeMetadata(page);
    if (manifest) assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, frameFile = `${name}-world.png`;
    const full = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await stage(page).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    report.captures.push({ file, frameFile, sha256: sha(full), frameSha256: sha(frame), ...metadata, actual: await state(page) });
}
async function waitWorkshop(page, predicate, label, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const native = await readNative(page);
        if (predicate(native.island?.workshop)) { await idle(page); return native; }
        await sleep(80);
    }
    throw new Error(`Workshop did not reach ${label}`);
}
async function command(page, name) { await idle(page); await button(page, name).click(); }
async function details(page, name) {
    const summary = page.locator('summary').filter({ hasText: name });
    if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
async function answer(page, before, touch) {
    await waitLearningReady(page, before.plan);
    const submit = page.locator('.park-answer .park-keypad [data-keypad-submit]');
    if (!await submit.count() || await submit.getAttribute('data-confirmation-mode') !== 'automatic') return (await attempt(page, before, { touch })).after;
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    const expected = await expectedAnswer(page, before.plan.slots[before.plan.cursor]);
    const values = Array.isArray(expected.values) ? expected.values : [expected.values];
    for (const [index, value] of values.entries()) {
        if (type !== 'hissan') await page.locator('.park-input').nth(index).click();
        for (const digit of String(value)) {
            if (touch) await page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }).tap();
            else await page.keyboard.type(digit);
        }
    }
    await page.waitForFunction(({ id, revision }) => {
        const root = document.querySelector('[data-island-plan-id]');
        return document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward'
            || root?.getAttribute('data-input-ready') === 'true' && (root.getAttribute('data-island-plan-id') !== id || Number(root.getAttribute('data-island-plan-revision')) === revision + 1);
    }, { id: before.plan.id, revision: before.plan.revision });
    const after = await readNative(page), saved = after.islandPlans.find(plan => plan.id === before.plan.id);
    assert.equal(saved.revision, before.plan.revision + 1);
    assert.deepEqual(saved.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.equal(after.islandEvents.filter(event => event.type === 'answer' && !before.islandEvents.some(old => old.id === event.id)).length, 1);
    return after;
}
async function enter(page) { await command(page, 'おためしの いりえ'); await waitMode(page, 'workshop'); await command(page, 'つくる'); }
async function selectResident(page, species) {
    const before = await state(page);
    if (species && before.actor?.species === species && before.actor.phase !== 'waiting') {
        // Selecting an already selected resident is deliberately not a new
        // selection. End the prior replay explicitly before preparing a case.
        await command(page, 'とめる'); await waitStopped(page);
    }
    await idle(page); await page.locator('.island-workshop-residents').getByRole('button', { name: species ? residentNames[species] : 'じぶんで', exact: true }).click();
    await page.waitForFunction(species => {
        const actor = JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-workshop-resident') || 'null');
        return species ? actor?.species === species && actor.phase === 'waiting' : actor === null;
    }, species ?? null);
}
async function setupWork(page) {
    await command(page, 'しらべる');
    for (const id of ['driftwood', 'seaglass', 'striped-shell']) {
        await idle(page); await page.locator(`[data-specimen-id="${id}"]`).click(); await command(page, 'ブラシへ おく');
        for (let section = 0; section < 6; section++) {
            await page.locator(`[data-brush-section="${section}"]`).click();
            await waitWorkshop(page, workshop => Boolean(workshop?.specimens[id].cleanedMask & 1 << section), `${id} brush ${section}`);
        }
        await waitWorkshop(page, workshop => workshop?.specimens[id].observations.some(entry => entry.result === 'clean'), `${id} clean rendered`);
        await command(page, id === 'driftwood' ? 'みずへ おく' : 'ひかりへ おく');
        await waitWorkshop(page, workshop => workshop?.specimens[id].identity, `${id} identity rendered`);
    }
    await command(page, 'つくる');
    for (const [id, material, col] of [['straight', 'ながれぎ', 0], ['wheel', 'いろガラス', 1], ['bell', 'しまもようの かい', 2]]) {
        await idle(page); await page.locator(`[data-part-id="${id}"]`).click(); await command(page, `${material}を はめる`);
        await waitWorkshop(page, workshop => workshop?.draftCheckpoint.draft.layout.parts[id].assembled, `${id} assembled`);
        await details(page, 'タップで おく'); await page.locator(`[data-workshop-cell="${col},1"]`).click();
        await waitWorkshop(page, workshop => workshop?.draftCheckpoint.draft.layout.parts[id].position?.col === col, `${id} placed`);
    }
}
async function setupAlternateWork(page) {
    await selectResident(page); await page.locator('[data-part-id="elbow"]').click();
    await command(page, 'ながれぎを はめる');
    await waitWorkshop(page, workshop => workshop?.draftCheckpoint.draft.layout.parts.elbow.assembled, 'elbow assembled');
    await details(page, 'さくひんを のこす'); await command(page, 'ばんを あける');
    await waitWorkshop(page, workshop => Object.values(workshop?.draftCheckpoint.draft.layout.parts ?? {}).every(part => !part.position), 'board cleared for B');
    for (const [id, row, rotation] of [['elbow', 1, 0], ['wheel', 2, 1], ['bell', 3, 1]]) {
        await idle(page); await page.locator(`[data-part-id="${id}"]`).click();
        let current = (await readNative(page)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation;
        for (let turns = 0; current !== rotation; turns++) {
            assert(turns < 4); const before = current; await command(page, 'まわす');
            current = (await waitWorkshop(page, workshop => workshop?.draftCheckpoint.draft.layout.parts[id].rotation !== before, `${id} rotates for B`)).island.workshop.draftCheckpoint.draft.layout.parts[id].rotation;
        }
        await details(page, 'タップで おく'); await page.locator(`[data-workshop-cell="0,${row}"]`).click();
        await waitWorkshop(page, workshop => workshop?.draftCheckpoint.draft.layout.parts[id].position?.row === row, `${id} placed in B`);
    }
}
function assertLearningUnchanged(before, after) {
    for (const key of ['islandPlans', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) assert.deepEqual(after[key], before[key], `${key} changed in optional workshop`);
    const strip = island => { const copy = structuredClone(island); delete copy.workshop; delete copy.revision; delete copy.updatedAt; return copy; };
    assert.deepEqual(strip(after.island), strip(before.island));
    assert.deepEqual(after.islandEvents.filter(event => event.type !== 'workshop_changed'), before.islandEvents.filter(event => event.type !== 'workshop_changed'));
}
async function armFrames(page) {
    await page.evaluate(() => {
        window.__workshopResidentProbe?.observer.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]'), started = performance.now();
        const frames = [], images = [], captured = new Set(); let firstRoot;
        const sample = () => {
            const actor = JSON.parse(host.dataset.workshopResident || 'null'), workshop = JSON.parse(host.dataset.workshop || 'null');
            const frame = { ms: performance.now() - started, timestamp: Number(host.dataset.frameTimestamp), actor, workshop, camera: host.dataset.cameraFrame,
                residents: JSON.parse(host.dataset.residentStates || '[]'), visibility: document.visibilityState };
            if (frames.length >= 2400 || frames[frames.length - 1]?.timestamp === frame.timestamp) return;
            frames.push(frame);
            let key = actor?.phase === 'walking' ? 'walking-entry' : actor?.phase === 'watching' ? 'watching' : undefined;
            if (actor?.phase === 'walking') {
                firstRoot ??= actor.position;
                if (Math.hypot(...actor.position.map((value, index) => value - firstRoot[index])) > .8) key = 'walking-lane';
            }
            if (actor?.handDistance <= .045 && ['contact', 'operating'].includes(actor.phase)) key = 'hand-contact';
            if (workshop?.phase === 'run-wheel') key = 'waterwheel';
            if (workshop?.phase === 'run-bell') key = 'shell';
            if (key && !captured.has(key)) { captured.add(key); images.push({ key, frame, png: host.querySelector('canvas').toDataURL('image/png') }); }
        };
        const observer = new MutationObserver(sample); observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
        window.__workshopResidentProbe = { observer, frames, images }; sample();
    });
}
async function saveFrames(page, name) {
    const probe = await page.evaluate(() => { window.__workshopResidentProbe.observer.disconnect(); return { frames: window.__workshopResidentProbe.frames, images: window.__workshopResidentProbe.images }; });
    for (const image of probe.images) {
        const file = `${name}-${image.key}.png`, bytes = Buffer.from(image.png.split(',')[1], 'base64');
        await fs.writeFile(`${out}/${file}`, bytes); report.captures.push({ file, sha256: sha(bytes), kind: 'actual-render-canvas', actual: image.frame,
            revision: manifest?.revision, delivery: 'VITE_ISLAND_ENABLED=true; VITE_BUILD_PLAY_ENABLED=true' });
    }
    report.runs.push({ name, frames: probe.frames }); return probe.frames;
}
async function start(page, pointer = false) {
    await stage(page).scrollIntoViewIfNeeded();
    if (!pointer) return command(page, 'みずを ながす');
    const box = await stage(page).locator('canvas').boundingBox(), { anchors } = await state(page);
    assert(box && anchors?.sourceHandle);
    const [x, y] = anchors.sourceHandle;
    assert(x > 0 && y > 0 && x < box.width && y < box.height, 'Actual source contact is inside the canvas');
    if (pointer === 'multi') {
        await page.evaluate(() => {
            window.__residentTouchEvents = [];
            const canvas = document.querySelector('[data-testid="island-stage"] canvas');
            for (const type of ['pointerdown', 'pointerup', 'pointercancel']) canvas.addEventListener(type, event => {
                window.__residentTouchEvents.push({ type, id: event.pointerId, primary: event.isPrimary, trusted: event.isTrusted, pointerType: event.pointerType });
            }, { capture: true });
        });
        const cdp = await page.context().newCDPSession(page);
        const primary = { id: 1, x: box.x + x, y: box.y + y, radiusX: 2, radiusY: 2, force: 1 };
        const secondary = { id: 2, x: box.x + box.width * .82, y: box.y + box.height * .78, radiusX: 2, radiusY: 2, force: 1 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [primary, secondary] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [secondary] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        const events = await page.evaluate(() => window.__residentTouchEvents);
        assert(events.every(event => event.trusted && event.pointerType === 'touch'));
        assert.equal(events.filter(event => event.type === 'pointerdown').length, 2);
        assert.deepEqual(events.filter(event => event.type === 'pointerup').map(event => event.primary), [false, true]);
        report.nativeMultiTouch = events; return;
    }
    await page.mouse.click(box.x + x, box.y + y);
}
async function waitPhase(page, phase) {
    await page.waitForFunction(phase => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-workshop-resident') || 'null')?.phase === phase, phase);
}
async function runResident(page, name, species, pointer = false) {
    await selectResident(page, species); const selected = await state(page);
    await armFrames(page); await start(page, pointer);
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), actor = JSON.parse(host?.dataset.workshopResident || 'null'), workshop = JSON.parse(host?.dataset.workshop || 'null');
        return actor?.phase === 'watching' && workshop?.run?.complete && workshop.phase === 'idle';
    }, undefined, { timeout: 20000 });
    const frames = await saveFrames(page, name), walking = frames.filter(frame => frame.actor?.phase === 'walking');
    assert(walking.length >= 2, 'A real walk must render before contact');
    assert(walking.every(frame => frame.actor.species === species && frame.actor.uuid === selected.actor.uuid && !frame.workshop.phase.startsWith('run-')));
    assert(Math.hypot(...walking[0].actor.position.map((value, index) => value - walking[walking.length - 1].actor.position[index])) > .7, 'Live body traverses the outside lane');
    const firstRun = frames.find(frame => frame.workshop?.phase.startsWith('run-'));
    assert(firstRun?.actor?.phase === 'operating' && firstRun.actor.handDistance <= .045, 'First run follows actual rendered hand contact');
    assert(firstRun.ms > walking[0].ms);
    assert(frames.some(frame => frame.actor?.phase === 'watching' && frame.actor.interestTarget));
    assert(frames.every(frame => !frame.actor || frame.actor.uuid === selected.actor.uuid), 'Same actual resident instance throughout');
    if (name.endsWith('-B')) {
        assert.equal(firstRun.camera, walking[0].camera, 'B keeps the handle view through actual contact');
        assert.notEqual(frames[frames.length - 1].camera, firstRun.camera, 'B reveals the south-facing window after the resident looks at its result');
    }
    await capture(page, `${name}-finished`); return selected.actor.uuid;
}
async function waitStopped(page) {
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), actor = JSON.parse(host?.dataset.workshopResident || 'null'), workshop = JSON.parse(host?.dataset.workshop || 'null');
        return (!actor || actor.phase === 'waiting') && (!workshop || workshop.phase === 'idle');
    });
}
async function cancelDuringWalk(page, layout, kind, baseline) {
    await selectResident(page, 'otter'); await armFrames(page); await start(page); await waitPhase(page, 'walking');
    let visibility;
    if (kind === 'reselect') await selectResident(page, 'rabbit');
    else if (kind === 'self') await selectResident(page);
    else if (kind === 'learning') { await command(page, 'まなぶ'); await waitMode(page, 'learning'); await waitLearningReady(page, baseline.plan); }
    else if (kind === 'exit') { await command(page, 'しまへ'); await waitMode(page, 'home'); }
    else {
        // Switch a real browser tab. A lifecycle freeze does not imply hidden;
        // do not patch document.hidden or dispatch a synthetic visibility event.
        await page.evaluate(() => { window.__residentVisibility = []; document.addEventListener('visibilitychange', () => window.__residentVisibility.push(document.visibilityState)); });
        // Playwright enables focus emulation for each page. Disable that CDP
        // override so Chromium can report the native active-tab visibility.
        const pageCdp = await page.context().newCDPSession(page);
        await pageCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
        const mainInfo = await pageCdp.send('Target.getTargetInfo');
        const mainWindow = await pageCdp.send('Browser.getWindowForTarget', { targetId: mainInfo.targetInfo.targetId });
        const background = await page.context().newPage();
        const backgroundCdp = await page.context().newCDPSession(background);
        await backgroundCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
        const backgroundInfo = await backgroundCdp.send('Target.getTargetInfo');
        const backgroundWindow = await backgroundCdp.send('Browser.getWindowForTarget', { targetId: backgroundInfo.targetInfo.targetId });
        report.driverFocus.windows.push({ viewport: layout, main: mainWindow.windowId, background: backgroundWindow.windowId });
        assert.equal(mainWindow.windowId, backgroundWindow.windowId, 'Native background check uses two tabs in the same Chromium window');
        await background.goto('about:blank'); await background.bringToFront();
        let hidden = false;
        try { await page.waitForFunction(() => document.visibilityState === 'hidden', undefined, { polling: 50, timeout: 2500 }); hidden = true; }
        catch (error) { if (error.name !== 'TimeoutError') throw error; }
        finally { visibility = await page.evaluate(() => window.__residentVisibility); }
        if (hidden) await sleep(600); // Negative window; no success is inferred from this wait.
        await backgroundCdp.detach(); await background.close(); await page.bringToFront(); await pageCdp.detach();
        await page.waitForFunction(() => document.visibilityState === 'visible');
        if (!hidden) {
            // Keep this environment limitation separate so tablet and the same
            // reserved learning can still be checked. The manual stop below is
            // cleanup, not evidence that native background cancellation passed.
            const actual = await state(page); await command(page, 'とめる'); await waitStopped(page);
            await saveFrames(page, `${layout}-background-unverified`);
            report.cancellations.push({ name: `${layout}-background`, pass: null, status: 'UNVERIFIED', visibility, actual,
                reason: 'Chromium remained visible after a headed same-window tab switch with focus emulation disabled. No synthetic hidden event was used.' });
            await capture(page, `${layout}-background-unverified`); return;
        }
        assert(visibility.includes('hidden'));
    }
    await waitStopped(page);
    const first = await state(page); await sleep(450); const settled = await state(page);
    assert(!settled.actor || settled.actor.phase === 'waiting', 'Cancelled walk cannot dispatch after return');
    assert(!settled.workshop || settled.workshop.phase === 'idle');
    const after = await readNative(page); assert.deepEqual(after, baseline, 'Interruption cannot write discoveries, layout or learning');
    const frames = await saveFrames(page, `${layout}-cancel-${kind}`);
    assert(!frames.some(frame => frame.workshop?.phase.startsWith('run-')), 'Cancelled walking request never starts water');
    if (kind === 'exit' || kind === 'learning') {
        assert.deepEqual(settled.residents.map(resident => resident.species).sort(), ['fox', 'otter', 'rabbit']);
        assert(settled.residents.every(resident => resident.position.every(Number.isFinite)));
        assert(!settled.actor && !settled.workshop, 'Borrowed actor and workshop view are released');
    }
    report.cancellations.push({ name: `${layout}-${kind}`, pass: true, first, settled, visibility });
    await capture(page, `${layout}-${kind}-cancelled`);
    if (kind === 'learning') { await command(page, 'しまへ'); await waitMode(page, 'home'); }
    if (kind === 'learning' || kind === 'exit') { await enter(page); await waitStopped(page); }
}
const require = createRequire(import.meta.url);
const { CRSession } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/crConnection.js'));
const driverSend = CRSession.prototype.send;
report.driverFocus = { command: 'Emulation.setFocusEmulationEnabled', originalEnabled: true, replacementEnabled: false,
    dependencyFilesModified: false, appVisibilityPropertyModified: false, overrides: [], windows: [] };
// Prevent the driver's own main-frame session from enabling synthetic focus.
// An additional CDP session cannot override that earlier session's true value.
if (!onlySecondarySource) CRSession.prototype.send = function (method, params) {
    if (method === report.driverFocus.command && params?.enabled === true) {
        report.driverFocus.overrides.push({ sessionId: this._sessionId, at: new Date().toISOString() });
        return driverSend.call(this, method, { ...params, enabled: false });
    }
    return driverSend.call(this, method, params);
};
const browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_HEADED !== '1' });
report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_HEADED === '1' };
try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }].filter(layout => !onlySecondarySource || layout.name === 'phone')) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitReady(page); await waitMode(page, 'learning');
            let native = await readNative(page), answerCount = 0;
            while (native.island.completedSets < 1) { native = await answer(page, native, layout.name === 'phone'); assert(++answerCount < 160); }
            await command(page, 'しまへ'); await waitMode(page, 'home'); await enter(page);
            assert.equal(await page.locator('.island-workshop-residents').getByRole('button', { name: 'キツネ', exact: true }).count(), 0, 'Unavailable fox cannot be selected');
            await capture(page, `${layout.name}-01-earned-first-section`);
            await command(page, 'まなぶ'); await waitMode(page, 'learning');
            while (native.island.completedSets < 4 || (native.island.growth?.expansionLevel ?? 0) < 1) {
                native = await answer(page, native, layout.name === 'phone'); assert(++answerCount < 160, 'Bounded real learning did not unlock waterside');
            }
            const earned = native; assert(native.islandEvents.filter(event => event.type === 'answer').length >= answerCount);
            await command(page, 'しまへ'); await waitMode(page, 'home'); const world = await state(page);
            await enter(page); await setupWork(page); await capture(page, `${layout.name}-02-earned-workshop`);
            assert.equal(await page.locator('canvas').count(), 1);
            await selectResident(page); await armFrames(page); await start(page);
            await waitWorkshop(page, workshop => workshop?.creations.some(entry => entry.partId === 'bell'), 'self A reaches shell');
            await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-workshop') || 'null')?.phase === 'idle');
            const self = await saveFrames(page, `${layout.name}-self`); assert(self.every(frame => frame.actor === null), 'Self borrows no resident');
            let baseline = await readNative(page); assertLearningUnchanged(earned, baseline);
            if (onlySecondarySource) {
                await runResident(page, `${layout.name}-secondary-source`, 'otter', 'multi');
                assert.deepEqual(await readNative(page), baseline);
                report.scenarios.push({ name: 'native secondary touch release preserves resident source tap', pass: true, fixture: false, actualAnswersToUnlock: answerCount });
                continue;
            }
            const uuids = {};
            for (const species of ['otter', 'rabbit', 'fox']) {
                uuids[species] = await runResident(page, `${layout.name}-${species}`, species, species === 'otter');
                assert.deepEqual(await readNative(page), baseline, 'Resident replay adds no save, reward or discovery');
            }
            assert.equal(new Set(Object.values(uuids)).size, 3, 'Three distinct live objects');
            if (layout.name === 'phone') {
                assert.equal(await runResident(page, `${layout.name}-secondary-source`, 'otter', 'multi'), uuids.otter);
                assert.deepEqual(await readNative(page), baseline);
            }
            await setupAlternateWork(page); baseline = await readNative(page); assertLearningUnchanged(earned, baseline);
            for (const species of ['otter', 'rabbit', 'fox']) {
                assert.equal(await runResident(page, `${layout.name}-${species}-B`, species), uuids[species]);
                assert.deepEqual(await readNative(page), baseline, 'B replay cannot issue another discovery or change learning');
            }
            // Cancellation uses normal movement so the physical UI gesture can
            // interrupt an actual walk; the complete tablet runs above use reduce.
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            for (const kind of ['reselect', 'self', 'learning', 'exit', 'background']) await cancelDuringWalk(page, layout.name, kind, baseline);
            await command(page, 'しまへ'); await waitMode(page, 'home'); const restored = await state(page);
            for (const original of world.residents) assert.equal(restored.residents.find(resident => resident.species === original.species)?.look, original.look, 'Actual visible clothing survives borrowing');
            await command(page, 'まなぶ'); await waitMode(page, 'learning');
            const same = await readNative(page); assert.deepEqual(same.plan, baseline.plan); await answer(page, same, layout.name === 'phone');
            await capture(page, `${layout.name}-same-learning-answered`); assert.deepEqual(errors, []);
            report.scenarios.push({ name: layout.name, pass: true, fixture: false, actualAnswersToUnlock: answerCount, earnedSections: earned.island.completedSets,
                earnedGrowth: earned.island.growth, availableResidents: Object.keys(uuids), uuids, preservedPlan: baseline.plan.id });
            console.log(`PASS ${layout.name}: ${answerCount} actual answers, 3 live residents, hand contact, self, replay, available interruptions, same learning; background=${report.cancellations.find(entry => entry.name === `${layout.name}-background`)?.status ?? 'PASS'}`);
        } catch (error) {
            report.errors = errors; await capture(page, `${layout.name}-failure`).catch(() => {});
            await fs.writeFile(`${out}/${layout.name}-native.json`, JSON.stringify(await readNative(page).catch(() => null), null, 2));
            if (await page.evaluate(() => Boolean(window.__workshopResidentProbe)).catch(() => false)) await saveFrames(page, `${layout.name}-failure-frames`).catch(() => {});
            throw error;
        } finally { await context.close(); }
    }
    if (manifest) assert.deepEqual(await source(), sourceStart, 'Frozen build source changed');
    const incomplete = report.cancellations.some(entry => entry.status === 'UNVERIFIED');
    report.pass = !incomplete; report.gates.runtime = incomplete ? 'PARTIAL; real background visibility unverified' : 'PASS';
} catch (error) { report.failure = error.stack; report.gates.runtime = 'FAIL'; process.exitCode = 1; }
finally {
    await browser.close(); CRSession.prototype.send = driverSend;
    report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Workshop live residents</title><style>body{font:14px system-ui;margin:24px;background:#f8f0de;color:#173b40}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}img{width:100%;height:580px;object-fit:contain;background:#e9e2cb}figcaption{overflow-wrap:anywhere}</style><h1>Live resident runtime: ${report.pass ? 'PASS' : 'FAIL / INCOMPLETE'}</h1><p>${escape(target)} · ${escape(report.source)} · actual earned progress, no fixture · human N=0 · visual review required</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.file)}"></a><figcaption>${escape(item.file)}<br>${escape(item.revision)}<br>SHA256 ${escape(item.sha256)}</figcaption></figure>`).join('')}</main>`);
}
