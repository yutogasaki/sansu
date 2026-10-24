import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { appRootMetadata, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_STATS_URL || 'http://127.0.0.1:5198';
const out = path.resolve(process.env.SANSU_STATS_OUTPUT || 'output/playwright/stats-activity');
await fs.mkdir(out, { recursive: true });
const files = ['src/pages/Stats.tsx', 'src/pages/UtilityLayout.css', 'src/components/progress/ActivitySummary.tsx', 'src/domain/stats/activity.ts', 'tools/e2e-stats-activity.mjs'];
const hashes = () => Promise.all(files.map(async file => ({ file, sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const bundle = await build({ stdin: { contents: `export { createInitialProfile } from './src/domain/user/profile.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createInitialProfile } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const report = { url: base, startedAt: new Date().toISOString(), source: await hashes(), scope: 'Explicit isolated historical log fixtures, read failure injection, current Island utility UI; no child observations or natural acquisition claims.', scenarios: [], pass: false };
const browser = await chromium.launch();
const stamp = (month, day, hour = 12) => new Date(2026, month - 1, day, hour).toISOString();

async function readStores(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = ['profiles', 'logs', 'memoryMath', 'memoryVocab', 'foundationEvents', 'foundationProgress'];
        const tx = db.transaction(names, 'readonly');
        const rows = await Promise.all(names.map(name => new Promise((resolve, reject) => {
            const req = tx.objectStore(name).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
        })));
        db.close();
        return Object.fromEntries(names.map((name, i) => [name, rows[i]]));
    });
}

async function seed(page, easy) {
    const profile = createInitialProfile('きろくの確認', 2, 7, 1, 'math');
    profile.uiTextMode = easy ? 'easy' : 'standard';
    profile.soundEnabled = false;
    const logs = [
        { timestamp: stamp(9, 25, 4) }, { timestamp: stamp(10, 17) }, { timestamp: stamp(10, 18, 4) },
        { timestamp: stamp(10, 24, 4), subject: 'vocab', result: 'skipped' },
        { timestamp: stamp(9, 25, 3) }, { timestamp: stamp(10, 25, 4) },
        { timestamp: stamp(10, 24), profileId: 'another-profile' },
    ].map(row => ({ profileId: profile.id, subject: 'math', itemId: 'add_1d_1', result: 'correct', ...row }));
    await page.evaluate(async ({ profile, logs }) => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const tx = db.transaction(['profiles', 'appData', 'logs', 'foundationEvents'], 'readwrite');
        tx.objectStore('profiles').put(profile);
        tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        for (const log of logs) tx.objectStore('logs').add(log);
        tx.objectStore('foundationEvents').put({ id: 'separate-foundation', profileId: profile.id, type: 'answer', at: Date.now(), correct: true });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        db.close();
    }, { profile, logs });
    return profile;
}

async function capture(page, row, name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800); // Utility route capture stability contract.
    const file = `${row.name}-${name}.png`;
    const screenshot = () => page.screenshot({ path: path.join(out, file), ...(name === 'return' ? {} : { animations: 'disabled' }) });
    try { await screenshot(); }
    catch (error) {
        if (name !== 'return') throw error;
        // A busy software WebGL compositor can finish after the first capture's timeout.
        // Preserve the failure in the report; a second actual screenshot is still required.
        row.captureWarnings ??= [];
        row.captureWarnings.push({ file, error: String(error) });
        await screenshot();
    }
    const metadata = await appRootMetadata(page);
    assert.equal(metadata.islandFeatureEnabled, true);
    assert.equal(metadata.natureTownFeatureEnabled, false);
    assert.equal(metadata.configuredDelivery, 'snap-root-v1');
    assert(metadata.revision && metadata.version);
    row.captures.push({ file, metadata, candidate: 'not-applicable: shared utility',
        ...(name === 'return' ? { destination: await runtimeMetadata(page) } : {}),
        cache: await page.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller })) });
}

try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 768, height: 1024 }]) {
        const easy = viewport.width === 320;
        const context = await browser.newContext({ viewport, timezoneId: 'Asia/Tokyo', reducedMotion: easy ? 'no-preference' : 'reduce', serviceWorkers: 'allow' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(45000);
        await page.clock.setFixedTime(new Date('2026-10-24T03:00:00Z'));
        const row = { name: `${viewport.width}x${viewport.height}`, easy, captures: [], pass: false };
        report.scenarios.push(row);
        try {
            await page.goto(`${base}/#/stats`);
            await page.waitForURL('**/#/onboarding');
            await capture(page, row, 'launch');
            await seed(page, easy);
            await page.goto(`${base}/#/stats`);
            const summary = page.getByTestId('activity-summary');
            await summary.waitFor();
            const text = async testId => (await page.getByTestId(testId).innerText()).replace(/\s/g, '');
            assert.equal(await text('activity-count'), easy ? '2かい' : '2回');
            assert.equal(await text('activity-days'), easy ? '2にち' : '2日');
            assert.match(await summary.innerText(), /2026\/10\/18〜2026\/10\/24/);
            assert.equal(await page.locator('.stats-disclosure[open]').count(), 0);
            const before = await readStores(page);
            await summary.scrollIntoViewIfNeeded();
            await capture(page, row, 'week');
            await summary.getByRole('button', { name: easy ? '30にちかん' : 'この30日間', exact: true }).click();
            assert.equal(await text('activity-count'), easy ? '4かい' : '4回');
            assert.equal(await text('activity-days'), easy ? '4にち' : '4日');
            assert.match(await summary.innerText(), /2026\/9\/25〜2026\/10\/24/);
            await capture(page, row, 'month');
            const geometry = await summary.evaluate(element => ({
                width: innerWidth, right: element.getBoundingClientRect().right,
                controls: [...element.querySelectorAll('button')].map(b => ({ height: b.getBoundingClientRect().height, minHeight: getComputedStyle(b).minHeight, transform: getComputedStyle(b).transform })),
                cells: [...element.querySelectorAll('dd')].map(b => b.getBoundingClientRect().top),
            }));
            assert(geometry.right <= geometry.width + 1 && geometry.controls.every(b => b.height >= 47.9), JSON.stringify(geometry));
            assert(Math.abs(geometry.cells[0] - geometry.cells[1]) < 1);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            for (const disclosure of await page.locator('.stats-disclosure > summary').all()) {
                await disclosure.scrollIntoViewIfNeeded();
                await disclosure.focus();
                await page.keyboard.press('Enter');
                assert(await disclosure.evaluate(el => el.parentElement.open));
            }
            await capture(page, row, 'details');
            assert.deepEqual(await readStores(page), before, 'Viewing/toggling cannot change saved learning');
            await page.reload();
            await summary.waitFor();
            assert.equal(await text('activity-count'), easy ? '2かい' : '2回');
            assert.equal(await page.locator('.stats-disclosure[open]').count(), 0);

            // Fault diagnostic: fail log reads without changing or deleting stored data.
            await page.evaluate(() => {
                const original = IDBIndex.prototype.openCursor;
                window.restoreStatsRead = () => { IDBIndex.prototype.openCursor = original; };
                IDBIndex.prototype.openCursor = function (...args) {
                    if (this.objectStore.name === 'logs') throw new DOMException('diagnostic read failure', 'UnknownError');
                    return original.apply(this, args);
                };
            });
            await page.getByRole('button', { name: '設定', exact: true }).click();
            await page.getByRole('button', { name: 'きろく', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: /記録を読み込めませんでした|きろくを よみこめなかった/ }).waitFor();
            assert.equal(await summary.count(), 0, 'Failure must not masquerade as zero');
            await capture(page, row, 'read-error');
            await page.evaluate(() => window.restoreStatsRead());
            await page.getByRole('button', { name: /再読み込み|もういちど/, exact: true }).click();
            await summary.waitFor();
            assert.equal(await text('activity-count'), easy ? '2かい' : '2回');
            assert.deepEqual(await readStores(page), before);

            // Only this isolated fixture is cleared to exercise empty and long-absent states.
            await page.evaluate(async () => {
                const req = indexedDB.open('SansuDatabase');
                const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
                const tx = db.transaction('logs', 'readwrite'); tx.objectStore('logs').clear();
                await new Promise(resolve => { tx.oncomplete = resolve; }); db.close();
            });
            await page.reload(); await summary.waitFor();
            assert.equal(await text('activity-count'), easy ? '0かい' : '0回');
            await page.locator('.stats-first-record').getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            await summary.scrollIntoViewIfNeeded(); await capture(page, row, 'empty');
            await page.getByRole('button', { name: 'しま', exact: true }).click();
            await page.waitForURL('**/#/island');
            page.setDefaultTimeout(45000);
            await page.waitForFunction(() => [...document.querySelectorAll('[data-growing-island="ready"] [data-growing-world] canvas')].some(canvas => {
                const rect = canvas.getBoundingClientRect();
                return canvas.width > 0 && canvas.height > 0 && rect.width > 0 && rect.height > 0;
            }));
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await capture(page, row, 'return');
            assert.deepEqual(errors, []);
            row.pass = true;
        } catch (error) {
            row.error = String(error);
            row.body = (await page.locator('body').innerText()).slice(-4000);
            await page.screenshot({ path: path.join(out, `${row.name}-failure.png`) });
            throw error;
        } finally { await context.close(); }
    }
    assert.deepEqual(await hashes(), report.source);
    report.pass = true;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
}
console.log(`Stats activity PASS: ${out}`);
