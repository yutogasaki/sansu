import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertDiscoveryDelta } from './island-qualified-audit.mjs';
import { assertGoalMutation, assertGoalPurchase, assertOrdinaryAnswerWorldPreserved, goalOf, emptyExpression } from './island-reward-goal-audit.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const choices = [{ category: 'customization', itemId: 'starry-bridge' }, { category: 'furniture', kind: 'hammock' },
    { category: 'expression', itemId: 'shell-three-notes' }];
const cover = { category: 'expression', itemId: 'leaf-album-cover' };
const scope = [
    'Empty DB, real setup and first three answers; no state, balance, qualification or geometry fixtures.',
    'Choose/clear/replace/reopen three goal categories for free; legacy desiredItemId and new rewardGoal have canonical reward_goal_changed receipts.',
    'Unqualified zero-star shell remains unavailable. Enough stars never grant a goal automatically.',
    'Complete only enough ordinary sections for at least 35 stars; explicitly acquire bridge 5, hammock 25 and album cover 5. Each matching goal clears.',
    'Preview/cancel/reopen keep all native stores unchanged, except independently proven visible home discoveries. Every learning field remains exact.',
    'Resume the identical reserved plan, submit one real answer, reload and compare all stores.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, viewports, scope,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_REWARD_GOALS_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: ['SANSU_ISLAND_REWARD_GOALS_QA_ROOT', 'SANSU_ISLAND_REWARD_GOALS_HEADED'],
        source: 'Snapshot app and unchanged four shared helpers; dedicated QA/audit closure separately hashed before/after.',
        limits: ['Audio, all visitors/works, item usage and long qualification paths are outside this short run.',
            'Photo stores begin empty: preserving these stores is checked; nonempty photo-byte preservation has separate evidence.',
            'Human N=0; rendered screenshots require human visual review. This does not pass the whole goal.'] }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, ''), out = process.env.SANSU_ISLAND_REWARD_GOALS_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Frozen URL, manifest and fresh output required');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length);
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_REWARD_GOALS_QA_ROOT || manifest.snapshot));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const helpers = ['tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs', 'tools/island-qualified-audit.mjs'];
const qaFiles = ['tools/e2e-island-reward-goals.mjs', 'tools/island-reward-goal-audit.mjs', ...helpers];
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)),
    qa: await hashFiles(qaFiles.map(file => path.join(sourceRoot, file))),
    bundleApp: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleApp.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256, file.sha256, file.relative);
for (const relative of helpers) assert.equal(initialSource.qa.find(entry => entry.path === path.join(sourceRoot, relative))?.sha256,
    manifest.files.find(file => file.relative === relative)?.sha256, `Frozen helper differs: ${relative}`);
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { pass: false, target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(),
    fullGoalPassed: false, humanN: 0, applicationDataInjected: false, photoScope: 'empty stores retained; nonempty bytes separate', scope,
    sources: { app: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)) } }, initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
}

/** One transaction reads every native store; actual Blob bytes are hashed after it completes. */
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
const digestTables = state => Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, { rows: rows.length, sha256: sha(JSON.stringify(rows)) }]));
const islandFor = (state, owner) => state.islands.find(island => island.profileId === owner);


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
const idOf = item => item.kind ?? item.itemId;
const customs = page => page.getByTestId('island-customization');
const furniture = page => page.locator('section[aria-label="くらしの どうぐ"]');
const expression = page => page.locator('section[aria-label="みじたくと コレクション"]');
const goalButton = (page, item, action) => page.locator(`button[data-reward-goal-action="${action}"][data-reward-goal-category="${item.category}"][data-reward-goal-item="${idOf(item)}"]`);
const homeGoal = page => page.locator('.island-home-controls [data-testid="island-customization-goal"]');
async function capture(page, row, name) {
    const file = `${row.name}-${String(row.captures++).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    const entry = { name, file, metadata: await runtimeMetadata(page), rendered: await stage(page).count() ? await stage(page).evaluate(host => ({ frame: host.dataset.frameTimestamp,
        camera: host.dataset.cameraFrame, appearance: JSON.parse(host.dataset.islandAppearance || 'null') })).catch(() => null) : null };
    assert.equal(entry.metadata.revision, manifest.revision); report.captures.push(entry);
    console.log(JSON.stringify({ viewport: row.name, checkpoint: name, answers: row.answerCount, file }));
}
async function checkRead(page, row, name, before) {
    const after = await tables(page); let records;
    try {
        records = assertDiscoveryDelta(before, after, row.owner);
        const audit = await page.evaluate(() => window.__qualifiedObservations);
        assert.deepEqual(audit.errors, []);
        for (const record of records) {
            const commit = audit.commits.find(entry => entry.event.profileId === row.owner && entry.event.discoveryId === record.id);
            assert(commit?.before, 'Only native complete discovery transactions may accompany a read/navigation');
            assert.deepEqual(commit.operations.map(entry => entry.store).sort(), ['islandEvents', 'islands']);
            const saved = commit.operations.find(entry => entry.store === 'islands').value;
            assertDiscoveryDelta({ islands: [commit.before], islandEvents: [] }, { islands: [saved], islandEvents: [commit.event] }, row.owner);
            const frame = audit.frames.find(entry => entry.activity.discoveryId === record.id && entry.activity.itemId === record.itemId
                && !entry.hidden && entry.at <= commit.at && ['home', 'play', 'viewing', 'camera'].includes(entry.mode));
            assert(frame && Number.isFinite(frame.timestamp) && frame.activity.natureVisible && frame.activity.natureReady);
            if (!row.observations.some(entry => entry.id === record.id)) {
                const file = `${row.name}-${record.id}-natural-ready.png`; await fs.writeFile(path.join(out, file), Buffer.from(frame.png.split(',')[1], 'base64'));
                row.observations.push({ id: record.id, itemId: record.itemId, nativeCommit: commit.event, commitAt: commit.at, frame: { ...frame, png: undefined, file } });
            }
        }
        row.databaseChecks.push({ name, pass: true, permittedDiscoveries: records.map(record => record.id), before: digestTables(before), after: digestTables(after) });
    } finally { await fs.writeFile(`${out}/${row.name}-DB-${row.databaseChecks.length}-${name}.json`, JSON.stringify({ before, after }, null, 2)); }
    return after;
}
async function readOnly(page, row, name, action) { const before = await tables(page); await action(); await idle(page); await painted(page); return checkRead(page, row, name, before); }
async function waitRevision(page, row, revision) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { if ((await readNative(page, row.owner)).island.revision >= revision) { await idle(page); return; } await pause(40); }
    throw new Error(`Missing native revision ${revision}`);
}
async function mutate(page, row, name, action, control, purchase) {
    const before = await tables(page), old = islandFor(before, row.owner); await activate(control, row.touch); await waitRevision(page, row, old.revision + 1);
    const after = await tables(page);
    try {
        const receipt = purchase ? assertGoalPurchase(before, after, row.owner, purchase.category, purchase.slot) : assertGoalMutation(before, after, row.owner, action);
        row.databaseChecks.push({ name, pass: true, receipt, before: digestTables(before), after: digestTables(after) });
    } finally { await fs.writeFile(`${out}/${row.name}-mutation-${name}.json`, JSON.stringify({ before, after }, null, 2)); }
    return after;
}
async function selected(page, item) {
    const locator = item.category === 'customization' ? customs(page) : item.category === 'furniture' ? furniture(page) : expression(page);
    const attr = item.category === 'customization' ? 'data-selected-item' : item.category === 'furniture' ? 'data-furniture-kind' : 'data-expression-item';
    await locator.locator(`xpath=self::*[@${attr}="${idOf(item)}"]`).waitFor(); await idle(page); await painted(page);
}
async function openItem(page, row, item) {
    await readOnly(page, row, `open-${idOf(item)}`, async () => {
        if (item.category === 'customization') {
            await press(page, row, 'きせかえ'); await waitMode(page, 'customization');
            await activate(customs(page).locator('button[data-customization-category="part"]'), row.touch);
            await activate(customs(page).locator('[data-appearance-part="bridge"]'), row.touch);
            await activate(customs(page).locator('[data-customization-id="starry-bridge"]'), row.touch);
        } else if (item.category === 'furniture') {
            await press(page, row, 'もちもの'); await waitMode(page, 'inventory');
            await press(page, row, 'くらしの どうぐを みる'); await waitMode(page, 'furniture');
            await activate(furniture(page).locator('[data-furniture-choice="hammock"]'), row.touch);
        } else {
            await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
            await activate(page.getByTestId('island-experience').locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
            await press(page, row, item.itemId === 'shell-three-notes' ? 'けしきと おと' : 'おもいで', expression(page));
            await activate(expression(page).locator(`[data-expression-choice="${item.itemId}"]`), row.touch);
        }
        await selected(page, item);
    });
}
async function closeItem(page, row, item) {
    await readOnly(page, row, `close-${idOf(item)}`, async () => {
        await press(page, row, item.category === 'customization' ? 'きせかえから もどる' : item.category === 'furniture' ? 'どうぐから もどる' : 'みじたくから もどる');
        if (item.category === 'expression') { await waitMode(page, 'experience'); await press(page, row, 'なまえ・けしきから もどる', page.getByTestId('island-experience')); }
        await waitMode(page, 'home');
    });
}
async function choose(page, row, item, clear = false) {
    const action = clear ? { type: 'clear' } : { type: 'choose', target: item };
    const after = await mutate(page, row, `${row.databaseChecks.length}-${clear ? 'clear' : 'choose'}-${idOf(item)}`, action, goalButton(page, item, clear ? 'clear' : 'choose'));
    assert.deepEqual(goalOf(islandFor(after, row.owner)), clear ? null : item);
    const current = goalButton(page, item, clear ? 'choose' : 'clear'); await current.waitFor(); assert.equal(await current.getAttribute('aria-pressed'), String(!clear));
}
async function reopen(page, row, item) {
    await waitMode(page, 'home'); const card = homeGoal(page); await card.waitFor();
    assert.equal(await card.getAttribute('data-reward-goal-category'), item.category); assert.equal(await card.getAttribute('data-reward-goal-item'), idOf(item));
    await readOnly(page, row, `reopen-${idOf(item)}`, async () => { await activate(card, row.touch); await selected(page, item); });
    assert.equal(await goalButton(page, item, 'clear').getAttribute('aria-pressed'), 'true');
}
async function assertBridgePreview(page, saved = false) {
    await waitWorld(page); await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]')?.dataset.islandAppearance || 'null')?.slots
        .find(slot => slot.slot === 'bridge')?.styleId === 'parts-v1:starry:bridge');
    assert.equal(await customs(page).getAttribute('data-preview'), String(!saved));
}
async function firstSection(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, row, 'まなぶ'); await page.locator('.island-setup-name input').fill(`ほしいもの${row.name}`);
    await press(page, row, '年中'); await press(page, row, 'さんすう');
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page); row.owner = native.plan.profileId;
    while (native.island.completedSets < 1 || native.plan.cursor !== 0) { native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; assert(++row.answerCount <= 3); }
    assert.equal(row.answerCount, 3); assert.equal(native.island.customization.points, 3);
    row.firstSection = { answers: 3, fixture: false, reservation: native.plan, receipts: native.islandEvents.filter(event => event.type === 'answer').map(event => event.id) };
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await capture(page, row, 'first-three-answers');
}
async function resume(page, row) {
    await waitMode(page, 'home'); const native = await readNative(page, row.owner), plan = native.plan;
    assert.equal(native.island.pendingPlanId, plan.id); assert.equal(plan.status, 'active');
    const start = page.locator('.island-home-controls .island-start'); assert.equal((await start.innerText()).trim(), 'つづきから とく');
    await readOnly(page, row, `same-reservation-${row.answerCount}`, async () => { await activate(start, row.touch); await waitLearningInput(page, plan);
        assert.deepEqual((await readNative(page, row.owner)).plan, plan); });
    return plan;
}
async function earnEnough(page, row) {
    for (let sections = 0; sections < 20; sections++) {
        const before = await readNative(page, row.owner);
        assert.deepEqual(goalOf(before.island), choices[0]); assert(!before.island.customization.ownedItemIds.includes('starry-bridge'));
        assert(!before.island.items.some(item => item.kind === 'hammock')); assert.deepEqual(before.island.expression?.ownedItemIds ?? [], []);
        if (before.island.customization.points >= 35) { row.earned = { points: before.island.customization.points, answers: row.answerCount, completedSets: before.island.completedSets, automaticGrant: false }; return; }
        const plan = await resume(page, row); let native = await readNative(page, row.owner), count = 0;
        while (native.plan.id === plan.id) { native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; assert(++count < 80); assert(++row.answerCount < 90); }
        assert.equal(native.island.completedSets, before.island.completedSets + 1);
        assert.deepEqual(goalOf(native.island), choices[0]);
        row.sections.push({ planId: plan.id, answers: count, completedSets: native.island.completedSets, points: native.island.customization.points });
        await press(page, row, 'しまへ'); await waitMode(page, 'home');
    }
    throw new Error('Insufficient points within bounded ordinary sections');
}
async function run(page, row) {
    await firstSection(page, row);
    for (const item of choices) {
        await openItem(page, row, item); await choose(page, row, item);
        if (item.category === 'customization') { await assertBridgePreview(page); await capture(page, row, 'goal-save-retains-bridge-preview'); }
        if (item.itemId === 'shell-three-notes') {
            assert(await expression(page).locator('[data-expression-action="acquire"]').isDisabled());
            await readOnly(page, row, 'unqualified-shell-preview-cancel', async () => {
                await activate(expression(page).locator('[data-expression-action="preview"]'), row.touch);
                await expression(page).locator('.island-expression-preview').waitFor(); await capture(page, row, 'unqualified-shell-preview');
                await press(page, row, 'いまに もどす', expression(page));
            });
        }
        await closeItem(page, row, item); await capture(page, row, `${idOf(item)}-home-goal`);
        const text = await homeGoal(page).innerText();
        if (item.itemId === 'shell-three-notes') { assert(text.includes('こうさくで かいの おとを みとどける')); assert(text.includes('0 ほし')); assert(!text.includes('もらえるよ')); }
        else assert(text.includes(`あと ${item.category === 'furniture' ? 22 : 2} ほし`));
        await reopen(page, row, item); await choose(page, row, item, true); await closeItem(page, row, item); assert.equal(await homeGoal(page).count(), 0);
    }
    // Cross-category replacement proves there is only one saved goal.
    await openItem(page, row, choices[1]); await choose(page, row, choices[1]); await closeItem(page, row, choices[1]);
    await openItem(page, row, choices[0]); await choose(page, row, choices[0]); await closeItem(page, row, choices[0]);
    await earnEnough(page, row); await capture(page, row, 'enough-stars-still-unowned');
    assert((await homeGoal(page).innerText()).includes('こうかん できるよ'));
    for (const item of [choices[0], choices[1], cover]) {
        if (item.category !== 'customization') { await openItem(page, row, item); await choose(page, row, item); await closeItem(page, row, item); }
        await reopen(page, row, item);
        if (item === cover) await readOnly(page, row, 'cover-preview-cancel', async () => {
            await activate(expression(page).locator('[data-expression-action="preview"]'), row.touch); await expression(page).locator('.island-expression-preview').waitFor();
            await capture(page, row, 'cover-preview'); await press(page, row, 'いまに もどす', expression(page));
        });
        const slot = item.category === 'customization' ? await customs(page).getAttribute('data-selected-slot') : null;
        const control = item.category === 'customization' ? customs(page).locator('[data-customization-action="purchase"]')
            : item.category === 'furniture' ? button(furniture(page), '25ほしで むかえる') : expression(page).locator('[data-expression-action="acquire"]');
        assert(!await control.isDisabled());
        const after = await mutate(page, row, `purchase-${idOf(item)}`, null, control, { category: item.category, slot: slot === 'all' ? undefined : slot });
        assert.equal(goalOf(islandFor(after, row.owner)), null);
        if (item.category === 'customization') await assertBridgePreview(page, true);
        if (item.category === 'expression') assert.deepEqual(islandFor(after, row.owner).expression.selection, emptyExpression().selection);
        await capture(page, row, `${idOf(item)}-acquired-goal-cleared`);
        if (item.category === 'furniture') await readOnly(page, row, 'cancel-uncommitted-purchase-placement', async () => {
            await waitMode(page, 'placement'); await press(page, row, 'いどうを やめる'); await waitMode(page, 'furniture');
        });
        await closeItem(page, row, item); assert.equal(await homeGoal(page).count(), 0);
    }
    const beforeFinal = await tables(page), savedIsland = islandFor(beforeFinal, row.owner); assert.equal(savedIsland.customization.points, row.earned.points - 35);
    const plan = await resume(page, row); await capture(page, row, 'same-reservation-before-answer');
    assert(plan.cursor < plan.slots.length - 1 && !savedIsland.pendingMathChecks?.length, 'This short QA requires a non-final slot with no pending independent checks');
    const answer = await answerUI(page, plan, { touch: row.touch, dev: false }); row.answerCount++;
    assert.equal(answer.state.plan.id, plan.id); assert.equal(answer.state.plan.revision, plan.revision + 1);
    const answered = await tables(page); for (const store of ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs']) assert.deepEqual(answered[store], beforeFinal[store]);
    assertOrdinaryAnswerWorldPreserved(beforeFinal, answered);
    await page.reload(); await waitLearningInput(page, answer.state.plan); assert.deepEqual((await readNative(page, row.owner)).plan, answer.state.plan);
    await checkRead(page, row, 'reload-same-answer-all-stores', answered);
    row.learning = { planId: plan.id, originalRevision: plan.revision, savedRevision: answer.state.plan.revision, actualAnswer: true, reload: true };
    await capture(page, row, 'reloaded-same-reservation'); assert.deepEqual(row.errors, []); row.pass = true;
}
const { chromium } = await import('playwright'); let browser;
try {
    const version = await (await fetch(`${target}/version.json`)).json(); assert.equal(version.revision, manifest.revision); report.servedVersion = version;
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_REWARD_GOALS_HEADED !== '1' }); report.browserVersion = browser.version();
    for (const layout of viewports) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow' });
        await installObservationAudit(context); await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, answerCount: 0, captures: 0, errors: [], databaseChecks: [], sections: [], observations: [] }; report.layouts.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        try { await run(page, row); }
        catch (error) { row.failure = error.stack; process.exitCode = 1; await capture(page, row, 'failure').catch(() => {});
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => '')); }
        finally {
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-natural-audit.json`, JSON.stringify(await page.evaluate(() => window.__qualifiedObservations).catch(() => null), null, 2));
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = report.layouts.length === 2 && report.layouts.every(row => row.pass);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    await browser?.close(); report.browserClosed = true;
    try { report.finalSource = await fingerprint(); assert.deepEqual(report.finalSource, initialSource); report.sourceStable = true; }
    catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Reward goals</title><p>${manifest.revision}: limited goal UI, human N=0</p>${report.captures.map(entry => `<figure><img width="390" src="${entry.file}"><figcaption>${entry.name}</figcaption></figure>`).join('')}`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, sourceStable: report.sourceStable, browserClosed: report.browserClosed,
        layouts: report.layouts.map(row => ({ name: row.name, pass: row.pass, answers: row.answerCount, failure: row.failure?.split('\n')[0] })) }));
}
