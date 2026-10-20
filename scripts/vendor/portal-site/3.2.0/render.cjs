'use strict';
// Portal site 3 (draft) renderer: a site model in, every page out.
// Repos never write chrome; they supply the model (see README.md).
const {CATEGORIES,STATES,SHAPES}=require('./classify.cjs');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const pill=(state,text,label)=>`<span class="pill ${esc(state)}"${text&&text!==STATES[state]?` title="${esc(text)}"`:''}>${esc(label||STATES[state]||state)}</span>`;
const icon={
 home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 work:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 decide:'<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
 library:'<path d="M5 4h4v16H5zM10 4h4v16h-4zM15 5l4-1 2 15-4 1z"/>',
 search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
 ideas:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z"/>',
 log:'<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon[name]}</svg>`;

// ── Chrome shared by every page at every level.
const VERSION='3.2.0';
const X=require('./context-ui.cjs');
function shell(site,{path:here,title,tab,body,lead,headExtra='',bodyExtra=''}){
 const depth=here.split('/').length-1,base='../'.repeat(depth),u=p=>/^(?:[a-z]+:|\/)/.test(p)?p:base+p;
 const route=h=>h.startsWith('/')?` data-route="${esc(h)}"`:'';
 const tabs=site.tabs.map(t=>`<a href="${esc(u(t.href))}"${route(t.href)}${t.id===tab?' aria-current="page"':''}>${svg(t.icon)}<span>${esc(t.label)}</span>${t.count?`<span class="count" aria-label="${t.count}件">${t.count}</span>`:''}</a>`).join('');
 const projects=site.projects.map(p=>`<a href="${esc(u(p.href))}"${route(p.href)}${p.slug===site.slug?' aria-current="page"':''}><span class="dot" style="--project:${esc(p.accent)}"></span>${esc(p.title)}${p.waiting?`<small>判断待ち ${p.waiting}</small>`:''}</a>`).join('');
 return `<!doctype html><html lang="ja" data-portal-site="${VERSION}" data-base="${esc(base)}" style="--project:${esc(site.accent)};--project-soft:${esc(site.accentSoft)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)}｜${esc(site.title)}</title><link rel="stylesheet" href="${base}site.css">${headExtra}</head><body>
<a class="skip" href="#main">本文へ</a>
<header class="bar"><div class="bar-in">
<a class="crumb-root" href="${esc(u(site.workspaceHref))}">Workspace</a><span class="bar-sep" aria-hidden="true">/</span>
<details class="switcher"><summary><span class="dot"></span>${esc(site.title)}</summary><nav class="menu" aria-label="プロジェクトを切り替える"><a href="${esc(u(site.workspaceHref))}"${site.slug==='hub'?' aria-current="page"':''}>すべてのプロジェクト</a><hr>${projects}</nav></details>
<nav class="tabs" aria-label="${esc(site.title)}のページ">${tabs}</nav>
<button class="find" type="button" data-jump>${svg('search')}<span class="find-label">ページを探す</span><kbd>/</kbd><span class="sr-only">（ページ名で移動）</span></button>
</div></header>
<main id="main">${body}</main>
<footer class="footer"><div class="footer-in"><span>${esc(site.title)} の内部ポータル</span><span>生成 ${esc(site.generatedAt)}</span>${site.sources?`<span>正本：${esc(site.sources)}</span>`:''}${site.legacyHref?`<a href="${esc(u(site.legacyHref))}">以前の画面（保管）</a>`:''}</div></footer>
<dialog class="jump" id="jump" aria-label="ページを探す"><form method="dialog" class="jump-input">${svg('search')}<input type="search" placeholder="ページ・資料・仕事・判断の名前" autocomplete="off" aria-label="名前で探す"></form><ul class="jump-list" role="listbox"></ul></dialog>
${site.references?X.dialog():''}<script src="${base}site-index.js"></script>${tab==='search'?`<script src="${base}site-text.js"></script>`:''}<script src="${base}site.js"></script>${site.references?`<script src="${base}context.js"></script>`:''}${bodyExtra}
</body></html>`;
}
const head=({crumbs=[],title,lead,meta})=>`<header class="page-head">${crumbs.length?`<ol class="breadcrumb">${crumbs.map(([t,h])=>`<li>${h?`<a href="${esc(h)}">${esc(t)}</a>`:esc(t)}</li>`).join('')}</ol>`:''}<h1>${esc(title)}</h1>${lead?`<p class="lead">${esc(lead)}</p>`:''}${meta?`<div class="meta">${meta}</div>`:''}</header>`;
const section=(id,title,inner,aside='')=>`<section class="section" id="${esc(id)}" aria-labelledby="${esc(id)}-h"><div class="section-head"><h2 id="${esc(id)}-h">${esc(title)}</h2>${aside}</div>${inner}</section>`;

// ── Project: home. One screen answers: what, where now, what is stuck, what next.
function home(site){
 const o=site.overview,ready=site.decisions.filter(d=>d.group==='ready'),prep=site.decisions.filter(d=>d.group==='preparing');
 const now=`<div class="grid g3"><article class="card now"><h3>どこまで進んだ</h3><p title="${esc(o.progress)}">${esc(o.progress)}</p></article><article class="card now${o.blocker?' blocked':''}"><h3>止まっていること</h3><p title="${esc(o.blocker||'')}">${esc(o.blocker||'なし')}</p></article><article class="card now"><h3>次にやること</h3><p title="${esc(o.next)}">${esc(o.next)}</p></article></div>`;
 const call=ready.length?`<a class="callout" href="decisions.html"><strong>あなたの判断待ち ${ready.length}件</strong><span>${esc(ready[0].title)}</span><span class="go">判断へ →</span></a>`:prep.length?`<a class="callout quiet" href="decisions.html"><strong>判断の準備中 ${prep.length}件</strong><span>${esc(prep[0].title)}（選択肢を整理中。まだ回答は不要）</span><span class="go">見る →</span></a>`:'';
 const ent=site.entrances.length?section('use','使う',`<div class="grid g3">${site.entrances.map(e=>`<a class="card entrance" href="${esc(e.href)}"${/^https?:/.test(e.href)?' target="_blank" rel="noopener"':''}><figure>${e.image?`<img src="${esc(e.image)}" alt="${esc(e.title)}の画面">`:''}</figure><div><h3>${esc(e.title)}${/^https?:/.test(e.href)?'<span class="ext">↗</span>':''}</h3><p>${esc(e.purpose)}</p></div></a>`).join('')}</div>`):'';
 const flow=site.flow.length?section('flow','作業の流れ',flowBand(site.flow),'<a href="work.html">仕事をすべて見る →</a>'):'';
 const active=site.tasks.filter(t=>t.state!=='done').slice(0,5),recent=[...site.docs].filter(d=>d.date&&d.tier==='list').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 const two=`<div class="section grid g2"><section aria-labelledby="active-h"><div class="section-head"><h2 id="active-h">動いている仕事</h2><a href="work.html">すべて →</a></div><div class="card"><ul class="rows">${active.map(t=>`<li><a class="row" href="work.html#${esc(t.anchor)}"><span class="row-title">${esc(t.title)}</span><span class="row-sub">${t.id?`<span class="chip">${esc(t.id)}</span>`:''}<span>${esc(t.owner||'')}</span></span><span class="row-end">${pill(t.state,t.status)}</span></a></li>`).join('')||'<li class="empty">動いている仕事はありません</li>'}</ul></div></section><section aria-labelledby="recent-h"><div class="section-head"><h2 id="recent-h">最近の資料</h2><a href="library.html?sort=date">すべて →</a></div><div class="card"><ul class="rows">${recent.map(d=>docRow(d)).join('')}</ul></div></section></div>`;
 const pinned=site.pinned.length?section('pinned','よく使う資料',`<div class="card"><ul class="rows">${site.pinned.map(d=>docRow(d)).join('')}</ul></div>`,'<a href="library.html">資料をすべて見る →</a>'):'';
 const aiCard=a=>`<a class="card tool ai-card" href="${esc(a.href)}"><small>${esc(a.kind)}</small><b>${esc(a.title)}</b><span>${esc(a.summary||a.source)}</span></a>`;
 const count=k=>(site.ai||[]).filter(a=>a.kind===k).length,main=(site.ai||[]).filter(a=>!['スキル','記憶'].includes(a.kind)).slice(0,4);
 const ai=(site.ai||[]).length?section('ai','AIの入口',`<div class="grid g3">${main.map(aiCard).join('')}${['スキル','記憶'].filter(count).map(k=>`<a class="card tool ai-card" href="library.html?cat=ai#ai-${k==='スキル'?'skills':'memory'}"><small>${k}</small><b>${k} ${count(k)}件</b><span>${esc((site.ai||[]).filter(a=>a.kind===k).slice(0,4).map(a=>a.title).join('・'))}</span></a>`).join('')}</div>`,'<a href="library.html?cat=ai">AIの環境をすべて見る →</a>'):'';
 return head({title:site.title,lead:o.goal,meta:`${pill(o.state)}<span>内容の確認日 ${esc(site.checkedAt||'未記録')}</span>`})+now+call+ent+flow+two+pinned+ai;
}
function flowBand(nodes){
 return `<ol class="flow">${nodes.map(n=>`<li class="${n.current?'current':''}"><h3>${esc(n.title)}</h3>${pill(n.state,n.status)}<p>${esc(n.body||'')}</p></li>`).join('')}</ol>`;
}
const docRow=d=>`<li${d.anchor&&d.first?` id="ai-${esc(d.anchor)}"`:''} data-doc="${esc(d.title+' '+(d.id||'')+' '+d.origCategory+' '+d.source)}" data-cat="${esc(d.cat)}" data-title="${esc(d.title)}" data-date="${esc(d.date||'')}" data-order="${d.order}"><a class="row" href="${esc(d.href)}"><span class="row-title">${esc(d.title)}</span>${d.summary?`<span class="row-sum">${esc(d.summary.text)}</span>`:''}<span class="row-sub">${d.id?`<span class="chip">${esc(d.id)}</span>`:''}${d.date?`<span>${esc(d.date)}</span>`:''}<span>${esc(d.sourceName)}</span>${d.reference?`<span>${esc(d.reference.label)} · <code>${esc(d.reference.version)}</code></span>`:''}</span></a></li>`;

function workFields(t){
 const fields=[['実行者（既存記録）',t.executor],['優先度（原文）',t.priority],['依存する仕事',t.dependencies],['障害・停止理由',t.blockers]];
 return `<dl class="facts">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${Array.isArray(v)?v.map(esc).join('<br>')||'記録なし':esc(v||'未記録')}</dd></div>`).join('')}</dl><p class="muted">担当・優先度・障害は正本の記録です。現在の接続や自動実行の割当を示すものではありません。</p>`;
}
// ── Project: work. The flow, then every task by shared state.
function work(site){
 const order=['blocked','review','doing','idle','done'],by=Object.fromEntries(order.map(s=>[s,site.tasks.filter(t=>t.state===s)]));
 const filters=`<div class="filters" data-filter-for="[data-task]" role="group" aria-label="状態で絞り込む"><button type="button" value="all" aria-pressed="true">すべて <b>${site.tasks.length}</b></button>${order.filter(s=>by[s].length).map(s=>`<button type="button" value="${s}" aria-pressed="false">${STATES[s]} <b>${by[s].length}</b></button>`).join('')}</div>`;
 const list=order.filter(s=>by[s].length).map(s=>`<div data-group="${s}"><h3 class="group-title">${pill(s)}<span>${by[s].length}件</span></h3><div class="card"><ul class="rows">${by[s].map(t=>`<li data-task data-state="${s}" id="${esc(t.anchor)}"><details class="task"><summary class="row"><span class="row-title">${esc(t.title)}</span><span class="row-sub">${t.id?`<span class="chip">${esc(t.id)}</span>`:''}${t.owner?`<span>担当 ${esc(t.owner)}</span>`:''}${t.started?`<span>開始 ${esc(t.started)}</span>`:''}</span><span class="row-end">${pill(t.state,t.status)}</span></summary><div class="task-body"><div class="wide"><h4>いまの状態（原文）</h4><p>${esc(t.status)}</p></div>${t.scope?`<div class="wide"><h4>範囲</h4><p>${esc(t.scope)}</p></div>`:''}${t.completion?.length?`<div><h4>完了の条件</h4><ul>${t.completion.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`:''}${t.verification?.length?`<div><h4>確かめ方</h4><ul>${t.verification.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`:''}${t.reference?`<div class="wide">${workFields(t)}${X.panel(t.reference)}</div>`:''}${t.evidence?.length?`<div class="wide"><h4>記録</h4><ul>${t.evidence.map(e=>`<li>${e.href?`<a href="${esc(e.href)}">${esc(e.title)}</a>`:esc(e.title)}</li>`).join('')}</ul></div>`:''}</div></details></li>`).join('')}</ul></div></div>`).join('');
 return head({title:'仕事',lead:'目的から確認までの流れと、すべての仕事の状態。止まっているものと確認待ちを先に並べます。'})+X.launcher(site,'work')+(site.flow.length?flowBand(site.flow):'')+`<div class="section">${filters}${list||'<p class="empty">記録された仕事はありません</p>'}</div>`;
}

// ── Project: decisions. What waits for an answer first, then the log.
function decisions(site){
 const groups=[['ready','回答待ち','あなたの回答で次の仕事が進みます。'],['preparing','準備中','選択肢や根拠を整理中です。まだ回答は不要です。'],['done','決まったこと','決定と反映の記録です。']];
 const card=d=>`<article class="card decision" id="${esc(d.anchor)}">${pill(d.state,d.stateText,d.stateText)}<h3>${esc(d.title)}</h3><p class="why">${esc(d.reason)}</p>${d.recommendation?`<div class="reco"><b>おすすめ</b>${esc(d.recommendation)}</div>`:''}${d.options.length?`<div class="options">${d.options.map(o=>`<div class="option"><b>${esc(o.label)}</b><p>${esc(o.description||'')}</p>${o.impact?`<p><b>影響：</b>${esc(o.impact)}</p>`:''}${o.rollback?`<p><b>戻し方：</b>${esc(o.rollback)}</p>`:''}${o.nextWork?`<p><b>選んだ場合の次の仕事（提案）：</b>${esc(o.nextWork.action)}（${esc(o.nextWork.actor)}）</p>`:''}</div>`).join('')}</div>`:''}${d.facts.length?`<dl class="facts">${d.facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:''}${d.impact?`<p class="more"><b>決めないと：</b>${esc(d.impact)}</p>`:''}${d.reference?`${!d.recommendation?'<p class="ref-warnings">推奨が未記入です。判断の準備中のため、まだ回答を求めません。</p>':''}${X.panel(d.reference)}`:''}${d.evidence.length?`<details class="more"><summary>根拠と記録（${d.evidence.length}）</summary><ul>${d.evidence.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></details>`:''}</article>`;
 return head({title:'判断',lead:'Yuが決めることを、回答待ち・準備中・決まったことに分けて並べます。'})+X.launcher(site,'decision')+groups.map(([g,t,hint])=>{const list=site.decisions.filter(d=>d.group===g);return section('d-'+g,`${t}（${list.length}）`,list.length?`<div class="grid">${list.map(card).join('')}</div>`:`<p class="empty">${g==='ready'?'いま回答が必要な判断はありません。':'ありません。'}</p>`,`<p>${hint}</p>`);}).join('');
}

// ── Project: library. Every document once, in the shared categories.
function library(site){
 const listed=site.docs.filter(d=>(d.tier==='list'||d.tier==='tool')&&d.cat!=='ai'),linked=site.docs.filter(d=>d.tier==='link'),ai=site.ai||[];
 const aiDocs=ai.map((a,i,all)=>({first:i===all.findIndex(x=>x.kind===a.kind),title:a.title,id:null,summary:a.summary?{text:a.summary}:null,cat:'ai',origCategory:a.kind,source:a.source,sourceName:a.kind+(a.page?'':'（ファイル）'),date:null,order:i,href:a.href,anchor:a.kind==='スキル'?'skills':a.kind==='記憶'?'memory':null}));
 const cats=CATEGORIES.map(c=>({...c,docs:c.id==='ai'?aiDocs:listed.filter(d=>d.cat===c.id)})).filter(c=>c.docs.length);
 const rail=`<nav class="rail" aria-label="資料の分類"><h2>分類</h2><ul><li><a href="library.html" data-cat="">すべて<span>${listed.length+aiDocs.length}</span></a></li>${cats.map(c=>`<li><a href="library.html?cat=${c.id}" data-cat="${c.id}">${esc(c.title)}<span>${c.docs.length}</span></a></li>`).join('')}</ul><p class="note">いま使う資料だけを並べています。日付つきの報告・監査・完了メモ（${linked.length}件）は、関係する仕事・判断と検索から開けます。</p></nav>`;

 const groups=cats.map(c=>`<section class="lib-group" id="cat-${c.id}"><h2>${esc(c.title)}<span>${c.docs.length}件</span></h2><p>${esc(c.hint)}</p><div class="card"><ul class="rows">${c.docs.map(docRow).join('')}</ul></div></section>`).join('');
 return head({title:'資料',lead:`${site.title}でいま使う資料 ${listed.length}件。古い報告や作業記録は、関係する仕事・判断から開きます。`})+`<div class="split">${rail}<div data-library><div class="toolbar"><label class="searchbox">${svg('search')}<span class="sr-only">資料を絞り込む</span><input type="search" placeholder="資料名・番号・ファイル名で絞り込む"></label><select aria-label="並び順"><option value="order">分類の順</option><option value="date">新しい順</option><option value="name">名前の順</option></select></div><p class="result-count" aria-live="polite"></p>${groups}</div></div>`+X.environment(site)+X.indexSection(site)+X.launcher(site,'knowledge');
}

// ── Project: one document. Siblings · article · contents.
function doc(site,d){
 const cat=CATEGORIES.find(c=>c.id===d.cat),listed=d.tier==='list',shape=SHAPES[d.type]||SHAPES.research;
 const siblings=listed?site.docs.filter(x=>x.cat===d.cat&&x.tier==='list'):[],i=siblings.indexOf(d),prev=siblings[i-1],next=siblings[i+1];
 const rel=h=>/^(?:[a-z]+:|\.\.\/)/.test(h)&&!/^doc\//.test(h)?'../'+h:'../'+h;
 const rail=listed?`<nav class="rail" aria-label="${esc(cat.title)}の資料"><h2>${esc(cat.title)}</h2><ul>${siblings.slice(Math.max(0,i-12),i+13).map(x=>`<li><a href="${esc(rel(x.href))}"${x===d?' aria-current="page"':''}>${esc(x.title)}</a></li>`).join('')}</ul></nav>`
  :`<nav class="rail" aria-label="関係する仕事"><h2>関係する仕事</h2><ul>${(d.related||[]).map(t=>`<li><a href="../${esc(t.href)}">${esc(t.title)}</a></li>`).join('')||'<li><a href="../work.html">仕事の一覧へ</a></li>'}</ul></nav>`;
 const toc=d.toc.length>=2?`<details class="toc" open><summary>このページの目次</summary><nav aria-label="このページの目次"><ol>${d.toc.map(h=>`<li><a href="#${esc(h.id)}"${h.level>2?' class="sub"':''}>${esc(h.text)}</a></li>`).join('')}</ol></nav></details>`:'<div></div>';
 const crumbs=listed?[[site.title,'../index.html'],['資料','../library.html'],[cat.title,'../library.html?cat='+cat.id]]:[[site.title,'../index.html'],['仕事','../work.html'],['記録',null]];
 const status=site.references?esc(d.reference?.label||'未確認（参照索引未登録）'):d.status?esc(d.status):'<span class="todo">未確認</span>';
 const summary=d.summary?(d.summary.own?`<p>${esc(d.summary.text)}</p>`:`<p>${esc(d.summary.text)}</p><p class="auto">冒頭の段落から自動で表示しています。資料の先頭に要点（3行まで）を書くと、ここに出ます。</p>`):'<p class="todo">要点がまだ書かれていません。</p>';
 const brief=`<section class="brief" aria-label="要点"><div class="brief-main"><h2>要点</h2>${summary}</div><dl class="brief-facts"><div><dt>種類</dt><dd>${esc(listed?shape.label:'記録')}</dd></div><div><dt>状態</dt><dd>${status}</dd></div><div><dt>更新</dt><dd>${esc(d.date||'不明')}</dd></div>${(d.related||[]).length?`<div><dt>関係する仕事</dt><dd>${d.related.map(t=>`<a class="chip" href="../${esc(t.href)}">${esc(t.id)}</a>`).join(' ')}</dd></div>`:''}</dl></section>`;
 const meta=`${d.id?`<span class="chip">${esc(d.id)}</span>`:''}<span>${esc(listed?cat.title:'作業の記録')}</span>`;
 const shapeNote=d.shape&&d.shape.length?`<p><b>この種類の資料の形：</b>${d.shape.map(x=>`<span class="shape ${x.found?'ok':'miss'}">${x.found?'✓':'—'} ${esc(x.name)}</span>`).join(' ')}</p>`:'';
 const article=`<article class="article">${head({crumbs,title:d.title,meta})}${brief}${site.references?X.panel(d.reference,'../'):''}${d.reference?X.launcher(site,'knowledge',d.reference):''}<div class="prose">${d.html||`<p>${esc(d.summary?.text||'本文はまだ生成されていません。')}</p>`}</div><details class="card source"><summary>出典と形の点検</summary><p>正本：<code>${esc(d.source)}</code>（元の分類：${esc(d.origCategory)}）</p>${shapeNote}${d.originalHref?`<p><a href="${esc(d.originalHref)}">元の閲覧ページを開く</a></p>`:''}</details>${listed?`<nav class="pager" aria-label="同じ分類の前後">${prev?`<a class="card" href="${esc(rel(prev.href))}"><small>← 前の資料</small>${esc(prev.title)}</a>`:''}${next?`<a class="card" href="${esc(rel(next.href))}"><small>次の資料 →</small>${esc(next.title)}</a>`:''}</nav>`:''}</article>`;
 return `<div class="reader">${rail}${article}${toc}</div>`;
}

function search(site){
 return head({title:'検索',lead:'ページ名・資料名・本文から探します。コードや生成データは対象外です（原文・保管を除く）。'})+`<div data-search><label class="searchbox">${svg('search')}<span class="sr-only">検索する言葉</span><input type="search" placeholder="例：学習マップ、監査、範囲" autofocus></label><p class="result-count" aria-live="polite"></p><ul class="hits"></ul></div>`;
}

const RUN={running:['doing','実行中'],done:['done','完了'],failed:['blocked','失敗'],blocked:['blocked','対応待ち'],stopped:['idle','停止']};
function runsSection(site,limit){
 const runs=[...(site.runs||[])].sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||String(b.started_at).localeCompare(String(a.started_at))).slice(0,limit);
 if(!runs.length)return '';
 const name=slug=>(site.cards||[]).find(c=>c.slug===slug)?.title||(slug==='hub'?'hub':slug);
 return section('runs','AIの作業',`<div class="card"><ul class="rows">${runs.map(r=>{const [st,label]=RUN[r.status]||['idle',r.status];return `<li><div class="row"><span class="row-title">${esc(r.title||r.id)}</span><span class="row-sub"><span class="chip">${esc(r.id)}</span><span>${esc(name(r.repo))}</span><span>開始 ${esc(String(r.started_at||'').slice(0,16).replace('T',' '))}</span>${r.ended_at?`<span>終了 ${esc(String(r.ended_at).slice(0,16).replace('T',' '))}</span>`:''}</span><span class="row-end">${pill(st,null,label)}</span></div></li>`;}).join('')}</ul></div>`,`<a href="${esc(site.runsHref||'runs/index.html')}">すべての記録 →</a>`);
}
// ── Workspace: every project at a glance, with what waits for Yu first.
function workspace(site){
 const waiting=site.cards.flatMap(c=>c.ready.map(d=>({...d,project:c})));
 const call=waiting.length?`<div class="grid">${waiting.map(d=>`<a class="callout" href="${esc(d.project.decisionsHref||d.project.href)}"><strong>${esc(d.project.title)}：判断待ち</strong><span>${esc(d.title)}</span><span class="go">判断へ →</span></a>`).join('')}</div>`:`<p class="callout quiet"><strong>いま回答が必要な判断はありません</strong><span>準備中の判断は各プロジェクトの「判断」に並びます。</span></p>`;
 const cards=site.cards.map(c=>`<a class="card project" id="project-${esc(c.slug)}" href="${esc(c.href)}" style="--project:${esc(c.accent)};--project-soft:${esc(c.accentSoft)}"><figure>${c.image?`<img src="${esc(c.image)}" alt="">`:'<span>画像なし</span>'}</figure><div><h3><span class="dot"></span>${esc(c.title)}</h3><p>${esc(c.summary)}</p>${c.blocker?`<p><b>止まっている：</b>${esc(c.blocker)}</p>`:''}<div class="foot">${pill(c.state)}${c.preparing?`<span class="pill idle">判断準備中 ${c.preparing}</span>`:''}${c.adopted?'':'<span class="pill review">新ポータル未移行</span>'}</div></div></a>`).join('');
 return head({title:'すべてのプロジェクト',lead:'各プロジェクトの現在地と、あなたの判断が必要なもの。'})+section('waiting','あなたの判断',call)+section('projects',`プロジェクト（${site.cards.length}）`,`<div class="grid g3">${cards}</div>`)+runsSection({...site,runs:(site.runs||[]).filter(r=>r.status==='running')},5);
}


// ── Workspace: progress of every project on one board.
function workspaceBoard(site){
 const order=['blocked','review','doing','idle','done'];
 const rows=site.cards.map(c=>{const n=Object.fromEntries(order.map(s=>[s,c.tasks.filter(t=>t.state===s).length]));const stage=c.flow.find(f=>f.current);
  return `<article class="card board-row" style="--project:${esc(c.accent)}"><div class="board-name"><h3><span class="dot"></span><a href="${esc(c.href)}">${esc(c.title)}</a></h3><p>${esc(c.summary)}</p></div><div class="board-stage"><h4>いまの段階</h4>${stage?`<p>${esc(stage.title)}</p>${pill(stage.state,stage.status)}`:'<p class="muted">流れ未登録</p>'}</div><div class="board-counts"><h4>仕事</h4><p>${order.filter(s=>n[s]).map(s=>`<a href="${esc(c.workHref?c.workHref+'?state='+s:c.href)}">${pill(s,null,STATES[s]+' '+n[s])}</a>`).join(' ')||'<span class="muted">記録なし</span>'}</p></div><div class="board-block"><h4>止まっていること</h4><p>${esc(c.blocker||'なし')}</p></div></article>`;}).join('');
 return head({title:'進み具合',lead:'全プロジェクトのいまの段階と仕事の状態。止まっているものから確かめます。'})+`<div class="grid">${rows}</div>`+runsSection(site,12)+(site.extraLinks?`<p class="more">${site.extraLinks}</p>`:'');
}
// ── Workspace: every decision across projects, answer-first.
function workspaceDecisions(site){
 const all=site.cards.flatMap(c=>c.decisions.map(d=>({...d,project:c})));
 const block=(g,title,hint)=>{const list=all.filter(d=>d.group===g);return section('w-'+g,`${title}（${list.length}）`,list.length?`<div class="card"><ul class="rows">${list.map(d=>`<li><a class="row" href="${esc(d.project.decisionsHref?d.project.decisionsHref+'#'+d.anchor:d.project.href)}"><span class="row-title">${esc(d.title)}</span><span class="row-sub"><span class="dot" style="--project:${esc(d.project.accent)}"></span><span>${esc(d.project.title)}</span></span><span class="row-end">${pill(d.state,d.stateText,d.stateText)}</span></a></li>`).join('')}</ul></div>`:`<p class="empty">${g==='ready'?'いま回答が必要な判断はありません。':'ありません。'}</p>`,`<p>${hint}</p>`);};
 return head({title:'判断',lead:'全プロジェクトの判断をまとめて見ます。回答はそれぞれのプロジェクトの判断ページで行います。'})+block('ready','回答待ち','あなたの回答で仕事が進みます。')+block('preparing','準備中','選択肢を整理中。まだ回答は不要です。')+block('done','決まったこと','決定と反映の記録。');
}
// Moves an existing generated page into the shared frame: its own styles,
// main content and scripts are kept; its old header/navigation is dropped.
const OLD_CHROME=/(?:portal-ui|portal-shell|portal-reader|integration|portal-viewer)\.(?:css|js)/;
function wrap(site,{path:here,tab,title,html,crumbs=[]}){
 const headPart=(html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)||[])[1]||'';
 const headExtra=[...headPart.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>|<style\b[\s\S]*?<\/style>/gi)].map(m=>m[0]).filter(t=>!OLD_CHROME.test(t)).join('');
 const main=(html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)||[])[1];if(main==null)throw Error('wrap: page has no main: '+here);
 const tail=html.slice(html.search(/<\/main>/i));
 const bodyExtra=[...tail.matchAll(/<script\b[\s\S]*?<\/script>/gi),...headPart.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map(m=>m[0]).filter(t=>!OLD_CHROME.test(t)&&!/portal-ui-config|portal-shell-config/.test(t)).join('');
 const crumb=crumbs.length?`<ol class="breadcrumb wrapped-crumb">${crumbs.map(([t,h])=>`<li>${h?`<a href="${esc(h)}">${esc(t)}</a>`:esc(t)}</li>`).join('')}</ol>`:'';
 const dialogs=[...tail.matchAll(/<dialog\b[\s\S]*?<\/dialog>/gi)].map(m=>m[0]).filter(t=>!/id=["'](?:portal-ui|portal-shell|portal-viewer)/.test(t)).join('');
 const oldId=html.match(/<main\b[^>]*\bid=["']([^"']+)/i)?.[1];
 const alias=oldId&&oldId!=='main'?`<span id="${esc(oldId)}"></span>`:'';
 return shell(site,{path:here,tab,title,body:`<div class="wrapped">${alias}${crumb}${main}</div>`,headExtra,bodyExtra:dialogs+bodyExtra});
}
module.exports={VERSION,wrap,shell,home,work,decisions,library,doc,search,workspace,workspaceBoard,workspaceDecisions,esc,json};
