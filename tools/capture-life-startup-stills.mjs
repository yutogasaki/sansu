// Capture existing runtime thumbnails before replacing their generation with baked images.
// Run against the unmodified source renderer; refuses an already baked image.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const target = process.env.SANSU_STILL_SOURCE_URL || 'https://sansu-seven.vercel.app/';
const out = 'docs/design/2026-09-19-life-startup-stills';
await mkdir(`${out}/source`, { recursive: true });
const version = await (await fetch(new URL('version.json', target))).json();
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(target);
    for (const name of ['まなぶ', '小学 1 年生', 'さんすう', '足し算まで']) await page.getByRole('button', { name, exact: true }).first().click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    const images = [];
    for (const [name, selector] of [['flower-bloom-original', '.life-build-action .life-product-preview img'], ['pokomoko-original', '.life-home-action .life-resident-portrait img']]) {
        await page.locator(selector).waitFor({ state: 'visible' });
        const image = await page.locator(selector).evaluate(img => ({ src: img.src, width: img.naturalWidth, height: img.naturalHeight }));
        assert(image.src.startsWith('data:image/png;base64,'), 'Source already baked; use the pre-optimization renderer');
        const bytes = Buffer.from(image.src.split(',')[1], 'base64');
        await writeFile(`${out}/source/${name}.png`, bytes, { flag: 'wx' });
        images.push({ name, width: image.width, height: image.height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    await page.screenshot({ path: `${out}/before.png` });
    const after = await (await fetch(new URL('version.json', target))).json();
    assert.equal(after.revision, version.revision);
    await writeFile(`${out}/capture.json`, JSON.stringify({ target, version, images, method: 'Exact PNG bytes from existing runtime img.src; no image editing or regeneration' }, null, 2) + '\n');
    console.log(JSON.stringify(images));
    await context.close();
} finally { await browser.close(); }
