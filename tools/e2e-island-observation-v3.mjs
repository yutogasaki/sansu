import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const candidate = process.env.SANSU_DISCOVERY_CANDIDATE ?? 'island-life-discovery-a-gatherings-v1';
const base = process.env.SANSU_DISCOVERY_DEV_URL ?? 'http://127.0.0.1:5223';
const out = process.env.SANSU_DISCOVERY_OUTPUT;
assert(out, 'Specify a fresh SANSU_DISCOVERY_OUTPUT directory');
await mkdir(out, { recursive: false });
const sourceHash = async () => {
    const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    const hash = createHash('sha256');
    for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0');
    return hash.digest('hex');
};
const startHash = await sourceHash();
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidate, target: base, flag: 'VITE_ISLAND_LIFE_PREVIEW=true; DEV', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        try {
            await page.goto(base);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
            await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
            await page.getByRole('button', { name: 'さんすう', exact: true }).click();
            await page.getByRole('button', { name: '足し算まで', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            let native = await readNative(page);
            for (let i = 0; i < 3; i++) native = (await attempt(page, native)).after;
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
            await page.waitForFunction(() => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) >= 6);
            const read = () => page.evaluate(async () => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV preview required');
                const record = (await lifeDb.worlds.toArray())[0]; return { record, state: replayLife(record) };
            });
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.locator('[data-life-buy="flower"]').click();
            await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
            for (let n = 0; n < 2; n++) await page.getByRole('button', { name: 'つぎの マス', exact: true }).click();
            await page.locator('[data-life-cell="0,2"]').click();
            await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
            await page.locator('.life-placement').waitFor({ state: 'hidden' });
            const open = async () => {
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                await page.locator('[data-life-item]').first().click();
                await page.getByRole('button', { name: 'みてみる', exact: true }).click();
                await page.locator('.life-observation-view[data-rendered="true"]').waitFor();
            };
            await open();
            const before = await read(), learningBefore = await readNative(page);
            assert.equal(before.state.items.length, 1); assert.equal(before.state.drops, 4);
            assert.equal(before.record.discoveryJournal, undefined);
            await page.screenshot({ path: `${out}/${name}-ready.png` });
            // A real WebGL context loss before one second cancels the episode.
            await page.getByRole('button', { name: 'おはなに ふれる', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.life-observation-view')?.hasAttribute('data-magic'));
            await page.locator('.life-observation-view canvas').evaluate(canvas => {
                canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
            });
            await page.getByText('景色をひらけなかったよ。とじて、もういちど ためしてね。', { exact: true }).waitFor();
            assert.equal((await read()).record.discoveryJournal, undefined);
            await page.getByRole('button', { name: 'みてみるを とじる', exact: true }).click();
            await open();
            const view = page.getByRole('button', { name: 'おはなに ふれる', exact: true });
            await view.click();
            await page.waitForFunction(() => Number(document.querySelector('.life-observation-view')?.dataset.magicElapsed) >= 800);
            await page.screenshot({ path: `${out}/${name}-leaves.png` });
            for (let i = 0; i < 6; i++) await view.click();
            await page.getByRole('button', { name: 'のこす', exact: true }).waitFor();
            const shown = await read();
            assert.equal(shown.record.discoveryJournal.firstPresented.length, 1);
            assert.equal(shown.record.discoveryJournal.savedIds.length, 0);
            assert.equal(shown.record.discoveryJournal.entries[0].event.source, 'current-context-test');
            assert.deepEqual(shown.record.credits, before.record.credits); assert.deepEqual(shown.record.actions, before.record.actions);
            assert.equal(shown.state.drops, before.state.drops);
            await page.getByRole('button', { name: 'のこす', exact: true }).click();
            await page.getByRole('button', { name: 'のこした', exact: true }).waitFor();
            const saved = await read(); assert.equal(saved.record.discoveryJournal.savedIds.length, 1);
            await page.screenshot({ path: `${out}/${name}-saved.png` });
            await page.waitForFunction(() => !document.querySelector('.life-observation-view')?.hasAttribute('data-magic'));
            await page.waitForTimeout(550);
            // Exiting immediately must not force viewing or manufacture another presented event.
            await view.click();
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            assert.equal(await page.locator('.life-observation').count(), 0);
            await page.screenshot({ path: `${out}/${name}-learning.png` });
            await page.getByRole('button', { name: 'とじる', exact: true }).click();
            await page.locator('.life-world[data-rendered="true"]').waitFor();
            assert.equal((await read()).record.discoveryJournal.savedIds.length, 1);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            assert.deepEqual((await read()).record.discoveryJournal.savedIds, saved.record.discoveryJournal.savedIds);
            // The learning session is merely resumed, with no answer added by magic.
            const learningAfter = await readNative(page);
            assert.deepEqual(learningAfter.logs, learningBefore.logs);
            assert.deepEqual(learningAfter.memoryMath, learningBefore.memoryMath);
            assert.deepEqual(learningAfter.memoryVocab, learningBefore.memoryVocab);
            // Explicit DEV clock fixture checks bloom rendering; it is not earned growth evidence.
            await page.evaluate(async () => {
                const { lifeDb, updateLife } = await import('/src/domain/islandLife/repository.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV preview required');
                const record = (await lifeDb.worlds.toArray())[0];
                await updateLife(record.profileId, [], { id: 'qa-bloom-clock', revision: record.revision, advanceHours: 24 });
            });
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            assert.equal((await read()).state.items[0].growth, 6);
            await open(); await page.getByRole('button', { name: 'おはなに ふれる', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.life-observation-view')?.dataset.magic === 'petals'
                && Number(document.querySelector('.life-observation-view')?.dataset.magicElapsed) >= 800);
            await page.screenshot({ path: `${out}/${name}-petals.png` });
            await page.getByRole('button', { name: 'のこす', exact: true }).waitFor();
            assert.equal((await read()).record.discoveryJournal.savedIds.length, 1);
            assert.equal(errors.length, 0, errors.join('\n'));
            report.scenarios.push({ name, pass: true, actualProblems: 3, reducedMotion: name === 'tablet', saved: 1, bloomSource: 'explicit DEV 24h clock', contextLoss: true, repeatedTaps: 6, errors });
        } catch (e) { await page.screenshot({ path: `${out}/${name}-failure.png` }); report.scenarios.push({ name, pass: false, error: e.stack, errors }); throw e; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.endHash, startHash);
    report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
