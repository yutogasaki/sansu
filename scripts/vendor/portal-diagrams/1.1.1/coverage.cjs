'use strict';
// Additive read-only coverage of explicitly published sources, never a crawler.
const fs=require('node:fs'),path=require('node:path');
const E=require('./adapter.cjs'),encode=x=>JSON.stringify(x,null,2)+'\n';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=x=>String(x).replaceAll('[','［').replaceAll(']','］').replaceAll('|','｜').replace(/[\r\n]+/g,' ');
function read(root,rel){
 if(typeof rel!=='string'||path.isAbsolute(rel)||/[\\:\x00-\x1f]/.test(rel)||rel.split('/').some(x=>!x||x==='.'||x==='..'||/^(private|sensitive|secrets?|credentials?)(?:[.-]|$)/i.test(x)))throw Error('DIAGRAM_COVERAGE_PATH');
 let f=fs.realpathSync(root);for(const part of rel.split('/')){f=path.join(f,part);if(fs.lstatSync(f).isSymbolicLink())throw Error('DIAGRAM_COVERAGE_SYMLINK');}
 if(!fs.statSync(f).isFile()||fs.statSync(f).size>16*1024*1024)throw Error('DIAGRAM_COVERAGE_FILE');return fs.readFileSync(f,'utf8');
}
function fromMermaid(code,{id,title,sourceRef,source,compatibility=[],labels={}}){
 let input=code;for(const item of compatibility){if(item.statement!=='end'||!item.reason||source!=='docs/maps/index.md')throw Error('DIAGRAM_COMPATIBILITY');const lines=input.trimEnd().split('\n');if(lines.at(-1)!=='end')throw Error('DIAGRAM_COMPATIBILITY_UNUSED');lines.pop();input=lines.join('\n');}
 const parsed=E.parse(input),mapping=new Map(parsed.nodes.map((n,i)=>[n.id,/^[A-Za-z_][\w-]*$/.test(n.id)?n.id:'state_'+i]));
 return {id,title,direction:parsed.direction,sourceCode:code,sourceCodeSha256:E.hash(code),compatibility,sourceKind:parsed.kind,intro:'元資料の関係を示します。実装・採用・現在の実行状態は元の記録で確認してください。',nodes:parsed.nodes.map(n=>({id:mapping.get(n.id),label:clean(labels[n.id]||({'__start':'開始','__end':'終了'})[n.id]||n.label),sourceRef,sourceId:n.id,sourceLabel:n.label,...(labels[n.id]?{labelOrigin:'元の状態IDを保持した表示用の読み替え'}:{})})),edges:parsed.edges.map((e,i)=>({...e,id:'edge_'+i,from:mapping.get(e.from),to:mapping.get(e.to),kind:e.bidirectional?'bidirectional':e.directed===false?'related':parsed.kind==='stateDiagram-v2'?'transition':'directed'}))};
}
function graphProjection(raw,{id,title,sourceRef}){
 const diagrams=[],make=(suffix,nodes,edges,intro)=>{if(!nodes.length)return;diagrams.push({id:id+'_'+suffix,title:title+'・'+intro,intro:(raw.as_of?raw.as_of+'時点の記録。現在の進捗は元の仕事正本で確認します。':'正本の条件を読取表示します。')+'所属の線は実行順や依存を意味しません。状態・未確認・停止理由は各項目と原文を参照します。',nodes:nodes.map(n=>({...n,label:clean(n.label),sourceRef})),edges,sourceData:raw});};
 if(Array.isArray(raw.diagrams))for(const d of raw.diagrams)diagrams.push({...d,id:id+'_'+d.id,sourceData:raw,nodes:d.nodes.map(n=>({...n,label:clean(n.label),sourceRef}))});
 if(Array.isArray(raw.nodes)&&Array.isArray(raw.edges)&&raw.edges.length){make('routes',raw.nodes.map(n=>({id:n.id,label:n.title||n.label||n.id,note:n.description||'',sourceRecord:n})),raw.edges.map((e,i)=>({...e,id:e.id||'route_'+i,label:e.label||'',kind:e.kind||'transition'})),'経路と条件');}
 if(raw.goals&&raw.stages&&raw.items&&raw.artifacts&&raw.checks){
  const groups=['goals','stages','items','artifacts','checks'],keys=new Map(),nodes=[];let i=0;
  for(const k of groups)for(const r of raw[k]){const id='node_'+i++;keys.set(k+':'+r.id,id);nodes.push({id,label:r.title||r.id,note:[r.status&&'状態：'+({active:'進行中',queued:'順番待ち',stopped:'停止中',done:'完了',unknown:'未確認',pass:'合格',fail:'不合格',proposal:'提案・未採用'}[r.status]||r.status),r.basis&&'根拠区分：'+(r.basis==='proposal'?'推測・提案':r.basis),r.why_stopped,r.result,r.next].filter(Boolean).join('。'),sourceRecord:r});}
  const edges=[],add=(from,to,label,kind='contains',extra={})=>{if(!from||!to)throw Error('DIAGRAM_GRAPH_REFERENCE');edges.push({...extra,id:'relation_'+edges.length,from,to,label,kind});};
  for(const [k,parent,field]of [['stages','goals','goal_id'],['items','stages','stage_id'],['artifacts','items','item_id'],['checks','artifacts','artifact_id']])for(const r of raw[k])add(keys.get(parent+':'+r[field]),keys.get(k+':'+r.id),'所属：'+({stages:'段階',items:'仕事',artifacts:'成果物',checks:'検査結果'})[k]);
  for(const d of raw.dependencies||[])add(keys.get('items:'+d.from),keys.get('items:'+d.to),(d.basis==='proposal'?'推測・提案：':'')+(d.reason||'先行条件'),'dependency',{sourceRecord:d});
  make('work',nodes,edges,'目標・仕事・成果と検査');
 }
 if(raw.dependencies&&!Array.isArray(raw.dependencies)&&raw.steps){
  const nodes=Object.keys(raw.dependencies).map(k=>({id:k,label:raw.steps[k]?.role?k+'：'+raw.steps[k].role:k,note:raw.steps[k]?.pass||'',sourceRecord:raw.steps[k]})),edges=[];
  for(const [to,deps]of Object.entries(raw.dependencies))for(const from of deps)edges.push({id:'requires_'+edges.length,from,to,label:'先行合格が必要（AND条件）',kind:'dependency'});
  make('contract',nodes,edges,'検証の先行条件');
 }
 return diagrams;
}
function enhance({root,files,prefix='',sources=[],graphs=[],template='work.html',attach=['work.html','knowledge.html'],compatibility={},labels={},retained=[],omitScripts=[]}){
 E.pin();const get=n=>files.has(prefix+n)?String(files.get(prefix+n)):null,set=(n,b)=>files.set(prefix+n,b);
 let registry={};if(get('data/unification.json'))registry=JSON.parse(get('data/unification.json'));
 const docs=(registry.documents||[]).filter(d=>typeof d.source==='string'&&d.source.endsWith('.md')&&!/(?:^|\/)(?:history|baseline|private|sensitive)\//.test(d.source));
 const declared=new Map(docs.map(d=>[d.source,{path:d.source,href:d.target}]));
 if(get('data/native-inputs.json'))for(const p of Object.keys(JSON.parse(get('data/native-inputs.json')).files||{}))if(p.endsWith('.md')&&!declared.has(p))declared.set(p,{path:p,href:'../'+p});
 if(get('data/integrated.json'))for(const r of JSON.parse(get('data/integrated.json')).records||[])if(r.source?.endsWith('.md')&&!declared.has(r.source))declared.set(r.source,{path:r.source,href:'../'+r.source});
 for(const s of sources)declared.set(s.path,s);
 const existing=get('data/diagrams/index.json')?JSON.parse(get('data/diagrams/index.json')):null;
 const refs=existing?.sources||[],diagrams=existing?.diagrams||[],inventory=(existing?.sources||[]).map(s=>({path:s.path,sha256:s.sha256,existingProjection:true}));
 for(const s of [...declared.values()].sort((a,b)=>a.path.localeCompare(b.path))){
  // Only existing declared repository files, never browser storage or private discovery.
  const text=read(root,s.path),blocks=[...text.matchAll(/^```mermaid[^\n]*\r?\n([\s\S]*?)^```\s*$/gm)];
  inventory.push({path:s.path,sha256:E.hash(text),mermaidBlocks:blocks.length});if(!blocks.length)continue;
  const ref='source_'+refs.length;refs.push({id:ref,path:s.path,href:s.href,sha256:E.hash(E.sourcePart(text,{}))});
  blocks.forEach((m,i)=>{const id='source_'+E.hash(s.path+'#'+i).slice(0,16);diagrams.push(fromMermaid(m[1],{id,title:(text.match(/^#\s+(.+)$/m)?.[1]||s.path)+'・図'+(i+1),sourceRef:ref,source:s.path,compatibility:compatibility[s.path]||[],labels}));});
 }
 for(const g of graphs){const text=read(root,g.path),raw=JSON.parse(text),ref='source_'+refs.length;refs.push({id:ref,path:g.path,href:g.href,sha256:E.hash(E.sourcePart(text,{}))});const found=graphProjection(raw,{id:g.id,title:g.title,sourceRef:ref});if(!found.length)throw Error('DIAGRAM_GRAPH_EMPTY: '+g.path);diagrams.push(...found);inventory.push({path:g.path,sha256:E.hash(text),graphProjections:found.length});}
 const result=diagrams.length?E.build({root,definition:{schemaVersion:1,sources:refs,diagrams}}):null;
 if(result){
  for(const [n,b]of Object.entries(result.files))set(n,b);
  let shell=get(template)||get('index.html');if(!shell||!/<main\b/.test(shell))throw Error('DIAGRAM_TEMPLATE');
  const intro='<header><h1>図と関係を読む</h1><p>同じ正本から図・文章・Mermaidを生成しています。所属・依存・状態遷移・双方向・点線を区別し、原文と状態を保持します。</p><p><a href="'+esc(template)+'">元の画面へ戻る</a></p></header>';
  shell=shell.replace(/<title>[\s\S]*?<\/title>/,'<title>図と関係を読む</title>').replace(/<main\b[^>]*>[\s\S]*?<\/main>/,()=>'<main id="main">'+intro+'<nav aria-label="図の一覧"><ul>'+result.model.diagrams.map(d=>'<li><a href="#'+d.id+'">'+esc(d.title)+'</a></li>').join('')+'</ul></nav>'+result.html+'</main>').replace('</head>','<link rel="stylesheet" href="portal-diagrams.css"></head>').replace('</body>','<script src="portal-diagrams.js" defer></script></body>');
  const anchors=new Set([...shell.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
  shell=shell.replace(/href=(["'])#([^"']+)\1/g,(all,q,anchor)=>anchors.has(anchor)?all:'href='+q+esc(template)+'#'+anchor+q);
  // Template-specific selection payloads are absent on the catalog page.
  shell=shell.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/g,(all,src)=>omitScripts.includes(src)?'':all);
  set('diagram-catalog.html',shell);
  for(const name of attach){const html=get(name);if(html)set(name,html.replace(/(<main\b[^>]*>)/, '$1<p class="diagram-catalog-link"><a href="diagram-catalog.html">図・関係の一覧と原文を読む →</a></p>'));}
  if(get('site-index.js')){const old=get('site-index.js'),m=old.match(/^window.PORTAL_INDEX=(.*);\s*$/s);if(m){const index=JSON.parse(m[1]);index.push({k:'図',t:'図と関係を読む',u:'diagram-catalog.html'});set('site-index.js','window.PORTAL_INDEX='+JSON.stringify(index)+';\n');}}
 }
 const retainedViews=retained.map(r=>({...r,sha256:E.hash(read(root,r.path)),treatment:'native-specialized-view-retained'}));
 const receipt={schemaVersion:1,retainedViews,component:'portal-diagrams/1.1.1',componentSha256:E.hash(JSON.stringify(E.pin())),scope:'declared-published-markdown-and-explicit-canonical-graphs',inventory,diagrams:result?.model.diagrams.map(d=>({id:d.id,nodes:d.nodes.length,edges:d.edges.length,sourceCodeSha256:d.sourceCodeSha256||d.codeSha256}))||[],originalViews:'retained; operational validation/approval engines unchanged',humanUnderstanding:'not-measured',physicalDevices:'not-tested'};
 set('data/diagram-coverage.json',encode(receipt));
 // Refresh only output fingerprints; canonical source tracking stays owned by caller.
 const mf=get('data/unification-manifest.json');if(mf){const m=JSON.parse(mf);m.outputs=Object.fromEntries([...files].filter(([n])=>n.startsWith(prefix)&&n!==prefix+'data/unification-manifest.json'&&n!==prefix+'.generated-by-hub-standard').map(([n,b])=>[n.slice(prefix.length),E.hash(b)]));set('data/unification-manifest.json',encode(m));}
 return receipt;
}
module.exports={enhance,fromMermaid,graphProjection,read};
