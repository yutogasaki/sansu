import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_LAND_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_LAND_OUTPUT;
assert(out, 'Specify fresh SANSU_LAND_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate: 'land-12-24-48-v1', world: 'canopy-dots-c3-v1', flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true',
    fixture: '60 QA credits; all three land purchases and two placements through real controls; no earned acquisition claim', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
async function saved(page, profileId) {
    return page.evaluate(async id => {
        const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
        const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record) };
    }, profileId);
}
async function closeMenu(page) { const close = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await close.isVisible()) await close.click(); }
async function cellPoint(page, cell) {
    return page.locator('.life-world').evaluate((node, cell) => {
        const camera = JSON.parse(node.dataset.lifeCamera), rect = node.getBoundingClientRect();
        const multiply = (m, v) => [0, 1, 2, 3].map(r => m[r] * v[0] + m[4+r] * v[1] + m[8+r] * v[2] + m[12+r] * v[3]);
        const clip = multiply(camera.projection, multiply(camera.view, [cell.x - 2.5, .045, cell.z - 2, 1]));
        const x = rect.left + (clip[0] / clip[3] + 1) * rect.width / 2, y = rect.top + (1 - clip[1] / clip[3]) * rect.height / 2;
        return { x, y, visible: x > 0 && x < innerWidth && y > 0 && y < innerHeight && node.contains(document.elementFromPoint(x, y)) };
    }, cell);
}
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const now = Date.now(), record = newLife(profileId, now);
                record.credits = Array.from({ length: 60 }, (_, i) => ({ id: `qa-land-${i}`, at: now, day: learningDay(now) }));
                await lifeDb.worlds.put(record);
            }, profileId);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const native = await readNative(page, profileId);
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'ひろげる', exact: true }).click();
            if (device === 'tablet') await page.getByRole('button', { name: 'ひだりへ', exact: true }).click();
            const expectedPrices = [12, 24, 48];
            for (let step = 0; step < 3; step++) {
                await page.waitForFunction(count => document.querySelectorAll('[data-proposed="true"]').length === count, [15, 15, 36][step]);
                const confirm = page.getByRole('button', { name: `ここを ひろげる ${expectedPrices[step]} しずく`, exact: true });
                await confirm.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/${device}-proposal-${step + 1}.png` });
                await confirm.click();
                await page.waitForFunction(async ({ id, count }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).actions.filter(a => a.command.type === 'expand').length === count; }, { id: profileId, count: step + 1 });
            }
            await page.waitForFunction(() => document.querySelectorAll('[data-life-map-cell]').length === 96 && !document.querySelector('[data-proposed="true"]'));
            const expanded = await saved(page, profileId); assert.equal(expanded.record.version, 5); assert.equal(expanded.state.drops, 36);
            assert.deepEqual(expanded.record.actions.filter(a => a.landReceipt).map(a => a.landReceipt.actualPaidDrops), expectedPrices);
            await closeMenu(page);
            await page.locator('.life-camera-tools summary').click(); await page.getByRole('button', { name: 'しま全体を みる', exact: true }).click(); await page.locator('.life-camera-tools summary').click();
            await page.screenshot({ path: `${out}/${device}-overview.png` });
            const corners = [];
            for (const cell of [{ x: -3, z: 0 }, { x: 8, z: 0 }, { x: -3, z: 7 }, { x: 8, z: 7 }]) {
                const point = await cellPoint(page, cell); assert(point.visible, `overview corner hidden ${JSON.stringify({ cell, point })}`); corners.push({ cell, point });
            }
            for (const cell of [{ x: -3, z: 7 }, { x: 8, z: 7 }]) {
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'つくる', exact: true }).click();
                await page.locator('[data-life-buy="flower"]').click();
                const point = await cellPoint(page, cell); assert(point.visible, 'placement corner hidden'); await page.touchscreen.tap(point.x, point.y);
                await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor();
                await page.screenshot({ path: `${out}/${device}-place-${cell.x}.png` });
                await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                await page.waitForFunction(async ({ id, cell }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); return replayLife(await lifeDb.worlds.get(id)).items.some(i => i.cell?.x === cell.x && i.cell?.z === cell.z); }, { id: profileId, cell });
                await closeMenu(page);
            }
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const final = await saved(page, profileId); assert.equal(final.state.drops, 32); assert.equal(final.state.items.length, 2);
            const routes = await page.evaluate(async id => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const { homeCell, pathToActivity } = await import('/src/domain/islandLife/space.ts'); const s = replayLife(await lifeDb.worlds.get(id)); return s.items.map(i => pathToActivity(s, homeCell, i));
            }, profileId); assert(routes.every(path => path?.length > 1));
            assert.deepEqual(await readNative(page, profileId), native);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.park-answer').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, corners, routes, drops: final.state.drops, receipts: final.record.actions.filter(a => a.landReceipt), errors, pass: true });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
