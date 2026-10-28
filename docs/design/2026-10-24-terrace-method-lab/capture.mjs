// Drives the lab in a real browser: same saved data rendered by both terrain methods,
// a scripted child edit pass, unadjusted random edits, a resident walking to a moved
// bench, and a save/reload round trip. Writes PNGs and evidence/run.json.
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(directory, 'evidence');
await mkdir(out, { recursive: true });
const base = process.argv[2] ?? 'http://127.0.0.1:8241/design/2026-10-24-terrace-method-lab/';
const bundle = await readFile(path.join(directory, 'lab.bundle.js'));
const run = { startedAt: new Date().toISOString(), url: base, bundleSHA256: createHash('sha256').update(bundle).digest('hex'), steps: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') run.steps.push({ consoleError: m.text() }); });
const ready = async url => {
    await page.goto(url); await page.waitForFunction(() => window.lab, null, { timeout: 120_000 });
    await page.evaluate(() => document.body.classList.add('capture'));
};
const settle = () => page.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 250)));
const shot = async (name, method, view) => {
    await page.evaluate(([m, v]) => { window.lab.setMethod(m); window.lab.setView(v); }, [method, view]);
    if (method === 'N') await page.waitForTimeout(6000);
    await settle(); await page.screenshot({ path: path.join(out, `${name}.png`) });
    const state = await page.evaluate(() => JSON.parse(document.body.dataset.state || '{}'));
    run.steps.push({ shot: `${name}.png`, method, view, state });
};
const evaluate = (fn, arg) => page.evaluate(fn, arg);

await ready(base + '?fresh');
for (const [m, v] of [['T', 'whole'], ['T', 'near'], ['T', 'hill'], ['T', 'scale'], ['G', 'whole'], ['G', 'near'], ['G', 'hill']]) await shot(`sample-${m}-${v}`, m, v);
await shot('native05-whole', 'N', 'whole'); await shot('native05-near', 'N', 'near');
await evaluate(() => window.lab.setMethod('T'));

// A child's edit pass through the normal commands: a new pond by the bench, a new
// front terrace with a higher step, homes and a bench moved onto it, a lowered forest lip.
const edits = [
    { type: 'height', cell: [4, 8], delta: -1 }, { type: 'height', cell: [4, 7], delta: -1 },
    ...[[7, 8], [8, 8], [7, 9], [8, 9]].map(cell => ({ type: 'height', cell, delta: 1 })),
    { type: 'move', id: 'b1', cell: [8, 8], rot: 2 }, { type: 'move', id: 'h2', cell: [7, 9], rot: 1 },
    { type: 'move', id: 't7', cell: [2, 7] }, { type: 'move', id: 'h4', cell: [1, 6], rot: 1 },
    { type: 'height', cell: [6, 1], delta: -1 }, { type: 'height', cell: [6, 2], delta: -1 },
    { type: 'height', cell: [3, 6], delta: 1 },
];
const results = await evaluate(list => list.map(c => window.lab.run(c)), edits);
run.steps.push({ edits, accepted: results, state: await evaluate(() => JSON.parse(document.body.dataset.state)) });
for (const [m, v] of [['T', 'whole'], ['T', 'near'], ['G', 'whole'], ['G', 'near']]) await shot(`edited-${m}-${v}`, m, v);

// The resident walks to the bench that was moved onto the new terrace.
await evaluate(() => { window.lab.setMethod('T'); window.lab.setView('near'); });
const started = await evaluate(() => { window.lab.log.length = 0; return window.lab.goTo('b1', true); });
const arrived = await page.waitForFunction(() => window.lab.log.find(l => l.target === 'b1'), null, { timeout: 60_000 }).then(h => h.jsonValue()).catch(() => null);
await settle(); await page.screenshot({ path: path.join(out, 'edited-T-resident-at-bench.png') });
run.steps.push({ resident: { started, arrived, stairs: await evaluate(() => window.lab.stairs), bridges: await evaluate(() => window.lab.bridges) } });

// Unadjusted legal edits from the same seed and the same start, once per method.
const edited = await evaluate(() => JSON.stringify({ ...window.lab.island, hints: undefined }));
for (const m of ['G', 'T']) {
    await evaluate(([json, method]) => { window.lab.setMethod(method); window.lab.load(json); }, [edited, m]);
    const stress = await evaluate(() => window.lab.stress(24, 7));
    run.steps.push({ stress: { method: m, ...stress }, state: await evaluate(() => JSON.parse(document.body.dataset.state)) });
    for (const v of m === 'T' ? ['whole', 'near'] : ['whole']) await shot(`random24-${m}-${v}`, m, v);
}

// Regeneration cost on the edited island, both methods, five rebuilds each.
const timing = {};
for (const m of ['T', 'G']) {
    timing[m] = await evaluate(method => {
        window.lab.setMethod(method); const before = window.lab.timings.length;
        for (let i = 0; i < 5; i++) window.lab.rebuild();
        const t = window.lab.timings.slice(before).map(x => x.total);
        return { ms: t.map(v => +v.toFixed(1)), max: +Math.max(...t).toFixed(1) };
    }, m);
}
const stressTimings = await evaluate(() => window.lab.timings.map(t => +t.total.toFixed(1)));
run.steps.push({ timing, allRebuildsMs: stressTimings });

// Save, reload without ?fresh, and compare the data and the derived connectors.
await evaluate(() => window.lab.setMethod('T'));
const saved = await evaluate(() => { window.lab.save(); return { island: JSON.stringify({ ...window.lab.island, hints: undefined }), stairs: JSON.stringify(window.lab.stairs), bridges: JSON.stringify(window.lab.bridges) }; });
await ready(base);
const reloaded = await evaluate(() => ({ island: JSON.stringify({ ...window.lab.island, hints: undefined }), stairs: JSON.stringify(window.lab.stairs), bridges: JSON.stringify(window.lab.bridges) }));
run.steps.push({ reload: { islandSame: saved.island === reloaded.island, stairsSame: saved.stairs === reloaded.stairs, bridgesSame: saved.bridges === reloaded.bridges } });
await shot('reloaded-T-whole', 'T', 'whole');
run.completedAt = new Date().toISOString();
await writeFile(path.join(out, 'run.json'), JSON.stringify(run, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(run.steps.filter(s => !s.shot), null, 1).slice(0, 4000));
