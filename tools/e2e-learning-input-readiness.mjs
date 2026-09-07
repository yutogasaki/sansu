import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_INPUT_READINESS_OUTPUT || `output/playwright/island-smoothness/readiness-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const source = 'src/components/domain/LearningAnswerForm.tsx';
const hash = async () => createHash('sha256').update(await fs.readFile(source)).digest('hex');
const report = { target: base, evidence: 'Test-only real React DOM commit boundary; no Island renderer or saved data',
    source, sourceStart: await hash(), cases: [], errors: [], pass: false };
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route(`${base}/__input_readiness__`, route => route.fulfill({ contentType: 'text/html', body: `
        <div id="probe"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        </script>` }));
    await page.goto(`${base}/__input_readiness__`);
    await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__);
    report.cases = await page.evaluate(async () => (await import('/tools/learning-answer-readiness-probe.tsx')).runCommitProbes());
    await page.evaluate(async () => (await import('/tools/learning-answer-readiness-probe.tsx')).mountNativeProbe());
    await page.keyboard.type('11');
    await page.keyboard.press('Enter');
    const native = await page.evaluate(async () => (await import('/tools/learning-answer-readiness-probe.tsx')).readNativeProbe());
    report.cases.push({ name: 'Playwright native keyboard enters and submits intentional 11', actual: native,
        expected: { values: ['11'], answers: ['11'] }, pass: JSON.stringify(native) === JSON.stringify({ values: ['11'], answers: ['11'] }) });
    await page.evaluate(async () => (await import('/tools/learning-answer-readiness-probe.tsx')).unmountNativeProbe());
    report.sourceEnd = await hash();
    report.pass = report.sourceStart === report.sourceEnd && report.errors.length === 0 && report.cases.every(test => test.pass);
} catch (error) { report.errors.push(error.stack); }
finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
for (const result of report.cases) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${JSON.stringify(result.actual)}`);
if (report.errors.length) console.error(report.errors.join('\n'));
console.log(`Report: ${out}/report.json`);
if (!report.pass) process.exitCode = 1;
