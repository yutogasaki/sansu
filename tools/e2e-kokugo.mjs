import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { appRootMetadata, seedNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_KOKUGO_URL || 'http://127.0.0.1:5198';
const output = process.env.SANSU_KOKUGO_OUTPUT;
assert(output, 'Set a new SANSU_KOKUGO_OUTPUT directory');
await fs.mkdir(output, { recursive: false });
const browser = await chromium.launch();
const report = { at: new Date().toISOString(), base, fixture: 'isolated native profile; learning and rewards use actual UI', captures: [], scenarios: [], pass: false };
let currentPage;
async function store(page, name, databaseName = 'SansuDatabase') {
    return page.evaluate(async ({ name, databaseName }) => {
        if (databaseName === 'growing') {
            const available = await indexedDB.databases();
            databaseName = available.find(db => /^SansuGrowingIsland(?:Preview)?V1$/.test(db.name ?? '') && db.version > 1)?.name;
            if (!databaseName) throw new Error('No initialized growing database');
        }
        const request = indexedDB.open(databaseName);
        const database = await new Promise((ok, fail) => { request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
        try { const read = database.transaction(name).objectStore(name).getAll(); return await new Promise((ok, fail) => { read.onsuccess = () => ok(read.result); read.onerror = () => fail(read.error); }); }
        finally { database.close(); }
    }, { name, databaseName });
}
async function until(read, predicate) {
    for (let i = 0; i < 300; i++) { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Persisted Kokugo state did not reach expected result');
}
async function waitReady(page) {
    await page.locator('[data-growing-island="ready"] canvas').first().waitFor({ state: 'visible' });
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden', timeout: 180000 });
}
const pending = async page => (await store(page, 'kokugoPlans')).find(plan => plan.status === 'pending');
const click = (page, name) => page.locator('.kokugo-screen').getByRole('button', { name, exact: true }).click();
async function capture(page, name) {
    const metadata = await appRootMetadata(page);
    assert.equal(metadata.islandFeatureEnabled, true); assert.equal(metadata.natureTownFeatureEnabled, false);
    assert(metadata.revision && metadata.version); assert.equal(metadata.configuredDelivery, 'snap-root-v1');
    assert.equal(await page.locator('[data-kokugo-version]').getAttribute('data-kokugo-version'), 'kokugo-v1');
    const file = `${page.viewportSize().width}-${name}.png`;
    await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || Array.from(document.querySelectorAll('.kokugo-content')).some(element => element.scrollWidth > element.clientWidth + 1));
    assert.equal(overflow, false, `No horizontal overflow at ${name}`);
    report.captures.push({ file, route: page.url(), candidate: 'kokugo-v1', metadata,
        swControlled: await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), viewport: page.viewportSize() });
}
try {
    for (const width of [390, 768, 320]) {
        const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : width === 320 ? 568 : 844 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference', hasTouch: true });
        const page = currentPage = await context.newPage(); page.setDefaultTimeout(90000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        if (process.env.SANSU_KOKUGO_UPDATE_CONTROL) await page.request.post(`${process.env.SANSU_KOKUGO_UPDATE_CONTROL}/old`);
        await page.goto(`${base}/#/onboarding`);
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor();
        const profileId = await seedNative(page, `kokugo-${width}`);
        await page.goto(`${base}/#/island`); await waitReady(page);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('button', { name: '国語を まなぶ', exact: true }).click();
        await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor();
        const legacy = await store(page, 'islandPlans');
        await capture(page, 'catalog');
        await click(page, '読む'); await page.getByRole('button', { name: /R01 ·/ }).click();
        await click(page, '3もん やってみる');
        let plan = await until(() => pending(page), p => !!p?.slots[0].presentation);
        await capture(page, 'reading');
        const wrong = plan.slots[0].item.choices.find(choice => choice !== plan.slots[0].item.answer);
        await click(page, wrong);
        plan = await until(() => pending(page), p => p?.slots[0].firstAnswer?.correct === false);
        const frozen = structuredClone(plan);
        await capture(page, 'retry'); await page.reload();
        await page.locator('.kokugo-question').waitFor();
        assert.deepEqual(await pending(page), frozen);
        if (process.env.SANSU_KOKUGO_UPDATE_CONTROL) {
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
            await page.locator('.kokugo-question h2').click(); // A real interaction arms the protected route.
            const beforeVersion = (await appRootMetadata(page)).version;
            await page.request.post(`${process.env.SANSU_KOKUGO_UPDATE_CONTROL}/new`);
            await page.evaluate(async () => {
                const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
                await (await navigator.serviceWorker.getRegistration()).update(); await changed;
            });
            assert.equal((await appRootMetadata(page)).version, beforeVersion, 'The active question defers automatic reload');
            assert.deepEqual(await pending(page), frozen);
            await page.locator('.kokugo-header').getByRole('button', { name: 'しまへ 戻る', exact: true }).click();
            await page.waitForFunction(version => document.querySelector('.app-container')?.dataset.buildVersion === version,
                process.env.SANSU_KOKUGO_NEW_VERSION, { timeout: 120000 });
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.kokugo-question').waitFor();
            assert.deepEqual(await pending(page), frozen);
            await capture(page, 'two-build-restored');
        }

        await click(page, 'おてほん'); await click(page, 'たしかめて おわる');
        await click(page, 'つぎへ');
        for (let i = 1; i < 3; i++) {
            plan = await until(() => pending(page), p => p?.cursor === i && !!p.slots[i].presentation);
            await click(page, plan.slots[i].item.answer);
            await click(page, i === 2 ? 'ここまで おわる' : 'つぎへ');
        }
        await page.getByRole('heading', { name: 'ここまで できたね' }).waitFor();
        await capture(page, 'completed');
        assert.equal((await store(page, 'kokugoOutbox')).length, 3);
        const editorialPolicy = (await store(page, 'kokugoProgress')).some(p => p.evidencePolicy === 'editorial-2');
        assert.equal((await store(page, 'kokugoEvents')).filter(e => e.independent).length, editorialPolicy ? 0 : 2);
        assert.deepEqual(await store(page, 'islandPlans'), legacy);
        await page.locator('.kokugo-header').getByRole('button', { name: 'しまへ 戻る', exact: true }).click(); await waitReady(page);
        const ledger = await until(() => store(page, 'terrainFoundationReceipts', 'growing'), rows => rows.length === 3);
        assert(ledger.every(row => row.sourceVersion === 'kokugo-v1'));
        const island = (await store(page, 'terrainIslands', 'growing'))[0]; assert.equal(island.state.drops, 6);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('heading', { name: '国語を まなぼう' }).waitFor();
        await click(page, '伝える'); await page.getByRole('button', { name: /E05 ·/ }).click();
        await page.getByLabel('作品・メモ', { exact: true }).fill('今日は 川で 小さな石を 見つけました。');
        await page.getByRole('button', { name: '作品に のこす' }).click();
        await page.getByText('作品に のこしたよ。', { exact: true }).waitFor();
        await capture(page, 'writing');
        const works = await store(page, 'kokugoWorks'); assert.equal(works[0].saved, true);
        await page.reload(); await page.getByRole('heading', { name: '国語を まなぼう' }).waitFor();
        await click(page, '伝える'); await page.getByRole('button', { name: /E05 ·/ }).click();
        await until(() => page.getByLabel('作品・メモ', { exact: true }).isEnabled(), ready => ready);
        assert.equal(await page.getByLabel('作品・メモ', { exact: true }).inputValue(), works[0].text);
        await click(page, 'コースへ'); await click(page, 'お話を えらぶ'); await capture(page, 'book');
        await click(page, '読んだ本に のこす'); await page.getByText('読んだ本に のこしたよ。', { exact: true }).waitFor();
        await click(page, 'コースへ');
        await click(page, 'かな'); await page.getByRole('button', { name: /K05 ·/ }).click(); await click(page, '3もん やってみる');
        plan = await until(() => pending(page), p => !!p?.slots[0].presentation);
        const input = page.getByLabel('こたえ', { exact: true });
        await input.fill(plan.slots[0].item.answer);
        await until(() => pending(page), p => p?.slots[0].draft === plan.slots[0].item.answer);
        await page.reload(); await page.getByLabel('こたえ', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('こたえ', { exact: true }).inputValue(), plan.slots[0].item.answer);
        await page.getByLabel('こたえ', { exact: true }).dispatchEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true });
        assert.equal((await pending(page)).slots[0].firstAnswer, undefined);
        await capture(page, 'short-restored'); await click(page, 'たしかめる'); await click(page, 'つぎへ');
        for (let i = 1; i < 3; i++) {
            await until(() => pending(page), p => p?.cursor === i && !!p.slots[i].presentation);
            await click(page, 'あとで やる'); await click(page, i === 2 ? 'ここまで おわる' : 'つぎへ');
        }
        await click(page, '内容を えらぶ'); await click(page, 'かな');
        await page.getByRole('button', { name: /K01 ·/ }).click(); await click(page, '3もん やってみる');
        plan = await until(() => pending(page), p => !!p?.slots[0].presentation);
        assert.equal(await page.locator('.kokugo-choices button').first().isDisabled(), true);
        await click(page, '▶ ことばを きく');
        await until(() => pending(page), p => p?.slots[0].heard);
        await capture(page, 'listening'); await click(page, plan.slots[0].item.answer); await click(page, 'つぎへ');
        for (let i = 1; i < 3; i++) {
            await until(() => pending(page), p => p?.cursor === i && !!p.slots[i].presentation);
            await click(page, 'あとで やる'); await click(page, i === 2 ? 'ここまで おわる' : 'つぎへ');
        }
        await click(page, '内容を えらぶ');
        await click(page, '文'); await page.getByRole('button', { name: /S05 ·/ }).click(); await click(page, '3もん やってみる');
        plan = await until(() => pending(page), p => !!p?.slots[0].presentation);
        await click(page, plan.slots[0].item.answer.split('｜')[0]);
        await until(() => pending(page), p => !!p?.slots[0].draft);
        await page.reload(); await page.locator('.kokugo-order').waitFor();
        assert.equal(await page.locator('.kokugo-order').innerText(), plan.slots[0].item.answer.split('｜')[0]);
        await capture(page, 'order-restored');
        await click(page, '算数・英語を まなぶ');
        await page.getByRole('button', { name: '国語を まなぶ', exact: true }).waitFor();
        assert.equal((await store(page, 'kokugoCourses'))[0].preferred, false);
        assert.equal((await pending(page)).unitId, 'S05');
        if (process.env.SANSU_KOKUGO_OFFLINE === '1') {
            await page.evaluate(async () => { await navigator.serviceWorker.ready; });
            await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
            await context.setOffline(true); await page.goto(`${base}/#/kokugo`);
            await page.locator('.kokugo-order').waitFor(); assert.equal((await pending(page)).unitId, 'S05');
            await capture(page, 'offline-resume'); await context.setOffline(false);
        }
        // Reopening the explicit subject must select it again even with a pending unit.
        if (!await page.locator('.kokugo-screen').isVisible()) await page.getByRole('button', { name: '国語を まなぶ', exact: true }).click();
        await page.locator('.kokugo-question').waitFor();
        await until(() => store(page, 'kokugoCourses'), rows => rows[0]?.preferred === true);
        await page.goto(`${base}/#/stats`);
        await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('.kokugo-question').waitFor();
        await page.locator('.kokugo-header').getByRole('button', { name: 'もどる', exact: true }).click();
        await page.waitForURL(/#\/stats$/);
        await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('.kokugo-question').waitFor();
        // Delete the isolated fixture through the real settings UI in a second tab.
        const ownerSettings = await context.newPage();
        await ownerSettings.goto(`${base}/#/settings?section=profile`);
        await ownerSettings.locator('#settings-panel-profile').getByRole('button', { name: /のプロフィールを削除$/ }).click();
        await ownerSettings.getByRole('dialog', { name: 'データを けす', exact: true }).getByRole('button', { name: 'けす', exact: true }).click();
        await page.getByRole('heading', { name: 'プロフィールを えらんでね', exact: true }).waitFor();
        await capture(page, 'owner-deleted');
        for (const table of ['kokugoCourses', 'kokugoProgress', 'kokugoPlans', 'kokugoEvents', 'kokugoOutbox', 'kokugoWorks']) assert.equal((await store(page, table)).length, 0, `${table} is deleted with its owner`);
        await ownerSettings.close();
        await click(page, 'はじめの画面へ');
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor();
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, profileId, pass: true, rewardCount: 5, restoredShort: true, imeGuard: true, heardAudio: true, restoredWriting: true, restoredOrder: true, savedLegacyPlanRetainedDuringKokugo: true, parentReturn: true, ownerDeletionSafeExit: true, realTwoBuildUpdate: Boolean(process.env.SANSU_KOKUGO_UPDATE_CONTROL), offline: process.env.SANSU_KOKUGO_OFFLINE === '1' });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (currentPage && !currentPage.isClosed()) { await currentPage.screenshot({ path: `${output}/failure.png` }); report.url = currentPage.url(); report.body = (await currentPage.locator('body').innerText()).slice(0, 6000); }
} finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios, captures: report.captures.length, error: report.error }, null, 2));
if (!report.pass) process.exitCode = 1;
