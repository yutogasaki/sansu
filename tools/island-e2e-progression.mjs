import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { attempt } from './island-learning-checks.mjs';
import { answerUI, button, readNative, runtimeMetadata, seedDev, waitMode, waitReady } from './island-e2e-helpers.mjs';

/** All first-chapter growth is earned by normal answers. No island state fixture. */
export async function verifyIslandProgression(browser, base, capture, { production = false } = {}) {
    const answer = async (page, state) => production ? (await attempt(page, state)).after : (await answerUI(page, state.plan)).state;
    const results = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const milestones = [], errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const prefix = viewport.width === 390 ? 'growth-phone' : 'growth-tablet';
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding');
            let profileId;
            if (production) {
                await waitReady(page); await button(page, 'まなぶ').click();
                await button(page, '年中').click(); await button(page, 'さんすう').click();
                await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
                await waitReady(page); await waitMode(page, 'learning');
                profileId = (await readNative(page)).island.profileId;
                await button(page, 'しまへ').click(); await waitMode(page, 'home');
            } else {
                profileId = await seedDev(page);
                await page.goto(`${base}/#/island`); await waitReady(page);
            }
            await capture(page, `${prefix}-initial`);
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            let state = await readNative(page, profileId);
            const initialMemory = state.island.growth.memories[0];
            for (let sequence = 1; sequence <= 24; sequence++) {
                const reservationId = state.plan.id, previousItems = state.island.items;
                let attempts = 0;
                while (state.plan?.id === reservationId) {
                    assert(++attempts < 70);
                    state = await answer(page, state);
                }
                assert.equal(state.island.completedSets, sequence);
                assert.equal(state.island.pendingRewards.length, 0);
                assert.equal(state.plan?.id, JSON.stringify(['island-plan-v1', profileId, sequence]));
                assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
                await waitMode(page, 'learning');
                for (const old of previousItems) {
                    const current = state.island.items.find(item => item.id === old.id);
                    assert(current); assert.deepEqual(current.position, old.position); assert.equal(current.rotation, old.rotation);
                }
                assert.deepEqual(state.island.growth.memories[0], initialMemory, 'Historical snapshot never changes during later growth');
                if ([1, 2, 3, 6, 12, 18, 24].includes(sequence)) {
                    await button(page, 'しまへ').click(); await waitMode(page, 'home');
                    await capture(page, `${prefix}-${sequence}-sections`);
                    const stage = page.locator('[data-renderer="three"]');
                    assert.equal(await stage.getAttribute('data-expanded'), String(sequence >= 2));
                    assert.equal(await stage.getAttribute('data-west-expanded'), String(sequence >= 12));
                    milestones.push({ completedSets: sequence, progress: state.island.growth.progress,
                        itemCount: state.island.items.length, ...(await runtimeMetadata(page)) });
                    if (sequence !== 24) {
                        await page.locator('.island-start').click(); await waitMode(page, 'learning');
                        state = await readNative(page, profileId);
                    }
                }
            }
            assert.deepEqual(state.island.growth.progress, { garden: 6, waterside: 6, grove: 6, village: 6 });
            assert.equal(state.island.items.length, 7, 'Finite authored places replace endless item accumulation');
            assert(state.island.items.every(item => item.growthLevel === 3 && item.position));
            const beforeVisit = state;
            // Observe an actual autonomous arrival, not an unlock-time journal insertion.
            const discoveryDeadline = Date.now() + 60000;
            do {
                state = await readNative(page, profileId);
                if (state.island.growth.discoveries.length) break;
                assert(Date.now() < discoveryDeadline, 'An actual autonomous arrival is observed within one minute');
                await page.waitForTimeout(150);
            } while (true);
            assert.deepEqual(state.plan, beforeVisit.plan); assert.deepEqual(state.logs, beforeVisit.logs);
            assert.deepEqual(state.island.growth.progress, beforeVisit.island.growth.progress);
            await capture(page, `${prefix}-autonomous-life`);
            for (const name of ['ひがし', 'にし', 'にわ', 'しまぜんぶ']) {
                await button(page, name).click();
                await capture(page, `${prefix}-district-${name}`);
            }
            state = await readNative(page, profileId);
            assert(state.island.growth.discoveries.length > 0, 'District viewing preserves observed facts');
            await page.locator(`.island-page[data-discovery-count="${state.island.growth.discoveries.length}"]`).waitFor();
            await button(page, 'アルバム').click(); await waitMode(page, 'album');
            await page.locator('[data-memory-id] [data-renderer="three"]').waitFor();
            await page.locator('[data-memory-current] [data-renderer="three"]').waitFor();
            assert.equal(await page.locator('[data-renderer="three"]').count(), 2);
            assert.equal(await page.locator('[data-memory-id]').getAttribute('data-memory-completed-sets'), '0');
            assert.equal(await page.locator('[data-memory-id] [data-renderer="three"]').getAttribute('data-expanded'), 'false');
            assert.equal(await page.locator('[data-memory-current] [data-renderer="three"]').getAttribute('data-west-expanded'), 'true');
            const compare = async habitat => {
                await page.waitForFunction(habitat => {
                    const stages = [...document.querySelectorAll('.island-album-compare [data-renderer="three"]')];
                    return stages.length === 2 && stages.every(stage => stage.dataset.comparisonHabitat === habitat && stage.dataset.cameraFrame)
                        && stages[0].dataset.cameraFrame === stages[1].dataset.cameraFrame;
                }, habitat);
                const bounds = await page.locator('.island-album-compare canvas').evaluateAll(canvases => canvases.map(canvas => {
                    const r = canvas.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
                }));
                assert(bounds.every(r => r.top >= 0 && r.bottom <= viewport.height + 1 && r.left >= 0 && r.right <= viewport.width + 1),
                    `Both equal-scale actual scenes fit the viewport: ${JSON.stringify(bounds)}`);
            };
            await compare('garden');
            await capture(page, `${prefix}-album-before-after`);
            for (const [habitat, label] of [['waterside', 'みずべ'], ['grove', '木かげ'], ['village', 'いえ'], ['all', 'しまぜんぶ']]) {
                await page.getByRole('group', { name: 'みくらべる ばしょ' }).getByRole('button', { name: label, exact: true }).click();
                await compare(habitat); await capture(page, `${prefix}-album-${habitat}`);
            }
            await button(page, 'みつけた くらし').click();
            const discovered = page.locator('[data-discovery-id]').first();
            const discoveryId = await discovered.getAttribute('data-discovery-id');
            await capture(page, `${prefix}-discovery-album`);
            await discovered.getByRole('button', { name: 'ためす', exact: true }).click(); await waitMode(page, 'play');
            await page.waitForFunction(id => {
                const stage = document.querySelector('[data-renderer="three"]');
                const life = JSON.parse(stage?.getAttribute('data-living-activity') || 'null');
                return life?.discoveryId === id && life.arrivedAt > 0;
            }, discoveryId, { timeout: 60000 });
            await capture(page, `${prefix}-discovery-replay`);
            await button(page, 'あそびを とじる').click(); await waitMode(page, 'home');
            const matured = (await readNative(page, profileId)).island;
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            state = await readNative(page, profileId);
            const planId = state.plan.id;
            while (state.plan?.id === planId) state = await answer(page, state);
            assert.equal(state.island.completedSets, 25);
            assert.deepEqual(state.island.items, matured.items);
            assert.deepEqual(state.island.growth.progress, matured.growth.progress);
            assert.deepEqual(state.island.growth.memories, matured.growth.memories);
            assert.equal(state.island.pendingRewards.length, 0);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            const resumed = await readNative(page, profileId);
            assert.deepEqual(resumed.plan, state.plan); assert.deepEqual(resumed.island, state.island);
            // Optional customization is checked after maturity, so it cannot
            // supply the placements or growth the normal loop just proved.
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, 'もちもの').click(); await waitMode(page, 'inventory');
            await page.getByRole('button', { name: /^ひかる おはな \d+を うごかす$/ }).click();
            await waitMode(page, 'placement');
            await button(page, 'はじめの すがた').click();
            await page.locator('.island-appearance button[aria-pressed="true"]').filter({ hasText: 'はじめの すがた' }).waitFor();
            await button(page, 'ひだりへ').click(); await button(page, 'まわす').click();
            await capture(page, `${prefix}-customize-old-appearance`);
            await button(page, 'ここに おく').click(); await waitMode(page, 'home');
            const edited = await readNative(page, profileId), flower = edited.island.items.find(item => item.id === 'starter-flower');
            assert.deepEqual(flower.position, { x: 1.25, z: .8 }); assert.equal(flower.rotation, Math.PI / 2);
            assert.equal(flower.appearanceLevel, 0); assert.equal(flower.growthLevel, 3);
            assert.deepEqual(edited.island.growth.memories, state.island.growth.memories);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            assert.deepEqual((await readNative(page, profileId)).island.items, edited.island.items);
            await capture(page, `${prefix}-customized-learning-resumed`);
            assert.deepEqual(errors, []);
            results.push({ viewport, milestones, discoveries: state.island.growth.discoveries, passed: true });
            console.log(`PASS ${prefix}: 25 real UI sections, all four mature habitats, stable7items, autonomous discovery, 3D history and replay`);
        } catch (error) {
            await capture(page, `${prefix}-failure`).catch(() => undefined);
            await writeFile(`${process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island'}/${prefix}-failure-state.json`, JSON.stringify(await readNative(page).catch(() => null), null, 2));
            throw error;
        } finally { await context.close(); }
    }
    return { name: 'east-and-growth', passed: true, results,
        evidenceScope: 'Phone/tablet normal planner and 25 UI sections. Full finite growth, stable items, observed life, districts, immutable production-rendered history, discovery replay and resumed learning.' };
}
