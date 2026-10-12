import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

// Run against the same immutable candidate used by verify:core. This file never
// starts a server, changes app data outside existing UI commands, or writes inputs.
const defaultUrl = 'http://127.0.0.1:5358/prototypes/place-qa/authored.html?water=wide&cove=corner&shoulder=central&ground=source';
const output = process.env.SANSU_AUTHORED_SHOULDER_OUTPUT && path.resolve(process.env.SANSU_AUTHORED_SHOULDER_OUTPUT);
const expectedBuild = process.env.SANSU_AUTHORED_SHOULDER_BUILD;
const coreReportPath = process.env.SANSU_AUTHORED_SHOULDER_CORE_REPORT;
const shapeOnly = process.env.SANSU_AUTHORED_SHOULDER_SHAPE_ONLY === '1';
const timeout = Number(process.env.SANSU_AUTHORED_SHOULDER_TIMEOUT_MS ?? 180000);
assert(output && expectedBuild, 'Set fresh SANSU_AUTHORED_SHOULDER_OUTPUT and actual SANSU_AUTHORED_SHOULDER_BUILD');
assert(shapeOnly || coreReportPath, 'Full run requires SANSU_AUTHORED_SHOULDER_CORE_REPORT for this frozen candidate');
assert(Number.isFinite(timeout) && timeout > 0, 'Invalid operation timeout');
const target = new URL(process.env.SANSU_AUTHORED_SHOULDER_URL ?? defaultUrl);
assert.equal(target.pathname, '/prototypes/place-qa/authored.html');
for (const [key, value] of [['water', 'wide'], ['cove', 'corner'], ['shoulder', 'central'], ['ground', 'source']])
    assert.equal(target.searchParams.get(key), value, `Required actual target flag ${key}`);
const sourceDirectory = 'docs/design/2026-10-12-authored-central-shoulder';
for (const directory of ['src', 'public', 'prototypes', 'tools', 'docs'])
    assert(output !== path.resolve(directory) && !output.startsWith(`${path.resolve(directory)}${path.sep}`), 'Output must be outside input directories');
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonSha = value => sha(JSON.stringify(value));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry =>
    entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
async function inputs() {
    const files = new Set([...await walk('src'), ...await walk('public'), ...await walk('prototypes/place-qa'), ...await walk('tools'),
        ...await walk(sourceDirectory), 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.app.json',
        'docs/design/2026-10-10-island-final-3d/whole-island.glb', 'docs/design/2026-10-10-island-final-3d/whole-island.blend',
        'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
        'docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json',
        'docs/design/2026-10-12-authored-cove-entrance/shared-apron-world-patch-v1.json']);
    const profileManifest = await readJson('prototypes/place-qa/authored-shoulder-profile-manifest.json');
    for (const input of Object.values(profileManifest.inputs)) files.add(input.path);
    // Iterating the Set follows newly discovered local import dependencies too.
    for (const file of files) {
        if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) continue;
        const text = await fs.readFile(file, 'utf8');
        for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
            if (!match[1].startsWith('.')) continue;
            const stem = path.normalize(path.join(path.dirname(file), match[1].split('?')[0]));
            for (const suffix of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts']) {
                const file = `${stem}${suffix}`;
                if ((await fs.stat(file).catch(() => null))?.isFile()) { files.add(file); break; }
            }
        }
    }
    return Object.fromEntries(await Promise.all([...files].sort().map(async file => [file, sha(await fs.readFile(file))])));
}
const owners = value => [...value.plots, ...value.landmarks];
const placed = value => owners(value).filter(owner => owner.cell);
const canonical = value => { const copy = structuredClone(value); delete copy.applied; delete copy.placeProgress; return copy; };
const physicalProof = value => { const copy = structuredClone(value); delete copy.poses; return copy; };
const sorted = values => [...values].sort();
const protectedEditState = value => {
    const copy = canonical(value); delete copy.landmarks.find(owner => owner.id === 'l34').cell; return copy;
};
const covePlanView = plan => {
    const { revision, profileRevision, sourceId, sourceSha256, assemblies } = plan;
    return { revision, profileRevision, sourceId, sourceSha256, assemblies };
};
const placeRoles = place => Object.fromEntries(['id', 'ruleId', 'family', 'anchorId', 'memberIds', 'mainIds', 'variant', 'stage', 'waterRefs', 'shadeRefs']
    .map(key => [key, place[key]]));
const purchases = [{ id: 'l33', cell: { x: 6, z: -7 }, form: 'spread' },
    { id: 'l34', cell: { x: 7, z: -6 }, form: 'branch' }, { id: 'l35', cell: { x: 8, z: -6 }, form: 'spire' }];

await fs.mkdir(output, { recursive: false });
const report = { pass: false, shapeOnly, expectedBuild, target: target.href, timeoutMs: timeout,
    scope: 'Real DEV browser: normal three-sapling purchase/diagnostic maturity, then a separate frozen 35-owner source-reference edit/view journey',
    excludes: ['Priced land purchase or expand', 'Personal save', 'Natural 18-hour elapsed-time observation', 'Performance acceptance',
        'Independent art/child acceptance', 'Full body-width or actual-use proof', 'Hardware touch', 'Whole-M1 completion'],
    landContract: 'Two land grants already exist in this explicit diagnostic fixture; 60 drops buys only three saplings.',
    timingScope: 'Operation wall time for diagnosis only, no performance threshold',
    runtime: { node: process.versions.node, platform: process.platform, headless: true },
    scopes: {}, captures: [], steps: [], timings: [], pointers: [], errors: [], resourceResponses: [] };
let browser, context, page, domain, base, shoulder, manifest, coveDelivery, groundManifest, appVersion, currentScope, core;
const installedFiles = new Map();
async function installedDependencies() {
    return Object.fromEntries(await Promise.all([...installedFiles].sort(([a], [b]) => a.localeCompare(b))
        .map(async ([key, file]) => [key, sha(await fs.readFile(file))])));
}
const hostMeta = () => page.locator('[data-authored-island]').evaluate(node => ({ ...node.dataset }));
const metadata = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const state = async () => JSON.parse((await hostMeta()).authoredState);
const history = async () => JSON.parse((await hostMeta()).authoredDiagnosticHistory);
// The domain already bounds immutable projections to three recent states. An
// outer cache would retain evicted worlds throughout this multi-state journey.
// Every browser assertion still reads current telemetry independently.
const frame = value => domain.authoredWorldFrame(value, base, { water: true, cove: true, shoulder });
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => {
    await page.waitForFunction(() => !document.querySelector('.authored-status')
        && document.querySelector('[data-growing-world]')?.dataset.growingCamera
        && document.querySelector('[data-growing-world]')?.dataset.authoredShoulder);
    await paint();
};
async function step(name, operation) {
    report.phase = `${currentScope ?? 'setup'}:${name}`;
    console.log(`authored-shoulder: ${report.phase}`);
    await fs.writeFile(path.join(output, 'progress.json'), JSON.stringify({ phase: report.phase, steps: report.steps, timings: report.timings }, null, 2));
    const start = performance.now(); let success = false;
    try { const value = await operation(); success = true; report.steps.push(report.phase); return value; }
    finally { report.timings.push({ name: report.phase, elapsedMs: performance.now() - start, success }); }
}
async function waitScene(expected, rootIds) {
    const expectedIds = sorted(placed(expected).map(owner => owner.id));
    await page.waitForFunction(({ ids, roots, revision }) => {
        const data = document.querySelector('[data-growing-world]')?.dataset;
        if (!data?.authoredShoulder || !data.authoredObstructionWalking || data.worldRevision !== revision || data.previewWorldRevision) return false;
        const proof = JSON.parse(data.authoredObstructionWalking), shoulder = JSON.parse(data.authoredShoulder);
        return JSON.stringify(proof.ownerAccess.map(owner => owner.id).sort()) === JSON.stringify(ids)
            && JSON.stringify(shoulder.roots.filter(root => !root.prospective && root.visible).map(root => root.ownerId).sort()) === JSON.stringify(roots)
            && shoulder.previewWorldRevision === null;
    }, { ids: expectedIds, roots: sorted(rootIds), revision: frame(expected).revision });
    await ready();
}
async function checkFrame(expected) {
    const current = await state(), host = await hostMeta(), meta = await metadata(), projected = frame(current);
    assert.deepEqual(canonical(current), canonical(expected), 'Canonical state differs');
    assert.equal(host.buildRevision, expectedBuild); assert(host.appVersion?.startsWith(`${expectedBuild}:`));
    if (appVersion) assert.equal(host.appVersion, appVersion, 'The same app build must serve both scopes'); else appVersion = host.appVersion;
    assert.equal(host.visualCandidate, `${shoulder.candidate}+source-shading-v1`);
    assert.equal(host.groundShading, 'source'); assert.equal(host.groundSourceRevision, base.definition.revision);
    assert.equal(meta.artCandidate, shoulder.candidate); assert.equal(meta.nativeGrowingArt, 'true');
    assert.equal(meta.authoredShoulderEnabled, 'true'); assert.equal(meta.authoredCoveEnabled, 'true');
    assert.equal(meta.authoredShoulderSourceId, manifest.source.id); assert.equal(meta.authoredShoulderSource, manifest.source.sha256);
    assert.equal(meta.authoredCoveSourceId, coveDelivery.source.id); assert.equal(meta.authoredCoveSource, coveDelivery.source.sha256);
    assert.equal(host.worldId, projected.world.id); assert.equal(host.worldRevision, projected.revision);
    assert.equal(meta.worldRevision, projected.revision); assert.equal(meta.authoredFrameRevision, `${projected.world.id}:${projected.revision}`);
    assert.deepEqual(JSON.parse(meta.authoredCove), covePlanView(projected.covePlan));
    assert.deepEqual(JSON.parse(meta.authoredWater), projected.waterPlan);
    const reference = JSON.parse(host.referenceSource);
    assert.equal(reference.stage, 'mature'); assert.equal(reference.sha256, sha(await fs.readFile(reference.path)));
    const s = JSON.parse(meta.authoredShoulder);
    assert.equal(s.candidate, shoulder.candidate); assert.equal(s.profilePhysicalRevision, shoulder.physicalRevision); assert.equal(s.soilPresent, true);
    for (const root of s.roots) { assert.equal(root.sourceSha256, manifest.source.sha256); assert.equal(root.artifactSha256, manifest.artifact.expandedSha256); }
    const rights = domain.landCells(current, projected.world); assert.equal(rights.length, 75);
    for (const cell of [{ x: 7, z: -6 }, { x: 8, z: -6 }]) assert(rights.some(right => domain.key(right) === domain.key(cell)));
    assert.equal(meta.authoredObstructionWalking, meta.authoredFlowerWalking);
    const proof = JSON.parse(meta.authoredObstructionWalking);
    assert.equal(proof.coveCount, 1); assert.equal(proof.stockCount, 4); assert(proof.groveCount > 0 && proof.triangles > 0);
    assert.deepEqual(sorted(proof.ownerAccess.map(owner => owner.id)), sorted(placed(current).map(owner => owner.id)));
    assert.deepEqual(proof.ownerAccess.filter(owner => !owner.reachable), [], 'Every current owner needs an actual guarded approach');
    return { current, host, meta, projected, shoulder: s, proof, rights, reference };
}
const waitForPoses = () => page.waitForFunction(() => {
    const text = document.querySelector('[data-growing-world]')?.dataset.authoredFlowerPoses;
    return text && JSON.parse(text)?.checked > 0;
});
async function checkSettled(expected, rootIds) {
    await waitScene(expected, rootIds); await waitForPoses();
    const checked = await checkFrame(expected);
    assert.deepEqual(sorted(checked.shoulder.roots.map(root => root.ownerId)), sorted(rootIds));
    assert(checked.shoulder.roots.every(root => !root.prospective && root.visible && !root.retainedPhysical));
    return checked;
}
async function capture(name, expected, { preview = false } = {}) {
    if (!preview) await waitForPoses();
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
    const checked = await checkFrame(expected), poses = JSON.parse(checked.meta.authoredFlowerPoses ?? 'null');
    assert(poses?.checked > 0, 'Require actual placed-pose checks'); assert.equal(poses.unplaced, 0);
    const file = `${currentScope}-${name}.png`, destination = path.join(output, file);
    assert(!(await fs.stat(destination).catch(() => null)), 'Never overwrite a capture');
    await page.screenshot({ path: destination, scale: 'css' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
    report.captures.push({ file, sha256: sha(await fs.readFile(destination)), scope: currentScope, url: page.url(), viewport: page.viewportSize(),
        reducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), build: expectedBuild, appVersion,
        host: checked.host, metadata: checked.meta, poses, physical: checked.proof, rights: checked.rights, reference: checked.reference });
    return checked;
}
async function whole() {
    const previous = await page.locator('[data-growing-world]').elementHandle(); assert(previous);
    await page.getByRole('button', { name: '全景', exact: true }).click();
    await page.waitForFunction(node => !node.isConnected, previous); await ready(); await waitForPoses();
    assert.equal((await metadata()).growingFocus, undefined);
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
}
async function select(id) {
    const button = page.locator(`[data-owner-id="${id}"]`); await button.scrollIntoViewIfNeeded(); await button.click();
    await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingFocus === id, id);
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
}
async function tapCell(cell) {
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
    const current = await state(), projected = frame(current), floor = projected.world.floorAt(cell); assert(floor, 'Composed source-shaded shoulder floor required');
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const pose = JSON.parse((await metadata()).growingCamera), camera = new T.OrthographicCamera();
    camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.projectionMatrix.fromArray(pose.projectionMatrix); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const point = new T.Vector3(floor.point.x - pose.center, floor.point.y, floor.point.z - 2).project(camera);
    assert(Math.abs(point.x) < .98 && Math.abs(point.y) < .98 && Math.abs(point.z) <= 1, 'Target must be inside actual camera');
    const pointer = { x: box.x + (point.x + 1) * box.width / 2, y: box.y + (1 - point.y) * box.height / 2 };
    assert(pointer.x >= 0 && pointer.x < page.viewportSize().width && pointer.y >= 0 && pointer.y < page.viewportSize().height);
    report.pointers.push({ scope: currentScope, cell, floor: floor.point, frameRevision: projected.revision, pointer, camera: pose });
    await page.mouse.click(pointer.x, pointer.y);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'ここにおく' && !button.disabled));
    await paint();
}
async function previewCheck(canonicalState, future, expectedRoots, committedHidden, prospectiveIds, beforeProof) {
    const revision = frame(future).revision;
    const terrainPreviewRevision = revision === frame(canonicalState).revision ? null : revision;
    await page.waitForFunction(({ revision, committed, prospective, hidden }) => {
        const data = document.querySelector('[data-growing-world]')?.dataset;
        if (!data?.authoredShoulder || (data.previewWorldRevision ?? null) !== revision) return false;
        const value = JSON.parse(data.authoredShoulder), roots = value.roots;
        return value.previewWorldRevision === revision
            && JSON.stringify(roots.filter(root => !root.prospective).map(root => root.ownerId).sort()) === JSON.stringify(committed)
            && JSON.stringify(roots.filter(root => root.prospective).map(root => root.ownerId).sort()) === JSON.stringify(prospective)
            && roots.filter(root => !root.prospective).every(root => root.visible === !hidden.includes(root.ownerId));
    }, { revision: terrainPreviewRevision, committed: sorted(expectedRoots), prospective: sorted(prospectiveIds), hidden: committedHidden });
    const checked = await checkFrame(canonicalState), roots = checked.shoulder.roots;
    assert.deepEqual(sorted(roots.filter(root => !root.prospective).map(root => root.ownerId)), sorted(expectedRoots));
    for (const root of roots.filter(root => !root.prospective)) {
        assert.equal(root.visible, !committedHidden.includes(root.ownerId));
        assert.equal(root.retainedPhysical, committedHidden.includes(root.ownerId));
    }
    assert.deepEqual(sorted(roots.filter(root => root.prospective).map(root => root.ownerId)), sorted(prospectiveIds));
    assert(roots.filter(root => root.prospective).every(root => root.visible && !root.retainedPhysical));
    assert.deepEqual(physicalProof(checked.proof), beforeProof, 'Ghost must retain committed guard and must not add prospective guard');
    return { revision, terrainPreviewRevision, roots, committedGuardUnchanged: true, prospectiveExcludedFromGuard: true };
}
async function loadScope(name, reference, grow) {
    currentScope = name; await context?.close();
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); page = await context.newPage();
    page.setDefaultTimeout(timeout); page.setDefaultNavigationTimeout(timeout);
    page.on('pageerror', error => report.errors.push({ scope: name, error: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ scope: name, error: message.text() }); });
    page.on('response', response => { if (/\/(?:native|authored)-.*\.(?:gz|json)(?:\?|$)/.test(response.url()))
        report.resourceResponses.push({ scope: name, url: response.url(), status: response.status() }); });
    const url = new URL(target); url.searchParams.set('reference', reference);
    if (grow) url.searchParams.set('grow', '1'); else url.searchParams.delete('grow');
    report.scopes[name] = { pass: false, reference, grow, target: url.href };
    await step('load', async () => { await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready(); });
    assert.equal(page.url(), url.href); assert.equal((await hostMeta()).growthDiagnostic, String(grow));
    const sw = await page.evaluate(async () => ({ controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
        registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope) : [] }));
    assert.equal(sw.controller, null); assert.deepEqual(sw.registrations, []);
    report.scopes[name].serviceWorker = { ...sw, scope: 'Fresh DEV context, no service worker; no production PWA claim' };
    assert.deepEqual(await history(), []);
}
function preserveOwnersAndPlaces(current, original, oldPlaces) {
    for (const owner of owners(original)) assert.deepEqual(owners(current).find(next => next.id === owner.id), owner, `Original ${owner.id} unchanged`);
    for (const key of ['land', 'town', 'plots', 'villagers', 'learned', 'keepsakes', 'arrivals', 'unopened', 'seed', 'rules', 'enrolledAt'])
        assert.deepEqual(current[key], original[key], `Original ${key} unchanged`);
    const places = domain.derivePlaces(current, frame(current).world);
    for (const before of oldPlaces) {
        const after = places.find(place => place.id === before.id); assert(after, `Original place ${before.id} retained`);
        assert.deepEqual(placeRoles(after), placeRoles(before), `Original place ownership/variant/stage ${before.id}`);
    }
    assert.equal(current.plots.filter(owner => owner.kind === 'home').length, 8);
}
async function acquisition() {
    await loadScope('acquisition', 'preflight32', true);
    const baseline = await state(), saved = await readJson('prototypes/place-qa/authored-flower-reference-mature.json');
    assert.deepEqual(canonical(baseline), canonical(saved.state)); assert.equal(owners(baseline).length, 32); assert.equal(baseline.nextId, 33);
    const initial = await checkSettled(baseline, []), oldPlaces = domain.derivePlaces(baseline, initial.projected.world);
    const geometryHash = jsonSha(initial.projected.world.definition.districts.map(district => [district.id, district.floors]));
    report.scopes.acquisition.initialState = baseline; report.scopes.acquisition.originalPlaceRoles = oldPlaces.map(placeRoles);
    await capture('initial-32-whole', baseline);
    for (const [index, purchase] of purchases.entries()) await step(`purchase-${purchase.id}`, async () => {
        await whole(); const before = await state(), current = await checkSettled(before, []);
        assert(domain.canPlace(before, purchase.cell, undefined, current.projected.world));
        assert.equal(domain.treeForm(purchase.id), purchase.form); assert.equal(before.nextId, Number(purchase.id.slice(1)));
        await page.locator('[data-purchase-kind="sapling"]').click(); await tapCell(purchase.cell);
        const future = domain.previewGrowingState(before, { kind: 'sapling', seed: false, style: 'plain', prospectiveOwnerId: purchase.id,
            cell: purchase.cell, allowed: [purchase.cell], valid: true }); assert(future);
        const preview = await previewCheck(before, future, [], [], [], physicalProof(current.proof));
        assert.equal(future.landmarks.find(owner => owner.id === purchase.id).growth, 0);
        await capture(`${purchase.id}-young-preview`, before, { preview: true });
        const command = { type: 'place', kind: 'sapling', cell: purchase.cell };
        const oracle = domain.applyIntent(before, { id: `shoulder-oracle-${purchase.id}`, command }, before.nature.realAt, current.projected.world).state;
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click();
        await page.waitForFunction(id => JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).landmarks.some(owner => owner.id === id), purchase.id);
        const after = await state(); assert.deepEqual(canonical(after), canonical(oracle)); await checkSettled(after, []);
        assert.equal((await metadata()).worldRevision, preview.revision, 'Purchase preview/commit share the same composed frame');
        assert.equal(after.drops, before.drops - 20); assert.equal(after.nextId, before.nextId + 1); assert.deepEqual(after.nature, baseline.nature);
        preserveOwnersAndPlaces(after, baseline, oldPlaces);
        const records = await history(); assert.equal(records.length, index + 1); assert.deepEqual(records[index].command, command);
        assert.deepEqual(records[index].before, { drops: before.drops, nextId: before.nextId, nature: before.nature.hours });
        assert.deepEqual(records[index].after, { drops: after.drops, nextId: after.nextId, nature: after.nature.hours });
        assert.equal(jsonSha(frame(after).world.definition.districts.map(district => [district.id, district.floors])), geometryHash, 'Tree purchase cannot replace land');
    });
    const young = await state(); assert.equal(owners(young).length, 35); assert.equal(young.drops, baseline.drops - 60);
    assert(purchases.every(item => young.landmarks.find(owner => owner.id === item.id).growth === 0));
    await whole(); await capture('young-35-whole', young);
    await step('explicit-diagnostic-18h', async () => {
        const expected = structuredClone(young), now = young.nature.realAt + 18 * 3600000;
        const events = domain.advanceNature(expected, now, frame(young).world); domain.syncPlaceMilestones(expected, now, frame(young).world);
        await page.locator('[data-advance-nature="18"]').click();
        await page.waitForFunction(hours => JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).nature.hours === hours, young.nature.hours + 18);
        const mature = await state(); assert.deepEqual(canonical(mature), canonical(expected)); preserveOwnersAndPlaces(mature, baseline, oldPlaces);
        await checkSettled(mature, purchases.map(item => item.id));
        assert.equal(mature.drops, baseline.drops - 60); assert.equal(mature.nextId, 36); assert.equal(mature.nature.realAt, now);
        for (const item of purchases) { const owner = mature.landmarks.find(owner => owner.id === item.id); assert.equal(owner.growth, 18); assert(owner.maturedAt > young.nature.hours && owner.maturedAt <= mature.nature.hours); }
        const records = await history(); assert.equal(records.length, 4);
        assert.deepEqual(records[3], { command: { type: 'diagnostic-nature', hours: 18 }, at: now,
            before: { nature: young.nature.hours }, after: { nature: mature.nature.hours }, events });
        await whole(); await capture('mature-35-whole', mature);
        report.scopes.acquisition.finalState = mature; report.scopes.acquisition.history = records;
        report.scopes.acquisition.paidDrops = 60; report.scopes.acquisition.rights = 75;
    });
    report.scopes.acquisition.pass = true;
}
async function fixedEdits(baseline) {
    const original = baseline.landmarks.find(owner => owner.id === 'l34'); assert(original?.cell);
    const target = { x: 12, z: -9 }, expectedRoots = ['l33', 'l34', 'l35'], remainingRoots = ['l33', 'l35'];
    const immutable = protectedEditState(baseline), initial = frame(baseline), rights = domain.landCells(baseline, initial.world);
    const floorsAndEdges = value => jsonSha([frame(value).world.definition.districts.map(d => [d.id, d.floors]), frame(value).world.definition.edges]);
    const floorHash = floorsAndEdges(baseline), edits = report.scopes.fixed35.edits = [];
    const future = structuredClone(baseline); future.landmarks.find(owner => owner.id === 'l34').cell = target;
    assert(domain.canPlace(baseline, target, original.id, initial.world));
    const reached = domain.reachableFromHome(future, undefined, frame(future).world);
    assert(placed(future).every(owner => domain.approachCells(owner.cell, frame(future).world).some(cell => reached.has(domain.key(cell)))));
    await select('l34'); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await whole();
    let committed = await checkFrame(baseline); await tapCell(target);
    let preview = await previewCheck(baseline, future, expectedRoots, ['l34'], [], physicalProof(committed.proof));
    await capture('l34-move-preview', baseline, { preview: true }); edits.push({ action: 'preview-move', target, ...preview });
    await page.getByRole('button', { name: 'やめる', exact: true }).click();
    await checkSettled(baseline, expectedRoots); assert.deepEqual(await history(), []); await capture('l34-cancelled', baseline);
    await page.getByRole('button', { name: 'うごかす', exact: true }).click(); committed = await checkFrame(baseline); await tapCell(target);
    preview = await previewCheck(baseline, future, expectedRoots, ['l34'], [], physicalProof(committed.proof));
    await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await waitScene(future, remainingRoots);
    const moved = await state(); assert.deepEqual(moved.landmarks.find(owner => owner.id === 'l34'), { ...original, cell: target });
    assert.deepEqual(protectedEditState(moved), immutable); await checkSettled(moved, remainingRoots);
    assert.equal((await metadata()).worldRevision, preview.revision); assert.equal(floorsAndEdges(moved), floorHash);
    assert.deepEqual(domain.landCells(moved, frame(moved).world), rights); await capture('l34-moved', moved);
    edits.push({ action: 'move', target, previewRevision: preview.revision, committedRevision: (await metadata()).worldRevision, roots: remainingRoots });
    await page.getByRole('button', { name: 'しまう', exact: true }).click();
    await page.waitForFunction(() => !JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).landmarks.find(owner => owner.id === 'l34').cell);
    const stored = await state(); assert.deepEqual(protectedEditState(stored), immutable); await checkSettled(stored, remainingRoots);
    assert.equal(floorsAndEdges(stored), floorHash); assert.deepEqual(domain.landCells(stored, frame(stored).world), rights);
    await capture('l34-stored-land-retained', stored); edits.push({ action: 'store', rights: 75, roots: remainingRoots });
    await page.getByRole('button', { name: 'おく', exact: true }).click(); await whole(); committed = await checkFrame(stored);
    await tapCell(original.cell);
    // Returning to the baseline also preserves its field order. JSON omits the
    // stored undefined cell key; rebuilding that opaque frame from parsed state
    // by appending cell would predict a different fingerprint for equal values.
    preview = await previewCheck(stored, baseline, remainingRoots, [], ['l34'], physicalProof(committed.proof));
    await capture('l34-restore-preview-no-future-guard', stored, { preview: true });
    await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await waitScene(baseline, expectedRoots);
    const restored = await state(); assert.deepEqual(canonical(restored), canonical(baseline)); await checkSettled(restored, expectedRoots);
    assert.equal((await metadata()).worldRevision, preview.revision); assert.equal(preview.revision, initial.revision);
    assert.equal(floorsAndEdges(restored), floorHash); assert.deepEqual(domain.landCells(restored, frame(restored).world), rights);
    const records = await history(); assert.deepEqual(records.map(record => record.command), [
        { type: 'move', id: 'l34', cell: target }, { type: 'store', id: 'l34' }, { type: 'unstore', id: 'l34', cell: original.cell }]);
    await whole(); await capture('l34-restored-whole', restored);
    edits.push({ action: 'restore', target: original.cell, roots: expectedRoots, revision: preview.revision });
    report.scopes.fixed35.history = records;
}
async function fixedReference() {
    await loadScope('fixed35', 'shoulder35', false);
    const baseline = await state(), saved = await readJson('prototypes/place-qa/authored-shoulder-reference-mature.json');
    assert.deepEqual(canonical(baseline), canonical(saved.state)); assert.equal(owners(baseline).length, 35);
    assert.equal(baseline.plots.filter(owner => owner.kind === 'home').length, 8);
    for (const item of purchases) assert.deepEqual(baseline.landmarks.find(owner => owner.id === item.id).cell, item.cell);
    await checkSettled(baseline, purchases.map(item => item.id)); report.scopes.fixed35.initialState = baseline;
    await step('desktop-whole-and-close', async () => {
        await capture('desktop-whole-day', baseline); await select('l34'); await capture('desktop-hill-close-day', baseline);
    });
    if (!shapeOnly) {
        await step('l34-cancel-move-store-restore', () => fixedEdits(baseline));
        await step('desktop-rotated', async () => {
            await whole(); await page.getByRole('button', { name: '右へ回す', exact: true }).click(); await paint();
            await capture('desktop-rotated-whole-day', baseline); await select('l34'); await capture('desktop-rotated-hill-close-day', baseline);
            await page.getByRole('button', { name: '左へ回す', exact: true }).click(); await paint();
        });
        for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet', { width: 768, height: 1024 }, 'reduce']])
            await step(`${name}-whole-close`, async () => {
                await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion }); await whole();
                await capture(`${name}-whole-day`, baseline); await select('l34'); await capture(`${name}-hill-close-day`, baseline);
            });
    }
    await checkSettled(baseline, purchases.map(item => item.id)); report.scopes.fixed35.finalState = await state();
    report.scopes.fixed35.pass = true;
}

try {
    report.initialInputs = await inputs(); report.initialInputHash = jsonSha(report.initialInputs);
    if (coreReportPath) {
        core = await readJson(coreReportPath);
        assert.equal(core.pass, true); assert.equal(core.sourceFixed, true); assert.equal(core.revision, expectedBuild);
        assert.equal(await fs.realpath(core.target), await fs.realpath(process.cwd()));
        assert.deepEqual(core.initialInputs, core.finalInputs, 'Core source changed');
        for (const [file, hash] of Object.entries(report.initialInputs)) assert.equal(core.finalInputs[file], hash, `Core/browser input mismatch: ${file}`);
        report.core = { path: path.resolve(coreReportPath), sha256: sha(await fs.readFile(coreReportPath)), revision: core.revision,
            target: core.target, inputSubsetCount: Object.keys(report.initialInputs).length, sameFrozenInputs: true };
    }
    manifest = await readJson('prototypes/place-qa/native-shoulder-manifest.json');
    const profileManifest = await readJson('prototypes/place-qa/authored-shoulder-profile-manifest.json');
    coveDelivery = await readJson('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
    groundManifest = await readJson('prototypes/place-qa/native05-world-source-shading-manifest.json');
    async function decode(artifact, file = artifact.path?.replace(/^\//, '')) {
        assert(file, 'Delivery artifact requires an explicit actual path');
        const compressed = await fs.readFile(file); assert.equal(sha(compressed), artifact.sha256);
        assert.equal(compressed.length, artifact.gzipBytes ?? artifact.bytes);
        const expanded = gunzipSync(compressed); assert.equal(sha(expanded), artifact.expandedSha256);
        assert.equal(expanded.length, artifact.expandedBytes); return expanded;
    }
    const ground = JSON.parse(await decode(groundManifest.artifact, 'prototypes/place-qa/native05-world-source-shading.json.gz')); shoulder = JSON.parse(await decode(profileManifest.artifact));
    await decode(manifest.artifact);
    assert.equal(report.initialInputs[manifest.source.artifact], manifest.source.sha256, 'Frozen original shoulder source matches delivery');
    assert.equal(report.initialInputs[groundManifest.source.artifact], groundManifest.source.sha256);
    for (const input of Object.values(profileManifest.inputs))
        assert.equal(report.initialInputs[input.path], input.sha256, `Profile source provenance: ${input.path}`);
    for (const [file, hash] of Object.entries(manifest.inputs))
        assert.equal(report.initialInputs[`${sourceDirectory}/${file}`], hash, `Kit source provenance: ${file}`);
    assert.equal(shoulder.candidate, manifest.source.id); assert.equal(shoulder.source.componentSha256, manifest.source.sha256);
    report.candidate = shoulder.candidate; report.hostCandidate = `${shoulder.candidate}+source-shading-v1`;
    report.delivery = { manifest, profile: profileManifest, ground: groundManifest };
    await step('compile-read-only-domain-projection', async () => {
        const compiled = await build({ stdin: { contents: `
            export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
            export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
            export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts';
            export { applyIntent, canPlace } from './src/domain/growingIsland/commands.ts';
            export { advanceNature } from './src/domain/growingIsland/nature.ts';
            export { syncPlaceMilestones } from './src/domain/growingIsland/placeGoals.ts';
            export { derivePlaces } from './src/domain/growingIsland/places.ts';
            export { key, landCells, reachableFromHome, approachCells } from './src/domain/growingIsland/space.ts';
            export { previewGrowingState } from './src/components/island/growing/objectLayer.ts';
            export { treeForm } from './src/components/island/growing/treeSilhouettes.ts';
        `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
        const moduleRoot = await fs.realpath('node_modules');
        const localByRealPath = new Map(await Promise.all(Object.keys(report.initialInputs).map(async file => [await fs.realpath(file), file])));
        report.domainInputs = []; report.domainDependencyResolution = {};
        for (const file of Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>').sort()) {
            const real = await fs.realpath(path.resolve(file)), relative = path.relative(moduleRoot, real);
            if (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
                const key = `node_modules/${relative.split(path.sep).join('/')}`;
                installedFiles.set(key, real); report.domainDependencyResolution[file] = key;
            } else {
                const local = localByRealPath.get(real); assert(local, `Domain input outside local/dependency closure: ${file}`);
                report.domainInputs.push(local); report.domainDependencyResolution[file] = local;
            }
        }
        installedFiles.set('node_modules/.package-lock.json', path.join(moduleRoot, '.package-lock.json'));
        report.initialInstalledDependencies = await installedDependencies();
        if (core) {
            assert.deepEqual(core.initialInstalledDependencies, core.finalInstalledDependencies, 'Core installed dependencies changed');
            for (const [file, hash] of Object.entries(report.initialInstalledDependencies))
                assert.equal(core.finalInstalledDependencies?.[file], hash, `Core/browser installed dependency mismatch: ${file}`);
            report.core.sameInstalledProjectionDependencies = true;
        }
        report.installedDependencyScope = 'Bundled projection dependencies and installed .package-lock; separate from frozen local source subset';
        report.domainBundleHash = sha(compiled.outputFiles[0].text);
        domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
        base = domain.withNative05WaterCarvingScope(domain.compileWorldDefinition(ground));
        assert.equal(base.sites.filter(site => site.placement).length, 73, 'Immutable base before diagnostic shoulder grants');
    });
    browser = await chromium.launch({ headless: true }); report.runtime.browser = await browser.version();
    if (!shapeOnly) await acquisition();
    await fixedReference();
    assert.deepEqual(report.errors, []); assert(report.resourceResponses.every(resource => resource.status === 200));
    report.finalInputs = await inputs(); report.finalInputHash = jsonSha(report.finalInputs);
    assert.deepEqual(report.finalInputs, report.initialInputs, 'Frozen application/source/artifact input changed');
    if (coreReportPath) assert.equal(sha(await fs.readFile(coreReportPath)), report.core.sha256, 'Core report changed');
    report.finalInstalledDependencies = await installedDependencies();
    assert.deepEqual(report.finalInstalledDependencies, report.initialInstalledDependencies, 'Installed projection dependencies changed');
    report.installedDependenciesUnchanged = true; report.sourceClosureUnchanged = true; report.pass = true;
} catch (error) {
    report.firstFailure = { phase: report.phase ?? 'input-closure', error: error.stack ?? String(error), captures: report.captures.length, steps: report.steps.length };
    if (page) {
        report.failureMetadata = await metadata().catch(() => null); report.failureHost = await hostMeta().catch(() => null);
        report.failureState = await state().catch(() => null); report.failureHistory = await history().catch(() => null);
        await page.screenshot({ path: path.join(output, 'first-failure.png'), scale: 'css' }).catch(error => { report.failureScreenshotError = String(error); });
    }
    process.exitCode = 1;
} finally {
    if (report.initialInstalledDependencies && !report.finalInstalledDependencies) {
        try { report.finalInstalledDependencies = await installedDependencies();
            report.installedDependenciesUnchanged = jsonSha(report.initialInstalledDependencies) === jsonSha(report.finalInstalledDependencies); }
        catch (error) { report.finalInstalledDependencyError = String(error); }
    }
    if (!report.finalInputs) {
        try { report.finalInputs = await inputs(); report.finalInputHash = jsonSha(report.finalInputs);
            report.sourceClosureUnchanged = report.initialInputHash === report.finalInputHash; }
        catch (error) { report.finalInputError = String(error); }
    }
    await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser?.close();
}
console.log(JSON.stringify({ pass: report.pass, shapeOnly, scopes: Object.fromEntries(Object.entries(report.scopes).map(([name, value]) => [name, value.pass])),
    captures: report.captures.length, steps: report.steps, sourceClosureUnchanged: report.sourceClosureUnchanged, error: report.firstFailure?.error, output }));
