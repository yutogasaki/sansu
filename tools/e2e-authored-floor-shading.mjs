import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const output = process.env.SANSU_FLOOR_SHADING_OUTPUT;
const expectedBuild = process.env.SANSU_FLOOR_SHADING_BUILD;
assert(output && expectedBuild, 'Set a fresh output directory and actual build revision');
const base = new URL(process.env.SANSU_FLOOR_SHADING_URL
    ?? 'http://127.0.0.1:5358/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner');
assert.equal(base.searchParams.get('shoulder'), null, 'This comparison changes source shading only');
const sha = value => createHash('sha256').update(value).digest('hex');
const inputs = async () => {
    const walk = async directory => (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map(entry =>
        entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat();
    const files = [...await walk('src'), ...await walk('tools'), ...await walk('prototypes/place-qa'),
        'package.json', 'package-lock.json', 'vite.config.ts',
        'docs/design/2026-10-11-authored-world-foundation/world-manifest.json',
        'docs/design/2026-10-10-island-final-3d/whole-island-render.png'];
    return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async name => [name, sha(await fs.readFile(name))])));
};
const physical = definition => {
    const copy = structuredClone(definition); delete copy.revision;
    for (const district of copy.districts) for (const floor of [...district.floors, ...(district.anchorFloors ?? [])]) {
        delete floor.material;
        for (const vertex of floor.vertices) delete vertex.normal;
    }
    return copy;
};
const canonicalState = state => { const copy = structuredClone(state); delete copy.applied; delete copy.placeProgress; return copy; };
const walkingTopology = value => { const copy = JSON.parse(value); delete copy.poses; return copy; };
await fs.mkdir(output, { recursive: false });
const report = { pass: false, expectedBuild, target: String(base),
    scope: 'Same real DEV renderer, physical floor data, synthetic owners, camera and day lighting; source floor normals/materials A/B only',
    exclusions: ['No art pass without reviewing both actual screenshots', 'No shoulder shape change', 'No performance, player save or independent observer acceptance'],
    initialInputs: await inputs(), captures: [], pairs: [], errors: [] };
let browser;
try {
    const definitions = await Promise.all(['native05-world.json.gz', 'native05-world-source-shading.json.gz'].map(async name =>
        JSON.parse(gunzipSync(await fs.readFile(`prototypes/place-qa/${name}`)))));
    assert.deepEqual(physical(definitions[0]), physical(definitions[1]), 'Every physical world value must be identical');
    report.physicalDefinitionSha256 = sha(JSON.stringify(physical(definitions[0])));
    report.sourceRevision = definitions[1].revision;
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
        const variants = new Map();
        for (const variant of ['legacy', 'source']) {
            console.log(`floor-shading: ${viewport.width} ${variant}`);
            const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
            const page = await context.newPage(); page.setDefaultTimeout(90000);
            page.on('pageerror', error => report.errors.push({ variant, width: viewport.width, error: error.message }));
            const url = new URL(base); url.searchParams.set('ground', variant);
            const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.goto(String(url), { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !document.querySelector('.authored-status')
                && document.querySelector('[data-growing-world]')?.dataset.growingCamera);
            const capture = async view => {
                await paint();
                await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
                const observed = await page.evaluate(() => {
                    const app = document.querySelector('[data-authored-island]');
                    const world = document.querySelector('[data-growing-world]');
                    return { app: { ...app.dataset }, world: { ...world.dataset },
                        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
                });
                assert.equal(observed.app.buildRevision, expectedBuild);
                assert.equal(observed.app.groundShading, variant);
                assert.equal(observed.world.nativeGrowingArt, 'true');
                assert.equal(observed.world.authoredCoveEnabled, 'true');
                assert.equal(observed.overflow, false);
                const state = canonicalState(JSON.parse(observed.app.authoredState));
                const walking = JSON.parse(observed.world.authoredObstructionWalking);
                assert.equal(state.plots.length + state.landmarks.length, 32);
                assert.equal(walking.ownerAccess.length, 32);
                assert.deepEqual(walking.ownerAccess.filter(owner => !owner.reachable), []);
                const cove = JSON.parse(observed.world.authoredCove); assert.equal(cove.assemblies.length, 1);
                const file = `${viewport.width}-${view}-${variant}.png`;
                await page.screenshot({ path: path.join(output, file), scale: 'css' });
                const entry = { file, url: page.url(), viewport, variant, view, observed,
                    camera: JSON.parse(observed.world.growingCamera), state,
                    serviceWorker: await page.evaluate(async () => ({ controlled: Boolean(navigator.serviceWorker?.controller),
                        registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0 })) };
                report.captures.push(entry); return entry;
            };
            const views = [await capture('whole')];
            if (viewport.width === 1280) {
                await page.getByRole('button', { name: '右へ回す', exact: true }).click();
                views.push(await capture('rotated'));
                await page.locator('[data-owner-id="l14"]').click();
                await page.waitForFunction(() => document.querySelector('[data-growing-world]')?.dataset.growingFocus === 'l14');
                views.push(await capture('hill-close'));
            }
            variants.set(variant, views); await context.close();
        }
        const legacy = variants.get('legacy'), source = variants.get('source');
        assert.equal(legacy.length, source.length);
        for (let i = 0; i < legacy.length; i++) {
            const a = legacy[i], b = source[i];
            assert.deepEqual(a.state, b.state, 'Same ownership, maturity, colors and clocks');
            assert.deepEqual(a.camera, b.camera, 'Same actual camera matrices and framing');
            assert.deepEqual(walkingTopology(a.observed.world.authoredObstructionWalking), walkingTopology(b.observed.world.authoredObstructionWalking),
                'Drawing attributes cannot change physical obstructions or owner approaches');
            assert.equal(a.observed.app.appVersion, b.observed.app.appVersion);
            report.pairs.push({ legacy: a.file, source: b.file, width: viewport.width, view: a.view,
                sameCamera: true, sameState: true, samePhysicalWalking: true, sameAppVersion: true });
        }
    }
    assert.equal(report.captures.length, 10); assert.equal(report.pairs.length, 5);
    assert.deepEqual(report.errors, []);
    report.finalInputs = await inputs(); assert.deepEqual(report.finalInputs, report.initialInputs);
    report.pass = true;
} catch (error) {
    report.error = error.stack ?? String(error); process.exitCode = 1;
} finally {
    await browser?.close();
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ pass: report.pass, captures: report.captures.length, pairs: report.pairs.length, error: report.error, output }));
