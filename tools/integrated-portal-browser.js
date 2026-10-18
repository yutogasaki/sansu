/* Local search and reading only. Canonical records are never edited here. */
const setURL=(values,push=false)=>{
 const url=new URL(location.href);
 for(const [key,value] of Object.entries(values))value?url.searchParams.set(key,value):url.searchParams.delete(key);
 if(url.href!==location.href)history[push?'pushState':'replaceState'](null,'',url);
};
const search=document.querySelector('#search');
const pageSearch=()=>{
 if(!search)return;
 const q=search.value.trim().toLowerCase();let count=0;
 const cards=[...document.querySelectorAll('[data-search]')];
 for(const card of cards){card.hidden=!!q&&!card.dataset.search.includes(q);if(!card.hidden)count++;}
 for(const group of document.querySelectorAll('.doc-group,.spec-list,.asset-groups')){
  const matches=[...group.querySelectorAll('[data-search]')].some(n=>!n.hidden);
  group.hidden=!!q&&!matches;
  if(group.previousElementSibling?.classList.contains('group-title'))group.previousElementSibling.hidden=group.hidden;
 }
 if(q)for(const node of cards.filter(n=>!n.hidden))for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
 const result=document.querySelector('#result');result.hidden=!q;result.textContent=count?q+'：'+count+' 件を表示':'一致する項目はありません。条件を解除して探し直せます。';
 setURL({'page-query':search.value});
};
if(search){
 search.value=new URL(location.href).searchParams.get('page-query')||'';
 search.addEventListener('input',pageSearch);pageSearch();
 document.querySelector('#page-search-reset')?.addEventListener('click',()=>{search.value='';pageSearch();search.focus();});
}
const globalSearch=document.querySelector('#global-search');
let restoreGlobal;
if(globalSearch){
 const category=document.querySelector('#global-category'),format=document.querySelector('#global-format');let index;
 const run=async()=>{
  const q=globalSearch.value.trim().toLowerCase();const result=document.querySelector('#global-results');const status=document.querySelector('#global-status');result.replaceChildren();
  try{
   index??=window.sansuSearchIndex||fetch('data/search.json').then(r=>{if(!r.ok)throw Error('search unavailable');return r.json();});
   const all=await index;
   const rows=all.filter(r=>(!q||r.body.toLowerCase().includes(q)||r.title.toLowerCase().includes(q))&&(!category.value||r.category===category.value)&&(!format.value||r.format===format.value));
   if(globalSearch.value.trim().toLowerCase()!==q)return;
   status.textContent=rows.length+' / '+all.length+' 件の資料'+(!rows.length?'。一致する資料はありません。条件を解除して探し直せます。':'');
   setURL({q:globalSearch.value,category:category.value,format:format.value});
   if(!q&&!category.value&&!format.value)return;
   for(const row of rows){const li=document.createElement('li');const a=document.createElement('a');a.href=row.href;a.textContent=row.label||'詳しい資料';li.append(a);result.append(li);}
  }catch{status.textContent='全文検索を開けません。このページの検索をご利用ください。';}
 };
 restoreGlobal=()=>{const params=new URL(location.href).searchParams;globalSearch.value=params.get('q')||'';category.value=params.get('category')||'';format.value=params.get('format')||'';run();};
 for(const input of [globalSearch,category,format])input.addEventListener('input',run);
 document.querySelector('#global-reset')?.addEventListener('click',()=>{globalSearch.value='';category.value='';format.value='';run();globalSearch.focus();});
 restoreGlobal();
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
 const stack=[];let opener,restoring=false,activeRow,activeURL;
 const close=()=>reader.close();
 document.querySelector('#reader-close').addEventListener('click',close);
 reader.addEventListener('close',()=>{content.replaceChildren();stack.length=0;if(!restoring)setURL({document:'',view:''});(opener||globalSearch||document.querySelector('h1'))?.focus();});
 function display(row,url,mode){
  const source=content.querySelector(':scope > .reader-source');
  content.replaceChildren();
  const resolveLink=raw=>new URL(raw.startsWith('/')?raw.slice(1):raw,raw.startsWith('/')?new URL('../',portalBase):url);
  content.append(window.sansuDocumentView(row,mode,resolveLink));
  if(source)content.append(source);
  for(const button of reader.querySelectorAll('[data-reader-view]'))button.setAttribute('aria-pressed',String(button.dataset.readerView===mode));
 }
 for(const button of reader.querySelectorAll('[data-reader-view]'))button.addEventListener('click',()=>{
  if(activeRow){display(activeRow,activeURL,button.dataset.readerView);setURL({view:button.dataset.readerView==='reading'?'':button.dataset.readerView});}
 });
 function show(url,label,push=true){
  if(push)stack.push({url,label});back.hidden=stack.length<2;
  const clean=new URL(url);clean.hash='';const row=corpus.get(clean.href);
  title.textContent=row?.title||label||'資料';content.replaceChildren();
  activeRow=row;activeURL=url;
  for(const button of reader.querySelectorAll('[data-reader-view]'))button.hidden=!row;
  if(row){display(row,url,new URL(location.href).searchParams.get('view')||'reading');setURL({document:row.source||row.href},!restoring&&stack.length===1);}
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
  if(!inFrame&&(a.closest('header,.original,.reader-source,.preserved-original')||a.classList.contains('back')))return;
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
 const restore=()=>{
  restoring=true;
  const source=new URL(location.href).searchParams.get('document');
  const row=[...corpus.values()].find(item=>item.source===source||item.href===source);
  if(row){stack.length=0;show(new URL(row.href,portalBase).href,row.label);}
  else if(reader.open)reader.close();
  restoring=false;
 };
 addEventListener('popstate',()=>{if(search){search.value=new URL(location.href).searchParams.get('page-query')||'';pageSearch();}restoreGlobal?.();restore();});
 restore();
}
