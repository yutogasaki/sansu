import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, expectedAnswer, waitLearningReady } from './island-learning-checks.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_WORKSHOP_OUTPUT;
assert(target && out, 'Set a target and fresh SANSU_ISLAND_WORKSHOP_OUTPUT');
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const sha = value => createHash('sha256').update(value).digest('hex');
const manifest = process.env.SANSU_ISLAND_BUILD_SOURCE ? JSON.parse(await fs.readFile(process.env.SANSU_ISLAND_BUILD_SOURCE)) : undefined;
const source = async () => manifest ? Promise.all(manifest.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) }))) : [];
const initialSource = await source();
if (manifest) assert.deepEqual(initialSource, manifest.files.map(({ path, sha256 }) => ({ path, sha256 })));
const report = { target, startedAt: new Date().toISOString(), source: manifest?.sourceHash ?? 'unfrozen-development-diagnostic', formal: Boolean(manifest),
    pass: false, humanN: 0, captures: [], scenarios: [], runs: [], scope: 'Empty database, real first learning section, three specimens and tools, two typed-connection works, undo/reload, same reserved learning. No maturity, specimen, or draft fixtures. Native offline/background and child motivation require separate verification.' };
const browser = await chromium.launch();
const stage = page => page.locator('[data-testid="island-stage"]').first();
const idle = page => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
async function capture(page, name) {
    await stage(page).scrollIntoViewIfNeeded();
    const metadata = await runtimeMetadata(page);
    if (manifest) assert.equal(metadata.revision, manifest.revision);
    const file = `${name}.png`, frameFile = `${name}-world.png`;
    const full = await page.screenshot({ path: `${out}/${file}`, fullPage: true, animations: 'disabled' });
    const frame = await stage(page).screenshot({ path: `${out}/${frameFile}`, animations: 'disabled' });
    report.captures.push({ file, frameFile, sha256: sha(full), frameSha256: sha(frame), ...metadata,
        workshopCandidate: await page.locator('.island-stage').first().getAttribute('data-workshop-candidate'),
        workshop: await stage(page).getAttribute('data-workshop') });
}
async function waitWorkshop(page, predicate, label, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const state = await readNative(page);
        if (predicate(state.island?.workshop)) { await idle(page); return state; }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Workshop did not reach ${label}`);
}
function unchangedLearning(before, after) {
    for (const name of ['islandPlans', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) assert.deepEqual(after[name], before[name], `${name} changed in optional workshop`);
    const strip = island => { const copy = structuredClone(island); delete copy.workshop; delete copy.revision; delete copy.updatedAt; return copy; };
    assert.deepEqual(strip(after.island), strip(before.island), 'Workshop cannot change growth, items, stars or reservation');
    assert.deepEqual(after.islandEvents.filter(event => event.type !== 'workshop_changed'), before.islandEvents.filter(event => event.type !== 'workshop_changed'));
}
async function clickCommand(page, label) { await idle(page); await button(page, label).click(); }
async function armRunObservation(page) {
    await page.evaluate(() => {
        const token = crypto.randomUUID(), started = performance.now();
        window.__workshopRunToken = token; window.__workshopRunFrames = [];
        let previous = '';
        const tick = () => {
            if (window.__workshopRunToken !== token || performance.now() - started > 30000) return;
            const host = document.querySelector('[data-testid="island-stage"]');
            const state = JSON.parse(host?.getAttribute('data-workshop') || 'null');
            const key = JSON.stringify({ phase: state?.phase, run: state?.run });
            if (key !== previous) { previous = key; window.__workshopRunFrames.push({ ms: performance.now() - started, state: JSON.parse(key), frameCpuMs: Number(host?.getAttribute('data-frame-cpu-ms')) }); }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}
async function answerLearning(page, before, touch) {
    await waitLearningReady(page, before.plan);
    const submit = page.locator('.park-answer .park-keypad [data-keypad-submit]');
    if (!await submit.count() || await submit.getAttribute('data-confirmation-mode') !== 'automatic') return (await attempt(page, before, { touch })).after;
    // The current learning form commits a complete single digit/column from the
    // real keypad gesture. Do not send that next question an extra submit.
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    const expected = await expectedAnswer(page, before.plan.slots[before.plan.cursor]);
    const values = Array.isArray(expected.values) ? expected.values : [expected.values];
    for (const [index, value] of values.entries()) {
        if (type !== 'hissan') await page.locator('.park-input').nth(index).click();
        for (const digit of String(value)) {
            if (touch) await page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }).tap();
            else await page.keyboard.type(digit);
        }
    }
    await page.waitForFunction(({ id, revision }) => {
        const root = document.querySelector('[data-island-plan-id]');
        return document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward'
            || root?.getAttribute('data-input-ready') === 'true' && (root.getAttribute('data-island-plan-id') !== id || Number(root.getAttribute('data-island-plan-revision')) === revision + 1);
    }, { id: before.plan.id, revision: before.plan.revision });
    const after = await readNative(page), saved = after.islandPlans.find(plan => plan.id === before.plan.id);
    assert.equal(saved.revision, before.plan.revision + 1);
    assert.deepEqual(saved.slots.map(slot => slot.problem), before.plan.slots.map(slot => slot.problem));
    assert.equal(after.islandEvents.filter(event => event.type === 'answer' && !before.islandEvents.some(old => old.id === event.id)).length, 1);
    return after;
}
async function openDetails(page, text) {
    const summary = page.locator('summary').filter({ hasText: text });
    if (!(await summary.evaluate(node => node.parentElement.open))) await summary.click();
}
async function observe(page, layout, id) {
    await idle(page); await page.locator(`[data-specimen-id="${id}"]`).click();
    await clickCommand(page, 'ブラシへ おく');
    for (let section = 0; section < 6; section++) {
        const control = page.locator(`[data-brush-section="${section}"]`);
        if (await control.isEnabled()) {
            if (layout.name === 'tablet') { await control.focus(); await page.keyboard.press('Enter'); }
            else await control.tap();
        }
        await waitWorkshop(page, state => Boolean(state?.specimens[id].cleanedMask & (1 << section)), `brush ${id}/${section}`);
        if (section === 2) await capture(page, `${layout.name}-${id}-half-clean`);
    }
    await waitWorkshop(page, state => state?.specimens[id].observations.some(entry => entry.result === 'clean'), `${id} clean visible`);
    await capture(page, `${layout.name}-${id}-clean`);
    for (const [tool, result] of [['ひかりへ おく', id === 'seaglass' ? 'transmit' : 'opaque'], ['みずへ おく', id === 'driftwood' ? 'float' : 'sink']]) {
        await clickCommand(page, tool);
        await waitWorkshop(page, state => state?.specimens[id].observations.some(entry => entry.result === result), `${id} ${result} visible`);
        await capture(page, `${layout.name}-${id}-${result}`);
    }
    await waitWorkshop(page, state => state?.specimens[id].identity, `${id} identified`);
    await openDetails(page, 'たなに かざる');
    const shelfIndex = ['driftwood', 'seaglass', 'striped-shell'].indexOf(id) + 1;
    await page.locator('.island-workshop-shelves button').nth(shelfIndex - 1).click();
    await waitWorkshop(page, state => state?.shelves[`shelf-${shelfIndex}`] === id, `${id} shelf`);
}
async function selectPart(page, id) { await idle(page); await page.locator(`[data-part-id="${id}"]`).click(); }
async function movePart(page, id, col, row, rotation = 0) {
    await selectPart(page, id);
    let state = (await readNative(page)).island.workshop;
    while (state.draftCheckpoint.draft.layout.parts[id].rotation !== rotation) {
        const prior = state.draftCheckpoint.draft.layout.parts[id].rotation;
        await clickCommand(page, 'まわす');
        state = (await waitWorkshop(page, state => state?.draftCheckpoint.draft.layout.parts[id].rotation !== prior, `${id} rotated`)).island.workshop;
    }
    await openDetails(page, 'タップで おく');
    await page.locator(`[data-workshop-cell="${col},${row}"]`).click();
    await waitWorkshop(page, state => { const pos = state?.draftCheckpoint.draft.layout.parts[id].position; return pos?.col === col && pos?.row === row; }, `${id} at ${col},${row}`);
}
try {
    for (const layout of [{ name: 'phone', viewport: { width: 390, height: 844 } }, { name: 'tablet', viewport: { width: 768, height: 1024 } }]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.name === 'phone', serviceWorkers: 'block', reducedMotion: layout.name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`); await waitReady(page);
            assert.equal(await button(page, 'おためしの いりえ').count(), 0, 'No workshop before first real section');
            await button(page, 'まなぶ').click(); await button(page, '年中').click(); await button(page, 'さんすう').click();
            await page.getByRole('button', { name: /数をかぞえる・くらべる/ }).click();
            await waitReady(page); await waitMode(page, 'learning');
            let native = await readNative(page), firstPlan = native.plan.id;
            for (let index = 0; native.plan.id === firstPlan; index++) {
                assert(index < 80); native = await answerLearning(page, native, layout.name === 'phone');
            }
            assert.equal(native.island.completedSets, 1);
            const baseline = native;
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await clickCommand(page, 'おためしの いりえ'); await waitMode(page, 'workshop');
            await capture(page, `${layout.name}-01-inlet`);
            assert.equal(await page.locator('canvas').count(), 1, 'Workshop shares the island renderer');
            unchangedLearning(baseline, await readNative(page));
            for (const id of ['driftwood', 'seaglass', 'striped-shell']) await observe(page, layout, id);
            await clickCommand(page, 'つくる');
            for (const id of ['straight', 'elbow', 'wheel', 'bell']) {
                await selectPart(page, id);
                const materials = { straight: 'ながれぎ', elbow: 'ながれぎ', wheel: 'いろガラス', bell: 'しまもようの かい' };
                await clickCommand(page, `${materials[id]}を はめる`);
                await waitWorkshop(page, state => state?.draftCheckpoint.draft.layout.parts[id].assembled, `${id} fitted`);
            }
            for (const [id, col, row] of [['straight', 0, 1], ['wheel', 1, 1], ['bell', 2, 1]]) await movePart(page, id, col, row);
            await armRunObservation(page);
            await clickCommand(page, 'みずを ながす');
            await waitWorkshop(page, state => state?.creations.some(entry => entry.partId === 'bell'), 'A reached bell', 25000);
            report.runs.push({ name: `${layout.name}-A`, frames: await page.evaluate(() => window.__workshopRunFrames) });
            await capture(page, `${layout.name}-02-work-A`);
            await openDetails(page, 'さくひんを のこす');
            const slotA = page.locator('[data-work-id="work-1"]');
            await slotA.locator('input').fill('よこへ ながれる'); await slotA.getByRole('button', { name: 'いまを のこす' }).click();
            const beforeB = await waitWorkshop(page, state => state?.works['work-1']?.name === 'よこへ ながれる', 'A saved');
            await clickCommand(page, 'ばんを あける');
            await waitWorkshop(page, state => Object.values(state?.draftCheckpoint.draft.layout.parts ?? {}).every(part => !part.position), 'board empty, assembly retained');
            for (const [id, col, row, rotation] of [['elbow', 0, 1, 0], ['wheel', 0, 2, 1], ['bell', 0, 3, 1]]) await movePart(page, id, col, row, rotation);
            await armRunObservation(page);
            await clickCommand(page, 'みずを ながす');
            await page.waitForFunction(() => {
                const run = JSON.parse(document.querySelector('[data-testid="island-stage"]')?.getAttribute('data-workshop') || 'null')?.run;
                return run?.complete && run.reached.includes('elbow') && run.reached.includes('wheel') && run.reached.includes('bell') && !run.reached.includes('straight');
            }, undefined, { timeout: 20000 });
            report.runs.push({ name: `${layout.name}-B`, frames: await page.evaluate(() => window.__workshopRunFrames) });
            await capture(page, `${layout.name}-03-work-B`);
            await openDetails(page, 'さくひんを のこす');
            const slotB = page.locator('[data-work-id="work-2"]');
            await slotB.locator('input').fill('したへ ながれる'); await slotB.getByRole('button', { name: 'いまを のこす' }).click();
            const saved = await waitWorkshop(page, state => state?.works['work-2']?.name === 'したへ ながれる', 'B saved');
            assert.deepEqual(saved.island.workshop.works['work-1'], beforeB.island.workshop.works['work-1']);
            assert.notDeepEqual(saved.island.workshop.works['work-1'].layout, saved.island.workshop.works['work-2'].layout);
            await clickCommand(page, 'ひとつ もどす'); await idle(page);
            const undone = await readNative(page);
            assert(undone.island.workshop.draftCheckpoint.draft.redo.length > 0);
            assert.deepEqual(undone.island.workshop.works, saved.island.workshop.works);
            unchangedLearning(baseline, undone);
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            const reloaded = await readNative(page);
            assert.deepEqual(reloaded.island.workshop, undone.island.workshop);
            assert.deepEqual(reloaded.plan, baseline.plan);
            await answerLearning(page, reloaded, layout.name === 'phone');
            await capture(page, `${layout.name}-04-same-learning-resumed`);
            assert.deepEqual(errors, []);
            report.scenarios.push({ name: layout.name, pass: true, earnedSections: 1, fixture: false, preservedReservation: baseline.plan.id });
            console.log(`PASS ${layout.name}: actual specimens, fitted parts, two saved drafts, undo/reload, same learning`);
        } catch (error) {
            await capture(page, `${layout.name}-failure`).catch(() => {});
            report.errors = errors;
            report.lastRunFrames = await page.evaluate(() => window.__workshopRunFrames).catch(() => null);
            await fs.writeFile(`${out}/${layout.name}-native.json`, JSON.stringify(await readNative(page).catch(() => null), null, 2));
            throw error;
        } finally { await context.close(); }
    }
    if (manifest) assert.deepEqual(await source(), initialSource, 'Frozen source changed during verification');
    report.pass = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
