import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { activate, answerUI, assertKeypad, button, readNative, runtimeMetadata, seedNative, waitMode, waitReady } from './island-e2e-helpers.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5399';
const output = process.env.SANSU_EXPERIENCE_OUTPUT || 'output/playwright/island-experience';
const baseline = process.env.SANSU_EXPERIENCE_BASELINE === 'true';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = { target, baseline, startedAt: new Date().toISOString(), captures: [], scenarios: [], pass: false,
    scope: 'Real UI: one earned gift, placement rotation/cancel, bench sitting, lantern invitation, return to learning. Screens require separate visual review; this is not child observation or complete release verification.' };

const scene = page => page.locator('[data-testid="island-stage"]').evaluate(stage => ({
    preview: stage.dataset.previewState ? JSON.parse(stage.dataset.previewState) : null,
    residents: stage.dataset.residentStates ? JSON.parse(stage.dataset.residentStates) : [],
    camera: stage.dataset.cameraFrame,
    previewValid: stage.dataset.previewValid,
}));
async function capture(page, name, row) {
    await page.evaluate(() => document.fonts.ready);
    const identity = await runtimeMetadata(page);
    assert.equal(identity.version, report.manifest.version);
    assert.equal(identity.revision, report.manifest.revision);
    assert.equal(identity.candidate, report.manifest.island.candidate);
    const file = `${row.name}-${name}.png`;
    const buffer = await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
    report.captures.push({ file, sha256: createHash('sha256').update(buffer).digest('hex'), ...identity, scene: await scene(page) });
}
async function settled(page, itemId) {
    await page.waitForFunction(id => {
        const values = document.querySelector('[data-testid="island-stage"]')?.dataset.residentStates;
        return values && JSON.parse(values).some(resident => resident.itemId === id && resident.action !== 'walk' && resident.usePhase >= 1);
    }, itemId, { timeout: 20000 });
}

try {
    for (const layout of [
        { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
        { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: false },
    ]) {
        const context = await browser.newContext({ viewport: layout.viewport, hasTouch: layout.touch, serviceWorkers: 'block' });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const row = { ...layout, answers: [], errors: [], pass: false };
        report.scenarios.push(row);
        page.on('pageerror', error => row.errors.push(error.message));
        try {
            await page.goto(`${target}/#/island`);
            await page.waitForURL('**/#/onboarding');
            await waitReady(page);
            const manifest = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json());
            assert(manifest.island.enabled && !manifest.revision.includes('development'));
            if (report.manifest) assert.deepEqual(manifest, report.manifest); else report.manifest = manifest;
            const id = await seedNative(page, `experience-${layout.name}`);
            await page.goto(`${target}/#/island`);
            await waitReady(page); await waitMode(page, 'home');
            await capture(page, 'home', row);
            await activate(page.locator('.island-start'), row.touch);
            await waitMode(page, 'learning'); await assertKeypad(page);
            await capture(page, 'learning', row);
            let state = await readNative(page, id);
            const reservationId = state.plan.id;
            while (state.plan?.id === reservationId) {
                assert(row.answers.length < 12);
                const answer = await answerUI(page, state.plan, { dev: false, touch: row.touch });
                state = answer.state;
                row.answers.push({ ms: answer.ms, beforeRevision: answer.beforeRevision, afterRevision: answer.afterRevision });
            }
            assert.equal(state.islandPlans.find(plan => plan.id === reservationId)?.status, 'completed');
            await waitMode(page, 'reward');
            const rewardId = state.island.pendingRewards[0].id;
            await capture(page, 'reward', row);
            await activate(button(page, 'ベンチ'), row.touch);
            await waitMode(page, 'placement');
            const itemId = `${rewardId}:item`;
            await page.waitForFunction(id => {
                const value = document.querySelector('[data-testid="island-stage"]')?.dataset.previewState;
                return value && JSON.parse(value)?.id === id;
            }, itemId);
            const beforePreview = await readNative(page, id);
            await capture(page, 'placement', row);
            await activate(button(page, 'まわす'), row.touch);
            await capture(page, 'placement-rotated', row);
            assert.deepEqual((await readNative(page, id)).island, beforePreview.island, 'Preview rotation must not persist');
            await activate(button(page, 'いどうを やめる'), row.touch);
            await waitMode(page, 'home');
            assert.deepEqual((await readNative(page, id)).island, beforePreview.island, 'Cancel must not move possessions');
            await activate(button(page, 'もちもの'), row.touch);
            await waitMode(page, 'inventory');
            await activate(page.getByRole('button', { name: /^ベンチ \d+を うごかす$/ }), row.touch);
            await waitMode(page, 'placement');
            await activate(button(page, 'まわす'), row.touch);
            await activate(button(page, 'ここに おく'), row.touch);
            await waitMode(page, 'home'); await settled(page, itemId);
            await capture(page, 'bench-used', row);
            await activate(button(page, 'どうぶつと あそぶ'), row.touch);
            await waitMode(page, 'play');
            const choices = await page.locator('.island-play .island-inventory').boundingBox();
            const returnButton = button(page, 'ひかりを とどける');
            const returnBox = await returnButton.boundingBox();
            row.playChoiceBeforeLearningReturn = Boolean(choices && returnBox && choices.y + choices.height <= returnBox.y + 1);
            row.returnIsSecondary = !(await returnButton.getAttribute('class'))?.includes('island-primary');
            if (!baseline) {
                assert(row.playChoiceBeforeLearningReturn, 'Furniture choices precede returning to learning');
                assert(row.returnIsSecondary, 'Returning to learning is not the dominant play action');
            }
            const savedBeforePlay = await readNative(page, id);
            await capture(page, 'play', row);
            await activate(page.getByRole('button', { name: /^ほしあかり \d+で あそぶ$/ }), row.touch);
            await settled(page, 'starter-lantern');
            await capture(page, 'lantern-used', row);
            assert.deepEqual(await readNative(page, id), savedBeforePlay, 'Free play does not manufacture saved learning or rewards');
            await activate(returnButton, row.touch);
            await waitMode(page, 'learning'); await assertKeypad(page);
            await capture(page, 'return-learning', row);
            row.returnScene = await scene(page);
            if (!baseline) for (const resident of row.returnScene.residents) {
                const bounds = resident.frameBounds;
                assert(bounds && bounds.left >= -1 && bounds.right <= 1 && bounds.bottom >= -1 && bounds.top <= 1,
                    `The complete ${resident.species} fits after free play: ${JSON.stringify(bounds)}`);
            }
            const firstFrame = row.returnScene.camera;
            state = await readNative(page, id);
            const answer = await answerUI(page, state.plan, { dev: false, touch: row.touch });
            assert.equal((await scene(page)).camera, firstFrame, 'The learning camera does not chase reactions between questions');
            assert.equal(answer.state.plan.cursor, 1);
            await capture(page, 'return-next-answer', row);
            assert.deepEqual(row.errors, []);
            row.pass = true;
            console.log(`PASS ${row.name}: actual placement/play/learning path; visual review required`);
        } finally { await context.close(); }
    }
    report.pass = true;
} finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
}
