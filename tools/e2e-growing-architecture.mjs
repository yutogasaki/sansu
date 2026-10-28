import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { seedNative, readNative, runtimeMetadata, openGrowingAction } from './island-e2e-helpers.mjs';
import { productionCellPoint, disposeProductionProjection } from './growing-production-helpers.mjs';
const base = process.env.SANSU_ARCHITECTURE_URL, out = process.env.SANSU_ARCHITECTURE_OUTPUT;
assert(base && out && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
await fs.mkdir(out, { recursive: false });
const compiled = await build({ stdin: { contents: `export {architectureFixture} from './src/domain/growingIsland/placeArchitecture.fixture';export {derivePlaces} from './src/domain/growingIsland/places';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { architectureFixture, derivePlaces } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const read = (page, id) => page.evaluate(async id => {
    const request = indexedDB.open('SansuGrowingIslandV1'); const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
    try { const op = db.transaction('foundationIslands').objectStore('foundationIslands').get(id); return await new Promise((ok, no) => { op.onsuccess = () => ok(op.result); op.onerror = () => no(op.error); }); } finally { db.close(); }
}, id);
const report = { at: new Date().toISOString(), target: base, scope: 'Explicit mature architecture fixtures in disposable production profiles. Fixed UTC-noon real renderer, pointer activation, receipts and offline reload; not earned maturity, visual approval, real-device or child evidence.', cases: [], pass: false };
report.version = await fetch(`${base}/version.json`).then(r => r.json());
const inputFiles = ['src/domain/growingIsland/communityRoof.ts', 'src/domain/growingIsland/placeCapability.ts', 'src/domain/growingIsland/places.ts', 'src/components/island/growing/placeCommunityRoofGeometry.ts', 'src/components/island/growing/placeGeometry.ts', 'src/components/island/growing/placeFlowerGeometry.ts', 'src/components/island/growing/objectLayer.ts', 'src/components/island/growing/GrowingWorld.tsx', 'src/components/island/growing/GrowingIsland.tsx', 'src/components/island/growing/GrowingSheet.tsx', 'src/components/island/growing/growingLife.ts', 'src/components/island/growing/growingCamera.ts', 'src/domain/growingIsland/placeArchitecture.fixture.ts', 'tools/e2e-growing-architecture.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputFiles.map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
report.inputs = await hashes();
const browser = await chromium.launch(); let active;
const names = process.env.SANSU_ARCHITECTURE_CASE ? [process.env.SANSU_ARCHITECTURE_CASE] : ['shared-roof', 'long-grove', 'hollow-court', 'flower-arch'];
assert(names.every(name => ['shared-roof', 'long-grove', 'hollow-court', 'flower-arch', 'flower-canopy-addition', 'grove-side-addition', 'shade-young-addition'].includes(name)));
report.requestedCases = names;
const ready = async page => { await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 900 : 1024 }, hasTouch: true, timezoneId: 'UTC', reducedMotion: width === 768 ? 'reduce' : 'no-preference', serviceWorkers: 'allow' });
        const page = active = await context.newPage(); page.setDefaultTimeout(30000); await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/island`); const id = await seedNative(page, randomUUID()); await page.reload(); await ready(page);
        const learning = await readNative(page, id);
        for (const name of names) {
            const state = architectureFixture(); state.seed = id; state.nature.realAt = Date.parse('2026-10-20T12:00:00Z'); state.guidance.starter.automatic = false;
            state.villagers = []; // Explicit hero-operation fixture; shared residents have separate coverage.
            if (name !== 'shared-roof') {
                state.plots[0].cell = { x: 0, z: 5 }; state.plots[1].cell = { x: 3, z: 5 };
                const flower = name.startsWith('flower-');
                const cells = name === 'shade-young-addition' ? [[4, 3], [5, 3]] : name === 'flower-canopy-addition' ? [[2, 2], [3, 2], [2, 3], [3, 3], [4, 3]]
                    : name === 'grove-side-addition' ? [[2, 2], [3, 2], [4, 2], [5, 2], [5, 3]]
                    : name === 'hollow-court' ? [[7, 1], [9, 1], [7, 3], [9, 3]] : Array.from({ length: 6 }, (_, x) => [x + 1, 3]);
                state.landmarks = cells.map(([x, z], i) => ({ id: `source-${i}`, kind: flower ? 'flower' : 'sapling', cell: { x, z }, growth: flower ? 6 : 18, maturedAt: 0, ...(flower ? { color: i % 2 ? 'blue' : 'red' } : {}) }));
            }
            if (name === 'shade-young-addition') { state.landmarks[1].growth = 0; delete state.landmarks[1].maturedAt; }
            const places = derivePlaces(state), place = places.find(p => p.ruleId === (name === 'shared-roof' ? 'P04' : name.startsWith('flower-') ? 'P05' : name === 'shade-young-addition' ? 'P01' : 'P02'));
            if (name === 'flower-canopy-addition') assert.deepEqual(place.flowerRoofs, [{ variant: 'canopy', mainIds: ['source-0', 'source-1', 'source-2', 'source-3'] }]);
            if (name === 'grove-side-addition') assert.deepEqual(place.mainIds, ['source-0', 'source-1', 'source-2', 'source-3']);
            if (name === 'shade-young-addition') { assert.deepEqual(place.mainIds, ['source-0']); assert.equal(place.treeForm, 'individual'); }
            assert.equal(place?.stage, 'grown');
            if (name === 'shared-roof') assert.equal(place.structure, 'P04:shared-roof');
            await page.evaluate(async ({ id, state }) => {
                const request = indexedDB.open('SansuGrowingIslandV1'); const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
                try { const tx = db.transaction('foundationIslands', 'readwrite'), table = tx.objectStore('foundationIslands'), get = table.get(id);
                    const row = await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); }); row.state = state; row.revision++; table.put(row);
                    await new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
                } finally { db.close(); }
            }, { id, state });
            await page.reload(); await ready(page); await page.waitForTimeout(1000);
            assert((await page.locator('[data-growing-world]').getAttribute('data-place-topology')).includes(`${place.ruleId}:`));
            await page.screenshot({ path: `${out}/${width}-${name}.png` });
            await openGrowingAction(page, 'ながめ');
            await page.getByRole('button', { name: 'しま全体', exact: true }).tap();
            await page.getByRole('button', { name: 'ながめを とじる', exact: true }).tap();
            await page.screenshot({ path: `${out}/${width}-${name}-overview.png` });
            const owners = [...state.plots, ...state.landmarks].filter(owner => place.mainIds.includes(owner.id));
            const sheet = page.locator('.growing-sheet');
            const expectedTitle = ['P01', 'P02'].includes(place.ruleId) ? '木の なえ' : place.ruleId === 'P05' ? 'おはな' : undefined;
            const isCorrectSheet = async () => await sheet.isVisible() && (!expectedTitle || await sheet.getAttribute('aria-label') === expectedTitle)
                && await sheet.getByRole('button', { name: 'ここで すごす', exact: true }).isVisible();
            const selectionEnd = Date.now() + 20000; let attempt = 0;
            while (Date.now() < selectionEnd && !await isCorrectSheet()) {
                if (await sheet.isVisible()) await sheet.getByRole('button', { name: 'とじる', exact: true }).tap();
                const owner = owners[attempt % owners.length], elevation = [.26, 1.2, 2][Math.floor(attempt / owners.length) % 3]; attempt++;
                const point = await productionCellPoint(page, state, owner.cell, owner.kind === 'home' ? .6 : elevation);
                await page.touchscreen.tap(point.x, point.y); await page.waitForTimeout(200);
            }
            assert(await isCorrectSheet(), `Must select actual ${expectedTitle ?? 'home'} rather than a neighboring object`);
            const selectionTitle = await sheet.getAttribute('aria-label');
            await sheet.getByRole('button', { name: 'ここで すごす', exact: true }).tap();
            await sheet.waitFor({ state: 'hidden' });
            await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingPlaceFocus === id, place.id, { timeout: 10000 });
            const commandFocus = await page.locator('[data-growing-world]').getAttribute('data-growing-place-focus');
            assert.equal(commandFocus, place.id, 'Camera must follow the actual chosen place');
            const limit = Date.now() + 60000; let saved;
            do { saved = await read(page, id); if (saved.state.placeProgress?.uses[place.ruleId]?.pokomoko) break; await page.waitForTimeout(250); } while (Date.now() < limit);
            // A real visible place command was issued; receipt still requires foreground arrival.
            assert(saved.state.placeProgress?.uses[place.ruleId]?.pokomoko, `Missing real ${name} Poko use`);
            await page.screenshot({ path: `${out}/${width}-${name}-use.png` });
            const canvasBox = await page.locator('[data-growing-world] canvas').boundingBox();
            const drag = { x: canvasBox.x + canvasBox.width * .2, y: canvasBox.y + canvasBox.height * .35 };
            await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await page.mouse.move(drag.x + 35, drag.y + 15, { steps: 4 }); await page.mouse.up();
            await page.waitForFunction(() => !document.querySelector('[data-growing-world]')?.dataset.growingPlaceFocus);
            const manualPose = await page.locator('[data-growing-world]').getAttribute('data-growing-camera');
            await page.waitForTimeout(1200); assert.equal(await page.locator('[data-growing-world]').getAttribute('data-growing-camera'), manualPose, 'Manual camera must stay in control');
            assert.deepEqual(await readNative(page, id), learning);
            const metadata = await runtimeMetadata(page); assert.equal(metadata.appRoot.version, report.version.version);
            report.cases.push({ width, name, selectionTitle, commandFocus, manualCameraPreserved: true, topology: place.variant, mainIds: place.mainIds, structure: place.structure, actualUse: saved.state.placeProgress.uses[place.ruleId].pokomoko, metadata, pass: true });
            if (name === 'shared-roof') {
                await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await ready(page); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
                await context.setOffline(true); await page.reload(); await ready(page); assert.deepEqual((await read(page, id)).state.plots, saved.state.plots); await context.setOffline(false);
            }
        }
        assert.deepEqual(errors, []); await context.close();
    }
    assert.deepEqual(await hashes(), report.inputs); report.pass = true;
} catch (error) { report.error = error.stack; if (active && !active.isClosed()) { report.body = await active.locator('body').innerText().catch(() => undefined); await active.screenshot({ path: `${out}/failure.png` }).catch(() => {}); } throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); disposeProductionProjection(); }
console.log('PASS architecture renderer and actual use:', report.cases.length, 'cases; offline reload only for shared-roof');
