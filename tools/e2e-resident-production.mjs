import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { openGrowingMenu, readNative, runtimeMetadata, seedNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_RESIDENT_URL || 'http://127.0.0.1:5297';
const out = process.env.SANSU_RESIDENT_OUTPUT;
assert(out, 'Specify a fresh SANSU_RESIDENT_OUTPUT'); await fs.mkdir(out, { recursive: false });
const version = await fetch(`${base}/version.json`).then(r => r.json());
const report = { at: new Date().toISOString(), version, scope: 'Production build with real UI saves/reload/offline and synthetic two-resident save; not earned residency or actual-child acceptance.', scenarios: [], captures: [], pass: false };
const browser = await chromium.launch(); let page;
async function record(page, id, write) {
 return page.evaluate(async ({ id, write }) => {
  const req = indexedDB.open('SansuGrowingIslandV1'); const db = await new Promise((ok, no) => { req.onsuccess = () => ok(req.result); req.onerror = () => no(req.error); });
  try { const tx = db.transaction('terrainIslands', write ? 'readwrite' : 'readonly'); const op = write ? tx.objectStore('terrainIslands').put(write) : tx.objectStore('terrainIslands').get(id);
   const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onabort = () => no(tx.error); });
   const result = await new Promise((ok, no) => { op.onsuccess = () => ok(op.result); op.onerror = () => no(op.error); }); await done; return write || result;
  } finally { db.close(); }
 }, { id, write });
}
async function ready(page) { await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); }
async function until(page, id, predicate) { for (let i = 0; i < 100; i++) { const r = await record(page, id); if (predicate(r)) return r; await page.waitForTimeout(100); } throw Error('Save did not reach expected state'); }
async function focus(page, name) {
 const menu = await openGrowingMenu(page); await menu.getByRole('button', { name: 'なかま', exact: true }).click();
 await page.locator('.growing-friends').getByRole('button', { name: new RegExp(name) }).click();
 await page.locator('.growing-sheet').waitFor();
}
async function capture(page, label) {
 const file = `${page.viewportSize().width}-${label}.png`; await page.screenshot({ path: `${out}/${file}` });
 const metadata = await runtimeMetadata(page); assert.equal(metadata.appRoot.revision, version.revision);
 assert.equal(metadata.appRoot.islandFeatureEnabled, true); report.captures.push({ file, metadata });
}
try {
 for (const width of [390, 768]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference', timezoneId: 'Asia/Tokyo' });
  page = await context.newPage(); page.setDefaultTimeout(30000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-26T03:00:00Z'));
  await page.goto(`${base}/#/island`); await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor();
  const id = `resident-production-${width}`; await seedNative(page, id); await page.reload(); await ready(page);
  const fixture = await record(page, id); assert(fixture); fixture.state.tutorial = 'done'; fixture.state.unopened = [];
  fixture.state.villagers = ['a', 'b'].map((id, i) => ({ id, name: i ? 'つき' : 'ほし', species: 'rabbit', home: 'pokomoko', arrivedAt: i, trait: 'mellow', variant: { color: i, accessory: 0, sparkle: false } }));
  fixture.state.arrivals = ['b']; await record(page, id, fixture); await page.reload(); await ready(page);
  const native = await readNative(page, id); const initial = (await record(page, id)).state;
  await focus(page, 'ほし'); await page.locator('.growing-sheet-details summary').click();
  await page.getByRole('button', { name: 'なまえを つける', exact: true }).click();
  await page.getByRole('textbox', { name: 'なまえ', exact: true }).fill('そら'); await page.getByRole('button', { name: 'きめる', exact: true }).click();
  await until(page, id, r => r.state.villagers[0].name === 'そら'); await capture(page, 'renamed');
  await page.locator('.growing-sheet').getByRole('button', { name: 'とじる', exact: true }).click();
  await focus(page, 'つき'); await page.getByRole('button', { name: 'おでかけ してもらう', exact: true }).click();
  await until(page, id, r => r.state.villagers[1].away === true);
  await page.reload(); await ready(page); await focus(page, 'つき');
  await page.getByRole('button', { name: 'しまに もどってきてもらう', exact: true }).click();
  const returned = (await until(page, id, r => !r.state.villagers[1].away)).state;
  assert.deepEqual(returned.arrivals, ['b']); assert.equal(returned.villagers.length, 2); assert.equal(returned.villagers[0].name, 'そら'); assert.equal(returned.villagers[1].name, 'つき');
  for (const key of ['land', 'plots', 'landmarks', 'keepsakes', 'drops', 'learned']) assert.deepEqual(returned[key], initial[key]);
  assert.deepEqual(await readNative(page, id), native); await capture(page, 'returned-on-boat');
  await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; if (!r.active) throw Error('No active SW'); });
  await context.setOffline(true); await page.reload(); await ready(page);
  const offline = (await record(page, id)).state; assert.deepEqual(offline.villagers, returned.villagers); assert.deepEqual(offline.arrivals, ['b']);
  assert.deepEqual(await readNative(page, id), native); await capture(page, 'offline-retained');
  assert.deepEqual(errors, []); report.scenarios.push({ width, renameSaved: true, awayReturnAcrossReload: true, boatQueueRetained: true, ownedAndLearningRetained: true, offline: true, pass: true });
  await context.close();
 }
 report.pass = true;
} catch (e) { report.error = e.stack; if (page) { await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}); report.failureBody = await page.locator('body').innerText().catch(() => 'unavailable'); } process.exitCode = 1; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios, error: report.error }));
