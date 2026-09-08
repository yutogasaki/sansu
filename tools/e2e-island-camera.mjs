import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Vector3 } from 'three';
import { answerUI, assertKeypad, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }];
const scope = ['Real empty-DB setup, no injected progress: pan both axes, anchored pinch/wheel, buttons, resize, cancel, house shell tap/exit, identical reservation and one actual non-final answer.',
    'Separate explicitly injected three-land visual fixture: earned-land pan bounds, local district travel, 1x overview and 6x maximum. This fixture is not acquisition, migration or child-observation evidence.',
    'Every native store is compared exactly; no unknown discovery or other write is silently adopted. Learning uses its actual input surface, never its intentionally hidden 1x1 canvas.',
    'Actual PNG/camera matrices and mouse/CDP touch input; source app and QA closure pinned. N=0, visual quality remains a separate review.'];
if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ browserStarted: false, layouts, scope,
        requiredEnvironment: ['SANSU_ISLAND_CAMERA_URL', 'SANSU_ISLAND_CAMERA_OUTPUT', 'SANSU_ISLAND_BUILD_SOURCE'],
        optionalEnvironment: ['SANSU_ISLAND_CAMERA_QA_ROOT'],
        runtimeClosure: ['tools/e2e-island-camera.mjs', 'tools/island-e2e-helpers.mjs'] }, null, 2)); process.exit(0);
}
const target = (process.env.SANSU_ISLAND_CAMERA_URL || '').replace(/\/$/u, ''), out = process.env.SANSU_ISLAND_CAMERA_OUTPUT;
assert(target && out && process.env.SANSU_ISLAND_BUILD_SOURCE, 'Frozen URL, manifest and fresh output are required');
const manifest = JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE, 'utf8'));
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), sha = value => createHash('sha256').update(value).digest('hex');
assert(manifest.revision && manifest.files?.length && manifest.sourceHash);
assert.equal(await fs.realpath(root), await fs.realpath(process.env.SANSU_ISLAND_CAMERA_QA_ROOT || manifest.snapshot));
const helpers = ['tools/island-e2e-helpers.mjs'], qa = ['tools/e2e-island-camera.mjs', ...helpers];
const appInputs = manifest.files.filter(file => !file.relative.startsWith('tools/'));
const hashFiles = files => Promise.all(files.map(async file => ({ path: file, sha256: sha(await fs.readFile(file)) })));
const fingerprint = async () => ({ app: await hashFiles(manifest.files.map(file => file.path)),
    bundleApp: await hashFiles(appInputs.map(file => path.join(root, file.relative))), qa: await hashFiles(qa.map(file => path.join(root, file))) });
const initialSource = await fingerprint();
for (const file of manifest.files) assert.equal(initialSource.app.find(entry => entry.path === file.path)?.sha256, file.sha256, file.path);
for (const file of appInputs) assert.equal(initialSource.bundleApp.find(entry => entry.path === path.join(root, file.relative))?.sha256, file.sha256, file.relative);
for (const file of helpers) assert.equal(initialSource.qa.find(entry => entry.path === path.join(root, file))?.sha256, manifest.files.find(entry => entry.relative === file)?.sha256);
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.mkdir(out);
const report = { target, startedAt: new Date().toISOString(), revision: manifest.revision, sourceHash: manifest.sourceHash,
    scope, pass: false, humanN: 0, timingEvidenceEligible: false, initialSource, captures: [], scenarios: [] };
const stage = page => page.getByTestId('island-stage');
const toolbar = page => page.getByRole('group', { name: 'しまの ながめ', exact: true });
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const view = async page => JSON.parse(await stage(page).getAttribute('data-camera-view'));
const frame = async page => (await stage(page).getAttribute('data-camera-frame')).split(',').map(Number);
async function world(page) {
    await waitReady(page); await stage(page).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-testid="island-stage"]'), box = host?.querySelector('canvas')?.getBoundingClientRect();
        return document.querySelector('.island-page')?.dataset.mode !== 'learning' && host?.dataset.renderer === 'three'
            && box?.width > 100 && box?.height > 100 && host.dataset.homeTransition !== 'true' && host.dataset.cameraFrame?.split(',').length === 32;
    }); await paint(page);
}
async function changed(page, before) {
    await page.waitForFunction(before => document.querySelector('[data-testid="island-stage"]')?.dataset.cameraView !== before, JSON.stringify(before)); await paint(page);
}
async function reset(page) {
    await button(page, 'もとの ながめ').click();
    await page.waitForFunction(() => { const v = JSON.parse(document.querySelector('[data-testid="island-stage"]').dataset.cameraView);
        return v.zoom === 1 && Math.abs(v.azimuth) < 1e-8 && Math.abs(v.pan.x) < 1e-8 && Math.abs(v.pan.y) < 1e-8; }); await paint(page);
}
function project(values, point, box) {
    const world = new Matrix4().fromArray(values.slice(0, 16)), projection = new Matrix4().fromArray(values.slice(16));
    const ndc = new Vector3(...point).applyMatrix4(world.invert()).applyMatrix4(projection);
    return { x: box.x + (ndc.x + 1) * box.width / 2, y: box.y + (1 - ndc.y) * box.height / 2 };
}
function unproject(values, pixel, box) {
    const matrix = new Matrix4().fromArray(values.slice(0, 16)).multiply(new Matrix4().fromArray(values.slice(16)).invert());
    return new Vector3((pixel.x - box.x) / box.width * 2 - 1, 1 - (pixel.y - box.y) / box.height * 2, 0).applyMatrix4(matrix).toArray();
}
async function capture(page, row, name) {
    await world(page); const file = row.name + '-' + name;
    await page.screenshot({ path: path.join(out, file + '.png') }); await stage(page).screenshot({ path: path.join(out, file + '-world.png') });
    const metadata = await runtimeMetadata(page); assert.equal(metadata.revision, manifest.revision); assert.equal(metadata.renderer, 'three');
    report.captures.push({ file: file + '.png', ...metadata, fixture: row.fixture, view: await view(page), camera: await frame(page) });
}
async function exact(page, row, name, baseline) {
    const actual = await tables(page); await fs.writeFile(path.join(out, row.name + '-native-' + name + '.json'), JSON.stringify(actual, null, 2));
    assert.deepEqual(actual, baseline, name + ': every native store must remain unchanged'); row.checks.push(name);
}
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

async function gestures(page, context, row) {
    await world(page);
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 2, radiusY: 2, force: 1 })) });
    const canvas = stage(page).locator('canvas'), box = await canvas.boundingBox();
    const midpoint = { x: box.x + box.width * .51, y: box.y + box.height * .56 };
    for (const control of await toolbar(page).getByRole('button').all()) { const size = await control.boundingBox(); assert(size.width >= 44 && size.height >= 44 && size.x >= 0 && size.x + size.width <= row.width); }
    assert.equal(await canvas.evaluate(node => getComputedStyle(node).touchAction), 'none');
    const baseline = await tables(page); await fs.writeFile(path.join(out, row.name + '-native-baseline.json'), JSON.stringify(baseline, null, 2));
    const original = await frame(page), anchor = unproject(original, midpoint, box);
    await touch('touchStart', [[1, midpoint.x - 30, midpoint.y], [2, midpoint.x + 30, midpoint.y]]);
    for (let step = 1; step <= 5; step++) await touch('touchMove', [[1, midpoint.x - 30 - step * 6, midpoint.y], [2, midpoint.x + 30 + step * 6, midpoint.y]]);
    await touch('touchEnd', [[1, midpoint.x - 60, midpoint.y]]); await touch('touchEnd', []);
    await page.waitForFunction(() => Math.abs(JSON.parse(document.querySelector('[data-camera-view]').dataset.cameraView).zoom - 2) < .001);
    const anchored = project(await frame(page), anchor, box); assert(Math.hypot(anchored.x - midpoint.x, anchored.y - midpoint.y) < 2, 'Pinch preserves its actual rendered focus');
    assert.equal((await view(page)).azimuth, 0); await waitMode(page, 'home'); await capture(page, row, 'pinch');
    for (const [name, dx, dy] of [['horizontal', -70, 0], ['vertical', 0, 55]]) {
        const before = await view(page), scroll = await page.locator('.island-page').evaluate(node => node.scrollTop);
        await touch('touchStart', [[1, midpoint.x, midpoint.y]]);
        for (let step = 1; step <= 5; step++) await touch('touchMove', [[1, midpoint.x + dx * step / 5, midpoint.y + dy * step / 5]]);
        await touch('touchEnd', []); await changed(page, before); const after = await view(page);
        assert(Math.abs(after.pan[dx ? 'x' : 'y'] - before.pan[dx ? 'x' : 'y']) > .1); assert.equal(after.azimuth, before.azimuth);
        assert.equal(await page.locator('.island-page').evaluate(node => node.scrollTop), scroll); await waitMode(page, 'home'); await capture(page, row, name);
    }
    const beforeResize = await view(page); await page.setViewportSize({ width: row.width - 10, height: row.height + 30 }); await world(page);
    const resized = await view(page); assert.equal(resized.zoom, beforeResize.zoom); assert(Math.abs(resized.pan.x - beforeResize.pan.x) < .001 && Math.abs(resized.pan.y - beforeResize.pan.y) < .001);
    await page.setViewportSize({ width: row.width, height: row.height }); await world(page);
    await touch('touchStart', [[1, midpoint.x, midpoint.y]]); await touch('touchCancel', []); await waitMode(page, 'home');
    await page.mouse.move(midpoint.x, midpoint.y); await page.mouse.down(); await page.mouse.move(midpoint.x + 40, midpoint.y + 20, { steps: 5 }); await page.mouse.up(); await waitMode(page, 'home');
    await reset(page); await page.mouse.move(midpoint.x, midpoint.y); await page.mouse.wheel(0, -100);
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-camera-view]').dataset.cameraView).zoom > 1.1);
    await button(page, 'しまを みぎに まわす').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => Math.abs(JSON.parse(document.querySelector('[data-camera-view]').dataset.cameraView).azimuth - Math.PI / 6) < .0001);
    await reset(page); await exact(page, row, 'gestures', baseline);
    // Native page scrolling still belongs to content outside the camera surface.
    await page.setViewportSize({ width: row.width, height: 500 }); await world(page);
    await page.locator('.island-home-records').scrollIntoViewIfNeeded(); const outside = await page.locator('.island-home-records').boundingBox();
    const priorScroll = await page.locator('.island-page').evaluate(node => node.scrollTop), outsideY = Math.min(420, outside.y + outside.height / 2);
    assert(priorScroll > 0, 'There must be actual outside-page scroll range before the native gesture');
    const worldBox = await canvas.boundingBox(); assert(outsideY > worldBox.y + worldBox.height, 'Page-scroll gesture must start outside canvas');
    await touch('touchStart', [[1, row.width / 2, outsideY]]);
    for (let step = 1; step <= 5; step++) await touch('touchMove', [[1, row.width / 2, outsideY + step * 13]]);
    await touch('touchEnd', []);
    await page.waitForFunction(before => document.querySelector('.island-page').scrollTop !== before, priorScroll);
    await page.setViewportSize({ width: row.width, height: row.height }); await world(page); await exact(page, row, 'outside-scroll', baseline);
    return baseline;
}
async function genuine(page, context, row) {
    await page.goto(target + '/#/island'); await waitReady(page); const empty = await tables(page);
    assert.equal(empty.profiles.length, 0); assert.equal(empty.islands.length, 0); await capture(page, row, 'welcome');
    await button(page, 'まなぶ').click(); await page.locator('.island-setup-name input').fill('カメラ' + row.name);
    await button(page, '年中').click(); await button(page, 'さんすう').click(); await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
    await waitMode(page, 'learning'); await assertKeypad(page); const native = await readNative(page); row.owner = native.plan.profileId;
    assert.equal(native.island.completedSets, 0); assert.equal(native.plan.cursor, 0); assert.equal(native.logs.length, 0);
    await button(page, 'しまへ').click(); await waitMode(page, 'home'); const baseline = await gestures(page, context, row);
    // Use the actual 32-value camera and the known physical cottage center. Runtime ray selection must hit the shell.
    const box = await stage(page).locator('canvas').boundingBox(), home = project(await frame(page), [-2.6, 1.25, -1.65], box);
    assert(home.x > box.x && home.x < box.x + box.width && home.y > box.y && home.y < box.y + box.height);
    await page.touchscreen.tap(home.x, home.y); await waitMode(page, 'keepsakes'); await world(page); assert.equal(await toolbar(page).count(), 0);
    await capture(page, row, 'house-actual-shell'); await exact(page, row, 'house-enter', baseline);
    await page.locator('[data-keepsake-action="close"]').click(); await waitMode(page, 'home');
    // Interrupt the outgoing house transition with a real manual action; its later tick must not take control back.
    await button(page, 'しまを おおきく').click(); await paint(page); const controlled = await frame(page);
    await page.waitForTimeout(600); assert.deepEqual(await frame(page), controlled); await exact(page, row, 'house-exit', baseline);
    await page.locator('.island-start').click(); await waitMode(page, 'learning'); await assertKeypad(page); assert.equal(await toolbar(page).count(), 0);
    const reserved = (await readNative(page, row.owner)).plan; assert.deepEqual(reserved, native.plan);
    const learningBefore = await tables(page); await answerUI(page, reserved, { dev: false, touch: true }); await assertKeypad(page);
    const after = await tables(page); assert.deepEqual(after.islands, learningBefore.islands);
    const learningTables = ['profiles', 'appData', 'logs', 'memoryMath', 'memoryVocab', 'islandPlans', 'islandEvents'];
    for (const name of Object.keys(after)) if (!learningTables.includes(name)) assert.deepEqual(after[name], learningBefore[name], name);
    assert.equal(after.logs.length, learningBefore.logs.length + 1); assert.equal((await readNative(page, row.owner)).plan.cursor, reserved.cursor + 1);
    await fs.writeFile(path.join(out, row.name + '-native-answer.json'), JSON.stringify({ before: learningBefore, after }, null, 2));
    await page.screenshot({ path: path.join(out, row.name + '-learning-input.png') }); row.realAnswers = 1; row.pass = true;
    return native.island;
}
async function mature(page, context, row, original) {
    await page.goto(target + '/#/island'); await waitReady(page); const empty = await tables(page); assert.equal(empty.islands.length, 0); assert.equal(empty.profiles.length, 0);
    row.owner = original.profileId; await seedNative(page, row.owner);
    const fixture = structuredClone(original); delete fixture.pendingPlanId;
    fixture.completedSets = 24; fixture.growth.expansionLevel = 2; fixture.growth.progress = { garden: 6, waterside: 6, grove: 6, village: 6 };
    // Store the same two possessions to isolate terrain/camera from spontaneous furniture discovery writes.
    fixture.items.forEach(item => { delete item.position; });
    await page.evaluate(async fixture => {
        const request = indexedDB.open('SansuDatabase'), db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try { const tx = db.transaction('islands', 'readwrite'); tx.objectStore('islands').put(fixture);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
    }, fixture);
    await fs.writeFile(path.join(out, row.name + '-declared-fixture.json'), JSON.stringify({ acquisitionEvidence: false, original, fixture }, null, 2));
    await page.reload(); await waitMode(page, 'home'); await world(page);
    const baseline = await tables(page); assert.deepEqual(baseline.islands, [fixture]);
    await button(page.getByRole('group', { name: 'ながめる ばしょ' }), 'しまぜんぶ').click(); await world(page);
    await capture(page, row, 'all-1x'); const originalFrame = await frame(page);
    for (let count = 0; count < 12 && (await view(page)).zoom < 6; count++) {
        const before = await view(page);
        await button(page, 'しまを おおきく').click();
        await page.waitForFunction(expected => JSON.parse(document.querySelector('[data-camera-view]').dataset.cameraView).zoom === expected,
            Math.min(6, before.zoom * 1.25)); await paint(page);
    }
    assert.equal((await view(page)).zoom, 6); assert.equal(await button(page, 'しまを おおきく').isDisabled(), true); await capture(page, row, 'all-6x');
    const box = await stage(page).locator('canvas').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    for (const [name, dx, dy] of [['east-bound', -box.width * .8, 0], ['west-bound', box.width * .8, 0], ['north-bound', 0, box.height * .7], ['south-bound', 0, -box.height * .7]]) {
        let stable = false;
        for (let step = 0; step < 30; step++) {
            const before = await view(page); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 3 }); await page.mouse.up(); await paint(page);
            const current = await view(page); if (Math.hypot(current.pan.x - before.pan.x, current.pan.y - before.pan.y) < .00001) { stable = true; break; }
        }
        assert(stable, 'Finite island pan bound was not reached'); assert(Math.abs((await view(page)).pan.x) < 30 && Math.abs((await view(page)).pan.y) < 20);
        await waitMode(page, 'home'); await capture(page, row, name);
    }
    await reset(page); assert.deepEqual(await frame(page), originalFrame);
    for (const label of ['ひがし', 'にし', 'にわ']) {
        await button(page.getByRole('group', { name: 'ながめる ばしょ' }), label).click(); await world(page);
        const value = await view(page); assert.equal(value.zoom, 1); assert.deepEqual(value.pan, { x: 0, y: 0 }); await capture(page, row, 'district-' + label);
    }
    const localBox = await stage(page).locator('canvas').boundingBox(), localBefore = await frame(page);
    // Actual ISLAND_EAST_LAND center from this frozen catalog. A wide tablet
    // already sees much of it at 1x: compare the rendered destination, not a
    // phone-specific minimum world pan distance.
    const eastCenter = [7.3, 0, 0], beforeEast = project(localBefore, eastCenter, localBox);
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 300, y, { steps: 6 }); await page.mouse.up(); await paint(page);
    const localAfter = await frame(page), afterEast = project(localAfter, eastCenter, localBox), actualView = await view(page);
    const offset = point => ({ x: (point.x - localBox.x) / localBox.width * 2 - 1, y: 1 - (point.y - localBox.y) / localBox.height * 2 });
    row.swipeToEast = { catalogTarget: eastCenter, beforeCamera: localBefore, afterCamera: localAfter,
        before: offset(beforeEast), after: offset(afterEast), actualView };
    assert(actualView.pan.x > 0); assert.notDeepEqual(localAfter, localBefore);
    assert(Math.abs(offset(afterEast).x) < Math.abs(offset(beforeEast).x));
    assert(Math.abs(offset(afterEast).x) < .7 && Math.abs(offset(afterEast).y) < .7, 'Actual eastern land center reaches the middle 70% of the rendered viewport');
    await capture(page, row, 'home-swipe-next-land'); await exact(page, row, 'mature-all-camera', baseline); row.pass = true;
}
const { chromium } = await import('playwright'); const browser = await chromium.launch();
try {
    for (const layout of layouts) {
        let original;
        for (const fixture of [false, true]) {
            const row = { ...layout, name: layout.name + (fixture ? '-mature-fixture' : '-genuine'), fixture, checks: [], pass: false, pageErrors: [] }; report.scenarios.push(row);
            const context = await browser.newContext({ viewport: { width: layout.width, height: layout.height }, hasTouch: true, serviceWorkers: 'block', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
            const page = await context.newPage(); page.on('pageerror', error => row.pageErrors.push(error.message));
            try { if (fixture) await mature(page, context, row, original); else original = await genuine(page, context, row);
                assert.deepEqual(row.pageErrors, []); console.log('PASS ' + row.name); }
            catch (error) { row.pass = false; row.error = error.stack; await page.screenshot({ path: path.join(out, row.name + '-failure.png') }).catch(() => {});
                await fs.writeFile(path.join(out, row.name + '-native-failure.json'), JSON.stringify(await tables(page), null, 2)).catch(() => {}); throw error; }
            finally { await context.close(); }
        }
    }
    report.pass = true;
} finally {
    try { report.finalSource = await fingerprint(); assert.deepEqual(report.finalSource, initialSource); report.sourceStable = true; }
    catch (error) { report.pass = false; report.sourceError = error.stack; }
    await browser.close(); report.browserClosed = true; report.completedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
