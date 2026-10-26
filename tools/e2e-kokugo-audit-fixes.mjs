import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { seedNative, appRootMetadata } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_KOKUGO_URL || 'http://127.0.0.1:5294';
const output = process.env.SANSU_KOKUGO_OUTPUT;
assert(output, 'Set a new SANSU_KOKUGO_OUTPUT directory'); await fs.mkdir(output);
const browser = await chromium.launch(); let currentPage;
const report = { at: new Date().toISOString(), base, fixture: 'isolated synthetic native profile; real topic/answer/save operations; no real user data', scenarios: [], captures: [], pass: false };
const click = (page, name) => page.locator('.kokugo-screen').getByRole('button', { name, exact: true }).click();
async function read(page, table) {
    return page.evaluate(async table => {
        const request = indexedDB.open('SansuDatabase');
        const d = await new Promise((ok, fail) => { request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
        try { const r = d.transaction(table).objectStore(table).getAll(); return await new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); }); }
        finally { d.close(); }
    }, table);
}
async function until(readValue, predicate) {
    for (let i = 0; i < 400; i++) { const value = await readValue(); if (predicate(value)) return value; await new Promise(ok => setTimeout(ok, 50)); }
    throw new Error('Persisted audit-fix state did not become ready');
}
const pending = async page => (await read(page, 'kokugoPlans')).find(p => p.status === 'pending');
async function capture(page, name) {
    const file = `${page.viewportSize().width}-${name}.png`, metadata = await appRootMetadata(page);
    assert(metadata.revision && metadata.version); assert.equal(metadata.islandFeatureEnabled, true);
    assert.equal(await page.locator('.kokugo-content').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' }); report.captures.push({ file, metadata, viewport: page.viewportSize(), route: page.url() });
}
async function catalog(page) {
    if (await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).isVisible()) return;
    if (await page.getByRole('button', { name: '内容を えらぶ', exact: true }).isVisible()) await click(page, '内容を えらぶ'); else await click(page, 'コースへ');
    await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor();
}
async function startKanji(page, g, c, kind) {
    await catalog(page); await page.getByLabel('学年の めやす', { exact: true }).selectOption(String(g + 1)); await click(page, '漢字');
    await page.getByRole('button', { name: new RegExp(`^${c} · 小学${g}年`) }).click(); await page.locator('.kokugo-kanji-detail h3').waitFor();
    await click(page, kind); await page.locator('.kokugo-intro, .kokugo-question').first().waitFor();
    const intro = page.getByRole('button', { name: '3もん やってみる', exact: true }); if (await intro.isVisible()) await intro.click();
    return until(() => pending(page), p => !!p?.slots[p.cursor].presentation);
}
async function finish(page, inspect = async () => {}, answerFor = slot => slot.item.answer, unknownNumber = false) {
    let p = await until(() => pending(page), p => !!p?.slots[p.cursor].presentation); const id = p.id;
    for (let n = p.cursor; n < p.slots.length; n++) {
        p = await until(() => pending(page), p => p?.id === id && p.cursor === n && !!p.slots[n].presentation); const slot = p.slots[n]; await inspect(slot);
        const numberScene = unknownNumber && slot.item.id === 'HT2-4f55-scene-s2';
        const answer = numberScene ? 'なにじん' : answerFor(slot);
        if (slot.item.form === 'short') { await page.getByLabel('こたえ', { exact: true }).fill(answer); await until(() => pending(page), p => p.slots[n].draft === answer); await click(page, 'たしかめる'); }
        else await click(page, answer);
        if (numberScene) {
            p = await until(() => pending(page), p => p.slots[n].support === 'model');
            assert.equal(p.slots[n].firstAnswer.correct, null); assert.equal(p.slots[n].completedAt, undefined);
            await capture(page, 'number-context-alternative'); await click(page, 'たしかめて おわる');
        }
        await until(() => pending(page), p => !!p.slots[n].completedAt);
        await click(page, n + 1 === p.slots.length ? 'ここまで おわる' : 'つぎへ');
    }
    await page.getByRole('heading', { name: 'ここまで できたね', exact: true }).waitFor(); return (await read(page, 'kokugoPlans')).find(p => p.id === id);
}
try {
    for (const width of [390, 768, 320]) {
        const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : width === 320 ? 568 : 844 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = currentPage = await context.newPage(); page.setDefaultTimeout(60000); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${base}/#/onboarding`); await page.getByRole('button', { name: 'しまへ いく', exact: true }).waitFor(); const owner = await seedNative(page, `audit-fixes-${width}`);
        await page.goto(`${base}/#/kokugo`); await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor(); await click(page, '伝える'); await page.getByRole('button', { name: /E05 ·/ }).click();
        const input = page.getByLabel('作品・メモ', { exact: true }), topic = page.locator('#kokugo-topic');
        const waitEditor = () => until(() => input.isEnabled(), Boolean);
        const save = async text => { await input.fill(text); await click(page, '作品に のこす'); await page.getByText('作品に のこしたよ。', { exact: true }).waitFor(); await until(() => topic.isEnabled(), Boolean); };
        await waitEditor(); await save('お題一の保存文'); await topic.selectOption('1'); await waitEditor(); assert.equal(await input.inputValue(), '');
        assert.equal(await page.getByRole('button', { name: '作品に のこす', exact: true }).isDisabled(), true);
        await save('お題二の保存文'); await topic.selectOption('0'); await waitEditor(); assert.equal(await input.inputValue(), 'お題一の保存文');
        await click(page, '作品に のこす'); await page.getByText('作品に のこしたよ。', { exact: true }).waitFor(); await capture(page, 'topic-one-retained');
        await until(() => topic.isEnabled(), Boolean); await topic.selectOption('2'); await waitEditor(); assert.equal(await input.inputValue(), '');
        await input.fill('お題三の下書き'); await until(() => read(page, 'kokugoWorks'), rows => rows.some(w => w.id === `${owner}:E05-3` && w.text === 'お題三の下書き'));
        await page.reload(); await page.getByRole('heading', { name: '国語を まなぼう', exact: true }).waitFor(); await click(page, '伝える'); await page.getByRole('button', { name: /E05 ·/ }).click();
        await waitEditor(); assert.equal(await input.inputValue(), 'お題一の保存文'); await topic.selectOption('1'); await waitEditor(); assert.equal(await input.inputValue(), 'お題二の保存文');
        await topic.selectOption('2'); await waitEditor(); assert.equal(await input.inputValue(), 'お題三の下書き');
        const works = await read(page, 'kokugoWorks'); assert.equal(works.find(w => w.id === `${owner}:E05-1`).text, 'お題一の保存文'); assert.equal(works.find(w => w.id === `${owner}:E05-2`).text, 'お題二の保存文');
        await catalog(page); await click(page, '漢字'); const modelStart = Date.now(); await page.getByRole('button', { name: /H06 ·/ }).click();
        await page.getByText('書いたら「川」と 見くらべよう。線の数や 向きを 見てみよう。', { exact: true }).waitFor();
        const contact = await read(page, 'kokugoProgress'); assert.equal(contact.length, 9);
        for (const row of contact) { assert(row.independentAfter >= modelStart + 86400000); assert.deepEqual(row.seenExposures, [`${row.target}:isolated`]); assert.equal(row.independentItems.length, 0); }
        await capture(page, 'h06-contact'); await startKanji(page, 1, '川', '漢字を えらぶ'); const supported = await finish(page); assert(supported.slots.every(s => s.completionKind === 'assisted'));
        const checked = [];
        for (const [g, c, reading, mask] of [[5, '桜', 'さくらいろ', '□色'], [2, '頭', 'あたまのうえ', '□の上']]) {
            await startKanji(page, g, c, '漢字を えらぶ');
            await finish(page, async slot => { assert.equal(slot.item.version, 'kokugo-kanji-3'); if (slot.item.prompt.includes(reading)) { assert.equal(slot.item.prompt, `「${reading}」と読む「${mask}」。□に 入る漢字は？`); checked.push(c); await capture(page, `word-${c}`); } });
        }
        assert.deepEqual(checked, ['桜', '頭']);
        await startKanji(page, 2, '何', '読みを 入力'); const lexical = await finish(page, undefined, slot => !slot.item.passage && slot.item.prompt.includes('何人') ? 'なにじん' : slot.item.answer);
        assert(lexical.slots.some(s => s.firstAnswer?.answer === 'なにじん' && s.firstAnswer.correct));
        await startKanji(page, 2, '何', '読みを 入力'); const contextPlan = await finish(page, undefined, undefined, true);
        const number = contextPlan.slots.find(s => s.item.id === 'HT2-4f55-scene-s2'); assert(number); assert.equal(number.completionKind, 'assisted');
        assert((await read(page, 'kokugoProgress')).every(p => !p.independentItems.includes('HT2-4f55-scene-s2')));
        assert.deepEqual(errors, []); report.scenarios.push({ width, owner, topicSwitchAndReload: true, threeDistinctWorks: true, h06GlyphOnlyContact: true, h06ImmediateAssisted: true, phrasePrompts: checked, lexicalAlternativeAccepted: true, contextualAlternativeNotIndependent: true, pass: true }); await context.close();
    }
    report.pass = true;
} catch (error) { report.error = String(error.stack || error); if (currentPage && !currentPage.isClosed()) { await currentPage.screenshot({ path: `${output}/failure.png` }); report.body = (await currentPage.locator('body').innerText()).slice(0, 6000); } process.exitCode = 1; }
finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios.length, error: report.error })); }
