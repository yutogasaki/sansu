import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertWorkshopDelta, assertSettingsSoundDelta, assertDiscoveryDelta } from './island-qualified-audit.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';


const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const residents = ['otter', 'rabbit', 'fox'];
const expressionCandidate = 'island-expression-v1';
const residentExpressionCandidate = 'island-stitched-expression-v1';
const diagnosticContract = { candidate: 'figure[data-expression-candidate]', host: '[data-testid="island-stage"]',
    attributes: ['data-island-expression', 'data-island-expression-environment', 'data-island-expression-flag'],
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
const qualified = catalog.filter(item => item.requirement);
const audioEnabled = process.env.SANSU_ISLAND_QUALIFIED_AUDIO === '1';
const audioModuleFiles = ['audio-probe.mjs', 'audio-analysis.mjs', 'expression-audio-phase.mjs'].map(file => `tools/expression-audio/${file}`);
const scenarios = [
    'Empty DB -> actual setup -> ordinary answers. No application state/geometry/observations injected.',
    'Before persisted observations, all four zero-star acquire controls are disabled; previews, guide open/close and part ownership/assembly alone do not qualify.',
    'Grow actual garden and grove through ordinary sections; use guide availability, observe ribbon-butterfly and leaf-bird at actual placed hosts, retain visible frame PNG and exact discovery receipt.',
    'Use real Settings UI to persist soundEnabled=false. Clean/observe actual specimens, assemble and connect straight/wheel/bell, then run real water to the bell. Silence does not remove qualification.',
    'Acquire the four observation-qualified items explicitly for zero stars, verify no automatic equip, then explicitly equip/remove/re-equip.',
    'Every optional mutation preserves learning/ownership/growth outside its exact authorized scope; photos and Blob bytes remain identical when applying the stamp.',
    'Resume the identical reserved learning plan, submit an actual answer and reload the saved selections.',
];
const remaining = [
    audioEnabled ? 'Opt-in digital audio and native lifecycle checks are pending execution; physical speaker quality, persistence faults, profile races and PWA update/hold remain separate.'
        : 'Actual sound waveform/output, sound hidden/off release, persistence faults, native background, profile races and PWA update/hold are unexecuted here.',
    'No visual appeal, child comprehension, motivation or learning effect conclusion; human N=0.',
];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, serverStarted: false, applicationDataInjected: false,
        viewports, catalog, expressionCandidate, residentExpressionCandidate, diagnosticContract, scenarios, remaining,
        requiredEnvironment: ['SANSU_ISLAND_PRODUCTION_URL', 'SANSU_ISLAND_QUALIFIED_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_ISLAND_QUALIFIED_QA_ROOT: 'Explicit immutable QA bundle with matching app inputs and unchanged shared helpers',
            SANSU_ISLAND_QUALIFIED_VIEWPORT: 'phone or tablet; one viewport is partial', SANSU_ISLAND_QUALIFIED_HEADED: '1 is required when audio is enabled',
            SANSU_ISLAND_QUALIFIED_AUDIO: '1 explicitly adds digital audio, same-window native hidden, real SPA exit/reentry and learning retirement on the already qualified page' },
        audio: { enabled: audioEnabled, modules: audioEnabled ? audioModuleFiles : [], headedRequired: audioEnabled,
            order: 'Initial passive probe -> existing real qualification -> main audio -> real same-window hidden -> Settings SPA exit -> actual UI return -> same reserved input -> one answer and reload',
            driver: 'Opt-in only: record every focus-emulation command and replace enabled=true with false in the original Playwright session; restore in finally',
            evidence: 'Digital source and routed output PCM, native lifecycle, exact DB deltas; physical speaker and human listening unverified' },
        sourceRule: 'Run snapshot/tools or an explicit immutable QA bundle; hash all fixed app inputs and the QA closure before/after.',
        outputRule: 'Fresh output only: per-action all-store exact deltas, PNGs/contact sheet, actual renderer probe traces and Playwright traces.',
    }, null, 2));
    process.exit(0);
}

const target = (process.env.SANSU_ISLAND_PRODUCTION_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_ISLAND_QUALIFIED_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Set frozen URL, manifest and fresh output');
assert(!audioEnabled || process.env.SANSU_ISLAND_QUALIFIED_HEADED === '1', 'Opt-in audio requires SANSU_ISLAND_QUALIFIED_HEADED=1 for genuine same-window native hidden');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } = await import(pathToFileURL(path.join(sourceRoot, 'tools/island-e2e-helpers.mjs')).href);
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length, 'Frozen build manifest required');
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_ISLAND_QUALIFIED_QA_ROOT || manifest.snapshot), 'Run snapshot/tools or explicitly identify the immutable QA bundle');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const frozenHelperFiles = ['tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs', 'tools/island-qualified-audit.mjs'];
const qaFiles = ['tools/e2e-island-expression-qualified.mjs', ...frozenHelperFiles, ...(audioEnabled ? audioModuleFiles : [])].map(file => path.join(sourceRoot, file));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), qa: await hashFiles(qaFiles),
    bundleAppInputs: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleAppInputs.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256,
    file.sha256, `QA bundle app differs: ${file.relative}`);
for (const file of frozenHelperFiles.map(file => path.join(sourceRoot, file))) {
    const relative = path.relative(sourceRoot, file), original = manifest.files.find(entry => entry.relative === relative);
    assert(original, `Missing frozen helper: ${relative}`);
    assert.equal(initialSource.qa.find(entry => entry.path === file)?.sha256, original.sha256, `Changed helper: ${relative}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec41Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false,
    audioOptIn: audioEnabled, audioModuleFiles: audioEnabled ? audioModuleFiles : [],
    expectedExpressionCandidate: expressionCandidate, expectedResidentExpressionCandidate: residentExpressionCandidate, diagnosticContract, scenarios, remaining,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)), explicitBundle: Boolean(process.env.SANSU_ISLAND_QUALIFIED_QA_ROOT) } },
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
async function checkDB(page, row, name, before, action, liveHome = false) {
    await idle(page); const after = await tables(page), changedStores = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const file = `${row.name}-db-${String(row.databaseChecks.length + 1).padStart(3, '0')}-${name}.json`;
    const entry = { name, file, action: action ?? null, before: digestTables(before), after: digestTables(after), changedStores, pass: false };
    row.databaseChecks.push(entry);
    try {
        if (liveHome) { assert.equal(action, undefined); entry.liveHomeDiscoveries = assertDiscoveryDelta(before, after, row.owner); }
        else exactDelta(before, after, row.owner, action);
        entry.pass = true;
    }
    finally { await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...entry, revision: manifest.revision, sourceHash: manifest.sourceHash,
        changes: Object.fromEntries(changedStores.map(key => [key, { before: before[key], after: after[key] }])) }, null, 2)); }
    return after;
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
    while (native.island.completedSets < 1 || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++answers < 80, 'The first ordinary section must complete within the bounded answer budget');
    }
    row.answerCount = answers; const receipts = native.islandEvents.filter(event => event.type === 'answer'); assert.equal(receipts.length, answers);
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
    await press(page, row, 'しゃしんの アルバムを とじる', gallery(page)); await waitMode(page, 'home');
}


async function exportUnchangedPhoto(page, row) {
    const before = await tables(page); await closeExpression(page, row);
    await press(page, row, 'アルバム'); await waitMode(page, 'album'); await press(page, row, 'しゃしん'); await waitMode(page, 'photos');
    assert.equal(await gallery(page).locator('[data-album-stamp="butterfly-stamp"]').count(), 1);
    await activate(gallery(page).locator(`[data-photo-id='${row.photo.metadata.id}']`), row.touch);
    const exportButton = button(gallery(page), 'PNGで とりだす'); await exportButton.waitFor();
    await page.waitForFunction(() => { const button = [...document.querySelectorAll('.island-photo-detail button')].find(button => button.textContent.includes('PNGで'));
        return button && !button.disabled; });
    const downloadPromise = page.waitForEvent('download'); await activate(exportButton, row.touch);
    const download = await downloadPromise, file = `${row.name}-decorated-album-original-export.png`; await download.saveAs(`${out}/${file}`);
    assert.equal(sha(await fs.readFile(`${out}/${file}`)), row.photo.metadata.image.sha256);
    await checkDB(page, row, 'decorated-album-original-export', before, undefined, true); await capture(page, row, 'decorated-real-photo');
    row.photo.decoratedExport = file;
    await press(page, row, 'しゃしんの アルバムを とじる', gallery(page)); await waitMode(page, 'home'); await enterExpression(page, row);
}

async function learningAndReload(page, row) {
    const item = catalog.find(item => item.id === 'butterfly-stitch'); await selectItem(page, row, item, 'fox');
    const before = await tables(page), native = await readNative(page, row.owner), plan = native.plan, saved = savedExpression(native.island).selection;
    await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
    await press(page, row, 'まなぶ', panel(page)); await waitLearningInput(page, plan);
    assert.deepEqual((await readNative(page, row.owner)).plan, plan); await checkDB(page, row, 'learning-cancels-preview-same-plan', before);
    await answerAndReload(page, row, { plan, before, saved });
}
// Both callers have already entered this same reserved input through real UI.
// The optional audio caller must not replay an expression preview to get here.
async function answerAndReload(page, row, { plan, before, saved }) {
    await waitLearningInput(page, plan); assert.deepEqual((await readNative(page, row.owner)).plan, plan);
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
    await checkDB(page, row, 'reopen-does-not-restart-old-preview', afterAnswer, undefined, true);
    await waitScene(page, actual => !actual.expression?.walk, 'no stale preview after reload');
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
async function qualifiedAudio(context, page, row, createPhase) {
    const phase = await createPhase({ page, owner: row.owner, name: row.name, touch: row.touch, output: `${out}/audio/${row.name}`,
        provenance: { revision: manifest.revision, sourceHash: manifest.sourceHash, qaClosureHash: report.sources.qa.closureHash }, tables });
    row.audio = phase.report;
    const originalDocument = await page.evaluate(() => performance.timeOrigin), reserved = (await readNative(page, row.owner)).plan;
    let background;
    try {
        await phase.runMain();
        const main = await audioWindow(context, page); background = await context.newPage();
        const other = await audioWindow(context, background);
        row.audioCaller = { pass: false, originalDocument, sameWindow: { main, other }, reentry: null };
        assert.equal(other.windowId, main.windowId, 'The audio boundary requires genuine tabs in the same headed window');
        assert.notEqual(other.targetId, main.targetId); await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
        await phase.runHidden({ headed: true, hide: async () => { await background.bringToFront(); },
            restore: async () => { await page.bringToFront(); } });
        await background.close(); background = undefined;
        await phase.runExit({ leave: async () => {
            await activate(page.locator('.island-header').getByRole('button', { name: 'せってい', exact: true }), row.touch);
            await page.waitForURL(url => url.hash.startsWith('#/settings'));
            await page.locator('.island-page').waitFor({ state: 'detached' });
        } });
        assert.equal(await page.evaluate(() => performance.timeOrigin), originalDocument, 'Settings exit must retain the original probe document');
        const beforeReturn = await tables(page);
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
        const beforeLearning = await tables(page), plan = await phase.runLearning();
        assert.deepEqual(plan, reserved); await waitLearningInput(page, plan);
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


const guide = page => page.locator('section[aria-label="しまの みつけもの"]');
const workshopPanel = page => page.locator('.island-workshop');
const hasDiscovery = (island, id) => Boolean(island.growth?.discoveries.some(entry => entry.id === id));
const hasBell = island => Boolean(island.workshop?.creations.some(entry => entry.partId === 'bell'));
const eligible = (island, item) => item.requirement === 'bell' ? hasBell(island) : hasDiscovery(island, item.requirement);
async function waitIsland(page, row, predicate, label, timeout = 25000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await readNative(page, row.owner); if (predicate(value.island)) { await idle(page); return value; } await pause(40); }
    throw new Error(`Native island did not reach ${label}`);
}
async function readOnlyBoundary(page, row, name, work) {
    const before = await tables(page); await work(); return checkDB(page, row, name, before);
}
async function negativeQualifications(page, row, ids, label) {
    await enterExpression(page, row);
    for (const item of qualified.filter(item => ids.includes(item.id))) {
        const before = await tables(page), island = islandFor(before, row.owner);
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
async function selectGuide(page, row, id) {
    await press(page, row, 'みつける'); await waitMode(page, 'guide');
    await press(page, row, id === 'leaf-bird' ? '木かげ' : 'にわ', guide(page).getByRole('group', { name: 'みつける ばしょ', exact: true }));
    await activate(guide(page).locator(`[data-discovery-id="${id}"]`), row.touch);
    await guide(page).locator(`[data-guide-id="${id}"]`).waitFor(); await painted(page);
    return guide(page).locator(`[data-guide-id="${id}"]`).getAttribute('data-guide-status');
}
async function closeGuide(page, row) {
    await press(page, row, 'みつけものを とじる', guide(page)); await waitMode(page, 'home');
}
async function ordinarySection(page, row, reason) {
    await waitMode(page, 'home'); await idle(page);
    const reserved = await readNative(page, row.owner), pendingPlanId = reserved.island.pendingPlanId;
    if (pendingPlanId) { assert.equal(reserved.plan?.id, pendingPlanId); assert.equal(reserved.plan.status, 'active'); }
    const start = page.locator('.island-home-controls .island-start');
    assert.equal(await start.count(), 1);
    assert.equal((await start.innerText()).trim(), pendingPlanId ? 'つづきから とく' : 'まなぶ');
    await start.evaluate(node => node.addEventListener('click', event => {
        window.__qualifiedResumeGesture = { trusted: event.isTrusted, hidden: document.hidden, at: performance.now() };
    }, { once: true, capture: true }));
    const beforeResume = await tables(page);
    if (pendingPlanId) assert.deepEqual(beforeResume.islandPlans.find(plan => plan.id === pendingPlanId), reserved.plan);
    await activate(start, row.touch); await waitLearningInput(page, reserved.plan);
    const resumeGesture = await page.evaluate(() => window.__qualifiedResumeGesture);
    assert(resumeGesture?.trusted && !resumeGesture.hidden);
    if (pendingPlanId) assert.deepEqual((await readNative(page, row.owner)).plan, reserved.plan);
    await checkDB(page, row, `ordinary-resume-${row.growthSections.length + 1}-before-answer`, beforeResume);
    let native = await readNative(page, row.owner); const old = native, planId = native.plan.id; let count = 0;
    while (native.plan.id === planId) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state;
        assert(++count < 80); assert(++row.answerCount < 600, 'Finite actual answer budget; no maturity injection fallback');
    }
    assert.equal(native.island.completedSets, old.island.completedSets + 1);
    const receipts = native.islandEvents.filter(event => event.type === 'answer' && !old.islandEvents.some(prior => prior.id === event.id));
    assert.equal(receipts.length, count);
    row.growthSections.push({ reason, answers: count, before: old.island.completedSets, after: native.island.completedSets,
        resumedPlan: { id: planId, revision: old.plan.revision, pendingPlanId, gesture: resumeGesture },
        growth: native.island.growth, answerReceiptIds: receipts.map(event => event.id) });
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
}
/** Read only: sampled after actual renderer frame markers, before any assertion. */
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
async function retainedVisitor(page, row, id) {
    const native = await readNative(page, row.owner);
    if (!hasDiscovery(native.island, id)) return false;
    const data = await page.evaluate(() => window.__qualifiedObservations);
    await fs.writeFile(`${out}/${row.name}-${id}-observation-audit.json`, JSON.stringify(data, null, 2));
    const commit = data.commits.find(value => value.event.discoveryId === id && value.event.profileId === row.owner);
    assert(commit?.before, `${id}: retain its actual first commit and prior committed island`);
    const changes = commit.operations.filter(value => value.store === 'islands');
    assert.equal(changes.length, 1);
    assert.deepEqual(commit.operations.map(value => value.store).sort(), ['islandEvents', 'islands']);
    const after = changes[0].value, record = after.growth.discoveries.find(value => value.id === id);
    assertDiscoveryDelta({ islands: [commit.before], islandEvents: [] }, { islands: [after], islandEvents: [commit.event] }, row.owner);
    const frame = data.frames.find(value => value.activity.discoveryId === id && value.activity.itemId === record.itemId
        && value.at <= commit.at && !value.hidden && ['home', 'play', 'viewing', 'camera'].includes(value.mode));
    assert(frame, `${id}: committed qualification requires a prior real visible-ready frame`);
    assert(Number.isFinite(frame.timestamp) && frame.activity.natureReady && frame.activity.natureVisible);
    assert.deepEqual(data.errors, []);
    const bytes = Buffer.from(frame.png.split(',')[1], 'base64'), file = `${row.name}-${id}-actual-first-observation.png`;
    await fs.writeFile(`${out}/${file}`, bytes);
    const details = { ...frame }; delete details.png;
    const entry = { id, record, event: commit.event, commitAt: commit.at, frame: { ...details, file, sha256: sha(bytes) },
        entryMode: frame.mode, fixture: false, pass: true };
    await fs.writeFile(`${out}/${row.name}-${id}-first-observation.json`, JSON.stringify({ ...entry, commit }, null, 2));
    if (!row.observations.some(value => value.id === id)) row.observations.push(entry);
    return true;
}
async function earnVisitor(page, row, id) {
    for (let sections = 0; sections < 70; sections++) {
        if (await retainedVisitor(page, row, id)) return;
        const status = await selectGuide(page, row, id);
        if (await retainedVisitor(page, row, id)) { await closeGuide(page, row); return; }
        if (status === 'try') {
            const before = await tables(page); await beginObservationProbe(page, 'visitor', id);
            await trustedObservationGesture(button(guide(page), 'みにいく'), row); await waitMode(page, 'play');
            await waitIsland(page, row, island => hasDiscovery(island, id), `${id} real observation`);
            const after = await tables(page); assertDiscoveryDelta(before, after, row.owner);
            const trace = await endObservationProbe(page, row, id); assert(trace.gesture.trusted && !trace.gesture.hidden);
            assert(await retainedVisitor(page, row, id)); await capture(page, row, `${id}-observed`);
            await press(page, row, 'あそびを とじる'); await waitMode(page, 'home'); return;
        }
        assert(['grow', 'visit'].includes(status), `Unexpected ${id} status ${status}; no injected maturity or placement`);
        await closeGuide(page, row); await ordinarySection(page, row, `${id}:${status}`);
    }
    throw new Error(`${id}: no observed visitor within the finite ordinary learning budget`);
}
async function disableSoundThroughSettings(page, row) {
    await page.goto(`${target}/#/settings`);
    const display = page.locator('[data-setting-section="display"]'); await display.waitFor();
    if (await display.getAttribute('aria-expanded') !== 'true') await activate(display, row.touch);
    const setting = page.getByText(/^(おと・BGM|サウンド)$/).locator('..').locator('..');
    const control = setting.getByRole('button', { name: /^(ON|OFF)$/ }); assert.equal(await control.count(), 1);
    const before = await tables(page), profile = before.profiles.find(profile => profile.id === row.owner); assert(profile);
    // Persist a real off action even when the profile began off; no DB edits.
    if (!profile.soundEnabled) { await activate(control, row.touch); await page.waitForFunction(async owner => {
        const req = indexedDB.open('SansuDatabase'); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
        try { return await new Promise(resolve => { const r = db.transaction('profiles').objectStore('profiles').get(owner); r.onsuccess = () => resolve(r.result?.soundEnabled === true); }); }
        finally { db.close(); }
    }, row.owner); assertSettingsSoundDelta(before, await tables(page), row.owner, true); }
    await control.filter({ hasText: /^ON$/ }).waitFor(); await activate(control, row.touch);
    const deadline = Date.now() + 15000; let after;
    while (Date.now() < deadline) { after = await tables(page); if (after.profiles.find(profile => profile.id === row.owner)?.soundEnabled === false) break; await pause(40); }
    assert.equal(after.profiles.find(profile => profile.id === row.owner).soundEnabled, false);
    assertSettingsSoundDelta(before, after, row.owner, false);
    row.sound = { method: 'actual Settings display/sound ON→OFF button', persistedOff: true, acousticOutput: 'UNVERIFIED', before: digestTables(before), after: digestTables(after) };
    await page.goto(`${target}/#/island`); const native = await readNative(page, row.owner); await waitLearningInput(page, native.plan);
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
}
async function waitWorkshop(page, row, predicate, label) { return waitIsland(page, row, island => predicate(island.workshop), label); }
async function workshopChange(page, row, name, expectedActions, action, condition) {
    const before = await tables(page); await action(); await waitWorkshop(page, row, condition, name); const after = await tables(page);
    const current = islandFor(after, row.owner);
    const entry = { name, expectedActions, before: digestTables(before), after: digestTables(after), pass: false };
    row.workshopChanges.push(entry);
    try { entry.events = assertWorkshopDelta(before, after, row.owner, expectedActions); entry.pass = true; }
    finally { await fs.writeFile(`${out}/${row.name}-${name}-DB.json`, JSON.stringify({ ...entry, changes: { before, after } }, null, 2)); }
    return current;
}
async function openDetails(page, row, text) { const summary = workshopPanel(page).locator('summary').filter({ hasText: text });
    if (!(await summary.evaluate(node => node.parentElement.open))) await activate(summary, row.touch); }
async function bellQualification(page, row) {
    await disableSoundThroughSettings(page, row);
    await press(page, row, 'おためしの いりえ'); await waitMode(page, 'workshop'); await waitWorld(page);
    assert.equal(hasBell((await readNative(page, row.owner)).island), false);
    for (const id of ['driftwood', 'seaglass', 'striped-shell']) {
        await activate(workshopPanel(page).locator(`[data-specimen-id="${id}"]`), row.touch);
        await press(page, row, 'ブラシへ おく', workshopPanel(page));
        for (let section = 0; section < 6; section++) await workshopChange(page, row, `brush-${id}-${section}`, [{ type: 'brush', specimenId: id, section }, ...(section === 5 ? [{ type: 'observe-specimen', specimenId: id, result: 'clean', cleanedMask: 63 }] : [])],
            () => activate(workshopPanel(page).locator(`[data-brush-section="${section}"]`), row.touch),
            state => Boolean(state?.specimens[id].cleanedMask & (1 << section)) && (section !== 5 || state.specimens[id].observations.some(entry => entry.result === 'clean')));
        for (const [label, result] of [['ひかりへ おく', id === 'seaglass' ? 'transmit' : 'opaque'], ['みずへ おく', id === 'driftwood' ? 'float' : 'sink']]) {
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
    await press(page, row, 'しまへ', workshopPanel(page)); await waitMode(page, 'home');
    await negativeQualifications(page, row, ['shell-three-notes'], 'owned-and-assembled-bell-without-flow');
    await press(page, row, 'おためしの いりえ'); await waitMode(page, 'workshop'); await press(page, row, 'つくる', workshopPanel(page));
    for (const [col, id] of ['straight', 'wheel', 'bell'].entries()) {
        await activate(workshopPanel(page).locator(`[data-part-id="${id}"]`), row.touch); await openDetails(page, row, 'タップで おく');
        await workshopChange(page, row, `place-${id}`, [{ type: 'edit-draft', edit: { type: 'move', partId: id, position: { col, row: 1 } } }], () => activate(workshopPanel(page).locator(`[data-workshop-cell="${col},1"]`), row.touch),
            state => state?.draftCheckpoint.draft.layout.parts[id].position?.col === col && state.draftCheckpoint.draft.layout.parts[id].position?.row === 1);
    }
    await press(page, row, 'しまへ', workshopPanel(page)); await waitMode(page, 'home');
    await negativeQualifications(page, row, ['shell-three-notes'], 'connected-bell-before-rendered-flow');
    await press(page, row, 'おためしの いりえ'); await waitMode(page, 'workshop'); await press(page, row, 'つくる', workshopPanel(page));
    const native = await tables(page); assert.equal(native.profiles.find(profile => profile.id === row.owner).soundEnabled, false);
    await beginObservationProbe(page, 'workshop', 'bell');
    const layoutKey = JSON.stringify(islandFor(native, row.owner).workshop.draftCheckpoint.draft.layout);
    await workshopChange(page, row, 'real-flow-reached-bell-sound-off', ['wheel', 'bell'].map(partId => ({ type: 'observe-creation', partId, layoutKey })),
        () => trustedObservationGesture(button(workshopPanel(page), 'みずを ながす'), row), state => state?.creations.some(entry => entry.partId === 'bell'));
    await waitScene(page, state => state.workshop?.run?.complete && ['straight', 'wheel', 'bell'].every(id => state.workshop.run.reached.includes(id)), 'complete real flow');
    const trace = await endObservationProbe(page, row, 'bell-sound-off');
    assert(trace.gesture.trusted && !trace.gesture.hidden);
    const audit = await page.evaluate(() => window.__qualifiedObservations);
    await fs.writeFile(`${out}/${row.name}-bell-observation-audit.json`, JSON.stringify(audit, null, 2));
    const commit = audit.commits.find(value => value.event.type === 'workshop_changed'
        && value.event.action.type === 'observe-creation' && value.event.action.partId === 'bell');
    assert(commit?.before && commit.at > trace.gesture.at);
    assert.deepEqual(commit.event.action, { type: 'observe-creation', partId: 'bell', layoutKey });
    assert.deepEqual(commit.operations.map(value => value.store).sort(), ['islandEvents', 'islands']);
    const committedIsland = commit.operations.find(value => value.store === 'islands').value;
    assertWorkshopDelta({ islands: [commit.before], islandEvents: [] }, { islands: [committedIsland], islandEvents: [commit.event] }, row.owner, [commit.event.action]);
    const fresh = trace.frames.find(frame => frame.capturedAt >= trace.gesture.at && frame.workshop?.run);
    assert(fresh && fresh.workshop.run.complete === false && fresh.workshop.run.reached.length === 0, 'Retain the new empty run after the trusted gesture');
    const bell = trace.frames.find(frame => frame.capturedAt > trace.gesture.at && frame.workshop?.run?.beat === 'bell' && !frame.workshop.run.complete);
    const complete = trace.images.find(frame => !frame.hidden && frame.capturedAt > trace.gesture.at && frame.capturedAt <= commit.at
        && frame.workshop?.active && frame.workshop.mode === 'build' && !frame.workshop.replay && frame.workshop.run?.complete
        && ['straight', 'wheel', 'bell'].every(id => frame.workshop.run.reached.includes(id)));
    assert(bell && complete && bell.capturedAt < complete.capturedAt, 'The actual terminal bell frame must precede its native commit');
    row.bellObservation = { event: commit.event, commitAt: commit.at, gesture: trace.gesture, firstFrame: fresh, bellFrame: bell, completedFrame: complete, sameLayoutKey: layoutKey, pass: true };
    await capture(page, row, 'bell-qualified-sound-off');
    await press(page, row, 'しまへ', workshopPanel(page)); await waitMode(page, 'home');
}
async function acquireQualified(page, row) {
    await enterExpression(page, row); const start = await tables(page), points = islandFor(start, row.owner).customization.points;
    for (const item of qualified) {
        const prior = await tables(page); assert(eligible(islandFor(prior, row.owner), item)); await selectItem(page, row, item);
        assert(await panel(page).locator('[data-expression-action="acquire"]').isEnabled());
        const flagBaseline = item.slot === 'flag-trim' ? flagFrame(await waitFlagFrame(page)) : null;
        if (flagBaseline) {
            await capture(page, row, 'qualified-flag-current-close');
            await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
            await waitSelection(page, applySelection(savedExpression(islandFor(prior, row.owner)).selection, equipAction(item)));
            await waitFlagFrame(page, -1, flagBaseline); await capture(page, row, 'qualified-flag-preview-close');
            await press(page, row, 'いまに もどす', panel(page));
            await waitSelection(page, savedExpression(islandFor(prior, row.owner)).selection);
            await waitFlagFrame(page, -1, flagBaseline); await checkDB(page, row, 'qualified-flag-preview-cancel', prior);
        }
        const saved = savedExpression(islandFor(prior, row.owner)).selection;
        const after = await act(page, row, `acquire-${item.id}`, { type: 'acquire', itemId: item.id }, panel(page).locator('[data-expression-action="acquire"]'));
        assert.deepEqual(islandFor(after, row.owner).expression.selection, saved); await capture(page, row, `${item.id}-owned-not-equipped`);
        if (flagBaseline) await waitFlagFrame(page, -1, flagBaseline);
        await act(page, row, `equip-${item.id}`, equipAction(item), panel(page).locator('[data-expression-action="equip"]'));
        if (flagBaseline) await waitFlagFrame(page, -1, flagBaseline);
        await capture(page, row, `${item.id}-equipped`);
        await act(page, row, `remove-${item.id}`, equipAction(item, 'otter', true), panel(page).locator('[data-expression-action="remove"]'));
        await act(page, row, `reequip-${item.id}`, equipAction(item), panel(page).locator('[data-expression-action="equip"]'));
        if (flagBaseline) { await waitFlagFrame(page, -1, flagBaseline); row.flagInspection = { baseline: flagBaseline, qualifiedAcquisitionAndEquip: true, sameActualObjectsAndCamera: true }; }
        row.acquisitions.push({ itemId: item.id, price: 0, qualification: item.requirement, autoEquip: false, pass: true });
    }
    const after = await tables(page); assert.equal(islandFor(after, row.owner).customization.points, points);
    assert.deepEqual(islandFor(after, row.owner).expression.ownedItemIds, qualified.map(item => item.id));
}

const { chromium } = await import('playwright');
let browser, restoreFocusDriver, audioModules;
try {
    if (audioEnabled) {
        const [probe, phase] = await Promise.all([
            import(pathToFileURL(path.join(sourceRoot, 'tools/expression-audio/audio-probe.mjs')).href),
            import(pathToFileURL(path.join(sourceRoot, 'tools/expression-audio/expression-audio-phase.mjs')).href),
        ]);
        audioModules = { install: probe.installExpressionAudioProbe, create: phase.createExpressionAudioPhase };
        restoreFocusDriver = installNativeFocusDriver();
    }
    browser = await chromium.launch({ headless: process.env.SANSU_ISLAND_QUALIFIED_HEADED !== '1' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_ISLAND_QUALIFIED_HEADED === '1' };
    const selected = viewports.filter(row => !process.env.SANSU_ISLAND_QUALIFIED_VIEWPORT || row.name === process.env.SANSU_ISLAND_QUALIFIED_VIEWPORT); assert(selected.length);
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow', acceptDownloads: true });
        await installObservationAudit(context);
        if (audioModules) await audioModules.install(context);
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(25000);
        const row = { ...layout, pass: false, errors: [], databaseChecks: [], traces: [], negative: [], observations: [], growthSections: [], workshopChanges: [], acquisitions: [],
            coverage: { actualObservations: 'not-run', explicitQualifiedFour: 'not-run', soundOffQualification: 'not-run', photoPreservation: 'not-run', sameLearning: 'not-run', actualAudio: 'UNVERIFIED' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row);
            await negativeQualifications(page, row, qualified.map(item => item.id), 'initial-unqualified');
            await selectGuide(page, row, 'ribbon-butterfly');
            await readOnlyBoundary(page, row, 'guide-selection-is-not-observation', async () => { await activate(guide(page).locator('[data-discovery-id="ribbon-butterfly"]'), row.touch); await painted(page); });
            await closeGuide(page, row);
            await createPhoto(page, row);
            await earnVisitor(page, row, 'ribbon-butterfly'); await earnVisitor(page, row, 'leaf-bird'); row.coverage.actualObservations = 'pass-selected-two; image-review-pending';
            await bellQualification(page, row); row.coverage.soundOffQualification = 'pass-persisted-off-and-real-bell; acoustic-output-unverified';
            await acquireQualified(page, row); row.coverage.explicitQualifiedFour = 'pass';
            await exportUnchangedPhoto(page, row); row.coverage.photoPreservation = 'pass-byte-identical-export';
            if (audioModules) await qualifiedAudio(context, page, row, audioModules.create);
            else await learningAndReload(page, row);
            row.coverage.sameLearning = 'pass';
            assert.equal(row.acquisitions.length, 4); assert.equal(row.observations.length, 2); assert.deepEqual(row.errors, []); row.pass = true;
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
        } catch (error) {
            row.failure = error.stack; process.exitCode = 1;
            await endObservationProbe(page, row, 'failure').catch(() => {});
            await capture(page, row, 'failure').catch(() => page.screenshot({ path: `${out}/${row.name}-failure-raw.png`, fullPage: true }).catch(() => {}));
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.pass = selected.length === viewports.length && report.layouts.every(row => row.pass);
    report.gates.runtimeIntegrity = report.pass ? 'passed-selected-qualified-paths' : 'failed-or-partial';
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
    try { if (browser) await browser.close(); }
    catch (error) { report.browserCloseFailure = error.stack; report.pass = false; process.exitCode = 1; }
    finally { if (restoreFocusDriver) restoreFocusDriver(); }
    try { report.finalFingerprints = await fingerprint(); assert.deepEqual(report.finalFingerprints, initialSource); report.sourceStable = true; }
    catch (error) { report.sourceStable = false; report.sourceFailure = error.stack; report.pass = false; process.exitCode = 1; }
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Qualified expression evidence</title><p>${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Limited qualified-item path. Human N=0. ${audioEnabled ? 'Opt-in digital audio has separate per-layout reports; physical speaker and human listening unverified.' : 'Audio unverified.'} Full specification unverified.</p>${report.captures.map(item => `<figure><img width="390" src="${escape(item.frameFile)}"><figcaption>${escape(item.name)}</figcaption></figure>`).join('')}`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
