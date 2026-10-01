import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';
import { closeMenu, inventory } from './island-life-ui-helpers.mjs';

const base = process.env.SANSU_COMMUNITY_URL, out = process.env.SANSU_COMMUNITY_OUTPUT;
const manifest = JSON.parse(await readFile(process.env.SANSU_COMMUNITY_MANIFEST));
assert(base && out); assert.equal(manifest.version.island.life.saveVersion, 21); await mkdir(out, { recursive: false });
async function verifySource() {
    for (const file of [...manifest.files, ...manifest.distFiles]) {
        assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'), file.sha256, file.path);
    }
}
await verifySource();
const browser = await chromium.launch();
const report = { target: base, version: manifest.version, sourceHash: manifest.sourceHash, humanN: 0,
    scope: 'Real onboarding, three earned answers, two purchases, explicit visit, invitation, house and same learning reservation. Production SW offline restart. No profile, credits, clocks or membership injected.', cases: [], captures: [], pass: false };
const world = page => page.locator('.life-world[data-rendered="true"]').waitFor();
async function room(page) {
    await page.waitForFunction(() => {
        const el = document.querySelector('[data-renderer="three"]');
        return el && JSON.parse(el.dataset.keepsakeRoom || 'null')?.visible && Number(el.dataset.drawCalls) > 10;
    });
    assert.equal(await page.locator('.island-page').getAttribute('data-house-candidate'), 'house-world-first-v1');
    assert.equal(await page.locator('.life-world').count(), 0);
}
async function owner(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuIslandLifeV1');
        const db = await new Promise((ok, no) => { open.onsuccess = () => ok(open.result); open.onerror = () => no(open.error); });
        try {
            const read = db.transaction('worlds').objectStore('worlds').getAll();
            return await new Promise((ok, no) => { read.onsuccess = () => ok(read.result[0]); read.onerror = () => no(read.error); });
        } finally { db.close(); }
    });
}
async function capture(page, label) {
    const file = `${page.viewportSize().width}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), houseCandidate: await page.locator('.island-page').getAttribute('data-house-candidate'),
        world: await page.locator('.life-world').count() ? await page.locator('.life-world').first().evaluate(n => ({ candidate: n.dataset.lifeVisualCandidate, time: n.dataset.gardenTime, render: n.dataset.lifeRender })) : null });
}
async function purchase(page, kind, cell) {
    await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click();
    const product = page.locator(`[data-life-buy="${kind}"]`);
    for (let i = 0; !await product.isVisible() && i < 10; i++) await page.getByRole('button', { name: 'つぎの ページ', exact: true }).click();
    await product.click(); await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
    const selectedCell = page.locator(`[data-life-cell="${cell}"]`);
    for (let i = 0; !await selectedCell.isVisible() && i < 12; i++) await page.getByRole('button', { name: 'つぎの マス', exact: true }).click();
    await selectedCell.click();
    await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
    for (let attempt = 0; attempt < 4; attempt++) {
        await page.waitForFunction(() => !document.querySelector('.life-placement')
            || document.querySelector('.life-placement .life-error button:not(:disabled)'));
        if (!await page.locator('.life-placement').count()) break;
        const message = await page.locator('.life-placement .life-error p').innerText();
        assert.equal(message, 'そこを あるいているよ。すこし まって もういちど おこう。');
        assert(attempt < 3, 'Resident clearance did not recover after three real UI retries');
        (report.placementRetries ??= []).push({ width: page.viewportSize().width, kind, attempt: attempt + 1, message });
        await page.waitForTimeout(2000);
        await page.locator('.life-placement').getByRole('button', { name: 'もういちど', exact: true }).click();
    }
    await closeMenu(page);
}
let active;
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = active = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(base); await page.locator('.island-welcome').waitFor(); await capture(page, 'welcome'); assert.deepEqual(await (await page.request.get(`${base}/version.json`)).json(), manifest.version);
        for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
        await page.locator('[data-input-ready="true"]').waitFor();
        const sound = page.getByRole('button', { name: 'おとを けす', exact: true }); if (await sound.isVisible()) await sound.click();
        let native = await readNative(page); const firstPlan = native.plan.id; await capture(page, 'first-learning');
        while (native.plan.id === firstPlan) native = (await answerUI(page, native.plan, { touch: true, dev: false })).state;
        const learning = native;
        await page.getByRole('button', { name: 'とじる', exact: true }).click(); await world(page);
        await page.waitForFunction(() => document.querySelector('.island-life')?.dataset.lifeDrops === '6');
        assert.equal(await page.locator('.island-life').getAttribute('data-life-residents'), 'pokomoko');
        await purchase(page, 'flower', '0,3'); await purchase(page, 'water-bowl', '1,3');
        await page.waitForFunction(() => document.querySelector('.island-life')?.dataset.lifeDrops === '0');
        const bought = await owner(page); const bowl = bought.actions.find(a => a.command.type === 'buy' && a.command.kind === 'water-bowl').id;
        await inventory(page, bowl); await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click();
        await page.getByRole('button', { name: 'メニューを とじる', exact: true }).waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'カワウソが あそびに きたよ', exact: true }).waitFor({ timeout: 90000 });
        await capture(page, 'visitor');
        await page.getByRole('button', { name: 'カワウソが あそびに きたよ', exact: true }).click();
        const invite = page.locator('[data-life-friend="otter"] button'); await invite.scrollIntoViewIfNeeded();
        assert((await invite.boundingBox()).height >= 44); await capture(page, 'invitation'); await invite.click();
        await page.waitForFunction(() => document.querySelector('.island-life')?.dataset.lifeResidents === 'pokomoko,otter');
        await page.getByRole('button', { name: 'しまの ようすを とじる', exact: true }).click();
        const joined = await owner(page); assert.equal(joined.version, 21);
        assert.equal(joined.actions.filter(a => a.command.type === 'invite-friend').length, 1);
        assert.deepEqual(joined.credits, bought.credits); assert.deepEqual(await readNative(page), learning);
        for (const [hour, time] of [[7, 'morning'], [12, 'day'], [17, 'dusk'], [21, 'night']]) {
            await page.clock.setFixedTime(new Date(2026, 9, 1, hour));
            await page.evaluate(() => window.dispatchEvent(new Event('focus')));
            await page.waitForFunction(t => document.querySelector('.island-life')?.dataset.gardenTime === t, time); await capture(page, `garden-${time}`);
            await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
            await page.getByRole('button', { name: 'いえへ', exact: true }).click(); await room(page);
            await capture(page, `house-${time}`);
            if (time === 'night') { await page.reload(); await room(page); await capture(page, 'house-reload'); }
            assert.deepEqual(await readNative(page), learning); assert.deepEqual((await owner(page)).actions, joined.actions);
            await page.getByRole('button', { name: 'しま', exact: true }).click(); await world(page);
        }
        await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await world(page);
        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
        await context.setOffline(true); await page.reload(); await world(page);
        assert.equal(await page.locator('.island-life').getAttribute('data-life-residents'), 'pokomoko,otter');
        assert.deepEqual((await owner(page)).actions, joined.actions); await capture(page, 'offline-joined');
        await page.locator('.island-shell-nav').getByRole('button', { name: 'いえ', exact: true }).click();
        await room(page); await capture(page, 'offline-interior');
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('[data-input-ready="true"]').waitFor();
        assert.deepEqual(await readNative(page), learning); await capture(page, 'same-learning');
        native = (await answerUI(page, learning.plan, { touch: true, dev: false })).state;
        assert.equal(native.logs.length, learning.logs.length + 1); assert.deepEqual(errors, []);
        report.cases.push({ width, sameLearning: true, retainedMembership: true, offlineAnswer: true, errors });
        await context.close();
    }
    await verifySource(); report.pass = true;
} catch (error) {
    report.error = String(error.stack); process.exitCode = 1;
    if (active && !active.isClosed()) {
        report.failureSave = { life: await owner(active).catch(() => null), native: await readNative(active).catch(() => null) };
        await active.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    }
} finally {
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
    console.log(JSON.stringify({ pass: report.pass, cases: report.cases, error: report.error }));
}
