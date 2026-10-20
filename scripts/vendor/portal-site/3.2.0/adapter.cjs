'use strict';
// Generic repo adapter: the repo's existing portal data → one site model.
// Reads only. Inputs, in order of preference:
//   portal/index.html script#portal-data   (standard v2 model, optional)
//   portal/data/project.json               (standard v1 model: summary, status, tasks, decisions, docs)
//   portal/data/portal-flow.json | docs/portal/flow.json   (flow standard: stages)
//   portal/data/ui-component.json ledger   (every internal page with title/source/category)
//   portal/read/*.html <main>              (readable document bodies)
// A repo may pass `options` to state what data cannot say (entrances, pins, tiers).
const fs=require('node:fs'),path=require('node:path');
const C=require('./classify.cjs');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rel=(from,to)=>path.relative(path.dirname(from),to).split(path.sep).join('/');
const read=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):null;
const json=f=>{const s=read(f);return s?JSON.parse(s):null;};
const dateOf=s=>{const m=String(s||'').match(/(20\d\d)-?(\d\d)-?(\d\d)/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;};
const MAIN=/^(?:index|work|documents|pages|search|decisions|library)\.html$/;
// Old-portal screens that the five fixed pages replace (overview, task board, doc index…).
const DUPLICATE=/概要|タスク|Tasks|ドキュメント入口|Docs Index|Skills Index|スキル入口|共通ポータル|AI開発環境|仕事一覧|開発の手順|技術的な根拠|これからの計画|^\S+\s*[·｜|]\s*(?:計画|運用|役割|仕様と実装|資料)$|進み具合/;

function v2Model(portal,readFile=read){
 const m=(readFile(path.join(portal,'index.html'))||'').match(/<script[^>]*id="portal-data"[^>]*>([\s\S]*?)<\/script>/);
 return m?JSON.parse(m[1]):null;
}
const V2_GROUP={ready:'ready',preparing:'preparing',paused:'preparing',received:'done',applied:'done',cancelled:'done'};
const V2_STATE={ready:'review',preparing:'idle',paused:'blocked',received:'doing',applied:'done',cancelled:'done'};
const V2_TEXT={ready:'回答待ち',preparing:'準備中',paused:'止まっている',received:'受領',applied:'反映済み',cancelled:'取り消し'};
function v1Decision(text){
 const s=String(text||'');
 if(/判断待ち|回答待ち|人の判断|Yuの判断|needs-human/i.test(s))return 'ready';
 if(/^決定済み|反映済み|完了|applied|取り消し|cancel/i.test(s))return 'done';
 return 'preparing';
}
const cleanTitle=s=>C.title(String(s||'').replace(/\s*\[[^\]]+\]\s*$/,'')).title;

// Readable body of an existing reader page, re-homed next to the new page.
function readBody(srcFile,outFile,linkFor,readFile=read){
 const html=readFile(srcFile)||'',main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);if(!main)return {html:'',toc:[]};
 let body=main[1].replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<(form|nav|dialog)\b[\s\S]*?<\/\1>/gi,'').replace(/<h1\b[\s\S]*?<\/h1>/i,'').replace(/\s(?:on\w+|style)="[^"]*"/gi,'');
 body=body.replace(/\s(href|src)="([^"#][^"]*)"/gi,(all,attr,url)=>{
  if(/^(?:[a-z]+:|\/\/|data:)/i.test(url))return all;
  const [p,hash='']=url.split('#'),abs=path.resolve(path.dirname(srcFile),decodeURI(p)),target=linkFor(abs);
  return ` ${attr}="${esc(target||rel(outFile,abs))}${hash?'#'+hash:''}"`;
 });
 const toc=[],seen=new Set();let n=0;
 body=body.replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,(all,level,attrs,inner)=>{
  const text=inner.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();if(!text)return all;
  let id=(attrs.match(/\bid="([^"]+)"/)||[])[1];if(!id||seen.has(id)){id='s'+(++n);attrs=attrs.replace(/\bid="[^"]*"/,'')+` id="${id}"`;}
  seen.add(id);toc.push({id,text,level:+level});return `<h${level}${attrs}>${inner}</h${level}>`;
 });
 return {html:body,toc};
}

/**
 * @param {object} o
 * @param {string} o.root     repo root
 * @param {string} o.outDir   where this site's index.html will be written
 * @param {object} [o.options] {entrances:[{title,purpose,href,image}], pins:[source], tiers:{source:'list'|'link'|'omit'}, legacyHref, skipDocs, tools:{path:{summary}}}
 */
function siteModel({root,outDir,options={}}){
 const diskRead=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):null;
 const read=f=>{const rel=path.relative(path.join(root,'portal'),f).split(path.sep).join('/');return options.inputFiles?.has(rel)?Buffer.from(options.inputFiles.get(rel)).toString():diskRead(f);};
 const json=f=>{const s=read(f);return s?JSON.parse(s):null;};
 const portal=path.join(root,'portal'),v1=json(path.join(portal,'data/project.json'))||{},v2=v2Model(portal,read);
 const ledger=json(path.join(portal,'data/ui-component.json'))?.ledger||[];
 const flowData=json(path.join(portal,'data/portal-flow.json'))||json(path.join(root,'docs/portal/flow.json'));
 const backlog=json(path.join(root,'docs/tasks/backlog.json'));
 const out=f=>path.join(outDir,f),fromIndex=to=>rel(out('index.html'),to);
 const pins=new Set((options.pins||v1.docs||[]).map(String)),aiDeclared=new Set((v1.ai||[]).map(String));
 // Ledgers without source paths: recover them from the unification registry.
 const registry=json(path.join(portal,'data/unification.json'))||{};
 const sourceOf=new Map([...(registry.documents||[]),...(registry.pages||[])].filter(r=>r.target&&r.source).map(r=>[r.target,r.source]));
 for(const p of ledger)if(!p.source&&sourceOf.has(p.path))p.source=sourceOf.get(p.path);

 // Documents: every ledger entry once, then tiered.
 // "In use" = the repo's own entry documents and what they link to (two hops).
 const curated=new Set(pins),mdLinks=src=>{const md=read(path.join(root,src))||'',out=[];for(const m of md.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)){if(/^[a-z]+:/i.test(m[1]))continue;out.push(path.posix.normalize(path.posix.join(path.posix.dirname(src),decodeURI(m[1]))));}return out;};
 let frontier=[...pins];for(let hop=0;hop<2;hop++){const next=[];for(const src of frontier)for(const l of mdLinks(src))if(!curated.has(l)){curated.add(l);next.push(l);}frontier=next;}
 const useCurated=!options.tiers&&curated.size>=6;
 const bySource=new Map();
 for(const p of options.skipDocs?[]:ledger){
  if(MAIN.test(p.path)||/^(?:#|https?:)/.test(p.path)||p.title==='根拠の原文')continue;
  const key=p.source&&!/^現在の正本から/.test(p.source)?p.source:p.path,prev=bySource.get(key);
  if(prev&&!/^read\//.test(p.path))continue;
  bySource.set(key,p);
 }
 const docs=[];let order=0;
 for(const p of bySource.values()){
  const t=C.title(p.title),src=p.source&&!/^現在の正本から/.test(p.source)?p.source:p.path,isRead=/^read\//.test(p.path);
  const file=path.join(root,src),md=/\.md$/.test(src)?read(file)||'':'',fm=C.frontMatter(md),pinned=pins.has(src);
  let tier,cat;
  if(isRead){cat=p.category==='出典・アクセス条件'?'archive':aiDeclared.has(src)?'ai':C.category({title:t.title,source:src,commonCategory:fm.type});tier=C.tier({source:src,cat,pinned:pinned||aiDeclared.has(src),tier:options.tiers?.[src]||fm.tier});if(tier==='list'&&useCurated&&!curated.has(src))tier='link';}
  else{cat='tool';tier=options.tiers?.[src]||(DUPLICATE.test(p.title)||/exclusions|retained|^references\/|\/records\//.test(p.path)?'omit':/20\d\d-?\d\d-?\d\d/.test(p.path)?'link':'tool');}
  if(tier==='omit')continue;
  const opening=md.replace(/^---\n[\s\S]*?\n---\n/,'').split(/\n\s*\n/).map(b=>b.trim()).find(b=>b&&!/^(?:#|\||!\[|<|```|[-*] )/.test(b))||'';
  const toolNote=!isRead&&options.tools?.[p.path];
  const summary=toolNote?{text:toolNote.summary||toolNote,own:true}:fm.summary?{text:fm.summary,own:true}:opening?{text:opening.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'').replace(/\s+/g,' ').slice(0,160)+(opening.length>160?'…':''),own:false}:null;
  const projectName=String(v1.title||path.basename(root)).toLowerCase(),parts=t.title.split(/\s*[·｜|]\s*/).filter(x=>x&&x.toLowerCase()!==projectName&&!/^ayami ballet$|^sansu$/i.test(x));
  docs.push({key:p.path,title:parts.join('・')||t.title,id:t.id,cat,tier,type:fm.type||cat,status:fm.status||null,summary,origCategory:p.category||'未分類',source:src,sourceName:path.basename(src),
   date:fm.updated||dateOf(src)||dateOf(p.path)||dateOf(p.title)||(fs.existsSync(file)?fs.statSync(file).mtime.toISOString().slice(0,10):null),order:order++,pinned,
   href:isRead?'doc/'+path.basename(p.path):fromIndex(path.join(portal,p.path)),originalHref:null,read:isRead});
 }
 const byAbs=new Map(docs.filter(d=>d.read).map(d=>[path.join(portal,d.key),d]));
 for(const d of docs)if(d.read){
  const o=out(d.href),body=readBody(path.join(portal,d.key),o,abs=>{const x=byAbs.get(abs);return x?rel(o,out(x.href)):null;},read);
  Object.assign(d,body,{originalHref:rel(o,path.join(portal,d.key))});d.shape=C.shape(d.type,body.toc.map(h=>h.text));
 }
 const docBySource=new Map(docs.map(d=>[d.source,d]));

 // Tasks: v1 tasks, enriched by a richer backlog when the repo keeps one.
 const rich=new Map((backlog?.tasks||[]).map(t=>[t.id,t]));
 const tasks=(v1.tasks||[]).map(t0=>{const t={...t0,...(rich.get(t0.id)||{})},tt=C.title(t.title);
  return {id:/^[A-Za-z]{1,8}-\d/.test(t.id)?t.id:(tt.id||null),anchor:'task-'+String(t.id).toLowerCase().replace(/[^a-z0-9-]+/g,'-'),title:cleanTitle(tt.title),status:t.status,state:C.state(t.status),
   owner:/未設定|未確認/.test(t.owner||'')?'':(t.owner||'').replace(/（[^）]*）/g,''),started:t.started,scope:t.scope||t.notes,completion:t.completion,verification:t.verification,evidenceSources:t.evidence||[],
   evidence:(t.evidence||[]).map(e=>{const d=docBySource.get(e);return {title:d?d.title:e,href:d&&d.read?d.href:null};})};});
 const order5=['blocked','review','doing','idle','done'];tasks.sort((a,b)=>order5.indexOf(a.state)-order5.indexOf(b.state));
 for(const d of docs)d.related=tasks.filter(t=>t.evidenceSources.includes(d.source)||(d.id&&t.id&&d.id.includes(t.id))).map(t=>({id:t.id||'仕事',title:t.title,href:'work.html#'+t.anchor}));

 // Decisions: v2 when present (it carries options and recommendations), else v1.
 const decisions=v2?.decisions?.length?v2.decisions.map(d=>({id:d.sourceRecord?.id||d.id,anchor:'d-'+d.id,title:d.human?.title||cleanTitle(d.title),reason:d.human?.reason||d.reason,recommendation:d.recommendation,impact:d.impact,options:d.options||[],facts:d.facts||[],evidence:d.evidence||[],group:V2_GROUP[d.state]||'preparing',state:V2_STATE[d.state]||'idle',stateText:V2_TEXT[d.state]||'準備中'}))
  :(v1.decisions||[]).map(d=>{const g=v1Decision(d.status);return {id:d.id,anchor:'d-'+d.id,title:cleanTitle(d.title),reason:d.notes||d.status,recommendation:d.recommendation||'',impact:d.risk||'',options:[],facts:[d.owner&&!/未設定/.test(d.owner)?{label:'担当',value:d.owner}:null,d.deadline?{label:'期限',value:d.deadline}:null].filter(Boolean),evidence:[],group:g,state:g==='ready'?'review':g==='done'?'done':'idle',stateText:g==='ready'?'回答待ち':g==='done'?'決まった':'準備中'};});

 // Flow: the flow standard's stages, else v2 nodes.
 const STAGE={done:'done',stopped:'blocked',blocked:'blocked',queued:'idle',active:'doing',doing:'doing',review:'review'};
 let flow=(flowData?.stages||[]).map(s=>({title:s.title,status:s.status,state:STAGE[s.status]||C.state(s.status),body:s.summary||s.body||''}));
 if(!flow.length)flow=(v2?.nodes||[]).map(n=>({title:n.title,body:n.body,status:n.status,state:/進行/.test(n.status)?'doing':/保留/.test(n.status)?'blocked':/未確認/.test(n.status)?'idle':C.state(n.status)}));
 const cur=flow.findIndex(n=>n.state!=='done');if(cur>=0)flow[cur].current=true;

 const ov=v2?.overview,blocked=tasks.find(t=>t.state==='blocked');
 const overview={goal:ov?.goal||v1.summary||'',progress:ov?.progress||v1.status||'',blocker:ov?.blocker||(blocked?blocked.title:''),next:ov?.plan||ov?.decision||v1.nextAction||'',state:blocked&&!tasks.some(t=>t.state==='doing')?'blocked':'doing'};
 const entrances=options.entrances||(v2?.artifacts||[]).filter(a=>a.entrance).map(a=>({title:a.title,purpose:a.purpose,href:a.href,image:a.preview?fromIndex(path.join(portal,a.preview)):null}));
 const pinned=docs.filter(d=>d.pinned&&d.tier==='list'&&d.cat!=='ai').slice(0,6);
 // AI environment: declared files first, then skills and memory found in the repo.
 const aiFiles=new Set(aiDeclared);
 for(const base of ['skills','.agents/skills','.claude/skills']){const dir=path.join(root,base);if(fs.existsSync(dir))for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory()&&fs.existsSync(path.join(dir,e.name,'SKILL.md')))aiFiles.add(base+'/'+e.name+'/SKILL.md');}
 for(const base of ['.agents/memory','memory']){const dir=path.join(root,base);if(fs.existsSync(dir))for(const f of fs.readdirSync(dir))if(f.endsWith('.md'))aiFiles.add(base+'/'+f);}
 for(const f of ['AGENTS.md','CLAUDE.md'])if(fs.existsSync(path.join(root,f)))aiFiles.add(f);
 const kindOf=src=>/SKILL\.md$/.test(src)?'スキル':/memory\//.test(src)?'記憶':/(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(src)?'AIへの指示':/CONSTITUTION|contract|policy/i.test(src)?'決まり':'入口';
 const ai=[...aiFiles].filter(src=>fs.existsSync(path.join(root,src))).map(src=>{const d=docBySource.get(src),md=read(path.join(root,src))||'',fm=C.frontMatter(md);
  const title=d?.title||fm.name||(md.match(/^#\s+(.+)$/m)||[])[1]||path.basename(src);
  return {source:src,kind:kindOf(src),title:String(title).trim(),summary:fm.description||d?.summary?.text||'',href:d&&d.read?d.href:fromIndex(path.join(root,src)),page:!!(d&&d.read)};})
  .sort((a,b)=>['AIへの指示','決まり','入口','スキル','記憶'].indexOf(a.kind)-['AIへの指示','決まり','入口','スキル','記憶'].indexOf(b.kind)||(b.page?1:0)-(a.page?1:0));
 // The same skill kept for two agents (.agents/ and .claude/) is one row.
 const seenSkill=new Set();for(let i=ai.length-1;i>=0;i--)ai[i].skill=ai[i].kind==='スキル'?ai[i].source.split('/').at(-2):null;
 const aiRows=ai.filter(a=>{if(!a.skill)return true;if(seenSkill.has(a.skill))return false;seenSkill.add(a.skill);return true;});
 for(const d of docs)if(d.cat==='ai'&&d.tier==='list'&&!aiRows.some(a=>a.source===d.source))aiRows.push({source:d.source,kind:'入口',title:d.title,summary:d.summary?.text||'',href:d.href,page:true});
 return require('./references.cjs').connect({title:v1.title||v2?.title||path.basename(root),checkedAt:v1.lastChecked||v2?.checkedAt,overview,entrances,flow,tasks,decisions,docs,pinned,ai:aiRows,
  sources:'portal/data（project.json・ui-component.json・portal-flow.json）',legacyHref:options.legacyHref||fromIndex(path.join(portal,'index.html'))},options.referenceData);
}
module.exports={siteModel,readBody};
