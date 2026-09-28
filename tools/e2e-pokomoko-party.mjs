import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, assertKeypad, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5230';
const candidate = 'pokomoko-pop-live-v5';
const out = process.env.SANSU_PARTY_OUTPUT || `output/playwright/pokomoko-party-${Date.now()}`;
await fs.mkdir(out, { recursive: true });
async function hashSource() {
    const hash = createHash('sha256');
    async function walk(path) { for (const e of (await fs.readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = `${path}/${e.name}`; if (e.isDirectory()) await walk(child); else hash.update(child).update(await fs.readFile(child));
    } }
    await walk('src'); hash.update(await fs.readFile('package-lock.json')); return hash.digest('hex');
}

// Scope these readings to the learning actor: the hidden island world may also
// own a THREE canvas and renderer metadata.
async function assertLiveActor(page, reduced) {
    const actor = page.locator('.pokomoko-learning-actor-live');
    await actor.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.pokomoko-learning-actor-live')?.dataset.renderer === 'live-original');
    const state = await actor.evaluate(async element => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const surface = element.querySelector('canvas'), hand = element.querySelector('.pokomoko-hand-anchor');
        const a = element.getBoundingClientRect(), c = surface?.getBoundingClientRect(), h = hand?.getBoundingClientRect();
        return {
            renderer: element.dataset.renderer, reducedMotion: element.dataset.reducedMotion,
            renderCount: Number(element.dataset.renderCount), fallbackUrl: element.dataset.fallbackUrl,
            canvas: surface && { width: surface.width, height: surface.height, cssWidth: c.width, cssHeight: c.height,
                visible: getComputedStyle(surface).visibility !== 'hidden' },
            hand: h && { x: h.left - a.left, y: h.top - a.top,
                contained: h.left >= a.left && h.top >= a.top && h.right <= a.right && h.bottom <= a.bottom },
        };
    });
    assert.equal(state.renderer, 'live-original', 'Normal journeys must render the original live model; fallback is separate evidence');
    assert.equal(state.reducedMotion, String(reduced));
    assert(state.renderCount > 0, 'The actor must have rendered a real frame');
    assert(state.canvas?.visible && state.canvas.width > 0 && state.canvas.height > 0
        && state.canvas.cssWidth >= 100 && state.canvas.cssHeight >= 100, JSON.stringify(state));
    assert(state.hand?.contained, `The projected paw contact must remain on the actor: ${JSON.stringify(state.hand)}`);
    return state;
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
                // Ready input does not prove that the live character rendered a frame.
                const actor = await page.locator('.pokomoko-learning-actor').isVisible() ? await assertLiveActor(page, reduced) : null;
                const file = `${name}-${label}.png`; await page.screenshot({ path: `${out}/${file}`, animations: 'allow' });
                row.captures.push({ file, ...await runtimeMetadata(page), actor, partyCandidate: await page.locator('[data-feedback-candidate]').getAttribute('data-feedback-candidate').catch(() => null) });
            };
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            await capture('home');
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor();
            assert.equal(await page.locator('.island-workbench').getAttribute('data-learning-candidate'), candidate);
            await assertLiveActor(page, reduced);
            await assertKeypad(page);
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
                window.__pokomokoFlightFrames = [];
                let present = false;
                new MutationObserver(() => {
                    const el = document.querySelector('.pokomoko-input-flight');
                    if (Boolean(el) === present) return;
                    present = Boolean(el);
                    window.__pokomokoFlightTrace.push({ present, at: performance.now(), digit: el?.textContent?.trim() ?? null,
                        problemId: document.querySelector('.island-answer')?.getAttribute('data-problem-id') });
                    if (el) {
                        const sample = () => {
                            if (!el.isConnected) return;
                            const style = getComputedStyle(el);
                            window.__pokomokoFlightFrames.push({ transform: style.transform, opacity: Number(style.opacity),
                                visible: getComputedStyle(el.parentElement).display !== 'none' });
                            requestAnimationFrame(sample);
                        };
                        requestAnimationFrame(sample);
                    }
                }).observe(document.querySelector('.island-workbench'), { childList: true, subtree: true });
            });
            let saved = await readNative(page, id), completedSinceOpen = 0;
            for (let i = 1; i <= 21; i++) {
                const result = await answerUI(page, saved.plan, { touch: i % 2 === 0, dev: false }); saved = result.state;
                if (i === 6 && process.env.SANSU_PARTY_OFFLINE) { row.offlineAnswer = saved.island.learningParty; await context.setOffline(false); }
                const game = saved.island.learningParty;
                assert.equal(game.streak, i);
                completedSinceOpen++;
                const showLevel = Number(await page.locator('.island-workbench').getAttribute('data-show-level'));
                assert.equal(showLevel, Math.min(3, Math.floor(completedSinceOpen / 3)), 'Stage builds from completed problems independently of combo');
                row.answers.push({ i, ms: result.ms, game, showLevel });
                assert.equal(await page.locator('.pokomoko-learning-feedback').getAttribute('data-streak'), String(i));
                if ([1, 3, 5, 8, 14, 21].includes(i)) {
                    await page.waitForTimeout([5, 14, 21].includes(i) ? 850 : 300); await capture(`correct-${i}`);
                }
                if (i === 1) {
                    await page.waitForFunction(() => window.__pokomokoFlightTrace.some(event => !event.present));
                    row.inputFlight = await page.evaluate(() => window.__pokomokoFlightTrace.slice(0, 2));
                    assert(row.inputFlight[0].present && !row.inputFlight[1].present);
                    const sameProblem = row.inputFlight[0].problemId === row.inputFlight[1].problemId;
                    if (sameProblem) assert(row.inputFlight[1].at - row.inputFlight[0].at >= 400, 'A continuing problem keeps its full numeral handoff');
                    else assert.equal(await page.locator('.pokomoko-input-flight').count(), 0, 'A completed problem retires its numeral before it can enter the next answer');
                    assert.match(row.inputFlight[0].digit, /^[0-9.]$/, 'The actual entered numeral travels to the answer');
                    row.inputFlightFrames = await page.evaluate(() => window.__pokomokoFlightFrames);
                    assert(row.inputFlightFrames.length > 0);
                    if (reduced) assert(row.inputFlightFrames.every(frame => !frame.visible), 'Reduced motion hides the moving numeral overlay');
                    else {
                        assert(new Set(row.inputFlightFrames.map(frame => frame.transform)).size > 1, 'The numeral visibly travels between key, paw and answer');
                        assert(row.inputFlightFrames.some(frame => frame.visible && frame.opacity > 0));
                    }
                }
                if (i === 5) {
                    assert.equal(game.rideRemaining, 3); assert.equal(game.light, 5);
                    assert.equal(await page.locator('.pokomoko-learning-feedback').getAttribute('data-riding'), 'true');
                    await assertLiveActor(page, reduced);
                    assert.equal(await page.locator('[data-input-ready=true]').count(), 1);
                    // Reopen while a ride is earned: counters persist, old animation does not replay.
                    await page.getByRole('button', { name: 'とじる', exact: true }).click();
                    await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).click();
                    await page.locator('[data-input-ready=true]').waitFor();
                    if (process.env.SANSU_PARTY_OFFLINE) {
                        await page.evaluate(async () => { await navigator.serviceWorker.ready; });
                        await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
                        await assertLiveActor(page, reduced);
                        row.offlineActorResources = await page.locator('.pokomoko-learning-actor-live').evaluate(async el => {
                            // The original geometry lives in the lazy actor JS, not a remote GLB.
                            const scripts = performance.getEntriesByType('resource').map(entry => entry.name)
                                .filter(name => { const url = new URL(name); return url.origin === location.origin && url.pathname.endsWith('.js'); });
                            const urls = [...new Set(scripts)].map(url => ({ url, kind: 'script' }));
                            if (el.dataset.fallbackUrl) urls.push({ url: new URL(el.dataset.fallbackUrl, location.href).href, kind: 'original-fallback' });
                            return Promise.all(urls.map(async resource => {
                                const response = await caches.match(resource.url);
                                return { ...resource, cached: Boolean(response?.ok), bytes: response ? (await response.blob()).size : 0 };
                            }));
                        });
                        assert(row.offlineActorResources.some(asset => asset.kind === 'script')
                            && row.offlineActorResources.some(asset => asset.kind === 'original-fallback')
                            && row.offlineActorResources.every(asset => asset.cached && asset.bytes > 0), 'Live-model code and original fallback must be in the real offline cache');
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
                    completedSinceOpen = 0;
                    assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), '0', 'Session presentation resets without erasing the saved party');
                }
            }
            assert.equal(saved.island.learningParty.light, 30);
            assert.equal(await page.locator('.pokomoko-stamp-shelf [data-earned=true]').count(), 3);
            const beforeMiss = saved.island.learningParty;
            const showBeforeMiss = await page.locator('.island-workbench').getAttribute('data-show-level');
            assert.equal(showBeforeMiss, '3');
            await answerUI(page, saved.plan, { incorrect: true, touch: true, dev: false });
            saved = await readNative(page, id);
            assert.deepEqual(saved.island.learningParty, { ...beforeMiss, streak: 0 });
            assert.equal(await page.locator('.island-workbench').getAttribute('data-show-level'), showBeforeMiss, 'A miss resets combo but retains the stage already built in this session');
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
