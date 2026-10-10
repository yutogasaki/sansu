(() => {
 'use strict';
 const data=window.ISLAND_REFERENCES;
 const refs=data.references;
 const byId=new Map(refs.map(r=>[r.id,r]));
 const $=id=>document.getElementById(id);
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const storeKey='sansu-island-art-atlas-v1-notes';
 let notes={};
 try {const parsed=JSON.parse(localStorage.getItem(storeKey)||'{}');for(const [id,n] of Object.entries(parsed))if(byId.has(id)&&n&&typeof n.text==='string'&&['参考','候補','保留','見送り'].includes(n.status))notes[id]=n;} catch {}
 let theme='すべて',notesOnly=false,visible=refs,selected=[],activeId=null;
 const themes=['すべて','場所の成長','地形','水辺','植物','家','素材','光','構図','幻想','かわいさ','暮らし'];
 const stages={separate:['離れている木','三本の木が離れて、それぞれの木陰を持つ。','<strong>離れている：</strong>三本の木は、それぞれの木陰を持つ。'],connected:['隣につながる木','根と樹冠がつながり、一つの地面のまとまりを作る。','<strong>隣につながる：</strong>根・樹冠・足元が寄り、一つの場所になり始める。'],grown:['育った大樹の庭','複数の幹に支えられた大きな樹冠と木陰の庭へ育つ。','<strong>大樹の庭になる：</strong>大きな樹冠と木陰が育ち、暮らしの居場所になる。']};
 document.querySelectorAll('[data-growth]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.growth;const stage=stages[key];$('growth-diagram').dataset.stage=key;$('growth-svg-title').textContent=stage[0];$('growth-svg-desc').textContent=stage[1];$('growth-caption').innerHTML=stage[2];document.querySelectorAll('[data-growth]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 $('theme-filters').innerHTML=themes.map(t=>`<button class="theme-button" type="button" data-theme="${esc(t)}" aria-pressed="${t===theme}">${esc(t)}</button>`).join('');
 function render(){
  const query=$('search').value.trim().toLocaleLowerCase();
  const kind=$('kind-filter').value;
  visible=refs.filter(r=>(theme==='すべて'||r.tags.includes(theme))&&(kind==='all'||r.kind===kind)&&(!notesOnly||notes[r.id])&&(!query||[r.id,r.title,r.source,r.observe,r.take,r.avoid,r.next,...r.tags].join(' ').toLocaleLowerCase().includes(query)));
  $('gallery').innerHTML=visible.map(r=>`<article class="reference-card" data-reference="${r.id}"><button class="image-button" data-detail="${r.id}" aria-label="${esc(r.id+' '+r.title+'を拡大')}" type="button"><img src="${esc(r.image)}" alt="${esc(r.title+'。'+r.observe)}" loading="lazy" decoding="async"><span class="zoom-label">拡大して見る ↗</span></button><div class="card-body"><div class="card-meta"><span class="card-id">${r.id}</span><span class="kind${r.kind==='生成参考'?' generated':''}">${esc(r.kind)}</span></div><h3>${esc(r.title)}</h3><p class="card-source">${esc(r.source)}</p><p class="card-status">${esc(r.status)}</p><div class="tag-list">${r.tags.map(t=>'<span>'+esc(t)+'</span>').join('')}</div><p class="card-transfer"><strong>取り入れる点</strong>${esc(r.take)}</p>${notes[r.id]?`<p class="memo-chip">判断メモ：${esc(notes[r.id].status)}${notes[r.id].text?' / '+esc(notes[r.id].text.slice(0,70)):''}</p>`:''}<div class="card-bottom"><button class="compare-toggle" type="button" data-compare="${r.id}" aria-pressed="${selected.includes(r.id)}" aria-label="${esc(r.id+'を比較'+(selected.includes(r.id)?'から外す':'へ追加'))}" ${selected.length===2&&!selected.includes(r.id)?'disabled':''}>${selected.includes(r.id)?'比較に選択済み':'比較へ追加 +'}</button><button class="details-button" type="button" data-detail="${r.id}">注釈と判断メモ ↗</button></div></div></article>`).join('');
  $('empty').hidden=visible.length>0;
  $('result-count').textContent=`${visible.length} / ${refs.length} 枚を表示`;
  document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));
  renderComparison();
 }
 function renderComparison(){
  $('compare-bar').hidden=!selected.length;
  document.body.classList.toggle('has-comparison',selected.length>0);
  $('open-compare').disabled=selected.length!==2;
  $('compare-selection').innerHTML=selected.map(id=>{const r=byId.get(id);return `<span class="selected-reference"><img src="${esc(r.image)}" alt=""><span>${r.id}<br>${esc(r.source.split(' / ')[0])}</span></span>`;}).join('');
 }
 function showDetail(id){
  const r=byId.get(id);activeId=id;
  $('detail-image').src=r.image;$('detail-image').alt=r.title+'。'+r.observe;
  $('detail-eyebrow').textContent=r.id+' / '+r.kind;
  $('detail-title').textContent=r.title;
  $('detail-status').textContent=r.status;
  $('detail-source').textContent=r.source;
  $('detail-notes').innerHTML=[['観察したこと',r.observe],['取り入れる点',r.take],['避けること',r.avoid],['次に確かめること',r.next]].map(([title,body])=>`<dt>${title}</dt><dd>${esc(body)}</dd>`).join('');
  $('detail-scope').textContent=r.captureScope;
  $('detail-source-link').href=r.sourceUrl;
  $('delete-note').disabled=!notes[id];$('note-status').value=notes[id]?.status||'参考';$('note-text').value=notes[id]?.text||'';$('note-feedback').textContent='';
  const index=visible.findIndex(v=>v.id===id);
  $('detail-position').textContent=`${index+1} / ${visible.length}`;
  $('previous-image').disabled=index<=0;$('next-image').disabled=index>=visible.length-1;
  if(!$('detail-dialog').open)$('detail-dialog').showModal();
  $('detail-dialog').scrollTop=0;
 }
 $('theme-filters').addEventListener('click',e=>{const button=e.target.closest('[data-theme]');if(button){theme=button.dataset.theme;render();}});
 $('search').addEventListener('input',render);$('kind-filter').addEventListener('change',render);
 $('notes-filter').addEventListener('click',()=>{notesOnly=!notesOnly;$('notes-filter').setAttribute('aria-pressed',String(notesOnly));render();});
 $('gallery').addEventListener('click',e=>{
  const detail=e.target.closest('[data-detail]');if(detail){showDetail(detail.dataset.detail);return;}
  const compare=e.target.closest('[data-compare]');if(compare){const id=compare.dataset.compare;selected=selected.includes(id)?selected.filter(i=>i!==id):selected.length<2?[...selected,id]:selected;render();$('announcement').textContent=`比較する画像は${selected.length}枚です。`;}
 });
 $('previous-image').addEventListener('click',()=>{const i=visible.findIndex(r=>r.id===activeId);if(i>0)showDetail(visible[i-1].id);});
 $('next-image').addEventListener('click',()=>{const i=visible.findIndex(r=>r.id===activeId);if(i<visible.length-1)showDetail(visible[i+1].id);});
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
 $('clear-compare').addEventListener('click',()=>{selected=[];render();});
 $('open-compare').addEventListener('click',()=>{
  if(selected.length!==2)return;
  $('compare-images').innerHTML=selected.map(id=>{const r=byId.get(id);return `<article><img src="${esc(r.image)}" alt="${esc(r.title)}"><h3>${r.id} · ${esc(r.title)}</h3><span class="badge">${esc(r.kind)} / ${esc(r.status)}</span><p class="card-source">${esc(r.source)}</p><p><strong>取り入れる点</strong><br>${esc(r.take)}</p><p><strong>避けること</strong><br>${esc(r.avoid)}</p><p><strong>次に確かめること</strong><br>${esc(r.next)}</p><p class="scope">${esc(r.captureScope)}</p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">元の出典 ↗</a></article>`;}).join('');
  $('compare-dialog').showModal();
 });
 $('note-form').addEventListener('submit',e=>{
  e.preventDefault();if(!activeId)return;
  notes[activeId]={status:$('note-status').value,text:$('note-text').value.trim(),updatedAt:new Date().toISOString()};
  let feedback='このブラウザに保存しました。書き出すと、次の改修へ引き継げます。';
  try{localStorage.setItem(storeKey,JSON.stringify(notes));}catch{feedback='ブラウザへの保存ができませんでした。メモの書き出しで残してください。';}
  $('delete-note').disabled=false;$('note-feedback').textContent=feedback;render();
 });
 $('delete-note').addEventListener('click',()=>{
  if(!activeId||!notes[activeId])return;
  delete notes[activeId];
  let feedback='この画像のメモを消しました。';
  try{localStorage.setItem(storeKey,JSON.stringify(notes));}catch{feedback='ブラウザの保存を更新できませんでした。書き出したメモをご利用ください。';}
  $('note-status').value='参考';$('note-text').value='';$('delete-note').disabled=true;$('note-feedback').textContent=feedback;render();
 });
 $('export-notes').addEventListener('click',()=>{
  const exported={strategyVersion:data.version,exportedAt:new Date().toISOString(),scope:'個人の比較メモ。製品採用を自動変更しない。',notes:Object.entries(notes).map(([id,n])=>({referenceId:id,title:byId.get(id).title,source:byId.get(id).source,...n}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='sansu-island-art-review-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('announcement').textContent=`${exported.notes.length}件の判断メモを書き出しました。`;
 });
 render();
})();
