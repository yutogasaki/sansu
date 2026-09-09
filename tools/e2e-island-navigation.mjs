import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { answerUI, button, readNative, seedNative, waitMode, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5219';
const out = process.env.SANSU_NAVIGATION_OUTPUT || 'output/playwright/island-navigation';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, navigationCandidate: 'island-navigation-five-tabs-v2', fixture: 'Native profile only; UI reserves and answers learning, moves starter furniture, and captures a real photo.', captures: [], scenarios: [], pass: false };
try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(20000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const capture = async name => {
            const file = `${viewport.width}-${name}.png`;
            // Framer Motion uses JS animation; screenshot's CSS animation flag
            // alone can catch a settings detail while its height is still zero.
            await page.waitForTimeout(400);
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            report.captures.push({ file, ...(await runtimeMetadata(page)) });
        };
        const nav = page.locator('.island-shell-nav');
        const learn = page.locator('.island-shell-tab--learn');
        const hash = () => new URL(page.url()).hash;
        const ordinary = async expected => {
            await nav.waitFor();
            assert.equal(hash(), expected);
            assert.deepEqual(await nav.getByRole('button').allTextContents(), ['しま', 'いえ', 'まなぶ', 'きろく', '設定']);
        };
        const focus = async mode => {
            await waitMode(page, mode);
            await nav.waitFor({ state: 'hidden' });
            assert.equal(await nav.count(), 0, `${mode} hides navigation`);
        };
        try {
            await page.goto(base);
            await page.waitForURL('**/#/onboarding');
            await page.locator('.island-welcome').waitFor();
            const id = await seedNative(page, randomUUID());
            // Select the same arithmetic level as the actual "足し算まで" setup,
            // so this draft regression exercises a numeric form, not a choice.
            await page.evaluate(async id => {
                const request = indexedDB.open('SansuDatabase');
                const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                const tx = db.transaction(['profiles', 'appData'], 'readwrite');
                const read = request => new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                const profile = await read(tx.objectStore('profiles').get(id));
                const app = await read(tx.objectStore('appData').get('app'));
                Object.assign(profile, { mathStartLevel: 8, mathMainLevel: 9, mathMaxUnlocked: 9,
                    mathLevels: Array.from({ length: 9 }, (_, index) => ({ level: index + 1, unlocked: true, enabled: true, recentAnswersNonReview: [] })) });
                tx.objectStore('profiles').put(profile); app.profiles[id] = profile; tx.objectStore('appData').put(app);
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
                db.close();
            }, id);
            await page.goto(base); await waitReady(page);
            await ordinary('#/island');
            assert.equal((await readNative(page, id)).plan, undefined, 'Top entry does not reserve questions');
            for (const entry of ['/#/?learn=1', '/#/missing-page?start=learn', '/#/onboarding']) {
                await page.goto(`${base}${entry}`); await waitReady(page); await waitMode(page, 'home');
                await ordinary('#/island');
                assert.equal((await readNative(page, id)).plan, undefined, `${entry} cannot start questions`);
            }
            await capture('home');
            await nav.getByRole('button', { name: 'いえ', exact: true }).click();
            await waitMode(page, 'keepsakes'); await ordinary('#/island?view=keepsakes');
            assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'いえ');
            await capture('house');
            await page.locator('[data-keepsake-action="album"]').click();
            await waitMode(page, 'album'); await ordinary('#/island?view=album');
            assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'いえ');
            await learn.click(); await focus('learning'); await waitReady(page);
            await button(page, 'とじる').click(); await waitMode(page, 'album');
            await ordinary('#/island?view=album');
            await nav.getByRole('button', { name: 'いえ', exact: true }).click();
            await waitMode(page, 'keepsakes');
            await page.locator('[data-keepsake-action="album"]').waitFor();
            await nav.getByRole('button', { name: 'しま', exact: true }).click();
            await waitMode(page, 'home');
            await nav.getByRole('button', { name: '設定', exact: true }).click();
            await page.getByRole('button', { name: /^学習 / }).click();
            await ordinary('#/settings?section=learning');
            await capture('settings-detail');
            const sourceHeading = page.getByRole('heading', { name: '学習', exact: true });
            const sourceHandle = await sourceHeading.elementHandle();
            await learn.click(); await focus('learning'); await waitReady(page);
            assert.equal(hash(), '#/settings?section=learning&learn=1');
            assert.equal(await sourceHandle.evaluate(element => element.isConnected), true, 'Source detail stays mounted');
            assert.equal(await sourceHeading.isVisible(), false, 'Source detail is covered');
            await page.locator('.park-keypad').getByRole('button', { name: '1', exact: true }).click();
            const draft = await page.locator('.park-input').allTextContents();
            assert(draft.some(value => value.includes('1')));
            const saved = await readNative(page, id);
            await capture('learning');
            await button(page, 'とじる').click(); await ordinary('#/settings?section=learning');
            assert.equal(await sourceHandle.evaluate(element => element.isConnected), true);
            assert.deepEqual(await readNative(page, id), saved, 'Closing cannot write an answer or change the reserved plan');
            await learn.click(); await focus('learning'); await waitReady(page);
            assert.deepEqual(await page.locator('.park-input').allTextContents(), draft, 'The same input draft resumes');
            assert.deepEqual(await readNative(page, id), saved);
            await page.goBack(); await ordinary('#/settings?section=learning');
            await page.goForward(); await focus('learning'); await waitReady(page);
            assert.deepEqual(await page.locator('.park-input').allTextContents(), draft, 'History preserves input');
            await button(page, 'とじる').click(); await ordinary('#/settings?section=learning');
            await button(page, 'もどる').click(); await ordinary('#/settings');
            await nav.getByRole('button', { name: 'きろく', exact: true }).click(); await ordinary('#/stats');
            await capture('records');
            await nav.getByRole('button', { name: 'しま', exact: true }).click();
            await waitMode(page, 'home'); await ordinary('#/island');
            assert.deepEqual((await readNative(page, id)).plan, saved.plan);
            await page.reload(); await waitReady(page); await waitMode(page, 'home');
            await ordinary('#/island');
            for (const entry of ['', '/#/', '/#/?start=learn', '/#/onboarding']) {
                await page.goto(`${base}${entry}`); await waitReady(page); await waitMode(page, 'home');
                await ordinary('#/island');
                const returned = await readNative(page, id);
                for (const store of ['islandPlans', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns']) {
                    assert.deepEqual(returned[store], saved[store], `Top return preserves ${store} without resuming learning`);
                }
            }
            await button(page, 'しまのメニュー').click();
            await button(page, 'もちもの').click(); await ordinary('#/island?view=inventory');
            const move = page.getByRole('button', { name: /を うごかす$/ }).first();
            await move.click(); await focus('placement');
            const beforeMove = await readNative(page, id);
            await button(page, 'いどうを とじる').click(); await ordinary('#/island?view=inventory');
            assert.deepEqual((await readNative(page, id)).island.items, beforeMove.island.items, 'Cancel leaves furniture unchanged');
            await move.click(); await focus('placement');
            await button(page, 'ここに おく').click(); await waitMode(page, 'home'); await ordinary('#/island');
            await page.goto(`${base}/#/island?view=photos`);
            await page.locator('.island-photo-empty').waitFor(); await ordinary('#/island?view=photos');
            await button(page, 'しゃしんを とる').click(); await focus('camera');
            await button(page, 'カメラを とじる').click(); await ordinary('#/island?view=photos');
            await button(page, 'しゃしんを とる').click(); await focus('camera');
            await page.locator('[data-photo-action="capture"]').click();
            await page.locator('[data-photo-saved="true"]').waitFor();
            await button(page, 'しゃしんを みる').click(); await ordinary('#/island?view=photos');
            await page.locator('[data-photo-id]').first().click(); await focus('photos');
            await capture('photo-detail');
            await button(page, 'とじる').click(); await ordinary('#/island?view=photos');
            await capture('photos');
            await page.goto(`${base}/#/settings?section=learning&learn=1`); await focus('learning'); await waitReady(page);
            await page.reload(); await focus('learning'); await waitReady(page);
            assert.deepEqual((await readNative(page, id)).plan, saved.plan, 'Direct learning reload preserves the same reservation');
            await button(page, 'とじる').click(); await ordinary('#/settings?section=learning');
            await button(page, '変更').first().click(); await ordinary('#/settings/curriculum');
            const curriculumScroll = page.locator('.brand-utility-screen > .overflow-y-auto');
            await page.waitForFunction(() => { const element = document.querySelector('.brand-utility-screen > .overflow-y-auto'); return element && element.scrollHeight > element.clientHeight + 160; });
            await curriculumScroll.evaluate(element => { element.scrollTop = 160; });
            const scrollTop = await curriculumScroll.evaluate(element => element.scrollTop);
            await learn.click(); await focus('learning'); await waitReady(page);
            await button(page, 'とじる').click(); await ordinary('#/settings/curriculum');
            assert.equal(await curriculumScroll.evaluate(element => element.scrollTop), scrollTop, 'Close restores the curriculum scroll position');
            await button(page, 'もどる').click(); await ordinary('#/settings?section=learning');
            await button(page, 'もどる').click(); await ordinary('#/settings');
            await page.goto(`${base}/#/island?view=placement`);
            await page.waitForURL('**/#/island?view=inventory'); await ordinary('#/island?view=inventory');
            await nav.getByRole('button', { name: 'きろく', exact: true }).click(); await ordinary('#/stats');
            await page.getByRole('heading', { name: /まなびの きろくが たまるよ|ここに学びの記録がたまります/ }).waitFor();
            await page.locator('.stats-first-record').getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            assert.equal(await page.locator('.stats-metric').count(), 0, 'Empty records explain the next action instead of repeating zero metrics');
            await learn.click(); await focus('learning'); await waitReady(page);
            const answered = await answerUI(page, (await readNative(page, id)).plan, { dev: false });
            assert.equal(answered.state.logs.length, 1);
            await button(page, 'とじる').click(); await ordinary('#/stats');
            await page.waitForFunction(() => [...document.querySelectorAll('div')].some(element => element.textContent === 'かいとう' && /^1\s*かいとう$/.test(element.parentElement.textContent)));
            const metric = page.getByText('かいとう', { exact: true }).locator('..');
            assert.match(await metric.innerText(), /^1\s/, 'One saved answer replaces the empty state with the actual answer metric');
            assert.deepEqual(errors, []);
            report.scenarios.push({ viewport, pass: true, checks: ['top entry without learning', 'stale top query and unknown URL recovery', 'existing-profile onboarding return', 'pending-plan top return without learning writes', 'ordinary tabs', 'settings source retained', 'draft and seven-store equality', 'back/forward', 'home reload without auto-start', 'placement cancel/save', 'camera close', 'real photo/detail close', 'direct learning reload/close', 'curriculum scroll restored', 'direct placement fallback', 'records refresh after answer'], errors });
            console.log(`PASS navigation ${viewport.width}x${viewport.height}`);
        } catch (error) {
            await page.screenshot({ path: `${out}/${viewport.width}-failure.png` }).catch(() => {});
            report.scenarios.push({ viewport, pass: false, error: String(error), url: page.url(), errors });
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
