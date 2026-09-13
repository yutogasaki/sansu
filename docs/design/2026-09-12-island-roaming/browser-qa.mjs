import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.SANSU_ISLAND_LIFE_URL;
const out = process.env.SANSU_ISLAND_LIFE_OUTPUT;
assert(base && out, 'Specify target and fresh output directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, humanN: 0, scenarios: [] };
try {
 for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet', { width: 768, height: 1024 }, 'reduce']]) {
    const context = await browser.newContext({ viewport, reducedMotion, recordVideo: { dir: out, size: viewport } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
    await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
    await page.getByRole('button', { name: 'さんすう', exact: true }).click();
    await page.getByRole('button', { name: '足し算まで', exact: true }).click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    const candidate = await page.locator('[data-life-candidate]').getAttribute('data-life-candidate');
    const samples = [], walkers = new Set();
    let maximumJump = 0, maximumSpeed = 0;
    const observingAt = Date.now();
    for (let second = 0; Date.now() - observingAt <= 60_000; second++) {
        const poses = await page.locator('.life-world').evaluate(e => JSON.parse(e.dataset.lifePoses || '[]'));
        assert.equal(poses.length, 3);
        const walking = poses.filter(p => p.phase === 'walking');
        assert(walking.length <= 1, 'One free walker at a time');
        walking.forEach(p => walkers.add(p.id));
        const sampledAt = Date.now(), last = samples.at(-1);
        if (last) for (let i = 0; i < 3; i++) {
            const jump = Math.hypot(poses[i].position[0] - last.poses[i].position[0], poses[i].position[2] - last.poses[i].position[2]);
            maximumJump = Math.max(maximumJump, jump);
            maximumSpeed = Math.max(maximumSpeed, jump / ((sampledAt - last.sampledAt) / 1000));
        }
        if (reducedMotion === 'reduce') assert(poses.every(p => p.hop === 0));
        samples.push({ second, sampledAt, poses });
        if (second % 15 === 0) await page.screenshot({ path: `${out}/${name}-${second}.png` });
        if (second < 60) await page.waitForTimeout(1000);
    }
    assert.equal(walkers.size, 3, 'All three residents walk within one minute');
    assert(maximumSpeed < 2.5, `No periodic reset/teleport: ${maximumSpeed} units/sec`);
    assert.equal(await page.locator('[data-life-light]').getAttribute('data-life-light'), '0');
    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), '0');
    await writeFile(`${out}/${name}-samples.json`, JSON.stringify({ candidate, samples, walkers: [...walkers], maximumJump }, null, 2));
    await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
    await page.locator('.life-residents').waitFor();
    assert.equal(await page.locator('[data-life-resident]').count(), 3);
    await page.screenshot({ path: `${out}/${name}-status.png` });
    await page.getByRole('button', { name: 'しまの ようすを とじる', exact: true }).click();
    await page.reload();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    assert.equal(await page.locator('.life-world').count(), 0);
    await page.screenshot({ path: `${out}/${name}-learning.png` });
    assert.deepEqual(errors, []);
    report.scenarios.push({ name, candidate, reducedMotion, walkers: [...walkers], maximumJump, maximumSpeed, samples, pass: true });
    await context.close();
    console.log(`${name}: PASS, three walkers, max step ${maximumJump.toFixed(3)}`);
 }
 report.pass = true;
} finally {
 await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
 await browser.close();
}
