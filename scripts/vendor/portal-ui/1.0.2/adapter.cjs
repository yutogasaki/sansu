'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const version='1.0.2',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const profiles={
 hub:{title:'すべてのプロジェクト',links:[['一覧','/index.html'],['仕事','/index.html#work'],['判断','/index.html#decisions'],['考え方','/principles/index.html']],pages:[['一覧','/index.html'],['考え方','/principles/index.html'],['作業の流れ','/flow/index.html'],['朝の報告','/morning-report.html'],['実行記録','/runs/index.html']]},
 jishu:{title:'JISHU',links:[['概要','index.html#overview'],['仕事','index.html#work-flow'],['判断','index.html#decisions'],['資料','pages.html'],['検索','search.html']]},
 mmmind:{title:'MMmind',links:[['概要','index.html#overview'],['仕事','index.html#work'],['判断','index.html#plan'],['資料','index.html#knowledge'],['検索','search.html']]},
 sansu:{title:'Sansu',links:[['概要','index.html#overview'],['仕事','index.html#tasks'],['判断','index.html#decisions'],['資料','documents.html'],['検索','search.html']]},
 'ayami-ballet':{title:'AYAMI BALLET',links:[['概要','index.html#overview'],['仕事','index.html#tasks'],['判断','index.html#decisions'],['資料','index.html#documents'],['検索','search.html']]},
 'keep-going':{title:'KeepGoing',links:[['概要','index.html#overview'],['仕事','work.html'],['判断','index.html#decisions'],['資料','documents.html'],['検索','search.html']]},
 'noren-studio':{title:'noren',links:[['概要','index.html'],['仕事','backlog.html'],['判断','index.html#decisions'],['資料','assets.html'],['検索','noren/search.html']]},
 'cast-life':{title:'CAST LIFE',links:[['概要','index.html#overview'],['仕事','index.html#work-flow'],['判断','index.html#decisions'],['資料','index.html#library'],['検索','index.html#filters']]},
 business:{title:'Business',links:[['概要','index.html']]}
};
const projects=[['hub','すべてのプロジェクト','hub','portal/index.html'],['keep-going','KeepGoing','keep-going','portal/index.html'],['jishu','JISHU','Jishu','portal/index.html'],['sansu','Sansu','sansu','portal/index.html'],['ayami-ballet','AYAMI BALLET','ayami-ballet','portal/index.html'],['mmmind','MMmind','MMmind','portal/index.html'],['noren-studio','noren','noren-studio','portal/index.html'],['cast-life','CAST LIFE','cast-life','portal/index.html'],['business','Business','Business','index.html']];
function pin(){const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'lock.json')));for(const [file,hash]of Object.entries(lock.files))if(file.includes('/')||sha(fs.readFileSync(path.join(__dirname,file)))!==hash)throw Error('Changed portal UI: '+file);return lock;}
function relative(home,href){return href.startsWith('/')?href:path.posix.join(path.posix.dirname(home),href);}
function config(slug,home='index.html',pages=[]){
 const profile=profiles[slug];if(!profile)throw Error('Unknown portal UI profile: '+slug);
 const links=profile.links.map(([label,href])=>({label,href:relative(home,href)}));
 const all=profile.pages?profile.pages.map(([title,href])=>({title,href,category:'共通ページ'})):pages.filter(p=>p.audience==='internal').map(p=>({title:p.title,href:relative(home,p.path),category:p.category||'資料'}));
 if(!all.length)throw Error('Derive the internal page ledger before attaching portal UI');
 const seen=new Set();
 return {version,slug,title:profile.title,home,links,pages:all.filter(p=>{if(!p.title||!p.href)throw Error('Invalid portal page ledger');if(seen.has(p.href))return false;seen.add(p.href);return true;})};
}
function derivePages(files,{prefix='',outputRoot='portal',home='index.html',preserve=[]}={}){
 const homePrefix=home.startsWith('../')?path.posix.basename(outputRoot)+'/':'';
 const list=[],seen=new Set(),add=(p,title,category='資料')=>{if(!p||seen.has(p))return;seen.add(p);list.push({path:homePrefix+p,title:String(title||p).trim(),category,audience:'internal'});};
 for(const [f,t]of [['index.html','概要'],['work.html','仕事と計画'],['documents.html','資料と記録'],['pages.html','資料一覧'],['search.html','全文検索']])if(files.has(prefix+f)&&!preserve.includes(f))add(f,t,'主要ページ');
 if(files.has(prefix+'data/unification.json')){
  const reg=JSON.parse(Buffer.from(files.get(prefix+'data/unification.json')).toString());
  for(const p of reg.pages||[])if(p.target&&files.has(prefix+p.target)&&!p.source?.startsWith('.agents/portal/documents/')&&!((reg.pages||[]).length>50&&/^docs\/(?:design|audits)\/2026-/.test(p.source||'')))add(p.target,p.title||p.source,p.category||'画面');
  const docs=reg.documents||[];
  for(const d of (docs.length>150?docs.filter(x=>!/\/2026-\d\d-/.test(x.source||'')):docs))if(d.target&&files.has(prefix+d.target))add(d.target,d.title||d.source,d.category||'資料・判断・手順');
 }
 if(files.has(prefix+'data/integrated.json')){
  const int=JSON.parse(Buffer.from(files.get(prefix+'data/integrated.json')).toString());
  for(const [h,t]of [['#work-flow','仕事と計画'],['#decisions','判断'],['#library','資料・制作資産'],['#filters','検索・絞り込み']])add('index.html'+h,t,'主要セクション');
  for(const e of int.entrances||[])if(e.href&&!/^(?:https?:|mailto:|tel:)/i.test(e.href))add(e.href.replace(/^\.\//,''),e.title||e.label||e.href,'主要導線');
 }
 return list;
}
function header(cfg){
 const link=(item,attr='')=>`<a href="${esc(item.href)}"${attr}>${esc(item.label||item.title)}</a>`;
 const groups=new Map();for(const item of cfg.pages){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item);}
 return `<header class="pui-header" id="portal-ui"><div class="pui-line"><div class="pui-identity"><a class="pui-hub" href="${esc(cfg.workspaceHref)}">Workspace</a><span class="pui-divider" aria-hidden="true">/</span><details class="pui-project-menu"><summary>${esc(cfg.title)}</summary><nav class="pui-dropdown" aria-label="プロジェクトを切り替える">${cfg.projects.map(p=>link(p,` data-portal-project="${esc(p.slug)}"${p.slug===cfg.slug?' aria-current="page"':''}`)).join('')}</nav></details></div><nav class="pui-nav" aria-label="主要ページ">${cfg.links.map(p=>link(p)).join('')}</nav><details class="pui-all-pages"><summary>すべてのページ</summary><nav class="pui-dropdown" aria-label="このポータルのすべてのページ">${[...groups].map(([name,items])=>`<section><p>${esc(name)}</p>${items.map(p=>link(p)).join('')}</section>`).join('')}</nav></details></div></header>`;
}
// Opted-in pages retire the previous presentation layers. Their runtime and
// exact records stay intact; the native adapter owns domain-only styles.
function retirePresentation(html){
 return html.replace(/<link\b[^>]*href=["'][^"']*(?:portal-shell|portal-reader|integration)\.css["'][^>]*>/gi,'')
  .replace(/<script\b[^>]*id=["']portal-shell-config["'][^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<script\b[^>]*src=["'][^"']*portal-shell\.js["'][^>]*><\/script>/gi,'');
}
function page(html,{slug,home='index.html',assetBase='',workspaceHref=slug==='hub'?'/index.html':assetBase+'../../hub/portal/index.html',pages=[],projectLinks}={}){
 if(html.includes('id="portal-ui-config"'))throw Error('Portal UI already attached');
 if(!/<\/head\s*>/i.test(html)||!/<\/body\s*>/i.test(html)||!/<main\b/i.test(html))throw Error('Portal UI needs a complete HTML page with main');
 const cfg={...config(slug,home,pages),workspaceHref,projects:projectLinks||projects.map(([id,title,directory,entry])=>({slug:id,title,href:id==='hub'?workspaceHref:assetBase+'../../'+directory+'/'+entry}))};
 html=retirePresentation(html);
 html=html.replace(/<html\b([^>]*)>/i,(_,attrs)=>`<html${attrs} data-portal-ui="${version}">`)
  .replace(/<main\b([^>]*)>/i,(_,attrs)=>`<main${attrs} data-portal-main>`);
 const data=JSON.stringify(cfg).replaceAll('<','\\u003c');
 return html.replace(/<\/head\s*>/i,()=>`<link rel="stylesheet" href="${assetBase}portal-ui.css"></head>`)
  .replace(/(<body\b[^>]*>)/i,open=>open+header(cfg))
  .replace(/<\/body\s*>/i,()=>`<script id="portal-ui-config" type="application/json">${data}</script><script src="${assetBase}portal-ui.js" defer></script></body>`);
}
function assets(){pin();return {css:fs.readFileSync(path.join(__dirname,'ui.css')),js:fs.readFileSync(path.join(__dirname,'ui.js'))};}
function enhance(root,files,{slug,prefix='',outputRoot='portal',home='index.html',pages=[],currentPages=[],preserve=[],sources=[]}={}){
 const lock=pin(),shared=assets(),vendor=path.relative(root,__dirname).split(path.sep).join('/');
 if(vendor.startsWith('../')||path.isAbsolute(vendor))throw Error('Pin portal UI inside its repository');
 const sourceFiles=Object.fromEntries(['lock.json',...Object.keys(lock.files)].map(f=>[vendor+'/'+f,sha(fs.readFileSync(path.join(__dirname,f)))]));
 for(const name of sources)sourceFiles[name]=sha(fs.readFileSync(path.join(root,name)));
 const ledger=pages.length?pages:derivePages(files,{prefix,outputRoot,home,preserve});
 const useBuf=Buffer.isBuffer(files.values().next().value),wrap=s=>useBuf?Buffer.from(s):s;
 files.set(prefix+'portal-ui.css',shared.css);files.set(prefix+'portal-ui.js',shared.js);
 const adopted=[];
 for(const [key,body]of files){
  const name=key.slice(prefix.length);
  if(!key.startsWith(prefix)||!name.endsWith('.html')||preserve.includes(name)||name.includes('/')&&!name.startsWith('read/')&&!currentPages.includes(name)||/^(?:before|original|overview-v1|pre-)/.test(name))continue;
  const dir=path.posix.relative(path.posix.dirname(name),'.'),base=dir?dir+'/':'';
  const rendered=page(Buffer.from(body).toString(),{slug,home:base+home,assetBase:base,pages:ledger,workspaceHref:base+'../'.repeat(outputRoot.split('/').length+1)+'hub/portal/index.html'});
  files.set(key,typeof body==='string'?rendered:Buffer.from(rendered));adopted.push(name);
 }
 const registryName=prefix+'data/unification.json';
 if(files.has(registryName)){
  const registry=JSON.parse(Buffer.from(files.get(registryName)).toString());
  registry.resources=(registry.resources||[]).filter(r=>!r.source.startsWith(outputRoot+'/'));
  registry.generatedOutputPolicy={root:outputRoot,hashes:'data/unification-manifest.json#outputs',note:'自分の生成先を入力hashとして再読込しない。原リンクと項目は保持。'};
  files.set(registryName,wrap(JSON.stringify(registry,null,2)+'\n'));
 }
 files.set(prefix+'data/ui-component.json',wrap(JSON.stringify({schemaVersion:1,component:'portal-ui',version,profile:slug,sourceFiles,pages:adopted,ledger},null,2)+'\n'));
 const manifestName=prefix+'data/unification-manifest.json';if(files.has(manifestName)){
  const manifest=JSON.parse(Buffer.from(files.get(manifestName)).toString());Object.assign(manifest.sourceFiles,sourceFiles);
  for(const source of Object.keys(manifest.sourceFiles))if(source.startsWith(outputRoot+'/'))delete manifest.sourceFiles[source];
  manifest.outputs=Object.fromEntries([...files].filter(([name])=>name.startsWith(prefix)&&name!==manifestName&&!name.endsWith('.generated-by-hub-standard')).map(([name,body])=>[name.slice(prefix.length),sha(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]));
  files.set(manifestName,wrap(JSON.stringify(manifest,null,2)+'\n'));
 }
 return files;
}
module.exports={version,page,config,derivePages,assets,enhance,retirePresentation};
