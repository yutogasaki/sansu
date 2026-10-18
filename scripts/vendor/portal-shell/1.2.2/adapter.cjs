'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const profiles={
 'keep-going':{title:'KeepGoing',links:[['概要','#overview'],['仕事','work.html'],['判断','#decisions'],['資料','documents.html'],['検索','search.html']]},
 jishu:{title:'JISHU',links:[['概要','#overview'],['仕事','#work-flow'],['判断','#decisions'],['資料','pages.html'],['検索','search.html']]},
 sansu:{title:'Sansu',links:[['概要','#overview'],['仕事','#tasks'],['判断','#decisions'],['資料','documents.html'],['検索','search.html']]},
 'ayami-ballet':{title:'AYAMI BALLET',links:[['概要','#overview'],['仕事','#tasks'],['判断','#decisions'],['資料','#documents'],['検索','search.html']]},
 mmmind:{title:'MMmind',links:[['概要','#overview'],['仕事','#work'],['判断','#plan'],['資料','#knowledge'],['検索','search.html']]},
 'noren-studio':{title:'noren',links:[['概要','index.html'],['仕事','backlog.html'],['判断','index.html#decisions'],['資料','assets.html'],['検索','noren/search.html']]},
 'cast-life':{title:'CAST LIFE',links:[['概要','#overview'],['仕事','#work-flow'],['判断','#decisions'],['資料','#library'],['検索','#filters']]},
 business:{title:'Business',links:[['概要','index.html']]},
 hub:{title:'すべてのプロジェクト',links:[['一覧','/index.html'],['仕事','/index.html#work'],['判断','/index.html#decisions'],['考え方','/principles/']]}
};
function pin(){const l=JSON.parse(fs.readFileSync(path.join(__dirname,'lock.json')));for(const [f,d]of Object.entries(l.files))if(f.includes('/')||sha(fs.readFileSync(path.join(__dirname,f)))!==d)throw Error('Changed portal shell: '+f);return l;}
function config(slug,home){const p=profiles[slug];if(!p)throw Error('Unknown portal shell profile');return {slug,title:p.title,links:p.links.map(([label,href])=>({label,href:slug==='hub'?href:href.startsWith('#')?home+href:path.posix.join(path.posix.dirname(home),href)}))};}
function page(html,{slug,home='index.html',assetBase='',workspaceHref=assetBase+'../../hub/portal/index.html'}){
 if(html.includes('id="portal-shell-config"'))throw Error('Portal shell already attached');
 if(!/<\/head\s*>/i.test(html)||!/<\/body\s*>/i.test(html))return html;
 const cfg=JSON.stringify({...config(slug,home),workspaceHref:slug==='hub'?undefined:workspaceHref}).replaceAll('<','\\u003c');
 return html.replace(/<\/head\s*>/i,`<link rel="stylesheet" href="${assetBase}portal-shell.css"></head>`).replace(/<\/body\s*>/i,`<script id="portal-shell-config" type="application/json">${cfg}</script><script src="${assetBase}portal-shell.js" defer></script></body>`);
}
function assets(){pin();return {css:fs.readFileSync(path.join(__dirname,'shell.css')),js:fs.readFileSync(path.join(__dirname,'shell.js'))};}
function enhance(root,files,{slug,prefix='',outputRoot='portal',sources=[],currentPages=[],preserve=[],home='index.html'}={}){
 const lock=pin(),a=assets(),vendor=path.relative(root,__dirname).split(path.sep).join('/');
 if(vendor.startsWith('../'))throw Error('Pin portal shell within its repository');
 const sourceFiles=Object.fromEntries(['lock.json',...Object.keys(lock.files)].map(f=>[vendor+'/'+f,sha(fs.readFileSync(path.join(__dirname,f)))]));
 for(const f of sources)sourceFiles[f]=sha(fs.readFileSync(path.join(root,f)));
 files.set(prefix+'portal-shell.css',a.css);files.set(prefix+'portal-shell.js',a.js);
 for(const [key,bytes]of files){const name=key.slice(prefix.length);if(!key.startsWith(prefix)||!name.endsWith('.html')||preserve.includes(name)||name.includes('/')&&!name.startsWith('read/')&&!currentPages.includes(name)||/^(?:before|original|overview-v1|pre-)/.test(name))continue;
  const assetBase=path.posix.relative(path.posix.dirname(name),'.');
  const base=assetBase?assetBase+'/':'';
  const rendered=page(Buffer.from(bytes).toString(),{slug,home:base+home,assetBase:base,workspaceHref:base+'../'.repeat(outputRoot.split('/').length+1)+'hub/portal/index.html'});files.set(key,typeof bytes==='string'?rendered:Buffer.from(rendered));
 }
 const registryName=prefix+'data/unification.json';
 if(files.has(registryName)){
  const registry=JSON.parse(files.get(registryName));
  registry.resources=(registry.resources||[]).filter(r=>!r.source.startsWith(outputRoot+'/'));
  registry.generatedOutputPolicy={root:outputRoot,hashes:'data/unification-manifest.json#outputs',note:'自分の生成先を入力hashとして再読込しない。原リンクと項目は保持。'};
  files.set(registryName,Buffer.from(JSON.stringify(registry,null,2)+'\n'));
 }
 files.set(prefix+'data/shell-component.json',Buffer.from(JSON.stringify({schemaVersion:1,component:'portal-shell',version:lock.version,profile:slug,sourceFiles},null,2)+'\n'));
 const manifestName=prefix+'data/unification-manifest.json';if(files.has(manifestName)){
  const manifest=JSON.parse(files.get(manifestName));Object.assign(manifest.sourceFiles,sourceFiles);
  for(const source of Object.keys(manifest.sourceFiles))if(source.startsWith(outputRoot+'/'))delete manifest.sourceFiles[source];
  manifest.outputs=Object.fromEntries([...files].filter(([name])=>name.startsWith(prefix)&&name!==manifestName&&!name.endsWith('.generated-by-hub-standard')).map(([name,body])=>[name.slice(prefix.length),sha(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]));
  files.set(manifestName,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 }
 return files;
}
module.exports={enhance,page,assets,config};
