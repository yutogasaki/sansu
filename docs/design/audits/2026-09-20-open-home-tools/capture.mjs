import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readNative } from '../../../../tools/island-e2e-helpers.mjs';
const base = process.env.SANSU_WORLD_FIRST_URL, out = process.env.SANSU_WORLD_FIRST_OUTPUT;
assert(base && out, 'Specify target URL and a fresh evidence directory');
await mkdir(out, { recursive: true });
const browser = await (process.env.SANSU_WORLD_FIRST_BROWSER === 'webkit' ? webkit : chromium).launch();
const report = { target: base, version: await fetch(new URL('/version.json', base)).then(r => r.json()).catch(() => null),
    fixture: 'Disposable native life credits and four flowers/bench; acquisition is not earned-learning evidence', humanN: 0, scenarios: [] };
try {
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 768, 1024], ['small', 320, 568], ['landscape', 844, 390]]) {
        if (process.env.SANSU_WORLD_FIRST_WIDTH && width !== Number(process.env.SANSU_WORLD_FIRST_WIDTH)) continue;
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const button = name => page.getByRole('button', { name, exact: true });
        const ready = async () => { await page.locator('.life-world[data-rendered="true"]').waitFor(); await page.evaluate(() => document.fonts.ready); };
        const shot = label => page.screenshot({ path: `${out}/${name}-${label}.png` });
        const hit = async locator => assert(await locator.evaluate(el => {
            const b = el.getBoundingClientRect();
            return b.width >= 44 && b.height >= 44 && b.top >= 0 && b.bottom <= innerHeight && el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
        }), 'Reachable 44px target');
        try {
            await page.goto(base);
            await page.locator('.island-welcome .island-stage__canvas[data-camera-frame]').waitFor();
            await button('まなぶ').first().waitFor(); await shot('launch');
            for (const label of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await button(label).first().click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor(); await button('とじる').click(); await ready();
            await shot('empty');
            assert.equal(await page.locator('[data-life-hud]').getAttribute('data-life-hud'), 'life-world-first-v1');
            const nativeBefore = await readNative(page);
            await page.evaluate(async () => {
                const name = (await indexedDB.databases()).find(d => d.name.startsWith('SansuIslandLife'))?.name;
                const req = indexedDB.open(name);
                const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
                const tx = db.transaction('worlds', 'readwrite'), store = tx.objectStore('worlds'), request = store.getAll();
                const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
                const rows = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                const now = Date.now(), start = now - 8 * 3600000, date = new Date(start); date.setHours(date.getHours() - 4);
                const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                const places = [[0, 2], [1, 2], [0, 3], [1, 3], [4, 2]];
                store.put({ profileId: rows[0].profileId, version: 1, revision: 0, clockIntents: [], createdAt: start, now, realAt: now, activitiesV2At: start, activitiesV2After: 0, offsets: [{ at: start, offset: 0 }],
                    credits: Array.from({ length: 60 }, (_, i) => ({ id: `qa-credit-${i}`, at: start, day })),
                    actions: places.map(([x, z], i) => ({ id: `qa-item-${i}`, at: start + 1000 * (i + 1), command: { type: 'buy', kind: i === 4 ? 'bench' : 'flower', cell: { x, z } } })) });
                await done; db.close();
            });
            await page.reload(); await ready();
            await page.locator('.life-earned').waitFor({ state: 'hidden', timeout: 30000 });
            const tools = page.locator('.life-home-tools'), world = page.locator('.life-world');
            await page.waitForFunction(() => [...document.querySelectorAll('.life-home-tools img')].length === 2 && [...document.querySelectorAll('.life-home-tools img')].every(i => i.complete && i.naturalWidth > 0 && !i.hidden));
            const worldBounds = await world.boundingBox(), toolBounds = await tools.boundingBox(), wallet = await page.locator('.life-wallet').boundingBox();
            assert(worldBounds.y >= wallet.y + wallet.height);
            assert(worldBounds.y + worldBounds.height <= toolBounds.y);
            assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
            for (const target of [button('つくる'), button('しまの ようす'), page.locator('.life-camera-tools > summary'), page.locator('.island-sound-button')]) await hit(target);
            const baseline = await page.addStyleTag({ content: await readFile(new URL('./before.css', import.meta.url), 'utf8') }); await shot('before-home'); await baseline.evaluate(el => el.remove()); await shot('home');
            await button('つくる').focus(); await shot('focus');
            const camera = await world.getAttribute('data-life-camera');
            await page.locator('.life-camera-tools > summary').click(); await shot('camera');
            await button('しま全体を みる').click(); await shot('overview');
            assert.notEqual(await world.getAttribute('data-life-camera'), camera);
            await button('くらしを みる').click();
            assert.equal(await world.getAttribute('data-life-camera'), camera);
            await button('しまを おおきく').click(); assert.notEqual(await world.getAttribute('data-life-camera'), camera);
            await button('もとの ながめ').click();
            await button('しまの ようす').click();
            assert.equal(await page.locator('.life-camera-tools').count(), 0, 'Hidden camera controls must unmount');
            await shot('residents'); await button('しまの ようすを とじる').click();
            assert(await button('しまの ようす').evaluate(el => el === document.activeElement), 'Closing details restores focus to its entrance');
            assert.equal(await page.locator('.life-camera-tools[open]').count(), 0, 'Camera must return closed');
            await button('つくる').click(); await shot('build');
            await page.locator('.life-menu-tabs').getByRole('button', { name: 'いろ', exact: true }).click();
            await page.locator('[data-life-style="starlight"]').click();
            await page.locator('[data-life-style="starlight"][aria-pressed="true"]').waitFor();
            await button('メニューを とじる').click(); await shot('notice');
            assert.equal(await page.locator('.life-dock-closed-notice button').count(), 0, 'Success notice must not add a menu action');
            await page.locator('.life-dock-closed-notice').waitFor({ state: 'hidden', timeout: 10000 });
            await shot('quiet-again');
            await button('つくる').click(); await page.locator('[data-life-buy="flower"]').click();
            assert.equal(await tools.count(), 0, 'Only placement controls remain during placement');
            await hit(button('やめる')); await shot('placement'); await button('やめる').click();
            if (name === 'phone') {
                // Abort only the next world put. This is an explicit save-failure diagnostic.
                await button('つくる').click(); await page.locator('.life-menu-tabs').getByRole('button', { name: 'いろ', exact: true }).click();
                await page.evaluate(() => {
                    const put = IDBObjectStore.prototype.put;
                    IDBObjectStore.prototype.put = function (...args) {
                        if (this.name === 'worlds') { IDBObjectStore.prototype.put = put; throw new DOMException('QA: one world save fails', 'AbortError'); }
                        return put.apply(this, args);
                    };
                });
                await page.locator('[data-life-style="original"]').click(); await page.locator('.life-error').waitFor();
                await button('メニューを とじる').click();
                await page.waitForTimeout(7200); await hit(page.locator('.life-dock-closed-notice button')); await shot('save-error');
                await page.locator('.life-dock-closed-notice button').click(); await button('もういちど').click();
                await page.locator('.life-error').waitFor({ state: 'hidden' });
                await page.locator('.life-menu-tabs').getByRole('button', { name: 'いろ', exact: true }).click();
                await page.locator('[data-life-style="original"][aria-pressed="true"]').waitFor(); await button('メニューを とじる').click();
            }
            const nativeAfter = await readNative(page);
            for (const key of ['logs', 'memoryMath', 'memoryVocab', 'islandPlans']) assert.deepEqual(nativeAfter[key], nativeBefore[key], `${key} remains unchanged`);
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor(); await shot('learning');
            if (name === 'phone' && report.version) {
                await button('とじる').click(); await ready();
                await page.evaluate(() => navigator.serviceWorker.ready);
                await page.reload(); await ready();
                assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Production preview is controlled by its service worker');
                await context.setOffline(true); await page.reload(); await ready(); await shot('offline');
                assert.equal(await page.locator('[data-life-hud]').getAttribute('data-life-hud'), 'life-world-first-v1');
                await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
                await page.locator('.island-learning[data-input-ready="true"]').waitFor();
                await context.setOffline(false);
            }
            assert.equal(errors.length, 0, errors.join('\n'));
            report.scenarios.push({ name, width, height, worldBounds, toolBounds, worldShare: worldBounds.height / height, pass: true });
            console.log(`${name} PASS`);
        } catch (error) {
            const failure = { name, pass: false, error: String(error), errors };
            report.scenarios.push(failure);
            await shot('failure').catch(captureError => { failure.captureError = String(captureError); });
            throw error;
        }
        finally { await context.close(); }
    }
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
