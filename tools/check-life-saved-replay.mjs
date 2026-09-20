import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const target = process.env.SANSU_REPLAY_URL, out = process.env.SANSU_REPLAY_OUTPUT;
assert(target && ['localhost', '127.0.0.1'].includes(new URL(target).hostname) && out);
await mkdir(out, { recursive: false });
const fixtures = JSON.parse(await readFile('docs/design/audits/2026-09-20-diagonal-stroll/replay-fixtures.json'));
const report = { target, scope: 'Diagnostic: original immutable saved R5/R6 snapshots, actual observation component; no acquisition, DB mutation or PWA claims.', cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const fixture of fixtures) {
        const context = await browser.newContext({ viewport: fixture.device === 'phone' ? { width: 390, height: 844 } : { width: 768, height: 1024 }, reducedMotion: fixture.device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        for (const original of fixture.events) {
            await page.goto(target);
            await page.evaluate(async original => {
                const { default: React } = await import('/node_modules/.vite/deps/react.js');
                const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
                const { default: View } = await import('/src/components/island/life/RelationObservationView.tsx');
                const { discoverySubject } = await import('/src/domain/islandLife/discoveryRecall.ts');
                const { sceneDigest, replayDiscoveryScene } = await import('/src/domain/islandLife/discoveryJournal.ts');
                await import('/src/components/island/life/life.css');
                if (await sceneDigest(original.snapshot.scene) !== original.snapshot.immutableHash) throw Error('Snapshot changed');
                const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#e4eee8;padding:12px';
                host.innerHTML = '<p>保存場面の再生診断</p><div id="replay-diagnostic"></div>'; document.body.append(host);
                const root = createRoot(host.querySelector('#replay-diagnostic'));
                window.replayEvidence = null;
                root.render(React.createElement(View, { state: { ...original.snapshot.scene, drops: 0, light: 0, styles: [], days: {} },
                    frozen: true, benchId: discoverySubject(original).id, residentId: original.snapshot.scene.observationResidentId,
                    prepare: async () => replayDiscoveryScene(original, crypto.randomUUID(), Date.now()),
                    presented: (event, evidence) => { window.replayEvidence = { event, evidence }; } }));
            }, original);
            let error;
            try { await page.waitForFunction(() => window.replayEvidence, { }, { timeout: 15000 }); } catch (e) { error = e.message; }
            const audit = await page.locator('.life-relation-view').evaluate(n => JSON.parse(n.dataset.relationView ?? '{}'));
            await page.screenshot({ path: `${out}/${fixture.device}-${original.ruleId}.png` });
            report.cases.push({ device: fixture.device, rule: original.ruleId, audit, error, pass: !error });
        }
        await context.close();
    }
    report.pass = report.cases.every(c => c.pass);
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
assert(report.pass, 'Saved scene replay did not deliver');
