import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { activate, answerUI, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const base = (process.env.SANSU_ISLAND_SHELL_URL || 'http://127.0.0.1:5198').replace(/\/$/, '');
const out = process.env.SANSU_ISLAND_SHELL_OUTPUT || 'output/playwright/island-shell';
const candidate = 'pokomoko-color-dots-v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
    target: base, candidate, flag: 'VITE_ISLAND_ENABLED=true', startedAt: new Date().toISOString(), pass: false,
    scope: 'Disposable native profiles. Chromium phone/tablet, not physical devices. Actual Island reservation and one answer precede utility navigation, reload, and old regular-practice links. Persisted plan, current question, cursor, support, rewards and logs must survive. Unsubmitted form digits are transient and are not claimed to survive unmount/reload. Explicit review/test routes retain their existing learning meanings. Screenshots support visual review; this script does not certify art appeal or child comprehension.',
    scenarios: [], captures: [],
};
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
report.browserVersion = browser.version();

async function appMetadata(page) {
    return page.locator('.app-container').evaluate(element => ({
        url: location.href, revision: element.dataset.buildRevision, delivery: element.dataset.deliveryId,
        configuredDelivery: element.dataset.configuredDeliveryId, lineage: element.dataset.visualLineageId,
        shellCandidate: document.querySelector('[data-shell-candidate]')?.getAttribute('data-shell-candidate') ?? null,
        viewport: { width: innerWidth, height: innerHeight },
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
    }));
}

async function noOverflow(page) {
    const geometry = await page.evaluate(() => ({ viewport: innerWidth,
        document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
        shell: [...document.querySelectorAll('.island-shell, .island-shell main, .island-shell-nav, .island-page')]
            .map(element => ({ className: element.className, width: element.clientWidth, scroll: element.scrollWidth })),
    }));
    assert(geometry.document <= geometry.viewport + 1 && geometry.body <= geometry.viewport + 1, JSON.stringify(geometry));
    for (const element of geometry.shell) assert(element.scroll <= element.width + 1, JSON.stringify(element));
    return geometry;
}

async function assertShell(page, { nav = true, mark = true } = {}) {
    await page.locator(`.island-shell[data-shell-candidate="${candidate}"]`).waitFor();
    const header = page.locator('.island-shell-header');
    await header.first().waitFor({ state: 'attached' });
    if (mark) assert.equal(await header.locator('.island-shell-mark img[src="/icons/icon-192.png"]').count(), 1, 'Utility header keeps the adopted Pokomoko bear');
    assert.equal(await header.locator('.island-shell-eyebrow').textContent(), 'ぽこもこと不思議な島');
    const geometry = await noOverflow(page);
    const controls = [];
    if (nav) {
        const menu = page.getByRole('navigation', { name: 'メインメニュー', exact: true });
        await menu.waitFor();
        assert.equal(await menu.getByRole('button').count(), 3);
        for (const label of ['きろく', 'しま', 'せってい']) {
            const control = menu.getByRole('button', { name: label, exact: true });
            await control.click({ trial: true });
            const actual = await control.evaluate(element => {
                const box = element.getBoundingClientRect(), text = element.querySelector('span');
                const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                return { label: element.getAttribute('aria-label'), width: box.width, height: box.height,
                    x: box.x, y: box.y, right: box.right, bottom: box.bottom,
                    viewport: { width: innerWidth, height: innerHeight },
                    text: text?.textContent, fontSize: text ? parseFloat(getComputedStyle(text).fontSize) : 0,
                    textFits: Boolean(text && text.scrollWidth <= text.clientWidth + 1),
                    hit: hit === element || element.contains(hit) };
            });
            assert(actual.width >= 44 && actual.height >= 44 && actual.fontSize >= 12 && actual.textFits && actual.hit, JSON.stringify(actual));
            assert(actual.text?.includes(label));
            assert(actual.x >= -1 && actual.y >= -1 && actual.right <= actual.viewport.width + 1 && actual.bottom <= actual.viewport.height + 1, JSON.stringify(actual));
            controls.push(actual);
        }
    }
    return { geometry, controls };
}

async function preserved(page, profileId, expected, reason) {
    const actual = await readNative(page, profileId);
    for (const key of ['island', 'plan', 'islandPlans', 'logs', 'islandEvents']) {
        assert.deepEqual(actual[key], expected[key], `${reason}: native ${key} is preserved`);
    }
    return { reason, planId: actual.plan.id, cursor: actual.plan.cursor, revision: actual.plan.revision,
        persistedStateHash: sha(JSON.stringify({ island: actual.island, plans: actual.islandPlans, logs: actual.logs })) };
}

async function capture(page, row, stage) {
    await noOverflow(page);
    const metadata = await appMetadata(page);
    assert.equal(metadata.revision, row.runtime.revision, 'All captures use the same actual build revision');
    const island = await page.locator('.island-page[data-visual-candidate-id]').count()
        ? await runtimeMetadata(page) : null;
    if (island) {
        assert.equal(island.version, row.runtime.version);
        assert.equal(island.candidate, row.runtime.candidate);
    }
    const file = `${row.name}-${stage}.png`;
    const bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, stage, sha256: sha(bytes), ...metadata,
        version: row.runtime.version, islandCandidate: row.runtime.candidate, island });
}

const navButton = (page, name) => page.getByRole('navigation', { name: 'メインメニュー', exact: true }).getByRole('button', { name, exact: true });
const readyLearning = async page => {
    await waitReady(page); await waitMode(page, 'learning');
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    assert.equal(await page.locator('[data-question-text]').count(), 0, 'Regular practice uses the native Island learning panel');
};

try {
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 768, 1024]]) {
        const touch = name === 'phone';
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch,
            serviceWorkers: 'block', reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        const row = { name, viewport: { width, height }, soundEnabled: false, errors: [], preservation: [], shellChecks: [], routes: [] };
        report.scenarios.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${base}/#/`); await waitReady(page);
            row.profileId = await seedNative(page, `island-shell-${name}-${Date.now()}`);
            await page.goto(`${base}/#/`); await waitReady(page); await waitMode(page, 'home');
            assert.equal(new URL(page.url()).hash, '#/island');
            row.runtime = await runtimeMetadata(page);
            assert.equal(row.runtime.reducedMotion, name === 'tablet');
            const manifest = await page.evaluate(async () => {
                try {
                    const response = await fetch('/version.json', { cache: 'no-store' });
                    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return null;
                    return await response.json();
                } catch { return null; }
            });
            if (manifest) {
                assert.equal(manifest.revision, row.runtime.revision);
                assert.equal(manifest.version, row.runtime.version);
                assert.equal(manifest.island.enabled, true);
                if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            }
            row.evidenceTarget = manifest ? 'production-manifest-verified' : 'development-runtime-metadata';
            await capture(page, row, 'launch');
            await activate(page.locator('.island-start'), touch); await readyLearning(page);
            const reserved = await readNative(page, row.profileId);
            assert(reserved.plan && reserved.plan.cursor === 0);
            await capture(page, row, 'native-learning');
            const answered = await answerUI(page, reserved.plan, { touch, dev: false });
            assert.equal(answered.state.logs.length, reserved.logs.length + 1);
            assert.equal(answered.state.plan.cursor, reserved.plan.cursor + 1);
            const saved = answered.state;
            await activate(button(page, 'しまへ'), touch); await waitMode(page, 'home');
            row.preservation.push(await preserved(page, row.profileId, saved, 'pause to Island'));
            await capture(page, row, 'paused-island');
            await activate(button(page, 'せってい'), touch);
            await page.getByRole('button', { name: /プロフィール/ }).first().waitFor();
            row.shellChecks.push({ stage: 'settings', ...await assertShell(page) });
            await capture(page, row, 'settings');
            await activate(page.getByRole('button', { name: /プロフィール/ }).first(), touch);
            await page.getByRole('button', { name: /^(ついか|追加)$/ }).waitFor();
            row.shellChecks.push({ stage: 'expanded-settings', ...await assertShell(page) });
            await capture(page, row, 'settings-expanded');
            await activate(navButton(page, 'きろく'), touch);
            await page.getByRole('heading', { name: /^(きろく|記録)$/ }).waitFor();
            row.shellChecks.push({ stage: 'stats', ...await assertShell(page) });
            await capture(page, row, 'stats');
            await activate(navButton(page, 'しま'), touch); await readyLearning(page);
            row.preservation.push(await preserved(page, row.profileId, saved, 'settings and records return'));
            await page.reload(); await readyLearning(page);
            row.preservation.push(await preserved(page, row.profileId, saved, 'reload resumed Island'));
            await capture(page, row, 'learning-resumed');
            await activate(button(page, 'しまへ'), touch); await waitMode(page, 'home');
            await activate(button(page, 'ほかの あそび'), touch);
            await page.getByRole('heading', { name: 'ほかの あそび', exact: true }).waitFor();
            row.shellChecks.push({ stage: 'other-games', ...await assertShell(page, { mark: false }) });
            assert(await page.getByRole('button', { name: /ポッコの たんけん/ }).count(), 'Other games keep their explicit identity and remain discoverable');
            await capture(page, row, 'other-games');
            await activate(navButton(page, 'しま'), touch); await readyLearning(page);
            row.preservation.push(await preserved(page, row.profileId, saved, 'other-games return'));

            for (const route of ['/study', '/study?session=normal']) {
                await page.goto(`${base}/#${route}`); await readyLearning(page);
                assert.equal(new URL(page.url()).hash, '#/island');
                row.routes.push({ requested: route, actual: new URL(page.url()).hash, nativeIslandLearning: true });
                row.preservation.push(await preserved(page, row.profileId, saved, `regular practice link ${route}`));
            }
            await capture(page, row, 'regular-link-resumed');

            for (const route of ['/study?session=review&force_review=1', '/study?session=periodic-test&focus_subject=math', '/study?session=normal&focus_subject=math']) {
                await page.goto(`${base}/#${route}`);
                await page.locator('[data-question-text]').waitFor();
                assert.equal(new URL(page.url()).hash, `#${route}`);
                assert.equal(await page.locator('.island-page').count(), 0);
                await assertShell(page, { nav: false });
                row.routes.push({ requested: route, actual: new URL(page.url()).hash, explicitStudyPreserved: true });
                row.preservation.push(await preserved(page, row.profileId, saved, `explicit Study ${route}`));
                if (!route.includes('session=normal')) await capture(page, row, route.includes('review') ? 'explicit-review' : 'explicit-periodic-test');
            }
            await page.goto(`${base}/#/island`); await readyLearning(page);
            row.preservation.push(await preserved(page, row.profileId, saved, 'return from explicit Study'));
            assert.deepEqual(row.errors, []);
            row.pass = true;
            console.log(`PASS Island shell ${name}: native learning, utility navigation, resume, regular redirect and explicit Study`);
        } finally { await context.close(); }
    }

    const emptyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
        const page = await emptyContext.newPage();
        await page.goto(`${base}/#/study`);
        await page.waitForURL(url => url.hash === '#/onboarding');
        await page.locator('.island-page').waitFor();
        assert.equal(await page.locator('.island-learning').count(), 0);
        report.emptyProfile = { requested: '/study', actual: new URL(page.url()).hash, onboardingRequired: true, ...await appMetadata(page) };
    } finally { await emptyContext.close(); }
    report.pass = true;
} catch (error) {
    report.error = { message: error.message, stack: error.stack };
    throw error;
} finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
    const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    await fs.writeFile(`${out}/contact-sheet.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Island shell runtime contact sheet</title><style>body{margin:24px;background:#102d30;color:#f5eedf;font:14px system-ui}h1{font-size:22px}p{max-width:90ch;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:24px}figure{margin:0}img{width:100%;height:600px;object-fit:contain;object-position:top;background:#193c3b}figcaption{line-height:1.5;overflow-wrap:anywhere}</style><h1>Island shell / ${escape(candidate)}</h1><p>${escape(base)} · ${escape(report.startedAt)} · ${report.pass ? 'PASS' : 'INCOMPLETE / FAILED'}</p><p>${escape(report.scope)}</p><div class="grid">${report.captures.map(capture => `<figure><a href="${escape(capture.file)}"><img src="${escape(capture.file)}" alt="${escape(capture.file)}"></a><figcaption>${escape(capture.file)}<br>${escape(capture.viewport.width)}×${escape(capture.viewport.height)} · ${escape(capture.revision)} · ${escape(capture.version)}<br>${escape(capture.delivery)} · ${escape(capture.shellCandidate || capture.islandCandidate)}<br>${escape(capture.url)}</figcaption></figure>`).join('')}</div></html>`);
}
