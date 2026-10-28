import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { seedNative, openGrowingAction, runtimeMetadata, readNative } from './island-e2e-helpers.mjs';
import { productionCellPoint } from './growing-production-helpers.mjs';

const base = process.env.SANSU_INVENTORY_URL;
const out = process.env.SANSU_INVENTORY_OUTPUT;
assert(base && out && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Specify local URL and fresh output');
await mkdir(out, { recursive: false });
const inputs = ['src/components/island/growing/GrowingTray.tsx', 'src/components/island/growing/storedCatalog.ts', 'src/components/island/growing/catalogPictures.ts', 'tools/e2e-growing-inventory.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const report = { at: new Date().toISOString(), base, source: await hashes(), scope: 'Disposable DEV fixture with 100 stored benches, variants and awards; UI grouping, filters, cancel, one-owner placement and reload. Not earned acquisition, release/PWA or child observation.', cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : 844 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
        console.log(width, 'launch');
        await page.goto(`${base}/#/island`);
        console.log(width, 'seed profile');
        const id = await seedNative(page, `inventory-${width}`);
        await page.reload(); await page.locator('[data-growing-island="ready"]').waitFor();
        await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
        console.log(width, 'seed stored fixture');
        await page.evaluate(async id => {
            const request = indexedDB.open('SansuGrowingIslandPreviewV1');
            const db = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
            const tx = db.transaction('terrainIslands', 'readwrite'), table = tx.objectStore('terrainIslands');
            const get = table.get(id);
            const record = await new Promise((ok, no) => { get.onsuccess = () => ok(get.result); get.onerror = () => no(get.error); });
            record.state.tutorial = 'done'; record.state.unopened = []; record.state.arrivals = [];
            record.state.plots = [];
            record.state.landmarks = [
                ...Array.from({ length: 100 }, (_, i) => ({ id: `stored-bench-${i}`, kind: 'bench', growth: 0 })),
                { id: 'placed-bench', kind: 'bench', growth: 0, cell: { x: 0, z: 0 } },
                { id: 'pink', kind: 'flower', color: 'pink', growth: 0 },
                { id: 'blue', kind: 'flower', color: 'blue', growth: 0 },
            ];
            record.state.keepsakes = [{ id: 'math-award', unitId: 'math:1' }, { id: 'english-award', unitId: 'english:1' }];
            table.put(record); await new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); }); db.close();
        }, id);
        await page.reload(); await page.locator('[data-growing-island="ready"]').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
        console.log(width, 'fixture ready');
        const learning = await readNative(page, id);
        const metadata = await runtimeMetadata(page);
        await page.screenshot({ path: `${out}/${width}-home.png` });
        console.log(width, 'open stored');
        await openGrowingAction(page, 'もちもの');
        const tray = page.locator('.growing-catalog');
        assert.equal(await tray.locator('[data-growing-stored]').count(), 5);
        assert.match(await tray.innerText(), /ベンチ ×100/);
        assert.match(await tray.getByRole('tab', { name: /もちもの/ }).innerText(), /104/);
        assert.equal(await tray.locator('.growing-catalog-group').first().getAttribute('aria-label'), 'しまに 多いもの');
        await page.screenshot({ path: `${out}/${width}-grouped.png` });
        await tray.getByRole('button', { name: 'あそぶ・やすむ', exact: true }).tap();
        assert.equal(await tray.locator('[data-growing-stored]').count(), 1);
        await tray.locator('[data-growing-stored="stored-bench-0"]').tap();
        await page.getByRole('button', { name: 'やめる', exact: true }).tap();
        await tray.waitFor();
        assert.equal(await tray.getByRole('button', { name: 'あそぶ・やすむ', exact: true }).getAttribute('aria-pressed'), 'true');
        await tray.locator('[data-growing-stored="stored-bench-0"]').tap();
        const state = await page.evaluate(async id => {
            const request = indexedDB.open('SansuGrowingIslandPreviewV1');
            const db = await new Promise(ok => { request.onsuccess = () => ok(request.result); });
            const get = db.transaction('terrainIslands').objectStore('terrainIslands').get(id);
            const value = await new Promise(ok => { get.onsuccess = () => ok(get.result); }); db.close(); return value.state;
        }, id);
        const confirm = page.getByRole('button', { name: 'ここに おく', exact: true });
        for (const cell of [{ x: 0, z: 3 }, { x: 0, z: 1 }, { x: 1, z: 3 }, { x: 3, z: 3 }, { x: 4, z: 2 }]) {
            const point = await productionCellPoint(page, state, cell);
            const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-growing-world]')), point);
            if (!hit) continue;
            await page.touchscreen.tap(point.x, point.y);
            await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
            console.log(width, 'candidate', cell, await page.locator('#growing-placement-message').innerText());
            if (await confirm.isEnabled()) break;
        }
        assert(await confirm.isEnabled(), 'A visible legal fixture location must be selectable');
        await confirm.tap();
        await page.getByRole('button', { name: 'もちもの', exact: true }).waitFor();
        await page.reload(); await page.locator('[data-growing-island="ready"]').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
        await openGrowingAction(page, 'もちもの');
        assert.match(await tray.innerText(), /ベンチ ×99/);
        assert.equal(await tray.locator('[data-growing-stored="stored-bench-1"]').count(), 1);
        assert.deepEqual(await readNative(page, id), learning);
        await page.screenshot({ path: `${out}/${width}-after-placement.png` });
        await tray.getByRole('button', { name: '花・木・水', exact: true }).tap();
        assert.equal(await tray.locator('[data-growing-stored]').count(), 2);
        const bounds = await tray.boundingBox(); assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        await tray.getByRole('button', { name: 'とじる', exact: true }).tap();
        report.cases.push({ width, metadata, pass: true });
        await context.close();
    }
    assert.deepEqual(await hashes(), report.source); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log('PASS grouped inventory, filter/cancel, individual placement/reload and learning preservation at 390/768');
