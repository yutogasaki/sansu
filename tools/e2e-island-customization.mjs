import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISLAND_CANDIDATE, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const viewports = [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }];
const appearanceSlots = ['sky', 'ground', 'shore', 'path', 'water', 'houseBody', 'houseRoof', 'houseWindows', 'tree', 'flower', 'mushroom', 'bridge'];
const categories = ['part', 'theme', 'set', 'accent'];
const partIds = ['sky', 'ground', 'water', 'house', 'plants', 'bridge'];
const expectedCandidates = { renderer: 'island-cosmetics-parts-v2', legacy: 'island-cosmetics-v1' };
const scope = [
    'Empty DB and actual onboarding/normal reserved answers earn stars on phone/tablet. No earned-flow progress or ownership fixture writes.',
    'Category browsing, unowned free preview on the same canvas, cancellation, target desire/clear and persisted cosmetics leave all native learning state and the exact pending reservation unchanged.',
    'Real earned accent costs 15; starry-bridge costs 5; starry bundle lists 60 with 5 owned and 55 remaining; completion set then costs 0. Total spending stays 75.',
    'Actual native exchange transaction abort rolls back every store; the explicit result-check button retries the same revision/action and creates only one receipt/charge.',
    'Actual service-worker offline reload, free re-equip, and a later real growth memory retain resolved appearance versions without an extra award.',
    'Separate named fixtures test historical credit (37 × 10), seven original direct ownership grants plus their derived parts/set rights, and paid legacy-v1 rendering until an explicit free parts-v1 application.',
];
const limitations = ['Human N=0; no child motivation, learning outcome or timing/P95 claim.',
    'This regression is not all spec39 paths: detailed 18-part/12-slot visual appeal, CAS across tabs, lost successful-commit response, all growth levels and saved-scene collision cases require their own evidence.',
    'Learning uses real enabled input readiness; its intentionally hidden 1×1 world canvas is not a world-render failure.'];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, viewports, categories, appearanceSlots, expectedCandidates, scope, limitations,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_BUILD_SOURCE', 'SANSU_CUSTOMIZATION_OUTPUT'],
        sourceRule: 'Run the QA and unchanged helpers from the same frozen manifest snapshot. Hash all manifest and QA files before/after; reject stale source or an existing output directory.',
        outputs: 'Versioned screenshots, native before/after snapshots at key boundaries and failures, receipt/learning-invariance checks, report.json.',
    }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_CUSTOMIZATION_OUTPUT;
assert(target && manifestPath && out, 'Set frozen production URL, source manifest, and a fresh customization output directory');
const sha = value => createHash('sha256').update(value).digest('hex');
const source = JSON.parse(await fs.readFile(manifestPath));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(source.snapshot), 'Run from the frozen snapshot, never mix live helpers with a frozen app');
assert.equal(await fs.realpath(process.cwd()), await fs.realpath(sourceRoot), 'Use the frozen snapshot as cwd: the independent learning answer oracle must compile that source too');
const qa = ['tools/e2e-island-customization.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...new Set([...source.files.map(file => file.path), ...qa.map(file => path.join(sourceRoot, file))])].sort()
    .map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const startedFiles = await fingerprint();
assert.deepEqual(source.files.filter(file => startedFiles.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out);
const version = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).json();
assert.equal(version.revision, source.revision);
assert(version.island.enabled); assert.equal(version.island.candidate, ISLAND_CANDIDATE);
const report = { target, version, sourceHash: source.sourceHash, startedAt: new Date().toISOString(),
    sourceRoot, sourceStart: sha(JSON.stringify(startedFiles)), captures: [], scenarios: [], nonLearningChecks: [], nativeSnapshots: [], humanN: 0,
    timingEvidenceEligible: false, pass: false, fullSpec39Passed: false, scope, limitations,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-image-review', silentComprehensionAndSafety: 'requires-human-review' } };
const { attempt } = await import('./island-learning-checks.mjs');
const { chromium } = await import('playwright');
const browser = await chromium.launch();
browser.on('disconnected', () => { report.browserDisconnectedAt = new Date().toISOString(); });
const stage = page => page.locator('[data-testid="island-stage"]').first();
const gallery = page => page.getByTestId('island-customization');
const item = (page, id) => page.locator(`[data-customization-id="${id}"]`);
const tapOrClick = (page, locator) => page.viewportSize().width === 390 ? locator.tap() : locator.click();
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitLearningInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const root = document.querySelector('[data-island-plan-id][data-input-ready="true"]'), answer = document.querySelector('.park-answer');
        return root && answer?.getBoundingClientRect().width > 20
            && (!expected || root.getAttribute('data-island-plan-id') === expected.id && Number(root.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(control => !control.disabled && control.getBoundingClientRect().height > 20);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
}
async function waitWorld(page) {
    assert.notEqual(await page.locator('.island-page').getAttribute('data-mode'), 'learning', 'World readiness is only required outside learning');
    await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const root = document.querySelector('[data-testid="island-stage"]'), canvas = root?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        return root?.getAttribute('data-renderer') === 'three' && box?.width > 100 && box?.height > 100 && canvas.width > 1
            && root.getAttribute('data-island-appearance') && root.getAttribute('data-camera-frame')?.split(',').length === 32;
    }); await painted(page);
}
async function settleRoute(page) {
    await waitReady(page);
    if (await page.locator('.island-page[data-mode="learning"]').count()) await waitLearningInput(page);
    else await waitWorld(page);
}
async function capture(page, name) {
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    if (mode === 'learning') await waitLearningInput(page);
    else await waitWorld(page);
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, version.revision); assert.equal(metadata.version, version.version);
    const cosmetics = await stage(page).evaluate(element => {
        const canvas = element.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        return { theme: element.dataset.islandTheme, accent: element.dataset.islandAccent,
            cosmeticsCandidate: element.dataset.customizationCandidate, geometries: Number(element.dataset.geometries), textures: Number(element.dataset.textures),
            appearance: JSON.parse(element.dataset.islandAppearance || 'null'),
            canvas: { width: canvas?.width, height: canvas?.height, cssWidth: box?.width, cssHeight: box?.height } };
    });
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, ...cosmetics, worldEvidence: mode !== 'learning' });
}
function styles(theme, version = theme === 'moon-garden' ? 'legacy-v1' : 'parts-v1') {
    return Object.fromEntries(appearanceSlots.map(slot => [slot, `${version}:${theme}:${slot}`]));
}
async function waitCosmetics(page, theme, accent = 'none', expected = styles(theme)) {
    await waitWorld(page);
    await page.waitForFunction(({ theme, accent, expected }) => {
        const root = document.querySelector('[data-testid="island-stage"]'), canvas = root?.querySelector('canvas');
        const actual = JSON.parse(root?.getAttribute('data-island-appearance') || 'null');
        return canvas?.getAttribute('data-island-theme') === theme && canvas.getAttribute('data-island-accent') === accent
            && actual?.slots.length === 12 && actual.slots.every(slot => slot.styleId === expected[slot.slot]);
    }, { theme, accent, expected });
    const actual = await stage(page).evaluate(root => JSON.parse(root.dataset.islandAppearance));
    assert.equal(actual.rendererCandidate, expectedCandidates.renderer); assert.equal(actual.legacyCompatibilityCandidate, expectedCandidates.legacy);
    return actual;
}
async function home(page) {
    if (await page.locator('.island-page[data-mode="learning"]').count()) await waitLearningInput(page);
    await idle(page);
    const close = gallery(page).getByRole('button', { name: 'きせかえを とじる', exact: true });
    await tapOrClick(page, await close.count() ? close : button(page, 'しまへ'));
    await waitMode(page, 'home'); await waitWorld(page);
}
async function openGallery(page) {
    await idle(page); await tapOrClick(page, button(page, 'きせかえ'));
    await waitMode(page, 'customization'); await gallery(page).waitFor(); await waitWorld(page);
}
function categoryFor(id) {
    if (['moon-garden', 'starry', 'candy', 'crystal'].includes(id)) return { kind: 'theme' };
    if (id.endsWith('-complete')) return { kind: 'set' };
    const part = partIds.find(part => id.endsWith(`-${part}`));
    return part ? { kind: 'part', part } : { kind: 'accent' };
}
async function choose(page, id) {
    await idle(page);
    const { kind, part } = categoryFor(id);
    if (await gallery(page).getAttribute('data-customization-category') !== kind)
        await tapOrClick(page, gallery(page).locator(`button[data-customization-category="${kind}"]`));
    if (part && await gallery(page).locator(`[data-appearance-part="${part}"]`).getAttribute('aria-pressed') !== 'true')
        await tapOrClick(page, gallery(page).locator(`[data-appearance-part="${part}"]`));
    await tapOrClick(page, item(page, id));
    await page.waitForFunction(id => document.querySelector(`[data-customization-id="${id}"]`)?.getAttribute('aria-pressed') === 'true', id);
    const fixed = await stage(page).evaluate(element => ({ x: element.getBoundingClientRect().x,
        scrollX, parentScroll: document.querySelector('.island-page').scrollLeft }));
    assert(fixed.x >= -.5 && fixed.scrollX === 0 && fixed.parentScroll === 0, `Selector must scroll its rail without shifting the island: ${JSON.stringify(fixed)}`);
}
/** Read all native stores in one readonly transaction, including actual photo Blob digests. */
async function allNative(page) {
    return page.evaluate(async () => {
        const req = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const rows = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve([name, request.result]); request.onerror = () => reject(request.error);
            })));
            await done;
            const value = async input => {
                if (input instanceof Blob) return { mime: input.type, bytes: input.size, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await input.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
                if (input instanceof Date) return { date: input.toISOString() };
                if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
                    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
                    return { binaryType: input.constructor.name, bytes: bytes.byteLength, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
                }
                if (Array.isArray(input)) return Promise.all(input.map(value));
                if (input && typeof input === 'object') return Object.fromEntries(await Promise.all(Object.entries(input).map(async ([key, item]) => [key, await value(item)])));
                return input;
            };
            return Object.fromEntries(await Promise.all(rows.map(async ([name, rows]) => [name, await value(rows)])));
        } finally { db.close(); }
    });
}
async function nativeCheckpoint(page, name) {
    const data = await allNative(page), file = `${name}.json`;
    await fs.writeFile(`${out}/${file}`, JSON.stringify(data, null, 2));
    report.nativeSnapshots.push({ file, sha256: sha(JSON.stringify(data)) });
    return data;
}
async function failureArtifacts(page, name) {
    // Do not wait for a working world/input to photograph the very failure under test.
    try { await nativeCheckpoint(page, `${name}-native`); } catch (error) { report.nativeCaptureError = error.message; }
    try {
        const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled', timeout: 10000 });
        const state = await page.evaluate(() => ({ mode: document.querySelector('.island-page')?.getAttribute('data-mode'),
            stages: [...document.querySelectorAll('[data-testid="island-stage"]')].map(node => ({ ...node.dataset })),
            alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent) }));
        report.captures.push({ file, sha256: sha(bytes), failure: true, ...state });
    } catch (error) { report.failureCaptureError = error.message; }
}
function assertOptionalChanges(before, after, label, goalAction) {
    assert.deepEqual(Object.keys(after), Object.keys(before), `${label}: native store inventory is unchanged`);
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name))
        assert.deepEqual(after[name], before[name], `${label}: optional operations preserve the entire native ${name} store`);
    const permitted = ['revision', 'updatedAt', 'customization', ...(goalAction ? ['rewardGoal'] : [])];
    const learningIsland = row => Object.fromEntries(Object.entries(row).filter(([key]) => !permitted.includes(key)));
    assert.deepEqual(after.islands.map(learningIsland), before.islands.map(learningIsland), `${label}: island learning/growth/items/optional content remain exact`);
    for (const event of before.islandEvents) assert.deepEqual(after.islandEvents.find(row => row.id === event.id), event, `${label}: old receipt is immutable`);
    const added = after.islandEvents.filter(row => !before.islandEvents.some(prior => prior.id === row.id));
    assert(added.every(row => row.type === (goalAction ? 'reward_goal_changed' : 'customization_changed')), `${label}: only the selected optional operation`);
    if (goalAction) {
        const prior = before.islands[0], current = after.islands[0];
        assert(prior.customization, 'The ordinary learning setup already materialized its wallet');
        assert(Number.isFinite(current.updatedAt) && current.updatedAt >= prior.updatedAt);
        const expected = { ...prior, revision: prior.revision + 1, updatedAt: current.updatedAt,
            customization: { ...prior.customization, desiredItemId: goalAction.type === 'choose' ? goalAction.target.itemId : null } };
        delete expected.rewardGoal;
        assert.deepEqual(current, expected, `${label}: goal saving changes no ownership, balance, appearance or learning`);
        assert.deepEqual(added, [{ id: JSON.stringify(['island-reward-goal-v1', prior.profileId, prior.revision]),
            profileId: prior.profileId, type: 'reward_goal_changed', timestamp: current.updatedAt, action: goalAction }]);
    }
    report.nonLearningChecks.push({ label, stores: Object.keys(before), addedReceipts: added.map(row => ({ id: row.id, action: row.action })), pass: true });
    return added;
}
async function persist(page, action) {
    await idle(page);
    const before = await allNative(page);
    assert.equal(before.islands.length, 1, 'This fixture owns exactly one island');
    const goalAction = action === 'desire' ? { type: 'choose', target: { category: 'customization', itemId: await gallery(page).getAttribute('data-selected-item') } }
        : action === 'clear-desire' ? { type: 'clear' } : undefined;
    await tapOrClick(page, gallery(page).locator(`[data-customization-action="${action}"]`));
    await page.waitForFunction(revision => Number(document.querySelector('.island-page')?.getAttribute('data-island-revision')) > revision, before.islands[0].revision);
    await idle(page); await painted(page);
    const receipts = assertOptionalChanges(before, await allNative(page), `${page.viewportSize().width}:${action}`, goalAction);
    assert.equal(receipts.length, 1, 'One confirmed optional action persists one receipt');
    assert.equal(receipts[0].id, JSON.stringify([goalAction ? 'island-reward-goal-v1' : 'island-customization-v1', before.islands[0].profileId, before.islands[0].revision]));
}
const purchase = page => persist(page, 'purchase');
const equip = page => persist(page, 'equip');
async function quote(page, price, listPrice = price) {
    const choice = gallery(page).locator('.island-customization-choice');
    assert.equal((await choice.locator('[data-customization-action="purchase"] .island-customization-stars > span').innerText()).replace(/\s/g, ''), `${price}こ`);
    const credit = choice.locator('.island-customization-credit');
    if (price < listPrice) assert.deepEqual(await credit.locator('.island-customization-stars > span').allTextContents(), [`${listPrice}こ`, `${listPrice - price}こ`]);
    else assert.equal(await credit.count(), 0);
}
async function learn(page) {
    const before = await allNative(page), reserved = (await readNative(page)).plan;
    await idle(page); await tapOrClick(page, page.getByRole('button', { name: /^(つづきから とく|まなぶ)$/ }));
    await waitLearningInput(page, reserved);
    if (reserved) assert.deepEqual(await allNative(page), before, 'Returning to a saved reservation cannot change any native state');
}
async function finishSection(page, state) {
    const plan = state.plan, previous = state.island.completedSets;
    const points = state.island.customization?.points ?? previous * 10;
    for (let steps = 0; state.plan?.id === plan.id; steps++) {
        assert(steps < 80, 'Normal reserved section must finish');
        state = (await attempt(page, state, { touch: page.viewportSize().width === 390 })).after;
    }
    assert.equal(state.island.completedSets, previous + 1);
    assert.equal(state.island.customization.points, points + (plan.rewardPacing === 'answers-v1' ? plan.slots.length : 10));
    assert.equal(state.island.pendingRewards.length, 0);
    assert.equal(state.plan.cursor, 0);
    await waitLearningInput(page, state.plan);
    return state;
}
async function assertGalleryGeometry(page) {
    const geometry = await gallery(page).evaluate(root => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        controls: [...root.querySelectorAll('button')].map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: rect.width, height: rect.height };
        }),
    }));
    assert.equal(geometry.overflow, false);
    geometry.controls.forEach(control => assert(control.width >= 44 && control.height >= 44, JSON.stringify(control)));
    return geometry;
}
async function failNextPurchase(page) {
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, ...args) {
            if (this.name === 'islands' && value.customization?.ownedItemIds.includes('starry')) {
                IDBObjectStore.prototype.put = original;
                this.transaction.abort();
            }
            return original.call(this, value, ...args);
        };
    });
}
async function historicalFixture(layout, earned) {
    const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const name = `${layout.name}-historical-credit-fixture`;
    try {
        await page.goto(`${target}/#/island`); await settleRoute(page);
        const id = await seedNative(page, `cosmetics-legacy-${layout.name}`);
        const fixture = structuredClone(earned);
        fixture.profileId = id; fixture.completedSets = 37;
        delete fixture.customization; delete fixture.pendingPlanId;
        await page.evaluate(async fixture => {
            const req = indexedDB.open('SansuDatabase');
            const database = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
            const tx = database.transaction('islands', 'readwrite'); tx.objectStore('islands').put(fixture);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); database.close();
        }, fixture);
        await page.goto(`${target}/#/island`); await settleRoute(page);
        if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
        await waitMode(page, 'home');
        await openGallery(page);
        for (const id of ['starry', 'candy', 'crystal', 'star-lanterns', 'candy-flags', 'crystal-charms']) {
            await choose(page, id); await purchase(page);
        }
        let state = await readNative(page, id);
        assert.equal(state.island.customization.points, 0);
        assert.equal(new Set(state.island.customization.ownedItemIds).size, 7);
        const inheritedBefore = await allNative(page);
        for (const family of ['starry', 'candy', 'crystal']) {
            for (const part of partIds) {
                await choose(page, `${family}-${part}`);
                assert.match(await item(page, `${family}-${part}`).innerText(), /もっている/);
                assert.equal(await gallery(page).locator('[data-customization-action="purchase"]').count(), 0, 'Old bundle grants its part without a second exchange');
            }
            await choose(page, `${family}-complete`);
            assert.match(await item(page, `${family}-complete`).innerText(), /もっている/);
            assert.equal(await gallery(page).locator('[data-customization-action="purchase"]').count(), 0);
        }
        assert.deepEqual(await allNative(page), inheritedBefore, 'Reading inherited ownership never materializes extra grants or charges');
        await capture(page, `${name}-all-owned`);
        await home(page); await page.reload(); await settleRoute(page);
        if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
        await waitMode(page, 'home');
        assert.equal((await readNative(page, id)).island.customization.points, 0, 'Legacy credit cannot reappear after spending/reload');
        await waitCosmetics(page, 'crystal', 'crystal-charms');
        await openGallery(page); await choose(page, 'candy'); await equip(page);
        await choose(page, 'star-lanterns'); await equip(page);
        await home(page); await waitCosmetics(page, 'candy', 'star-lanterns');
        await capture(page, `${name}-mixed-set`);
        await learn(page); state = await finishSection(page, await readNative(page, id));
        assert.equal(state.island.customization.points, (() => { const plan = state.islandPlans.find(plan => plan.status === 'completed'); return plan.rewardPacing === 'answers-v1' ? plan.slots.length : 10; })(), 'All-owned child can continue learning and keep earned stars');
        await capture(page, `${name}-learning`);
        report.scenarios.push({ name, synthetic: true, completedSetsFixture: 37, originalDirectGrants: 7, inheritedParts: 18, inheritedSets: 3, allOwned: true, noRecredit: true, continued: true, pass: true });
    } catch (error) { await failureArtifacts(page, `${name}-failure`); throw error; }
    finally { await context.close(); }
}

async function legacyOwnedFixture(layout, earned) {
    const name = `${layout.name}-legacy-owned-fixture`;
    const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
        await page.goto(`${target}/#/island`); await settleRoute(page);
        const id = await seedNative(page, `old-theme-${layout.name}`), fixture = structuredClone(earned);
        fixture.profileId = id; delete fixture.pendingPlanId;
        fixture.customization = { version: 1, points: 0, ownedItemIds: ['moon-garden', 'starry'], desiredItemId: null, themeId: 'starry', accentId: null };
        await page.evaluate(async fixture => {
            const req = indexedDB.open('SansuDatabase');
            const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
            const tx = db.transaction('islands', 'readwrite'); tx.objectStore('islands').put(fixture);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
        }, fixture);
        const beforeOpen = await nativeCheckpoint(page, `${name}-before-open`);
        await page.reload(); await settleRoute(page); await waitMode(page, 'home');
        const oldStyle = styles('starry', 'legacy-v1');
        await waitCosmetics(page, 'starry', 'none', oldStyle);
        assert.deepEqual(await allNative(page), beforeOpen, 'Opening old ownership cannot materialize appearance, grants or award historical credit again');
        await capture(page, `${name}-old-visible`);
        await openGallery(page);
        const legacy = await waitCosmetics(page, 'starry', 'none', oldStyle);
        await choose(page, 'starry-sky');
        assert.equal(await gallery(page).locator('[data-customization-action="purchase"]').count(), 0);
        await waitCosmetics(page, 'starry', 'none', { ...oldStyle, sky: 'parts-v1:starry:sky' });
        assert.deepEqual(await allNative(page), beforeOpen, 'Explicit free preview still keeps the old saved version');
        await capture(page, `${name}-new-sky-preview`);
        await home(page); await waitCosmetics(page, 'starry', 'none', oldStyle);
        await openGallery(page); await choose(page, 'starry-sky'); await equip(page);
        const mixed = { ...oldStyle, sky: 'parts-v1:starry:sky' };
        const actual = await waitCosmetics(page, 'starry', 'none', mixed);
        for (const previous of legacy.slots.filter(slot => slot.slot !== 'sky')) {
            const current = actual.slots.find(slot => slot.slot === previous.slot);
            assert.equal(current.geometrySignature, previous.geometrySignature); assert.equal(current.materialSignature, previous.materialSignature);
        }
        const saved = await readNative(page, id);
        assert.equal(saved.island.customization.points, 0); assert.deepEqual(saved.island.customization.ownedItemIds, ['moon-garden', 'starry']);
        assert.deepEqual(saved.island.customization.appearance.slots, mixed);
        await home(page); await page.reload(); await settleRoute(page); await waitCosmetics(page, 'starry', 'none', mixed);
        await capture(page, `${name}-explicit-mix-persisted`); await nativeCheckpoint(page, `${name}-final-native`);
        report.scenarios.push({ name, synthetic: true, legacyVersionPreservedUntilExplicitApply: true, freeInheritedSky: true, paid: 0, otherElevenSlotsUnchanged: true, pass: true });
    } catch (error) { await failureArtifacts(page, `${name}-failure`); throw error; }
    finally { await context.close(); }
}

try {
    for (const layout of viewports) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone',
            serviceWorkers: 'allow', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let earned;
        try {
            await page.goto(`${target}/#/island`); await settleRoute(page);
            await capture(page, `${layout.name}-01-welcome`);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitLearningInput(page);
            let state = await readNative(page);
            const id = state.island.profileId;
            await capture(page, `${layout.name}-02-learning`);
            state = await finishSection(page, state);
            assert.equal(state.island.customization.points, 3);
            await home(page); await capture(page, `${layout.name}-03-first-stars`);
            await openGallery(page);
            const previewBefore = await readNative(page, id), previewAllBefore = await nativeCheckpoint(page, `${layout.name}-preview-before`);
            await stage(page).locator('canvas').evaluate(canvas => { canvas.dataset.previewIdentity = 'same-scene'; });
            const sceneResources = [];
            for (const [index, theme] of ['starry', 'candy', 'crystal', 'moon-garden', 'starry', 'candy', 'crystal', 'moon-garden'].entries()) {
                await choose(page, theme); await waitCosmetics(page, theme);
                assert.equal(await stage(page).locator('canvas').getAttribute('data-preview-identity'), 'same-scene');
                await stage(page).scrollIntoViewIfNeeded();
                await capture(page, `${layout.name}-preview-${index}-${theme}`);
                if (theme === 'moon-garden') sceneResources.push(await stage(page).evaluate(el => ({ g: +el.dataset.geometries, t: +el.dataset.textures })));
            }
            assert.deepEqual(sceneResources[0], sceneResources[1], 'Repeated theme preview returns to stable renderer resources');
            assert.deepEqual(await readNative(page, id), previewBefore, 'Preview never writes currency, ownership, learning or discovery');
            assert.deepEqual(await allNative(page), previewAllBefore, 'Category browsing and all unowned previews leave every native store exact');
            await home(page); await waitCosmetics(page, 'moon-garden');
            assert.deepEqual((await readNative(page, id)).island.customization, previewBefore.island.customization);
            await openGallery(page); await choose(page, 'crystal');
            await persist(page, 'desire');
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, 'crystal');
            await choose(page, 'crystal'); await persist(page, 'clear-desire');
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, null);
            await choose(page, 'starry'); await persist(page, 'desire');
            assert.equal((await readNative(page, id)).island.customization.desiredItemId, 'starry');
            const controls = await assertGalleryGeometry(page);
            await choose(page, 'star-lanterns');
            assert.equal(await gallery(page).locator('[data-customization-action="purchase"]').isDisabled(), true, 'One opening section cannot buy an accent');
            await home(page); await learn(page);
            state = await readNative(page, id);
            for (let i = 0; state.island.customization.points < 15; i++) {
                assert(i < 5); state = await finishSection(page, state);
            }
            const accentBalance = state.island.customization.points;
            await home(page); await openGallery(page); await choose(page, 'star-lanterns'); await purchase(page);
            assert.equal((await readNative(page, id)).island.customization.points, accentBalance - 15);
            await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            await capture(page, `${layout.name}-04-first-accent`);
            await persist(page, 'clear-accent');
            await waitCosmetics(page, 'moon-garden');
            assert((await readNative(page, id)).island.customization.ownedItemIds.includes('star-lanterns'));
            await choose(page, 'star-lanterns'); await equip(page);
            await home(page); await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            await capture(page, `${layout.name}-05-wanted-goal`);
            const wanted = page.getByTestId('island-customization-goal');
            assert.equal(await wanted.getAttribute('data-reward-goal-category'), 'customization');
            assert.equal(await wanted.getAttribute('data-reward-goal-item'), 'starry');
            const beforeGoalOpen = await allNative(page);
            await tapOrClick(page, wanted); await gallery(page).waitFor({ state: 'visible' }); await painted(page);
            assert.equal(await gallery(page).getAttribute('data-selected-item'), 'starry');
            assert.deepEqual(await allNative(page), beforeGoalOpen, 'Opening the selected reward preserves every native store');
            await home(page);
            await learn(page);
            state = await readNative(page, id);
            for (let i = 0; state.island.customization.points < 60; i++) {
                assert(i < 21); state = await finishSection(page, state);
            }
            const themeBalance = state.island.customization.points - 60;
            await home(page); await openGallery(page); await choose(page, 'starry-bridge'); await quote(page, 5); await purchase(page);
            assert.equal((await readNative(page, id)).island.customization.points, themeBalance + 55);
            const mixedStyles = { ...styles('moon-garden'), bridge: 'parts-v1:starry:bridge' };
            const bridgeAppearance = await waitCosmetics(page, 'moon-garden', 'star-lanterns', mixedStyles);
            await capture(page, `${layout.name}-06-part-earned`);
            await choose(page, 'starry-complete'); await quote(page, 55, 75);
            await choose(page, 'starry'); await quote(page, 55, 60);
            await capture(page, `${layout.name}-06-owned-credit`);
            const beforeFailed = await readNative(page, id), failedAllBefore = await nativeCheckpoint(page, `${layout.name}-abort-before`);
            await failNextPurchase(page);
            await tapOrClick(page, gallery(page).locator('[data-customization-action="purchase"]'));
            await gallery(page).locator('.island-customization-error').waitFor();
            await gallery(page).locator('[data-customization-action="retry"]').waitFor(); await idle(page);
            assert.deepEqual(await readNative(page, id), beforeFailed, 'Native transaction abort rolls back the complete exchange');
            assert.deepEqual(await nativeCheckpoint(page, `${layout.name}-abort-after`), failedAllBefore, 'Native abort leaves all stores exact');
            await capture(page, `${layout.name}-06-save-retry`);
            await persist(page, 'retry');
            const afterRetry = await allNative(page), receiptId = JSON.stringify(['island-customization-v1', id, beforeFailed.island.revision]);
            const retriedReceipt = afterRetry.islandEvents.filter(event => event.id === receiptId);
            assert.equal(retriedReceipt.length, 1); assert.deepEqual(retriedReceipt[0].action, { type: 'purchase', itemId: 'starry' });
            state = await readNative(page, id);
            assert.equal(state.island.customization.points, themeBalance);
            assert.equal(state.island.customization.themeId, 'starry');
            assert.equal(state.island.customization.desiredItemId, null);
            await waitCosmetics(page, 'starry', 'star-lanterns');
            await capture(page, `${layout.name}-07-theme-earned`);
            await choose(page, 'starry-complete');
            assert.equal(await gallery(page).locator('[data-customization-action="purchase"]').count(), 0, 'An already complete set never charges again');
            assert.equal(await gallery(page).locator('[data-customization-action="equip"]').isDisabled(), true, 'The matching theme/accent set is already applied');
            await gallery(page).getByTestId('island-customization-sets').waitFor();
            await home(page); await capture(page, `${layout.name}-08-live-island`);
            const beforeOffline = await nativeCheckpoint(page, `${layout.name}-offline-before`);
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.reload(); await settleRoute(page);
            assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Use the real installed service worker');
            await context.setOffline(true); await page.reload(); await settleRoute(page);
            // Stored learning reservations resume automatically on new document.
            if (await page.locator('.island-page[data-mode="learning"]').count()) await home(page);
            await waitCosmetics(page, 'starry', 'star-lanterns');
            assert.deepEqual(await nativeCheckpoint(page, `${layout.name}-offline-after`), beforeOffline, 'Reload/offline entry preserves every native table and the exact reserved question');
            await openGallery(page); await choose(page, 'moon-garden'); await equip(page); await home(page);
            await waitCosmetics(page, 'moon-garden', 'star-lanterns');
            assert.equal((await readNative(page, id)).island.customization.points, themeBalance);
            await openGallery(page); await choose(page, 'starry'); await equip(page); await home(page);
            await learn(page);
            state = await readNative(page, id);
            const memoriesBefore = state.island.growth.memories.map(memory => memory.id);
            for (let i = 0; state.island.growth.memories.every(memory => memoriesBefore.includes(memory.id)); i++) {
                assert(i < 22); state = await finishSection(page, state);
            }
            earned = state.island;
            const latest = earned.growth.memories.at(-1);
            assert.equal(latest.cosmetics.themeId, 'starry'); assert.equal(latest.cosmetics.accentId, 'star-lanterns');
            assert.deepEqual(latest.cosmetics.appearance?.slots, styles('starry'), 'New earned history freezes every resolved rendering version');
            await home(page); await button(page, 'アルバム').click(); await waitMode(page, 'album');
            assert.equal(await page.locator('[data-memory-current] [data-testid="island-stage"]').getAttribute('data-island-theme'), 'starry');
            await page.locator('[data-memory-current] [data-testid="island-stage"]').scrollIntoViewIfNeeded();
            await page.waitForFunction(expected => {
                const root = document.querySelector('[data-memory-current] [data-testid="island-stage"]');
                const actual = JSON.parse(root?.getAttribute('data-island-appearance') || 'null');
                return actual?.slots.length === 12 && actual.slots.every(slot => slot.styleId === expected[slot.slot]);
            }, styles('starry'));
            await capture(page, `${layout.name}-09-album`);
            await nativeCheckpoint(page, `${layout.name}-earned-final-native`);
            assert.deepEqual(errors, []);
            report.scenarios.push({ name: `${layout.name}-earned-flow`, synthetic: false, completedSets: earned.completedSets,
                starsEarned: earned.customization.points + 75, starsSpent: 75, controls, stableResources: sceneResources, realOfflineReloadAndEquip: true,
                remainingQuote: { originalTheme: 60, ownedBridge: 5, themePaid: 55, accentPaid: 15 },
                bridgeVisibility: bridgeAppearance.slots.find(slot => slot.slot === 'bridge').visibleMeshCount,
                sameRevisionRetryReceipt: retriedReceipt[0], errors, pass: true });
        } catch (error) { await failureArtifacts(page, `${layout.name}-failure`); throw error; }
        finally { await context.close(); }
        await historicalFixture(layout, earned);
        await legacyOwnedFixture(layout, earned);
    }
    report.pass = true; report.gates.runtimeIntegrity = 'selected-regression-passed';
} catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
    await browser.close();
    const endedFiles = await fingerprint();
    report.sourceEnd = sha(JSON.stringify(endedFiles));
    report.sourceUnchanged = report.sourceStart === report.sourceEnd;
    report.pass &&= report.sourceUnchanged;
    if (!report.pass) { process.exitCode = 1; report.gates.runtimeIntegrity = 'failed-or-incomplete'; }
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.length, captures: report.captures.length, error: report.error?.message, out }));
}
