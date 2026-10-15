/* Static, local reader only. No task edits or external submission. */
const search=document.querySelector('#search');
if(search)search.addEventListener('input',()=>{
 const q=search.value.trim().toLowerCase();let count=0;
 const cards=[...document.querySelectorAll('[data-search]')];
 for(const card of cards){card.hidden=!!q&&!card.dataset.search.includes(q);if(!card.hidden)count++;}
 for(const group of document.querySelectorAll('.doc-group,.spec-list,.asset-groups')){
  const matches=[...group.querySelectorAll('[data-search]')].some(n=>!n.hidden);
  group.hidden=!!q&&!matches;
  if(group.previousElementSibling?.classList.contains('group-title'))group.previousElementSibling.hidden=group.hidden;
 }
 if(q)for(const node of cards.filter(n=>!n.hidden))for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
 const result=document.querySelector('#result');result.hidden=!q;result.textContent=count+' 件を表示';
});
const globalSearch=document.querySelector('#global-search');
if(globalSearch){
 let index;
 globalSearch.addEventListener('input',async()=>{
  const q=globalSearch.value.trim().toLowerCase();const result=document.querySelector('#global-results');const status=document.querySelector('#global-status');result.replaceChildren();
  if(!q){status.textContent='';return;}
  try{
   index??=window.sansuSearchIndex||fetch('data/search.json').then(r=>{if(!r.ok)throw Error('search unavailable');return r.json();});
   const rows=(await index).filter(r=>r.body.toLowerCase().includes(q)||r.title.toLowerCase().includes(q));
   if(globalSearch.value.trim().toLowerCase()!==q)return;
   status.textContent=rows.length+' 件の資料が見つかりました';
   for(const row of rows){const li=document.createElement('li');const a=document.createElement('a');a.href=row.href;a.textContent=row.label||'詳しい資料';li.append(a);result.append(li);}
  }catch{status.textContent='全文検索を開けません。このページの検索をご利用ください。';}
 });
}

// A document, image, or interactive HTML opens on this page at the second level.
// Canonical relative URLs remain in the DOM for the hub's dependency collector.
const reader=document.querySelector('#reader');
if(reader){
 const portalBase=new URL('.',document.querySelector('script[src$="portal.js"]').src);
 const corpus=new Map((window.sansuSearchIndex||[]).map(row=>[new URL(row.href,portalBase).href,row]));
 const content=document.querySelector('#reader-content');
 const title=document.querySelector('#reader-title');
 const back=document.querySelector('#reader-back');
 const stack=[];let opener;
 const close=()=>reader.close();
 document.querySelector('#reader-close').addEventListener('click',close);
 reader.addEventListener('close',()=>{content.replaceChildren();stack.length=0;opener?.focus();});
 function show(url,label,push=true){
  if(push)stack.push({url,label});back.hidden=stack.length<2;
  const clean=new URL(url);clean.hash='';const row=corpus.get(clean.href);
  title.textContent=row?.title||label||'資料';content.replaceChildren();
  if(row){const pre=document.createElement('pre');pre.className='reader-text';pre.textContent=row.body;content.append(pre);}
  else if(/\.(?:png|jpe?g|webp|gif|svg)(?:#.*)?$/i.test(url)){
   const img=document.createElement('img');img.src=url;img.alt=label||'比較画像';content.append(img);
  }else{
   const frame=document.createElement('iframe');frame.title=label||'比較資料';frame.src=url;
   frame.addEventListener('load',()=>{try{frame.contentDocument.addEventListener('click',event=>follow(event,frame.contentDocument.baseURI,true));}catch{/* The original remains usable if its origin is isolated. */}});
   content.append(frame);
  }
  const details=document.createElement('details');details.className='reader-source ai-detail';
  const summary=document.createElement('summary');summary.textContent='元の資料を別に開く';
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='元の資料';details.append(summary,a);content.append(details);
  if(!reader.open)reader.showModal();document.querySelector('#reader-close').focus();content.scrollTop=0;reader.scrollTop=0;
 }
 back.addEventListener('click',()=>{stack.pop();const previous=stack.at(-1);show(previous.url,previous.label,false);});
 function follow(event,base,inFrame=false){
  const a=event.target.closest('a[href]');if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(!inFrame&&(a.closest('header,.original,.reader-source')||a.classList.contains('back')))return;
  const raw=a.getAttribute('href');if(!raw||raw.startsWith('#'))return;
  const url=new URL(raw,base);if(url.origin!==portalBase.origin||(!['file:','http:','https:'].includes(url.protocol)))return;
  const clean=new URL(url);clean.hash='';
  const isPortalPage=url.pathname.startsWith(portalBase.pathname)&&url.pathname.endsWith('.html');
  // Entry -> section is the second click from the hub. Deeper navigation stays here.
  if(!inFrame&&location.pathname===new URL('index.html',portalBase).pathname&&isPortalPage)return;
  if(corpus.has(clean.href)||/\.(?:html|png|jpe?g|webp|gif|svg)$/i.test(url.pathname)){
   event.preventDefault();if(!reader.open)opener=a;
   show(url.href,a.textContent.trim()||a.getAttribute('aria-label')||'比較画像');
  }
 }
 document.addEventListener('click',event=>follow(event,document.baseURI));
}
