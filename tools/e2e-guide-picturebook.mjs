import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDev, runtimeMetadata, readNative } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_GUIDE_ART_URL || 'http://127.0.0.1:5260';
const out = process.env.SANSU_GUIDE_ART_OUTPUT;
assert(out, 'Provide a fresh output directory'); await fs.mkdir(out, { recursive: false });
async function sources() {
    const paths = execFileSync('rg', ['--files', 'src', 'public'], { encoding: 'utf8' }).trim().split('\n');
    paths.push('tools/e2e-guide-picturebook.mjs', 'tools/island-e2e-helpers.mjs', 'package-lock.json', 'vite.config.ts');
    return Object.fromEntries(await Promise.all(paths.sort().map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
}
const report = { target: base, fixture: 'Explicit saved A1–A6 snapshots; not evidence of real acquisition',
    initialSources: await sources(), captures: [], errors: [], checks: [], pass: false };
const browser = await chromium.launch(); let current;
const book = page => page.locator('.growing-guide-book');
async function ready(page) {
    await page.locator('[data-growing-island="ready"] [data-growing-world] canvas').waitFor();
    await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' });
}
async function visibleAction(page, detail) {
    const action = detail.getByRole('button').first();
    const a = await action.boundingBox(), panel = await book(page).locator('.growing-guide-page').boundingBox();
    assert(a && panel && a.y >= panel.y && a.y + a.height <= panel.y + panel.height,
        `Primary action must be visible without scrolling: ${JSON.stringify({ a, panel })}`);
    assert(await action.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), 'Primary action must not be covered by navigation');
}
async function capture(page, name) {
    if (await book(page).count()) await book(page).locator('.growing-guide-illustration').first().waitFor();
    await page.locator('.growing-guide-illustration').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.waitForTimeout(150);
    const file = `${page.viewportSize().width}-${name}.png`; await page.screenshot({ path: `${out}/${file}` });
    report.captures.push({ file, ...await runtimeMetadata(page), candidate: await book(page).count() ? await book(page).getAttribute('data-visual-candidate') : null,
        cache: 'DEV; no SW claim', reducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) });
}
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = current = await context.newPage(); page.setDefaultTimeout(30000);
        page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(`${base}/#/island`); await capture(page, 'launch');
        const id = await seedDev(page, { familiar: false }); await page.reload(); await ready(page); await capture(page, 'island');
        await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
        await page.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
        await capture(page, 'starter');
        await book(page).locator('summary').tap();
        for (const goal of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) {
            await book(page).locator(`[data-guidance-goal="${goal}"]`).tap();
            await book(page).locator('.growing-guide-page').evaluate(node => { node.scrollTop = 0; });
            await capture(page, `try-${goal}`);
            await visibleAction(page, book(page).locator('.growing-guide-detail'));
        }
        await book(page).getByRole('button', { name: 'とじる', exact: true }).tap();
        await page.evaluate(async id => {
            const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
            if (growingDb.name !== 'SansuGrowingIslandPreviewV1') throw Error('Only disposable DEV database allowed');
            const record = await growingDb.islands.get(id), state = record.state;
            const farm = { id: 'fixture-farm', kind: 'farm', cell: { x: 4, z: 3 }, plantedAt: 0, builtAt: 6, stage: 1, style: 'flower', growth: 0, origin: 'seed', paid: 4 };
            const resident = { id: 'fixture-otter', species: 'otter', variant: { color: 3, accessory: 1, sparkle: false }, trait: 'mellow', home: 'pokomoko', arrivedAt: 1 };
            const bench = state.landmarks.find(p => p.kind === 'bench');
            const bandstand = { id: 'fixture-music', kind: 'bandstand', cell: { x: 1, z: 3 }, growth: 0 };
            state.plots.push(farm); state.villagers.push(resident); state.landmarks.push(bandstand); state.land.expanded = 'east';
            const proof = (target, at) => ({ source: 'explicit-visual-fixture', at, ...(target ? { targetId: target.id } : {}), snapshot: { flagColor: 2, ...(target ? { target: structuredClone(target) } : {}) } });
            const memories = { A1: proof(resident, 1), A2: proof(farm, 6), A3: { ...proof(undefined, 3), targetId: 'flag' }, A4: proof(bench, 4), A5: proof(bandstand, 5), A6: { ...proof(undefined, 2), snapshot: { flagColor: 2, land: structuredClone(state.land) } } };
            state.guidance.achievements = memories; state.guidance.notified = Object.keys(memories); state.guidance.starter.automatic = false;
            state.flagColor = 5; // Current purple must not replace remembered yellow.
            record.revision++; await growingDb.islands.put(record);
        }, id);
        await page.reload(); await ready(page);
        const nativeBefore = await readNative(page, id);
        await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
        await page.getByRole('button', { name: 'しまの あそびかた', exact: true }).tap();
        await book(page).getByRole('tab', { name: 'できたこと', exact: true }).tap();
        const snapshots = {};
        for (const goal of ['A2', 'A1', 'A3', 'A4', 'A5', 'A6']) {
            if (!await page.locator(`[data-guidance-memory="${goal}"]`).count()) await book(page).locator(`[data-guidance-goal="${goal}"]`).tap();
            const detail = page.locator(`[data-guidance-memory="${goal}"]`);
            await detail.locator('[data-memory-picture]').waitFor();
            await book(page).locator('.growing-guide-page').evaluate(node => { node.scrollTop = 0; });
            snapshots[goal] = await detail.locator('[data-memory-picture]').getAttribute('src');
            await capture(page, `memory-${goal}`);
            await visibleAction(page, detail);
            const illustration = await detail.locator('.growing-guide-illustration').boundingBox();
            const personal = await detail.locator('.growing-guide-personal').boundingBox();
            assert(illustration.x + illustration.width <= personal.x, 'Saved model must not overlap the illustration');
            assert(await detail.locator('.growing-guide-personal > span').evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 12));
        }
        assert.equal(new Set(Object.values(snapshots)).size, 6, 'Every memory depicts its recorded model');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.keyboard.press('Escape'); await book(page).waitFor({ state: 'hidden' });
        assert.deepEqual(await readNative(page, id), nativeBefore, 'Reading never changes learning');
        await page.getByRole('button', { name: /^まなぶ/ }).tap(); await page.locator('[data-input-ready="true"]').waitFor();
        await capture(page, 'learning-return');
        report.checks.push({ viewport, distinctModels: 6, navigation: true, noLearningWrite: true,
            initialActionVisible: 'all 6 invitations and all 6 memories', separatedMemory: true, captionMin12px: true });
        await context.close();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(await sources(), report.initialSources); report.pass = true;
} catch (error) {
    report.error = error.stack || String(error); if (current) await current.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
