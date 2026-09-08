import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { answerUI, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_WORKSHOP_GESTURES_OUTPUT;
assert(target && out, 'Set target and fresh SANSU_ISLAND_WORKSHOP_GESTURES_OUTPUT');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = process.env.SANSU_ISLAND_BUILD_SOURCE ? JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE)) : undefined;
const checkSource = async () => {
    if (manifest) for (const file of manifest.files) assert.equal(sha(await fs.readFile(file.path)), file.sha256, `Frozen source changed: ${file.path}`);
};
await checkSource();
const report = { target, revision: manifest?.revision, startedAt: new Date().toISOString(), pass: false, humanN: 0,
    harnessSha256: sha(await fs.readFile(new URL(import.meta.url))), captures: [], checks: [],
    scope: 'Actual mouse/touch rays, cancel, hold, fast brushing, assembly socket, drag collision/outside, undo/redo and same learning. Empty DB; no progress/specimen/layout fixtures.' };
const browser = await chromium.launch();
const stage = page => page.locator('[data-testid="island-stage"]');
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
const scene = page => stage(page).evaluate(node => JSON.parse(node.getAttribute('data-workshop')));
async function waitState(page, predicate, description) {
    const start = Date.now();
    while (Date.now() - start < 15000) {
        const native = await readNative(page);
        if (predicate(native.island?.workshop)) { await idle(page); return native; }
        await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw new Error(`Missing ${description}`);
}
async function point(page, choose) {
    await stage(page).scrollIntoViewIfNeeded();
    const anchors = await stage(page).evaluate(node => JSON.parse(node.getAttribute('data-workshop-anchors')));
    const xy = choose(anchors), box = await page.locator('[data-testid="island-stage"] canvas').boundingBox();
    assert(xy?.length === 2 && box, 'Actual geometry must be projected into the current canvas');
    assert(xy[0] >= 0 && xy[0] <= box.width && xy[1] >= 0 && xy[1] <= box.height, 'Gesture target must be visible');
    return { x: box.x + xy[0], y: box.y + xy[1] };
}
async function capture(page, name) {
    await stage(page).scrollIntoViewIfNeeded();
    const metadata = await runtimeMetadata(page);
    if (manifest) assert.equal(metadata.revision, manifest.revision);
    const bytes = await stage(page).screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    report.captures.push({ name, sha256: sha(bytes), ...metadata, workshop: await scene(page) });
}
const woodMask = state => state?.specimens.driftwood.cleanedMask ?? 0;
function keepLearning(before, after) {
    for (const table of ['islandPlans', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) assert.deepEqual(after[table], before[table], `${table} changed from gestures`);
    const strip = value => { const copy = structuredClone(value); delete copy.workshop; delete copy.revision; delete copy.updatedAt; return copy; };
    assert.deepEqual(strip(after.island), strip(before.island));
}
try {
    for (const mode of ['phone', 'tablet']) {
        const touch = mode === 'phone';
        const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 768, height: 1024 },
            hasTouch: touch, serviceWorkers: 'block', reducedMotion: touch ? 'no-preference' : 'reduce' });
        const page = await context.newPage(), cdp = await context.newCDPSession(page), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let pressed;
        const down = async p => { pressed = p; if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] }); else { await page.mouse.move(p.x, p.y); await page.mouse.down(); } };
        const move = async p => { pressed = p; if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] }); else await page.mouse.move(p.x, p.y, { steps: 3 }); };
        const up = async () => { if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up(); pressed = undefined; };
        const cancel = async () => {
            if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
            else { await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }))); await page.mouse.up(); }
            pressed = undefined;
        };
        const drag = async (from, to) => { await down(from); await move(to); await up(); };
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitMode(page, 'learning');
            let native = await readNative(page); const planId = native.plan.id;
            for (let count = 0; native.plan.id === planId; count++) {
                assert(count < 80); native = (await answerUI(page, native.plan, { touch, dev: false })).state;
            }
            assert.equal(native.island.completedSets, 1); const baseline = native;
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, 'おためしの いりえ').click(); await waitMode(page, 'workshop');
            await idle(page);
            const sand = section => point(page, a => a.specimens.driftwood.sand[section]);
            await down(await sand(0));
            await page.waitForTimeout(450);
            assert.equal(woodMask((await readNative(page)).island.workshop), 0, 'Holding a brush does not award cleaned sections');
            await cancel();
            await page.waitForTimeout(350);
            assert.equal(woodMask((await readNative(page)).island.workshop), 0, 'Cancelled brush has no saved contact');
            report.checks.push({ mode, name: 'hold and cancel preserve covered surface', pass: true, cancellation: touch ? 'native touchCancel' : 'synthetic OS-style pointercancel; real mouse down/up' });
            await down(await sand(0));
            for (const section of [1, 2, 5, 4, 3]) await move(await sand(section));
            await up();
            await waitState(page, state => woodMask(state) === 63 && state.specimens.driftwood.observations.some(o => o.result === 'clean'), 'one fast stroke cleans all six actual contacts');
            await capture(page, `${mode}-01-direct-brush`);
            report.checks.push({ mode, name: 'one direct stroke observes six sections', pass: true });
            await button(page, 'みずへ おく').click();
            await waitState(page, state => state?.specimens.driftwood.identity, 'actual floating identifies the wood');
            const wood = () => point(page, a => a.specimens.driftwood.center);
            const lamp = await point(page, a => a.stations.lamp);
            await drag(await wood(), lamp);
            await waitState(page, state => state?.specimens.driftwood.observations.some(o => o.result === 'opaque'), 'dragged wood casts its shadow');
            assert.equal((await scene(page)).stations.driftwood, 'lamp');
            await capture(page, `${mode}-02-dragged-wood`);
            const beforeOutside = await scene(page), box = await stage(page).boundingBox();
            await drag(await wood(), { x: box.x + box.width - 8, y: box.y + 8 });
            await page.waitForTimeout(200);
            const afterOutside = await scene(page);
            assert.equal(afterOutside.stations.driftwood, beforeOutside.stations.driftwood);
            assert.deepEqual(afterOutside.specimenPositions.driftwood, beforeOutside.specimenPositions.driftwood);
            report.checks.push({ mode, name: 'specimen drag and invalid drop preserve the same object', pass: true });
            await button(page, 'つくる').click(); await idle(page);
            for (const id of ['straight', 'elbow']) {
                const socket = await point(page, a => a.parts[id].socket);
                await down(socket); await up();
                await waitState(page, state => state?.draftCheckpoint.draft.layout.parts[id].assembled, `${id} fitted by actual socket`);
            }
            const part = id => point(page, a => a.parts[id].socket);
            const cell = (col, row) => point(page, a => a.grid.find(c => c.col === col && c.row === row).world);
            await drag(await part('straight'), await cell(0, 1));
            await waitState(page, state => state?.draftCheckpoint.draft.layout.parts.straight.position?.col === 0, 'straight dragged onto board');
            await drag(await part('elbow'), await cell(1, 1));
            const placed = await waitState(page, state => state?.draftCheckpoint.draft.layout.parts.elbow.position?.col === 1, 'elbow dragged onto board');
            await drag(await part('straight'), await cell(1, 1));
            await page.waitForTimeout(200);
            assert.deepEqual((await readNative(page)).island.workshop.draftCheckpoint, placed.island.workshop.draftCheckpoint, 'Occupied cell cannot replace either part or add undo history');
            await drag(await part('straight'), { x: box.x + box.width - 8, y: box.y + 8 });
            await page.waitForTimeout(200);
            assert.deepEqual((await readNative(page)).island.workshop.draftCheckpoint, placed.island.workshop.draftCheckpoint, 'Outside release preserves placement');
            await capture(page, `${mode}-03-collision-recovery`);
            for (const col of [2, 3, 2]) {
                await drag(await part('straight'), await cell(col, 1));
                await waitState(page, state => state?.draftCheckpoint.draft.layout.parts.straight.position?.col === col, `FIFO direct move to ${col}`);
            }
            const moved = await readNative(page);
            assert.equal(moved.island.workshop.draftCheckpoint.draft.undo.length, placed.island.workshop.draftCheckpoint.draft.undo.length + 3);
            await button(page, 'ひとつ もどす').click();
            await waitState(page, state => state?.draftCheckpoint.draft.layout.parts.straight.position?.col === 3, 'undo latest actual gesture');
            await button(page, 'やりなおす').click();
            const redone = await waitState(page, state => state?.draftCheckpoint.draft.layout.parts.straight.position?.col === 2, 'redo actual gesture');
            keepLearning(baseline, redone);
            report.checks.push({ mode, name: 'real sockets, drag collisions, A-B-A, undo and redo', pass: true });
            await button(page, 'まなぶ').click(); await waitMode(page, 'learning');
            const learning = await readNative(page); assert.deepEqual(learning.plan, baseline.plan);
            await answerUI(page, learning.plan, { touch, dev: false });
            assert.deepEqual(errors, []);
            console.log(`PASS ${mode}: actual workshop gestures and unchanged learning`);
        } catch (error) {
            if (pressed) await cancel().catch(() => {});
            await capture(page, `${mode}-failure`).catch(() => {});
            await fs.writeFile(`${out}/${mode}-native.json`, JSON.stringify(await readNative(page).catch(() => null), null, 2));
            report.errors = errors; throw error;
        } finally { await context.close(); }
    }
    await checkSource(); report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
