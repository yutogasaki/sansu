import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { seedDev, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_EXPANSION_VISIBILITY_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_EXPANSION_VISIBILITY_OUTPUT;
assert(out && new URL(base).hostname === '127.0.0.1', 'Fresh output and local DEV URL required');
await fs.mkdir(out, { recursive: false });
const paths = ['src/components/island/growing/GrowingIsland.tsx', 'src/components/island/growing/GrowingHomeTools.tsx', 'src/components/island/growing/growingExpansion.ts', 'src/components/island/growing/quietHome.css', 'src/domain/growingIsland/commands.ts', 'src/domain/growingIsland/rules.ts', 'src/domain/growingIsland/repository.ts', 'tools/e2e-growing-expansion-visibility.mjs'];
const sources = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const report = { at: new Date().toISOString(), scope: 'Disposable DEV profiles with explicit three-expansion/level fixtures. No acquisition, production save, PWA, device or child-comprehension claim.', initialSources: await sources(), captures: [], cases: [], pass: false };
const browser = await chromium.launch();
let page;
const ready = async () => { await page.locator('[data-growing-island="ready"]').waitFor(); await page.locator('.growing-loading--overlay').waitFor({ state: 'hidden' }); };
const snapshot = id => page.evaluate(async id => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    const record = await growingDb.islands.get(id);
    return { land: record.state.land, drops: record.state.drops };
}, id);
const fixture = (id, cape, unlocked = false) => page.evaluate(async ({ id, cape, unlocked }) => {
    const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
    const { RULES } = await import('/src/domain/growingIsland/rules.ts');
    assertDev(growingDb.name); function assertDev(name) { if (name !== 'SansuGrowingIslandPreviewV1') throw Error('DEV DB only'); }
    const record = await growingDb.islands.get(id), state = record.state;
    state.tutorial = 'done'; state.guidance.starter.automatic = false;
    state.land = { expanded: 'west', extra: ['east', 'south'], capes: cape ? ['east'] : [] };
    state.genki.best = RULES.genkiLevels[(cape ? 4 : 3) + Number(unlocked)];
    state.drops = 1148; state.unopened = []; state.arrivals = [];
    await growingDb.islands.put({ ...record, state, revision: record.revision + 1 });
}, { id, cape, unlocked });
const capture = async label => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const file = `${page.viewportSize().width}x${page.viewportSize().height}-${label}.png`;
    await page.screenshot({ path: `${out}/${file}` });
    const runtime = await runtimeMetadata(page); assert.equal(runtime.islandFeatureEnabled, true);
    report.captures.push({ file, runtime });
};
try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 568 ? 'reduce' : 'no-preference' });
        page = await context.newPage(); page.setDefaultTimeout(30000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/island`); const id = await seedDev(page, { familiar: false, name: '土地の確認' });
        await page.reload(); await ready();
        for (const cape of [false, true]) {
            const requiredLevel = cape ? 6 : 5, price = cape ? 960 : 720;
            await fixture(id, cape); await page.reload(); await ready();
            const before = await snapshot(id), entry = page.getByRole('button', { name: 'しまを ひろげる', exact: true });
            await entry.waitFor(); assert((await entry.innerText()).includes(`島Lv${requiredLevel}から`));
            assert.equal(await entry.isEnabled(), true);
            const hit = await entry.boundingBox(); assert(hit && hit.width >= 44 && hit.height >= 44 && hit.y >= 0 && hit.y + hit.height <= viewport.height);
            assert.equal(await entry.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
            await capture(`locked-${requiredLevel}-home`); await entry.tap();
            const panel = page.getByRole('region', { name: 'しまを ひろげる', exact: true });
            await panel.waitFor(); assert((await panel.innerText()).includes(`島Lv${requiredLevel}で 次の土地が ひらくよ`));
            assert((await panel.innerText()).includes(String(price)));
            assert.equal(await panel.locator('.growing-expansion-choices button').count(), 0);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await capture(`locked-${requiredLevel}-explanation`);
            await panel.getByRole('button', { name: 'ひろげるを とじる' }).press('Escape');
            await page.waitForFunction(() => document.activeElement?.matches('.growing-home-expand'));
            assert.deepEqual(await snapshot(id), before, 'Opening/exiting a locked expansion must not acquire land or charge drops');
            await fixture(id, cape, true); await page.reload(); await ready();
            await entry.tap(); await panel.waitFor();
            const choices = panel.locator('.growing-expansion-choices button');
            assert((await choices.count()) > 0); assert.equal(await panel.locator('.growing-expansion-choices button:disabled').count(), 0);
            assert((await choices.first().innerText()).includes(String(price)));
            await capture(`unlocked-${requiredLevel}-choices`);
            await panel.getByRole('button', { name: 'ひろげるを とじる' }).tap();
            report.cases.push({ viewport, requiredLevel, price, balance: 1148, pass: true });
        }
        assert.deepEqual(errors, []); await context.close();
    }
    report.finalSources = await sources(); assert.deepEqual(report.finalSources, report.initialSources); report.pass = true;
    console.log('PASS expansion visibility: both level gates and unlocks at 3 viewports');
} catch (error) {
    report.error = error.stack;
    if (page) await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    throw error;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close();
}
