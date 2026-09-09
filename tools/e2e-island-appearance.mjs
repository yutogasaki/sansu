import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const families = ['starry', 'candy', 'crystal'];
const parts = { sky: ['sky'], ground: ['ground', 'shore', 'path'], water: ['water'],
    house: ['houseBody', 'houseRoof', 'houseWindows'], plants: ['tree', 'flower', 'mushroom'], bridge: ['bridge'] };
const slots = Object.values(parts).flat();
const accents = { starry: 'star-lanterns', candy: 'candy-flags', crystal: 'crystal-charms' };
// Audited against the immutable snapshot08 UI/domain; no app imports at runtime.
const sceneContract = {
    sourceFiles: ['src/components/island/IslandExperiencePanel.tsx', 'src/pages/Island.tsx',
        'src/domain/island/experience.ts', 'src/domain/island/customization.ts', 'src/domain/island/experienceRepository.ts'],
    entranceTab: 'layouts', slotIds: ['slot-1', 'slot-2', 'slot-3'], slotId: 'slot-1',
    nameLabel: 'けしき 1の なまえ', name: 'わたしの おかしやね',
    saveLabel: 'いまの しまを のこす', cancelScope: '.island-experience-preview', cancelLabel: 'いまに もどす',
};
const scenarios = [
    'S01: empty DB, actual profile setup and ordinary learning earn enough stars and the placed western mushroom; no profile/progress/ownership/geometry injection',
    'S01/S04: 3 families × 6 parts and 3 × 12 independent slots are previewed on the current island; actual layer geometry/material signatures, non-target identities, fixed framing and full native DB snapshots are compared',
    'S04/S08: mixed roof/flower preview, undo one slot, restore default, reset all, close and learning discard unsaved previews; three whole sets preview on the same island without purchasing them',
    'S03 initial purchase path: earn ≥25 stars by real answers, leave a crystal flower preview unconfirmed, buy candy-house rights while applying only its roof; other unconfirmed slots are not saved',
    'S03: candy-house owned scope equips its windows for free; restoring a slot costs zero; candy theme/complete prices reflect 25 owned stars (75 / 95 remaining)',
    'S08: actual named whole-scene save via the customization exit, with all resolved appearance slots/outfits/ambience/emblem; explicit saved-layout preview and cancellation',
    'S10: preview, purchase and saved-scene flows return to the exact full planner reservation and accept one real answer without altering optional content',
    'S10 subset: all native learning tables unchanged during optional actions; idle/visible frame CPU and UI completion latency recorded separately from learning timing',
];
const limitations = [
    'First S01/S03/S04/S08/S10 UI path only. S03 alternate purchase orders/full set purchases and S02 legacy rights are NOT run.',
    'S05 abort/unknown receipt/CAS, S06 later-growth collision, S07 all growth stages/lands/resident-use contacts, S09 historical snapshots, S11 owner/offline/update/recovery require separate runs.',
    'Only actually earned current growth is rendered. Invisible or locked pieces are reported separately; a geometry signature alone does not pass visual readability.',
    'Human N=0. Appearance appeal and silent child comprehension require actual image review; no motivation, pedagogy or formal learning P95 claim.',
    'No browser is launched by --plan. A real run uses the build snapshot or an explicit immutable QA bundle whose app inputs and unchanged helpers match it.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: false, viewports, scenarios, limitations, sceneContract,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_APPEARANCE_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_ISLAND_APPEARANCE_VIEWPORT: 'phone or tablet for a bounded partial diagnostic', SANSU_ISLAND_APPEARANCE_HEADED: '1 enables headed inspection', SANSU_ISLAND_APPEARANCE_QA_ROOT: 'Explicit immutable QA bundle; every non-tools app input must match the build manifest, helpers remain copied from that build'  },
        mutationRule: 'Actual UI inputs only. Read-only all-store IndexedDB snapshots and actual renderer diagnostics/canvas are observed; no imports/calls of app functions or fixture writes.',
        evidenceRule: 'Fresh directory; source/QA hashes before and after, PNG contact sheet, trace, native per-action differences, achieved checks and remaining coverage.',
        rendererContract: 'data-island-appearance from world.describeAppearance() uses real mesh signatures/UUIDs, not copied React props.',
    }, null, 2));
    process.exit(0);
}

const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_APPEARANCE_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set frozen URL, source manifest and fresh output');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_APPEARANCE_QA_ROOT || manifest.snapshot), 'Run the QA file from the explicit frozen QA root or build snapshot/tools');
assert(manifest.revision && manifest.sourceHash && manifest.files?.length);
const sha = value => createHash('sha256').update(value).digest('hex');
const qaFiles = ['tools/e2e-island-appearance.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'].map(file => path.join(sourceRoot, file));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length > 0 && appInputs.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({
    app: await hashFiles(manifest.files.map(file => file.path)),
    qa: await hashFiles(qaFiles),
    bundleAppInputs: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))),
});
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleAppInputs.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256,
    file.sha256, `QA bundle app input differs from frozen build: ${file.relative}`);
for (const file of qaFiles.slice(1)) {
    const relative = path.relative(sourceRoot, file), original = manifest.files.find(entry => entry.relative === relative);
    assert(original, `Frozen helper must be in build manifest: ${relative}`);
    assert.equal(initialSource.qa.find(entry => entry.path === file)?.sha256, original.sha256, `Shared helper must be an unchanged build copy: ${relative}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, sourceRoot, startedAt: new Date().toISOString(), pass: false,
    fullSpec39Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, limitations, sceneContract,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    fingerprints: initialSource, sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)), explicitBundle: Boolean(process.env.SANSU_ISLAND_APPEARANCE_QA_ROOT) } }, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const panel = page => page.getByTestId('island-customization');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const idle = page => page.waitForFunction(() => {
    const host = document.querySelector('.island-page');
    return host?.getAttribute('data-busy') === 'false' || host?.getAttribute('data-mode') === 'welcome'
        || host?.hasAttribute('data-onboarding-step') && host.querySelector('.island-setup-sheet')?.getAttribute('aria-busy') === 'false';
});
const painted = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function waitLearningInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const node = document.querySelector('[data-island-plan-id][data-input-ready="true"]'), answer = document.querySelector('.park-answer');
        return node && answer && answer.getBoundingClientRect().width > 20
            && (!expected || node.getAttribute('data-island-plan-id') === expected.id && Number(node.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(control => !control.disabled && control.getBoundingClientRect().height > 10);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
}
async function waitWorld(page) {
    await waitReady(page); await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        const expectedFocus = document.querySelector('[data-testid="island-customization"]')?.getAttribute('data-cosmetic-focus');
        const appliedFocus = host?.getAttribute('data-cosmetic-focus');
        return document.querySelector('.island-page')?.getAttribute('data-mode') !== 'learning' && host?.getAttribute('data-renderer') === 'three'
            && box?.width > 100 && box?.height > 100 && canvas.width > 1 && host.getAttribute('data-camera-frame')?.split(',').length === 32
            && (!expectedFocus || appliedFocus && JSON.parse(appliedFocus).requested === expectedFocus);
    }); await painted(page);
}
async function press(page, label, touch, scope = page) { await idle(page); await activate(button(scope, label), touch); }
async function act(page, row, action) { await idle(page); await activate(panel(page).locator(`[data-customization-action="${action}"]`), row.touch); await idle(page); await waitWorld(page); }
async function goHome(page, row) { await press(page, 'しまへ', row.touch); await waitMode(page, 'home'); await waitWorld(page); }
async function open(page, row) { await press(page, 'きせかえ', row.touch); await waitMode(page, 'customization'); await waitWorld(page); }
async function waitNative(page, predicate, label) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) { const state = await readNative(page); if (predicate(state.island, state)) { await idle(page); return state; } await pause(75); }
    throw new Error(`Native state did not reach ${label}`);
}

/** One readonly transaction covers every native store. Hash actual Blob bytes
 * afterwards; these reads never seed progress or dispatch application actions. */
async function tables(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const entries = await Promise.all(names.map(name => new Promise((resolve, reject) => {
                const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve([name, request.result]); request.onerror = () => reject(request.error);
            })));
            await done;
            const canonical = async value => {
                if (value instanceof Blob) return { mime: value.type, bytes: value.size,
                    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
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
function unchanged(before, after, allowed) {
    assert.deepEqual(Object.keys(before), Object.keys(after));
    for (const name of Object.keys(before)) {
        const strip = rows => {
            if (!allowed) return rows;
            if (name === 'islandEvents') return rows.filter(event => event.type !== `${allowed}_changed`);
            if (name !== 'islands') return rows;
            return rows.map(row => { const copy = structuredClone(row); delete copy.revision; delete copy.updatedAt; delete copy[allowed]; return copy; });
        };
        assert.deepEqual(strip(after[name]), strip(before[name]), `${name}: mutation outside ${allowed ?? 'read-only preview'}`);
    }
}
async function checkDB(page, row, name, before, allowed) {
    await idle(page); const after = await tables(page); unchanged(before, after, allowed);
    row.databaseChecks.push({ name, allowed: allowed ?? 'none', before: digestTables(before), after: digestTables(after),
        changedStores: Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table])), pass: true });
    return after;
}
const savedSlots = island => island.customization?.appearance?.slots ?? Object.fromEntries(slots.map(slot => [slot, `legacy-v1:${island.customization?.themeId ?? 'moon-garden'}:${slot}`]));
async function actual(page) {
    await waitWorld(page);
    await page.waitForFunction(() => {
        const value = document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-island-appearance');
        return value && JSON.parse(value).slots?.length === 12;
    });
    return stage(page).evaluate(node => ({ appearance: JSON.parse(node.getAttribute('data-island-appearance')),
        frame: node.getAttribute('data-camera-frame'), cpu: Number(node.getAttribute('data-frame-cpu-ms')),
        cosmeticFocus: JSON.parse(node.getAttribute('data-cosmetic-focus') || 'null'),
        residents: JSON.parse(node.getAttribute('data-resident-states') || '[]'), personal: JSON.parse(node.getAttribute('data-personal-scenery') || 'null') }));
}
const bySlot = record => Object.fromEntries(record.appearance.slots.map(slot => [slot.slot, slot]));
const physical = value => ({ geometry: value.geometrySignature, material: value.materialSignature });
function compare(actualBefore, actualAfter, changed, family, row, name) {
    const before = bySlot(actualBefore), after = bySlot(actualAfter), invisible = [];
    assert.equal(actualAfter.frame, actualBefore.frame, `${name}: same camera for the comparison`);
    for (const slot of slots) {
        assert(after[slot], `actual ${slot} geometry diagnostic is required`);
        if (changed.includes(slot)) {
            assert.equal(after[slot].styleId, `parts-v1:${family}:${slot}`);
            assert.notDeepEqual(physical(after[slot]), physical(before[slot]), `${name}: ${slot} must change actual geometry or material`);
            if (after[slot].visibleMeshCount === 0 || after[slot].visibleMeshCount === undefined) invisible.push(slot);
        } else {
            assert.deepEqual(after[slot].groupUuids, before[slot].groupUuids, `${name}: unrelated ${slot} identity`);
            assert.deepEqual(physical(after[slot]), physical(before[slot]), `${name}: unrelated ${slot} surface`);
        }
    }
    assert.equal(actualAfter.appearance.tree.rootUuid, actualBefore.appearance.tree.rootUuid);
    assert.equal(actualAfter.appearance.tree.crownUuid, actualBefore.appearance.tree.crownUuid);
    assert.deepEqual(actualAfter.appearance.tree.lightAnchor, actualBefore.appearance.tree.lightAnchor);
    row.comparisons.push({ name, changed, family, visibilityUnverifiedSlots: invisible, before: actualBefore, after: actualAfter, geometryPass: true, imageReview: 'pending' });
}
async function capture(page, row, name) {
    const learning = await page.locator('.island-page').getAttribute('data-mode') === 'learning';
    if (learning) await waitLearningInput(page); else await waitWorld(page);
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'input' : 'world'}.png`;
    const ui = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await (learning ? page.locator('.island-workbench') : stage(page)).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    report.captures.push({ name, file, frameFile, sha256: sha(ui), frameSha256: sha(frame), ...metadata,
        actual: learning ? undefined : await actual(page), role: learning ? 'actual input; world intentionally hidden' : 'actual scene, image review pending' });
}
async function reset(page, row) {
    const control = panel(page).locator('[data-customization-action="reset-preview"]');
    if (await control.count()) await act(page, row, 'reset-preview');
    await waitWorld(page);
}
async function browseTarget(page, row, part, slot) {
    await activate(panel(page).locator('button[data-customization-category="part"]'), row.touch);
    await activate(panel(page).locator(`[data-appearance-part="${part}"]`), row.touch);
    if (slots.includes(slot) && parts[part].length > 1) await activate(panel(page).locator(`[data-appearance-slot="${slot}"]`), row.touch);
    await waitWorld(page);
}
async function choose(page, row, family, part, slot) {
    await browseTarget(page, row, part, slot);
    const started = performance.now(); await activate(panel(page).locator(`[data-customization-id="${family}-${part}"]`), row.touch);
    const desired = slot ? [slot] : parts[part];
    await waitWorld(page);
    await page.waitForFunction(({ desired, family }) => {
        const raw = document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-island-appearance');
        return raw && desired.every(slot => JSON.parse(raw).slots.some(value => value.slot === slot && value.styleId === `parts-v1:${family}:${slot}`));
    }, { desired, family });
    await waitWorld(page); row.interactions.push({ name: `${family}-${part}-${slot ?? 'all'}`, completionMs: performance.now() - started, frameCpu: (await actual(page)).cpu });
}
async function selectCategoryItem(page, row, category, id) {
    await activate(panel(page).locator(`button[data-customization-category="${category}"]`), row.touch);
    await activate(panel(page).locator(`[data-customization-id="${id}"]`), row.touch); await waitWorld(page);
}
async function returnLearning(page, row, label) {
    const before = await tables(page), plan = (await readNative(page)).plan;
    assert(plan?.status === 'active');
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    if (mode === 'customization') await press(page, 'きせかえから もどる', row.touch, panel(page));
    else if (mode === 'experience') await press(page, 'なまえ・けしきから もどる', row.touch, page.getByTestId('island-experience'));
    else assert.equal(mode, 'home', 'Use the actual optional-screen close control before learning');
    await waitMode(page, 'home'); await idle(page);
    assert.deepEqual((await readNative(page)).plan, plan); unchanged(before, await tables(page));
    await press(page, 'つづきから とく', row.touch); await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page)).plan, plan); unchanged(before, await tables(page));
    await capture(page, row, `${label}-same-reservation`);
    const answered = await answerUI(page, plan, { touch: row.touch, dev: false });
    // A real section completion may earn stars; appearance/ownership stay independent of that normal reward.
    const saved = answered.state.islandPlans.find(value => value.id === plan.id);
    assert.equal(saved.revision, plan.revision + 1);
    const after = await tables(page);
    for (const field of ['experience', 'workshop', 'sharedMemories']) assert.deepEqual(after.islands[0][field], before.islands[0][field]);
    assert.deepEqual(after.islands[0].customization?.appearance, before.islands[0].customization?.appearance);
    assert.deepEqual(after.islands[0].customization?.ownedItemIds, before.islands[0].customization?.ownedItemIds);
    for (const name of Object.keys(before).filter(name => /Photo/u.test(name))) assert.deepEqual(after[name], before[name]);
    row.learningReturns.push({ label, planId: plan.id, revisionBefore: plan.revision, revisionAfter: saved.revision, pass: true });
    await goHome(page, row);
}

async function earn(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page);
    assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, 'まなぶ', row.touch); await page.locator('.island-setup-name input').fill(`けしき${row.name}`);
    await press(page, '年中', row.touch); await press(page, 'さんすう', row.touch);
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page), answers = 0; row.owner = native.plan.profileId;
    // Finish a whole section so later optional returns start with a real new reservation.
    while ((native.island.customization?.points ?? 0) < 25 || !native.island.items.some(item => item.kind === 'mushroom' && item.position) || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers < 240, 'Real ordinary answers must earn house stars and a placed mushroom in a bounded run');
    }
    const receipts = native.islandEvents.filter(event => event.type === 'answer');
    assert.equal(receipts.length, answers);
    row.earned = { answerCount: answers, answerReceiptIds: receipts.map(event => event.id), points: native.island.customization.points,
        completedSets: native.island.completedSets, growth: native.island.growth, placedMushroomId: native.island.items.find(item => item.kind === 'mushroom' && item.position).id, fixture: false };
    await goHome(page, row); await open(page, row); await capture(page, row, 'earned-saved-before');
}
async function previewMatrix(page, row) {
    for (const family of families) for (const part of Object.keys(parts)) {
        await reset(page, row); await browseTarget(page, row, part);
        const before = await tables(page), sceneBefore = await actual(page);
        await choose(page, row, family, part); compare(sceneBefore, await actual(page), parts[part], family, row, `${family}-${part}-all`);
        await checkDB(page, row, `${family}-${part}-all-preview-only`, before);
        await capture(page, row, `${family}-${part}-all`);
    }
    for (const family of families) for (const [part, targets] of Object.entries(parts)) for (const slot of targets) {
        await reset(page, row); await browseTarget(page, row, part, slot);
        const before = await tables(page), sceneBefore = await actual(page);
        if (family === 'candy') await capture(page, row, `${family}-${slot}-saved-before`);
        await choose(page, row, family, part, slot); compare(sceneBefore, await actual(page), [slot], family, row, `${family}-${slot}`);
        await checkDB(page, row, `${family}-${slot}-preview-only`, before);
        await capture(page, row, `${family}-${slot}-single`);
    }
    await reset(page, row);
    for (const family of families) {
        await activate(panel(page).locator('button[data-customization-category="set"]'), row.touch); await waitWorld(page);
        const before = await tables(page), sceneBefore = await actual(page);
        await selectCategoryItem(page, row, 'set', `${family}-complete`);
        compare(sceneBefore, await actual(page), slots, family, row, `${family}-complete`);
        row.setPreviews.push({ family, expectedAccent: accents[family], purchased: false, accentImageReview: 'pending' });
        await checkDB(page, row, `${family}-complete-preview-only`, before); await capture(page, row, `${family}-complete`);
        assert.equal(await panel(page).getAttribute('data-preview'), 'true');
        assert(await button(panel(page), 'いまの けしきを のこす').isDisabled(), 'An unconfirmed set cannot be saved as owned scenery');
        await reset(page, row); await checkDB(page, row, `${family}-complete-reset`, before);
    }
}
async function mixAndCancel(page, row) {
    const before = await tables(page), saved = savedSlots(before.islands[0]);
    await choose(page, row, 'crystal', 'plants', 'flower');
    const flower = (await actual(page)).appearance.slots.find(value => value.slot === 'flower');
    await choose(page, row, 'candy', 'house', 'houseRoof'); await capture(page, row, 'unowned-roof-and-flower-mix');
    await checkDB(page, row, 'mix-preview-only', before);
    await act(page, row, 'undo-preview-part');
    let rendered = bySlot(await actual(page));
    assert.equal(rendered.houseRoof.styleId, saved.houseRoof); assert.deepEqual(physical(rendered.flower), physical(flower));
    await capture(page, row, 'undo-roof-keeps-flower'); await checkDB(page, row, 'undo-one-part', before);
    await choose(page, row, 'candy', 'house', 'houseRoof'); await act(page, row, 'preview-default-part');
    rendered = bySlot(await actual(page)); assert.equal(rendered.houseRoof.styleId, 'legacy-v1:moon-garden:houseRoof');
    assert.equal(rendered.flower.styleId, 'parts-v1:crystal:flower'); await checkDB(page, row, 'restore-default-preview-only', before);
    await goHome(page, row); await checkDB(page, row, 'close-discards-mix', before);
    assert.deepEqual(Object.fromEntries((await actual(page)).appearance.slots.map(value => [value.slot, value.styleId])), saved);
    await open(page, row); await choose(page, row, 'candy', 'house', 'houseRoof');
    await returnLearning(page, row, 'unconfirmed-roof');
    assert.deepEqual(savedSlots((await readNative(page)).island), saved);
    await open(page, row);
}
async function roofPurchase(page, row) {
    await reset(page, row); const before = await tables(page), previous = before.islands[0], expected = savedSlots(previous);
    await choose(page, row, 'crystal', 'plants', 'flower'); await choose(page, row, 'candy', 'house', 'houseRoof');
    await checkDB(page, row, 'roof-purchase-composite-preview', before); await capture(page, row, 'roof-purchase-ready');
    const purchaseFrame = await actual(page);
    assert(await panel(page).locator('[data-customization-action="purchase"]').isEnabled());
    const started = performance.now(); await act(page, row, 'purchase');
    const native = await waitNative(page, island => island.customization?.ownedItemIds.includes('candy-house'), 'candy-house rights saved');
    const after = await checkDB(page, row, 'roof-purchase-only-customization', before, 'customization');
    assert.equal(native.island.customization.points, previous.customization.points - 25);
    assert.deepEqual(native.island.customization.ownedItemIds, [...previous.customization.ownedItemIds, 'candy-house']);
    assert.deepEqual(savedSlots(native.island), { ...expected, houseRoof: 'parts-v1:candy:houseRoof' });
    assert.equal(native.island.customization.themeId, previous.customization.themeId);
    assert.equal(native.island.customization.accentId, previous.customization.accentId);
    const event = after.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
    assert.equal(event.length, 1); assert.equal(event[0].type, 'customization_changed');
    assert.deepEqual(event[0].action, { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' });
    const rendered = bySlot(await actual(page));
    assert.equal((await actual(page)).frame, purchaseFrame.frame, 'Purchase completion preserves the browsed roof camera');
    for (const slot of slots) assert.equal(rendered[slot].styleId, savedSlots(native.island)[slot]);
    row.purchases.push({ sku: 'candy-house', slot: 'houseRoof', price: 25, actualPointsBefore: previous.customization.points,
        actualPointsAfter: native.island.customization.points, action: event[0].action, eventId: event[0].id, completionMs: performance.now() - started });
    await capture(page, row, 'owned-roof-only-flower-not-saved');
    await returnLearning(page, row, 'purchased-roof'); await open(page, row);

    // Owned house grants wall/roof/window use, while the current action only equips windows.
    const equipBefore = await tables(page); await choose(page, row, 'candy', 'house', 'houseWindows');
    assert.equal(await panel(page).locator('[data-customization-action="purchase"]').count(), 0);
    await act(page, row, 'equip');
    const equipped = await waitNative(page, island => savedSlots(island).houseWindows === 'parts-v1:candy:houseWindows', 'owned window equipped');
    await checkDB(page, row, 'owned-window-free-equip', equipBefore, 'customization');
    assert.equal(equipped.island.customization.points, equipBefore.islands[0].customization.points);
    assert.deepEqual(equipped.island.customization.ownedItemIds, equipBefore.islands[0].customization.ownedItemIds);
    assert.deepEqual(savedSlots(equipped.island), { ...savedSlots(equipBefore.islands[0]), houseWindows: 'parts-v1:candy:houseWindows' });
    await capture(page, row, 'owned-roof-and-free-windows');
    // Default restoration is itself an explicit free operation, not purchase.
    await choose(page, row, 'candy', 'house', 'houseWindows'); await act(page, row, 'preview-default-part');
    const restoreBefore = await tables(page); await act(page, row, 'restore-part');
    const restored = await waitNative(page, island => savedSlots(island).houseWindows === 'legacy-v1:moon-garden:houseWindows', 'window restored for free');
    await checkDB(page, row, 'window-free-default', restoreBefore, 'customization');
    assert.equal(restored.island.customization.points, restoreBefore.islands[0].customization.points);
    assert.deepEqual(savedSlots(restored.island), { ...savedSlots(restoreBefore.islands[0]), houseWindows: 'legacy-v1:moon-garden:houseWindows' });

    const quoteBefore = await tables(page);
    for (const [kind, id, price] of [['theme', 'candy', 75], ['set', 'candy-complete', 95]]) {
        await selectCategoryItem(page, row, kind, id);
        const displayed = await panel(page).locator(`[data-customization-id="${id}"] .island-customization-item-status`).innerText();
        assert.match(displayed, new RegExp(`^${price}\\s*こ$`, 'u'));
        row.quotes.push({ id, ownedComponent: 'candy-house', price, actualText: displayed, purchased: false });
        await checkDB(page, row, `${id}-owned-credit-preview-only`, quoteBefore); await capture(page, row, `${id}-25-owned-credit`); await reset(page, row);
    }
    row.coverage.S03 = 'PASS initial roof purchase/free equip/owned credit; alternate acquisition orders and full-set purchase unverified';
}
async function sceneSave(page, row) {
    await reset(page, row); const before = await tables(page), prior = before.islands[0];
    await press(page, 'いまの けしきを のこす', row.touch, panel(page)); await waitMode(page, 'experience');
    const experience = page.getByTestId('island-experience');
    assert.equal(await experience.getAttribute('data-experience-tab'), sceneContract.entranceTab, 'Customization opens the layouts tab directly');
    assert.deepEqual(await experience.locator('[data-layout-slot]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-layout-slot'))), sceneContract.slotIds);
    await checkDB(page, row, 'whole-scene-save-entrance-readonly', before);
    row.sceneChecks.push({ name: 'direct-layouts-entrance', ids: sceneContract.slotIds, pass: true });
    const layoutId = sceneContract.slotId, slot = experience.locator(`[data-layout-slot="${layoutId}"]`);
    assert.equal(await slot.count(), 1); assert.equal(await slot.getAttribute('data-layout-slot'), 'slot-1');
    assert.equal(await slot.getAttribute('data-layout-saved'), 'false');
    const nameInput = slot.getByRole('textbox', { name: sceneContract.nameLabel, exact: true });
    await nameInput.fill(sceneContract.name); assert.equal(await nameInput.inputValue(), sceneContract.name);
    await checkDB(page, row, 'scene-name-draft-readonly', before);
    await press(page, sceneContract.saveLabel, row.touch, slot);
    const native = await waitNative(page, island => island.experience?.layouts.some(value => value.id === layoutId), 'whole scene captured');
    const after = await checkDB(page, row, 'named-scene-save-only-experience', before, 'experience');
    const saved = native.island.experience.layouts.find(value => value.id === layoutId);
    assert.equal(saved.id, 'slot-1'); assert.equal(saved.name, sceneContract.name);
    assert.deepEqual(saved.cosmetics, { themeId: prior.customization.themeId, accentId: prior.customization.accentId,
        appearance: { version: 1, slots: savedSlots(prior) } });
    assert.deepEqual(saved.poses, prior.items.map(({ id, position, rotation }) => ({ id, ...(position ? { position } : {}), rotation })));
    assert.deepEqual(saved.sceneStyle, { version: 1, residentLooks: Object.fromEntries(['otter', 'rabbit', 'fox'].map(id => [id, prior.experience?.residents[id].look ?? 'original'])),
        ambience: prior.experience?.ambience ?? 'off', emblem: prior.experience?.emblem ?? 'leaf' });
    assert.deepEqual(native.island.experience.layouts.filter(value => value.id !== layoutId), prior.experience?.layouts.filter(value => value.id !== layoutId) ?? []);
    const events = after.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
    assert.equal(events.length, 1); assert.equal(events[0].type, 'experience_changed');
    assert.deepEqual(events[0].action, { type: 'save-layout', layoutId: 'slot-1', name: sceneContract.name });
    assert.equal(saved.capturedAt, events[0].timestamp);
    assert.equal(await slot.getAttribute('data-layout-saved'), 'true');
    assert.equal(await slot.getByRole('heading', { level: 3 }).innerText(), sceneContract.name);
    row.sceneChecks.push({ name: 'slot-1-exact-snapshot-and-one-save-event', eventId: events[0].id, pass: true });
    row.savedScene = saved; await capture(page, row, 'named-whole-scene-saved');

    // Make current scenery visibly different using already-owned windows. This
    // makes snapshot preview/cancel observable without granting any new rights.
    await press(page, 'なまえ・けしきから もどる', row.touch, experience); await waitMode(page, 'home'); await open(page, row);
    await checkDB(page, row, 'saved-scene-exit-to-owned-customization-readonly', after);
    await choose(page, row, 'candy', 'house', 'houseWindows'); await act(page, row, 'equip');
    const current = await waitNative(page, island => savedSlots(island).houseWindows === 'parts-v1:candy:houseWindows', 'current owned windows differ from saved layout');
    const currentTables = await checkDB(page, row, 'current-owned-window-only-customization', after, 'customization');
    assert.deepEqual(current.island.experience, native.island.experience);
    assert.equal(current.island.customization.points, native.island.customization.points);
    assert.deepEqual(current.island.customization.ownedItemIds, native.island.customization.ownedItemIds);
    assert.deepEqual(savedSlots(current.island), { ...saved.cosmetics.appearance.slots, houseWindows: 'parts-v1:candy:houseWindows' });
    const currentScene = await actual(page);
    await capture(page, row, 'current-owned-windows-after-snapshot');
    await press(page, 'いまの けしきを のこす', row.touch, panel(page)); await waitMode(page, 'experience');
    assert.equal(await experience.getAttribute('data-experience-tab'), 'layouts');
    assert.equal(await slot.getByRole('heading', { level: 3 }).innerText(), sceneContract.name);
    await checkDB(page, row, 'same-slot-reentry-readonly', currentTables);
    await activate(slot.locator('[data-experience-action="preview-layout"]'), row.touch); await waitWorld(page);
    await slot.locator('[data-experience-action="preview-layout"][aria-pressed="true"]').waitFor({ state: 'visible' });
    const previewStatus = experience.locator(sceneContract.cancelScope);
    await previewStatus.waitFor({ state: 'visible' });
    assert.match(await previewStatus.innerText(), /おためしの けしき/u);
    const previewScene = await actual(page);
    assert.deepEqual(Object.fromEntries(previewScene.appearance.slots.map(value => [value.slot, value.styleId])), saved.cosmetics.appearance.slots);
    assert.notDeepEqual(physical(bySlot(previewScene).houseWindows), physical(bySlot(currentScene).houseWindows), 'The saved windows actually replace the current windows');
    await checkDB(page, row, 'saved-scene-preview-only', currentTables); await capture(page, row, 'named-whole-scene-preview');
    await press(page, sceneContract.cancelLabel, row.touch, previewStatus);
    await previewStatus.waitFor({ state: 'detached' });
    await slot.locator('[data-experience-action="preview-layout"][aria-pressed="false"]').waitFor({ state: 'visible' });
    const cancelledScene = await actual(page);
    assert.deepEqual(Object.fromEntries(cancelledScene.appearance.slots.map(value => [value.slot, value.styleId])), savedSlots(current.island));
    assert.deepEqual(physical(bySlot(cancelledScene).houseWindows), physical(bySlot(currentScene).houseWindows));
    await checkDB(page, row, 'explicit-saved-scene-cancel-readonly', currentTables); await capture(page, row, 'named-whole-scene-cancel-current-windows');
    row.sceneChecks.push({ name: 'same-slot-preview-actual-window-difference-and-explicit-cancel', pass: true });
    await activate(slot.locator('[data-experience-action="preview-layout"]'), row.touch);
    await slot.locator('[data-experience-action="preview-layout"][aria-pressed="true"]').waitFor({ state: 'visible' });
    await returnLearning(page, row, 'saved-scene-preview');
    assert.deepEqual((await readNative(page)).island.experience.layouts.find(value => value.id === layoutId), saved);
    assert.deepEqual(Object.fromEntries((await actual(page)).appearance.slots.map(value => [value.slot, value.styleId])), savedSlots(current.island));
    row.sceneChecks.push({ name: 'learning-exit-cancels-preview-and-keeps-same-snapshot', pass: true });
    row.coverage.S08 = 'PASS selected previews and exact slot-1 named snapshot, actual saved/current window difference, explicit cancellation and learning exit; image review pending';
}

const { chromium } = await import('playwright');
let browser;
try {
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_APPEARANCE_HEADED !== '1' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_APPEARANCE_HEADED === '1' };
    const selected = viewports.filter(row => !process.env.SANSU_ISLAND_APPEARANCE_VIEWPORT || row.name === process.env.SANSU_ISLAND_APPEARANCE_VIEWPORT);
    assert(selected.length, 'Unknown viewport selection');
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow' });
        await context.addInitScript(() => {
            const performanceReport = { frames: 0, maxGapMs: 0, over100Ms: 0, last: 0, cpu: [] };
            window.__appearancePerformance = performanceReport;
            const sample = now => {
                if (performanceReport.last && !document.hidden) {
                    const gap = now - performanceReport.last; performanceReport.maxGapMs = Math.max(performanceReport.maxGapMs, gap);
                    if (gap > 100) performanceReport.over100Ms++;
                }
                performanceReport.last = now; performanceReport.frames++; requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
            const install = () => new MutationObserver(records => {
                for (const record of records) if (record.attributeName === 'data-frame-cpu-ms' && performanceReport.cpu.length < 4000)
                    performanceReport.cpu.push({ ms: performance.now(), value: Number(record.target.getAttribute('data-frame-cpu-ms')) });
            }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-frame-cpu-ms'] });
            if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install, { once: true });
        });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], comparisons: [], purchases: [], quotes: [], setPreviews: [], interactions: [], learningReturns: [], sceneChecks: [],
            coverage: { S01: 'not-run', S03: 'not-run', S04: 'not-run', S08: 'not-run', S10: 'not-run' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row); console.log(`${row.name}: ${row.earned.answerCount} actual answers earned ${row.earned.points} stars`);
            await previewMatrix(page, row); row.coverage.S01 = 'PASS 18 part and 36 slot runtime comparisons; image review pending';
            await mixAndCancel(page, row); row.coverage.S04 = 'PASS selected preview/mix/undo/default/reset/close/learning paths';
            await roofPurchase(page, row); await sceneSave(page, row);
            const beforeReload = await tables(page), plan = (await readNative(page)).plan;
            await page.reload(); await waitLearningInput(page, plan);
            assert.deepEqual((await readNative(page)).plan, plan); unchanged(beforeReload, await tables(page));
            assert.deepEqual((await readNative(page)).island.experience.layouts.find(value => value.id === 'slot-1'), row.savedScene);
            row.sceneChecks.push({ name: 'reload-same-full-reservation-and-exact-slot-1-snapshot-all-db-unchanged', pass: true });
            await goHome(page, row); await open(page, row); await capture(page, row, 'owned-appearance-after-reload');
            const actualSlots = Object.fromEntries((await actual(page)).appearance.slots.map(value => [value.slot, value.styleId]));
            assert.deepEqual(actualSlots, savedSlots((await readNative(page)).island));
            row.coverage.S10 = 'PASS same full reservation and actual answer; formal throughput remains unverified';
            row.performance = await page.evaluate(() => window.__appearancePerformance);
            row.finalTables = digestTables(await tables(page)); assert.deepEqual(row.errors, []); row.pass = true;
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
            console.log(`PASS ${row.name}: selected appearance runtime path; human image review and remaining spec39 cases are pending`);
        } catch (error) {
            row.failure = error.stack; process.exitCode = 1;
            await capture(page, row, 'failure').catch(() => {});
            row.performance = await page.evaluate(() => window.__appearancePerformance).catch(() => null);
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            await context.tracing.stop({ path: `${out}/${row.name}-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = selected.length === viewports.length && report.layouts.every(row => row.pass);
    report.gates.runtimeIntegrity = report.pass ? 'passed-selected-scenarios' : 'failed-or-partial';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    try {
        const finalSource = await fingerprint(); report.finalFingerprints = finalSource;
        report.sourceChecks = Object.fromEntries(Object.keys(initialSource).map(kind => [kind,
            { unchanged: JSON.stringify(initialSource[kind]) === JSON.stringify(finalSource[kind]) }]));
        assert.deepEqual(finalSource, initialSource, 'Frozen application, QA closure or bundle app inputs changed'); report.sourceStable = true;
    } catch (error) { report.sourceStable = false; report.pass = false; report.sourceFailure = error.stack; report.gates.runtimeIntegrity = 'source-changed'; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Appearance UI evidence</title><style>body{font:16px system-ui;margin:24px;background:#f5f2e9}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;padding:12px}img{width:100%}small{display:block;overflow-wrap:anywhere}</style><h1>Appearance UI — image review pending</h1><p>${escape(target)} · ${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Only explicitly executed S01/S03/S04/S08/S10 subsets. All learning/rights were earned by actual UI answers. Technical assertions do not certify appeal or silent child comprehension.</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.frameFile)}" alt="${escape(item.name)}"></a><figcaption>${escape(item.file)}</figcaption><small>${escape(item.candidate)} · ${escape(item.delivery)} · ${escape(item.revision)} · ${escape(item.frameSha256)}</small></figure>`).join('')}</main>`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
