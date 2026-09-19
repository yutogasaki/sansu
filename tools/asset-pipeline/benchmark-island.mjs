import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
const root = process.cwd(), out = resolve('output/playwright/island-benchmark');
await mkdir(out, { recursive: true });
let source = await readFile('src/prototypes/assetLab/main.ts', 'utf8');
source = source.replaceAll("'../../components/", "'/src/components/").replace("'./style.css'", "'/src/prototypes/assetLab/style.css'").replace("'../../../assets/", "'/assets/");
source = `import { makeStarTree } from '/src/components/island/three/scenery';\nimport { makeFurniture } from '/src/components/island/three/furniture';\n` + source;
source = source.replace("focus('all'); void load(wanted);", `
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
camera.aspect = viewport.clientWidth / viewport.clientHeight; camera.updateProjectionMatrix();
focus('all');
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'existing') {
 const ownMaterials = new IslandMaterials('moon-garden');
 const tree = makeStarTree(ownMaterials), bench = makeFurniture('bench', ownMaterials);
 const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.3, 0), ownMaterials.get('#b9b9a2'));
 [tree, rock, bench].forEach((o,i) => { const a = assets[i]; o.position.set(...a.position); current.add(o); });
 renderer.shadowMap.needsUpdate = true; draw(); lab.ready = true; lab.quality = 'existing';
 status.textContent = '既存素材の島（比較用）';
} else { void load('1024'); }
Object.assign(window, { __benchmark: {
 snapshot: () => {
  const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  scene.traverse(o => { if (!(o instanceof THREE.Mesh)) return; geometries.add(o.geometry);
   for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
  });
  let geometryBytes = 0, textureRgba8Estimate = 0;
  geometries.forEach(g => { geometryBytes += g.index?.array.byteLength ?? 0; Object.values(g.attributes).forEach(a => geometryBytes += a.array.byteLength); });
  textures.forEach(t => { const im = t.image; if (im?.width && im?.height) textureRgba8Estimate += im.width * im.height * 4 * (t.generateMipmaps ? 4/3 : 1); });
  draw(); return { camera:camera.position.toArray(), target:controls.target.toArray(), geometryBytes, textureRgba8Estimate, textureCount: textures.size, calls: renderer.info.render.calls };
 },
 orbit: async () => {
  const frames: number[] = [], cpu: number[] = []; let last = 0;
  const offset = camera.position.clone().sub(controls.target); const y = offset.y, radius = Math.hypot(offset.x, offset.z), phase = Math.atan2(offset.x, offset.z);
  for (let i=0;i<150;i++) {
   const t = await new Promise<number>(resolve => requestAnimationFrame(resolve));
   if (i>30) frames.push(t-last); last=t;
   const a=phase+i*.005; camera.position.set(controls.target.x+Math.sin(a)*radius, controls.target.y+y, controls.target.z+Math.cos(a)*radius);
   const start=performance.now(); controls.update(); draw(); if(i>30) cpu.push(performance.now()-start);
  }
  return {frames,cpu};
 }
}});
`);
await writeFile(`${out}/entry.ts`, source);
await writeFile(`${out}/index.html`, '<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="./entry.ts"></script></html>');
await build({ configFile: false, root, logLevel: 'error', resolve: {alias:{'@':resolve('src')}}, build:{outDir:`${out}/dist`,emptyOutDir:true,rollupOptions:{input:`${out}/index.html`}} });
for (const id of ['tree','rock','bench']) {
 const folder = `${out}/dist/assets/island-${id}-v1/optimized`;
 await mkdir(folder, {recursive:true});
 await copyFile(`assets/island-${id}-v1/optimized/model-1024.glb`, `${folder}/model-1024.glb`);
}
const server = await preview({configFile:false,root,build:{outDir:`${out}/dist`},preview:{host:'127.0.0.1',port:5244,strictPort:true}});
const report={ revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:createHash('sha256').update(source).digest('hex'),conditions:{viewport:'390x844',deviceScaleFactor:1.5,downloadMbps:10,latencyMs:50,cache:'disabled; fresh context every run',runsPerMode:3,scope:'Standalone production-built scene comparison; not full game boot',memory:'JS heap measured after GC; geometry bytes counted; texture RGBA8+mips estimate excludes driver/render-target overhead'},runs:[]};
const browser=await chromium.launch();
try {
 for(let run=0;run<3;run++)for(const mode of (run%2?['generated','existing']:['existing','generated'])){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/GL_INVALID|THREE.WebGLProgram/.test(m.text()))errors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:50,downloadThroughput:1250000,uploadThroughput:1250000});
  let wireBytes=0;cdp.on('Network.loadingFinished',e=>wireBytes+=e.encodedDataLength);
  await page.goto(`http://127.0.0.1:5244/output/playwright/island-benchmark/index.html?mode=${mode}`);
  await page.waitForFunction(()=>window.__assetLab?.ready);
  const readyMs=await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now();});
  await page.waitForLoadState('networkidle');
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,transfer:r.transferSize,encoded:r.encodedBodySize})));
  await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
  const scene=await page.evaluate(()=>window.__benchmark.snapshot());
  if(run===0)await page.screenshot({path:`${out}/${mode}.png`,fullPage:true});
  const frames=await page.evaluate(()=>window.__benchmark.orbit());
  const row={run,mode,readyMs,wireBytes,heap,scene,resources,frames,errors};report.runs.push(row);console.log(JSON.stringify({run,mode,readyMs,wireBytes,heap:heap.usedSize,scene,errors}));
  await context.close();
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();server.httpServer.close();}
if(report.runs.some(r=>r.errors.length))throw new Error('Browser errors; see report');
