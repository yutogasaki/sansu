import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { activate, button, readNative, runtimeMetadata, waitMode, waitReady } from './island-e2e-helpers.mjs';
import { attempt, assertControls, assertProblemMeaning } from './island-learning-checks.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL;
const sourcePath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_PATCHWORK_OUTPUT;
assert(base && sourcePath && out, 'Set the frozen production target, build source and fresh output directory');
const source = JSON.parse(await fs.readFile(sourcePath));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = async () => Promise.all(source.files.map(async file => ({ path: file.path, sha256: sha(await fs.readFile(file.path)) })));
const start = await fingerprint(); assert.deepEqual(start, source.files);
const qaFiles = ['tools/e2e-island-patchwork.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const qaFingerprint = async () => Promise.all(qaFiles.map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const qaStart = await qaFingerprint();
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const manifest = await (await fetch(`${base}/version.json`)).json();
assert.equal(manifest.revision, source.revision); assert.equal(manifest.island.residentCandidate, 'patchwork-otter-v1');
const report = { target: base, manifest, sourceHash: source.sourceHash, startedAt: new Date().toISOString(),
    scope: 'Empty database and actual onboarding, answers, earned bench, furniture play, learning return, reload and explicit WebGL-loss diagnostic. No island/learning fixtures or renderer pose injection. Author evidence; human N=0.',
    qaStart, captures: [], scenarios: [], pass: false };
const browser = await chromium.launch();
const scene = page => page.locator('[data-testid="island-stage"]').evaluate(node => {
    const d = node.dataset;
    return { residentCandidate: d.residentCandidate, canvasCandidate: node.querySelector('canvas')?.dataset.residentCandidate,
        residents: JSON.parse(d.residentStates ?? '[]'), textures: Number(d.textures), geometries: Number(d.geometries),
        calls: Number(d.drawCalls), triangles: Number(d.triangles), camera: d.cameraFrame, status: d.playStatus };
});
async function capture(page, name) {
    const metadata = await runtimeMetadata(page), state = await scene(page);
    assert.equal(metadata.revision, manifest.revision); assert.equal(metadata.version, manifest.version);
    assert.equal(state.residentCandidate, manifest.island.residentCandidate);
    assert.equal(state.canvasCandidate, state.residentCandidate);
    const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: sha(bytes), ...metadata, ...state });
}
try {
    for (const layout of [{ name: 'phone', width: 390, height: 844, touch: true }, { name: 'tablet', width: 768, height: 1024, touch: false }]) {
        const context = await browser.newContext({ viewport: layout, hasTouch: layout.touch,
            reducedMotion: layout.touch ? 'no-preference' : 'reduce' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(15000);
        const row = { layout, checks: [], errors, poses: [] }; report.scenarios.push(row);
        try {
            await page.goto(`${base}/#/island`); await page.waitForURL('**/#/onboarding'); await waitReady(page);
            await capture(page, `${layout.name}-01-welcome`);
            await activate(button(page, 'まなぶ'), layout.touch);
            await activate(button(page, '年中'), layout.touch);
            await activate(button(page, 'さんすう'), layout.touch);
            await activate(page.getByRole('button', { name: /数をかぞえる・くらべる/ }), layout.touch);
            await waitMode(page, 'learning'); await waitReady(page);
            let state = await readNative(page); const id = state.island.profileId;
            await assertControls(page); await assertProblemMeaning(page, state.plan.slots[state.plan.cursor]);
            await capture(page, `${layout.name}-02-learning`);
            state = (await attempt(page, state, { wrong: true, touch: layout.touch })).after;
            await capture(page, `${layout.name}-03-retry`);
            const firstPlan = state.plan.id;
            while (state.plan.id === firstPlan) state = (await attempt(page, state, { touch: layout.touch })).after;
            assert.equal(state.island.completedSets, 1); assert.equal(state.plan.cursor, 0);
            await capture(page, `${layout.name}-04-next-section`);
            const reserved = state.plan;
            await activate(button(page, 'しまへ'), layout.touch); await waitMode(page, 'home');
            await capture(page, `${layout.name}-05-home`);
            await activate(button(page, 'どうぶつと あそぶ'), layout.touch); await waitMode(page, 'play');
            const bench = page.getByRole('button', { name: /ベンチ \d+で あそぶ/ });
            await activate(bench, layout.touch);
            if (layout.touch) {
                await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]').dataset.residentStates)
                    .some(resident => resident.species === 'otter' && resident.action === 'walk'));
                await capture(page, `${layout.name}-06-walking`);
            }
            await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="island-stage"]').dataset.residentStates)
                .some(resident => resident.species === 'otter' && resident.action === 'sit' && resident.usePhase === 1));
            await capture(page, `${layout.name}-07-seated`);
            row.poses.push(await scene(page));
            const resources = await scene(page);
            await activate(bench, layout.touch);
            await page.waitForFunction(() => Number(document.querySelector('[data-testid="island-stage"]').dataset.residentUsePhase) === 1);
            const replay = await scene(page);
            assert.equal(replay.textures, resources.textures); assert.equal(replay.geometries, resources.geometries);
            assert.deepEqual((await readNative(page, id)).plan, reserved);
            await activate(button(page, 'ひかりを とどける'), layout.touch); await waitMode(page, 'learning');
            await assertControls(page); await capture(page, `${layout.name}-08-seated-learning`);
            for (const resident of (await scene(page)).residents) {
                assert(resident.frameBounds.left >= -1 && resident.frameBounds.right <= 1);
                assert(resident.frameBounds.top <= 1 && resident.frameBounds.bottom >= -1);
            }
            state = await readNative(page, id); await attempt(page, state, { touch: layout.touch });
            const beforeReload = (await readNative(page, id)).plan;
            await page.reload(); await waitReady(page); await waitMode(page, 'learning');
            assert.deepEqual((await readNative(page, id)).plan, beforeReload);
            await capture(page, `${layout.name}-09-reload`);
            await page.locator('[data-testid="island-stage"] canvas').evaluate(canvas => {
                const gl = canvas.getContext('webgl2'); if (!gl) throw new Error('Missing WebGL2 context');
                gl.getExtension('WEBGL_lose_context').loseContext();
            });
            await button(page, 'もういちど みる').click(); await waitReady(page);
            assert.deepEqual((await readNative(page, id)).plan, beforeReload);
            await capture(page, `${layout.name}-10-restored`);
            row.checks.push('same rendered resident identity in all views', 'wrong/correct and zero-action section continuation',
                'earned bench, otter sit and replay', 'unchanged learning reservation during play', 'learning crop contains all residents',
                'reload and explicit WebGL recovery preserve plan and restore fabric', 'two cached fabric textures do not multiply on replay');
            assert.deepEqual(errors, []);
        } catch (error) {
            row.error = error.stack;
            await page.screenshot({ path: `${out}/${layout.name}-failure.png` });
            throw error;
        } finally { await context.close(); }
    }
    assert.deepEqual(await fingerprint(), start); assert.deepEqual(await qaFingerprint(), qaStart); report.pass = true;
} finally {
    await browser.close(); report.completedAt = new Date().toISOString();
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
