import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { answerUI, appRootMetadata, button, readNative, seedNative, waitMode, waitReady, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5219';
const out = process.env.SANSU_NAVIGATION_OUTPUT || 'output/playwright/island-navigation';
const defaultViewports = [
    // Minimum supported phone portrait: scroll hints should stay absent when the inventory fits.
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    // Narrow short-landscape Welcome/photo breakpoint and the compact-phone landscape route.
    { width: 480, height: 431 },
    { width: 599, height: 430 },
    { width: 568, height: 320 },
];
const viewports = process.env.SANSU_NAVIGATION_VIEWPORTS
    ? process.env.SANSU_NAVIGATION_VIEWPORTS.split(',').map(value => {
        const match = /^(\d{3,4})x(\d{3,4})$/.exec(value.trim());
        if (!match) throw new Error(`Invalid navigation viewport "${value}"; expected WIDTHxHEIGHT`);
        return { width: Number(match[1]), height: Number(match[2]) };
    })
    : defaultViewports;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const parseCssColor = value => {
    const hex = /^#([\da-f]{6})$/i.exec(value.trim());
    if (hex) {
        return { channels: [0, 2, 4].map(index => Number.parseInt(hex[1].slice(index, index + 2), 16)), alpha: 1 };
    }
    const toSrgb = (lightness, a, b) => {
        const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
        const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
        const sRoot = lightness - 0.0894841775 * a - 1.2914855480 * b;
        const l = lRoot ** 3;
        const m = mRoot ** 3;
        const s = sRoot ** 3;
        return [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
        ].map(channel => {
            const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
            return Math.max(0, Math.min(1, encoded)) * 255;
        });
    };
    const oklab = /^oklab\(([^)]+)\)$/i.exec(value.trim());
    const oklch = /^oklch\(([^)]+)\)$/i.exec(value.trim());
    if (oklab || oklch) {
        const parts = (oklab ?? oklch)[1].replace('/', ' ').split(/[\s,]+/).filter(Boolean);
        const lightness = parts[0].endsWith('%') ? Number.parseFloat(parts[0]) / 100 : Number(parts[0]);
        const a = oklab ? Number(parts[1]) : Number(parts[1]) * Math.cos(Number.parseFloat(parts[2]) * Math.PI / 180);
        const b = oklab ? Number(parts[2]) : Number(parts[1]) * Math.sin(Number.parseFloat(parts[2]) * Math.PI / 180);
        const alphaPart = parts[3];
        const alpha = alphaPart === undefined ? 1 : alphaPart.endsWith('%')
            ? Number.parseFloat(alphaPart) / 100
            : Number(alphaPart);
        return { channels: toSrgb(lightness, a, b), alpha };
    }
    const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
    if (!match) throw new Error(`Unsupported computed color: ${value}`);
    const parts = match[1].replace('/', ' ').split(/[\s,]+/).filter(Boolean);
    const channels = parts.slice(0, 3).map(channel => channel.endsWith('%')
        ? Number.parseFloat(channel) * 2.55
        : Number(channel));
    const alphaPart = parts[3];
    const alpha = alphaPart === undefined ? 1 : alphaPart.endsWith('%')
        ? Number.parseFloat(alphaPart) / 100
        : Number(alphaPart);
    return { channels, alpha };
};
const compositeCssColors = (layers, base) => {
    let channels = parseCssColor(base).channels;
    for (const layer of [...layers].reverse()) {
        const { channels: foreground, alpha } = parseCssColor(layer);
        channels = foreground.map((channel, index) => channel * alpha + channels[index] * (1 - alpha));
    }
    return `rgb(${channels.map(channel => Math.round(channel)).join(', ')})`;
};
const relativeLuminance = color => parseCssColor(color).channels
    .map(channel => {
        const srgb = channel / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrastRatio = (first, second) => {
    const luminance = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
    return Number(((luminance[0] + 0.05) / (luminance[1] + 0.05)).toFixed(2));
};
const assertCanonicalIslandRoot = appRoot => {
    assert.equal(appRoot.islandFeatureEnabled, true, 'App-root identity must prove the Island flag is enabled');
    assert.equal(appRoot.natureTownFeatureEnabled, false, 'App-root identity must exclude the Nature Town preview');
    assert.ok(appRoot.revision, 'App-root identity must include a build revision');
    assert.ok(appRoot.version, 'App-root identity must include the unique build version');
    assert.equal(appRoot.configuredDelivery, 'snap-root-v1', 'App-root identity must use the current configured delivery');
};
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, navigationCandidate: 'island-navigation-five-tabs-v2', viewports, fixture: 'First-run Welcome is captured before any profile fixture; route scenarios then use a disposable native profile for learning, furniture, and photo checks. Short-landscape help checks record one support_opened event and its normal due-check/relearning safeguard only in that disposable profile; no answer, learning-attempt log, or answer count is created. Parent review candidates are a display-only isWeak fixture in that disposable profile; no threshold is exercised and no attempt log or answer count is added.', captures: [], scenarios: [], pass: false };
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.setDefaultNavigationTimeout(20000);
        const errors = [];
        let settingsContrast = null;
        let parentCandidateFixture = null;
        let welcomeLayout = null;
        let photoActionLayout = null;
        let otherGamesChoiceLayout = null;
        let inventoryScrollLayout = null;
        let recordsScrollLayout = null;
        let recordsHeadingLayout = null;
        let shortLearningLayout = null;
        let shortHelpLayout = null;
        const shortLandscapeWelcome = viewport.width >= 480 && viewport.height <= 600 && viewport.width > viewport.height;
        const viewportTag = `${viewport.width}x${viewport.height}`;
        page.on('pageerror', error => errors.push(error.message));
        const capture = async name => {
            const file = `${viewportTag}-${name}.png`;
            // Framer Motion uses JS animation; screenshot's CSS animation flag
            // alone can catch a settings detail while its height is still zero.
            await page.waitForTimeout(400);
            const metadata = await runtimeMetadata(page);
            assertCanonicalIslandRoot(metadata.appRoot);
            assert.equal(metadata.appRoot.revision, metadata.revision, 'App-root and Island revision markers must agree');
            assert.equal(metadata.appRoot.version, metadata.version, 'App-root and Island version markers must agree');
            assert.equal(metadata.islandFeatureEnabled, true, 'Island navigation evidence must come from an Island-enabled runtime');
            assert.equal(metadata.delivery, 'mystic-island-v1', 'Island navigation evidence must use the current delivery');
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            report.captures.push({ file, ...metadata });
        };
        const captureUtility = async name => {
            const file = `${viewportTag}-${name}.png`;
            // Shared utility routes can expose the navigation in the DOM before
            // Chromium has painted its tab contents after a route transition.
            // Let the first composed frame settle before saving visual evidence.
            await page.waitForTimeout(800);
            const appRoot = await appRootMetadata(page);
            assertCanonicalIslandRoot(appRoot);
            const routeMetadata = await page.locator('.app-container').evaluate(element => ({
                url: location.href,
                routeCandidate: 'not-applicable-shared-utility',
                viewport: { width: innerWidth, height: innerHeight },
                serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
                reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            }));
            const metadata = {
                ...routeMetadata,
                revision: appRoot.revision,
                version: appRoot.version,
                rootConfiguredDelivery: appRoot.configuredDelivery,
                islandFeatureEnabled: appRoot.islandFeatureEnabled,
                natureTownFeatureEnabled: appRoot.natureTownFeatureEnabled,
                appRoot,
            };
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            report.captures.push({ file, ...metadata });
        };
        const nav = page.locator('.island-shell-nav');
        const learn = page.locator('.island-shell-tab--learn');
        const hash = () => new URL(page.url()).hash;
        const ordinary = async expected => {
            await nav.waitFor();
            assert.equal(hash(), expected);
            assert.deepEqual(await nav.getByRole('button').allTextContents(), ['しま', 'いえ', 'まなぶ', 'きろく', '設定']);
            if (viewport.width <= 360) {
                const labelLayout = await nav.locator('.island-shell-tab').evaluateAll(buttons => buttons.map(button => {
                    const label = button.querySelector('span');
                    const buttonBounds = button.getBoundingClientRect();
                    const range = document.createRange();
                    range.selectNodeContents(label);
                    const labelBounds = range.getBoundingClientRect();
                    return {
                        label: label.textContent?.trim(),
                        lines: range.getClientRects().length,
                        fits: labelBounds.left >= buttonBounds.left && labelBounds.right <= buttonBounds.right,
                        targetWidth: buttonBounds.width,
                        targetHeight: buttonBounds.height,
                    };
                }));
                assert(labelLayout.every(item => item.lines === 1 && item.fits
                    && item.targetWidth >= 44 && item.targetHeight >= 44),
                `Main navigation labels stay on one line inside 44px targets at ${viewport.width}px: ${JSON.stringify(labelLayout)}`);
            }
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
            await page.locator('.island-stage canvas').waitFor();
            await page.waitForFunction(() => document.body.classList.contains('app-mode-island-first-run'));
            const welcomeShell = await page.locator('.app-container').boundingBox();
            assert(welcomeShell && Math.abs(welcomeShell.width - Math.min(viewport.width, 1180)) <= 1,
                'First-run Island welcome uses the responsive fullscreen app frame');
            welcomeLayout = await page.evaluate(() => {
                const bounds = selector => {
                    const element = document.querySelector(selector);
                    const box = element?.getBoundingClientRect();
                    return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height } : null;
                };
                return {
                    scrollHeight: document.querySelector('.island-welcome')?.scrollHeight ?? null,
                    header: bounds('.island-welcome > header'),
                    stage: bounds('.island-welcome > .island-stage'),
                    controls: bounds('.island-welcome > .island-home-controls'),
                    actions: [...document.querySelectorAll('.island-welcome .island-home-controls button')].map(button => {
                        const box = button.getBoundingClientRect();
                        return { name: button.innerText, top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
                    }),
                };
            });
            const welcomeStage = await page.locator('.island-stage').boundingBox();
            if (shortLandscapeWelcome) {
                assert(welcomeLayout.scrollHeight <= viewport.height + 1,
                    `Short-landscape Welcome keeps its primary route within the initial viewport: ${JSON.stringify(welcomeLayout)}`);
                assert(welcomeLayout.header.bottom <= welcomeLayout.stage.top + 1
                    && welcomeLayout.stage.right <= welcomeLayout.controls.left + 1
                    && welcomeLayout.stage.width >= viewport.width * 0.5,
                `Short-landscape Welcome keeps a substantial island scene beside its actions: ${JSON.stringify(welcomeLayout)}`);
            } else {
                const maxWelcomeStageWidth = viewport.height <= 430 ? 680 : 920;
                assert(welcomeStage && Math.abs(welcomeStage.width - Math.min(viewport.width, maxWelcomeStageWidth)) <= 1,
                    'Welcome island scene keeps a composed width on wide screens');
            }
            const welcomeMetadata = await runtimeMetadata(page);
            assert.equal(welcomeMetadata.mode, 'welcome');
            assert.equal(welcomeMetadata.islandFeatureEnabled, true, 'Welcome identity proves the Island flag is enabled');
            for (const label of ['おはな', 'あかり', 'まなぶ']) {
                const target = await page.getByRole('button', { name: label, exact: true }).boundingBox();
                assert(target && target.width >= 44 && target.height >= 44, `${label} is a 44px-or-larger target`);
                assert(target && target.x >= 0 && target.x + target.width <= viewport.width
                    && target.y >= 0 && target.y + target.height <= viewport.height,
                `${label} is visible without scrolling`);
            }
            if (viewport.width <= 360) {
                for (const label of ['おはな', 'あかり']) {
                    const target = await page.getByRole('button', { name: label, exact: true }).boundingBox();
                    assert(target && target.height <= 54, `${label} remains a compact single-line choice on narrow phones`);
                }
            }
            await capture('welcome');
            const id = await seedNative(page, randomUUID());
            // A two-digit arithmetic profile leaves a real incomplete draft.
            // One-digit bridge questions now submit immediately after one key.
            await page.evaluate(async id => {
                const request = indexedDB.open('SansuDatabase');
                const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                const tx = db.transaction(['profiles', 'appData'], 'readwrite');
                const read = request => new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
                const profile = await read(tx.objectStore('profiles').get(id));
                const app = await read(tx.objectStore('appData').get('app'));
                Object.assign(profile, { mathStartLevel: 10, mathMainLevel: 11, mathMaxUnlocked: 11,
                    mathLevels: Array.from({ length: 11 }, (_, index) => ({ level: index + 1, unlocked: true, enabled: true, recentAnswersNonReview: [] })) });
                tx.objectStore('profiles').put(profile); app.profiles[id] = profile; tx.objectStore('appData').put(app);
                await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
                db.close();
            }, id);
            await page.goto(base); await waitReady(page);
            await ordinary('#/island');
            await page.goto(`${base}/#/onboarding?mode=add`);
            await page.locator('.island-welcome').waitFor();
            await page.waitForFunction(() => !document.body.classList.contains('app-mode-island-first-run'));
            const addProfileShell = await page.locator('.app-container').boundingBox();
            assert(addProfileShell && Math.abs(addProfileShell.width - Math.min(viewport.width, 430)) <= 1,
                'Explicit profile-add onboarding keeps its existing utility frame');
            await page.goto(base); await waitReady(page);
            await ordinary('#/island');
            assert.equal((await readNative(page, id)).plan, undefined, 'Top entry does not reserve questions');
            for (const entry of ['/#/?learn=1', '/#/missing-page?start=learn', '/#/onboarding']) {
                await page.goto(`${base}${entry}`); await waitReady(page); await waitMode(page, 'home');
                await ordinary('#/island');
                assert.equal((await readNative(page, id)).plan, undefined, `${entry} cannot start questions`);
            }
            await capture('home');
            for (const [action, mode, title] of [
                ['play', 'play', 'どうぶつと あそぶ'], ['guide', 'guide', 'みつける'],
                ['inventory', 'inventory', 'もちものを おく'], ['customization', 'customization', 'しまの きせかえ'],
                ['experience', 'experience', 'なまえ・けしき'], ['help', 'help', 'あそびかた'],
            ]) {
                await button(page, 'しまのメニュー').click();
                if (['inventory', 'customization', 'experience'].includes(action)) await page.locator('[data-home-group=arrange] > summary').click();
                const entry = page.locator(`[data-home-action=${action}]`);
                assert.equal((await entry.innerText()).trim(), title, 'The entry names the destination');
                await entry.click(); await waitMode(page, mode);
                const heading = page.locator('.island-panel-heading');
                assert.equal(await heading.getByRole('heading', { level: 2 }).innerText(), title);
                const back = heading.getByRole('button');
                assert.equal(await back.innerText(), 'もどる');
                await capture(mode);
                if (action === 'inventory' && (
                    (viewport.width >= 480 && viewport.height <= 600 && viewport.width > viewport.height)
                    || (viewport.width <= 360 && viewport.height >= 500 && viewport.height > viewport.width)
                )) {
                    const inventoryPage = page.locator('.island-page');
                    const readInventoryLayout = () => inventoryPage.evaluate(element => {
                        const rect = value => {
                            const bounds = value?.getBoundingClientRect();
                            return bounds ? { top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height } : null;
                        };
                        const navigation = document.querySelector('.island-shell-nav');
                        return {
                            scrollHeight: element.scrollHeight,
                            clientHeight: element.clientHeight,
                            scrollTop: element.scrollTop,
                            maxScrollTop: Math.max(0, element.scrollHeight - element.clientHeight),
                            documentScrollHeight: document.documentElement.scrollHeight,
                            scrollport: rect(element),
                            navigationTop: navigation?.getBoundingClientRect().top ?? null,
                            items: [...element.querySelectorAll('.island-inventory > button')].map(item => ({
                                rect: rect(item),
                                name: rect(item.querySelector('strong')),
                                description: rect(item.querySelector('small')),
                            })),
                            furnitureAction: rect(element.querySelector('.island-inventory-panel > .island-secondary')),
                        };
                    });
                    const before = await readInventoryLayout();
                    const scrollHint = page.locator('.island-inventory-scroll-hint');
                    const hasMoreBefore = before.scrollHeight > before.clientHeight + 1;
                    const itemCardsFullyVisible = layout => layout.items.length > 0
                        && layout.items.every(item => item.rect && item.name && item.description
                            && item.rect.top >= layout.scrollport.top - 1
                            && item.rect.bottom <= layout.navigationTop + 1
                            && item.name.top >= layout.scrollport.top - 1
                            && item.name.bottom <= layout.navigationTop + 1
                            && item.description.bottom <= layout.navigationTop + 1);
                    inventoryScrollLayout = { before, hasMoreBefore, itemsView: before, after: null };
                    assert(before.navigationTop !== null && before.documentScrollHeight <= viewport.height + 1,
                        `The inventory uses an app-bounded scroll surface: ${JSON.stringify(before)}`);
                    assert.equal(await scrollHint.isVisible(), hasMoreBefore,
                        'The inventory heading signals when the page has more content below');
                    if (hasMoreBefore && !itemCardsFullyVisible(before)) {
                        const scrollBox = await inventoryPage.boundingBox();
                        assert(scrollBox && scrollBox.height > 0, 'Short-landscape inventory has a visible scroll surface');
                        await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
                        await page.mouse.wheel(0, 100);
                        await page.waitForFunction(() => {
                            const element = document.querySelector('.island-page');
                            return !!element && element.scrollTop > 0;
                        });
                    }
                    const itemsView = await readInventoryLayout();
                    inventoryScrollLayout.itemsView = itemsView;
                    assert(itemCardsFullyVisible(itemsView),
                        `Every short-landscape inventory card and label is reachable above navigation: ${JSON.stringify(inventoryScrollLayout)}`);
                    if (hasMoreBefore) {
                        await scrollHint.waitFor({ state: itemsView.scrollTop + itemsView.clientHeight >= itemsView.scrollHeight - 1 ? 'hidden' : 'visible' });
                    }
                    if (itemsView.scrollTop > 0) await capture('inventory-scrolled-items');
                    if (hasMoreBefore && itemsView.scrollTop + itemsView.clientHeight < itemsView.scrollHeight - 1) {
                        await page.mouse.wheel(0, 12000);
                        await page.waitForFunction(() => {
                            const element = document.querySelector('.island-page');
                            return !!element && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
                        });
                        await scrollHint.waitFor({ state: 'hidden' });
                    }
                    const after = await readInventoryLayout();
                    inventoryScrollLayout.after = after;
                    assert(!after.furnitureAction || after.furnitureAction.bottom <= after.navigationTop + 1,
                        `The short-landscape inventory's furniture action is reachable above navigation: ${JSON.stringify(inventoryScrollLayout)}`);
                    if (after.scrollTop > 0) await capture('inventory-scrolled-bottom');
                    await inventoryPage.evaluate(element => { element.scrollTop = 0; });
                    await page.waitForFunction(() => document.querySelector('.island-page')?.scrollTop === 0);
                    if (hasMoreBefore) await scrollHint.waitFor({ state: 'visible' });
                }
                if (action === 'play') {
                    const playBody = page.locator('.island-play-body');
                    const scrollHint = page.getByText('つづき', { exact: true });
                    const hasMoreBelow = await playBody.evaluate(element => element.scrollHeight > element.clientHeight + 1);
                    assert.equal(await scrollHint.isVisible(), hasMoreBelow,
                        'The play panel explains when more choices are below the visible area');
                }
                if (action === 'play' && viewport.height <= 430) {
                    const playBody = page.locator('.island-play-body');
                    const bodyBox = await playBody.boundingBox();
                    assert(bodyBox && bodyBox.height > 0, 'Play choices have a visible scroll surface');
                    assert(await playBody.evaluate(element => element.scrollHeight > element.clientHeight), 'Short-landscape play content continues below the first view');
                    await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
                    await page.mouse.wheel(0, 500);
                    await page.waitForFunction(() => {
                        const element = document.querySelector('.island-play-body');
                        return !!element && element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
                    });
                    await page.getByText('つづき', { exact: true }).waitFor({ state: 'hidden' });
                    const continueAction = button(page, 'ひかりを とどける');
                    const actionBox = await continueAction.boundingBox();
                    const scrolledBodyBox = await playBody.boundingBox();
                    assert(actionBox && scrolledBodyBox && actionBox.y >= scrolledBodyBox.y && actionBox.y + actionBox.height <= scrolledBodyBox.y + scrolledBodyBox.height,
                        'Play continuation action is reachable inside the short-landscape scroll surface');
                    assert(actionBox.height >= 44, 'Play continuation action preserves the minimum target height');
                    await capture('play-scrolled');
                    await page.mouse.wheel(0, -500);
                    await page.waitForFunction(() => document.querySelector('.island-play-body')?.scrollTop === 0);
                    await page.getByText('つづき', { exact: true }).waitFor({ state: 'visible' });
                }
                await back.click(); await waitMode(page, 'home');
            }
            await nav.getByRole('button', { name: 'いえ', exact: true }).click();
            await waitMode(page, 'keepsakes'); await ordinary('#/island?view=keepsakes');
            assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'いえ');
            await capture('house');
            await page.getByRole('button', { name: 'いえの メニュー', exact: true }).click();
            await page.locator('[data-keepsake-action=notices]').click();
            await page.getByRole('heading', { name: 'おしらせ', exact: true }).first().waitFor();
            assert.equal(await page.locator('[data-keepsake-action=close]').count(), 0, 'House detail has one parent return');
            await page.locator('[data-keepsake-action=home]').click();
            await page.locator('[data-keepsake-action=album]').waitFor();
            await page.locator('[data-keepsake-action="album"]').click();
            await waitMode(page, 'album'); await ordinary('#/island?view=album');
            assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'いえ');
            await learn.click(); await focus('learning'); await waitReady(page);
            await button(page, 'とじる').click(); await waitMode(page, 'album');
            await ordinary('#/island?view=album');
            await nav.getByRole('button', { name: 'いえ', exact: true }).click();
            await waitMode(page, 'keepsakes');
            await page.locator('[data-keepsake-action="album"]').waitFor();
            await page.locator('[data-keepsake-action="album"]').click();
            await waitMode(page, 'album');
            await button(page, 'アルバムから もどる').click();
            await waitMode(page, 'keepsakes');
            assert.equal(await page.locator('[data-keepsake-action="album"]').evaluate(element => element === document.activeElement), true,
                'Returning from the album restores focus to its house entry');
            await nav.getByRole('button', { name: 'しま', exact: true }).click();
            await waitMode(page, 'home');
            await nav.getByRole('button', { name: '設定', exact: true }).click();
            await page.getByRole('button', { name: /^学習 / }).click();
            await ordinary('#/settings?section=learning');
            const unselectedSubject = page.getByRole('group', { name: '学習する科目' }).locator('button[aria-pressed="false"]').first();
            const measuredColors = await unselectedSubject.evaluate(element => {
                const resolveColor = value => {
                    const probe = document.createElement('span');
                    probe.style.color = value;
                    document.body.append(probe);
                    const resolved = getComputedStyle(probe).color;
                    probe.remove();
                    return resolved;
                };
                const backgroundLayers = [];
                for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
                    backgroundLayers.push(getComputedStyle(node).backgroundColor);
                }
                const slateProbe = document.createElement('span');
                slateProbe.className = 'text-slate-400';
                document.body.append(slateProbe);
                const legacySlate400 = getComputedStyle(slateProbe).color;
                slateProbe.remove();
                return {
                    foreground: getComputedStyle(element).color,
                    mutedToken: resolveColor('var(--pokomoko-muted)'),
                    paper: resolveColor('var(--pokomoko-paper)'),
                    canvas: resolveColor('var(--pokomoko-canvas)'),
                    legacySlate400,
                    backgroundLayers,
                };
            });
            const composedBackground = compositeCssColors(measuredColors.backgroundLayers, measuredColors.canvas);
            settingsContrast = {
                foreground: measuredColors.foreground,
                composedBackground,
                ratio: contrastRatio(measuredColors.foreground, composedBackground),
                paperFloorRatio: contrastRatio(measuredColors.foreground, measuredColors.paper),
                canvasRatio: contrastRatio(measuredColors.foreground, measuredColors.canvas),
                legacySlate400OnPaperRatio: contrastRatio(measuredColors.legacySlate400, measuredColors.paper),
            };
            assert.equal(settingsContrast.foreground, measuredColors.mutedToken,
                'Unselected subject text uses the shared Pokomoko muted token');
            assert(settingsContrast.ratio >= 4.5,
                `Unselected subject text must meet 4.5:1 against its composed settings background; measured ${settingsContrast.ratio}:1`);
            assert(settingsContrast.paperFloorRatio >= 4.5,
                `Unselected subject text must meet 4.5:1 even against opaque paper; measured ${settingsContrast.paperFloorRatio}:1`);
            assert(settingsContrast.legacySlate400OnPaperRatio < 4.5,
                'The previous pale slate text remains a failing contrast sentinel on paper');
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
            if (viewport.width >= 480 && viewport.height <= 600 && viewport.width > viewport.height) {
                shortLearningLayout = await page.evaluate(() => {
                    const navigation = document.querySelector('.island-shell-nav');
                    const navigationRect = navigation?.getBoundingClientRect();
                    const navigationVisible = !!navigation && !!navigationRect && navigationRect.height > 0
                        && navigationRect.top < innerHeight && getComputedStyle(navigation).visibility !== 'hidden';
                    const contentBottom = navigationVisible ? Math.min(innerHeight, navigationRect.top) : innerHeight;
                    const rect = element => {
                        const bounds = element?.getBoundingClientRect();
                        return bounds ? { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height } : null;
                    };
                    const keypad = document.querySelector('.park-keypad');
                    return {
                        contentBottom,
                        viewportHeight: innerHeight,
                        documentScrollHeight: document.documentElement.scrollHeight,
                        learningPageScrollHeight: document.querySelector('.island-page')?.scrollHeight ?? null,
                        workbench: rect(document.querySelector('.island-workbench')),
                        progress: rect(document.querySelector('.island-learning-progress')),
                        progressControls: [...document.querySelectorAll('.island-learning-progress button')].map(rect),
                        feedback: rect(document.querySelector('.island-workbench-message')),
                        question: rect(document.querySelector('.park-question')),
                        support: rect(document.querySelector('.park-support')),
                        inputs: rect(document.querySelector('.park-inputs')),
                        keypad: rect(keypad),
                        keys: [...(keypad?.querySelectorAll('button') ?? [])].map(rect),
                        actions: rect(document.querySelector('.island-learning-actions')),
                        actionButtons: [...document.querySelectorAll('.island-learning-actions button')].map(rect),
                    };
                });
                assert(shortLearningLayout.documentScrollHeight <= shortLearningLayout.viewportHeight + 1
                    && shortLearningLayout.learningPageScrollHeight <= shortLearningLayout.viewportHeight + 1
                    && shortLearningLayout.progress?.height > 0
                    && shortLearningLayout.progress.bottom <= shortLearningLayout.contentBottom + 1
                    && shortLearningLayout.progressControls.every(control => control.width >= 44 && control.height >= 44
                        && control.top >= 0 && control.bottom <= shortLearningLayout.contentBottom + 1)
                    && shortLearningLayout.question?.height > 0
                    && shortLearningLayout.question.bottom <= shortLearningLayout.contentBottom + 1
                    && (!shortLearningLayout.support || (shortLearningLayout.support.top >= 0
                        && shortLearningLayout.support.bottom <= shortLearningLayout.contentBottom + 1))
                    && shortLearningLayout.keypad?.height > 0
                    && shortLearningLayout.keys.length > 0
                    && shortLearningLayout.keys.every(key => key.height >= 44 && key.width >= 44
                        && key.top >= 0 && key.bottom <= shortLearningLayout.contentBottom + 1)
                    && (!shortLearningLayout.inputs || (shortLearningLayout.inputs.top >= 0
                        && shortLearningLayout.inputs.bottom <= shortLearningLayout.contentBottom + 1))
                    && shortLearningLayout.actions?.top >= 0
                    && shortLearningLayout.actions.bottom <= shortLearningLayout.contentBottom + 1
                    && shortLearningLayout.actionButtons.length > 0
                    && shortLearningLayout.actionButtons.every(action => action.height >= 44 && action.width >= 44
                        && action.top >= 0 && action.bottom <= shortLearningLayout.contentBottom + 1),
                `Short-landscape learning keeps the full 44px keypad, answer and help actions visible: ${JSON.stringify(shortLearningLayout)}`);
            }
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
            const recordsScroll = page.locator('.utility-layout-scroll');
            const recordsScrollBefore = await recordsScroll.evaluate(element => ({
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                documentScrollHeight: document.documentElement.scrollHeight,
                navigationTop: document.querySelector('.island-shell-nav')?.getBoundingClientRect().top ?? null,
            }));
            assert(recordsScrollBefore.navigationTop !== null,
                `The records reachability check requires the fixed navigation: ${JSON.stringify(recordsScrollBefore)}`);
            assert(recordsScrollBefore.documentScrollHeight <= viewport.height + 1,
                `The records view uses its own scroll surface without document overflow: ${JSON.stringify(recordsScrollBefore)}`);
            if (recordsScrollBefore.scrollHeight > recordsScrollBefore.clientHeight + 1) {
                const scrollBox = await recordsScroll.boundingBox();
                assert(scrollBox && scrollBox.height > 0, 'Records expose a visible scroll surface');
                await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
                await page.mouse.wheel(0, 12000);
                await page.waitForFunction(() => {
                    const element = document.querySelector('.utility-layout-scroll');
                    return !!element && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
                });
            }
            recordsScrollLayout = await recordsScroll.evaluate(element => {
                const scroll = element.getBoundingClientRect();
                const navigation = document.querySelector('.island-shell-nav')?.getBoundingClientRect();
                const parentReport = document.querySelector('#stats-learning-details')?.lastElementChild?.getBoundingClientRect();
                return {
                    scrollHeight: element.scrollHeight,
                    clientHeight: element.clientHeight,
                    scrollTop: element.scrollTop,
                    maxScrollTop: element.scrollHeight - element.clientHeight,
                    documentScrollHeight: document.documentElement.scrollHeight,
                    scrollBottom: scroll.bottom,
                    navigationTop: navigation?.top ?? null,
                    parentReport: parentReport ? { top: parentReport.top, bottom: parentReport.bottom } : null,
                };
            });
            assert(recordsScrollLayout.scrollHeight <= recordsScrollLayout.clientHeight + 1
                || recordsScrollLayout.scrollTop + recordsScrollLayout.clientHeight >= recordsScrollLayout.scrollHeight - 1,
            `The records scroll surface reaches its end: ${JSON.stringify(recordsScrollLayout)}`);
            assert(recordsScrollLayout.parentReport
                && recordsScrollLayout.parentReport.bottom <= recordsScrollLayout.scrollBottom + 1
                && recordsScrollLayout.parentReport.bottom <= recordsScrollLayout.navigationTop + 1,
            `The final records section remains reachable above fixed navigation: ${JSON.stringify(recordsScrollLayout)}`);
            await capture('records-scrolled-bottom');
            if (recordsScrollBefore.scrollHeight > recordsScrollBefore.clientHeight + 1) {
                await page.mouse.wheel(0, -200);
                await page.waitForFunction(() => {
                    const scrollElement = document.querySelector('.utility-layout-scroll');
                    const navigation = document.querySelector('.island-shell-nav')?.getBoundingClientRect();
                    const heading = document.querySelector('#stats-learning-details')?.lastElementChild?.querySelector('h3')?.getBoundingClientRect();
                    const scroll = scrollElement?.getBoundingClientRect();
                    return !!heading && !!scroll && !!navigation
                        && heading.height > 0
                        && heading.top >= scroll.top - 1
                        && heading.bottom <= navigation.top + 1;
                });
            }
            recordsHeadingLayout = await recordsScroll.evaluate(element => {
                const scroll = element.getBoundingClientRect();
                const navigation = document.querySelector('.island-shell-nav')?.getBoundingClientRect();
                const heading = document.querySelector('#stats-learning-details')?.lastElementChild?.querySelector('h3')?.getBoundingClientRect();
                return {
                    scrollTop: element.scrollTop,
                    scrollTopEdge: scroll.top,
                    navigationTop: navigation?.top ?? null,
                    heading: heading ? { top: heading.top, bottom: heading.bottom, height: heading.height } : null,
                };
            });
            assert(recordsHeadingLayout.heading
                && recordsHeadingLayout.heading.top >= recordsHeadingLayout.scrollTopEdge - 1
                && recordsHeadingLayout.heading.bottom <= recordsHeadingLayout.navigationTop + 1,
            `The final records heading can be brought into view above fixed navigation: ${JSON.stringify(recordsHeadingLayout)}`);
            await capture('records-scrolled');
            await recordsScroll.evaluate(element => { element.scrollTop = 0; });
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
            await page.locator('[data-home-group=arrange] > summary').click();
            await page.locator('[data-home-action=inventory]').click(); await ordinary('#/island?view=inventory');
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
            photoActionLayout = await button(page, 'しゃしんを とる').evaluate(element => {
                const action = element.getBoundingClientRect();
                const navigation = document.querySelector('.island-shell-nav')?.getBoundingClientRect();
                const page = document.querySelector('.island-page')?.getBoundingClientRect();
                return {
                    action: { top: action.top, bottom: action.bottom, height: action.height },
                    navigationTop: navigation?.top ?? null,
                    pageBottom: page?.bottom ?? null,
                };
            });
            assert(photoActionLayout.navigationTop !== null && photoActionLayout.pageBottom !== null,
                `The photo action check requires a visible navigation and page viewport: ${JSON.stringify(photoActionLayout)}`);
            const photoActionLimit = Math.min(photoActionLayout.navigationTop ?? Infinity, photoActionLayout.pageBottom ?? Infinity);
            assert(photoActionLayout.action.height >= 44 && photoActionLayout.action.top >= 0
                && photoActionLayout.action.bottom <= photoActionLimit + 1,
            `The populated photo gallery keeps its 44px camera action fully above the fixed navigation: ${JSON.stringify(photoActionLayout)}`);
            await page.goto(`${base}/#/settings?section=learning&learn=1`); await focus('learning'); await waitReady(page);
            await page.reload(); await focus('learning'); await waitReady(page);
            assert.deepEqual((await readNative(page, id)).plan, saved.plan, 'Direct learning reload preserves the same reservation');
            await button(page, 'とじる').click(); await ordinary('#/settings?section=learning');
            await button(page, '変更').first().click(); await ordinary('#/settings/curriculum');
            const curriculumHeading = page.getByRole('heading', { name: 'レベル いちらん', exact: true });
            await curriculumHeading.waitFor();
            const curriculumScroll = page.locator('.brand-utility-screen').filter({ has: curriculumHeading }).locator(':scope > .overflow-y-auto');
            const curriculumScrollHandle = await curriculumScroll.elementHandle();
            assert(curriculumScrollHandle, 'Curriculum owns a mounted scroll surface');
            await page.waitForFunction(element => element.scrollHeight > element.clientHeight + 160, curriculumScrollHandle);
            await curriculumScroll.evaluate(element => { element.scrollTop = 160; });
            const scrollTop = await curriculumScroll.evaluate(element => element.scrollTop);
            const learnBox = await learn.boundingBox();
            assert(learnBox && learnBox.y >= 0 && learnBox.y + learnBox.height <= viewport.height, 'Learning tab is directly tappable in the viewport');
            await page.mouse.click(learnBox.x + learnBox.width / 2, learnBox.y + learnBox.height / 2);
            await focus('learning'); await waitReady(page);
            await button(page, 'とじる').click(); await ordinary('#/settings/curriculum');
            await curriculumHeading.waitFor();
            await page.waitForFunction(expected => {
                const screen = [...document.querySelectorAll('.brand-utility-screen')].find(element =>
                    [...element.querySelectorAll('h1, h2, h3')].some(heading => heading.textContent?.trim() === 'レベル いちらん'));
                const element = screen?.querySelector(':scope > .overflow-y-auto');
                return element?.scrollTop === expected;
            }, scrollTop);
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
            const metric = page.locator('.stats-metric').filter({ has: page.getByText('かいとう', { exact: true }) });
            assert.match(await metric.innerText(), /^1\s/, 'One saved answer replaces the empty state with the actual answer metric');

            // Review the caregiver page through its real gate on the current
            // Island-enabled app. The profile and its single answer are
            // disposable to this browser context, which is closed below.
            await page.goto(`${base}/#/settings?section=parent`);
            await page.getByRole('heading', { name: 'テスト・保護者', exact: true }).waitFor();
            await page.getByRole('button', { name: '開く', exact: true }).first().click();
            const gate = page.getByRole('dialog', { name: 'ほごしゃ かくにん' });
            await gate.waitFor();
            const gatePrompt = page.getByText(/^\d+\s*×\s*\d+\s*=\s*\?$/);
            const [gateLeft, gateRight] = (await gatePrompt.innerText()).match(/\d+/g).map(Number);
            await page.getByLabel('答え').fill(String(gateLeft * gateRight));
            await gate.getByRole('button', { name: 'OK', exact: true }).click();
            await page.waitForURL('**/#/parents');
            await page.getByRole('heading', { name: '保護者メニュー', exact: true }).waitFor();
            const reviewHeading = page.getByRole('heading', { name: '復習候補', exact: true });
            await reviewHeading.waitFor();
            const reviewDescription = '5回以上の回答がある項目が対象です。直近10回の正答率が60%未満で候補に加わり、80%以上になると表示から外れます。';
            const description = page.getByText(reviewDescription, { exact: true });
            await description.waitFor();
            assert.equal(await page.getByText('復習候補：0件', { exact: true }).count(), 1);
            assert.equal(await page.getByText('今は復習候補がありません。', { exact: true }).count(), 2);
            const parentLayout = await page.evaluate(() => {
                const paragraph = [...document.querySelectorAll('p')].find(element => element.textContent?.trim() ===
                    '5回以上の回答がある項目が対象です。直近10回の正答率が60%未満で候補に加わり、80%以上になると表示から外れます。');
                if (!paragraph) throw new Error('The review-candidate explanation is not rendered');
                const box = paragraph.getBoundingClientRect();
                return {
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: innerWidth,
                    descriptionWidth: box.width,
                    descriptionHeight: box.height,
                    descriptionScrollWidth: paragraph.scrollWidth,
                    descriptionClientWidth: paragraph.clientWidth,
                };
            });
            assert(parentLayout.documentWidth <= viewport.width + 1,
                `Parent page has no horizontal overflow: ${JSON.stringify(parentLayout)}`);
            assert(parentLayout.descriptionScrollWidth <= parentLayout.descriptionClientWidth + 1,
                `Review explanation wraps without clipping: ${JSON.stringify(parentLayout)}`);
            await captureUtility('parent-summary');
            const returnButton = page.getByRole('button', { name: '設定に戻る', exact: true });
            await returnButton.scrollIntoViewIfNeeded();
            const returnBox = await returnButton.boundingBox();
            assert(returnBox && returnBox.width >= 44 && returnBox.height >= 44,
                'Parent-page return remains a 44px-or-larger target');
            await returnButton.click();
            await page.waitForURL('**/#/settings?section=parent');
            await page.getByRole('heading', { name: 'テスト・保護者', exact: true }).waitFor();
            const beforeReviewFixture = await readNative(page, id);
            const fixtureMath = beforeReviewFixture.memoryMath.some(item => item.id === 'add_1d_1')
                ? { id: 'count_5', label: '5まで数える' }
                : { id: 'add_1d_1', label: '1桁+1桁(はじめ)' };
            const fixtureVocab = { id: 'apple', label: 'apple' };
            await page.evaluate(async ({ profileId, mathId, vocabId }) => {
                const { db } = await import('/src/db/index.ts');
                const now = new Date().toISOString();
                // These explicit isWeak rows exist only to exercise the parent
                // display. Zero answer counts and no logs make this unsuitable
                // as evidence for natural weak-state acquisition or thresholds.
                await db.memoryMath.put({ profileId, id: mathId, strength: 2, nextReview: '2099-01-01',
                    totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0, skippedAnswers: 0,
                    status: 'active', updatedAt: now, isWeak: true });
                await db.memoryVocab.put({ profileId, id: vocabId, strength: 2, nextReview: '2099-01-01',
                    totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0, skippedAnswers: 0,
                    updatedAt: now, isWeak: true });
            }, { profileId: id, mathId: fixtureMath.id, vocabId: fixtureVocab.id });
            const afterReviewFixture = await readNative(page, id);
            assert.deepEqual(afterReviewFixture.logs, beforeReviewFixture.logs,
                'Display-only parent fixture adds no attempt logs');
            assert.equal(afterReviewFixture.memoryMath.find(item => item.id === fixtureMath.id)?.isWeak, true);
            assert.equal(afterReviewFixture.memoryVocab.find(item => item.id === fixtureVocab.id)?.isWeak, true);
            assert.equal(afterReviewFixture.memoryMath.find(item => item.id === fixtureMath.id)?.totalAnswers, 0);
            assert.equal(afterReviewFixture.memoryVocab.find(item => item.id === fixtureVocab.id)?.totalAnswers, 0);
            parentCandidateFixture = {
                kind: 'display-only isWeak=true; zero answer counters; no attempt-log delta',
                mathId: fixtureMath.id,
                vocabId: fixtureVocab.id,
                naturalThresholdEvidence: false,
            };
            await page.getByRole('button', { name: '開く', exact: true }).first().click();
            const populatedGate = page.getByRole('dialog', { name: 'ほごしゃ かくにん' });
            await populatedGate.waitFor();
            const populatedGatePrompt = page.getByText(/^\d+\s*×\s*\d+\s*=\s*\?$/);
            const [populatedGateLeft, populatedGateRight] = (await populatedGatePrompt.innerText()).match(/\d+/g).map(Number);
            await page.getByLabel('答え').fill(String(populatedGateLeft * populatedGateRight));
            await populatedGate.getByRole('button', { name: 'OK', exact: true }).click();
            await page.waitForURL('**/#/parents');
            await page.getByRole('heading', { name: '保護者メニュー', exact: true }).waitFor();
            await page.getByText('復習候補：2件', { exact: true }).waitFor();
            await page.getByText(fixtureMath.label, { exact: true }).waitFor();
            await page.getByText(/^apple/).waitFor();
            assert.equal(await page.getByText('今は復習候補がありません。', { exact: true }).count(), 0,
                'Populated review state replaces both empty messages');
            await reviewHeading.scrollIntoViewIfNeeded();
            await captureUtility('parent-review-candidates');
            const populatedReturn = page.getByRole('button', { name: '設定に戻る', exact: true });
            await populatedReturn.scrollIntoViewIfNeeded();
            const populatedReturnBox = await populatedReturn.boundingBox();
            assert(populatedReturnBox && populatedReturnBox.width >= 44 && populatedReturnBox.height >= 44,
                'Populated parent-page return remains a 44px-or-larger target');
            await populatedReturn.click();
            await page.waitForURL('**/#/settings?section=parent');
            await page.getByRole('heading', { name: 'テスト・保護者', exact: true }).waitFor();

            // Continue from the current Island's own menu into the two-player
            // game. This is a current route, but a shared utility surface, so
            // record app-root flags rather than inventing an Island candidate.
            await nav.getByRole('button', { name: 'しま', exact: true }).click();
            await waitMode(page, 'home'); await ordinary('#/island');
            await button(page, 'しまのメニュー').click();
            await page.locator('[data-home-group="more-play"] > summary').click();
            await page.locator('[data-home-action="other-games"]').click();
            await page.waitForURL('**/#/battle');
            const otherGamesHeading = page.getByRole('heading', { name: 'ほかの あそび', exact: true });
            await otherGamesHeading.waitFor();
            assert.equal(await page.getByRole('button', { name: /ふたりで きょうりょく/ }).count(), 1);
            assert.equal(await page.getByRole('button', { name: /つなひき たいせん/ }).count(), 1);
            const otherGamesAlignment = await page.evaluate(() => {
                const heading = [...document.querySelectorAll('h1')].find(element => element.textContent?.trim() === 'ほかの あそび');
                const firstChoice = [...document.querySelectorAll('button')].find(element => element.textContent?.includes('ポッコの たんけん'));
                if (!heading || !firstChoice) throw new Error('The Other Games heading or first choice is missing');
                const headingRect = heading.getBoundingClientRect();
                const choiceRect = firstChoice.getBoundingClientRect();
                const headingCenter = (headingRect.left + headingRect.right) / 2;
                const choiceCenter = (choiceRect.left + choiceRect.right) / 2;
                return { headingCenter, choiceCenter, centerDelta: Math.abs(headingCenter - choiceCenter) };
            });
            if (viewport.width >= 700) {
                assert(otherGamesAlignment.centerDelta <= 2,
                    `Wide Other Games heading aligns with the centered choice list: ${JSON.stringify(otherGamesAlignment)}`);
            }
            otherGamesChoiceLayout = await page.evaluate(() => {
                const navigation = document.querySelector('.island-shell-nav');
                const navigationTop = navigation?.getBoundingClientRect().top ?? innerHeight;
                const choices = [...document.querySelectorAll('[data-other-game-choice]')].map(button => {
                    const rect = button.getBoundingClientRect();
                    return {
                        bottom: rect.bottom,
                        width: rect.width,
                        height: rect.height,
                    };
                });
                return { navigationTop, choices };
            });
            if (viewport.height <= 430) {
                assert(otherGamesChoiceLayout.choices.length === 3
                    && otherGamesChoiceLayout.choices.every(choice => choice.bottom <= otherGamesChoiceLayout.navigationTop + 1
                        && choice.width >= 44 && choice.height >= 44),
                `Short-landscape game choices stay fully visible above navigation: ${JSON.stringify(otherGamesChoiceLayout)}`);
            }
            await captureUtility('other-games');
            await button(page, '2人あそびを くわしく えらぶ').click();
            await page.waitForURL('**/#/battle/play');

            if (viewport.width >= 768 && viewport.height > viewport.width) {
                await page.getByText('タブレットを よこにしてね', { exact: true }).waitFor();
                const gateReturn = button(page, 'ほかの あそびへ もどる');
                const gateReturnBox = await gateReturn.boundingBox();
                assert(gateReturnBox && gateReturnBox.width >= 44 && gateReturnBox.height >= 44,
                    'Tablet-portrait guidance keeps a 44px-or-larger return target');
                await captureUtility('battle-rotate-guidance');
                await gateReturn.click();
                await page.waitForURL('**/#/battle');
            } else if (viewport.width <= 767 && viewport.height <= 639) {
                await page.getByText('もうすこし 大きな画面で あそんでね', { exact: true }).waitFor();
                await page.getByText('このゲームは 画面の大きな端末で あそべるよ', { exact: true }).waitFor();
                const gateReturn = button(page, 'ほかの あそびへ もどる');
                const gateReturnBox = await gateReturn.boundingBox();
                assert(gateReturnBox && gateReturnBox.width >= 44 && gateReturnBox.height >= 44,
                    'Small-phone guidance keeps a 44px-or-larger return target');
                await captureUtility('battle-small-screen-guidance');
                await gateReturn.click();
                await page.waitForURL('**/#/battle');
            } else {
                const setup = page.locator('.battle-setup-screen');
                await setup.waitFor();
                const playerOneGrades = page.getByRole('group', { name: 'プレイヤー 1のがくねん' });
                const playerTwoGrades = page.getByRole('group', { name: 'プレイヤー 2のがくねん' });
                await playerOneGrades.waitFor();
                await playerTwoGrades.waitFor();
                await page.getByRole('group', { name: 'プレイヤー 1のアイコン' }).waitFor();
                await page.getByRole('group', { name: 'プレイヤー 2のアイコン' }).waitFor();
                const start = button(page, 'スタート！');
                assert.equal(await start.isEnabled(), false, 'Two-player setup requires both grades before starting');
                const setupStatus = setup.locator('[role="status"]');
                const setupStatusCopy = () => setupStatus.locator(':scope > span').first().textContent();
                const expectedScrollCue = async player => page.evaluate(playerNumber => {
                    const viewport = document.querySelector('[data-battle-setup-scroll]');
                    const gradeGroup = viewport?.querySelector(`[data-battle-grade="player-${playerNumber}"]`);
                    if (!viewport || !gradeGroup) return null;
                    const clip = viewport.getBoundingClientRect();
                    const target = gradeGroup.getBoundingClientRect();
                    const hiddenAbove = target.top < clip.top - 1;
                    const hiddenBelow = target.bottom > clip.bottom + 1;
                    return hiddenAbove && hiddenBelow ? 'both' : hiddenAbove ? 'up' : hiddenBelow ? 'down' : null;
                }, player);
                const initialScrollCue = await expectedScrollCue(1);
                const scrollCue = setup.locator('[data-battle-scroll-cue]');
                assert.equal(await scrollCue.getAttribute('data-battle-scroll-cue'), initialScrollCue,
                    'The visible scroll cue matches the first required grade group when it is clipped');
                assert.equal(await setupStatusCopy(), 'ふたりの がくねんを えらぶと はじめられるよ');
                const setupState = await page.evaluate(() => ({
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: innerWidth,
                    setupScrollCue: document.querySelector('[data-battle-scroll-cue]')?.getAttribute('data-battle-scroll-cue') ?? null,
                    playerGroups: [...document.querySelectorAll('.battle-setup-screen [role="group"]')]
                        .map(group => group.getAttribute('aria-label')),
                    optionTargets: [...document.querySelectorAll('.battle-setup-screen [aria-pressed]')]
                        .map(option => {
                            const rect = option.getBoundingClientRect();
                            return { width: rect.width, height: rect.height };
                        }),
                }));
                assert(setupState.documentWidth <= viewport.width + 1,
                    `Battle setup has no horizontal overflow: ${JSON.stringify(setupState)}`);
                assert(setupState.playerGroups.includes('プレイヤー 1のアイコン')
                    && setupState.playerGroups.includes('プレイヤー 2のアイコン')
                    && setupState.playerGroups.includes('プレイヤー 1のがくねん')
                    && setupState.playerGroups.includes('プレイヤー 2のがくねん'),
                `Both players' controls expose distinct group names: ${JSON.stringify(setupState.playerGroups)}`);
                assert(setupState.optionTargets.length >= 36
                    && setupState.optionTargets.every(target => target.width >= 44 && target.height >= 44),
                `Battle option targets remain at least 44px: ${JSON.stringify(setupState.optionTargets)}`);
                await captureUtility('battle-setup');
                const gradeOptions = page.getByRole('button', { name: '1ねんせい', exact: true });
                assert.equal(await gradeOptions.count(), 2);
                await gradeOptions.first().click();
                assert.equal(await setupStatusCopy(), 'プレイヤー2の がくねんを えらぶと はじめられるよ');
                const secondPlayerScrollCue = await expectedScrollCue(2);
                await page.waitForFunction(expected => {
                    const cue = document.querySelector('[data-battle-scroll-cue]');
                    return expected ? cue?.getAttribute('data-battle-scroll-cue') === expected : cue === null;
                }, secondPlayerScrollCue);
                await gradeOptions.last().click();
                assert.equal(await gradeOptions.first().getAttribute('aria-pressed'), 'true');
                assert.equal(await gradeOptions.last().getAttribute('aria-pressed'), 'true');
                assert.equal(await setupStatusCopy(), 'ふたりの じゅんびが できたよ');
                assert.equal(await scrollCue.count(), 0, 'The scroll cue clears when neither required grade remains');
                assert.equal(await start.isEnabled(), true, 'Selecting both grades enables the start action');
                await button(page, 'もどる').click();
                await page.waitForURL('**/#/battle');
            }
            await button(page, 'もどる').click();
            await waitMode(page, 'home'); await ordinary('#/island');
            if (viewport.width >= 480 && viewport.height <= 400 && viewport.width > viewport.height) {
                await learn.click(); await focus('learning'); await waitReady(page);
                const hintAnswer = page.locator('.park-keypad').getByRole('button', { name: '1', exact: true });
                await hintAnswer.click();
                const beforeHint = await readNative(page, id);
                const hintPlan = beforeHint.plan;
                await button(page, 'ヒントを みる').click();
                await page.locator('.island-answer-stage[data-support-stage=hint]').waitFor();
                await page.locator('.park-support').waitFor();
                const afterHint = await readNative(page, id);
                assert.deepEqual(afterHint.logs, beforeHint.logs, 'Opening a hint does not add an answer log');
                assert.equal(afterHint.plan.cursor, hintPlan.cursor, 'Opening a hint does not advance the reserved question');
                assert.equal(afterHint.plan.slots[afterHint.plan.cursor].assisted, true, 'The disposable plan records the opened hint');
                const skillId = hintPlan.slots[hintPlan.cursor].problem.categoryId;
                const memoryStore = hintPlan.subject === 'math' ? 'memoryMath' : 'memoryVocab';
                const memoryBeforeHint = beforeHint[memoryStore].find(memory => memory.id === skillId);
                const memoryAfterHint = afterHint[memoryStore].find(memory => memory.id === skillId);
                assert(memoryAfterHint, 'Opening a hint keeps the independent relearning safeguard for this skill');
                for (const counter of ['totalAnswers', 'correctAnswers', 'incorrectAnswers', 'skippedAnswers']) {
                    assert.equal(memoryAfterHint[counter], memoryBeforeHint?.[counter] ?? 0,
                        `Opening a hint does not change the ${counter} answer count`);
                }
                await capture('learning-hint');
                shortHelpLayout = await page.evaluate(() => {
                    const navigation = document.querySelector('.island-shell-nav');
                    const navigationRect = navigation?.getBoundingClientRect();
                    const contentBottom = navigation && navigationRect && navigationRect.top < innerHeight
                        ? Math.min(innerHeight, navigationRect.top) : innerHeight;
                    const rect = element => {
                        const bounds = element?.getBoundingClientRect();
                        return bounds ? { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height } : null;
                    };
                    const keypad = document.querySelector('.park-keypad');
                    return {
                        contentBottom,
                        viewportHeight: innerHeight,
                        documentScrollHeight: document.documentElement.scrollHeight,
                        progress: rect(document.querySelector('.island-learning-progress')),
                        progressControls: [...document.querySelectorAll('.island-learning-progress button')].map(rect),
                        question: rect(document.querySelector('.park-question')),
                        support: rect(document.querySelector('.park-support')),
                        inputs: rect(document.querySelector('.park-inputs')),
                        keypad: rect(keypad),
                        keys: [...(keypad?.querySelectorAll('button') ?? [])].map(rect),
                        actions: rect(document.querySelector('.island-learning-actions')),
                        actionButtons: [...document.querySelectorAll('.island-learning-actions button')].map(rect),
                    };
                });
                assert(shortHelpLayout.documentScrollHeight <= shortHelpLayout.viewportHeight + 1
                    && shortHelpLayout.progress?.bottom <= shortHelpLayout.contentBottom + 1
                    && shortHelpLayout.progressControls.every(control => control.width >= 44 && control.height >= 44
                        && control.top >= 0 && control.bottom <= shortHelpLayout.contentBottom + 1)
                    && shortHelpLayout.question?.bottom <= shortHelpLayout.contentBottom + 1
                    && shortHelpLayout.support?.height > 0
                    && shortHelpLayout.support.top >= 0
                    && shortHelpLayout.support.bottom <= shortHelpLayout.actions?.top + 1
                    && shortHelpLayout.keypad?.height > 0
                    && shortHelpLayout.keys.length > 0
                    && shortHelpLayout.keys.every(key => key.width >= 44 && key.height >= 44
                        && key.top >= 0 && key.bottom <= shortHelpLayout.contentBottom + 1)
                    && (!shortHelpLayout.inputs || (shortHelpLayout.inputs.top >= 0
                        && shortHelpLayout.inputs.bottom <= shortHelpLayout.contentBottom + 1))
                    && shortHelpLayout.actionButtons.length > 0
                    && shortHelpLayout.actionButtons.every(action => action.width >= 44 && action.height >= 44
                        && action.top >= 0 && action.bottom <= shortHelpLayout.contentBottom + 1),
                `Short-landscape hint keeps support, full keypad, answer and next action visible without overlap: ${JSON.stringify(shortHelpLayout)}`);
                await button(page, 'とじる').click(); await waitMode(page, 'home'); await ordinary('#/island');
            }
            assert.deepEqual(errors, []);
            report.scenarios.push({ viewport, pass: true, settingsContrast, parentCandidateFixture, welcomeLayout, photoActionLayout, otherGamesChoiceLayout, shortLearningLayout, shortHelpLayout, checks: ['first-run welcome identity, responsive frame, and visible 44px actions', ...(shortLandscapeWelcome ? ['short-landscape Welcome keeps the island scene and all three actions visible without scrolling'] : []), ...(viewport.width <= 360 ? ['narrow first-run item labels remain single-line', 'five-tab navigation labels fit on one line inside 44px-or-larger targets'] : []), 'explicit profile-add frame preserved', 'top entry without learning', 'stale top query and unknown URL recovery', 'existing-profile onboarding return', 'pending-plan top return without learning writes', 'ordinary tabs', ...(viewport.height <= 430 ? ['play continuation reachable by internal scroll'] : []), 'settings source retained', 'settings small-text contrast on composed surface and opaque paper', 'draft and seven-store equality', 'back/forward', 'home reload without auto-start', 'placement cancel/save', 'camera close', 'real photo/detail close', 'populated photo action remains fully visible above fixed navigation', 'direct learning reload/close', ...(viewport.width >= 480 && viewport.height <= 600 && viewport.width > viewport.height ? ['short-landscape learning keeps every 44px keypad key, answer, and help action visible'] : []), ...(viewport.width >= 480 && viewport.height <= 400 && viewport.width > viewport.height ? ['short-landscape hint keeps the support, full keypad, answer and next action visible without overlap'] : []), 'curriculum scroll restored', 'direct placement fallback', 'records refresh after answer', 'current-Island parent gate and empty review-candidate copy', 'current-Island parent populated review candidates via display-only fixture', 'parent explanation wraps without horizontal overflow', 'parent return reaches the originating settings section from both states', ...(viewport.width >= 700 ? ['wide Other Games heading aligns with centered choice list'] : []), ...(viewport.height <= 430 ? ['all three primary game choices remain fully visible above the fixed navigation'] : []), 'Island menu → Other Games → Battle guidance/setup and return', ...(viewport.width >= 768 && viewport.height > viewport.width ? ['tablet portrait Battle orientation guidance and return'] : viewport.width <= 767 && viewport.height <= 639 ? ['small-phone Battle screen-size guidance and return'] : ['two-player setup semantics, 44px options, prerequisite guidance, scroll discoverability, and start readiness'])], errors });
            report.scenarios.at(-1).recordsScrollLayout = recordsScrollLayout;
            report.scenarios.at(-1).checks.push('records use an internal scroll surface without document overflow');
            report.scenarios.at(-1).checks.push('the final records section remains reachable above fixed navigation');
            report.scenarios.at(-1).recordsHeadingLayout = recordsHeadingLayout;
            report.scenarios.at(-1).checks.push('the final records section heading can be brought into view above fixed navigation');
            report.scenarios.at(-1).inventoryScrollLayout = inventoryScrollLayout;
            if (inventoryScrollLayout) report.scenarios.at(-1).checks.push('short-landscape inventory scroll cue tracks content; item labels and furniture action are reachable above fixed navigation');
            console.log(`PASS navigation ${viewport.width}x${viewport.height}`);
        } catch (error) {
            await page.screenshot({ path: `${out}/${viewportTag}-failure.png` }).catch(() => {});
            report.scenarios.push({ viewport, pass: false, settingsContrast, parentCandidateFixture, welcomeLayout, photoActionLayout, otherGamesChoiceLayout, shortLearningLayout, shortHelpLayout, error: String(error), url: page.url(), errors });
            report.scenarios.at(-1).recordsScrollLayout = recordsScrollLayout;
            report.scenarios.at(-1).recordsHeadingLayout = recordsHeadingLayout;
            report.scenarios.at(-1).inventoryScrollLayout = inventoryScrollLayout;
            throw error;
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const contactSheet = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Island navigation evidence</title><style>body{margin:24px;background:#f6f4ee;color:#25314f;font:14px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}figure{margin:0;padding:10px;background:#fff;border:1px solid #ded8e8;border-radius:12px}img{display:block;width:100%;height:340px;object-fit:contain;background:#f0eef3;border-radius:8px}figcaption{padding-top:8px;overflow-wrap:anywhere;line-height:1.45}h1{font-size:20px}p{color:#58637b}</style><h1>Island navigation: ${report.pass ? 'PASS' : 'FAIL / INCOMPLETE'}</h1><p>${escapeHtml(report.target)} · ${report.captures.length} captures · ${report.scenarios.length} viewport runs</p><main>${report.captures.map(capture => {
        const imagePath = encodeURIComponent(capture.file);
        const appRoot = capture.appRoot;
        const rootCaption = appRoot
            ? `root Island ${appRoot.islandFeatureEnabled} / NatureTown ${appRoot.natureTownFeatureEnabled} · ${appRoot.revision} · ${appRoot.version} · ${appRoot.configuredDelivery}`
            : 'root identity missing';
        const caption = capture.candidate
            ? `${capture.viewport.width}×${capture.viewport.height} · ${capture.mode} · ${capture.version} · ${capture.delivery} · ${capture.candidate} · ${capture.learningCandidate} · ${rootCaption}`
            : `${capture.viewport.width}×${capture.viewport.height} · ${capture.routeCandidate} · ${rootCaption}`;
        return `<figure><a href="${imagePath}"><img loading="lazy" src="${imagePath}" alt="${escapeHtml(capture.file)}"></a><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }).join('')}</main></html>`;
    await fs.writeFile(`${out}/contact-sheet.html`, contactSheet);
    await browser.close();
}
