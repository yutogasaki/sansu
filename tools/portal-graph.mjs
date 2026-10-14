import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home='/tmp/sansu-common-portal-application';
const file=path.join(home,'run.json');
const stages=['scope','generate','machine','browser','review','accept','report'];
const inputs=['tools/generate-agent-index.mjs','tools/portal-content.mjs','tools/portal-graph.mjs','tools/check-internal-portal.mjs','docs/internal-portal/contract.md','docs/runbooks/repository-portal.md','.agents/tasks/TASKS.md','docs/tasks/backlog.md','docs/product/island-construction-strategy.md','docs/design/2026-10-11-authored-flower-garden/README.md','.agents/index.html','.agents/plan.html','.agents/tasks/index.html','docs/index.html','.agents/map.html','.agents/roles.html','.agents/operations.html'];
const markdowns=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?markdowns(dir+'/'+e.name):e.name.endsWith('.md')?[dir+'/'+e.name]:[]);
const hash=b=>createHash('sha256').update(b).digest('hex');
export function candidate(){return hash(JSON.stringify([...new Set([...inputs,...markdowns('docs'),...markdowns('.agents'),'CONSTITUTION.md','website/index.html'])].sort().map(p=>[p,fs.existsSync(path.join(root,p))?hash(fs.readFileSync(path.join(root,p))):'missing'])));}
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
export function validateHistory(s){
  need(Array.isArray(s.history)&&s.history.length>0,'history missing');
  for(const a of s.history.filter(a=>a.receipt)){
    need(hash(fs.readFileSync(a.receipt))===a.receiptHash,'receipt changed');
    const e=JSON.parse(fs.readFileSync(a.receipt));
    need(hash(fs.readFileSync(e.log))===a.logHash,'raw evidence changed');
    for(const item of e.artifacts||[])need(hash(fs.readFileSync(item.path))===item.sha,'artifact changed or missing');
  }
}
export function step(s,op,args,current,now=Date.now()){
  // H-003b: one hash-bound human allowance, confined to trial5 of the original run.
  if(now-Date.parse(s.started)>=3600000){
    // H-003c: one additional hash-bound allowance; H-003b and normal limits retained.
    if(s.humanTimeExtensionH003c){
    const extension=s.humanTimeExtensionH003c;
    need(extension&&extension.path===path.join(root,'output/internal-portal-evidence/sansu-common-portal-application/trial6/authorization.json'),'human judgment: time limit');
    const raw=fs.readFileSync(extension.path);need(hash(raw)===extension.sha256,'human authorization changed');
    const auth=JSON.parse(raw);
    const priorRaw=fs.readFileSync(path.join(path.dirname(extension.path),'original-run.json'));
    const priorJournal=fs.readFileSync(path.join(path.dirname(extension.path),'original-journal.jsonl'));
    need(hash(priorRaw)===auth.originalRunSha256&&hash(priorJournal)===auth.originalJournalSha256,'authorization original hashes changed');
    const prior=JSON.parse(priorRaw);
    need(JSON.stringify(prior)===priorJournal.toString().trim().split('\n').at(-1),'authorization original journal mismatch');
    const events=s.history.filter(h=>h.action==='authorize-h003c-trial6');
    need(auth.task==='H-003c'&&auth.runId===s.id&&auth.trial===6&&auth.uses===1&&auth.additionalRepairs===1&&extension.consumed===1&&events.length===1,'human allowance exhausted or invalid');
    const event=events[0];
    need(event.authorizationHash===extension.sha256&&event.originalRunSha256===auth.originalRunSha256&&event.originalJournalSha256===auth.originalJournalSha256,'authorization history mismatch');
    need(prior.trial===5&&prior.repairs===3&&prior.failed?.cause==='environment'&&!prior.active&&s.trial===6&&s.version===prior.version+1&&s.repairs===4,'human allowance trial boundary');
    need(s.started===prior.started&&auth.originalStarted===prior.started&&s.candidate===prior.candidate&&auth.candidate===prior.candidate,'human allowance candidate/start changed');
    need(JSON.stringify(s.history.slice(0,prior.history.length))===JSON.stringify(prior.history)&&s.history[prior.history.length]===event,'human allowance history changed');
    need(auth.deadlineMinutes===120&&Date.parse(auth.deadline)===Date.parse(auth.at)+120*60000&&now>=Date.parse(auth.at)&&now<Date.parse(auth.deadline),'human judgment: additional deadline');
    need(!s.history.slice(prior.history.length+1).some(h=>h.action==='repair'||h.trial!==6),'human allowance reused');
    need(JSON.stringify(s.humanTimeExtension)===JSON.stringify(prior.humanTimeExtension)&&JSON.stringify(s.authorization)===JSON.stringify(prior.authorization),'earlier human allowances changed');
    }else{
    const extension=s.humanTimeExtension;
    need(extension&&extension.path===path.join(root,'output/internal-portal-evidence/sansu-common-portal-application/trial5/authorization.json'),'human judgment: time limit');
    const raw=fs.readFileSync(extension.path);need(hash(raw)===extension.sha256,'human authorization changed');
    const auth=JSON.parse(raw);
    const priorRaw=fs.readFileSync(path.join(path.dirname(extension.path),'original-run.json'));
    const priorJournal=fs.readFileSync(path.join(path.dirname(extension.path),'original-journal.jsonl'));
    need(hash(priorRaw)===auth.originalRunSha256&&hash(priorJournal)===auth.originalJournalSha256,'authorization original hashes changed');
    const prior=JSON.parse(priorRaw);
    need(JSON.stringify(prior)===priorJournal.toString().trim().split('\n').at(-1),'authorization original journal mismatch');
    const events=s.history.filter(h=>h.action==='authorize-h003b-trial5');
    need(auth.task==='H-003b'&&auth.runId===s.id&&auth.trial===5&&auth.uses===1&&auth.additionalRepairs===1&&extension.consumed===1&&events.length===1,'human allowance exhausted or invalid');
    const event=events[0];
    need(event.authorizationHash===extension.sha256&&event.originalRunSha256===auth.originalRunSha256&&event.originalJournalSha256===auth.originalJournalSha256,'authorization history mismatch');
    need(prior.trial===4&&prior.repairs===2&&prior.failed?.cause==='environment'&&!prior.active&&s.trial===5&&s.version===prior.version+1&&s.repairs===3,'human allowance trial boundary');
    need(s.started===prior.started&&auth.originalStarted===prior.started&&s.candidate===prior.candidate&&auth.candidate===prior.candidate,'human allowance candidate/start changed');
    need(JSON.stringify(s.history.slice(0,prior.history.length))===JSON.stringify(prior.history)&&s.history[prior.history.length]===event,'human allowance history changed');
    need(auth.deadlineMinutes===120&&Date.parse(auth.deadline)===Date.parse(auth.at)+120*60000&&now>=Date.parse(auth.at)&&now<Date.parse(auth.deadline),'human judgment: additional deadline');
    need(!s.history.slice(prior.history.length+1).some(h=>h.action==='repair'||h.trial!==5),'human allowance reused');
    }
  }
  need(s.id==='sansu-common-portal-application','different run rejected');
  validateHistory(s);
  if(op==='repair'){
    need(s.failed&&!s.active,'no failure to repair');
    need(s.failed.cause!=='permission','human permission required');
    need(s.repairs<2 && s.trial<3,'human judgment: repair limit');
    need(s.history.filter(a=>a.result==='FAIL'&&a.cause===s.failed.cause).length<2,'human judgment: repeated cause');
    need(current!==s.candidate,'version change required');
    s.history.push({action:'repair',cause:s.failed.cause,returnTo:s.failed.returnTo,from:s.candidate,to:current});
    s.repairs++;s.trial++;s.version++;s.candidate=current;s.passed=[];s.failed=null;return s;
  }
  need(current===s.candidate,'candidate changed; old evidence invalid');
  need(!s.failed,'predecessor failed');
  if(op==='start'){
    const [stage,actor]=args;
    need(!s.active,'already running');need(stages[s.passed.length]===stage,'dependency or parent completion rejected');
    need(actor&&actor.trim(),'actor required');need(stage!=='review'||actor!==s.implementer,'self review rejected');
    s.active={stage,actor,token:randomUUID(),trial:s.trial,candidate:current,version:s.version,started:new Date(now).toISOString()};
    s.history.push({...s.active,action:'start'});return s;
  }
  if(op==='finish'){
    const [receipt]=args;need(s.active,'not running');
    const e=JSON.parse(fs.readFileSync(receipt));const a=s.active;
    for(const k of ['stage','actor','token','trial','candidate','version'])need(e[k]===a[k],`stale ${k}`);
    need(Date.parse(e.at)>=Date.parse(a.started)&&Date.parse(e.at)<=now,'stale evidence time');
    need(['PASS','FAIL'].includes(e.result),'result required');
    need(Array.isArray(e.artifacts),'artifact manifest required');
    if(a.stage==='browser'&&e.result==='PASS')need(e.artifacts.filter(x=>x.path.endsWith('.png')).length>=28,'browser images missing');
    for(const item of e.artifacts)need(hash(fs.readFileSync(item.path))===item.sha,'artifact changed or missing');
    need(e.condition?.trim()&&e.log&&e.logHash,'condition and raw evidence required');
    need(path.dirname(path.resolve(e.log))===path.join(home,'evidence')&&path.basename(e.log).startsWith(a.token+'.'),'old raw evidence path');
    need(fs.statSync(e.log).mtimeMs>=Date.parse(a.started),'old raw evidence time');
    const raw=fs.readFileSync(e.log,'utf8');
    const identity=JSON.parse(raw.split('\n')[0]);
    for(const k of ['stage','token','trial','candidate','version'])need(identity[k]===a[k],`old raw evidence ${k}`);
    need(!s.history.some(h=>h.logHash===e.logHash),'raw evidence reused');
    need(hash(raw)===e.logHash,'raw log mismatch');
    if(e.result==='FAIL')need(['input','specification','implementation','environment','unknown','permission'].includes(e.cause)&&e.reason?.trim(),'failure cause required');
    if(e.result==='PASS')s.passed.push(a.stage);
    else s.failed={cause:e.cause,reason:e.reason,returnTo:({implementation:'generate',environment:'machine'})[e.cause]||'scope'};
    s.history.push({...a,result:e.result,cause:e.cause,condition:e.condition,receipt,receiptHash:hash(fs.readFileSync(receipt)),logHash:e.logHash});s.active=null;return s;
  }
  throw Error('reset, different run and parent complete are unsupported');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{
    const [op,...args]=process.argv.slice(2);fs.mkdirSync(home,{recursive:true});
    const lock=fs.openSync(path.join(home,'lock'),'wx');
    try{
      let s;
      if(op==='init'){
        need(!fs.existsSync(file)&&!fs.existsSync(path.join(home,'journal.jsonl')),'existing run: reset rejected');
        s={id:'sansu-common-portal-application',contract:'sansu-portal-local-v1',started:new Date().toISOString(),implementer:'Codex',candidate:candidate(),version:1,trial:1,repairs:0,passed:[],history:[{action:'init'}],active:null,failed:null};
      }else{
        s=JSON.parse(fs.readFileSync(file));
        const journal=fs.readFileSync(path.join(home,'journal.jsonl'),'utf8').trim().split('\n');
        need(hash(JSON.stringify(s))===hash(journal.at(-1)),'history reset or run edit rejected');
        if(op==='status'){validateHistory(s);textStatus(s);process.exitCode=0;}
        else s=step(s,op,args,candidate());
      }
      if(op!=='status'){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,2));fs.renameSync(tmp,file);fs.appendFileSync(path.join(home,'journal.jsonl'),JSON.stringify(s)+'\n');textStatus(s);}
    }finally{fs.closeSync(lock);fs.unlinkSync(path.join(home,'lock'));}
  }catch(e){console.error(e.message);process.exitCode=2;}
}
function textStatus(s){console.log(JSON.stringify({id:s.id,trial:s.trial,repairs:s.repairs,version:s.version,candidate:s.candidate,passed:s.passed,active:s.active,failed:s.failed,started:s.started},null,2));}
