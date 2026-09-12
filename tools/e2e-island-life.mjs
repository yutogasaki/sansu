import { chromium } from 'playwright';
import { Matrix4, Vector3 } from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const base = process.env.SANSU_ISLAND_LIFE_URL, out = process.env.SANSU_ISLAND_LIFE_OUTPUT;
assert(base && out, 'Specify the DEV island life target and fresh output directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { target: base, flag: 'DEV + VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'island-life-garden-v6', humanN: 0, clock: 'explicit DEV time advance; not real overnight evidence', scenarios: [] };
try {
 for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet-reduced', { width: 768, height: 1024 }, 'reduce']]) {
    const context = await browser.newContext({ viewport, reducedMotion, hasTouch: true }); const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
    const healthy = async () => {
        await page.locator('.life-world[data-rendered="true"]').waitFor();
        assert.equal(await page.getByText('景色をひらけなかったよ。下の一覧から選べるよ。').count(), 0);
        assert.equal(await page.locator('.life-world canvas').count(), 1);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page-level horizontal overflow');
    };
    const capture = async stage => { await healthy(); await page.locator('.life-wallet').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/${name}-${stage}.png` }); };
    const poses = () => page.locator('.life-world').evaluate(e => JSON.parse(e.dataset.lifePoses || '[]'));
    await page.goto(base);
    await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
    await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
    await page.getByRole('button', { name: 'さんすう', exact: true }).click();
    await page.getByRole('button', { name: '足し算まで', exact: true }).click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('[data-life-candidate] .life-world[data-rendered="true"]').waitFor();
    await capture('initial');
    assert.equal(await page.locator('[data-life-candidate]').getAttribute('data-life-candidate'), report.candidate);
    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), '0');
    await page.locator('.life-learn').click();
    let native = await readNative(page), tries = 0;
    const firstCount = native.island.completedSets;
    while (native.island.completedSets < firstCount + 6 && tries++ < 70) native = (await attempt(page, native)).after;
    assert(tries < 70, 'Real normal learning must complete enough sections');
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) >= 54);
    const nativeBefore = await readNative(page);
    const canvas = await page.locator('.life-world canvas').elementHandle();
    const openLifePanel = async () => {
        const group = page.getByRole('group', { name: 'しまの ていれ' });
        if (!await group.isVisible().catch(() => false)) {
            await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
            await group.waitFor();
        }
        return group;
    };
    const selectTab = async label => { await (await openLifePanel()).getByRole('button', { name: label, exact: true }).click(); };
    const worldCell = async (x, z, expanded = false) => {
        await page.locator('.life-wallet').scrollIntoViewIfNeeded();
        const box = await page.locator('.life-world canvas').boundingBox();
        const matrices = JSON.parse(await page.locator('.life-world').getAttribute('data-life-camera'));
        const point = new Vector3(x - (expanded ? 4 : 2.5), .085, z - 2)
            .applyMatrix4(new Matrix4().fromArray(matrices.view)).applyMatrix4(new Matrix4().fromArray(matrices.projection));
        await page.touchscreen.tap(box.x + (point.x + 1) / 2 * box.width, box.y + (1 - point.y) / 2 * box.height);
        assert.equal(await page.locator('.life-placement').getAttribute('data-life-placement-cell'), `${x},${z}`);
    };
    const ownedBeforePreview = await page.locator('[data-life-drops]').getAttribute('data-life-drops');
    await selectTab('つくる');
    await page.locator('[data-life-buy="bench"]').click();
    await worldCell(4, 4);
    assert(await page.getByRole('button', { name: 'ここに おく', exact: true }).isDisabled());
    await page.getByText('まえを ひとマス あけて おこう。', { exact: true }).waitFor();
    await capture('placement-blocked');
    await worldCell(4, 2);
    assert(await page.getByRole('button', { name: 'ここに おく', exact: true }).isEnabled());
    assert(await page.getByRole('button', { name: 'ここに おく', exact: true }).evaluate(e => {
        const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
    }), 'Confirm stays in the same viewport as the island');
    await capture('placement-ready');
    await page.locator('.life-placement').getByRole('button', { name: 'やめる', exact: true }).click();
    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), ownedBeforePreview);
    assert.equal(await page.locator('[data-life-items]').getAttribute('data-life-items'), '0');
    const buy = async (kind, cell) => {
        console.log(`${name}: buy ${kind} at ${cell}`);
        await selectTab('つくる'); await page.locator(`[data-life-buy="${kind}"]`).click();
        const details = page.locator('.life-placement details'); if (!await details.evaluate(e => e.open)) await details.locator('summary').click();
        await page.locator(`[data-life-cell="${cell}"]`).click(); await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
        await page.locator('.life-placement').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.life-error').count(), 0);
        await healthy();
        assert(await canvas.evaluate(e => e.isConnected), 'Keep the renderer while editing instead of exhausting WebGL contexts');
    };
    await selectTab('ひろげる'); await page.getByRole('button', { name: 'みぎへ ひろげる', exact: true }).click();
    await page.getByText('ひろがった しまに、すきな ばしょを つくろう。').waitFor();
    await page.evaluate(() => {
        window.__lifeEmotes = [];
        const root = document.querySelector('.life-world');
        const observer = new MutationObserver(() => {
            for (const badge of root.querySelectorAll('[data-life-emote]:not([hidden])')) {
                const box = badge.getBoundingClientRect();
                if (box.top >= 0 && box.bottom <= innerHeight) window.__lifeEmotes.push({ id: badge.dataset.lifeEmote, symbol: badge.textContent });
            }
        });
        observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
        window.__lifeEmoteObserver = observer;
    });
    await buy('flower', '0,2');
    await page.waitForFunction(() => window.__lifeEmotes.some(e => e.id === 'rabbit' && e.symbol === '!'));
    await capture('noticed');
    await page.waitForFunction(reduced => {
        const r = JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').find(p => p.id === 'rabbit');
        return r?.reaction === '♪' && (reduced ? r.hop === 0 : r.hop > .02);
    }, reducedMotion === 'reduce');
    await capture('flower-delight');
    await page.evaluate(() => window.__lifeEmoteObserver.disconnect());
    for (const cell of ['1,2', '2,2', '0,3', '1,3', '2,3']) await buy('flower', cell);
    for (const cell of ['4,3', '5,3', '6,3']) await buy('swing', cell);
    await buy('bench', '4,1');
    await page.waitForFunction(() => JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').some(p => p.phase === 'bench' && p.seatGap < 1e-8));
    await capture('bench-rest');
    await selectTab('つくる'); await page.locator('[data-life-buy="flower"]').click();
    await worldCell(4, 2, true);
    assert(await page.getByRole('button', { name: 'ここに おく', exact: true }).isDisabled());
    await page.getByText('みんなの とおりみちを あけて おこう。', { exact: true }).waitFor();
    await page.locator('.life-placement summary').click();
    assert(await page.locator('[data-life-cell="4,2"]').isDisabled(), 'List and world protect the same occupied approach');
    await page.locator('.life-placement').getByRole('button', { name: 'やめる', exact: true }).click();
    await buy('lantern', '6,1');
    const lastItemCount = Number(await page.locator('[data-life-items]').getAttribute('data-life-items')); assert.equal(lastItemCount, 11);
    assert.match(await page.locator('[data-life-districts]').getAttribute('data-life-districts'), /ゆうえんち/);
    await capture('planted');
    const dev = page.locator('.life-dev'); await dev.locator('summary').click();
    await page.getByRole('button', { name: '試作を 6時間すすめる', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-life-districts]')?.dataset.lifeDistricts.includes('おはなばたけ'));
    await page.waitForFunction(() => JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').every(p => p.phase !== 'walking'));
    await capture('grown');
    const allItems = await page.locator('[data-life-item]').evaluateAll(items => items.map(i => ({ id: i.dataset.lifeItem, text: i.textContent })));
    const occupied = new Set((await poses()).map(p => p.itemId));
    const swing = allItems.find(i => i.text.startsWith('ブランコ') && !occupied.has(i.id));
    assert(swing, 'There is a free swing among the three built with normal learning');
    await page.locator(`[data-life-item="${swing.id}"]`).click();
    await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click();
    await page.waitForFunction(id => JSON.parse(document.querySelector('.life-world')?.dataset.lifePoses || '[]').some(p => p.id === 'pokomoko' && p.itemId === id && p.phase === 'swing' && p.seatGap < 1e-8), swing.id);
    await capture('swing-use');
    const seated = (await poses()).find(p => p.id === 'pokomoko');
    await page.waitForTimeout(700);
    const swung = (await poses()).find(p => p.id === 'pokomoko');
    assert(swung.seatGap < 1e-8);
    if (reducedMotion === 'reduce') assert.deepEqual(swung.position, seated.position);
    else assert.notDeepEqual(swung.position, seated.position, 'Actor moves with the swing seat');
    await selectTab('もちもの'); await page.locator('[data-life-item]').first().click();
    const requestedItem = await page.locator('[data-life-item]').first().getAttribute('data-life-item');
    await page.getByRole('button', { name: 'ぽこもこを よぶ', exact: true }).click();
    await page.waitForFunction(id => document.querySelector('[data-life-candidate]')?.dataset.lifeDestination === id, requestedItem);
    const dropsBeforeStyle = await page.locator('[data-life-drops]').getAttribute('data-life-drops');
    await selectTab('いろ'); await page.getByRole('button', { name: 'ぽこもこの いろ', exact: true }).click();
    await page.locator('[data-life-style="starlight"]').click(); await page.getByText('いろが かわったよ。いつでも もどせるよ。').waitFor();
    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), dropsBeforeStyle);
    await capture('style');
    await selectTab('もちもの'); await page.locator('[data-life-item]').first().click();
    await page.getByRole('button', { name: 'うごかす', exact: true }).click();
    await worldCell(0, 1, true); await capture('move-preview');
    assert(await page.getByRole('button', { name: 'ここに おく', exact: true }).isEnabled());
    await page.locator('.life-placement').getByRole('button', { name: 'やめる', exact: true }).click();
    assert.match(await page.locator('[data-life-districts]').getAttribute('data-life-districts'), /おはなばたけ/);
    await page.getByRole('button', { name: 'しまう', exact: true }).click();
    await page.getByText('そだったまま しまったよ。').waitFor();
    await page.getByRole('button', { name: 'おく', exact: true }).click();
    await page.locator('.life-placement summary').click(); await page.locator('[data-life-cell="0,2"]').click();
    await page.getByRole('button', { name: 'ここに おく', exact: true }).click(); await page.locator('.life-placement').waitFor({ state: 'hidden' });
    assert.match(await page.locator('[data-life-districts]').getAttribute('data-life-districts'), /おはなばたけ/);
    await page.getByRole('button', { name: 'とりのぞく', exact: true }).click();
    await page.locator('.life-confirm').getByRole('button', { name: 'やめる', exact: true }).click();
    assert.equal(Number(await page.locator('[data-life-items]').getAttribute('data-life-items')), lastItemCount);
    await page.getByRole('button', { name: 'とりのぞく', exact: true }).click();
    await page.getByRole('button', { name: 'とりのぞくと きめる', exact: true }).click(); await page.getByText('しずくが もどったよ。').waitFor();
    assert.equal(Number(await page.locator('[data-life-items]').getAttribute('data-life-items')), lastItemCount - 1);
    await healthy(); assert(await canvas.evaluate(e => e.isConnected));
    assert.deepEqual(await readNative(page), nativeBefore, 'Only the independent DEV database changes when building, advancing and using residents');
    const beforeReload = await page.locator('[data-life-drops]').getAttribute('data-life-drops');
    await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), beforeReload);
    await page.locator('.life-learn').click(); await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    assert.equal(await page.locator('.life-world').count(), 0, 'Scene unmounts during learning');
    assert.equal((await readNative(page)).plan.id, nativeBefore.plan.id, 'Resume the saved normal reservation');
    await page.screenshot({ path: `${out}/${name}-resume.png` });
    await attempt(page, await readNative(page));
    assert.deepEqual(errors, []);
    report.scenarios.push({ name, viewport, reducedMotion, normalAttempts: tries, completedSections: 6, sourceStoresUnchanged: true, items: lastItemCount,
        placement: { touch: true, frontAccessBlocked: true, existingPathProtected: true, cancelPreservesOwnership: true, confirmInViewport: true },
        reactions: { newFavorite: '!', enjoyedFavorite: '♪', reducedMotionRespected: true }, swingContact: { seated, swung }, errors, pass: true });
    console.log(`${name}: normal learning, choice, expansion, maturity, residents, style, storage and resume PASS`);
    } catch (error) {
        await page.screenshot({ path: `${out}/${name}-failure.png` });
        await writeFile(`${out}/${name}-failure.json`, JSON.stringify({ message: String(error), url: page.url(), body: await page.locator('body').innerText(), errors }, null, 2));
        throw error;
    } finally { await context.close(); }
 }
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
