import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedDev, runtimeMetadata, waitForAsync } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_VISIT_URL, out = process.env.SANSU_VISIT_OUTPUT;
const width = Number(process.env.SANSU_VISIT_WIDTH || 768); assert([390, 768].includes(width));
assert(base && out, 'Specify a DEV URL and fresh SANSU_VISIT_OUTPUT');
await fs.mkdir(out, { recursive: false });
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(45000);
const report = { target: base, source: 'DEV disposable three-profile fixture; real visit and gift UI; explicit IDB blocking/failure', scenarios: [], captures: [], pass: false };
async function hashes() {
    const paths = execFileSync('rg', ['--files', '--no-ignore', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/build-app.mjs', 'tools/island-e2e-helpers.mjs', 'tools/e2e-growing-visit-recovery.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
}
report.initialHashes = await hashes();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const ready = () => page.locator('[data-growing-island="ready"] canvas').waitFor();
const capture = async name => { await page.screenshot({ path: `${out}/${name}.png` }); report.captures.push({ file: `${name}.png`, ...await runtimeMetadata(page) }); };
async function visit(name) {
    await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
    await page.getByRole('button', { name: 'みせる', exact: true }).tap();
    await page.getByRole('button', { name: /きょうだいの しまへ/ }).tap();
    await page.getByRole('button', { name: `${name}の しま`, exact: true }).tap();
    await page.locator('[data-growing-island="visit"] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
}
const gift = () => page.getByRole('button', { name: 'おはなを おいてくる 🌸', exact: true });
try {
    await page.goto(`${base}/#/island`);
    const ids = [];
    for (const name of ['ふたば', 'みなと', 'つむぎ']) {
        const id = await seedDev(page, { name, familiar: false }); ids.push(id);
        await page.evaluate(async id => {
            const { growingDb, syncGrowingIsland } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV only');
            await syncGrowingIsland(id, []);
        }, id);
    }
    await page.reload(); await ready(); await visit('ふたば');
    // Hold an actual competing write transaction, so the UI gift save queues behind it.
    await page.evaluate(async () => {
        const q = indexedDB.open('SansuGrowingIslandPreviewV1');
        const db = await new Promise((ok, no) => { q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
        let released = false; const tx = db.transaction('gifts', 'readwrite');
        const poll = () => { if (!released) tx.objectStore('gifts').get('qa-block').onsuccess = poll; }; poll();
        window.__releaseVisitBlock = () => { released = true; };
        tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
    });
    await gift().tap(); await page.getByRole('button', { name: 'かえる', exact: true }).tap(); await ready();
    await page.evaluate(() => window.__releaseVisitBlock());
    await waitForAsync(page, async ({ from, to }) => {
        const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
        return (await growingDb.gifts.where('to').equals(to).toArray()).filter(g => g.from === from).length === 1;
    }, { from: ids[2], to: ids[0] });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('[data-growing-island="ready"]').count(), 1, 'Late gift completion must not reopen a departed visit');
    await capture('returned-during-save'); report.scenarios.push({ name: 'return during gift persistence; gift retained; no forced revisit', pass: true });

    await visit('みなと');
    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) { if (this.name === 'gifts') throw Error('qa-gift-disk-full'); return original.apply(this, args); };
        window.__restoreGiftPut = () => { IDBObjectStore.prototype.put = original; };
    });
    await gift().tap();
    await page.getByRole('alert').filter({ hasText: /おはな.*ほぞん/ }).waitFor();
    await capture('gift-save-error'); await page.evaluate(() => window.__restoreGiftPut());
    await gift().tap(); await page.getByRole('button', { name: 'おはなを おいたよ', exact: true }).waitFor();
    const gifts = await page.evaluate(async to => {
        const { growingDb } = await import('/src/domain/growingIsland/repository.ts'); return growingDb.gifts.where('to').equals(to).count();
    }, ids[1]); assert.equal(gifts, 1);
    assert.deepEqual(errors, []); await capture('gift-retried');
    report.scenarios.push({ name: 'gift transaction fails; visible recovery; same recipient retry; one flower', pass: true });
    report.finalHashes = await hashes(); assert.deepEqual(report.finalHashes, report.initialHashes);
    report.pass = true; console.log('PASS visit save recovery');
} catch (error) {
    report.error = error.stack || String(error); report.pageErrors = errors;
    await capture('failure').catch(() => {}); throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
