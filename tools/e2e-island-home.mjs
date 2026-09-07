import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { button, readNative, seedNative, waitReady, waitMode, runtimeMetadata, answerUI } from './island-e2e-helpers.mjs';
import { onboardingStores } from './island-onboarding-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL;
const out = process.env.SANSU_ISLAND_HOME_OUTPUT;
assert(base && out, 'Set a fixed production URL and a fresh evidence directory');
await fs.mkdir(out, { recursive: true });
const report = { target: base, pass: false, scenarios: [], captures: [], scope: 'Disposable native profiles; real UI creates and saves Park work and Island learning. Phone/tablet Chromium, not physical devices.' };
const browser = await chromium.launch();
try {
    for (const [name, width, height] of [['phone', 390, 844], ['tablet', 768, 1024]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone', serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const capture = async stage => {
            const file = `${name}-${stage}.png`;
            await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
            report.captures.push({ file, viewport: { width, height }, url: page.url(), version: report.manifest.version });
        };
        try {
            await page.goto(`${base}/#/`); await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            assert(manifest.island.enabled);
            const id = await seedNative(page, `island-home-${name}`);
            await page.goto(`${base}/#/`); await waitReady(page); await waitMode(page, 'home');
            assert.equal(new URL(page.url()).hash, '#/island');
            await button(page, 'ひかりを とどける').click(); await waitMode(page, 'learning');
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            const reserved = await readNative(page, id);
            assert(reserved.plan);
            await capture('home');
            await button(page, 'ほかの あそび').click();
            await page.getByRole('heading', { name: 'ほかの あそび', exact: true }).waitFor();
            await capture('other-games');
            await page.getByRole('button', { name: /ちいさな遊園地/ }).click();
            await page.locator('[data-game-id="build-play-v1"]').waitFor();
            if (!await page.locator('.park-course-name input').isVisible()) await button(page, 'ならべかえる').click();
            const courseName = page.locator('.park-course-name input');
            await courseName.fill('また あそぶ'); await courseName.press('Tab');
            await button(page, 'しまへ もどる').click({ trial: true });
            const saved = await onboardingStores(page);
            assert(saved.parks.rows.some(park => park.profileId === id && park.courses.some(course => course.name === 'また あそぶ')));
            await capture('saved-park');
            await button(page, 'しまへ もどる').click(); await waitReady(page);
            // A pending Island section resumes automatically; neither game is reset.
            assert.deepEqual((await readNative(page, id)).plan, reserved.plan);
            await button(page, 'しまへ').click(); await waitMode(page, 'home');
            await button(page, 'ほかの あそび').click();
            await page.getByRole('button', { name: /ちいさな遊園地/ }).click();
            await page.locator('[data-game-id="build-play-v1"]').waitFor();
            assert.deepEqual((await onboardingStores(page)).parks, saved.parks);
            await capture('park-reopened');
            await button(page, 'せってい').click();
            await button(page, 'ふしぎな しま').click(); await waitReady(page); await waitMode(page, 'learning');
            const before = await readNative(page, id);
            assert.deepEqual(before.plan, reserved.plan);
            assert.deepEqual(before.logs, reserved.logs);
            const after = (await answerUI(page, before.plan, { dev: false })).state;
            assert.equal(after.logs.length, before.logs.length + 1);
            await capture('island-resumed');
            report.scenarios.push({ name, runtime: await runtimeMetadata(page), parkPreserved: true, islandReservationPreserved: true, nextAnswerSaved: true, errors });
            assert.deepEqual(errors, []);
            console.log('PASS Island home / saved Park / Settings / learning', name);
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    await browser.close();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
