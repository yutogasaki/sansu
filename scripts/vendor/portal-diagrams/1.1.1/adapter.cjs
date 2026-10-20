'use strict';
// Extracted from JISHU's portal-development-flows and diagram parser (2026-10-19).
// Read-only projection: sources and records are pinned, never updated here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=value=>typeof value==='string'&&/^[A-Za-z_][\w-]*$/.test(value);
function pin(){
 const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'lock.json'),'utf8'));
 const entries=Object.entries(lock.files),runtime=entries.filter(([file])=>file.startsWith('node_modules/'));
 // Validate every fixed source and npm lock before a first-install download.
 for(const [file,sha]of entries.filter(([file])=>!file.startsWith('node_modules/')))if(hash(fs.readFileSync(path.join(__dirname,file)))!==sha)throw Error('DIAGRAM_PIN: '+file);
 const modules=path.join(__dirname,'node_modules'),guard=path.join(__dirname,'.diagram-install-lock');
 function waitForPreparation(){
  try{const state=fs.lstatSync(guard);if(state.isSymbolicLink()||!state.isDirectory())throw Error('DIAGRAM_DEPENDENCY_LOCK');}catch(error){if(error.code!=='ENOENT')throw error;} // The winning installer may already have removed its guard.
  const until=Date.now()+65000,pause=new Int32Array(new SharedArrayBuffer(4));
  while(fs.existsSync(guard)){if(Date.now()>until)throw Error('DIAGRAM_DEPENDENCY_BUSY: inspect interrupted setup in '+__dirname);Atomics.wait(pause,0,0,50);}
  if(!fs.existsSync(modules))throw Error('DIAGRAM_DEPENDENCY_SETUP: initializer failed in '+__dirname);
 }
 if(runtime.length){
  try{if(fs.lstatSync(modules).isSymbolicLink())throw Error('DIAGRAM_DEPENDENCY_LINK');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(fs.existsSync(guard))waitForPreparation();
  else if(!fs.existsSync(modules)){
   let owns=false;try{fs.mkdirSync(guard);owns=true;}catch(error){if(error.code!=='EEXIST')throw error;}
   if(!owns)waitForPreparation();
   else try{
    process.stderr.write('Preparing locked portal diagram dependency (scripts disabled).\n');
    execFileSync('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:__dirname,stdio:['ignore','pipe','pipe'],timeout:60000});
   }catch{throw Error('DIAGRAM_DEPENDENCY_SETUP: run npm ci --ignore-scripts in '+__dirname);}
   finally{if(owns)fs.rmdirSync(guard);}
  }
 }
 // Existing partial or changed installs fail; they are never silently repaired.
 for(const [file,sha]of runtime)if(hash(fs.readFileSync(path.join(__dirname,file)))!==sha)throw Error('DIAGRAM_PIN: '+file);
 return lock;
}
function localFile(root,rel){
 if(typeof rel!=='string'||!rel||path.isAbsolute(rel)||rel.includes('\\')||rel.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('DIAGRAM_SOURCE_PATH');
 const base=fs.realpathSync(root),file=path.join(base,rel);
 for(let p=file;p!==base;p=path.dirname(p))if(fs.lstatSync(p).isSymbolicLink())throw Error('DIAGRAM_SOURCE_SYMLINK');
 if(!fs.statSync(file).isFile())throw Error('DIAGRAM_SOURCE_FILE');
 return file;
}
function sourcePart(text,ref){
 text=text.replaceAll('\r\n','\n');if(!ref.heading)return text;
 if(!/^#+ /.test(ref.heading))throw Error('DIAGRAM_SOURCE_HEADING');
 const lines=text.split('\n'),matches=lines.flatMap((line,i)=>line===ref.heading?[i]:[]);
 if(matches.length!==1)throw Error('DIAGRAM_SOURCE_SECTION: '+ref.id);
 const start=matches[0],level=ref.heading.match(/^#+/)[0].length;let end=start+1;
 for(;end<lines.length;end++){const m=lines[end].match(/^(#+) /);if(m&&m[1].length<=level)break;}
 return lines.slice(start,end).join('\n');
}
function parse(code){
 const lines=code.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('%%'));
 const header=lines.shift(),state=header==='stateDiagram-v2',direction=state?'TB':header?.match(/^(?:flowchart|graph) (TD|TB|LR|RL|BT)$/)?.[1];
 if(!direction)throw Error('DIAGRAM_SYNTAX_HEADER');
 const nodes=new Map(),edges=[];
 const node=(key,label)=>{const old=nodes.get(key);if(old&&label&&old!==key&&old!==label)throw Error('DIAGRAM_LABEL_CONFLICT');nodes.set(key,label||old||key);};
 const endpoint='([A-Za-z_][\\w-]*)(?:\\[([^\\]\\r\\n]+)\\])?';
 const flowEdge=new RegExp('^'+endpoint+'\\s*(<-->|-->|---|-\\.->)\\s*(?:\\|([^|\\r\\n]+)\\|\\s*)?'+endpoint+'\\s*;?$');
 for(const line of lines){
  if(state){
   const e=line.match(/^(\[\*\]|[^\s:]+)\s*-->\s*(\[\*\]|[^\s:]+)(?:\s*:\s*(.+))?$/);
   if(!e)throw Error('DIAGRAM_SYNTAX_STATEMENT: '+line);
   const from=e[1]==='[*]'?'__start':e[1],to=e[2]==='[*]'?'__end':e[2];node(from);node(to);edges.push({from,to,label:e[3]||'',directed:true});continue;
  }
  const e=line.match(flowEdge);
  if(e){node(e[1],e[2]);node(e[5],e[6]);edges.push({from:e[1],to:e[5],label:e[4]||'',directed:e[3]!=='---',...(e[3]==='<-->'?{bidirectional:true}:{}),...(e[3]==='-.->'?{dashed:true}:{})});continue;}
  const isolated=line.match(/^([A-Za-z_][\w-]*)\[([^\]\r\n]+)\]\s*;?$/);
  if(!isolated)throw Error('DIAGRAM_SYNTAX_STATEMENT: '+line);
  node(isolated[1],isolated[2]);
 }
 return {kind:state?'stateDiagram-v2':'flowchart',direction,nodes:[...nodes].map(([id,label])=>({id,label})),edges};
}
function mermaidOf(d){
 const label=k=>`${k}[${d.nodes.find(n=>n.id===k).label}]`;
 return `flowchart ${d.direction||'TD'}\n`+d.nodes.map(n=>'    '+label(n.id)).join('\n')+'\n'+d.edges.map(e=>`    ${label(e.from)} ${e.kind==='related'?'---':e.kind==='bidirectional'?'<-->':e.dashed?'-.->':'-->'}${e.label?'|'+e.label+'|':''} ${label(e.to)}`).join('\n')+'\n';
}
function roundTrip(d,code){
 const parsed=parse(code),sort=rows=>rows.map(row=>JSON.stringify(row)).sort();
 const edge=e=>[...(e.directed===false||e.bidirectional?[e.from,e.to].sort():[e.from,e.to]),e.directed!==false,!!e.bidirectional,!!e.dashed,e.label];
 if(parsed.direction!==(d.direction||'TD')||JSON.stringify(sort(parsed.nodes.map(n=>[n.id,n.label])))!==JSON.stringify(sort(d.nodes.map(n=>[n.id,n.label])))||JSON.stringify(sort(parsed.edges.map(edge)))!==JSON.stringify(sort(d.edges.map(e=>edge({...e,directed:e.kind!=='related',bidirectional:e.kind==='bidirectional'})))))throw Error('DIAGRAM_ROUND_TRIP');
 return parsed;
}
const safeHref=href=>typeof href==='string'&&href&&!/[\u0000-\u0020\\]/.test(href)&&!href.startsWith('//')&&!/^[a-z][a-z0-9+.-]*:/i.test(href);
function resolveDefinition({root,definition}){
 if(definition?.schemaVersion!==1||!Array.isArray(definition.sources)||!Array.isArray(definition.diagrams))throw Error('DIAGRAM_SCHEMA');
 const refs=new Set();
 for(const s of definition.sources){if(!id(s.id)||refs.has(s.id)||!safeHref(s.href))throw Error('DIAGRAM_SOURCE');refs.add(s.id);if(hash(sourcePart(fs.readFileSync(localFile(root,s.path),'utf8'),s))!==s.sha256)throw Error('DIAGRAM_SOURCE_STALE: '+s.id);}
 for(const r of definition.records||[]){
  const data=JSON.parse(fs.readFileSync(localFile(root,r.path),'utf8')),rows=data[r.collection];
  if(!Array.isArray(rows)||!Array.isArray(r.fields)||!r.fields.length)throw Error('DIAGRAM_RECORD');
  const matches=rows.filter(row=>row[r.key]===r.value);
  if(matches.length!==1||r.fields.some(k=>!Object.hasOwn(matches[0],k)))throw Error('DIAGRAM_RECORD_MISSING');
  if(hash(JSON.stringify(Object.fromEntries(r.fields.map(k=>[k,matches[0][k]]))))!==r.sha256)throw Error('DIAGRAM_RECORD_STALE: '+r.value);
 }
 const diagrams=new Set();
 for(const d of definition.diagrams){
  if(!id(d.id)||diagrams.has(d.id)||typeof d.title!=='string'||!d.title||!Array.isArray(d.nodes)||!d.nodes.length||!Array.isArray(d.edges))throw Error('DIAGRAM_DEFINITION');diagrams.add(d.id);
  const nodes=new Set(),edges=new Set();
  for(const n of d.nodes){if(!id(n.id)||nodes.has(n.id)||typeof n.label!=='string'||!n.label||/[\[\]|\r\n]/.test(n.label)||!refs.has(n.sourceRef)||(n.href&&!safeHref(n.href)))throw Error('DIAGRAM_NODE');nodes.add(n.id);}
  for(const e of d.edges){if(!id(e.id)||edges.has(e.id)||!nodes.has(e.from)||!nodes.has(e.to)||!['related','dependency','procedure','evidence_for_decision','directed','bidirectional','contains','transition'].includes(e.kind)||typeof e.label!=='string'||/[\[\]|\r\n]/.test(e.label))throw Error('DIAGRAM_EDGE');edges.add(e.id);}
  if(d.sequence&&(!Array.isArray(d.sequence)||new Set(d.sequence).size!==d.sequence.length||d.sequence.some(n=>!nodes.has(n))))throw Error('DIAGRAM_SEQUENCE');
 }
 const copy=JSON.parse(JSON.stringify(definition));
 return {...copy,version:'1.1.1',sourceFingerprint:hash(JSON.stringify(definition)),diagrams:copy.diagrams.map(d=>{const code=mermaidOf(d);roundTrip(d,code);return {...d,code,codeSha256:hash(code)};})};
}
function renderFigure(d,model,{base='data/diagrams/'}={}){
 if(!safeHref(base))throw Error('DIAGRAM_ASSET_PATH');
 const labels=Object.fromEntries(d.nodes.map(n=>[n.id,n.label])),sources=new Map(model.sources.map(s=>[s.id,s]));
 const node=n=>`<section><h3>${n.href?`<a href="${esc(n.href)}">${esc(n.label)}</a>`:esc(n.label)}</h3>${n.note?`<p>${esc(n.note)}</p>`:''}<p><a href="${esc(sources.get(n.sourceRef).href)}">根拠を読む →</a></p></section>`;
 const nodes=d.sequence?[...d.sequence.map(k=>d.nodes.find(n=>n.id===k)),...d.nodes.filter(n=>!d.sequence.includes(n.id))]:d.nodes;
 return `<figure class="pd-diagram${d.sequence?' pd-procedure':''}" id="${esc(d.id)}"><figcaption><h2>${esc(d.title)}</h2><p>${esc(d.intro||'')}</p></figcaption><button type="button" class="pd-zoom" aria-controls="${esc(d.id)}-graphic" aria-pressed="false">原寸で読む</button><div class="pd-graphic" id="${esc(d.id)}-graphic" role="region" tabindex="0" aria-label="${esc(d.title)}の図"><img src="${esc(base+d.id)}.svg" width="${d.width}" height="${d.height}" alt="${esc(d.title)}。同じ関係を続く文章で読めます。"></div><div class="pd-nodes">${nodes.map(node).join('')}</div><section class="pd-relations"><h3>同じ関係を文章で読む</h3><ul>${d.edges.map(e=>`<li data-diagram-edge="${esc(e.id)}" data-edge-kind="${e.kind}">${esc(labels[e.from])}${e.kind==='related'?' —（関連のみ） ':e.kind==='bidirectional'?' ↔ ':e.dashed?' ⇢（点線） ':' → '}${esc(labels[e.to])}：${esc(e.label)}</li>`).join('')}</ul></section><p>${esc(d.note||'')}</p><details><summary>図の定義・根拠と版</summary><p>図の表示は実行・採用・公開の承認を変更しません。</p><pre>${esc(d.code)}</pre><p><a href="${esc(base+d.id)}.mmd">Mermaidソース</a> · <a href="${esc(base+d.id)}.json">同じモデルと根拠（JSON）</a></p></details></figure>`;
}
const cache=new Map();
function verifyProjection(d,model,html,svg){
 const headings=[...html.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));
 for(const n of d.nodes)if(!headings.includes(esc(n.label)))throw Error('DIAGRAM_HTML_NODE: '+n.id);
 const rows=[...html.matchAll(/<li data-diagram-edge="([^"]+)" data-edge-kind="([^"]+)">([^<]*)<\/li>/g)];
 if(rows.length!==d.edges.length)throw Error('DIAGRAM_HTML_EDGES');
 const labels=Object.fromEntries(d.nodes.map(n=>[n.id,n.label]));
 for(const e of d.edges){const row=rows.find(r=>r[1]===e.id),expected=esc(labels[e.from])+(e.kind==='related'?' —（関連のみ） ':e.kind==='bidirectional'?' ↔ ':e.dashed?' ⇢（点線） ':' → ')+esc(labels[e.to])+'：'+esc(e.label);if(!row||row[2]!==e.kind||row[3]!==expected)throw Error('DIAGRAM_HTML_RELATION: '+e.id);}
 for(const n of d.nodes){if(!svg.replace(/&#45;/g,'-').includes('<title>'+n.id+'</title>'))throw Error('DIAGRAM_SVG_NODE: '+n.id);if(!html.includes('href="'+esc(model.sources.find(s=>s.id===n.sourceRef).href)+'"'))throw Error('DIAGRAM_HTML_SOURCE');}
 const xml=s=>s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
 const visible=s=>xml([...s.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1]).join('')).replace(/\s/g,'');
 const groups=[...svg.matchAll(/<g\b[^>]*class="(node|edge)"[^>]*>([\s\S]*?)<\/g>/g)];
 for(const n of d.nodes){const g=groups.find(g=>g[1]==='node'&&xml(g[2].match(/<title>(.*?)<\/title>/)?.[1]||'')===n.id);if(!g||visible(g[2])!==n.label.replace(/\s/g,''))throw Error('DIAGRAM_SVG_LABEL: '+n.id);}
 const pending=d.edges.map(e=>({...e}));
 for(const g of groups.filter(g=>g[1]==='edge')){const title=xml(g[2].match(/<title>(.*?)<\/title>/)?.[1]||''),i=pending.findIndex(e=>title===e.from+'->'+e.to&&visible(g[2])===e.label.replace(/\s/g,'')&&/stroke-dasharray=/.test(g[2])===!!e.dashed);if(i<0)throw Error('DIAGRAM_SVG_EDGE_LABEL_STYLE');pending.splice(i,1);}
 if(pending.length)throw Error('DIAGRAM_SVG_EDGE_MISSING');
 const drawn=[...svg.matchAll(/<g\b[^>]*class="edge"[^>]*>([\s\S]*?)<\/g>/g)].map(m=>[m[1].match(/<title>(.*?)<\/title>/)?.[1].replace(/&#45;/g,'-').replace(/&gt;/g,'>'),(m[1].match(/<polygon\b/g)||[]).length]);
 const sort=xs=>xs.map(x=>JSON.stringify(x)).sort();
 if(JSON.stringify(sort(drawn))!==JSON.stringify(sort(d.edges.map(e=>[e.from+'->'+e.to,e.kind==='related'?0:e.kind==='bidirectional'?2:1]))))throw Error('DIAGRAM_SVG_DIRECTION');
 return true;
}
function build({root,definition}){
 const lock=pin(),model=resolveDefinition({root,definition}),key=hash(JSON.stringify(model.diagrams));
 let rendered=cache.get(key);
 if(!rendered){rendered=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'render.cjs')],{input:JSON.stringify(model.diagrams),encoding:'utf8',maxBuffer:8*1024*1024}));cache.set(key,rendered);}
 const files={};
 model.renderer=rendered.generator;model.componentFingerprint=hash(JSON.stringify(lock.files));
 model.diagrams.forEach((d,i)=>{const svg=rendered.diagrams[i];Object.assign(d,{width:svg.width,height:svg.height});verifyProjection(d,model,renderFigure(d,model),svg.svg);files[`data/diagrams/${d.id}.svg`]=svg.svg;files[`data/diagrams/${d.id}.mmd`]=d.code;files[`data/diagrams/${d.id}.json`]=JSON.stringify({...model,diagrams:[d]},null,2)+'\n';});
 files['data/diagrams/index.json']=JSON.stringify(model,null,2)+'\n';
 files['portal-diagrams.css']=fs.readFileSync(path.join(__dirname,'diagrams.css'),'utf8');files['portal-diagrams.js']=fs.readFileSync(path.join(__dirname,'diagrams.js'),'utf8');
 return {model,files,html:model.diagrams.map(d=>renderFigure(d,model)).join('')};
}
module.exports={build,pin,hash,sourcePart,parse,mermaidOf,roundTrip,resolveDefinition,renderFigure,verifyProjection};
