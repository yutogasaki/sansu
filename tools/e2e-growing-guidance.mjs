import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { answerUI, readNative, runtimeMetadata, seedDev } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_GROWING_GUIDANCE_URL || 'http://127.0.0.1:5260';
const out = process.env.SANSU_GROWING_GUIDANCE_OUTPUT;
assert(out, 'Specify a fresh SANSU_GROWING_GUIDANCE_OUTPUT directory');
await fs.mkdir(out, { recursive: false });
const hash = value => createHash('sha256').update(value).digest('hex');
async function sources() {
    const paths = execFileSync('rg', ['--files', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('package.json', 'package-lock.json', 'vite.config.ts', 'tools/e2e-growing-guidance.mjs', 'tools/island-e2e-helpers.mjs');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, hash(await fs.readFile(path))])));
}
const initialSources = await sources();
const report = { target: base, source: 'DEV Growing preview; disposable seedDev profiles. New island real UI actions/answers and explicit existing-record fixture are separate.',
    productionServiceWorker: false, consoleErrors: [], scenarios: [], captures: [], exceptions: [], initialSources, pass: false };
const browser = await chromium.launch();
let activePage;
function observeConsole(page, viewport, scenario) {
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({ viewport, scenario, text: message.text(), location: message.location() });
    });
}

const book = page => page.locator('section[aria-label="しまの あそびかた"]');
const btn = (page, name) => page.getByRole('button', { name, exact: true });
const read = (page, id) => page.evaluate(async id => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV preview only; refuse production DB');
    return growingDb.islands.get(id);
}, id);
async function saved(page, id, predicate) {
    const deadline = Date.now() + 30000;
    do { const record = await read(page, id); if (predicate(record)) return record; await page.waitForTimeout(100); } while (Date.now() < deadline);
    throw Error('Expected persisted guidance condition was not reached');
}
async function ready(page) {
    await page.locator('[data-growing-island="ready"]').waitFor();
    await page.locator('[data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
}
async function capture(page, label) {
    const file = `${page.viewportSize().width}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), world: await page.locator('[data-growing-world]').evaluate(e => ({ ...e.dataset })),
        guidanceCandidate: await book(page).count() ? await book(page).getAttribute('data-visual-candidate') : null,
        cacheState: 'DEV module cache; no production service worker claim' });
}
async function openBook(page) {
    await btn(page, 'メニュー').tap(); await btn(page, 'しまの あそびかた').tap(); await book(page).waitFor();
}
async function closeBook(page) { await book(page).getByRole('button', { name: 'とじる', exact: true }).tap(); await book(page).waitFor({ state: 'hidden' }); }
async function choose(page, goal) {
    await openBook(page);
    let card = book(page).locator(`.growing-guide-candidates [data-guidance-goal="${goal}"]`);
    if (!await card.count()) {
        await book(page).locator('summary').click();
        card = book(page).locator(`.growing-guide-all [data-guidance-goal="${goal}"]`);
    }
    await card.tap();
    await book(page).getByRole('button', { name: 'これを やってみる', exact: true }).tap();
    await book(page).waitFor({ state: 'hidden' });
}

async function tapSeed(page) {
    const locator = btn(page, 'たね'); await locator.waitFor();
    const box = await locator.boundingBox(); assert(box);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function cellTap(page, id, cell) {
    const point = await page.evaluate(async ({ id, cell }) => {
        const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
        const { sceneLayout } = await import('/src/components/island/growing/sceneLayout.ts');
        const { frameCamera, initialView } = await import('/src/components/island/growing/growingCamera.ts');
        const T = await import('/node_modules/.vite/deps/three.js');
        const box = document.querySelector('[data-growing-world] canvas').getBoundingClientRect();
        const layout = sceneLayout((await growingDb.islands.get(id)).state), camera = new T.OrthographicCamera();
        frameCamera(camera, layout, initialView(), box.width / box.height); camera.updateMatrixWorld();
        const p = layout.point(cell).project(camera);
        return { x: box.x + (p.x + 1) / 2 * box.width, y: box.y + (1 - p.y) / 2 * box.height };
    }, { id, cell });
    await page.touchscreen.tap(point.x, point.y);
}
async function plant(page, id, kind, cell) {
    await tapSeed(page); await page.locator(`[data-growing-seed="${kind}"]`).tap();
    await cellTap(page, id, cell); await btn(page, 'ここに おく').tap();
    await saved(page, id, r => r.state.plots.some(p => p.kind === kind && p.cell?.x === cell.x && p.cell?.z === cell.z));
}
async function learn(page, id, count) {
    await page.getByRole('button', { name: /^まなぶ/ }).tap(); await page.locator('[data-input-ready="true"]').waitFor();
    assert.equal(await book(page).count(), 0, 'Book stays out of learning');
    let native = await readNative(page, id);
    const answers = [];
    for (let i = 0; i < count; i++) { const answered = await answerUI(page, native.plan, { touch: true }); native = answered.state; answers.push({ beforeRevision: answered.beforeRevision, afterRevision: answered.afterRevision }); }
    const resume = { id: native.plan.id, cursor: native.plan.cursor, revision: native.plan.revision };
    await btn(page, 'とじる').tap(); await ready(page);
    return { answers, resume };
}
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = activePage = await context.newPage(); page.setDefaultTimeout(30000); observeConsole(page, viewport, 'new-real-UI');
        const errors = []; page.on('pageerror', error => { errors.push(error.message); report.exceptions.push({ viewport, error: error.stack || error.message }); });
        console.log(`[guidance] ${viewport.width}: new real UI journey`);
        await page.goto(`${base}/#/island`);
        const id = await seedDev(page, { familiar: false, name: 'しまの あんない' });
        await page.reload(); await ready(page);
        await page.locator('[data-guidance-starter="S1"]').waitFor(); await capture(page, 'starter-S1');
        await openBook(page);
        assert.equal(await book(page).locator('.growing-guide-candidates').count(), 0);
        assert.equal(await book(page).locator('details[open]').count(), 0);
        await book(page).locator('[data-guidance-starter="S1"]').waitFor();
        await capture(page, 'first-book-one-action'); await closeBook(page);
        const first = await read(page, id); assert.equal(first.state.guidance.starter.automatic, true); assert.equal(first.state.plots.length, 0);
        await page.locator('[data-guidance-starter="S1"]').getByRole('button', { name: 'しまの ヒントを とじる', exact: true }).tap();
        await saved(page, id, r => !r.state.guidance.starter.automatic);
        await page.reload(); await ready(page);
        assert.equal(await page.locator('[data-guidance-starter="S1"]').count(), 0);
        assert.equal((await read(page, id)).state.tutorial, 'first-home');
        assert.equal((await read(page, id)).state.drops, first.state.drops);

        await choose(page, 'A3');
        await page.locator('.growing-sheet[aria-label="しまの はた"]').waitFor();
        await btn(page, 'いろ 2').tap();
        const colored = await saved(page, id, r => r.state.guidance.achievements.A3);
        assert.equal(colored.state.flagColor, 1); const a3 = colored.state.guidance.achievements.A3;
        await btn(page, 'いろ 3').tap(); await saved(page, id, r => r.state.flagColor === 2);
        assert.deepEqual((await read(page, id)).state.guidance.achievements.A3, a3, 'Later paint keeps original earned snapshot');
        await page.locator('.growing-sheet').getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.locator('[data-guidance-notice]').getByRole('button', { name: 'できごとを みる', exact: true }).tap();
        assert.equal(await book(page).getByRole('tab', { name: 'できたこと', exact: true }).getAttribute('aria-selected'), 'true');
        await book(page).locator('[data-guidance-memory="A3"]').waitFor();
        assert.equal(await book(page).locator('[data-guidance-starter]').count(), 0);
        assert.deepEqual((await read(page, id)).state.guidance.achievements.A3, a3);
        await capture(page, 'notice-direct-memory'); await closeBook(page);
        await choose(page, 'A4');
        await page.locator('.growing-sheet').getByRole('button', { name: 'うごかす', exact: true }).tap();
        await cellTap(page, id, { x: 4, z: 3 }); await btn(page, 'ここに おく').tap();
        const moved = await saved(page, id, r => r.state.guidance.achievements.A4);
        assert.equal(moved.state.guidance.achievements.A4.targetId, 'starter-bench');
        assert.deepEqual(moved.state.landmarks.find(p => p.id === 'starter-bench').cell, { x: 4, z: 3 });
        await page.reload(); await ready(page);
        assert.equal((await read(page, id)).state.guidance.selected, 'A4');
        assert.deepEqual((await read(page, id)).state.guidance.achievements.A3, a3);
        await capture(page, 'color-and-move');

        await plant(page, id, 'home', { x: 1, z: 3 });
        const free = await read(page, id); assert.equal(free.state.drops, first.state.drops); assert.equal(free.state.plots.length, 1);
        assert(free.state.guidance.starter.steps.S1); assert(!free.state.guidance.achievements.A2);
        await btn(page, 'ぜんぶ ひらく').tap();
        await saved(page, id, r => r.state.guidance.achievements.A1);
        const welcomed = await read(page, id); assert(welcomed.state.guidance.starter.steps.S2); assert(welcomed.state.guidance.starter.steps.S3);
        assert(!welcomed.state.guidance.achievements.A2, 'Free house never counts as ordinary growth');
        await capture(page, 'first-friend');
        const firstLearning = await learn(page, id, 3);
        await saved(page, id, r => r.state.guidance.starter.steps.S4);
        assert.equal((await read(page, id)).state.drops, 6);
        await plant(page, id, 'farm', { x: 4, z: 2 });
        const paid = await read(page, id); assert.equal(paid.state.drops, 2);
        let resumed = firstLearning.resume; const answers = [...firstLearning.answers];
        if (!paid.state.plots.find(p => p.kind === 'farm').stage) {
            const next = await learn(page, id, 3); resumed = next.resume; answers.push(...next.answers);
        }
        await saved(page, id, r => r.state.plots.some(p => p.kind === 'farm' && p.stage > 0));
        await btn(page, 'ぜんぶ ひらく').tap();
        const grown = await saved(page, id, r => r.state.guidance.starter.steps.S5 && r.state.guidance.achievements.A2);
        assert.equal(grown.state.plots.filter(p => p.starter).length, 1);
        await openBook(page); await book(page).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await capture(page, 'book-earned'); await closeBook(page);
        await page.reload(); await ready(page);
        assert.deepEqual((await read(page, id)).state.guidance.achievements.A3, a3);
        assert.equal((await read(page, id)).state.guidance.selected, 'A4');
        await page.getByRole('button', { name: /^まなぶ/ }).tap(); await page.locator('[data-input-ready="true"]').waitFor();
        const native = await readNative(page, id); assert.deepEqual({ id: native.plan.id, cursor: native.plan.cursor, revision: native.plan.revision }, resumed);
        await btn(page, 'とじる').tap(); await ready(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        report.scenarios.push({ viewport, name: 'new-island-real-UI-starter-color-move-free-and-paid-seeds-learning-reload', profileId: id, answerCount: answers.length, answers, guidance: (await read(page, id)).state.guidance, pass: true });

        if (process.env.SANSU_GROWING_GUIDANCE_OFFLINE === '1') {
            await context.setOffline(true);
            await openBook(page); await book(page).getByRole('tab', { name: 'できたこと', exact: true }).tap();
            if (!await book(page).locator('[data-guidance-memory="A3"]').count()) await book(page).locator('[data-guidance-goal="A3"]').tap();
            await book(page).getByRole('button', { name: 'この場所へ', exact: true }).tap();
            await page.locator('.growing-sheet[aria-label="しまの はた"]').waitFor(); await btn(page, 'いろ 4').tap(); await saved(page, id, r => r.state.flagColor === 3);
            await page.locator('.growing-sheet').getByRole('button', { name: 'とじる', exact: true }).tap();
            await context.setOffline(false); await page.reload(); await ready(page);
            assert.equal((await read(page, id)).state.flagColor, 3);
            report.scenarios.push({ viewport, name: 'optional-mounted-DEV-offline-save-online-reload-no-SW-cold-start-claim', pass: true });
        }
        await context.close();

        // Explicit existing saved owner: proves conservative migration, not acquired progress.
        const oldContext = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const oldPage = activePage = await oldContext.newPage(); oldPage.setDefaultTimeout(30000); observeConsole(oldPage, viewport, 'explicit-old-fixture');
        const oldErrors = []; oldPage.on('pageerror', error => { oldErrors.push(error.message); report.exceptions.push({ viewport, scenario: 'explicit-old-fixture', error: error.stack || error.message }); });
        console.log(`[guidance] ${viewport.width}: conservative old fixture`);
        await oldPage.goto(`${base}/#/island`); const oldId = await seedDev(oldPage, { familiar: false, name: 'これまでの しま' });
        await oldPage.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV preview only');
            const { newIsland } = await import('/src/domain/growingIsland/island.ts');
            const now = Date.now(), state = newIsland(id, now); delete state.guidance;
            state.tutorial = 'done'; state.land.expanded = 'east';
            state.villagers.push({ id: 'fixture-friend', ...state.pier.visitor, home: 'pokomoko', arrivedAt: 0 });
            await growingDb.islands.put({ profileId: id, version: 2, revision: 1, createdAt: now, updatedAt: now, state });
        }, oldId);
        await oldPage.reload(); await ready(oldPage);
        const old = await read(oldPage, oldId); assert.equal(old.version, 3);
        assert.equal(old.state.guidance.starter.automatic, false); assert.equal(old.state.tutorial, 'done');
        assert.deepEqual(Object.keys(old.state.guidance.achievements).sort(), ['A1', 'A6']);
        assert.deepEqual([...old.state.guidance.notified].sort(), ['A1', 'A6']);
        for (const proof of Object.values(old.state.guidance.achievements)) { assert.equal(proof.source, 'legacy'); assert.equal(proof.at, undefined); }
        assert.equal(await oldPage.locator('[data-guidance-starter="S1"]').count(), 0);
        await openBook(oldPage); await book(oldPage).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await capture(oldPage, 'existing-conservative-book'); await closeBook(oldPage);
        await oldPage.reload(); await ready(oldPage);
        assert.deepEqual((await read(oldPage, oldId)).state.guidance.achievements, old.state.guidance.achievements);
        assert.deepEqual(oldErrors, []);
        report.scenarios.push({ viewport, name: 'explicit-version2-owner-conservative-silent-migration-no-free-reissue', guidance: old.state.guidance, pass: true });
        await oldContext.close();

        // An explicit ready-to-play rich fixture isolates foreground concert and expansion receipts.
        // Its resources/unlocks were not acquired by the child's six-question journey above.
        const richContext = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const richPage = activePage = await richContext.newPage(); richPage.setDefaultTimeout(30000); observeConsole(richPage, viewport, 'explicit-rich-fixture');
        const richErrors = []; richPage.on('pageerror', error => { richErrors.push(error.message); report.exceptions.push({ viewport, scenario: 'explicit-rich-fixture', error: error.stack || error.message }); });
        console.log(`[guidance] ${viewport.width}: rich concert/land fixture`);
        await richPage.goto(`${base}/#/island`); const richId = await seedDev(richPage, { familiar: false, name: 'ひろばと とちの しらべ' });
        await richPage.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV preview only');
            const { newIsland } = await import('/src/domain/growingIsland/island.ts');
            const { refreshUnlocks } = await import('/src/domain/growingIsland/community.ts');
            const now = Date.now(), state = newIsland(id, now);
            state.tutorial = 'done'; state.guidance.starter.automatic = false;
            state.drops = 200; state.genki.best = 3;
            state.landmarks.push({ id: 'fixture-bandstand', kind: 'bandstand', cell: { x: 4, z: 2 }, growth: 0 });
            refreshUnlocks(state);
            await growingDb.islands.put({ profileId: id, version: 3, revision: 1, createdAt: now, updatedAt: now, state });
        }, richId);
        await richPage.reload(); await ready(richPage);
        const nativeBefore = await readNative(richPage, richId);
        await choose(richPage, 'A5');
        assert.equal((await read(richPage, richId)).state.guidance.achievements.A5, undefined, 'Choosing is not a renderer-start receipt');
        // Reload removes the guidance camera focus; projection matches the actual initial camera.
        await richPage.reload(); await ready(richPage);
        await cellTap(richPage, richId, { x: 4, z: 2 });
        const performed = await saved(richPage, richId, r => r.state.guidance.achievements.A5);
        assert.equal(performed.state.guidance.achievements.A5.targetId, 'fixture-bandstand');
        assert.notEqual(performed.state.guidance.achievements.A5.source, 'legacy');
        await capture(richPage, 'fixture-concert-started');
        await choose(richPage, 'A6');
        assert.equal((await read(richPage, richId)).state.guidance.achievements.A6, undefined, 'Choosing cannot expand land');
        await btn(richPage, 'ひがしへ ひろげる 💧12').tap();
        const expanded = await saved(richPage, richId, r => r.state.guidance.achievements.A6);
        const landMemory = expanded.state.guidance.achievements.A6;
        assert.equal(expanded.state.drops, 188); assert.equal(expanded.state.land.expanded, 'east');
        assert.equal(landMemory.snapshot.land.expanded, 'east');
        await btn(richPage, 'メニュー').tap(); await btn(richPage, 'にしへ ひろげる 💧24').tap();
        await saved(richPage, richId, r => r.state.drops === 164);
        await richPage.reload(); await ready(richPage);
        assert.deepEqual((await read(richPage, richId)).state.guidance.achievements.A6, landMemory, 'Later land expansion keeps the first immutable memory');
        assert.equal((await read(richPage, richId)).state.guidance.selected, 'A6');
        assert.equal((await read(richPage, richId)).state.learned.length, 0);
        const nativeAfter = await readNative(richPage, richId);
        for (const table of ['logs', 'memoryMath', 'memoryVocab', 'islandPlans']) assert.deepEqual(nativeAfter[table], nativeBefore[table], 'Fixture island actions do not alter learning stores');
        await openBook(richPage); await book(richPage).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        await capture(richPage, 'fixture-concert-land-memories'); await closeBook(richPage);
        assert.deepEqual(richErrors, []);
        report.scenarios.push({ viewport, name: 'explicit-rich-fixture-real-concert-renderer-start-and-paid-land-expansion',
            fixture: { drops: 200, genkiBest: 3, bandstand: 'fixture-bandstand' }, acquiredProgress: false,
            guidance: (await read(richPage, richId)).state.guidance, pass: true });
        await richContext.close();
    }
    report.finalSources = await sources();
    assert.deepEqual(report.finalSources, initialSources, 'Runtime journey must use unchanged application and QA sources');
    report.pass = true;
} catch (error) {
    report.error = String(error.stack || error); process.exitCode = 1;
    report.finalSources ??= await sources().catch(() => undefined);
    if (activePage && !activePage.isClosed()) report.failureState = await activePage.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 2000) })).catch(() => undefined);
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png`, timeout: 15000 }).catch(() => {});
} finally {
    report.qaHash = hash(await fs.readFile(new URL(import.meta.url)));
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close(); console.log(JSON.stringify({ target: report.target, pass: report.pass, error: report.error, scenarios: report.scenarios.map(s => ({ name: s.name, viewport: s.viewport, pass: s.pass })), captures: report.captures.length }, null, 2));
}
