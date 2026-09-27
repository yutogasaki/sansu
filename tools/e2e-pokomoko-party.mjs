import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5230';
const out = process.env.SANSU_PARTY_OUTPUT || `output/playwright/pokomoko-party-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
async function hashSource() {
    const hash = createHash('sha256');
    async function walk(path) { for (const e of (await fs.readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = `${path}/${e.name}`; if (e.isDirectory()) await walk(child); else hash.update(child).update(await fs.readFile(child));
    } }
    await walk('src'); hash.update(await fs.readFile('package-lock.json')); return hash.digest('hex');
}
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceStart: await hashSource(),
    qaHash: createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),
    evidence: 'Disposable profile and memory fixture; actual UI answers, normal plans, no injected party progress. Sound off. Not a child or physical-device evaluation.', runs: [], pass: false };
const browser = await chromium.launch(); let page;
try {
    const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'landscape', width: 844, height: 390 }];
    for (const layout of layouts.filter(l => !process.env.SANSU_PARTY_LAYOUT || l.name === process.env.SANSU_PARTY_LAYOUT)) {
        for (const reduced of [false, true]) {
            const name = `${layout.name}-${reduced ? 'reduced' : 'motion'}`;
            const context = await browser.newContext({ viewport: layout, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference',
                recordVideo: !reduced && layout.name === 'phone' ? { dir: out, size: layout } : undefined });
            page = await context.newPage(); page.setDefaultTimeout(15000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            const row = { name, captures: [], answers: [], pass: false }; report.runs.push(row);
            const capture = async label => {
                // Ready inputs do not prove that the offline character artwork loaded.
                if (await page.locator('.pokomoko-sprite').count()) {
                    await page.locator('.pokomoko-sprite').evaluate(async el => {
                        const img = new Image(); img.src = getComputedStyle(el).backgroundImage.slice(5, -2);
                        await img.decode();
                        await document.querySelector('.pokomoko-rim-art').decode();
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    });
                }
                const file = `${name}-${label}.png`; await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page), partyCandidate: await page.locator('[data-feedback-candidate]').getAttribute('data-feedback-candidate').catch(() => null) });
            };
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            await capture('home');
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            await page.locator('.pokomoko-sprite').waitFor();
            await page.locator('.pokomoko-sprite').evaluate(async el => { const img = new Image(); img.src = getComputedStyle(el).backgroundImage.slice(5, -2); await img.decode(); });
            await capture('ready');
            row.characterBounds = await page.locator('.pokomoko-play-scene').evaluate(scene => {
                const root = scene.closest('.island-workbench'), actor = scene.querySelector('.pokomoko-learning-actor');
                const r = root.getBoundingClientRect(), a = actor.getBoundingClientRect(), keys = root.querySelector('.park-keypad').getBoundingClientRect();
                return { position: getComputedStyle(scene.parentElement).position, actorWidth: a.width, actorHeight: a.height,
                    contained: a.top >= r.top && (a.bottom < keys.top || a.right <= keys.left) && a.left >= r.left && a.right <= r.right };
            });
            assert.equal(row.characterBounds.position, 'absolute', 'The actor shares the problem board instead of occupying a dashboard row');
            assert(row.characterBounds.actorWidth >= 110 && row.characterBounds.actorHeight >= 110 && row.characterBounds.contained, 'Full character and feet remain clear of the answer shelf in portrait and side-by-side layouts');
            const labelSizes = await page.locator('.pokomoko-party-headline, .pokomoko-combo-number').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
            assert(labelSizes.every(size => size >= 16), 'Play labels must be readable without tiny explanatory copy');
            const layoutData = await page.locator('.park-keypad button').evaluateAll(buttons => buttons.map(el => {
                const r = el.getBoundingClientRect(); return { name: el.getAttribute('aria-label'), x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
            }));
            for (const key of layoutData.filter(k => /^\d$/.test(k.name))) assert(key.w >= 44 && key.h >= 44 && key.bottom <= layout.height && key.right <= layout.width, JSON.stringify(key));
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            row.layout = layoutData;
            await page.evaluate(() => {
                window.__pokomokoFlightTrace = [];
                let present = false;
                new MutationObserver(() => {
                    const el = document.querySelector('.pokomoko-input-flight');
                    if (Boolean(el) === present) return;
                    present = Boolean(el);
                    window.__pokomokoFlightTrace.push({ present, at: performance.now(), animation: el ? getComputedStyle(el).animationName : null });
                }).observe(document.querySelector('.island-workbench'), { childList: true, subtree: true });
            });
            let saved = await readNative(page, id);
            for (let i = 1; i <= 21; i++) {
                const result = await answerUI(page, saved.plan, { touch: i % 2 === 0, dev: false }); saved = result.state;
                if (i === 6 && process.env.SANSU_PARTY_OFFLINE) { row.offlineAnswer = saved.island.learningParty; await context.setOffline(false); }
                const game = saved.island.learningParty;
                assert.equal(game.streak, i);
                row.answers.push({ i, ms: result.ms, game });
                assert.equal(await page.locator('.pokomoko-learning-feedback').getAttribute('data-streak'), String(i));
                if ([1, 3, 5, 8, 14, 21].includes(i)) {
                    await page.waitForTimeout([5, 14, 21].includes(i) ? 850 : 300); await capture(`correct-${i}`);
                }
                if (i === 1) {
                    await page.waitForFunction(() => window.__pokomokoFlightTrace.some(event => !event.present));
                    row.inputFlight = await page.evaluate(() => window.__pokomokoFlightTrace.slice(0, 2));
                    assert(row.inputFlight[0].present && !row.inputFlight[1].present);
                    assert(row.inputFlight[1].at - row.inputFlight[0].at >= 400, 'Input light must reach its destination before removal');
                    assert.equal(row.inputFlight[0].animation === 'none', reduced);
                }
                if (i === 5) {
                    assert.equal(game.rideRemaining, 3); assert.equal(game.light, 5);
                    assert.equal(await page.locator('.pokomoko-learning-feedback').getAttribute('data-riding'), 'true');
                    assert.equal(await page.locator('.pokomoko-sprite').evaluate(el => getComputedStyle(el).animationName === 'none'), reduced);
                    assert.equal(await page.locator('[data-input-ready=true]').count(), 1);
                    // Reopen while a ride is earned: counters persist, old animation does not replay.
                    await page.getByRole('button', { name: 'とじる', exact: true }).click();
                    await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).click();
                    await page.locator('[data-input-ready=true]').waitFor();
                    if (process.env.SANSU_PARTY_OFFLINE) {
                        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
                        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
                        row.offlineArtwork = await page.locator('.pokomoko-sprite').evaluate(async el => {
                            const urls = [getComputedStyle(el).backgroundImage.slice(5, -2), document.querySelector('.pokomoko-rim-art').src];
                            return Promise.all(urls.map(async url => {
                                const response = await caches.match(url);
                                return { url, cached: Boolean(response?.ok), bytes: response ? (await response.blob()).size : 0 };
                            }));
                        });
                        assert(row.offlineArtwork.every(art => art.cached && art.bytes > 0), 'Character and board artwork must be in the real offline cache');
                        await context.setOffline(true);
                    }
                    await page.reload();
                    await page.locator('[data-input-ready=true]').waitFor();
                    const resumed = await readNative(page, id);
                    assert.deepEqual(resumed.island.learningParty, game);
                    if (process.env.SANSU_PARTY_OFFLINE) row.offlineReload = { controlled: await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), game: resumed.island.learningParty };
                    assert.equal(resumed.plan.cursor, saved.plan.cursor);
                    assert.equal(await page.locator('.pokomoko-burst').count(), 0);
                    await capture('ride-resumed'); saved = resumed;
                }
            }
            assert.equal(saved.island.learningParty.light, 30);
            assert.equal(await page.locator('.pokomoko-stamp-shelf [data-earned=true]').count(), 3);
            const beforeMiss = saved.island.learningParty;
            await answerUI(page, saved.plan, { incorrect: true, touch: true, dev: false });
            saved = await readNative(page, id);
            assert.deepEqual(saved.island.learningParty, { ...beforeMiss, streak: 0 });
            assert.equal(await page.locator('.pokomoko-burst').count(), 0);
            await capture('retry-keeps-collection');
            saved = (await answerUI(page, saved.plan, { touch: true, dev: false })).state;
            assert.equal(saved.island.learningParty.streak, 0, 'Same-question correction is not independent');
            await page.getByRole('button', { name: 'ヒントを みる', exact: true }).click();
            await page.getByRole('button', { name: 'おてほんを みる', exact: true }).click();
            await page.getByRole('button', { name: 'つぎへ すすむ', exact: true }).click();
            await page.locator('[data-result=supported]').waitFor();
            const supported = await readNative(page, id);
            assert.equal(supported.island.learningParty.streak, 0);
            assert.equal(supported.island.learningParty.light, 30);
            assert.equal(supported.island.learningParty.rideRemaining, 0);
            await capture('supported');
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).waitFor();
            await capture('return');
            assert.deepEqual(errors, []);
            row.pass = true;
            const video = page.video(); await context.close(); if (video) { const path = `${out}/${name}.webm`; await video.saveAs(path); row.video = path; }
            console.log(`${name}: PASS`);
        }
    }
    report.sourceEnd = await hashSource(); assert.equal(report.sourceEnd, report.sourceStart, 'Stable app inputs'); report.pass = true;
} catch (error) {
    report.error = error.stack;
    if (page && !page.isClosed()) await page.screenshot({ path: `${out}/failure.png` });
    throw error;
} finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(out); }
