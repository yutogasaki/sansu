import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';

// Run against a production preview built with VITE_BUILD_PLAY_ENABLED=true.
const base = process.env.SANSU_PARK_PRODUCTION_URL || 'http://127.0.0.1:5287';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { window.__SANSU_PWA_E2E__ = true; });
async function stored() {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const rows = async table => {
            const request = database.transaction(table).objectStore(table).getAll();
            return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        };
        const result = { plans: await rows('parkPlans'), parks: await rows('parks'), logs: await rows('logs'), runs: await rows('exploreRuns') };
        database.close(); return result;
    });
}
const dispatch = (type, detail) => page.evaluate(({ type, detail }) => window.dispatchEvent(new CustomEvent(type, { detail })), { type, detail });
try {
    await page.goto(`${base}/#/park`);
    await page.waitForURL('**/#/onboarding');
    await page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const p = { id: 'park-production-test', name: 'つむぎ', grade: 2, mathStartLevel: 1, mathMainLevel: 2, mathMaxUnlocked: 2,
            vocabStartLevel: 1, vocabMainLevel: 1, vocabMaxUnlocked: 1, subjectMode: 'math', soundEnabled: false,
            mathSkills: {}, vocabWords: {}, mathLevels: [{ level: 2, unlocked: true, enabled: true, recentAnswersNonReview: [] }],
            streak: 0, todayCount: 0, recentAttempts: [] };
        const tx = database.transaction(['profiles', 'appData'], 'readwrite');
        tx.objectStore('profiles').put(p);
        tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        localStorage.setItem('sansu_active_profile', p.id);
        database.close();
    });
    await page.goto(`${base}/#/`);
    await page.locator('[data-game-id]').waitFor();
    assert.equal(new URL(page.url()).hash, '#/park');
    await fs.mkdir('output/playwright/park', { recursive: true });
    await page.screenshot({ path: 'output/playwright/park/production-ready.png' });
    const revision = await page.locator('[data-game-id]').getAttribute('data-build-revision');
    const candidate = await page.locator('[data-game-id]').getAttribute('data-visual-candidate-id');
    await page.getByRole('button', { name: 'つくる', exact: true }).click();
    await page.getByRole('button', { name: 'シャボンゲートを つくる', exact: true }).click();
    await page.locator('.park-answer').waitFor();
    const before = await stored();
    const marker = 'park-pending-checkpoint';
    await dispatch('sansu:pwa-e2e-reload', { version: marker });
    await page.waitForTimeout(600);
    assert.equal(new URL(page.url()).searchParams.get('__app-update'), null);
    await page.getByRole('button', { name: 'ひとやすみ', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(new URL(page.url()).searchParams.get('__app-update'), null);
    const navigation = page.waitForRequest(r => r.isNavigationRequest() && new URL(r.url()).searchParams.get('__app-update') === marker);
    await page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
    await navigation;
    await page.waitForURL(url => url.searchParams.get('__app-update') === marker);
    await page.locator('[data-game-id]').waitFor();
    assert.deepEqual((await stored()).plans, before.plans);
    assert.equal((await stored()).logs.length, 0);
    assert.equal((await stored()).parks[0].parts.length, 2);
    console.log('PASS production park checkpoint preserves pending learning');
    await page.getByRole('button', { name: 'つづきから', exact: true }).click();
    await page.locator('.park-answer').waitFor();
    await dispatch('sansu:pwa-e2e-persistence', { active: true });
    await dispatch('sansu:pwa-e2e-reload', { version: 'park-save-hold' });
    await page.getByRole('button', { name: 'せってい', exact: true }).click();
    await page.waitForTimeout(600);
    assert.notEqual(new URL(page.url()).searchParams.get('__app-update'), 'park-save-hold');
    const heldNavigation = page.waitForRequest(r => r.isNavigationRequest() && new URL(r.url()).searchParams.get('__app-update') === 'park-save-hold');
    await dispatch('sansu:pwa-e2e-persistence', { active: false });
    await heldNavigation;
    await page.waitForURL(url => url.searchParams.get('__app-update') === 'park-save-hold');
    assert.deepEqual((await stored()).plans, before.plans);
    console.log('PASS production park persistence hold spans navigation');
    await page.goto(`${base}/#/explore`);
    await page.waitForFunction(async () => {
        const request = indexedDB.open('SansuDatabase');
        return new Promise(resolve => { request.onsuccess = () => {
            const d = request.result;
            const get = d.transaction('exploreRuns').objectStore('exploreRuns').getAll();
            get.onsuccess = () => { d.close(); resolve(get.result.some(r => r.status === 'active' && r.activeCheckpoint)); };
        }; });
    });
    const old = (await stored()).runs.find(r => r.status === 'active');
    await page.goto(`${base}/#/`);
    await page.waitForURL('**/#/explore');
    const same = (await stored()).runs.find(r => r.status === 'active');
    assert.equal(same.runId, old.runId);
    assert.deepEqual((await stored()).plans, before.plans);
    assert.deepEqual(errors, []);
    await fs.writeFile('output/playwright/park/production-report.json', JSON.stringify({ target: base, revision,
        flag: 'VITE_BUILD_PLAY_ENABLED=true', candidate,
        passed: ['pending learning checkpoint', 'critical persistence navigation hold', 'old active run precedence'] }, null, 2));
    console.log('PASS production old run remains the launch priority');
} finally { await context.close(); await browser.close(); }
