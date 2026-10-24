import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { appRootMetadata, waitForAsync } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_CURRICULUM_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_CURRICULUM_OUTPUT || 'output/playwright/curriculum-password';
await fs.mkdir(out, { recursive: true });
const sourceHash = async () => createHash('sha256').update(await fs.readFile('src/pages/CurriculumSettings.tsx')).digest('hex');
const report = { startedAt: new Date().toISOString(), target: base, sourceStart: await sourceHash(), cases: [], pass: false,
    scope: 'Disposable profile fixtures; real settings UI and IndexedDB writes. Desktop Chromium phone/tablet viewports, sound off. No release, physical device, or child observation claim.' };
const browser = await chromium.launch({ headless: true });
async function profileRecord(page, id, prepareResume = false) {
    return page.evaluate(async ({ id, prepareResume }) => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const tx = db.transaction('profiles', prepareResume ? 'readwrite' : 'readonly');
        const store = tx.objectStore('profiles');
        const get = store.get(id);
        const profile = await new Promise((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
        if (prepareResume) {
            profile.mathMaxUnlocked = profile.mathMainLevel + 1;
            profile.mathLevels = profile.mathLevels.map(level => level.level === profile.mathMainLevel + 1
                ? { ...level, unlocked: true, enabled: false } : level);
            store.put(profile);
        }
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        db.close();
        return profile;
    }, { id, prepareResume });
}
try {
    for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: 1024 }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        await page.goto(base);
        await waitForAsync(page, () => indexedDB.databases().then(dbs => dbs.some(db => db.name === 'SansuDatabase')));
        const id = await seedLearningProfile(page, {});
        for (const action of ['math', 'vocab', 'unlock', 'resume']) {
            if (action === 'resume') await profileRecord(page, id, true);
            await page.goto(`${base}/#/settings/curriculum${action === 'vocab' ? '?subject=vocab' : ''}`);
            await page.reload();
            await page.getByText('レベル いちらん', { exact: true }).waitFor();
            const before = await profileRecord(page, id);
            const target = action === 'math' ? before.mathMainLevel + 1 : before.vocabMainLevel + 1;
            const trigger = action === 'resume' ? page.getByRole('button', { name: /^Lv\..*への進級を再開$/ })
                : action === 'unlock' ? page.getByRole('button', { name: '解放上限にする', exact: true }).last()
                    : page.getByRole('button', { name: 'メインにする', exact: true }).nth(action === 'math' ? target - 1 : target - 2);
            await trigger.click();
            const dialog = page.getByRole('dialog');
            const input = dialog.getByLabel('保護者のパスワード');
            const submit = dialog.getByRole('button', { name: '変更する', exact: true });
            assert.equal(await input.getAttribute('type'), 'password');
            for (const value of ['', '9999', '320']) {
                await input.fill(value);
                await submit.click();
                await dialog.getByRole('alert').waitFor();
                assert.deepEqual(await profileRecord(page, id), before);
            }
            await input.fill('0320');
            await dialog.getByRole('button', { name: 'やめる', exact: true }).click();
            assert.deepEqual(await profileRecord(page, id), before);
            await trigger.click();
            assert.equal(await input.inputValue(), '');
            await input.fill('0320');
            const metadata = await appRootMetadata(page);
            assert.equal(metadata.islandFeatureEnabled, true);
            await page.screenshot({ path: `${out}/${width}-${action}.png` });
            await input.press('Enter');
            await dialog.waitFor({ state: 'hidden' });
            const after = await profileRecord(page, id);
            if (action === 'resume') assert.equal(after.mathLevels.find(level => level.level === before.mathMainLevel + 1).enabled, true);
            else if (action === 'unlock') assert.equal(after.mathMaxUnlocked, 24);
            else assert.equal(after[action === 'math' ? 'mathMainLevel' : 'vocabMainLevel'], target);
            report.cases.push({ width, action, metadata, pass: true });
        }
        await context.close();
    }
    report.sourceEnd = await sourceHash();
    assert.equal(report.sourceEnd, report.sourceStart);
    report.pass = true;
} catch (error) {
    report.error = error.stack;
    throw error;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
console.log(`PASS curriculum password: ${report.cases.length} cases (${out})`);
