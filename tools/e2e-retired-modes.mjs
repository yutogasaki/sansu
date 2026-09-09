import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { seedNative, readNative, answerUI, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_RETIRED_BASE_URL || 'http://127.0.0.1:5328';
const mode = process.env.SANSU_RETIRED_MODE || 'island';
assert(['island', 'classic'].includes(mode));
const out = process.env.SANSU_RETIRED_OUTPUT || `output/playwright/retired-${mode}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { base, mode, pass: false, cases: [], fixture: 'Native profile and opaque legacy park rows; island answers use real UI.' };
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = [], assets = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.url().includes('/assets/park/')) assets.push(request.url()); });
        await page.goto(`${base}/#/park?learn=1&parkRenderer=three`);
        await page.waitForURL('**/#/onboarding');
        await page.getByRole('button', { name: mode === 'island' ? /^まなぶ$/ : /はじめる$/ }).waitFor();
        assert.equal(await page.locator('.park-welcome, .park-three-stage').count(), 0);
        await page.screenshot({ path: `${out}/${width}-onboarding.png` });
        const id = await seedNative(page, randomUUID());
        const legacy = await page.evaluate(async ({ id, numeric }) => {
            const request = indexedDB.open('SansuDatabase');
            const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            if (numeric) {
                const read = db.transaction('profiles').objectStore('profiles').get(id);
                const profile = await new Promise((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
                Object.assign(profile, { mathStartLevel: 7, mathMainLevel: 8, mathMaxUnlocked: 8,
                    mathLevels: [{ level: 8, unlocked: true, enabled: true, recentAnswersNonReview: [] }] });
                const tx = db.transaction(['profiles', 'appData'], 'readwrite');
                tx.objectStore('profiles').put(profile);
                tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: id, profiles: { [id]: profile } });
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
            }
            const rows = { parks: { profileId: id, revision: 7, oldCourse: 'retain' }, parkPlans: { id: `plan:${id}`, profileId: id, status: 'active', revision: 2, frozenProblem: 'retain' }, parkEvents: { id: `event:${id}`, profileId: id, type: 'visit', timestamp: 123 } };
            const tx = db.transaction(Object.keys(rows), 'readwrite');
            for (const [name, row] of Object.entries(rows)) tx.objectStore(name).put(row);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
            db.close(); return rows;
        }, { id, numeric: process.env.SANSU_RETIRED_NUMERIC === '1' });
        for (const route of ['/', '/park', '/park?learn=1&parkRenderer=three', '/__dev/g0', '/__dev/g0-v2', '/__dev/suika', '/__dev/wager']) {
            await page.goto(`${base}/#${route}`);
            await page.waitForURL(`**/#/${mode === 'island' ? 'island' : 'battle'}`);
            await page.locator(mode === 'island' ? '.island-page[data-mode="home"]' : '.game-hub').waitFor();
            assert.equal((await readNative(page, id)).islandPlans.length, 0, 'Redirect must not reserve questions');
        }
        await page.goto(`${base}/#/battle`);
        await page.getByRole('button', { name: /たんけん/ }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: /遊園地|ゆうえんち/ }).count(), 0);
        await page.screenshot({ path: `${out}/${width}-other-games.png` });
        if (mode === 'island') {
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await waitReady(page);
            if (process.env.SANSU_RETIRED_NUMERIC === '1') {
                const keypad = page.locator('.park-keypad');
                await keypad.waitFor();
                const rect = await keypad.boundingBox();
                assert(rect && rect.y >= 0 && rect.y + rect.height <= page.viewportSize().height, 'Keypad stays within the viewport');
            }
            const before = await readNative(page, id);
            await answerUI(page, before.plan, { dev: false });
            await page.screenshot({ path: `${out}/${width}-learning.png` });
            const after = await readNative(page, id);
            assert(after.logs.length > before.logs.length, 'Shared input still saves an answer');
        }
        const retained = await page.evaluate(async () => {
            const request = indexedDB.open('SansuDatabase');
            const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            const result = {};
            for (const name of ['parks', 'parkPlans', 'parkEvents']) {
                const r = db.transaction(name).objectStore(name).getAll();
                result[name] = await new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
            }
            db.close(); return result;
        });
        for (const [name, row] of Object.entries(legacy)) assert.deepEqual(retained[name], [row]);
        assert.deepEqual(assets, []); assert.deepEqual(errors, []);
        report.cases.push({ width, pass: true, legacyDataRetained: true, retiredAssetRequests: assets });
        await context.close();
    }
    report.pass = true;
    console.log(`PASS retired modes (${mode}, phone/tablet)`);
} catch (error) {
    report.error = String(error); throw error;
} finally {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
