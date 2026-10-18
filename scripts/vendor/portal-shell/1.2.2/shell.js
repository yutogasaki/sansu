/* Shared navigation. Native categories and controls are retained in their groups. */
(function(){
 'use strict';
 const projects=[['hub','すべてのプロジェクト','/','hub'],['keep-going','KeepGoing','/repos/keep-going/portal/index.html','keep-going'],['jishu','JISHU','/repos/jishu/portal/index.html','Jishu'],['sansu','Sansu','/repos/sansu/portal/index.html','sansu'],['ayami-ballet','AYAMI BALLET','/repos/ayami-ballet/portal/index.html','ayami-ballet'],['mmmind','MMmind','/repos/mmmind/portal/index.html','MMmind'],['noren-studio','noren','/repos/noren-studio/portal/index.html','noren-studio'],['cast-life','CAST LIFE','/repos/cast-life/portal/index.html','cast-life'],['business','Business','/repos/business/index.html','Business']];
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function localNavigation(source){
  const groups=[],notices=[],seen=new Set();
  for(const node of source){
   if(node.matches('.pu-bar,.pi-module-nav'))for(const p of node.querySelectorAll('p'))if(p.textContent.trim())notices.push(p.textContent.trim());
   const navs=[...node.querySelectorAll('nav')];
   for(const container of navs.length?[...navs,node]:[node]){
    const links=[];
    for(const a of container.querySelectorAll('a[href]')){
     if(container===node&&navs.some(nav=>nav.contains(a)))continue;
     const key=a.href+'\n'+a.textContent.trim();if(!a.textContent.trim()||seen.has(key))continue;seen.add(key);links.push(a);
    }
    if(links.length)groups.push({label:container.getAttribute('aria-label')||node.getAttribute('aria-label')||(node.matches('header')?'このページ':'関連するページ'),links});
   }
  }
  return {groups,notices};
 }
 function fillMenu(header,groups){
  header.querySelector('.ps-local-menu')?.remove();if(!groups?.length)return;
  const more=make('details',null,'ps-local-menu');more.append(make('summary','すべてのページ'));
  const menu=make('nav',null,'ps-dropdown');menu.setAttribute('aria-label','このリポジトリのページ');
  for(const group of groups){const section=make('section',null,'ps-menu-group');section.append(make('p',group.label,'ps-menu-label'));for(const item of group.links){const a=item instanceof HTMLAnchorElement?item:make('a',item.label);if(!(item instanceof HTMLAnchorElement))a.href=item.href;a.className='';section.append(a);}menu.append(section);}
  more.append(menu);header.querySelector('.ps-line').append(more);
 }
 function renderNotice(header,notices,groups){
  header.querySelector('.ps-review-note')?.remove();if(!notices?.length)return;
  const note=make('div',null,'ps-review-note'),details=make('details');details.append(make('summary','新しい画面を確認中'));
  for(const text of [...new Set(notices)])details.append(make('p',text));note.append(details);
  const links=(groups||[]).flatMap(g=>g.links),original=links.find(a=>/元の画面|元のポータル|元の入口|元ページ/.test(a.label||a.textContent));
  if(original){const a=make('a','元の画面');a.href=original.href;note.append(a);}header.append(note);
 }
 function mount(config){
  if(document.getElementById('portal-shell'))return;
  const body=document.body,source=[...body.children].filter(e=>e.matches('header,aside.pu-bar,aside.pi-module-nav'));
  if(config.slug==='noren-studio')source.push(...document.querySelectorAll('body>.layout>aside'));
  const {groups,notices}=localNavigation(source);
  if(window.parent!==window&&window.frameElement?.hasAttribute('data-portal-content')){
   const controls=source.flatMap(node=>[...node.querySelectorAll('form,button,input,select,textarea')].filter(e=>!e.parentElement.closest('form')));
   if(controls.length){const tools=make('div',null,'ps-content-tools');tools.append(...controls);body.prepend(tools);}
   globalThis.PortalShellEmbedded={config,groups:groups.map(g=>({label:g.label,links:g.links.map(a=>({label:a.textContent.trim(),href:a.href}))})),notices};
   const preserved=make('template');preserved.id='portal-source-navigation';for(const node of source)preserved.content.append(node);body.prepend(preserved);
   document.documentElement.dataset.portalShellReady='true';return;
  }
  const header=make('header',null,'ps-header');header.id='portal-shell';
  const line=make('div',null,'ps-line'),identity=make('div',null,'ps-identity');
  const local=location.protocol==='file:';
  const direct=/^\/(?:repos|view)\//.test(location.pathname)||config.slug==='hub';
  const workspace=local?new URL(config.workspaceHref||'index.html',location.href):new URL('/',direct?location.origin:'http://127.0.0.1:47860');
  const hub=make('a','Workspace','ps-hub');hub.href=workspace.href;hub.setAttribute('aria-label','ハブの全プロジェクトへ');identity.append(hub,make('span','/','ps-divider'));
  const project=make('details',null,'ps-project-menu'),summary=make('summary',config.title);summary.append(make('span','⌄','ps-chevron'));project.append(summary);
  const list=make('nav',null,'ps-dropdown');list.setAttribute('aria-label','プロジェクトを切り替える');
  for(const [slug,title,route,directory]of projects){const a=make('a',title);a.href=local?(slug==='hub'?workspace.href:new URL('../../'+directory+'/'+(slug==='business'?'index.html':'portal/index.html'),workspace).href):new URL(route,workspace).href;if(slug===config.slug)a.setAttribute('aria-current','page');list.append(a);}project.append(list);identity.append(project);line.append(identity);
  const nav=make('nav',null,'ps-nav');nav.setAttribute('aria-label','主要ページ');
  for(const link of config.links){const a=make('a',link.label);a.href=link.href;nav.append(a);}line.append(nav);header.append(line);body.prepend(header);
  fillMenu(header,groups);
  // Forms and buttons in a native header keep their existing handlers and labels.
  const controls=source.flatMap(node=>[...node.querySelectorAll('form,button,input,select,textarea')].filter(e=>!e.parentElement.closest('form')));
  if(controls.length){let menu=header.querySelector('.ps-local-menu .ps-dropdown');if(!menu){fillMenu(header,[{label:'表示と操作',links:[]}]);menu=header.querySelector('.ps-local-menu .ps-dropdown');}for(const control of controls)menu.append(control);}
  for(const node of source)node.remove();
  renderNotice(header,notices,groups);
  document.documentElement.dataset.portalShellReady='true';
  const normalized=url=>{const u=new URL(url);u.pathname=u.pathname.replace(/^\/view\//,'/repos/').replace(/\/index\.html$/,'/');return u;};
  function current(){const url=normalized(location.href);for(const [index,a]of [...nav.querySelectorAll('a')].entries()){const target=normalized(a.href);const active=target.pathname===url.pathname&&(target.hash?target.hash===url.hash||(!url.hash&&index===0):!url.hash);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}}
  current();addEventListener('hashchange',current);addEventListener('popstate',current);addEventListener('portal:location',current);
  header.addEventListener('keydown',event=>{if(event.key==='Escape'){for(const d of header.querySelectorAll('details[open]')){d.open=false;d.querySelector('summary').focus();}event.stopPropagation();}});
  document.addEventListener('click',event=>{for(const d of header.querySelectorAll('details[open]'))if(!d.contains(event.target))d.open=false;});
 }
 globalThis.PortalShell=Object.freeze({version:'1.2.2',mount,fillMenu,renderNotice});
 const data=document.getElementById('portal-shell-config');if(data)mount(JSON.parse(data.textContent));
 if(window.parent===window&&!document.getElementById('portal-viewer-data'))document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const a=event.target.closest?.('a[href]');if(!a||!a.closest('#portal-shell,[data-directory-repo]')||a.hasAttribute('download')||a.target==='_blank')return;
  const u=new URL(a.href);if(!u.pathname.startsWith('/repos/')||u.origin!==location.origin||!/^https?:$/.test(u.protocol))return;
  event.preventDefault();location.assign(u.origin+u.pathname.replace(/^\/repos\//,'/view/')+u.search+u.hash);
 });
})();
