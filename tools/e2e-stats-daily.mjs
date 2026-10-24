import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { appRootMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_DAILY_URL || 'http://127.0.0.1:5198';
const out = path.resolve(process.env.SANSU_DAILY_OUTPUT || 'output/playwright/stats-daily');
await fs.mkdir(out, { recursive: true });
const sources = ['src/pages/Stats.tsx', 'src/components/progress/ActivitySummary.tsx', 'src/components/progress/DailyActivityList.tsx', 'src/domain/stats/activity.ts', 'src/pages/UtilityLayout.css', 'tools/e2e-stats-daily.mjs'];
const hashes = () => Promise.all(sources.map(async file => ({ file, sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const bundle = await build({ stdin: { contents: `export { createInitialProfile } from './src/domain/user/profile.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createInitialProfile } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const report = { startedAt: new Date().toISOString(), base, scope: 'Synthetic isolated records; day/time/subject/result display and read-only preservation. Not child or device evidence.', sources: await hashes(), cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(45000);
        const row = { viewport, captures: [], pass: false }; report.cases.push(row);
        try {
            await page.clock.setFixedTime(new Date('2026-10-24T18:00:00Z'));
            await page.goto(`${base}/#/stats`); await page.waitForURL('**/#/onboarding');
            const profile = createInitialProfile('日別記録の確認', 2, 7, 1, 'math');
            profile.uiTextMode = 'standard'; profile.soundEnabled = false;
            const logs = [
                { timestamp: '2026-10-24T09:42:00Z', result: 'correct' },
                { timestamp: '2026-10-24T09:45:00Z', subject: 'vocab', result: 'incorrect' },
                { timestamp: '2026-10-24T09:50:00Z', result: 'skipped' },
                { timestamp: '2026-10-24T16:32:00Z', result: 'incorrect' },
                { timestamp: '2026-10-23T09:42:00Z', result: 'correct' },
            ].map(log => ({ profileId: profile.id, subject: 'math', itemId: 'add_1d_1', ...log }));
            await page.evaluate(async ({ profile, logs }) => {
                const req = indexedDB.open('SansuDatabase'); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
                const tx = db.transaction(['profiles', 'appData', 'logs'], 'readwrite');
                tx.objectStore('profiles').put(profile); tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
                for (const log of logs) tx.objectStore('logs').add(log);
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
                localStorage.setItem('sansu_active_profile', profile.id);
            }, { profile, logs });
            await page.goto(`${base}/#/stats`);
            const days = page.locator('[data-activity-date]'); await days.first().waitFor();
            assert.equal(await page.locator('.stats-layout > .card-surface').first().getAttribute('data-testid'), 'activity-summary');
            assert.equal(await days.count(), 7);
            assert.equal((await page.getByTestId('activity-count').innerText()).replace(/\s/g, ''), '4問');
            assert.equal((await page.getByTestId('activity-days').innerText()).replace(/\s/g, ''), '2日');
            const today = page.locator('[data-activity-date="2026-10-24"]');
            assert.match(await today.innerText(), /3問/);
            assert.doesNotMatch(await today.innerText(), /算数|英単語/);
            assert.match(await today.getAttribute('aria-label'), /スキップ 1回/);
            assert.equal(await page.locator('.stats-calendar-weekdays span').count(), 7);
            assert.equal(await days.first().getAttribute('data-activity-date'), '2026-10-18');
            assert.doesNotMatch(await page.getByTestId('activity-summary').innerText(), /朝4時|問題数にスキップ/);
            const compact = `${viewport.width}x${viewport.height}-compact.png`;
            await page.screenshot({ path: path.join(out, compact), animations: 'disabled' }); row.captures.push(compact);
            assert.match(await page.locator('[data-activity-date="2026-10-23"]').innerText(), /1問/);
            assert.match(await page.locator('[data-activity-date="2026-10-22"]').innerText(), /0問/);
            await today.scrollIntoViewIfNeeded(); await today.click();
            assert.equal(await today.getAttribute('aria-pressed'), 'true');
            const detail = page.locator('#stats-calendar-detail');
            assert.equal(await detail.locator('time').count(), 4);
            assert.match(await detail.innerText(), /算数 2問 ・ 英単語 1問/);
            assert.match(await detail.innerText(), /スキップ 1回/);
            assert.match(await detail.locator('time').first().innerText(), /10\/25 01:32/);
            assert.match(await detail.innerText(), /10\/24 18:42/);
            await today.focus(); await page.keyboard.press('Enter');
            assert.equal(await detail.innerText(), '');
            await page.keyboard.press('Space');
            assert.equal(await detail.locator('time').count(), 4);
            const file = `${viewport.width}x${viewport.height}-daily.png`; await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); row.captures.push(file);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert((await today.boundingBox()).height >= 64);
            await page.locator('[data-activity-date="2026-10-22"]').click();
            assert.match(await detail.innerText(), /記録はまだありません/);
            await page.getByRole('button', { name: 'この30日間', exact: true }).click(); assert.equal(await days.count(), 30);
            assert.equal(await detail.innerText(), '');
            assert.equal(await page.locator('.stats-calendar-month').count(), 2);
            assert.equal(await days.first().getAttribute('data-activity-date'), '2026-09-25');
            const friday = page.locator('[data-activity-date="2026-09-25"]');
            const saturday = page.locator('[data-activity-date="2026-09-26"]');
            const sunday = page.locator('[data-activity-date="2026-09-27"]');
            assert((await saturday.boundingBox()).x > (await friday.boundingBox()).x);
            assert((await sunday.boundingBox()).y > (await friday.boundingBox()).y);
            assert((await sunday.boundingBox()).x < (await friday.boundingBox()).x);
            await page.getByTestId('activity-summary').scrollIntoViewIfNeeded();
            const monthFile = `${viewport.width}x${viewport.height}-month.png`;
            await page.screenshot({ path: path.join(out, monthFile), animations: 'disabled' }); row.captures.push(monthFile);
            await page.reload(); await days.first().waitFor(); assert.equal(await days.count(), 7);
            const persisted = await page.evaluate(async () => {
                const req = indexedDB.open('SansuDatabase'); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
                const tx = db.transaction('logs', 'readonly'); const rows = await new Promise(resolve => { const r = tx.objectStore('logs').getAll(); r.onsuccess = () => resolve(r.result); }); db.close(); return rows;
            });
            assert.deepEqual(persisted.map(({ id, ...log }) => log), logs);
            if (viewport.width === 390) {
                await page.clock.setFixedTime(new Date('2027-01-05T09:00:00Z'));
                await page.reload(); await days.first().waitFor();
                await page.getByRole('button', { name: 'この30日間', exact: true }).click();
                assert.equal(await days.count(), 30);
                assert.deepEqual(await page.locator('.stats-calendar-month').allTextContents(), ['2026年12月', '2027年1月']);
                assert.equal(await days.first().getAttribute('data-activity-date'), '2026-12-07');
                assert.equal(await page.locator('[aria-pressed="true"][data-activity-date]').count(), 0);
                assert.equal((await page.getByTestId('activity-count').innerText()).replace(/\s/g, ''), '0問');
            }
            row.metadata = await appRootMetadata(page); assert.equal(row.metadata.islandFeatureEnabled, true); row.pass = true;
        } catch (error) { row.error = String(error); await page.screenshot({ path: path.join(out, `${viewport.width}-failure.png`) }); throw error; }
        finally { await context.close(); }
    }
    assert.deepEqual(await hashes(), report.sources); report.pass = true;
} finally { await browser.close(); report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(`Daily records PASS: ${out}`);
