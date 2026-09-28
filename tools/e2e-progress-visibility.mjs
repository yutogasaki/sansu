import { chromium } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedNative, readNative, answerUI, appRootMetadata } from './island-e2e-helpers.mjs';
const base = process.env.SANSU_PROGRESS_URL || 'http://127.0.0.1:5266';
const out = process.env.SANSU_PROGRESS_OUTPUT || 'output/playwright/progress-visibility';
await fs.mkdir(out, { recursive: true });
const paths = ['src/pages/Stats.tsx', 'src/pages/Island.tsx', 'src/components/island/IslandLearningPanel.tsx',
    'src/components/progress/LearningProgressCards.tsx', 'src/components/progress/LearningProgressCue.tsx',
    'src/components/progress/LearningProgressCue.css', 'src/domain/learning/progressView.ts', 'src/domain/learning/progressRepository.ts', 'src/domain/levelProgression.ts'];
const hashes = () => Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await fs.readFile(path)).digest('hex') })));
const bundled = await build({ stdin: { contents: "export { createInitialProfile } from './src/domain/user/profile.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
const { createInitialProfile } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const report = { base, scope: 'Isolated explicit near-unlock profile fixture, actual planner/answer/save and routes. No child/device efficacy claim.', source: await hashes(), journeys: [], pass: false };
const browser = await chromium.launch();
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#/onboarding`);
        await page.waitForFunction(() => document.querySelector('.app-container'));
        await seedNative(page, `progress-${width}`);
        const profile = createInitialProfile('はる', 2, 7, 1, 'math');
        profile.id = `progress-${width}`; profile.soundEnabled = false; profile.englishAutoRead = false; profile.hissanModeEnabled = false;
        profile.mathLevels.find(l => l.level === 8).recentIndependentAnswersNonReview = Array(19).fill(true);
        await page.evaluate(async profile => {
            const req = indexedDB.open('SansuDatabase');
            const database = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
            const tx = database.transaction(['appData', 'profiles'], 'readwrite');
            tx.objectStore('profiles').put(profile);
            tx.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
            await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); database.close();
        }, profile);
        await page.goto(`${base}/#/stats`); await page.reload();
        const road = page.getByLabel('つぎへの道', { exact: true });
        await road.getByText('19 / 20問', { exact: true }).waitFor();
        const row = { width, app: await appRootMetadata(page), errors, before: await road.innerText() };
        await page.screenshot({ path: `${out}/${width}-record.png`, fullPage: true });
        await road.getByRole('button', { name: 'まなぶ', exact: true }).click();
        await page.locator('[data-learning-progress=true]').waitFor();
        await page.locator('[data-input-ready=true]').waitFor();
        const before = await readNative(page, profile.id);
        assert(before.plan); assert.equal(before.plan.subject, 'math');
        row.candidate = await page.locator('section[data-learning-candidate]').getAttribute('data-learning-candidate');
        await answerUI(page, before.plan, { dev: false });
        await page.locator('.learning-progress-cue-notice').getByText('さんすう：あたらしい はんいが ひらいたよ', { exact: true }).waitFor({ timeout: 15000 });
        await page.screenshot({ path: `${out}/${width}-unlocked.png` });
        const keys = page.locator('.park-keypad button');
        for (let index = 0; index < await keys.count(); index++) {
            const bounds = await keys.nth(index).boundingBox();
            assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= (width === 390 ? 844 : 1024), 'keypad fits viewport');
        }
        await page.getByRole('button', { name: 'とじる', exact: true }).click();
        await road.getByText('つぎの はんいが ひらいたよ。少しずつ れんしゅう中。', { exact: true }).waitFor();
        row.after = await road.innerText();
        await page.screenshot({ path: `${out}/${width}-after.png`, fullPage: true });
        await road.getByRole('button', { name: 'さんすうの しあげに ちょうせん', exact: true }).click();
        await page.waitForURL(/session=periodic-test.*focus_subject=math/);
        await page.locator('[data-study-question-id]').waitFor();
        await page.screenshot({ path: `${out}/${width}-test.png` });
        row.testUrl = page.url();
        assert.equal(errors.length, 0);
        report.journeys.push(row);
        await context.close();
    }
    assert.deepEqual(await hashes(), report.source, 'source stayed stable during browser check');
    report.pass = true;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
console.log(JSON.stringify({ pass: report.pass, journeys: report.journeys.length, out }));
