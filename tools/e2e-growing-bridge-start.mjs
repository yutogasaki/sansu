import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

// Explicit renderer-lifecycle diagnostic. No real profile or saved data is read
// or written; the component receives a synthetic, already-saved bridge.
const base = process.env.SANSU_BRIDGE_URL || 'http://127.0.0.1:5198';
const output = process.env.SANSU_BRIDGE_OUTPUT;
assert(output, 'Specify a fresh SANSU_BRIDGE_OUTPUT directory');
await fs.mkdir(output, { recursive: false });
const files = ['src/components/island/growing/GrowingWorld.tsx', 'src/components/island/growing/GrowingIsland.tsx',
    'src/components/island/growing/growingLife.ts', 'tools/e2e-growing-bridge-start.mjs'];
const sources = async () => Object.fromEntries(await Promise.all(files.map(async file =>
    [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = { target: base, date: new Date().toISOString(), diagnostic: 'synthetic state; no acquisition or persistence evidence',
    sources: await sources(), cases: [], pass: false };
const browser = await chromium.launch();
try {
    for (const width of [390, 768]) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.evaluate(async () => {
            await import('/src/components/island/growing/growing.css');
            const [{ default: React }, { default: ReactDOM }, { default: World }, { newIsland, applyIntent }] = await Promise.all([
                import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
                import('/src/components/island/growing/GrowingWorld.tsx'), import('/src/domain/growingIsland/index.ts')]);
            let state = applyIntent(newIsland('bridge-lifecycle-diagnostic', Date.now()), {
                id: 'fixture-home', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
            state.arrivals = []; state.unopened = [];
            state = applyIntent(state, { id: 'fixture-bridge', command: { type: 'bridge-build', x: 2 } }).state;
            document.querySelector('#root').style.display = 'none';
            const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;background:white'; document.body.append(host);
            const root = ReactDOM.createRoot(host);
            window.bridgeDiagnostic = { ready: false, complete: 0, draw(request, rebuild = false) {
                root.render(React.createElement(World, { state, time: 'day', turn: 0, cheer: 0, festival: 0,
                    compact: true, bridgeBuild: request, authoredWater: rebuild,
                    onStage: stage => { if (stage === 'ready') window.bridgeDiagnostic.ready = true; },
                    onBridgeComplete: () => { window.bridgeDiagnostic.complete++; } }));
            } };
            // Signal is present on the very first render, while api.current is
            // still undefined. The old effect silently lost this exact request.
            window.bridgeDiagnostic.draw(1);
        });
        for (const stage of ['building', 'crossing', 'arrived']) {
            await page.locator(`[data-bridge-stage="${stage}"]`).waitFor({ timeout: 30000 });

        }
        await page.screenshot({ path: `${output}/${width}-arrived.png` });
        assert.equal(await page.locator('[data-growing-world]').getAttribute('data-growing-focus'), 'bridge');
        assert.equal(await page.evaluate(() => window.bridgeDiagnostic.complete), 1);
        await page.locator('[data-bridge-stage]').waitFor({ state: 'hidden' });
        await page.evaluate(() => { window.bridgeDiagnostic.ready = false; window.bridgeDiagnostic.draw(1, true); });
        await page.waitForFunction(() => window.bridgeDiagnostic.ready);
        assert.equal(await page.locator('[data-bridge-stage]').count(), 0, 'completed request must not replay on renderer rebuild');
        await page.evaluate(() => window.bridgeDiagnostic.draw(0, true));
        await page.waitForTimeout(100);
        assert.equal(await page.locator('[data-bridge-stage]').count(), 0, 'saved bridge without a fresh request must not play');
        assert.deepEqual(errors, []);
        report.cases.push({ width, stages: ['building', 'crossing', 'arrived'], completedOnce: true,
            world: await page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset })) });
        await page.close();
    }
    assert.deepEqual(await sources(), report.sources, 'source changed during diagnostic');
    report.pass = true;
} catch (error) { report.error = error.stack; throw error; }
finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(`PASS bridge renderer startup and rebuild (${report.cases.length} viewports)`);
