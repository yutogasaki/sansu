import fs from 'node:fs';
import path from 'node:path';
import {packRegistry,hash} from './portal-registry.mjs';
import {addAssets} from './portal-assets.mjs';
import {escape} from './portal-html.mjs';
const localSources=['tools/portal-storage.mjs','tools/portal-registry.mjs','tools/portal-registry-browser.js','tools/portal-registry.py','tools/portal-assets.mjs','tools/portal-assets-browser.js','tools/portal-note-import.js'];
export function compactPortal(root,files){
 const original=JSON.parse(files.get('data/unification.json'));
 const manifest=JSON.parse(files.get('data/unification-manifest.json'));
 const assets=addAssets(root,files,original,manifest);
 const {files:packed,catalog}=packRegistry(original);
 for(const [name,body]of packed)files.set(name,body);
 files.set('registry-loader.js',fs.readFileSync(path.join(root,'tools/portal-registry-browser.js')));
 files.set('atlas-note-import.js',fs.readFileSync(path.join(root,'tools/portal-note-import.js')));
 const atlas='integrated/docs/design/2026-10-10-island-design-strategy/index.html';
 if(files.has(atlas))files.set(atlas,Buffer.from(files.get(atlas)).toString().replace('</body>','<script src="'+path.posix.relative('docs/design/2026-10-10-island-design-strategy','portal/atlas-note-import.js')+'" defer></script></body>'));
 for(const name of ['integration.js','sansu-legacy-search.js']){
  if(!files.has(name))continue;
  let js=Buffer.from(files.get(name)).toString();
  const setup=`const registryBase=new URL('.',document.currentScript.src);let registryReady;
  function ensureRegistry(){return registryReady ||= (async()=>{for(const file of ['registry-index.js','registry-loader.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(file,registryBase);script.onload=resolve;script.onerror=()=>reject(Error('原文の読取処理を開けません。再読み込みしてください。'));document.head.append(script);});})();}`;
  js=js.replace('(async () => {','(async () => {\n'+setup);
  const needle='function openDetail(record, button) {';
  if(!js.includes(needle))throw Error('Review record reader adapter: '+name);
  js=js.replace(needle,'async function openDetail(record, button) {');
  js=js.replace("document.getElementById('pu-detail-data').textContent = JSON.stringify(record, null, 2);","document.getElementById('pu-detail-data').textContent = JSON.stringify({key:record.key,status:'原文を読み込んでいます。'},null,2);");
  const show='dialog.showModal();\n  }';
  if(!js.includes(show))throw Error('Review record dialog lifecycle: '+name);
  js=js.replace(show,`dialog.showModal();
    try {
      if(!window.SansuRegistry)await ensureRegistry();
      const full=await window.SansuRegistry.record(record.__shard,record.key);
      if(dialog.open&&origin===button) document.getElementById('pu-detail-data').textContent=JSON.stringify(full,null,2);
    } catch(error) {
      if(dialog.open&&origin===button) document.getElementById('pu-detail-data').textContent='原文の読込に失敗しました。閉じて再度開くか、元の資料から確認してください。\\n'+error.message;
    }
  }`);
  js=js.replace('const type = document.getElementById(\'pu-type\');',"const type = document.getElementById('pu-type');\n  const raw = document.getElementById('pu-raw');\n  if(raw)raw.checked=new URLSearchParams(location.search).get('raw')==='1';");
  js=js.replace('const rows = data.items.filter(row =>','const rows = data.items.filter(row => ((raw?.checked || type.value===\'code\') || row.meaningful) &&');
  js=js.replace('    if (updateUrl) {',"    if(!terms.length&&!category.value&&!type.value&&!raw?.checked){const priority={document:0,heading:1,diagram:2,image:3,table:4};rows.sort((a,b)=>(priority[a.kind]??5)-(priority[b.kind]??5));}\n    if (updateUrl) {");
  js=js.replace("[row.text,row.pageTitle,row.title,...Object.values(row.attributes||{})].join(' ').toLocaleLowerCase()","row.haystack");
  js=js.replace("PortalReader.normalize([row.text,row.pageTitle,row.title,...Object.values(row.attributes||{})].join(' '))","row.haystack");
  js=js.replace("['type',type.value]","['type',type.value],['raw',raw?.checked?'1':'']");
  js=js.replace('PortalReader.saveFilters({q:query,category,type},location,history);',"PortalReader.saveFilters({q:query,category,type},location,history);const rawUrl=new URL(location.href);if(raw?.checked)rawUrl.searchParams.set('raw','1');else rawUrl.searchParams.delete('raw');history.replaceState(history.state,'',rawUrl);");
  js=js.replaceAll('PortalReader.restoreFilters({q:query,category,type},location.href);',"PortalReader.restoreFilters({q:query,category,type},location.href);if(raw)raw.checked=new URLSearchParams(location.search).get('raw')==='1';");
  js=js.replace('全${data.items.length.toLocaleString()}件','原文全${data.items.length.toLocaleString()}件');
  js=js.replace('for (const input of [query,category,type])','for (const input of [query,category,type,...(raw?[raw]:[])])');
  js=js.replace("type.value=p.get('type')||'';draw(false);","type.value=p.get('type')||'';if(raw)raw.checked=p.get('raw')==='1';draw(false);");
  files.set(name,js);
 }
 for(const [name,body]of files){
  if(!name.endsWith('.html'))continue;
  if(/^(?:retained\/|original\/|ai\/|legacy-|overview-legacy\.html)/.test(name))continue;
  let html=Buffer.from(body).toString();
  if(/<script[^>]+src="[^\"]*(?:integration|sansu-legacy-search)\.js"/.test(html)){
   const base='../'.repeat(name.split('/').length-1);
   // Source-context documents have a base pointing at their original source.
   const sourceBase=html.match(/<base data-sansu-source-context href="([^"]+)"/)?.[1];
   let prefix=base;
   if(sourceBase){const source=path.posix.normalize(path.posix.join('portal',path.posix.dirname(name),sourceBase));prefix=path.posix.relative(path.posix.dirname(source),'portal')+'/';}
   html=html.replace('</head>',`<script src="${prefix}registry-index.js" defer></script><script src="${prefix}registry-loader.js" defer></script></head>`);
  }
  if(html.includes('id="pu-form"'))html=html.replace('</form>','<label class="registry-raw"><input id="pu-raw" type="checkbox">操作定義・ナビ等の原文も含める</label></form>');
  html=html.replace(/href="((?:\.\.\/)*)data\/unification\.json"/g,'href="$1records.html"');
  files.set(name,html);
 }
 const template=Buffer.from(files.get('library.html')||files.get('index.html')).toString();
 const content=`<main id="main"><header class="page-head"><h1>全項目の原文と出典</h1><p>原文${catalog.itemStorage.count.toLocaleString()}件を分割して保持しています。検索の詳細は必要な部分だけ読み込みます。全件の書き出しは時間とメモリを使います。</p></header><p><a href="filters.html">分類・種類・語句で探す</a> · <a href="data/unification.json">分割台帳とhash</a></p><button id="registry-export" type="button">全文・未知フィールドを含むJSONを書き出す</button><p id="registry-status" role="status"></p><h2>復元方法</h2><p>分割台帳のitemStorage順に各gzipスクリプトを復号し、itemsへ結合します。元の識別子・属性・全文・未知フィールドを保持します。生成元はtools/portal-registry.mjs、Python読取はtools/portal-registry.pyです。</p><p><a href="index.html">Sansuの入口へ戻る</a></p></main>`;
 files.set('records.html',template.replace(/<title>[\s\S]*?<\/title>/,'<title>全項目の原文と出典</title>').replace(/<main\b[\s\S]*?<\/main>/,()=>content).replace('</head>','<script src="registry-index.js" defer></script><script src="registry-loader.js" defer></script></head>').replace('</body>','<script src="registry-export.js" defer></script></body>'));
 files.set('registry-export.js',`document.getElementById('registry-export').addEventListener('click',async event=>{const button=event.currentTarget,status=document.getElementById('registry-status');button.disabled=true;status.textContent='全件を読み込んでいます。';try{const data=await window.SansuRegistry.full(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sansu-unification.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent=data.items.length.toLocaleString()+'件を書き出しました。';}catch(error){status.textContent='書き出せませんでした。分割台帳や元の資料を確認し、再試行してください。 '+error.message;}finally{button.disabled=false;}});`);
 const assetMain='<main id="main"><header class="page-head"><h1>画像・音声・素材を探す</h1><p>元ポータルの素材と現行英語教材を個別に登録しました。制作原本・過去の検証・実装素材を含みます。件数を現在の採用や配布容量と読み替えません。</p></header><p><a href="library.html">資料一覧へ戻る</a> · <a href="data/assets.json">全件の出典・容量・hash</a></p><label>名前・元の場所<input id="asset-query" type="search"></label><label>種類<select id="asset-type"><option value="">すべて</option><option value="image">画像</option><option value="audio">音声</option><option value="video">動画</option><option value="3d">3D</option><option value="document">資料</option></select></label><button id="asset-reset">条件を解除</button><p id="asset-count" role="status">読み込んでいます。</p><ul id="asset-results" class="asset-results"></ul><button id="asset-more" hidden>続きを表示</button><section id="asset-detail" hidden></section></main>';
 files.set('assets.html',template.replace(/<title>[\s\S]*?<\/title>/,'<title>画像・音声・素材</title>').replace(/<main\b[\s\S]*?<\/main>/,()=>assetMain).replace('</body>','<script src="assets-data.js" defer></script><script src="assets-browser.js" defer></script></body>'));
 files.set('assets-browser.js',fs.readFileSync(path.join(root,'tools/portal-assets-browser.js')));
 const missing=original.resources.filter(row=>row.state==='missing');
 const warning='<aside class="section"><h2>過去資料の未復旧の参照</h2><p>'+missing.length+'件の元ファイル・場所がありません。別の素材で補完していません。過去資料の表示・復元は未受入です。</p><details><summary>対象と原文の場所</summary><ul>'+missing.map(r=>'<li>'+escape(r.source)+'</li>').join('')+'</ul></details></aside>';
 if(missing.length)for(const name of ['records.html','assets.html'])files.set(name,Buffer.from(files.get(name)).toString().replace('</main>',warning+'</main>'));
 if(files.has('sansu-workspace.css'))files.set('sansu-workspace.css',Buffer.from(files.get('sansu-workspace.css')).toString()+`\n#asset-results li{margin:1.5rem 0;padding-bottom:1.5rem;border-bottom:1px solid var(--line,#ddd)}#asset-results p,#asset-detail pre{overflow-wrap:anywhere;white-space:pre-wrap}
 #pu-form{display:grid;grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,1fr));gap:16px;align-items:end;margin:24px 0}
 #pu-form label{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:16px}#pu-form input,#pu-form select,#asset-query,#asset-type{box-sizing:border-box;width:100%;min-width:0;min-height:44px;font:inherit;padding:10px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--paper,#fff);color:inherit}
 #pu-form button,#asset-reset,#asset-results button,#asset-more{min-height:44px;font:inherit;padding:10px 16px;border:1px solid var(--line,#ccc);border-radius:6px;background:var(--paper,#fff);color:inherit}
 #pu-form .registry-raw{grid-column:2/-1;display:flex;flex-direction:row;align-items:center;gap:10px}#pu-form .registry-raw input{width:20px;min-height:20px;height:20px;flex-shrink:0}#asset-query,#asset-type{display:block;margin:8px 0 16px;max-width:600px}
 @media(max-width:700px){#pu-form{grid-template-columns:minmax(0,1fr)}#pu-form .registry-raw{grid-column:1}#asset-results{padding-left:20px}}`);
 for(const name of ['library.html','knowledge.html','pages.html','map.html'])if(files.has(name))files.set(name,Buffer.from(files.get(name)).toString().replace(/(<main\b[^>]*>)/,'$1<p><a href="assets.html">画像・音声・素材 '+assets.length.toLocaleString()+'件を探す →</a></p>'));
 for(const source of localSources)manifest.sourceFiles[source]=hash(fs.readFileSync(path.join(root,source)));
 const {items,...metadata}=original;
 files.set('data/storage.json',JSON.stringify({schemaVersion:1,format:'sansu-record-shards/1',rawModelSha256:hash(JSON.stringify({...metadata,items})),records:items.length,rawModelBytes:Buffer.byteLength(JSON.stringify(original)),catalogBytes:Buffer.byteLength(files.get('data/unification.json')),shardBytes:[...packed].filter(([name])=>name.startsWith('data/records/')).reduce((n,[,body])=>n+Buffer.byteLength(body),0),searchBytes:Buffer.byteLength(files.get('search-data.js')),assets:assets.length,missingResources:missing.map(r=>r.source)},null,2)+'\n');
 manifest.outputs=Object.fromEntries([...files].filter(([name])=>name!=='data/unification-manifest.json'&&name!=='.generated-by-hub-standard').map(([name,body])=>[name,hash(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]));
 files.set('data/unification-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 return {records:catalog.itemStorage.count,shards:catalog.itemStorage.shards.length};
}
