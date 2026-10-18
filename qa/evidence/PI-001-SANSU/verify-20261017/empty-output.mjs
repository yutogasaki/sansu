import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '/Users/yutogasaki/Projects/sansu/scripts/standard-portal.mjs';
const root='/Users/yutogasaki/Projects/sansu',out=root+'/portal';
const original=Object.fromEntries(['existsSync','readFileSync','mkdirSync','writeFileSync','copyFileSync','rmSync','readdirSync','statSync','lstatSync'].map(k=>[k,fs[k]]));
const inOutput=p=>String(p)===out||String(p).startsWith(out+'/');
const absent=p=>{const e=new Error('virtual output absent: '+p);e.code='ENOENT';throw e;};
const captured=new Map();let result;
try {
 fs.existsSync=p=>inOutput(p)?false:original.existsSync(p);
 for(const name of ['readFileSync','readdirSync','statSync','lstatSync'])fs[name]=(p,...args)=>inOutput(p)?absent(p):original[name](p,...args);
 fs.mkdirSync=p=>{if(!inOutput(p))throw Error('unexpected mkdir '+p);};
 fs.rmSync=p=>{if(!inOutput(p))throw Error('unexpected removal '+p);};
 fs.writeFileSync=(p,data)=>{if(inOutput(p))captured.set(path.relative(out,p),Buffer.from(data));else if(String(p)!==root+'/docs/portal/project.json')throw Error('unexpected write '+p);};
 fs.copyFileSync=(from,to)=>{if(!inOutput(to))throw Error('unexpected copy '+to);captured.set(path.relative(out,to),original.readFileSync(from));};
 result=run('build');
} catch(error){result={status:'FAIL',error:error.stack};}
finally {Object.assign(fs,original);}
const diffs=[];for(const [name,bytes] of captured)if(!fs.existsSync(out+'/'+name)||!fs.readFileSync(out+'/'+name).equals(bytes))diffs.push(name);
const report={at:new Date().toISOString(),method:'Read-only diagnostic: filesystem calls virtualize absent portal and capture writes in memory. Canonical source files stay available. Not a recovery archive test.',result,captured:captured.size,differences:diffs,manifestSha256:createHash('sha256').update(fs.readFileSync(out+'/data/unification-manifest.json')).digest('hex')};
fs.writeFileSync('/tmp/sansu-portal-verify-20261017/empty-output.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
