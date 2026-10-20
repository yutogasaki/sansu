'use strict';
// Additive six-entry workspace. The repository supplies its domain content.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const TABS=[['home','概要','index.html'],['strategy','企画・成長','strategy.html'],['work','開発・仕事','work.html'],['outcomes','成果・評価','outcomes.html'],['knowledge','知識・記憶','knowledge.html'],['ai','AI開発能力','ai.html']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function verifyPin(){const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'lock.json')));for(const [f,h]of Object.entries(lock.files))if(hash(fs.readFileSync(path.join(__dirname,f)))!==h)throw Error('Changed workspace component: '+f);return lock;}
function enhance({files,site,screens,areas={},workIds=[],workRefs}){
 const lock=verifyPin(),changed=[];
 const repo=site.slug;if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(repo||''))throw Error('Invalid workspace repository');
 const refs=workRefs||Object.fromEntries(workIds.map(id=>[id,repo+':work/'+id]));
 if(workIds.some(id=>!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(id)||refs[id]!==repo+':work/'+id))throw Error('Invalid workspace work reference');
 for(const [name,bytes]of files){
  if(!name.endsWith('.html')||name.startsWith('previous/'))continue;
  let html=Buffer.from(bytes).toString();if(!/data-portal-site=/.test(html))continue;
  const original=html.match(/<header class="bar">[\s\S]*?<\/header>/)?.[0];if(!original)throw Error('Missing workspace header: '+name);
  const base='../'.repeat(name.split('/').length-1),oldTab=original.match(/<nav class="tabs"[\s\S]*?<\/nav>/)?.[0].match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<span>([^<]+)/)?.[1];
  const tab=screens[name]?.tab||areas[name]||({'ホーム':'home','仕事':'work','判断':'work','資料':'knowledge','検索':'knowledge'}[oldTab])||'knowledge';
  const current=TABS.find(t=>t[0]===tab);if(!current)throw Error('Unknown workspace area');
  const root=original.match(/<a class="crumb-root"[\s\S]*?<\/a>/)?.[0]||'',switcher=original.match(/<details class="switcher">[\s\S]*?<\/details>/)?.[0]||'';
  const find=original.match(/<button class="find"[\s\S]*?<\/button>/)?.[0]||'';
  const links=TABS.map(([id,title,url])=>`<a data-workspace-link href="${base+url}"${id===tab?' aria-current="page"':''}>${title}</a>`).join('');
  const header=`<header class="bar workspace-bar"><div class="workspace-top">${root}<a class="workspace-brand" href="${base}index.html">${esc(site.title)}</a><span class="workspace-area">${current[1]}</span><button class="workspace-toggle" type="button" aria-label="メニューを開く" aria-controls="workspace-menu" aria-expanded="false"><span aria-hidden="true">☰</span><span>メニュー</span></button></div><div class="workspace-host"><div class="workspace-panel"><div class="workspace-menu-head"><h2>${esc(site.title)}のメニュー</h2><button type="button" data-workspace-close>閉じる</button></div><nav class="workspace-nav" aria-label="${esc(site.title)}のメインナビゲーション">${links}</nav><div class="workspace-return">${root}</div><div class="workspace-tools">${switcher}<a href="${base}decisions.html">判断</a><a href="${base}search.html">検索</a>${find}</div></div></div><dialog id="workspace-menu" aria-label="${esc(site.title)}のメニュー"></dialog></header>`;
  html=html.replace('生成 '+esc(site.generatedAt),'資料の確認日 '+esc(site.generatedAt)).replace(original,header).replace('</head>',`<link rel="stylesheet" href="${base}workspace.css"></head>`).replace('</body>',`<script type="application/json" id="workspace-work-ids">${json(workIds)}</script><script type="application/json" id="workspace-work-refs">${json(refs)}</script><script src="${base}workspace.js"></script></body>`);
  files.set(name,html);changed.push({path:name,area:tab});
 }
 for(const f of ['workspace.css','workspace.js'])files.set(f,fs.readFileSync(path.join(__dirname,f)));
 const indexFile=Buffer.from(files.get('site-index.js')).toString(),old=JSON.parse(indexFile.replace(/^window.PORTAL_INDEX=/,'').replace(/;\s*$/,''));
 const pages=TABS.map(([,t,u])=>({k:'ページ',t,u}));
 files.set('site-index.js','window.PORTAL_INDEX='+json([...pages,{k:'ページ',t:'記憶・再開',u:'memory.html'},{k:'ページ',t:'判断',u:'decisions.html'},{k:'ページ',t:'資料一覧',u:'library.html'},{k:'ページ',t:'検索',u:'search.html'},...old.filter(p=>p.k!=='ページ')])+';\n');
 const text=JSON.parse(Buffer.from(files.get('site-text.js')).toString().replace(/^window.PORTAL_TEXT=/,'').replace(/;\s*$/,''));
 for(const [name]of Object.entries(screens))text[name]=Buffer.from(files.get(name)).toString().match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,12000)||'';
 files.set('site-text.js','window.PORTAL_TEXT='+json(text)+';\n');
 files.set('data/workspace-component.json',JSON.stringify({version:lock.version,files:lock.files,pages:changed,scope:'navigation and repository-composed content; adoption and execution stay canonical'},null,2)+'\n');
 return changed;
}
module.exports={TABS,enhance,verifyPin};
