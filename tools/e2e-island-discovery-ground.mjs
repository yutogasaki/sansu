import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { seedDev, readNative } from './island-e2e-helpers.mjs';

const candidate = process.env.SANSU_DISCOVERY_CANDIDATE ?? 'island-life-economy-checkpoint-v3';
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
const report = { startHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), flags: 'VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV', cache: 'fresh browser context; DEV; no production SW claim', target: base, source: 'explicit DEV ownership fixture; no earned acquisition claim', humanN: 0, scenarios: [], pass: false };
const browser = await chromium.launch();
try {
    for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: name === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(base);
            const profileId = await seedDev(page, { familiar: false });
            await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                const { commandLife } = await import('/src/domain/islandLife/simulation.ts');
                assertPreview(lifeDb.name);
                function assertPreview(name) { if (name !== 'SansuIslandLifePreviewV1') throw new Error('DEV preview required'); }
                const at = Date.now(); let record = newLife(profileId, at);
                record.credits = Array.from({ length: 3 }, (_, i) => ({ id: `explicit-qa-credit-${i}`, at, day: learningDay(at) }));
                for (let x = 0; x < 3; x++) record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x, z: 2 } }, `qa-flower-${x}`, at);
                await lifeDb.worlds.put(record);
            }, profileId);
            await page.reload();
            await page.locator(`[data-life-candidate="${candidate}"] .life-world[data-rendered="true"]`).waitFor();
            const before = await readNative(page, profileId);
            await page.screenshot({ path: `${out}/${name}-joined.png` });
            const move = async (x, z) => {
                await page.getByRole('button', { name: 'つくる', exact: true }).click();
                await page.getByRole('group', { name: 'しまの ていれ' }).getByRole('button', { name: 'もちもの', exact: true }).click();
                while (!await page.locator('[data-life-item="qa-flower-2"]').count()) await page.getByRole('button', { name: 'つぎの ページ', exact: true }).click();
                await page.locator('[data-life-item="qa-flower-2"]').click();
                await page.getByRole('button', { name: 'うごかす', exact: true }).click();
                await page.getByRole('button', { name: 'マスから えらぶ', exact: true }).click();
                for (let attempt = 0; attempt < 10 && !await page.locator(`[data-life-cell="${x},${z}"]`).count(); attempt++) {
                    const targetPage = z, current = Number((await page.locator('.life-cell-picker .life-pager span').innerText()).split('/')[0]) - 1;
                    await page.getByRole('button', { name: current < targetPage ? 'つぎの マス' : 'まえの マス', exact: true }).click();
                }
                await page.locator(`[data-life-cell="${x},${z}"]`).click();
                await page.getByRole('button', { name: 'ここに おく', exact: true }).click();
                await page.locator('.life-placement').waitFor({ state: 'hidden' });
                await page.locator('.life-world[data-rendered="true"]').waitFor();
            };
            await move(5, 3);
            await page.screenshot({ path: `${out}/${name}-split.png` });
            await move(2, 2);
            await page.screenshot({ path: `${out}/${name}-restored.png` });
            const saved = await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const { evaluateDiscovery } = await import('/src/domain/islandLife/discovery.ts');
                const record = await lifeDb.worlds.get(profileId), state = replayLife(record);
                return { state, rules: evaluateDiscovery(state, profileId), journal: record.discoveryJournal };
            }, profileId);
            assert.equal(saved.state.drops, 0); assert.equal(saved.state.items.length, 3);
            assert(saved.state.items.every(item => item.paidDrops === 2));
            assert(saved.rules.some(rule => rule.ruleId === 'G0'));
            assert(!saved.rules.some(rule => rule.ruleId === 'GF3')); assert((saved.journal?.firstPresented ?? []).every(first => first.ruleId === 'G0')); // Live soil evidence is allowed; mature achievements are not.
            assert.deepEqual(await readNative(page, profileId), before);
            await page.reload(); await page.locator('.life-world[data-rendered="true"]').waitFor();
            await page.screenshot({ path: `${out}/${name}-reload.png` });
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor();
            await page.screenshot({ path: `${out}/${name}-learning.png` });
            assert.equal(errors.length, 0, errors.join('\n'));
            report.scenarios.push({ name, viewport, pass: true, candidate, reducedMotion: name === 'tablet', errors });
        } catch (error) {
            await page.screenshot({ path: `${out}/${name}-failure.png` });
            report.scenarios.push({ name, pass: false, error: error.stack, errors }); throw error;
        } finally { await context.close(); }
    }
    report.endHash = await sourceHash();
    assert.equal(report.endHash, startHash, 'Application source changed during capture');
    report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
