import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

// Only real DEV controls and canvas pointers mutate the scene. The initial
// mature 35-owner reference is diagnostic, not an acquisition or clock journey.
const output = process.env.SANSU_CORE_GROWTH_OUTPUT;
const revision = process.env.SANSU_CORE_GROWTH_BUILD;
const corePath = process.env.SANSU_CORE_GROWTH_CORE_REPORT;
assert(output && revision && corePath, 'Set a fresh output directory, build revision and completed core report');
const target = new URL(process.env.SANSU_CORE_GROWTH_URL ?? 'http://127.0.0.1:5367/prototypes/place-qa/authored.html?art=whole&terrain=core');
assert.equal(target.pathname, '/prototypes/place-qa/authored.html');
assert.equal(target.searchParams.get('art'), 'whole');
assert.equal(target.searchParams.get('terrain'), 'core');
assert.equal(target.searchParams.has('districts'), false, 'This journey must not enable diagnostic acquisitions');
mkdirSync(output, { recursive: false });
const manifestPath = 'prototypes/place-qa/authored-core-growth-terrain-manifest.json';
const referencePath = 'prototypes/place-qa/authored-shoulder-reference-mature.json';
const baseManifestPath = 'prototypes/place-qa/native05-world-source-shading-manifest.json';
const baseArtifactPath = 'prototypes/place-qa/native05-world-source-shading.json.gz';
const originalTreeCells = [{ x: 3, z: -9 }, { x: 4, z: -9 }, { x: 3, z: -8 }, { x: 4, z: -8 }];
const benchFrom = { x: 12, z: -4 }, benchTo = { x: 7, z: -3 };
const spareHomeCells = [{ x: 3, z: -7 }, { x: 3, z: -2 }, { x: 4, z: -1 }];
const expectedCases = { north: { sockets: ['north'], connections: 0 }, east: { sockets: ['east'], connections: 0 },
    loop: { sockets: ['east', 'north'], connections: 1 } };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => sha(JSON.stringify(value));
const owners = state => [...state.plots, ...state.landmarks];
const sameCell = (a, b) => a?.x === b?.x && a?.z === b?.z;
const cellKey = cell => `${cell.x},${cell.z}`;
const launchOptions = { executablePath: chromium.executablePath(), headless: true, args: ['--use-angle=metal'] };
const report = { pass: false, sourceFixed: false, target: target.href, revision, launchOptions,
    scope: 'Same four existing mature saplings and same eight existing homes in the diagnostic 35-owner island; one recorded bench move before the invariant baseline, then three tree/home/coast arrangements, separation and restoration through visible controls and canvas pointers',
    excludes: ['district or item acquisition', 'personal save', 'natural time observation or clock advance', 'offline/update',
        'actor traversal/use acceptance', 'whole-island art acceptance', 'performance/device acceptance'],
    timingScope: 'Wall time for UI, rendering, assertions and capture; not device latency or FPS',
    steps: [], captures: [], checkpoints: [], pointers: [], errors: [] };
let core, initial, catalog, localWorld, reference, maturityHours, parentDistrictId, browser, page, cases, loopConnection;
let originalOwners, sceneIdentity, matureInvariant, ids = [], homeIds = [], movableIds = [];
const fingerprints = () => Object.fromEntries(Object.keys(core.finalInputs).sort().map(file => [file, sha(readFileSync(file))]));
const requireCoreFile = file => assert(Object.keys(core.finalInputs).some(input => path.resolve(input) === path.resolve(file)), `Core fingerprint must include ${file}`);
const host = () => page.locator('[data-authored-island]').evaluate(node => ({ ...node.dataset }));
const state = async () => JSON.parse((await host()).authoredState);
const plan = async () => JSON.parse((await host()).growthTerrainPlan);
async function ready() {
    await page.waitForFunction(() => {
        const h = document.querySelector('[data-authored-island]')?.dataset, w = document.querySelector('[data-growing-world]')?.dataset;
        return !document.querySelector('.authored-status') && h?.growthTerrainPlan && w?.growingCamera && w.worldRevision === h.worldRevision;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await plan()).rejectedReason, undefined, 'Core growth must not silently fall back to the original island');
}
async function step(name, fn) {
    report.phase = name;
    writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase: name, steps: report.steps, at: new Date().toISOString() }, null, 2));
    console.log(name); const start = Date.now(); await fn(); report.steps.push({ name, elapsedMs: Date.now() - start });
}
async function click(locator) { await locator.scrollIntoViewIfNeeded(); await locator.click(); }
function stableState(current, movable = movableIds) {
    // Placement may update soil, receipts and derived places. Every owner's
    // other field, plus clocks, resources and the original land, must stay fixed.
    return { owners: owners(current).map(item => {
        const copy = structuredClone(item); if (movable.includes(copy.id)) delete copy.cell; return copy;
    }), land: current.land, bridge: current.bridge, keepsakes: current.keepsakes, villagers: current.villagers,
    seed: current.seed, rules: current.rules, nature: current.nature, town: current.town, drops: current.drops,
    nextId: current.nextId, unlocked: current.unlocked, learned: current.learned, mastery: current.mastery };
}
async function checkInvariants() {
    const h = await host(), current = JSON.parse(h.authoredState);
    assert.equal(h.buildRevision, revision); assert.equal(h.growthTerrainMode, 'core');
    assert.equal(h.growthTerrainCandidate, catalog.candidate); assert.equal(h.groundShading, 'source');
    assert.equal(h.districtsEnabled, 'false');
    assert.deepEqual(JSON.parse(h.districtGrants), [], 'The original core requires no district acquisition');
    assert.equal(JSON.parse(h.districtPreview), null);
    assert.equal(owners(current).length, 35); assert.equal(current.plots.filter(item => item.kind === 'home').length, 8);
    if (sceneIdentity) for (const [field, value] of Object.entries(sceneIdentity)) assert.equal(h[field], value, `${field} must remain fixed`);
    if (matureInvariant) assert.deepEqual(stableState(current), matureInvariant, 'Only the four existing sapling and eight existing home cells may change after preparation');
    return { h, current };
}
async function graphics() {
    return page.locator('[data-growing-world] canvas').evaluate(canvas => {
        const gl = canvas.getContext('webgl2');
        if (!gl) return { webgl2: false, dataset: { ...canvas.dataset } };
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { webgl2: true, contextLost: gl.isContextLost(), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
            unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null,
            unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
            version: gl.getParameter(gl.VERSION), attributes: gl.getContextAttributes(), dataset: { ...canvas.dataset } };
    });
}
function checkGraphics(actual) {
    assert.equal(actual.webgl2, true); assert.equal(actual.contextLost, false);
    assert.match(actual.unmaskedRenderer ?? '', /ANGLE Metal Renderer: Apple M4/, 'This run requires the verified Apple M4 Metal renderer; no software fallback');
    assert.doesNotMatch(actual.unmaskedRenderer, /swiftshader|llvmpipe|software/i);
}
async function checkpoint(name, screenshot = false) {
    await ready(); await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
    const { h, current } = await checkInvariants();
    const renderer = await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
    assert.equal(renderer.worldRevision, h.worldRevision); assert.equal(renderer.authoredGrowthTerrainCandidate, catalog.candidate);
    const gpu = await graphics();
    const record = { name, viewport: page.viewportSize(), host: h, renderer, graphics: gpu,
        ownershipHash: digest(stableState(current)), plan: JSON.parse(h.growthTerrainPlan) };
    report.checkpoints.push(record); checkGraphics(gpu);
    if (screenshot) {
        await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
        report.captures.push({ ...record, file: `${name}.png` });
    }
    return record;
}
async function full(name) { await click(page.getByRole('button', { name: '全景', exact: true })); return checkpoint(name, true); }
async function tap(cell) {
    const canvas = page.locator('[data-growing-world] canvas'); await canvas.scrollIntoViewIfNeeded();
    const floor = localWorld.floorAt(cell); assert(floor && localWorld.owns(cell), 'Pointer must target an original owned core floor');
    const physical = floor.point;
    const project = async () => {
        const pose = await page.locator('[data-growing-world]').evaluate(node => JSON.parse(node.dataset.growingCamera));
        const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
        return { pose, screen: new T.Vector3(physical.x - pose.center, physical.y, physical.z - 2).project(camera) };
    };
    let projected = await project(), resetView = false;
    const visible = ({ screen }) => screen.x >= -.95 && screen.x <= .95 && screen.y >= -.95 && screen.y <= .95;
    if (!visible(projected)) {
        // Selecting an old western owner zooms to it. Use the existing full view
        // control to reach the distant coast, never write a camera or owner pose.
        await click(page.getByRole('button', { name: '全景', exact: true })); await ready();
        await canvas.scrollIntoViewIfNeeded(); projected = await project(); resetView = true;
    }
    assert(visible(projected), 'Actual core anchor must be visible before tapping');
    const box = await canvas.boundingBox(); assert(box);
    const pointer = { x: box.x + (projected.screen.x + 1) * box.width / 2, y: box.y + (1 - projected.screen.y) * box.height / 2 };
    report.pointers.push({ cell, physical, pointer, camera: projected.pose, resetView });
    await page.mouse.click(pointer.x, pointer.y);
}
async function waitOwner(id, cell) {
    await page.waitForFunction(({ id, cell }) => {
        const text = document.querySelector('[data-authored-island]')?.dataset.authoredState;
        const state = text && JSON.parse(text), owner = state && [...state.plots, ...state.landmarks].find(item => item.id === id);
        return Boolean(owner && (cell ? owner.cell?.x === cell.x && owner.cell?.z === cell.z : owner.cell === undefined));
    }, { id, cell });
    await ready(); await checkInvariants();
}
async function choose(id) {
    const buttons = page.locator('[data-owner-id]');
    const index = await buttons.evaluateAll((nodes, value) => nodes.findIndex(node => node.dataset.ownerId === value), id);
    assert(index >= 0, `Owner ${id} remains selectable`); await click(buttons.nth(index));
}
async function storeOwner(id) { await choose(id); await click(page.getByRole('button', { name: 'しまう', exact: true })); await waitOwner(id); }
async function move(id, cell) {
    const placed = owners(await state()).find(item => item.id === id)?.cell;
    await choose(id); await click(page.getByRole('button', { name: placed ? 'うごかす' : 'おく', exact: true }));
    await tap(cell); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const confirm = page.getByRole('button', { name: 'ここにおく', exact: true });
    if (!await confirm.isEnabled()) {
        await click(page.getByRole('button', { name: 'やめる', exact: true })); await ready(); return false;
    }
    await click(confirm); await waitOwner(id, cell); return true;
}
async function checkCase(name) {
    const expected = expectedCases[name], actual = await plan(), current = await state();
    assert.equal(actual.rejectedReason, undefined); assert.equal(actual.catalogRevision, catalog.revision);
    assert.deepEqual(actual.assemblies.map(item => item.socketId).sort(), [...expected.sockets].sort());
    assert.equal(actual.connections.length, expected.connections);
    for (const assembly of actual.assemblies) {
        assert.equal(assembly.id, `${parentDistrictId}:growth-terrain:${assembly.socketId}`); assert.equal(assembly.districtId, parentDistrictId);
        assert.equal(assembly.shape, 'seaward'); assert.deepEqual([...assembly.ownerIds].sort(), [...ids].sort());
    }
    if (expected.connections) {
        const connection = actual.connections[0]; assert.equal(connection.connectionId, loopConnection.id);
        assert.equal(connection.id, `${parentDistrictId}:growth-connection:${loopConnection.id}`); assert.equal(connection.districtId, parentDistrictId);
        assert.deepEqual([...connection.ownerIds].sort(), [...ids].sort());
    }
    for (let i = 0; i < ids.length; i++) assert.deepEqual(current.landmarks.find(item => item.id === ids[i]).cell, cases[name].localCells[i]);
    for (let i = 0; i < homeIds.length; i++) assert.deepEqual(current.plots.find(item => item.id === homeIds[i]).cell, cases[name].homeCells[i]);
    await checkInvariants(); return actual;
}
async function arrange(name) {
    const desired = [...ids.map((id, i) => ({ id, cell: cases[name].localCells[i] })),
        ...homeIds.map((id, i) => ({ id, cell: cases[name].homeCells[i] }))];
    let parkingCursor = 0;
    for (let attempt = 0; attempt < movableIds.length * 2 + 4; attempt++) {
        const all = owners(await state());
        const pending = desired.map(item => ({ ...item, current: all.find(owner => owner.id === item.id)?.cell }))
            .filter(item => !sameCell(item.current, item.cell));
        if (!pending.length) return checkCase(name);
        const free = pending.filter(item => !all.some(owner => owner.id !== item.id && owner.cell && sameCell(owner.cell, item.cell)));
        let moved = false;
        for (const item of free) if (await move(item.id, item.cell)) { moved = true; break; }
        if (!moved) {
            const tree = pending.find(item => ids.includes(item.id));
            if (tree) { assert(tree.current, 'Cycle-breaking tree must be placed'); await storeOwner(tree.id); }
            else {
                const parking = pending[parkingCursor++ % pending.length];
                assert(parking.current, 'Cycle-breaking home must be placed');
                const reserved = new Set(desired.map(item => cellKey(item.cell))), seen = new Set();
                const open = [...spareHomeCells, ...localWorld.sites.filter(site => site.placement
                    && Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)).map(site => site.cell)]
                    .filter(cell => {
                        const key = cellKey(cell);
                        if (seen.has(key) || reserved.has(key)) return false;
                        seen.add(key); return !all.some(owner => owner.cell && sameCell(owner.cell, cell));
                    });
                let parked = false;
                for (const cell of open) if (await move(parking.id, cell)) { parked = true; break; }
                assert(parked, 'Cycle-breaking home needs a reachable spare cell');
            }
        }
    }
    assert.fail('Tree/home rearrangement did not settle within its bounded edit count');
}
try {
    await step('verify-fixed-candidate', async () => {
        core = JSON.parse(readFileSync(corePath)); assert(core.pass && core.sourceFixed && core.revision === revision, 'Frozen candidate core must pass first');
        for (const file of ['tools/e2e-authored-core-growth.mjs', manifestPath, referencePath, baseManifestPath, baseArtifactPath]) requireCoreFile(file);
        initial = fingerprints(); assert.deepEqual(initial, core.finalInputs); report.initialInputs = initial;
        const manifest = JSON.parse(readFileSync(manifestPath)); assert.match(manifest.artifact.path, /^\/prototypes\/place-qa\//);
        const artifactPath = manifest.artifact.path.slice(1); requireCoreFile(artifactPath);
        const compressed = readFileSync(artifactPath), expanded = gunzipSync(compressed);
        assert.equal(sha(compressed), manifest.artifact.sha256); assert.equal(sha(expanded), manifest.artifact.expandedSha256);
        catalog = JSON.parse(expanded); assert.equal(catalog.candidate, manifest.candidate);
        report.candidate = catalog.candidate; report.catalogRevision = catalog.revision; report.manifest = manifest;
        cases = Object.fromEntries(Object.keys(expectedCases).map(name => {
            const authored = manifest.variationCases?.[name]; assert.equal(authored?.localCells?.length, 4, `Authored ${name} requires four cells`);
            assert.equal(authored?.homeCells?.length, 8, `Authored ${name} requires eight home cells`);
            assert(authored.localCells.every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z)));
            assert(authored.homeCells.every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z)));
            assert.equal(new Set([...authored.localCells, ...authored.homeCells].map(cellKey)).size, 12); return [name, authored];
        })); report.cases = cases;
        assert.deepEqual(catalog.profile.sockets.map(socket => socket.id).sort(), ['east', 'north']);
        for (const socket of catalog.profile.sockets) assert.deepEqual((socket.variants ?? catalog.profile.variants).map(variant => variant.id).sort(), ['parallel', 'seaward']);
        const connections = catalog.profile.connections?.filter(connection => connection.branchShape === 'seaward'
            && JSON.stringify([...connection.socketIds].sort()) === JSON.stringify(['east', 'north'])) ?? [];
        assert.equal(connections.length, 1, 'The authored east/north connector must exist exactly once'); loopConnection = connections[0];
        const baseManifest = JSON.parse(readFileSync(baseManifestPath)), baseCompressed = readFileSync(baseArtifactPath), baseExpanded = gunzipSync(baseCompressed);
        assert.equal(sha(baseCompressed), baseManifest.artifact.sha256); assert.equal(sha(baseExpanded), baseManifest.artifact.expandedSha256);
        const base = JSON.parse(baseExpanded), parents = base.districts.filter(district => district.templateId === catalog.template.id);
        assert.equal(parents.length, 1); const parent = parents[0]; parentDistrictId = parent.id;
        assert.equal(parent.turn, 0); assert.deepEqual(parent.logicalOrigin, { x: 0, z: 0 }); assert.deepEqual(parent.worldOrigin, { x: 0, y: 0, z: 0 });
        assert.equal(catalog.source.sha256, base.source.sha256); assert.deepEqual(catalog.template.district.floors, parent.floors);
        report.coreIdentity = { districtId: parentDistrictId, templateId: parent.templateId, logicalOrigin: parent.logicalOrigin,
            worldOrigin: parent.worldOrigin, source: base.source, groundArtifactSha256: sha(baseCompressed) };
        const bundle = await build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { TREE_MATURE_HOURS } from './src/domain/growingIsland/environment.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
        const domain = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
        localWorld = domain.compileWorldDefinition({ version: 1, id: 'core-growth-pointer-projection', source: catalog.source, districts: [catalog.template.district], edges: catalog.template.edges });
        maturityHours = domain.TREE_MATURE_HOURS;
        for (const cell of [benchTo, ...Object.values(cases).flatMap(item => item.localCells)]) assert(localWorld.owns(cell) && localWorld.floorAt(cell), `Existing core must support ${cellKey(cell)}`);
        reference = JSON.parse(readFileSync(referencePath)); assert.equal(reference.synthetic, true); assert.equal(reference.worldId, base.id);
        browser = await chromium.launch(launchOptions); report.browserVersion = browser.version();
        page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(180000);
        page.on('pageerror', error => report.errors.push(String(error)));
    });
    await step('load-existing-mature-island', async () => {
        await page.goto(target.href); await ready(); const { h, current } = await checkInvariants();
        originalOwners = owners(current); assert.deepEqual(originalOwners, owners(reference.state), 'The existing diagnostic reference must be preserved on load');
        ids = originalTreeCells.map(cell => {
            const matches = current.landmarks.filter(item => sameCell(item.cell, cell)); assert.equal(matches.length, 1);
            assert.equal(matches[0].kind, 'sapling'); assert(matches[0].growth >= maturityHours); return matches[0].id;
        }); assert.equal(new Set(ids).size, 4);
        homeIds = current.plots.filter(item => item.kind === 'home').map(item => item.id);
        assert.equal(homeIds.length, 8); assert.equal(new Set(homeIds).size, 8); movableIds = [...ids, ...homeIds];
        sceneIdentity = { districtWorldRevision: h.districtWorldRevision, groundSourceRevision: h.groundSourceRevision, visualCandidate: h.visualCandidate };
        for (const value of Object.values(sceneIdentity)) assert(value, 'The fixed original world needs an explicit identity');
        report.originalOwners = originalOwners; report.existingTreeIds = ids; report.existingHomeIds = homeIds; report.sceneIdentity = sceneIdentity;
        assert.deepEqual((await plan()).assemblies, []); assert.deepEqual((await plan()).connections, []); await full('initial');
    });
    await step('prepare-existing-bench-once', async () => {
        const before = await state(), matches = before.landmarks.filter(item => item.kind === 'bench' && sameCell(item.cell, benchFrom));
        assert.equal(matches.length, 1); assert(!owners(before).some(item => sameCell(item.cell, benchTo)), 'Preparation destination must be vacant');
        const benchId = matches[0].id; assert(await move(benchId, benchTo)); const after = await state();
        assert.deepEqual(stableState(after, [benchId]), stableState(before, [benchId]), 'Preparation may only move the same bench');
        report.preparation = { kind: 'ordinary-ui-move', ownerId: benchId, before: matches[0], after: after.landmarks.find(item => item.id === benchId),
            unchangedStateHash: digest(stableState(after, [benchId])) };
        matureInvariant = stableState(after); report.matureInvariant = matureInvariant; await checkpoint('prepared');
    });
    let north, east, loop;
    await step('same-owners-north', async () => { north = await arrange('north'); await full('north'); });
    await step('same-owners-east', async () => { east = await arrange('east'); assert.notEqual(east.revision, north.revision); await full('east'); });
    await step('same-owners-loop', async () => { loop = await arrange('loop'); assert.notEqual(loop.revision, north.revision); assert.notEqual(loop.revision, east.revision); await full('loop'); });
    const loopWorldRevision = (await host()).worldRevision;
    await step('separate-bridge-tree', async () => {
        await storeOwner(ids[1]); const separated = await plan(); assert.deepEqual(separated.connections, []);
        assert(separated.assemblies.length <= 1, 'Three remaining owners cannot support two independent mature groups');
        for (const assembly of separated.assemblies) {
            assert.equal(assembly.districtId, parentDistrictId); assert(!assembly.ownerIds.includes(ids[1]));
            assert(assembly.ownerIds.length >= 2 && assembly.ownerIds.every(id => ids.includes(id)), 'Any remaining branch belongs only to the same remaining owners');
        }
        const current = await state();
        for (const i of [0, 2, 3]) assert.deepEqual(current.landmarks.find(item => item.id === ids[i]).cell, cases.loop.localCells[i]);
        assert.notEqual(separated.revision, loop.revision); report.separatedPlan = separated; await full('separated');
    });
    await step('reconnect-and-restore-loop', async () => {
        assert(await move(ids[1], cases.loop.localCells[1])); const restored = await checkCase('loop');
        assert.deepEqual(restored, loop); assert.equal((await host()).worldRevision, loopWorldRevision); await full('loop-restored');
    });
    await step('rotate-and-small-screens', async () => {
        await click(page.getByRole('button', { name: '右へ回す', exact: true })); await checkpoint('rotated', true);
        await page.setViewportSize({ width: 390, height: 844 }); await checkpoint('phone', true);
        await page.setViewportSize({ width: 768, height: 1024 }); await checkpoint('tablet', true); await checkCase('loop');
    });
    assert.equal(report.captures.length, 9); assert.deepEqual(report.errors, []); report.pass = true;
} catch (error) {
    report.failure = String(error.stack ?? error); process.exitCode = 1;
    if (page) {
        await page.screenshot({ path: path.join(output, 'failure.png'), scale: 'css' }).catch(() => {});
        report.failureHost = await host().catch(() => null); report.failureGraphics = await graphics().catch(error => ({ error: String(error) }));
    }
} finally {
    try {
        if (initial) { report.finalInputs = fingerprints(); report.sourceFixed = JSON.stringify(report.finalInputs) === JSON.stringify(initial); }
    } catch (error) { report.fingerprintFailure = String(error); }
    if (!report.sourceFixed) { report.pass = false; process.exitCode = 1; }
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(JSON.stringify({ pass: report.pass, phase: report.phase, failure: report.failure, sourceFixed: report.sourceFixed }));
}
