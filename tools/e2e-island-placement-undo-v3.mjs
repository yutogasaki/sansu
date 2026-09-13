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
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, candidate, source: 'explicit DEV six-credit fixture; real purchase/move/store/undo controls; no earned learning claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const at = Date.now(), r = newLife(profileId, at);
                r.credits = Array.from({ length: 6 }, (_, i) => ({ id: `fixture-${i}`, at, day: learningDay(at) }));
                await lifeDb.worlds.put(r);
            }, profileId);
            await page.reload(); await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
            const native = await readNative(page, profileId);
            const read = () => page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const record = await lifeDb.worlds.get(profileId); return { record, state: replayLife(record) };
            }, profileId);
            const place = async (x, z) => {
                await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
                for (let i = 0; i < 10 && !await page.locator(`[data-life-cell="${x},${z}"]`).count(); i++) {
                    const current = Number((await page.locator('.life-cell-picker .life-pager span').innerText()).split('/')[0]) - 1;
                    await page.getByRole('button', { name: current < z ? 'つぎの マス' : 'まえの マス', exact: true }).click();
                }
                await page.locator(`[data-life-cell="${x},${z}"]`).click();
                await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                await page.locator('.life-placement').waitFor({ state: 'hidden' });
            };
            const undo = async () => { await page.locator('[data-life-undo]').click(); await page.locator('[data-life-undo]').waitFor({ state: 'hidden' }); };
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.locator('[data-life-buy="flower"]').click(); await place(0, 2);
            const bought = await read(), id = bought.state.items[0].id;
            assert.equal(bought.state.drops, 10); await page.screenshot({ path: `${out}/${name}-purchase.png` });
            await undo(); const storedPurchase = await read();
            assert.equal(storedPurchase.state.items[0].cell, undefined); assert.equal(storedPurchase.state.drops, 10);
            const details = async () => {
                if (!await page.locator('.life-menu').count()) await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                await page.locator('[data-life-item]').filter({ has: page.locator('b', { hasText: 'おはな' }) }).click();
            };
            await details(); await page.getByRole('button', { name: 'おく', exact: true }).click(); await place(0, 2);
            await details(); await page.getByRole('button', { name: 'うごかす', exact: true }).click(); await place(2, 2);
            assert.deepEqual((await read()).state.items[0].cell, { x: 2, z: 2 });
            await page.screenshot({ path: `${out}/${name}-moved.png` }); await undo();
            assert.deepEqual((await read()).state.items[0].cell, { x: 0, z: 2 });
            await page.screenshot({ path: `${out}/${name}-restored.png` });
            await details(); await page.getByRole('button', { name: 'しまう', exact: true }).click();
            await page.locator('[data-life-undo]').waitFor(); assert.equal((await read()).state.items[0].cell, undefined);
            await undo(); assert.deepEqual((await read()).state.items[0].cell, { x: 0, z: 2 });
            // Cancelling a preview through learning must not commit or resurrect it.
            await details();
            await page.getByRole('button', { name: 'うごかす', exact: true }).click();
            const beforeExit = await read();
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            assert.deepEqual((await read()).record.actions, beforeExit.record.actions);
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.locator('.life-world[data-rendered="true"]').waitFor();
            assert.equal(await page.locator('.life-placement').count(), 0);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const final = await read();
            assert.equal(final.state.items.length, 1); assert.equal(final.state.items[0].id, id);
            assert.deepEqual(final.state.items[0].cell, { x: 0, z: 2 }); assert.equal(final.state.drops, 10);
            assert.equal(final.record.actions.filter(action => action.undoOf).length, 3);
            assert.deepEqual((await readNative(page, profileId)).logs, native.logs);
            assert.deepEqual(errors, []); await page.screenshot({ path: `${out}/${name}-reload.png` });
            report.scenarios.push({ name, pass: true, itemId: id, undoActions: 3, drops: final.state.drops, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${name}-failure.png` }); report.scenarios.push({ name, pass: false, error: error.stack, errors }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
