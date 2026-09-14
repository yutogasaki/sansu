import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
import { putCell, inventory } from './island-life-ui-helpers.mjs';
const oldDir = process.env.SANSU_LIFE_OLD_DIR, newDir = process.env.SANSU_LIFE_NEW_DIR, out = process.env.SANSU_LIFE_TWO_BUILD_OUTPUT;
assert(oldDir && newDir && out); await mkdir(out, { recursive: false });
const builds = await Promise.all(['OLD', 'NEW'].map(async key => { const path = process.env[`SANSU_LIFE_${key}_MANIFEST`]; assert(path); return JSON.parse(await readFile(path)); }));
async function verifyBuilds() {
    for (const [index, root] of [oldDir, newDir].entries()) {
        for (const file of builds[index].distFiles) {
            assert(file.path.startsWith('dist/')); const bytes = await readFile(resolve(root, file.path.slice(5)));
            assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
        }
        assert.deepEqual(JSON.parse(await readFile(resolve(root, 'version.json'))), builds[index].version);
        assert.equal(builds[index].version.island.enabled, true); assert.equal(builds[index].version.park.enabled, false);
    }
}
await verifyBuilds(); assert.notEqual(builds[0].version.version, builds[1].version.version);
const modulePath = html => html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
const bundles = await Promise.all([oldDir, newDir].map(async root => modulePath(await readFile(resolve(root, 'index.html'), 'utf8'))));
assert(bundles.every(Boolean)); assert.notEqual(bundles[0], bundles[1]);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const interruption = process.env.SANSU_LIFE_UPDATE_INTERRUPTION === '1';
const discoveryUpgrade = process.env.SANSU_LIFE_DISCOVERY_UPGRADE === '1';
const cadenceUpgrade = process.env.SANSU_LIFE_CADENCE_UPGRADE === '1';
const heroVisitUpgrade = process.env.SANSU_LIFE_HERO_VISIT_UPGRADE === '1';
assert(!(cadenceUpgrade && heroVisitUpgrade), 'Select one version upgrade');
if (discoveryUpgrade) {
    assert.notEqual(builds[0].flags.VITE_ISLAND_LIFE_DISCOVERY_ENABLED, true);
    assert.equal(builds[1].flags.VITE_ISLAND_LIFE_DISCOVERY_ENABLED, true);
}
let deployed = oldDir, pinWorker = false; const requests = [];
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'); const path = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const root = pinWorker && /^\/(sw\.js|workbox-[^/]+\.js)$/.test(path) ? oldDir : deployed;
    const file = resolve(root, `.${path}`); if (!file.startsWith(resolve(root) + '/')) { res.writeHead(403).end(); return; }
    try { const bytes = await readFile(file); requests.push({ path: url.pathname, root, marker: url.searchParams.get('__app-update') }); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(bytes); }
    catch { res.writeHead(404).end(); }
});
await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
const report = { target: base, builds: builds.map(b => ({ revision: b.revision, sourceHash: b.sourceHash, version: b.version, flags: b.flags })), bundles,
    scope: 'Real old-to-new SW update during a partially completed learning reservation, retained earned Life ownership and all native stores, one reload, offline restart and same next question. No injected profile, credits, timestamps, update events or worker mocks. Empty photo stores do not prove Blob retention.', interruption, discoveryUpgrade, cadenceUpgrade, heroVisitUpgrade, humanN: 0, cases: [], pass: false };
async function snapshot(page) {
    return page.evaluate(async () => {
        const result = {};
        for (const name of ['SansuDatabase', 'SansuIslandLifeV1']) {
            if (!(await indexedDB.databases()).some(d => d.name === name)) throw Error(`Missing ${name}`);
            const open = indexedDB.open(name); const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
            try { result[name] = {}; for (const store of db.objectStoreNames) {
                const request = db.transaction(store).objectStore(store).getAll();
                result[name][store] = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            } } finally { db.close(); }
        }
        return result;
    });
}
const world = page => page.locator('.life-world[data-rendered="true"]').waitFor();
const input = page => page.locator('.island-learning[data-input-ready="true"]').waitFor();
const bundle = page => page.locator('script[type="module"][src]').first().getAttribute('src');
function retained(before, after) {
    assert.deepEqual(after.SansuDatabase, before.SansuDatabase, 'Every native store remains unchanged');
    assert.equal(after.SansuIslandLifeV1.worlds.length, 1);
    const old = before.SansuIslandLifeV1.worlds[0], next = after.SansuIslandLifeV1.worlds[0];
    if (cadenceUpgrade && old.version === 15 && next.version === 16) {
        assert(next.cadenceCutover); assert.equal(next.cadenceCutover.profileId, old.profileId);
        assert.deepEqual(next.cadenceCutover.priorActions, old.actions);
        assert.deepEqual(next.placementCutover, old.placementCutover);
    } else if (heroVisitUpgrade && old.version === 16 && next.version === 17) {
        assert(next.heroVisitCutover); assert.equal(next.heroVisitCutover.profileId, old.profileId);
        assert.deepEqual(next.heroVisitCutover.priorActions, old.actions);
        assert.deepEqual(next.cadenceCutover, old.cadenceCutover);
        assert.deepEqual(next.placementCutover, old.placementCutover);
    } else assert.equal(next.version, old.version);
    for (const key of ['profileId', 'createdAt', 'credits', 'actions', 'economyCheckpoint', 'tourCutover', 'facilityCutover', 'relationCutover', 'clockIntents']) assert.deepEqual(next[key], old[key], key);
}
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        deployed = oldDir; pinWorker = interruption; const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'allow', reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [], navigations = []; page.setDefaultTimeout(30000);
        page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame() && new URL(req.url()).searchParams.has('__app-update')) navigations.push(req.url()); });
        try {
            console.log(`${device}: earn and buy on old build`); await page.goto(base);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).click();
            await input(page); await page.getByRole('button', { name: 'とじる', exact: true }).click(); await world(page);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            let native = await readNative(page); const firstPlan = native.plan.id; let answers = 0;
            while (native.plan.id === firstPlan) { assert(++answers <= 3); native = (await attempt(page, native, { touch: true })).after; }
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await world(page);
            await page.waitForFunction(() => document.querySelector('[data-life-drops]')?.dataset.lifeDrops === '6');
            await page.getByRole('button', { name: 'つくる', exact: true }).click(); await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'つくる', exact: true }).click();
            if (discoveryUpgrade) {
                assert.deepEqual(await page.locator('[data-life-buy]').evaluateAll(nodes => nodes.map(n => n.dataset.lifeBuy)), ['flower','bench','swing','lantern']);
                await page.screenshot({ path: `${out}/${device}-old-catalog.png` });
            }
            await page.locator('[data-life-buy="flower"]').click(); await putCell(page, { x: 0, z: 2 });
            await page.waitForFunction(() => document.querySelector('[data-life-drops]')?.dataset.lifeDrops === '4');
            if (heroVisitUpgrade) {
                const record = (await snapshot(page)).SansuIslandLifeV1.worlds[0];
                const flower = record.actions.find(a => a.command.type === 'buy' && a.command.kind === 'flower');
                await inventory(page, flower.id); await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click();
                await page.getByRole('button', { name: 'メニューを とじる', exact: true }).waitFor({ state: 'hidden' });
                await page.waitForFunction(() => Boolean(document.querySelector('.life-world[data-rendered="true"]')), null);
            }
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await input(page);
            const partial = (await attempt(page, await readNative(page), { touch: true })).after;
            assert.equal(partial.plan.cursor, 1);
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await world(page);
            await page.waitForFunction(() => document.querySelector('[data-life-drops]')?.dataset.lifeDrops === '6');
            await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await world(page);
            assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))); assert.equal(await bundle(page), bundles[0]);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await input(page);
            const cacheBefore = await page.evaluate(() => caches.keys());
            const before = await snapshot(page); if (cadenceUpgrade) assert.equal(before.SansuIslandLifeV1.worlds[0].version, 15); assert.equal(before.SansuIslandLifeV1.worlds[0].credits.length, 4);
            if (heroVisitUpgrade) assert.equal(before.SansuIslandLifeV1.worlds[0].version, 16);
            const allActions = before.SansuIslandLifeV1.worlds[0].actions;
            if (heroVisitUpgrade) {
                const calls = allActions.filter(a => a.command.type === 'visit'); assert.equal(calls.length, 1);
                assert.equal(calls[0].command.itemId, allActions.find(a => a.command.type === 'buy').id);
            }
            const purchaseActions = heroVisitUpgrade ? allActions.filter(a => a.command.type !== 'visit') : allActions;
            // Permissive placement can legitimately move a resident out of
            // this exact footprint before the single paid purchase commits.
            assert.deepEqual(purchaseActions.map(a => a.command.type), purchaseActions.length === 2 ? ['clear-placement', 'buy'] : ['buy']);
            for (const action of purchaseActions) assert.deepEqual(action.command, {
                type: action.command.type, kind: 'flower', cell: { x: 0, z: 2 },
            });
            assert.deepEqual((await readNative(page)).plan, partial.plan);
            await page.screenshot({ path: `${out}/${device}-protected-old.png` });
            console.log(`${device}: real worker update waits during learning`);
            await context.setOffline(true); deployed = newDir;
            const detected = page.waitForResponse(r => r.url().includes('/version.json') && r.status() === 200);
            await context.setOffline(false); await page.bringToFront(); await detected;
            await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
            if (interruption) {
                console.log(`${device}: stale worker and disconnect after detection`);
                await context.setOffline(true); await page.waitForTimeout(5000);
                assert.equal(navigations.length, 0); assert.deepEqual(await page.evaluate(() => caches.keys()), cacheBefore);
                retained(before, await snapshot(page)); await page.reload();
                await page.waitForFunction(() => document.querySelector('.island-learning[data-input-ready="true"]') || document.querySelector('.life-world[data-rendered="true"]'));
                assert.equal(await bundle(page), bundles[0]); retained(before, await snapshot(page));
                assert.deepEqual(await page.evaluate(() => caches.keys()), cacheBefore);
                if (!await page.locator('.island-learning[data-input-ready="true"]').isVisible()) await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
                await input(page); assert.deepEqual((await readNative(page)).plan, partial.plan);
                await page.screenshot({ path: `${out}/${device}-disconnected-old.png` });
                pinWorker = false;
                const redetected = page.waitForResponse(r => r.url().includes('/version.json') && r.status() === 200);
                await context.setOffline(false); await page.bringToFront(); await redetected;
                await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
            }
            await page.waitForTimeout(5000);
            assert.equal(await bundle(page), bundles[0]); assert.equal(navigations.length, 0); retained(before, await snapshot(page));
            await input(page); await page.screenshot({ path: `${out}/${device}-update-deferred.png` });
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.waitForFunction(expected => document.querySelector('script[type="module"][src]')?.getAttribute('src') === expected, bundles[1]); await world(page);
            await page.waitForTimeout(5000); assert.equal(navigations.length, 1); const after = await snapshot(page); retained(before, after);
            if (cadenceUpgrade) assert.equal(after.SansuIslandLifeV1.worlds[0].version, 16);
            if (heroVisitUpgrade) {
                assert.equal(after.SansuIslandLifeV1.worlds[0].version, 17);
                const flowerId = allActions.find(a => a.command.type === 'buy').id;
                await page.waitForFunction(id => JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses ?? '[]')
                    .some(p => p.id === 'pokomoko' && p.phase === 'walking' && p.itemId !== id), flowerId, { timeout: 60000 });
                await page.screenshot({ path: `${out}/${device}-hero-resumed.png` });
            }
            assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), '6'); assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '1');
            await page.screenshot({ path: `${out}/${device}-new-world.png` });
            let offlineBaseline = after, addedPurchase;
            if (discoveryUpgrade) {
                console.log(`${device}: twelve-item catalog and new purchase`);
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                assert.deepEqual(await page.locator('[data-life-buy]').evaluateAll(nodes => nodes.map(n => n.dataset.lifeBuy)), ['flower','bench','swing','lantern','sapling','water-bowl','picnic-table','pinwheel','flower-arch','sandbox','garden-hut','library']);
                await page.getByRole('button', { name: '3ページめ', exact: true }).click();
                await page.waitForFunction(() => {
                    const scroller=document.querySelector('.life-catalog-scroll'), group=document.querySelectorAll('.life-catalog-page')[2];
                    if (!scroller || !group) return false;
                    const view=scroller.getBoundingClientRect(), target=group.getBoundingClientRect();
                    return Math.abs(target.left-view.left)<1 && Math.abs(target.right-view.right)<1;
                });
                await page.screenshot({ path: `${out}/${device}-new-catalog.png` });
                await page.locator('[data-life-buy="sapling"]').click(); await putCell(page, { x: 2, z: 2 });
                await page.waitForFunction(() => document.querySelector('[data-life-drops]')?.dataset.lifeDrops === '2');
                offlineBaseline = await snapshot(page);
                assert.deepEqual(offlineBaseline.SansuDatabase, before.SansuDatabase);
                const oldRecord=before.SansuIslandLifeV1.worlds[0], nextRecord=offlineBaseline.SansuIslandLifeV1.worlds[0];
                assert.deepEqual(nextRecord.credits, oldRecord.credits);
                assert.deepEqual(nextRecord.actions.slice(0,oldRecord.actions.length),oldRecord.actions);
                assert.equal(nextRecord.actions.length,oldRecord.actions.length+1);
                addedPurchase=nextRecord.actions.at(-1);
                assert.equal(addedPurchase.command.type,'buy'); assert.equal(addedPurchase.command.kind,'sapling');
                assert.equal(addedPurchase.purchaseReceipt.actualPaidDrops,4);
                assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'),'2');
                await page.screenshot({ path: `${out}/${device}-new-purchase.png` });
            }
            console.log(`${device}: new build offline resume`);
            await context.setOffline(true); await page.reload(); await world(page); assert.equal(await bundle(page), bundles[1]); retained(offlineBaseline, await snapshot(page));
            if (discoveryUpgrade) {
                assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'),'2');
                assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'),'2');
            }
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await input(page); assert.deepEqual((await readNative(page)).plan, partial.plan);
            await page.screenshot({ path: `${out}/${device}-offline-same-question.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, viewport, cacheBefore, before, after, offlineBaseline, addedPurchase, plan: partial.plan, navigations, errors, pass: true });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }).catch(() => {}); report.failure = { device, error: error.stack, errors, navigations, url: page.url(), text: await page.locator('body').innerText(), snapshot: await snapshot(page).catch(() => null) }; throw error; }
        finally { await context.close(); }
    }
    await verifyBuilds(); report.pass = true;
} finally { report.requests = requests; await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); await new Promise(resolveClose => server.close(resolveClose)); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length }));
