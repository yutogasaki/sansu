/* Portal site 3 (draft) runtime. Pages work without it; it adds quick jump,
   filters, and the current-section marker. No page is wrapped in a viewer. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const index=window.PORTAL_INDEX||[],base=document.documentElement.dataset.base||'';
 // Root-absolute entries resolve through this page's own nav links, which the
 // HTTP server and the file:// export both already point at the right place.
 const routes=$$('[data-route]').map(a=>[a.dataset.route.replace(/[^/]*$/,''),a.href.replace(/[^/]*$/,'')]).sort((a,b)=>b[0].length-a[0].length);
 const link=u=>{if(/^[a-z]+:/i.test(u))return u;if(!u.startsWith('/'))return base+u;const r=routes.find(([p])=>u.startsWith(p));return r?r[1]+u.slice(r[0].length):u;};
 const norm=s=>String(s||'').toLowerCase().normalize('NFKC');
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // Menus close on outside click and Escape; only one is open at a time.
 const menus=$$('details.switcher');
 document.addEventListener('click',e=>{for(const d of menus)if(d.open&&!d.contains(e.target))d.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of menus)if(d.open){d.open=false;$('summary',d).focus();}});

 // Quick jump: every page, document, task and decision by name.
 const dialog=$('#jump'),input=dialog&&$('input',dialog),list=dialog&&$('.jump-list',dialog);let selected=0,hits=[];
 function render(){
  const words=norm(input.value).split(/\s+/).filter(Boolean);
  hits=(words.length?index.filter(i=>words.every(w=>norm(i.t+' '+(i.s||'')+' '+(i.id||'')).includes(w))):index.filter(i=>i.k==='ページ')).slice(0,40);
  selected=0;
  list.innerHTML=hits.length?hits.map((h,i)=>`<li><a href="${esc(link(h.u))}" aria-selected="${i===0}"><span class="jump-kind">${esc(h.k)}</span><span>${esc(h.t)}</span>${h.s?`<small>${esc(h.s)}</small>`:''}</a></li>`).join(''):'<li class="jump-empty">一致するものはありません</li>';
 }
 function move(d){const links=$$('a',list);if(!links.length)return;links[selected].setAttribute('aria-selected','false');selected=(selected+d+links.length)%links.length;links[selected].setAttribute('aria-selected','true');links[selected].scrollIntoView({block:'nearest'});}
 function openJump(){if(!dialog)return;input.value='';render();dialog.showModal();input.focus();}
 if(dialog){
  input.addEventListener('input',render);
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();move(1);}else if(e.key==='ArrowUp'){e.preventDefault();move(-1);}else if(e.key==='Enter'){const a=$$('a',list)[selected];if(a){e.preventDefault();location.href=a.href;}}});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  for(const b of $$('[data-jump]'))b.addEventListener('click',openJump);
  document.addEventListener('keydown',e=>{
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)||document.activeElement.isContentEditable;
   if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!typing)){e.preventDefault();openJump();}
  });
 }

 // Contents: highlight the section being read.
 const toc=$('.toc');
 if(toc){
  const links=$$('a',toc),targets=links.map(a=>document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  const wide=matchMedia('(min-width:1021px)'),sync=()=>{toc.open=wide.matches;};sync();wide.addEventListener('change',sync);
  toc.addEventListener('click',e=>{if(e.target.closest('a')&&!wide.matches)toc.open=false;});
  let frame=0;const spy=()=>{frame=0;const line=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)+8;let active=-1;targets.forEach((t,i)=>{if(t.getBoundingClientRect().top<=line)active=i;});
   links.forEach((a,i)=>{if(i===Math.max(active,0))a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});};
  addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(spy);},{passive:true});spy();
 }

 // Status filter on the work page; the choice is kept in the URL.
 const filters=$('[data-filter-for]');
 if(filters){
  const items=$$(filters.dataset.filterFor),groups=$$('[data-group]');
  const apply=value=>{for(const b of $$('button',filters))b.setAttribute('aria-pressed',String(b.value===value));
   for(const i of items)i.hidden=value!=='all'&&i.dataset.state!==value;
   for(const g of groups)g.hidden=!$$(filters.dataset.filterFor,g).some(i=>!i.hidden);
   const u=new URL(location.href);if(value==='all')u.searchParams.delete('state');else u.searchParams.set('state',value);history.replaceState(null,'',u);};
  filters.addEventListener('click',e=>{const b=e.target.closest('button');if(b)apply(b.value);});
  apply(new URL(location.href).searchParams.get('state')||'all');
 }

 // Library: words and category, both restorable from the URL.
 const lib=$('[data-library]');
 if(lib){
  const q=$('input',lib),sort=$('select',lib),rows=$$('[data-doc]'),groups=$$('.lib-group'),count=$('.result-count'),rail=$$('.rail a[data-cat]');
  const apply=()=>{
   const words=norm(q.value).split(/\s+/).filter(Boolean),cat=new URL(location.href).searchParams.get('cat')||'';let n=0;
   for(const r of rows){const ok=words.every(w=>norm(r.dataset.doc).includes(w))&&(!cat||r.dataset.cat===cat);r.hidden=!ok;if(ok)n++;}
   for(const g of groups){const any=$$('[data-doc]',g).some(r=>!r.hidden);g.hidden=!any;if(g.tagName==='DETAILS'&&(words.length||cat)&&any)g.open=true;}
   for(const a of rail)if(a.dataset.cat===cat)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');
   count.textContent=(words.length||cat?`${n}件 / 全${rows.length}件`:`全${rows.length}件`);
   const order=sort.value;for(const g of groups){const ul=$('.rows',g);const items=$$(':scope>li',ul);items.sort((a,b)=>order==='name'?a.dataset.title.localeCompare(b.dataset.title,'ja'):order==='date'?(b.dataset.date||'').localeCompare(a.dataset.date||''):a.dataset.order-b.dataset.order);ul.append(...items);}
  };
  q.addEventListener('input',()=>{const u=new URL(location.href);if(q.value)u.searchParams.set('q',q.value);else u.searchParams.delete('q');history.replaceState(null,'',u);apply();});
  sort.addEventListener('change',()=>{const u=new URL(location.href);if(sort.value!=='order')u.searchParams.set('sort',sort.value);else u.searchParams.delete('sort');history.replaceState(null,'',u);apply();});
  for(const a of rail)a.addEventListener('click',e=>{e.preventDefault();const u=new URL(location.href);if(a.dataset.cat&&u.searchParams.get('cat')!==a.dataset.cat)u.searchParams.set('cat',a.dataset.cat);else u.searchParams.delete('cat');history.pushState(null,'',u);apply();});
  addEventListener('popstate',()=>{q.value=new URL(location.href).searchParams.get('q')||'';apply();});
  q.value=new URL(location.href).searchParams.get('q')||'';{const s=new URL(location.href).searchParams.get('sort');if(s&&[...sort.options].some(o=>o.value===s))sort.value=s;}apply();
 }

 // Full-text search over the human index (titles and readable text only).
 const search=$('div[data-search]'); // Native cards may carry data-search text, not a search form.
 if(search){
  const q=$('input',search),out=$('.hits'),count=$('.result-count'),texts=window.PORTAL_TEXT||{};
  const run=()=>{
   const raw=q.value.trim(),words=norm(raw).split(/\s+/).filter(Boolean);
   const u=new URL(location.href);if(raw)u.searchParams.set('q',raw);else u.searchParams.delete('q');history.replaceState(null,'',u);
   if(!words.length){out.innerHTML='';count.textContent=`${index.length}件から探せます。ページ名・資料名・本文が対象です。`;return;}
   const found=[];
   for(const i of index){const body=texts[i.u]||'',hay=norm(i.t+' '+(i.s||'')+' '+body);if(!words.every(w=>hay.includes(w)))continue;
    const title=words.every(w=>norm(i.t).includes(w));const at=norm(body).indexOf(words[0]);
    found.push({i,score:title?0:1,snip:at<0?'':body.slice(Math.max(0,at-40),at+90)});}
   found.sort((a,b)=>a.score-b.score);
   const hl=s=>{let h=esc(s);for(const w of words)h=h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>`<mark>${m}</mark>`);return h;};
   count.textContent=`「${raw}」 ${found.length}件`;
   out.innerHTML=found.slice(0,100).map(({i,snip})=>`<li><a href="${esc(link(i.u))}">${hl(i.t)}</a>${snip?`<p>…${hl(snip)}…</p>`:''}<small>${esc(i.k)}${i.s?' · '+esc(i.s):''}</small></li>`).join('')||'<li class="empty">一致する内容はありません。言葉を短くするか、資料の分類から探してください。</li>';
  };
  q.addEventListener('input',run);q.value=new URL(location.href).searchParams.get('q')||'';run();
 }
})();
