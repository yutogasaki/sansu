import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { seedNative, readNative } from './island-e2e-helpers.mjs';
const target = process.env.SANSU_REPLAY_URL, out = process.env.SANSU_REPLAY_OUTPUT;
assert(target && ['localhost', '127.0.0.1'].includes(new URL(target).hostname) && out);
await mkdir(out, { recursive: false });
const fixtures = JSON.parse(await readFile('docs/design/audits/2026-09-20-diagonal-stroll/legacy-world-fixtures.json'));
const report = { target, scope: 'Disposable preview fixture from archived original worlds; realAt rebased to launch, logical history and saved scenes retained. Real UI replay, not fresh acquisition or production PWA.', cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const { device, record } of fixtures.filter(f => !process.env.SANSU_REPLAY_DEVICE || f.device === process.env.SANSU_REPLAY_DEVICE)) {
        const context = await browser.newContext({ viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 768, height: 1024 }, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        try {
            await page.goto(target);
            await page.evaluate(async () => { const { db } = await import('/src/db/index.ts'); await db.open(); });
            await seedNative(page, record.profileId);
            await page.evaluate(async record => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw Error('Preview only');
                await lifeDb.worlds.put({ ...record, realAt: Date.now() });
            }, record);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            const native = await readNative(page, record.profileId), replays = [];
            for (const id of record.discoveryJournal.savedIds) {
                await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
                await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
                await page.getByRole('button', { name: 'のこした おもいで', exact: true }).click();
                await page.locator('[data-life-memory]').first().waitFor();
                const entry = page.locator('[data-life-memory]');
                let found = false;
                for (const node of await entry.all()) if (await node.getAttribute('data-life-memory') === id) { await node.click(); found = true; break; }
                assert(found, 'Original saved scene listed');
                await page.waitForFunction(() => JSON.parse(document.querySelector('.life-relation-view')?.dataset.relationView ?? '{}').delivered);
                const backgroundPoseUpdates = await page.locator('.life-world').evaluate(node => new Promise(resolve => {
                    let count = 0; const observer = new MutationObserver(changes => { count += changes.length; });
                    observer.observe(node, { attributes: true, attributeFilter: ['data-life-poses'] });
                    setTimeout(() => { observer.disconnect(); resolve(count); }, 600);
                }));
                assert.equal(backgroundPoseUpdates, 0, 'Covered world must not spend frames rendering');
                const audit = await page.locator('.life-relation-view').evaluate(n => JSON.parse(n.dataset.relationView));
                const original = record.discoveryJournal.entries.find(e => e.event.eventId === id);
                await page.screenshot({ path: `${out}/${device}-${original.event.ruleId}.png` }); replays.push({ id, audit, backgroundPoseUpdates });
                await page.getByRole('button', { name: 'おもいでを とじる', exact: true }).click();
                await page.locator('.life-world').evaluate(node => new Promise((resolve, reject) => {
                    const timer = setTimeout(() => { observer.disconnect(); reject(Error('World did not resume')); }, 5000);
                    const observer = new MutationObserver(() => { clearTimeout(timer); observer.disconnect(); resolve(true); });
                    observer.observe(node, { attributes: true, attributeFilter: ['data-life-poses'] });
                }));
            }
            const after = await page.evaluate(async id => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return lifeDb.worlds.get(id); }, record.profileId);
            for (const id of record.discoveryJournal.savedIds) assert.deepEqual(after.discoveryJournal.entries.find(e => e.event.eventId === id), record.discoveryJournal.entries.find(e => e.event.eventId === id));
            assert.deepEqual(await readNative(page, record.profileId), native); assert.equal(after.version, 18);
            report.cases.push({ device, replays, pass: true });
        } catch (e) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.failure = { device, error: e.stack, text: await page.locator('body').innerText(), audit: await page.locator('.life-relation-view').evaluate(n => JSON.parse(n.dataset.relationView ?? '{}')).catch(() => null) }; throw e; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
