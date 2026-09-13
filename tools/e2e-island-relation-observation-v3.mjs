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
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, candidate, source: 'explicit DEV two-item ownership and record-v2 fixture; no earned acquisition claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        for (const kind of ['flower', 'swing']) {
            const name = `${device}-${kind}`;
            if (process.env.SANSU_RELATION_ONLY && process.env.SANSU_RELATION_ONLY !== name) continue;
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
            const page = await context.newPage(); page.setDefaultTimeout(20000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            try {
                await page.goto(base); const profileId = await seedDev(page, { familiar: false });
                await page.evaluate(async ({ profileId, kind }) => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                    const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                    const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                    if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV preview required');
                    const at = Date.now(); let record = newLife(profileId, at);
                    record.credits = Array.from({ length: 6 }, (_, i) => ({ id: `qa-credit-${i}`, at, day: learningDay(at) }));
                    record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'qa-bench', at);
                    record = commandLife(record, { type: 'buy', kind, cell: { x: 2, z: 2 } }, 'qa-target', at);
                    record = commandLife(record, { type: 'visit', itemId: 'qa-bench' }, 'qa-visit', at);
                    record = commandLife(record, { type: 'observe', itemId: 'qa-bench' }, 'qa-format-v2', at);
                    if (record.version !== 2) throw new Error('Version 2 fixture expected');
                    await lifeDb.worlds.put(record);
                }, { profileId, kind });
                await page.reload();
                await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
                const poses = () => page.locator('.life-world').evaluate(node => JSON.parse(node.dataset.lifePoses || '[]'));
                const ready = async relation => {
                    await page.waitForFunction(({ relation }) => {
                        const poses = JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]');
                        return poses.some(pose => pose.phase === 'bench' && pose.seatGap < 1e-8
                            && (relation ? pose.relation?.ready && pose.relation.ruleId === relation : !pose.relation && pose.headYaw === 0));
                    }, { relation }, { timeout: 30000 });
                };
                const rule = kind === 'flower' ? 'R1' : 'R3';
                await ready(rule);
                const near = await poses(); let native = await readNative(page, profileId);
                await page.screenshot({ path: `${out}/${name}-near.png` });
                const readJournal = () => page.evaluate(async profileId => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                    return (await lifeDb.worlds.get(profileId)).discoveryJournal;
                }, profileId);
                const observe = async () => {
                    await page.getByRole('button', { name: 'つくる', exact: true }).click();
                    await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                    await page.locator('[data-life-item="qa-bench"]').click();
                    await page.getByRole('button', { name: 'みてみる', exact: true }).click();
                    await page.locator('.life-relation-view[data-rendered="true"]').waitFor();
                };
                await observe();
                await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
                await page.locator('.island-learning[data-input-ready="true"]').waitFor();
                assert.equal(await page.locator('.life-relation-view').count(), 0);
                assert(!(await readJournal())?.entries.some(entry => entry.event.source === 'current-context-test')); // Ordinary live scenes may already exist.
                assert.deepEqual((await readNative(page, profileId)).logs, native.logs);
                await page.screenshot({ path: `${out}/${name}-early-exit.png` });
                await page.getByRole('button', { name: 'とじる', exact: true }).click();
                await page.locator('.life-world[data-rendered="true"]').waitFor();
                native = await readNative(page, profileId);
                await observe();
                await page.getByRole('button', { name: 'のこす', exact: true }).waitFor({ timeout: 30000 });
                await page.screenshot({ path: `${out}/${name}-observation.png` });
                const shown = await readJournal(); assert.equal(shown.firstPresented.length, 1);
                assert(shown.entries.some(entry => entry.event.ruleId === rule && entry.event.source === 'current-context-test'));
                await page.getByRole('button', { name: 'のこす', exact: true }).click();
                await page.getByRole('button', { name: 'のこした', exact: true }).waitFor();
                const memoryId = (await readJournal()).savedIds[0];
                if (name === 'phone-flower') {
                    const stableJournal = await readJournal();
                    await page.waitForTimeout(16000);
                    assert.equal(await page.getByRole('button', { name: 'のこした', exact: true }).count(), 1);
                    assert.equal((await readJournal()).revision, stableJournal.revision);
                }
                await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
                const move = async (x, z) => {
                    await page.getByRole('button', { name: 'つくる', exact: true }).click();
                    await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                    await page.locator('[data-life-item="qa-target"]').click();
                    await page.getByRole('button', { name: 'うごかす', exact: true }).click();
                    await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
                    for (let i = 0; i < 10 && !await page.locator(`[data-life-cell="${x},${z}"]`).count(); i++) {
                        const current = Number((await page.locator('.life-cell-picker .life-pager span').innerText()).split('/')[0]) - 1;
                        await page.getByRole('button', { name: current < z ? 'つぎの マス' : 'まえの マス', exact: true }).click();
                    }
                    await page.locator(`[data-life-cell="${x},${z}"]`).click();
                    await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                    await page.locator('.life-placement').waitFor({ state: 'hidden' });
                };
                await move(5, kind === 'flower' ? 4 : 3); await ready(null);
                const far = await poses(); await page.screenshot({ path: `${out}/${name}-far.png` });
                await observe();
                await page.getByLabel('ベンチから みるもの', { exact: true }).selectOption('qa-target');
                await page.waitForTimeout(1500);
                assert.equal(await page.getByRole('button', { name: 'のこす', exact: true }).count(), 0);
                assert.deepEqual((await readJournal()).firstPresented, shown.firstPresented);
                await page.screenshot({ path: `${out}/${name}-far-observation.png` });
                await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
                await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                await page.locator(`[data-life-memory="${memoryId}"]`).click();
                let replay;
                for (let i = 0; i < 100; i++) {
                    replay = (await readJournal()).entries.find(entry => entry.event.source === 'replay')?.event;
                    if (replay) break;
                    await page.waitForTimeout(200);
                }
                if (!replay) {
                    await writeFile(`${out}/${name}-journal-diagnostic.json`, JSON.stringify({ journal: await readJournal(),
                        view: await page.locator('.life-relation-view').getAttribute('data-relation-view') }, null, 2));
                }
                assert(replay, 'The owner journal must contain the replay, not merely an in-flight presentation');
                await page.screenshot({ path: `${out}/${name}-memory.png` });
                assert.equal(replay.originEventId, memoryId);
                assert.deepEqual(replay.snapshot.scene.items.find(item => item.id === 'qa-target').cell, { x: 2, z: 2 });
                await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
                await move(2, 2); await ready(rule);
                const restored = await poses(); await page.screenshot({ path: `${out}/${name}-restored.png` });
                assert(near.some(pose => Math.abs(pose.headYaw) > .1 && pose.relation?.ruleId === rule));
                assert(far.some(pose => pose.phase === 'bench' && !pose.relation));
                assert(restored.some(pose => pose.relation?.ruleId === rule));
                const seated = near.find(pose => pose.relation?.ruleId === rule).id;
                assert.equal(far.find(pose => pose.phase === 'bench').id, seated);
                assert.equal(restored.find(pose => pose.relation?.ruleId === rule).id, seated);
                assert.deepEqual(await readNative(page, profileId), native);
                const saved = await page.evaluate(async profileId => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                    const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                    const record = await lifeDb.worlds.get(profileId); return { state: replayLife(record), journal: record.discoveryJournal };
                }, profileId);
                assert.equal(saved.state.items.length, 2); assert.equal(saved.state.drops, kind === 'flower' ? 6 : 2);
                assert.equal(saved.journal.firstPresented.length, 1); assert.equal(saved.journal.savedIds.length, 1);
                await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
                await page.locator('.island-learning[data-input-ready="true"]').waitFor();
                await page.screenshot({ path: `${out}/${name}-learning.png` });
                assert.equal(errors.length, 0, errors.join('\n'));
                report.scenarios.push({ name, pass: true, near, far, restored, errors });
            } catch (error) { await page.screenshot({ path: `${out}/${name}-failure.png` }); report.scenarios.push({ name, pass: false, error: error.stack, errors }); throw error; }
            finally { await context.close(); }
        }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
