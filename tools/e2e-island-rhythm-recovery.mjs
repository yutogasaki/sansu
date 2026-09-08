import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { answerUI, assertIslandSectionGrowth, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const output = process.env.SANSU_ISLAND_RHYTHM_RECOVERY_OUTPUT;
assert(target && output, 'Set an immutable production URL and a fresh recovery output directory');
await fs.mkdir(output, { recursive: true });
await assert.rejects(fs.readFile(`${output}/report.json`), { code: 'ENOENT' });
const report = { target, pass: false, scenarios: [], captures: [], humanN: 0,
    scope: 'Explicit disposable native profiles and one-shot native IndexedDB transaction aborts. Real production UI and answer receipts; diagnostic fault recovery, not ordinary latency or child observation.' };
const browser = await chromium.launch();
async function submitFinalAndAbortNext(page, plan) {
    const slot = plan.slots[plan.cursor];
    let submit;
    if (slot.problem.inputType === 'number') {
        await page.locator('.park-input').first().click();
        await page.keyboard.type(String(slot.problem.correctAnswer));
        submit = () => page.keyboard.press('Enter');
    } else {
        assert.equal(slot.problem.inputType, 'choice', 'The real introductory curriculum uses numeric or choice answers');
        const choice = slot.problem.inputConfig.choices.find(choice => choice.value === slot.problem.correctAnswer);
        assert(choice, 'Use the exact correct value and label from the real reserved Problem');
        submit = () => page.locator('.park-choices').getByRole('button', { name: choice.label, exact: true }).click();
    }
    await page.evaluate(() => { window.__abortNextIslandReservation = true; });
    await submit();
    await page.locator('.island-learning-retry').waitFor();
    return readNative(page, plan.profileId);
}
try {
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 768, 1024]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone',
            reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const row = { name, errors, pass: false };
        report.scenarios.push(row);
        const capture = async stage => {
            const file = `${name}-${stage}.png`;
            await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
            report.captures.push({ file, ...await runtimeMetadata(page) });
        };
        try {
            await page.addInitScript(() => {
                window.__reservationAborts = [];
                const add = IDBObjectStore.prototype.add;
                IDBObjectStore.prototype.add = function (value, ...args) {
                    const request = add.call(this, value, ...args);
                    if (this.name === 'islandPlans' && window.__abortNextIslandReservation) {
                        window.__abortNextIslandReservation = false;
                        window.__reservationAborts.push({ planId: value.id, cursor: value.cursor, revision: value.revision });
                        this.transaction.abort();
                    }
                    return request;
                };
            });
            await page.goto(`${target}/#/`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && manifest.island.learningCandidate === 'mystic-island-learning-v2');
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const id = await seedNative(page, `rhythm-abort-${name}`);
            await page.evaluate(() => { window.__abortNextIslandReservation = true; });
            await page.goto(`${target}/#/island?start=learn&profile=${id}`);
            await page.locator('.island-learning-retry').waitFor(); await waitReady(page);
            const failedStart = await readNative(page, id);
            assert.equal(failedStart.island.completedSets, 0); assert.equal(failedStart.island.pendingPlanId, undefined);
            assert.equal(failedStart.islandPlans.length, 0); assert.equal(failedStart.islandEvents.length, 0);
            assert.equal(failedStart.logs.length, 0); assert.equal(await page.locator('.park-answer').count(), 0);
            assert.deepEqual(failedStart.island.growth.progress, { garden: 0, waterside: 0, grove: 0, village: 0 });
            assert.equal(failedStart.island.growth.memories.length, 1); assert.equal(failedStart.island.items.length, 2);
            assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('start'), 'learn');
            await capture('initial-reservation-aborted');
            await button(page, 'つづきの もんだいを ひらく').click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            assert.equal(new URL(page.url()).hash, '#/island');
            let state = await readNative(page, id);
            assert.equal(state.plan.slots.length, 3); assert.equal(state.islandPlans.length, 1);
            assert.equal(state.plan.cursor, 0); assert.equal(state.logs.length, 0);
            const firstId = state.plan.id;
            for (let count = 0; count < 12 && state.plan.cursor < state.plan.slots.length - 1; count += 1) {
                state = (await answerUI(page, state.plan, { dev: false })).state;
            }
            const firstBefore = state;
            assert.equal(firstBefore.plan.id, firstId); assert.equal(firstBefore.plan.cursor, 2);
            assert.equal(firstBefore.plan.growthTarget, 'garden');
            const firstFailedNext = await submitFinalAndAbortNext(page, firstBefore.plan);
            const firstCompleted = firstFailedNext.islandPlans.find(plan => plan.id === firstId);
            assert.equal(firstCompleted.status, 'completed'); assert.equal(firstCompleted.cursor, 3);
            assert.equal(firstCompleted.revision, firstBefore.plan.revision + 1);
            assert.deepEqual(firstCompleted.slots.map(slot => slot.problem), firstBefore.plan.slots.map(slot => slot.problem));
            assert.equal(firstFailedNext.island.completedSets, 1); assert.equal(firstFailedNext.plan, undefined);
            assert.equal(firstFailedNext.island.pendingPlanId, undefined); assert.equal(firstFailedNext.islandPlans.length, 1);
            assertIslandSectionGrowth(firstBefore, firstFailedNext, firstBefore.plan);
            assert.equal(firstFailedNext.island.items.length, 3);
            assert(firstFailedNext.island.items.some(item => item.id === 'living-bench' && item.position));
            assert.equal(firstFailedNext.island.growth.memories.length, 1);
            assert.deepEqual(firstFailedNext.island.growth.memories[0], firstBefore.island.growth.memories[0]);
            assert.equal(firstFailedNext.island.growth.progress.garden, 1, 'Small growth survives without adding a major album record');
            assert.equal(firstFailedNext.logs.length, firstBefore.logs.length + 1);
            const firstAnswer = firstFailedNext.islandEvents.filter(event => event.type === 'answer'
                && !firstBefore.islandEvents.some(old => old.id === event.id));
            const firstLogs = firstFailedNext.logs.filter(log => !firstBefore.logs.some(old => old.id === log.id));
            assert.equal(firstAnswer.length, 1); assert.equal(firstLogs.length, 1);
            assert.equal(firstAnswer[0].result, 'correct'); assert.equal(firstAnswer[0].slotIndex, 2);
            assert.equal(firstAnswer[0].learningLogId, firstLogs[0].id);
            const firstCompletion = firstFailedNext.islandEvents.filter(event => event.type === 'plan_completed');
            assert.equal(firstCompletion.length, 1); assert.equal(firstCompletion[0].habitatId, 'garden');
            assert.equal(firstCompletion[0].rewardId, undefined);
            assert.equal(await page.locator('.park-answer').count(), 0);
            await waitMode(page, 'learning'); await capture('first-growth-next-reservation-aborted');
            await button(page, 'つづきの もんだいを ひらく').click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            state = await readNative(page, id);
            const firstRecovered = state;
            assert.equal(state.plan.id, JSON.stringify(['island-plan-v1', id, 1]));
            assert.equal(state.plan.growthTarget, 'garden'); assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
            assert.equal(state.islandPlans.length, 2); assert.equal(state.island.completedSets, 1);
            assert.deepEqual(state.island.growth, firstFailedNext.island.growth);
            assert.deepEqual(state.island.items, firstFailedNext.island.items);
            assert.deepEqual(state.island.pendingRewards, firstFailedNext.island.pendingRewards);
            assert.deepEqual(state.logs, firstFailedNext.logs); assert.deepEqual(state.memoryMath, firstFailedNext.memoryMath);
            assert.deepEqual(state.islandPlans.find(plan => plan.id === firstId), firstCompleted);
            for (const event of firstFailedNext.islandEvents) assert.deepEqual(state.islandEvents.find(row => row.id === event.id), event);
            const firstRetryEvents = state.islandEvents.filter(event => !firstFailedNext.islandEvents.some(old => old.id === event.id));
            assert.equal(firstRetryEvents.length, 1); assert.equal(firstRetryEvents[0].type, 'plan_started');
            assert.equal(firstRetryEvents[0].planId, state.plan.id);
            await capture('first-growth-next-reservation-retried');
            row.firstBoundary = { before: firstBefore, failed: firstFailedNext, recovered: firstRecovered };
            const normalId = state.plan.id;
            for (let count = 0; count < 12 && state.plan.cursor < state.plan.slots.length - 1; count += 1) {
                state = (await answerUI(page, state.plan, { dev: false })).state;
            }
            const before = state;
            assert.equal(before.plan.id, normalId); assert.equal(before.plan.cursor, before.plan.slots.length - 1);
            const finalSlot = before.plan.slots[before.plan.cursor];
            const failedNext = await submitFinalAndAbortNext(page, before.plan);
            const completed = failedNext.islandPlans.find(plan => plan.id === normalId);
            assert.equal(completed.status, 'completed'); assert.equal(completed.cursor, before.plan.slots.length);
            assert.equal(completed.revision, before.plan.revision + 1);
            assert.deepEqual(completed.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
            assert.equal(failedNext.logs.length, before.logs.length + 1);
            const answers = failedNext.islandEvents.filter(event => event.type === 'answer' && !before.islandEvents.some(old => old.id === event.id));
            const logs = failedNext.logs.filter(log => !before.logs.some(old => old.id === log.id));
            assert.equal(answers.length, 1); assert.equal(logs.length, 1);
            assert.equal(answers[0].id, JSON.stringify(['island-action-v1', id, normalId, before.plan.revision]));
            assert.equal(answers[0].result, 'correct'); assert.equal(answers[0].slotIndex, before.plan.cursor);
            assert.equal(answers[0].learningLogId, logs[0].id); assert.equal(logs[0].result, 'correct');
            assert.equal(logs[0].itemId, finalSlot.problem.categoryId);
            assert.equal(failedNext.island.completedSets, 2); assert.deepEqual(failedNext.island.pendingRewards, []);
            assertIslandSectionGrowth(before, failedNext);
            assert(failedNext.island.items.some(item => item.kind === 'bench' && item.position));
            assert.equal(failedNext.island.growth.expansionLevel, 0, 'Two sections do not mature a place or open the eastern land');
            assert.equal(failedNext.plan, undefined); assert.equal(failedNext.islandPlans.length, 2);
            assert.equal(failedNext.islandEvents.filter(event => event.type === 'plan_completed').length, 2);
            assert.equal(await page.locator('.park-answer').count(), 0, 'A saved final answer cannot be resubmitted from the failure screen');
            await capture('next-reservation-aborted');
            await button(page, 'つづきの もんだいを ひらく').click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            const recovered = await readNative(page, id);
            assert.equal(recovered.plan.id, JSON.stringify(['island-plan-v1', id, 2]));
            assert.equal(recovered.plan.cursor, 0); assert.equal(recovered.plan.revision, 0);
            assert.equal(recovered.islandPlans.length, 3);
            assert.deepEqual(recovered.logs, failedNext.logs);
            assert.deepEqual(recovered.memoryMath, failedNext.memoryMath);
            assert.deepEqual(recovered.island.pendingRewards, failedNext.island.pendingRewards);
            assert.deepEqual(recovered.island.growth, failedNext.island.growth);
            assert.deepEqual(recovered.island.items, failedNext.island.items);
            assert.equal(recovered.island.completedSets, failedNext.island.completedSets, 'Reservation retry never grows the island twice');
            assert.deepEqual(recovered.islandPlans.find(plan => plan.id === normalId), completed);
            for (const event of failedNext.islandEvents) assert.deepEqual(recovered.islandEvents.find(row => row.id === event.id), event);
            const starts = recovered.islandEvents.filter(event => !failedNext.islandEvents.some(old => old.id === event.id));
            assert.equal(starts.length, 1); assert.equal(starts[0].type, 'plan_started');
            assert.equal(starts[0].planId, recovered.plan.id);
            row.aborts = await page.evaluate(() => window.__reservationAborts);
            assert.deepEqual(row.aborts.map(row => row.planId), [firstId, firstRecovered.plan.id, recovered.plan.id]);
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await page.locator('.island-start').click(); await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            assert.deepEqual((await readNative(page, id)).plan, recovered.plan);
            await page.reload(); await waitReady(page); await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            const reloaded = await readNative(page, id);
            assert.deepEqual(reloaded.plan, recovered.plan); assert.deepEqual(reloaded.logs, recovered.logs);
            assert.deepEqual(reloaded.island.pendingRewards, recovered.island.pendingRewards);
            assert.deepEqual(reloaded.island.growth.progress, recovered.island.growth.progress);
            assert.deepEqual(reloaded.island.growth.memories, recovered.island.growth.memories);
            assert.deepEqual(reloaded.island.items, recovered.island.items);
            await capture('retry-and-reload');
            row.runtime = await runtimeMetadata(page); assert.equal(row.runtime.version, manifest.version);
            row.failedStart = failedStart; row.before = before; row.failedNext = failedNext; row.recovered = recovered;
            assert.deepEqual(errors, []); row.pass = true;
            console.log(`PASS ${name}: first-start abort, introductory and normal final-growth preservation, next-only retries and reload`);
        } catch (error) {
            row.error = error.stack;
            try {
                row.failureState = await readNative(page, `rhythm-abort-${name}`);
                row.failureUrl = page.url();
                await capture('failure');
            } catch (diagnosticError) { row.diagnosticError = diagnosticError.stack; }
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    await browser.close();
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
