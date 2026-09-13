import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';

const candidate = process.env.SANSU_DISCOVERY_CANDIDATE ?? 'island-life-discovery-a-live-relations-v1';
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
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, candidate, source: 'explicit DEV ownership/credit/24h-growth fixtures; real visibility/memory/move/replay controls; no earned acquisition claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        if (process.env.SANSU_GATHERING_DEVICE && process.env.SANSU_GATHERING_DEVICE !== device) continue;
        for (const ruleId of ['G0', 'GF6', 'GP3']) {
            const name = `${device}-${ruleId}`;
            if (process.env.SANSU_GATHERING_ONLY && process.env.SANSU_GATHERING_ONLY !== name) continue;
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
            const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', error => errors.push(error.message));
            try {
                await page.goto(base); const profileId = await seedDev(page, { familiar: false });
                const count = ruleId === 'GF6' ? 6 : 3;
                await page.evaluate(async ({ profileId, ruleId, count }) => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                    const { newLife, learningDay, HOUR } = await import('/src/domain/islandLife/model.ts');
                    const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                    if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                    const now = Date.now(), at = now - (ruleId === 'GF6' ? 24 * HOUR : 0); let r = newLife(profileId, at);
                    r.credits = Array.from({ length: 12 }, (_, i) => ({ id: `qa-credit-${i}`, at, day: learningDay(at) }));
                    for (let i = 0; i < count; i++) r = commandLife(r, { type: 'buy', kind: ruleId === 'GP3' ? 'swing' : 'flower', cell: { x: 1 + i % 3, z: 2 + Math.floor(i / 3) } }, `qa-${i}`, at);
                    r.now = now; r.realAt = now; await lifeDb.worlds.put(r); sessionStorage.setItem('qa-cover', 'on');
                }, { profileId, ruleId, count });
                await page.addInitScript(() => {
                    if (sessionStorage.getItem('qa-cover') !== 'on') return;
                    const cover = () => { const node = document.createElement('div'); node.id = 'qa-cover'; node.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff'; document.body.append(node); };
                    if (document.body) cover(); else document.addEventListener('DOMContentLoaded', cover, { once: true });
                });
                await page.reload(); await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
                const read = () => page.evaluate(async profileId => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                    const record = await lifeDb.worlds.get(profileId); return { record, state: replayLife(record) };
                }, profileId);
                await page.waitForTimeout(1500); assert.equal((await read()).record.discoveryJournal, undefined);
                await page.evaluate(() => { document.querySelector('#qa-cover').remove(); sessionStorage.setItem('qa-cover', 'off'); });
                const waitJournal = async predicate => {
                    for (let i = 0; i < 150; i++) { const journal = (await read()).record.discoveryJournal; if (predicate(journal)) return journal; await page.waitForTimeout(150); }
                    throw new Error(`Journal missing: ${await page.locator('.life-world').getAttribute('data-life-gatherings')}; relation: ${await page.locator('.life-gathering-view').count() ? await page.locator('.life-gathering-view').getAttribute('data-relation-view') : ''}`);
                };
                const first = await waitJournal(journal => journal?.firstPresented.some(entry => entry.ruleId === ruleId));
                assert.deepEqual(first.firstPresented.map(entry => entry.ruleId), [ruleId]);
                const event = first.entries.find(entry => entry.event.eventId === first.firstPresented[0].eventId).event;
                assert.equal(event.source, 'live'); assert.equal(event.snapshot.scene.items.length, count);
                const before = await read(), native = await readNative(page, profileId);
                await page.screenshot({ path: `${out}/${name}-live.png` });
                const openMemories = async () => {
                    await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                    await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                };
                await openMemories(); await page.getByRole('button', { name: 'みえた ばめん', exact: true }).click();
                await page.locator('[data-life-memory]').filter({ hasText: ruleId === 'G0' ? 'つながった つち' : ruleId === 'GF6' ? 'ひろがった おはな' : 'ひろがった あそびば' }).first().click();
                await page.locator('.life-gathering-view[data-rendered="true"]').waitFor();
                await waitJournal(journal => journal?.entries.some(entry => entry.event.source === 'replay' && entry.event.originEventId === event.eventId));
                await page.getByRole('button', { name: 'のこす', exact: true }).click(); await page.getByRole('button', { name: 'のこすのを やめる', exact: true }).waitFor();
                await page.screenshot({ path: `${out}/${name}-memory.png` });
                await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                while (!await page.locator(`[data-life-item="qa-${count - 1}"]`).count()) await page.getByRole('button', { name: 'つぎの ページ', exact: true }).click();
                await page.locator(`[data-life-item="qa-${count - 1}"]`).click(); await page.getByRole('button', { name: 'うごかす', exact: true }).click();
                await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
                const targetZ = ruleId === 'GP3' ? 3 : 4;
                while (!await page.locator(`[data-life-cell="5,${targetZ}"]`).count()) await page.getByRole('button', { name: 'つぎの マス', exact: true }).click();
                await page.locator(`[data-life-cell="5,${targetZ}"]`).click(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click(); await page.locator('.life-placement').waitFor({ state: 'hidden' });
                if (ruleId !== 'G0') await waitJournal(journal => journal?.firstPresented.some(entry => entry.ruleId === (ruleId === 'GF6' ? 'GF3' : 'GP2')));
                await page.screenshot({ path: `${out}/${name}-split.png` });
                await openMemories(); await page.locator('[data-life-memory]').first().click();
                await page.locator('.life-gathering-view[data-rendered="true"]').waitFor();
                await page.screenshot({ path: `${out}/${name}-past-after-move.png` });
                await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click();
                await page.locator('[aria-label="いまの あつまり"] .life-gathering-view[data-rendered="true"]').waitFor();
                await page.waitForTimeout(1500);
                const audit = JSON.parse(await page.locator('.life-gathering-view').getAttribute('data-relation-view')); assert.equal(audit.core, false);
                await page.screenshot({ path: `${out}/${name}-current-split.png` });
                await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
                await page.locator('[data-life-undo]').click(); await page.locator('[data-life-undo]').waitFor({ state: 'hidden' });
                await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
                const final = await read(); assert.deepEqual(final.state.items.map(item => [item.id, item.cell]), before.state.items.map(item => [item.id, item.cell]));
                assert.equal(final.state.drops, before.state.drops); assert.deepEqual(final.record.discoveryJournal.savedIds, [event.eventId]);
                assert.deepEqual(final.record.discoveryJournal.firstPresented.find(first => first.ruleId === ruleId), first.firstPresented[0]);
                assert.deepEqual((await readNative(page, profileId)).logs, native.logs); assert.deepEqual(errors, []);
                await page.screenshot({ path: `${out}/${name}-reload.png` }); report.scenarios.push({ name, pass: true, eventId: event.eventId, errors });
            } catch (error) { await page.screenshot({ path: `${out}/${name}-failure.png` }); report.scenarios.push({ name, pass: false, error: error.stack, errors }); throw error; }
            finally { await context.close(); }
        }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
