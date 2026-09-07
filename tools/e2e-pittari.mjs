import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const base = process.env.SANSU_PITTARI_BASE_URL || 'http://127.0.0.1:5197';
const out = 'output/pittari/verification';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: `${base}/prototypes/pittari/`, candidate: 'pittari-positive-v1', delivery: 'standalone-prototype',
    build: JSON.parse(await readFile('output/pittari/build.json', 'utf8')), checks: [], boards: [] };
const errors = [];
const key = 'sansu:pittari:positive-v1';
const tile = (page, c) => page.locator(`button.tile[data-column="${c}"]`);
const settled = page => page.waitForFunction(() => document.querySelector('#board')?.dataset.busy === 'false');
async function choose(page, id) {
    await page.locator('details').evaluate(el => { el.open = true; });
    await page.locator('#board-select').selectOption(id);
    await page.locator('details').evaluate(el => { el.open = false; });
    await page.evaluate(() => window.scrollTo(0, 0));
}
async function move(page, pair, wait = true) {
    await tile(page, pair).click(); await tile(page, pair + 1).click();
    if (wait) await settled(page);
}
const boardValues = page => page.locator('.column').evaluateAll(columns => columns.map(c => [...c.querySelectorAll('.number')].map(n => Number(n.textContent))));
const capture = (page, name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
function observe(page) { page.on('pageerror', error => errors.push(error.message)); }

try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
    const page = await context.newPage(); observe(page);
    await page.goto(report.target); await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.setItem('sansu-existing-data-sentinel', 'keep'));
    const databasesBefore = await page.evaluate(() => indexedDB.databases());
    await capture(page, 'phone-launch');
    // Inspect all reachable states through the same domain code, then use real UI clicks for each win.
    report.boards = await page.evaluate(async () => {
        const { boards } = await import('/src/prototypes/pittari/boards.ts');
        const { inspect } = await import('/src/prototypes/pittari/engine.ts');
        return boards.map(board => ({ id: board.id, ...inspect(board) }));
    });
    for (const board of report.boards) {
        await choose(page, board.id);
        const path = [...board.wins].sort((a, b) => a.length - b.length)[0];
        for (const pair of path) await move(page, pair);
        assert.equal(await page.locator('#board').getAttribute('data-won'), 'true', board.id);
    }
    report.checks.push('All 12 boards achieved through real button clicks');
    await choose(page, '10-3'); await capture(page, 'phone-comparison-ready');
    await move(page, 1); assert.equal(await page.locator('#chain').textContent(), '1 れんさ');
    assert.equal(await page.locator('#board').getAttribute('data-won'), 'false');
    await capture(page, 'phone-right-one');
    await page.locator('#undo').click();
    assert.deepEqual(await boardValues(page), [[7, 4], [3, 6], [7, 2]]);
    await capture(page, 'phone-undone');
    await move(page, 0); assert.equal(await page.locator('#chain').textContent(), '2 れんさ');
    await capture(page, 'phone-left-two');
    report.checks.push('Right 1 chain → undo → left 2 chains; short chain is valid');
    await page.reload(); await settled(page);
    assert.equal(await page.locator('#chain').textContent(), '2 れんさ');
    await page.locator('#undo').click(); assert.deepEqual(await boardValues(page), [[7, 4], [3, 6], [7, 2]]);
    await move(page, 0, false); await page.reload(); await settled(page);
    assert.equal(await page.locator('#board').getAttribute('data-won'), 'true');
    report.checks.push('Reload persists completed move and undo; mid-chain reload resumes whole resolved move');
    await page.locator('#next').click(); await capture(page, 'phone-next-mirrored');
    await page.locator('#end').click(); await capture(page, 'phone-ended');
    await page.reload(); assert.equal(await page.locator('#pause').isVisible(), true);
    await page.locator('#resume').click(); await capture(page, 'phone-resumed');
    await move(page, 1); assert.equal(await page.locator('#board').getAttribute('data-won'), 'true');
    report.checks.push('End/reload/resume and mirrored right advantage');
    await choose(page, '5-1');
    const before = await boardValues(page);
    await move(page, 1); assert.deepEqual(await boardValues(page), before);
    assert.match(await page.locator('#message').textContent(), /4 と 2 は 6/);
    await tile(page, 0).click(); await tile(page, 2).click();
    assert.match(await page.locator('#message').textContent(), /となりどうし/);
    assert.deepEqual(await boardValues(page), before);
    report.checks.push('Wrong sum and nonadjacent selection never clear blocks');
    await choose(page, '10-5'); await capture(page, 'phone-three-ready');
    await move(page, 0, false); await choose(page, '5-1');
    await page.waitForTimeout(2700);
    assert.deepEqual(await boardValues(page), [[1], [4], [2]]);
    await choose(page, '10-5'); await move(page, 0, false); await page.locator('#undo').click();
    await page.waitForTimeout(2700);
    assert.deepEqual(await boardValues(page), [[2, 1, 5], [8, 9, 5], [2]]);
    report.checks.push('Board change and undo during cascade cancel stale animation');
    await choose(page, '10-6'); await move(page, 0);
    assert.equal(await page.locator('#board').getAttribute('data-won'), 'false');
    await capture(page, 'phone-four-next-manual'); await move(page, 2);
    assert.deepEqual(await boardValues(page), [[], [], [], []]);
    await page.locator('#undo').click(); await page.locator('#dots').click();
    await move(page, 2);
    await page.locator('details').evaluate(el => { el.open = true; });
    const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await downloadPromise; await download.saveAs(`${out}/observation.json`);
    const log = JSON.parse(await readFile(`${out}/observation.json`, 'utf8'));
    assert.equal(log.affectsSrs, false);
    assert.ok(log.events.some(e => e.event === 'manual_pair' && !e.dots && e.afterUndo));
    assert.ok(log.events.some(e => e.event === 'automatic_clear'));
    assert.equal(log.events[0].event, 'reload_resume');
    assert.equal(await page.evaluate(() => localStorage.getItem('sansu-existing-data-sentinel')), 'keep');
    assert.deepEqual(await page.evaluate(() => indexedDB.databases()), databasesBefore);
    report.checks.push('Four columns require another manual move; JSON separates manual/auto/dots/undo/reload; unrelated storage retained and no IndexedDB created');
    await context.close();
    for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
        const ctx = await browser.newContext({ viewport, reducedMotion: viewport.width === 768 ? 'reduce' : 'no-preference' });
        const p = await ctx.newPage(); observe(p); await p.goto(report.target);
        for (const id of ['10-3', '10-5', '10-6']) {
            await choose(p, id);
            assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const boxes = await p.locator('button.tile').evaluateAll(els => els.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
            assert.ok(boxes.every(box => box.width >= 48 && box.height >= 48));
            await capture(p, `${viewport.width}-${id}-ready`);
        }
        if (viewport.width === 768) {
            await move(p, 2); await capture(p, 'tablet-reduced-next-manual');
            await move(p, 0); assert.equal(await p.locator('#board').getAttribute('data-won'), 'true');
            await capture(p, 'tablet-reduced-complete');
        }
        await ctx.close();
    }
    report.checks.push('320/390/768/1280 widths: no horizontal overflow, tiles ≥48px; reduced-motion flow completes silently');
    for (const mode of ['unavailable', 'corrupt']) {
        const ctx = await browser.newContext();
        if (mode === 'unavailable') await ctx.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
        else await ctx.addInitScript(key => localStorage.setItem(key, '{broken'), key);
        const p = await ctx.newPage(); observe(p); await p.goto(report.target);
        assert.equal(await p.locator('#storage-warning').isVisible(), true);
        await move(p, 0); assert.equal(await p.locator('#board').getAttribute('data-won'), 'true');
        await ctx.close();
    }
    report.checks.push('Unavailable and corrupt storage show notice and allow play');
    const fileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const file = await fileContext.newPage(); observe(file);
    const externalRequests = [];
    file.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
    await file.goto(pathToFileURL(resolve('output/pittari/pittari_chain.html')).href);
    await choose(file, '10-3'); await move(file, 1); await file.locator('#undo').click(); await move(file, 0);
    await file.reload(); await settled(file);
    assert.equal(await file.locator('#chain').textContent(), '2 れんさ');
    assert.equal(await file.locator('main').getAttribute('data-build-revision'), report.build.revision);
    assert.deepEqual(externalRequests, []);
    await capture(file, 'single-html-file-reloaded'); await fileContext.close();
    report.checks.push('Bundled HTML opens via file URL, comparison and reload work in Chromium, no external HTTP requests');
    assert.deepEqual(errors, []);
    report.pass = true;
} catch (error) { report.pass = false; report.failure = error.stack; process.exitCode = 1; }
finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ pass: report.pass, checks: report.checks, failure: report.failure }, null, 2));
