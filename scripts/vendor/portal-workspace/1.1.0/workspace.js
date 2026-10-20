/* One navigation DOM; view selection does not change canonical work state. */
(()=>{'use strict';
 const here=new URL(location.href),script=document.querySelector('script[src$="workspace.js"]'),baseURL=new URL('.',script.src),legacy=here.searchParams.get('view');
 if(legacy){const target=new URL(legacy,baseURL);if(target.origin===baseURL.origin&&target.pathname.startsWith(baseURL.pathname)&&target.pathname.endsWith('.html')){target.searchParams.delete('view');location.replace(target.href);return;}here.searchParams.delete('view');history.replaceState(null,'',here);}
 if(here.pathname.endsWith('/index.html')){const alias={decisions:'decisions.html',tasks:'work.html#all-work','task-table':'work.html#all-work',documents:'library.html','native-modules':'library.html',pinned:'library.html',ai:'ai.html','ai-environment':'ai.html',flow:'work.html#all-work'}[here.hash.slice(1)];if(alias){const target=new URL(alias,baseURL);const work=here.searchParams.get('work');if(work)target.searchParams.set('work',work);location.replace(target.href);return;}}
 
 const panel=document.querySelector('.workspace-panel'),host=document.querySelector('.workspace-host'),dialog=document.querySelector('#workspace-menu'),toggle=document.querySelector('.workspace-toggle');
 if(panel&&host&&dialog&&toggle){
  const narrow=matchMedia('(max-width:760px)');let restore=true;
  const close=(focus=true)=>{restore=focus;if(dialog.open)dialog.close();toggle.setAttribute('aria-expanded','false');};
  const sync=()=>{close(false);(narrow.matches?dialog:host).append(panel);};
  toggle.addEventListener('click',()=>{restore=true;dialog.showModal();toggle.setAttribute('aria-expanded','true');panel.querySelector('[data-workspace-close]').focus();});
  panel.querySelector('[data-workspace-close]').addEventListener('click',()=>close());
  dialog.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');if(restore&&narrow.matches)toggle.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  panel.addEventListener('click',e=>{if(e.target.closest('a,[data-jump]'))close(false);},true);
  dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const els=[...panel.querySelectorAll('a[href],button,summary')].filter(x=>x.getClientRects().length&&!x.disabled),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  document.addEventListener('keydown',e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);if(dialog.open&&((e.key==='/'&&!typing)||(e.key==='k'&&(e.ctrlKey||e.metaKey))))close(false);},true);
  narrow.addEventListener('change',sync);document.documentElement.classList.add('workspace-ready');sync();
 }
 const allowed=JSON.parse(document.querySelector('#workspace-work-ids')?.textContent||'[]'),refs=JSON.parse(document.querySelector('#workspace-work-refs')?.textContent||'{}');
 const carry=id=>{for(const a of document.querySelectorAll('[data-workspace-link]')){const u=new URL(a.href);if(id&&allowed.includes(id)){u.searchParams.set('work',id);u.hash=u.pathname.endsWith('/index.html')?'':'selected-work';}else{u.searchParams.delete('work');u.hash='';}a.href=u.href;}};
 const select=document.querySelector('[data-workspace-work]'),cases=[...document.querySelectorAll('[data-workspace-case]')];
 if(!select)carry(new URL(location.href).searchParams.get('work'));
 if(select){
  const links=[...document.querySelectorAll('[data-workspace-link]')].map(a=>({a,href:a.href}));
  function apply(){const query=new URL(location.href).searchParams.get('work'),inferred=allowed.find(id=>location.hash==='#task-'+id.toLowerCase()),id=query===null?(inferred||select.value):query,found=cases.find(c=>c.dataset.workspaceCase===id);select.value=found?id:'';for(const button of document.querySelectorAll('[data-context-open]'))button.disabled=!found;for(const c of cases)c.hidden=c!==found;const missing=document.querySelector('[data-workspace-missing]');if(missing)missing.hidden=!!found;
   carry(found?id:null);
   const s=document.querySelector('[data-workspace-status]');if(s)s.textContent=found?'選択中：'+id+'。表示だけを切り替えます。仕事・判断の状態は変更しません。':'対象の仕事を確認できません。一覧から選ぶか、正本を確認してください。';
  }
  select.addEventListener('change',()=>{const u=new URL(location.href);u.searchParams.set('work',select.value);u.hash='selected-work';history.pushState(null,'',u);apply();});addEventListener('popstate',apply);select.disabled=false;apply();
 }
 // Existing copy-only handoff follows the work selected in this workspace.
 document.addEventListener('click',e=>{
  if(!e.target.closest('[data-context-open]')||!select)return;
  const target=document.querySelector('#context-target'),ref=refs[select.value];if(!target)return;
  const valid=allowed.includes(select.value)&&ref&&[...target.options].some(o=>o.value===ref);
  target.value=valid?ref:'';target.dispatchEvent(new Event('input',{bubbles:true}));
  const preview=document.querySelector('[data-context-preview]');if(preview)preview.disabled=!valid;
  if(!valid){const status=document.querySelector('#context-status');if(status)status.textContent='選択した仕事の参照先を確認できません。正本を確認してください。';}
 });
 function reveal(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const el=id&&document.getElementById(id);if(!el)return;for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;const detail=el.querySelector(':scope>details');if(detail)detail.open=true;requestAnimationFrame(()=>el.scrollIntoView({block:'start'}));}
 addEventListener('hashchange',reveal);if(location.hash)reveal();
 const jump=document.querySelector('#jump .jump-list');if(jump)new MutationObserver(()=>{if(!jump.querySelector('.jump-empty')||jump.querySelector('[data-workspace-fallback]'))return;const li=document.createElement('li');li.dataset.workspaceFallback='';li.innerHTML='<p>索引にない資料もあります。0件は情報がないことを意味しません。</p>';for(const [href,title]of [['library.html','資料一覧へ'],['work.html','仕事一覧へ']]){const a=document.createElement('a');a.href=(document.documentElement.dataset.base||'')+href;a.textContent=title;li.append(a);}jump.append(li);}).observe(jump,{childList:true});
})();
