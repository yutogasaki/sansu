import { readFile, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
const root = process.cwd(), out = resolve('output/playwright/island-runtime');
await mkdir(out, { recursive: true });
let source = await readFile('src/prototypes/assetLab/main.ts', 'utf8');
source = source.replaceAll("'../../components/", "'/src/components/").replace("'./style.css'", "'/src/prototypes/assetLab/style.css'").replace("'../../../assets/", "'/assets/");
source = source.replace("focus('all'); void load(wanted);", "renderer.setSize(viewport.clientWidth, viewport.clientHeight); camera.aspect=viewport.clientWidth/viewport.clientHeight; camera.updateProjectionMatrix(); focus('all'); void load('1024');");
source = source.replace('const draw =', 'let draw =');
source = source.replace("const path = quality === '1024' ?", "const path = new URLSearchParams(location.search).get('profile') !== 'original' ? 'runtime/near.glb' : quality === '1024' ?");
source += await readFile('tools/asset-pipeline/stress-scene.ts','utf8');
source += await readFile('tools/asset-pipeline/runtime-lod.ts','utf8');
await writeFile(`${out}/entry.ts`, source);
await writeFile(`${out}/index.html`, '<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="./entry.ts"></script></html>');
await build({ configFile: false, root, logLevel: 'error', resolve: {alias:{'@':resolve('src')}}, build:{outDir:`${out}/dist`,emptyOutDir:true,rollupOptions:{input:`${out}/index.html`}} });
for (const id of ['tree','rock','bench']) {
 const folder = `${out}/dist/assets/island-${id}-v1/optimized`;
 await mkdir(folder, {recursive:true});
 await copyFile(`assets/island-${id}-v1/optimized/model-1024.glb`, `${folder}/model-1024.glb`);
}
await cp('node_modules/three/examples/jsm/libs/basis', `${out}/dist/basis`,{recursive:true});
for(const id of ['tree','rock','bench']){const dir=`${out}/dist/assets/island-${id}-v1/runtime`;await mkdir(dir,{recursive:true});for(const f of ['near.glb','far-geometry.glb'])await copyFile(`assets/island-${id}-v1/runtime/${f}`,`${dir}/${f}`);}
if(process.env.RUNTIME_BUILD_ONLY)process.exit(0);
const server = await preview({configFile:false,root,build:{outDir:`${out}/dist`},preview:{host:'127.0.0.1',port:5246,strictPort:true}});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:createHash('sha256').update(source).digest('hex'),date:new Date().toISOString(),conditions:{viewport:'390x844',dpr:1.5,network:'local unthrottled, cache disabled',scope:'synthetic expanded island; 300 shared placements / 3 assets; original 1K vs UASTC vs UASTC + far LOD',memory:'texturePayloadBytes: transcoded compressed mip bytes plus RGBA8+mips estimate for ordinary textures; excludes GPU overhead and render targets',frames:'45 per view; first11 excluded; headless Chromium, not phone'},runs:[]};
const browser=await chromium.launch();
try {
 const cases=(process.env.RUNTIME_PROFILES||'original,compressed,lod').split(',').map(profile=>({count:300,mode:'shared',kinds:3,profile}));
 for(const config of cases){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5});const page=await context.newPage();page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/GL_INVALID|THREE.WebGLProgram|Context Lost/.test(m.text()))errors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});let wireBytes=0;cdp.on('Network.loadingFinished',e=>wireBytes+=e.encodedDataLength);
  await page.goto(`http://127.0.0.1:5246/output/playwright/island-runtime/index.html?profile=${config.profile}`);await page.waitForFunction(()=>window.__assetLab?.ready);
  const setupMs=await page.evaluate(async c=>{const t=performance.now();await window.__stress.setup(c.count,c.mode,c.kinds);return performance.now()-t;},config);
  await page.waitForLoadState('networkidle');await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');const views={};
  for(const view of ['overview','near','moving']){
   await page.evaluate(v=>window.__stress.view(v==='overview'?'overview':'near'),view);
   views[view]=await page.evaluate(v=>window.__stress.measure(v==='moving',false),view);
   if(view==='overview'||(view==='near'&&config.count===300))await page.screenshot({path:`${out}/${config.profile}-${view}.png`,fullPage:true});
  }
  for(const id of [0,1,2]){await page.evaluate(i=>window.__runtimeLod.focus(i),id);views['focus'+id]=await page.evaluate(()=>window.__stress.snapshot());await page.screenshot({path:`${out}/${config.profile}-focus${id}.png`,fullPage:true});}
  if(config.profile==='lod'){await page.evaluate(()=>{window.__stress.view('near');window.__runtimeLod.shadows(false);});await page.screenshot({path:`${out}/lod-no-shadow.png`,fullPage:true});}
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  const row={...config,wireBytes,setupMs,heap,views,gpu,errors};report.runs.push(row);await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...config,wireBytes,overview:views.overview.calls,near:views.near.calls,texturePayloadMB:views.overview.texturePayloadBytes/1e6,errors}));await context.close();
 }
}finally{await browser.close();server.httpServer.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
if(report.runs.length!==(process.env.RUNTIME_PROFILES||'original,compressed,lod').split(',').length||report.runs.some(r=>r.errors.length))throw new Error('Incomplete runtime comparison');
