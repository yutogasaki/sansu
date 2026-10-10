import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makePlacePack, loadPlaceDomain } from './growing-place-fixtures.mjs';
import { hash } from './growing-fixture-data.mjs';
import { answerUI, appRootMetadata, openGrowingMenu, readNative, runtimeMetadata, seedNative } from './island-e2e-helpers.mjs';
import { disposeProductionProjection, plantProduction, productionCellPoint } from './growing-production-helpers.mjs';

const CANDIDATE = 'native-05-place-runtime-v3';
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 768, height: 1024 }];
export function parseOptions(args) {
    const result = { plan: false, diagnosticOnly: false, development: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--plan') result.plan = true;
        else if (args[i] === '--diagnostic-only') result.diagnosticOnly = true;
        else if (args[i] === '--development') result.development = true;
        else {
            assert(['--url', '--output-dir', '--build-dir', '--diagnostic-viewport', '--diagnostic-case'].includes(args[i]) && args[i + 1], 'Usage: --plan OR --url LOOPBACK --output-dir NEW_DIRECTORY [--build-dir BUILD] [--development] [--diagnostic-only [--diagnostic-viewport 390|768] [--diagnostic-case PACK_ID]]');
            const key = args[i].slice(2); assert(!result[key], `Duplicate ${args[i]}`); result[key] = args[++i];
        }
    }
    if (result['diagnostic-viewport'] || result['diagnostic-case']) assert(result.diagnosticOnly, 'Explicit diagnostic selection requires --diagnostic-only');
    if (result['diagnostic-viewport']) assert(VIEWPORTS.some(viewport => String(viewport.width) === result['diagnostic-viewport']), 'Select an actual mature diagnostic viewport');
    if (!result.plan) {
        assert(result.url && result['output-dir'], 'A loopback URL and fresh output directory are required');
        const url = new URL(result.url);
        assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Only local loopback app targets');
        result.url = url.origin;
        assert(result.development || result['build-dir'], 'Identify a production build, or explicitly mark the DEV diagnosis');
        if (result['build-dir']) {
            const relative = path.relative(path.resolve(result['build-dir']), path.resolve(result['output-dir']));
            assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Keep evidence outside the build');
        }
    }
    return result;
}

async function sourceManifest(root = process.cwd()) {
    const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(async item => item.isDirectory()
        ? walk(path.join(directory, item.name)) : item.isFile() ? [path.join(directory, item.name)] : []))).flat();
    const files = [...await walk(path.join(root, 'src')), ...await walk(path.join(root, 'public')), ...await walk(path.join(root, 'prototypes/place-qa')),
        ...['tools/e2e-growing-places.mjs', 'tools/growing-place-fixtures.mjs', 'tools/growing-production-helpers.mjs', 'tools/island-e2e-helpers.mjs', 'docs/product/island-place-goals.json', 'package.json', 'package-lock.json'].map(file => path.join(root, file))];
    return Object.fromEntries(await Promise.all(files.sort().map(async file => [path.relative(root, file), hash(await fs.readFile(file))])));
}
const stateKernel = state => ({ owners: [...state.plots, ...state.landmarks, ...state.keepsakes].map(item => ({ id: item.id, kind: item.kind, paid: item.paid, origin: item.origin, plantedAt: item.plantedAt, builtAt: item.builtAt, stagedAt: item.stagedAt, stage: item.stage, style: item.style })),
    drops: state.drops, land: state.land, villagers: state.villagers, town: state.town, learned: state.learned });

/** Read the exact guarded table, never a former lineage table. */
async function nativeRecord(page, databaseName, profileId, value) {
    return page.evaluate(async ({ databaseName, profileId, value }) => {
        const request = indexedDB.open(databaseName);
        const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
        try {
            if (!db.objectStoreNames.contains('placedIslands')) throw Error('Current place-owning table is missing');
            const tx = db.transaction('placedIslands', value ? 'readwrite' : 'readonly');
            const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
            const op = value ? tx.objectStore('placedIslands').put(value) : profileId ? tx.objectStore('placedIslands').get(profileId) : tx.objectStore('placedIslands').getAll();
            const result = await new Promise((ok, no) => { op.onsuccess = () => ok(op.result); op.onerror = () => no(op.error); });
            await done; return value ?? result;
        } finally { db.close(); }
    }, { databaseName, profileId, value });
}
export async function until(page, read, predicate, label, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await page.waitForTimeout(100); }
    // Sample once at the boundary: a real receipt may have saved since the last
    // polling interval. The exact predicate still governs acceptance.
    const final = await read(); if (predicate(final)) return final;
    throw Error(`Unproved runtime condition: ${label}`);
}
async function ready(page) {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
    await page.locator(`[data-growing-world][data-art-candidate="${CANDIDATE}"]`).waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function openBook(page) {
    if (await page.locator('.growing-place-book').isVisible()) return page.locator('.growing-place-book');
    const menu = await openGrowingMenu(page, { touch: true });
    await menu.getByRole('button', { name: 'そだつ場所', exact: true }).tap();
    await page.locator('.growing-place-book').waitFor(); return page.locator('.growing-place-book');
}
async function layoutAudit(page) {
    const result = await page.evaluate(() => {
        const book = document.querySelector('.growing-place-book');
        const box = book?.getBoundingClientRect();
        const buttons = [...(book?.querySelectorAll('button, summary') ?? [])].filter(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden').map(button => {
            const r = button.getBoundingClientRect(); return { text: button.textContent?.trim(), width: r.width, height: r.height };
        });
        return { viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth,
            bookInside: Boolean(box && box.left >= -.5 && box.right <= innerWidth + .5), buttons };
    });
    assert.equal(result.overflow, false); assert.equal(result.bookInside, true);
    assert(result.buttons.every(button => button.width >= 43.5 && button.height >= 43.5), 'Every shown book action needs a 44px target');
    return result;
}

async function tapCell(page, state, cell, elevation) { const point = await productionCellPoint(page, state, cell, elevation); await page.touchscreen.tap(point.x, point.y); }

export function assertOwnerPlacementPreserved(original, owner, cell, before, after, requireStored = false) {
    const expected = cell === undefined && !Object.hasOwn(original, 'cell') ? original : { ...original, cell };
    // A real acquisition journey keeps the natural clock running. Its numeric
    // growth may advance at the existing soil modifier (at most 1.25), while
    // every other owner field and the exact selected cell stay unchanged.
    if (!requireStored && typeof original.growth === 'number') {
        const hours = after.nature.hours - before.nature.hours;
        assert(Number.isFinite(hours) && hours >= 0, 'The real natural clock must not reset');
        assert(Number.isFinite(owner?.growth) && owner.growth >= original.growth
            && owner.growth - original.growth <= hours * 1.25 + 1e-7, 'Growth must advance only within the actual saved natural hours');
        assert.deepEqual({ ...owner, growth: original.growth }, expected, 'Preserve every original owner field and chosen cell while natural growth continues');
    } else assert.deepEqual(owner, expected, 'Keep the exact original owner at the chosen cell');
}

/** An existing owner is placed only through the visible placement confirmation.
 * A refresh may disable that control between touch-down and touch-up; re-read the
 * saved owner before another real tap, and reject any purchase or substituted ID.
 * At most four real taps are allowed; success requires the exact saved owner. */
export async function confirmOwnerPlacement(page, read, ownerId, cell, timeout = 15000, requireStored = false) {
    const baseline = await read(), owners = state => [...state.plots, ...state.landmarks, ...state.keepsakes];
    const original = owners(baseline.state).find(item => item.id === ownerId);
    assert(original && (!requireStored || !original.cell), 'The selected original owner must exist in its expected placement state');
    const rights = state => ({ drops: state.drops, ids: owners(state).map(item => item.id).sort() });
    const button = page.locator('.growing-placing').getByRole('button', { name: 'ここに おく', exact: true });
    const end = Date.now() + timeout; let taps = 0, nextTap = 0;
    while (Date.now() < end) {
        const current = await read();
        assert.deepEqual(rights(current.state), rights(baseline.state), 'Placing an existing owner must not buy another object');
        const owner = owners(current.state).find(item => item.id === ownerId);
        if (owner?.cell?.x === cell.x && owner.cell.z === cell.z) {
            assertOwnerPlacementPreserved(original, owner, cell, baseline.state, current.state, requireStored);
            return { record: current, confirmationTaps: taps };
        }
        assertOwnerPlacementPreserved(original, owner, original.cell, baseline.state, current.state, requireStored);
        assert.equal(await button.isVisible(), true, 'Existing-owner placement must remain visible until saved');
        if (taps < 4 && Date.now() >= nextTap && await button.isEnabled()) {
            await button.tap(); taps++;
            nextTap = Date.now() + 600;
        }
        await page.waitForTimeout(100);
    }
    throw Error(`Unproved existing-owner confirmation: ${ownerId} after ${taps} real taps`);
}
export async function confirmStoredPlacement(page, read, ownerId, cell, timeout = 15000) {
    return confirmOwnerPlacement(page, read, ownerId, cell, timeout, true);
}

async function placeLandmark(page, read, kind, cell) {
    const menu = await openGrowingMenu(page, { touch: true }); await menu.getByRole('button', { name: 'たね', exact: true }).tap();
    await page.getByRole('tab', { name: 'めじるし', exact: true }).tap();
    await page.locator(`[data-growing-landmark="${kind}"]`).tap();
    await tapCell(page, (await read()).state, cell); await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
    return until(page, read, record => record.state.landmarks.some(item => item.kind === kind && item.cell?.x === cell.x && item.cell?.z === cell.z), `purchased ${kind}`);
}
async function moveOwner(page, read, id, cell) {
    const before = await read(), owner = [...before.state.landmarks, ...before.state.plots].find(item => item.id === id);
    const title = owner.kind === 'sapling' ? '木の なえ' : owner.kind === 'bench' ? 'ベンチ' : undefined;
    const expectedSheet = title ? page.locator(`.growing-sheet[aria-label="${title}"]`) : page.locator('.growing-sheet');
    const end = Date.now() + 15000;
    while (Date.now() < end && !await expectedSheet.isVisible()) {
        const other = page.locator('.growing-sheet');
        if (await other.isVisible()) await other.getByRole('button', { name: 'とじる', exact: true }).tap();
        const point = await productionCellPoint(page, before.state, owner.cell, owner.kind === 'bench' ? .45 : .26);
        const actors = JSON.parse(await page.locator('[data-growing-world]').getAttribute('data-place-actors') || '[]');
        // Wait for a moving friend to leave the tiny visible seed's finger area. This
        // is real foreground input, not a private selected-owner/actor mutation.
        if (actors.some(actor => Math.hypot(actor.screenX - point.x, actor.screenY - point.y) < 28)) { await page.waitForTimeout(150); continue; }
        await page.touchscreen.tap(point.x, point.y); await page.waitForTimeout(150);
    }
    await expectedSheet.getByRole('button', { name: 'うごかす', exact: true }).tap();
    await tapCell(page, before.state, cell);
    return (await confirmOwnerPlacement(page, read, id, cell)).record;
}
export async function confirmGoalChoice(page, read, book, id, timeout = 15000) {
    const before = await read(), end = Date.now() + timeout;
    const button = book.getByRole('button', { name: id ? 'ここを そだてたい' : '目標を はずす', exact: true });
    let taps = 0, nextTap = 0;
    while (Date.now() < end) {
        const current = await read();
        assert.deepEqual(stateKernel(current.state), stateKernel(before.state), 'A free bookmark must preserve the same island and learning');
        if (current.state.placeProgress?.selected === id) return { record: current, id, confirmationTaps: taps };
        assert.equal(await button.isVisible(), true, 'Keep the requested goal confirmation visible until saved');
        if (taps < 4 && Date.now() >= nextTap && await button.isEnabled()) {
            await button.tap(); taps++; nextTap = Date.now() + 600;
        }
        await page.waitForTimeout(100);
    }
    throw Error(`Unproved free goal confirmation: ${id ?? 'clear'} after ${taps} real taps`);
}
async function exerciseGoalChoices(page, read, capture) {
    const before = await read(), book = await openBook(page);
    const confirmations = [];
    assert.equal(await book.locator('[data-place-goal]').count(), 6);
    for (const id of ['P04', 'P02', 'P06', 'P03', 'P05', 'P01']) {
        await book.locator(`[data-place-goal="${id}"]`).tap();
        await until(page, () => book.locator('[data-place-detail]').getAttribute('data-place-detail'), value => value === id, `opened optional detail ${id}`);
        const chosen = await confirmGoalChoice(page, read, book, id);
        confirmations.push({ id, confirmationTaps: chosen.confirmationTaps });
    }
    await capture('optional-six-goals');
    const clear = await confirmGoalChoice(page, read, book);
    const cleared = clear.record; confirmations.push({ id: 'clear', confirmationTaps: clear.confirmationTaps });
    assert.deepEqual(stateKernel(cleared.state), stateKernel(before.state), 'Selecting/clearing must preserve clock, ownership and learning');
    const bookmark = await confirmGoalChoice(page, read, book, 'P01');
    confirmations.push({ id: 'P01', confirmationTaps: bookmark.confirmationTaps });
    await page.keyboard.press('Escape'); assert.equal(await book.isVisible(), false);
    assert.equal(await page.locator('.growing-menu-button').evaluate(button => button === document.activeElement), true);
    await page.reload(); await ready(page); assert.equal((await read()).state.placeProgress.selected, 'P01');
    return confirmations;
}

/** These are ordinary answers/purchases; this journey deliberately does not fake elapsed maturity. */
async function acquiredJourney(browser, options, report, captureFactory) {
    for (const viewport of [...VIEWPORTS, { width: 320, height: 568 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, timezoneId: 'Asia/Tokyo', reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
        const capture = captureFactory(page, `acquired-${viewport.width}`);
        try {
            await page.goto(`${options.url}/#/island`); await capture('welcome');
            await page.getByRole('button', { name: /^まなぶ/ }).first().tap();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).tap();
            await ready(page);
            const database = options.development ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1';
            const initial = (await nativeRecord(page, database))[0], id = initial.profileId, read = () => nativeRecord(page, database, id);
            await plantProduction(page, 'home', { x: 4, z: 3 }, initial.state);
            await until(page, read, record => record.state.villagers.length === 1, 'real free-home newcomer');
            await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).tap(); await capture('first-home');
            await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
            let learning = await readNative(page, id);
            while (learning.logs.length < 20) learning = (await answerUI(page, learning.plan, { touch: true, dev: options.development })).state;
            const continuation = { id: learning.plan.id, cursor: learning.plan.cursor };
            await capture('twenty-real-answers'); await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
            await until(page, read, record => record.state.learned.length === 20 && record.state.drops === 40, 'earned two saplings');
            const goalConfirmations = await exerciseGoalChoices(page, read, capture);
            const book = await openBook(page); report.layouts.push({ journey: 'acquired', ...await layoutAudit(page) });
            await book.getByRole('tab', { name: 'いまの しま', exact: true }).focus(); await page.keyboard.press('ArrowRight');
            assert.equal(await book.getByRole('tab', { name: 'そだった おもいで', exact: true }).getAttribute('aria-selected'), 'true');
            await page.keyboard.press('Escape');
            await placeLandmark(page, read, 'sapling', { x: 0, z: 2 });
            const planted = await placeLandmark(page, read, 'sapling', { x: 2, z: 2 });
            if (planted.state.unopened.length) {
                await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).tap();
                await until(page, read, record => record.state.unopened.length === 0, 'opened bought saplings normally');
            }
            const bench = planted.state.landmarks.find(item => item.id === 'starter-bench');
            if (bench.cell.x !== 1 || bench.cell.z !== 3) await moveOwner(page, read, bench.id, { x: 1, z: 3 });
            const connected = await read(); assert.equal(connected.state.drops, 0);
            assert.equal(connected.state.placeProgress.milestones.P01, undefined, 'Young acquired trees are not mature');
            await until(page, () => page.locator('[data-growing-world]').getAttribute('data-place-topology'), value => value.includes('P01:lane:connected'), 'real acquired young connected garden');
            await capture('young-connected-garden');
            const tree = connected.state.landmarks.find(item => item.kind === 'sapling' && item.cell.x === 2);
            await moveOwner(page, read, tree.id, { x: 5, z: 4 }); await capture('split-same-owner');
            await moveOwner(page, read, tree.id, { x: 2, z: 2 });
            const rejoined = await read(); assert.equal(rejoined.state.landmarks.find(item => item.id === tree.id).growth >= tree.growth, true);
            assert.equal(rejoined.state.drops, 0); await capture('reconnected-same-tree');
            await page.reload(); await ready(page);
            assert.equal((await read()).state.placeProgress.selected, 'P01');
            const beforeReturn = await readNative(page, id); assert.deepEqual(beforeReturn, learning, 'Island play must not mutate learning stores');
            await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
            learning = await readNative(page, id); assert.equal(learning.plan.id, continuation.id); assert.equal(learning.plan.cursor, continuation.cursor);
            learning = (await answerUI(page, learning.plan, { touch: true, dev: options.development })).state; assert.equal(learning.logs.length, 21);
            await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page); await until(page, read, record => record.state.learned.length === 21, 'normal learning return');
            await capture('same-plan-return'); assert.deepEqual(errors, []);
            report.acquired.push({ viewport, profileId: id, answerCount: 21, noFixtureWrites: true, noClockManipulation: true, acquiredMatureGarden: false, goalConfirmations,
                limitation: 'Real purchases/connect/split/reconnect verified. Natural 18-hour/7-day maturity is deliberately not claimed.', record: await read(), pass: true });
        } catch (error) {
            await capture('first-failure').catch(() => {});
            report.firstFailure = { journey: 'acquired', viewport, error: String(error),
                native: await nativeRecord(page, options.development ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1').catch(() => undefined),
                dom: await page.locator('body').innerText().catch(() => undefined), errors };
            throw error;
        } finally { await context.close(); }
    }
}

async function actorTelemetry(page) {
    return page.locator('[data-growing-world]').evaluate(world => ({ actors: JSON.parse(world.dataset.placeActors || '[]'), targets: JSON.parse(world.dataset.placeTargets || '[]') }));
}
export function matchesPlaceUse(record, expected) {
    return Object.values(record.state.placeProgress?.uses[expected.ruleId] ?? {}).some(fact => fact.actorId === expected.actorId
        && fact.targetId === expected.targetId && fact.revision === expected.revision);
}
/** Random autonomous life has no promise to choose one exact seat in 90s.
 * Retry only through normal page reload, retain every missed observation window,
 * and require the same real actor/target/revision receipt on every attempt. */
export async function observeExactPlaceUse(page, read, expected, timeout, attempts = 1, onReload = ready) {
    assert(Number.isInteger(attempts) && attempts >= 1 && attempts <= 3, 'Bound real observation to at most three windows');
    const observations = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const startedAt = Date.now();
        try {
            const record = await until(page, read, value => matchesPlaceUse(value, expected), `${expected.ruleId} actual ${expected.actorId}/${expected.targetId}`, timeout);
            observations.push({ attempt, timeoutMs: timeout, elapsedMs: Date.now() - startedAt, finalNativePoll: true, matched: true });
            return { record, observations };
        } catch (error) {
            const actual = await read();
            observations.push({ attempt, timeoutMs: timeout, elapsedMs: Date.now() - startedAt, finalNativePoll: true, matched: false,
                actual: actual.state.placeProgress?.uses[expected.ruleId] ?? {} });
            error.placeUse = { expected, observations, actual: actual.state.placeProgress?.uses[expected.ruleId] ?? {},
                arrivedAfterDeadline: matchesPlaceUse(actual, expected) };
            if (attempt === attempts) throw error;
            await page.reload(); await onReload(page);
        }
    }
}
/** P06 requires three reachable families and both real actor classes using any
 * current mature place. It does not prescribe one garden or a named resident. */
export function currentWholeIslandUseEvidence(record, places, reachable) {
    const state = record.state, progress = state.placeProgress;
    const mature = places.filter(place => ['grown', 'lived'].includes(place.stage)
        && place.entrances.some(cell => reachable.has(`${cell.x},${cell.z}`)));
    if (new Set(mature.map(place => place.family)).size < 3) return undefined;
    const facts = [...progress?.useHistory ?? [], ...Object.values(progress?.uses ?? {}).flatMap(slots => Object.values(slots))];
    const current = facts.filter(fact => {
        const place = mature.find(place => place.ruleId === fact.ruleId && place.revision === fact.revision && place.anchorId === fact.anchorId
            && place.memberIds.length === fact.memberIds.length && place.memberIds.every(id => fact.memberIds.includes(id))
            && place.useTargets.some(target => target.id === fact.targetId));
        if (!place) return false;
        if (fact.actorId === 'pokomoko') return true;
        const resident = state.villagers.find(resident => resident.id === fact.actorId && !resident.away && !state.arrivals.includes(resident.id));
        if (!resident) return false;
        if (resident.home === 'pokomoko') return true;
        const home = state.plots.find(plot => plot.id === resident.home && plot.kind === 'home' && plot.stage > 0
            && plot.cell && !state.unopened.includes(plot.id));
        return Boolean(home?.cell && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([x, z]) => reachable.has(`${home.cell.x + x},${home.cell.z + z}`)));
    });
    const pokomoko = current.find(fact => fact.actorId === 'pokomoko'), villager = current.find(fact => fact.actorId !== 'pokomoko');
    return pokomoko && villager ? { pokomoko, villager, revision: JSON.stringify(mature.map(place => place.revision).sort()) } : undefined;
}
export async function observeWholeIslandUse(page, read, evidence, timeout = 90000, attempts = 3, onReload = ready) {
    assert(Number.isInteger(attempts) && attempts >= 1 && attempts <= 3, 'Bound real observation to at most three windows');
    const observations = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const startedAt = Date.now();
        try {
            const record = await until(page, read, value => {
                const actual = evidence(value);
                return actual && value.state.placeProgress.milestones.P06?.revision === actual.revision;
            }, 'whole island: three current reachable families and actual Poco/resident use', timeout);
            observations.push({ attempt, timeoutMs: timeout, elapsedMs: Date.now() - startedAt, finalNativePoll: true, matched: true });
            return { record, observations };
        } catch (error) {
            const actual = await read();
            observations.push({ attempt, timeoutMs: timeout, elapsedMs: Date.now() - startedAt, finalNativePoll: true, matched: false,
                actual: actual.state.placeProgress });
            error.placeUse = { ruleId: 'P06', observations };
            if (attempt === attempts) throw error;
            await page.reload(); await onReload(page);
        }
    }
}
async function actualPlaceUse(page, read, place, actorId = 'pokomoko', timeout = 45000, auditBook = false) {
    const desired = place.ruleId === 'P02' ? 'gallery' : place.ruleId === 'P04' ? 'play' : 'seat';
    const target = place.useTargets.find(target => target.kind === desired) ?? place.useTargets[0]; assert(target);
    let action = 'autonomous observed use (production has no DEV telemetry)';
    const telemetry = await actorTelemetry(page), screen = telemetry.targets.find(item => item.placeId === place.id && item.targetId === target.id), actor = telemetry.actors.find(item => item.id === actorId);
    if (screen && actor && screen.screenX > 0 && screen.screenX < page.viewportSize().width && actor.screenX > 0 && actor.screenX < page.viewportSize().width) {
        if (desired === 'gallery' && actorId === 'pokomoko') {
            await page.mouse.click(screen.screenX, screen.screenY); action = 'real gallery-floor tap, followed by walking/climb';
        } else {
            await page.mouse.move(actor.screenX, actor.screenY); await page.mouse.down(); await page.waitForTimeout(90);
            await page.mouse.move(screen.screenX, screen.screenY, { steps: 18 }); await page.mouse.up(); action = 'real pointer pickup/carry/drop';
        }
    }
    let overlay;
    if (auditBook) {
        await openBook(page);
        // An observation accepted before opening may already be saving. Settle that
        // work before checking that the opaque book prevents further receipts.
        await page.waitForTimeout(750);
        const receipts = record => ({ shown: record.state.placeProgress.shown, uses: record.state.placeProgress.uses, history: record.state.placeProgress.useHistory });
        const before = receipts(await read());
        await page.waitForTimeout(3000);
        assert.equal(await page.locator('.growing-place-book').isVisible(), true);
        const after = receipts(await read());
        assert.deepEqual(after, before, 'An opaque book must not acknowledge covered places or actors');
        await page.keyboard.press('Escape');
        await page.locator('.growing-place-book').waitFor({ state: 'hidden' });
        overlay = { opaqueBookMs: 3000, inflightSettledMs: 750, before, after, unchanged: true };
    }
    const expected = { ruleId: place.ruleId, placeId: place.id, actorId, targetId: target.id, revision: place.revision };
    // Production observation uses the unmodified, random island-life behaviour.
    // Give that action a bounded 90s window, keeping the exact target/shape check.
    const observationTimeout = action.startsWith('autonomous') ? Math.max(timeout, 90000) : timeout;
    const { record, observations } = await observeExactPlaceUse(page, read, expected, observationTimeout, action.startsWith('autonomous') ? 3 : 1);
    return { actorId, targetId: target.id, ruleId: place.ruleId, revision: place.revision, action, overlay,
        observation: { timeoutMs: observationTimeout, attempts: observations, normalReloads: observations.length - 1, finalNativePoll: true }, evidence: record.state.placeProgress.uses[place.ruleId] };
}
async function diagnosticJourney(browser, options, report, pack, captureFactory) {
    for (const viewport of VIEWPORTS.filter(viewport => !options['diagnostic-viewport'] || String(viewport.width) === options['diagnostic-viewport']))
        for (const fixture of pack.cases.filter(fixture => !options['diagnostic-case'] || fixture.id === options['diagnostic-case'])) {
        const context = await browser.newContext({ viewport, hasTouch: true, timezoneId: pack.timezone, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
        const capture = captureFactory(page, `${fixture.id}-${viewport.width}`), database = options.development ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1', id = fixture.profile.id;
        const read = () => nativeRecord(page, database, id);
        try {
            await page.clock.setFixedTime(pack.epoch); await page.goto(`${options.url}/#/island`); await page.waitForURL('**/#/onboarding');
            await page.evaluate(async () => {
                const request = indexedDB.open('SansuDatabase'), db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
                try { const get = db.transaction('profiles').objectStore('profiles').count(); if (await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); })) throw Error('Refuse to seed nonempty profile database'); }
                finally { db.close(); }
            });
            await seedNative(page, id); await page.goto(`${options.url}/#/island`); await ready(page);
            await nativeRecord(page, database, id, fixture.island); await page.reload(); await ready(page);
            const before = await read(), learning = await readNative(page, id); assert.equal(before.version, 4);
            assert.deepEqual(stateKernel(before.state), stateKernel(fixture.island.state));
            const topology = await page.locator('[data-growing-world]').getAttribute('data-place-topology');
            for (const expected of fixture.expected.places ?? []) assert(topology.includes(`${expected.ruleId}:${expected.variant}:grown`), 'Actual renderer reads the exact shared place projection');
            for (const expected of fixture.expected.relations ?? []) assert((await page.locator('[data-growing-world]').getAttribute('data-place-relations')).split(',').includes(expected));
            await capture('grown-real-3d');
            for (const expected of [...fixture.expected.places ?? [], ...fixture.expected.wholePlaces ?? []]) {
                const place = fixture.projection.places.find(place => place.ruleId === expected.ruleId && place.variant === expected.variant);
                await until(page, read, record => record.state.placeProgress.shown[place.ruleId] === place.revision, `rendered ${place.ruleId}/${place.variant} receipt`);
            }
            const uses = []; let storageRoundTrip;
            if (viewport.width === 390 && fixture.expected.places?.[0] && ['lane', 'tiered', 'bay', 'arch'].includes(fixture.expected.places[0].variant)) {
                const place = fixture.projection.places.find(place => place.ruleId === fixture.expected.places[0].ruleId);
                const auditBook = place.ruleId === 'P01' && fixture.expected.places[0].variant === 'lane';
                uses.push(await actualPlaceUse(page, read, place, 'pokomoko', 45000, auditBook)); await capture('physical-use');
            }
            if (fixture.expected.realUseRequiredForP06) {
                assert.equal(before.state.placeProgress.milestones.P06, undefined);
                const { domain } = await loadPlaceDomain();
                const evidence = record => currentWholeIslandUseEvidence(record, domain.derivePlaces(record.state), domain.reachableFromHome(record.state));
                assert.equal(evidence(before), undefined, 'The synthetic whole island has no fabricated actor-use facts');
                const { record: used, observations } = await observeWholeIslandUse(page, read, evidence);
                const actual = evidence(used); assert(actual);
                uses.push({ action: 'autonomous observed whole-island use', ...actual,
                    milestone: used.state.placeProgress.milestones.P06, observation: { attempts: observations, normalReloads: observations.length - 1 } });
                await capture('whole-island-used');
            }
            if (fixture.expected.places?.[0]?.ruleId === 'P01' && fixture.expected.places[0].variant === 'lane') {
                await page.reload(); await ready(page); // A preceding seat play focuses its camera temporarily.
                const place = fixture.projection.places.find(place => place.ruleId === 'P01'), ownerId = place.mainIds[0], owner = before.state.landmarks.find(item => item.id === ownerId);
                const originalEvidence = (await read()).state.placeProgress.milestones.P01;
                await tapCell(page, (await read()).state, owner.cell); await page.locator('.growing-sheet').getByRole('button', { name: 'しまう', exact: true }).tap();
                const stored = await until(page, read, record => !record.state.landmarks.find(item => item.id === ownerId).cell, 'store original tree');
                assert.deepEqual(stored.state.placeProgress.milestones.P01, originalEvidence);
                const menu = await openGrowingMenu(page, { touch: true }); await menu.getByRole('button', { name: 'もちもの', exact: true }).tap();
                await page.locator(`[data-growing-stored="${ownerId}"]`).tap();
                await page.locator('.growing-tray').waitFor({ state: 'hidden' });
                await page.locator('.growing-placing').waitFor();
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                await tapCell(page, stored.state, owner.cell);
                const restored = await confirmStoredPlacement(page, read, ownerId, owner.cell), rejoined = restored.record;
                assert.deepEqual(rejoined.state.landmarks.find(item => item.id === ownerId), owner); assert.deepEqual(rejoined.state.placeProgress.milestones.P01, originalEvidence);
                storageRoundTrip = { ownerId, restoredCell: owner.cell, confirmationTaps: restored.confirmationTaps, originalEvidence, ownershipAndMaturityPreserved: true };
                await capture('stored-rejoined-history');
            }
            await page.reload(); await ready(page); const after = await read();
            assert.deepEqual(stateKernel(after.state), stateKernel(before.state)); assert.deepEqual(await readNative(page, id), learning);
            assert.deepEqual(errors, []);
            report.diagnostics.push({ id, viewport, synthetic: true, conditions: fixture.conditions, expected: fixture.expected, topology, uses, storageRoundTrip, before, after, pass: true });
        } catch (error) {
            await capture('first-failure').catch(() => {});
            report.firstFailure = { journey: 'explicit-mature-diagnostic', fixture: fixture.id, viewport, error: String(error), placeUse: error.placeUse,
                native: await nativeRecord(page, options.development ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1').catch(() => undefined),
                dom: await page.locator('body').innerText().catch(() => undefined), errors };
            throw error;
        } finally { await context.close(); }
    }
}

export async function main(args = process.argv.slice(2)) {
    const options = parseOptions(args), pack = await makePlacePack();
    if (options['diagnostic-case']) assert(pack.cases.some(fixture => fixture.id === options['diagnostic-case']), 'Select an actual diagnostic case from the immutable pack');
    const selectedDiagnosticRuns = VIEWPORTS.filter(viewport => !options['diagnostic-viewport'] || String(viewport.width) === options['diagnostic-viewport'])
        .flatMap(viewport => pack.cases.filter(fixture => !options['diagnostic-case'] || fixture.id === options['diagnostic-case']).map(fixture => ({ id: fixture.id, viewport })));
    if (options.plan) {
        const plan = { prepared: true, runtimeExecuted: false, schema: 'sansu-growing-place-e2e-v1', diagnosticCases: pack.cases.length, catalogLayouts: 15,
            combinations: 4, recordVersion: 4, currentTable: 'placedIslands', diagnosticPayloadHash: pack.payloadHash, sourceHash: pack.sourceHash, selectedDiagnosticRuns,
            actualJourneys: ['Real onboarding/21 answers/2 bought young trees/free six goals/connect/split/rejoin/same-plan return at390/768/320',
                '15 mature diagnostic layouts,4 relations,whole-island with actual rendered use at390/768; fixed Date and synthetic resources are explicit'],
            gates: { runtime: 'NOT_EXECUTED', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED', naturalSevenDayGrowth: 'NOT_EVALUATED', realDevice: 'NOT_EVALUATED' } };
        console.log(JSON.stringify(plan, null, 2)); return plan;
    }
    const out = path.resolve(options['output-dir']); await fs.mkdir(out, { recursive: false });
    const report = { schema: 'sansu-growing-place-e2e-v1', target: options.url, development: options.development, artCandidate: CANDIDATE, packHash: pack.payloadHash, domainSourceHash: pack.sourceHash,
        initialSources: await sourceManifest(), selectedDiagnosticRuns, acquired: [], diagnostics: [], layouts: [], captures: [], pass: false,
        gates: { runtime: 'NOT_EVALUATED', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED', naturalSevenDayGrowth: 'NOT_EVALUATED', realDevice: 'NOT_EVALUATED' } };
    if (options['build-dir']) {
        report.build = JSON.parse(await fs.readFile(path.join(options['build-dir'], 'version.json')));
        assert.deepEqual(await fetch(`${options.url}/version.json`).then(response => response.json()), report.build, 'Actual server must serve the specified fixed build');
        assert.equal(report.build.island?.enabled, true);
    }
    const browser = await chromium.launch();
    const captureFactory = (page, prefix) => async label => {
        const file = `${prefix}-${label}.png`;
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const metadata = await page.locator('.island-page').count() ? await runtimeMetadata(page) : { url: page.url(), onboarding: true, appRoot: await appRootMetadata(page) };
        assert.equal(metadata.appRoot.islandFeatureEnabled, true); assert.equal(metadata.appRoot.natureTownFeatureEnabled, false);
        assert(metadata.appRoot.revision && metadata.appRoot.version);
        if (metadata.revision) assert.equal(metadata.revision, metadata.appRoot.revision);
        if (report.build) { assert.equal(metadata.appRoot.version, report.build.version); assert.equal(metadata.appRoot.revision, report.build.revision); }
        const world = await page.locator('[data-growing-world]').count() ? await page.locator('[data-growing-world]').evaluate(world => ({ ...world.dataset })) : undefined;
        if (world) assert.equal(world.artCandidate, CANDIDATE);
        const pixels = await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
        report.captures.push({ file, hash: hash(pixels), metadata, world, cache: await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker.controller), online: navigator.onLine })) });
    };
    try {
        if (!options.diagnosticOnly) await acquiredJourney(browser, options, report, captureFactory);
        await diagnosticJourney(browser, options, report, pack, captureFactory);
        report.finalSources = await sourceManifest(); assert.deepEqual(report.finalSources, report.initialSources, 'App/QA source changed during formal evidence collection');
        assert.equal((await loadPlaceDomain()).sourceHash, pack.sourceHash);
        report.pass = true; report.gates.runtime = 'PASS';
        if (options.diagnosticOnly) report.acquiredNotExecuted = true;
    } catch (error) { report.error = String(error.stack || error).replace(/data:text\/javascript;base64,[\w+/=]+/g, '[compiled domain]'); report.gates.runtime = 'FAIL'; throw error; }
    finally {
        disposeProductionProjection();
        await browser.close(); await fs.writeFile(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
        await fs.writeFile(path.join(out, 'contact-sheet.html'), `<!doctype html><meta charset="utf-8"><title>Growing place actual app evidence</title><style>body{font:15px system-ui;background:#f5f6f8;color:#30364f}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%;max-height:650px;object-fit:contain;background:white}</style><h1>Actual app / ${CANDIDATE}</h1><p>Acquired journeys and explicit mature diagnostics are separately reported. Visual, child observation, natural 7-day growth and real-device gates are not inferred.</p><main>${report.captures.map(item => `<figure><img src="${item.file}"><figcaption>${item.file}</figcaption></figure>`).join('')}</main>`);
    }
    return report;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main().catch(error => { console.error(String(error.message)); process.exitCode = 1; });
