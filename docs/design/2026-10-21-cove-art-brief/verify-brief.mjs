import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder=fileURLToPath(new URL('./',import.meta.url)),root=path.resolve(folder,'../../..');
const report={startedAt:new Date().toISOString(),target:'http://127.0.0.1:5264/docs/design/2026-10-21-cove-art-brief/',checks:[],scenarios:[],pass:false,scope:'Comparison document and real media/links only. No new art, Astra execution, main app or PWA acceptance.'};
await fs.writeFile(folder+'verification.json',JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({channel:'chrome'});
try{
  const manifest=JSON.parse(await fs.readFile(folder+'input-manifest.json','utf8'));
  for(const [file,sha] of Object.entries(manifest.inputs))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),sha,file);
  report.checks.push('all declared source images, video, observations and prototype evidence match their SHA');
  const html=await fs.readFile(folder+'index.html','utf8');
  for(const match of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)){
    const ref=match[1];if(/^(?:https?:|data:|#)/.test(ref))continue;await fs.access(path.resolve(folder,ref.split('#')[0]));
  }
  report.checks.push('every relative HTML link/media/poster target exists');
  for(const width of [390,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(report.target,{waitUntil:'networkidle'});
    const images=await page.locator('img').evaluateAll(images=>images.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
    assert(images.every(i=>i.loaded));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>0;});
    const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,muted:v.muted}));assert.equal(media.width,900);assert.equal(media.height,1300);assert(media.muted);
    await page.screenshot({path:folder+`board-${width}.png`,fullPage:false});assert.deepEqual(errors,[]);
    report.scenarios.push({width,height:1000,images:images.length,media,overflow:false,pageErrors:errors,pass:true});await context.close();
  }
  report.checks.push('390/1440 widths load every image, decode the real silent video, show no horizontal overflow or page errors');report.pass=true;
}finally{report.completedAt=new Date().toISOString();await fs.writeFile(folder+'verification.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
