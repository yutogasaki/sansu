import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_PLANTS_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_PLANTS_OUTPUT;
assert(out, 'Specify fresh SANSU_PLANTS_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate: 'life-v3-plants-water-v1', world: 'canopy-dots-c3-v1', flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true',
    fixture: '12 QA credits; real UI buys; explicit DEV clock advances for young/mature tree; no real-time acquisition claim', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
async function read(page, id) {
    return page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record) }; }, id);
}
async function closeMenu(page) { const b = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await b.isVisible()) await b.click(); }
async function inventory(page, id) {
    await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click();
    await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click(); await page.locator(`[data-life-item="${id}"]`).click();
}
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        try {
            await page.goto(base); const id = await seedDev(page, { familiar: false });
            await page.evaluate(async id => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                assertPreview(); function assertPreview() { if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only'); }
                const now = Date.now(), record = newLife(id, now); record.credits = Array.from({ length: 12 }, (_, i) => ({ id: `qa-plants-${i}`, at: now, day: learningDay(now) })); await lifeDb.worlds.put(record);
            }, id);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor(); const native = await readNative(page, id);
            for (const [kind, cell] of [['sapling', { x: 0, z: 2 }], ['water-bowl', { x: 1, z: 2 }]]) {
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('button', { name: '3ページめ', exact: true }).click();
                const buy = page.locator(`[data-life-buy="${kind}"]`); await buy.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/${device}-catalog-${kind}.png` }); await buy.click();
                const point = await page.locator('.life-world').evaluate((node, c) => {
                    const { projection, view } = JSON.parse(node.dataset.lifeCamera), rect = node.getBoundingClientRect();
                    const mul = (m, v) => [0,1,2,3].map(r => m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
                    const p = mul(projection, mul(view, [c.x-2.5, .045, c.z-2, 1])); return { x: rect.left+(p[0]/p[3]+1)*rect.width/2, y: rect.top+(1-p[1]/p[3])*rect.height/2 };
                }, cell);
                await page.touchscreen.tap(point.x, point.y); await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor();
                await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                await waitForAsync(page, async ({ id, kind }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).actions.some(a => a.command.type === 'buy' && a.command.kind === kind); }, { id, kind });
                await closeMenu(page);
            }
            const runtimeCandidate = await page.locator('.island-life').getAttribute('data-life-candidate');
            const runtimeWorld = await page.locator('.life-world').getAttribute('data-life-world-style');
            assert.equal(runtimeWorld, 'canopy-dots-c3-v1');
            const purchased = await read(page, id); assert.equal(purchased.record.version, 6); assert.equal(purchased.state.drops, 16);
            const tree = purchased.state.items.find(i => i.kind === 'sapling').id, bowl = purchased.state.items.find(i => i.kind === 'water-bowl').id;
            await inventory(page, tree); await page.getByRole('button', { name: 'みてみる', exact: true }).click();
            await page.locator('.life-observation-view[data-rendered="true"]').waitFor(); await page.screenshot({ path: `${out}/${device}-sapling.png` });
            await page.getByRole('button', { name: '木に ふれる', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.life-observation-view')?.dataset.magic === 'leaves');
            await page.waitForTimeout(1300); await page.screenshot({ path: `${out}/${device}-tree-magic.png` });
            await waitForAsync(page, async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal?.entries.some(e => e.event.ruleId === 'M2' && e.event.snapshot.scene.items.some(i => i.kind === 'sapling')); }, id);
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            for (const [hours, stage] of [[6, 1], [24, 2]]) {
                await page.locator('.life-dev summary').click();
                await page.getByRole('button', { name: `試作を ${hours}時間すすめる`, exact: true }).click();
                await waitForAsync(page, async ({ id, tree, stage }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const { growthStage } = await import('/src/domain/islandLife/model.ts'); return growthStage(replayLife(await lifeDb.worlds.get(id)).items.find(i => i.id === tree)) === stage; }, { id, tree, stage });
                await page.locator('.life-dev summary').click();
                await inventory(page, tree); await page.getByRole('button', { name: 'みてみる', exact: true }).click(); await page.locator('.life-observation-view[data-rendered="true"]').waitFor();
                await page.screenshot({ path: `${out}/${device}-tree-stage-${stage}.png` }); await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            }
            await inventory(page, bowl); await page.getByRole('button', { name: 'みてみる', exact: true }).click();
            const water = page.getByRole('button', { name: '水に ふれてみる', exact: true }); await water.locator('canvas').waitFor();
            const before = await read(page, id); await water.click(); await page.locator('[data-ripple="true"]').waitFor(); await page.screenshot({ path: `${out}/${device}-water-ripple.png` });
            await page.locator('[data-ripple="false"]').waitFor(); const after = await read(page, id);
            assert.deepEqual(after.record.actions, before.record.actions); assert.deepEqual(after.record.discoveryJournal, before.record.discoveryJournal);
            assert.equal(after.state.drops, before.state.drops); assert.equal(after.state.light, before.state.light);
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor(); const restored = await read(page, id);
            assert.equal(restored.record.version, 6); assert.equal(restored.state.items.find(i => i.id === tree).growth, 18); assert.equal(restored.state.items.find(i => i.id === bowl).growth, 0);
            assert.deepEqual(await readNative(page, id), native);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.park-answer').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, runtimeCandidate, runtimeWorld, pass: true, receipts: restored.record.actions.filter(a => a.command.type === 'buy'), drops: restored.state.drops, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); throw error; } finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
