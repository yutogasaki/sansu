import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = process.env.SANSU_PRINT_BASE_URL || 'http://127.0.0.1:5199';
const out = path.resolve(process.env.SANSU_PRINT_OUTPUT || 'output/playwright/learning-print');
const filter = process.env.SANSU_PRINT_SCENARIO;
const scenarios = [
    { name: 'count', level: 0, visual: 'single-items' },
    { name: 'spatial', level: 2, skill: 'spatial_words' },
    { name: 'number-line', level: 7, visual: 'number-line' },
    { name: 'hissan', level: 11, skill: 'add_2d1d_hissan_c', workingSpace: true },
    { name: 'remainder', level: 17, input: 'multi-number' },
    { name: 'fraction', level: 22, input: 'multi-number' },
    { name: 'vocabulary', level: 1, subject: 'vocab', input: 'choice' },
].flatMap(scenario => [
    { ...scenario, name: `phone-${scenario.name}`, width: 390, height: 844 },
    { ...scenario, name: `tablet-${scenario.name}`, width: 768, height: 1024 },
]).filter(scenario => !filter || scenario.name === filter);
assert(scenarios.length, 'Scenario filter must match');
await fs.mkdir(out, { recursive: true });

// Only profile setup runs in Node. The real Settings path generates and persists
// every test; no browser imports, question replacement, or test-generator mocks.
const compiled = await build({ stdin: { contents: "export { createInitialProfile } from './src/domain/user/profile.ts';", resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { createInitialProfile } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const sourcePaths = ['src/pages/Settings.tsx', 'src/components/domain/PrintableTestPreview.tsx', 'src/components/domain/PrintableTestPreview.css',
    'src/components/domain/MathProblemPrompt.tsx', 'src/domain/test/paperTest.ts', 'src/domain/test/paperTestRepository.ts', 'src/domain/test/testSet.ts'];
const sourceSnapshot = async () => Promise.all(sourcePaths.map(async file => ({ file, sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex') })));
const report = { target: base, startedAt: new Date().toISOString(), fixtureHash: createHash('sha256').update(compiled.outputFiles[0].text).digest('hex'),
    sourceStart: await sourceSnapshot(), scenarios: [], pass: false,
    scope: 'Actual Settings generation, isolated native profiles, immutable paper snapshots, screen and Chromium A4 PDF. System print call is intercepted to model cancellation without a score; physical printer and OS print dialog are not automated.' };
const browser = await chromium.launch();

async function seed(page, scenario, legacy = false) {
    const profile = createInitialProfile('はる', 2, scenario.level - 1, 1, 'mix');
    profile.soundEnabled = false;
    profile.hissanModeEnabled = true;
    profile.uiTextMode = 'standard';
    if (legacy) profile.pendingPaperTests = [{ id: 'legacy-no-snapshot', subject: 'math', level: 7, createdAt: '2026-08-01T00:00:00.000Z' }];
    await page.evaluate(async profile => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const transaction = database.transaction(['profiles', 'appData'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', profile.id);
        database.close();
    }, profile);
    return profile.id;
}

async function readState(page, profileId) {
    return page.evaluate(async profileId => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const names = ['appData', 'profiles', 'memoryMath', 'memoryVocab', 'logs'];
        const transaction = database.transaction(names, 'readonly');
        const requestValue = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const rows = await Promise.all(names.map(name => requestValue(transaction.objectStore(name).getAll())));
        const state = Object.fromEntries(names.map((name, index) => [name, rows[index]]));
        state.profile = state.appData.find(row => row.id === 'app').profiles[profileId];
        state.mirror = state.profiles.find(row => row.id === profileId);
        database.close();
        return state;
    }, profileId);
}

async function openSettings(page) {
    await page.goto(`${base}/#/settings`);
    await page.getByRole('button', { name: /テスト・保護者/ }).click();
    await page.getByRole('heading', { name: '定期テスト（20問）' }).waitFor();
}

const subjectPanel = (page, subject = 'math') => page.locator('div').filter({ has: page.getByText(new RegExp(`^${subject === 'math' ? '算数' : '英語'} Lv\\.`)) })
    .filter({ has: page.getByRole('button', { name: 'アプリ受験', exact: true }) }).last();

async function capture(page, name) {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
    return file;
}

async function verifyScreen(page) {
    const bounds = await page.locator('[data-testid="printable-test-preview"]').evaluate(root => ({ width: root.clientWidth, scrollWidth: root.scrollWidth,
        controls: Array.from(root.querySelectorAll('.printable-test-toolbar button, .printable-test-mode span')).map(element => {
            const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }) }));
    assert(bounds.scrollWidth <= bounds.width + 1, 'Preview must not overflow horizontally');
    assert(bounds.controls.every(control => control.height >= 44 && control.x >= 0 && control.x + control.width <= bounds.width + 1), 'All preview controls fit and have 44px targets');
    assert.equal(await page.locator('#root').evaluate(root => root.inert), true);
    await page.getByRole('button', { name: '閉じる', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator(':focus').innerText(), '印刷・PDF保存');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), '閉じる');
    return bounds;
}

function poppler(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    return result.stdout;
}

async function pdf(page, name, mode, problems) {
    await page.getByRole('radio', { name: mode === 'both' ? '両方' : mode === 'answers' ? '解答のみ' : '問題のみ', exact: true }).check();
    const filename = path.join(out, `${name}-${mode}.pdf`);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('#root').evaluate(root => getComputedStyle(root).display), 'none');
    assert.equal(await page.locator('.printable-test-toolbar').evaluate(root => getComputedStyle(root).display), 'none');
    await page.pdf({ path: filename, format: 'A4', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    await page.emulateMedia({ media: 'screen' });
    const extracted = JSON.parse(poppler(process.env.SANSU_PRINT_PYTHON || 'python3', ['-c', `import fitz,json,sys
document=fitz.open(sys.argv[1])
print(json.dumps({'plain':'\\n'.join(page.get_text() for page in document),'pages':[{'width':page.rect.width,'height':page.rect.height,'words':[{'left':word[0],'top':word[1],'right':word[2],'bottom':word[3],'text':word[4]} for word in page.get_text('words')]} for page in document]},ensure_ascii=False))`, filename]));
    const { plain, pages } = extracted;
    assert(!plain.includes('印刷プレビュー') && !plain.includes('印刷・PDF保存') && !plain.includes('テスト・保護者'), 'PDF contains only paper content');
    assert(pages.length > 0);
    assert(pages.every(page => Math.abs(page.width - 595.28) < 1 && Math.abs(page.height - 841.89) < 1), 'Every page is A4');
    assert(pages.every(page => page.words.every(word => word.left >= 30 && word.right <= page.width - 30 && word.top >= 30 && word.bottom <= page.height - 30)), 'All PDF text stays inside the page margins');
    const numberedPages = pages.map(page => page.words.filter(word => /^\d+$/.test(word.text) && word.left >= 34 && word.left < 54).map(word => Number(word.text)));
    const numbers = numberedPages.flat();
    const expected = Array.from({ length: 20 }, (_, index) => index + 1);
    assert.deepEqual(numbers, mode === 'both' ? [...expected, ...expected] : expected, 'All 20 question/answer numbers survive PDF layout in order');
    if (mode === 'both') {
        const answerPage = numberedPages.findIndex((numbers, index) => index > 0 && numbers[0] === 1);
        assert(answerPage > 0, 'Answers begin on their own page');
        assert(pages[answerPage].words.some(word => word.text.includes('解答')));
    }
    if (mode === 'questions') {
        let offset = 0;
        pages.forEach((page, index) => {
            const count = numberedPages[index].length;
            if (!count) return;
            const expectedLabels = problems.slice(offset, offset + count).flatMap(problem => problem.inputConfig?.fields?.length
                ? problem.inputConfig.fields.map(field => field.label || 'こたえ') : ['こたえ']);
            const actualLabels = page.words.map(word => word.text).filter(text => expectedLabels.includes(text));
            for (const label of new Set(expectedLabels)) assert.equal(actualLabels.filter(item => item === label).length, expectedLabels.filter(item => item === label).length, `Page ${index + 1} keeps every answer field with its question`);
            offset += count;
        });
    }
    // Every page is rendered so reviewers can inspect page boundaries and diagram geometry.
    poppler('pdftoppm', ['-scale-to', '1100', '-png', filename, path.join(out, `${name}-${mode}-page`)]);
    return { file: path.basename(filename), pages: pages.length, numberedPages, sha256: createHash('sha256').update(await fs.readFile(filename)).digest('hex') };
}

try {
    for (const scenario of scenarios) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const row = { ...scenario, captures: [], pdfs: [], pass: false };
        report.scenarios.push(row);
        try {
            await page.goto(`${base}/#/settings`);
            await page.waitForURL('**/#/onboarding');
            const profileId = await seed(page, scenario);
            await openSettings(page);
            const before = await readState(page, profileId);
            await subjectPanel(page, scenario.subject).getByRole('button', { name: '印刷・PDF', exact: true }).click();
            await page.getByTestId('printable-test-preview').waitFor();
            await page.evaluate(() => document.fonts.ready);
            const prepared = await readState(page, profileId);
            const paper = prepared.profile.pendingPaperTests.find(paper => paper.subject === (scenario.subject || 'math'));
            assert.equal(paper.testSet.problems.length, 20);
            assert.deepEqual(paper.testSet, prepared.profile.periodicTestSets[scenario.subject || 'math'], 'Paper and app periodic test share the same saved questions');
            assert.deepEqual(prepared.profile, prepared.mirror, 'Canonical and legacy profile mirror agree');
            assert.deepEqual(prepared.profile.testHistory, before.profile.testHistory, 'Preparing paper adds no score');
            for (const key of ['memoryMath', 'memoryVocab', 'logs']) assert.deepEqual(prepared[key], before[key], `Printing does not alter ${key}`);
            if (scenario.visual) assert(paper.testSet.problems.some(problem => problem.questionVisual?.kind === scenario.visual), `Actual level generates ${scenario.visual}`);
            if (scenario.skill) assert(paper.testSet.problems.some(problem => problem.categoryId === scenario.skill), `Actual level generates ${scenario.skill}`);
            if (scenario.input) assert(paper.testSet.problems.some(problem => problem.inputType === scenario.input), `Actual level generates ${scenario.input}`);
            if (scenario.workingSpace) assert(await page.getByLabel('筆算を書く場所').count() > 0, 'Explicit Hissan skills include a writing area');
            assert.equal(await page.locator('[data-print-question]').count(), 20);
            assert.equal(await page.locator('[data-print-answer]').count(), 0);
            row.controls = await verifyScreen(page);
            row.captures.push(await capture(page, `${scenario.name}-preview`));
            const selectedIndex = paper.testSet.problems.findIndex(problem => scenario.skill ? problem.categoryId === scenario.skill : scenario.visual ? problem.questionVisual?.kind === scenario.visual : problem.inputType === scenario.input);
            if (selectedIndex >= 0) {
                await page.locator(`[data-print-question="${selectedIndex + 1}"]`).scrollIntoViewIfNeeded();
                row.captures.push(await capture(page, `${scenario.name}-sample`));
            }
            const renderedChoices = await page.locator('[data-print-choice-value]').evaluateAll(elements => elements.map(element => ({ value: element.getAttribute('data-print-choice-value'), label: element.querySelector('span:last-child').textContent })));
            assert.deepEqual(renderedChoices, paper.testSet.problems.flatMap(problem => problem.inputConfig?.choices || []), 'All saved choice labels, values, and order survive');
            row.paperId = paper.id;
            row.testSet = paper.testSet;
            row.pdfs.push(await pdf(page, scenario.name, 'questions', paper.testSet.problems));
            await page.getByRole('radio', { name: '解答のみ', exact: true }).check();
            assert.equal(await page.locator('[data-print-question]').count(), 0);
            assert.equal(await page.locator('[data-print-answer]').count(), 20);
            if (scenario.name === 'tablet-vocabulary') {
                row.pdfs.push(await pdf(page, scenario.name, 'answers', paper.testSet.problems));
                await page.getByTestId('printable-test-preview').evaluate(root => { root.scrollTop = 0; });
                row.captures.push(await capture(page, `${scenario.name}-answers`));
            }
            if (scenario.name.startsWith('tablet-')) row.pdfs.push(await pdf(page, scenario.name, 'both', paper.testSet.problems));
            await page.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls += 1; }; });
            await page.getByRole('button', { name: '印刷・PDF保存', exact: true }).click();
            await page.waitForFunction(() => window.__printCalls === 1);
            assert.deepEqual((await readState(page, profileId)).profile, prepared.profile, 'Cancelling print does not record a score');
            await page.keyboard.press('Escape');
            await page.getByTestId('printable-test-preview').waitFor({ state: 'detached' });
            assert.equal(await page.locator('#root').evaluate(root => root.inert), false);
            assert.match(await page.locator(':focus').innerText(), /同じ問題を印刷/);
            await page.reload();
            await openSettings(page);
            await subjectPanel(page, scenario.subject).getByRole('button', { name: '同じ問題を印刷', exact: true }).click();
            await page.getByTestId('printable-test-preview').waitFor();
            assert.deepEqual((await readState(page, profileId)).profile.pendingPaperTests.find(item => item.id === paper.id), paper, 'Reload/reprint preserves exact snapshot and ID');
            assert.equal(await page.getByRole('radio', { name: '問題のみ', exact: true }).isChecked(), true);
            await page.getByRole('button', { name: '閉じる', exact: true }).click();
            await subjectPanel(page, scenario.subject).getByRole('button', { name: '点数入力', exact: true }).click();
            const scoreDialog = page.getByRole('dialog');
            await scoreDialog.getByRole('button', { name: '17', exact: true }).click();
            await scoreDialog.getByRole('button', { name: 'とうろく する', exact: true }).dblclick();
            await scoreDialog.waitFor({ state: 'detached' });
            const scored = await readState(page, profileId);
            const results = scored.profile.testHistory.filter(result => result.method === 'paper');
            assert.equal(results.length, 1, 'Rapid repeated submit records exactly once');
            assert.equal(results[0].correctCount, 17);
            assert.equal(results[0].score, 85);
            assert.equal(scored.profile.pendingPaperTests?.length || 0, 0);
            assert.equal(scored.profile.mathMainLevel, before.profile.mathMainLevel);
            assert.equal(scored.profile.vocabMainLevel, before.profile.vocabMainLevel);
            for (const key of ['memoryMath', 'memoryVocab', 'logs']) assert.deepEqual(scored[key], before[key], `Paper score does not alter ${key}`);
            assert.deepEqual(scored.profile, scored.mirror);
            assert.deepEqual(errors, []);
            row.pass = true;
            console.log(`PASS ${scenario.name}: ${row.pdfs.map(pdf => `${pdf.pages} pages`).join(', ')}`);
        } finally { await context.close(); }
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    try {
        const page = await context.newPage();
        await page.goto(`${base}/#/settings`);
        await page.waitForURL('**/#/onboarding');
        const profileId = await seed(page, { level: 9 }, true);
        await openSettings(page);
        await subjectPanel(page).getByRole('button', { name: '同じ問題を印刷', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: '以前の紙テストには問題が保存されていません' }).waitFor();
        assert.equal(await page.getByTestId('printable-test-preview').count(), 0);
        assert.equal((await readState(page, profileId)).profile.pendingPaperTests[0].testSet, undefined);
        await subjectPanel(page).getByRole('button', { name: '採点待ちを取り消す', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: '採点待ちを取り消す', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.equal((await readState(page, profileId)).profile.pendingPaperTests?.length || 0, 0);
        report.legacy = { pass: true, capture: await capture(page, 'legacy-cancelled') };
    } finally { await context.close(); }
    report.sourceEnd = await sourceSnapshot();
    assert.deepEqual(report.sourceEnd, report.sourceStart, 'Verification covers one unchanged source snapshot');
    report.pass = true;
} finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    await fs.writeFile(path.join(out, 'review.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学習プリントの実画面・A4確認</title>
<style>body{font:16px/1.7 system-ui,sans-serif;margin:32px;background:#f5f6f3;color:#263b38}h1{font-size:28px}h2{margin-top:48px}a{color:#166556}header{max-width:900px}section{border-top:1px solid #c9d3ce}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}.grid figure{margin:0;max-width:360px}.grid img{width:100%;height:auto;background:white;border:1px solid #ccd5cf}figcaption{font-size:13px}details{margin:20px 0}summary{cursor:pointer;font-weight:bold}.pass{color:#176440}</style>
<header><h1>学習プリントの実画面・A4確認</h1><p class="pass">${report.pass ? '全シナリオ合格' : '検証途中'} · ${escape(report.finishedAt)}</p><p>対象：${escape(base)}。実際の設定画面で生成した20問、解答のみ／両方、再印刷、点数登録、旧データの取り消しを検証。保存問題を差し替えるテスト用フックは使っていません。</p><p>画面は390×844・768×1024。PDFの全ページを画像化し、問題番号・解答欄の同一ページ保持・A4余白・背景UI非表示を検査しています。OSの印刷ダイアログと実プリンターは対象外です。</p><a href="report.json">検証結果・保存された問題・ソースハッシュ</a></header>
${report.scenarios.map(scenario => `<section><h2>${escape(scenario.name)} ${scenario.pass ? '✓' : ''}</h2><div class="grid">${scenario.captures.map(file => `<figure><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt="${escape(file)}"></a><figcaption>${escape(file)}</figcaption></figure>`).join('')}</div>${scenario.pdfs.map(pdf => `<details><summary><a href="${escape(pdf.file)}">${escape(pdf.file)}</a> · ${pdf.pages}ページ</summary><div class="grid">${Array.from({ length: pdf.pages }, (_, index) => {
        const file = `${pdf.file.slice(0, -4)}-page-${String(index + 1).padStart(String(pdf.pages).length, '0')}.png`;
        return `<figure><a href="${escape(file)}"><img loading="lazy" src="${escape(file)}" alt="${escape(pdf.file)} ${index + 1}ページ"></a><figcaption>${index + 1}ページ · 問題番号 ${pdf.numberedPages[index].join(', ')}</figcaption></figure>`;
    }).join('')}</div></details>`).join('')}</section>`).join('')}</html>`);
}
