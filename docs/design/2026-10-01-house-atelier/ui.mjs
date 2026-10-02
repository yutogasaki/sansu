import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { seedDev, runtimeMetadata, waitMode, readNative } from '../../../tools/island-e2e-helpers.mjs';

const out = process.env.SANSU_HOUSE_OUTPUT || 'output/playwright/house-atelier';
await fs.mkdir(out, { recursive: true });
const inputs = ['src/components/island/IslandHouseOverview.tsx', 'src/components/island/IslandHouseOverview.css', 'src/components/island/IslandHouseMenu.css', 'src/components/island/IslandLearningKeepsakes.tsx', 'src/components/challenge/ChallengeHomeCard.tsx', 'src/components/island/growing/LettersPanel.tsx', 'src/components/island/growing/RoomDecorPanel.tsx'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = { started: new Date().toISOString(), source: await hashes(), fixture: 'Disposable seeded profile and one completed-set display fixture; canonical growing widths additionally simulate 74 learned words, two resident letters and challenge eligibility. No evidence of real learning acquisition, real-device usability or child preference.', cases: [] };
const browser = await chromium.launch();
try {
    for (const target of [process.env.SANSU_HOUSE_URL || 'http://127.0.0.1:5260', 'http://127.0.0.1:5198']) {
        for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
            if (target.endsWith('5198') && ![390, 768].includes(viewport.width)) continue;
            const tag = `${target.endsWith('5260') ? 'growing' : 'standard'}-${viewport.width}`;
            const row = { tag, target, viewport, captures: [], errors: [], pass: false };
            report.cases.push(row);
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: viewport.width === 390 ? 'no-preference' : 'reduce' });
            const page = await context.newPage(); page.setDefaultTimeout(20000);
            page.on('pageerror', error => row.errors.push(error.message));
            const shot = async name => {
                await page.waitForTimeout(800);
                const metadata = await runtimeMetadata(page);
                assert.equal(metadata.appRoot.islandFeatureEnabled, true); assert.equal(metadata.appRoot.natureTownFeatureEnabled, false);
                assert(metadata.appRoot.revision && metadata.appRoot.version);
                const file = `${tag}-${name}.png`;
                await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
                row.captures.push({ file, ...metadata, houseMenuCandidate: await page.locator('[data-house-menu-candidate]').getAttribute('data-house-menu-candidate').catch(() => null) });
            };
            const open = async () => {
                await page.locator('[data-house-menu-trigger]').tap();
                await page.locator('.island-house-menu[open]').waitFor();
            };
            try {
                await page.goto(`${target}/#/island`);
                const id = await seedDev(page, { name: 'Yu', familiar: true }); row.profileId = id;
                await page.evaluate(async id => {
                    const { db } = await import('/src/db/index.ts');
                    const { createIsland } = await import('/src/domain/island/catalog.ts');
                    const island = createIsland(id, Date.now()); island.completedSets = 1;
                    await db.islands.put(island);
                }, id);
                await page.goto(`${target}/#/island`); await waitMode(page, 'home'); await shot('island');
                if (target.endsWith('5260') && [390, 768].includes(viewport.width)) {
                    await page.evaluate(async id => {
                        const { db } = await import('/src/db/index.ts');
                        const { updateProfileAtomically } = await import('/src/domain/user/repository.ts');
                        const { ENGLISH_WORDS } = await import('/src/domain/english/words.ts');
                        const { createLearningProblemContext } = await import('/src/domain/learning/context.ts');
                        const { learningEvidenceForProblem } = await import('/src/domain/learning/attemptContext.ts');
                        const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
                        await updateProfileAtomically(id, p => ({ ...p, vocabWords: Object.fromEntries(ENGLISH_WORDS.slice(0, 74).map(w => [w.id, { strength: 3, independentCorrectAnswers: 1 }])) }));
                        const problem = { id: 'qa-house-eligibility', subject: 'math', categoryId: 'add_1d_1', questionText: '1 + 2 =', correctAnswer: '3', inputType: 'number', isReview: false };
                        problem.learningContext = createLearningProblemContext('math', problem);
                        await db.logs.add({ profileId: id, subject: 'math', itemId: 'add_1d_1', result: 'correct', timestamp: new Date().toISOString(), learningEvidence: learningEvidenceForProblem(problem, 'independent') });
                        const record = await growingDb.islands.get(id);
                        if (!record) throw new Error('Growing fixture was not initialized');
                        record.state.villagers = ['rabbit', 'otter'].map((species, i) => ({ id: `qa-friend-${i}`, species, home: 'pokomoko', trait: 'mellow', arrivedAt: i, variant: { color: 0, accessory: 0, sparkle: false } }));
                        await growingDb.islands.put(record);
                    }, id);
                }
                await page.goto(`${target}/#/island?view=keepsakes`); await waitMode(page, 'keepsakes');
                await page.locator('[data-house-menu-trigger]').waitFor(); await shot('room');
                const before = await readNative(page, id);
                await open(); await shot('menu');
                const dialog = page.locator('.island-house-menu');
                row.geometry = await dialog.evaluate(root => ({ width: root.getBoundingClientRect().width, scrollWidth: root.scrollWidth, controls: [...root.querySelectorAll('button')].map(b => ({ text: b.innerText, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }));
                assert(row.geometry.scrollWidth <= row.geometry.width + 1);
                assert(row.geometry.controls.every(b => b.height >= 44 && b.width >= 44));
                await dialog.getByRole('button', { name: 'いえの メニューを とじる', exact: true }).tap();
                await open(); await page.keyboard.press('Escape'); await page.locator('.island-house-menu[open]').waitFor({ state: 'hidden' });
                assert(await page.locator('[data-house-menu-trigger]').evaluate(e => document.activeElement === e));
                await open();
                await dialog.locator('[data-keepsake-action=open-keepsakes]').tap();
                await page.locator('[data-keepsake-section=keepsakes]').waitFor(); await shot('keepsakes');
                await page.getByRole('button', { name: 'いえの なかへ もどる', exact: true }).tap();
                await open(); await dialog.locator('[data-keepsake-action=notices]').tap();
                await page.locator('[data-keepsake-section=notices]').waitFor(); await shot('notices');
                await page.getByRole('button', { name: 'いえの なかへ もどる', exact: true }).tap(); await open();
                if (await dialog.locator('[data-room-entry=letters]').count()) {
                    await dialog.locator('[data-room-entry=letters]').tap(); await shot('letters');
                    if ([390, 768].includes(viewport.width)) {
                        assert.equal(await dialog.locator('.room-letters button').count(), 2);
                        await dialog.locator('.room-letters button').first().tap();
                        await dialog.locator('[data-room-panel=letters]').getByRole('button', { name: 'とじる', exact: true }).tap();
                        assert.equal(await dialog.locator('.room-entry-badge').innerText(), 'あたらしい 1つう');
                        await dialog.locator('[data-room-entry=letters]').tap();
                    }
                    await dialog.locator('[data-room-panel=letters]').getByRole('button', { name: 'とじる', exact: true }).tap();
                    await dialog.locator('[data-room-entry=decor]').tap(); await shot('decor');
                    await dialog.locator('[data-room-panel=decor]').getByRole('button', { name: 'とじる', exact: true }).tap();
                }
                await dialog.locator('.challenge-card summary').tap(); await shot('challenge-help');
                assert.deepEqual(await readNative(page, id), before, 'Browsing house entries must leave learning/profile records unchanged');
                await dialog.locator('.challenge-card summary').tap();
                const learn = dialog.locator('[data-keepsake-action=learn]'); await learn.scrollIntoViewIfNeeded(); await learn.tap();
                await waitMode(page, 'learning'); await page.locator('[data-input-ready=true]').waitFor();
                for (const digit of '0123456789') assert(await page.getByRole('button', { name: digit, exact: true }).isVisible());
                await shot('learning'); assert.equal(row.errors.length, 0, row.errors.join('\n')); row.pass = true;
                console.log('PASS', tag);
            } catch (error) { row.error = error.stack; await page.screenshot({ path: `${out}/${tag}-failure.png` }).catch(() => {}); console.error('FAIL', tag, error.message); }
            await context.close();
        }
    }
} finally {
    await browser.close(); report.sourceEnd = await hashes(); report.stable = JSON.stringify(report.source) === JSON.stringify(report.sourceEnd);
    report.pass = report.stable && report.cases.every(c => c.pass); report.finished = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
if (!report.pass) process.exitCode = 1;
