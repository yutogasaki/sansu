import {chromium} from 'playwright';
import {seedNative,readNative,runtimeMetadata} from '../../../../tools/island-e2e-helpers.mjs';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='output/house-release/production-offline-stable';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();
const report={pass:false,target:'https://sansu-seven.vercel.app',physicalDevice:false,requestsFailed:[]};
page.on('requestfailed',r=>report.requestsFailed.push({url:r.url(),failure:r.failure()}));
try{
 await page.goto(report.target);await page.waitForURL('**/#/onboarding');const id=await seedNative(page,randomUUID());
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await page.goto(report.target,{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
 await page.locator('.life-world[data-rendered=true]').waitFor();await page.locator('.island-shell-nav').getByRole('button',{name:'まなぶ',exact:true}).click();await page.locator('[data-input-ready=true]').waitFor();
 await page.getByRole('button',{name:'とじる',exact:true}).click();await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).click();await page.locator('[data-home-camera-candidate=island-home-interior-v5]').waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const before=await readNative(page,id);assert(before.plan);report.before=await runtimeMetadata(page);
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-home-camera-candidate=island-home-interior-v5]').waitFor();
 assert.deepEqual(await readNative(page,id),before);report.after=await runtimeMetadata(page);await page.screenshot({path:`${out}/offline.png`});
 await page.getByRole('button',{name:'いえの メニュー',exact:true}).click();await page.getByRole('dialog',{name:'いえの メニュー',exact:true}).waitFor();report.pass=true;
}catch(e){report.error=String(e);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
