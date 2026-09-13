import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_GROVES_URL ?? 'http://127.0.0.1:5223', out = process.env.SANSU_GROVES_OUTPUT;
assert(out, 'Specify fresh SANSU_GROVES_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256'), files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate: 'groves-water-v1', world: 'canopy-dots-c3-v1', flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true',
    fixture: '20 QA credits, six mature trees, two bowls and explicit hero destination; seeded simulated pre-grove G0 memory, not a claimed prior live capture', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
async function saved(page, id) { return page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); const record = await lifeDb.worlds.get(id); return { record, state: replayLife(record) }; }, id); }
async function closeMenu(page) { const b = page.getByRole('button', { name: 'メニューを とじる', exact: true }); if (await b.isVisible()) await b.click(); }
async function memory(page, eventId) {
    await page.getByRole('button', { name: 'しまの ようす', exact: true }).click(); await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
    await page.getByRole('button', { name: 'みえた ばめん', exact: true }).click(); await page.locator(`[data-life-memory="${eventId}"]`).click();
    await page.locator('.life-relation-view[data-rendered="true"]').waitFor();
    await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView ?? '{}').delivered === true);
}
async function closeMemory(page) { await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click(); await closeMenu(page); }
async function waitRule(page, id, ruleId) {
    await waitForAsync(page, async ({ id, ruleId }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal?.entries.some(e => e.event.ruleId === ruleId && e.event.source === 'live'); }, { id, ruleId });
    return (await saved(page, id)).record.discoveryJournal.entries.find(e => e.event.ruleId === ruleId && e.event.source === 'live').event;
}
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const reduced = device === 'tablet', context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(45000);
        page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        try {
            await page.goto(base); const id = await seedDev(page, { familiar: false });
            const old = await page.evaluate(async id => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { newLife, learningDay, HOUR } = await import('/src/domain/islandLife/model.ts');
                const { commandLife, replayLife } = await import('/src/domain/islandLife/simulation.ts'); const { prepareEconomyMigration } = await import('/src/domain/islandLife/economyMigration.ts');
                const { prepareTourMigration } = await import('/src/domain/islandLife/tourMigration.ts'); const { evaluateDiscovery } = await import('/src/domain/islandLife/discovery.ts');
                const { createDiscoveryScene, emptyDiscoveryJournal, appendPresentedScene } = await import('/src/domain/islandLife/discoveryJournal.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const now = Date.now(), start = now - 18 * HOUR; let record = newLife(id, start);
                record.credits = Array.from({ length: 20 }, (_, i) => ({ id: `qa-c-${i}`, at: start, day: learningDay(start) }));
                record = await prepareTourMigration(await prepareEconomyMigration(record, []));
                for (let i = 0; i < 6; i++) record = commandLife(record, { type: 'buy', kind: 'sapling', cell: { x: i % 3, z: 2 + Math.floor(i / 3) } }, `qa-tree-${i}`, start);
                for (let i = 0; i < 2; i++) record = commandLife(record, { type: 'buy', kind: 'water-bowl', cell: { x: 4 + i, z: 2 } }, `qa-water-${i}`, start);
                record = commandLife(record, { type: 'visit', itemId: 'qa-water-0' }, 'qa-destination', now); record.realAt = now;
                const state = { ...replayLife(record), worldStyle: 'canopy-dots-c3-v1' };
                const rule = evaluateDiscovery(state, id).find(r => r.ruleId === 'G0');
                const old = await createDiscoveryScene(id, state, rule, 'simulated', 'qa-old-g0', now);
                record.discoveryJournal = appendPresentedScene(emptyDiscoveryJournal(), old, { eventId: old.eventId, firstVisibleAt: now, visibleDurationMs: 1000, coreShown: true, presentationKind: 'simulated' });
                await lifeDb.worlds.put(record); return old;
            }, id);
            await page.reload(); await page.locator('.life-world[data-life-landscape-version="groves-water-v1"][data-rendered="true"]').waitFor(); const native = await readNative(page, id);
            await page.locator('.life-camera-tools summary').click(); await page.getByRole('button', { name: 'しま全体を みる', exact: true }).click(); await page.locator('.life-camera-tools summary').click();
            const grove = await waitRule(page, id, 'GT6'), water = await waitRule(page, id, 'GW2');
            assert.equal(grove.snapshot.scene.landscapeVersion, 'groves-water-v1'); assert(water.snapshot.scene.waterFocus.some(f => f.ready)); assert.equal(water.snapshot.scene.poseReducedMotion, reduced);
            await page.screenshot({ path: `${out}/${device}-grove-water.png` });
            const live = await page.locator('.life-world').evaluate(n => ({ poses: JSON.parse(n.dataset.lifePoses), groups: JSON.parse(n.dataset.lifeGatherings) }));
            await memory(page, old.eventId); await page.screenshot({ path: `${out}/${device}-old-g0.png` }); await closeMemory(page);
            await page.emulateMedia({ reducedMotion: reduced ? 'no-preference' : 'reduce' });
            await memory(page, water.eventId); const replay = await page.locator('.life-relation-view').evaluate(n => JSON.parse(n.dataset.relationView));
            for (const focus of water.snapshot.scene.waterFocus.filter(f => f.ready)) {
                const actual = replay.poses.find(p => p.id === focus.residentId)?.waterLook; assert(actual?.ready); assert.deepEqual(actual.focus, focus.focus);
            }
            await page.screenshot({ path: `${out}/${device}-water-replay-opposite-motion.png` }); await closeMemory(page);
            await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
            await page.getByRole('button', { name: 'つくる', exact: true }).click(); await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
            await page.locator('[data-life-item="qa-tree-0"]').click(); await page.getByRole('button', { name: 'しまう', exact: true }).click(); await closeMenu(page);
            const smaller = await waitRule(page, id, 'GT3'); assert.equal(smaller.snapshot.scene.items.filter(i => i.kind === 'sapling' && i.cell).length, 5);
            await page.screenshot({ path: `${out}/${device}-five-tree-grove.png` }); await page.locator('[data-life-undo]').click();
            await waitForAsync(page, async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); return replayLife(await lifeDb.worlds.get(id)).items.find(i => i.id === 'qa-tree-0').cell?.x === 0; }, id);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor(); const final = await saved(page, id);
            for (const original of [old, grove, water]) assert.deepEqual(final.record.discoveryJournal.entries.find(e => e.event.eventId === original.eventId)?.event, original);
            assert.equal(final.state.drops, 8); assert.deepEqual(await readNative(page, id), native);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.park-answer').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, live, replay, groveId: grove.eventId, waterId: water.eventId, oldHash: old.snapshot.immutableHash, pass: true, errors });
        } catch (error) {
            await page.screenshot({ path: `${out}/${device}-failure.png` });
            await writeFile(`${out}/${device}-failure-state.json`, JSON.stringify(await page.locator('.life-world').evaluate(n => ({ poses: n.dataset.lifePoses, groups: n.dataset.lifeGatherings })), null, 2)); throw error;
        } finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
