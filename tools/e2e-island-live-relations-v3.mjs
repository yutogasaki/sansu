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
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, candidate, source: 'explicit DEV two-item ownership fixture; no earned acquisition claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        if (process.env.SANSU_RELATION_DEVICE && process.env.SANSU_RELATION_DEVICE !== device) continue;
        for (const kind of (process.env.SANSU_RELATION_KIND ? [process.env.SANSU_RELATION_KIND] : ['flower', 'swing'])) {
            const name = `${device}-${kind}`;
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
                    if (kind === 'water-bowl') {
                        const { prepareEconomyMigration } = await import('/src/domain/islandLife/economyMigration.ts');
                        const { prepareTourMigration } = await import('/src/domain/islandLife/tourMigration.ts');
                        record = await prepareTourMigration(await prepareEconomyMigration(record, []));
                    }
                    record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'qa-bench', at);
                    record = commandLife(record, { type: 'buy', kind, cell: { x: 2, z: 2 } }, 'qa-target', at);
                    record = commandLife(record, { type: 'visit', itemId: 'qa-bench' }, 'qa-visit', at);
                    await lifeDb.worlds.put(record); sessionStorage.setItem('qa-cover', 'on');
                }, { profileId, kind });
                await page.addInitScript(() => {
                    if (sessionStorage.getItem('qa-cover') !== 'on') return;
                    const cover = () => { const node = document.createElement('div'); node.id = 'qa-cover'; node.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#fff'; document.body.append(node); };
                    if (document.body) cover(); else document.addEventListener('DOMContentLoaded', cover, { once: true });
                });
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
                const rule = kind === 'flower' ? 'R1' : kind === 'water-bowl' ? 'R4' : 'R3';
                await ready(rule);
                const read = () => page.evaluate(async profileId => {
                    const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return await lifeDb.worlds.get(profileId);
                }, profileId);
                const coveredRecord = await read();
                await page.waitForTimeout(1600); assert.equal((await read()).discoveryJournal, undefined);
                await page.evaluate(() => { document.querySelector('#qa-cover').remove(); sessionStorage.setItem('qa-cover', 'off'); });
                const waitJournal = async predicate => {
                    for (let i = 0; i < 160; i++) { const journal = (await read()).discoveryJournal; if (predicate(journal)) return journal; await page.waitForTimeout(150); }
                    throw new Error(`Journal missing: ${await page.locator('.life-world').getAttribute('data-life-relations')}`);
                };
                let cameraTurns = 0;
                for (; cameraTurns < 12; cameraTurns++) {
                    await page.waitForTimeout(350);
                    const visible = await page.locator('.life-world').evaluate(node => JSON.parse(node.dataset.lifeRelations || '[]').some(relation => relation.core));
                    if (visible) break;
                    await page.locator('.life-camera-tools summary').click();
                    await page.getByRole('button', { name: 'しまを ひだりに まわす', exact: true }).click();
                    await page.locator('.life-camera-tools summary').click();
                }
                const first = await waitJournal(j => j?.firstPresented.some(entry => entry.ruleId === rule));
                const entry = first.entries.find(entry => entry.event.ruleId === rule);
                assert.equal(entry.event.source, 'live'); assert(entry.evidence.visibleDurationMs >= 1000);
                assert(entry.event.focalResidentIds.length >= 1);
                assert.deepEqual((await read()).actions, coveredRecord.actions);
                assert.deepEqual((await read()).credits, coveredRecord.credits);
                const delivered = await page.locator('.island-life').evaluate(n => ({ candidate: n.dataset.lifeCandidate, world: n.querySelector('.life-world').dataset.lifeWorldStyle }));
                const near = await poses(), native = await readNative(page, profileId);
                await page.screenshot({ path: `${out}/${name}-near.png` });
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
                await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                await page.getByRole('button', { name: 'みえた ばめん', exact: true }).click();
                await page.locator('[data-life-memory]').first().click();
                await page.locator('.life-relation-view[data-rendered="true"]').waitFor();
                await waitJournal(j => j?.entries.some(e => e.event.source === 'replay' && e.event.originEventId === entry.event.eventId));
                await page.getByRole('button', { name: 'のこす', exact: true }).click();
                await page.getByRole('button', { name: 'のこすのを やめる', exact: true }).waitFor();
                await page.screenshot({ path: `${out}/${name}-memory.png` });
                await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
                await move(5, kind === 'swing' ? 3 : 4); await ready(null);
                const far = await poses();
                const atFar = (await read()).discoveryJournal;
                await page.waitForTimeout(1600); assert.deepEqual((await read()).discoveryJournal, atFar); await page.screenshot({ path: `${out}/${name}-far.png` });
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
                assert.equal(saved.state.items.length, 2); assert.equal(saved.state.drops, kind === 'flower' ? 6 : kind === 'water-bowl' ? 4 : 2);
                assert(saved.journal?.entries.some(entry => entry.event.ruleId === rule && entry.event.source === 'live' && entry.evidence.visibleDurationMs >= 1000));
                await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
                await page.locator('.park-answer').waitFor();
                await page.screenshot({ path: `${out}/${name}-learning.png` });
                assert.equal(errors.length, 0, errors.join('\n'));
                report.scenarios.push({ name, pass: true, delivered, cameraTurns, event: entry, near, far, restored, errors });
            } catch (error) { await page.screenshot({ path: `${out}/${name}-failure.png` }); report.scenarios.push({ name, pass: false, error: error.stack, errors }); throw error; }
            finally { await context.close(); }
        }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
