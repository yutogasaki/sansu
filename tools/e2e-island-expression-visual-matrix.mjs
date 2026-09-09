import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activate, button, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { PAIRS, USES, EXISTING_PAIRS, RESIDENTS, pairKey, islandFor, makeVisualFixture, assertVisualMutation,
    assertRenderedPair, assertFurnitureUse } from './island-expression-visual-matrix-audit.mjs';

const viewports = [{ name: 'phone', viewport: { width: 390, height: 844 }, touch: true, reducedMotion: 'no-preference' },
    { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false, reducedMotion: 'reduce' }];
const fixedRevision = 'workshop-20260909-a285ab860033';
const overlay = ['tools/e2e-island-expression-visual-matrix.mjs', 'tools/island-expression-visual-matrix-audit.mjs'];
const helpers = ['tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const remaining = ['Isolated injected visual state is not genuine acquisition, qualification, spontaneous replay or child behavior (human N=0).',
    'Acquisition/save/trail/old-state boundaries remain bounded by expression-06/furniture-06 and their fixed17 build; this run does not re-prove them on fixed24.',
    'Visual appeal and silent comprehension/safety require separate review of the actual images. Technical completion alone never closes X04/X12.',
    'No extra clothing x furniture x partner Cartesian product, automatic home-use matrix, every interrupt, audio, performance or populated-photo preservation claim.'];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, applicationDataInjected: true, timingEvidenceEligible: false,
        fixedRevision, viewports, existingPairs: EXISTING_PAIRS, remainingPairsPerViewport: PAIRS, usesPerViewport: USES,
        fixture: 'Complete furniture-06 final native state per width, unchanged furniture poses/learning history/reservation; only four explicit expression rights, neutral expression/experience defaults, and sound OFF are injected once into an empty isolated context.',
        requiredEnvironment: ['SANSU_VISUAL_MATRIX_URL', 'SANSU_VISUAL_MATRIX_OUTPUT', 'SANSU_VISUAL_MATRIX_BUILD_SOURCE', 'SANSU_VISUAL_MATRIX_QA_ROOT', 'SANSU_VISUAL_MATRIX_FIXTURES'],
        optionalEnvironment: ['SANSU_VISUAL_MATRIX_VIEWPORT=phone|tablet (partial)', 'SANSU_VISUAL_MATRIX_HEADED=1'],
        source: { application: 'Immutable fixed24 all inputs plus matching overlay app inputs', qa: overlay, unchangedHelpers: helpers,
            external: 'qa-runtime.json pins Node/Playwright; fixture manifest pins source reports, native originals and generated states; all hashed before/after' },
        measurements: ['25 actual portrait PNGs/UI captures per width; same real rig and visible cloth groups; unchanged non-look state',
            '9 owned-model uses per width; trusted UI, selected real actor, contacts/cup identity, every actual phase PNG and frame/camera trace',
            'All native stores and Blob hashes checked across every navigation/action against the prior verified baseline; no automatic baseline absorption'],
        remaining }, null, 2)); process.exit(0);
}
const target = (process.env.SANSU_VISUAL_MATRIX_URL || '').replace(/\/$/u, ''), out = process.env.SANSU_VISUAL_MATRIX_OUTPUT;
assert(target && out && process.env.SANSU_VISUAL_MATRIX_BUILD_SOURCE && process.env.SANSU_VISUAL_MATRIX_QA_ROOT && process.env.SANSU_VISUAL_MATRIX_FIXTURES);
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_VISUAL_MATRIX_BUILD_SOURCE, 'utf8'));
assert.equal(manifest.revision, fixedRevision);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), fixturesRoot = path.resolve(process.env.SANSU_VISUAL_MATRIX_FIXTURES);
assert.equal(await fs.realpath(root), await fs.realpath(process.env.SANSU_VISUAL_MATRIX_QA_ROOT));
assert.notEqual(await fs.realpath(root), await fs.realpath(manifest.origin), 'Run an explicit immutable QA overlay, never live source');
const fixtureManifestPath = path.join(fixturesRoot, 'fixtures.json'), runtimeManifestPath = path.join(root, 'qa-runtime.json');
const fixtures = JSON.parse(await fs.readFile(fixtureManifestPath, 'utf8')), runtime = JSON.parse(await fs.readFile(runtimeManifestPath, 'utf8'));
const casesPath = process.env.SANSU_VISUAL_MATRIX_CASES;
const cases = casesPath ? JSON.parse(await fs.readFile(casesPath, 'utf8')) : null;
if (cases) for (const row of cases.layouts) {
    assert(viewports.some(viewport => viewport.name === row.name));
    assert(row.pairs.every(key => PAIRS.some(pair => pairKey(pair) === key)));
    assert(row.uses.every(key => USES.some(use => `${use.kind}-${use.residentId}` === key)));
    assert.equal(new Set(row.pairs).size, row.pairs.length); assert.equal(new Set(row.uses).size, row.uses.length);
}
assert.equal(fixtures.version, 1); assert.equal(fixtures.acquisitionEvidence, false); assert.equal(fixtures.layouts.length, 2);
assert(runtime.files?.length && runtime.localRuntimeImports?.length);
assert.deepEqual(runtime.localRuntimeImports.find(entry => entry.from === overlay[0])?.to.slice().sort(),
    [helpers[0], overlay[1]].sort(), 'The runtime closure must name this runner and its actual local imports');
assert.equal(runtime.node.version, process.version); assert.equal(await fs.realpath(runtime.node.executable), await fs.realpath(process.execPath));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const appFiles = manifest.files.filter(file => !file.relative.startsWith('tools/'));
assert(appFiles.length && manifest.files.every(file => file.relative && !path.isAbsolute(file.relative) && !file.relative.split(path.sep).includes('..')));
const fixtureFiles = fixtures.layouts.flatMap(layout => [path.join(fixturesRoot, layout.file), layout.source.path]);
const evidenceFiles = fixtures.evidence.map(entry => entry.path);
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)), overlayApp: await hashFiles(appFiles.map(file => path.join(root, file.relative))),
    qa: await hashFiles([...overlay, ...helpers].map(file => path.join(root, file))),
    fixtures: await hashFiles([fixtureManifestPath, ...fixtureFiles, ...evidenceFiles, ...(casesPath ? [casesPath, ...cases.evidence.map(file => file.path)] : [])]), runtime: await hashFiles([runtimeManifestPath, ...runtime.files.map(file => file.path)]) });
const initial = await fingerprint();
const pinned = (list, file, expected) => assert.equal(list.find(entry => entry.path === file)?.sha256, expected, `Changed source: ${file}`);
for (const file of manifest.files) pinned(initial.app, file.path, file.sha256);
for (const file of appFiles) pinned(initial.overlayApp, path.join(root, file.relative), file.sha256);
for (const file of helpers) pinned(initial.qa, path.join(root, file), manifest.files.find(entry => entry.relative === file)?.sha256);
for (const file of runtime.files) pinned(initial.runtime, file.path, file.sha256);
for (const item of fixtures.layouts) { pinned(initial.fixtures, path.join(fixturesRoot, item.file), item.sha256); pinned(initial.fixtures, item.source.path, item.source.sha256); }
for (const item of fixtures.evidence) pinned(initial.fixtures, item.path, item.sha256);
if (cases) for (const item of cases.evidence) pinned(initial.fixtures, item.path, item.sha256);
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, revision: manifest.revision, sourceHash: manifest.sourceHash, startedAt: new Date().toISOString(), pass: false,
    fullSpec41Passed: false, humanN: 0, applicationDataInjected: true, acquisitionEvidence: false, timingEvidenceEligible: false,
    scope: { pairsPerViewport: PAIRS, existingPairs: EXISTING_PAIRS, usesPerViewport: USES, selectedCases: cases, fullMatrixInThisRun: !cases }, fixture: fixtures, fingerprints: initial,
    sources: { app: manifest.snapshot, qa: root, fixtures: fixturesRoot }, remaining, captures: [], layouts: [],
    gates: { runtimeIntegrity: 'not-run', visualAppeal: 'requires-image-review', silentComprehensionAndSafety: 'requires-human-review' } };
const stage = page => page.getByTestId('island-stage'), panel = page => page.locator('.island-expression'), experience = page => page.getByTestId('island-experience');
const shop = page => page.locator('section[aria-label="くらしの どうぐ"]');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function idle(page) { await page.waitForFunction(() => document.querySelector('.island-page')?.dataset.busy === 'false'); }
async function press(page, row, label, scope = page) { await idle(page); await activate(button(scope, label), row.touch); }
async function closeExpression(page, row) {
    const control = button(panel(page), 'みじたくを とじる');
    await page.evaluate(() => {
        window.__visualClose = { events: [] };
        const record = event => {
            const button = document.querySelector('.island-expression button[aria-label="みじたくを とじる"]');
            if (!button) return;
            const box = button.getBoundingClientRect(), canvas = document.querySelector('[data-testid="island-stage"] canvas');
            const hit = document.elementFromPoint(event.clientX, event.clientY);
            window.__visualClose.events.push({ type: event.type, at: performance.now(), trusted: event.isTrusted,
                x: event.clientX, y: event.clientY, target: event.target.tagName, hit: hit?.tagName,
                buttonReceives: button.contains(event.target), buttonHit: button.contains(hit), box: box.toJSON(),
                canvasBox: canvas?.getBoundingClientRect().toJSON(), scrollTop: document.querySelector('.island-page').scrollTop });
        };
        for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, record, { capture: true, once: true });
    });
    await activate(control, row.touch);
    let navigated = true;
    await page.waitForFunction(() => document.querySelector('.island-page')?.dataset.mode === 'experience', null, { timeout: 2000 }).catch(() => { navigated = false; });
    const diagnosis = await page.evaluate(() => window.__visualClose);
    diagnosis.firstTapNavigated = navigated;
    if (!navigated) {
        diagnosis.originalFailureImage = `${row.name}-close-${row.navigation.length}-first-tap.png`;
        await page.screenshot({ path: path.join(out, diagnosis.originalFailureImage) });
        // A normal scroll makes the complete button visible; no app action,
        // camera, time or storage state is changed by the QA.
        await control.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await control.evaluate(node => {
            const b = node.getBoundingClientRect();
            if (![.1, .5, .9].every(t => node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height * t)))) throw new Error('Close button remains obscured after scrolling');
        });
        await activate(control, row.touch); await waitMode(page, 'experience');
        diagnosis.explicitScrollRetapNavigated = true;
    }
    row.navigation.push(diagnosis);
    await fs.writeFile(`${out}/${row.name}-navigation.json`, JSON.stringify(row.navigation, null, 2));
}
async function world(page) {
    await waitReady(page); await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), canvas = host?.querySelector('canvas'), box = canvas?.getBoundingClientRect();
        return document.querySelector('.island-page')?.dataset.mode !== 'learning' && host?.dataset.renderer === 'three'
            && box?.width > 100 && box?.height > 100 && canvas.width > 1 && host.dataset.cameraFrame?.split(',').length === 32;
    });
}
async function tables(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            const entries = await Promise.all(names.map(name => new Promise((resolve, reject) => { const req = tx.objectStore(name).getAll();
                req.onsuccess = () => resolve([name, req.result]); req.onerror = () => reject(req.error); })));
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
const digest = state => Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, { rows: rows.length, sha256: sha(JSON.stringify(rows)) }]));
async function check(page, row, label, action) {
    await idle(page); const before = row.baseline, after = await tables(page);
    const entry = { label, action: action ?? null, before: digest(before), after: digest(after), pass: false,
        file: `${row.name}-db-${String(row.db.length + 1).padStart(3, '0')}-${label}.json` };
    row.db.push(entry);
    try { assertVisualMutation(before, after, row.owner, action); entry.pass = true; row.baseline = after; }
    finally { await fs.writeFile(path.join(out, entry.file), JSON.stringify({ ...entry, changes: Object.fromEntries(Object.keys(after)
        .filter(name => JSON.stringify(before[name]) !== JSON.stringify(after[name])).map(name => [name, { before: before[name], after: after[name] }])) }, null, 2)); }
    return after;
}
// Passive post-render observer. It never changes time, camera, nodes or gestures.
async function observe(page, label, phases) {
    await page.evaluate(({ label, phases }) => {
        window.__visualMatrix?.observer?.disconnect();
        const host = document.querySelector('[data-testid="island-stage"]'), seen = new Set(); let last;
        const probe = window.__visualMatrix = { label, frames: [], images: [], errors: [], closed: false, phases };
        const sample = () => {
            if (probe.closed || !host.dataset.frameTimestamp || host.dataset.frameTimestamp === last) return;
            last = host.dataset.frameTimestamp;
            if (probe.frames.length >= 6000) { probe.errors.push('frame-limit'); probe.observer.disconnect(); return; }
            try {
                const read = key => host.getAttribute(key) ? JSON.parse(host.getAttribute(key)) : null;
                const canvas = host.querySelector('canvas'), box = canvas?.getBoundingClientRect();
                const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
                const frame = { timestamp: Number(last), at: performance.now(), expression: read('data-island-expression'), residents: read('data-resident-states'),
                    portrait: read('data-resident-portrait'), optional: read('data-optional-furniture'), camera: host.dataset.cameraFrame,
                    expressionCandidate: host.closest('figure')?.dataset.expressionCandidate, optionalCandidate: host.dataset.optionalFurnitureCandidate,
                    requestId: host.dataset.playRequestId, status: host.dataset.playStatus, reason: host.dataset.playReason,
                    hidden: document.hidden, mode: document.querySelector('.island-page')?.dataset.mode,
                    canvas: { width: box.width, height: box.height, pixelWidth: canvas.width, pixelHeight: canvas.height,
                        visible: box.width > 100 && box.height > 100 && cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight && document.elementFromPoint(cx, cy) === canvas } };
                probe.frames.push(frame); probe.latest = frame;
                if (!phases || !probe.gesture || !frame.optional?.active || !frame.canvas.visible || frame.hidden) return;
                const keys = [frame.optional.phase, ...(frame.optional.contactSeen ? ['contact-confirmed'] : []), ...(frame.optional.transferSeen ? ['transfer-confirmed'] : [])];
                for (const key of keys) if (!seen.has(key)) { seen.add(key); probe.images.push({ key, frame, png: canvas.toDataURL('image/png') }); }
            } catch (error) { probe.errors.push(String(error)); }
        };
        probe.observer = new MutationObserver(sample); probe.observer.observe(host, { attributes: true, attributeFilter: ['data-frame-timestamp'] });
        probe.sample = sample;
        // An idle scene may already have rendered its last frame before this
        // observer is installed. Read that actual canvas once without driving
        // the app; later action/phase checks still require their real request.
        sample();
    }, { label, phases });
}
async function latest(page) { return page.evaluate(() => window.__visualMatrix?.latest); }
async function waitFrame(page, predicate, label, timeout = 45000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const actual = await latest(page); if (actual && predicate(actual)) return actual; await pause(40); }
    throw new Error(`${label}: ${JSON.stringify(await latest(page))}`);
}
async function saveProbe(page, row, captureCurrent = false) {
    const probe = await page.evaluate(captureCurrent => {
        const value = window.__visualMatrix; if (!value || value.closed) return null;
        value.closed = true; value.observer.disconnect();
        if (captureCurrent && value.latest && !value.latest.hidden && value.latest.canvas.visible) {
            value.images.push({ key: 'portrait', frame: value.latest, compositorScreenshot: true });
        }
        return { label: value.label, gesture: value.gesture, frames: value.frames, images: value.images, errors: value.errors };
    }, captureCurrent);
    if (!probe) return null;
    for (const image of probe.images) {
        const bytes = image.compositorScreenshot ? await stage(page).locator('canvas').screenshot() : Buffer.from(image.png.split(',')[1], 'base64'); delete image.png;
        image.file = `${row.name}-${probe.label}-${image.key}.png`; image.sha256 = sha(bytes);
        await fs.writeFile(path.join(out, image.file), bytes);
        report.captures.push({ name: `${probe.label}-${image.key}`, file: image.file, sha256: image.sha256, actual: image.frame,
            ...row.metadata, fixture: true, visualReview: 'pending' });
    }
    const file = `${row.name}-${probe.label}-frames.json`;
    await fs.writeFile(path.join(out, file), JSON.stringify(probe, null, 2)); row.traces.push(file);
    assert.deepEqual(probe.errors, []); return probe;
}
async function seed(page, row) {
    await page.goto(`${target}/#/island`); await waitMode(page, 'welcome'); await waitReady(page);
    const empty = await tables(page); assert.equal(empty.profiles.length, 0); assert.equal(empty.islands.length, 0); assert.equal(empty.logs.length, 0);
    const item = fixtures.layouts.find(item => item.name === row.name); assert(item);
    const original = JSON.parse(await fs.readFile(item.source.path, 'utf8')), fixture = JSON.parse(await fs.readFile(path.join(fixturesRoot, item.file), 'utf8'));
    assert.deepEqual(fixture, makeVisualFixture(original), 'Exactly the declared four rights/default looks/sound change');
    assert.deepEqual(Object.keys(fixture), Object.keys(empty), 'Fixture and production schema must match');
    row.owner = fixture.islands[0].profileId;
    await page.evaluate(async ({ fixture, owner }) => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const tx = db.transaction([...db.objectStoreNames], 'readwrite');
            const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
            for (const [name, rows] of Object.entries(fixture)) for (const value of rows) tx.objectStore(name).put(value);
            await done; localStorage.setItem('sansu_active_profile', owner);
        } finally { db.close(); }
    }, { fixture, owner: row.owner });
    assert.deepEqual(await tables(page), fixture); row.baseline = fixture;
    await fs.writeFile(`${out}/${row.name}-native-fixture.json`, JSON.stringify(fixture, null, 2));
    await page.reload(); await waitReady(page); await waitMode(page, 'learning');
    await page.locator('[data-input-ready="true"] .park-answer').waitFor();
    await check(page, row, 'fixture-open-same-reservation');
    await press(page, row, 'しまへ'); await waitMode(page, 'home');
    await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
    await activate(experience(page).locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression'); await world(page);
    await check(page, row, 'initial-expression-entry'); row.metadata = await runtimeMetadata(page); assert.equal(row.metadata.revision, fixedRevision);
    await observe(page, 'initial-rigs', false);
    const frame = await waitFrame(page, value => value.expression?.residents?.length === 3 && value.canvas.visible, 'Three actual resident rigs');
    row.rigs = Object.fromEntries(frame.expression.residents.map(value => [value.id, value.uuid])); assert.deepEqual(Object.keys(row.rigs), RESIDENTS);
    await saveProbe(page, row);
}
async function selectExpression(page, row, residentId, itemId) {
    await idle(page); await activate(panel(page).locator(`[data-expression-resident-choice="${residentId}"]`), row.touch);
    await activate(panel(page).locator(`[data-expression-choice="${itemId}"]`), row.touch);
    await page.waitForFunction(({ residentId, itemId }) => {
        const panel = document.querySelector('.island-expression'); return panel?.dataset.expressionResident === residentId && panel.dataset.expressionItem === itemId;
    }, { residentId, itemId });
    await check(page, row, `select-${residentId}-${itemId}`);
}
async function mutate(page, row, label, action, control) {
    await check(page, row, `before-${label}`);
    const revision = islandFor(row.baseline, row.owner).revision, end = Date.now() + 15000;
    await activate(control, row.touch);
    while (islandFor(await tables(page), row.owner)?.revision === revision) {
        assert(Date.now() < end, `Native writer did not settle: ${label}`); await pause(40);
    }
    await check(page, row, label, action);
}
async function wear(page, row, pair) {
    const current = islandFor(row.baseline, row.owner), selected = current.expression.selection.residents[pair.residentId];
    if (['original', 'scarf', 'cap'].includes(pair.look)) {
        if (selected.outfit !== null || current.experience.residents[pair.residentId].look !== pair.look) {
            await closeExpression(page, row);
            await press(page, row, 'なかま', experience(page)); await activate(experience(page).locator(`[data-resident-id="${pair.residentId}"]`), row.touch);
            await mutate(page, row, `look-${pair.residentId}-${pair.look}`, { type: 'resident-look', residentId: pair.residentId, look: pair.look }, experience(page).locator(`[data-resident-look="${pair.look}"]`));
            await activate(experience(page).locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
            await check(page, row, 'free-look-return');
        }
    } else if (selected.outfit !== pair.look) {
        await selectExpression(page, row, pair.residentId, pair.look);
        await mutate(page, row, `outfit-${pair.residentId}-${pair.look}`, { type: 'equip-outfit', residentId: pair.residentId, itemId: pair.look }, panel(page).locator('[data-expression-action="equip"]'));
    }
    await selectExpression(page, row, pair.residentId, pair.pattern);
    if (islandFor(row.baseline, row.owner).expression.selection.residents[pair.residentId].pattern !== pair.pattern) {
        await mutate(page, row, `pattern-${pair.residentId}-${pair.pattern}`, { type: 'equip-pattern', residentId: pair.residentId, itemId: pair.pattern }, panel(page).locator('[data-expression-action="equip"]'));
    }
}
async function portrait(page, row, pair) {
    // The saved clothes remain on the same rig. The friends tab exposes the
    // actual portrait camera diagnostic; expression uses a separate camera route.
    await closeExpression(page, row);
    await press(page, row, 'なかま', experience(page));
    await activate(experience(page).locator(`[data-resident-id="${pair.residentId}"]`), row.touch);
    await world(page); await observe(page, pairKey(pair), false);
    const outfit = ['raincoat', 'star-beret'].includes(pair.look) ? pair.look : null;
    const frame = await waitFrame(page, frame => frame.portrait?.id === pair.residentId && frame.canvas.visible
        && frame.expression?.residents.some(resident => resident.id === pair.residentId && resident.pattern === pair.pattern && resident.outfit === outfit)
        && (outfit || frame.residents?.some(resident => resident.species === pair.residentId && resident.look === pair.look)), 'New selected portrait');
    assertRenderedPair(frame, pair, row.rigs);
    const probe = await saveProbe(page, row, true); assert(probe.images.length === 1);
    const uiFile = `${row.name}-${pairKey(pair)}-ui.png`; await page.screenshot({ path: path.join(out, uiFile), fullPage: true });
    await check(page, row, `portrait-${pairKey(pair)}`);
    row.pairs.push({ ...pair, frame: probe.images[0], uiFile, runtimePass: true, visualReview: 'pending' });
    await activate(experience(page).locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
    await check(page, row, `portrait-${pairKey(pair)}-exit`);
}
async function repairFurniture(page, row, use) {
    const before = structuredClone(row.baseline), itemId = `optional-${use.kind}`;
    const placement = page.locator('section[aria-label="おく ばしょを えらぶ"]');
    const repair = { itemId, residentId: use.residentId, partnerId: use.partnerId, pass: false };
    row.repairs.push(repair);
    await press(page, row, 'おく ばしょを かえる', shop(page)); await waitMode(page, 'placement'); await world(page);
    await check(page, row, `repair-${use.kind}-${use.residentId}-preview`);
    const search = button(placement, 'つかえる ばしょを さがす');
    await search.evaluate(node => {
        const host = document.querySelector('[data-testid="island-stage"]');
        const probe = window.__visualPlacement = { states: [] };
        probe.observer = new MutationObserver(() => {
            if (!probe.gesture || probe.states.length >= 1024) return;
            const value = JSON.parse(host.dataset.furniturePlacement || 'null');
            if (value) probe.states.push({ value, timestamp: host.dataset.frameTimestamp });
        });
        probe.observer.observe(host, { attributes: true, attributeFilter: ['data-furniture-placement'] });
        node.addEventListener('click', event => { probe.gesture = { trusted: event.isTrusted, hidden: document.hidden }; }, { once: true, capture: true });
    });
    try {
        await activate(search, row.touch);
        const terminalHandle = await page.waitForFunction(({ itemId, residentId, partnerId }) => {
            const states = window.__visualPlacement.states;
            const matches = value => value.itemId === itemId && value.residentId === residentId && value.partnerId === partnerId;
            const start = states.findIndex(state => matches(state.value) && state.value.status === 'searching');
            return start >= 0 && states.slice(start + 1).find(state => matches(state.value)
                && (state.value.status === 'no-space' || state.value.status === 'ready' && state.value.suggestion?.requestId));
        }, { itemId, residentId: use.residentId, partnerId: use.partnerId }, { timeout: 45000 });
        repair.terminal = await terminalHandle.jsonValue(); await terminalHandle.dispose();
        await check(page, row, `repair-${use.kind}-${use.residentId}-search-unsaved`);
        await page.screenshot({ path: `${out}/${row.name}-repair-${use.kind}-${use.residentId}-search.png` });
        assert.equal(repair.terminal.value.status, 'ready', 'Explicit same-resident search must find an actual usable pose; no-space remains failed');
        const suggestion = repair.terminal.value.suggestion;
        await page.waitForFunction(({ itemId, kind, residentId, partnerId, suggestion }) => {
            const host = document.querySelector('[data-testid="island-stage"]');
            const value = JSON.parse(host.dataset.furniturePlacement || 'null'), preview = JSON.parse(host.dataset.previewState || 'null');
            return value?.itemId === itemId && value.residentId === residentId && value.partnerId === partnerId && value.status === 'ready'
                && preview?.id === itemId && preview.position[0] === suggestion.position.x && preview.position[2] === suggestion.position.z
                && Math.abs(preview.rotationY - suggestion.rotation) < 1e-8
                && value.key === JSON.stringify([itemId, kind, preview.position[0], preview.position[2], preview.rotationY, residentId, partnerId]);
        }, { itemId, kind: use.kind, residentId: use.residentId, partnerId: use.partnerId, suggestion });
        repair.action = { type: 'place', itemId, position: suggestion.position, rotation: suggestion.rotation };
        await press(page, row, 'ここに おく', placement); await waitMode(page, 'furniture'); await idle(page);
        const after = await tables(page), expected = structuredClone(before), old = islandFor(before, row.owner), island = islandFor(expected, row.owner);
        island.revision++; island.updatedAt = islandFor(after, row.owner).updatedAt;
        assert(Number.isSafeInteger(island.updatedAt) && island.updatedAt >= old.updatedAt);
        const item = island.items.find(item => item.id === itemId); item.position = { ...suggestion.position };
        item.rotation = ((suggestion.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); item.autoPlacementBlocked = undefined;
        expected.islandEvents.push({ id: JSON.stringify(['island-edit-v1', row.owner, old.revision]), profileId: row.owner,
            type: 'item_edited', timestamp: island.updatedAt, itemId, action: repair.action });
        expected.islandEvents.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        await fs.writeFile(`${out}/${row.name}-repair-${use.kind}-${use.residentId}-native.json`, JSON.stringify({ before, after, expected }, null, 2));
        assert.deepEqual(after, expected, 'Only the explicitly confirmed furniture pose and canonical edit receipt may change');
        row.baseline = after; repair.saved = true;
        assert.equal(await shop(page).locator(`[data-furniture-resident="${use.residentId}"]`).getAttribute('aria-pressed'), 'true');
        if (use.partnerId) assert.equal(await shop(page).locator(`[data-furniture-partner="${use.partnerId}"]`).getAttribute('aria-pressed'), 'true');
    } finally {
        repair.probe = await page.evaluate(() => { const p = window.__visualPlacement; p.observer.disconnect(); return { gesture: p.gesture, states: p.states }; });
        await fs.writeFile(`${out}/${row.name}-repair-${use.kind}-${use.residentId}.json`, JSON.stringify(repair, null, 2));
        assert(repair.probe.gesture?.trusted && !repair.probe.gesture.hidden);
    }
    return repair;
}
async function storeNearbySwing(page, row, use) {
    const before = structuredClone(row.baseline), itemId = 'living-swing', old = islandFor(before, row.owner);
    const index = old.items.findIndex(item => item.id === itemId); assert(index >= 0 && old.items[index].position);
    const placement = page.locator('section[aria-label="おく ばしょを えらぶ"]');
    await press(page, row, 'まわりの ものを うごかす', placement); await waitMode(page, 'inventory');
    await check(page, row, 'surroundings-inventory-unchanged');
    await press(page, row, `ブランコ ${index + 1}を うごかす`, page.locator('section[aria-label="しまの もちもの"]'));
    await waitMode(page, 'placement'); await world(page); await check(page, row, 'surroundings-swing-preview-unchanged');
    await page.screenshot({ path: `${out}/${row.name}-surroundings-swing-before.png` });
    const action = { type: 'store', itemId };
    await press(page, row, 'いまは しまっておく', placement); await waitMode(page, 'home'); await idle(page);
    const after = await tables(page), expected = structuredClone(before), island = islandFor(expected, row.owner);
    island.revision++; island.updatedAt = islandFor(after, row.owner).updatedAt;
    assert(Number.isSafeInteger(island.updatedAt) && island.updatedAt >= old.updatedAt);
    island.items[index] = { ...island.items[index], position: undefined, autoPlacementBlocked: undefined };
    expected.islandEvents.push({ id: JSON.stringify(['island-edit-v1', row.owner, old.revision]), profileId: row.owner,
        type: 'item_edited', timestamp: island.updatedAt, itemId, action });
    expected.islandEvents.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    await fs.writeFile(`${out}/${row.name}-surroundings-swing-native.json`, JSON.stringify({ before, after, expected, action }, null, 2));
    assert.deepEqual(after, expected, 'Only the explicit nearby swing storage and its canonical receipt may change');
    row.baseline = after; row.surroundings = { action, pass: true, originalPosition: old.items[index].position };
    await press(page, row, 'もちもの'); await waitMode(page, 'inventory');
    await press(page, row, 'くらしの どうぐを みる'); await waitMode(page, 'furniture');
    assert.equal(await shop(page).getAttribute('data-furniture-kind'), use.kind);
    assert.equal(await shop(page).locator(`[data-furniture-resident="${use.residentId}"]`).getAttribute('aria-pressed'), 'true');
    if (use.partnerId) assert.equal(await shop(page).locator(`[data-furniture-partner="${use.partnerId}"]`).getAttribute('aria-pressed'), 'true');
    await check(page, row, 'surroundings-same-actors-return');
}
async function furniture(page, row, use) {
    await wear(page, row, use);
    // The receiver wears a declared additional outfit/pattern too, without expanding the nine-pair scope.
    if (use.partnerId) {
        const partner = USES.find(value => value.kind === 'tea-table' && value.residentId === use.partnerId);
        await wear(page, row, partner);
    }
    await closeExpression(page, row);
    await press(page, row, 'しまへ もどる', experience(page)); await waitMode(page, 'home');
    await press(page, row, 'もちもの'); await waitMode(page, 'inventory');
    await press(page, row, 'くらしの どうぐを みる'); await waitMode(page, 'furniture');
    await activate(shop(page).locator(`[data-furniture-choice="${use.kind}"]`), row.touch);
    await activate(shop(page).locator(`[data-furniture-resident="${use.residentId}"]`), row.touch);
    if (use.partnerId) await activate(shop(page).locator(`[data-furniture-partner="${use.partnerId}"]`), row.touch);
    await check(page, row, `${use.kind}-${use.residentId}-selected`);
    assert.equal(await shop(page).locator(`[data-furniture-resident="${use.residentId}"]`).getAttribute('aria-pressed'), 'true');
    if (use.partnerId) assert.equal(await shop(page).locator(`[data-furniture-partner="${use.partnerId}"]`).getAttribute('aria-pressed'), 'true');
    const label = `use-${use.kind}-${use.residentId}`;
    const start = async suffix => {
        await world(page); await observe(page, `${label}${suffix}`, true);
        const old = await waitFrame(page, frame => frame.canvas.visible, 'Before use frame');
        const control = button(shop(page), 'ここで ためす');
        await control.evaluate(node => node.addEventListener('click', event => {
            window.__visualMatrix.gesture = { trusted: event.isTrusted, hidden: document.hidden, at: performance.now() };
        }, { once: true, capture: true }));
        await activate(control, row.touch);
        return waitFrame(page, frame => frame.requestId && frame.requestId !== old.requestId, 'New real use request');
    };
    let started = await start(''), repair;
    if (started.status === 'blocked' && process.env.SANSU_VISUAL_MATRIX_REPAIR === '1') {
        await saveProbe(page, row); await check(page, row, `${label}-original-refusal-unchanged`);
        await page.screenshot({ path: `${out}/${row.name}-${label}-original-refusal.png` });
        row.refusals.push({ ...use, request: started });
        try { repair = await repairFurniture(page, row, use); started = await start('-repaired'); }
        catch (error) {
            if (process.env.SANSU_VISUAL_MATRIX_SURROUNDINGS !== '1' || row.surroundings
                || row.repairs.at(-1)?.terminal?.value.status !== 'no-space') throw error;
            await storeNearbySwing(page, row, use);
            started = await start('-after-surroundings');
        }
    }
    assert.equal(started.status, 'playing', `Selected resident could not use the saved fixture: ${started.reason}`);
    await waitFrame(page, frame => frame.optional?.requestId === started.requestId && frame.optional.phase === 'settled', 'Actual settled result');
    const probe = await saveProbe(page, row); const result = assertFurnitureUse(probe, use, row.rigs, started.requestId);
    if (use.partnerId) {
        const partner = USES.find(value => value.kind === 'tea-table' && value.residentId === use.partnerId);
        for (const frame of probe.frames.filter(frame => frame.optional?.requestId === started.requestId)) assertRenderedPair(frame, partner, row.rigs, false);
    }
    await check(page, row, label); row.uses.push({ ...use, ...result });
    if (repair) { repair.pass = true; repair.result = result; await fs.writeFile(`${out}/${row.name}-repair-${use.kind}-${use.residentId}.json`, JSON.stringify(repair, null, 2)); }
    await press(page, row, 'どうぐを とじる', shop(page)); await waitMode(page, 'home');
    await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
    await activate(experience(page).locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
    await check(page, row, `${label}-exit`);
}
let browser;
try {
    report.servedVersion = await (await fetch(`${target}/version.json`)).json();
    assert.equal(report.servedVersion.revision, fixedRevision, 'Actual served app must match the frozen build');
    assert.equal(report.servedVersion.island?.candidate, 'mystic-island-shore-garden-v7');
    const { chromium } = await import('playwright'); browser = await chromium.launch({ headless: process.env.SANSU_VISUAL_MATRIX_HEADED !== '1' });
    report.browser = { version: browser.version(), headed: process.env.SANSU_VISUAL_MATRIX_HEADED === '1' };
    const selected = viewports.filter(value => !process.env.SANSU_VISUAL_MATRIX_VIEWPORT || value.name === process.env.SANSU_VISUAL_MATRIX_VIEWPORT); assert(selected.length);
    for (const layout of selected) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, reducedMotion: layout.reducedMotion, serviceWorkers: 'allow' });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const selectedCases = cases?.layouts.find(value => value.name === layout.name);
        const pairs = selectedCases ? PAIRS.filter(pair => selectedCases.pairs.includes(pairKey(pair))) : PAIRS;
        const uses = selectedCases ? selectedCases.uses.map(key => USES.find(use => `${use.kind}-${use.residentId}` === key)) : USES;
        const row = { ...layout, selectedCases, pass: false, errors: [], pairs: [], uses: [], useFailures: [], repairs: [], refusals: [], navigation: [], traces: [], db: [] }; report.layouts.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        try {
            await seed(page, row);
            for (const pair of pairs) { await wear(page, row, pair); await portrait(page, row, pair); }
            for (const use of uses) {
                try { await furniture(page, row, use); }
                catch (error) {
                    row.useFailures.push({ ...use, error: error.stack });
                    await saveProbe(page, row);
                    await page.screenshot({ path: `${out}/${row.name}-use-${use.kind}-${use.residentId}-failure.png` });
                    await check(page, row, `failed-${use.kind}-${use.residentId}-unchanged`);
                    console.error(`${row.name} ${use.kind}/${use.residentId}: ${error.message}`);
                    // Retain this failed case and continue the finite list through
                    // the ordinary close route; never absorb a changed baseline.
                    if (await page.locator('.island-page').getAttribute('data-mode') === 'placement') {
                        await press(page, row, 'いどうを やめる', page.locator('section[aria-label="おく ばしょを えらぶ"]')); await waitMode(page, 'furniture');
                    }
                    await press(page, row, 'どうぐを とじる', shop(page)); await waitMode(page, 'home');
                    await press(page, row, 'しまづくり'); await waitMode(page, 'experience');
                    await activate(experience(page).locator('[data-experience-action="expression"]'), row.touch); await waitMode(page, 'expression');
                    await check(page, row, `failed-${use.kind}-${use.residentId}-exit`);
                }
            }
            assert.equal(row.pairs.length, pairs.length); assert.equal(row.uses.length + row.useFailures.length, uses.length); assert.deepEqual(row.errors, []);
            await check(page, row, 'final-world');
            await fs.writeFile(`${out}/${row.name}-native-final.json`, JSON.stringify(row.baseline, null, 2));
            row.finalTables = digest(row.baseline); row.pass = row.useFailures.length === 0;
            console.log(`${row.name}: ${row.pairs.length} portraits, ${row.uses.length} uses passed, ${row.useFailures.length} failed; selected scope and image review remain separate`);
        } catch (error) {
            row.error = error.stack; await saveProbe(page, row).catch(error => { row.probeError = String(error); });
            if (row.baseline) await fs.writeFile(`${out}/${row.name}-verified-baseline-failure.json`, JSON.stringify(row.baseline, null, 2));
            await fs.writeFile(`${out}/${row.name}-native-failure.json`, JSON.stringify(await tables(page), null, 2));
            await page.screenshot({ path: `${out}/${row.name}-failure.png`, fullPage: true }).catch(() => {});
            await stage(page).screenshot({ path: `${out}/${row.name}-failure-world.png` }).catch(() => {});
            console.error(`${row.name}: ${error.message}`);
        } finally {
            delete row.baseline; await context.tracing.stop({ path: `${out}/${row.name}-trace.zip` }); await context.close();
            await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
        }
    }
} finally {
    try { await browser?.close(); report.browserClosed = true; }
    catch (error) { report.browserCloseError = String(error); }
    try { report.finalFingerprints = await fingerprint(); report.sourceStable = JSON.stringify(initial) === JSON.stringify(report.finalFingerprints); }
    catch (error) { report.sourceStable = false; report.sourceError = String(error); }
    report.pass = report.browserClosed && report.sourceStable && report.layouts.length === 2 && report.layouts.every(row => row.pass);
    report.gates.runtimeIntegrity = report.pass ? 'pass-selected-visual-fixture-path' : 'fail-or-partial';
    report.endedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const html = `<!doctype html><meta charset="utf-8"><title>Fixture visual matrix</title><style>body{font:14px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}figure{margin:0;background:white;padding:8px}img{width:100%}</style><h1>Isolated visual fixture — human review pending</h1><p>${manifest.revision}. No acquisition or child-behavior evidence.</p><main>${report.captures.map(value => `<figure><a href="${value.file}"><img src="${value.file}" loading="lazy"></a><figcaption>${value.file}</figcaption></figure>`).join('')}</main>`;
    await fs.writeFile(`${out}/contact-sheet.html`, html);
}
if (!report.pass) process.exitCode = 1;
