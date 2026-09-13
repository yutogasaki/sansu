import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_TOURS_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_TOURS_OUTPUT;
assert(out, 'Specify fresh SANSU_TOURS_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate: 'gp3-tours-v1', world: 'canopy-dots-c3-v1', flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true',
    fixture: '9 explicit QA credits, three swings, and same-position move to restart all old reservations; no earned acquisition claim',
    cache: 'fresh DEV context; no production SW claim', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                const { prepareEconomyMigration } = await import('/src/domain/islandLife/economyMigration.ts');
                const { prepareTourMigration } = await import('/src/domain/islandLife/tourMigration.ts');
                assertPreview(); function assertPreview() { if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only'); }
                const now = Date.now(); let record = newLife(profileId, now);
                record.credits = Array.from({ length: 9 }, (_, i) => ({ id: `qa-${i}`, at: now, day: learningDay(now) }));
                record = await prepareTourMigration(await prepareEconomyMigration(record, []));
                for (let x = 0; x < 3; x++) record = commandLife(record, { type: 'buy', kind: 'swing', cell: { x, z: 2 } }, `qa-swing-${x}`, now);
                record = commandLife(record, { type: 'move', itemId: 'qa-swing-0', cell: { x: 0, z: 2 } }, 'qa-restart', now);
                await lifeDb.worlds.put(record);
            }, profileId);
            await page.reload(); await page.locator('.life-world[data-life-tour-version="1"][data-rendered="true"]').waitFor();
            const native = await readNative(page, profileId), samples = [];
            for (let step = 0; step < 9; step++) {
                const sample = await page.locator('.life-world').evaluate(node => ({ at: Date.now(), poses: JSON.parse(node.dataset.lifePoses ?? '[]'), render: JSON.parse(node.dataset.lifeRender ?? '{}') }));
                samples.push(sample);
                if ([0, 3, 6, 8].includes(step)) await page.screenshot({ path: `${out}/${device}-${step}.png` });
                if (step < 8) await page.waitForTimeout(5000);
            }
            for (const id of ['pokomoko', 'rabbit', 'otter']) {
                const destinations = new Set(samples.flatMap(s => s.poses.filter(p => p.id === id && p.itemId?.startsWith('qa-swing-')).map(p => p.itemId)));
                assert.equal(destinations.size, 3, `${id} did not tour all three swings`);
            }
            const saved = await page.evaluate(async profileId => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(profileId); return { record, state: replayLife(record) }; }, profileId);
            assert.equal(saved.record.version, 4); assert.equal(saved.state.light, 0); assert(saved.state.residents.every(r => r.enjoyed === 0));
            const original = saved.record.discoveryJournal?.entries.find(entry => entry.event.ruleId === 'GP3' && entry.event.source === 'live')?.event;
            assert(original, 'No actually presented GP3 event'); assert.equal(original.snapshot.scene.scenePose, 'captured-v1');
            await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
            await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
            await page.getByRole('button', { name: 'みえた ばめん', exact: true }).click();
            await page.locator(`[data-life-memory="${original.eventId}"]`).click();
            await page.locator('.life-relation-view[data-rendered="true"]').waitFor();
            await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView ?? '{}').delivered === true);
            await page.screenshot({ path: `${out}/${device}-replay.png` });
            await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
            const menuClose = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await menuClose.isVisible()) await menuClose.click();
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
            await page.locator('[data-life-item="qa-swing-0"]').click();
            await page.getByRole('button', { name: 'しまう', exact: true }).click();
            await page.waitForFunction(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const state = replayLife(await lifeDb.worlds.get(profileId)); return !state.items.find(i => i.id === 'qa-swing-0').cell && state.residents.every(r => !r.playTour);
            }, profileId);
            const final = await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const record = await lifeDb.worlds.get(profileId); return { record, state: replayLife(record) };
            }, profileId);
            assert.equal(final.state.light, 0); assert.deepEqual(final.record.discoveryJournal.entries.find(e => e.event.eventId === original.eventId).event, original);
            await page.screenshot({ path: `${out}/${device}-stored.png` });
            assert.deepEqual(await readNative(page, profileId), native);
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            await page.screenshot({ path: `${out}/${device}-learning.png` }); assert.deepEqual(errors, []);
            report.cases.push({ device, viewport, pass: true, samples, light: saved.state.light, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.cases.push({ device, pass: false, errors, error: error.stack }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
