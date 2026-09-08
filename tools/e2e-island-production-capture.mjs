import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { activate, answerUI, assertKeypad, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island-production';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, flag: 'VITE_ISLAND_ENABLED=true', startedAt: new Date().toISOString(),
    evidenceScope: 'Immutable production critical path at two viewports. Native profile fixture only; every completed set, reward claim and placement is earned or performed through the actual UI.',
    scenarios: [], captures: [], pass: false };

async function capture(page, name, manifest, state) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Number(document.querySelector('[data-renderer="three"]')?.getAttribute('data-draw-calls')) > 0);
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.version, manifest.version, 'Every screenshot must identify the exact manifest build');
    assert.equal(metadata.revision, manifest.revision);
    assert.equal(metadata.delivery, manifest.island.delivery);
    assert.equal(metadata.candidate, manifest.island.candidate);
    assert.equal(metadata.artDirection, manifest.island.artDirection);
    if (name.endsWith('-welcome')) assert.equal(metadata.learningCandidate, 'not-applicable');
    else {
        assert.equal(metadata.learningCandidate, 'mystic-island-learning-v2');
        assert.equal(metadata.learningCandidate, manifest.island.learningCandidate);
    }
    assert.equal(metadata.renderer, 'three');
    const file = `${name}.png`;
    const buffer = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: createHash('sha256').update(buffer).digest('hex'), ...metadata,
        completedSets: state?.island.completedSets ?? 0, learningLogs: state?.logs.length ?? 0 });
}

try {
    for (const scenario of [
        { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
        { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
    ]) {
        const context = await browser.newContext({ viewport: scenario.viewport, hasTouch: scenario.touch,
            serviceWorkers: 'block', reducedMotion: 'no-preference' });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert.equal(manifest.island.enabled, true);
            assert(!manifest.revision.includes('development'), 'Visual release evidence requires a production build');
            if (report.manifest) assert.deepEqual(manifest, report.manifest, 'Both viewports must use one immutable build');
            else report.manifest = manifest;
            await capture(page, `${scenario.name}-welcome`, manifest);
            const profileId = await seedNative(page, `island-production-art-${scenario.name}`);
            await page.goto(`${base}/#/`);
            await waitReady(page);
            await waitMode(page, 'home');
            let state = await readNative(page, profileId);
            assert.equal(state.island.completedSets, 0);
            assert.equal(state.logs.length, 0);
            await capture(page, `${scenario.name}-home`, manifest, state);
            await activate(page.locator('.island-start'), scenario.touch);
            await waitMode(page, 'learning');
            await assertKeypad(page);
            state = await readNative(page, profileId);
            const reservedPlan = state.plan;
            assert(reservedPlan);
            assert.equal(reservedPlan.id, JSON.stringify(['island-plan-v1', profileId, 0]));
            assert.equal(reservedPlan.slots.length, 3);
            await capture(page, `${scenario.name}-learning`, manifest, state);
            const samples = [];
            while (state.plan?.id === reservedPlan.id) {
                assert(samples.length < 24, 'The first real learning section must terminate');
                const { state: next, ...sample } = await answerUI(page, state.plan, { dev: false, touch: scenario.touch });
                state = next;
                samples.push(sample);
                if (samples.length === 1) await capture(page, `${scenario.name}-answer-light`, manifest, state);
            }
            await waitMode(page, 'reward');
            assert.equal(state.island.completedSets, 1);
            assert.equal(state.island.pendingRewards.length, 1);
            assert.equal(state.islandEvents.filter(event => event.type === 'plan_completed').length, 1);
            assert.equal(state.logs.length, reservedPlan.slots.length);
            await capture(page, `${scenario.name}-reward`, manifest, state);
            const rewardId = state.island.pendingRewards[0].id;
            await activate(button(page, 'ベンチ'), scenario.touch);
            await waitMode(page, 'placement');
            state = await readNative(page, profileId);
            const claimed = state.island.items.find(item => item.id === `${rewardId}:item`);
            assert.equal(claimed?.kind, 'bench');
            assert.equal(state.island.pendingRewards.length, 0);
            await capture(page, `${scenario.name}-placement`, manifest, state);
            await activate(button(page, 'まわす'), scenario.touch);
            await activate(button(page, 'ここに おく'), scenario.touch);
            await waitMode(page, 'home');
            state = await readNative(page, profileId);
            const placed = state.island.items.find(item => item.id === claimed.id);
            assert(placed.position);
            assert.equal(placed.rotation, Math.PI / 2);
            await page.waitForFunction(id => {
                const stage = document.querySelector('[data-renderer="three"]');
                return stage?.getAttribute('data-resident-item-id') === id && stage.getAttribute('data-resident-action') === 'sit';
            }, claimed.id);
            await capture(page, `${scenario.name}-animal-use`, manifest, state);
            await page.reload();
            await waitReady(page);
            assert.deepEqual((await readNative(page, profileId)).island.items.find(item => item.id === claimed.id), placed);
            await activate(page.locator('.island-start'), scenario.touch);
            await waitMode(page, 'learning');
            state = await readNative(page, profileId);
            assert(state.plan && state.plan.id !== reservedPlan.id);
            assert.equal(state.island.completedSets, 1);
            await capture(page, `${scenario.name}-next-learning`, manifest, state);
            assert.deepEqual(pageErrors, []);
            report.scenarios.push({ ...scenario, completedSets: 1, answeredThroughUI: samples.length,
                rewardClaimedThroughUI: true, placedThroughUI: true, animalActuallyUsedItem: true,
                savedPlacementSurvivedReload: true, nextLearningReady: true, soundEnabled: false, samples, pass: true });
            console.log(`PASS immutable production ${scenario.name}: welcome, home, learning, earned reward, placement, actual animal use, next learning`);
        } catch (error) {
            await page.screenshot({ path: `${out}/${scenario.name}-failure.png`, animations: 'disabled' }).catch(() => undefined);
            report.scenarios.push({ ...scenario, pass: false, error: error.stack, pageErrors });
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/production-capture-report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
