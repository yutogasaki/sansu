// Project accessibility and restorable detail state around the pinned UI.
(() => {
 const fallback=()=>document.querySelector('#pu-query,.pu-bar a,h1');
 const observed=new WeakSet();
 const watch=dialog=>{
  if(observed.has(dialog))return;observed.add(dialog);
  const reflect=()=>{
   if(dialog.id!=='pu-detail')return;
   const url=new URL(location.href);
   if(dialog.open){
    try{const row=JSON.parse(document.getElementById('pu-detail-data').textContent);if(row.key)url.searchParams.set('record',row.key);}catch{return;}
   }else url.searchParams.delete('record');
   history.replaceState(history.state,'',url);
  };
  new MutationObserver(reflect).observe(dialog,{attributes:true,attributeFilter:['open']});
  dialog.addEventListener('close',()=>{reflect();if(!document.activeElement||document.activeElement===document.body)fallback()?.focus();});
  if(dialog.open)reflect();
 };
 const update=()=>{
  document.querySelectorAll('dialog').forEach(watch);
  document.querySelectorAll('.pu-document table:not([tabindex])').forEach(table=>{table.tabIndex=0;table.setAttribute('role','region');table.setAttribute('aria-label','資料の表。左右のキーで読む');});
 };
 new MutationObserver(update).observe(document.body,{childList:true,subtree:true});update();
})();
