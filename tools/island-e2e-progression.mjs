import assert from 'node:assert/strict';
import { answerUI, button, readNative, runtimeMetadata, seedDev, waitMode, waitReady } from './island-e2e-helpers.mjs';

/** Focused acceptance: every growth milestone is earned through the actual answering UI. */
export async function verifyIslandProgression(browser, base, capture) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const milestones = [];
    let trace;
    try {
        await page.goto(`${base}/#/island`);
        await page.waitForURL('**/#/onboarding');
        const profileId = await seedDev(page);
        await page.goto(`${base}/#/island`);
        await waitReady(page);
        for (let sequence = 1; sequence <= 6; sequence++) {
            const home = await page.locator('.island-page[data-mode="home"]').count();
            await button(page, home ? 'ひかりを とどける' : 'つづけて とく').click();
            await waitMode(page, 'learning');
            let state = await readNative(page, profileId);
            let attempts = 0;
            while (state.plan) {
                assert(++attempts < 70);
                state = (await answerUI(page, state.plan)).state;
            }
            await waitMode(page, 'reward');
            assert.equal(state.island.completedSets, sequence);
            if (sequence === 2) {
                await page.locator('[data-renderer="three"][data-expanded="true"]').waitFor();
                await button(page, 'ベンチ').click();
                await waitMode(page, 'placement');
                state = await readNative(page, profileId);
                const bench = state.island.items.find(item => item.kind === 'bench');
                const suggestion = await page.evaluate(async ({ island, id }) => {
                    const { findAvailablePosition } = await import('/src/domain/island/catalog.ts');
                    return findAvailablePosition(island, 'bench', id);
                }, { island: state.island, id: bench.id });
                assert(suggestion);
                const target = { x: 6.25, z: 1 };
                for (const [axis, positive, negative] of [['x', 'みぎへ', 'ひだりへ'], ['z', 'てまえへ', 'おくへ']]) {
                    const steps = Math.round((target[axis] - suggestion[axis]) / .25);
                    await button(page, steps >= 0 ? positive : negative).focus();
                    for (let i = 0; i < Math.abs(steps); i++) await page.keyboard.press('Enter');
                }
                await page.evaluate(itemId => {
                    const trace = { samples: [], done: false };
                    window.__islandEastTrace = trace;
                    const sample = () => {
                        const stage = document.querySelector('[data-renderer="three"]');
                        if (stage?.getAttribute('data-resident-item-id') === itemId) {
                            const frame = { time: performance.now(), x: Number(stage.getAttribute('data-resident-x')),
                                y: Number(stage.getAttribute('data-resident-y')), z: Number(stage.getAttribute('data-resident-z')),
                                action: stage.getAttribute('data-resident-action') };
                            trace.samples.push(frame);
                            if (frame.action === 'sit') { trace.done = true; return; }
                        }
                        requestAnimationFrame(sample);
                    };
                    requestAnimationFrame(sample);
                }, bench.id);
                const crossing = page.waitForFunction(() => {
                    const stage = document.querySelector('[data-renderer="three"]');
                    const x = Number(stage?.getAttribute('data-resident-x'));
                    return stage?.getAttribute('data-resident-action') === 'walk' && x > 4.4 && x < 5.15;
                }, undefined, { timeout: 15000 });
                await button(page, 'ここに おく').click();
                await crossing;
                await capture(page, 'east-bridge-walk');
                await page.waitForFunction(() => window.__islandEastTrace?.done, undefined, { timeout: 15000 });
                trace = await page.evaluate(() => window.__islandEastTrace.samples);
                assert(trace.length >= 10, 'Observe the live crossing rather than only its destination');
                const bridge = trace.filter(point => point.x > 4.4 && point.x < 5.15);
                assert(bridge.length > 0, 'Resident traverses the bridge');
                for (const point of trace) {
                    const main = (point.x / 4.38) ** 2 + (point.z / 3.18) ** 2 <= 1.002;
                    const east = ((point.x - 6.2) / 1.48) ** 2 + (point.z / 1.88) ** 2 <= 1.002;
                    const deck = point.x >= 4.05 && point.x <= 5.5 && Math.abs(point.z) <= .095;
                    assert(main || east || deck, `Live resident left land/deck: ${JSON.stringify(point)}`);
                    for (const obstacle of [{ x: -2.6, z: -1.65, radius: 1.15 }, { x: 1.6, z: -1.6, radius: .85 }, { x: 6.35, z: -1.16, radius: .7 }]) {
                        assert(Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .415,
                            `Live resident crossed a reserved structure: ${JSON.stringify(point)}`);
                    }
                }
                for (const point of bridge) {
                    assert(Math.abs(point.z) <= .095);
                    assert(point.y >= .18, 'Resident feet follow the raised bridge deck');
                }
                const saved = (await readNative(page, profileId)).island.items.find(item => item.id === bench.id);
                assert.deepEqual(saved.position, target);
                await capture(page, 'east-bench-used');
                milestones.push({ completedSets: 2, ...(await runtimeMetadata(page)), walkSamples: trace.length });
                console.log(`PASS east bench: ${trace.length} live path samples stayed on land/bridge`);
            }
            if (sequence === 4 || sequence === 6) {
                await page.locator('[data-renderer="three"][data-residents="3"]').waitFor();
                if (sequence === 6) await page.locator('[data-renderer="three"][data-lighthouse="true"]').waitFor();
                await capture(page, `progression-${sequence}-sets`);
                milestones.push({ completedSets: sequence, ...(await runtimeMetadata(page)),
                    residents: await page.locator('[data-renderer="three"]').getAttribute('data-residents'),
                    lighthouse: await page.locator('[data-renderer="three"]').getAttribute('data-lighthouse') });
                console.log(`PASS actual UI learning reaches ${sequence} completed sets and visible growth`);
            }
        }
        return { name: 'east-and-growth', passed: true, milestones, trace,
            evidenceScope: 'Six sections completed through actual learning UI; claimed bench moved with keyboard; live eastern crossing, third resident and lighthouse observed.' };
    } finally { await context.close(); }
}
