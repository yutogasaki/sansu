import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';

assert(process.env.SANSU_AUTHORED_WHOLE_OUTPUT, 'Specify a fresh SANSU_AUTHORED_WHOLE_OUTPUT');
const output = process.env.SANSU_AUTHORED_WHOLE_OUTPUT;
const url = process.env.SANSU_AUTHORED_WHOLE_URL || 'http://127.0.0.1:5350/prototypes/place-qa/authored.html?water=wide&grow=1';
const expectedBuild = process.env.SANSU_AUTHORED_WHOLE_BUILD || 'authored-whole-preflight-c1';
const candidate = 'native05-authored-whole-preflight-v1';
await fs.mkdir(output, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => sha(JSON.stringify(value));
const inputs = async () => {
    const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(item =>
        item.isDirectory() ? walk(`${dir}/${item.name}`) : [`${dir}/${item.name}`]))).flat();
    const files = [...await walk('src'), 'package.json', 'package-lock.json', 'vite.config.ts',
        'tools/e2e-authored-whole-preflight.mjs', 'tools/e2e-authored-water.mjs', 'tools/growing-authored-water-fixture.mjs',
        'tools/growing-authored-fixture.mjs', 'tools/extract-native-water-profile.mjs', 'tools/extract-native-water-bridge.mjs',
        'prototypes/place-qa/authored.html', 'prototypes/place-qa/authored-fixture.json', 'prototypes/place-qa/authored-water-fixture.json',
        'prototypes/place-qa/native05-world.json.gz', 'prototypes/place-qa/native05-coast.json.gz', 'prototypes/place-qa/native-water-bridge.json.gz',
        'docs/design/2026-10-11-authored-world-foundation/world-manifest.json',
        'docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz',
        'docs/design/2026-10-11-native-owned-island/kit-manifest.json',
        'docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'];
    return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async file => [file, sha(await fs.readFile(file))])));
};
const report = {
    pass: false, candidate, expectedBuild, url,
    runtime: { node: process.versions.node, platform: process.platform, headless: true },
    scope: 'DEV synthetic authored 27-to-32 owner whole-island preflight; five ordinary paid purchases through actual UI, then the diagnostic nature clock advances 18 hours',
    excludes: ['Production player acquisition/save', 'Learning or town-time evidence', 'Gallery implementation', 'Touch hardware', 'Performance acceptance', 'Independent child understanding or art acceptance', 'Final whole-island or M1 completion'],
    companionQa: 'tools/e2e-authored-water.mjs retains edit/store/split/reconnect coverage; this preflight adds purchase/nature/whole-view evidence rather than replacing that QA',
    timingScope: 'Headless desktop browser operation through evaluated world plus two painted frames; separate Node frame/proof work is diagnostic, not device acceptance',
    captures: [], steps: [], operationTimings: [], frameTimings: [], frames: [], pointers: [], focuses: [],
    initialInputs: await inputs(),
};
report.initialInputHash = jsonHash(report.initialInputs);
let browser, page;
const errors = [];
const read = () => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredState));
const history = () => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredDiagnosticHistory));
const metadata = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => {
    await page.waitForFunction(() => !document.querySelector('.authored-status') && document.querySelector('[data-growing-world]')?.dataset.growingCamera);
    await paint();
};
const phase = async name => {
    report.phase = name; console.log(`authored-whole-preflight: ${name}`);
    await fs.writeFile(path.join(output, 'progress.json'), JSON.stringify({ phase: name, steps: report.steps, operationTimings: report.operationTimings }, null, 2));
};
const timed = async (name, operation) => {
    const start = performance.now(); let success = false;
    try { const result = await operation(); await paint(); success = true; return result; }
    finally { report.operationTimings.push({ name, elapsedMs: performance.now() - start, success }); }
};
const capture = async (name, validate = true) => {
    await paint(); await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
    const record = { file: `${name}.png`, viewport: page.viewportSize(), url: page.url(),
        metadata: await metadata().catch(error => ({ unavailable: String(error) })),
        build: await page.locator('[data-authored-island]').getAttribute('data-build-revision').catch(() => null) };
    report.captures.push(record);
    if (validate) { assert.equal(record.build, expectedBuild); assert.equal(record.metadata.artCandidate, candidate); assert.equal(record.metadata.nativeGrowingArt, 'true'); }
};
const ownersOf = state => [...state.plots, ...state.landmarks];
const withoutReceipts = state => { const copy = structuredClone(state); delete copy.applied; delete copy.placeProgress; return copy; };
const anchorSignature = world => world.sites.map(site => [site.ref, site.cell, site.point, site.placement]);
const nonWalkEdges = world => world.definition.edges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
const edgeKey = edge => JSON.stringify([edge.from, edge.to]);
const purchases = [
    { id: 'l28', kind: 'sapling', cell: { x: 1, z: -4 }, form: 'spire', price: 20 },
    { id: 'l29', kind: 'sapling', cell: { x: 4, z: -3 }, form: 'branch', price: 20 },
    { id: 'l30', kind: 'bench', cell: { x: 4, z: -2 }, price: 20 },
    { id: 'l31', kind: 'flower', cell: { x: 8, z: -4 }, color: 'white', price: 10 },
    { id: 'l32', kind: 'water-bowl', cell: { x: 8, z: -2 }, price: 20 },
];
try {
    await phase('compile-diagnostic-source');
    const compiled = await build({ stdin: { contents: `
        export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
        export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
        export { authoredWaterFrame } from './src/domain/growingIsland/authoredWaterFrame.ts';
        export { applyIntent, canPlace } from './src/domain/growingIsland/commands.ts';
        export { advanceNature } from './src/domain/growingIsland/nature.ts';
        export { syncPlaceMilestones } from './src/domain/growingIsland/placeGoals.ts';
        export { derivePlaces } from './src/domain/growingIsland/places.ts';
        export { key, landCells, reachableFromHome, approachCells } from './src/domain/growingIsland/space.ts';
        export { hasAuthoredPlacementSupport } from './src/domain/growingIsland/authoredPlacementSupport.ts';
        export { previewGrowingState } from './src/components/island/growing/objectLayer.ts';
        export { treeForm } from './src/components/island/growing/treeSilhouettes.ts';
    `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
    report.domainBundleHash = sha(compiled.outputFiles[0].text); report.domainBundleInputs = Object.keys(compiled.metafile.inputs).sort();
    const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const base = d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(await fs.readFile('prototypes/place-qa/native05-world.json.gz')))));
    const sourceAnchors = anchorSignature(base), sourceNonWalkEdges = nonWalkEdges(base), sourceWalkEdges = new Set(base.definition.edges.filter(edge => edge.allows.includes('walk')).map(edgeKey));
    const sourceRights = base.sites.filter(site => site.placement).map(site => ({ ...site.cell }));
    assert.equal(sourceRights.length, 73);
    browser = await chromium.launch({ headless: true });
    report.runtime.browser = await browser.version();
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await phase('load-initial-27');
    await timed('initial-load', async () => { await page.goto(url); await ready(); });
    assert.equal(new URL(page.url()).searchParams.get('water'), 'wide'); assert.equal(new URL(page.url()).searchParams.get('grow'), '1');
    assert.equal(await page.locator('[data-authored-island]').getAttribute('data-growth-diagnostic'), 'true');
    assert.equal(await page.locator('[data-authored-island]').getAttribute('data-build-revision'), expectedBuild);
    const baseline = await read(), originalOwners = ownersOf(baseline), upper = {};
    report.initialState = baseline; assert.equal(originalOwners.length, 27); assert.equal(baseline.drops, 9320); assert.equal(baseline.nextId, 28);
    assert.equal(baseline.nature.hours, 216); assert.equal(baseline.plots.filter(owner => owner.kind === 'home').length, 8);
    assert.deepEqual(await history(), []);
    const invariantState = state => {
        assert.deepEqual(state.land, baseline.land); assert.deepEqual(state.town, baseline.town);
        assert.equal(state.seed, baseline.seed); assert.equal(state.rules, baseline.rules); assert.equal(state.enrolledAt, baseline.enrolledAt);
        assert.deepEqual(state.learned, baseline.learned); assert.deepEqual(state.plots, baseline.plots); assert.deepEqual(state.villagers, baseline.villagers);
        assert.deepEqual(state.keepsakes, baseline.keepsakes); assert.deepEqual(state.arrivals, baseline.arrivals); assert.deepEqual(state.unopened, baseline.unopened);
        const owners = ownersOf(state); assert.equal(new Set(owners.map(owner => owner.id)).size, owners.length);
        assert.equal(new Set(owners.map(owner => d.key(owner.cell))).size, owners.length);
        for (const original of originalOwners) assert.deepEqual(owners.find(owner => owner.id === original.id), original, `Original owner ${original.id}`);
        assert.equal(state.plots.filter(owner => owner.kind === 'home').length, 8);
    };
    const frameProof = async (name, state, persist = false) => {
        const started = performance.now(); let success = false;
        try {
            invariantState(state);
            const frame = d.authoredWaterFrame(state, base), places = d.derivePlaces(state, frame.world), reached = d.reachableFromHome(state, undefined, frame.world);
            const definitionText = JSON.stringify(frame.world.definition), definitionHash = sha(definitionText);
            const proof = { name, state, stateHash: jsonHash(state), definitionHash, worldId: frame.world.id, revision: frame.world.definition.revision,
                plan: frame.plan, places, reachedWalkingPoints: reached.size, rights: d.landCells(state, frame.world), approaches: [], dryFootprints: [],
                floorCounts: Object.fromEntries(['ground', 'water', 'deck'].map(kind => [kind, frame.world.floors.filter(floor => floor.kind === kind).length])) };
            report.frames.push(proof);
            assert.deepEqual(anchorSignature(frame.world), sourceAnchors, `${name}: acquired anchors`);
            assert.deepEqual(proof.rights, sourceRights, `${name}: 73 placement rights`); assert.deepEqual(nonWalkEdges(frame.world), sourceNonWalkEdges, `${name}: join/water grants`);
            for (const edge of frame.world.definition.edges.filter(edge => edge.allows.includes('walk'))) assert(sourceWalkEdges.has(edgeKey(edge)), `${name}: invented walk grant`);
            for (const owner of ownersOf(state)) {
                const entries = d.approachCells(owner.cell, frame.world).filter(cell => reached.has(d.key(cell)));
                const supports = entries.map(cell => ({ cell, floor: frame.world.floorAt(cell) }));
                proof.approaches.push({ id: owner.id, entries: supports });
                assert(entries.length, `${name}: HOME approach ${owner.id}`); assert(supports.every(entry => entry.floor), `${name}: actual entry floor ${owner.id}`);
                if (!frame.plan.ownerIds.includes(owner.id)) {
                    const supported = d.hasAuthoredPlacementSupport(frame.world, owner.cell);
                    proof.dryFootprints.push({ id: owner.id, cell: owner.cell, supported, floor: frame.world.floorAt(owner.cell) });
                    assert(supported, `${name}: full dry footprint ${owner.id}`);
                }
            }
            for (const id of ['P02:p3', 'P03:l20']) {
                const place = places.find(place => place.id === id); assert(place, `${name}: upper place ${id}`);
                if (name === 'initial-27') upper[id] = place.revision;
                else assert.equal(place.revision, upper[id], `${name}: upper place revision ${id}`);
            }
            if (persist) {
                proof.definitionFile = `${name}.world.json.gz`;
                const expanded = `${definitionText}\n`, compressed = gzipSync(expanded);
                proof.definitionExpandedFileHash = sha(expanded); proof.definitionExpandedBytes = Buffer.byteLength(expanded);
                proof.definitionGzipHash = sha(compressed); proof.definitionGzipBytes = compressed.length;
                await fs.writeFile(path.join(output, proof.definitionFile), compressed, { flag: 'wx' });
            }
            await fs.writeFile(path.join(output, `${name}.frame.json`), `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' });
            success = true; return { frame, proof };
        } finally { report.frameTimings.push({ name, elapsedMs: performance.now() - started, success }); }
    };
    const runtimeParity = async frame => {
        const meta = await metadata(); assert.equal(meta.artCandidate, candidate); assert.equal(meta.nativeGrowingArt, 'true');
        assert.equal(meta.worldRevision, frame.plan.revision); assert.deepEqual(JSON.parse(meta.authoredWater), frame.plan);
        return meta;
    };
    let current = await frameProof('initial-27', baseline, true); await runtimeParity(current.frame);
    assert.equal(current.proof.dryFootprints.length, 22); assert.equal(current.frame.plan.pools.length, 3); assert.equal(current.frame.plan.bridges.length, 1);
    await capture('initial-27-camera-scale'); report.steps.push('initial 27 owners, 8 homes and actual 73 rights');
    const full = async () => {
        await timed('whole-view-reset', async () => { await page.getByRole('button', { name: '全景', exact: true }).click(); await ready(); await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); });
    };
    const tap = async (cell, world, surface) => {
        const box = await page.locator('[data-growing-world] canvas').boundingBox(), pose = JSON.parse((await metadata()).growingCamera);
        assert(box, 'Canvas has no physical bounds');
        const physical = surface ?? world.floorAt(cell)?.point; assert(physical, `No current dry purchase floor ${d.key(cell)}`);
        const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
        const point = new T.Vector3(physical.x - pose.center, physical.y, physical.z - 2).project(camera);
        assert(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) <= 1, `Purchase ${d.key(cell)} outside the actual camera`);
        const screen = { x: box.x + (point.x + 1) * box.width / 2, y: box.y + (1 - point.y) * box.height / 2 };
        assert(screen.x >= 0 && screen.x < page.viewportSize().width && screen.y >= 0 && screen.y < page.viewportSize().height, 'Pointer outside viewport');
        report.pointers.push({ cell, physical, screen, camera: pose, surface: surface ? 'actual wet rejection target' : 'actual current dry floor' }); await page.mouse.click(screen.x, screen.y); await paint();
    };
    await phase('invalid-and-cancel-purchase-preview'); await full();
    const previewBefore = await read(), saplingButton = page.locator('[data-purchase-kind="sapling"]');
    const wetPool = current.frame.plan.pools.find(pool => pool.ownerId === 'l22'), wetCell = previewBefore.landmarks.find(owner => owner.id === 'l22').cell;
    assert.equal(d.canPlace(previewBefore, wetCell, undefined, current.frame.world), false);
    await saplingButton.click();
    await timed('purchase-invalid-water-pointer', () => tap(wetCell, current.frame.world, { x: wetPool.center.x, y: wetPool.waterY, z: wetPool.center.z }));
    assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isDisabled());
    assert.equal((await metadata()).previewWorldRevision, undefined); assert.deepEqual(withoutReceipts(await read()), withoutReceipts(previewBefore));
    await capture('invalid-wet-purchase'); await page.getByRole('button', { name: 'やめる', exact: true }).click();
    await saplingButton.click(); await timed('purchase-valid-cancel-preview', () => tap(purchases[0].cell, current.frame.world));
    assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isEnabled());
    const cancelledFuture = d.previewGrowingState(previewBefore, { kind: 'sapling', seed: false, prospectiveOwnerId: 'l28', style: 'plain', cell: purchases[0].cell, valid: true, allowed: [purchases[0].cell] });
    const cancelledFrame = await frameProof('preview-l28-cancel', cancelledFuture);
    assert.equal((await metadata()).previewWorldRevision, cancelledFrame.frame.plan.revision); await capture('valid-purchase-preview-before-cancel');
    await timed('purchase-preview-cancel', async () => {
        await page.getByRole('button', { name: 'やめる', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('[data-growing-world]').dataset.previewWorldRevision);
    });
    await runtimeParity(current.frame); assert.deepEqual(withoutReceipts(await read()), withoutReceipts(previewBefore)); assert.deepEqual(await history(), []);
    await capture('purchase-preview-cancelled'); report.steps.push('wet purchase stays invalid and valid preview cancel preserves all owners, prices and clocks');
    for (const [index, purchase] of purchases.entries()) {
        await phase(`purchase-${purchase.id}-${purchase.kind}`); await full();
        const before = await read(), expectedCommand = { type: 'place', kind: purchase.kind, cell: purchase.cell, ...(purchase.color ? { color: purchase.color } : {}) };
        assert.equal(d.canPlace(before, purchase.cell, undefined, current.frame.world), true, `Current composed placement ${purchase.id}`);
        assert.equal(before.nextId, Number(purchase.id.slice(1))); assert(before.unlocked.includes(`landmark:${purchase.kind}`));
        if (purchase.form) assert.equal(d.treeForm(purchase.id), purchase.form);
        const button = page.locator(`[data-purchase-kind="${purchase.kind}"]`); assert(await button.isEnabled());
        await timed(`purchase-${purchase.id}-start`, () => button.click());
        await timed(`purchase-${purchase.id}-pointer-preview`, async () => { await tap(purchase.cell, current.frame.world); await page.getByRole('button', { name: 'ここにおく', exact: true }).waitFor(); assert(await page.getByRole('button', { name: 'ここにおく', exact: true }).isEnabled()); });
        assert.deepEqual(withoutReceipts(await read()), withoutReceipts(before), 'Preview must not purchase or advance a clock');
        const future = d.previewGrowingState(before, { kind: purchase.kind, seed: false, prospectiveOwnerId: purchase.id, style: 'plain', cell: purchase.cell, valid: true, allowed: [purchase.cell], ...(purchase.color ? { color: purchase.color } : {}) });
        assert(future); const futureOwner = future.landmarks.find(owner => owner.id === purchase.id);
        assert.equal(futureOwner.growth, 0); assert.equal(futureOwner.maturedAt, undefined);
        const predicted = await frameProof(`preview-${purchase.id}`, future);
        const previewMeta = await metadata(); assert.equal(previewMeta.previewWorldRevision, predicted.frame.plan.revision);
        await capture(`preview-${purchase.id}-${purchase.kind}`);
        const oracle = d.applyIntent(before, { id: `preflight-oracle-${purchase.id}`, command: expectedCommand }, before.nature.realAt, current.frame.world).state;
        await timed(`purchase-${purchase.id}-confirm`, async () => {
            await page.getByRole('button', { name: 'ここにおく', exact: true }).click();
            await page.waitForFunction(id => JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).landmarks.some(owner => owner.id === id), purchase.id);
            await page.waitForFunction(revision => document.querySelector('[data-growing-world]').dataset.worldRevision === revision
                && !document.querySelector('[data-growing-world]').dataset.previewWorldRevision, predicted.frame.plan.revision);
        });
        const after = await read(); assert.deepEqual(withoutReceipts(after), withoutReceipts(oracle), `Actual applyIntent ${purchase.id}`);
        assert.equal(after.drops, before.drops - purchase.price); assert.equal(after.nextId, before.nextId + 1); assert.deepEqual(after.nature, baseline.nature);
        const committedOwner = after.landmarks.find(owner => owner.id === purchase.id); assert.deepEqual(committedOwner, futureOwner);
        current = await frameProof(`committed-${purchase.id}`, after); assert.equal(current.proof.definitionHash, predicted.proof.definitionHash, `Preview/commit geometry ${purchase.id}`);
        await runtimeParity(current.frame);
        const records = await history(); assert.equal(records.length, index + 1); assert.deepEqual(records[index].command, expectedCommand);
        assert.deepEqual(records[index].before, { drops: before.drops, nextId: before.nextId, nature: 216 });
        assert.deepEqual(records[index].after, { drops: after.drops, nextId: after.nextId, nature: 216 });
        report.steps.push(`${purchase.id}: actual paid ${purchase.kind} acquisition, prospective ID and geometry match confirmation`);
    }
    await phase('young-32-whole'); const young = await read();
    assert.equal(ownersOf(young).length, 32); assert.equal(young.drops, 9230); assert.equal(young.nextId, 33); assert.equal(young.nature.hours, 216);
    for (const purchase of purchases) assert.equal(young.landmarks.find(owner => owner.id === purchase.id).growth, 0);
    current = await frameProof('young-32', young, true); assert.equal(current.proof.dryFootprints.length, 27);
    await full(); await capture('young-32-source-forest');
    await phase('nature-18-hours');
    const expectedNature = structuredClone(young), natureAt = young.nature.realAt + 18 * 3600000;
    const expectedEvents = d.advanceNature(expectedNature, natureAt, current.frame.world); d.syncPlaceMilestones(expectedNature, natureAt, current.frame.world);
    await timed('diagnostic-nature-18h', async () => {
        const button = page.locator('[data-advance-nature="18"]'); assert(await button.isEnabled()); await button.click();
        await page.waitForFunction(() => JSON.parse(document.querySelector('[data-authored-island]').dataset.authoredState).nature.hours === 234);
    });
    const mature = await read(); assert.deepEqual(withoutReceipts(mature), withoutReceipts(expectedNature), 'Actual advanceNature result');
    invariantState(mature); assert.equal(ownersOf(mature).length, 32); assert.equal(mature.drops, 9230); assert.equal(mature.nextId, 33);
    assert.equal(mature.nature.hours, 234); assert.equal(mature.nature.realAt, natureAt);
    for (const id of ['l28', 'l29']) { const owner = mature.landmarks.find(owner => owner.id === id); assert.equal(owner.growth, 18); assert(owner.maturedAt > 216 && owner.maturedAt <= 234); }
    assert.equal(mature.landmarks.find(owner => owner.id === 'l31').growth, 6); assert.equal(mature.landmarks.find(owner => owner.id === 'l31').color, 'white');
    const records = await history(); assert.equal(records.length, 6); assert.deepEqual(records[5].command, { type: 'diagnostic-nature', hours: 18 });
    assert.deepEqual(records[5].events, expectedEvents); assert.deepEqual(records[5].before, { nature: 216 }); assert.deepEqual(records[5].after, { nature: 234 }); assert.equal(records[5].at, natureAt);
    report.diagnosticHistory = records; report.natureEvents = expectedEvents;
    current = await frameProof('mature-32', mature, true); assert.equal(current.proof.approaches.length, 32); assert.equal(current.proof.dryFootprints.length, 27);
    await runtimeParity(current.frame); await full(); await capture('mature-32-whole-day');
    report.steps.push('diagnostic 18h advances only nature; new trees mature and white flower blooms with all 32 approaches and 27 dry footprints');
    const choose = async id => {
        const index = await page.locator('[data-owner-id]').evaluateAll((nodes, id) => nodes.findIndex(node => node.dataset.ownerId === id), id); assert(index >= 0, `Missing owner ${id}`);
        await timed(`focus-${id}`, async () => {
            const button = page.locator('[data-owner-id]').nth(index); await button.scrollIntoViewIfNeeded(); await button.click();
            await page.waitForFunction(id => document.querySelector('[data-growing-world]').dataset.growingFocus === id, id);
            await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
        });
        const meta = await metadata(), owner = ownersOf(await read()).find(owner => owner.id === id), pose = JSON.parse(meta.growingCamera);
        const physical = current.frame.world.floorAt(owner.cell)?.point ?? current.frame.world.anchorAt(owner.cell); assert(physical);
        const camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
        const focusAnchor = new T.Vector3(physical.x - pose.center, physical.y + .04, physical.z - 2).project(camera);
        report.focuses.push({ id, viewport: page.viewportSize(), physical, camera: pose, projectedOwnerAnchor: focusAnchor.toArray(),
            scope: 'Actual selected owner anchor; captures, rather than this point, assess the visible object composition' });
        assert(Math.abs(focusAnchor.x) < .000001 && Math.abs(focusAnchor.y) < .000001, `Actual 3D focus ${id}`);
        assert(Math.abs(focusAnchor.z) <= 1, `Focused owner ${id} clipped`);
    };
    await phase('desktop-close-views');
    for (const [id, name] of [['l28', 'forest'], ['l22', 'hill-water'], ['l31', 'flower'], ['l32', 'bay-water']]) { await choose(id); await capture(`desktop-${name}-close`); }
    await phase('desktop-rotated-day-dusk'); await full();
    await page.getByRole('button', { name: '右へ回す', exact: true }).click(); await paint(); await capture('desktop-rotated-day-whole');
    await choose('l28'); await capture('desktop-rotated-forest-close'); await full();
    await page.getByRole('button', { name: '夕の光', exact: true }).click(); await paint(); await capture('desktop-rotated-dusk-whole');
    await choose('l22'); await capture('desktop-rotated-dusk-water-close');
    await page.getByRole('button', { name: '昼の光', exact: true }).click();
    await page.getByRole('button', { name: '左へ回す', exact: true }).click(); await paint();
    for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet', { width: 768, height: 1024 }, 'reduce']]) {
        await phase(`${name}-day-dusk`); await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion });
        await full(); await capture(`${name}-mature-whole-day`); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await choose('l28'); await capture(`${name}-forest-close-day`);
        await page.getByRole('button', { name: '夕の光', exact: true }).click(); await full(); await capture(`${name}-mature-whole-dusk`);
        await choose('l22'); await capture(`${name}-water-close-dusk`); await page.getByRole('button', { name: '昼の光', exact: true }).click();
    }
    report.finalState = await read(); invariantState(report.finalState); assert.deepEqual(withoutReceipts(report.finalState), withoutReceipts(mature));
    assert.deepEqual(await history(), records); assert.deepEqual(errors, []);
    report.finalInputs = await inputs(); report.finalInputHash = jsonHash(report.finalInputs); assert.deepEqual(report.finalInputs, report.initialInputs, 'Sources changed during whole preflight');
    report.pass = true;
} catch (error) {
    report.firstFailure = { phase: report.phase, error: String(error.stack || error), stepsCompleted: report.steps.length, capturesCompleted: report.captures.length };
    if (page) { report.failureState = await read().catch(() => undefined); report.failureHistory = await history().catch(() => undefined); await capture('first-failure', false).catch(() => {}); }
    throw error;
} finally {
    report.errors = errors;
    if (!report.finalInputs) { report.finalInputs = await inputs().catch(error => ({ unavailable: String(error) })); report.finalInputHash = jsonHash(report.finalInputs); }
    report.sourceClosureUnchanged = JSON.stringify(report.finalInputs) === JSON.stringify(report.initialInputs);
    await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser?.close();
}
console.log(JSON.stringify({ pass: report.pass, candidate, build: expectedBuild, steps: report.steps.length, captures: report.captures.length, sourceHash: report.finalInputHash, output }));
