import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activate, answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { assertDiscoveryDelta } from './island-qualified-audit.mjs';

const viewports = [
    { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' },
];
const residents = ['otter', 'rabbit', 'fox'];
const expressionCandidate = 'island-expression-v1';
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
    'Real empty onboarding and ordinary answers earn 50 stars; no profile, progress, reward or expression fixture writes',
    'Each real profile captures and exports a different actual renderer subject before its first answer (A island, B rabbit portrait); distinct original/thumbnail bytes and metadata survive every fault, owner switch and offline step',
    'Photo-gallery home transitions permit only exact first-discovery receipts with a prior visible-ready frame and native commit; gallery viewing/export itself preserves every store',
    'Native expression acquisition abort after island put rolls every store back; real retry keeps the exact receipt and canonical intent',
    'Native committed acquisition with failed completion delivery retries its original receipt without second subtraction or automatic equip; next equip uses the latest revision',
    'Two genuinely visible windows: another real save with lost notification leaves a stale preview; known CAS clears it and requires a new explicit choice',
    'A held native-commit completion crosses a real same-window hidden transition; release cannot resume a preview or begin a hidden writer',
    'Real second-profile onboarding and ordinary first section; A/B selections and learning rows remain separate; a held A save delivered after a real B switch cannot publish A into B',
    'Saved nondefault evening/winter survives a genuinely controlling service worker offline reload; actual offline edit and same-reservation normal answer still work',
];
const remaining = [
    'This is X07/X08/X11 persistence coverage, not full spec41; native-browser diagnostics do not prove child motivation or visual appeal (human N=0)',
    'Legacy free-cap receipt compatibility, cross-feature purchase contention, storage quota, PWA update/hold, exact delayed liveQuery ordering, delayed learning-reservation save and clock changes remain separate cases',
    'Observation-qualified acquisition, actual audio, full-scene v1/v2 compatibility, clothing/posture/physical collisions and full visual matrix are outside this harness',
    'If native hidden cannot be obtained, that gate is UNVERIFIED and remaining offline/profile cases continue; never forge document.hidden or visibilitychange',
];
const diagnosticFaults = ['native IDB abort after island put', 'native commit with failed completion delivery',
    'held native completion callback', 'driver Emulation.setFocusEmulationEnabled true to false'];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, serverStarted: false, applicationDataInjected: false,
        viewports, scenarios, remaining, diagnosticFaults, headedDefault: true,
        requiredEnvironment: ['SANSU_EXPRESSION_PERSISTENCE_URL', 'SANSU_EXPRESSION_PERSISTENCE_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: { SANSU_EXPRESSION_PERSISTENCE_QA_ROOT: 'Explicit immutable QA bundle', SANSU_EXPRESSION_PERSISTENCE_VIEWPORT: 'phone or tablet (partial)',
            SANSU_EXPRESSION_PERSISTENCE_HEADED: '0 disables native-background eligibility' },
        sourceRule: 'Fixed app manifest + copied app inputs + unchanged shared helper closure are hashed before and after; fresh output only',
        publicUI: { entry: 'しまづくり -> [data-experience-action=expression]', section: 'みじたくと コレクション',
            retry: 'きろくを たしかめる', revision: '.island-page[data-island-revision]', candidate: 'figure[data-expression-candidate]',
            diagnostics: ['data-island-expression', 'data-island-expression-environment', 'data-island-expression-flag'] },
    }, null, 2));
    process.exit(0);
}
const target = (process.env.SANSU_EXPRESSION_PERSISTENCE_URL || '').replace(/\/$/u, '');
const out = process.env.SANSU_EXPRESSION_PERSISTENCE_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Provide a frozen target, manifest and fresh output');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const sourceRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
assert(manifest.revision && manifest.sourceHash && manifest.snapshot && manifest.files?.length);
assert.equal(await fs.realpath(sourceRoot), await fs.realpath(process.env.SANSU_EXPRESSION_PERSISTENCE_QA_ROOT || manifest.snapshot),
    'Run snapshot/tools or an explicit immutable QA bundle');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const qaFiles = ['tools/e2e-island-expression-persistence.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs', 'tools/island-qualified-audit.mjs'].map(file => path.join(sourceRoot, file));
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appInputs.length && appInputs.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), qa: await hashFiles(qaFiles),
    bundleAppInputs: await hashFiles(appInputs.map(file => path.join(sourceRoot, file.relative))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleAppInputs.find(entry => entry.path === path.join(sourceRoot, file.relative))?.sha256,
    file.sha256, `QA app input differs: ${file.relative}`);
for (const file of qaFiles.slice(1)) {
    const original = manifest.files.find(entry => entry.relative === path.relative(sourceRoot, file)); assert(original, `Missing frozen helper ${file}`);
    assert.equal(initialSource.qa.find(entry => entry.path === file)?.sha256, original.sha256, `Shared helper changed: ${file}`);
}
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec41Passed: false, humanN: 0, applicationDataInjected: false, timingEvidenceEligible: false, scenarios, remaining, diagnosticFaults,
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-human-review', silentComprehensionAndSafety: 'requires-human-review' },
    sources: { application: { root: manifest.snapshot, revision: manifest.revision, sourceHash: manifest.sourceHash },
        qa: { root: sourceRoot, closureHash: sha(JSON.stringify(initialSource.qa)), explicitBundle: Boolean(process.env.SANSU_EXPRESSION_PERSISTENCE_QA_ROOT) } },
    fingerprints: initialSource, captures: [], layouts: [] };
const stage = page => page.getByTestId('island-stage');
const panel = page => page.locator('section[aria-label="みじたくと コレクション"]');
const retryButton = page => button(panel(page), 'きろくを たしかめる');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const visibility = page => page.evaluate(() => ({ hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus() }));
const diagnostics = page => page.evaluate(() => window.__expressionPersistence.snapshot());
const arm = (page, mode, profileId, action) => page.evaluate(value => window.__expressionPersistence.arm(value), { mode, profileId, action });
async function retainDiagnostics(page, row) {
    const value = await diagnostics(page), index = row.diagnosticDocuments.findIndex(entry => entry.documentId === value.documentId);
    if (index < 0) row.diagnosticDocuments.push(value); else row.diagnosticDocuments[index] = value;
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
function exactDelta(before, after, owner, action) {
    assert.deepEqual(Object.keys(after), Object.keys(before));
    if (!action) { assert.deepEqual(after, before, 'Preview/cancel/view/return must preserve every store and Blob hash'); return; }
    for (const name of Object.keys(before)) if (!['islands', 'islandEvents'].includes(name)) assert.deepEqual(after[name], before[name], `${name}: optional action changed unrelated data`);
    const old = islandFor(before, owner), updated = islandFor(after, owner), expected = structuredClone(old);
    assert(old && updated); assert.equal(updated.revision, old.revision + 1); assert(Number.isFinite(updated.updatedAt));
    expected.revision++; expected.updatedAt = updated.updatedAt; expected.expression = savedExpression(old);
    if (action.type === 'acquire') {
        const item = catalog.find(item => item.id === action.itemId); assert(item && !expected.expression.ownedItemIds.includes(item.id));
        expected.expression.ownedItemIds = catalog.filter(entry => entry.id === item.id || expected.expression.ownedItemIds.includes(entry.id)).map(entry => entry.id);
        if (item.price) expected.customization.points -= item.price;
    } else expected.expression.selection = applySelection(expected.expression.selection, action);
    assert.deepEqual(after.islands, before.islands.map(island => island.profileId === owner ? expected : island), 'Only exact expression/authorized wallet fields may change');
    const ids = new Set(before.islandEvents.map(event => event.id)), added = after.islandEvents.filter(event => !ids.has(event.id));
    assert.deepEqual(after.islandEvents.filter(event => ids.has(event.id)), before.islandEvents, 'Existing receipts are immutable');
    assert.deepEqual(added, [{ id: JSON.stringify(['island-expression-v1', owner, old.revision]), profileId: owner,
        type: 'expression_changed', timestamp: updated.updatedAt, action }]);
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
async function recordBoundary(row, name, before, after, verify, detail) {
    const changedStores = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    const file = `${row.name}-db-${String(row.databaseChecks.length + 1).padStart(3, '0')}-${name}.json`;
    const entry = { name, file, before: digestTables(before), after: digestTables(after), changedStores, detail, pass: false };
    row.databaseChecks.push(entry);
    try { verify(); entry.pass = true; }
    finally { await fs.writeFile(`${out}/${file}`, JSON.stringify({ ...entry, revision: manifest.revision, sourceHash: manifest.sourceHash,
        changes: Object.fromEntries(changedStores.map(key => [key, { before: before[key], after: after[key] }])) }, null, 2)); }
}
async function waitInput(page, plan) {
    await waitMode(page, 'learning');
    await page.waitForFunction(expected => {
        const input = document.querySelector('[data-island-plan-id][data-input-ready="true"]'), answer = input?.querySelector('.park-answer');
        return answer && answer.getBoundingClientRect().width > 20
            && (!expected || input.getAttribute('data-island-plan-id') === expected.id && Number(input.getAttribute('data-island-plan-revision')) === expected.revision)
            && [...answer.querySelectorAll('.park-keypad button, .park-choices button')].some(button => !button.disabled);
    }, plan ? { id: plan.id, revision: plan.revision } : null);
    assert.equal((await runtimeMetadata(page)).revision, manifest.revision, 'The actual learning surface must be the fixed build');
}
async function home(page, row) {
    await page.locator('.island-page[data-mode]').waitFor();
    const mode = await page.locator('.island-page').getAttribute('data-mode');
    if (mode === 'learning') { await waitInput(page, (await readNative(page, row.owner)).plan); await activate(button(page, 'しまへ'), row.touch); }
    else if (mode === 'expression') { await closeExpression(page, row); return; }
    await waitMode(page, 'home'); await waitReady(page); await idle(page);
}
async function openExpression(page, row) {
    await home(page, row); await activate(button(page, 'しまづくり'), row.touch); await waitMode(page, 'experience');
    await activate(page.locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression'); await waitReady(page); await idle(page);
    assert.equal(await stage(page).evaluate(host => host.closest('figure')?.getAttribute('data-expression-candidate')), expressionCandidate);
}
async function closeExpression(page, row) {
    await activate(button(panel(page), 'みじたくを とじる'), row.touch); await waitMode(page, 'experience');
    await activate(button(page.getByTestId('island-experience'), 'しまへ もどる'), row.touch); await waitMode(page, 'home'); await waitReady(page); await idle(page);
}
async function choose(page, row, id) {
    const item = catalog.find(item => item.id === id); assert(item);
    await activate(button(panel(page), { friends: 'なかま', world: 'けしきと おと', memories: 'おもいで' }[item.category]), row.touch);
    await activate(panel(page).locator(`[data-expression-choice="${id}"]`), row.touch);
    if (item.category === 'friends') await activate(panel(page).locator('[data-expression-resident-choice="otter"]'), row.touch);
    await page.waitForFunction(id => document.querySelector('.island-expression')?.getAttribute('data-expression-item') === id, id);
}
async function renderSelection(page, selection) {
    await page.waitForFunction(selection => {
        const host = document.querySelector('[data-testid="island-stage"]');
        const expression = JSON.parse(host?.getAttribute('data-island-expression') || 'null');
        const environment = JSON.parse(host?.getAttribute('data-island-expression-environment') || 'null');
        return environment?.period === selection.environment.period && environment?.season === selection.environment.season
            && expression?.residents?.length === 3 && expression.residents.every(resident => resident.outfit === selection.residents[resident.id].outfit
                && resident.pattern === selection.residents[resident.id].pattern);
    }, selection);
}
async function waitPublished(page, row, revision) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const value = await readNative(page, row.owner), visibleRevision = Number(await page.locator('.island-page').getAttribute('data-island-revision'));
        if (value.island.revision === revision && visibleRevision === revision) { await idle(page); return value; }
        assert(value.island.revision <= revision, 'Unexpected extra write'); await pause(50);
    }
    throw new Error(`Native/published revision ${revision} did not agree`);
}
async function saved(page, row, name, action, control) {
    const before = await tables(page), revision = islandFor(before, row.owner).revision;
    await activate(control, row.touch); await waitPublished(page, row, revision + 1);
    const after = await checkDB(page, row, name, before, action);
    await renderSelection(page, savedExpression(islandFor(after, row.owner)).selection);
    await panel(page).locator('.island-error').waitFor({ state: 'hidden' }); return after;
}
async function free(page, row, type, value, name = `${type}-${value}`) {
    await activate(button(panel(page), 'けしきと おと'), row.touch);
    const before = await tables(page);
    await activate(panel(page).locator(`[data-expression-${type}="${value ?? 'default'}"]`), row.touch);
    await renderSelection(page, applySelection(savedExpression(islandFor(before, row.owner)).selection, { type, [type]: value }));
    await checkDB(page, row, `${name}-preview`, before);
    return saved(page, row, name, { type, [type]: value }, panel(page).locator('[data-expression-action="apply-free"]'));
}
async function failed(page) { await retryButton(page).waitFor(); await idle(page); }
async function retry(page, row) {
    await activate(retryButton(page), row.touch); await retryButton(page).waitFor({ state: 'hidden' }); await idle(page);
    const state = await readNative(page, row.owner);
    await waitPublished(page, row, state.island.revision); await renderSelection(page, savedExpression(state.island).selection);
}
async function capture(page, row, name) {
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision);
    const learning = metadata.mode === 'learning'; if (learning) await waitInput(page); else await waitReady(page);
    const file = `${row.name}-${name}.png`, frameFile = `${row.name}-${name}-${learning ? 'input' : 'world'}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await (learning ? page.locator('.island-workbench') : stage(page)).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    const actual = learning ? null : await stage(page).evaluate(host => ({
        candidate: host.closest('figure')?.getAttribute('data-expression-candidate'),
        expression: JSON.parse(host.getAttribute('data-island-expression') || 'null'),
        environment: JSON.parse(host.getAttribute('data-island-expression-environment') || 'null'),
        flag: JSON.parse(host.getAttribute('data-island-expression-flag') || 'null'), frameTimestamp: host.dataset.frameTimestamp,
    }));
    if (actual) assert.equal(actual.candidate, expressionCandidate);
    report.captures.push({ name, file, frameFile, sha256: sha(bytes), frameSha256: sha(frame), ...metadata, actual });
}
/** Capture while this real profile has no completed sections, so the photo
 * transaction is audited independently of later legitimate home discoveries. */
async function createOwnerPhoto(page, row) {
    await home(page, row);
    const initial = await tables(page);
    assert.equal(islandFor(initial, row.owner).completedSets, 0);
    assert.equal(initial.islandPhotos.filter(photo => photo.profileId === row.owner).length, 0);
    await activate(button(page, 'アルバム'), row.touch); await waitMode(page, 'album');
    await activate(button(page, 'しゃしん'), row.touch); await waitMode(page, 'photos');
    const gallery = page.getByTestId('island-photo-gallery'), camera = page.getByTestId('island-photo-camera');
    await activate(button(gallery, 'しゃしんを とる'), row.touch); await waitMode(page, 'camera'); await waitReady(page);
    // Distinct real compositions make a swapped owner Blob observable. Two
    // otherwise identical first-island photographs would hide that defect.
    const portrait = row.photos.length > 0;
    if (portrait) {
        const priorFrame = await stage(page).getAttribute('data-frame-timestamp');
        const rabbit = button(camera.locator('.island-photo-targets'), 'ウサギ');
        await activate(rabbit, row.touch);
        await page.waitForFunction(previous => {
            const host = document.querySelector('[data-testid="island-stage"]');
            const selected = [...document.querySelectorAll('.island-photo-targets button')]
                .find(button => button.textContent === 'ウサギ');
            const portrait = JSON.parse(host?.dataset.residentPortrait || 'null');
            return selected?.getAttribute('aria-pressed') === 'true' && portrait?.id === 'rabbit'
                && host?.dataset.frameTimestamp !== previous;
        }, priorFrame);
    }
    const before = await tables(page);
    assert.deepEqual(before, initial, 'Entering the initial photo camera must not change the reserved question or any store');
    await activate(camera.locator('[data-photo-action="capture"]'), row.touch);
    await page.waitForFunction(() => document.querySelector('[data-testid="island-photo-camera"]')?.dataset.photoStatus === 'saved'); await idle(page);
    const after = await tables(page), priorIds = new Set(before.islandPhotos.map(photo => photo.id));
    const added = after.islandPhotos.filter(photo => !priorIds.has(photo.id));
    assert.equal(added.length, 1); const photo = added[0], blob = after.islandPhotoBlobs.find(value => value.id === photo.id);
    await recordBoundary(row, `actual-photo-${row.owner}`, before, after, () => {
        assert.equal(photo.profileId, row.owner); assert.equal(photo.version, 1);
        assert.equal(photo.composition, portrait ? 'resident' : 'island');
        if (portrait) assert.equal(photo.targetKey, 'rabbit');
        assert(blob && blob.profileId === row.owner);
        for (const kind of ['image', 'thumbnail']) {
            assert.equal(blob[kind].mime, 'image/png'); assert(blob[kind].bytes > 0);
            assert.equal(blob[kind].sha256, photo[kind].sha256); assert.equal(blob[kind].bytes, photo[kind].bytes);
        }
        const expected = structuredClone(before);
        expected.islandPhotos.push(photo); expected.islandPhotoBlobs.push(blob);
        const previousAlbum = expected.islandPhotoAlbums.find(album => album.profileId === row.owner), revision = previousAlbum?.revision ?? 0;
        if (previousAlbum) previousAlbum.revision++;
        else expected.islandPhotoAlbums.push({ profileId: row.owner, version: 1, revision: 1 });
        const receiptIds = new Set(before.islandEvents.map(event => event.id));
        const receipts = after.islandEvents.filter(event => !receiptIds.has(event.id)); assert.equal(receipts.length, 1);
        const receipt = receipts[0];
        assert.equal(receipt.id, JSON.stringify(['island-photo:v1:operation', row.owner, revision]));
        assert.equal(receipt.profileId, row.owner); assert.equal(receipt.type, 'photo_changed');
        assert.deepEqual(receipt.action, { type: 'save-photo', photo });
        assert.equal(receipt.photoReceipt.photoId, photo.id); assert.equal(receipt.photoReceipt.albumRevision, revision);
        assert.equal(receipt.photoReceipt.result, 'saved');
        assert.equal(receipt.photoReceipt.intentDigest, sha(JSON.stringify({ type: 'save-photo', photo })));
        assert(Number.isFinite(receipt.timestamp)); expected.islandEvents.push(receipt);
        for (const key of ['islandPhotos', 'islandPhotoBlobs', 'islandEvents']) expected[key].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        expected.islandPhotoAlbums.sort((a, b) => a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0);
        assert.deepEqual(after, expected, 'Photo capture adds exactly its own records, retaining all old owners, learning and photo bytes');
    }, { profileId: row.owner, photoId: photo.id });
    const pending = page.waitForEvent('download'); await activate(button(camera, 'PNGで とりだす'), row.touch);
    const download = await pending, originalFile = `${row.name}-photo-${row.photos.length + 1}-original.png`;
    await download.saveAs(`${out}/${originalFile}`); assert.equal(sha(await fs.readFile(`${out}/${originalFile}`)), photo.image.sha256);
    row.photos.push({ owner: row.owner, metadata: photo, blobHashes: blob, originalFile });
    if (portrait) for (const other of row.photos.filter(value => value.owner !== row.owner)) {
        assert.notEqual(photo.image.sha256, other.metadata.image.sha256, 'Distinct real compositions must expose swapped owner image bytes');
        assert.notEqual(photo.thumbnail.sha256, other.metadata.thumbnail.sha256, 'Distinct owner thumbnails must also be distinguishable');
    }
    await page.screenshot({ path: `${out}/${row.name}-photo-${row.photos.length}-captured.png`, fullPage: true });
    await activate(button(camera, 'しゃしんを みる'), row.touch); await waitMode(page, 'photos');
    await activate(button(gallery, 'しゃしんの アルバムを とじる'), row.touch); await waitMode(page, 'home'); await idle(page);
    assert.deepEqual(await tables(page), after, 'Export and gallery return are read-only');
}
async function verifyOwnerPhoto(page, row) {
    const beforeEntry = await tables(page), expected = row.photos.find(photo => photo.owner === row.owner); assert(expected);
    await home(page, row);
    await activate(button(page, 'アルバム'), row.touch); await waitMode(page, 'album');
    await activate(button(page, 'しゃしん'), row.touch); await waitMode(page, 'photos');
    await idle(page);
    const before = await photoNavigationBoundary(page, row, `photo-gallery-entry-${row.owner}`, beforeEntry);
    const gallery = page.getByTestId('island-photo-gallery');
    await gallery.locator('[data-photo-id]').waitFor();
    const ids = await gallery.locator('[data-photo-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-photo-id')));
    assert.deepEqual(ids, [expected.metadata.id], 'The real gallery displays only this owner’s existing photograph');
    await activate(gallery.locator('[data-photo-id]'), row.touch);
    const image = gallery.locator('.island-photo-detail img'); await image.waitFor();
    const actualImageHash = await image.evaluate(async element => {
        await element.decode(); const bytes = await (await fetch(element.currentSrc || element.src)).arrayBuffer();
        return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    });
    assert.equal(actualImageHash, expected.metadata.image.sha256);
    const exportButton = button(gallery, 'PNGで とりだす'); await exportButton.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.island-photo-detail button')]
        .some(button => button.textContent.includes('PNGで') && !button.disabled));
    const pending = page.waitForEvent('download'); await activate(exportButton, row.touch); const download = await pending;
    const finalExport = `${row.name}-photo-${row.photos.indexOf(expected) + 1}-after-faults.png`;
    await download.saveAs(`${out}/${finalExport}`); assert.equal(sha(await fs.readFile(`${out}/${finalExport}`)), expected.metadata.image.sha256);
    const after = await tables(page);
    for (const photo of row.photos) {
        assert.deepEqual(after.islandPhotos.find(value => value.id === photo.metadata.id), photo.metadata);
        assert.deepEqual(after.islandPhotoBlobs.find(value => value.id === photo.metadata.id), photo.blobHashes);
    }
    await recordBoundary(row, `existing-photo-export-${row.owner}`, before, after, () => exactDelta(before, after, row.owner), { photoId: expected.metadata.id });
    expected.finalExport = finalExport; expected.actualImageHash = actualImageHash;
    await activate(button(gallery, 'しゃしんの アルバムを とじる'), row.touch); await waitMode(page, 'home');
    await openExpression(page, row);
    await photoNavigationBoundary(page, row, `photo-gallery-exit-${row.owner}`, after);
}
async function photoNavigationBoundary(page, row, name, before) {
    await idle(page); const after = await tables(page), diagnostic = await diagnostics(page);
    const proof = { documentId: diagnostic.documentId, discoveries: [] };
    await recordBoundary(row, name, before, after, () => {
        assert.deepEqual(diagnostic.discoveryErrors, []);
        const records = assertDiscoveryDelta(before, after, row.owner);
        for (const record of records) {
            const event = after.islandEvents.find(value => value.id === JSON.stringify(['island-discovery-v1', row.owner, record.id]));
            const transaction = diagnostic.transactions.find(value => value.nativeOutcome === 'complete'
                && value.discoveries.some(discovery => JSON.stringify(discovery) === JSON.stringify(event)));
            assert(transaction, 'A permitted discovery must have actually committed in this document');
            const frame = diagnostic.discoveryFrames.find(value => value.activity.discoveryId === record.id
                && value.activity.itemId === record.itemId && !value.hidden && value.at <= transaction.end.at);
            assert(frame && Number.isFinite(frame.timestamp) && frame.activity.natureVisible && frame.activity.natureReady,
                'A home discovery requires its own prior visible-ready rendered object');
            proof.discoveries.push({ record, event, transaction, frame });
        }
    }, proof);
    return after;
}
/** The application remains the only writer of every value and action. These
 * narrowly armed driver faults affect native transaction completion delivery. */
async function instrument(context) {
    await context.addInitScript(() => {
        const transaction = IDBDatabase.prototype.transaction, add = IDBObjectStore.prototype.add, get = IDBObjectStore.prototype.get;
        const complete = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
        if (!complete?.get || !complete?.set) throw new Error('Native completion instrumentation unavailable');
        const meta = new WeakMap(), deliveries = []; let armed;
        const sample = () => ({ at: performance.now(), hidden: document.hidden, visibility: document.visibilityState, focused: document.hasFocus(),
            mode: document.querySelector('.island-page')?.getAttribute('data-mode') ?? null });
        const data = { documentId: crypto.randomUUID(), transactions: [], faults: [], visibility: [sample()], deliveries: [],
            discoveryFrames: [], discoveryErrors: [] };
        const observed = new Set();
        const observeDiscovery = () => {
            try {
                const host = document.querySelector('[data-testid="island-stage"]');
                if (!host || document.hidden) return;
                const mode = document.querySelector('.island-page')?.getAttribute('data-mode');
                if (!['home', 'play', 'viewing', 'camera'].includes(mode)) return;
                const activity = JSON.parse(host.getAttribute('data-living-activity') || 'null');
                if (!activity?.discoveryId || !activity.natureVisible || !activity.natureReady) return;
                const key = JSON.stringify([activity.discoveryId, activity.itemId]);
                if (observed.has(key)) return;
                const canvas = host.querySelector('canvas'), rect = canvas?.getBoundingClientRect();
                if (!rect || rect.width < 100 || rect.height < 100 || rect.bottom <= 0 || rect.top >= innerHeight
                    || rect.right <= 0 || rect.left >= innerWidth) return;
                if (data.discoveryFrames.length >= 128) throw new Error('Discovery evidence limit reached');
                const frame = { ...sample(), timestamp: Number(host.getAttribute('data-frame-timestamp')), activity,
                    png: canvas.toDataURL('image/png') };
                data.discoveryFrames.push(frame); observed.add(key);
            } catch (error) { if (data.discoveryErrors.length < 32) data.discoveryErrors.push(String(error)); }
        };
        new MutationObserver(observeDiscovery).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-frame-timestamp'] });
        window.__expressionPersistence = {
            arm(value) { if (armed || deliveries.length) throw new Error('Previous diagnostic fault is still pending'); armed = value; },
            release() { for (const deliver of deliveries.splice(0)) deliver(); },
            snapshot() { return JSON.parse(JSON.stringify({ ...data, heldCount: deliveries.length, armed: armed ?? null })); },
        };
        document.addEventListener('visibilitychange', () => data.visibility.push(sample()));
        IDBDatabase.prototype.transaction = function (...args) {
            const tx = transaction.apply(this, args);
            if (tx.mode !== 'readwrite' || !tx.objectStoreNames.contains('islands')) return tx;
            const entry = { start: sample(), stores: [...tx.objectStoreNames], nativeOutcome: 'pending', actions: [], discoveries: [], receiptReads: [], islandReads: [] };
            meta.set(tx, entry); data.transactions.push(entry);
            tx.addEventListener('complete', () => { entry.nativeOutcome = 'complete'; entry.end = sample(); });
            tx.addEventListener('abort', () => { entry.nativeOutcome = 'abort'; entry.end = sample(); }); return tx;
        };
        IDBObjectStore.prototype.get = function (key) {
            const request = get.call(this, key), entry = meta.get(this.transaction);
            if (entry && this.name === 'islandEvents' && typeof key === 'string' && key.startsWith('["island-expression-v1",')) {
                const read = { key }; entry.receiptReads.push(read);
                request.addEventListener('success', () => { read.result = request.result ? structuredClone(request.result) : null; });
            } else if (entry && this.name === 'islands') {
                const read = { key }; entry.islandReads.push(read);
                request.addEventListener('success', () => { read.revision = request.result?.revision; });
            }
            return request;
        };
        IDBObjectStore.prototype.add = function (value, ...args) {
            const entry = meta.get(this.transaction);
            if (this.name === 'islandEvents' && value?.type === 'expression_changed' && entry) {
                entry.actions.push(structuredClone(value));
                if (armed && armed.profileId === value.profileId && JSON.stringify(armed.action) === JSON.stringify(value.action)) {
                    entry.fault = armed.mode; armed = undefined;
                    data.faults.push({ ...sample(), mode: entry.fault, receiptId: value.id, action: structuredClone(value.action) });
                    if (entry.fault === 'abort') this.transaction.abort();
                }
            }
            const result = add.call(this, value, ...args);
            if (this.name === 'islandEvents' && value?.type === 'discovery_observed' && entry) entry.discoveries.push(structuredClone(value));
            return result;
        };
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: complete.configurable, enumerable: complete.enumerable,
            get() { return complete.get.call(this); }, set(handler) {
                complete.set.call(this, typeof handler !== 'function' ? handler : function (event) {
                    const entry = meta.get(this);
                    if (entry?.fault === 'lost-completion') {
                        entry.applicationOutcome = 'injected-failure-after-native-commit';
                        this.onabort?.call(this, new Event('abort', { cancelable: true }));
                    } else if (entry?.fault === 'hold-completion') {
                        entry.applicationOutcome = 'held-after-native-commit';
                        deliveries.push(() => { data.deliveries.push({ receiptId: entry.actions[0]?.id, ...sample() });
                            entry.applicationOutcome = 'released-native-completion'; handler.call(this, event); });
                    } else handler.call(this, event);
                });
            } });
    });
}
async function windowInfo(context, page) {
    const session = await context.newCDPSession(page);
    try { const { targetInfo } = await session.send('Target.getTargetInfo'); return { ...await session.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId }), targetInfo }; }
    finally { await session.detach(); }
}
async function separateWindow(browser, context, page, row) {
    const main = await windowInfo(context, page), session = await browser.newBrowserCDPSession();
    try {
        const waiting = context.waitForEvent('page');
        const created = await session.send('Target.createTarget', { url: 'about:blank', newWindow: true, browserContextId: main.targetInfo.browserContextId });
        const other = await waiting, info = await windowInfo(context, other);
        assert.equal(info.targetInfo.targetId, created.targetId); assert.notEqual(info.windowId, main.windowId);
        for (const [id, left] of [[main.windowId, 10], [info.windowId, row.viewport.width + 50]])
            await session.send('Browser.setWindowBounds', { windowId: id, bounds: { windowState: 'normal', left, top: 20, width: row.viewport.width + 30, height: row.viewport.height + 100 } });
        await other.setViewportSize(row.viewport); other.setDefaultTimeout(20000); other.on('pageerror', error => row.errors.push(error.message));
        await other.bringToFront(); await other.waitForFunction(() => !document.hidden);
        row.windows.push({ main: main.windowId, other: info.windowId }); return other;
    } finally { await session.detach(); }
}
async function visiblePair(page, other, row, label) {
    const state = { label, main: await visibility(page), other: await visibility(other) }; row.visibilityPairs.push(state);
    assert(!state.main.hidden && !state.other.hidden && state.main.visibility === 'visible' && state.other.visibility === 'visible',
        'Concurrent preview requires two genuinely visible windows, never a forged visibility state');
}
async function earn(page, row) {
    await page.goto(`${target}/#/island`); await waitReady(page);
    row.initialRuntime = await runtimeMetadata(page);
    assert.equal(row.initialRuntime.revision, manifest.revision, 'Verify the target before any onboarding or answer writes');
    const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0); assert.equal(empty.profiles.length, 0);
    await activate(button(page, 'まなぶ'), row.touch); await page.locator('.island-setup-name input').fill(row.ownerName);
    await activate(button(page, '年中'), row.touch); await activate(button(page, 'さんすう'), row.touch);
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitInput(page);
    let native = await readNative(page), answers = 0; row.owner = native.plan.profileId;
    const initialPlan = native.plan; await createOwnerPhoto(page, row); const photographed = await tables(page);
    await activate(button(page, 'つづきから とく'), row.touch); await waitInput(page, initialPlan);
    assert.deepEqual(await tables(page), photographed); native = await readNative(page, row.owner);
    while ((native.island.customization?.points ?? 0) < 50 || native.plan.cursor !== 0) {
        native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; assert(++answers < 220, 'Bounded normal input must earn the test purchases');
    }
    assert.equal(native.islandEvents.filter(event => event.type === 'answer').length, answers);
    assert.equal(native.island.expression, undefined, 'Ordinary learning must not materialize expression');
    row.earned = { fixture: false, answers, points: native.island.customization.points, reservedPlan: native.plan,
        answerReceiptIds: native.islandEvents.filter(event => event.type === 'answer').map(event => event.id) };
    await openExpression(page, row); await capture(page, row, '01-real-earned');
}
async function nativeFaults(page, row) {
    await choose(page, row, 'raincoat');
    const before = await tables(page), action = { type: 'acquire', itemId: 'raincoat' };
    await arm(page, 'abort', row.owner, action); await activate(panel(page).locator('[data-expression-action="acquire"]'), row.touch); await failed(page);
    const fault = (await diagnostics(page)).faults.at(-1); assert.equal(fault.mode, 'abort');
    assert.equal(fault.receiptId, JSON.stringify(['island-expression-v1', row.owner, islandFor(before, row.owner).revision]));
    await checkDB(page, row, 'native-abort-all-table-rollback', before); await capture(page, row, '02-native-abort');
    await retry(page, row);
    const recovered = await checkDB(page, row, 'native-abort-same-intent-retry', before, action);
    const receipt = recovered.islandEvents.find(event => event.id === fault.receiptId);
    assert.deepEqual(receipt.action, fault.action); assert.deepEqual(islandFor(recovered, row.owner).expression.selection, emptySelection());
    assert((await diagnostics(page)).transactions.some(entry => entry.fault === 'abort' && entry.nativeOutcome === 'abort'));
    row.coverage.nativeAbort = 'pass';

    await choose(page, row, 'star-beret');
    const prior = await tables(page), lostAction = { type: 'acquire', itemId: 'star-beret' };
    await arm(page, 'lost-completion', row.owner, lostAction);
    await activate(panel(page).locator('[data-expression-action="acquire"]'), row.touch); await failed(page);
    const committed = await checkDB(page, row, 'lost-completion-native-commit', prior, lostAction), lost = (await diagnostics(page)).faults.at(-1);
    assert.equal(lost.mode, 'lost-completion'); assert.deepEqual(islandFor(committed, row.owner).expression.selection, emptySelection());
    assert(await panel(page).locator('[data-expression-choice]').evaluateAll(controls => controls.every(control => control.disabled)),
        'An unknown request cannot be replaced by a new catalog choice');
    const index = (await diagnostics(page)).transactions.length; await capture(page, row, '03-unknown-native-commit'); await retry(page, row);
    await checkDB(page, row, 'lost-completion-exact-receipt-retry', committed);
    const replay = (await diagnostics(page)).transactions.slice(index);
    assert(replay.some(entry => entry.nativeOutcome === 'complete' && entry.actions.length === 0 && entry.receiptReads.some(read => read.key === lost.receiptId
        && JSON.stringify(read.result?.action) === JSON.stringify(lost.action))), 'Retry must read the original canonical receipt without a new action');
    assert((await diagnostics(page)).transactions.some(entry => entry.fault === 'lost-completion' && entry.nativeOutcome === 'complete'));
    await choose(page, row, 'raincoat');
    await saved(page, row, 'next-equip-after-unknown-retry', { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }, panel(page).locator('[data-expression-action="equip"]'));
    row.coverage.unknownRetry = 'pass'; await capture(page, row, '04-retry-then-next-equip');
}
async function knownCAS(browser, context, page, row) {
    let other;
    try {
        other = await separateWindow(browser, context, page, row); await other.goto(`${target}/#/island`); await openExpression(other, row);
        await page.bringToFront(); await visiblePair(page, other, row, 'CAS before old preview');
        const before = await tables(page), oldRevision = islandFor(before, row.owner).revision;
        await activate(button(panel(page), 'けしきと おと'), row.touch);
        await activate(panel(page).locator('[data-expression-season="winter"]'), row.touch);
        await renderSelection(page, applySelection(savedExpression(islandFor(before, row.owner)).selection, { type: 'season', season: 'winter' }));
        await checkDB(page, row, 'CAS-stale-preview-is-read-only', before);
        await other.bringToFront(); await visiblePair(page, other, row, 'CAS other real save');
        await activate(button(panel(other), 'けしきと おと'), row.touch);
        await activate(panel(other).locator('[data-expression-period="morning"]'), row.touch);
        await arm(other, 'lost-completion', row.owner, { type: 'period', period: 'morning' });
        await activate(panel(other).locator('[data-expression-action="apply-free"]'), row.touch); await failed(other);
        const concurrent = await checkDB(other, row, 'CAS-concurrent-native-save', before, { type: 'period', period: 'morning' });
        await page.bringToFront(); await visiblePair(page, other, row, 'CAS stale submit');
        assert.equal(Number(await page.locator('.island-page').getAttribute('data-island-revision')), oldRevision,
            'The lost completion must actually leave this page stale; a current revision is not a CAS test');
        const txIndex = (await diagnostics(page)).transactions.length;
        await activate(panel(page).locator('[data-expression-action="apply-free"]'), row.touch);
        await panel(page).getByText('しまの ようすが かわったよ。いまの ものから えらびなおそう。', { exact: true }).waitFor();
        await idle(page); await waitPublished(page, row, oldRevision + 1);
        assert.equal(await retryButton(page).count(), 0); assert.equal(await panel(page).locator('.island-expression-preview').count(), 0);
        assert.equal(await panel(page).locator('[data-expression-action="apply-free"]').count(), 0);
        await checkDB(page, row, 'CAS-rejection-does-not-rebase', concurrent);
        const rejected = (await diagnostics(page)).transactions.slice(txIndex);
        assert(rejected.some(entry => entry.nativeOutcome === 'abort' && entry.actions.length === 0 && entry.islandReads.some(read => read.revision === oldRevision + 1)
            && entry.receiptReads.some(read => read.key === JSON.stringify(['island-expression-v1', row.owner, oldRevision]))), 'Observe a real stale receipt lookup and native CAS abort');
        const selected = await free(page, row, 'season', 'summer', 'CAS-explicit-new-summer');
        await capture(page, row, '05-known-CAS-new-choice');
        await other.bringToFront(); await retry(other, row);
        await checkDB(other, row, 'older-other-receipt-keeps-new-summer', selected);
        await page.bringToFront(); await waitPublished(page, row, islandFor(selected, row.owner).revision);
        await renderSelection(page, savedExpression(islandFor(selected, row.owner)).selection);
        row.coverage.knownCAS = 'pass';
    } finally { if (other) { await retainDiagnostics(other, row).catch(() => {}); await other.close(); } await page.bringToFront(); }
}
async function nativeBackground(context, page, row) {
    let tab;
    try {
        const mainWindow = await windowInfo(context, page); tab = await context.newPage();
        assert.equal((await windowInfo(context, tab)).windowId, mainWindow.windowId, 'Native background needs a real same-window tab');
        await page.bringToFront(); await page.waitForFunction(() => !document.hidden);
        await choose(page, row, 'leaf-album-cover'); await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
        const before = await tables(page), action = { type: 'acquire', itemId: 'leaf-album-cover' };
        await arm(page, 'hold-completion', row.owner, action); await activate(panel(page).locator('[data-expression-action="acquire"]'), row.touch);
        await page.waitForFunction(() => window.__expressionPersistence.snapshot().heldCount === 1);
        const committed = await tables(page);
        await recordBoundary(row, 'background-native-commit-before-delivery', before, committed, () => exactDelta(before, committed, row.owner, action), { action });
        const baseline = await diagnostics(page);
        assert(baseline.transactions.some(entry => entry.fault === 'hold-completion' && entry.nativeOutcome === 'complete'));
        await tab.bringToFront();
        const hidden = await page.waitForFunction(() => document.hidden && document.visibilityState === 'hidden', undefined, { timeout: 3000 }).then(() => true, () => false);
        row.background = { status: hidden ? 'pending' : 'unverified-driver', windowId: mainWindow.windowId,
            main: await visibility(page), foreground: await visibility(tab), applicationVisibilityModified: false };
        await page.evaluate(() => window.__expressionPersistence.release()); await idle(page);
        await checkDB(page, row, 'held-acquisition-only-authorized-change', before, action);
        await checkDB(page, row, 'held-completion-no-extra-write', committed);
        if (hidden) {
            const after = await diagnostics(page);
            assert(after.visibility.some(value => value.hidden && value.visibility === 'hidden'));
            assert(after.deliveries.some(value => value.hidden && value.visibility === 'hidden'));
            assert.equal(after.transactions.length, baseline.transactions.length, 'No new writer begins while the old completion is delivered hidden');
            assert.equal(await panel(page).locator('.island-expression-preview').count(), 0);
            row.background.status = 'pass';
        }
        await page.bringToFront(); await page.waitForFunction(() => !document.hidden); await tab.close(); tab = undefined;
        if (hidden) assert.equal(await panel(page).locator('.island-expression-preview').count(), 0, 'Foreground must not replay the canceled trial');
        else if (await panel(page).locator('.island-expression-preview').count()) await activate(button(panel(page), 'いまに もどす'), row.touch);
        await waitPublished(page, row, islandFor(committed, row.owner).revision);
        await renderSelection(page, savedExpression(islandFor(committed, row.owner)).selection);
        await free(page, row, 'period', 'evening', 'foreground-explicit-evening');
        row.coverage.nativeBackground = row.background.status;
        row.background.visibilityEvents = (await diagnostics(page)).visibility;
        await capture(page, row, '06-background-result');
    } finally {
        await page.evaluate(() => window.__expressionPersistence.release()).catch(() => {});
        if (tab) await tab.close(); await page.bringToFront();
        await fs.writeFile(`${out}/background-report.json`, JSON.stringify({ target, revision: manifest.revision, driverFocus: report.driverFocus,
            layouts: report.layouts.map(layout => ({ name: layout.name, ...layout.background })) }, null, 2));
    }
}
function ownedRows(state, owner) {
    return Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, name === 'profiles' ? rows.filter(row => row.id === owner)
        : name === 'appData' ? rows.map(row => ({ id: row.id, profile: row.profiles?.[owner] })) : rows.filter(row => row.profileId === owner)]));
}
function exactProfileSwitch(before, after, id) {
    const expected = structuredClone(before), app = expected.appData.find(row => row.id === 'app'); assert(app);
    app.activeProfileId = id; assert.deepEqual(after, expected, 'Profile switch may only change the actual active profile pointer');
}
async function settings(page, row) {
    await home(page, row); await activate(button(page, 'せってい'), row.touch);
    await activate(page.locator('[data-setting-section="profile"]'), row.touch);
}
async function switchProfile(page, row, name, id) {
    await settings(page, row); const before = await tables(page);
    const card = page.locator('.space-y-3.px-4.py-4').filter({ hasText: name });
    await activate(card.getByRole('button', { name: /切替|きりかえ/ }), row.touch); await waitReady(page);
    await page.waitForFunction(name => document.querySelector('.island-brand p')?.textContent === `${name}の`, name);
    const after = await tables(page);
    await recordBoundary(row, `switch-profile-${id}`, before, after, () => exactProfileSwitch(before, after, id), { activeProfileId: id });
}
async function createSecondProfile(page, row) {
    await settings(page, row); const before = await tables(page);
    await activate(page.getByRole('button', { name: /^(追加|ついか)$/ }), row.touch);
    await activate(button(page, 'はじめる'), row.touch); await page.getByPlaceholder('あだ名でOK').fill(row.otherName);
    await activate(button(page, '次へ'), row.touch); await activate(page.getByRole('button', { name: /年中/ }), row.touch);
    await activate(page.getByRole('button', { name: /さんすう だけ/ }), row.touch);
    await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), row.touch); await waitReady(page);
    const created = await tables(page), otherId = created.profiles.find(profile => profile.name === row.otherName)?.id;
    assert(otherId && otherId !== row.owner); assert.deepEqual(ownedRows(created, row.owner), ownedRows(before, row.owner));
    const otherRow = { ...row, owner: otherId };
    assert.equal(islandFor(created, otherId).expression, undefined); assert.equal(islandFor(created, otherId).customization?.points ?? 0, 0);
    await createOwnerPhoto(page, otherRow);
    await activate(button(page, 'まなぶ'), row.touch); await waitInput(page);
    let native = await readNative(page, otherId), initialPlanId = native.plan.id, answers = 0;
    while (native.plan.id === initialPlanId) { native = (await answerUI(page, native.plan, { touch: row.touch, dev: false })).state; assert(++answers < 80); }
    assert.equal(native.island.completedSets, 1); assert.equal(native.island.expression, undefined);
    await openExpression(page, otherRow); await choose(page, otherRow, 'raincoat');
    assert.equal(await panel(page).locator('[data-expression-action="equip"]').count(), 0);
    assert(await panel(page).locator('[data-expression-action="acquire"]').isDisabled(), 'A ownership and wallet cannot leak to B');
    await free(page, otherRow, 'period', 'day', 'B-day'); await free(page, otherRow, 'season', 'spring', 'B-spring');
    const after = await tables(page); assert.deepEqual(ownedRows(after, row.owner), ownedRows(before, row.owner));
    row.otherId = otherId; row.otherLearning = { fixture: false, answers, initialPlanId, reservedPlan: native.plan };
    row.otherBaseline = ownedRows(after, otherId); row.ownerBaseline = ownedRows(after, row.owner);
    await capture(page, otherRow, '07-independent-B');
    await switchProfile(page, otherRow, row.ownerName, row.owner); await openExpression(page, row);
    assert.deepEqual(ownedRows(await tables(page), row.otherId), row.otherBaseline);
    row.coverage.profileSeparation = 'pass';
}
async function lateProfileCompletion(browser, context, page, row) {
    let other;
    try {
        other = await separateWindow(browser, context, page, row); await other.goto(`${target}/#/island`); await settings(other, row);
        await page.bringToFront(); await visiblePair(page, other, row, 'profile exit before held save');
        await choose(page, row, 'star-beret'); await activate(panel(page).locator('[data-expression-action="preview"]'), row.touch);
        const before = await tables(page), action = { type: 'equip-outfit', residentId: 'otter', itemId: 'star-beret' };
        await arm(page, 'hold-completion', row.owner, action); await activate(panel(page).locator('[data-expression-action="equip"]'), row.touch);
        await page.waitForFunction(() => window.__expressionPersistence.snapshot().heldCount === 1);
        const committed = await tables(page);
        await recordBoundary(row, 'A-native-commit-before-profile-exit', before, committed, () => exactDelta(before, committed, row.owner, action), { action });
        await other.bringToFront(); await visiblePair(page, other, row, 'real B switch while A completion is held');
        const card = other.locator('.space-y-3.px-4.py-4').filter({ hasText: row.otherName });
        await activate(card.getByRole('button', { name: /切替|きりかえ/ }), row.touch); await waitReady(other);
        await page.waitForFunction(name => document.querySelector('.island-brand p')?.textContent === `${name}の`, row.otherName); await waitReady(page);
        const switched = await tables(page);
        await recordBoundary(row, 'real-profile-exit-while-A-completion-held', committed, switched,
            () => exactProfileSwitch(committed, switched, row.otherId), { activeProfileId: row.otherId });
        await page.evaluate(() => window.__expressionPersistence.release());
        await page.waitForFunction(() => window.__expressionPersistence.snapshot().heldCount === 0); await idle(page);
        await page.bringToFront(); await waitReady(page);
        assert.deepEqual(await tables(page), switched, 'Late A completion must not write or publish a different B state');
        const otherRow = { ...row, owner: row.otherId };
        await openExpression(page, otherRow);
        await renderSelection(page, savedExpression(islandFor(switched, row.otherId)).selection);
        assert.equal(await panel(page).locator('.island-expression-preview').count(), 0); assert.equal(await retryButton(page).count(), 0);
        assert.deepEqual(ownedRows(await tables(page), row.otherId), row.otherBaseline);
        await capture(page, otherRow, '08-late-A-completion-stays-B');
        await retainDiagnostics(other, row); await other.close(); other = undefined;
        await switchProfile(page, otherRow, row.ownerName, row.owner); await openExpression(page, row);
        await renderSelection(page, savedExpression(islandFor(committed, row.owner)).selection);
        assert.deepEqual(ownedRows(await tables(page), row.owner), ownedRows(committed, row.owner));
        row.coverage.lateProfileCompletion = 'pass';
    } finally {
        await page.evaluate(() => window.__expressionPersistence.release()).catch(() => {});
        if (other) { await retainDiagnostics(other, row).catch(() => {}); await other.close(); } await page.bringToFront();
    }
}
async function offlineReload(context, page, row) {
    await free(page, row, 'period', 'evening', 'offline-preparation-evening');
    await free(page, row, 'season', 'winter', 'offline-preparation-winter');
    const savedState = await tables(page), savedIsland = islandFor(savedState, row.owner), selection = savedIsland.expression.selection;
    assert.deepEqual(selection.environment, { period: 'evening', season: 'winter' });
    const pending = (await readNative(page, row.owner)).plan;
    await activate(panel(page).locator('[data-expression-action="learn"]'), row.touch); await waitInput(page, pending);
    await checkDB(page, row, 'nondefault-return-keeps-same-reservation', savedState);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
    row.serviceWorker = await page.evaluate(async () => ({ controller: navigator.serviceWorker.controller?.scriptURL,
        registrations: (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, active: registration.active?.scriptURL, state: registration.active?.state })) }));
    await retainDiagnostics(page, row);
    await context.setOffline(true);
    try {
        const disconnected = await page.evaluate(async () => {
            try { await fetch(`${location.origin}/__expression_network_probe_${crypto.randomUUID()}`, { cache: 'no-store' }); return false; }
            catch { return true; }
        });
        assert(disconnected, 'Uncached native network request must actually fail, not merely a simulated offline label');
        const response = await page.reload(); await waitInput(page, pending);
        assert(response?.fromServiceWorker(), 'The actual reload navigation must come from the installed service worker');
        assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller) && !navigator.onLine));
        await checkDB(page, row, 'offline-reload-all-stores-exact', savedState);
        assert.deepEqual((await readNative(page, row.owner)).plan, pending);
        await openExpression(page, row); await renderSelection(page, selection);
        await checkDB(page, row, 'offline-real-nondefault-render-no-write', savedState);
        await capture(page, row, '09-offline-evening-winter');
        const edited = await free(page, row, 'period', 'morning', 'offline-explicit-morning');
        assert.equal(islandFor(edited, row.owner).expression.selection.environment.season, 'winter');
        await activate(panel(page).locator('[data-expression-action="learn"]'), row.touch); await waitInput(page, pending);
        await checkDB(page, row, 'offline-edit-to-same-reservation', edited);
        const answered = await answerUI(page, pending, { touch: row.touch, dev: false }), after = await tables(page);
        assert.equal(answered.state.plan.id, pending.id); assert.equal(answered.state.plan.revision, pending.revision + 1);
        assert.deepEqual(islandFor(after, row.owner).expression, islandFor(edited, row.owner).expression);
        for (const name of ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs']) assert.deepEqual(after[name], edited[name]);
        assert.deepEqual(ownedRows(after, row.otherId), row.otherBaseline);
        row.offline = { navigationFromServiceWorker: response.fromServiceWorker(), uncachedNetworkFailed: disconnected,
            savedEnvironment: selection.environment, editedEnvironment: islandFor(after, row.owner).expression.selection.environment,
            samePlanId: pending.id, previousPlanRevision: pending.revision, answeredPlanRevision: answered.state.plan.revision, fixture: false };
        await capture(page, row, '10-offline-same-normal-input'); await retainDiagnostics(page, row);
        await context.setOffline(false); await page.reload(); await waitInput(page, answered.state.plan);
        await checkDB(page, row, 'online-reload-keeps-offline-answer-and-selection', after);
        await openExpression(page, row); await renderSelection(page, savedExpression(islandFor(after, row.owner)).selection);
        await capture(page, row, '11-online-restored'); row.coverage.nondefaultOffline = 'pass';
    } finally { await context.setOffline(false); }
}
const require = createRequire(import.meta.url);
const { chromium } = await import('playwright');
const { CRSession } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/crConnection.js'));
const driverSend = CRSession.prototype.send;
report.driverFocus = { command: 'Emulation.setFocusEmulationEnabled', originalEnabled: true, replacementEnabled: false,
    dependencyFilesModified: false, appVisibilityPropertyModified: false, overrides: [] };
CRSession.prototype.send = function (method, params) {
    if (method === report.driverFocus.command && params?.enabled === true) {
        report.driverFocus.overrides.push({ sessionId: this._sessionId, at: new Date().toISOString() });
        return driverSend.call(this, method, { ...params, enabled: false });
    }
    return driverSend.call(this, method, params);
};
let browser;
try {
    const headed = process.env.SANSU_EXPRESSION_PERSISTENCE_HEADED !== '0';
    browser = await chromium.launch({ headless: !headed }); report.browser = { version: browser.version(), headed };
    const selected = viewports.filter(layout => !process.env.SANSU_EXPRESSION_PERSISTENCE_VIEWPORT || layout.name === process.env.SANSU_EXPRESSION_PERSISTENCE_VIEWPORT);
    assert(selected.length, 'Choose phone or tablet');
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow', acceptDownloads: true });
        await instrument(context); await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const row = { ...layout, ownerName: `みじたくA${layout.name}`, otherName: `みじたくB${layout.name}`, pass: false, errors: [],
            databaseChecks: [], diagnosticDocuments: [], windows: [], visibilityPairs: [], photos: [],
            coverage: { realEarned: 'not-run', nativeAbort: 'not-run', unknownRetry: 'not-run', knownCAS: 'not-run', nativeBackground: 'not-run',
                profileSeparation: 'not-run', lateProfileCompletion: 'not-run', nondefaultOffline: 'not-run', existingPhotoBytes: 'not-run' } };
        report.layouts.push(row); page.on('pageerror', error => row.errors.push(error.message));
        try {
            await earn(page, row); row.coverage.realEarned = 'pass'; console.log(`${row.name}: earned ${row.earned.points} stars through ${row.earned.answers} ordinary answers`);
            await nativeFaults(page, row); console.log(`${row.name}: native abort and exact unknown-result retry checked`);
            await knownCAS(browser, context, page, row);
            await nativeBackground(context, page, row);
            await createSecondProfile(page, row);
            await lateProfileCompletion(browser, context, page, row);
            await offlineReload(context, page, row);
            await verifyOwnerPhoto(page, row);
            await switchProfile(page, row, row.otherName, row.otherId);
            await verifyOwnerPhoto(page, { ...row, owner: row.otherId });
            await switchProfile(page, { ...row, owner: row.otherId }, row.ownerName, row.owner); await openExpression(page, row);
            assert.equal(row.photos.length, 2); assert(row.photos.every(photo => photo.finalExport && photo.actualImageHash === photo.metadata.image.sha256));
            row.coverage.existingPhotoBytes = 'pass-two-distinct-real-subjects-original-thumbnail-metadata-owner-gallery-and-UI-export';
            await retainDiagnostics(page, row);
            const transactions = row.diagnosticDocuments.flatMap(document => document.transactions).filter(entry => entry.actions.length);
            assert(transactions.some(entry => entry.fault === 'abort' && entry.nativeOutcome === 'abort'));
            assert(transactions.some(entry => entry.fault === 'lost-completion' && entry.nativeOutcome === 'complete'));
            for (const entry of transactions) {
                assert(!entry.start.hidden && entry.start.mode === 'expression', 'No expression writer begins in learning, another mode or native background');
                assert(entry.actions.every(action => action.type === 'expression_changed'));
            }
            assert.deepEqual(row.errors, []); row.pass = true; row.finalTables = digestTables(await tables(page));
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(await tables(page), null, 2));
            console.log(`${row.name}: persistence main path PASS; native background ${row.background?.status}`);
        } catch (cause) {
            row.failure = cause.stack; process.exitCode = 1;
            await page.evaluate(() => window.__expressionPersistence?.release()).catch(() => {});
            await capture(page, row, 'failure').catch(() => page.screenshot({ path: `${out}/${row.name}-failure-raw.png`, fullPage: true }).catch(() => {}));
            await fs.writeFile(`${out}/${row.name}-failure-native.json`, JSON.stringify(await tables(page).catch(() => null), null, 2));
            await fs.writeFile(`${out}/${row.name}-failure.html`, await page.content().catch(() => ''));
        } finally {
            await retainDiagnostics(page, row).catch(() => {});
            await fs.writeFile(`${out}/${row.name}-native-diagnostics.json`, JSON.stringify(row.diagnosticDocuments, null, 2));
            await context.tracing.stop({ path: `${out}/${row.name}-browser-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
    report.mainPathPassed = selected.length === 2 && report.layouts.every(row => row.pass);
    report.backgroundGatePassed = headed && selected.length === 2 && report.layouts.every(row => row.background?.status === 'pass');
    report.pass = report.mainPathPassed && report.backgroundGatePassed;
    report.gates.runtimeIntegrity = report.pass ? 'passed-selected-persistence-scenarios' : 'failed-or-partial';
} catch (cause) { report.failure = cause.stack; process.exitCode = 1; }
finally {
    if (browser) await browser.close(); CRSession.prototype.send = driverSend;
    try { report.finalFingerprints = await fingerprint(); assert.deepEqual(report.finalFingerprints, initialSource); report.sourceStable = true; }
    catch (cause) { report.pass = false; report.sourceStable = false; report.sourceFailure = cause.stack; process.exitCode = 1; }
    if (!report.pass) process.exitCode = 1;
    report.finishedAt = new Date().toISOString();
    const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Expression persistence evidence</title><style>body{font:16px system-ui;margin:24px;background:#f5f2e9}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;padding:12px}img{width:100%}small{display:block;overflow-wrap:anywhere}</style><h1>Expression persistence — ${report.pass ? 'PASS' : 'INCOMPLETE'}</h1><p>${escape(target)} · ${escape(manifest.revision)} · ${escape(manifest.sourceHash)}</p><p>Human N=0. Native fault injection is declared; no application-data fixtures. Runtime integrity, appearance and silent comprehension remain separate.</p><main>${report.captures.map(item => `<figure><a href="${escape(item.file)}"><img src="${escape(item.frameFile)}" alt="${escape(item.name)}"></a><figcaption>${escape(item.name)}</figcaption><small>${escape(item.candidate)} · ${escape(item.actual?.candidate)} · ${escape(item.delivery)} · ${escape(item.revision)} · ${escape(item.frameSha256)}</small></figure>`).join('')}</main>`);
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
