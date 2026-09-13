import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
import { saved, inventory, closeMenu, putCell } from './island-life-ui-helpers.mjs';

const out = process.env.SANSU_ENCOUNTER_OUTPUT;
assert(out, 'Specify a fresh SANSU_ENCOUNTER_OUTPUT');
await mkdir(out, { recursive: false });
const browser = await chromium.launch();
async function sourceHash() {
    const hash = createHash('sha256');
    const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0');
    return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    target: 'http://127.0.0.1:5223', flags: 'DEV VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'group-encounters-v1',
    fixture: '20 QA credits; purchases and 18-hour maturity seeded through domain commands in a fresh DEV database. Subsequent inputs, placement, storage, save, and replay use actual UI.', humanN: 0, cases: [], pass: false };
try {
    for (const device of ['phone', 'tablet']) for (const kind of ['flower', 'sapling']) {
        if (process.env.SANSU_ENCOUNTER_CASE && process.env.SANSU_ENCOUNTER_CASE !== `${device}-${kind}`) continue;
        const prefix = `${device}-${kind}`;
        const context = await browser.newContext({ viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 768, height: 1024 }, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
            await page.goto('http://127.0.0.1:5223');
            const id = await seedDev(page, { familiar: false });
            await page.evaluate(async ({ id, kind }) => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay, HOUR } = await import('/src/domain/islandLife/model.ts');
                const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                const { prepareEconomyMigration } = await import('/src/domain/islandLife/economyMigration.ts');
                const { prepareTourMigration } = await import('/src/domain/islandLife/tourMigration.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV fixture only');
                const now = Date.now(), start = now - 18 * HOUR;
                let record = newLife(id, start);
                record.credits = Array.from({ length: 20 }, (_, i) => ({ id: `qa-credit-${i}`, at: start, day: learningDay(start) }));
                record = await prepareTourMigration(await prepareEconomyMigration(record, []));
                for (let i = 0; i < (kind === 'flower' ? 6 : 3); i++)
                    record = commandLife(record, { type: 'buy', kind, cell: { x: i % 3, z: 2 + Math.floor(i / 3) } }, `qa-plant-${i}`, start);
                record = commandLife(record, { type: 'buy', kind: 'water-bowl', cell: { x: 4, z: 2 } }, 'qa-water', start);
                record = commandLife(record, { type: 'visit', itemId: 'qa-water' }, 'qa-visit', now);
                record.realAt = now; await lifeDb.worlds.put(record);
            }, { id, kind });
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const native = await readNative(page, id), before = await saved(page, id);
            await page.locator('.life-camera-tools summary').click();
            await page.getByRole('button', { name: 'しま全体を みる', exact: true }).click();
            await page.locator('.life-camera-tools summary').click();
            const rule = kind === 'flower' ? 'GF6' : 'GT3';
            await waitForAsync(page, async ({ id, rule }) => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                return (await lifeDb.worlds.get(id)).discoveryJournal?.entries.some(e => e.event.ruleId === rule);
            }, { id, rule });
            const eventId = await page.evaluate(async ({ id, rule }) => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                return (await lifeDb.worlds.get(id)).discoveryJournal.entries.find(e => e.event.ruleId === rule).event.eventId;
            }, { id, rule });
            const memory = async event => {
                await closeMenu(page); await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                await page.getByRole('button', { name: event === eventId ? 'みえた ばめん' : 'のこした おもいで', exact: true }).click();
                await page.locator(`[data-life-memory="${event}"]`).click();
            };
            await memory(eventId);
            await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click();
            const hint = page.getByRole('button', { name: kind === 'flower' ? 'はねの けはい' : 'えだの けはい', exact: true });
            await hint.waitFor(); await page.screenshot({ path: `${out}/${prefix}-hint.png` });
            await hint.click();
            await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.encounterView ?? '{}').active);
            // Keep screenshot readback out of the first presentation's short visibility window.
            await waitForAsync(page, async ({ id, kind }) => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                return (await lifeDb.worlds.get(id)).discoveryJournal.entries.some(e => e.event.ruleId === (kind === 'flower' ? 'X1' : 'X2'));
            }, { id, kind });
            const event = (await saved(page, id)).record.discoveryJournal.entries.find(e => e.event.ruleId === (kind === 'flower' ? 'X1' : 'X2')).event;
            await page.getByRole('button', { name: 'のこす', exact: true }).click();
            await waitForAsync(page, async ({ id, eventId }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal.savedIds.includes(eventId); }, { id, eventId: event.eventId });
            await page.waitForFunction(() => !JSON.parse(document.querySelector('.life-relation-view')?.dataset.encounterView ?? '{}').active);
            await page.waitForTimeout(600);
            const cue = await page.locator('.life-relation-view').evaluate(n => {
                const { cue } = JSON.parse(n.dataset.encounterView), { camera } = JSON.parse(n.dataset.relationView), r = n.getBoundingClientRect();
                const mul = (m, v) => [0,1,2,3].map(i => m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);
                const p = mul(camera.projection, mul(camera.view, [...cue, 1]));
                return { x: r.left+(p[0]/p[3]+1)*r.width/2, y: r.top+(1-p[1]/p[3])*r.height/2 };
            });
            await page.touchscreen.tap(cue.x, cue.y);
            await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.encounterView ?? '{}').active);
            const samples = [];
            for (const [i, stage] of ['outbound', 'water', 'plant'].entries()) {
                await page.waitForFunction(stage => {
                    const v = JSON.parse(document.querySelector('.life-relation-view')?.dataset.encounterView ?? '{}');
                    return v.active && v.stage === stage && (stage !== 'plant' || v.elapsed > 6000);
                }, stage);
                samples.push(await page.locator('.life-relation-view').evaluate(n => ({ ...JSON.parse(n.dataset.encounterView ?? '{}'), rendering: JSON.parse(n.dataset.relationView ?? '{}') })));
                await page.screenshot({ path: `${out}/${prefix}-phase-${i}.png` });
            }
            await writeFile(`${out}/${prefix}-samples.json`, JSON.stringify({ samples, errors }, null, 2));
            const entries = await page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal.entries; }, id);
            await writeFile(`${out}/${prefix}-journal.json`, JSON.stringify(entries, null, 2));
            assert(entries.some(e => e.event.ruleId === (kind === 'flower' ? 'X1' : 'X2')), 'Encounter must be presented');
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            await memory(event.eventId); await hint.waitFor(); await hint.click();
            await waitForAsync(page, async ({ id, origin }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal.entries.some(e => e.event.source === 'replay' && e.event.originEventId === origin); }, { id, origin: event.eventId });
            await page.screenshot({ path: `${out}/${prefix}-replay.png` });
            await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
            // Remove the partner through actual UI; the immutable past remains replayable.
            await inventory(page, 'qa-water'); await page.getByRole('button', { name: 'しまう', exact: true }).click();
            await waitForAsync(page, async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); return !replayLife(await lifeDb.worlds.get(id)).items.find(i => i.id === 'qa-water').cell; }, id);
            await closeMenu(page); await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            await memory(event.eventId); await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click();
            await page.locator('.life-gathering-view[data-rendered="true"]').waitFor();
            await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView ?? '{}').delivered);
            assert.equal(await hint.count(), 0); await page.screenshot({ path: `${out}/${prefix}-current-without-water.png` });
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            await inventory(page, 'qa-water'); await page.getByRole('button', { name: 'おく', exact: true }).click();
            await putCell(page, { x: 4, z: 2 });
            await waitForAsync(page, async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); const { replayLife } = await import('/src/domain/islandLife/simulation.ts'); return replayLife(await lifeDb.worlds.get(id)).items.find(i => i.id === 'qa-water').cell?.x === 4; }, id);
            await memory(event.eventId); await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click(); await hint.waitFor();
            await page.screenshot({ path: `${out}/${prefix}-restored-hint.png` });
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            const final = await saved(page, id);
            assert.deepEqual(final.record.discoveryJournal.entries.find(e => e.event.eventId === event.eventId).event, event);
            assert(final.record.discoveryJournal.savedIds.includes(event.eventId));
            assert.equal(final.state.drops, before.state.drops); assert.equal(final.state.light, before.state.light);
            assert.deepEqual(await readNative(page, id), native);
            const delivery = await page.evaluate(() => ({ url: location.href, builds: [...document.querySelectorAll('[data-build-revision]')].map(n => ({ revision: n.dataset.buildRevision, version: n.dataset.buildVersion, delivery: n.dataset.deliveryId })), world: document.querySelector('.life-world')?.dataset.lifeWorldStyle }));
            await closeMenu(page); await page.getByRole('button', { name: 'まなぶ', exact: true }).click(); await page.locator('.park-answer').waitFor();
            assert.deepEqual(errors, []);
            report.cases.push({ device, kind, event, version: final.record.version, delivery, drops: final.state.drops, light: final.state.light, pass: true });
        } catch (error) {
            await page.screenshot({ path: `${out}/${prefix}-failure.png` });
            await writeFile(`${out}/${prefix}-failure.json`, JSON.stringify(await page.locator('.life-relation-view').evaluateAll(nodes => nodes.map(n => ({ current: n.dataset.encounterView, last: n.dataset.encounterLast, rendering: n.dataset.relationView }))), null, 2));
            throw error;
        }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
