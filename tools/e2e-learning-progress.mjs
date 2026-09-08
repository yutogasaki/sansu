import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const base = process.env.SANSU_LEARNING_PROGRESS_BASE_URL || 'http://127.0.0.1:5199';
const out = path.resolve(process.env.SANSU_LEARNING_PROGRESS_OUTPUT || 'output/playwright/learning-progress');
await fs.mkdir(out, { recursive: true });
const built = await build({ stdin: { contents: `
    export { createInitialProfile } from './src/domain/user/profile.ts';
    export { MATH_CURRICULUM } from './src/domain/math/curriculum.ts';
    export { ENGLISH_WORDS } from './src/domain/english/words.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const domain = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const sourcePaths = ['src/pages/Settings.tsx', 'src/pages/Study.tsx', 'src/pages/StudyLayout.tsx', 'src/hooks/useStudySession.ts',
    'src/hooks/useStudySession.logic.ts', 'src/hooks/blockGenerators.ts', 'src/domain/learningRepository.ts'];
const hashes = async () => Promise.all(sourcePaths.map(async file => ({ file, sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const report = { target: base, startedAt: new Date().toISOString(), sourceStart: await hashes(), scenarios: [], pass: false,
    scope: 'Native isolated profile/log fixtures; actual Settings activation, normal Study planner/answers/writer, weak-review empty/retry routes. Fault scenario throws once from native IndexedDB logs reads, then restores the original methods. No app-module or problem overrides.' };
const browser = await chromium.launch();

async function seed(page, kind) {
    const profile = domain.createInitialProfile('はる', 2, 7, 1, kind === 'vocabulary' ? 'vocab' : 'math');
    profile.soundEnabled = false;
    profile.englishAutoRead = false;
    profile.uiTextMode = 'standard';
    profile.hissanModeEnabled = false;
    if (kind === 'vocabulary') {
        profile.vocabMaxUnlocked = 2;
        profile.vocabLevels = profile.vocabLevels.map(level => level.level === 2 ? { ...level, unlocked: true, enabled: false } : level);
    }
    const logs = kind === 'stopped' ? domain.MATH_CURRICULUM[8].flatMap(itemId => Array.from({ length: 3 }, (_, index) => ({
        profileId: profile.id, subject: 'math', itemId, result: 'skipped', skipped: true, isReview: true,
        timestamp: new Date(Date.now() - index * 1000).toISOString(),
    }))) : [];
    await page.evaluate(async ({ profile, logs }) => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = database.transaction(['profiles', 'appData', 'logs'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        for (const log of logs) transaction.objectStore('logs').add(log);
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        database.close();
    }, { profile, logs });
    return profile.id;
}

async function state(page, profileId) {
    return page.evaluate(async profileId => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = ['appData', 'profiles', 'logs', 'memoryMath', 'memoryVocab'];
        const transaction = database.transaction(names, 'readonly');
        const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const rows = await Promise.all(names.map(name => requestValue(transaction.objectStore(name).getAll())));
        const result = Object.fromEntries(names.map((name, index) => [name, rows[index]]));
        result.profile = result.appData.find(row => row.id === 'app').profiles[profileId];
        result.mirror = result.profiles.find(profile => profile.id === profileId);
        database.close();
        return result;
    }, profileId);
}

async function capture(page, row, suffix) {
    await page.evaluate(() => document.fonts.ready);
    const file = `${row.name}-${suffix}.png`;
    await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
    row.captures.push(file);
}

async function fits(page, locator) {
    const geometry = await locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height, width: window.innerWidth, viewportHeight: window.innerHeight };
    });
    assert(geometry.left >= 0 && geometry.right <= geometry.width + 1 && geometry.height >= 44, 'Action fits and has a usable tap target');
    return geometry;
}

try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        for (const kind of ['vocabulary', 'stopped', 'read-error']) {
            const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(15_000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            const row = { name: `${viewport.width}-${kind}`, viewport, kind, captures: [], pass: false };
            report.scenarios.push(row);
            try {
                await page.goto(`${base}/#/settings`);
                await page.waitForURL('**/#/onboarding');
                const profileId = await seed(page, kind);
                await page.goto(`${base}/#/settings`);
                await page.getByRole('button', { name: /^学習 / }).waitFor();
                const before = await state(page, profileId);
                if (kind === 'vocabulary') {
                    await page.getByRole('button', { name: /^学習 / }).click();
                    const activate = page.getByRole('button', { name: '英語 Lv.2の練習を始める', exact: true });
                    await activate.scrollIntoViewIfNeeded();
                    row.action = await fits(page, activate);
                    await capture(page, row, 'activation');
                    await activate.click();
                    await activate.waitFor({ state: 'detached' });
                    const activated = await state(page, profileId);
                    const expected = structuredClone(before.profile);
                    expected.vocabLevels.find(level => level.level === 2).enabled = true;
                    assert.deepEqual(activated.profile, expected, 'Activation changes only the previously unlocked next level enabled flag');
                    assert.deepEqual(activated.profile, activated.mirror);
                    assert.deepEqual(activated.logs, before.logs);
                    assert.deepEqual(activated.memoryVocab, before.memoryVocab);
                    await page.goto(`${base}/#/study?session=normal&focus_subject=vocab`);
                    const observedWords = [];
                    for (let index = 0; index < 10; index++) {
                        const question = page.locator(`[data-study-index="${index}"][data-feedback="none"]`);
                        await question.waitFor();
                        const text = await question.getAttribute('data-question-text');
                        // Display spelling may be shared by different stable IDs
                        // (orange fruit / orange_lv2 color). The generator excludes
                        // same-spelling distractors, so the rendered answer disambiguates.
                        const words = [];
                        for (const candidate of domain.ENGLISH_WORDS.filter(word => (word.surface ?? word.id) === text)) {
                            if (await question.getByRole('button', { name: candidate.japanese, exact: true }).count()) words.push(candidate);
                        }
                        assert.equal(words.length, 1, 'Displayed spelling and answer identify one vocabulary item');
                        const word = words[0];
                        assert(word && [1, 2].includes(word.level), 'Normal study draws from the current or enabled next English level');
                        observedWords.push({ id: word.id, level: word.level });
                        if (index === 0 || (word.level === 2 && !row.nextLevelCapture)) {
                            await capture(page, row, `question-${index + 1}`);
                            if (word.level === 2) row.nextLevelCapture = true;
                        }
                        await question.getByRole('button', { name: word.japanese, exact: true }).click();
                    }
                    await page.locator('[data-study-index="10"]').waitFor();
                    const after = await state(page, profileId);
                    assert.equal(after.logs.length, 10);
                    assert(after.logs.every(log => log.subject === 'vocab' && log.result === 'correct' && log.isReview === false));
                    assert.deepEqual(after.logs.map(log => log.itemId), observedWords.map(word => word.id));
                    const introduced = observedWords.filter(word => word.level === 2).length;
                    assert(introduced > 0 && introduced <= 3, 'Enabled next-level words actually appear within the 30% budget');
                    assert.equal(after.profile.vocabMainLevel, 1, 'One block does not prematurely promote the main level');
                    assert.equal(after.profile.vocabMaxUnlocked, 2);
                    assert.equal(after.profile.vocabLevels.find(level => level.level === 2).enabled, true);
                    row.words = observedWords;
                    row.introduced = introduced;
                    await capture(page, row, 'completed');
                } else {
                    if (kind === 'read-error') {
                        await page.evaluate(() => {
                            const originals = { getAll: IDBIndex.prototype.getAll, openCursor: IDBIndex.prototype.openCursor };
                            window.__learningReadFaults = 0;
                            const restore = () => { IDBIndex.prototype.getAll = originals.getAll; IDBIndex.prototype.openCursor = originals.openCursor; };
                            for (const method of ['getAll', 'openCursor']) IDBIndex.prototype[method] = function (...args) {
                                if (this.objectStore.name === 'logs') {
                                    restore();
                                    window.__learningReadFaults += 1;
                                    throw new DOMException('One-shot test read failure', 'UnknownError');
                                }
                                return originals[method].apply(this, args);
                            };
                        });
                    }
                    await page.evaluate(() => { window.location.hash = '/study?session=weak-review&focus_subject=math'; });
                    if (kind === 'stopped') {
                        await page.getByText('この範囲の復習は今日はここまでです', { exact: true }).waitFor();
                        assert.equal(await page.locator('[data-study-question-id]').count(), 0, 'No stopped or out-of-range fallback question appears');
                        const back = page.getByRole('button', { name: '記録へ戻る', exact: true });
                        row.action = await fits(page, back);
                        await capture(page, row, 'empty');
                        const after = await state(page, profileId);
                        assert.deepEqual(after.profile, before.profile);
                        assert.deepEqual(after.logs, before.logs);
                        await back.click();
                        await page.waitForURL('**/#/stats');
                        row.backToStats = true;
                    } else {
                        await page.getByText('問題を作成できませんでした', { exact: true }).waitFor();
                        assert.equal(await page.evaluate(() => window.__learningReadFaults), 1, 'Only one real IndexedDB read failed');
                        assert.equal(await page.locator('[data-study-question-id]').count(), 0, 'Read failure does not create a generic fallback');
                        assert.equal(await page.getByRole('button', { name: '記録へ戻る', exact: true }).count(), 0, 'Failure is not falsely presented as a completed review');
                        const retry = page.getByRole('button', { name: '再試行', exact: true });
                        row.action = await fits(page, retry);
                        await capture(page, row, 'error');
                        await retry.click();
                        await page.locator('[data-study-question-id]').waitFor();
                        const question = await page.locator('[data-study-question-id]').getAttribute('data-question-text');
                        const operands = question?.match(/^(\d+) \+ (\d+) =$/);
                        assert(operands, 'Retry returns to arithmetic in the requested Lv.8 range');
                        assert.deepEqual((await state(page, profileId)).logs, before.logs, 'Error and retry do not fabricate answers');
                        await capture(page, row, 'retried');
                        await page.keyboard.type(String(Number(operands[1]) + Number(operands[2])));
                        await page.keyboard.press('Enter');
                        await page.locator('[data-study-index="1"]').waitFor();
                        const answered = await state(page, profileId);
                        assert.equal(answered.logs.length, before.logs.length + 1);
                        assert.equal(answered.logs.at(-1).result, 'correct');
                        assert(domain.MATH_CURRICULUM[8].includes(answered.logs.at(-1).itemId), 'The retry answer is written against an actual skill in the requested range');
                        row.retriedSkill = answered.logs.at(-1).itemId;
                        row.recovered = true;
                    }
                }
                assert.deepEqual(errors, []);
                row.pass = true;
                console.log(`PASS ${row.name}`);
            } finally { await context.close(); }
        }
    }
    report.sourceEnd = await hashes();
    assert.deepEqual(report.sourceEnd, report.sourceStart, 'Scenarios use one unchanged source snapshot');
    report.pass = true;
} finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await fs.writeFile(path.join(out, 'review.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学習の進み方と復習の回帰確認</title><style>body{font:16px/1.7 system-ui,sans-serif;margin:32px;color:#263b38;background:#f5f6f3}section{border-top:1px solid #bdc9c0;margin-top:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}figure{margin:0;max-width:390px}img{width:100%;height:auto}a{color:#176440}</style><h1>学習の進み方と復習の回帰確認</h1><p>${report.pass ? '全シナリオ合格' : '検証途中'} · ${report.finishedAt}</p><p>英語の解放済みレベル再開→通常10問、当日の復習候補なし→記録、読込失敗→再試行を390×844・768×1024で検証しました。</p><a href="report.json">ログ・出題・ソースハッシュ</a>${report.scenarios.map(row => `<section><h2>${row.name} ${row.pass ? '✓' : ''}</h2><div class="grid">${row.captures.map(file => `<figure><a href="${file}"><img loading="lazy" src="${file}" alt="${file}"></a><figcaption>${file}</figcaption></figure>`).join('')}</div></section>`).join('')}</html>`);
}
