// Isolated anonymous browser: native editing is exercised without personal data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '/Users/yutogasaki/Projects/sansu/node_modules/playwright/index.mjs';
const root='/Users/yutogasaki/Projects/sansu';
const out=path.resolve(process.env.SANSU_LIBRARY_BROWSER_OUTPUT||'qa/evidence/PI-001-SANSU/library-browser');fs.mkdirSync(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const data=JSON.parse(fs.readFileSync(path.join(root,'portal/data/unification.json')));
const manifest=fs.readFileSync(path.join(root,'portal/data/unification-manifest.json'));
const report={at:new Date().toISOString(),command:'node tools/check-portal-library-browser.mjs '+process.argv.slice(2).join(' '),candidate:JSON.parse(fs.readFileSync(path.join(root,'portal/data/integration.json'))).currentCandidate,manifestSha256:sha(manifest),inputSha256:sha(fs.readFileSync(path.join(root,'portal/data/unification.json'))),groups:[],pages:[],failures:[]};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)),file=path.resolve(root,relative);
 if(req.method!=='GET'||!file.startsWith(root+path.sep)||/(?:^|\/)(?:\.env|\.git|node_modules)(?:\/|$)/.test(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const size=fs.statSync(file).size,match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
 const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
 if(match){res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}res.setHeader('Content-Length',Math.max(0,end-start+1));fs.createReadStream(file,{start,end}).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
async function context(){const result=await browser.newContext({acceptDownloads:true});await result.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());return result;}
let active=await context();let page=await active.newPage();page.setDefaultTimeout(15000);
page.on('dialog',dialog=>dialog.accept());
const go=async route=>{await page.goto(origin+'/'+route);await page.waitForLoadState('networkidle');};
const shot=async name=>{const file=name+'.jpg';await page.screenshot({path:path.join(out,file),type:'jpeg',quality:75});return file;};
async function group(name,work){try{await work();report.groups.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){report.groups.push({name,status:'FAIL',error:String(error),screenshot:await shot('failure-'+report.groups.length)});report.failures.push({name,error:error.stack});console.log('FAIL '+name+': '+error);}}
try {
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});
  for(const [variant,route] of [['before','.agents/index.html'],['after','portal/index.html']]) {
   await go(route);await page.evaluate(()=>document.fonts.ready);
   report.pages.push({variant,width,route,metrics:await page.evaluate(()=>({title:document.title,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(n=>n.complete&&!n.naturalWidth).length})),screenshot:await shot(variant+'-'+width)});
  }
 }
} finally { fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve)); }
