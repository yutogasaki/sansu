// Standalone headless browser. Never attaches to a personal browser session.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=process.env.SANSU_PORTAL_QA_REPORT||'/tmp/codex/S-002/browser.json';
const report={at:new Date().toISOString(),mode:'standalone headless Chromium',widths:[320,390,768,1440],pages:[],result:'BLOCKED',screenshotsDeleted:false};
let browser;
try {
 browser=await chromium.launch({headless:true});
 for(const width of report.widths) {
  const page=await browser.newPage({viewport:{width,height:width===320?568:900}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>route.abort());
  for(const file of ['index.html','overview.html','map.html','plan.html','tasks.html','documents.html','roles.html','operations.html','ai/index.html']) {
   await page.goto(pathToFileURL(path.join(root,'portal',file)).href);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${file} overflow at ${width}`);
   assert.equal(await page.locator('body').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=16),true);
   if(file==='index.html') {
    assert(await page.locator('.original a').isVisible());
    assert.equal(await page.locator('main > .back').count(),0);
    assert.equal(await page.locator('header').evaluate(n=>n.getBoundingClientRect().height<100),true,'compact mobile header');
    assert.equal(await page.locator('.use-cards').evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),true,'use cards in first viewport');
    assert.equal(await page.locator('.entry-artifact').evaluate(n=>n.getBoundingClientRect().bottom<innerHeight),true,'image result in first viewport, including 320x568');
    assert.equal(await page.locator('.entry-artifact img').evaluate(n=>n.complete&&n.naturalWidth>0),true,'canonical result image loads');
    assert.equal(await page.locator('.link-tail').evaluate(n=>n.getClientRects().length),1,'link arrow stays with final word');
    assert.equal(await page.locator('.snapshot').evaluate(n=>n.getBoundingClientRect().bottom<document.querySelector('.use-cards').getBoundingClientRect().top),true,'summary precedes image strip');
    assert.equal(await page.locator('#documents #global-search').count(),1,'global search belongs to materials');
    for(const card of await page.locator('.use-card').all())assert.equal(await card.locator('img').evaluate(n=>n.complete&&n.naturalWidth>0),true,'existing use images load');
    if(width===320){
     const destination=page.locator('.use-cards a').nth(1);await destination.focus();
     assert.equal(await destination.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true,'keyboard focus brings strip destination into view');
    }
    await page.locator('#search').fill('存在しない検索語S002');
    assert.equal(await page.locator('section[data-search]:visible').count(),0);
    await page.locator('#search').fill('判断');
    assert(await page.locator('#decisions').isVisible(),'entry section search');
    await page.locator('#search').fill('');
    assert.equal(await page.locator('#decisions').evaluate(n=>{
     const clone=n.cloneNode(true);clone.querySelectorAll('details').forEach(d=>d.remove());return /confirmation-\d|\.agents\/|SHA256/.test(clone.textContent);
    }),false);
   }
   if(file==='overview.html') {
    for(const label of ['最新試行の結果','確認範囲','失敗段階','未実施の段階','未確認事項'])assert(await page.locator('#formal-status').getByText(label,{exact:true}).isVisible(),'formal result/scope stays outside closed details');
   }
   if(file==='tasks.html')for(const label of ['現在地','次の一手','未確認'])assert(await page.locator('.card').getByText(label,{exact:true}).first().isVisible(),'task facts visible without expansion');
   if(file==='map.html') {
    await page.locator('#search').fill('旧探索');
    assert(await page.locator('#legacy').getAttribute('open')!==null);
    await page.locator('#search').fill('存在しない検索語S002');
    assert.equal(await page.locator('[data-search]:visible').count(),0);
    await page.locator('#search').fill('');
   }
   if(file==='documents.html'||file==='index.html') {
    await page.locator('#global-search').fill('成熟');
    await page.waitForFunction(()=>document.querySelectorAll('#global-results a').length>0);
    const before=page.url();const link=page.locator('#global-results a').first();
    await link.focus();await page.keyboard.press('Enter');
    await page.locator('#reader[open] .reader-text').waitFor();
    assert.equal(page.url(),before,'document stays on same page');
    await page.keyboard.press('Escape');
    assert.equal(await link.evaluate(n=>n===document.activeElement),true,'return focus');
   }
   if(file==='index.html'){
    await page.locator('a[href="map.html#evidence"]').first().click();
    await page.waitForURL('**/map.html#evidence');
    const source=page.locator('main a[href$=".html"]').filter({hasText:'原本と実画面'}).first();
    if(await source.count()){
     const before=page.url();await source.click();await page.locator('#reader[open] iframe').waitFor();
     assert.equal(page.url(),before,'HTML comparison stays on same page');await page.keyboard.press('Escape');
    }
    await page.goto(pathToFileURL(path.join(root,'portal',file)).href);
   }
   if(width===320){
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${file} text zoom overflow`);
    await page.evaluate(()=>document.documentElement.style.fontSize='');
   }
   const summary=page.locator('details:visible > summary').first();
   if(await summary.count()) {await summary.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');}
   const imageCount=await page.locator('img').count();
   report.pages.push({file,width,imageCount,errors:[...errors]});
   assert.deepEqual(errors,[]);
  }
  await page.close();
 }
 report.result='PASS';
} catch(error) {report.error=String(error);process.exitCode=1;}
finally {
 await browser?.close();
 report.screenshotsDeleted=true;
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({result:report.result,pages:report.pages.length,report:output,screenshotsDeleted:report.screenshotsDeleted}));
}
