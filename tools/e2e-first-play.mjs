import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { Matrix4, Vector3 } from 'three';
import { installOnboardingFault, onboardingControls } from './island-onboarding-checks.mjs';

const base = process.env.SANSU_FIRST_PLAY_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_FIRST_PLAY_OUTPUT;
assert(out, 'Use a fresh SANSU_FIRST_PLAY_OUTPUT directory');
await fs.mkdir(out, { recursive: false });
console.log('FIRST_PLAY_PID', process.pid);
const browser = await chromium.launch();
const report = { target: base, date: new Date().toISOString(), scenarios: [], captures: [], pass: false };
const inputs = ['src/domain/user/firstPlay.ts', 'src/domain/user/onboarding.ts', 'src/components/island/IslandOnboarding.tsx',
    'src/components/island/IslandFirstSetup.tsx', 'src/components/island/IslandWelcome.tsx', 'src/components/island/IslandOnboarding.css',
    'src/components/island/growing/GrowingIsland.tsx', 'src/components/island/growing/GrowingIslandMenu.tsx', 'tools/e2e-first-play.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
report.inputs = await hashes();
let activePage;
async function store(page, database, table, key) {
    return page.evaluate(async ({ database, table, key }) => {
        const request = indexedDB.open(database);
        const db = await new Promise((ok, no) => { const timer = setTimeout(() => no(Error(`IDB open timed out: ${database}/${table}`)), 30000); request.onsuccess = () => { clearTimeout(timer); ok(request.result); }; request.onerror = () => { clearTimeout(timer); no(request.error); }; request.onblocked = () => { clearTimeout(timer); no(Error(`IDB open blocked: ${database}`)); }; });
        try {
            const read = db.transaction(table).objectStore(table);
            const request = key === undefined ? read.getAll() : read.get(key);
            return await new Promise((ok, no) => { const timer = setTimeout(() => no(Error(`IDB read timed out: ${database}/${table}`)), 30000); request.onsuccess = () => { clearTimeout(timer); ok(request.result); }; request.onerror = () => { clearTimeout(timer); no(request.error); }; });
        } finally { db.close(); }
    }, { database, table, key });
}
const session = page => store(page, 'SansuDatabase', 'appData', 'island-first-play');
const world = async page => store(page, base.includes(':5198') ? 'SansuGrowingIslandPreviewV1' : 'SansuGrowingIslandV1', 'placedIslands', (await session(page)).ownerId);
async function until(read, predicate) {
    for (let n = 0; n < 300; n++) { const value = await read(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 100)); }
    throw Error('Saved state did not reach expected condition');
}
async function ready(page) {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
}
async function capture(page, name) {
    const file = `${page.viewportSize().width}-${name}.png`;
    await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    const candidate = page.locator('[data-onboarding-candidate]').first();
    report.captures.push({ file, ...(await runtimeMetadata(page)),
        candidate: await candidate.count() ? await candidate.getAttribute('data-onboarding-candidate') : null,
        cache: await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker.controller), online: navigator.onLine })) });
}
// Initial production island only: use the renderer's real camera and bounds.
// This never creates a second world or writes a placement fixture into the DB.
async function plantFirstHome(page) {
    await page.getByRole('button', { name: 'おうちを つくる', exact: true }).click();
    const host = page.locator('[data-growing-world]');
    assert.equal(await host.getAttribute('data-native-growing-art'), 'false');
    const { pose, bounds } = await host.evaluate(node => ({ pose: JSON.parse(node.dataset.growingCamera), bounds: JSON.parse(node.dataset.growingBounds) }));
    const box = await host.locator('canvas').boundingBox(); assert(box);
    const point = new Vector3(1 - (bounds.minX + bounds.maxX) / 2, .04, 1)
        .applyMatrix4(new Matrix4().fromArray(pose.matrixWorld).invert())
        .applyMatrix4(new Matrix4().fromArray(pose.projectionMatrix));
    await page.touchscreen.tap(box.x + (point.x + 1) * box.width / 2, box.y + (1 - point.y) * box.height / 2);
    await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
}
async function emptyLearning(page) {
    for (const name of ['profiles', 'memoryMath', 'memoryVocab', 'logs', 'islandPlans', 'islandEvents'])
        assert.deepEqual(await store(page, 'SansuDatabase', name), [], `${name} must stay empty before learning setup`);
}
async function enter(page) {
    await page.goto(`${base}/#/onboarding`);
    await page.getByRole('button', { name: 'しまへ いく', exact: true }).click();
    await ready(page);
}
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(90000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await installOnboardingFault(page, 'abort-once');
        await page.goto(`${base}/#/onboarding`);
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor();
        await emptyLearning(page);
        assert.equal(await session(page), undefined);
        await page.getByRole('button', { name: 'ぽこもこに あいさつ', exact: true }).click();
        await page.getByText('きみに あえて').waitFor();
        await capture(page, 'welcome');
        await onboardingControls(page, '.first-play-entry button');
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).click(); await ready(page);
        const owner = (await session(page)).ownerId;
        await emptyLearning(page); await capture(page, 'arrival'); console.log('READY arrival', width);
        await plantFirstHome(page);
        console.log('PLACED action', width);
        const planted = await until(() => world(page), r => r?.state.plots.length === 1); console.log('SAVED home', width);
        assert.equal(planted.state.villagers.length, 1);
        await page.reload(); await ready(page); console.log('RELOADED home', width);
        assert.equal((await session(page)).ownerId, owner);
        assert.deepEqual((await world(page)).state.plots.map(p => ({ id: p.id, cell: p.cell })), planted.state.plots.map(p => ({ id: p.id, cell: p.cell })));
        await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).click();
        const welcomed = await until(() => world(page), r => Boolean(r?.state.guidance?.starter.steps.S3));
        await emptyLearning(page); await capture(page, 'first-neighbor'); console.log('READY neighbor', width);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('textbox', { name: /なまえ/ }).fill('あお');
        await page.getByRole('button', { name: '年中', exact: true }).click();
        await page.getByRole('heading', { name: 'なにを まなぶ？' }).waitFor();
        await page.reload(); await page.getByRole('heading', { name: 'なにを まなぶ？' }).waitFor();
        assert.equal((await session(page)).selection.name, 'あお');
        await emptyLearning(page);
        await page.getByRole('button', { name: 'しまへ もどる', exact: true }).click(); await ready(page);
        assert.equal((await world(page)).state.villagers[0].id, welcomed.state.villagers[0].id);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('button', { name: '年中', exact: true }).click();
        await page.getByRole('button', { name: 'さんすう', exact: true }).click();
        await capture(page, 'learning-setup');
        if (width === 390) await page.evaluate(() => window.__armOnboardingFault());
        await page.getByRole('button', { name: '数をかぞえる・くらべる', exact: true }).click();
        if (width === 390) {
            await page.getByRole('alert').filter({ hasText: 'ほぞんできなかった' }).waitFor();
            await emptyLearning(page);
            assert.equal((await session(page)).completed, false);
            assert.equal((await world(page)).state.villagers[0].id, welcomed.state.villagers[0].id);
            await page.getByRole('button', { name: '数をかぞえる・くらべる', exact: true }).click();
        }
        await page.locator('[data-input-ready="true"]').waitFor(); console.log('READY learning', width);
        const profiles = await store(page, 'SansuDatabase', 'profiles');
        assert.equal(profiles.length, 1); assert.equal(profiles[0].id, owner);
        assert.equal((await session(page)).completed, true);
        assert.equal((await world(page)).state.villagers[0].id, welcomed.state.villagers[0].id);
        let native = await readNative(page, owner);
        assert.equal(native.plan.slots.length, 3);
        const first = native.plan.id;
        for (let n = 0; n < 3; n++) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        assert.notEqual(native.plan.id, first);
        await capture(page, 'learning');
        await page.getByRole('button', { name: 'とじる', exact: true }).click(); await ready(page);
        const earned = await until(() => world(page), r => r?.state.learned.length === 3);
        assert.equal(earned.state.drops, 6);
        await capture(page, 'return');
        if (!base.includes(':5198')) {
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.reload(); await ready(page);
            await context.setOffline(true); await page.reload(); await ready(page);
            assert.equal((await world(page)).state.seed, owner);
            assert.equal((await world(page)).state.villagers[0].id, welcomed.state.villagers[0].id);
            await capture(page, 'offline-return'); await context.setOffline(false);
        }
        await page.goto(`${base}/#/onboarding`); await page.waitForURL('**/#/island'); await ready(page);
        assert.equal((await store(page, 'SansuDatabase', 'profiles')).length, 1);
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, owner, realAnswers: 3, guestReload: true, setupReload: true, failureRollback: width === 390,
            sameIsland: true, offline: !base.includes(':5198'), passed: true });
        await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = activePage = await context.newPage(); page.setDefaultTimeout(90000);
    await enter(page); await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
    await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
    await page.getByRole('button', { name: 'えいご', exact: true }).click();
    await page.getByRole('button', { name: 'はじめて', exact: true }).click();
    await page.locator('[data-input-ready="true"]').waitFor();
    assert.deepEqual(await store(page, 'SansuDatabase', 'memoryMath'), []);
    assert.equal((await store(page, 'SansuDatabase', 'profiles'))[0].subjectMode, 'vocab');
    report.scenarios.push({ name: 'English only, no prior required play or invented math memory', passed: true });
    await context.close();
    assert.deepEqual(await hashes(), report.inputs, 'Changed inputs require a fresh run');
    report.pass = true; console.log('PASS first play: welcome, real placement/neighbor, reload, rollback, setup, real learning, return, English-only');
} catch (error) {
    report.error = String(error); report.url = activePage?.url();
    if (activePage && !activePage.isClosed()) {
        report.body = await activePage.locator('body').innerText().catch(() => '');
        await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    }
    throw error;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
