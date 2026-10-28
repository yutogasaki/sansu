import { kokugoUnitButton } from './island-e2e-helpers.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { appRootMetadata, seedNative } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_KOKUGO_URL || 'http://127.0.0.1:5291';
const output = process.env.SANSU_KOKUGO_OUTPUT;
assert(output, 'Set a new output directory'); await fs.mkdir(output);
const report = { at: new Date().toISOString(), base, fixture: 'synthetic native owner; answers, preview exposure and work saves use real UI', captures: [], scenarios: [], errors: [], pass: false };
const browser = await chromium.launch(); let currentPage;
const read = (page, table) => page.evaluate(async table => {
    const request = indexedDB.open('SansuDatabase');
    const d = await new Promise((ok, fail) => { request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
    try { const req = d.transaction(table).objectStore(table).getAll(); return await new Promise((ok, fail) => { req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error); }); }
    finally { d.close(); }
}, table);
const pending = async page => (await read(page, 'kokugoPlans')).find(p => p.status === 'pending');
async function until(readValue, predicate) {
    for (let n = 0; n < 600; n++) { const value = await readValue(); if (predicate(value)) return value; await new Promise(ok => setTimeout(ok, 100)); }
    throw new Error('Persisted kanji state did not become ready');
}
const click = (page, name) => name instanceof RegExp && name.source === 'K01 ·' ? kokugoUnitButton(page, 'K01').click() : page.locator('.kokugo-screen').getByRole('button', { name, exact: true }).click();
async function capture(page, name) {
    const file = `${page.viewportSize().width}-${name}.png`, metadata = await appRootMetadata(page);
    assert.equal(metadata.islandFeatureEnabled, true); assert(metadata.version && metadata.revision);
    assert.equal(await page.evaluate(() => document.querySelector('.kokugo-content').scrollWidth > document.querySelector('.kokugo-content').clientWidth + 1), false);
    if (name.startsWith('scene-')) assert(await page.locator('.kokugo-passage').evaluate(element => element.getBoundingClientRect().top >= element.closest('.kokugo-content').getBoundingClientRect().top), 'Question starts at the top after a scrolled catalog');
    await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
    report.captures.push({ file, route: page.url(), metadata, swControlled: await page.evaluate(() => !!navigator.serviceWorker.controller), viewport: page.viewportSize() });
}
async function catalog(page, grade) {
    const heading = page.getByRole('heading', { name: '国語を まなぼう', exact: true });
    if (!await heading.isVisible()) await click(page, '内容を えらぶ');
    await page.getByLabel('学年の めやす', { exact: true }).selectOption(String(grade + 1)); await click(page, '漢字');
    await page.locator('#kokugo-kanji-search').fill('');
}
async function select(page, character, grade) {
    await page.getByRole('button', { name: new RegExp(`^${character} · 小学${grade}年(?: ·|$)`) }).click();
    await page.locator('.kokugo-kanji-detail h3').waitFor();
    assert((await page.locator('.kokugo-kanji-detail h3').innerText()).includes(character));
}
async function start(page, name) {
    await click(page, name);
    await page.locator('.kokugo-intro, .kokugo-question').first().waitFor();
    const intro = page.getByRole('button', { name: /^[23]もん やってみる$/ });
    if (await intro.isVisible()) await intro.click();
    return until(() => pending(page), p => !!p?.slots[p.cursor].presentation);
}
async function finish(page, { alternateFirst, reloadFirst = false } = {}) {
    let plan = await until(() => pending(page), p => !!p?.slots[p.cursor].presentation);
    const id = plan.id;
    for (let n = plan.cursor; n < plan.slots.length; n++) {
        plan = await until(() => pending(page), p => p?.id === id && p.cursor === n && !!p.slots[n].presentation);
        const slot = plan.slots[n];
        if (slot.item.audio && !slot.heard) { await click(page, '▶ ことばを きく'); await until(() => pending(page), p => p.slots[n].heard); }
        const answer = n === 0 && alternateFirst ? alternateFirst : slot.item.answer;
        if (slot.item.form === 'short') {
            await page.getByLabel('こたえ', { exact: true }).fill(answer);
            await until(() => pending(page), p => p.slots[n].draft === answer);
            await click(page, 'たしかめる');
        } else await click(page, answer);
        plan = await until(() => pending(page), p => !!p.slots[n].completedAt);
        if (n === 0 && reloadFirst) { const frozen = structuredClone(plan); await page.reload(); await page.locator('.kokugo-question').waitFor(); assert.deepEqual(await pending(page), frozen); }
        await click(page, n + 1 === plan.slots.length ? 'ここまで おわる' : 'つぎへ');
    }
    await page.getByRole('heading', { name: 'ここまで できたね', exact: true }).waitFor();
    return (await read(page, 'kokugoPlans')).find(p => p.id === id);
}
try {
    for (const width of [390, 768, 320]) {
        const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : width === 320 ? 568 : 844 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference', hasTouch: true });
        const page = currentPage = await context.newPage(); page.setDefaultTimeout(90000);
        const errors = []; page.on('pageerror', e => { errors.push(e.message); report.errors.push(e.stack); });
        await page.goto(`${base}/#/onboarding`); await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor();
        const owner = await seedNative(page, `kanji-${width}`);
        await page.goto(`${base}/#/kokugo`); await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor();
        const legacy = await read(page, 'islandPlans');
        for (const [g, count] of [[1, 80], [2, 160], [3, 200], [4, 202], [5, 193], [6, 191]]) {
            await catalog(page, g); assert.equal(await page.locator('.kokugo-kanji-grid button').count(), count);
        }
        await capture(page, 'grade-six');
        await catalog(page, 1); await select(page, '山', 1);
        await page.getByLabel('学年の めやす', { exact: true }).selectOption('5');
        await page.locator('.kokugo-kanji-detail').waitFor({ state: 'detached' });
        await catalog(page, 1); await select(page, '山', 1); await capture(page, 'character');
        let plan = await start(page, '読みを えらぶ'); assert(plan.slots.every(s => s.item.kanji === '山')); await capture(page, 'reading');
        await click(page, 'コースへ'); await click(page, '漢字');
        assert.equal(await page.locator('#kokugo-kanji-search').isDisabled(), true);
        assert.equal(await page.locator('.kokugo-kanji-grid button:enabled').count(), 0);
        await click(page, 'つづきから');
        const finished = await finish(page, { reloadFirst: true }); assert(finished.slots.every(s => s.completionKind === 'independent'));
        await catalog(page, 1); await select(page, '山', 1);
        plan = await start(page, '読みを えらぶ'); assert(plan.slots[0].item.passage);
        assert.equal(plan.slots[0].item.version, 'kokugo-kanji-3'); await capture(page, 'scene-reading');
        const scenes = await finish(page); assert(scenes.slots.slice(0, 2).every(s => s.item.passage && s.completionKind === 'independent'));
        await catalog(page, 1); await select(page, '右', 1); await start(page, '読みを 入力');
        const short = await finish(page, { alternateFirst: 'ミギ' }); assert(short.slots[0].firstAnswer.correct);
        await catalog(page, 1); await select(page, '川', 1); await click(page, '読みと ことばの例を 見る');
        await page.locator('.kokugo-kanji-model ruby').first().waitFor(); await capture(page, 'model');
        const beforePreview = await read(page, 'kokugoOutbox');
        await start(page, '読みを えらぶ'); const supported = await finish(page);
        assert(supported.slots.every(s => s.completionKind === 'assisted')); assert.equal((await read(page, 'kokugoOutbox')).length, beforePreview.length + supported.slots.length);
        await catalog(page, 1); await select(page, '花', 1); await click(page, '紙に 書く');
        await page.getByLabel('漢字の手本', { exact: true }).waitFor(); await click(page, '手本を 閉じる');
        assert.equal(await page.getByLabel('漢字の手本', { exact: true }).count(), 0);
        assert.equal(await page.locator('#kokugo-topic').count(), 0, 'The topic selector cannot reveal the concealed model');
        await capture(page, 'paper-concealed'); await click(page, '手本と 見くらべる');
        await page.getByLabel('作品・メモ', { exact: true }).fill('花を 紙に書いて、上と下を 見くらべた。');
        await click(page, '作品に のこす');
        await until(() => read(page, 'kokugoWorks'), rows => rows.some(w => w.unitId === 'HP1' && w.saved)); await capture(page, 'paper-saved');
        await page.reload(); await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor();
        await catalog(page, 1); await select(page, '花', 1); await click(page, '紙に 書く');
        await until(() => page.getByLabel('作品・メモ', { exact: true }).inputValue(), text => text === '花を 紙に書いて、上と下を 見くらべた。');
        await click(page, 'コースへ'); await catalog(page, 4);
        await page.locator('#kokugo-kanji-search').fill('えひめ'); assert.equal(await page.locator('.kokugo-kanji-grid button').count(), 1);
        await select(page, '媛', 4); await capture(page, 'prefecture-search');
        plan = await start(page, '読みを えらぶ'); assert.equal(plan.slots.length, 3); assert(plan.slots.every(s => s.item.kanji === '媛'));
        const ehime = await finish(page); assert(ehime.slots.every(s => s.completionKind === 'assisted'));
        await catalog(page, 6); await select(page, '臓', 6); plan = await start(page, '漢字を えらぶ');
        await finish(page); await catalog(page, 6); await select(page, '臓', 6); plan = await start(page, '漢字を えらぶ');
        assert(plan.slots[0].item.passage && !plan.slots[0].item.passage.includes('臓'));
        await capture(page, 'scene-spelling-concealed');
        const frozen = structuredClone(plan); await page.evaluate(async () => { await navigator.serviceWorker.ready; });
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        await context.setOffline(true); await page.reload(); await page.locator('.kokugo-question').waitFor();
        assert.deepEqual(await pending(page), frozen); await capture(page, 'offline-resume');
        await context.setOffline(false); await finish(page);
        await click(page, '内容を えらぶ');
        await page.getByLabel('学年の めやす', { exact: true }).selectOption('0');
        const heardIds = [];
        for (let section = 0; section < 4; section++) {
            if (section) await click(page, '内容を えらぶ');
            await click(page, 'かな'); await start(page, /K01 ·/);
            const listening = await finish(page); heardIds.push(...listening.slots.map(s => s.item.id));
            if (section === 3) await capture(page, 'expanded-listening');
        }
        assert.equal(new Set(heardIds).size, 12);
        assert.deepEqual(await read(page, 'islandPlans'), legacy);
        assert.equal(errors.length, 0);
        report.scenarios.push({ width, owner, gradeCounts: [80, 160, 200, 202, 193, 191], focusedReload: true, alternateReading: true,
            twoNovelScenes: true, spellingSceneMasked: true, twelveAudioExamples: true, referenceExposureAssisted: true, paperConcealedWithoutTopicLeak: true, paperSaved: true, prefectureReading: true, offline: true, legacyPlanPreserved: true, pass: true });
        await context.close();
    }
    report.pass = true;
} catch (error) {
    report.failure = String(error.stack || error);
    if (currentPage) { await currentPage.screenshot({ path: `${output}/failure.png` }).catch(() => undefined); await fs.writeFile(`${output}/failure.txt`, await currentPage.locator('body').innerText().catch(() => '')); }
    throw error;
} finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
