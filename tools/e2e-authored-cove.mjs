import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const defaultUrl = 'http://127.0.0.1:5354/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner';
assert(process.env.SANSU_AUTHORED_COVE_OUTPUT, 'Specify a fresh SANSU_AUTHORED_COVE_OUTPUT');
assert(process.env.SANSU_AUTHORED_COVE_BUILD, 'Specify the actual SANSU_AUTHORED_COVE_BUILD');
assert(process.env.SANSU_AUTHORED_COVE_URL, `Specify SANSU_AUTHORED_COVE_URL (usual target: ${defaultUrl})`);
const output = path.resolve(process.env.SANSU_AUTHORED_COVE_OUTPUT), expectedBuild = process.env.SANSU_AUTHORED_COVE_BUILD;
const target = new URL(process.env.SANSU_AUTHORED_COVE_URL), shapeOnly = process.env.SANSU_AUTHORED_COVE_SHAPE_ONLY === '1';
assert.equal(target.pathname, '/prototypes/place-qa/authored.html');
for (const [key, value] of [['water', 'wide'], ['reference', 'preflight32'], ['cove', 'corner']]) assert.equal(target.searchParams.get(key), value);
assert.notEqual(target.searchParams.get('grow'), '1', 'This fixed-reference driver never advances time or buys owners');
for (const directory of ['src', 'prototypes', 'tools', 'docs/design/2026-10-12-authored-cove-entrance'])
    assert(!output.startsWith(`${path.resolve(directory)}${path.sep}`), 'Evidence output must be outside the hashed input directories');
const sourceDirectory = 'docs/design/2026-10-12-authored-cove-entrance';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const delivery = await readJson(`${sourceDirectory}/cove-delivery-manifest.json`);
const visualCandidate = (await readJson(`${sourceDirectory}/shared-apron-world-patch-v1.json`)).candidate;
const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory()
    ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat();
const inputs = async () => {
    const files = new Set([...await walk('src'), ...await walk('prototypes/place-qa'), ...await walk('tools'),
        'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.app.json',
        ...[...await walk(sourceDirectory)].filter(file => /\.(?:json|glb|blend)$/.test(file)),
        'docs/design/2026-10-10-island-final-3d/whole-island-render.png',
        'docs/design/2026-10-10-island-final-3d/whole-island.glb',
        'docs/design/2026-10-11-authored-whole-preflight/runtime/young-32.frame.json',
        'docs/design/2026-10-11-authored-whole-preflight/runtime/mature-32.frame.json']);
    // All source files are covered; also follow static/dynamic local imports
    // outside src, especially the JSON profiles imported from docs/design.
    for (const file of files) {
        if (!/\.(?:[cm]?[jt]sx?)$/.test(file)) continue;
        const text = await fs.readFile(file, 'utf8');
        for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
            if (!match[1].startsWith('.')) continue;
            const resolved = path.normalize(path.join(path.dirname(file), match[1].split('?')[0]));
            for (const suffix of ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts']) {
                const candidate = `${resolved}${suffix}`;
                if ((await fs.stat(candidate).catch(() => null))?.isFile()) { files.add(candidate); break; }
            }
        }
    }
    return Object.fromEntries(await Promise.all([...files].sort().map(async file => [file, sha(await fs.readFile(file))])));
};
await fs.mkdir(output, { recursive: false });
const report = { pass: false, expectedBuild, candidate: visualCandidate, shellSourceId: delivery.source.id, target: target.href, shapeOnly,
    scope: shapeOnly ? 'Two actual DEV views of the archived synthetic 32-owner/8-home reference'
        : 'Actual DEV fixed synthetic reference: whole/close/rotated/phone/tablet views, real owner/canvas selection, move preview/cancel/commit/store/restore',
    excludes: ['Fresh acquisition', 'Personal save', 'Natural growth', 'Performance acceptance', 'Full body-width support proof',
        'Actual facility use', 'Touch hardware', 'Independent art or child acceptance', 'Whole-M1 completion'],
    timingScope: 'Diagnostic action wall time only; no performance threshold',
    initialInputs: await inputs(), captures: [], selections: [], canvasSelections: [], edits: [], steps: [], timings: [], errors: [] };
report.initialInputHash = sha(JSON.stringify(report.initialInputs));
let browser, page, domain, base, appVersion;
const meta = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const hostMeta = () => page.locator('[data-authored-island]').evaluate(node => ({ ...node.dataset }));
const state = async () => JSON.parse((await hostMeta()).authoredState);
const canonical = value => { const copy = structuredClone(value); delete copy.applied; delete copy.placeProgress; return copy; };
const protectedState = value => {
    const copy = canonical(value); const owner = copy.plots.find(owner => owner.id === 'p9'); assert(owner); delete owner.cell; return copy;
};
const frame = value => domain.authoredWorldFrame(value, base, { water: true, cove: true });
const exposedPlan = plan => {
    const { revision, profileRevision, sourceId, sourceSha256, assemblies } = plan;
    return { revision, profileRevision, sourceId, sourceSha256, assemblies };
};
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => {
    await page.waitForFunction(() => !document.querySelector('.authored-status')
        && document.querySelector('[data-growing-world]')?.dataset.growingCamera);
    await paint();
};
const timed = async (name, operation) => {
    report.phase = name; console.log(`authored-cove: ${name}`);
    await fs.writeFile(path.join(output, 'progress.json'), `${JSON.stringify({ phase: name })}\n`);
    const start = performance.now(); let success = false;
    try { const result = await operation(); await paint(); success = true; return result; }
    finally { report.timings.push({ name, elapsedMs: performance.now() - start, success }); }
};
const waitRevision = async expected => {
    await page.waitForFunction(revision => document.querySelector('[data-growing-world]')?.dataset.worldRevision === revision, expected);
    await ready();
};
const assertFrame = async expectedState => {
    const current = await state(), metadata = await meta(), host = await hostMeta(), projected = frame(current);
    assert.deepEqual(canonical(current), canonical(expectedState));
    assert.equal(host.buildRevision, expectedBuild); assert(host.appVersion?.startsWith(`${expectedBuild}:`));
    if (appVersion) assert.equal(host.appVersion, appVersion, 'The running DEV app version must stay fixed');
    else appVersion = host.appVersion;
    assert.equal(host.visualCandidate, visualCandidate);
    assert.equal(metadata.artCandidate, visualCandidate); assert.equal(metadata.nativeGrowingArt, 'true');
    assert.equal(metadata.authoredCoveEnabled, 'true'); assert.equal(metadata.authoredCoveSourceId, delivery.source.id);
    assert.equal(metadata.authoredCoveSource, delivery.source.sha256);
    assert.equal(metadata.worldRevision, projected.revision); assert.equal(host.worldRevision, projected.revision);
    assert.equal(metadata.authoredFrameRevision, `${projected.world.id}:${projected.revision}`);
    assert.deepEqual(JSON.parse(metadata.authoredCove), exposedPlan(projected.covePlan));
    assert.deepEqual(JSON.parse(metadata.authoredWater), projected.waterPlan);
    const reference = JSON.parse(host.referenceSource);
    assert.equal(reference.stage, 'mature');
    assert.equal(reference.sha256, sha(await fs.readFile(reference.path)), 'The archived acquisition input must remain byte-identical');
    return { current, metadata, host, projected, reference };
};
const capture = async (name, expectedState) => {
    await page.waitForFunction(() => {
        const encoded = document.querySelector('[data-growing-world]')?.dataset.authoredFlowerPoses;
        return encoded && JSON.parse(encoded)?.checked > 0;
    });
    await paint(); const checked = await assertFrame(expectedState), { metadata, projected, current } = checked;
    assert.equal(metadata.authoredObstructionWalking, metadata.authoredFlowerWalking);
    const physical = JSON.parse(metadata.authoredObstructionWalking), poses = JSON.parse(metadata.authoredFlowerPoses);
    assert.equal(physical.coveCount, projected.covePlan.assemblies.length); assert.equal(physical.stockCount, 4);
    assert(physical.triangles > 0); if (physical.coveCount) assert(physical.triangles >= delivery.counts.triangles);
    assert.deepEqual(physical.ownerAccess.map(owner => owner.id).sort(), [...current.plots, ...current.landmarks].filter(owner => owner.cell).map(owner => owner.id).sort());
    assert.deepEqual(physical.ownerAccess.filter(owner => !owner.reachable), [], 'All current owner approaches must remain reachable');
    assert(poses.checked > 0); assert.equal(poses.unplaced, 0);
    await page.screenshot({ path: path.join(output, `${name}.png`), scale: 'css' });
    report.captures.push({ file: `${name}.png`, viewport: page.viewportSize(), url: page.url(), build: expectedBuild,
        appVersion, metadata, referenceSource: checked.reference, physical, poses });
};
const whole = async () => {
    const previous = await page.locator('[data-growing-world]').elementHandle(); assert(previous);
    await page.getByRole('button', { name: '全景', exact: true }).click();
    await page.waitForFunction(node => !node.isConnected, previous); await ready();
    assert.equal((await meta()).growingFocus, undefined);
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
};
const selected = () => page.locator('[data-owner-id][aria-pressed="true"]').getAttribute('data-owner-id').catch(() => null);
const select = async id => {
    const button = page.locator(`[data-owner-id="${id}"]`); await button.scrollIntoViewIfNeeded(); await button.click();
    await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingFocus === id, id);
    assert.equal(await selected(), id); await paint();
    report.selections.push({ id, viewport: page.viewportSize(), camera: JSON.parse((await meta()).growingCamera) });
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded();
};
const cameraAndCanvas = async () => {
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const pose = JSON.parse((await meta()).growingCamera), camera = new T.OrthographicCamera();
    camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    camera.projectionMatrix.fromArray(pose.projectionMatrix); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return { box, pose, camera };
};
const pointerFor = (point, view) => {
    const p = point.clone().project(view.camera), { box } = view;
    assert(p.x > -.97 && p.x < .97 && p.y > -.97 && p.y < .97, 'The source projection must be inside the actual canvas');
    return { x: box.x + (p.x + 1) * box.width / 2, y: box.y + (1 - p.y) * box.height / 2 };
};
const tapCell = async cell => {
    const current = await state(), projection = frame(current), floor = projection.world.floorAt(cell); assert(floor, 'Use the actual composed floor');
    const view = await cameraAndCanvas(), point = new T.Vector3(floor.point.x - view.pose.center, floor.point.y, floor.point.z - 2);
    const pointer = pointerFor(point, view); await page.mouse.click(pointer.x, pointer.y); await paint();
    return { cell, pointer, floor: floor.point, frameRevision: projection.revision, camera: view.pose };
};
const canvasShellSelection = async baseline => {
    await select('p6'); await whole(); assert.equal(await selected(), 'p6');
    const currentFrame = frame(baseline), assembly = currentFrame.covePlan.assemblies[0]; assert(assembly);
    const view = await cameraAndCanvas(), compressed = await fs.readFile(delivery.artifact.path.slice(1));
    assert.equal(sha(compressed), delivery.artifact.sha256);
    const bytes = gunzipSync(compressed); assert.equal(sha(bytes), delivery.source.sha256);
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    try {
        const at = assembly.transform.position, pivot = assembly.transform.pivot;
        const transform = new T.Matrix4().makeTranslation(at.x - view.pose.center, at.y, at.z - 2)
            .multiply(new T.Matrix4().makeRotationY(assembly.transform.yaw))
            .multiply(new T.Matrix4().makeScale(assembly.transform.scale, assembly.transform.scale, assembly.transform.scale))
            .multiply(new T.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
        gltf.scene.applyMatrix4(transform); gltf.scene.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(gltf.scene), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
        const desired = center.clone(); desired.y = bounds.min.y + size.y * .68;
        const desiredNdc = desired.project(view.camera), candidates = [];
        gltf.scene.traverse(mesh => {
            if (!(mesh instanceof T.Mesh) || !/translucent/.test(mesh.material.name)) return;
            const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
            // Exact indexed source triangle centroids; no invented mesh hotspot.
            for (let i = 0; i < indices.count; i += 3) {
                const vertices = [0, 1, 2].map(offset => new T.Vector3().fromBufferAttribute(positions, indices.getX(i + offset)).applyMatrix4(mesh.matrixWorld));
                const point = vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3);
                if (point.y < bounds.min.y + size.y * .5) continue;
                const ndc = point.clone().project(view.camera);
                if (Math.abs(ndc.x) >= .95 || Math.abs(ndc.y) >= .95) continue;
                candidates.push({ point, ndc, mesh: mesh.name, triangle: i / 3,
                    score: Math.hypot(ndc.x - desiredNdc.x, ndc.y - desiredNdc.y) });
            }
        });
        candidates.sort((a, b) => a.score - b.score);
        const ray = new T.Raycaster();
        const choice = candidates.find(candidate => {
            ray.setFromCamera(candidate.ndc, view.camera);
            const hit = ray.intersectObject(gltf.scene, true)[0];
            return hit && hit.point.distanceTo(candidate.point) < 1e-4;
        });
        assert(choice, 'Find an exposed front-facing point on the exact source shell');
        const pointer = pointerFor(choice.point, view);
        const evidence = { previousOwner: 'p6', expectedOwner: 'p9', sourceSha256: delivery.source.sha256,
            sourceMesh: choice.mesh, sourceTriangle: choice.triangle, rendererPoint: choice.point.toArray(), pointer, camera: view.pose,
            scope: 'Source visibility selects one point; the following real canvas click proves actual scene picking', pass: false };
        report.canvasSelections.push(evidence);
        await page.mouse.click(pointer.x, pointer.y);
        await page.waitForFunction(() => document.querySelector('[data-owner-id="p9"]')?.getAttribute('aria-pressed') === 'true');
        await page.waitForFunction(() => document.querySelector('[data-growing-world]')?.dataset.growingFocus === 'p9');
        assert.deepEqual(canonical(await state()), canonical(baseline)); evidence.pass = true;
        report.steps.push('Actual source shell canvas tap changes selection from p6 to p9');
    } finally {
        const geometries = new Set(), materials = new Set();
        gltf.scene.traverse(mesh => { if (mesh instanceof T.Mesh) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
        geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    }
};
const waitValid = async () => {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'ここにおく' && !button.disabled));
    await paint();
};
const preview = async (canonicalState, futureState, committedCount, prospectiveCount) => {
    const future = frame(futureState);
    await page.waitForFunction(revision => document.querySelector('[data-growing-world]')?.dataset.previewWorldRevision === revision, future.revision);
    const checked = await assertFrame(canonicalState), status = JSON.parse(checked.metadata.authoredCovePreview);
    assert.equal(status.worldRevision, future.revision); assert.equal(status.committed.length, committedCount);
    assert(status.committed.every(item => !item.visible && item.sourceSha256 === delivery.source.sha256));
    assert.equal(status.prospective.length, prospectiveCount);
    assert(status.prospective.every(item => item.visible && item.sourceSha256 === delivery.source.sha256));
    return { revision: future.revision, status };
};
const noPreview = async expectedState => {
    await page.waitForFunction(() => {
        const data = document.querySelector('[data-growing-world]')?.dataset;
        return data?.authoredCovePreview && !data.previewWorldRevision && JSON.parse(data.authoredCovePreview).worldRevision === null;
    });
    const checked = await assertFrame(expectedState), status = JSON.parse(checked.metadata.authoredCovePreview);
    assert.equal(status.committed.length, checked.projected.covePlan.assemblies.length);
    assert(status.committed.every(item => item.visible && item.sourceSha256 === delivery.source.sha256));
    assert.deepEqual(status.prospective, []); return checked;
};
const edits = async baseline => {
    const initial = frame(baseline), owner = baseline.plots.find(item => item.id === 'p9'); assert(owner?.cell);
    const invariant = protectedState(baseline);
    // This journey preserves access while separating the cove. canPlace only
    // proves support/vacancy: a legal non-home placement can block a main path.
    // (4,-4) did exactly that in c2. The real-geometry life regression verifies
    // this fixed reference's (12,-9) move/store/restore before the browser run.
    const target = { x: 12, z: -9 };
    assert(domain.landCells(baseline, initial.world).some(cell => cell.x === target.x && cell.z === target.z));
    assert(domain.canPlace(baseline, target, owner.id, initial.world), 'The audited distant target must remain legal');
    const future = structuredClone(baseline); future.plots.find(item => item.id === 'p9').cell = target;
    const futureFrame = frame(future), reached = domain.reachableFromHome(future, undefined, futureFrame.world);
    const placedOwners = [...future.plots, ...future.landmarks].filter(item => item.cell);
    const unreachable = placedOwners.filter(item => !domain.isReachable(item.cell, reached, futureFrame.world)).map(item => item.id);
    assert.deepEqual(unreachable, [], 'The separation target must preserve all domain owner approaches');
    assert.equal(futureFrame.covePlan.assemblies.length, 0);
    report.editPreflight = { target, owners: placedOwners.length, unreachable, worldRevision: futureFrame.revision,
        physicalRegression: 'src/components/island/growing/authoredCoveLife.test.ts',
        scope: 'Domain preflight plus focused real-geometry regression; live physical owner access is asserted again after each capture.' };
    await select('p9'); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await whole();
    const firstPointer = await timed('preview-distant-p9', async () => { const tap = await tapCell(target); await waitValid(); return tap; });
    const previewed = await preview(baseline, future, 1, 0);
    await page.screenshot({ path: path.join(output, 'desktop-p9-move-preview.png'), scale: 'css' });
    report.edits.push({ action: 'preview', target, ...previewed, pointer: firstPointer, canonicalUnchanged: true });
    await timed('cancel-p9', () => page.getByRole('button', { name: 'やめる', exact: true }).click()); await noPreview(baseline);
    report.steps.push('Move preview hides committed shell and cancel restores it without canonical changes');
    await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await tapCell(target); await waitValid();
    const confirmedPreview = await preview(baseline, future, 1, 0);
    await timed('commit-distant-p9', async () => {
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await waitRevision(confirmedPreview.revision);
    });
    const moved = await state(); assert.deepEqual(moved.plots.find(item => item.id === 'p9'), { ...owner, cell: target });
    assert.deepEqual(protectedState(moved), invariant); await noPreview(moved);
    assert.equal(frame(moved).covePlan.assemblies.length, 0); await capture('desktop-p9-moved-whole-day', moved);
    report.edits.push({ action: 'move', target, committedRevision: (await meta()).worldRevision, previewRevision: confirmedPreview.revision });
    await timed('store-p9', async () => {
        await page.getByRole('button', { name: 'しまう', exact: true }).click();
        await page.waitForFunction(() => {
            const encoded = document.querySelector('[data-authored-island]')?.dataset.authoredState;
            return encoded && !JSON.parse(encoded).plots.find(owner => owner.id === 'p9')?.cell;
        });
        await ready();
    });
    const stored = await state(); assert.equal(stored.plots.find(item => item.id === 'p9').cell, undefined);
    assert.deepEqual(protectedState(stored), invariant); await waitRevision(frame(stored).revision); await noPreview(stored);
    assert.equal(frame(stored).covePlan.assemblies.length, 0); report.edits.push({ action: 'store', revision: frame(stored).revision });
    await page.getByRole('button', { name: 'おく', exact: true }).click(); await whole(); await tapCell(owner.cell); await waitValid();
    // The state telemetry's JSON omits the stored owner's undefined cell key.
    // App memory keeps that key in its original position; the plan fingerprint
    // includes field order. Adding it to parsed `stored` would predict a different
    // opaque revision for equal values. The protected-state assertion above proves
    // that returning to this original cell must recover the exact baseline.
    const restoredFuture = structuredClone(baseline);
    const restoring = await preview(stored, restoredFuture, 0, 1); assert.equal(restoring.revision, initial.revision);
    await timed('restore-p9-original-cell', async () => {
        await page.getByRole('button', { name: 'ここにおく', exact: true }).click(); await waitRevision(restoring.revision);
    });
    const restored = await state(); assert.deepEqual(canonical(restored), canonical(baseline));
    await noPreview(restored); assert.deepEqual(exposedPlan(frame(restored).covePlan), exposedPlan(initial.covePlan));
    await capture('desktop-p9-restored-whole-day', restored);
    report.edits.push({ action: 'restore', target: owner.cell, revision: restoring.revision, sourceSha256: delivery.source.sha256 });
    report.steps.push('Move/store remove shell; original-cell restore recovers the original plan/source, eight homes, rights, maturity, colors and clock');
};

try {
    const compiled = await build({ stdin: { contents: `
        export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
        export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts';
        export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts';
        export { canPlace } from './src/domain/growingIsland/commands.ts';
        export { landCells, reachableFromHome, isReachable } from './src/domain/growingIsland/space.ts';
    `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', metafile: true });
    report.domainInputFiles = Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>').sort();
    for (const file of report.domainInputFiles) assert(report.initialInputs[file], `Projection input omitted from source closure: ${file}`);
    domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    base = domain.withNative05WaterCarvingScope(domain.compileWorldDefinition(JSON.parse(gunzipSync(await fs.readFile('prototypes/place-qa/native05-world.json.gz')))));
    browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(90000); page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });
    await timed('load-mature-32', async () => { await page.goto(target.href); await ready(); });
    report.serviceWorker = await page.evaluate(async () => ({ controller: navigator.serviceWorker?.controller?.scriptURL ?? null,
        registrations: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope) : [] }));
    assert.equal(report.serviceWorker.controller, null); assert.deepEqual(report.serviceWorker.registrations, []);
    report.serviceWorker.scope = 'Fresh DEV browser context; no service worker controls/registers this diagnostic. No production PWA claim.';
    const saved = await readJson('prototypes/place-qa/authored-flower-reference-mature.json'), baseline = await state();
    assert.deepEqual(canonical(baseline), canonical(saved.state)); assert.equal(baseline.plots.length + baseline.landmarks.length, 32);
    assert.equal(baseline.plots.filter(owner => owner.kind === 'home').length, 8); assert.equal(frame(baseline).covePlan.assemblies.length, 1);
    report.initialState = baseline; report.initialPlan = exposedPlan(frame(baseline).covePlan);
    await capture('desktop-mature-whole-day', baseline); await timed('select-p9-close', () => select('p9'));
    await capture('desktop-cove-close-day', baseline);
    if (!shapeOnly) {
        await timed('canvas-select-source-shell', () => canvasShellSelection(baseline));
        await edits(baseline);
        await timed('rotate-whole', async () => { await whole(); await page.getByRole('button', { name: '右へ回す', exact: true }).click(); });
        await capture('desktop-rotated-whole-day', baseline); await select('p9'); await capture('desktop-rotated-cove-close-day', baseline);
        await page.getByRole('button', { name: '左へ回す', exact: true }).click(); await paint();
        for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet', { width: 768, height: 1024 }, 'reduce']]) {
            await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion }); await timed(`${name}-whole`, whole);
            await capture(`${name}-whole-day`, baseline); await select('p9'); await capture(`${name}-cove-close-day`, baseline);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
    }
    assert.deepEqual(report.errors, []); report.finalState = await state(); await assertFrame(baseline);
    report.finalInputs = await inputs(); report.finalInputHash = sha(JSON.stringify(report.finalInputs));
    assert.deepEqual(report.finalInputs, report.initialInputs, 'Application/QA/source/patch/benchmark input changed during the run');
    report.sourceClosureUnchanged = true; report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); report.firstFailurePhase = report.phase;
    if (page) {
        report.failureMetadata = await meta().catch(() => null); report.failureSelection = await selected();
        report.failureState = await state().catch(() => null);
        await page.screenshot({ path: path.join(output, 'first-failure.png'), scale: 'css' }).catch(() => {});
    }
    process.exitCode = 1;
} finally {
    if (!report.finalInputs) {
        try { report.finalInputs = await inputs(); report.finalInputHash = sha(JSON.stringify(report.finalInputs));
            report.sourceClosureUnchanged = report.initialInputHash === report.finalInputHash; }
        catch (error) { report.finalInputError = String(error); }
    }
    await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser?.close();
}
console.log(JSON.stringify({ pass: report.pass, shapeOnly, captures: report.captures.length, steps: report.steps, error: report.error, output }));
