import { chromium } from 'playwright';
import { seedNative, readNative, runtimeMetadata } from '../../../../tools/island-e2e-helpers.mjs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://sansu-seven.vercel.app', out='output/house-release/live-update';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await context.newPage();
const report={target:base,engine:'chromium',physicalDevice:false,pass:false};
try {
 await page.goto(base);await page.waitForURL('**/#/onboarding');const id=await seedNative(page,randomUUID());
 await page.goto(base);await page.locator('.life-world[data-rendered=true]').waitFor();
 await page.locator('.island-shell-nav').getByRole('button',{name:'まなぶ',exact:true}).click();
 await page.locator('[data-input-ready=true]').waitFor();
 await page.getByRole('button',{name:'とじる',exact:true}).click();
 await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).click();
 await page.locator('[data-home-resident]').waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
 if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))) await page.reload();
 report.before=await runtimeMetadata(page); const saved=await readNative(page,id);assert(saved.plan);
 await page.screenshot({path:`${out}/before.png`});
 await fs.writeFile(`${out}/ready.json`,JSON.stringify(report,null,2));
 // The parent publishes only after its release checks pass. No application state is changed here.
 let expected;
 for(let i=0;i<1800;i++){
  try {expected=(await fs.readFile(`${out}/expected-revision.txt`,'utf8')).trim();break;}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 assert(expected,'Release signal missing');
 await page.waitForFunction(expected=>document.querySelector('.island-page')?.getAttribute('data-build-revision')===expected && document.querySelector('[data-home-camera-candidate]')?.getAttribute('data-home-camera-candidate')==='island-home-interior-v5',expected,{timeout:240000});
 assert.deepEqual(await readNative(page,id),saved,'Automatic update keeps the same saved learning reservation and seven stores');
 report.after=await runtimeMetadata(page);report.cameraCandidate=await page.locator('[data-home-camera-candidate]').first().getAttribute('data-home-camera-candidate');
 await page.screenshot({path:`${out}/after.png`});
 await context.setOffline(true);await page.reload();
 await page.locator('[data-home-camera-candidate=island-home-interior-v5]').waitFor();
 assert.deepEqual(await readNative(page,id),saved,'Offline reload preserves data');
 await page.screenshot({path:`${out}/offline.png`});
 report.offline=await runtimeMetadata(page);report.pass=true;
} catch(error){report.error=String(error);throw error;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
