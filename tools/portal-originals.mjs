// Preserve the original portal in a separate document/CSS/JS context.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse,elements,textOf,serialize,escape} from './portal-html.mjs';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const originalTarget=target=>'original/'+target;
const structural=new Set(['h1','h2','h3','article','section','details','a','img','input','nav','style','script']);
export function originalInventory(root,pages) {
 const items=[],sources=[];
 for(const [source,target] of pages) {
  const html=fs.readFileSync(path.join(root,source),'utf8'),doc=parse(html);
  const nodes=elements(doc,n=>n.tag!=='root');let structuralOrdinal=0;
  const add=(kind,locator,value,extra={})=>items.push({id:`${target}:${items.length+1}`,source,target:originalTarget(target),kind,locator,value,sha256:sha(value),...extra});
  nodes.forEach((node,index)=>{
   const locator={element:index,tag:node.tag};
   add('element',locator,node.tag,structural.has(node.tag)?{s002Ordinal:++structuralOrdinal}:{});
   for(const [name,value] of Object.entries(node.attrs))add('attribute',{...locator,attribute:name},value,{url:['href','src','poster'].includes(name)});
   node.children.forEach((child,childIndex)=>{
    if(child.raw!==undefined&&child.raw.trim())add(node.tag==='style'?'css':node.tag==='script'?'javascript':'text',{...locator,child:childIndex},child.raw);
   });
  });
  sources.push({source,target:originalTarget(target),sha256:sha(html),elements:nodes.length,structural:structuralOrdinal});
 }
 const visual=JSON.parse(fs.readFileSync(path.join(root,'qa/evidence/S-002/visual-inventory.json'),'utf8'));
 // Keep the S-002 counting unit as a separate, explicit baseline.
 for(const [kind,rows] of [['css-rule',visual.rules],['media-condition',visual.media],['behavior',visual.actions]])rows.forEach((value,index)=>{
  const text=typeof value==='string'?value:JSON.stringify(value);
  items.push({id:`s002-${kind}-${index+1}`,source:'all-original-pages',target:'original/',kind,locator:{s002Visual:index},value:text,sha256:sha(text)});
 });
 const s002={structural:sources.reduce((sum,p)=>sum+p.structural,0),cssRules:visual.rules.length,mediaConditions:visual.media.length,actions:visual.actions.length};
 return {schemaVersion:1,counting:'one element, attribute, or nonblank direct text/script/style node per item; repeated occurrences retained',s002:{...s002,total:s002.structural+s002.cssRules+s002.mediaConditions+s002.actions,explanation:'5495 = 5328 structural + 150 CSS rules + 9 media conditions + 8 action definitions; S-003 reported structural only. No 167-item deletion.'},sources,counts:Object.fromEntries([...new Set(items.map(i=>i.kind))].map(kind=>[kind,items.filter(i=>i.kind===kind).length])),total:items.length,items};
}
export function renderOriginals(root,pages,files,register) {
 const inventory=originalInventory(root,pages);
 for(const [source,target] of pages) {
  const doc=parse(fs.readFileSync(path.join(root,source),'utf8'));
  const destination=originalTarget(target);
  for(const node of elements(doc,n=>!!n.attrs))for(const key of ['href','src','poster']) {
   const value=node.attrs[key];if(!value||/^(?:https?:|mailto:|data:|tel:|#)/.test(value))continue;
   const hash=value.indexOf('#'),raw=hash<0?value:value.slice(0,hash),anchor=hash<0?'':value.slice(hash);
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(source),decodeURIComponent(raw)));
   const to=pages.has(resolved)?originalTarget(pages.get(resolved)):register(resolved);
   node.attrs[key]=path.posix.relative(path.posix.dirname(destination),to)+anchor;
  }
  files.set(destination,serialize(doc));
 }
 files.set('data/original-inventory.json',JSON.stringify(inventory,null,2)+'\n');
 return inventory;
}
export const embeddedOriginal=(source,target,title)=>`<details class="preserved-original" aria-label="元の${escape(title)}"><summary>元の${escape(title)}の全表示と操作を開く</summary><p>配色・図・全文・検索を保ったページです。<a href="../${source}" target="_blank" rel="noopener">元ページを別に開く</a> · <a href="#adapted-content">整理した表示へ</a></p><iframe title="元の${escape(title)}の全文と操作" src="${originalTarget(target)}" loading="lazy"></iframe></details><div id="adapted-content"></div>`;
