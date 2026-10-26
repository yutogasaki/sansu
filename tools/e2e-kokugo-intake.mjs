import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { Matrix4, Vector3 } from 'three';
import { appRootMetadata } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_KOKUGO_URL || 'http://127.0.0.1:5198';
const output = process.env.SANSU_KOKUGO_OUTPUT;
assert(output, 'Set a new SANSU_KOKUGO_OUTPUT'); await fs.mkdir(output);
const report = { at: new Date().toISOString(), base, fixture: 'empty browser, real first-play UI, no inserted profile', scenarios: [], browserErrors: [], requestFailures: [], pass: false };
const browser = await chromium.launch(); let page;
async function rows(name) {
    return page.evaluate(async name => {
        const open = indexedDB.open('SansuDatabase');
        const d = await new Promise((ok, fail) => { open.onsuccess = () => ok(open.result); open.onerror = () => fail(open.error); });
        try { const get = d.transaction(name).objectStore(name).getAll(); return await new Promise((ok, fail) => { get.onsuccess = () => ok(get.result); get.onerror = () => fail(get.error); }); }
        finally { d.close(); }
    }, name);
}
async function until(read, predicate) {
    for (let i = 0; i < 600; i++) { const value = await read(); if (predicate(value)) return value; await new Promise(ok => setTimeout(ok, 100)); }
    throw new Error('First-play saved state not ready');
}
const pending = async () => (await rows('kokugoPlans')).find(plan => plan.status === 'pending');
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        page = await context.newPage(); page.setDefaultTimeout(120000);
        const errors = []; page.on('pageerror', error => { errors.push(error.message); report.browserErrors.push(error.stack); });
        page.on('requestfailed', request => report.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText }));
        await page.goto(`${base}/#/onboarding`);
        await page.getByRole('button', { name: 'しまへ いく', exact: true }).click();
        await page.locator('[data-growing-island="ready"] canvas').first().waitFor();
        await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden', timeout: 240000 });
        // Follow the existing first-play home placement through the real camera and UI.
        await page.getByRole('button', { name: 'おうちを つくる', exact: true }).click();
        const host = page.locator('[data-growing-world]');
        const { pose, bounds } = await host.evaluate(node => ({ pose: JSON.parse(node.dataset.growingCamera), bounds: JSON.parse(node.dataset.growingBounds) }));
        const box = await host.locator('canvas').boundingBox(); assert(box);
        const point = new Vector3(1 - (bounds.minX + bounds.maxX) / 2, .04, 1)
            .applyMatrix4(new Matrix4().fromArray(pose.matrixWorld).invert()).applyMatrix4(new Matrix4().fromArray(pose.projectionMatrix));
        await page.touchscreen.tap(box.x + (point.x + 1) * box.width / 2, box.y + (1 - point.y) * box.height / 2);
        await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
        await page.getByRole('button', { name: 'ぜんぶ ひらく', exact: true }).click();
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('button', { name: '小学 2 年生', exact: true }).click();
        await page.getByRole('button', { name: /^こくご/ }).click();
        await page.getByRole('heading', { name: '国語を まなぼう' }).waitFor();
        const profile = (await rows('profiles'))[0]; assert(profile);
        assert.equal((await rows('kokugoCourses'))[0].preferred, true);
        assert.deepEqual(await rows('memoryMath'), []); assert.deepEqual(await rows('memoryVocab'), []);
        assert.deepEqual(await rows('islandPlans'), []); assert.deepEqual(await rows('logs'), []);
        await page.screenshot({ path: `${output}/${width}-first-national-choice.png` });
        await page.getByRole('button', { name: '読む', exact: true }).click();
        await page.getByRole('button', { name: /R01 ·/ }).click();
        await page.getByRole('button', { name: '3もん やってみる', exact: true }).click();
        for (let cursor = 0; cursor < 3; cursor++) {
            const plan = await until(pending, plan => plan?.cursor === cursor && !!plan.slots[cursor].presentation);
            await page.getByRole('button', { name: plan.slots[cursor].item.answer, exact: true }).click();
            await page.getByRole('button', { name: cursor === 2 ? 'ここまで おわる' : 'つぎへ', exact: true }).click();
        }
        await page.getByRole('heading', { name: 'ここまで できたね' }).waitFor();
        assert.equal((await rows('kokugoOutbox')).length, 3); assert.deepEqual(await rows('memoryMath'), []);
        await page.locator('.kokugo-header').getByRole('button', { name: 'しまへ 戻る', exact: true }).click();
        await page.locator('[data-growing-island="ready"] canvas').first().waitFor();
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.getByRole('heading', { name: '国語を まなぼう' }).waitFor();
        await page.screenshot({ path: `${output}/${width}-first-return.png` });
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, owner: profile.id, pass: true, realFirstHomePlaced: true, noMathAbilitySeeded: true, firstThreeCompleted: true, preferredCourseResumed: true, runtime: await appRootMetadata(page) });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.error = error.stack; report.url = page?.url();
    if (page && !page.isClosed()) { report.body = await page.locator('body').innerText(); await page.screenshot({ path: `${output}/failure.png` }); }
} finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios, error: report.error }, null, 2));
if (!report.pass) process.exitCode = 1;
