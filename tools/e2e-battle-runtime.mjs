import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { button, readNative, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_BATTLE_RUNTIME_OUTPUT || 'output/playwright/battle-runtime';
const defaultViewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 1024, height: 390 },
];
const viewports = process.env.SANSU_BATTLE_RUNTIME_VIEWPORTS
    ? process.env.SANSU_BATTLE_RUNTIME_VIEWPORTS.split(',').map(value => {
        const match = /^(\d{3,4})x(\d{3,4})$/.exec(value.trim());
        if (!match) throw new Error('Invalid battle viewport "' + value + '"; expected WIDTHxHEIGHT');
        return { width: Number(match[1]), height: Number(match[2]) };
    })
    : defaultViewports;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const viewportId = viewport => viewport.width + 'x' + viewport.height;
const startCoopRound = async (page, start) => {
    await start.click();
    await page.waitForFunction(() => {
        const frames = [...document.querySelectorAll('.battle-question-frame')];
        return frames.length === 2 && frames.every(frame => {
            const text = (frame.innerText ?? '').trim();
            return text.length > 0 && text !== '...';
        });
    }, undefined, { timeout: 12000 });
    const questions = await page.locator('.battle-question-frame').evaluateAll(elements =>
        elements.map(element => (element.innerText ?? '').trim().replace(/\s+/g, ' ')));
    assert.equal(questions.length, 2, 'Countdown completes with both player panels mounted');
    assert(questions.every(question => question && question !== '...'),
        'Countdown completion generates a question for each player');
    return { questions };
};
const endCoopAtTimeout = async page => {
    await page.getByRole('heading', { name: 'じかんぎれ...', exact: true }).waitFor();
};
const setDeterministicBattleRandom = async page => {
    await page.evaluate(() => {
        window.__battleRuntimeOriginalRandom ??= Math.random;
        Math.random = () => 0;
    });
};
const restoreBattleRandom = async page => {
    await page.evaluate(() => {
        const originalRandom = window.__battleRuntimeOriginalRandom;
        if (typeof originalRandom === 'function') {
            Math.random = originalRandom;
            delete window.__battleRuntimeOriginalRandom;
        }
    });
};
const startTugRound = async (page, start) => {
    await setDeterministicBattleRandom(page);
    await start.click();
    const p1Visual = page.locator('.battle-player-card').first()
        .locator('.battle-question-frame [data-visual-count]').first();
    await p1Visual.waitFor({ timeout: 12000 });
    const visual = await p1Visual.evaluate(element => ({
        surface: element.getAttribute('data-visual-surface'),
        count: Number(element.getAttribute('data-visual-count')),
    }));
    assert.equal(visual.surface, 'count-frame', 'The deterministic tug sample uses the visible five-frame counting problem');
    assert(Number.isInteger(visual.count) && visual.count > 0 && visual.count <= 5,
        'The visible counting frame has a readable item count');
    return { visual };
};
const winTugRoundFromVisibleCount = async page => {
    const p1 = page.locator('.battle-player-card').first();
    for (let targetCorrectCount = 1; targetCorrectCount <= 5; targetCorrectCount += 1) {
        const visual = p1.locator('.battle-question-frame [data-visual-count]').first();
        await visual.waitFor({ timeout: 5000 });
        const visibleCount = await visual.getAttribute('data-visual-count');
        const choices = p1.locator('.battle-choice-wrap button');
        const labels = (await choices.allTextContents()).map(label => label.trim());
        const correctChoiceIndex = labels.findIndex(label => label === visibleCount);
        assert(correctChoiceIndex >= 0,
            'The visible item count ' + visibleCount + ' is available as an answer choice');

        await setDeterministicBattleRandom(page);
        await choices.nth(correctChoiceIndex).click();
        if (targetCorrectCount < 5) {
            await page.waitForFunction(expected => {
                const label = document.querySelector('.battle-player-card .battle-stats span')?.textContent ?? '';
                return Number(label.replace(/\D/g, '')) === expected;
            }, targetCorrectCount, { timeout: 5000 });
            await restoreBattleRandom(page);
        } else {
            await page.getByText('プレイヤー1 の かち！', { exact: true }).waitFor({ timeout: 5000 });
            // The test holds the RNG fixed only while the visible count problem is generated.
            // Let its short result flourish finish before capturing the stable result state.
            await page.waitForTimeout(2100);
            await restoreBattleRandom(page);
        }
    }
};
const report = {
    target: base,
    journey: 'Current Island → Other Games → Boss Coop setup/play/result/replay/end → Tug of War setup/play/win/result/replay → Island',
    viewports,
    fixture: 'Each run uses a fresh browser context and a disposable native profile. Co-op uses the normal countdown and accelerates only its 1-second interval to 10ms. Tug of War uses grade -2 and a temporary deterministic generator only to render count_5; the test answers from the visible item count and plays to the five-step result. No learning records are changed; stores are compared before and after.',
    captures: [],
    scenarios: [],
    pass: false,
};

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();

try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(20000);
        const scenario = { viewport, pass: false, pageErrors: [], checks: [] };
        const profileId = 'battle-runtime-' + viewportId(viewport) + '-' + randomUUID();
        page.on('pageerror', error => scenario.pageErrors.push(error.message));

        const capture = async name => {
            const file = viewportId(viewport) + '-' + name + '.png';
            await page.screenshot({ path: out + '/' + file, animations: 'disabled' });
            const metadata = await page.locator('.app-container').evaluate(element => ({
                url: location.href,
                revision: element.dataset.buildRevision ?? null,
                version: element.dataset.buildVersion ?? null,
                rootConfiguredDelivery: element.dataset.deliveryId ?? null,
                routeCandidate: 'not-applicable-shared-utility',
                islandFeatureEnabled: element.dataset.islandFeatureEnabled === 'true',
                natureTownFeatureEnabled: element.dataset.natureTownFeatureEnabled === 'true',
                viewport: { width: innerWidth, height: innerHeight },
                serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
                reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            }));
            assert.equal(metadata.islandFeatureEnabled, true, 'Battle evidence must use the current Island-enabled app');
            assert.equal(metadata.natureTownFeatureEnabled, false, 'Battle evidence must not use the Nature Town preview');
            assert(metadata.revision && metadata.version?.startsWith(metadata.revision + ':'),
                'Battle evidence must identify the unique runtime build version');
            report.captures.push({ file, ...metadata });
        };

        try {
            await page.goto(base);
            await page.waitForURL('**/#/onboarding');
            await page.locator('.island-welcome').waitFor();
            await seedNative(page, profileId);
            await page.goto(base);
            await waitReady(page);
            await waitMode(page, 'home');
            const baseline = await readNative(page, profileId);
            const rootFlags = await page.locator('.app-container').evaluate(element => ({
                island: element.dataset.islandFeatureEnabled,
                natureTown: element.dataset.natureTownFeatureEnabled,
            }));
            assert.deepEqual(rootFlags, { island: 'true', natureTown: 'false' });

            const nav = page.locator('.island-shell-nav');
            await nav.getByRole('button', { name: 'しま', exact: true }).click();
            await button(page, 'しまのメニュー').click();
            await page.locator('[data-home-group="more-play"] > summary').click();
            await page.locator('[data-home-action="other-games"]').click();
            await page.waitForURL(url => url.hash === '#/battle');
            await page.getByRole('heading', { name: 'ほかの あそび', exact: true }).waitFor();
            await page.waitForTimeout(400);
            await capture('other-games');
            scenario.checks.push('Island menu opens the shared Other Games page');

            await page.getByRole('button', { name: /ふたりで きょうりょく/ }).click();
            await page.waitForURL(url => url.hash === '#/battle/play?mode=boss_coop');

            if (viewport.width >= 768 && viewport.height > viewport.width) {
                await page.getByText('タブレットを よこにしてね', { exact: true }).waitFor();
                const returnToGames = button(page, 'ほかの あそびへ もどる');
                const returnBox = await returnToGames.boundingBox();
                assert(returnBox && returnBox.width >= 44 && returnBox.height >= 44,
                    'Tablet portrait guidance keeps a 44px-or-larger return target');
                await capture('tablet-rotate-guidance');
                scenario.checks.push('Tablet portrait explains landscape play and keeps a large return action');
                await returnToGames.click();
                await page.waitForURL(url => url.hash === '#/battle');
            } else {
                await page.locator('.battle-setup-screen').waitFor();
                const modeGroup = page.getByRole('group', { name: 'あそびの モード' });
                const coopMode = modeGroup.getByRole('button', { name: /ボスきょうりょく/ });
                assert.equal(await coopMode.getAttribute('aria-pressed'), 'true',
                    'The selected Other Games card is reflected in Battle setup');

                const gradeOptions = page.getByRole('button', { name: '1ねんせい', exact: true });
                assert.equal(await gradeOptions.count(), 2);
                const start = button(page, 'スタート！');
                assert.equal(await start.isEnabled(), false, 'Both players must choose a grade before starting');
                await gradeOptions.first().click();
                await gradeOptions.last().click();
                assert.equal(await start.isEnabled(), true, 'Selecting both grades enables the start action');
                await page.waitForTimeout(400);
                await capture('battle-setup-ready');
                scenario.checks.push('Co-op route preserves its selected mode and makes both-player setup operable');

                await page.evaluate(() => {
                    const nativeSetInterval = window.setInterval.bind(window);
                    window.setInterval = (callback, delay, ...args) =>
                        nativeSetInterval(callback, delay === 1000 ? 10 : delay, ...args);
                });
                const round = await startCoopRound(page, start);
                const playing = await page.evaluate(() => ({
                    documentWidth: document.documentElement.scrollWidth,
                    panels: [...document.querySelectorAll('.battle-player-panel')].map(panel => {
                        const panelRect = panel.getBoundingClientRect();
                        const question = panel.querySelector('.battle-question-frame');
                        const questionText = (question?.innerText ?? '').trim().replace(/\s+/g, ' ');
                        const sections = [...panel.children].map(element => {
                            const rect = element.getBoundingClientRect();
                            const style = getComputedStyle(element);
                            return {
                                className: element.className,
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                                bottom: rect.bottom,
                                clientHeight: element.clientHeight,
                                scrollHeight: element.scrollHeight,
                                flex: style.flex,
                                minHeight: style.minHeight,
                                maxHeight: style.maxHeight,
                                overflowY: style.overflowY,
                            };
                        });
                        const controls = [...panel.querySelectorAll('.battle-keypad-wrap button')].map(control => {
                            const rect = control.getBoundingClientRect();
                            return {
                                label: control.getAttribute('aria-label') || control.innerText.trim(),
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                                insidePanel: rect.left >= panelRect.left - 1
                                    && rect.right <= panelRect.right + 1
                                    && rect.top >= panelRect.top - 1
                                    && rect.bottom <= panelRect.bottom + 1,
                            };
                        });
                        return {
                            x: panelRect.x,
                            y: panelRect.y,
                            width: panelRect.width,
                            height: panelRect.height,
                            questionText,
                            sections,
                            visualSurfaces: [...(question?.querySelectorAll('[data-visual-surface]') ?? [])]
                                .map(surface => surface.getAttribute('data-visual-surface')),
                            controls,
                        };
                    }),
                    viewport: { width: innerWidth, height: innerHeight },
                }));
                scenario.countdown = round;
                scenario.playing = playing;
                assert.equal(playing.documentWidth <= viewport.width + 1, true,
                    'Battle play has no horizontal page overflow');
                assert.equal(playing.panels.length, 2, 'Both player panels are present during play');
                for (const [index, panel] of playing.panels.entries()) {
                    assert(panel.questionText && panel.questionText !== '...',
                        'Player ' + (index + 1) + ' receives a question after the countdown');
                    assert(panel.controls.length >= 3,
                        'Player ' + (index + 1) + ' receives an answer control');
                    assert(panel.controls.every(control => control.width >= 44 && control.height >= 44),
                        'Player ' + (index + 1) + ' answer controls meet the 44px minimum');
                    assert(panel.controls.every(control => control.insidePanel
                        && control.x >= 0 && control.x + control.width <= viewport.width + 1
                        && control.y >= 0 && control.y + control.height <= viewport.height + 1),
                    'Player ' + (index + 1) + ' answer controls remain visible in the player panel');
                }
                await capture('battle-playing');
                scenario.checks.push('Both timed play panels expose questions and reachable 44px answer controls');

                await endCoopAtTimeout(page);
                await page.getByText('もういちど ちょうせんしよう', { exact: true }).waitFor();
                await capture('battle-timeout-result');
                const result = await page.evaluate(() => {
                    const labels = ['もう いっかい！', 'おわる'];
                    return {
                        documentWidth: document.documentElement.scrollWidth,
                        viewport: { width: innerWidth, height: innerHeight },
                        metrics: [...document.querySelectorAll('.battle-result-metric > :last-child')]
                            .map(element => {
                                const rect = element.getBoundingClientRect();
                                return {
                                    label: element.innerText.trim().replace(/\s+/g, ' '),
                                    width: rect.width,
                                    height: rect.height,
                                    clientWidth: element.clientWidth,
                                    scrollWidth: element.scrollWidth,
                                };
                            }),
                        actions: [...document.querySelectorAll('button')]
                            .filter(element => labels.includes(element.innerText.trim().replace(/\s+/g, ' ')))
                            .map(element => {
                                const rect = element.getBoundingClientRect();
                                return {
                                    label: element.innerText.trim().replace(/\s+/g, ' '),
                                    x: rect.x,
                                    y: rect.y,
                                    width: rect.width,
                                    height: rect.height,
                                };
                            }),
                    };
                });
                scenario.timeoutResult = result;
                assert.equal(result.documentWidth <= viewport.width + 1, true,
                    'Timeout result has no horizontal page overflow');
                assert.equal(result.actions.length, 2, 'Timeout result offers replay and exit');
                assert.equal(result.metrics.length, 3, 'Co-op timeout result explains each summary value');
                assert(result.metrics.every(metric => metric.height <= 18
                    && metric.scrollWidth <= metric.clientWidth + 1),
                'Result metric labels stay on a single line without clipping');
                assert(result.actions.every(action => action.width >= 44 && action.height >= 44
                    && action.x >= 0 && action.x + action.width <= viewport.width + 1
                    && action.y >= 0 && action.y + action.height <= viewport.height + 1),
                'Timeout result keeps replay and exit controls visible and touchable');
                scenario.checks.push('Timeout result metrics keep readable single-line labels');
                scenario.checks.push('Timeout is non-shaming and offers visible replay and exit actions');

                await button(page, 'もう いっかい！').click();
                await page.locator('.battle-setup-screen').waitFor();
                await page.waitForTimeout(400);
                assert.equal(await coopMode.getAttribute('aria-pressed'), 'true',
                    'Replay keeps the chosen co-op mode');
                assert.equal(await start.isEnabled(), false,
                    'Replay returns to setup and asks for both player grades again');
                await capture('battle-replay-setup');
                scenario.checks.push('Replay returns to a fresh, ready-to-configure co-op setup');

                await gradeOptions.first().click();
                await gradeOptions.last().click();
                await startCoopRound(page, start);
                await endCoopAtTimeout(page);
                await button(page, 'おわる').click();
                await page.waitForURL(url => url.hash === '#/battle');
            }

            await page.getByRole('heading', { name: 'ほかの あそび', exact: true }).waitFor();
            await page.getByRole('button', { name: /つなひき たいせん/ }).click();
            await page.waitForURL(url => url.hash === '#/battle/play?mode=tug_of_war');
            if (viewport.width >= 768 && viewport.height > viewport.width) {
                await page.getByText('タブレットを よこにしてね', { exact: true }).waitFor();
                const returnToGames = button(page, 'ほかの あそびへ もどる');
                const returnBox = await returnToGames.boundingBox();
                assert(returnBox && returnBox.width >= 44 && returnBox.height >= 44,
                    'Tug of War tablet portrait guidance keeps a 44px-or-larger return target');
                await capture('tug-tablet-rotate-guidance');
                await returnToGames.click();
                await page.waitForURL(url => url.hash === '#/battle');
                scenario.checks.push('Tug of War tablet portrait provides the same clear rotation and return guidance');
            } else {
                await page.locator('.battle-setup-screen').waitFor();
                const modeGroup = page.getByRole('group', { name: 'あそびの モード' });
                const tugMode = modeGroup.getByRole('button', { name: /つなひき/ });
                assert.equal(await tugMode.getAttribute('aria-pressed'), 'true',
                    'The selected Tug of War card is reflected in Battle setup');
                const gradeOptions = page.getByRole('button', { name: 'ねんしょう', exact: true });
                assert.equal(await gradeOptions.count(), 2);
                const start = button(page, 'スタート！');
                assert.equal(await start.isEnabled(), false,
                    'Both tug players must choose a grade before starting');
                await gradeOptions.first().click();
                await gradeOptions.last().click();
                assert.equal(await start.isEnabled(), true,
                    'Selecting both tug grades enables the start action');
                await page.waitForTimeout(400);
                await capture('tug-setup-ready');
                scenario.checks.push('Tug of War route preserves its selected mode and makes both-player setup operable');

                const round = await startTugRound(page, start);
                await restoreBattleRandom(page);
                scenario.tugOpeningQuestion = round.visual;
                await capture('tug-playing');
                await winTugRoundFromVisibleCount(page);
                await capture('tug-result');
                const tugResult = await page.evaluate(() => {
                    const labels = ['もう いっかい！', 'おわる'];
                    const card = document.querySelector('.battle-result-card');
                    const cardRect = card?.getBoundingClientRect();
                    return {
                        documentWidth: document.documentElement.scrollWidth,
                        viewport: { width: innerWidth, height: innerHeight },
                        summary: card?.innerText.trim().replace(/\s+/g, ' ') ?? '',
                        badgeWhiteSpace: card?.querySelector(':scope > div:first-child > span')
                            ? getComputedStyle(card.querySelector(':scope > div:first-child > span')).whiteSpace
                            : null,
                        card: cardRect ? {
                            x: cardRect.x,
                            y: cardRect.y,
                            width: cardRect.width,
                            height: cardRect.height,
                            bottom: cardRect.bottom,
                        } : null,
                        stats: [...document.querySelectorAll('.battle-result-stats > *')]
                            .map(element => {
                                const rect = element.getBoundingClientRect();
                                return {
                                    x: rect.x,
                                    right: rect.right,
                                    width: rect.width,
                                    clientWidth: element.clientWidth,
                                    scrollWidth: element.scrollWidth,
                                };
                            }),
                        actions: [...document.querySelectorAll('button')]
                            .filter(element => labels.includes(element.innerText.trim().replace(/\s+/g, ' ')))
                            .map(element => {
                                const rect = element.getBoundingClientRect();
                                return {
                                    label: element.innerText.trim().replace(/\s+/g, ' '),
                                    x: rect.x,
                                    y: rect.y,
                                    width: rect.width,
                                    height: rect.height,
                                    bottom: rect.bottom,
                                };
                            }),
                    };
                });
                scenario.tugResult = tugResult;
                assert.equal(tugResult.documentWidth <= viewport.width + 1, true,
                    'Tug of War result has no horizontal page overflow');
                assert.match(tugResult.summary, /プレイヤー1 の かち！/,
                    'Tug of War result names the player who reached the visible goal');
                assert.equal(tugResult.badgeWhiteSpace, 'nowrap',
                    'Tug of War result badge stays on a single line');
                assert(tugResult.card && tugResult.card.x >= 0
                    && tugResult.card.x + tugResult.card.width <= viewport.width + 1,
                'Tug of War result card stays within the viewport width');
                assert.equal(tugResult.stats.length, 3,
                    'Tug of War result shows winner, duration, and score difference');
                assert(tugResult.stats.every(stat => stat.x >= tugResult.card.x - 1
                    && stat.right <= tugResult.card.x + tugResult.card.width + 1
                    && stat.scrollWidth <= stat.clientWidth + 1),
                'Tug of War result stat cards stay inside the result card without clipping');
                assert.equal(tugResult.actions.length, 2,
                    'Tug of War result offers replay and exit');
                assert(tugResult.actions.every(action => action.width >= 44 && action.height >= 44
                    && action.x >= 0 && action.x + action.width <= viewport.width + 1
                    && action.y >= 0 && action.bottom <= viewport.height + 1),
                'Tug of War result keeps replay and exit controls visible and touchable');
                scenario.checks.push('Visible counting problems can advance the rope to a clear, non-shaming winner result');
                scenario.checks.push('Tug of War result keeps replay and exit controls visible and touchable');

                await button(page, 'もう いっかい！').click();
                await page.locator('.battle-setup-screen').waitFor();
                const replayMode = page.getByRole('group', { name: 'あそびの モード' })
                    .getByRole('button', { name: /つなひき/ });
                assert.equal(await replayMode.getAttribute('aria-pressed'), 'true',
                    'Tug of War replay keeps the selected mode');
                assert.equal(await button(page, 'スタート！').isEnabled(), false,
                    'Tug of War replay returns to a fresh setup');
                await capture('tug-replay-setup');
                scenario.checks.push('Tug of War replay returns to a fresh setup with the mode preserved');
                await button(page, 'もどる').click();
                await page.waitForURL(url => url.hash === '#/battle');
            }

            await button(page, 'もどる').click();
            await page.waitForURL(url => url.hash === '#/island');
            await waitMode(page, 'home');
            await nav.waitFor();

            const after = await readNative(page, profileId);
            for (const store of ['logs', 'memoryMath', 'memoryVocab', 'islandEvents', 'exploreRuns']) {
                assert.deepEqual(after[store], baseline[store],
                    'The Battle journey does not change the ' + store + ' learning/progression data');
            }
            assert.deepEqual(scenario.pageErrors, []);
            scenario.checks.push('Return reaches the same Island and leaves learning records unchanged');
            scenario.pass = true;
            report.scenarios.push(scenario);
            console.log('PASS battle runtime ' + viewportId(viewport));
        } catch (error) {
            scenario.pass = false;
            scenario.error = String(error);
            await page.screenshot({ path: out + '/' + viewportId(viewport) + '-failure.png' }).catch(() => {});
            report.scenarios.push(scenario);
            throw error;
        } finally {
            await context.close();
        }
    }
} catch (error) {
    report.error = String(error);
    throw error;
} finally {
    report.pass = !report.error && report.scenarios.length === viewports.length
        && report.scenarios.every(scenario => scenario.pass);
    await fs.writeFile(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
    const contactSheet = [
        '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Battle runtime evidence</title>',
        '<style>body{margin:24px;background:#f6f4ee;color:#25314f;font:14px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}figure{margin:0;padding:10px;background:#fff;border:1px solid #ded8e8;border-radius:12px}img{display:block;width:100%;height:340px;object-fit:contain;background:#f0eef3;border-radius:8px}figcaption{padding-top:8px;overflow-wrap:anywhere;line-height:1.45}h1{font-size:20px}</style>',
        '<h1>Current Island Battle runtime: ' + (report.pass ? 'PASS' : 'FAIL / INCOMPLETE') + '</h1>',
        '<p>' + escapeHtml(report.target) + ' · ' + report.captures.length + ' captures · ' + report.scenarios.length + ' viewport runs</p><main>',
        ...report.captures.map(capture => {
            const imagePath = encodeURIComponent(capture.file);
            const label = capture.viewport.width + '×' + capture.viewport.height + ' · '
                + capture.url + ' · ' + capture.rootConfiguredDelivery + ' · Island '
                + capture.islandFeatureEnabled + ' · Nature Town ' + capture.natureTownFeatureEnabled
                + ' · ' + capture.revision;
            return '<figure><a href="' + imagePath + '"><img loading="lazy" src="' + imagePath
                + '" alt="' + escapeHtml(capture.file) + '"></a><figcaption>'
                + escapeHtml(label) + '</figcaption></figure>';
        }),
        '</main></html>',
    ].join('');
    await fs.writeFile(out + '/contact-sheet.html', contactSheet);
    await browser.close();
}
