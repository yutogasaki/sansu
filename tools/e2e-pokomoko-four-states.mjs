import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

// Real written-input UI and saved answers in a disposable profile, no injected
// combo or animation clock. This is visual evidence, not a throughput benchmark.
const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_FOUR_STATES_OUTPUT || `output/playwright/pokomoko-four-states-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, evidence: 'Real UI, disposable profile, actual generated written problems; no fixed 27+35 fixture or independent observer.', runs: [] };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const page = await browser.newPage({ viewport, hasTouch: true });
        const row = { viewport, captures: [] }; report.runs.push(row);
        const capture = async label => {
            const file = `${viewport.width}-${label}.png`;
            await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
            row.captures.push({ file, ...await runtimeMetadata(page) });
        };
        await page.goto(`${base}/#/island`);
        await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
        const id = await seedLearningProfile(page, { skill: 'add_2d1d_hissan_c', type: 'hissan' });
        await page.reload();
        await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('[data-input-ready=true]').waitFor();
        await page.waitForFunction(() => document.querySelector('.pokomoko-learning-actor')?.dataset.renderer === 'live-original');
        await page.evaluate(() => document.fonts.ready);
        await capture('ready');
        const digit = await page.evaluate(async () => {
            const { db } = await import('/src/db/index.ts');
            const id = localStorage.getItem('sansu_active_profile');
            const plans = await db.islandPlans.where('profileId').equals(id).toArray();
            const plan = plans.find(p => p.status === 'active');
            const { parkHissanGrid } = await import('/src/domain/park/learning.ts');
            const { writtenInputOrder } = await import('/src/domain/math/writtenInput.ts');
            const grid = parkHissanGrid(plan.slots[plan.cursor].problem);
            const step = grid.steps[0];
            return String(step.correctValues[writtenInputOrder(step)[0]]);
        });
        await page.keyboard.type(digit);
        await page.waitForTimeout(170);
        assert(await page.locator('.pokomoko-handoff-trail').count());
        await capture('input');
        await page.getByRole('button', { name: 'こたえを けす', exact: true }).click();
        let saved = await readNative(page, id);
        for (let n = 0; (saved.island.learningParty?.streak ?? 0) < 5 && n < 24; n++) {
            saved = (await answerUI(page, saved.plan, { touch: true })).state;
            const streak = saved.island.learningParty.streak;
            if ([3, 5].includes(streak)) {
                await page.waitForTimeout(streak === 3 ? 300 : 350);
                await capture(`streak-${streak}`);
            }
        }
        assert.equal(saved.island.learningParty.streak, 5);
        await page.getByRole('button', { name: 'とじる', exact: true }).click();
        await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).waitFor();
        await capture('return');
        await page.close();
    }
} finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(out);
