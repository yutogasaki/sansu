import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { readNative, runtimeMetadata, waitReady } from './island-e2e-helpers.mjs';
import { seedLearningProfile } from './island-learning-fixtures.mjs';

const base = process.env.SANSU_LEVEL_CUE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_LEVEL_CUE_OUTPUT || 'output/playwright/level-up-cue';
await fs.mkdir(out, { recursive: true });
const inputs = ['src/components/progress/LearningProgressCue.tsx', 'src/components/progress/LearningProgressCue.css',
    'src/components/island/IslandLearningPanel.tsx', 'src/components/island/IslandLearningHeader.css', 'src/pages/Learn.tsx'];
const hashes = () => Promise.all(inputs.map(async path => ({ path, sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') })));
const compiled = await build({ stdin: { contents: `
    export { generateMathProblem } from './src/domain/math/index.ts';
    export { getSkillsForLevel } from './src/domain/math/curriculum.ts';
    export { generateVocabProblem } from './src/domain/english/generator.ts';
    export { getWordsByLevel } from './src/domain/english/words.ts';
    export { getLearningItemMapping } from './src/domain/learning/catalog.ts';
    export { createLearningProblemContext } from './src/domain/learning/context.ts';
    export { evaluateFinishCoverage, finishContentKey } from './src/domain/finishCoverage.ts';
    export { createSeededRandom } from './src/utils/random.ts';
`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    startedAt: new Date().toISOString(), sourceStart: await hashes(), cases: [], pass: false,
    delivery: await fetch(base + '/version.json').then(r => r.json()).catch(() => null),
    scope: 'Disposable native profile/log/memory qualification fixtures and real planner/UI. No user data, mocked readiness, or replaced problems. Desktop Chromium viewports; not physical iOS or child observation.' };

async function qualify(page, id, subject) {
    const profile = await page.evaluate(async id => {
        const r = indexedDB.open('SansuDatabase');
        const db = await new Promise((a, b) => { r.onsuccess = () => a(r.result); r.onerror = () => b(r.error); });
        const get = db.transaction('profiles').objectStore('profiles').get(id);
        const p = await new Promise((a, b) => { get.onsuccess = () => a(get.result); get.onerror = () => b(get.error); }); db.close(); return p;
    }, id);
    const logs = [], rng = d.createSeededRandom('level-up-cue');
    const add = problem => logs.push({ profileId: id, subject, itemId: problem.categoryId, result: 'correct', isReview: false,
        timestamp: new Date(Date.now() - 60000 + logs.length).toISOString(),
        learningEvidence: { problem: d.createLearningProblemContext(subject, problem), assistance: 'independent', completion: 'whole-problem' } });
    if (subject === 'math') {
        for (const skill of d.getSkillsForLevel(profile.mathMainLevel)) {
            for (const variant of d.getLearningItemMapping('math', skill).variants) {
                const seen = new Set();
                for (let n = 0; n < 500 && seen.size < 3; n++) {
                    const problem = d.generateMathProblem(skill, { random: rng, preferredLearningVariant: variant });
                    const key = d.finishContentKey(problem);
                    if (seen.has(key) || d.createLearningProblemContext('math', problem).variant !== variant) continue;
                    seen.add(key); add(problem);
                }
                assert.equal(seen.size, 3);
            }
        }
        while (logs.length < 20) add(d.generateMathProblem(d.getSkillsForLevel(profile.mathMainLevel)[0], { random: rng }));
    } else {
        const words = d.getWordsByLevel(profile.vocabMainLevel);
        for (const word of words.slice(0, Math.ceil(words.length * .7))) add(d.generateVocabProblem(word.id, { random: rng }));
        while (logs.length < 20) add(d.generateVocabProblem(words[logs.length % words.length].id, { random: rng }));
    }
    const ready = d.evaluateFinishCoverage(profile, subject, logs);
    assert(ready.coverageReady && ready.fresh, JSON.stringify(ready));
    await page.evaluate(async ({ id, logs }) => {
        const r = indexedDB.open('SansuDatabase');
        const db = await new Promise((a, b) => { r.onsuccess = () => a(r.result); r.onerror = () => b(r.error); });
        const tx = db.transaction('logs', 'readwrite');
        for (const log of logs) tx.objectStore('logs').add(log);
        await new Promise((a, b) => { tx.oncomplete = a; tx.onerror = () => b(tx.error); }); db.close();
    }, { id, logs });
}
async function controls(page) {
    return page.evaluate(() => Object.fromEntries(['.park-question', '.park-keypad', '.island-learning-actions'].map(selector => {
        const r = document.querySelector(selector)?.getBoundingClientRect();
        return [selector, r && { x: r.x, y: r.y, width: r.width, height: r.height }];
    })));
}
async function capture(page, name) {
    const meta = await runtimeMetadata(page);
    assert.equal(meta.appRoot.islandFeatureEnabled, true);
    assert.equal(meta.appRoot.natureTownFeatureEnabled, false);
    assert.equal(meta.learningCandidate, 'pokomoko-pop-live-v8');
    if (report.delivery) assert.equal(meta.version, report.delivery.version);
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
    return meta;
}
const browser = await chromium.launch();
try {
    for (const viewport of (process.env.SANSU_LEVEL_CUE_EXTRA_ONLY ? [] : [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 320, height: 568, written: true }, { width: 844, height: 390, written: true }])) {
        const label = `${viewport.width}${viewport.written ? '-written' : ''}`;
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const row = { viewport, errors: [] }; report.cases.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        await page.goto(base + '/#/onboarding');
        await page.locator('.app-container').waitFor();
        const id = await seedLearningProfile(page, { skill: 'div_2d1d_exact', type: viewport.written ? 'hissan' : 'number', subject: 'math' });
        // Fixture qualification, not actual child learning. The app still uses its real gate.
        await qualify(page, id, 'math');
        await page.goto(base + '/#/stats'); await page.reload();
        await page.getByRole('button', { name: 'さんすうの レベルアップに ちょうせん', exact: true }).waitFor();
        await page.goto(base + '/#/stats?learn=1'); await waitReady(page);
        const cue = page.getByRole('button', { name: /さんすうの Lv\d+へ ちょうせん/ });
        await cue.waitFor();
        row.runtime = await capture(page, `${label}-ready`);
        const bounds = await cue.boundingBox(); assert(bounds.height >= 44 && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
        for (const button of await page.locator('.park-keypad button, .island-learning-actions button').all()) {
            const r = await button.boundingBox();
            assert(r && r.width >= 44 && r.height >= 44 && r.y >= 0 && r.y + r.height <= viewport.height + 1, JSON.stringify({ viewport, r, text: await button.innerText() }));
        }
        await page.evaluate(() => document.fonts.ready);
        const before = await readNative(page, id);
        await cue.click();
        await page.waitForURL(/#\/learn\?challenge=math/);
        await page.getByRole('button', { name: 'ちょうせんする', exact: true }).waitFor();
        await page.screenshot({ path: `${out}/${viewport.width}-confirmation.png` });
        await page.getByRole('button', { name: 'れんしゅうを つづける', exact: true }).click();
        await page.waitForURL(/#\/stats\?learn=1/); await waitReady(page);
        assert.deepEqual(await readNative(page, id), before, 'Confirmation and practice preserve all learning stores');
        assert.equal(await cue.count(), 0, 'No repeated invitation after returning from confirmation');
        // Reload of an untouched first slot may invite again. Typing must remove it without shifting inputs.
        await page.reload(); await waitReady(page); await cue.waitFor();
        const layout = await controls(page);
        await page.keyboard.type('9');
        await cue.waitFor({ state: 'detached' });
        assert.deepEqual(await controls(page), layout, 'First input does not move question/keypad/help');
        row.afterInput = await capture(page, `${label}-input`);
        // A separate disposable ready profile checks support without carrying the input answer above.
        await page.goto(base + '/#/stats');
        const supportId = await seedLearningProfile(page, { skill: 'div_2d1d_exact', type: 'number', subject: 'math' });
        await qualify(page, supportId, 'math');
        await page.goto(base + '/#/stats?learn=1'); await page.reload(); await waitReady(page); await cue.waitFor();
        await page.getByRole('button', { name: 'ヒントを みる', exact: true }).click();
        await cue.waitFor({ state: 'detached' }); await waitReady(page);
        await page.reload(); await waitReady(page); assert.equal(await cue.count(), 0);
        row.supportSuppressed = true;
        assert.deepEqual(row.errors, []);
        await context.close();
    }
    // Other subject, both-ready, and failed read use the same real qualification gate.
    for (const mode of ['vocab', 'mix', 'read-failure', 'finish-test'].filter(mode => !process.env.SANSU_LEVEL_CUE_MODE || mode === process.env.SANSU_LEVEL_CUE_MODE)) {
        const viewport = { width: 390, height: 844 };
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const row = { mode, errors: [] }; report.cases.push(row);
        page.on('pageerror', e => row.errors.push(e.message));
        if (mode === 'read-failure') {
            await page.addInitScript(() => {
                const original = IDBDatabase.prototype.transaction;
                window.__cueReadFaults = 0;
                IDBDatabase.prototype.transaction = function(stores, ...args) {
                    const names = typeof stores === 'string' ? [stores] : Array.from(stores);
                    if (sessionStorage.getItem('cue-read-fault') === '1' && names.length === 1 && names[0] === 'memoryVocab' && args[0] === 'readonly') {
                        window.__cueReadFaults++; throw new DOMException('Explicit cue read failure', 'UnknownError');
                    }
                    return original.call(this, stores, ...args);
                };
            });
        }
        await page.goto(base + '/#/onboarding'); await page.locator('.app-container').waitFor();
        const id = await seedLearningProfile(page, { skill: 'div_2d1d_exact', type: 'number', subject: ['read-failure', 'finish-test'].includes(mode) ? 'math' : mode });
        if (mode === 'mix') await qualify(page, id, 'math');
        await qualify(page, id, ['read-failure', 'finish-test'].includes(mode) ? 'math' : 'vocab');
        if (mode === 'vocab') {
            // Use the actual course choice, rather than a forged foundation reservation.
            await page.goto(base + '/#/stats?learn=1'); await page.reload();
            await page.waitForFunction(() => document.querySelector('[data-input-ready=true] .park-answer, .foundation-course-option'));
            const course = page.getByRole('button', { name: /^えいたんごを よむ/ });
            if (await course.isVisible()) await course.click();
        } else { await page.goto(base + '/#/stats?learn=1'); await page.reload(); }
        await waitReady(page);
        const cue = page.locator('.learning-progress-finish-link');
        await cue.waitFor();
        const state = await readNative(page, id);
        if (mode === 'mix') {
            assert.equal(await cue.count(), 1);
            assert.match(await cue.getAttribute('aria-label'), new RegExp(state.plan.subject === 'math' ? 'さんすう' : 'えいご'));
            assert.equal(await page.getByRole('button', { name: /つぎも/ }).count(), 1, 'Subject preference remains available');
        }
        row.runtime = await capture(page, mode + '-ready');
        if (mode === 'read-failure') {
            await page.evaluate(() => sessionStorage.setItem('cue-read-fault', '1'));
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.locator('.island-shell-nav').getByRole('button', { name: 'まなぶ', exact: true }).click();
            await waitReady(page);
            await page.waitForFunction(() => window.__cueReadFaults > 0);
            assert.equal(await cue.count(), 0);
            await page.getByRole('button', { name: '9', exact: true }).click();
            row.readFailure = true;
        } else {
            await cue.click(); await page.waitForURL(new RegExp('challenge=' + state.plan.subject));
            await page.getByRole('button', { name: 'ちょうせんする', exact: true }).waitFor();
            if (mode === 'finish-test') {
                await page.getByRole('button', { name: 'ちょうせんする', exact: true }).click();
                await page.locator('[data-study-index="0"][data-feedback="none"]').waitFor();
                const reservation = await page.evaluate(async id => {
                    const r = indexedDB.open('SansuDatabase');
                    const db = await new Promise((a, b) => { r.onsuccess = () => a(r.result); r.onerror = () => b(r.error); });
                    const get = db.transaction('profiles').objectStore('profiles').get(id);
                    const p = await new Promise((a, b) => { get.onsuccess = () => a(get.result); get.onerror = () => b(get.error); }); db.close(); return p.finishTestSets.math;
                }, id);
                assert.equal(reservation.problems.length, 20);
                await page.screenshot({ path: `${out}/finish-test-start.png` });
                for (let n = 0; n < 20; n++) {
                    await page.locator(`[data-study-index="${n}"][data-feedback="none"]`).waitFor();
                    await page.keyboard.type(String(reservation.problems[n].correctAnswer));
                    await page.keyboard.press('Enter');
                }
                await page.locator('[data-finish-state="cleared"]').waitFor();
                await page.screenshot({ path: `${out}/finish-test-clear.png` });
                assert.deepEqual(await readNative(page, id), state, 'Finish preserves ordinary reservation/logs/SRS/rewards');
                row.twentyAnswers = true;
            } else {
                await page.goBack(); await waitReady(page);
            assert.deepEqual(await readNative(page, id), state);
            assert.equal(await cue.count(), 0);
            }
        }
        assert.deepEqual(row.errors, []); await context.close();
    }
    report.sourceEnd = await hashes(); assert.deepEqual(report.sourceEnd, report.sourceStart);
    report.pass = true;
} catch (error) { report.error = error.stack; for (const c of browser.contexts()) for (const p of c.pages()) await p.screenshot({path: `${out}/failure.png`}).catch(() => {}); throw error; }
finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, cases: report.cases.length, out }));
