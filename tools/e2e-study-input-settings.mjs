import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_STUDY_SETTINGS_OUTPUT || `output/playwright/island-smoothness/study-settings-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const source = 'src/pages/Study.tsx';
const hash = async () => createHash('sha256').update(await fs.readFile(source)).digest('hex');
const report = { target: base, evidence: 'Actual Study state/effects/handlers and Hissan hook; controlled session, delayed settings, and minimal DOM layout. No app database or 3D.',
    source, sourceStart: await hash(), interceptedModules: 0, cases: [], errors: [], pass: false };
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('**/src/pages/Study.tsx*', async route => {
        const response = await route.fetch();
        let body = await response.text();
        for (const dependency of ['/src/hooks/useStudySession.ts', '/src/domain/user/repository.ts', '/src/pages/StudyLayout.tsx']) {
            const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matcher = new RegExp(`(["'])${escaped}(?:\\?[^"']*)?\\1`, 'g');
            if (!matcher.test(body)) throw new Error(`Study import not found: ${dependency}`);
            body = body.replace(matcher, '"/tools/study-input-settings-probe.tsx"');
        }
        report.interceptedModules += 1;
        await route.fulfill({ response, body });
    });
    await page.route(`${base}/__study_settings__`, route => route.fulfill({ contentType: 'text/html', body: `
        <div id="probe"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        </script>` }));
    await page.goto(`${base}/__study_settings__`);
    await page.waitForFunction(() => window.__vite_plugin_react_preamble_installed__);
    report.cases = await page.evaluate(async () => (await import('/tools/study-input-settings-probe.tsx')).runSettingsProbes());
    report.sourceEnd = await hash();
    report.pass = report.sourceStart === report.sourceEnd && report.interceptedModules > 0
        && report.errors.length === 0 && report.cases.every(test => test.pass);
} catch (error) { report.errors.push(error.stack); }
finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
for (const test of report.cases) console.log(`${test.pass ? 'PASS' : 'FAIL'} ${test.name}: ${JSON.stringify(test.actual)}`);
if (report.errors.length) console.error(report.errors.join('\n'));
console.log(`Report: ${out}/report.json`);
if (!report.pass) process.exitCode = 1;
