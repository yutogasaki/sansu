import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('playwright'), { build } = require('esbuild'), T = require('three');
const output = '/private/tmp/sansu-growth-c6/runtime';
mkdirSync(output, { recursive: false });
const report = { pass: false, target: 'http://127.0.0.1:5363/prototypes/place-qa/authored.html?art=whole', revision: 'growth-assembly-c6', candidate: 'native05-growth-assembly-v1', scope: 'DEV fixed35 whole composition and ordinary edits; no personal save, gallery traversal, performance or art acceptance', steps: [], captures: [], errors: [] };
const json = file => JSON.parse((file.endsWith('.gz') ? gunzipSync(readFileSync(file)) : readFileSync(file)).toString());
const compiled = await build({ stdin: { contents: `export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving.ts'; export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame.ts'; export { canPlace } from './src/domain/growingIsland/commands.ts'; export { landCells } from './src/domain/growingIsland/space.ts';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const base = domain.withNative05WaterCarvingScope(domain.compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz'))), shoulder = json('prototypes/place-qa/authored-shoulder-profile.json.gz');
const frame = state => domain.authoredWorldFrame(state, base, { water: true, cove: true, shoulder });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(90000); page.setDefaultNavigationTimeout(90000);
page.on('pageerror', error => report.errors.push(String(error)));
const meta = () => page.locator('[data-growing-world]').evaluate(node => ({ ...node.dataset }));
const state = () => page.locator('[data-authored-island]').evaluate(node => JSON.parse(node.dataset.authoredState));
const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => {
    await page.waitForFunction(() => {
        const host = document.querySelector('[data-authored-island]')?.dataset, world = document.querySelector('[data-growing-world]')?.dataset;
        return !document.querySelector('.authored-status') && world?.authoredWholeArt && world.growingCamera && world.worldRevision === host?.worldRevision;
    }); await paint();
};
const check = async () => {
 await ready(); const value=await meta(); const art=JSON.parse(value.authoredWholeArt); assert.equal(value.artCandidate,report.candidate); assert.equal(value.authoredWholeArtEnabled,'true'); assert.equal(art.galleryTraversalEnabled,false);
 for(const id of ['l14','l15','l28','l29','l33','l34','l35']) assert(art.forestOwners.includes(id), 'rich forest absent: '+id);
 const host=await page.locator('[data-authored-island]').evaluate(node=>({...node.dataset})); assert.equal(host.buildRevision,report.revision); report.appVersion=host.appVersion;
};
const supportWorld=frame(json('prototypes/place-qa/authored-shoulder-reference-mature.json').state).world;
async function step(name, fn) { report.phase = name; console.log(name); writeFileSync(`${output}/progress.json`, JSON.stringify(report, null, 2)); const started = Date.now(); await fn(); report.steps.push({ name, elapsedMs: Date.now() - started }); }
async function capture(name) {
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
    await page.screenshot({ path: `${output}/${name}.png`, scale: 'css' });
    report.captures.push({ name, url: page.url(), viewport: page.viewportSize(), metadata: await meta(), state: await state() });
}
async function select(id) { const button = page.locator(`[data-owner-id="${id}"]`); await button.scrollIntoViewIfNeeded(); await button.click(); await page.waitForFunction(id => document.querySelector('[data-growing-world]')?.dataset.growingFocus === id, id); }
async function whole() { const old = await page.locator('[data-growing-world]').elementHandle(); await page.getByRole('button', { name: '全景', exact: true }).click(); await page.waitForFunction(node => !node.isConnected, old); await ready(); }
async function tap(cell) {
    await page.locator('[data-growing-world] canvas').scrollIntoViewIfNeeded(); await paint();
    const floor = supportWorld.floorAt(cell); assert(floor);
    const pose = JSON.parse((await meta()).growingCamera), camera = new T.OrthographicCamera(); camera.matrixWorld.fromArray(pose.matrixWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(pose.projectionMatrix);
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const point = new T.Vector3(floor.point.x - pose.center, floor.point.y, floor.point.z - 2).project(camera); assert(Math.abs(point.x) < .98 && Math.abs(point.y) < .98);
    await page.mouse.click(box.x + (point.x + 1) * box.width / 2, box.y + (1 - point.y) * box.height / 2);
    await page.getByRole('button', { name: 'ここにおく', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'ここにおく' && !button.disabled));
}
try {
 await step('whole-load',async()=>{ await page.goto(report.target); await check(); await capture('whole-before'); });
 const before=await state(), original=before.landmarks.find(x=>x.id==='l29').cell, target={x:12,z:-9};
 await step('move-rich-tree',async()=>{
  await select('l29'); await page.getByRole('button',{name:'うごかす',exact:true}).click(); await whole(); await tap(target); await capture('move-preview');
  await page.getByRole('button',{name:'ここにおく',exact:true}).click(); await check();
  assert.deepEqual((await state()).landmarks.find(x=>x.id==='l29').cell,target); await capture('whole-moved');
 });
 await step('return-rich-tree',async()=>{
  await select('l29'); await page.getByRole('button',{name:'うごかす',exact:true}).click(); await whole(); await tap(original);
  await page.getByRole('button',{name:'ここにおく',exact:true}).click(); await check(); await capture('whole-restored');
 });
 const stable=x=>{const y=structuredClone(x); delete y.applied; delete y.placeProgress;return y;}; assert.deepEqual(stable(await state()),stable(before)); assert.deepEqual(report.errors,[]); report.pass=true;
} catch(error){ report.failure=String(error.stack??error); await page.screenshot({path:output+'/failure.png',scale:'css'}).catch(()=>{}); report.failureMetadata=await meta().catch(()=>null);process.exitCode=1; }
finally{fsWrite();await browser.close();console.log(JSON.stringify({pass:report.pass,phase:report.phase,captures:report.captures.length,failure:report.failure}));}
function fsWrite(){writeFileSync(output+'/report.json',JSON.stringify(report,null,2));}
