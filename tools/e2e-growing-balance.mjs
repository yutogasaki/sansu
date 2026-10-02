import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, expandGrowingIslandUI, readNative, runtimeMetadata, seedDev, waitForAsync } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_GROWING_URL || 'http://127.0.0.1:5260';
const out = process.env.SANSU_GROWING_OUTPUT;
assert(out, 'Specify a fresh SANSU_GROWING_OUTPUT directory');
await fs.mkdir(out, { recursive: false });
const browser = await chromium.launch();
const report = { target: base, source: 'DEV preview, disposable profiles; real UI learning and explicit land fixture kept separate',
    scenarios: [], captures: [], pass: false };
let activePage;
const world = page => page.locator('[data-growing-world] canvas');
const read = (page, id) => page.evaluate(async id => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    assertPreview(growingDb.name);
    function assertPreview(name) { if (name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV preview only'); }
    return growingDb.islands.get(id);
}, id);
async function ready(page) {
    await page.locator('[data-growing-island="ready"]').waitFor();
    await world(page).waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
}
async function capture(page, label) {
    const file = `${page.viewportSize().width}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), world: await page.locator('[data-growing-world]').count()
        ? await page.locator('[data-growing-world]').evaluate(e => ({ ...e.dataset })) : null });
}
async function tapSeed(page) {
    // The tutorial invitation pulses continuously; use a real touch at its visible hit target.
    const button = page.getByRole('button', { name: 'たね', exact: true });
    await button.waitFor();
    const box = await button.boundingBox(); assert(box);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function cellTap(page, id, cell) {
    const point = await page.evaluate(async ({ id, cell }) => {
        const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
        const { sceneLayout } = await import('/src/components/island/growing/sceneLayout.ts');
        const { frameCamera, initialView } = await import('/src/components/island/growing/growingCamera.ts');
        const T = await import('/node_modules/.vite/deps/three.js');
        const box = document.querySelector('[data-growing-world] canvas').getBoundingClientRect();
        const layout = sceneLayout((await growingDb.islands.get(id)).state), camera = new T.OrthographicCamera();
        frameCamera(camera, layout, initialView(), box.width / box.height); camera.updateMatrixWorld();
        const p = layout.point(cell).project(camera);
        return { x: box.x + (p.x + 1) / 2 * box.width, y: box.y + (1 - p.y) / 2 * box.height };
    }, { id, cell });
    await page.touchscreen.tap(point.x, point.y);
}
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/#/island`);
        const id = await seedDev(page, { familiar: false });
        await page.reload(); await ready(page); await capture(page, 'initial');
        await tapSeed(page);
        await page.locator('[data-growing-seed="home"]').tap();
        await cellTap(page, id, { x: 1, z: 3 });
        await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
        await waitForAsync(page, async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.villagers.length === 1, id);
        await capture(page, 'first-home');
        await page.locator('.island-shell-tab--learn').tap();
        await page.locator('[data-input-ready="true"]').waitFor(); await capture(page, 'learning');
        let native = await readNative(page, id); const first = native.plan.id; let answers = 0;
        while (native.plan.id === first && answers < 12) { native = (await answerUI(page, native.plan, { touch: true })).state; answers++; }
        assert.equal(answers, 3);
        const continuation = { id: native.plan.id, cursor: native.plan.cursor };
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        await waitForAsync(page, async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.learned.length === 3, id);
        assert.equal((await read(page, id)).state.drops, 6);
        await tapSeed(page);
        await page.locator('[data-growing-seed="wild"]').tap(); await cellTap(page, id, { x: 4, z: 2 });
        await capture(page, 'placement');
        await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
        await waitForAsync(page, async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.plots.length === 2, id);
        const planted = await read(page, id); assert.equal(planted.state.drops, 5); assert.equal(planted.state.plots[1].stage, 0);
        await page.reload(); await ready(page); await capture(page, 'saved');
        assert.deepEqual((await read(page, id)).state.learned, planted.state.learned);
        assert.equal((await read(page, id)).state.plots[1].id, planted.state.plots[1].id);
        await page.locator('.island-shell-tab--learn').tap(); await page.locator('[data-input-ready="true"]').waitFor();
        native = await readNative(page, id); assert.equal(native.plan.id, continuation.id); assert.equal(native.plan.cursor, continuation.cursor);
        await page.getByRole('button', { name: 'とじる', exact: true }).tap(); await ready(page);
        report.scenarios.push({ viewport, name: 'real-learning-placement-reload-resume', answers, pass: true });

        // Explicit rich save is diagnostic; this is not an acquired late-game island.
        await page.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            const record = await growingDb.islands.get(id);
            record.version = 1; record.state.drops = 2000; record.state.genki.best = 150;
            record.state.town.bank = 500;
            record.state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
            await growingDb.islands.put(record);
        }, id);
        await page.reload(); await ready(page);
        assert.equal((await read(page, id)).version, 3);
        for (const [side, price] of [['east', 120], ['west', 144], ['south', 168]]) {
            await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
            await expandGrowingIslandUI(page, side, price);
            await waitForAsync(page, async ({ id, side }) => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.land.districts?.includes(side), { id, side });
        }
        await capture(page, 'districts');
        const expanded = await read(page, id); assert.deepEqual(expanded.state.land.districts, ['east', 'west', 'south']);
        assert(expanded.state.town.bank > 0);
        await tapSeed(page);
        assert.match(await page.locator('.growing-tray').innerText(), /じかん/);
        await page.locator('[data-growing-seed="home"]').tap();
        await cellTap(page, id, { x: -7, z: 3 });
        await capture(page, 'district-placement');
        await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
        await waitForAsync(page, async id => (await (await import('/src/domain/growingIsland/repository.ts')).growingDb.islands.get(id))?.state.plots.some(p => p.cell?.x === -7 && p.stage > 0), id);
        await page.reload(); await ready(page); await capture(page, 'district-saved');
        assert.deepEqual((await read(page, id)).state.land.districts, ['east', 'west', 'south']);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        report.scenarios.push({ viewport, name: 'explicit-v1-save-migration-three-directions-banked-time', pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
    report.qaHash = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close(); console.log(JSON.stringify(report, null, 2));
}
