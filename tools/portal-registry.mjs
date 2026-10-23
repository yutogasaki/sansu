// Lossless records on demand; fixed vendors still receive the full in-memory model.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function decodeShard(bytes,descriptor){
 if(hash(bytes)!==descriptor.sha256)throw Error('Registry shard hash mismatch: '+descriptor.path);
 const match=String(bytes).match(/^window\.__sansuRegistryChunks\[("[^"]+")\]=("[A-Za-z0-9+/=]+")\s*;\n?$/);
 if(!match||JSON.parse(match[1])!==descriptor.id)throw Error('Invalid registry shard');
 const rows=JSON.parse(gunzipSync(Buffer.from(JSON.parse(match[2]),'base64')));
 if(!Array.isArray(rows)||rows.length!==descriptor.count)throw Error('Registry shard count mismatch');
 return rows;
}
export function hydrateRegistry(catalog,read){
 if(Array.isArray(catalog.items))return catalog;
 if(catalog.itemStorage?.format!=='sansu-record-shards/1')throw Error('Unsupported registry storage');
 const {itemStorage,...metadata}=catalog;
 const items=itemStorage.shards.flatMap(d=>{
  if(!/^data\/records\/[a-f0-9]+\.js$/.test(d.path))throw Error('Unsafe registry shard');
  return decodeShard(read(d.path),d);
 });
 if(items.length!==itemStorage.count)throw Error('Registry item count mismatch');
 return {...metadata,items};
}
export function readRegistry(file){
 const base=path.dirname(path.dirname(file));
 return hydrateRegistry(JSON.parse(fs.readFileSync(file)),name=>fs.readFileSync(path.join(base,name)));
}
export function packRegistry(registry,{chunkSize=512}={}){
 const {items,...metadata}=registry,files=new Map(),shards=[],projection=[];
 for(let start=0;start<items.length;start+=chunkSize){
  const rows=items.slice(start,start+chunkSize),id=hash(JSON.stringify(rows)).slice(0,24),name='data/records/'+id+'.js';
  const body='window.__sansuRegistryChunks['+JSON.stringify(id)+']='+JSON.stringify(gzipSync(Buffer.from(JSON.stringify(rows)),{level:9}).toString('base64'))+';\n';
  const descriptor={id,path:name,count:rows.length,sha256:hash(body)};shards.push(descriptor);files.set(name,body);
  for(const row of rows){
   const title=row.humanTitle||row.title||row.kindLabel,pageTitle=row.humanPageTitle||row.pageTitle;
   // Keep full search terms; raw fields/unknown properties live unchanged in shards.
   const haystack=[row.text,row.pageTitle,row.title,...Object.values(row.attributes||{})].join(' ').normalize('NFKC').toLocaleLowerCase();
   const meaningful=row.kind!=='code'&&!(row.humanTitle||'').endsWith('操作定義')&&(row.kind!=='text'||(['p','li','blockquote','figcaption','td','th'].includes(row.tag)&&(row.text||'').trim().length>20))&&!['html','body','nav','header','footer','script','style'].includes(row.tag)&&!/^\s*(?:const |let |function |document\.|window\.|@media|[.#][\w-]+\s*\{)/.test(row.text||'')&&!/^(?:本文へ|概要|計画|仕事|判断|資料|検索|戻る|目次|知識・仕様|役割・手順|運用|すべてのページ)$/.test(row.title||'');
   projection.push({key:row.key,target:row.target,category:row.category,kind:row.kind,kindLabel:row.kindLabel,pageTitle,title,text:(row.humanText??row.text??'').slice(0,240),haystack,meaningful,__shard:id});
  }
 }
 const metaId=hash(JSON.stringify(metadata)).slice(0,24),metaPath='data/records/'+metaId+'.js';
 const metaBody='window.__sansuRegistryChunks['+JSON.stringify(metaId)+']='+JSON.stringify(gzipSync(Buffer.from(JSON.stringify([metadata])),{level:9}).toString('base64'))+';\n';
 files.set(metaPath,metaBody);
 const catalog={...metadata,itemStorage:{format:'sansu-record-shards/1',count:items.length,shards,metadata:{id:metaId,path:metaPath,count:1,sha256:hash(metaBody)}}};
 files.set('data/unification.json',JSON.stringify(catalog)+'\n');
 files.set('registry-index.js','window.__sansuRegistryStorage='+JSON.stringify(catalog.itemStorage)+';\n');
 files.set('search-data.js','window.__portalSearchGzip='+JSON.stringify(gzipSync(Buffer.from(JSON.stringify({items:projection})),{level:9}).toString('base64'))+';\n');
 return {catalog,files};
}
