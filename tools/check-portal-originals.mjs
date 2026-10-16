import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parse,elements} from './portal-html.mjs';
import {originalInventory,originalTarget} from './portal-originals.mjs';
export function compareOriginal(sourceHtml,targetHtml,source,target,pages) {
 const before=elements(parse(sourceHtml),n=>n.tag!=='root'),after=elements(parse(targetHtml),n=>n.tag!=='root');
 assert.equal(after.length,before.length,source+': all elements');
 for(let i=0;i<before.length;i++) {
  const a=before[i],b=after[i];assert.equal(b.tag,a.tag,source+': tag '+i);
  assert.deepEqual(Object.keys(b.attrs),Object.keys(a.attrs),source+': attribute membership '+i);
  for(const [key,value] of Object.entries(a.attrs)) {
   if(!['href','src','poster'].includes(key)||!value||/^(?:https?:|mailto:|data:|tel:|#)/.test(value))assert.equal(b.attrs[key],value,`${source}: ${key} ${i}`);
   else {
    const old=new URL(value,'https://local.invalid/'+source);
    const next=new URL(b.attrs[key],'https://local.invalid/portal/'+originalTarget(target));
    const oldPath=decodeURIComponent(old.pathname.slice(1));
    const expected=pages.has(oldPath)?'/portal/'+originalTarget(pages.get(oldPath)):'/'+oldPath;
    assert.equal(decodeURIComponent(next.pathname),expected,source+': URL destination '+i);assert.equal(next.hash,old.hash,source+': URL anchor '+i);
   }
  }
  assert.deepEqual(b.children.filter(n=>n.raw!==undefined).map(n=>n.raw),a.children.filter(n=>n.raw!==undefined).map(n=>n.raw),source+': direct text/style/script '+i);
 }
 return after.length;
}
export function checkOriginals(root,pages) {
 const inventory=originalInventory(root,pages),out=path.join(root,'portal');
 const frozen=JSON.parse(fs.readFileSync(path.join(root,'qa/evidence/S-002/visual-inventory.json'),'utf8'));
 const sourceCss=[...pages.keys()].map(source=>fs.readFileSync(path.join(root,source),'utf8')).join('\n');
 for(const rule of frozen.rules)assert(sourceCss.includes(rule.selector+'{'+rule.declarations+'}'),'S-002 CSS rule remains in original context');
 for(const media of frozen.media)assert(sourceCss.includes(media),'S-002 media rule remains in original context');
 const actual=JSON.parse(fs.readFileSync(path.join(out,'data/original-inventory.json'),'utf8'));
 assert.deepEqual(actual,inventory,'all inventory rows exactly match current original sources');
 // Explicit discovery prevents a newly added old portal page from being skipped.
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.html')?[path.relative(root,path.join(dir,e.name))]:[]);
 assert.deepEqual(walk(path.join(root,'.agents')).sort(),[...pages.keys()].filter(p=>p.startsWith('.agents/')).sort(),'all .agents HTML pages covered');
 let preserved=0;
 for(const [source,target] of pages) {
  const before=fs.readFileSync(path.join(root,source),'utf8'),after=fs.readFileSync(path.join(out,originalTarget(target)),'utf8');
  preserved+=compareOriginal(before,after,source,target,pages);
  const human=parse(fs.readFileSync(path.join(out,target),'utf8'));
  const frame=elements(human,n=>n.tag==='iframe'&&n.attrs.src===originalTarget(target));
  assert.equal(frame.length,1,'same-page original exists: '+target);assert(!('hidden' in frame[0].attrs));
 }
 const first=[...pages][0],source=fs.readFileSync(path.join(root,first[0]),'utf8'),target=fs.readFileSync(path.join(out,originalTarget(first[1])),'utf8');
 for(const corrupt of [target.replace('<h1>','<h4>'),target.replace('color-scheme:light','color-scheme:dark'),target.replace("addEventListener('input'","addEventListener('change'")]) {
  assert.notEqual(corrupt,target,'negative fixture must mutate the output');
  assert.throws(()=>compareOriginal(source,corrupt,...first,pages),'missing content, CSS drift and JS behavior drift fail');
 }
 console.log(`PASS: original portal ${pages.size} pages, ${inventory.total} inventory items, ${preserved} elements, exact CSS/JS/text/attributes and URL destinations`);
 return {pages:pages.size,items:inventory.total,preserved};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const {destinations}=await import('./integrated-portal.mjs');checkOriginals(path.resolve(fileURLToPath(new URL('../',import.meta.url))),destinations);
}
