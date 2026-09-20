import { inventory, saved } from './island-life-ui-helpers.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_CADENCE_URL ?? 'http://127.0.0.1:5236';
const out = process.env.SANSU_CADENCE_OUTPUT ?? 'output/resident-cadence';
const heroCall = process.env.SANSU_CADENCE_HERO_CALL === '1';
await mkdir(out, { recursive: true });
async function sourceHash() {
    const paths = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    const hash = createHash('sha256'); for (const path of paths) hash.update(path).update('\0').update(await readFile(path)).update('\0'); return hash.digest('hex');
}
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startHash: await sourceHash(),
    flags: 'DEV Island=true, Life preview=true', fixture: 'Disposable preview owner, 12 injected credits and one flower. Real time and UI refresh/reload; no time acceleration. Does not prove earned acquisition.', heroCall, humanN: 0, cases: [], pass: false };
const browser = await chromium.launch({ channel: 'chrome' });
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(base); const id = await seedDev(page, { familiar: false });
        await page.evaluate(async id => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
            const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
            if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw Error('Disposable preview only');
            const at = Date.now(), record = newLife(id, at);
            record.credits = Array.from({ length: 12 }, (_, i) => ({ id: `qa-${i}`, at, day: learningDay(at) }));
            await lifeDb.worlds.put(record);
            const migrated = await updateLife(id, [], undefined, at);
            await lifeDb.worlds.put(commandLife(migrated, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'qa-flower', at));
        }, id);
        await page.reload(); const world = page.locator('.life-world[data-rendered="true"]'); await world.waitFor();
        if (heroCall) {
            await inventory(page, 'qa-flower');
            await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click();
            await page.getByRole('button', { name: 'メニューを とじる', exact: true }).waitFor({ state: 'hidden' });
            assert.equal((await saved(page, id)).state.target, 'qa-flower');
        }
        const native = await readNative(page, id), samples = [];
        const initial = await world.evaluate(n => ({ ...n.dataset }));
        for (let i = 0; i < 46; i++) {
            samples.push({ at: Date.now(), poses: JSON.parse(await world.getAttribute('data-life-poses')) });
            if ([0, 15, 30, 45].includes(i)) { await page.screenshot({ path: `${out}/${device}-${i}.png` }); console.log(device, i * 2, 'seconds'); }
            if (i < 45) await page.waitForTimeout(2000);
        }
        const positions = Object.fromEntries(['pokomoko', 'rabbit', 'otter'].map(id => [id, new Set(samples.flatMap(s => s.poses.filter(p => p.id === id).map(p => JSON.stringify(p.position.map(v => Math.round(v * 10)))))).size]));
        for (const [id, count] of Object.entries(positions)) assert(count >= 4, `${device}: ${id} stayed still (${count})`);
        assert.deepEqual(await readNative(page, id), native, 'Idle movement must not change learning');
        const before = await page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return lifeDb.worlds.get(id); }, id);
        assert.equal(before.version, 18); await page.reload(); await world.waitFor();
        const after = await page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return lifeDb.worlds.get(id); }, id);
        if (heroCall) {
            assert.equal((await saved(page, id, true)).state.target, undefined);
            assert(samples.some(s => s.poses.some(p => p.id === 'pokomoko' && p.phase === 'walking' && p.itemId !== 'qa-flower')), 'Called hero must walk elsewhere');
            assert.deepEqual(after.heroVisitCutover, before.heroVisitCutover);
            assert.deepEqual(after.diagonalCutover, before.diagonalCutover);
        }
        assert.deepEqual(after.cadenceCutover, before.cadenceCutover); assert.deepEqual(after.actions, before.actions); assert.deepEqual(after.credits, before.credits);
        assert.deepEqual(errors, []); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        report.cases.push({ device, viewport, reducedMotion: device === 'tablet', candidate: initial.lifeVisualCandidate, initial, positions, samples, errors, pass: true });
        await context.close();
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, report.startHash); report.pass = true;
} catch (e) { report.error = e.stack; throw e; }
finally { await writeFile(`${out}/manifest.json`, JSON.stringify(report, null, 2)); await browser.close(); }
