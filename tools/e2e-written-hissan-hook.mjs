import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';

const base = process.env.SANSU_WRITTEN_HISSAN_BASE_URL || 'http://127.0.0.1:5201';
const out = process.env.SANSU_WRITTEN_HISSAN_HOOK_OUTPUT || `output/playwright/written-hissan/hook-${Date.now()}`;
const sources = [
    'src/hooks/useHissanSession.ts',
    'src/hooks/useTimeoutScheduler.ts',
    'src/domain/math/hissanEngine.ts',
    'src/domain/math/writtenArithmetic.ts',
    'src/domain/math/hissanTypes.ts',
    'tools/written-hissan-hook-probe.tsx',
];
const hashes = async () => Object.fromEntries(await Promise.all(sources.map(async source => [
    source, createHash('sha256').update(await fs.readFile(source)).digest('hex'),
])));
await fs.mkdir(out, { recursive: true });
const report = {
    target: base,
    evidence: 'Actual useHissanSession, engines, and timeout scheduler in Chromium. Native keydown batches run before React commits. Only the harness HTML is intercepted; application modules execute unchanged.',
    boundary: 'Save outcomes are controlled caller results testing retryHissanSave; actual persistence, planner, application keyboard bindings, and layout are covered separately.',
    sourceStart: await hashes(), sourceEnd: {}, cases: [], errors: [], pass: false,
};
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route(`${base}/__written_hissan_hook__`, route => route.fulfill({
        contentType: 'text/html', body: `<div id="probe"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        </script>`,
    }));
    await page.goto(`${base}/__written_hissan_hook__`);
    await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__);
    report.cases = await page.evaluate(async () => (
        await import('/tools/written-hissan-hook-probe.tsx')
    ).runWrittenHissanHookProbes());
    report.sourceEnd = await hashes();
    report.pass = JSON.stringify(report.sourceStart) === JSON.stringify(report.sourceEnd)
        && report.cases.length > 0 && report.cases.every(test => test.pass) && report.errors.length === 0;
} catch (error) {
    report.errors.push(error.stack ?? String(error));
} finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
for (const test of report.cases) {
    console.log(`${test.pass ? 'PASS' : 'FAIL'} ${test.name}${test.pass ? '' : `: ${JSON.stringify(test.actual)} expected ${JSON.stringify(test.expected)}`}`);
}
if (report.errors.length) console.error(report.errors.join('\n'));
console.log(`${report.cases.filter(test => test.pass).length}/${report.cases.length} cases passed. Report: ${out}/report.json`);
if (!report.pass) process.exitCode = 1;
