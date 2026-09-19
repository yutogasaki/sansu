import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedDev } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_STUDY_URL || 'http://127.0.0.1:5345';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = process.env.SANSU_STUDY_OUTPUT || 'output/verification-repair/feedback-boundary';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(), report = { target: base, cases: [], pass: false };
try {
    for (const kind of ['incorrect', 'skipped']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.addInitScript(() => { window.__SANSU_E2E__ = { exploreBenchmark: { fixtureId: 'cold-open-fixed-ten-v1', startIndex: 0 } }; });
        await page.goto(base); await page.waitForURL('**/#/onboarding'); await seedDev(page, { familiar: false });
        await page.goto(`${base}/#/study?session=dev&benchmark=cold-open-fixed-ten-v1`);
        const root = page.locator('[data-benchmark-id="cold-open-fixed-ten-v1"]');
        await root.waitFor();
        await page.waitForFunction(() => document.querySelector('[data-study-index="0"][data-feedback="none"]'));
        if (kind === 'incorrect') await page.keyboard.type('3');
        else await page.getByRole('button', { name: /スキップ|とばす/ }).click();
        const next = page.getByRole('button', { name: /^(次へ|つぎへ)$/ }); await next.waitFor();
        // Dispatch both clicks in one browser task, with React's next render in between.
        // This specifically exercises an outgoing AnimatePresence control, not a fresh button.
        const result = await next.evaluate(async button => {
            button.click();
            await new Promise(resolve => requestAnimationFrame(resolve));
            const before = document.querySelector('[data-benchmark-id]')?.getAttribute('data-study-index');
            const outgoingStillMounted = button.isConnected;
            button.click();
            await new Promise(resolve => requestAnimationFrame(resolve));
            return { before, outgoingStillMounted, after: document.querySelector('[data-benchmark-id]')?.getAttribute('data-study-index') };
        });
        await page.screenshot({ path: `${out}/${kind}.png` }); report.cases.push({ kind, ...result });
        assert.equal(result.before, '1'); assert.equal(result.outgoingStillMounted, true, 'must exercise the actual outgoing control');
        assert.equal(result.after, '1', 'outgoing feedback must not skip an unanswered problem');
        await page.keyboard.type('5');
        await page.waitForFunction(() => document.querySelector('[data-study-index="2"][data-feedback="none"]'));
        await context.close();
    }
    report.pass = true;
} catch (error) { report.error = error.stack; throw error; }
finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
