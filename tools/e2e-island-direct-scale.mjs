import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { build } from 'esbuild';
import { chromium, webkit } from 'playwright';
import { Matrix4, Vector3 } from 'three';
import { button, seedNative, readNative, waitReady, waitMode, runtimeMetadata } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_DIRECT_URL;
const out = process.env.SANSU_DIRECT_OUTPUT;
const baseline = process.env.SANSU_DIRECT_BASELINE === '1';
const engine = process.env.SANSU_DIRECT_BROWSER || 'chromium';
assert(target && out, 'Specify a production URL and fresh evidence directory');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.access(`${out}/report.json`), { code: 'ENOENT' });
const compiled = await build({ stdin: { contents: `
    export { findAvailablePosition, ISLAND_ITEMS, isValidIslandPlacement } from './src/domain/island/catalog.ts';
    export { ISLAND_DISCOVERIES } from './src/domain/island/growth.ts';
    export { getIslandExperience } from './src/domain/island/experience.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureInputs = await Promise.all(Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>' && !file.includes('node_modules')).sort()
    .map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const report = { target, engine, baseline, humanN: 0, diagnostic: true,
    fixture: 'Explicit native maturity, legal placements, names and prior discoveries; not earned learning. Real pointer input and native save comparisons. No app callbacks injected.',
    fixtureInputs, fixtureHash: sha(compiled.outputFiles[0].text), version: await (await fetch(`${target}/version.json`)).json(), scenarios: [], pass: false };
const browser = await ({ chromium, webkit })[engine].launch();
const sizes = (baseline || engine === 'webkit' ? [{ width: 390, height: 844 }] : [
    { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 844, height: 390 }])
    .filter(viewport => !process.env.SANSU_DIRECT_WIDTH || viewport.width === Number(process.env.SANSU_DIRECT_WIDTH));
const stage = page => page.getByTestId('island-stage');
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function install(page, island) {
    await page.evaluate(async island => {
        const req = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        const tx = db.transaction('islands', 'readwrite'); tx.objectStore('islands').put(island);
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
    }, island);
    await page.reload(); await waitReady(page); await settle(page);
}
function mature(base, count, longName) {
    const island = structuredClone(base);
    island.completedSets = 24;
    island.growth = { ...island.growth, expansionLevel: 2, progress: { garden: 6, waterside: 6, grove: 6, village: 6 } };
    island.items = [];
    const kinds = Object.keys(domain.ISLAND_ITEMS);
    for (let index = 0; index < count; index++) {
        const kind = kinds[index] || 'flower', id = ['telescope', 'hammock', 'tea-table'].includes(kind) ? `optional-${kind}` : `scale-${index}`;
        const position = domain.findAvailablePosition(island, kind);
        assert(position, `Fixture ${index} must fit legal land`);
        const habitatId = ({ flower: 'garden', lantern: 'village', mushroom: 'grove', fountain: 'waterside' })[kind];
        island.items.push({ id, kind, position, rotation: 0, ...(habitatId ? { habitatId, growthLevel: 3 } : {}) });
    }
    for (const item of island.items) assert(domain.isValidIslandPlacement(island, item.id, item.position));
    island.growth.discoveries = domain.ISLAND_DISCOVERIES.flatMap(definition => {
        const item = island.items.find(item => item.habitatId === definition.habitatId && definition.kinds.includes(item.kind));
        return item ? [{ id: definition.id, itemId: item.id, discoveredAt: 1 }] : [];
    });
    island.experience = domain.getIslandExperience(island);
    if (longName) island.experience.residents.otter.name = 'あいうえおかきくけこさしすせそた';
    return island;
}
async function visibleHit(locator) {
    const result = await locator.evaluate(element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height,
            inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
            hits: [.15, .5, .85].map(f => element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height * f))) };
    });
    assert(result.inView && result.width >= 44 && result.height >= 44 && result.hits.every(Boolean), JSON.stringify(result));
    return result;
}
async function pointAt(page, position, height = .55) {
    const box = await stage(page).boundingBox(), frame = (await stage(page).getAttribute('data-camera-frame')).split(',').map(Number);
    const p = new Vector3(...position).add(new Vector3(0, height, 0)).applyMatrix4(new Matrix4().fromArray(frame.slice(0, 16)).invert())
        .applyMatrix4(new Matrix4().fromArray(frame.slice(16)));
    return { x: box.x + (p.x + 1) / 2 * box.width, y: box.y + (1 - p.y) / 2 * box.height };
}
async function selectResident(page) {
    if (baseline) {
        await page.locator('[data-direct-target="resident"]').tap();
        await page.locator('.island-direct-panel').waitFor(); return;
    }
    await settle(page);
    const resident = JSON.parse(await stage(page).getAttribute('data-resident-states')).find(resident => resident.species === 'otter');
    const p = await pointAt(page, resident.position, .8); await page.touchscreen.tap(p.x, p.y);
    await page.locator('.island-direct-panel').waitFor();
}
try {
    for (const viewport of sizes) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const scenario = { viewport, captures: [], counts: [], errors: [], pass: false }; report.scenarios.push(scenario);
        page.on('pageerror', error => scenario.errors.push(error.message));
        const capture = async name => { await settle(page); const file = `${viewport.width}-${name}.png`;
            await page.screenshot({ path: `${out}/${file}` }); scenario.captures.push({ file, ...(await runtimeMetadata(page)) }); };
        try {
            await page.goto(target); await page.locator('.island-welcome').waitFor();
            const id = await seedNative(page, randomUUID()); await page.reload(); await waitReady(page);
            const base = (await readNative(page, id)).island;
            for (const count of baseline ? [16] : [1, 9, 16]) {
                await install(page, mature(base, count, viewport.width === 320));
                const before = await readNative(page, id);
                await page.locator('.island-view-tools > summary').click();
                await button(page, 'しまを みぎに まわす').click();
                await page.locator('.island-view-tools > summary').click(); await settle(page);
                await selectResident(page);
                await page.locator('.island-direct-panel').waitFor(); await settle(page);
                const panel = page.locator('.island-direct-panel');
                const metrics = await panel.evaluate(element => {
                    const r = element.getBoundingClientRect(), world = document.querySelector('.island-stage__viewport').getBoundingClientRect();
                    const overlap = Math.max(0, Math.min(r.right, world.right) - Math.max(r.left, world.left)) * Math.max(0, Math.min(r.bottom, world.bottom) - Math.max(r.top, world.top));
                    const reset = document.querySelector('.island-stage__quick-reset')?.getBoundingClientRect();
                    return { height: r.height, buttons: element.querySelectorAll('button').length, worldOverlap: overlap,
                        resetOverlap: reset ? Math.max(0, Math.min(r.right, reset.right) - Math.max(r.left, reset.left)) * Math.max(0, Math.min(r.bottom, reset.bottom) - Math.max(r.top, reset.top)) : 0,
                        worldHeight: world.height, worldWidth: world.width };
                });
                scenario.counts.push({ count, ...metrics }); await capture(`placed-${count}`);
                if (baseline) { assert(metrics.buttons > 10 && metrics.resetOverlap > 0, 'Reproduce expanding list and reset overlap'); continue; }
                assert.equal(metrics.buttons, 2); assert.equal(metrics.worldOverlap, 0); assert.equal(metrics.resetOverlap, 0);
                assert(metrics.worldWidth >= 200 && metrics.worldHeight >= 120);
                await visibleHit(button(page, 'そうさを とじる')); await visibleHit(button(page, 'えから えらぶ'));
                assert.equal(await page.locator('.island-home-controls').count(), 0);
                assert.equal(await page.locator('.island-view-tools[open]').count(), 0);
                await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' });
                await button(page, 'もちもの').waitFor();
                assert.deepEqual(await readNative(page, id), before, 'Readonly selection/camera/close keeps all seven stores unchanged');
            }
            if (baseline) { scenario.pass = true; continue; }
            await selectResident(page);
            await page.locator('.island-view-tools > summary').click();
            assert.equal(await page.locator('.island-direct-panel').count(), 0);
            assert.equal(await page.locator('.island-view-tools[open]').count(), 1);
            await selectResident(page);
            assert.equal(await page.locator('.island-view-tools[open]').count(), 0);
            await button(page, 'えから えらぶ').tap(); await waitMode(page, 'play');
            const choices = page.locator('.island-play-choices button');
            assert.equal(await choices.count(), 16);
            const bench = page.locator('.island-play-choices').getByRole('button', { name: /ベンチ.*で あそぶ/ }).first();
            await bench.scrollIntoViewIfNeeded(); await visibleHit(bench); await bench.tap();
            await page.waitForFunction(() => ['playing', 'blocked'].includes(document.querySelector('[data-testid="island-stage"]')?.dataset.playStatus));
            scenario.densePlayStatus = await stage(page).getAttribute('data-play-status');
            await visibleHit(button(page, 'ベンチを うごかす'));
            await capture('picture-choice');
            await button(page, 'あそびから もどる').tap(); await waitMode(page, 'home'); await settle(page);

            // Primary route uses real projected model coordinates, never a DOM marker or app callback for the item.
            await install(page, mature(base, 2, false));
            let expectedResident = 'otter';
            if (viewport.width === 768) {
                // View the visible flower from the side when the autonomous rabbit stands in front of it.
                await page.locator('.island-view-tools > summary').click();
                await button(page, 'しまを みぎに まわす').click(); await button(page, 'しまを みぎに まわす').click();
                await page.locator('.island-view-tools > summary').click(); await settle(page);
            }
            if (viewport.width === 390) {
                await page.locator('.island-view-tools > summary').click(); await button(page, 'しまを みぎに まわす').click();
                await page.locator('.island-view-tools > summary').click(); await settle(page);
                const fox = JSON.parse(await stage(page).getAttribute('data-resident-states')).find(resident => resident.species === 'fox');
                const p = await pointAt(page, fox.position, .8); await page.touchscreen.tap(p.x, p.y);
                await page.getByRole('region', { name: 'キツネの そうさ', exact: true }).waitFor(); expectedResident = 'fox';
            } else await selectResident(page);
            await settle(page);
            const items = JSON.parse(await stage(page).getAttribute('data-furniture-state'));
            const item = items.find(item => item.kind === 'flower'); assert(item);
            const p = await pointAt(page, item.position, .45); await page.touchscreen.tap(p.x, p.y);
            await waitMode(page, 'play');
            await page.waitForFunction(({ id, resident }) => { const s = document.querySelector('[data-testid="island-stage"]'); return s?.dataset.residentSpecies === resident && s.dataset.residentItemId === id; }, { id: item.id, resident: expectedResident });
            await capture('world-choice');
            if (viewport.width === 390) {
                const previousRequest = await stage(page).getAttribute('data-play-request-id');
                const next = page.locator('.island-play-choices').getByRole('button', { name: /ベンチ.*で あそぶ/ }).first();
                await next.scrollIntoViewIfNeeded(); await visibleHit(next); await next.tap();
                await page.waitForFunction(previous => { const s = document.querySelector('[data-testid="island-stage"]'); return s?.dataset.playRequestId && s.dataset.playRequestId !== previous; }, previousRequest);
                await page.getByRole('heading', { name: 'キツネと あそぶ', exact: true }).waitFor();
                scenario.nextChoice = { status: await stage(page).getAttribute('data-play-status'), species: await stage(page).getAttribute('data-resident-species') };
                if (scenario.nextChoice.status === 'playing') assert.equal(scenario.nextChoice.species, 'fox');
                await capture('next-picture-choice');
            }
            await button(page, 'あそびから もどる').tap(); await waitMode(page, 'home');

            if (viewport.width === 390) {
                await button(page, 'しまのメニュー').tap(); await button(page, 'どうぶつと あそぶ').tap();
                await page.getByRole('heading', { name: 'どうぶつと あそぶ', exact: true }).waitFor();
                await page.reload(); await waitReady(page);
                await page.getByRole('heading', { name: 'どうぶつと あそぶ', exact: true }).waitFor();
                await button(page, 'あそびから もどる').tap(); await waitMode(page, 'home');
            }

            if (viewport.width === 320) {
                await install(page, mature(base, 1, true)); await selectResident(page);
                const text = await page.addStyleTag({ content: '.island-direct-panel :is(h2, p, button) { font-size: 24px !important; line-height: 1.6 !important; }' });
                await button(page, 'えから えらぶ').scrollIntoViewIfNeeded();
                await visibleHit(button(page, 'そうさを とじる')); await visibleHit(button(page, 'えから えらぶ'));
                await capture('text-enlargement-diagnostic'); await text.evaluate(element => element.remove());
                await page.keyboard.press('Escape');
            }

            if (viewport.width === 390 && engine === 'chromium') {
                await install(page, mature(base, 1, false)); await selectResident(page);
                const before = await readNative(page, id);
                await page.locator('.island-stage__canvas canvas').evaluate(canvas => {
                    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
                    if (!extension) throw new Error('Context-loss diagnostic unavailable'); extension.loseContext();
                });
                await page.locator('.island-stage__fallback').waitFor();
                await visibleHit(button(page, 'そうさを とじる')); await visibleHit(button(page, 'えから えらぶ'));
                await capture('context-loss-diagnostic'); await button(page, 'えから えらぶ').tap(); await waitMode(page, 'play');
                await button(page, 'あそびから もどる').tap(); await waitMode(page, 'home');
                assert.deepEqual(await readNative(page, id), before, 'Context loss and escape preserve saved state');
            }

            const empty = mature(base, 1, false); delete empty.items[0].position;
            await install(page, empty); await selectResident(page);
            await visibleHit(button(page, 'もちものを おく')); assert.equal(await button(page, 'えから えらぶ').count(), 0);
            await capture('stored-only'); await button(page, 'もちものを おく').tap(); await waitMode(page, 'inventory');
            await button(page, 'まなぶ').tap(); await waitMode(page, 'learning');
            assert.equal(await page.locator('.island-direct-panel').count(), 0);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.deepEqual(scenario.errors, []); scenario.pass = true;
        } catch (error) { scenario.error = String(error.stack || error);
            scenario.failureStage = await stage(page).evaluate(element => ({ ...element.dataset })).catch(() => null);
            await page.screenshot({ path: `${out}/${viewport.width}-failure.png` }); throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally { await browser.close(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ pass: report.pass, baseline, engine, out }));
