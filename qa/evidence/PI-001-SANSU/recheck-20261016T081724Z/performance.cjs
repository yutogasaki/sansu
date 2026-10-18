// Diagnostic profiles only: anonymous Chromium emulation, never a real-phone verdict.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root='/Users/yutogasaki/Projects/sansu',out=__dirname;
const {chromium}=require(root+'/node_modules/playwright');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={at:new Date().toISOString(),candidate:JSON.parse(fs.readFileSync(root+'/portal/data/integration.json')).currentCandidate,manifestSha256:sha(root+'/portal/data/unification-manifest.json'),scope:'Diagnostic desktop Chromium 390x844 mobile emulation. Local static HTTP without gzip. Artificial CPU/network limits. Not Safari/iOS, real phone, production latency, peak memory or acceptance.',profiles:[]};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||/(?:^|\/)(?:\.env|\.git|node_modules)(?:\/|$)/.test(file.slice(root.length))){res.writeHead(404);res.end();return;}
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',fs.statSync(file).size);fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const profile of [{name:'baseline',cpuRate:1,downloadMbps:null},{name:'cpu4-network4Mbps',cpuRate:4,downloadMbps:4}]){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage();page.setDefaultTimeout(90000);const cdp=await context.newCDPSession(page);
   await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpuRate});
   if(profile.downloadMbps)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:profile.downloadMbps*1000000/8,uploadThroughput:1000000/8});
   const result={...profile};const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const began=performance.now();await page.goto(origin+'/portal/search.html');await page.waitForFunction(()=>document.querySelectorAll('#pu-results .pu-result').length===40);
   result.searchReadyMs=Math.round(performance.now()-began);
   result.navigation=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,encodedBodySize:r.encodedBodySize,durationMs:Math.round(r.duration)})),count:document.querySelector('#pu-count').textContent}));
   const initial=result.navigation.count,queryAt=performance.now();await page.locator('#pu-query').fill('島');await page.waitForFunction(previous=>document.querySelector('#pu-count').textContent!==previous,initial);result.queryToCountMs=Math.round(performance.now()-queryAt);
   result.queryCount=await page.locator('#pu-count').innerText();result.metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','TaskDuration'].includes(m.name)).map(m=>[m.name,m.value]));
   result.jsHeapSampleMiB=+(result.metrics.JSHeapUsedSize/1024/1024).toFixed(2);result.errors=errors;
   await page.screenshot({path:path.join(out,'performance-'+profile.name+'.jpg'),type:'jpeg',quality:80});
   if(profile.name==='baseline'){
    await page.goto(origin+'/portal/integrated/docs/design/2026-10-10-island-design-strategy/index.html');await page.locator('#gallery [data-detail]').first().click();
    result.atlasSmallText=await page.locator('dialog[open]').evaluate(node=>[...node.querySelectorAll('p,label,small,figcaption')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height&&parseFloat(getComputedStyle(n).fontSize)<16).map(n=>({tag:n.tagName,fontPx:parseFloat(getComputedStyle(n).fontSize),text:n.textContent.trim().slice(0,100)})));
   }
   report.profiles.push(result);await context.close();console.log(JSON.stringify({profile:profile.name,searchReadyMs:result.searchReadyMs,queryToCountMs:result.queryToCountMs,jsHeapSampleMiB:result.jsHeapSampleMiB}));
  }
  report.status='MEASURED_DIAGNOSTIC_ONLY';
 }catch(error){report.status='FAILED_DIAGNOSTIC';report.error=String(error);process.exitCode=1;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2)+'\n');}
})();
