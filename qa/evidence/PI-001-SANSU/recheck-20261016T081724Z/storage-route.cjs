const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root='/Users/yutogasaki/Projects/sansu',out=__dirname,{chromium}=require(root+'/node_modules/playwright');
const atlas='docs/design/2026-10-10-island-design-strategy/index.html',base='http://127.0.0.1:47860/repos/sansu/';
const report={at:new Date().toISOString(),candidate:JSON.parse(fs.readFileSync(root+'/portal/data/integration.json')).currentCandidate,scope:'new anonymous Chromium context and synthetic notes only; no personal browser/storage read or migration'};
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(15000);
 await context.route('**/*',r=>{const u=new URL(r.request().url());return u.protocol==='file:'||u.origin===new URL(base).origin?r.continue():r.abort();});
 const open=async url=>{await page.goto(url);await page.locator('#gallery [data-detail]').first().click();};
 const save=async text=>{await page.locator('#note-text').fill(text);await page.locator('#note-form button[type=submit]').click();};
 await open(pathToFileURL(path.join(root,atlas)).href);await save('QA-FILE-ORIGIN');
 await open(pathToFileURL(path.join(root,'portal/integrated',atlas)).href);report.fileOldToIntegrated=await page.locator('#note-text').inputValue();
 await open(base+'portal/integrated/'+atlas);report.fileNoteVisibleAtHubHttp=await page.locator('#note-text').inputValue();
 await open(base+atlas);await save('QA-HTTP-ORIGIN');await open(base+'portal/integrated/'+atlas);report.httpOldToIntegrated=await page.locator('#note-text').inputValue();await page.locator('#delete-note').click();
 await open(pathToFileURL(path.join(root,atlas)).href);report.originalFileNoteStillPresent=await page.locator('#note-text').inputValue();await page.locator('#delete-note').click();
 report.status='MEASURED_DIAGNOSTIC_ONLY';report.conclusion='Same-context old/new file URLs and same-origin HTTP URLs share the respective synthetic note; file-to-HTTP origin change requires an explicit migration path when notes exist.';
}catch(error){report.status='FAIL';report.error=String(error);process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'storage-route.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}})();
