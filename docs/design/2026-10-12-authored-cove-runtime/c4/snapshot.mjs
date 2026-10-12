import {execFileSync} from 'node:child_process';
import {constants,promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source='/Users/yutogasaki/Projects/sansu';
const output='/private/tmp/sansu-authored-cove-c4';
const dest=path.join(output,'candidate');
const names=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:source,maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean))].filter(f=>!/^\.env(?:\.|$)/.test(f));
await fs.mkdir(dest,{recursive:false});
const hashes={};
for (const name of names) {
 const from=path.join(source,name),to=path.join(dest,name);
 try { if(!(await fs.stat(from)).isFile()) continue; } catch { continue; }
 await fs.mkdir(path.dirname(to),{recursive:true});
 await fs.copyFile(from,to,constants.COPYFILE_FICLONE);
 hashes[name]=createHash('sha256').update(await fs.readFile(to)).digest('hex');
}
await fs.symlink(path.join(source,'node_modules'),path.join(dest,'node_modules'),'dir');
const changed=[];
for(const [name,h] of Object.entries(hashes)) if(createHash('sha256').update(await fs.readFile(path.join(source,name))).digest('hex')!==h) changed.push(name);
await fs.writeFile(path.join(output,'snapshot.json'),JSON.stringify({source,dest,createdAt:new Date().toISOString(),files:hashes,changedDuringCopy:changed},null,2));
console.log(JSON.stringify({dest,files:Object.keys(hashes).length,changedDuringCopy:changed}));
if(changed.length) process.exitCode=1;
