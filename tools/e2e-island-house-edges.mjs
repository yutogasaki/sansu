import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { answerUI, button, readNative, seedNative, waitMode, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5387';
const out = process.env.SANSU_HOUSE_EDGES_OUTPUT || 'output/playwright/house-edges/run-v1';
const viewports = JSON.parse(process.env.SANSU_HOUSE_VIEWPORTS || '[{"width":390,"height":844},{"width":320,"height":568},{"width":768,"height":1024},{"width":844,"height":390}]');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, scope: 'Native profile, real first three answers and first award; explicit 1000-completion aggregate fixture for long collection; one native display-write failure diagnostic.', captures: [], scenarios: [], pass: false };
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const action = name => page.locator(`[data-keepsake-action="${name}"]`);
        const section = name => page.locator(`[data-keepsake-section="${name}"]`).waitFor();
        const capture = async name => {
            await page.waitForTimeout(150);
            const file = `${viewport.width}-${name}.png`;
            await page.screenshot({ path: `${out}/${file}` });
            report.captures.push({ file, ...(await runtimeMetadata(page)) });
        };
        const exposed = async locator => {
            await locator.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(80);
            const rect = await locator.evaluate(el => {
                const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
                return { width: r.width, height: r.height, x, y, hit: el.contains(document.elementFromPoint(x, y)) };
            });
            assert(rect.width >= 44 && rect.height >= 44 && rect.hit, `Tap is exposed: ${JSON.stringify(rect)}`);
        };
        try {
            await page.goto(base); await page.waitForURL('**/#/onboarding');
            const id = await seedNative(page, randomUUID());
            await page.goto(base); await waitMode(page, 'home'); await waitReady(page); await capture('island');
            await page.locator('.island-shell-nav').getByRole('button', { name: 'いえ', exact: true }).click();
            await section('home'); await waitReady(page); await capture('house-empty');
            const beforeVisit = await readNative(page, id);
            await exposed(action('notices')); await action('notices').click(); await section('notices');
            assert.equal(new URL(page.url()).hash, '#/island?view=keepsakes&house=notices');
            await page.goBack(); await section('home');
            await page.waitForFunction(() => document.activeElement?.getAttribute('data-keepsake-action') === 'notices');
            await page.goForward(); await section('notices'); await page.reload(); await section('notices');
            await action('home').click(); await section('home');
            await exposed(action('open-keepsakes')); await action('open-keepsakes').click(); await section('keepsakes');
            assert.equal(await action('display').count(), 0); assert.equal(await action('display-earned').count(), 0);
            assert.deepEqual(await readNative(page, id), beforeVisit, 'House reading/history/reload do not change learning or display');
            await capture('first-keepsake');
            await exposed(action('learn')); await action('learn').click(); await waitMode(page, 'learning'); await waitReady(page);
            await capture('learning');
            for (let i = 0; i < 3; i++) await answerUI(page, (await readNative(page, id)).plan, { dev: false });
            assert.equal((await readNative(page, id)).island.completedSets, 1);
            await button(page, 'とじる').click(); await section('keepsakes');
            assert.equal(new URL(page.url()).hash, '#/island?view=keepsakes&house=keepsakes');
            await exposed(action('display')); await action('display').click();
            await page.waitForFunction(() => document.querySelector('[data-keepsake-action=store]')?.disabled === false);
            assert.deepEqual((await readNative(page, id)).island.learningKeepsakes.displayed, ['first-completion']);
            await capture('earned-first-award');
            await exposed(action('room')); await action('room').click(); await section('home');
            await page.waitForFunction(() => document.activeElement?.getAttribute('data-keepsake-action') === 'open-keepsakes');
            await action('album').click(); await waitMode(page, 'album');
            await page.locator('.island-panel-heading').getByRole('button').click(); await section('home');
            await exposed(action('photos')); await action('photos').click(); await waitMode(page, 'photos');
            await page.locator('.island-panel-heading').getByRole('button').click(); await section('home');
            const cameraEntry = button(page, 'しゃしんに のこす');
            await exposed(cameraEntry); await cameraEntry.click(); await waitMode(page, 'camera');
            await button(page, 'カメラを とじる').click(); await section('home');
            // A native diagnostic aggregate, distinct from the real first award above.
            await page.evaluate(async id => {
                const open = indexedDB.open('SansuDatabase');
                const db = await new Promise(resolve => { open.onsuccess = () => resolve(open.result); });
                const tx = db.transaction('islands', 'readwrite'), store = tx.objectStore('islands');
                const req = store.get(id); req.onsuccess = () => store.put({ ...req.result, completedSets: 1000 });
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
            }, id);
            await page.reload(); await section('home');
            await exposed(action('open-keepsakes')); await action('open-keepsakes').click(); await section('keepsakes');
            const last = page.locator('[data-keepsake-choice=completed-1000]');
            await exposed(last); await last.click();
            await page.waitForFunction(() => document.activeElement === document.querySelector('.island-keepsake-detail h3') && document.querySelector('[data-keepsake-selected]')?.getAttribute('data-keepsake-selected') === 'completed-1000');
            const detail = page.locator('.island-keepsake-detail h3');
            assert.equal(await detail.evaluate(el => el === document.activeElement), true);
            await exposed(action('display')); await capture('long-collection');
            const beforeFault = await readNative(page, id);
            await page.evaluate(() => {
                const original = IDBObjectStore.prototype.put;
                IDBObjectStore.prototype.put = function(value, ...args) {
                    if (this.name === 'islands' && value.learningKeepsakes?.displayed.includes('completed-1000')) {
                        IDBObjectStore.prototype.put = original;
                        throw new DOMException('House edge diagnostic: one failed display write', 'QuotaExceededError');
                    }
                    return original.call(this, value, ...args);
                };
            });
            await action('display').click(); await action('retry').waitFor();
            await page.waitForFunction(() => !document.querySelector('[data-keepsake-action=retry]').disabled);
            assert.deepEqual(await readNative(page, id), beforeFault, 'Failed display transaction cannot change stores');
            assert.equal(await action('display').isDisabled(), true);
            await action('home').click(); await section('home');
            await action('retry').waitFor(); await capture('recovery-home');
            await exposed(action('notices')); await action('notices').click(); await section('notices');
            await exposed(action('retry')); await action('retry').click(); await action('retry').waitFor({ state: 'hidden' });
            const afterRetry = await readNative(page, id);
            assert.deepEqual(afterRetry.island.learningKeepsakes.displayed, ['first-completion', 'completed-1000']);
            assert.equal(afterRetry.islandEvents.filter(e => e.type === 'learning_keepsakes_changed').length, 2, 'First genuine display + one successful retry');
            for (const table of ['islandPlans', 'logs', 'memoryMath', 'memoryVocab']) assert.deepEqual(afterRetry[table], beforeFault[table]);
            await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
            await context.setOffline(true); await page.reload(); await section('notices');
            assert.deepEqual((await readNative(page, id)).island.learningKeepsakes, afterRetry.island.learningKeepsakes, 'Offline reload preserves the recovered display');
            await context.setOffline(false);
            await action('home').click(); await section('home');
            if (viewport.width === 390) {
                // Text scaling diagnostic, distinct from browser/OS accessibility zoom.
                await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
                await exposed(action('open-keepsakes')); await action('open-keepsakes').click(); await section('keepsakes');
                await exposed(action('store'));
                assert.equal(await page.locator('.island-page').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
                await capture('large-text');
                await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
            }
            await page.goto(`${base}/#/island?view=keepsakes&house=notices`); await section('notices');
            await action('home').click(); await section('home');
            await page.goto(`${base}/#/island?view=keepsakes&house=unknown`); await section('home');
            await action('close').click(); await waitMode(page, 'home');
            assert.equal(await page.locator('.island-page').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
            assert.deepEqual(errors, []);
            report.scenarios.push({ viewport, pass: true, errors }); console.log(`PASS house edges ${viewport.width}x${viewport.height}`);
        } catch (error) {
            await capture('failure').catch(() => {});
            report.scenarios.push({ viewport, pass: false, url: page.url(), error: String(error), errors }); throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
