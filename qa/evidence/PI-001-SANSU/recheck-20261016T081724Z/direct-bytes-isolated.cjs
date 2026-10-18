const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='/Users/yutogasaki/Projects/sansu',out=__dirname;let base,server;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestBytes=fs.readFileSync(root+'/portal/data/unification-manifest.json'),manifest=JSON.parse(manifestBytes);
const report={at:new Date().toISOString(),base,candidate:JSON.parse(fs.readFileSync(root+'/portal/data/integration.json')).currentCandidate,manifestSha256:hash(manifestBytes),server:'existing hub server; no restart, assembly or shared-file edits by this task',bytes:[],resources:[]};
const route=rel=>base+rel.split('/').map(encodeURIComponent).join('/');
async function pool(rows,work){let next=0;await Promise.all(Array.from({length:8},async()=>{while(next<rows.length){const row=rows[next++];await work(row);}}));}
(async()=>{
 server=require('/Users/yutogasaki/Projects/hub/common-portal/publish/serve.cjs').createServer({projectsRoot:'/Users/yutogasaki/Projects'});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/repos/sansu/';report.base=base;report.server='Isolated invocation of the exported hub read-through createServer API; no assemble, copying, source edits or shared-server restart';
 const expected=Object.entries(manifest.outputs).map(([name,sha256])=>({file:'portal/'+name,sha256}));
 expected.push({file:'portal/data/unification-manifest.json',sha256:hash(manifestBytes)});
 for(const file of ['.agents/index.html','.agents/map.html','.agents/plan.html','.agents/roles.html','.agents/operations.html','.agents/tasks/index.html','docs/index.html','assets/island-planter-v1/design-v2/back.png'])expected.push({file,sha256:hash(fs.readFileSync(path.join(root,file)))});
 await pool(expected,async row=>{
  try{const response=await fetch(route(row.file),{signal:AbortSignal.timeout(30000)}),digest=crypto.createHash('sha256');let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;digest.update(chunk);}const sha256=digest.digest('hex');report.bytes.push({...row,status:response.status,bytes,actualSha256:sha256,pass:response.status===200&&sha256===row.sha256});}
  catch(error){report.bytes.push({...row,pass:false,error:String(error),cause:error.cause&&{code:error.cause.code,message:error.cause.message}});}
 });
 const registry=JSON.parse(fs.readFileSync(root+'/portal/data/unification.json'));
 const seen=new Set(),rows=[];
 for(const row of registry.resources){const file=row.generatedTarget?'portal/'+row.generatedTarget:row.source;const abs=path.join(root,file);if(seen.has(file)||fs.existsSync(abs)&&fs.statSync(abs).isDirectory())continue;seen.add(file);rows.push({file,source:row.source,existsOnDisk:fs.existsSync(abs)});}
 await pool(rows,async row=>{try{const response=await fetch(route(row.file),{method:'HEAD',signal:AbortSignal.timeout(30000)});report.resources.push({...row,status:response.status,pass:response.status===200});}catch(error){report.resources.push({...row,pass:false,error:String(error),cause:error.cause&&{code:error.cause.code,message:error.cause.message}});}});
 report.byteFailures=report.bytes.filter(r=>!r.pass);report.resourceFailures=report.resources.filter(r=>!r.pass);report.status=report.byteFailures.length||report.resourceFailures.length?'FAIL':'PASS';
 fs.writeFileSync(path.join(out,'direct-bytes-isolated.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,bytesChecked:report.bytes.length,byteFailures:report.byteFailures.length,resourcesChecked:report.resources.length,resourceFailures:report.resourceFailures.length,missingOnDisk:report.resourceFailures.filter(r=>!r.existsOnDisk).length}));server.closeIdleConnections?.();await new Promise(r=>server.close(r));if(report.status==='FAIL')process.exitCode=1;
})().catch(error=>{server?.closeAllConnections?.();server?.close();report.error=String(error);report.status='FAIL';fs.writeFileSync(path.join(out,'direct-bytes-isolated.json'),JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
