import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out=process.env.DESIGN_PREVIEW_OUTPUT;assert(out,'Specify a new output directory');await mkdir(out,{recursive:false});
const target='http://127.0.0.1:5246/prototypes/asset-lab/?set=design-v2';
const fingerprint=async()=>createHash('sha256').update(await readFile('src/prototypes/assetLab/main.ts')).update(await readFile('assets/pipeline/island-design-v2/file-checks.json')).digest('hex');
const report={target,candidate:'island-design-v2',delivery:'isolated-development-asset-lab',revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startHash:await fingerprint(),cases:[],errors:[],pass:false};
const browser=await chromium.launch();
try{
 for(const width of [390,768]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/GL_INVALID|THREE.WebGLProgram/.test(m.text()))report.errors.push(m.text());});
  await page.goto(target);
  const ready=quality=>page.waitForFunction(q=>window.__assetLab?.ready&&window.__assetLab.quality===q,quality);
  await ready('runtime');assert.equal(await page.evaluate(()=>window.__assetLab.candidate),report.candidate);
  for(const q of ['2048','1024','runtime']){
   await page.locator(`[data-quality="${q}"]`).click();await ready(q);await page.locator('[data-focus="all"]').click();
   await page.screenshot({path:`${out}/${width}-${q}-all.png`,fullPage:true});
   for(const id of ['fence','watering-can','planter','mailbox']){await page.locator(`[data-focus="${id}"]`).click();await page.screenshot({path:`${out}/${width}-${q}-${id}.png`,fullPage:true});}
   report.cases.push({width,quality:q,...await page.evaluate(()=>window.__assetLab.measure())});
  }
  await page.route('**/island-mailbox-v1/design-v2/near.glb',route=>route.abort());
  await page.locator('[data-quality="runtime"]').click();await page.locator('#retry').waitFor({state:'visible'});
  await page.unroute('**/island-mailbox-v1/design-v2/near.glb');await page.locator('#retry').click();await ready('runtime');
  await page.reload();await ready('runtime');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
 }
 report.endHash=await fingerprint();assert.equal(report.startHash,report.endHash);assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:report.pass,cases:report.cases.length}));
