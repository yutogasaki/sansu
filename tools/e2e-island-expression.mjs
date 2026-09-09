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
const residents = ['otter', 'rabbit', 'fox'];
const expressionCandidate = 'island-expression-v1';
const residentExpressionCandidate = 'island-stitched-expression-v1';
const diagnosticContract = { candidate: 'figure[data-expression-candidate]', host: '[data-testid="island-stage"]',
    attributes: ['data-island-expression', 'data-island-expression-environment', 'data-island-expression-flag', 'data-island-expression-flag-focus'],
    expression: { residents: ['id', 'uuid', 'visible', 'candidate', 'outfit', 'pattern', 'groups'],
        trails: ['residentId', 'residentUuid', 'style', 'walking', 'marks'],
        walk: ['requestId', 'residentId', 'residentUuid', 'phase', 'checked', 'position', 'route', 'feet', 'tail', 'departure'] } };
const catalog = [
    { id: 'raincoat', slot: 'outfit', price: 25, category: 'friends' },
    { id: 'star-beret', slot: 'outfit', price: 20, category: 'friends' },
    { id: 'river-check', slot: 'pattern', price: 10, category: 'friends' },
    { id: 'butterfly-stitch', slot: 'pattern', price: 0, category: 'friends', requirement: 'ribbon-butterfly' },
    { id: 'leaf-trail', slot: 'trail', price: 10, category: 'friends' },
    { id: 'water-ring-trail', slot: 'trail', price: 15, category: 'friends' },
    { id: 'shell-three-notes', slot: 'soundscape', price: 0, category: 'world', requirement: 'bell' },
    { id: 'leaf-album-cover', slot: 'album-cover', price: 5, category: 'memories' },
    { id: 'butterfly-stamp', slot: 'album-stamp', price: 0, category: 'memories', requirement: 'ribbon-butterfly' },
    { id: 'leaf-bird-flag-trim', slot: 'flag-trim', price: 0, category: 'memories', requirement: 'leaf-bird' },
];
const scenarios = [
    'Empty DB and actual onboarding; ordinary real answers earn at least 85 stars and all three residents without writing fixture data',
    'All 10 unowned previews, cancellation and closure preserve every native store including photograph Blob hashes',
    'Two outfits x three residents; both foot trails x three actual walks with finite pools, contact and cancellation evidence; pattern remains separate',
    'Six paid acquisitions total 85 stars, each initially unequipped, followed by an explicit equip/remove/re-equip; no automatic equip after receipt',
    'Three chosen day periods x four seasons, free explicit saves, and restoration to the theme default; saved growth/items/poses remain unchanged (physical renderer invariants have separate unit coverage)',
    'An actual saved photograph is shown under the trial/owned album cover; export bytes and all stored photo metadata/PNG/thumbnail bytes remain identical',
    'Save confirmed outfits/pattern/trail/album/environment as sceneStyle v2; change them, preview/cancel the old scene, explicitly apply it, then re-edit without changing ownership or learning',
    'For each actual resident, select the free cap, equip the owned raincoat, rename without removing it, and explicitly select the same saved free cap again; pattern/trail and the real rig remain intact',
    'Close and learning interruption cancel trials; same entire learning reservation resumes and accepts an actual answer; reload keeps exact saved selections and stores',
    'Four observation-qualified items are freely previewable; absent persisted observation disables acquire. Any already eligible item is reported without inventing its acquisition path',
    'Actual flag inspection keeps the same flag/trim/nameplate UUIDs and 32 camera values through preview/cancel and an overview round trip; other items, exit and learning return release inspection without writes',
];
const remaining = [
    'Four qualified items: earning the actual butterfly/leaf-bird/bell observations and their later explicit acquisition/equipping are outside this first main path',
    'Native abort, unknown-result retry, competing tabs, profile separation, true background, service-worker offline and update/hold require a persistence phase',
    'Collected sound is previewed visually here; actual audio waveform, sound off/hidden release, free-sound override compatibility, old-scene migration and later-item collision need separate checks',
    'Human N=0; actual screenshots and technical checks do not certify visual appeal, silent comprehension, motivation or learning outcomes',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, serverStarted: false, applicationDataInjected: false,
        viewports, catalog, expressionCandidate, residentExpressionCandidate, diagnosticContract, scenarios, remaining,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_EXPRESSION_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_ISLAND_EXPRESSION_QA_ROOT: 'Explicit immutable QA bundle with matching app inputs and unchanged shared helpers',
            SANSU_ISLAND_EXPRESSION_VIEWPORT: 'phone or tablet; one viewport is partial', SANSU_ISLAND_EXPRESSION_HEADED: '1 for headed browser, still not a native-background claim' },
        sourceRule: 'Run snapshot/tools or an explicit immutable QA bundle; hash all fixed app inputs and the QA closure before/after.',
        outputRule: 'Fresh output only: per-action all-store exact deltas, PNGs/contact sheet, actual renderer probe traces and Playwright traces.',
    }, null, 2));
    process.exit(0);
}

const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_EXPRESSION_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set frozen URL, manifest and fresh output');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length, 'Frozen build manifest required');
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_EXPRESSION_QA_ROOT || manifest.snapshot), 'Run snapshot/tools or explicitly identify the immutable QA bundle');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = ['tools/e2e-island-expression.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'].map(file => path.join(sourceRoot, file));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), qa: await hashFiles(qaFiles),
    bundleAppInputs: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleAppInputs.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256,
    file.sha256, `QA bundle app differs: ${file.relative}`);
for (const file of qaFiles.slice(1)) {
    const relative = path.relative(sourceRoot, file), original = manifest.files.find(entry => entry.relative === relative);
    assert(original, `Missing frozen helper: ${relative}`);
    assert.equal(initialSource.qa.find(entry => entry.path === file)?.sha256, original.sha256, `Changed helper: ${relative}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec41Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false,
    expectedExpressionCandidate: expressionCandidate, expectedResidentExpressionCandidate: residentExpressionCandidate, diagnosticContract, scenarios, remaining,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)), explicitBundle: Boolean(process.env.SANSU_ISLAND_EXPRESSION_QA_ROOT) } },
    fingerprints: initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const panel = page => page.locator('section[aria-label="みじたくと コレクション"]');
const camera = page => page.getByTestId('island-photo-camera');
const gallery = page => page.getByTestId('island-photo-gallery');
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
    assert.equal(await stage(page).evaluate(host => host.closest('figure')?.getAttribute('data-expression-candidate')), expressionCandidate,
        'The actual Stage figure must identify the frozen expression candidate');
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

const emptySelection = () => ({ version: 1, residents: Object.fromEntries(residents.map(id => [id, { outfit: null, pattern: null, trail: null }])),
    soundscape: null, environment: { period: null, season: null }, album: { cover: null, stamp: null }, flagTrim: null });
const savedExpression = island => structuredClone(island.expression ?? { version: 1, ownedItemIds: [], selection: emptySelection() });
const savedExperience = island => structuredClone(island.experience ?? { version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off',
    residents: { otter: { name: 'カワウソ', look: 'original' }, rabbit: { name: 'ウサギ', look: 'original' }, fox: { name: 'キツネ', look: 'original' } }, layouts: [] });
function sceneCapture(island, action, timestamp) {
    const experience = savedExperience(island), { themeId, accentId, appearance } = island.customization;
    const slots = ['sky', 'ground', 'shore', 'path', 'water', 'houseBody', 'houseRoof', 'houseWindows', 'tree', 'flower', 'mushroom', 'bridge'];
    return { id: action.layoutId, name: action.name, capturedAt: timestamp,
        poses: island.items.map(({ id, position, rotation }) => ({ id, rotation, ...(position ? { position } : {}) })),
        cosmetics: { themeId, accentId, appearance: appearance ?? { version: 1, slots: Object.fromEntries(slots.map(slot => [slot, `legacy-v1:${themeId}:${slot}`])) } },
        sceneStyle: { version: 2, residentLooks: Object.fromEntries(residents.map(id => [id, experience.residents[id].look])),
            ambience: experience.ambience, emblem: experience.emblem, expression: savedExpression(island).selection } };
}
function applySelection(selection, action) {
    const result = structuredClone(selection);
    if (['equip-outfit', 'equip-pattern', 'equip-trail'].includes(action.type)) result.residents[action.residentId][action.type.slice(6)] = action.itemId;
    else if (action.type === 'period') result.environment.period = action.period;
    else if (action.type === 'season') result.environment.season = action.season;
    else if (action.type === 'equip-album-cover') result.album.cover = action.itemId;
    else if (action.type === 'equip-album-stamp') result.album.stamp = action.itemId;
    else if (action.type === 'equip-soundscape') result.soundscape = action.itemId;
    else if (action.type === 'equip-flag-trim') result.flagTrim = action.itemId;
    else throw new Error(`Unsupported audited action ${JSON.stringify(action)}`);
    return result;
}
const equipAction = (item, residentId = 'otter', remove = false) => ({ type: `equip-${item.slot}`,
    ...(['outfit', 'pattern', 'trail'].includes(item.slot) ? { residentId } : {}), itemId: remove ? null : item.id });
function exactDelta(before, after, owner, action) {
    assert.deepEqual(Object.keys(after), Object.keys(before));
    if (!action) { assert.deepEqual(after, before, 'Preview/cancel/view/return must preserve every store and Blob hash'); return; }
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name], `${name}: optional action changed unrelated data`);
    const old = islandFor(before, owner), updated = islandFor(after, owner), expected = structuredClone(old);
    assert(old && updated); assert.equal(updated.revision, old.revision + 1); assert(Number.isFinite(updated.updatedAt));
    expected.revision++; expected.updatedAt = updated.updatedAt; expected.expression = savedExpression(old);
    const isSceneAction = ['save-layout', 'apply-layout'].includes(action.type);
    const isExperienceAction = isSceneAction || ['resident-name', 'resident-look'].includes(action.type);
    if (isSceneAction) {
        expected.experience = savedExperience(old);
        if (action.type === 'save-layout') {
            expected.experience.layouts = [...expected.experience.layouts.filter(layout => layout.id !== action.layoutId), sceneCapture(old, action, updated.updatedAt)]
                .sort((a, b) => a.id.localeCompare(b.id));
        } else {
            const saved = expected.experience.layouts.find(layout => layout.id === action.layoutId); assert.equal(saved?.sceneStyle.version, 2);
            expected.expression.selection = structuredClone(saved.sceneStyle.expression);
            for (const id of residents) expected.experience.residents[id].look = saved.sceneStyle.residentLooks[id];
            expected.experience.ambience = saved.sceneStyle.ambience; expected.experience.emblem = saved.sceneStyle.emblem;
            expected.customization = { ...expected.customization, ...structuredClone(saved.cosmetics) };
            expected.items = expected.items.map(item => {
                const pose = saved.poses.find(pose => pose.id === item.id);
                return pose ? { ...item, rotation: pose.rotation, position: pose.position, autoPlacementBlocked: undefined } : item;
            });
        }
    } else if (action.type === 'resident-name' || action.type === 'resident-look') {
        expected.experience = savedExperience(old);
        if (action.type === 'resident-name') expected.experience.residents[action.residentId].name = action.name;
        else {
            expected.experience.residents[action.residentId].look = action.look;
            expected.expression.selection.residents[action.residentId].outfit = null;
        }
    } else if (action.type === 'acquire') {
        const item = catalog.find(item => item.id === action.itemId); assert(item && !expected.expression.ownedItemIds.includes(item.id));
        expected.expression.ownedItemIds = catalog.filter(entry => entry.id === item.id || expected.expression.ownedItemIds.includes(entry.id)).map(entry => entry.id);
        if (item.price) expected.customization.points -= item.price;
    } else expected.expression.selection = applySelection(expected.expression.selection, action);
    assert.deepEqual(after.islands, before.islands.map(island => island.profileId === owner ? expected : island), 'Only exact expression/authorized wallet fields may change');
    const ids = new Set(before.islandEvents.map(event => event.id)), added = after.islandEvents.filter(event => !ids.has(event.id));
    assert.deepEqual(after.islandEvents.filter(event => ids.has(event.id)), before.islandEvents, 'Existing receipts are immutable');
    assert.deepEqual(added, [{ id: JSON.stringify([isExperienceAction ? 'island-experience-v1' : 'island-expression-v1', owner, old.revision]), profileId: owner,
        type: isExperienceAction ? 'experience_changed' : 'expression_changed', timestamp: updated.updatedAt, action }]);
}
async function checkDB(page, row, name, before, action) {
    await idle(page); const after = await tables(page), changedStores = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const file = `${row.name}-db-${String(row.databaseChecks.length + 1).padStart(3, '0')}-${name}.json`;
    const entry = { name, file, action: action ?? null, before: digestTables(before), after: digestTables(after), changedStores, pass: false };
    row.databaseChecks.push(entry);
    try { exactDelta(before, after, row.owner, action); entry.pass = true; }
    finally { await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...entry, revision: manifest.revision, sourceHash: manifest.sourceHash,
        changes: Object.fromEntries(changedStores.map(key => [key, { before: before[key], after: after[key] }])) }, null, 2)); }
    return after;
}
async function scene(page) {
    return stage(page).evaluate(host => {
        const read = key => { const value = host.getAttribute(key); return value ? JSON.parse(value) : null; };
        return { expressionCandidate: host.closest('figure')?.getAttribute('data-expression-candidate') ?? null,
            expression: read('data-island-expression'), environment: read('data-island-expression-environment'), flag: read('data-island-expression-flag'),
            flagFocus: read('data-island-expression-flag-focus'),
            appearance: read('data-island-appearance'), residents: read('data-resident-states'), furniture: read('data-furniture-state'),
            camera: host.dataset.cameraFrame, frameTimestamp: Number(host.dataset.frameTimestamp),
            hidden: document.hidden, mode: document.querySelector('.island-page')?.dataset.mode };
    });
}
async function waitScene(page, predicate, label, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await scene(page); if (predicate(value)) return value; await pause(40); }
    throw new Error(`Actual renderer did not reach ${label}: ${JSON.stringify(await scene(page))}`);
}
function flagFrame(actual, baseline) {
    const focus = actual.flagFocus, camera = actual.camera?.split(',').map(Number);
    assert.equal(focus?.candidate, 'island-flag-inspection-v1');
    for (const key of ['flagUuid', 'trimUuid', 'nameplateUuid']) assert(typeof focus[key] === 'string' && focus[key].length > 0);
    assert.equal(focus.trimUuid, actual.flag?.uuid, 'Inspection must use the actual flag decoration group');
    assert.equal(focus.target.length, 3); assert(focus.target.every(Number.isFinite));
    assert.equal(camera?.length, 32); assert(camera.every(Number.isFinite));
    const result = { focus, camera };
    if (baseline) assert.deepEqual(result, baseline, 'Flag inspection keeps the same actual objects, target and all camera values');
    return result;
}
async function waitFlagFrame(page, after = -1, baseline) {
    await waitWorld(page);
    const actual = await waitScene(page, value => !value.hidden && value.mode === 'expression' && value.frameTimestamp > after
        && value.flagFocus?.candidate === 'island-flag-inspection-v1', 'new actual flag inspection frame');
    flagFrame(actual, baseline); return actual;
}
async function waitFlagReleased(page, after, mode) {
    // A hidden learning Stage may retain its last debug attributes. Only a new
    // visible renderer frame in the requested destination proves release.
    await waitWorld(page);
    return waitScene(page, value => !value.hidden && value.mode === mode && value.frameTimestamp > after
        && value.flagFocus === null, `new ${mode} frame without flag inspection`);
}
async function waitRevision(page, row, revision) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { const native = await readNative(page, row.owner); if (native.island.revision >= revision) { await idle(page); return native; } await pause(40); }
    throw new Error(`Native expression revision ${revision} was not committed`);
}
function assertResident(actual, id, choice) {
    const resident = actual.expression?.residents?.find(resident => resident.id === id);
    assert(resident?.uuid, 'Actual resident rig diagnostic required');
    assert.equal(resident.candidate, residentExpressionCandidate);
    assert.equal(resident.outfit, choice.outfit); assert.equal(resident.pattern, choice.pattern);
    const visible = name => resident.groups.find(group => group.name === name)?.visible;
    assert.equal(visible('expression-raincoat'), choice.outfit === 'raincoat');
    assert.equal(visible('expression-star-beret'), choice.outfit === 'star-beret');
    assert.equal(visible('expression-pattern-cloth'), choice.pattern !== null);
    return resident;
}
async function waitSelection(page, selection) {
    const actual = await waitScene(page, actual => actual.expression?.residents?.length === 3 && actual.environment
        && residents.every(id => { const resident = actual.expression.residents.find(entry => entry.id === id);
            return resident?.outfit === selection.residents[id].outfit && resident?.pattern === selection.residents[id].pattern; })
        && residents.every(id => actual.expression.trails?.find(track => track.residentId === id)?.style === selection.residents[id].trail)
        && actual.flag?.trim === selection.flagTrim && (!selection.flagTrim || actual.flag.visible)
        && actual.environment.period === selection.environment.period && actual.environment.season === selection.environment.season, 'rendered expression selection');
    assert.equal(actual.expressionCandidate, expressionCandidate);
    for (const id of residents) assertResident(actual, id, selection.residents[id]);
    return actual;
}
async function capture(page, row, name, extra = {}) {
    const mode = await page.locator('.island-page').getAttribute('data-mode'), learning = mode === 'learning', photos = mode === 'photos';
    if (learning) await waitLearningInput(page); else if (photos) await gallery(page).locator('.island-photo-detail img').waitFor(); else await waitWorld(page);
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'input' : photos ? 'photo' : 'world'}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await (learning ? page.locator('.island-workbench') : photos ? gallery(page) : stage(page)).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    const actual = learning || photos ? null : await scene(page);
    report.captures.push({ name, file, frameFile, sha256: sha(bytes), frameSha256: sha(frame), ...metadata, ...extra,
        expressionCandidate: actual?.expressionCandidate ?? null,
        frameKind: learning ? 'actual-learning-input' : photos ? 'actual-stored-photo' : 'actual-world', actual });
}
async function enterExpression(page, row) {
    await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
    await activate(page.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression'); await waitWorld(page);
}
async function closeExpression(page, row) {
    await press(page, row, 'みじたくから もどる', panel(page)); await waitMode(page, 'experience');
    await press(page, row, 'なまえ・けしきから もどる', page.getByTestId('island-experience')); await waitMode(page, 'home'); await waitWorld(page);
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
async function act(page, row, name, action, locator) {
    const before = await tables(page), old = islandFor(before, row.owner);
    await activate(locator, row.touch); await waitRevision(page, row, old.revision + 1);
    const after = await checkDB(page, row, name, before, action);
    await waitSelection(page, savedExpression(islandFor(after, row.owner)).selection);
    return after;
}

async function earn(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    await press(page, row, 'まなぶ'); await page.locator('.island-setup-name input').fill(`みじたく${row.name}`);
    await press(page, row, '年中'); await press(page, row, 'さんすう');
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitLearningInput(page);
    let native = await readNative(page), answers = 0; row.owner = native.plan.profileId;
    while ((native.island.customization?.points ?? 0) < 85 || native.island.completedSets < 4 || (native.island.growth?.expansionLevel ?? 0) < 1 || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers < 300, 'Bounded ordinary answers must earn 85 stars and the second land');
    }
    const receipts = native.islandEvents.filter(event => event.type === 'answer'); assert.equal(receipts.length, answers);
    row.earned = { fixture: false, answers, answerReceiptIds: receipts.map(event => event.id), points: native.island.customization.points,
        completedSets: native.island.completedSets, reservedPlan: native.plan };
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
}
async function createPhoto(page, row) {
    await press(page, row, 'アルバム'); await waitMode(page, 'album'); await press(page, row, 'しゃしん'); await waitMode(page, 'photos');
    await press(page, row, 'しゃしんを とる', gallery(page)); await waitMode(page, 'camera'); await waitWorld(page);
    const before = await tables(page); assert.equal(before.islandPhotos.length, 0);
    await activate(camera(page).locator('[data-photo-action="capture"]'), row.touch);
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.getAttribute('data-photo-status') === 'saved'); await idle(page);
    const after = await tables(page), photo = after.islandPhotos[0], blob = after.islandPhotoBlobs[0];
    for (const name of Object.keys(before)) if (!['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name]);
    assert.equal(after.islandPhotos.length, 1); assert.equal(after.islandPhotoBlobs.length, 1);
    assert.equal(photo.profileId, row.owner); assert.equal(blob.profileId, row.owner); assert.equal(blob.id, photo.id);
    assert.equal(blob.image.sha256, photo.image.sha256); assert.equal(blob.thumbnail.sha256, photo.thumbnail.sha256);
    const priorEvents = new Set(before.islandEvents.map(event => event.id)), added = after.islandEvents.filter(event => !priorEvents.has(event.id));
    assert.deepEqual(after.islandEvents.filter(event => priorEvents.has(event.id)), before.islandEvents);
    assert.equal(added.length, 1); assert.equal(added[0].type, 'photo_changed'); assert.equal(added[0].photoReceipt.result, 'saved');
    assert.equal(added[0].profileId, row.owner); assert.deepEqual(added[0].action, { type: 'save-photo', photo });
    const revision = before.islandPhotoAlbums.find(album => album.profileId === row.owner)?.revision ?? 0;
    assert.deepEqual(after.islandPhotoAlbums, [{ profileId: row.owner, version: 1, revision: revision + 1 }]);
    row.photo = { metadata: photo, blobHashes: blob, creationReceipt: added[0], before: digestTables(before), after: digestTables(after) };
    const downloadPromise = page.waitForEvent('download'); await press(page, row, 'PNGで とりだす', camera(page));
    const download = await downloadPromise, file = `${row.name}-original-photo.png`; await download.saveAs(`${out}/${file}`);
    assert.equal(sha(await fs.readFile(`${out}/${file}`)), photo.image.sha256); row.photo.originalExport = file;
    await capture(page, row, 'original-photo');
    await press(page, row, 'しゃしんを みる', camera(page)); await waitMode(page, 'photos');
    await press(page, row, 'しゃしんの アルバムから もどる', gallery(page)); await waitMode(page, 'home');
}

/** Read-only actual frame probe. It never dispatches an application action. */
async function startProbe(page) {
    await page.evaluate(() => {
        window.__expressionQA?.observer?.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]');
        const probe = window.__expressionQA = { frames: [], images: [], closed: false }; let last = '', lastPhase = '';
        const sample = () => {
            const stamp = host.dataset.frameTimestamp; if (probe.closed || !stamp || stamp === last || probe.frames.length >= 3000) return; last = stamp;
            const read = name => { const value = host.getAttribute(name); return value ? JSON.parse(value) : null; };
            const expression = read('data-island-expression'), canvas = host.querySelector('canvas'), box = canvas?.getBoundingClientRect();
            const frame = { timestamp: Number(stamp), ms: performance.now(), expression, furniture: read('data-furniture-state'),
                expressionCandidate: host.closest('figure')?.getAttribute('data-expression-candidate') ?? null, hidden: document.hidden,
                canvas: { width: box?.width, height: box?.height, visible: Boolean(box && box.width > 100 && box.height > 100
                    && box.top >= 0 && box.top < innerHeight && document.elementFromPoint(box.x + box.width / 2, Math.min(innerHeight - 1, box.y + box.height / 2)) === canvas) } };
            probe.frames.push(frame);
            const mark = expression?.trails?.some(track => track.marks.some(mark => mark.visible));
            const phase = mark ? 'contact-mark' : expression?.walk?.phase;
            if (phase && phase !== lastPhase && probe.images.length < 12 && frame.canvas.visible && !document.hidden) {
                lastPhase = phase; probe.images.push({ phase, frame, png: canvas.toDataURL('image/png') });
            }
        };
        probe.observer = new MutationObserver(sample); probe.observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] }); sample();
    });
}
async function finishProbe(page, row, name) {
    const probe = await page.evaluate(() => { const value = window.__expressionQA; if (!value || value.closed) return null;
        value.closed = true; value.observer.disconnect(); return { frames: value.frames, images: value.images }; });
    if (!probe) return null;
    const images = [];
    for (const [index, image] of probe.images.entries()) {
        const file = `${row.name}-${name}-phase-${index}-${image.phase}.png`, bytes = Buffer.from(image.png.split(',')[1], 'base64');
        await fs.writeFile(`${out}/${file}`, bytes); images.push({ file, sha256: sha(bytes), phase: image.phase, frame: image.frame });
    }
    const file = `${row.name}-${name}-frames.json`; await fs.writeFile(`${out}/${file}`, JSON.stringify({ revision: manifest.revision, frames: probe.frames, images }, null, 2));
    row.traces.push({ name, file, frameCount: probe.frames.length, images });
    return { frames: probe.frames, images };
}
async function trailPreview(page, row, item, residentId, name) {
    await startProbe(page);
    try {
        await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch); await waitWorld(page);
        const moving = await waitScene(page, actual => actual.expression?.walk?.residentId === residentId
            && ['walking', 'settled', 'blocked'].includes(actual.expression.walk.phase), 'actual chosen-resident trail walk');
        assert.notEqual(moving.expression.walk.phase, 'blocked', 'A blocked route is evidence of failure, not an invented successful walk');
        const requestId = moving.expression.walk.requestId; assert(requestId);
        const rig = moving.expression.residents.find(resident => resident.id === residentId);
        assert(rig?.visible, 'The chosen resident must be visible in the actual scene');
        assert.equal(moving.expression.walk.residentUuid, rig.uuid, 'The walk must use the chosen existing resident rig');
        await waitScene(page, actual => actual.expression?.walk?.requestId === requestId && actual.expression.walk.phase === 'settled', 'trail walk reaches its real destination');
        const probe = await finishProbe(page, row, name); assert(probe);
        const frames = probe.frames.filter(frame => frame.expression?.walk?.requestId === requestId);
        assert(frames.some(frame => frame.expression.walk.phase === 'walking'));
        for (const frame of frames) {
            assert.equal(frame.expressionCandidate, expressionCandidate);
            assert.equal(frame.expression.walk.residentUuid, rig.uuid);
            assert.equal(frame.expression.residents.find(resident => resident.id === residentId)?.uuid, rig.uuid);
        }
        const departureFrames = frames.filter(frame => frame.expression.walk.phase === 'departing');
        const departure = frames.find(frame => frame.expression.walk.departure)?.expression.walk.departure;
        if (departure) {
            assert(departureFrames.some(frame => frame.canvas.visible && !frame.hidden), 'A real seat departure must be drawn before the ground walk');
            assert.equal(typeof departure.seatUuid, 'string'); assert.equal(typeof departure.support.meshUuid, 'string');
            const support = departure.support;
            assert(support.point.length === 3 && support.point.every(Number.isFinite));
            assert(support.normal.length === 3 && support.normal.every(Number.isFinite));
            assert(Math.abs(Math.hypot(...support.normal) - 1) < 1e-5, 'Support comes from an actual unit surface normal');
            support.point.forEach((value, i) => assert(value >= support.bounds.min[i] - 1e-6 && value <= support.bounds.max[i] + 1e-6));
            for (const frame of departureFrames) {
                const walk = frame.expression.walk;
                assert.deepEqual(walk.departure.support, support); assert.equal(walk.departure.seatUuid, departure.seatUuid);
                assert(frame.furniture.some(item => item.id === departure.seatId && item.visible), 'The occupied seat remains the same visible actual furniture');
                assert(walk.position.length === 3 && walk.position.every(Number.isFinite));
                assert.equal(walk.feet.length, 2);
                for (const foot of walk.feet) assert(typeof foot.uuid === 'string' && foot.sole.length === 3 && foot.sole.every(Number.isFinite) && Number.isFinite(foot.groundY));
                assert(frame.expression.trails.every(track => track.marks.every(mark => !mark.visible)), 'A seated/departing body must not emit ground footprints');
            }
            const firstGround = frames.find(frame => frame.expression.walk.phase === 'walking').expression.walk;
            assert(firstGround.feet.some(foot => Math.abs(foot.sole[1] - foot.groundY) <= .008), 'An actual sole reaches the ground before ordinary walking');
            assert.equal(firstGround.departure.landed, true);
            assert(probe.images.some(image => image.phase === 'departing'), 'Preserve an actual departure image for visual review');
        }
        const pool = frames[0].expression.trails.map(track => ({ residentId: track.residentId, residentUuid: track.residentUuid,
            marks: track.marks.map(mark => mark.uuid) }));
        assert.equal(pool.reduce((sum, track) => sum + track.marks.length, 0), 24);
        assert.equal(new Set(pool.flatMap(track => track.marks)).size, 24);
        if (row.trailPool) assert.deepEqual(pool, row.trailPool, 'Repeated trials reuse the same three rigs and 24 physical marks');
        else row.trailPool = pool;
        const contacts = frames.flatMap(frame => (frame.expression.trails ?? []).filter(track => track.residentId === residentId)
            .flatMap(track => track.marks.filter(mark => mark.visible).map(mark => ({ frame, track, mark }))));
        assert(contacts.some(({ frame }) => frame.canvas.visible && !frame.hidden), 'Real foot marks must be seen in the actual visible canvas');
        for (const { frame, track, mark } of contacts) {
            assert.equal(track.style, item.id); assert.equal(mark.style, item.id); assert.equal(track.residentUuid, rig.uuid);
            assert([0, 1].includes(mark.foot)); assert(mark.born > 0); assert(mark.contact.every(Number.isFinite));
            assert.equal(mark.position[0], mark.contact[0]); assert.equal(mark.position[2], mark.contact[2]);
            const limit = row.reducedMotion === 'reduce' ? 2 : 8;
            assert(track.marks.length <= 8); assert(track.marks.filter(mark => mark.visible).length <= limit);
            assert(frame.expression.trails.reduce((sum, value) => sum + value.marks.filter(mark => mark.visible).length, 0) <= limit * 3);
        }
        assert(probe.images.some(image => image.phase === 'contact-mark'), 'Preserve a real PNG with the visible foot mark');
        row.walks.push({ name, itemId: item.id, residentId, requestId, frames: frames.length, actualContacts: contacts.length,
            seatDeparture: departure ? { ...departure, frames: departureFrames.length, pass: true } : { status: 'not-exercised' }, pass: true });
    } finally { await finishProbe(page, row, `${name}-interrupted`); }
}
async function preview(page, row, item, residentId = 'otter', suffix = '') {
    await selectItem(page, row, item, residentId); const before = await tables(page), saved = savedExpression(islandFor(before, row.owner)).selection;
    const name = `preview-${item.id}-${residentId}${suffix}`;
    const flagBaseline = item.slot === 'flag-trim' ? flagFrame(await waitFlagFrame(page)) : undefined;
    if (flagBaseline) await capture(page, row, 'flag-current-close');
    if (item.slot === 'trail') await trailPreview(page, row, item, residentId, name);
    else await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await panel(page).locator('.island-expression-preview').waitFor();
    if (flagBaseline) await waitWorld(page);
    const actual = await waitSelection(page, applySelection(saved, equipAction(item, residentId)));
    if (['outfit', 'pattern'].includes(item.slot)) assert.equal(actual.expression.residents.find(resident => resident.id === residentId)?.visible, true,
        'Trial clothing must be applied to the chosen visible resident');
    if (item.slot === 'album-cover' || item.slot === 'album-stamp') {
        const photo = panel(page).locator('.island-photo-album-preview img'); await photo.waitFor();
        assert(await photo.evaluate(image => image.complete && image.naturalWidth > 0), 'Use a real saved photograph in the trial');
        if (item.slot === 'album-cover') assert.equal(await panel(page).locator('[data-album-cover]').getAttribute('data-album-cover'), item.id);
        else await panel(page).locator(`[data-album-stamp="${item.id}"]`).waitFor();
    }
    if (item.slot === 'flag-trim') {
        assert(actual.flag, 'Actual physical flag diagnostic must exist; review its PNG separately');
        assert.equal(actual.flag.trim, item.id); assert.equal(actual.flag.visible, true);
        flagFrame(actual, flagBaseline);
        await flagOverviewRoundTrip(page, row, flagBaseline, before);
    }
    await capture(page, row, name); await checkDB(page, row, name, before);
    await press(page, row, 'いまに もどす', panel(page));
    if (flagBaseline) await waitWorld(page);
    await waitSelection(page, saved);
    await waitScene(page, actual => !actual.expression?.walk, 'trial is fully released on cancel');
    if (item.slot === 'trail') await waitScene(page, actual => actual.expression.trails.every(track => track.marks.every(mark => !mark.visible)), 'cancel clears every foot mark');
    await checkDB(page, row, `${name}-cancel`, before);
    if (flagBaseline) {
        const cancelled = await waitFlagFrame(page, actual.frameTimestamp, flagBaseline);
        assert.equal(cancelled.flag.trim, saved.flagTrim);
        await capture(page, row, 'flag-cancelled-close');
        await flagNavigation(page, row, item, flagBaseline, before, saved);
    }
}

async function flagOverviewRoundTrip(page, row, baseline, before) {
    const control = panel(page).locator('[data-expression-action="flag-view"]');
    assert.equal(await control.getAttribute('aria-pressed'), 'true');
    assert.equal((await control.innerText()).trim(), 'しま全体を みる');
    const near = await scene(page); await activate(control, row.touch);
    const overview = await waitFlagReleased(page, near.frameTimestamp, 'expression');
    assert.equal(await control.getAttribute('aria-pressed'), 'false');
    assert.notDeepEqual(overview.camera.split(',').map(Number), baseline.camera, 'Overview must change the actual camera');
    assert.equal(overview.flag.uuid, baseline.focus.trimUuid); assert.equal(overview.flag.trim, 'leaf-bird-flag-trim');
    assert.equal(overview.flag.visible, true, 'Changing the view preserves the active trial');
    await capture(page, row, 'flag-preview-overview'); await checkDB(page, row, 'flag-overview-no-write', before);
    assert.equal((await control.innerText()).trim(), 'はたを みる'); await activate(control, row.touch);
    const restored = await waitFlagFrame(page, overview.frameTimestamp, baseline);
    assert.equal(await control.getAttribute('aria-pressed'), 'true');
    await capture(page, row, 'flag-preview-close-return'); await checkDB(page, row, 'flag-close-return-no-write', before);
    row.flagInspection = { baseline, overview: { camera: overview.camera, frameTimestamp: overview.frameTimestamp },
        returnedAt: restored.frameTimestamp, roundTrip: true, pass: false, ownedEquip: 'not-run; requires actual observation-qualified acquisition' };
}
async function flagNavigation(page, row, item, baseline, before, saved) {
    let previous = await scene(page);
    await selectItem(page, row, catalog.find(entry => entry.id === 'leaf-album-cover'));
    await waitFlagReleased(page, previous.frameTimestamp, 'expression');
    await checkDB(page, row, 'flag-other-item-releases', before);
    await selectItem(page, row, item); previous = await waitFlagFrame(page, -1, baseline);
    await closeExpression(page, row); await waitFlagReleased(page, previous.frameTimestamp, 'home');
    await checkDB(page, row, 'flag-exit-releases', before);
    await enterExpression(page, row); await selectItem(page, row, item); await waitFlagFrame(page, -1, baseline);
    await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await waitWorld(page);
    previous = await waitSelection(page, applySelection(saved, equipAction(item))); flagFrame(previous, baseline);
    const plan = (await readNative(page, row.owner)).plan;
    await press(page, row, 'まなぶ', panel(page)); await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page, row.owner)).plan, plan);
    assert(await page.evaluate(() => {
        const world = document.querySelector('[data-testid="island-stage"]');
        return document.querySelector('.island-page')?.dataset.mode === 'learning'
            && (!world || world.closest('[aria-hidden="true"]') || world.getBoundingClientRect().height === 0);
    }), 'Learning hides the Stage; stale hidden flag attributes are not a completion signal');
    await capture(page, row, 'flag-learning-same-reservation'); await checkDB(page, row, 'flag-learning-no-write', before);
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await waitWorld(page);
    const home = await waitFlagReleased(page, previous.frameTimestamp, 'home');
    assert.equal(home.flag.trim, saved.flagTrim, 'Learning cancels the unsaved flag decoration');
    assert.deepEqual((await readNative(page, row.owner)).plan, plan);
    await capture(page, row, 'flag-learning-return-home'); await checkDB(page, row, 'flag-home-after-learning-no-write', before);
    await enterExpression(page, row); await selectItem(page, row, item); await waitFlagFrame(page, home.frameTimestamp, baseline);
    await waitSelection(page, saved); await checkDB(page, row, 'flag-reopen-current-no-write', before);
    Object.assign(row.flagInspection, { otherItemReleased: true, exitReleased: true, learningStageHidden: true,
        samePlanId: plan.id, homeReleaseFrame: home.frameTimestamp, pass: true });
    row.coverage.flagInspection = 'pass-same-objects-camera-overview-cancel-and-release; visual-review-pending';
}

async function mainPreviews(page, row) {
    await enterExpression(page, row);
    assert.deepEqual(await panel(page).locator('[data-expression-resident-choice]').evaluateAll(nodes => nodes.map(node => node.dataset.expressionResidentChoice)), residents);
    await waitSelection(page, savedExpression((await readNative(page, row.owner)).island).selection);
    for (const item of catalog) {
        if (['outfit', 'trail'].includes(item.slot)) for (const resident of residents) await preview(page, row, item, resident);
        else await preview(page, row, item);
        if (item.requirement) {
            const native = await readNative(page, row.owner), eligible = item.requirement === 'bell'
                ? Boolean(native.island.workshop?.creations.some(entry => entry.partId === 'bell'))
                : Boolean(native.island.growth?.discoveries.some(entry => entry.id === item.requirement));
            const acquire = panel(page).locator('[data-expression-action="acquire"]'); assert.equal(await acquire.isDisabled(), !eligible);
            assert(!native.island.expression?.ownedItemIds.includes(item.id), 'Observation alone must not grant ownership');
            row.qualification.push({ itemId: item.id, requirement: item.requirement, actualSavedObservation: eligible,
                preview: 'verified', acquisitionDisabled: !eligible, acquisitionPath: 'not-run' });
        }
    }
    // Leaving from a live unowned outfit trial must be another no-write cancellation.
    const before = await tables(page), saved = savedExpression(islandFor(before, row.owner)).selection;
    await selectItem(page, row, catalog[0]); await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await closeExpression(page, row); await waitSelection(page, saved); await checkDB(page, row, 'preview-close', before);
    await enterExpression(page, row);
}
async function acquireAndEquip(page, row) {
    const starting = await tables(page), initialPoints = islandFor(starting, row.owner).customization.points;
    for (const item of catalog.filter(item => item.price > 0)) {
        await selectItem(page, row, item); const old = savedExpression((await readNative(page, row.owner)).island);
        const after = await act(page, row, `acquire-${item.id}`, { type: 'acquire', itemId: item.id }, panel(page).locator('[data-expression-action="acquire"]'));
        assert.deepEqual(islandFor(after, row.owner).expression.selection, old.selection, 'Acquisition never equips the new item');
        await capture(page, row, `${item.id}-owned-not-equipped`);
        const choices = item.slot === 'outfit' ? residents : ['otter'];
        for (const residentId of choices) {
            await selectItem(page, row, item, residentId);
            await act(page, row, `equip-${item.id}-${residentId}`, equipAction(item, residentId), panel(page).locator('[data-expression-action="equip"]'));
            await capture(page, row, `${item.id}-${residentId}-equipped`);
            await act(page, row, `remove-${item.id}-${residentId}`, equipAction(item, residentId, true), panel(page).locator('[data-expression-action="remove"]'));
            await act(page, row, `reequip-${item.id}-${residentId}`, equipAction(item, residentId), panel(page).locator('[data-expression-action="equip"]'));
        }
        row.acquisitions.push({ itemId: item.id, price: item.price, pass: true });
    }
    const final = await tables(page), expression = islandFor(final, row.owner).expression;
    assert.equal(initialPoints - islandFor(final, row.owner).customization.points, 85);
    assert.deepEqual(expression.ownedItemIds, catalog.filter(item => item.price > 0).map(item => item.id));
    const newReceipts = final.islandEvents.filter(event => event.type === 'expression_changed' && event.action.type === 'acquire');
    assert.equal(newReceipts.length, 6);
    for (const name of ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs']) assert.deepEqual(final[name], starting[name]);
}

async function freeEnvironment(page, row) {
    await press(page, row, 'けしきと おと', panel(page));
    const before = await tables(page), baseline = await scene(page);
    for (const period of ['morning', 'day', 'evening']) {
        const prior = await tables(page);
        await activate(panel(page).locator(`[data-expression-period="${period}"]`), row.touch);
        await waitScene(page, actual => actual.environment?.period === period, `preview ${period}`); await checkDB(page, row, `preview-${period}`, prior);
        await act(page, row, `period-${period}`, { type: 'period', period }, panel(page).locator('[data-expression-action="apply-free"]'));
        for (const season of ['spring', 'summer', 'autumn', 'winter']) {
            const unchanged = await tables(page);
            await activate(panel(page).locator(`[data-expression-season="${season}"]`), row.touch);
            await waitScene(page, actual => actual.environment?.period === period && actual.environment?.season === season, `preview ${period}/${season}`);
            await checkDB(page, row, `preview-${period}-${season}`, unchanged);
            await capture(page, row, `${period}-${season}-preview`);
            await act(page, row, `season-${period}-${season}`, { type: 'season', season }, panel(page).locator('[data-expression-action="apply-free"]'));
            const actual = await scene(page); assert(actual.environment.materialCount > 0, 'Season must affect actual material assignments');
            row.environments.push({ period, season, actual: actual.environment, pass: true });
        }
    }
    for (const type of ['period', 'season']) {
        await activate(panel(page).locator(`[data-expression-${type}="default"]`), row.touch);
        await act(page, row, `restore-${type}`, { type, [type]: null }, panel(page).locator('[data-expression-action="apply-free"]'));
    }
    const restored = await scene(page), after = await tables(page);
    assert.equal(new Set(row.environments.map(entry => JSON.stringify([entry.actual.background, entry.actual.sun]))).size, 3,
        'Three periods must differ in the actual light/background, beyond selected labels');
    assert.equal(new Set(row.environments.filter(entry => entry.period === 'day').map(entry => JSON.stringify(entry.actual.surfaces.map(surface => surface.colors)))).size, 4,
        'Four seasons must differ in actual ground/vegetation material colors');
    assert.deepEqual(restored.environment, baseline.environment, 'Default must restore actual original lights/background and release seasonal materials');
    const old = islandFor(before, row.owner), now = islandFor(after, row.owner);
    assert.equal(now.customization.points, old.customization.points); assert.deepEqual(now.items, old.items); assert.deepEqual(now.growth, old.growth);
    await capture(page, row, 'environment-default-restored');
}
async function exportUnchangedPhoto(page, row) {
    const before = await tables(page); await closeExpression(page, row);
    await press(page, row, 'アルバム'); await waitMode(page, 'album'); await press(page, row, 'しゃしん'); await waitMode(page, 'photos');
    assert.equal(await gallery(page).locator('[data-album-cover]').getAttribute('data-album-cover'), 'leaf-album-cover');
    await activate(gallery(page).locator(`[data-photo-id='${row.photo.metadata.id}']`), row.touch);
    const exportButton = button(gallery(page), 'PNGで とりだす'); await exportButton.waitFor();
    await page.waitForFunction(() => { const button = [...document.querySelectorAll('.island-photo-detail button')].find(button => button.textContent.includes('PNGで'));
        return button && !button.disabled; });
    const downloadPromise = page.waitForEvent('download'); await activate(exportButton, row.touch);
    const download = await downloadPromise, file = `${row.name}-decorated-album-original-export.png`; await download.saveAs(`${out}/${file}`);
    assert.equal(sha(await fs.readFile(`${out}/${file}`)), row.photo.metadata.image.sha256);
    await checkDB(page, row, 'decorated-album-original-export', before); await capture(page, row, 'decorated-real-photo');
    row.photo.decoratedExport = file;
    await press(page, row, 'しゃしんの アルバムから もどる', gallery(page)); await waitMode(page, 'home'); await enterExpression(page, row);
}
async function sceneRoundTrip(page, row) {
    const before = await tables(page), original = islandFor(before, row.owner), layoutId = 'slot-1', name = 'みんなの ひとやすみ';
    const coat = catalog.find(item => item.id === 'raincoat'); await selectItem(page, row, coat, 'otter');
    await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await waitSelection(page, applySelection(original.expression.selection, equipAction(coat, 'otter')));
    assert(await button(panel(page), 'けしきを のこす').isDisabled(), 'An unconfirmed outfit cannot be captured as a saved scene');
    await checkDB(page, row, 'scene-v2-unconfirmed-capture-blocked', before);
    await press(page, row, 'いまに もどす', panel(page)); await waitSelection(page, original.expression.selection);
    await press(page, row, 'けしきを のこす', panel(page)); await waitMode(page, 'experience');
    const experience = page.getByTestId('island-experience'), slot = experience.locator(`[data-layout-slot="${layoutId}"]`);
    assert.equal(await experience.getAttribute('data-experience-tab'), 'layouts');
    await slot.getByRole('textbox', { name: 'けしき 1の なまえ', exact: true }).fill(name);
    await checkDB(page, row, 'scene-v2-name-draft', before);
    await press(page, row, 'いまの しまを のこす', slot); await waitRevision(page, row, original.revision + 1);
    const afterSave = await checkDB(page, row, 'scene-v2-save', before, { type: 'save-layout', layoutId, name });
    const saved = islandFor(afterSave, row.owner).experience.layouts.find(layout => layout.id === layoutId);
    assert.deepEqual(saved.sceneStyle.expression, original.expression.selection);
    await capture(page, row, 'scene-v2-saved');
    await activate(experience.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
    await selectItem(page, row, coat, 'otter');
    await act(page, row, 'scene-v2-change-outfit', equipAction(coat, 'otter'), panel(page).locator('[data-expression-action="equip"]'));
    for (const id of ['river-check', 'water-ring-trail', 'leaf-album-cover']) {
        const item = catalog.find(item => item.id === id); await selectItem(page, row, item, 'otter');
        await act(page, row, `scene-v2-remove-${id}`, equipAction(item, 'otter', true), panel(page).locator('[data-expression-action="remove"]'));
    }
    assert.equal(await panel(page).locator('[data-album-cover]').getAttribute('data-album-cover'), 'default');
    await press(page, row, 'けしきと おと', panel(page));
    for (const [type, value] of [['period', 'morning'], ['season', 'winter']]) {
        await activate(panel(page).locator(`[data-expression-${type}="${value}"]`), row.touch);
        await act(page, row, `scene-v2-change-${type}`, { type, [type]: value }, panel(page).locator('[data-expression-action="apply-free"]'));
    }
    const changed = await tables(page), changedSelection = islandFor(changed, row.owner).expression.selection;
    assert.notDeepEqual(changedSelection, saved.sceneStyle.expression);
    await press(page, row, 'けしきを のこす', panel(page)); await waitMode(page, 'experience');
    await activate(slot.locator('[data-experience-action="preview-layout"]'), row.touch);
    await waitSelection(page, saved.sceneStyle.expression); await checkDB(page, row, 'scene-v2-preview-no-write', changed);
    await capture(page, row, 'scene-v2-preview-original');
    await activate(slot.locator('[data-experience-action="preview-layout"]'), row.touch);
    await waitSelection(page, changedSelection); await checkDB(page, row, 'scene-v2-cancel-restores-current', changed);
    await capture(page, row, 'scene-v2-cancel-current');
    await activate(slot.locator('[data-experience-action="apply-layout"]'), row.touch);
    await waitRevision(page, row, islandFor(changed, row.owner).revision + 1);
    const applied = await checkDB(page, row, 'scene-v2-apply', changed, { type: 'apply-layout', layoutId });
    await waitSelection(page, saved.sceneStyle.expression); await capture(page, row, 'scene-v2-applied');
    assert.deepEqual(islandFor(applied, row.owner).expression.ownedItemIds, original.expression.ownedItemIds);
    await activate(experience.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
    await selectItem(page, row, coat, 'otter');
    const edited = await act(page, row, 'scene-v2-edit-again', equipAction(coat, 'otter'), panel(page).locator('[data-expression-action="equip"]'));
    assert.deepEqual(islandFor(edited, row.owner).experience.layouts.find(layout => layout.id === layoutId), saved, 'Re-editing must not recapture the saved scene');
    await capture(page, row, 'scene-v2-edited-again');
    row.sceneRoundTrip = { layoutId, version: 2, capturedSelection: saved.sceneStyle.expression, pass: true,
        excluded: ['legacy sceneStyle none/v1', 'unconfirmed F03 mix', 'competing receipt retry', 'later furniture/display collision'] };
}
async function freeLookCompatibility(page, row) {
    const coat = catalog.find(item => item.id === 'raincoat'), experience = page.getByTestId('island-experience');
    const names = { otter: ['カワウソ', 'すいすい'], rabbit: ['ウサギ', 'ぴょん'], fox: ['キツネ', 'こん'] };
    const beforeAll = await tables(page), owned = islandFor(beforeAll, row.owner).expression.ownedItemIds;
    const baseline = await scene(page), rigIds = Object.fromEntries(baseline.expression.residents.map(resident => [resident.id, resident.uuid]));
    const openFreeLooks = async residentId => {
        await press(page, row, 'みじたくから もどる', panel(page)); await waitMode(page, 'experience');
        await press(page, row, 'なかま', experience);
        await activate(experience.locator(`[data-resident-id="${residentId}"]`), row.touch);
    };
    const reopenExpression = async () => {
        await activate(experience.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
    };
    const actualFreeCap = async residentId => {
        const actual = await waitScene(page, actual => actual.residents?.some(resident => resident.species === residentId && resident.look === 'cap')
            && actual.expression?.residents?.some(resident => resident.id === residentId && resident.outfit === null), `${residentId}'s actual free cap`);
        assert.equal(actual.expression.residents.find(resident => resident.id === residentId).uuid, rigIds[residentId]);
        assert.equal(await experience.locator('[data-resident-look="cap"]').getAttribute('aria-pressed'), 'true');
    };
    row.freeLooks = [];
    for (const residentId of residents) {
        const initial = islandFor(await tables(page), row.owner).expression.selection.residents[residentId];
        await openFreeLooks(residentId);
        await act(page, row, `free-cap-${residentId}`, { type: 'resident-look', residentId, look: 'cap' }, experience.locator('[data-resident-look="cap"]'));
        await actualFreeCap(residentId); await capture(page, row, `free-cap-${residentId}`);
        await reopenExpression(); await selectItem(page, row, coat, residentId);
        await act(page, row, `free-cap-covered-${residentId}`, equipAction(coat, residentId), panel(page).locator('[data-expression-action="equip"]'));
        await openFreeLooks(residentId);
        assert.equal(await experience.locator('[data-resident-look="cap"]').getAttribute('aria-pressed'), 'false', 'The stored fallback cap is not currently worn');
        const beforeRename = await tables(page), [speciesName, name] = names[residentId];
        assert.equal(islandFor(beforeRename, row.owner).experience.residents[residentId].look, 'cap');
        await experience.getByRole('textbox', { name: `${speciesName}の よびなまえ`, exact: true }).fill(name);
        await checkDB(page, row, `rename-draft-${residentId}`, beforeRename);
        const renamed = await act(page, row, `rename-keeps-coat-${residentId}`, { type: 'resident-name', residentId, name }, button(experience, 'なまえを つける'));
        const chosen = islandFor(renamed, row.owner).expression.selection.residents[residentId];
        assert.deepEqual(chosen, { ...initial, outfit: 'raincoat' });
        assert.equal((await scene(page)).expression.residents.find(resident => resident.id === residentId).uuid, rigIds[residentId]);
        await capture(page, row, `renamed-coat-${residentId}`);
        const restored = await act(page, row, `same-free-cap-restores-${residentId}`, { type: 'resident-look', residentId, look: 'cap' }, experience.locator('[data-resident-look="cap"]'));
        await actualFreeCap(residentId);
        assert.deepEqual(islandFor(restored, row.owner).expression.selection.residents[residentId], { ...initial, outfit: null });
        await capture(page, row, `same-free-cap-restored-${residentId}`);
        await reopenExpression(); await selectItem(page, row, coat, residentId);
        await act(page, row, `coat-reselected-${residentId}`, equipAction(coat, residentId), panel(page).locator('[data-expression-action="equip"]'));
        row.freeLooks.push({ residentId, rigUuid: rigIds[residentId], fallbackLook: 'cap', name, preservedPattern: initial.pattern,
            preservedTrail: initial.trail, sameFreeValueSelected: true, pass: true });
    }
    assert.deepEqual(islandFor(await tables(page), row.owner).expression.ownedItemIds, owned);
}
async function learningAndReload(page, row) {
    const item = catalog.find(item => item.id === 'leaf-trail'); await selectItem(page, row, item, 'fox');
    const before = await tables(page), native = await readNative(page, row.owner), plan = native.plan, saved = savedExpression(native.island).selection;
    await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await press(page, row, 'まなぶ', panel(page)); await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page, row.owner)).plan, plan); await checkDB(page, row, 'learning-cancels-preview-same-plan', before);
    assert(await page.evaluate(() => { const root = document.querySelector('.island-page'), world = document.querySelector('[data-testid="island-stage"]');
        return root?.dataset.mode === 'learning' && (!world || world.closest('[aria-hidden="true"]') || world.getBoundingClientRect().height === 0); }));
    await capture(page, row, 'same-learning-reservation');
    const answer = await answerUI(page, plan, { touch: row.touch, dev: false }); assert.equal(answer.state.plan.id, plan.id);
    const afterAnswer = await tables(page); assert.equal(answer.state.plan.revision, plan.revision + 1);
    assert.deepEqual(islandFor(afterAnswer, row.owner).expression.selection, saved);
    for (const name of ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs']) assert.deepEqual(afterAnswer[name], before[name]);
    row.learning = { sameReservedPlan: plan.id, fromRevision: plan.revision, answeredRevision: answer.state.plan.revision, fixture: false };
    await page.reload(); await waitLearningInput(page, answer.state.plan); assert.deepEqual((await readNative(page, row.owner)).plan, answer.state.plan);
    await checkDB(page, row, 'reload-all-stores', afterAnswer);
    await press(page, row, 'しまへ'); await waitMode(page, 'home'); await enterExpression(page, row); await waitSelection(page, saved);
    await capture(page, row, 'reload-saved-expression');
    await checkDB(page, row, 'reopen-does-not-restart-old-preview', afterAnswer);
    await waitScene(page, actual => !actual.expression?.walk, 'no stale preview after reload');
}

const { chromium } = await import('playwright');
let browser;
try {
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_EXPRESSION_HEADED !== '1' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_EXPRESSION_HEADED === '1' };
    const selected = viewports.filter(row => !process.env.SANSU_ISLAND_EXPRESSION_VIEWPORT || row.name === process.env.SANSU_ISLAND_EXPRESSION_VIEWPORT); assert(selected.length);
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion,
            serviceWorkers: 'allow', acceptDownloads: true });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], qualification: [], walks: [], acquisitions: [], environments: [], traces: [],
            coverage: { realEarned: 'not-run', freePreview: 'not-run', flagInspection: 'not-run', paidSix: 'not-run', environment: 'not-run', sceneV2: 'not-run', freeLookCompatibility: 'not-run', originalPhoto: 'not-run', learningReload: 'not-run',
                qualifiedAcquisition: 'not-run', nativeFaultsOfflineProfileBackground: 'not-run', actualAudio: 'not-run' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row); row.coverage.realEarned = 'pass'; console.log(`${row.name}: ${row.earned.answers} actual answers earned ${row.earned.points} stars`);
            await createPhoto(page, row); await mainPreviews(page, row); row.coverage.freePreview = 'pass-main-path; visual-review-pending';
            await acquireAndEquip(page, row); row.coverage.paidSix = 'pass';
            await freeEnvironment(page, row); row.coverage.environment = 'pass-12-combinations-and-default; visual-review-pending';
            await sceneRoundTrip(page, row); row.coverage.sceneV2 = 'pass-save-change-preview-cancel-apply-reedit; legacy-and-collision-unverified';
            await freeLookCompatibility(page, row); row.coverage.freeLookCompatibility = 'pass-same-cap-rename-and-independent-pattern-trail-three-real-residents';
            await exportUnchangedPhoto(page, row); row.coverage.originalPhoto = 'pass-actual-saved-photo-and-byte-identical-export';
            await learningAndReload(page, row); row.coverage.learningReload = 'pass';
            assert.equal(row.walks.length, 6); assert.equal(row.qualification.length, 4); assert.equal(row.acquisitions.length, 6); assert.equal(row.environments.length, 12); assert.equal(row.freeLooks.length, 3);
            assert.equal(row.flagInspection?.pass, true);
            assert.deepEqual(row.errors, []); row.finalTables = digestTables(await tables(page)); row.pass = true;
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
            console.log(`PASS ${row.name}: first expression path; qualified acquisition/audio/persistence and human image review remain separate`);
        } catch (error) {
            row.failure = error.stack; process.exitCode = 1;
            await finishProbe(page, row, 'failure').catch(() => {});
            await capture(page, row, 'failure').catch(() => page.screenshot({ path: `${out}/${row.name}-failure-raw.png`, fullPage: true }).catch(() => {}));
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = selected.length === viewports.length && report.layouts.every(row => row.pass);
    report.gates.runtimeIntegrity = report.pass ? 'passed-selected-main-scenarios' : 'failed-or-partial';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    try {
        report.finalFingerprints = await fingerprint(); assert.deepEqual(report.finalFingerprints, initialSource, 'Frozen app or QA closure changed'); report.sourceStable = true;
    } catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Expression evidence</title><style>body{font:16px system-ui;margin:24px;background:#f5f2e9}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;padding:12px}img{width:100%}small{display:block;overflow-wrap:anywhere}</style><h1>Expression first path — image review pending</h1><p>${escape(target)} · ${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Human N=0. Qualified acquisition, audio and persistence-fault paths remain separate. Technical success does not certify visual appeal or learning effects.</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.frameFile)}" alt="${escape(item.name)}"></a><figcaption>${escape(item.name)}</figcaption><small>${escape(item.candidate)} · ${escape(item.delivery)} · ${escape(item.revision)} · ${escape(item.frameSha256)}</small></figure>`).join('')}${report.layouts.flatMap(row => row.traces.flatMap(trace => trace.images.map(item => `<figure><img src="${escape(item.file)}" alt="${escape(trace.name)}"><figcaption>${escape(trace.name)} / ${escape(item.phase)}</figcaption><small>${escape(item.sha256)}</small></figure>`))).join('')}</main>`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
