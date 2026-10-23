// Script transport also works on file://; no personal storage or external sends.
(() => {
 'use strict';
 const base=new URL('.',document.currentScript.src),pending=new Map(),cache=new Map();
 window.__sansuRegistryChunks=Object.create(null);
 async function chunk(id){
  if(cache.has(id))return cache.get(id);
  if(pending.has(id))return pending.get(id);
  const storage=window.__sansuRegistryStorage;
  const descriptor=storage&&[...storage.shards,storage.metadata].find(row=>row.id===id);
  if(!descriptor)throw Error('原文の場所が見つかりません。再生成または元の資料を確認してください。');
  const promise=(async()=>{
   await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(descriptor.path,base);script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(Error('原文を読み込めません。元の資料へ戻るか、再読み込みしてください。'));};document.head.append(script);});
   const packed=window.__sansuRegistryChunks[id];delete window.__sansuRegistryChunks[id];
   const bytes=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
   const rows=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
   if(rows.length!==descriptor.count)throw Error('原文の件数が一致しません。再生成してください。');
   cache.set(id,rows);if(cache.size>8)cache.delete(cache.keys().next().value);return rows;
  })();
  pending.set(id,promise);try{return await promise;}finally{pending.delete(id);}
 }
 window.SansuRegistry={
  async record(id,key){const row=(await chunk(id)).find(r=>r.key===key);if(!row)throw Error('原文の項目が見つかりません。');return row;},
  async full(){
   const itemStorage=window.__sansuRegistryStorage;
   const [metadata]=await chunk(itemStorage.metadata.id);const items=[];
   for(const d of itemStorage.shards)items.push(...await chunk(d.id));
   return {...metadata,items};
  }
 };
})();
