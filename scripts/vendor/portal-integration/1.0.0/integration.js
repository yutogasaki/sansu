'use strict';
(async () => {
  const source = document.getElementById('pu-data');
  let data = source ? JSON.parse(source.textContent) : null;
  if (!data && window.__portalSearchGzip) {
    try {
      const binary = Uint8Array.from(atob(window.__portalSearchGzip),character=>character.charCodeAt(0));
      const stream = new Blob([binary]).stream().pipeThrough(new DecompressionStream('gzip'));
      data = JSON.parse(await new Response(stream).text());
      delete window.__portalSearchGzip;
    } catch {
      const notice = document.getElementById('pu-count');
      if(notice) notice.textContent='検索用データを開けませんでした。ページを再読み込みするか、下の「全件の元データ」から確認してください。';
      return;
    }
  }
  const dialog = document.getElementById('pu-detail');
  let origin = null;
  let viewer = null;
  let frame = null;
  let viewerOrigin = null;
  let viewerTrail = [];
  const rootUrl = new URL(document.querySelector('script[src$="integration.js"]')?.src || location.href);
  rootUrl.pathname=rootUrl.pathname.replace(/integration\.js$/,'');
  const isView = url => url.origin===rootUrl.origin && url.pathname.startsWith(rootUrl.pathname) &&
    (/\/(?:integrated|read)\//.test(url.pathname)||/\/(?:verification-flow|pages)\.html$/.test(url.pathname));
  function showView(url,button,title,push=true){
    if(!isView(url))return;
    if(!viewer){
      viewer=document.createElement('dialog');viewer.className='pu-detail pu-viewer';viewer.setAttribute('aria-label','内容と操作');
      const toolbar=document.createElement('header');
      const back=document.createElement('button');back.textContent='ひとつ前へ';back.type='button';
      back.addEventListener('click',()=>history.back());
      const close=document.createElement('button');close.textContent='閉じて元の位置へ';close.type='button';close.addEventListener('click',()=>viewer.close());
      toolbar.append(back,close);frame=document.createElement('iframe');frame.title='内容と操作';viewer.append(toolbar,frame);document.body.append(viewer);
      viewer.addEventListener('close',()=>{frame.removeAttribute('src');viewerTrail=[];const url=new URL(location.href);url.searchParams.delete('view');history.replaceState(null,'',url);viewerOrigin?.focus();});
    }
    if(button)viewerOrigin=button;
    if(push)viewerTrail.push(url.href);
    if(push){const current=new URL(location.href);current.searchParams.set('view',url.href);history.pushState({portalTrail:viewerTrail.slice()},'',current);}
    frame.title=title||'内容と操作';frame.src=url.href;
    viewer.querySelector('button').disabled=viewerTrail.length<2;
    if(!viewer.open)viewer.showModal();
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return;
    const url=new URL(link.href);
    if(!isView(url))return;
    event.preventDefault();
    if(window.parent!==window){window.parent.postMessage({portalView:url.href,title:link.textContent},location.origin);return;}
    showView(url,link,link.textContent);
  });
  addEventListener('message',event=>{
    if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow||typeof event.data?.portalView!=='string')return;
    showView(new URL(event.data.portalView),null,event.data.title);
  });
  function restoreView(){
    const value=new URL(location.href).searchParams.get('view');
    if(value){const url=new URL(value,location.href);viewerTrail=history.state?.portalTrail||[url.href];showView(url,null,'内容と操作',false);}
    else if(viewer?.open)viewer.close();
  }
  addEventListener('popstate',restoreView);
  restoreView();
  function openDetail(record, button) {
    if (!dialog) return;
    origin = button;
    document.getElementById('pu-detail-title').textContent = record.title || record.kind;
    document.getElementById('pu-detail-data').textContent = JSON.stringify(record, null, 2);
    dialog.showModal();
  }
  if (dialog) {
    document.getElementById('pu-detail-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => origin?.focus());
  }
  const target = new URL(location.href).searchParams.get('item');
  if (target) {
    const element = document.querySelector(`[data-portal-item="${CSS.escape(target)}"]`);
    if (element) {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      element.classList.add('pu-selected');
      element.tabIndex = -1;
      element.focus({preventScroll:true});
      element.scrollIntoView({block:'center'});
    }
  }
  const form = document.getElementById('pu-form');
  if (!form || !data) return;
  const query = document.getElementById('pu-query');
  const category = document.getElementById('pu-category');
  const type = document.getElementById('pu-type');
  const results = document.getElementById('pu-results');
  const count = document.getElementById('pu-count');
  const more = document.getElementById('pu-more');
  let limit = 40;
  const params = new URLSearchParams(location.search);
  query.value = params.get('q') || '';
  for (const [field, key] of [[category,'category'],[type,'type']]) {
    field.value = [...field.options].some(option => option.value === params.get(key)) ? params.get(key) : '';
  }
  const make = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  function draw(updateUrl = true) {
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = data.items.filter(row => (!category.value || row.category === category.value) &&
      (!type.value || row.kind === type.value) && terms.every(term => [row.text,row.pageTitle,row.title,...Object.values(row.attributes||{})].join(' ').toLocaleLowerCase().includes(term)));
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [key, value] of [['q',query.value],['category',category.value],['type',type.value]]) {
        if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);
      }
      history.replaceState(null,'',url);
    }
    count.textContent = `${rows.length.toLocaleString()}件 / 全${data.items.length.toLocaleString()}件。${Math.min(limit,rows.length)}件を表示。`;
    results.replaceChildren();
    if (!rows.length) results.append(make('li','条件に合う項目はありません。語句や分類を変えるか、条件を解除してください。','pu-result'));
    for (const row of rows.slice(0,limit)) {
      const li = make('li',undefined,'pu-result');
      li.id = 'result-' + row.key;
      li.append(make('p', `${row.category} · ${row.kindLabel} · ${row.pageTitle}`, 'pu-meta'));
      const heading = make('h2');
      const link = make('a',row.title || row.pageTitle);
      const url = new URL(row.target, location.href);
      url.searchParams.set('item',row.key);
      link.href = url.href;
      heading.append(link);li.append(heading);
      if (row.text) li.append(make('p',row.text.length>240?row.text.slice(0,240)+'…':row.text));
      const actions = make('div',undefined,'pu-actions');
      actions.append(make('a','内容と操作を開く'));
      actions.lastChild.href = link.href;
      const details = make('button','原文・出典・元データ');details.type='button';
      details.addEventListener('click',()=>openDetail(row,details));actions.append(details);li.append(actions);
      results.append(li);
    }
    more.hidden = rows.length <= limit;
  }
  form.addEventListener('submit',event=>{event.preventDefault();limit=40;draw();});
  for (const input of [query,category,type]) input.addEventListener(input===query?'input':'change',()=>{limit=40;draw();});
  document.getElementById('pu-reset').addEventListener('click',()=>{form.reset();query.value='';category.value='';type.value='';limit=40;draw();query.focus();});
  more.addEventListener('click',()=>{limit+=40;draw(false);});
  addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);query.value=p.get('q')||'';category.value=p.get('category')||'';type.value=p.get('type')||'';draw(false);});
  draw(false);
  const initial = params.get('record');
  const record = initial && data.items.find(row=>row.key===initial);
  if(record) openDetail(record,query);
})();
