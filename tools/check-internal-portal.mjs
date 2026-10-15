import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {step} from './portal-graph.mjs';
import {checkIntegration} from './check-portal-integration.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=['.agents/index.html','.agents/tasks/index.html','docs/index.html','.agents/map.html','.agents/plan.html','.agents/roles.html','.agents/operations.html'];
let count=0;
for(const p of pages){
 const html=fs.readFileSync(path.join(root,p),'utf8');
 for(const name of ['概要','計画','仕事','知識・仕様','役割・手順','運用'])assert(html.includes(`>${name}</a>`),`${p}: ${name}`);
 for(const m of html.matchAll(/href="([^"]+)"/g)){
  if(/^(https?:|mailto:)/.test(m[1]))continue;
  const [rel,anchor]=m[1].split('#');const dest=path.resolve(root,path.dirname(p),decodeURIComponent(rel)||path.basename(p));
  assert(fs.existsSync(dest),`${p} missing ${m[1]}`);
  if(anchor&&dest.endsWith('.html'))assert(fs.readFileSync(dest,'utf8').includes(`id="${anchor}"`),'missing anchor');
 }
 count++;
}
for(const id of ['overview','progress','specs','assets','legacy','evidence'])assert(fs.readFileSync(path.join(root,'.agents/map.html'),'utf8').includes(`id="${id}"`));
const base=()=>({id:'sansu-common-portal-application',started:new Date().toISOString(),implementer:'Codex',candidate:'a',version:1,trial:1,repairs:0,passed:[],history:[{action:'init'}],active:null,failed:null});
const reject=(s,op,args=[],candidate='a')=>{assert.throws(()=>step(s,op,args,candidate));count++;};
reject(base(),'start',['machine','QA']);reject(base(),'start',['complete','Codex']);reject(base(),'reset');
reject(base(),'start',['scope','QA'],'old');
const running=step(base(),'start',['scope','Codex'],'a');reject(running,'start',['scope','Codex']);
const fail=base();fail.failed={cause:'input'};reject(fail,'start',['scope','Codex']);reject(fail,'repair');
const limit=base();limit.failed={cause:'input'};limit.repairs=2;reject(limit,'repair',[],'b');
const time=base();time.started='2000-01-01';reject(time,'start',['scope','QA']);
const self=base();self.passed=['scope','generate','machine','browser'];reject(self,'start',['review','Codex']);
const other=base();other.id='another';reject(other,'start',['scope','QA']);
const reset=base();reset.history=[];reject(reset,'start',['scope','QA']);
const same=base();same.failed={cause:'input'};same.history.push({result:'FAIL',cause:'input'},{result:'FAIL',cause:'input'});reject(same,'repair',[],'b');
const permission=base();permission.failed={cause:'permission'};reject(permission,'repair',[],'b');
const before=base();before.passed=['scope','generate','machine','browser'];reject(before,'start',['accept','Codex']);
const temp='/tmp/sansu-common-portal-application/fixture';fs.mkdirSync(temp,{recursive:true});
const raw=path.join(temp,'raw.log');fs.writeFileSync(raw,'fixture raw');
const a=running.active;
const receipt=path.join(temp,'receipt.json');
const make=e=>fs.writeFileSync(receipt,JSON.stringify({...a,at:new Date().toISOString(),result:'PASS',condition:'fixture',log:raw,logHash:'wrong',artifacts:[],...e}));
for(const field of ['token','trial','candidate','version','stage','actor']){make({[field]:'old'});reject(structuredClone(running),'finish',[receipt]);}
make({condition:''});reject(structuredClone(running),'finish',[receipt]);
make({result:'FAIL',cause:'',reason:''});reject(structuredClone(running),'finish',[receipt]);
make({});reject(structuredClone(running),'finish',[receipt]);
reject(structuredClone(running),'finish',[receipt+'.missing']);
const lost=base();lost.history.push({receipt:receipt+'.missing',receiptHash:'missing'});reject(lost,'start',['scope','QA']);
console.log(`PASS: ${count} page/graph checks, legacy anchors preserved`);
checkIntegration();
