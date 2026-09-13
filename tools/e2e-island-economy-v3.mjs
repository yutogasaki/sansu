import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';

const candidate = process.env.SANSU_DISCOVERY_CANDIDATE ?? 'island-life-economy-checkpoint-v3';
const base = process.env.SANSU_DISCOVERY_DEV_URL ?? 'http://127.0.0.1:5223';
const out = process.env.SANSU_DISCOVERY_OUTPUT;
assert(out, 'Specify a fresh SANSU_DISCOVERY_OUTPUT directory');
await mkdir(out, { recursive: false });
const sourceHash = async () => {
    const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    const hash = createHash('sha256');
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0');
    return hash.digest('hex');
};
const startHash = await sourceHash();
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, candidate, source: 'explicit DEV legacy flower and six completed-credit fixture at minus 20 hours; no earned acquisition claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(25000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            const original = await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV preview required');
                const at = Date.now(), earned = at - 20 * 3600000;
                let record = newLife(profileId, earned);
                record.credits = Array.from({ length: 6 }, (_, i) => ({ id: `qa-credit-${i}`, at: earned, day: learningDay(earned) }));
                record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'qa-flower', at);
                record.realAt = at; await lifeDb.worlds.put(record); return record;
            }, profileId);
            await page.reload(); await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
            const read = () => page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const record = await lifeDb.worlds.get(profileId); return { record, state: replayLife(record) };
            }, profileId);
            const waitState = async predicate => { for (let i = 0; i < 100; i++) { const value = await read(); if (predicate(value)) return value; await page.waitForTimeout(100); } throw new Error('Saved state did not reach expected boundary'); };
            const initial = await waitState(value => value.record.version === 3), native = await readNative(page, profileId);
            assert.deepEqual(initial.record.economyCheckpoint.originalRecord, original);
            assert.equal(initial.state.drops, 10); assert.equal(initial.state.light, 0); assert.equal(initial.state.economy.lightRemainingBudget, 8);
            const closeMenu = async () => { const button = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await button.isVisible()) await button.click(); };
            const inventory = async () => {
                await closeMenu(); await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                await page.locator('[data-life-item="qa-flower"]').click();
            };
            const jump = async hours => {
                await closeMenu(); const before = await read();
                await page.locator('.life-dev summary').click();
                await page.getByRole('button', { name: `試作を ${hours}時間すすめる`, exact: true }).click();
                await waitState(value => value.record.now >= before.record.now + hours * 3600000);
                await page.locator('.life-dev summary').click();
                return read();
            };
            await inventory(); await page.getByText('追加で まなばない ときの めやすだよ。', { exact: true }).waitFor();
            await page.screenshot({ path: `${out}/${device}-cutover.png` });
            const six = await jump(6);
            assert(Math.abs(six.state.items[0].growth - 5) < .03); assert.equal(six.state.light, 8); assert.equal(six.state.economy.lightRemainingBudget, 0);
            await inventory(); await page.getByText('あと 約2じかんで さいた', { exact: true }).waitFor();
            await page.screenshot({ path: `${out}/${device}-expiry.png` });
            await page.getByRole('button', { name: 'しまう', exact: true }).click();
            const stored = await waitState(value => !value.state.items[0].cell), storageDay = await jump(6);
            assert.equal(storageDay.state.items[0].growth, stored.state.items[0].growth);
            await inventory(); await page.screenshot({ path: `${out}/${device}-stored.png` });
            await page.getByRole('button', { name: 'おく', exact: true }).click(); await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
            while (!await page.locator('[data-life-cell="0,2"]').count()) await page.getByRole('button', { name: 'つぎの マス', exact: true }).click();
            await page.locator('[data-life-cell="0,2"]').click(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
            await page.locator('.life-placement').waitFor({ state: 'hidden' });
            const mature = await jump(6); assert.equal(mature.state.items[0].growth, 6); assert.equal(mature.state.drops, 10);
            await inventory(); await page.getByRole('button', { name: 'いろを かえる', exact: true }).click();
            await page.locator('[data-life-style="sunshine"]').click();
            await waitState(value => value.state.items[0].style === 'sunshine');
            const afterColor = await jump(24); assert.equal(afterColor.state.light, 4); assert.equal(afterColor.state.economy.lightRemainingBudget, 0);
            await page.screenshot({ path: `${out}/${device}-mature-color.png` });
            assert.deepEqual(afterColor.record.economyCheckpoint, initial.record.economyCheckpoint);
            assert.deepEqual(afterColor.record.credits, original.credits); assert.deepEqual(await readNative(page, profileId), native);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const reloaded = await read(); assert.equal(reloaded.state.light, 4); assert.equal(reloaded.state.items[0].growth, 6);
            assert.deepEqual(reloaded.record.economyCheckpoint, initial.record.economyCheckpoint);
            await page.screenshot({ path: `${out}/${device}-reload.png` });
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []);
            report.scenarios.push({ device, pass: true, checkpoint: initial.record.economyCheckpoint.checkpointId, validationHash: initial.record.economyCheckpoint.validationHash,
                growthAtSixHours: six.state.items[0].growth, light: { initial: initial.state.light, capped: six.state.light, afterColor: reloaded.state.light }, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.scenarios.push({ device, pass: false, error: error.stack, errors }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
