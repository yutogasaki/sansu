import { chromium } from 'playwright';
import { Matrix4, Vector3 } from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const base = process.env.SANSU_ISLAND_LIFE_URL, out = process.env.SANSU_ISLAND_LIFE_OUTPUT;
assert(base && out, 'Specify the DEV island life target and fresh output directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { target: base, flag: 'DEV + VITE_ISLAND_LIFE_PREVIEW=true', candidate: 'runtime attributes in screenshots', humanN: 0, clock: 'real learning, no injected credits or time advance', scenarios: [] };
try {
 for (const [name, viewport, reducedMotion] of [['phone', { width: 390, height: 844 }, 'no-preference'], ['tablet-reduced', { width: 768, height: 1024 }, 'reduce']]) {
    const context = await browser.newContext({ viewport, reducedMotion, hasTouch: true }); const page = await context.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
    const healthy = async () => {
        await page.locator('.life-world[data-rendered="true"]').waitFor();
        assert.equal(await page.getByText('景色をひらけなかったよ。下の一覧から選べるよ。').count(), 0);
        assert.equal(await page.locator('.life-world canvas').count(), 1);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page-level horizontal overflow');
    };
    const capture = async stage => { await healthy(); await page.locator('.life-wallet').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/${name}-${stage}.png` }); };
    await page.goto(base);
    await page.getByRole('button', { name: 'まなぶ', exact: true }).first().click();
    await page.getByRole('button', { name: '小学 1 年生', exact: true }).click();
    await page.getByRole('button', { name: 'さんすう', exact: true }).click();
    await page.getByRole('button', { name: '足し算まで', exact: true }).click();
    await page.locator('.island-learning[data-input-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('[data-life-candidate] .life-world[data-rendered="true"]').waitFor();
    await capture('initial');

    assert.equal(await page.locator('[data-life-drops]').getAttribute('data-life-drops'), '0');
    await page.getByRole('button', {name:'まなぶ',exact:true}).click();
    let native = await readNative(page), tries = 0;
    const firstCount = native.island.completedSets;
    while (native.island.completedSets < firstCount + 2 && tries++ < 70) native = (await attempt(page, native)).after;
    assert(tries < 70, 'Real normal learning must complete enough sections');
    await page.getByRole('button', { name: 'とじる', exact: true }).click();
    await page.locator('.life-world[data-rendered="true"]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('[data-life-drops]')?.dataset.lifeDrops) >= 6);
    const worldCell = async (x, z, expanded = false) => {
        await page.locator('.life-wallet').scrollIntoViewIfNeeded();
        const box = await page.locator('.life-world canvas').boundingBox();
        const matrices = JSON.parse(await page.locator('.life-world').getAttribute('data-life-camera'));
        const point = new Vector3(x - (expanded ? 4 : 2.5), .085, z - 2)
            .applyMatrix4(new Matrix4().fromArray(matrices.view)).applyMatrix4(new Matrix4().fromArray(matrices.projection));
        await page.touchscreen.tap(box.x + (point.x + 1) / 2 * box.width, box.y + (1 - point.y) / 2 * box.height);
        assert.equal(await page.locator('.life-placement').getAttribute('data-life-placement-cell'), `${x},${z}`);
    };

    await page.getByRole('button', {name:'つくる',exact:true}).click();
    await page.locator('[data-life-buy="bench"]').click();
    await worldCell(4,2);
    const selected = () => page.locator('.life-placement').getAttribute('data-life-placement-cell');
    const view = () => page.locator('.life-world').evaluate(e => JSON.parse(e.dataset.lifeCamera).cameraView);
    await page.getByRole('button',{name:'しまを おおきく',exact:true}).click();
    assert((await view()).zoom > 1);
    await worldCell(3,3);
    assert((await view()).zoom > 1, 'Selection retains zoom');
    const box = await page.locator('.life-world canvas').boundingBox();
    const x=box.x+box.width*.5, y=box.y+box.height*.45;
    const cdp=await context.newCDPSession(page);
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id}))});
    const before = await selected(), zoom=(await view()).zoom;
    await touch('touchStart',[[x-25,y,1],[x+25,y,2]]);
    await touch('touchMove',[[x-55,y,1],[x+55,y,2]]);
    await touch('touchEnd',[]);
    assert((await view()).zoom > zoom,'Pinch zoom during placement');
    assert.equal(await selected(),before,'Pinch never selects a cell');
    const panBefore = (await view()).pan;
    await touch('touchStart',[[x,y,1]]);
    await touch('touchMove',[[x+30,y+20,1]]);
    await touch('touchEnd',[]);
    assert.notDeepEqual((await view()).pan,panBefore,'Drag pans during placement');
    assert.equal(await selected(),before,'Drag never selects a cell');
    await page.getByRole('button',{name:'しまを みぎに まわす',exact:true}).click();
    assert((await view()).azimuth > 0,'Rotation works during placement');
    assert.equal(await selected(),before);
    const toolbar = await page.locator('.life-placement-camera').boundingBox();
    const wallet = await page.locator('.life-wallet').boundingBox();
    assert(toolbar.y >= wallet.y + wallet.height,'Toolbar clears wallet');
    await capture('zoom');
    await page.getByRole('button',{name:'もとの ながめ',exact:true}).click();
    await worldCell(0,2);
    await page.getByRole('button',{name:'ここに おく',exact:true}).click();
    await page.getByRole('button',{name:'つくる',exact:true}).click();
    await page.locator('[data-life-buy="flower"]').click();
    await worldCell(0,3);
    await page.getByText('ベンチまで あるけなくなるよ。べつの マスを えらぼう。',{exact:true}).waitFor();
    assert(await page.getByRole('button',{name:'ここに おく',exact:true}).isDisabled());
    await capture('blocked-path');
    assert.deepEqual(errors,[]);
    report.scenarios.push({name,pass:true,view:await view(), candidate:await page.locator('.life-world').getAttribute('data-life-visual-candidate')});
    } finally { await context.close(); }
 }
} finally { await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)); await browser.close(); }
