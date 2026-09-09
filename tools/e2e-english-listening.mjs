import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedDev, readNative, answerUI, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_LISTENING_URL || 'http://127.0.0.1:5238';
const output = process.env.SANSU_LISTENING_OUTPUT || 'output/playwright/english-listening';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
let lastPage;
const report = { base, evidence: 'DEV: real UI answers from explicit profile fixture; speech mock is separate from native speech', scenarios: [] };
const readAll = page => page.evaluate(async () => {
    const request = indexedDB.open('SansuDatabase');
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tables = await Promise.all([...db.objectStoreNames].map(async name => {
        const request = db.transaction(name).objectStore(name).getAll();
        const rows = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        return [name, rows];
    }));
    db.close(); return Object.fromEntries(tables);
});
try {
    for (const width of process.env.SANSU_LISTENING_ONLY_STUDY ? [] : [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        lastPage = page;
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(base);
        await page.waitForTimeout(700);
        const id = await seedDev(page, { subject: 'vocab', skill: 'apple' });
        // Keep only a known authored item due. Reservations are still made by the normal planner.
        await page.evaluate(async id => {
            const { db } = await import('/src/db/index.ts');
            await db.memoryVocab.where('profileId').equals(id).modify(row => { row.nextReview = row.id === 'apple' ? '2000-01-01' : '2099-01-01'; });
        }, id);
        await page.goto(`${base}/#/island`);
        await page.locator('.island-start').click();
        await page.locator('.park-answer').waitFor();
        let state = await readNative(page, id);
        let answers = 0;
        while (!(await page.getByRole('button', { name: 'ぶんを きく', exact: true }).count())) {
            assert(answers++ < 18, 'An authored recent word should offer listening at the section boundary');
            state = (await answerUI(page, state.plan)).state;
        }
        assert(answers >= 6);
        const entry = page.getByRole('button', { name: 'ぶんを きく', exact: true });
        await page.screenshot({ path: `${output}/${width}-entry.png` });
        const before = await readNative(page, id);
        const allBefore = await readAll(page);
        await entry.click();
        const dialog = page.getByRole('dialog', { name: 'ぶんを きく', exact: true });
        await dialog.waitFor();
        assert(await dialog.locator('[lang=ja]').isVisible());
        assert(await dialog.locator('[lang=en]').isVisible());
        assert(await dialog.locator('.english-listening-play').isDisabled());
        await page.screenshot({ path: `${output}/${width}-japanese-sound-off.png` });
        await page.keyboard.press('1');
        await dialog.focus();
        await page.keyboard.press('Enter');
        assert.deepEqual(await readNative(page, id), before, 'Dialog keyboard must never answer the underlying question');
        await page.evaluate(async () => { (await import('/src/utils/audio.ts')).setSoundEnabled(true); });
        await dialog.locator('.english-listening-play').click();
        await page.waitForFunction(() => document.querySelector('.english-listening-play')?.textContent !== 'とめる', undefined, { timeout: 10000 });
        const nativeSpeech = await dialog.locator('.english-listening-status').textContent();
        // Explicit mock measures lifecycle, not acoustic quality or native availability.
        await page.evaluate(async () => {
            const { setSoundEnabled } = await import('/src/utils/audio.ts');
            setSoundEnabled(true);
            window.__listeningSpeech = { texts: [], cancellations: 0 };
            window.speechSynthesis.speak = utterance => { window.__listeningSpeech.texts.push(utterance.text); window.__listeningUtterance = utterance; utterance.onstart?.(); };
            window.speechSynthesis.cancel = () => { window.__listeningSpeech.cancellations++; };
        });
        await dialog.locator('.english-listening-play').click();
        await dialog.getByRole('button', { name: 'とめる', exact: true }).waitFor();
        await page.screenshot({ path: `${output}/${width}-playing.png` });
        await dialog.getByRole('button', { name: 'とめる', exact: true }).click();
        await dialog.getByRole('button', { name: 'もういちど きく', exact: true }).click();
        await page.evaluate(() => window.__listeningUtterance.onerror?.({ error: 'network' }));
        await dialog.getByText('いまは おとが でないよ', { exact: true }).waitFor();
        await dialog.getByRole('button', { name: 'もういちど きく', exact: true }).click();
        await dialog.getByRole('button', { name: 'つづける', exact: true }).click();
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.deepEqual(await readNative(page, id), before, 'Listening and leaving do not write learning/reward state');
        assert.deepEqual(await readAll(page), allBefore, 'Every IndexedDB store, including profile/settings, remains unchanged');
        const speech = await page.evaluate(() => window.__listeningSpeech);
        assert.equal(speech.texts.length, 3);
        assert(speech.cancellations >= 2);
        await page.screenshot({ path: `${output}/${width}-returned.png` });
        state = (await answerUI(page, before.plan)).state;
        assert.equal(await entry.count(), 0, 'At most one card per session');
        assert.equal(state.logs.length, before.logs.length + 1, 'Normal answers still save');
        assert.deepEqual(errors, []);
        report.scenarios.push({ width, answers, speech, nativeSpeech, metadata: await runtimeMetadata(page), pass: true });
        await context.close();
    }
    for (const width of process.env.SANSU_LISTENING_ONLY_ISLAND ? [] : [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 } });
        const page = await context.newPage();
        lastPage = page;
        await page.goto(base); await page.waitForTimeout(600);
        await seedDev(page, { subject: 'vocab', skill: 'apple' });
        await page.goto(`${base}/#/study?focus_subject=vocab&focus_ids=apple,banana,cat,dog`);
        const root = page.locator('[data-study-question-id]');
        await root.waitFor();
        let answers = 0;
        const entry = page.getByRole('button', { name: 'ぶんを きく', exact: true });
        while (!(await entry.count())) {
            assert(answers++ < 20, 'Study offers a sentence using saved normal answers');
            const questionId = await root.getAttribute('data-study-question-id');
            const word = await root.getAttribute('data-question-text');
            const labels = await page.evaluate(async word => {
                const { ENGLISH_WORDS } = await import('/src/domain/english/words.ts');
                return ENGLISH_WORDS.filter(item => (item.surface ?? item.id) === word).flatMap(item => [item.japanese, item.japaneseKanji].filter(Boolean));
            }, word);
            let choice;
            for (const label of labels) {
                const match = page.getByRole('button', { name: label, exact: true });
                if (await match.count()) { choice = match; break; }
            }
            assert(choice, `Actual choice for ${word}`);
            await choice.click();
            await page.waitForFunction(id => document.querySelector('[data-study-question-id]')?.getAttribute('data-study-question-id') !== id, questionId);
        }
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${output}/${width}-study-entry.png` });
        const before = await readAll(page);
        const questionId = await root.getAttribute('data-study-question-id');
        await entry.click();
        const dialog = page.getByRole('dialog', { name: 'ぶんを きく', exact: true });
        await dialog.waitFor();
        assert(await dialog.locator('[lang=ja]').isVisible());
        await page.screenshot({ path: `${output}/${width}-study-sentence.png` });
        await dialog.getByRole('button', { name: 'つづける', exact: true }).click();
        assert.equal(await root.getAttribute('data-study-question-id'), questionId);
        assert.deepEqual(await readAll(page), before);
        assert.equal(await entry.count(), 0);
        report.scenarios.push({ surface: 'study', width, answers, pass: true });
        await context.close();
    }
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
} catch (error) {
    if (lastPage && !lastPage.isClosed()) {
        await lastPage.screenshot({ path: `${output}/failure.png` });
        await writeFile(`${output}/failure.txt`, `${String(error)}\n${lastPage.url()}\n${await lastPage.locator('body').innerText()}`);
    }
    throw error;
} finally { await browser.close(); }
