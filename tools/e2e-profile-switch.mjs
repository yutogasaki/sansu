import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { answerUI, openGrowingMenu, openIslandDestination, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_PROFILE_URL ?? 'http://127.0.0.1:5198';
const out = process.env.SANSU_PROFILE_OUTPUT;
assert(out, 'Set SANSU_PROFILE_OUTPUT to a fresh output directory');
await fs.mkdir(out, { recursive: false });
const compiled = await build({ stdin: { contents: `
    export { createInitialProfile } from './src/domain/user/profile.ts';
    export { getLevelForSkill } from './src/domain/math/curriculum.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const report = { target: base, scope: 'Disposable profile fixtures at math levels 3 and 13; actual UI switching, planner, answer persistence and reservation resume. Stale local mirror is an explicit fault diagnostic. No production deployment or device claim.', scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const low = domain.createInitialProfile('低レベル', 1, 2, 1, 'math');
        const high = domain.createInitialProfile('高レベル', 4, 12, 4, 'math');
        for (const p of [low, high]) { p.soundEnabled = false; p.hissanModeEnabled = false; }
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            await page.evaluate(async ({ low, high }) => {
                const request = indexedDB.open('SansuDatabase');
                const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
                const tx = db.transaction(['profiles', 'appData'], 'readwrite');
                for (const p of [low, high]) tx.objectStore('profiles').put(p);
                tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: high.id, profiles: { [low.id]: low, [high.id]: high } });
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
                db.close();
                // Commit chose high; simulate a stale mirror left by another reader/tab.
                localStorage.setItem('sansu_active_profile', low.id);
            }, { low, high });
            await page.goto(`${base}/#/island`);
            await waitReady(page);
            const checkOwner = async person => {
                const menu = await openGrowingMenu(page);
                await menu.locator('.growing-pocket-profile').waitFor();
                assert.equal(await menu.locator('.growing-pocket-profile').textContent(), person.name, 'The menu shows the committed profile');
                await menu.getByRole('button', { name: 'メニューを とじる', exact: true }).click();
                const active = await page.evaluate(async () => {
                    const request = indexedDB.open('SansuDatabase');
                    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                    const get = db.transaction('appData').objectStore('appData').get('app');
                    const app = await new Promise(resolve => { get.onsuccess = () => resolve(get.result); });
                    db.close();
                    return { committed: app.activeProfileId, mirror: localStorage.getItem('sansu_active_profile') };
                });
                assert.equal(active.committed, person.id);
                assert.equal(active.mirror, person.id);
            };
            await checkOwner(high);
            const plans = new Map();
            for (const [index, person] of [high, low, high, low].entries()) {
                if (index > 0) {
                    if (index === 1) {
                        await openIslandDestination(page, '設定');
                    } else {
                        const menu = await openGrowingMenu(page);
                        await menu.getByRole('button', { name: 'あそぶ人を きりかえる', exact: true }).click();
                    }
                    await page.getByRole('button', { name: `${person.name}に きりかえる`, exact: true }).click();
                    await page.getByRole('dialog', { name: 'だれが あそぶ？', exact: true }).waitFor({ state: 'hidden' });
                    await waitMode(page, 'home'); await waitReady(page); await checkOwner(person);
                }
                await page.locator('.island-shell-tab--learn').click();
                await waitMode(page, 'learning'); await waitReady(page);
                let state = await readNative(page, person.id);
                assert.equal(state.plan.profileId, person.id);
                const slot = state.plan.slots[state.plan.cursor];
                assert.equal(domain.getLevelForSkill(slot.problem.categoryId), person.mathMainLevel);
                const previous = plans.get(person.id);
                if (previous) { assert.equal(state.plan.id, previous.id); assert.equal(slot.problem.id, previous.problemId); }
                await page.screenshot({ path: `${out}/${width}-${index}-learning.png` });
                if (!previous) {
                    state = (await answerUI(page, state.plan, { dev: false })).state;
                    assert.equal(state.logs.length, 1);
                }
                plans.set(person.id, { id: state.plan.id, problemId: state.plan.slots[state.plan.cursor].problem.id });
                await page.getByRole('button', { name: 'とじる', exact: true }).click();
                await waitMode(page, 'home'); await waitReady(page);
            }
            for (const person of [low, high]) assert.equal((await readNative(page, person.id)).logs.length, 1);
            assert.deepEqual(errors, []);
            report.scenarios.push({ width, metadata: await runtimeMetadata(page), pass: true });
        } catch (error) {
            const failure = { width, pass: false, error: String(error.stack || error), url: page.url(), errors };
            failure.screen = await page.locator('body').innerText().catch(() => 'unavailable');
            failure.native = await readNative(page).catch(() => null);
            await page.screenshot({ path: `${out}/${width}-failure.png` }).catch(() => {});
            report.scenarios.push(failure);
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
    console.log('PASS profile switch: stale mirror, settings/home switch, first-question levels, isolated answers and reservation resume at 390/768');
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
