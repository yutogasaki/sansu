import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { ISLAND_CANDIDATE, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_ISLAND_OUTPUT;
assert(target && manifestPath && out, 'Set immutable production URL, source manifest and a fresh output directory');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(await fs.readFile(manifestPath));
const qa = ['tools/e2e-island-chapters.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...new Set([...source.files.map(file => file.path), ...qa])].sort()
    .map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const start = await fingerprint();
assert.deepEqual(source.files.filter(file => start.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const version = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).json();
assert.equal(version.revision, source.revision); assert(version.island.enabled);
assert.equal(version.island.candidate, ISLAND_CANDIDATE);
const report = { target, version, sourceHash: source.sourceHash, manifestPath, startedAt: new Date().toISOString(),
    sourceStart: sha(JSON.stringify(start)), captures: [], scenarios: [], humanN: 0, pass: false,
    scope: 'Primary phone/tablet flows use empty-database setup, an optional home-first growth choice and seven real normal-planner sections. Separate clearly marked mixed-history fixtures check old omitted and new explicit land state in the production album. No fixture is counted as earned progress or child observation.' };
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});

async function capture(page, name) {
    await page.waitForTimeout(850);
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.revision, version.revision); assert.equal(metadata.version, version.version);
    assert.equal(metadata.candidate, ISLAND_CANDIDATE);
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage: true });
    report.captures.push({ file, sha256: sha(bytes), ...metadata });
}
async function finishSection(page, state) {
    const reservation = state.plan, previousSets = state.island.completedSets;
    for (let steps = 0; state.plan?.id === reservation.id; steps++) {
        assert(steps < 70, 'A real reserved section must finish');
        state = (await attempt(page, state)).after;
    }
    assert.equal(state.island.completedSets, previousSets + 1);
    assert.equal(state.plan.cursor, 0); assert.equal(state.plan.revision, 0);
    assert.equal(state.island.pendingRewards.length, 0);
    await waitMode(page, 'learning');
    return state;
}
async function inspectMixedHistory(layout, earned) {
    const context = await browser.newContext({ viewport: layout.viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], name = `${layout.name}-mixed-history-fixture`;
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.goto(`${target}/#/island`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
        const id = await seedNative(page, `chapter-history-${layout.name}`);
        const fixture = structuredClone(earned);
        fixture.profileId = id; delete fixture.pendingPlanId;
        const initial = structuredClone(fixture.growth.memories[0]);
        delete initial.expansionLevel;
        const oldEast = { ...structuredClone(initial), id: 'legacy-east-at-two', kind: 'expansion', completedSets: 2,
            capturedAt: initial.capturedAt + 1, focus: 'village', progress: { garden: 1, waterside: 0, grove: 0, village: 1 },
            items: fixture.items.map(item => ({ ...item, growthLevel: ['garden', 'village'].includes(item.habitatId) ? 1 : 0 })) };
        const mature = structuredClone(fixture.growth.memories[1]);
        assert.equal(mature.completedSets, 7); assert.equal(mature.expansionLevel, 1);
        fixture.growth.memories = [initial, oldEast, mature];
        fixture.growth.discoveries = [];
        await page.evaluate(async fixture => {
            const request = indexedDB.open('SansuDatabase');
            const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            const tx = database.transaction('islands', 'readwrite'); tx.objectStore('islands').put(fixture);
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); database.close();
        }, fixture);
        await page.goto(`${target}/#/island`); await waitReady(page); await waitMode(page, 'home');
        await button(page, 'アルバム').click(); await waitMode(page, 'album');
        await page.getByRole('group', { name: 'みくらべる ばしょ' }).getByRole('button', { name: 'しまぜんぶ', exact: true }).click();
        const timeline = page.locator('.island-album-timeline button');
        assert.equal(await timeline.count(), 3);
        const before = await readNative(page, id);
        for (const [index, sets, east] of [[0, 0, false], [1, 2, true], [2, 7, true]]) {
            await timeline.nth(index).click();
            await page.locator(`[data-memory-completed-sets="${sets}"] [data-renderer="three"]`).waitFor();
            const historic = page.locator('[data-memory-id] [data-renderer="three"]');
            assert.equal(await historic.getAttribute('data-expanded'), String(east));
            assert.equal(await historic.getAttribute('data-west-expanded'), 'false');
            assert.equal(await page.locator('[data-memory-current] [data-renderer="three"]').getAttribute('data-expanded'), 'true');
            await capture(page, `${name}-${sets}`);
        }
        assert.deepEqual(await readNative(page, id), before, 'Read-only mixed history does not rewrite old memories, current land or learning');
        await page.reload(); await waitReady(page); await waitMode(page, 'home');
        assert.deepEqual((await readNative(page, id)).island.growth.memories, fixture.growth.memories);
        assert.deepEqual(errors, []);
        report.scenarios.push({ name, synthetic: true, pass: true, memories: fixture.growth.memories.map(memory => ({
            id: memory.id, completedSets: memory.completedSets, expansionLevel: memory.expansionLevel ?? 'legacy-omitted' })) });
    } catch (error) {
        await capture(page, `${name}-failure`).catch(() => undefined); throw error;
    } finally { await context.close(); }
}

try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, serviceWorkers: 'block',
            reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [], name = `${layout.name}-home-first`;
        page.on('pageerror', error => errors.push(error.message));
        let earned;
        try {
            await page.goto(`${target}/#/island`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click(); await waitReady(page); await waitMode(page, 'learning');
            let state = await readNative(page), initialPlan = structuredClone(state.plan);
            const id = state.island.profileId;
            assert.equal(initialPlan.growthTarget, 'garden'); assert.equal(state.island.growth.expansionLevel, 0);
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, '育てる ばしょを えらぶ').click();
            await page.locator('.island-growth-place').filter({ hasText: 'いえの まわり' }).click(); await waitMode(page, 'home');
            state = await readNative(page, id);
            assert.deepEqual(state.plan, initialPlan, 'Optional target choice never replaces the current reservation');
            assert.equal(state.island.growth.focus, 'village');
            await capture(page, `${name}-next-place-chosen`);
            await page.locator('.island-start').click(); await waitMode(page, 'learning');
            state = await finishSection(page, state);
            assert.equal(state.island.growth.progress.garden, 1); assert.equal(state.plan.growthTarget, 'village');
            for (let progress = 1; progress <= 6; progress++) {
                const planId = state.plan.id;
                state = await finishSection(page, state);
                assert.equal(state.island.growth.progress.village, progress);
                assert.equal(state.island.growth.expansionLevel, progress === 6 ? 1 : 0);
                assert.deepEqual(state.island.growth.memories.map(memory => memory.completedSets), progress === 6 ? [0, 7] : [0]);
                if (progress < 6) assert.equal(await page.locator(`[data-growth-milestone='${planId}']`).count(), 0);
                if (progress === 5 || progress === 6) {
                    if (progress === 6) {
                        const notice = page.locator('[data-growth-milestone]'); await notice.waitFor();
                        assert.match(await notice.innerText(), /おうちに テラスが できた/);
                        assert.match(await notice.innerText(), /しまが 大きく ひろがったよ/);
                        assert.equal(await notice.getByRole('button').count(), 0);
                        await capture(page, `${name}-first-maturity-learning`);
                    }
                    await button(page, 'しまへ').click(); await waitMode(page, 'home');
                    const stage = page.locator('[data-renderer="three"]');
                    assert.equal(await stage.getAttribute('data-expanded'), String(progress === 6));
                    assert.equal(await stage.getAttribute('data-west-expanded'), 'false');
                    if (progress === 5) {
                        assert.equal(await page.locator('[data-island-expansion-preview]').getAttribute('data-island-expansion-preview'), 'east');
                        assert.equal(state.island.completedSets, 6, 'Six total sections alone must not unlock land');
                    }
                    await capture(page, `${name}-${progress === 5 ? 'one-to-maturity' : 'east-opened-at-seven'}`);
                    if (progress === 5) { await page.locator('.island-start').click(); await waitMode(page, 'learning'); }
                }
            }
            assert.equal(state.island.completedSets, 7); assert.equal(state.island.items.length, 5);
            state = await readNative(page, id);
            earned = structuredClone(state.island);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            const restored = await readNative(page, id);
            assert.deepEqual(restored.plan, state.plan); assert.deepEqual(restored.island.growth, state.island.growth);
            assert.deepEqual(errors, []);
            report.scenarios.push({ name, synthetic: false, completedSets: 7, progress: state.island.growth.progress,
                expansionLevel: state.island.growth.expansionLevel, pass: true });
            console.log(`PASS ${name}: optional next target stays frozen; home matures first and opens east at seven real sections`);
        } catch (error) {
            await capture(page, `${name}-failure`).catch(() => undefined); throw error;
        } finally { await context.close(); }
        await inspectMixedHistory(layout, earned);
    }
    assert.deepEqual(await fingerprint(), start, 'Application and QA inputs remain fixed throughout the run');
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString(); await browser.close(); report.browserClosed = true;
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
