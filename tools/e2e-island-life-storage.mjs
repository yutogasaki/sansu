import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
import { putCell, inventory, closeMenu } from './island-life-ui-helpers.mjs';
const base = process.env.SANSU_LIFE_STORAGE_URL, out = process.env.SANSU_LIFE_STORAGE_OUTPUT;
assert(base && out, 'Specify a local production URL and a fresh output directory');
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local isolated browser verification only');
await mkdir(out, { recursive: false });
const buildPath = process.env.SANSU_LIFE_STORAGE_BUILD_SOURCE; assert(buildPath, 'Bind the run to a frozen production build');
const build = JSON.parse(await readFile(buildPath));
const discovery = process.env.SANSU_LIFE_STORAGE_DISCOVERY === '1';
const purchaseKind = discovery ? 'sapling' : 'flower', purchaseCost = discovery ? 4 : 2;
const afterPurchase = 6 - purchaseCost, afterProjection = afterPurchase + 2;
const failProjection = process.env.SANSU_LIFE_STORAGE_FAIL_PROJECTION === '1';
async function verifyBuild() {
    for (const file of [...build.files, ...build.distFiles]) assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'), file.sha256, file.path);
}
await verifyBuild();
async function sourceHash() {
    const hash = createHash('sha256');
    const paths = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const path of paths) hash.update(path).update('\0').update(await readFile(path)).update('\0');
    return hash.digest('hex');
}
async function life(page) {
    return page.evaluate(async () => {
        const names = (await indexedDB.databases()).map(d => d.name);
        if (!names.includes('SansuIslandLifeV1') || names.includes('SansuIslandLifePreviewV1')) throw Error('Expected production Life ownership');
        const open = indexedDB.open('SansuIslandLifeV1');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const read = db.transaction('worlds').objectStore('worlds').getAll();
            const rows = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
            if (rows.length !== 1) throw Error('Expected one UI-created owner');
            return rows[0];
        } finally { db.close(); }
    });
}
async function until(read, accepts, message) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) { const value = await read(); if (accepts(value)) return value; await new Promise(resolve => setTimeout(resolve, 200)); }
    throw Error(message);
}
const ready = page => page.locator('.life-world[data-rendered="true"]').waitFor();
const stableKeys = ['profileId', 'createdAt', 'credits', 'actions', 'economyCheckpoint', 'tourCutover', 'facilityCutover', 'relationCutover'];
function sameOwnership(before, after) { for (const key of stableKeys) assert.deepEqual(after[key], before[key], key); }
async function wallet(page) { return Number(await page.locator('[data-life-drops]').getAttribute('data-life-drops')); }
const report = { target: base, startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    flags: `production Island=true, Life=true, Discovery=${discovery}, Life preview=false, BuildPlay=false`, fixture: 'No injected profiles, clocks, credits, answers, or database writes; onboarding and purchases through actual UI in disposable contexts',
    failureInjection: failProjection ? 'Explicit IDBObjectStore.put failure for SansuIslandLifeV1/worlds only after a real offline answer; disabled before UI retry' : 'none', buildVersion: build.version,
    scope: `Actual service worker offline ownership, earned credit projection, placement/storage and native learning. ${discovery ? '14-item catalog and real sapling purchase' : 'Six-item production capability'}. Not all rule journeys, C3 or two-build update.`, humanN: 0, cases: [], pass: false };
assert.equal(report.startHash, build.sourceHash);
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
        try {
            console.log(`${device}: real onboarding`);
            await page.goto(base);
            assert.deepEqual(await (await page.request.get(new URL('/version.json', base).href)).json(), build.version, 'Actual target build must match');
            await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
            for (const name of ['小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await ready(page);
            assert.equal(await page.locator('.life-dev').count(), 0);
            const initial = await life(page); assert.equal(initial.credits.length, 0); assert.equal(await wallet(page), 0);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            let native = await readNative(page); const plan = native.plan.id; let answers = 0;
            while (native.plan.id === plan) { assert(++answers <= 3, 'Actual three-question introduction'); native = (await attempt(page, native, { touch: true })).after; }
            assert.equal(answers, 3);
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await ready(page);
            const earned = await until(() => life(page), r => r.credits.length === 3, 'Three earned credits must project');
            await page.waitForFunction(() => document.querySelector('[data-life-drops]')?.dataset.lifeDrops === '6');
            console.log(`${device}: purchase`);
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'つくる', exact: true }).click();
            let catalog;
            if (discovery) {
                catalog=[];
                for(let i=1;i<=7;i++){
                    await page.getByRole('button',{name:`${i}ページめ`,exact:true}).click();
                    const group=page.getByRole('group',{name:`${i}ページめ`,exact:true});
                    catalog.push(...await group.locator('[data-life-buy]').evaluateAll(nodes=>nodes.map(n=>({kind:n.dataset.lifeBuy,text:n.textContent,disabled:n.disabled}))));
                    await page.screenshot({path:`${out}/${device}-catalog-${i}.png`});
                }
                const navigation = await page.locator('.life-catalog-navigation').evaluate(n=>{
                    const box=n.getBoundingClientRect(),hint=n.querySelector('small').getBoundingClientRect(),count=n.querySelector('.life-catalog-count').getBoundingClientRect();
                    return {width:n.clientWidth,scrollWidth:n.scrollWidth,hintHeight:hint.height,countHeight:count.height,
                        targets:[...n.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,inside:r.left>=box.left-1&&r.right<=box.right+1};})};
                });
                assert(navigation.scrollWidth<=navigation.width+1);assert(navigation.hintHeight<20&&navigation.countHeight<20);
                assert(navigation.targets.length===7&&navigation.targets.every(b=>b.width>=44&&b.height>=44&&b.inside));
                report.navigationChecks??=[];report.navigationChecks.push({device,...navigation});
                assert.deepEqual(catalog.map(p=>p.kind),['flower','bench','swing','lantern','sapling','water-bowl','picnic-table','pinwheel','flower-arch','sandbox','garden-hut','library','fence','planter']);
                await page.getByRole('button',{name:'3ページめ',exact:true}).click();
            }
            await page.locator(`[data-life-buy="${purchaseKind}"]`).click(); await putCell(page, { x: 0, z: 2 });
            const purchased = await until(() => life(page), r => r.actions.some(a => a.command.type === 'buy'), 'Purchase must commit before reload');
            const itemId = purchased.actions.find(a => a.command.type === 'buy').id;
            assert.equal(purchased.actions.find(a=>a.id===itemId).purchaseReceipt.actualPaidDrops,purchaseCost);
            assert.equal(purchased.actions.find(a=>a.id===itemId).command.kind,purchaseKind);
            assert(itemId); assert.equal(await wallet(page), afterPurchase); assert.deepEqual(purchased.credits, earned.credits);
            await page.screenshot({ path: `${out}/${device}-purchased.png` });
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.reload(); await ready(page);
            const cache = await page.evaluate(async () => {
                const registration = await navigator.serviceWorker.ready;
                const urls = [...new Set(performance.getEntriesByType('resource').map(r => r.name).filter(url => new URL(url).origin === location.origin && /\/assets\/.*\.(js|css)$/.test(new URL(url).pathname)))];
                return { controlled: Boolean(navigator.serviceWorker.controller), active: registration.active?.state, hook: window.__SANSU_PWA_E2E__ === true,
                    resources: await Promise.all(urls.map(async url => ({ url, cached: Boolean(await caches.match(url, { ignoreSearch: true })) }))) };
            });
            assert(cache.controlled && cache.active === 'activated' && !cache.hook); assert(cache.resources.length > 1 && cache.resources.every(r => r.cached));
            const onlineNative = await readNative(page); sameOwnership(purchased, await life(page));
            console.log(`${device}: offline reload and placement`);
            await context.setOffline(true); await page.reload(); await ready(page); sameOwnership(purchased, await life(page));
            assert.deepEqual(await readNative(page), onlineNative); assert.equal(await wallet(page), afterPurchase);
            await inventory(page, itemId); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await putCell(page, { x: 1, z: 2 });
            const moved = await until(() => life(page), r => r.actions.some(a => a.command.type === 'move' && a.command.itemId === itemId), 'Offline move must commit');
            await inventory(page, itemId); await page.getByRole('button', { name: 'しまう', exact: true }).click(); await closeMenu(page);
            const stored = await until(() => life(page), r => r.actions.length > moved.actions.length, 'Offline storage must commit');
            assert.deepEqual(stored.actions.at(-1).command, { type: 'store', itemId });
            await page.reload(); await ready(page); sameOwnership(stored, await life(page)); assert.equal(await wallet(page), afterPurchase);
            assert.deepEqual(await readNative(page), onlineNative);
            await inventory(page, itemId); await page.getByRole('button', { name: 'おく', exact: true }).waitFor(); await closeMenu(page);
            await page.screenshot({ path: `${out}/${device}-offline-stored.png` });
            console.log(`${device}: offline learning`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            const offlineBefore = await readNative(page); const answered = (await attempt(page, offlineBefore, { touch: true })).after;
            assert(answered.islandEvents.length > offlineBefore.islandEvents.length);
            const projectionTarget = page.workers().find(worker => worker.url().includes('lifeUpdate')) ?? page;
            if (failProjection) await projectionTarget.evaluate(() => {
                globalThis.lifePutFailures = 0; globalThis.originalLifePut = IDBObjectStore.prototype.put;
                IDBObjectStore.prototype.put = function (...args) {
                    if (this.name === 'worlds' && this.transaction.db.name === 'SansuIslandLifeV1') {
                        globalThis.lifePutFailures++; throw new DOMException('QA Life projection unavailable', 'QuotaExceededError');
                    }
                    return globalThis.originalLifePut.apply(this, args);
                };
            });
            await page.getByRole('button', { name: 'とじる', exact: true }).click(); await ready(page);
            let fault;
            if (failProjection) {
                await until(() => projectionTarget.evaluate(() => globalThis.lifePutFailures), count => count > 0, 'Life writer must encounter the injected fault');
                const failed = await life(page); sameOwnership(stored, failed); assert.deepEqual(await readNative(page), answered);
                await page.getByRole('button', { name: 'ひらく', exact: true }).first().click();
                await page.locator('.life-error').waitFor();
                assert.equal(await page.locator('.life-error p').innerText(), 'しまの きろくを たしかめられなかったよ。もういちど ためしてね。');
                await page.screenshot({ path: `${out}/${device}-projection-failed.png` });
                fault = { attempts: await projectionTarget.evaluate(() => globalThis.lifePutFailures), retainedCredits: failed.credits.length, nativeSaved: true };
                await projectionTarget.evaluate(() => { IDBObjectStore.prototype.put = globalThis.originalLifePut; delete globalThis.originalLifePut; });
                await page.locator('.life-error').getByRole('button', { name: 'もういちど', exact: true }).click();
                await page.locator('.life-error').waitFor({ state: 'hidden' }); await closeMenu(page);
            }
            const projected = await until(() => life(page), r => r.credits.length === 4, 'Offline terminal projects exactly once');
            await page.waitForFunction(amount => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) === amount, afterProjection);
            assert.deepEqual(projected.actions, stored.actions); assert.deepEqual(projected.credits.slice(0, 3), earned.credits);
            await page.reload(); await ready(page); sameOwnership(projected, await life(page)); assert.deepEqual(await readNative(page), answered);
            await context.setOffline(false); await page.reload(); await ready(page); sameOwnership(projected, await life(page)); assert.equal(await wallet(page), afterProjection);
            await page.screenshot({ path: `${out}/${device}-reconnected.png` });
            const delivery = await page.evaluate(() => ({ builds: [...document.querySelectorAll('[data-build-revision]')].map(n => ({ ...n.dataset })), world: document.querySelector('.life-world')?.dataset.lifeWorldStyle }));
            assert.equal(delivery.world,'moon-garden-v1');
            assert.deepEqual(errors, []); report.cases.push({ device, viewport, cache, delivery, catalog, fault, answers, initial, earned, purchased, stored, projected, offlineNativeBefore: offlineBefore, offlineNativeAfter: answered, errors, pass: true });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }).catch(() => {}); await writeFile(`${out}/${device}-failure.json`, JSON.stringify({ error: error.stack, errors, body: await page.locator('body').innerText(), life: await life(page).catch(() => null), native: await readNative(page).catch(() => null) }, null, 2)); throw error; }
        finally { await context.close(); }
    }
    await verifyBuild(); report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, source: report.endHash }));
