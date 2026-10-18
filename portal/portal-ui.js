/* Portal chrome has no page viewer: ordinary links use browser navigation. */
(() => {
 'use strict';
 const data=document.getElementById('portal-ui-config');if(!data)return;
 const config=JSON.parse(data.textContent),header=document.getElementById('portal-ui'),main=document.querySelector('[data-portal-main]');
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 // Page-specific links belong to the content, never to the fixed page menu.
 const sources=[...document.body.children].filter(e=>e!==header&&e.matches('header,aside.pu-bar,aside.pi-module-nav'));
 if(sources.length&&main){
  const local=make('details',null,'pui-page-tools');local.append(make('summary','このページの目次と関連リンク'));
  const nav=make('nav');nav.setAttribute('aria-label','このページの目次と関連リンク');
  const seen=new Set(),notices=[];
  for(const source of sources){
   for(const a of source.querySelectorAll('a[href]')){if(a.hasAttribute('data-json-view'))continue;const key=a.href+'\n'+a.textContent.trim();if(!a.textContent.trim()||seen.has(key))continue;seen.add(key);nav.append(a);}
   for(const e of source.querySelectorAll('form,button,input,select,textarea'))if(!e.parentElement.closest('form'))nav.append(e);
   if(source.matches('.pu-bar,.pi-module-nav'))for(const p of source.querySelectorAll('p'))if(p.textContent.trim())notices.push(p);
   source.remove();
  }
  local.append(nav,...notices);if(nav.childElementCount||notices.length)main.prepend(local);
 }
 // Static file links remain useful without a local server. HTTP repo routes
 // are changed only in this project's switcher, never in product content.
 if(/^https?:$/.test(location.protocol)){
  const direct=/^\/(?:repos|view)\//.test(location.pathname)||config.slug==='hub';
  const workspace=new URL('/index.html',direct?location.origin:'http://127.0.0.1:47860');
  header.querySelector('.pui-hub').href=workspace.href;
  for(const a of header.querySelectorAll('[data-portal-project]')){
   if(config.slug==='hub')continue; // Hub renders its actual available entries.
   const slug=a.dataset.portalProject;
   a.href=new URL(slug==='hub'?'/index.html':'/repos/'+slug+'/'+(slug==='business'?'index.html':'portal/index.html'),workspace).href;
  }
 }
 function current(){
  const url=new URL(location.href),canonical=u=>u.pathname.replace(/\/index\.html$/,'/');
  const nav=[...header.querySelectorAll('.pui-nav a')];
  const same=nav.filter(a=>canonical(new URL(a.href))===canonical(url));
  const chosen=same.find(a=>new URL(a.href).hash===url.hash)||(!url.hash?same[0]:null);
  for(const a of nav)if(a===chosen)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
 }
 current();addEventListener('hashchange',current);addEventListener('popstate',current);
 header.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const d=event.target.closest('details[open]');if(d){d.open=false;d.querySelector('summary').focus();event.stopPropagation();}});
 document.addEventListener('click',event=>{for(const d of header.querySelectorAll('details[open]'))if(!d.contains(event.target))d.open=false;});
 header.addEventListener('toggle',event=>{if(event.target.open)for(const d of header.querySelectorAll('details[open]'))if(d!==event.target)d.open=false;},true);
 globalThis.PortalUI=Object.freeze({version:config.version});
})();
