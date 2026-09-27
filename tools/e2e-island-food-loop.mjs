import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { runtimeMetadata, seedDev } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5224';
const out = process.env.SANSU_FOOD_OUTPUT || 'output/playwright/island-food-loop';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, fixture: 'DEV profile and learning facts seeded through the Life writer; no child observation',
    candidate: 'island-food-loop-v1', scenarios: [], pass: false };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        const errors = [];
        const captures = [];
        page.on('pageerror', error => errors.push(error.message));
        const capture = async file => {
            const metadata = await runtimeMetadata(page);
            const foodCandidate = await page.locator('.island-life').getAttribute('data-life-food-candidate');
            assert.equal(foodCandidate, report.candidate);
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            captures.push({ file, foodCandidate, ...metadata });
        };
        await page.goto(base);
        await page.locator('.island-welcome').waitFor();
        const id = await seedDev(page, { familiar: false });
        const seeded = await page.evaluate(async profileId => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { HOUR } = await import('/src/domain/islandLife/model.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            assertPreview();
            function assertPreview() { if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV fixture only'); }
            const first = Date.now() - 8 * HOUR;
            let record = await updateLife(profileId, [], undefined, first, lifeDb);
            const facts = Array.from({ length: 8 }, (_, i) => ({ id: `food-lesson-${i}`, at: first + 1 }));
            record = await updateLife(profileId, facts, undefined, first + 2, lifeDb);
            record = await updateLife(profileId, [], { id: 'food-herbs', revision: record.revision,
                command: { type: 'buy', kind: 'planter', cell: { x: 0, z: 3 } } }, first + 3, lifeDb);
            record = await updateLife(profileId, [], { id: 'food-table', revision: record.revision,
                command: { type: 'buy', kind: 'picnic-table', cell: { x: 4, z: 3 } } }, first + 4, lifeDb);
            record = await updateLife(profileId, [], undefined, Date.now(), lifeDb);
            let state = replayLife(record);
            const collect = state.residents.find(r => r.foodTrip?.phase === 'collect');
            if (!collect?.visit) throw new Error('No real collection path');
            record = await updateLife(profileId, [], undefined, record.realAt + collect.visit.end - state.now + 100, lifeDb);
            state = replayLife(record);
            if (!state.residents.some(r => r.foodTrip?.phase === 'carry')) throw new Error('Pickup did not enter carrying phase');
            const { pathToActivity } = await import('/src/domain/islandLife/space.ts');
            const source = state.items.find(item => item.id === 'food-herbs');
            const table = state.items.find(item => item.id === 'food-table');
            return { cutover: record.foodCutover, food: state.food,
                debug: { placementVersion: state.placementVersion, residents: state.residents.map(r => ({ id: r.id, cell: r.cell, visit: r.visit?.itemId, foodTrip: r.foodTrip?.phase })),
                    sourcePaths: state.residents.map(r => pathToActivity(state, r.cell, source)?.length ?? 0),
                    tableFromSource: pathToActivity(state, { x: 0, z: 4 }, table)?.length ?? 0 } };
        }, id);
        assert(seeded.cutover && seeded.food.harvested > 0, 'Same island harvests under the current clock');
        await page.reload();
        await page.locator('.life-world[data-rendered="true"]').waitFor();
        const island = page.locator('.island-life');
        assert.equal(await island.getAttribute('data-life-food-candidate'), report.candidate);
        await page.waitForFunction(() => JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses ?? '[]').some(pose => pose.foodCargo));
        const carryingFile = `${viewport.width}-carrying.png`;
        await capture(carryingFile);
        const delivery = await page.evaluate(async profileId => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            const current = await lifeDb.worlds.get(profileId);
            const state = replayLife(current);
            const carrier = state.residents.find(r => r.foodTrip?.phase === 'carry');
            if (!carrier?.visit && state.food?.delivered) return state.food;
            if (!carrier?.visit) throw new Error('Cargo was lost before delivery');
            const next = await updateLife(profileId, [], undefined, current.realAt + carrier.visit.end - current.now + 100, lifeDb);
            return replayLife(next).food;
        }, id);
        assert(delivery.delivered > 0, 'The actual carried unit reaches the table');
        await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
        const deliveredFile = `${viewport.width}-delivered.png`;
        await capture(deliveredFile);
        const meal = await page.evaluate(async profileId => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { HOUR } = await import('/src/domain/islandLife/model.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            const current = await lifeDb.worlds.get(profileId);
            const next = await updateLife(profileId, [], undefined, current.realAt + HOUR, lifeDb);
            const state = replayLife(next);
            const { pathToActivity, homeCell } = await import('/src/domain/islandLife/space.ts');
            return { food: state.food, residents: state.residents.map(r => ({ id: r.id, cell: r.cell, visit: r.visit?.itemId, foodTrip: r.foodTrip?.phase })),
                tablePathFromHome: pathToActivity(state, homeCell, state.items.find(i => i.id === 'food-table'))?.length ?? 0 };
        }, id);
        assert(meal.food.eaten > 0, `A normal resident table visit consumes one delivered unit: ${JSON.stringify(meal)}`);
        await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
        await page.getByRole('button', { name: 'しまの ようす' }).click();
        await page.getByRole('dialog', { name: 'みんなの ようす' }).waitFor();
        const summary = await page.getByRole('region', { name: 'たべものの くらし' }).innerText();
        assert(summary.includes('うえ木ばち') && summary.includes('テーブル'));
        const file = `${viewport.width}-food-summary.png`;
        await capture(file);
        const before = await page.evaluate(async profileId => {
            const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            return replayLife(await lifeDb.worlds.get(profileId)).food;
        }, id);
        await page.reload();
        await page.locator('.life-world[data-rendered="true"]').waitFor();
        const after = await page.evaluate(async profileId => {
            const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            return replayLife(await lifeDb.worlds.get(profileId)).food;
        }, id);
        assert(after.harvested >= before.harvested && after.delivered >= before.delivered && after.eaten >= before.eaten);
        assert.deepEqual(errors, []);
        report.scenarios.push({ viewport, captures, seeded: seeded.food, delivery, meal, debug: seeded.debug, before, after, errors, pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
