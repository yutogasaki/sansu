// Public-build diagnostic in an isolated browser. Never connects to a user's browser profile.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const target = 'https://sansu-seven.vercel.app/';
const out = process.env.SANSU_OPENING_OUTPUT || 'output/playwright/life-public-opening/measured';
await mkdir(out, { recursive: true });
const version = await (await fetch(new URL('version.json', target))).json();
assert.equal(execFileSync('git', ['diff', version.revision, '--', 'src/domain/islandLife'], { encoding: 'utf8' }), '', 'Fixture rules must match public source');
const report = { target, version, viewport: { width: 390, height: 844 }, conditions: 'Desktop Chromium, isolated storage, public JS, normal network; CPU slowdown explicitly labelled. Synthetic fixture, not user data.', runs: [] };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [], entries: [] } });
const browser = await chromium.launch();
function instrument() {
    const data = window.__opening = { marks: {}, idb: [], longTasks: [], gl: {}, errors: [] };
    const stamp = name => { data.marks[name] ??= performance.now(); };
    new PerformanceObserver(list => { for (const e of list.getEntries()) data.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
    addEventListener('error', e => data.errors.push(e.message));
    const observe = () => {
        if (document.querySelector('.life-world')) stamp('worldDom');
        if (document.querySelector('.life-world[data-rendered="true"]') && data.marks.firstFrame === undefined) {
            stamp('firstFrame');
            requestAnimationFrame(() => requestAnimationFrame(() => stamp('paintOpportunity')));
        }
        if (document.querySelector('.island-learning[data-input-ready="true"]')) stamp('learningReady');
    };
    new MutationObserver(observe).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-rendered', 'data-input-ready'] });
    for (const method of ['get', 'getAll', 'getAllKeys', 'openCursor', 'put', 'add']) {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (...args) {
            const entry = { db: this.transaction.db.name, store: this.name, method, start: performance.now() };
            const request = original.apply(this, args);
            request.addEventListener('success', () => { if (entry.end === undefined) { entry.end = performance.now(); data.idb.push(entry); } });
            return request;
        };
    }
    const encode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const t = performance.now(); try { return encode.apply(this, args); }
        finally { const m = data.gl.pngEncode ??= { calls: 0, ms: 0 }; m.calls++; m.ms += performance.now() - t; }
    };
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
        const t = performance.now(), result = get.apply(this, args);
        if (String(args[0]).startsWith('webgl')) { stamp('webglContext'); data.gl.contextMs = (data.gl.contextMs || 0) + performance.now() - t; }
        return result;
    };
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const method of ['compileShader', 'linkProgram', 'getProgramParameter', 'texImage2D']) {
            const original = proto[method];
            proto[method] = function (...args) {
                const t = performance.now(); try { return original.apply(this, args); }
                finally { const m = data.gl[method] ??= { calls: 0, ms: 0 }; m.calls++; m.ms += performance.now() - t; }
            };
        }
    }
}
async function world(page, value) {
    return page.evaluate(async value => {
        const database = await new Promise((resolve, reject) => { const r = indexedDB.open('SansuIslandLifeV1'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        try {
            if (value) await new Promise((resolve, reject) => { const tx = database.transaction('worlds', 'readwrite'); tx.objectStore('worlds').put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
            return await new Promise((resolve, reject) => { const r = database.transaction('worlds').objectStore('worlds').getAll(); r.onsuccess = () => resolve(r.result[0]); r.onerror = () => reject(r.error); });
        } finally { database.close(); }
    }, value);
}
try {
    const context = await browser.newContext({ viewport: report.viewport, hasTouch: true });
    await context.addInitScript(instrument);
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    const cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable');
    await page.goto(target); await page.getByRole('button', { name: 'まなぶ', exact: true }).first().waitFor();
    report.coldShell = await page.evaluate(() => ({ readyMs: performance.now(), navigation: performance.getEntriesByType('navigation')[0].toJSON(), resources: performance.getEntriesByType('resource').map(e => e.toJSON()) }));
    for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    async function measure(label, rate = 1, profile = false) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        if (profile) await cdp.send('Profiler.start');
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.locator('.life-world[data-rendered="true"]').waitFor();
        await page.waitForFunction(() => window.__opening?.marks.paintOpportunity !== undefined);
        const result = await page.evaluate(() => ({ ...window.__opening, navigation: performance.getEntriesByType('navigation')[0].toJSON(), resources: performance.getEntriesByType('resource').map(e => e.toJSON()), serviceWorker: Boolean(navigator.serviceWorker.controller), runtimeAssets: document.querySelector('.life-world').dataset.runtimeAssets || null }));
        if (profile) { const { profile: cpu } = await cdp.send('Profiler.stop'); await writeFile(`${out}/${label}.cpuprofile`, JSON.stringify(cpu)); }
        await page.screenshot({ path: `${out}/${label}.png` });
        const reads = result.idb.filter(x => x.db === 'SansuIslandLifeV1' && x.store === 'worlds' && x.method === 'get');
        const writes = result.idb.filter(x => x.db === 'SansuIslandLifeV1' && x.store === 'worlds' && x.method === 'put');
        const read = reads[0], write = writes.find(x => x.start >= (read?.end || 0));
        const summary = { label, cpuRate: rate, firstFrameMs: result.marks.firstFrame, documentResponseMs: result.navigation.responseEnd, worldReadEndMs: read?.end, preWriteWorkMs: read && write ? write.start - read.end : null, worldDomMs: result.marks.worldDom, glContextToFirstFrameMs: result.marks.firstFrame - result.marks.webglContext, paintOpportunityMs: result.marks.paintOpportunity, gl: result.gl, transferredBytes: result.resources.reduce((n, e) => n + e.transferSize, 0), longTaskMs: result.longTasks.reduce((n, e) => n + e.duration, 0), runtimeAssets: result.runtimeAssets };
        report.runs.push({ summary, raw: result }); console.log(JSON.stringify(summary));
        assert.deepEqual(result.errors, []);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    await measure('fresh-warm');
    const initial = await world(page);
    const { commandLife } = await server.ssrLoadModule('/src/domain/islandLife/simulation.ts');
    const { learningDay, HOUR } = await server.ssrLoadModule('/src/domain/islandLife/model.ts');
    let fixture = structuredClone(initial); const at = fixture.now + 1;
    fixture.credits.push(...Array.from({ length: 100 }, (_, i) => ({ id: `opening-synthetic-${i}`, at, day: learningDay(at) })));
    for (const [i, [kind, x, z]] of [['flower', 0, 3], ['bench', 1, 3], ['lantern', 4, 2], ['flower', 0, 1], ['swing', 4, 4], ['flower', 2, 4]].entries()) {
        let purchased = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            try { fixture = commandLife(fixture, { type: 'buy', kind, cell: { x, z } }, `opening-item-${i}`, fixture.now + 1 + attempt * 30000); purchased = true; break; }
            catch (e) { if (!String(e).includes('あるいている')) throw e; }
        }
        assert(purchased, `Fixture placement did not become vacant: ${i}`);
    }
    report.fixture = { version: fixture.version, actions: fixture.actions.length, syntheticCredits: 100, hash: createHash('sha256').update(JSON.stringify(fixture)).digest('hex') };
    for (const hours of [0, 24, 168]) {
        await world(page, { ...fixture, realAt: Date.now() - hours * HOUR });
        await measure(`owned-${hours}h`, 1, hours === 168);
        if (hours === 0) {
            await cdp.send('Network.enable');
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
            await cdp.send('Network.setBypassServiceWorker', { bypass: true });
            await measure('owned-cold-network');
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
            await cdp.send('Network.setBypassServiceWorker', { bypass: false });
        }
    }
    await measure('owned-168h-repeat', 1, true);
    await measure('owned-168h-repeat-cpu4', 4, true);
    await page.getByRole('button', { name: 'いえ', exact: true }).click();
    await page.locator('.life-world').waitFor({ state: 'detached' });
    await page.evaluate(() => { window.__opening.marks = {}; window.__opening.idb = []; window.__opening.gl = {}; window.__opening.longTasks = []; });
    const returnStart = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'しま', exact: true }).click();
    await page.waitForFunction(() => window.__opening?.marks.paintOpportunity !== undefined);
    report.sameDocumentReturn = await page.evaluate(start => ({ firstFrameMs: window.__opening.marks.firstFrame - start,
        paintOpportunityMs: window.__opening.marks.paintOpportunity - start, raw: window.__opening }), returnStart);
    await page.screenshot({ path: `${out}/same-document-return.png` });
    console.log(JSON.stringify({ label: 'same-document-return', firstFrameMs: report.sameDocumentReturn.firstFrameMs, paintOpportunityMs: report.sameDocumentReturn.paintOpportunityMs }));
    report.finalVersion = await (await fetch(new URL('version.json', target))).json();
    assert.equal(report.finalVersion.revision, version.revision, 'Public deployment changed during measurement');
    report.pass = true;
    await context.close();
} catch (e) { report.error = String(e); throw e; }
finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); await server.close(); }
