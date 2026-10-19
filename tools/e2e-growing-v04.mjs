import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { seedNative, openGrowingAction, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { plantProduction } from './growing-production-helpers.mjs';
const base = process.env.SANSU_GROWTH_V04_URL, out = process.env.SANSU_GROWTH_V04_OUTPUT;
assert(base && out, 'Specify loopback preview and fresh evidence output');
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
await fs.mkdir(out, { recursive: false });
const files = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(item => item.isDirectory() ? files(`${dir}/${item.name}`) : [`${dir}/${item.name}`]))).flat();
const inputs = [...(await files('src')).filter(name => !/\.(test|fixture)\./.test(name)), 'tools/e2e-growing-v04.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async name => [name, createHash('sha256').update(await fs.readFile(name)).digest('hex')])));
const report = { at: new Date().toISOString(), target: base, inputs: await hashes(), cases: [], timezone: 'UTC', pass: false,
    scope: 'Disposable native profile; real free home and catalog. Explicit legacy Growing snapshot for parent recovery and stored-property diagnostics. An explicit two-grown-home layout diagnoses real rendered garden use; no claim of earned paid purchases, elapsed natural growth, real two-build recovery or child comprehension.' };
const browser = await chromium.launch();
let active;
const ready = async page => { await page.locator('[data-growing-island="ready"]').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
async function record(page, id, change) {
    return page.evaluate(async ({ id, change }) => {
        const request = indexedDB.open('SansuGrowingIslandV1');
        const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
        try {
            const tx = db.transaction('cultivatedIslands', change ? 'readwrite' : 'readonly'), table = tx.objectStore('cultivatedIslands');
            const op = table.get(id), value = await new Promise((ok, no) => { op.onsuccess = () => ok(op.result); op.onerror = () => no(op.error); });
            if (change === 'garden') {
                const home = value.state.plots.find(p => p.kind === 'home');
                home.stage = 2;
                value.state.plots = [home, { ...home, id: 'garden-diagnostic-home', cell: { x: 3, z: 3 } }];
                value.state.landmarks = []; value.state.arrivals = []; value.state.unopened = [];
                value.state.placeProgress = { version: 1, milestones: {}, uses: {}, shown: {}, useHistory: [] };
            } else if (change) {
                delete value.state.growth; value.version = 1; value.state.wonderSeeds = 0;
                value.state.landmarks.push({ id: 'legacy-planter', kind: 'planter', growth: 0 }, { id: 'legacy-bakery', kind: 'bakery', growth: 0 });
            }
            if (change) {
                table.put(value);
                await new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
            }
            return value;
        } finally { db.close(); }
    }, { id, change });
}
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ timezoneId: 'UTC', viewport: { width, height: 900 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = active = await context.newPage(); page.setDefaultTimeout(30000);
        await page.goto(`${base}/#/island`); const id = await seedNative(page, randomUUID()); await page.reload(); await ready(page);
        await plantProduction(page, 'home', { x: 1, z: 3 }, (await record(page, id)).state);
        if (await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).isVisible()) await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).click();
        const first = await record(page, id); assert.equal(first.version, 5); assert.equal(first.state.growth.slots.W1.status, 'granted');
        await openGrowingAction(page, /^しまに おく$/);
        for (const kind of ['home', 'farm', 'wonder']) assert.equal(await page.locator(`[data-growing-seed="${kind}"]`).count(), 1);
        for (const kind of ['wild', 'play', 'market', 'festival']) assert.equal(await page.locator(`[data-growing-seed="${kind}"]`).count(), 0);
        for (const kind of ['planter', 'bakery']) assert.equal(await page.locator(`[data-growing-landmark="${kind}"]`).count(), 0);
        await page.getByRole('button', { name: 'たべもの', exact: true }).click();
        await page.screenshot({ path: `${out}/${width}-food-catalog.png` });
        await record(page, id, true); await page.reload(); await ready(page);
        const learning = await readNative(page, id);
        await page.goto(`${base}/#/parents`); await page.getByText('島の記念を復元', { exact: true }).click();
        await page.getByRole('button', { name: '記念 1 を復元', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'ほごしゃ かくにん' }); await dialog.waitFor();
        assert.equal((await record(page, id)).state.wonderSeeds, 0, 'Opening the parent gate must not restore');
        const expression = (await dialog.innerText()).match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/); assert(expression);
        await dialog.getByLabel('答え', { exact: true }).fill(String(Number(expression[1]) + Number(expression[2])));
        await dialog.getByRole('button', { name: 'OK', exact: true }).click();
        await page.getByText('この島の記念を復元しました。ふしぎのたねから置けます。', { exact: true }).waitFor();
        const restored = await record(page, id); assert.equal(restored.state.wonderSeeds, 1); assert.equal(restored.state.growth.slots.W1.status, 'restored');
        await page.screenshot({ path: `${out}/${width}-parent-recovery.png` });
        await page.goto(`${base}/#/island`); await ready(page);
        await openGrowingAction(page, /^もちもの$/);
        for (const item of ['legacy-planter', 'legacy-bakery']) assert.equal(await page.locator(`[data-growing-stored="${item}"]`).count(), 1);
        await page.screenshot({ path: `${out}/${width}-legacy-inventory.png` });
        assert.deepEqual(await readNative(page, id), learning);
        await record(page, id, 'garden'); await page.reload(); await ready(page);
        const deadline = Date.now() + 90000; let garden;
        do { garden = (await record(page, id)).state.placeProgress?.uses.P04;
            if (garden?.pokomoko && garden?.villager) break;
            await page.waitForTimeout(200);
        } while (Date.now() < deadline);
        assert(garden?.pokomoko && garden?.villager, 'Both existing actors must actually use the rendered garden');
        assert.equal(garden.pokomoko.targetId.endsWith(':garden'), true);
        assert.equal(garden.villager.targetId.endsWith(':garden'), true);
        await page.screenshot({ path: `${out}/${width}-shared-garden.png` });
        await page.locator('.growing-home-goal').click();
        await page.locator('[data-place-goal="P04"]').click();
        await page.getByRole('heading', { name: 'みんなの庭', exact: true }).waitFor();
        await page.locator('.growing-place-layouts summary').click();
        assert((await page.locator('.growing-place-inputs').innerText()).includes('いえ 2けん'));
        assert(!(await page.locator('.growing-place-book').innerText()).includes('あそびば'));
        await page.locator('.growing-place-book').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/${width}-garden-guide.png` });
        assert.deepEqual(await readNative(page, id), learning);
        report.cases.push({ width, gardenUse: garden, parentGateChecked: true, stock: restored.state.wonderSeeds, learningUnchanged: true, metadata: await runtimeMetadata(page) });
        await context.close();
    }
    assert.deepEqual(await hashes(), report.inputs, 'Application inputs changed during journey'); report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (active && !active.isClosed()) { report.body = await active.locator('body').innerText().catch(() => 'unavailable'); await active.screenshot({ path: `${out}/failure.png` }).catch(() => undefined); }
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`PASS v0.4 catalog, free arrival, parent-gated recovery and legacy inventory (${report.cases.length} viewports)`);
