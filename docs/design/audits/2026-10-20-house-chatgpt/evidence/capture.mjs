import { chromium } from '/Users/yutogasaki/Projects/sansu/node_modules/playwright/index.mjs';
import { seedDev, runtimeMetadata } from '/Users/yutogasaki/Projects/sansu/tools/island-e2e-helpers.mjs';
import fs from 'node:fs/promises';
const out='/Users/yutogasaki/Projects/sansu/output/house-audit-2026-10-20';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const report={date:new Date().toISOString(),revision:'9355c416',target:'http://127.0.0.1:5260',scope:'DEV isolated synthetic fresh profile; no child data',captures:[],checks:[],errors:[]};
try{
for(const vp of [{width:390,height:844},{width:320,height:568},{width:768,height:1024}]){
const context=await browser.newContext({viewport:vp,hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
const shot=async name=>{await page.screenshot({path:`${out}/${vp.width}-${name}.png`});report.captures.push({file:`${vp.width}-${name}.png`,...await runtimeMetadata(page)});};
await page.goto(report.target+'/#/island');await seedDev(page,{name:'かんさ',familiar:false});await page.reload();await page.locator('[data-growing-island="ready"] canvas').waitFor();await page.locator('.growing-loading--overlay').waitFor({state:'hidden'});
await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).click();await page.locator('[data-keepsake-section="home"]').waitFor();await page.locator('.island-stage canvas').waitFor();await page.waitForTimeout(1000);await shot('house');
report.checks.push({width:vp.width,houseText:await page.locator('.island-page').innerText()});
await page.locator('[data-house-menu-trigger]').click();await page.locator('dialog[open]').waitFor();await shot('menu');
report.checks.push({width:vp.width,menuText:await page.locator('dialog[open]').innerText()});
await page.locator('[data-room-entry="decor"]').click();await page.locator('[data-room-panel="decor"]').scrollIntoViewIfNeeded();await shot('decor');
await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});report.checks.push({width:vp.width,escapeFocus:await page.locator('[data-house-menu-trigger]').evaluate(el=>document.activeElement===el)});
await page.locator('[data-house-menu-trigger]').click();await page.locator('[data-keepsake-action="open-keepsakes"]').click();await page.locator('[data-keepsake-section="keepsakes"]').waitFor();await shot('keepsakes');
await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).click();await page.locator('[data-keepsake-action="photos"]').click();await page.locator('.island-page[data-mode="photos"]').waitFor();await shot('photos');
report.checks.push({width:vp.width,photosText:await page.locator('.island-page').innerText()});
await context.close();}
}finally{await fs.writeFile(out+'/runtime.json',JSON.stringify(report,null,2));await browser.close();}
