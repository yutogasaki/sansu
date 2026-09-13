import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const out = process.env.SANSU_CANOPY_OUTPUT, base = process.env.SANSU_CANOPY_URL ?? 'http://127.0.0.1:5223';
assert(out, 'Specify a fresh SANSU_CANOPY_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    const hash = createHash('sha256'); for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate: 'canopy-dots-c3-v1', flags: 'DEV VITE_ISLAND_LIFE_PREVIEW=true', cache: 'fresh DEV context; no production SW claim',
    fixture: 'three connected flowers and an explicitly simulated old-world saved memory; no earned acquisition or historical user activity claim', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(25000);
        page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            const original = await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                const { commandLife, replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const { evaluateDiscovery } = await import('/src/domain/islandLife/discovery.ts');
                const { createDiscoveryScene, appendPresentedScene, emptyDiscoveryJournal, saveDiscoveryMemory } = await import('/src/domain/islandLife/discoveryJournal.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const at = Date.now(); let record = newLife(profileId, at);
                record.credits = Array.from({ length: 3 }, (_, i) => ({ id: `qa-${i}`, at, day: learningDay(at) }));
                for (let x = 0; x < 3; x++) record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x, z: 3 } }, `qa-flower-${x}`, at);
                const state = replayLife(record), rule = evaluateDiscovery(state, profileId).find(rule => rule.ruleId === 'G0');
                const old = await createDiscoveryScene(profileId, state, rule, 'simulated', 'qa-old-world', at);
                record.discoveryJournal = saveDiscoveryMemory(appendPresentedScene(emptyDiscoveryJournal(), old, {
                    eventId: old.eventId, firstVisibleAt: at, visibleDurationMs: 1000, coreShown: true, presentationKind: 'simulated' }), old.eventId);
                await lifeDb.worlds.put(record); return old;
            }, profileId);
            await page.reload(); await page.locator('.life-world[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            const native = await readNative(page, profileId);
            const read = () => page.evaluate(async profileId => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return lifeDb.worlds.get(profileId); }, profileId);
            const before = await read();
            await waitForAsync(page, async profileId => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(profileId))?.discoveryJournal?.entries.some(e => e.event.source === 'live' && e.event.snapshot.scene.worldStyle === 'canopy-dots-c3-v1'); }, profileId);
            await page.screenshot({ path: `${out}/${device}-current.png` });
            await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
            await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
            await page.locator('[data-life-memory="qa-old-world"]').click();
            await page.locator('.life-relation-view[data-life-world-style="moon-garden-v1"][data-rendered="true"]').waitFor();
            await page.screenshot({ path: `${out}/${device}-old-memory.png` });
            await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click();
            await page.locator('.life-relation-view[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            await page.screenshot({ path: `${out}/${device}-current-observation.png` });
            await page.reload(); await page.locator('.life-world[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            await page.locator('.life-camera-tools summary').click(); await page.getByRole('button', { name: 'しま全体を みる', exact: true }).click(); await page.locator('.life-camera-tools summary').click();
            await page.screenshot({ path: `${out}/${device}-overview.png` });
            const after = await read();
            assert.deepEqual(after.discoveryJournal.entries.find(e => e.event.eventId === original.eventId).event, original);
            assert.deepEqual(after.actions, before.actions); assert.deepEqual(after.credits, before.credits);
            assert.deepEqual(await readNative(page, profileId), native);
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, viewport, pass: true, errors, originalHash: original.snapshot.immutableHash });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.cases.push({ device, viewport, pass: false, errors, error: error.stack }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
