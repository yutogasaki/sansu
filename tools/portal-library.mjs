// Sansu-specific composition around the pinned library. Never edits source pages.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {decode,escape,parse,elements,headingIssue,technicalSurface} from './portal-html.mjs';
import {humanLabel} from './integrated-portal.mjs';
import {addFolders} from './portal-library-folders.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const csv='docs/design/2026-09-09-pokomoko-growth-keyvisual/growth-pacing.csv';
const relative=(from,to)=>path.posix.relative(path.posix.dirname(from),to)||'.';

function completeShell(html){
 if(!/<head\b/i.test(html)){
  const start=html.match(/<html\b[^>]*>/i);let cursor=start?start.index+start[0].length:0;
  const begin=cursor;
  const metadata=/\s+|<!--[\s\S]*?-->|<(?:meta|link)\b[^>]*>|<(title|style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/giy;
  while(true){metadata.lastIndex=cursor;const token=metadata.exec(html);if(!token)break;cursor=metadata.lastIndex;}
  html=html.slice(0,begin)+'<head>'+html.slice(begin,cursor)+'</head>'+html.slice(cursor);
 }
 if(!/<body\b/i.test(html)){
  html=html.replace(/<\/head\s*>/i,'</head><body>');
  html=/<\/html\s*>/i.test(html)?html.replace(/<\/html\s*>/i,'</body></html>'):html+'</body>';
 }
 return html;
}

// A base URL retains URLs created by the original JS and inline CSS. Rebase the
// already-integrated static URLs first, including fragment-only navigation.
function sourceContext(html,target,source){
 if(/http-equiv=["']Content-Security-Policy["']/i.test(html))return html;
 const rebase=value=>{
  if(!value||/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(value))return value;
  const url=new URL(value,'https://local.invalid/portal/'+target);
  return relative(source,decodeURIComponent(url.pathname.slice(1)))+url.search+url.hash;
 };
 html=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>/gi,tag=>{
  if(/^<(?:script|style)\b/i.test(tag)&&/<\//.test(tag)){
   if(/^<style\b/i.test(tag))return tag;
   const end=tag.indexOf('>');return rewrite(tag.slice(0,end+1))+tag.slice(end+1);
  }
  return rewrite(tag);
 });
 function rewrite(tag){
  return tag.replace(/\b(href|src|poster|action|data-src)\s*=\s*(["'])(.*?)\2/gi,(_,attr,q,value)=>attr+'='+q+escape(rebase(decode(value)))+q)
   .replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi,(_,q,value)=>'srcset='+q+escape(decode(value).split(',').map(part=>{const [url,...size]=part.trim().split(/\s+/);return [rebase(url),...size].join(' ');}).join(', '))+q);
 }
 const base=relative('portal/'+target,source);
 return html.replace(/(<head\b[^>]*>)/i,'$1<base data-sansu-source-context href="'+escape(base)+'"><script src="'+escape(relative(source,'portal/native-context.js'))+'"></script>');
}

export function composeLibrary(root,files,home){
 const registry=JSON.parse(files.get('data/unification.json'));
 const manifest=JSON.parse(files.get('data/unification-manifest.json'));
 for(const row of registry.items){
  const page=humanLabel(row.pageTitle||row.source);
  const pageLabel=/[ぁ-んァ-ヶ一-龯]/.test(page)?page:'制作と確認の資料';
  const code=row.kind==='code'||/\b(?:const|let|function|document|window|addEventListener|querySelector)\b|=>/.test(row.title||'');
  const label=code?pageLabel+'の操作定義':humanLabel(row.title||row.kindLabel);
  row.humanPageTitle=pageLabel;
  row.humanTitle=label&&!headingIssue(label)&&/[ぁ-んァ-ヶ一-龯]/.test(label)?label:pageLabel+'の'+row.kindLabel;
  row.humanText=code?'検索や表示に使う処理です。全文・識別子・出典は詳細で確認できます。':technicalSurface.test(row.text)||/\b(?:const|let|function|document|window|addEventListener|querySelector)\b|=>/.test(row.text)?'全文と対象版は「原文・出典・元データ」で確認できます。':row.text;
 }
 // Adapt only the generated copy. The pinned payload and raw record stay exact.
 let behavior=String(files.get('integration.js'));
 for(const [from,to] of [
  ["record.title || record.kind","record.humanTitle || record.title || record.kind"],
  ["${row.pageTitle}","${row.humanPageTitle || row.pageTitle}"],
  ["make('a',row.title || row.pageTitle)","make('a',row.humanTitle || row.title || row.pageTitle)"],
  ["const isView = url => url.origin","const isView = url => false && url.origin"],
  ["if (row.text) li.append(make('p',row.text.length>240?row.text.slice(0,240)+'…':row.text));","const snippet=row.humanText ?? row.text; if (snippet) li.append(make('p',snippet.length>240?snippet.slice(0,240)+'…':snippet));"],
 ]){
  if(behavior.split(from).length!==2)throw Error('Library behavior adapter needs review: '+from);
  behavior=behavior.replace(from,to);
 }
 files.set('integration.js',behavior);
 // This CSV is a numeric design model, not a child/customer record. Explicitly
 // validate its schema before making a local exception to the vendor's CSV deny.
 const bytes=fs.readFileSync(path.join(root,csv));
 const [header,...records]=bytes.toString('utf8').trim().split(/\r?\n/);
 if(header!=='order,state_id,cost_a,total_a,cost_b,total_b,a_reached_at_intro3_then6,a_segments_intro3_then6'||records.some(line=>!/^\d+,[a-z]+-\d+(?:,\d+){6}$/.test(line)))throw Error('Unexpected design pacing CSV schema');
 registry.exclusions=registry.exclusions.filter(row=>row.source!==csv);
 if(!registry.resources.some(row=>row.source===csv))registry.resources.push({source:csv,target:'../'+csv,bytes:bytes.length,sha256:sha(bytes),state:'local-reference',access:'匿名の設計モデル。原資料の出典・配布条件を維持。'});
 for(const item of registry.items.filter(row=>row.tag==='a'&&row.attributes?.href?.includes('growth-pacing.csv'))){
  const html=String(files.get(item.target));
  const pattern=new RegExp('<a\\b[^>]*data-portal-item="'+item.key+'"[^>]*>');
  if(!pattern.test(html))throw Error('Missing pacing CSV link: '+item.key);
  files.set(item.target,html.replace(pattern,tag=>tag.replace(/href\s*=\s*(["']).*?\1/i,'href="'+escape(relative('portal/'+item.target,csv))+'"')));
 }
 files.set('library-runtime.js',fs.readFileSync(path.join(root,'tools/portal-library-runtime.js'),'utf8'));
 files.set('library.css',fs.readFileSync(path.join(root,'tools/portal-library.css'),'utf8'));
 for(const row of registry.pages){
  let html=completeShell(String(files.get(row.target)));
  if(!html.includes('integration.js')){
   const root=relative('portal/'+row.target,'portal/index.html'),search=relative('portal/'+row.target,'portal/search.html'),original=relative('portal/'+row.target,registry.original);
   html=html.replace(/(<body\b[^>]*>)/i,'$1<aside class="pu-bar" aria-label="統合ポータル"><nav><strong>'+escape(registry.title)+'</strong><a href="'+escape(root)+'">現在地へ</a><a href="'+escape(search)+'">全ページから探す</a><a href="'+escape(original)+'">元のポータルを開く →</a></nav><p>新版を確認中。元の入口を保持しています。</p></aside>');
   html=html.replace('</head>','<link rel="stylesheet" href="'+escape(relative('portal/'+row.target,'portal/integration.css'))+'"></head>').replace('</body>','<script src="'+escape(relative('portal/'+row.target,'portal/integration.js'))+'" defer></script></body>');
  }
  files.set(row.target,html);
 }
 for(const [name,body] of files){
  if(!name.endsWith('.html')||!String(body).includes('integration.js'))continue;
  const css=relative('portal/'+name,'portal/library.css'),js=relative('portal/'+name,'portal/library-runtime.js');
  files.set(name,String(body).replace('</head>','<link rel="stylesheet" href="'+escape(css)+'"></head>').replace('</body>','<script src="'+escape(js)+'" defer></script></body>'));
 }
 for(const row of registry.pages){
  files.set(row.target,sourceContext(String(files.get(row.target)),row.target,row.source));
 }
 files.set('index.html',home.replace('<section id="trials">','<p class="complete-library"><a href="pages.html">資料・画像・図・操作の全項目を見る</a> · <a href="search.html">全項目をまとめて探す</a></p><section id="trials">'));
 const folderRoutes=addFolders(root,files,registry,manifest);
 const routes={...Object.fromEntries([...registry.pages,...registry.documents].map(row=>[row.source,row.target])),...folderRoutes};
 files.set('native-context.js','window.sansuNativeRoutes='+JSON.stringify(routes)+';\n'+fs.readFileSync(path.join(root,'tools/portal-native-context.js'),'utf8'));
 // Compatible anchors are derived from actual headings; never retitle source.
 const compact=value=>decode(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const headings=new Map(registry.documents.map(row=>[row.target,elements(parse(String(files.get(row.target))),n=>/^h[1-6]$/.test(n.tag)&&n.attrs.id)]));
 registry.anchorAliases=[];
 for(const [name,body] of files){
  if(!name.endsWith('.html')||name.startsWith('integrated/'))continue;
  for(const node of elements(parse(String(body)),n=>n.tag==='a'&&n.attrs.href?.includes('#'))){
   const url=new URL(node.attrs.href,'https://local.invalid/portal/'+name),target=decodeURIComponent(url.pathname.slice('/portal/'.length));
   const candidates=headings.get(target);if(!candidates)continue;
   const wanted=decodeURIComponent(url.hash.slice(1));if(candidates.some(n=>n.attrs.id===wanted))continue;
   const exact=candidates.filter(n=>compact(n.attrs.id)===compact(wanted));
   const section=wanted.match(/^\d+-/),sameSection=section?candidates.filter(n=>n.attrs.id.startsWith(section[0])):[];
   const match=exact.length===1?exact[0]:sameSection.length===1?sameSection[0]:null;if(!match)continue;
   const alias='<span id="'+escape(wanted)+'" class="source-anchor-alias"></span>';
   files.set(target,String(files.get(target)).replace(new RegExp('(<h[1-6] id="'+match.attrs.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'")'),alias+'$1'));
   candidates.push({tag:'span',attrs:{id:wanted}});registry.anchorAliases.push({page:target,old:wanted,current:match.attrs.id});
  }
 }
 files.set('data/unification.json',JSON.stringify(registry,null,2)+'\n');
 // No browser observes this intermediate Map. The final storage composer emits
 // the search projection once, after all shared and native transformations.
 files.set('search-data.js','/* Search is emitted by the final storage composer. */\n');
 // Local changes remain part of the same exact source/output manifest.
 for(const source of ['scripts/standard-portal.mjs','tools/portal-library.mjs','tools/portal-library-folders.mjs','tools/portal-native-context.js','tools/portal-library-runtime.js','tools/portal-library.css',csv])manifest.sourceFiles[source]=sha(fs.readFileSync(path.join(root,source)));
 manifest.outputs=Object.fromEntries([...files].filter(([name])=>!['.generated-by-hub-standard','data/unification-manifest.json'].includes(name)).map(([name,body])=>[name,sha(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]));
 files.set('data/unification-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 return files;
}
