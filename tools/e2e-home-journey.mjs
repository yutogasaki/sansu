import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readNative } from './island-e2e-helpers.mjs';
import { attempt } from './island-learning-checks.mjs';
const base = process.env.SANSU_HOME_JOURNEY_URL;
const out = process.env.SANSU_HOME_JOURNEY_OUTPUT;
assert(base && out, 'Set a DEV preview URL and fresh evidence directory');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { target: base, flag: 'DEV + VITE_HOME_JOURNEY_PREVIEW=true', candidate: 'home-journey-growth-reveal-v6', kind: 'DEV normal-planner integration; not production/art approval', humanN: 0, scenarios: [] };
try {
 for (const [name, viewport, reducedMotion] of [['phone', {width:390,height:844}, 'no-preference'], ['tablet-reduced', {width:768,height:1024}, 'reduce']]) {
  const context = await browser.newContext({ viewport, reducedMotion }); const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button', {name:'まなぶ', exact:true}).first().click();
  await page.getByRole('button', {name:'小学 1 年生', exact:true}).click();
  await page.getByRole('button', {name:'さんすう', exact:true}).click();
  await page.getByRole('button', {name:'足し算まで', exact:true}).click();
  await page.locator('.island-learning[data-input-ready="true"]').waitFor();
  let state=await readNative(page);
  assert.equal(state.plan.homeJourneyVersion,1);
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  await page.locator('[data-home-journey] [data-rendered="true"]').waitFor();
  await page.screenshot({path:`${out}/${name}-initial.png`});
  await page.getByRole('button',{name:/^(まなぶ|つづきから とく)$/,exact:false}).last().click();
  let count=0;
  while ((state.island.homeJourney?.answers??0)<45 && count++<100) {
   state=(await attempt(page,state)).after;
  }
  assert.equal(state.island.homeJourney.answers,45);
  const pending=state.plan.id;
  await page.getByRole('button',{name:'とじる',exact:true}).click();
  try { await page.locator('[data-home-answers="45"] [data-rendered="true"]').waitFor(); } catch (error) {
   await page.screenshot({path:`${out}/${name}-failure.png`});
   await writeFile(`${out}/${name}-failure.json`,JSON.stringify({url:page.url(),text:await page.locator('body').innerText(),errors,state:await readNative(page)},null,2)); throw error;
  }
  await page.locator('[data-growth-at="45"]').waitFor();
  if(reducedMotion !== 'reduce') {
   await page.locator('[data-growth-at="45"][data-activity="delivery-place"]').waitFor();
   await page.waitForFunction(()=>Number(document.querySelector('[data-growth-at="45"]')?.getAttribute('data-delivery-time'))>=11.5);
  } else await page.locator('[data-growth-at="45"][data-growth-phase="settled"][data-activity="delivery-arrived"]').waitFor();
  await page.screenshot({path:`${out}/${name}-growth.png`});
  await page.locator('[data-activity="delivery-arrived"]').waitFor();
  await page.screenshot({path:`${out}/${name}-delivery.png`});
  const beforeView=await readNative(page);
  const canvas=await page.locator('[data-home-journey] canvas').elementHandle();
  await page.getByRole('button',{name:'島全体',exact:true}).click();
  await page.locator('[data-camera-view="island"]').waitFor();
  await page.screenshot({path:`${out}/${name}-wide.png`});
  await page.getByRole('button',{name:'家の近く',exact:true}).click();
  await page.locator('[data-camera-view="home"]').waitFor();
  assert.equal(await canvas.evaluate(node=>node.isConnected),true,'Camera switching keeps the live scene mounted');
  assert.deepEqual(await readNative(page),beforeView,'Camera switching preserves every learning and island record');
  await page.reload();
  await page.locator('[data-home-answers="45"]').waitFor();
  assert.equal((await readNative(page)).plan.id,pending);
  await page.getByRole('button',{name:/^(まなぶ|つづきから とく)$/}).last().click();
  await page.locator('.island-learning[data-input-ready="true"]').waitFor();
  assert.equal(await page.locator('[data-home-journey]').count(),0);
  await page.screenshot({path:`${out}/${name}-resume.png`});
  assert.deepEqual(errors,[]);
  report.scenarios.push({name,viewport,reducedMotion,answers:45,normalAttempts:count,errors,pass:true});
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  await context.close();
 }
} finally { await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)); await browser.close(); }
