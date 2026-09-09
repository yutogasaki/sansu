import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Matrix4, Vector3 } from 'three';
import { button, seedNative, readNative, answerUI, waitMode, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';
const target = process.env.SANSU_DIRECT_URL || 'http://127.0.0.1:5340';
const out = process.env.SANSU_DIRECT_OUTPUT || 'output/playwright/island-direct-actions';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target, fixture: 'Native profile only, real reserved answers earn the first garden. No injected growth.', humanN: 0, pass: false, scenarios: [] };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const scenario = { viewport, captures: [], errors, pass: false }; report.scenarios.push(scenario);
        const capture = async name => { const file = `${viewport.width}-${name}.png`; await page.screenshot({ path: `${out}/${file}` }); scenario.captures.push({ file, ...(await runtimeMetadata(page)) }); };
        try {
            await page.goto(target); await page.locator('.island-welcome').waitFor();
            const id = await seedNative(page, randomUUID()); await page.reload(); await waitReady(page);
            await capture('first-home');
            await button(page, 'まなぶ').click(); await waitMode(page, 'learning');
            for (let index = 0; index < 3; index++) { const { plan } = await readNative(page, id); await answerUI(page, plan, { touch: true, dev: false }); }
            await button(page, 'とじる').click(); await waitMode(page, 'home'); await waitReady(page);
            const garden = page.locator('[data-direct-target="garden"]'); await garden.waitFor();
            await capture('home');
            const stage = page.getByTestId('island-stage'), stageBox = await stage.boundingBox();
            const matrices = (await stage.getAttribute('data-camera-frame')).split(',').map(Number);
            const resident = JSON.parse(await stage.getAttribute('data-resident-states')).find(resident => resident.species === 'otter');
            const point = new Vector3(...resident.position).add(new Vector3(0, .8, 0))
                .applyMatrix4(new Matrix4().fromArray(matrices.slice(0, 16)).invert()).applyMatrix4(new Matrix4().fromArray(matrices.slice(16)));
            await page.touchscreen.tap(stageBox.x + (point.x + 1) / 2 * stageBox.width, stageBox.y + (1 - point.y) / 2 * stageBox.height);
            await page.getByRole('region', { name: 'カワウソの そうさ' }).waitFor();
            await page.getByRole('button', { name: 'そうさを とじる', exact: true }).waitFor();
            await page.keyboard.press('Escape');
            await page.locator('.island-direct-panel').waitFor({ state: 'detached' });
            await garden.tap();
            await page.getByRole('region', { name: 'にわの そうさ' }).waitFor();
            const before = await readNative(page, id); await capture('garden-now');
            const gardenFrame = await page.getByTestId('island-stage').getAttribute('data-camera-frame');
            await button(page, 'つぎの すがた').tap(); await capture('garden-next');
            assert.equal(await page.getByTestId('island-stage').getAttribute('data-camera-frame'), gardenFrame, 'Current and next growth share one fixed camera');
            assert.deepEqual(await readNative(page, id), before, 'Growth preview never saves learning, island or discovery state');
            await button(page, 'いまの すがた').tap(); await page.keyboard.press('Escape');
            assert.equal(await page.locator('.island-direct-panel').count(), 0);
            const markerBox = await garden.boundingBox();
            await page.mouse.move(markerBox.x + 20, markerBox.y + 20); await page.mouse.down();
            await page.mouse.move(markerBox.x + 35, markerBox.y + 20, { steps: 4 }); await page.mouse.up();
            assert.equal(await page.locator('.island-direct-panel').count(), 0, 'Dragging a label does not open it');
            await garden.focus(); await page.keyboard.press('Enter');
            await page.getByRole('region', { name: 'にわの そうさ' }).waitFor(); await page.keyboard.press('Escape');

            await button(page, 'しまのメニュー').click();
            await page.locator('[data-home-group="arrange"] > summary').click();
            await button(page, '育てる ばしょを えらぶ').click();
            await page.locator('.island-growth-place').filter({ hasText: 'いえの まわり' }).click(); await waitMode(page, 'home');
            await garden.tap(); await button(page, 'ここを 育てる').tap();
            await page.locator('.island-direct-panel').waitFor({ state: 'detached' });
            const selectedGrowth = await readNative(page, id);
            assert.equal(selectedGrowth.island.growth.focus, 'garden');
            assert.deepEqual(selectedGrowth.plan, before.plan, 'Choosing the next growing place preserves the reserved problem');
            const box = await page.getByTestId('island-stage').boundingBox();
            await page.mouse.move(box.x + box.width * .5, box.y + box.height * .65); await page.mouse.down();
            await page.mouse.move(box.x + box.width * .68, box.y + box.height * .72, { steps: 8 }); await page.mouse.up();
            assert.equal(await page.locator('.island-direct-panel').count(), 0, 'Dragging does not select a target');
            if (await button(page, 'もとの ながめ').isVisible()) await button(page, 'もとの ながめ').click();
            await page.locator('[data-direct-target="resident"]').tap(); await capture('resident');
            await page.locator('.island-direct-play-list').getByRole('button', { name: 'ベンチで あそぶ', exact: true }).tap(); await waitMode(page, 'play');
            await page.waitForFunction(() => document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-resident-species') === 'otter');
            await capture('play'); await button(page, 'あそびを とじる').tap(); await waitMode(page, 'home');
            await page.locator('[data-direct-target="home"]').tap(); await waitMode(page, 'keepsakes'); await capture('house');
            await page.locator('[data-keepsake-action="close"]').click(); await waitMode(page, 'home');
            await button(page, 'もちもの').tap(); await waitMode(page, 'inventory');
            await button(page, 'まなぶ').click(); await waitMode(page, 'learning');
            assert.equal((await readNative(page, id)).plan.id, before.plan.id, 'Returns to the identical reserved plan');
            await answerUI(page, (await readNative(page, id)).plan, { touch: true, dev: false });
            await capture('learning');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.deepEqual(errors, []); scenario.pass = true;
        } catch (error) { scenario.error = String(error.stack || error); await page.screenshot({ path: `${out}/${viewport.width}-failure.png` }); throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally { await browser.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ pass: report.pass, out }));
