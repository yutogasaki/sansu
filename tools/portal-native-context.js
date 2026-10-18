// Route links created by native scripts through the integrated library. Their
// images, fetches, fonts and storage retain the original document context.
(() => {
 const script=document.currentScript;
 const portal=new URL('.',script.src),repo=new URL('../',portal);
 document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||link.hasAttribute('download'))return;
  const url=new URL(link.href);
  if(url.origin!==repo.origin||!url.pathname.startsWith(repo.pathname))return;
  const source=decodeURIComponent(url.pathname.slice(repo.pathname.length));
  const target=window.sansuNativeRoutes[source];
  const next=target?new URL(target,portal):url;
  if(target){next.search=url.search;next.hash=url.hash;link.href=next.href;}
  if(next.pathname===location.pathname&&next.search===location.search&&next.hash){
   const element=document.getElementById(decodeURIComponent(next.hash.slice(1)));
   if(element){event.preventDefault();event.stopImmediatePropagation();history.pushState(null,'',next);element.scrollIntoView();element.tabIndex=-1;element.focus({preventScroll:true});}
  }
 },true);
})();
