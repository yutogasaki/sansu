import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SANSU_TOWN_URL || 'http://127.0.0.1:5341';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local Vite only');
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.goto(base);
    const images = await page.evaluate(async () => (await import('/tools/nature-town-pose-source.ts')).bakeTownPoses());
    await mkdir('src/assets/natureTown', { recursive: true });
    for (const [name, data] of Object.entries(images)) await writeFile(`src/assets/natureTown/town-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`Baked ${Object.keys(images).length} full-body stills`);
} finally { await browser.close(); }
