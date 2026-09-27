import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { runtimeMetadata, seedDev } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5224';
const out = process.env.SANSU_WATER_OUTPUT || 'output/playwright/island-water-channel';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, fixture: 'DEV profile and lesson credits through Life writer; no child observation',
    candidate: 'island-water-channel-v1', scenarios: [], pass: false };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(30000);
        await page.goto(base);
        await page.locator('.island-welcome').waitFor();
        const id = await seedDev(page, { familiar: false });
        const setup = await page.evaluate(async profileId => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            const { foodGrowthConditions } = await import('/src/domain/islandLife/foodLoop.ts');
            if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV fixture only');
            const start = Date.now() - 3600_000;
            let record = await updateLife(profileId, [], undefined, start, lifeDb);
            record = await updateLife(profileId, Array.from({ length: 9 }, (_, i) =>
                ({ id: `water-lesson-${i}`, at: start + 1 })), undefined, start + 2, lifeDb);
            for (const [id, kind, x] of [
                ['water-bowl', 'water-bowl', 0], ['channel-1', 'water-channel', 1],
                ['channel-2', 'water-channel', 2], ['channel-3', 'water-channel', 3],
                ['planter', 'planter', 5],
            ]) record = await updateLife(profileId, [], { id, revision: record.revision,
                command: { type: 'buy', kind, cell: { x, z: 3 } } }, start + 3 + x, lifeDb);
            const state = replayLife(record), plot = state.items.find(item => item.id === 'planter');
            return { version: record.version, flow: state.items.filter(i => i.waterFlow).length,
                water: foodGrowthConditions(state, plot).water, food: state.food,
                receipts: record.actions.filter(a => a.command.type === 'buy').map(a => a.purchaseReceipt?.priceVersion) };
        }, id);
        assert.equal(setup.version, 20);
        assert.equal(setup.flow, 3);
        assert(setup.water < .01);
        assert.equal(setup.receipts.filter(version => version === 'life-v20-channel-v1').length, 3);

        const captures = [];
        const screenMetadata = async () => ({ ...(await runtimeMetadata(page)), lifeWorld: await page.locator('.life-world').evaluate(element => ({
            rendered: element.dataset.rendered === 'true', visualCandidate: element.dataset.lifeVisualCandidate,
            worldStyle: element.dataset.lifeWorldStyle, canvas: Boolean(element.querySelector('canvas')),
            render: element.dataset.lifeRender ? JSON.parse(element.dataset.lifeRender) : null,
        })) });
        const capture = async (state, flow) => {
            await page.reload();
            await page.locator('.life-world[data-rendered="true"]').waitFor();
            const island = page.locator('.island-life');
            assert.equal(await island.getAttribute('data-life-water-candidate'), report.candidate);
            assert.equal(await island.getAttribute('data-life-soil-candidate'), 'island-soil-moisture-v1');
            assert.equal(Number(await island.getAttribute('data-life-water-flow')), flow);
            const file = `${viewport.width}-${state}.png`;
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            captures.push({ file, flow, ...(await screenMetadata()) });
        };
        await capture('connected', 3);
        await page.getByRole('button', { name: 'つくる', exact: true }).click();
        const catalog = page.locator('[data-life-buy="water-channel"]');
        assert.equal(await catalog.count(), 1);
        await page.getByRole('button', { name: '5ページめ' }).click();
        await catalog.scrollIntoViewIfNeeded();
        assert((await catalog.innerText()).includes('みずみち'));
        assert((await catalog.innerText()).includes('しずく 2'));
        const catalogFile = `${viewport.width}-catalog.png`;
        await page.screenshot({ path: `${out}/${catalogFile}`, animations: 'disabled' });
        captures.push({ file: catalogFile, flow: 3, ...(await screenMetadata()) });
        await page.getByRole('button', { name: 'メニューを とじる' }).click();
        await page.getByRole('button', { name: 'しまの ようす' }).click();
        const summary = await page.getByRole('region', { name: 'たべものの くらし' }).innerText();
        assert(summary.includes('みずみち 3 / 3'), summary);
        const summaryFile = `${viewport.width}-summary.png`;
        await page.screenshot({ path: `${out}/${summaryFile}`, animations: 'disabled' });
        captures.push({ file: summaryFile, flow: 3, ...(await screenMetadata()) });

        const change = async (intentId, command) => page.evaluate(async ({ profileId, intentId, command }) => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            const { foodGrowthConditions } = await import('/src/domain/islandLife/foodLoop.ts');
            const record = await lifeDb.worlds.get(profileId);
            const next = await updateLife(profileId, [], { id: intentId, revision: record.revision, command }, Date.now(), lifeDb);
            const state = replayLife(next), plot = state.items.find(item => item.id === 'planter');
            return { version: next.version, flow: state.items.filter(i => i.waterFlow).length,
                water: foodGrowthConditions(state, plot).water, food: state.food,
                channelId: state.items.find(i => i.id === 'channel-2')?.id };
        }, { profileId: id, intentId, command });
        const advance = async intentId => page.evaluate(async ({ profileId, intentId }) => {
            const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
            const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
            const { foodGrowthConditions } = await import('/src/domain/islandLife/foodLoop.ts');
            const record = await lifeDb.worlds.get(profileId);
            const next = await updateLife(profileId, [], { id: intentId, revision: record.revision, advanceHours: 6 }, Date.now(), lifeDb);
            const state = replayLife(next), plot = state.items.find(item => item.id === 'planter');
            return { flow: state.items.filter(i => i.waterFlow).length, water: foodGrowthConditions(state, plot).water,
                moisture: state.soilMoisture['5,3'], food: state.food };
        }, { profileId: id, intentId });
        const soaked = await advance('soil-wet-six-hours');
        assert(soaked.water > .5);
        await capture('soil-wet', 3);
        const dry = await change('store-middle', { type: 'store', itemId: 'channel-2' });
        assert.equal(dry.flow, 1);
        assert(dry.water > .5);
        await capture('disconnected', 1);
        const dried = await advance('soil-dry-six-hours');
        assert(dried.water < .2);
        await capture('soil-dry', 1);
        const wet = await change('replace-middle', { type: 'move', itemId: 'channel-2', cell: { x: 2, z: 3 } });
        assert.equal(wet.flow, 3);
        assert(wet.water < .2);
        assert.equal(wet.channelId, dry.channelId);
        assert.equal(wet.food.harvested, dried.food.harvested);
        assert.equal(wet.food.delivered, dried.food.delivered);
        assert.equal(wet.food.eaten, dried.food.eaten);
        assert.equal(wet.food.plots.planter.stock, dried.food.plots.planter.stock);
        await capture('reconnected', 3);
        const rewet = await advance('soil-rewet-six-hours');
        assert(rewet.water > .5);
        await capture('soil-rewet', 3);
        assert.deepEqual(errors, []);
        report.scenarios.push({ viewport, setup, soaked, dry, dried, wet, rewet, captures, errors, pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report, null, 2)); }
