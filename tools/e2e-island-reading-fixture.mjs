import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
import { saved, closeMenu } from './island-life-ui-helpers.mjs';

const out = process.env.SANSU_READING_OUTPUT;
assert(out, 'Specify a fresh SANSU_READING_OUTPUT');
await mkdir(out, { recursive: false });
async function sourceHash() {
    const hash = createHash('sha256');
    for (const path of [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort())
        hash.update(path).update('\0').update(await readFile(path)).update('\0');
    return hash.digest('hex');
}
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    target: 'http://127.0.0.1:5223', flags: 'DEV VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'reading-book-v1',
    fixture: 'Explicit simulated otter reading snapshot rendered by the actual observation component. Actual rendered evidence is persisted as simulated, then saved and replayed through app UI. This does not prove a naturally scheduled X3 or acquisition.', humanN: 0, cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const device of ['phone', 'tablet']) {
        const context = await browser.newContext({ viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 768, height: 1024 }, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        try {
            await page.goto(report.target); const id = await seedDev(page, { familiar: false });
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const before = await saved(page, id), native = await readNative(page, id);
            await page.evaluate(async id => {
                const { default: React } = await import('/node_modules/.vite/deps/react.js');
                const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
                const { default: View } = await import('/src/components/island/life/RelationObservationView.tsx');
                const { newLife } = await import('/src/domain/islandLife/model.ts');
                const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const { evaluateDiscovery } = await import('/src/domain/islandLife/discovery.ts');
                const { createDiscoveryScene } = await import('/src/domain/islandLife/discoveryJournal.ts');
                const { recordPresentedScene } = await import('/src/domain/islandLife/discoveryRepository.ts');
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw Error('DEV fixture only');
                const state = replayLife(newLife(id, 0));
                state.readingEncounterVersion = 1; state.facilityTripVersion = 1; state.worldStyle = 'canopy-dots-c3-v1';
                state.items = [{ id: 'fixture-library', kind: 'library', cell: { x: 0, z: 0 }, growth: 0, style: 'original' },
                    { id: 'fixture-bench', kind: 'bench', cell: { x: 3, z: 2 }, growth: 0, style: 'original', access: 'front' }];
                const path = [{ x: 0, z: 2 }, { x: 0, z: 3 }, { x: 1, z: 3 }, { x: 2, z: 3 }, { x: 3, z: 3 }];
                const otter = state.residents.find(r => r.id === 'otter');
                otter.visit = { itemId: 'fixture-bench', from: path[0], path, start: 0, end: 100000 };
                otter.facilityTrip = { facilityId: 'fixture-library', targetId: 'fixture-bench', kind: 'library', phase: 'carry', path, end: 100000 };
                state.now = 10000;
                const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;background:#e4eee8;z-index:999999;padding:24px';
                document.body.append(host);
                const label = document.createElement('p'); label.textContent = '検証用の場面 — 自然出現の証拠ではありません'; host.append(label);
                const target = document.createElement('div'); host.append(target);
                const style = document.createElement('style'); style.textContent = '.life-relation-view {width:min(100%,440px)!important;height:410px!important;margin:20px auto!important;}'; host.append(style);
                const root = createRoot(target); window.closeReadingFixture = () => { root.unmount(); host.remove(); };
                window.readingFixtureEvidence = [];
                const prepare = (s, r, actors) => createDiscoveryScene(id, s, evaluateDiscovery(s, id).find(x => x.ruleId === r.ruleId), 'simulated', crypto.randomUUID(), Date.now(), actors);
                const presented = async (event, evidence) => { await recordPresentedScene(id, event, evidence); window.readingFixtureEvidence.push({ event, evidence }); };
                root.render(React.createElement(View, { state, benchId: 'fixture-bench', residentId: 'otter', frozen: true, prepare, presented, readingPrepare: prepare, readingPresented: presented }));
            }, id);
            await page.waitForFunction(() => window.readingFixtureEvidence?.some(e => e.event.ruleId === 'X3'));
            const original = await page.evaluate(() => window.readingFixtureEvidence.find(e => e.event.ruleId === 'X3'));
            assert.equal(original.event.source, 'simulated');
            await page.evaluate(() => window.closeReadingFixture());
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const memory = async savedTab => {
                await closeMenu(page); await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                await page.getByRole('button', { name: savedTab ? 'のこした おもいで' : 'みえた ばめん', exact: true }).click();
                await page.locator(`[data-life-memory="${original.event.eventId}"]`).click();
            };
            await memory(false);
            await page.getByRole('button', { name: 'のこす', exact: true }).click();
            await waitForAsync(page, async ({ id, eventId }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal.savedIds.includes(eventId); }, { id, eventId: original.event.eventId });
            await waitForAsync(page, async ({ id, eventId }) => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(id)).discoveryJournal.entries.some(e => e.event.source === 'replay' && e.event.originEventId === eventId); }, { id, eventId: original.event.eventId });
            await page.screenshot({ path: `${out}/${device}-saved-replay.png` });
            await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
            await memory(true);
            const samples = [];
            for (const stage of ['upside-down', 'upright']) {
                await page.waitForFunction(stage => { const v = JSON.parse(document.querySelector('.life-relation-view')?.dataset.readingView ?? '{}'); return v.active && v.stage === stage; }, stage);
                samples.push(await page.locator('.life-relation-view').evaluate(n => ({ reading: JSON.parse(n.dataset.readingView), relation: JSON.parse(n.dataset.relationView) })));
                await page.screenshot({ path: `${out}/${device}-${stage}.png` });
            }
            await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const after = await saved(page, id);
            assert.deepEqual(after.record.actions, before.record.actions);
            assert.equal(after.state.drops, before.state.drops); assert.equal(after.state.light, before.state.light);
            assert.deepEqual(await readNative(page, id), native);
            assert(after.record.discoveryJournal.savedIds.includes(original.event.eventId));
            assert.deepEqual(after.record.discoveryJournal.entries.find(e => e.event.eventId === original.event.eventId).event, original.event);
            assert.deepEqual(errors, []);
            const delivery = await page.evaluate(() => ({ url: location.href, builds: [...document.querySelectorAll('[data-build-revision]')].map(n => ({ revision: n.dataset.buildRevision, version: n.dataset.buildVersion, delivery: n.dataset.deliveryId })), world: document.querySelector('.life-world')?.dataset.lifeWorldStyle }));
            report.cases.push({ device, original, samples, delivery, unchangedActions: true, unchangedNative: true, unchangedCurrency: true, savedAfterReload: true, errors });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }).catch(() => {}); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, source: report.endHash, out }));
