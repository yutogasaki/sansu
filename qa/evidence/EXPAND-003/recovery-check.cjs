'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=process.cwd(),out=path.join(root,'portal'),dir=__dirname;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function snapshot(){const data={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else data[path.relative(out,f)]=sha(fs.readFileSync(f));}}walk(out);return data;}
const result={startedAt:new Date().toISOString(),commands:[],before:snapshot()};
function run(name,env={}){const logfile=path.join(dir,name+'.log'),at=new Date().toISOString(),fd=fs.openSync(logfile,'w');const args=name.includes('verify')?['run','portal:verify']:['run','portal:build'];const run=spawnSync('npm',args,{cwd:root,env:{...process.env,...env},stdio:['ignore',fd,fd]});fs.closeSync(fd);result.commands.push({command:'npm '+args.join(' '),env,at,endedAt:new Date().toISOString(),exit:run.status,log:path.basename(logfile),sha256:sha(fs.readFileSync(logfile))});if(run.status!==0)throw Error(name+' failed');}
try{
 run('rollback-build',{PORTAL_WORKSPACE:'legacy'});run('rollback-verify',{PORTAL_WORKSPACE:'legacy'});result.legacy=snapshot();
 run('restored-build');run('restored-verify');result.restored=snapshot();result.restoreEqual=JSON.stringify(result.before)===JSON.stringify(result.restored);if(!result.restoreEqual)throw Error('Restored bytes differ');
 const backup=path.join(root,'output/expand-003-recovery/current-portal-final');fs.mkdirSync(path.dirname(backup),{recursive:true});if(fs.existsSync(backup))throw Error('Recovery target already exists');fs.renameSync(out,backup);result.freshBackup=path.relative(root,backup);
 try{run('fresh-build');run('fresh-verify');result.fresh=snapshot();result.freshEqual=JSON.stringify(result.before)===JSON.stringify(result.fresh);if(!result.freshEqual)throw Error('First generation differs');}catch(e){if(!fs.existsSync(out))fs.renameSync(backup,out);throw e;}
 result.status='PASS';
}catch(e){result.status='FAIL';result.error=e.message;process.exitCode=1;}finally{result.endedAt=new Date().toISOString();fs.writeFileSync(path.join(dir,'recovery.json'),JSON.stringify(result,null,2)+'\n');console.log(result.status,result.commands.map(c=>c.exit),result.error||'same bytes after rollback, restoration and clean generation');}
