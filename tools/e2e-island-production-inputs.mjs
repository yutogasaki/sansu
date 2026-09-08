import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { activate, answerUI, assertKeypad, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5298';
const out = process.env.SANSU_ISLAND_OUTPUT || 'output/playwright/island-production';
await fs.mkdir(out, { recursive: true });
// Read the checked-in curriculum only to construct realistic unlocked memory fixtures.
const curriculumSource = await fs.readFile('src/domain/math/curriculum.ts', 'utf8');
const curriculum = Object.fromEntries([...curriculumSource.matchAll(/^\s*(\d+):\s*\[([\s\S]*?)\]/gm)]
    .map(([, level, skills]) => [level, [...skills.matchAll(/"([^"]+)"/g)].map(([, skill]) => skill)]));
assert.equal(curriculum[8]?.includes('add_1d_1'), true);
const browser = await chromium.launch();
const report = { target: base, startedAt: new Date().toISOString(), flag: 'VITE_ISLAND_ENABLED=true', captures: [], scenarios: [], pass: false,
    evidenceScope: 'Isolated native profile and unlocked memory setup; actual normal planner creates the reserved problems. No saved-plan edits. Numeric answers use real UI; complex forms are inspected without answering.' };

async function seed(page, scenario) {
    return page.evaluate(async ({ scenario, curriculum }) => {
        const id = `island-production-input-${scenario.name}`;
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const now = new Date().toISOString();
        const profile = { id, name: 'つむぎ', grade: 2, mathStartLevel: scenario.level - 1,
            mathMainLevel: scenario.level, mathMaxUnlocked: scenario.level, vocabStartLevel: 1, vocabMainLevel: 1, vocabMaxUnlocked: 1,
            subjectMode: 'math', soundEnabled: false, mathSkills: {}, vocabWords: {},
            mathLevels: Array.from({ length: 28 }, (_, index) => ({ level: index + 1, unlocked: index < scenario.level,
                enabled: index < scenario.level, recentAnswersNonReview: [], updatedAt: now })),
            streak: 0, todayCount: 0, recentAttempts: [], hissanModeEnabled: true };
        const transaction = database.transaction(['profiles', 'appData', 'memoryMath'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: id, profiles: { [id]: profile } });
        for (const [level, skills] of Object.entries(curriculum)) {
            if (Number(level) > scenario.level) continue;
            for (const skill of skills) transaction.objectStore('memoryMath').put({ profileId: id, id: skill, strength: 2,
                nextReview: skill === scenario.skill ? '2000-01-01' : '2099-01-01', updatedAt: '2000-01-01',
                totalAnswers: 20, correctAnswers: 18, incorrectAnswers: 2, skippedAnswers: 0,
                status: Number(level) < scenario.level ? 'retired' : 'active' });
        }
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', id);
        database.close();
        return id;
    }, { scenario, curriculum });
}

async function capture(page, file, manifest, fullPage = false) {
    const metadata = await runtimeMetadata(page);
    assert.equal(metadata.version, manifest.version);
    assert.equal(metadata.revision, manifest.revision);
    assert.equal(metadata.candidate, manifest.island.candidate);
    assert.equal(metadata.delivery, manifest.island.delivery);
    assert.equal(metadata.renderer, 'three');
    const caption = await page.locator('.island-stage__caption').innerText();
    const buffer = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage });
    report.captures.push({ file, sha256: createHash('sha256').update(buffer).digest('hex'), ...metadata, caption, fullPage });
}

try {
    for (const scenario of [
        { name: 'phone-numeric', width: 390, height: 844, level: 8, skill: 'add_1d_1', type: 'number', touch: true, video: true },
        { name: 'tablet-numeric', width: 768, height: 1024, level: 8, skill: 'add_1d_1', type: 'number' },
        { name: 'phone-hissan', width: 390, height: 844, level: 11, skill: 'add_2d1d_hissan_c', type: 'hissan' },
        { name: 'tablet-multi', width: 768, height: 1024, level: 21, skill: 'frac_add_same', type: 'multi-number' },
    ]) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
            hasTouch: Boolean(scenario.touch), serviceWorkers: 'block', reducedMotion: 'no-preference',
            ...(scenario.video ? { recordVideo: { dir: `${out}/video`, size: { width: scenario.width, height: scenario.height } } } : {}) });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.stack));
        try {
            await page.goto(`${base}/#/island`);
            await page.waitForURL('**/#/onboarding');
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert.equal(manifest.island.enabled, true);
            assert(!manifest.revision.includes('development'));
            if (report.manifest) assert.deepEqual(manifest, report.manifest);
            else report.manifest = manifest;
            const id = await seed(page, scenario);
            await page.goto(`${base}/#/island`);
            await waitReady(page);
            await activate(page.locator('.island-start'), scenario.touch);
            await waitMode(page, 'learning');
            const before = await readNative(page, id);
            assert.equal(before.plan.slots[0].problem.categoryId, scenario.skill);
            assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), scenario.type);
            assert.equal(before.island.completedSets, 0);
            assert.equal(before.plan.id, JSON.stringify(['island-plan-v1', id, 0]));
            assert.equal(before.plan.slots.length, 3, 'A new island reserves three real introductory problems for every input form');
            assert.equal(before.logs.length, 0);
            await assertKeypad(page, scenario.type === 'number');
            await capture(page, `${scenario.name}-learning.png`, manifest, scenario.type !== 'number');
            let sample;
            if (scenario.type === 'number') {
                const { state, ...timing } = await answerUI(page, before.plan, { dev: false, touch: scenario.touch });
                sample = timing;
                assert.equal(state.plan.cursor, 1);
                assert.equal(state.logs.length, 1);
                await page.locator('.island-stage__caption').filter({ hasText: /^ひかりが とどいて/ }).waitFor();
                await capture(page, `${scenario.name}-light-arrival.png`, manifest);
            }
            assert.deepEqual(errors, []);
            const row = { ...scenario, normalPlannerSkill: before.plan.slots[0].problem.categoryId, slots: before.plan.slots.length,
                answer: sample, pass: true };
            report.scenarios.push(row);
            await context.close();
            if (scenario.video) {
                const file = `${scenario.name}-actual-answer.webm`;
                await page.video().saveAs(`${out}/${file}`);
                row.video = { file, sha256: createHash('sha256').update(await fs.readFile(`${out}/${file}`)).digest('hex'),
                    version: manifest.version, revision: manifest.revision };
            }
            console.log(`PASS final production ${scenario.name}: normal ${scenario.type} planner and full input controls`);
        } catch (error) {
            await page.screenshot({ path: `${out}/${scenario.name}-failure.png` }).catch(() => undefined);
            report.scenarios.push({ ...scenario, pass: false, error: error.stack, errors });
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/production-input-report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
