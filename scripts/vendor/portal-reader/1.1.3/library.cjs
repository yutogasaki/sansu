'use strict';
const fs=require('node:fs'),path=require('node:path');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function enhanceLibrary(files,{prefix=''}){
 const page=prefix+'pages.html',model=prefix+'data/unification.json';
 if(!files.has(page)||!files.has(model))return;
 const registry=JSON.parse(files.get(model));if(!Array.isArray(registry.pages))return;
 const input=files.get(page),html=Buffer.from(input).toString();
 const list=html.match(/<ul class="pu-results">([\s\S]*?)<\/ul>/);if(!list)return;
 const rows=[...list[1].matchAll(/<li class="pu-result">[\s\S]*?<\/li>/g)].map(m=>m[0]);
 const pages=registry.pages.filter(p=>files.has(prefix+p.target));
 if(rows.length!==pages.length)throw Error('Library page count changed; preserve all native pages before regrouping.');
 const groups=new Map();
 const native=files.has(prefix+'data/native-mapping.json')?JSON.parse(files.get(prefix+'data/native-mapping.json')).modules||[]:[];
 pages.forEach((entry,i)=>{
  const category=entry.category||'その他の資料';if(!groups.has(category))groups.set(category,[]);
  if(!rows[i].includes('href="'+esc(entry.target)+'"'))throw Error('Native library order changed: '+entry.target);
  const mapped=native.find(module=>module.source===entry.source);
  const content=Buffer.from(files.get(prefix+(mapped&&files.has(prefix+mapped.target)?mapped.target:entry.target))).toString();
  const heading=(content.split(/<body\b[^>]*>/i)[1]||content).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title=mapped?.title||heading?.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim()||entry.title||category;
  let row=rows[i].replace(/(<h2><a\b[^>]*>)[\s\S]*?(<\/a><\/h2>)/,(_,a,b)=>a+esc(title)+b);
  row=row.replace(/<p>([\s\S]*?)<\/p>/,(_,text)=>'<details class="pr-library-source"><summary>出典と記録</summary><p>'+text+'</p></details>');
  groups.get(category).push({entry,html:row});
 });
 const max=Math.max(1,...[...groups.values()].map(g=>g.length));
 const chart='<figure class="pr-library-map"><figcaption>分類から探す <span>画面数</span></figcaption><nav aria-label="資料の分類">'+[...groups].map(([label,items],i)=>`<a href="#library-category-${i+1}"><span>${esc(label)}</span><span class="pr-library-track" aria-hidden="true"><i style="width:${items.length/max*100}%"></i></span><span class="pr-library-count">${items.length}画面</span></a>`).join('')+'</nav></figure>';
 const sections=[...groups].map(([label,items],i)=>`<section class="pr-library-group" id="library-category-${i+1}"><h2>${esc(label)} <span>${items.length}画面</span></h2><ul class="pu-results">${items.map(row=>row.html).join('')}</ul></section>`).join('');
 let output=html.replace(list[0],chart+sections).replace('<h1>内容と操作の一覧</h1>','<h1>資料と画面を探す</h1>').replace('元の画像・図・表・操作を保持した各画面です。検索では全項目と資料の原文を照合できます。','分類を選び、使いたい画面を開けます。図・比較・操作は各画面へ、言葉から探すときは検索へ。');
 output=output.replace('</head>','<link rel="stylesheet" href="portal-reader.css"></head>');
 files.set(page,typeof input==='string'?output:Buffer.from(output));files.set(prefix+'portal-reader.css',fs.readFileSync(path.join(__dirname,'reader.css')));
}
module.exports={enhanceLibrary};
