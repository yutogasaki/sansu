import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {escape,decode} from './portal-html.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const relative=(from,to)=>path.posix.relative(path.posix.dirname(from),to)||'.';
const privatePath=/(?:^|\/)(?:\.git|node_modules|private|personal|accounting|finance|customers?|students?|contacts?)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:key|pem|db|sqlite3?|xlsx?)$/i;

export function addFolders(root,files,registry,manifest){
 const known=new Map([...registry.pages,...registry.documents].map(row=>[row.source,row.target]));
 const core=new Set(JSON.parse(files.get('data/search.json')).map(row=>row.source));
 const resources=new Map(registry.resources.map(row=>[row.source,row]));
 const folders=new Map();
 const visit=source=>{
  if(folders.has(source))return folders.get(source).target;
  const target='folders/'+sha(source).slice(0,20)+'.html',entries=[];
  folders.set(source,{source,target,entries});known.set(source,target);
  for(const dirent of fs.readdirSync(path.join(root,source),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'ja'))){
   const child=source+'/'+dirent.name;
   if(dirent.isSymbolicLink()||privatePath.test(child)){
    registry.exclusions.push({source:child,reason:'非公開領域またはsymlink。原領域に保持し、内容を転記しない。'});continue;
   }
   if(dirent.isDirectory()){entries.push({source:child,name:dirent.name,type:'folder',target:visit(child)});continue;}
   if(!dirent.isFile())continue;
   const bytes=fs.readFileSync(path.join(root,child)),digest=sha(bytes);
   manifest.sourceFiles[child]=digest;
   if(!resources.has(child)){const row={source:child,target:'../'+child,bytes:bytes.length,sha256:digest,state:'local-reference',access:'元フォルダ内の資料。原資料の利用・アクセス条件を維持。'};resources.set(child,row);registry.resources.push(row);}
   const destination=known.get(child)||(core.has(child)?'index.html?document='+encodeURIComponent(child):'../'+child);
   const type=/\.(png|jpe?g|webp|svg|gif)$/i.test(child)?'image':/\.(wav|mp3)$/i.test(child)?'audio':/\.(mp4|webm)$/i.test(child)?'video':'link';
   const key='folder-file-'+sha(child).slice(0,20),text=dirent.name+' · '+bytes.length+' bytes';
   const row={key,source:child,sourceSha256:digest,title:dirent.name,pageTitle:'保存した資料の一覧',kind:type,kindLabel:{image:'画像',audio:'音声',video:'動画',link:'資料'}[type],tag:'li',attributes:{},text,target,originalUrl:child,anchor:key,bytes:bytes.length,assetTarget:destination,
    checks:{structure:'generated',browser:'unverified',independentReview:'unverified'},verdict:'未受入（表示・操作・独立審査を別途照合）',humanPageTitle:'保存した資料の一覧',humanTitle:'保存した'+({image:'画像',audio:'音声',video:'動画',link:'資料'}[type]),humanText:'元の資料名・容量・内容hash・出典は詳細で確認できます。'};
   registry.items.push(row);entries.push({source:child,name:dirent.name,type,target:destination,key,text,bytes:bytes.length,sha256:digest});
  }
  const css=relative('portal/'+target,'portal/integration.css'),extra=relative('portal/'+target,'portal/library.css'),js=relative('portal/'+target,'portal/integration.js'),runtime=relative('portal/'+target,'portal/library-runtime.js');
  const link=dest=>relative('portal/'+target,dest.startsWith('../')?dest.slice(3):'portal/'+dest);
  files.set(target,'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>保存した資料の一覧</title><link rel="stylesheet" href="'+escape(css)+'"><link rel="stylesheet" href="'+escape(extra)+'"></head><body><aside class="pu-bar"><nav><strong>さんすう</strong><a href="'+escape(link('index.html'))+'">現在地へ</a><a href="'+escape(link('search.html'))+'">全ページから探す</a><a href="'+escape(relative('portal/'+target,registry.original))+'">元のポータルを開く →</a></nav><p>新版を確認中。元の入口を保持しています。</p></aside><main class="pu-document"><h1>保存した資料の一覧</h1><p>'+entries.length+'件。資料名は原文です。過去の資料を現在の採用・確認済みと扱いません。</p><details><summary>元フォルダと全件データ</summary><p>'+escape(source)+'</p><a href="../data/folders.json">原文・容量・hash・対応先を開く</a></details><ul class="library-files">'+entries.map(row=>'<li'+(row.key?' id="'+row.key+'" data-portal-item="'+row.key+'"':'')+'><a href="'+escape(link(row.target))+'">'+escape(row.text||row.name+' / フォルダ')+'</a></li>').join('')+'</ul></main><script src="'+escape(js)+'" defer></script><script src="'+escape(runtime)+'" defer></script></body></html>');
  return target;
 };
 for(const row of [...registry.resources])if(row.state==='directory'&&fs.statSync(path.join(root,row.source)).isDirectory()){row.generatedTarget=visit(row.source);}
 const rewriteLink=(value,base)=>{
  if(!value||/^[a-z][\w+.-]*:/i.test(value))return value;
  const url=new URL(value,'https://local.invalid/'+base),source=decodeURIComponent(url.pathname.slice(1)).replace(/\/$/,'');
  if(!folders.has(source))return value;
  const target=known.get(source+'/index.html')||folders.get(source).target;
  return relative(base,'portal/'+target)+url.search+url.hash;
 };
 for(const [name,body] of files){
  if(!name.endsWith('.html')||name.startsWith('original/')||name.startsWith('ai/'))continue;
  let html=String(body);const base=html.match(/<base\b[^>]*href="([^"]+)"/i),context=base?path.posix.normalize(path.posix.join(path.posix.dirname('portal/'+name),decode(base[1]))):'portal/'+name;
  html=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>/gi,tag=>/^<(?:script|style|base)\b/i.test(tag)?tag:tag.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi,(_,q,value)=>'href='+q+escape(rewriteLink(decode(value),context))+q));
  files.set(name,html);
 }
 registry.folders=[...folders.values()];files.set('data/folders.json',JSON.stringify(registry.folders,null,2)+'\n');
 return Object.fromEntries([...folders].map(([source,row])=>[source,known.get(source+'/index.html')||row.target]));
}
