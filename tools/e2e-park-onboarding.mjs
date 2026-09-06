import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5188';
const out = process.env.SANSU_PARK_ONBOARDING_OUTPUT || 'output/playwright/park-onboarding';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const report = { target: base, browser: browser.version(), candidate: 'park-three-resin-v1', device: 'Chromium viewport emulation, not physical mobile', scenarios: [], errors: [] };
async function data(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const d = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const values = {};
        for (const table of ['profiles', 'parks', 'logs', 'parkPlans']) {
            const r = d.transaction(table).objectStore(table).getAll();
            values[table] = await new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        }
        d.close(); return values;
    });
}
const capture = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 320, height: 640 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: viewport.width === 320 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(`${base}/#/`);
        await page.waitForURL('**/#/onboarding');
        await page.getByRole('heading', { name: 'ちいさな遊園地', exact: true }).waitFor();
        await page.locator('[data-art-candidate="park-three-resin-v1"] canvas[data-frames]').waitFor();
        const text = await page.locator('body').innerText();
        assert(!text.includes('ポッコ') && !text.includes('たんけん'));
        const cta = await page.getByRole('button', { name: 'はじめる', exact: true }).boundingBox();
        assert(cta.y >= 0 && cta.y + cta.height <= viewport.height && cta.height >= 44);
        const frames = await page.locator('canvas').getAttribute('data-frames');
        await page.waitForTimeout(400);
        assert.equal(await page.locator('canvas').getAttribute('data-frames'), frames);
        assert.equal((await data(page)).profiles.length, 0, 'Welcome must not provision a profile or parts');
        const revision = await page.locator('[data-onboarding-world]').getAttribute('data-build-revision');
        await capture(page, `${viewport.width}-welcome`);
        await page.getByRole('button', { name: 'はじめる', exact: true }).click();
        assert.equal(await page.locator('canvas').count(), 0);
        assert(await page.getByRole('button', { name: '次へ', exact: true }).isDisabled());
        await page.getByRole('textbox', { name: 'あだ名でOK' }).fill('つむぎ');
        await capture(page, `${viewport.width}-name`);
        await page.getByRole('button', { name: '次へ', exact: true }).click();
        await page.getByRole('button', { name: /小学 6 年生/ }).waitFor();
        const grades = page.locator('.park-onboarding-grade');
        assert.equal(await grades.count(), 9);
        const bounds = await grades.evaluateAll(buttons => buttons.map(b => {
            const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, textOverflow: b.scrollWidth > b.clientWidth };
        }));
        assert(bounds.every(b => b.width >= 44 && b.height >= 44 && b.x >= 0 && b.x + b.width <= viewport.width && !b.textOverflow));
        await grades.last().scrollIntoViewIfNeeded();
        assert((await grades.last().boundingBox()).y + (await grades.last().boundingBox()).height <= viewport.height);
        await capture(page, `${viewport.width}-grade`);
        await page.getByRole('button', { name: /小学 1 年生/ }).click();
        await capture(page, `${viewport.width}-subject`);
        await page.getByRole('button', { name: /さんすう だけ/ }).click();
        await capture(page, `${viewport.width}-level`);
        assert.equal((await data(page)).profiles.length, 0);
        await page.getByRole('button', { name: /足し算まで/ }).click();
        await page.waitForURL('**/#/park');
        await page.locator('[data-art-candidate="park-three-resin-v1"] canvas[data-frames]').waitFor();
        const created = await data(page);
        assert.equal(created.profiles.length, 1);
        assert.equal(created.profiles[0].name, 'つむぎ');
        assert.equal(created.profiles[0].grade, 1);
        assert.equal(created.profiles[0].mathStartLevel, 7);
        assert.equal(created.profiles[0].subjectMode, 'math');
        assert.equal(created.parks[0].parts.length, 2);
        assert.equal(created.parks[0].courses[0].slots[2], null);
        await capture(page, `${viewport.width}-park`);
        await page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
        await page.getByRole('button', { name: 'とめて つくりなおす', exact: true }).waitFor();
        await page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 20000 });
        assert.equal((await data(page)).logs.length, 0);
        await page.getByRole('button', { name: 'つくる', exact: true }).click();
        await page.getByRole('button', { name: 'シャボンゲートを つくる', exact: true }).click();
        await page.locator('.park-answer').waitFor();
        assert.equal(await page.locator('canvas').count(), 0);
        await capture(page, `${viewport.width}-learning`);
        report.scenarios.push({ viewport, revision, grades: bounds, pass: true });
        await context.close();
    }
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await fallback.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/i.test(type) ? null : original.call(this, type, ...args); };
    });
    const page = await fallback.newPage();
    await page.goto(`${base}/#/`);
    await page.locator('[data-art-candidate="park-resin-blender-v1"]').waitFor();
    await page.getByRole('button', { name: 'はじめる', exact: true }).click();
    await page.getByRole('textbox', { name: 'あだ名でOK' }).waitFor();
    report.fallback = true;
    await fallback.close();
    assert.deepEqual(report.errors, []);
    report.pass = true;
    console.log('PASS real first visit → all registration steps → owned park → replay → learning; 3 sizes, reduced motion, WebGL fallback.');
} catch (error) { report.pass = false; report.failure = String(error); throw error; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
