import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
const root = process.cwd(), out = resolve('output/playwright/island-stress');
await mkdir(out, { recursive: true });
let source = await readFile('src/prototypes/assetLab/main.ts', 'utf8');
source = source.replaceAll("'../../components/", "'/src/components/").replace("'./style.css'", "'/src/prototypes/assetLab/style.css'").replace("'../../../assets/", "'/assets/");
source = source.replace("focus('all'); void load(wanted);", "renderer.setSize(viewport.clientWidth, viewport.clientHeight); camera.aspect=viewport.clientWidth/viewport.clientHeight; camera.updateProjectionMatrix(); focus('all'); void load('1024');");
source += await readFile('tools/asset-pipeline/stress-scene.ts','utf8');
await writeFile(`${out}/entry.ts`, source);
await writeFile(`${out}/index.html`, '<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="./entry.ts"></script></html>');
await build({ configFile: false, root, logLevel: 'error', resolve: {alias:{'@':resolve('src')}}, build:{outDir:`${out}/dist`,emptyOutDir:true,rollupOptions:{input:`${out}/index.html`}} });
for (const id of ['tree','rock','bench']) {
 const folder = `${out}/dist/assets/island-${id}-v1/optimized`;
 await mkdir(folder, {recursive:true});
 await copyFile(`assets/island-${id}-v1/optimized/model-1024.glb`, `${folder}/model-1024.glb`);
}
const server = await preview({configFile:false,root,build:{outDir:`${out}/dist`},preview:{host:'127.0.0.1',port:5245,strictPort:true}});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:createHash('sha256').update(source).digest('hex'),date:new Date().toISOString(),conditions:{viewport:'390x844',dpr:1.5,network:'local unthrottled, cache disabled',scope:'synthetic expanded island; shared clones vs zone instancing; kinds are independent re-downloads of same GLBs',memory:'RGBA8+mips estimate, not actual GPU total; unique kinds capped at12',frames:'45 per view; first11 excluded; headless Chromium, not phone'},runs:[]};
const browser=await chromium.launch();
try {
 const cases=[...([30,100,300].flatMap(count=>['shared','instanced'].map(mode=>({count,mode,kinds:3})))),{count:30,mode:'instanced',kinds:6},{count:30,mode:'instanced',kinds:12}];
 for(const config of cases){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5});const page=await context.newPage();page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/GL_INVALID|THREE.WebGLProgram|Context Lost/.test(m.text()))errors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});let wireBytes=0;cdp.on('Network.loadingFinished',e=>wireBytes+=e.encodedDataLength);
  await page.goto('http://127.0.0.1:5245/output/playwright/island-stress/index.html');await page.waitForFunction(()=>window.__assetLab?.ready);
  const setupMs=await page.evaluate(async c=>{const t=performance.now();await window.__stress.setup(c.count,c.mode,c.kinds);return performance.now()-t;},config);
  await page.waitForLoadState('networkidle');await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');const views={};
  for(const view of ['overview','near','moving']){
   await page.evaluate(v=>window.__stress.view(v==='overview'?'overview':'near'),view);
   views[view]=await page.evaluate(v=>window.__stress.measure(v==='moving',false),view);
   if(view==='overview'||(view==='near'&&config.count===300))await page.screenshot({path:`${out}/${config.count}-${config.mode}-${config.kinds}-${view}.png`,fullPage:true});
  }
  if(config.count===300) views.dynamicShadows=await page.evaluate(()=>window.__stress.measure(true,true));
  const row={...config,wireBytes,setupMs,heap,views,errors};report.runs.push(row);await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...config,wireBytes,overview:views.overview.calls,near:views.near.calls,textureMB:views.overview.textureEstimateBytes/1e6,errors}));await context.close();
 }
}finally{await browser.close();server.httpServer.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
if(report.runs.length!==8||report.runs.some(r=>r.errors.length))throw new Error('Incomplete stress test or browser errors');
const sharedRuns=report.runs.filter(r=>r.kinds===3);
if(sharedRuns.some(r=>r.wireBytes!==sharedRuns[0].wireBytes||r.views.overview.textureEstimateBytes!==sharedRuns[0].views.overview.textureEstimateBytes))throw new Error('Shared asset footprint unexpectedly grew');
for(const count of [30,100,300]){
 const pair=sharedRuns.filter(r=>r.count===count);
 if(pair[0].views.overview.triangles!==pair[1].views.overview.triangles)throw new Error('Compared different full-view geometry');
}
