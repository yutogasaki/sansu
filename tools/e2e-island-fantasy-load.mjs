import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readNative, answerUI } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_FANTASY_LOAD_URL, out = process.env.SANSU_FANTASY_LOAD_OUTPUT;
assert(target && out); assert(['localhost', '127.0.0.1'].includes(new URL(target).hostname));
await mkdir(out, { recursive: false });
const built = await build({ stdin: { contents: "export { replayLife, commandLife } from './src/domain/islandLife/simulation.ts'; export { landCells } from './src/domain/islandLife/space.ts';", resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', define: { 'import.meta.env.DEV': 'false' } });
const { replayLife, commandLife, landCells } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const browser = await chromium.launch();
const report = { target, source: 'Disposable UI-created profile, followed by 200 synthetic credits and 30 legal purchases. Desktop Chromium viewport emulation, not real-phone FPS.', cases: [], pass: false };
async function life(page, value) {
    return page.evaluate(async value => {
        const open = indexedDB.open('SansuIslandLifeV1');
        const db = await new Promise((ok, no) => { open.onsuccess = () => ok(open.result); open.onerror = () => no(open.error); });
        try {
            const tx = db.transaction('worlds', value ? 'readwrite' : 'readonly');
            const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
            const request = value ? tx.objectStore('worlds').put(value) : tx.objectStore('worlds').getAll();
            const result = await new Promise((ok, no) => { request.onsuccess = () => ok(request.result); request.onerror = () => no(request.error); });
            await done; return value || result[0];
        } finally { db.close(); }
    }, value);
}
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
        try {
            await page.goto(target);
            for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
            await page.locator('[data-input-ready="true"]').waitFor();
            let native = await readNative(page); const initial = native.plan.id;
            while (native.plan.id === initial) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
            const learning = native;
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            let stress = await life(page); const now = stress.now;
            stress = { ...stress, replaySnapshot: undefined, credits: [...stress.credits, ...Array.from({ length: 200 }, (_, i) => ({ id: `qa-load-${i}`, at: now, day: 'qa-load' }))] };
            for (const side of ['west', 'east', 'south']) stress = commandLife(stress, { type: 'expand', side }, `qa-expand-${side}`, now);
            const kinds = ['water-bowl', 'water-channel', 'planter', 'flower', 'sapling', 'picnic-table', 'lantern', 'bench'];
            for (const cell of landCells(replayLife(stress))) {
                const count = replayLife(stress).items.length; if (count === 30) break;
                try { stress = commandLife(stress, { type: 'buy', kind: kinds[count % kinds.length], cell }, `qa-item-${count}`, now); } catch { /* Keep the normal collision and reachability rules. */ }
            }
            assert.equal(replayLife(stress).items.length, 30); await life(page, stress);
            const start = performance.now(); await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const startupMs = performance.now() - start;
            assert.equal(await page.locator('.life-world').getAttribute('data-life-visual-candidate'), 'living-fantasy-garden-v2');
            const frames = await page.evaluate(async () => {
                const samples = []; let previous = performance.now();
                for (let i = 0; i < 125; i++) { await new Promise(requestAnimationFrame); const now = performance.now(); if (i >= 5) samples.push(now - previous); previous = now; }
                samples.sort((a, b) => a - b);
                return { p50: samples[59], p95: samples[113], render: JSON.parse(document.querySelector('.life-world').dataset.lifeRender) };
            });
            await page.screenshot({ path: `${out}/${width}-thirty-items.png` });
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('[data-input-ready="true"]').waitFor();
            assert.deepEqual(await readNative(page), learning); assert.equal((await life(page)).version, 20);
            await page.screenshot({ path: `${out}/${width}-learning.png` }); assert.deepEqual(errors, []);
            report.cases.push({ width, startupMs, frames, itemCount: 30, learningPreserved: true, errors });
        } catch (error) { report.failure = String(error.stack); await page.screenshot({ path: `${out}/${width}-failure.png` }).catch(() => {}); throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
