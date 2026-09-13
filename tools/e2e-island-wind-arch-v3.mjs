import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_WIND_ARCH_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_WIND_ARCH_OUTPUT;
assert(out); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'life-v3-wind-arch-v1', fixture: '24 QA credits; real UI purchases and visits; no earned acquisition claim', humanN: 0, cases: [], pass: false };
async function saved(page, id) { return page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record) }; }, id); }
async function closeMenu(page) { const b = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await b.isVisible()) await b.click(); }
async function inventory(page, id) { await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click(); await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click(); await page.locator(`[data-life-item="${id}"]`).click(); }
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(45000); const errors = [];
        page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        try {
            await page.goto(base); const id = await seedDev(page, { familiar: false });
            await page.evaluate(async id => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const now = Date.now(), record = newLife(id, now); record.credits = Array.from({ length: 24 }, (_, i) => ({ id: `qa-${i}`, at: now, day: learningDay(now) })); await lifeDb.worlds.put(record);
            }, id);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor(); const native = await readNative(page, id);
            const delivered = await page.locator('.island-life').evaluate(n => ({ candidate: n.dataset.lifeCandidate, world: n.querySelector('.life-world').dataset.lifeWorldStyle }));
            let arch;
            for (const [kind, cell, catalogPage] of [['pinwheel', { x: 4, z: 3 }, 4], ['flower-arch', { x: 1, z: 2 }, 5]]) {
                await closeMenu(page); await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'つくる', exact: true }).click(); await page.getByRole('button', { name: `${catalogPage}ページめ`, exact: true }).click();
                await page.locator(`[data-life-buy="${kind}"]`).click();
                const at = await page.locator('.life-world').evaluate((n, c) => {
                    const { projection, view } = JSON.parse(n.dataset.lifeCamera), r = n.getBoundingClientRect(); const mul = (m, v) => [0,1,2,3].map(r => m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
                    const p = mul(projection, mul(view, [c.x-2.5,.045,c.z-2,1])); return { x:r.left+(p[0]/p[3]+1)*r.width/2,y:r.top+(1-p[1]/p[3])*r.height/2 };
                }, cell);
                await page.touchscreen.tap(at.x, at.y); await page.locator(`[data-life-placement-cell="${cell.x},${cell.z}"][data-life-placement-valid="true"]`).waitFor(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                await waitForAsync(page, async ({ id, kind }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).actions.some(a => a.command.type === 'buy' && a.command.kind === kind); }, { id, kind }); await closeMenu(page);
                if (kind === 'flower-arch') arch = (await saved(page, id)).state.items.find(i => i.kind === kind).id;
            }
            await page.screenshot({ path: `${out}/${device}-placed.png` });
            await inventory(page, arch);
            await page.evaluate(() => { window.archSamples = []; window.archTimer = setInterval(() => { const n = document.querySelector('.life-world'); if (n?.dataset.lifePoses) window.archSamples.push(JSON.parse(n.dataset.lifePoses)[0]); }, 30); });
            await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click(); await closeMenu(page);
            await page.waitForTimeout(15000);
            const samples = await page.evaluate(() => { clearInterval(window.archTimer); return window.archSamples; });
            await writeFile(`${out}/${device}-crossing.json`, JSON.stringify({ samples, saved: await saved(page, id) }, null, 2));
            const traversal = samples.filter(p => p.itemId === arch);
            assert(traversal.some(p => Math.abs(p.position[0] + 1.5) < .12 && p.position[2] < -.2)
                && traversal.some(p => Math.abs(p.position[0] + 1.5) < .12 && p.position[2] > .2), 'same arch visit is rendered on both sides of its centerline');
            await page.screenshot({ path: `${out}/${device}-passed.png` });
            const used = await saved(page, id); assert.equal(used.state.light, 0); assert.equal(used.state.drops, 24);
            assert(!used.record.discoveryJournal?.entries.length);
            const wind = used.state.items.find(i => i.kind === 'pinwheel').id;
            await inventory(page, wind); assert(await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).isDisabled()); await closeMenu(page);
            await inventory(page, arch); await page.getByRole('button', { name: 'しまう', exact: true }).click(); await closeMenu(page);
            await waitForAsync(page, async ({id, arch}) => { const {lifeDb} = await import('/src/domain/islandLife/repository.ts'); const {replayLife} = await import('/src/domain/islandLife/simulation.ts'); return !replayLife(await lifeDb.worlds.get(id)).items.find(i => i.id === arch).cell; }, {id, arch});
            await page.screenshot({ path: `${out}/${device}-stored.png` });
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor(); const final = await saved(page, id);
            assert.equal(final.record.version, 8); assert.equal(final.state.drops, 24); assert.equal(final.state.items.find(i => i.id === arch).cell, undefined);
            assert.deepEqual(await readNative(page, id), native);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.park-answer').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` }); assert.deepEqual(errors, []);
            report.cases.push({ device, delivered, samples, pass: true, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.cases.push({ device, pass: false, error: error.stack, errors }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
