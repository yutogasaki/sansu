const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const [,,name,command,...args]=process.argv;
if(!name||!command)throw Error('Expected check name, command, and arguments');
const out=__dirname,log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
const record={name,command,args,startedAt:new Date().toISOString(),node:process.version,cwd:process.cwd(),environment:Object.fromEntries(['SANSU_PORTAL_BROWSER_OUTPUT','SANSU_LIBRARY_BROWSER_OUTPUT','SANSU_PORTAL_BEFORE','VITEST_MAX_THREADS','VITEST_MIN_THREADS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))};
fs.writeFileSync(path.join(out,name+'.running.json'),JSON.stringify(record,null,2)+'\n');
const child=cp.spawn(command,args,{stdio:['ignore',fd,fd]});
child.on('error',error=>{record.spawnError=String(error);});
child.on('close',(code,signal)=>{
 fs.closeSync(fd);Object.assign(record,{endedAt:new Date().toISOString(),exitCode:code,signal,status:code===0?'PASS':'FAIL',log:name+'.log',logSha256:crypto.createHash('sha256').update(fs.readFileSync(log)).digest('hex')});
 fs.writeFileSync(path.join(out,name+'.result.json'),JSON.stringify(record,null,2)+'\n');fs.unlinkSync(path.join(out,name+'.running.json'));console.log(JSON.stringify(record));process.exitCode=code===0?0:1;
});
