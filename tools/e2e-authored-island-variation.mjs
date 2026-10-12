import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

// Real DEV controls and canvas pointers only. The fixture, district ledger and
// explicit 18-hour diagnostic clock do not prove personal acquisition or saves.
const output = process.env.SANSU_ISLAND_VARIATION_OUTPUT;
const revision = process.env.SANSU_ISLAND_VARIATION_BUILD;
const corePath = process.env.SANSU_ISLAND_VARIATION_CORE_REPORT;
assert(output && revision && corePath, 'Set a fresh output directory, build revision and completed core report');
const target = new URL(process.env.SANSU_ISLAND_VARIATION_URL ?? 'http://127.0.0.1:5366/prototypes/place-qa/authored.html?art=whole&terrain=grove');
assert.equal(target.pathname, '/prototypes/place-qa/authored.html');
assert.equal(target.searchParams.get('art'), 'whole');
assert.equal(target.searchParams.get('terrain'), 'grove');
mkdirSync(output, { recursive: false });
const cases = {
    single: { localCells: [{ x: 1, z: -1 }, { x: 2, z: -1 }, { x: 1, z: 0 }, { x: 2, z: 0 }],
        patches: [{ socket: 'south', owners: [0, 1, 2, 3] }], connections: 0 },
    split: { localCells: [{ x: 1, z: -1 }, { x: 2, z: -1 }, { x: 1, z: 1 }, { x: 2, z: 1 }],
        patches: [{ socket: 'south', owners: [0, 1] }, { socket: 'north', owners: [2, 3] }], connections: 0 },
    loop: { localCells: [{ x: 2, z: -1 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 0 }],
        patches: [{ socket: 'south', owners: [0, 1, 2, 3] }, { socket: 'north', owners: [0, 1, 2, 3] }], connections: 1 },
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => sha(JSON.stringify(value));
const owners = state => [...state.plots, ...state.landmarks];
const sameCell = (a, b) => a?.x === b?.x && a?.z === b?.z;
const rotate = (p, turn) => turn === 1 ? { x: -p.z, z: p.x } : turn === 2 ? { x: -p.x, z: -p.z } : turn === 3 ? { x: p.z, z: -p.x } : p;
const launchOptions = { executablePath: chromium.executablePath(), headless: true, args: ['--use-angle=metal'] };
const report = { pass: false, sourceFixed: false, target: target.href, revision, cases, launchOptions,
    scope: 'Four normally purchased DEV saplings, one diagnostic district and the explicit nature clock; same owners and maturity in three configurations, separation, reconnection and restoration through visible UI and canvas pointers',
    excludes: ['personal land purchase/save', 'offline/update', 'natural time observation', 'actor traversal/use acceptance', 'whole-island art acceptance', 'performance/device acceptance'],
    timingScope: 'Wall time for UI, rendering, assertions and capture; not device latency or FPS',
    steps: [], captures: [], checkpoints: [], pointers: [], errors: [] };
let core, initial, catalog, localWorld, maturityHours, saplingPrice, browser, page, grant, ids = [];
let originalOwners, acquisition, matureInvariant, loopConnection;
const fingerprints = () => Object.fromEntries(Object.keys(core.finalInputs).sort().map(file => [file, sha(readFileSync(file))]));
const host = () => page.locator('[data-authored-island]').evaluate(node => ({ ...node.dataset }));
const state = async () => JSON.parse((await host()).authoredState);
const plan = async () => JSON.parse((await host()).growthTerrainPlan);
const cellFor = cell => { const p = rotate(cell, grant.turn); return { x: p.x + grant.logicalOrigin.x, z: p.z + grant.logicalOrigin.z }; };
async function ready() {
    await page.waitForFunction(() => {
        const h = document.querySelector('[data-authored-island]')?.dataset, w = document.querySelector('[data-growing-world]')?.dataset;
        return !document.querySelector('.authored-status') && h?.growthTerrainPlan && w?.growingCamera && w.worldRevision === h.worldRevision;
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await plan()).rejectedReason, undefined, 'The growth candidate must not silently fall back to the low shore');
}
async function step(name, fn) {
    report.phase = name;
    writeFileSync(path.join(output, 'progress.json'), JSON.stringify({ phase: name, steps: report.steps, at: new Date().toISOString() }, null, 2));
    console.log(name); const start = Date.now(); await fn(); report.steps.push({ name, elapsedMs: Date.now() - start });
}
async function click(locator) { await locator.scrollIntoViewIfNeeded(); await locator.click(); }
function oldOwners(current) {
    const oldIds = new Set(originalOwners.map(item => item.id));
    return owners(current).filter(item => oldIds.has(item.id));
}
function stableState(current) {
    // Receipts, soil and place derivations may react to placement. These explicit
    // fields prove ownership, identity, growth, clocks, resources and old land.
    return { owners: owners(current).map(item => {
        const copy = structuredClone(item); if (ids.includes(copy.id)) delete copy.cell; return copy;
    }), land: current.land, bridge: current.bridge, keepsakes: current.keepsakes, villagers: current.villagers,
    seed: current.seed, rules: current.rules, nature: current.nature, town: current.town, drops: current.drops,
    nextId: current.nextId, unlocked: current.unlocked, learned: current.learned, mastery: current.mastery };
}
async function checkInvariants() {
    const h = await host(), current = JSON.parse(h.authoredState);
    assert.equal(h.buildRevision, revision);
    assert.equal(h.growthTerrainCandidate, catalog.candidate);
    if (acquisition) {
        assert.deepEqual(JSON.parse(h.districtGrants), acquisition.grants, 'Acquired transforms must remain fixed');
        assert.equal(h.districtWorldRevision, acquisition.revision);
        assert.equal(h.groundSourceRevision, acquisition.groundSourceRevision);
        assert.equal(h.visualCandidate, acquisition.visualCandidate);
        assert.deepEqual(current.land, acquisition.land);
    }
    if (matureInvariant) assert.deepEqual(stableState(current), matureInvariant, 'Only the four new owner cells may change');
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
    await ready();
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
    const { h, current } = await checkInvariants();
    const renderer = await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
    assert.equal(renderer.worldRevision, h.worldRevision);
    assert.equal(renderer.authoredGrowthTerrainCandidate, catalog.candidate);
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
async function tap(localCell) {
    const canvas = page.locator('[data-growing-world] canvas'); await canvas.scrollIntoViewIfNeeded();
    const floor = localWorld.floorAt(localCell); assert(floor, 'Pointer must target an original acquired floor');
    const p = rotate(floor.point, grant.turn), physical = { x: p.x + grant.worldOrigin.x, y: floor.point.y + grant.worldOrigin.y, z: p.z + grant.worldOrigin.z };
    const pose = await page.locator('[data-growing-world]').evaluate(node => JSON.parse(node.dataset.growingCamera));
    const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
    const screen = new T.Vector3(physical.x - pose.center, physical.y, physical.z - 2).project(camera), box = await canvas.boundingBox(); assert(box);
    assert(screen.x >= -1 && screen.x <= 1 && screen.y >= -1 && screen.y <= 1, 'Actual acquired anchor must be visible before tapping');
    const pointer = { x: box.x + (screen.x + 1) * box.width / 2, y: box.y + (1 - screen.y) * box.height / 2 };
    report.pointers.push({ localCell, cell: cellFor(localCell), physical, pointer, camera: pose });
    await page.mouse.click(pointer.x, pointer.y);
}
async function waitOwner(id, cell) {
    await page.waitForFunction(({ id, cell }) => {
        const text = document.querySelector('[data-authored-island]')?.dataset.authoredState;
        const owner = text && JSON.parse(text).landmarks.find(item => item.id === id);
        return Boolean(owner && (cell ? owner.cell?.x === cell.x && owner.cell?.z === cell.z : owner.cell === undefined));
    }, { id, cell });
    await ready(); await checkInvariants();
}
async function choose(id) {
    const buttons = page.locator('[data-owner-id]');
    const index = await buttons.evaluateAll((nodes, value) => nodes.findIndex(node => node.dataset.ownerId === value), id);
    assert(index >= 0, `Owner ${id} remains selectable`); await click(buttons.nth(index));
}
async function storeOwner(id) {
    await choose(id); await click(page.getByRole('button', { name: 'しまう', exact: true })); await waitOwner(id);
}
async function move(id, localCell) {
    const placed = (await state()).landmarks.find(item => item.id === id)?.cell;
    await choose(id); await click(page.getByRole('button', { name: placed ? 'うごかす' : 'おく', exact: true }));
    await tap(localCell); await click(page.getByRole('button', { name: 'ここにおく', exact: true })); await waitOwner(id, cellFor(localCell));
}
async function checkCase(name) {
    const expected = cases[name], actual = await plan(), current = await state();
    assert.equal(actual.rejectedReason, undefined); assert.equal(actual.catalogRevision, catalog.revision);
    assert.equal(actual.assemblies.length, expected.patches.length); assert.equal(actual.connections.length, expected.connections);
    for (const patch of expected.patches) {
        const assembly = actual.assemblies.find(item => item.socketId === patch.socket); assert(assembly);
        assert.equal(assembly.id, `${grant.id}:growth-terrain:${patch.socket}`); assert.equal(assembly.districtId, grant.id);
        assert.equal(assembly.shape, 'seaward'); assert.deepEqual([...assembly.ownerIds].sort(), patch.owners.map(i => ids[i]).sort());
    }
    if (expected.connections) {
        const connection = actual.connections[0]; assert.equal(connection.connectionId, loopConnection.id);
        assert.equal(connection.id, `${grant.id}:growth-connection:${loopConnection.id}`); assert.equal(connection.districtId, grant.id);
        assert.deepEqual([...connection.ownerIds].sort(), [...ids].sort());
    }
    for (let i = 0; i < ids.length; i++) assert.deepEqual(current.landmarks.find(item => item.id === ids[i]).cell, cellFor(expected.localCells[i]));
    await checkInvariants(); return actual;
}
async function arrange(name) {
    const desired = cases[name].localCells;
    for (let attempt = 0; attempt < 9; attempt++) {
        const current = await state(), all = owners(current);
        const pending = ids.map((id, i) => ({ id, cell: desired[i], current: all.find(item => item.id === id)?.cell }))
            .filter(item => !sameCell(item.current, cellFor(item.cell)));
        if (!pending.length) return checkCase(name);
        const free = pending.find(item => !all.some(owner => owner.id !== item.id && owner.cell && sameCell(owner.cell, cellFor(item.cell))));
        if (free) await move(free.id, free.cell);
        else { assert(pending[0].current, 'Cycle breaking requires a placed owner'); await storeOwner(pending[0].id); }
    }
    assert.fail('Four-owner rearrangement did not settle within eight edits');
}
try {
    await step('verify-fixed-candidate', async () => {
        core = JSON.parse(readFileSync(corePath)); assert(core.pass && core.sourceFixed && core.revision === revision, 'Frozen candidate core must pass first');
        assert(Object.keys(core.finalInputs).some(file => path.resolve(file) === path.resolve('tools/e2e-authored-island-variation.mjs')), 'Core fingerprint must include this harness');
        initial = fingerprints(); assert.deepEqual(initial, core.finalInputs); report.initialInputs = initial;
        const manifest = JSON.parse(readFileSync('prototypes/place-qa/authored-growth-terrain-manifest.json'));
        const compressed = readFileSync(manifest.artifact.path.replace(/^\//, '')), expanded = gunzipSync(compressed);
        assert.equal(sha(compressed), manifest.artifact.sha256); assert.equal(sha(expanded), manifest.artifact.expandedSha256);
        catalog = JSON.parse(expanded); report.candidate = catalog.candidate; report.catalogRevision = catalog.revision; report.manifest = manifest;
        for (const [name, expected] of Object.entries(cases)) assert.deepEqual(manifest.variationCases?.[name]?.localCells, expected.localCells, `Authored ${name} input must match the fixed journey`);
        const connections = catalog.profile.connections?.filter(connection => connection.branchShape === 'seaward'
            && JSON.stringify([...connection.socketIds].sort()) === JSON.stringify(['north', 'south'])) ?? [];
        assert.equal(connections.length, 1, 'The authored south/north loop connector must exist exactly once'); loopConnection = connections[0];
        const bundle = await build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { TREE_MATURE_HOURS } from './src/domain/growingIsland/environment.ts'; export { LANDMARK_PRICE } from './src/domain/growingIsland/rules.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
        const domain = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
        localWorld = domain.compileWorldDefinition({ version: 1, id: 'variation-pointer-projection', source: catalog.source, districts: [catalog.template.district], edges: catalog.template.edges });
        maturityHours = domain.TREE_MATURE_HOURS; saplingPrice = domain.LANDMARK_PRICE.sapling;
        assert.equal(localWorld.sites.filter(site => site.placement).length, 6, 'All variations share the same six acquired rights');
        browser = await chromium.launch(launchOptions); report.browserVersion = browser.version();
        page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(180000);
        page.on('pageerror', error => report.errors.push(String(error)));
    });
    await step('load', async () => {
        await page.goto(target.href); await ready(); await checkInvariants();
        originalOwners = owners(await state()); assert.equal(originalOwners.length, 35, 'This journey starts with the existing 35-owner island');
        report.originalOwners = originalOwners; report.initialGraphics = await graphics(); checkGraphics(report.initialGraphics);
    });
    await step('acquire-diagnostic-shore', async () => {
        const before = await state(), beforeGrants = JSON.parse((await host()).districtGrants); assert.deepEqual(beforeGrants, []);
        const buttons = page.locator('[data-district-template]');
        const index = await buttons.evaluateAll((nodes, id) => nodes.findIndex(node => node.dataset.districtTemplate === id), catalog.template.id);
        assert(index >= 0, 'Authored growth district must be offered in the existing acquisition UI'); await click(buttons.nth(index));
        await page.waitForFunction(() => document.querySelector('[data-authored-island]')?.dataset.districtPreview !== 'null'); await ready();
        await click(page.locator('[data-district-confirm]'));
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-authored-island]').dataset.districtGrants).length === 1); await ready();
        const h = await host(); grant = JSON.parse(h.districtGrants)[0]; assert.equal(grant.templateId, catalog.template.id);
        acquisition = { grants: JSON.parse(h.districtGrants), revision: h.districtWorldRevision, groundSourceRevision: h.groundSourceRevision,
            visualCandidate: h.visualCandidate, land: before.land };
        assert.deepEqual(owners(await state()), originalOwners); assert.equal((await state()).drops, before.drops);
        assert.deepEqual((await plan()).assemblies, []); assert.deepEqual((await plan()).connections, []);
        report.acquisition = acquisition; await checkpoint('low-shore');
    });
    await step('purchase-four-saplings', async () => {
        for (const localCell of cases.single.localCells) {
            const before = await state(), id = `l${before.nextId}`;
            await click(page.locator('[data-purchase-kind="sapling"]')); await tap(localCell);
            await click(page.getByRole('button', { name: 'ここにおく', exact: true })); await waitOwner(id, cellFor(localCell));
            const after = await state(), owner = after.landmarks.find(item => item.id === id); assert(owner);
            assert.equal(owner.kind, 'sapling'); assert.equal(owner.growth, 0); assert.equal(after.drops, before.drops - saplingPrice);
            assert.equal(after.nextId, before.nextId + 1); assert.deepEqual(oldOwners(after), originalOwners); ids.push(id);
        }
        report.newOwnerIds = [...ids]; assert.equal(new Set(ids).size, 4); assert.equal(owners(await state()).length, 39);
        assert.deepEqual((await plan()).assemblies, []); assert.deepEqual((await plan()).connections, []); await full('young');
    });
    let single, split, loop;
    await step('mature-through-existing-clock', async () => {
        const before = await state(); await click(page.locator('[data-advance-nature="18"]'));
        await page.waitForFunction(hours => JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).nature.hours === hours, before.nature.hours + 18); await ready();
        const after = await state(); assert.equal(owners(after).length, 39); assert.deepEqual(after.town, before.town);
        for (const id of ids) { const owner = after.landmarks.find(item => item.id === id); assert(owner.growth >= maturityHours); }
        const identity = item => { const copy = structuredClone(item); delete copy.growth; delete copy.maturedAt; return copy; };
        assert.deepEqual(oldOwners(after).map(identity), originalOwners.map(identity));
        report.natureAdvance = { hours: 18, before: before.nature, after: after.nature,
            existingOwnerChanges: oldOwners(after).flatMap((owner, i) => JSON.stringify(owner) === JSON.stringify(originalOwners[i]) ? [] : [{ before: originalOwners[i], after: owner }]) };
        matureInvariant = stableState(after); report.matureInvariant = matureInvariant;
        single = await checkCase('single'); await full('single');
    });
    await step('same-owners-split', async () => { split = await arrange('split'); assert.notEqual(split.revision, single.revision); await full('split'); });
    await step('same-owners-loop', async () => { loop = await arrange('loop'); assert.notEqual(loop.revision, single.revision); assert.notEqual(loop.revision, split.revision); await full('loop'); });
    const loopWorldRevision = (await host()).worldRevision;
    await step('separate-middle-tree', async () => {
        await storeOwner(ids[1]); assert.deepEqual((await plan()).assemblies, []); assert.deepEqual((await plan()).connections, []);
        const current = await state();
        for (const i of [0, 2, 3]) assert.deepEqual(current.landmarks.find(item => item.id === ids[i]).cell, cellFor(cases.loop.localCells[i]));
        await full('separated');
    });
    await step('reconnect-and-restore-loop', async () => {
        await move(ids[1], cases.loop.localCells[1]); const restored = await checkCase('loop');
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
